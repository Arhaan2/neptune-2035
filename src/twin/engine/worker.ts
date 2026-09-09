import type { SimulationState, WorkerRequest, WorkerResponse } from '../types';
import {
  CONTRACT,
  INTEGRATION_STEPS,
  type IntegrationStep,
} from '../persistence/limits';
import { diagnosticFor, failure, finiteNumber } from '../safety';
import {
  advance,
  advanceWithStep,
  initialize,
  validateEvent,
} from './simulation';
import { validateState } from '../persistence/state';
import { validateDesign } from '../persistence/design';

/** Chunk and progress timing only bound work; the persisted integration grid owns simulated time. */
export function createWorkerHandler(
  post: (response: WorkerResponse) => void,
  yieldTask: () => Promise<void> = () =>
    new Promise((resolve) => setTimeout(resolve, 0)),
  now: () => number = () => performance.now(),
) {
  let activeEpoch = -1,
    lastRequestId = -1,
    token = 0;
  let latest: SimulationState | undefined;
  let latestProgress: WorkerResponse['progress'];
  return async (request: WorkerRequest): Promise<void> => {
    if (!request || typeof request !== 'object') {
      post({
        version: 2,
        requestId: -1,
        epoch: -1,
        status: 'failed',
        error: 'Worker request must be an object.',
        diagnostic: {
          kind: 'invalid-input',
          code: 'WORKER_REQUEST',
          message: 'Worker request must be an object.',
        },
      });
      return;
    }
    const response = {
      version: 2 as const,
      requestId: Number.isSafeInteger(request.requestId)
        ? request.requestId
        : -1,
      epoch: Number.isSafeInteger(request.epoch) ? request.epoch : -1,
    };
    try {
      if (request.version !== 2)
        failure(
          'invalid-input',
          'WORKER_VERSION',
          'Unsupported worker protocol version.',
        );
      finiteNumber(request.requestId, 'requestId', { min: 0, integer: true });
      finiteNumber(request.epoch, 'epoch', { min: 0, integer: true });
    } catch (error) {
      const diagnostic = diagnosticFor(error);
      post({
        ...response,
        status: 'failed',
        error: diagnostic.message,
        diagnostic,
      });
      return;
    }
    if (
      request.epoch < activeEpoch ||
      (request.epoch === activeEpoch && request.requestId <= lastRequestId)
    )
      return;
    activeEpoch = request.epoch;
    lastRequestId = request.requestId;
    const mine = ++token;
    if (request.kind === 'cancel') {
      post({
        ...response,
        status: 'cancelled',
        state: latest,
        progress: latestProgress,
      });
      return;
    }
    latest = undefined;
    latestProgress = undefined;
    let committed: SimulationState | undefined;
    let admitted = false;
    const start = now();
    let completedWork = 0,
      lastPost = start,
      targetTimeS = 0,
      totalWork = 0;
    const publish = (status: WorkerResponse['status']) => {
      if (mine !== token || !committed) return;
      latest = committed;
      latestProgress = {
        completedTimeS: committed.timeS,
        targetTimeS,
        completedWork,
        totalWork,
      };
      post({ ...response, status, state: committed, progress: latestProgress });
      lastPost = now();
    };
    try {
      if (!request.design)
        failure(
          'invalid-input',
          'WORKER_DESIGN',
          'Worker request requires a design.',
        );
      if (
        !['initialize', 'advance', 'replay', 'restore'].includes(request.kind)
      )
        failure(
          'invalid-input',
          'WORKER_OPERATION',
          'Unknown worker operation.',
        );
      const design = request.design;
      validateDesign(design);
      const duration = Object.hasOwn(request, 'durationS')
        ? request.durationS
        : 0;
      finiteNumber(duration, 'durationS', {
        min: 0,
        max:
          request.kind === 'replay' ? CONTRACT.horizonS : CONTRACT.maxAdvanceS,
        integer: true,
        unit: 's',
      });
      if (
        (request.kind === 'initialize' || request.kind === 'restore') &&
        duration !== 0
      )
        failure(
          'invalid-input',
          'WORKER_DURATION',
          'Initialize and restore require zero duration.',
        );
      const chunkLimit = Object.hasOwn(request, 'chunkS')
        ? request.chunkS
        : CONTRACT.maxChunkS;
      finiteNumber(chunkLimit, 'chunkS', {
        min: 1,
        max: CONTRACT.maxChunkS,
        integer: true,
        unit: 's',
      });
      if (
        request.kind === 'advance' ||
        request.kind === 'restore' ||
        (request.kind === 'replay' && Object.hasOwn(request, 'state'))
      ) {
        validateState(design, request.state);
        committed = structuredClone(request.state);
      } else {
        committed = initialize(design);
      }
      const integrationStepS = Object.hasOwn(request, 'integrationStepS')
        ? request.integrationStepS
        : committed.integrationStepS;
      if (!INTEGRATION_STEPS.includes(integrationStepS as IntegrationStep))
        failure(
          'invalid-input',
          'INTEGRATION_STEP',
          'Worker integration step must be 1, 0.5, 0.25, or 0.125 seconds.',
        );
      if (integrationStepS !== committed.integrationStepS) {
        if (Object.hasOwn(request, 'state'))
          failure(
            'invalid-input',
            'INTEGRATION_STEP_MISMATCH',
            'A supplied checkpoint must retain its integration step.',
          );
        committed = advanceWithStep(
          design,
          committed,
          0,
          [],
          integrationStepS as IntegrationStep,
        );
      }
      targetTimeS = committed.timeS + duration;
      finiteNumber(targetTimeS, 'targetTimeS', {
        min: 0,
        max: CONTRACT.horizonS,
        integer: true,
        unit: 's',
      });
      const events = Object.hasOwn(request, 'events') ? request.events : [];
      if (!Array.isArray(events) || events.length > CONTRACT.maxEvents)
        failure(
          'invalid-input',
          'EVENT_COUNT',
          `Worker event count must not exceed ${CONTRACT.maxEvents}.`,
        );
      // The current session remains unchanged until this entire admission candidate validates.
      for (
        let offset = 0;
        offset < events.length;
        offset += CONTRACT.eventValidationBatch
      ) {
        await yieldTask();
        if (mine !== token) return;
        if (now() - start >= CONTRACT.maxJobWallMs)
          failure(
            'resource-limit',
            'REPLAY_BUDGET',
            'Event validation reached the job wall-clock budget. No candidate history was committed.',
          );
        for (const event of events.slice(
          offset,
          offset + CONTRACT.eventValidationBatch,
        ))
          validateEvent(design, event);
      }
      const modules = design.modules.length;
      const step = committed.integrationStepS;
      const initialWork =
        modules *
        events.filter(
          (event) =>
            event.timeS <= committed!.timeS &&
            !committed!.appliedEventIds.includes(event.id),
        ).length;
      if (initialWork > CONTRACT.maxChunkModuleSteps)
        failure(
          'resource-limit',
          'EVENT_CHUNK_BUDGET',
          'This event boundary exceeds the per-chunk work budget. The valid scenario remains available for inspection and export.',
          {
            details: {
              requiredModuleSteps: initialWork,
              maximum: CONTRACT.maxChunkModuleSteps,
            },
          },
        );
      if (request.kind === 'restore' && events.length)
        failure(
          'invalid-input',
          'RESTORE_EVENTS',
          'Exact restoration cannot admit new events in the same request.',
        );
      if (request.kind !== 'restore')
        committed = advance(design, committed, 0, events);
      admitted = true;
      completedWork = initialWork;
      totalWork =
        modules *
          (Math.ceil(duration / step) +
            committed.events.filter(
              (event) =>
                event.timeS > committed!.timeS && event.timeS <= targetTimeS,
            ).length) +
        initialWork;
      latest = committed;
      latestProgress = {
        completedTimeS: committed.timeS,
        targetTimeS,
        completedWork,
        totalWork,
      };
      if (!duration) {
        publish('complete');
        return;
      }
      let firstChunk = true;
      while (committed.timeS < targetTimeS) {
        await yieldTask();
        if (mine !== token) return;
        let chunk = Math.min(
          chunkLimit,
          targetTimeS - committed.timeS,
          Math.max(
            1,
            Math.floor((CONTRACT.maxChunkModuleSteps * step) / modules),
          ),
        );
        let work = 0;
        while (chunk >= 1) {
          work =
            modules *
            (chunk / step +
              committed.events.filter(
                (event) =>
                  event.timeS > committed!.timeS &&
                  event.timeS <= committed!.timeS + chunk,
              ).length);
          if (work <= CONTRACT.maxChunkModuleSteps) break;
          chunk--;
        }
        if (chunk < 1)
          failure(
            'resource-limit',
            'EVENT_CHUNK_BUDGET',
            'The next complete event boundary exceeds the chunk work budget. Resume cannot advance this boundary on the current execution budget.',
            {
              details: {
                completedTimeS: committed.timeS,
                maximum: CONTRACT.maxChunkModuleSteps,
              },
            },
          );
        if (
          completedWork + work > CONTRACT.maxJobModuleSteps ||
          now() - start >= CONTRACT.maxJobWallMs
        )
          failure(
            'resource-limit',
            'REPLAY_BUDGET',
            'Replay paused at the last validated checkpoint because the job resource budget was reached. Resume to continue.',
            {
              details: {
                completedTimeS: committed.timeS,
                completedWork,
                maximumModuleSteps: CONTRACT.maxJobModuleSteps,
                maximumWallMs: CONTRACT.maxJobWallMs,
              },
            },
          );
        committed = advance(design, committed, chunk);
        completedWork += work;
        latest = committed;
        latestProgress = {
          completedTimeS: committed.timeS,
          targetTimeS,
          completedWork,
          totalWork,
        };
        if (firstChunk || now() - lastPost >= CONTRACT.progressIntervalMs) {
          publish('progress');
          firstChunk = false;
        }
      }
      const elapsedMs = now() - start;
      if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
        failure(
          'numerical-failure',
          'WORKER_CLOCK',
          'Worker timing produced an invalid duration. The last validated numerical checkpoint was retained.',
        );
      const completed = { ...committed, solverMs: elapsedMs };
      validateState(design, completed);
      committed = completed;
      publish('complete');
    } catch (error) {
      if (mine !== token) return;
      const diagnostic = diagnosticFor(error);
      // Never replace an existing checkpoint with an unvalidated request or a failed candidate.
      if (committed && admitted) {
        latest = committed;
        latestProgress = {
          completedTimeS: committed.timeS,
          targetTimeS,
          completedWork,
          totalWork,
        };
      }
      post({
        ...response,
        status:
          diagnostic.kind === 'resource-limit' ? 'resource-limited' : 'failed',
        error: diagnostic.message,
        diagnostic,
        state: admitted ? committed : undefined,
        progress: admitted ? latestProgress : undefined,
      });
    }
  };
}
if (typeof self !== 'undefined' && typeof document === 'undefined') {
  const handler = createWorkerHandler((response) => self.postMessage(response));
  self.onmessage = (event: MessageEvent<WorkerRequest>) => {
    void handler(event.data);
  };
}
