import type { ExperimentDefinition } from '../twin/experiment/types';
import { createExperimentDefinition } from '../twin/experiment/definition';
import { experimentExecutionDuration, setExperimentStatus } from '../twin/experiment/runtime';
import { replayExperimentState } from '../twin/experiment/runner';
import { engineeringIdentity } from '../twin/catalog/equipment';
import { diagnosticEvent, diagnosticsEnabled } from '../twin/diagnostics';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Design,
  OperationEvent,
  SimulationState,
  Summary,
  WorkerRequest,
  WorkerResponse,
} from '../twin/types';
import { summarize } from '../twin/engine/simulation';
import { validateState } from '../twin/persistence/state';
import { CONTRACT, type IntegrationStep } from '../twin/persistence/limits';
import { projectFile, restoreProject } from '../twin/persistence/project';
import {
  discardCheckpoint,
  readCheckpoint,
  writeCheckpoint,
} from '../twin/persistence/storage';
import type {
  CurrentProject,
  ProjectFile,
  ProjectProvenance,
} from '../twin/persistence/types';
import { diagnosticFor, finiteNumber } from '../twin/safety';

export function runWorkerExperiment(
  design: Design,
  events: OperationEvent[],
  durationS: number,
  integrationStepS: IntegrationStep = 1,
  experimentDefinition?: ExperimentDefinition,
  onProgress?: (progress: NonNullable<WorkerResponse['progress']>) => void,
): Promise<SimulationState> {
  const definition = experimentDefinition ?? createExperimentDefinition(design, { name: 'Reproducible comparison', durationS, disturbances: events, integrationStepS });
  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../twin/engine/worker.ts', import.meta.url),
      { type: 'module' },
    );
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(
        Error(
          'Experiment exceeded the worker execution budget. The source scenario remains available.',
        ),
      );
    }, CONTRACT.maxJobWallMs + 1000);
    const end = () => {
      clearTimeout(timeout);
      worker.terminate();
    };
    worker.onerror = (e) => {
      end();
      reject(Error(e.message));
    };
    worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const r = e.data;
      if (
        r.version !== 2 ||
        r.requestId !== 1 ||
        r.epoch !== 1
      )
        return;
      if(r.status==='progress') { if(r.progress)onProgress?.(r.progress);return; }
      end();
      if (r.error || !r.state || r.status !== 'complete')
        reject(Error(r.error ?? 'No completed solver result'));
      else {
        try {
          validateState(design, r.state);
          resolve(r.state);
        } catch (error) {
          reject(error);
        }
      }
    };
    worker.postMessage({
      version: 2,
      requestId: 1,
      epoch: 1,
      kind: 'replay',
      design,
      events: [],
      durationS: experimentExecutionDuration(definition),
      integrationStepS: definition.integrationStepS,
      experimentDefinition: definition,
    } satisfies WorkerRequest);
  });
}
export function useTwin(design: Design) {
  const [state, setState] = useState<SimulationState | null>(null),
    [running, setRunningState] = useState(false),
    [speed, setSpeed] = useState(1),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<Summary[]>([]),
    [progress, setProgress] = useState<WorkerResponse['progress']>(),
    [workerGeneration, setWorkerGeneration] = useState(0),
    [recoveryRead] = useState(() => readCheckpoint()),
    [recovery, setRecovery] = useState<ProjectFile | null>(
      recoveryRead.project,
    ),
    [recoveryBlocked, setRecoveryBlocked] = useState(
      Boolean(recoveryRead.diagnostic),
    ),
    [storageStatus, setStorageStatus] = useState(
      recoveryRead.diagnostic?.message ?? '',
    ),
    [durableTimeS, setDurableTimeS] = useState<number | null>(
      recoveryRead.project?.timeS ?? null,
    ),
    [resumeTarget, setResumeTarget] = useState<number | null>(null);
  const worker = useRef<Worker | null>(null),
    current = useRef<SimulationState | null>(null),
    committedProject = useRef<CurrentProject | null>(null),
    epoch = useRef(0),
    requestId = useRef(0),
    pending = useRef(false),
    clockRunning = useRef(false),
    clockTimer = useRef<ReturnType<typeof setInterval> | null>(null),
    designRef = useRef(design),
    restoredDesign = useRef<Design | null>(null),
    provenance = useRef<ProjectProvenance | undefined>(undefined),
    target = useRef<number | null>(null),
    recoveryPending = useRef(
      recoveryRead.project !== null || Boolean(recoveryRead.diagnostic),
    );
  const captureProject = useCallback(() => {
    if (!committedProject.current)
      throw Error('No completed checkpoint is available.');
    return structuredClone(committedProject.current);
  }, []);
  const persist = useCallback(() => {
    if (recoveryPending.current || !current.current) return;
    try {
      const persistStart = performance.now();
      const result = writeCheckpoint(captureProject());
      diagnosticEvent('ui.persist', { ms: performance.now() - persistStart, timeS: current.current.timeS, ok: result.ok });
      if (result.ok) {
        setDurableTimeS(result.timeS);
        setStorageStatus(
          `Checkpoint saved locally at ${result.timeS}s. Progress after this checkpoint may be lost on interruption.`,
        );
      } else setStorageStatus(result.diagnostic.message);
    } catch (problem) {
      setStorageStatus(diagnosticFor(problem).message);
    }
  }, [captureProject]);
  const accept = useCallback(
    (next: SimulationState) => {
      const validationStart = performance.now();
      validateState(designRef.current, next);
      diagnosticEvent('ui.validate', { ms: performance.now() - validationStart, timeS: next.timeS });
      const projectStart = performance.now();
      // Admit the complete user project, including provenance and paused execution,
      // before replacing either the physical state or the exportable checkpoint.
      const candidate = projectFile(designRef.current, next, {
        ...(provenance.current ? { provenance: provenance.current } : {}),
        ...(target.current !== null && target.current > next.timeS && (!next.experiment || !['completed','cancelled','warmup-timeout','numerical-failed'].includes(next.experiment.status))
          ? {
              execution: {
                targetTimeS: target.current,
                status: 'paused' as const,
                kind: 'replay' as const,
              },
            }
          : {}),
      });
      diagnosticEvent('ui.project', { ms: performance.now() - projectStart, timeS: next.timeS });
      const summaryStart = performance.now();
      const summary = summarize(designRef.current, next);
      diagnosticEvent('ui.summarize', { ms: performance.now() - summaryStart, timeS: next.timeS });
      committedProject.current = candidate;
      const initializing = current.current === null;
      current.current = next;
      setState(next);
      setHistory((old) =>
        [
          ...(initializing ? [] : old.filter((p) => p.timeS < next.timeS)),
          summary,
        ].slice(-600),
      );
      persist();
    },
    [persist],
  );
  const stopClock = useCallback(() => {
    clockRunning.current = false;
    if (clockTimer.current !== null) clearInterval(clockTimer.current);
    clockTimer.current = null;
    setRunningState(false);
  }, []);
  const invalidate = useCallback(() => {
    epoch.current++;
    pending.current = false;
    stopClock();
    setBusy(false);
    worker.current?.postMessage({
      version: 2,
      requestId: ++requestId.current,
      epoch: epoch.current,
      kind: 'cancel',
    } satisfies WorkerRequest);
    // Its acknowledgement may contain worker progress the UI never committed.
    // Keep that later state from replacing the checkpoint after controls unlock.
    requestId.current++;
  }, [stopClock]);
  const setRunning = useCallback(
    (next: boolean) => {
      if (!next) {
        // Pause freezes the last UI-committed checkpoint, including when an
        // advance or cancellation reply is already on its way from the worker.
        invalidate();
        if (current.current?.experiment) accept(setExperimentStatus(current.current, 'paused', 'Paused at the last UI-committed physical and metric checkpoint.'));
        persist();
      } else if (worker.current && current.current && !pending.current) {
        clockRunning.current = true;
        setRunningState(true);
      }
    },
    [invalidate, persist, accept],
  );
  const send = useCallback(
    (
      kind: WorkerRequest['kind'],
      durationS = 0,
      events: OperationEvent[] = [],
      continuing = false,
      integrationStepS: IntegrationStep = current.current?.integrationStepS ??
        1,
      experimentDefinition?: ExperimentDefinition,
      replayInitialState?: SimulationState,
    ) => {
      diagnosticEvent('ui.send-attempt', { kind, durationS, selectedRevision: designRef.current.revision, initializedRevision: current.current?.designRevision, pending: pending.current, hasWorker: Boolean(worker.current) });
      if (!worker.current || pending.current) return;
      try {
        finiteNumber(durationS, 'durationS', {
          min: 0,
          max: kind === 'replay' ? CONTRACT.horizonS : CONTRACT.maxAdvanceS,
          integer: true,
          unit: 's',
        });
        if (kind === 'replay' || kind === 'advance') {
          const nextTarget =
            (kind === 'advance' || continuing
              ? (current.current?.timeS ?? 0)
              : 0) + durationS;
          finiteNumber(nextTarget, 'targetTimeS', {
            min: 0,
            max: CONTRACT.horizonS,
            integer: true,
            unit: 's',
          });
          target.current = nextTarget;
          setResumeTarget(nextTarget);
        }
      } catch (problem) {
        setError(diagnosticFor(problem).message);
        stopClock();
        return;
      }
      pending.current = true;
      // Previous initialization/replay progress does not describe this request.
      setProgress(undefined);
      setBusy(true);
      setError('');
      diagnosticEvent('ui.dispatch-start', { kind, requestId: requestId.current + 1, epoch: epoch.current, durationS, targetTimeS: target.current });
      worker.current.postMessage({
        diagnostics: diagnosticsEnabled,
        version: 2,
        requestId: ++requestId.current,
        epoch: epoch.current,
        kind,
        design: designRef.current,
        durationS,
        events,
        integrationStepS,
        ...(experimentDefinition && !replayInitialState ? { experimentDefinition } : {}),
        ...(replayInitialState ? { state: replayInitialState } : (kind === 'advance' || kind === 'restore' || continuing) &&
        current.current
          ? { state: current.current }
          : {}),
      } satisfies WorkerRequest);
      diagnosticEvent('ui.dispatched', { requestId: requestId.current, epoch: epoch.current });
    },
    [stopClock],
  );
  useEffect(() => {
    const w = new Worker(new URL('../twin/engine/worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onerror = (e) => {
      diagnosticEvent('ui.worker-error', { currentWorker: worker.current === w });
      if (worker.current !== w) return;
      epoch.current++;
      pending.current = false;
      setBusy(false);
      stopClock();
      setError(
        `Simulation worker interrupted: ${e.message}. Last received checkpoint at ${current.current?.timeS ?? 0}s retained; any later in-flight progress was lost. Resume uses a new worker.`,
      );
      w.terminate();
      worker.current = null;
      setWorkerGeneration((value) => value + 1);
    };
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const r = e.data;
      diagnosticEvent('ui.response', { requestId: r.requestId, epoch: r.epoch, status: r.status, timeS: r.state?.timeS, selectedRevision: designRef.current.revision, responseRevision: r.state?.designRevision, rejection: worker.current !== w ? 'worker' : r.version !== 2 ? 'version' : r.epoch !== epoch.current ? 'epoch' : r.requestId !== requestId.current ? 'requestId' : r.state && r.state.designRevision !== designRef.current.revision ? 'designRevision' : 'none' });
      if (
        worker.current !== w ||
        r.version !== 2 ||
        r.epoch !== epoch.current ||
        r.requestId !== requestId.current
      )
        return;
      try {
        if (r.progress) setProgress(r.progress);
        if (r.state && r.state.designRevision === designRef.current.revision)
          accept(r.state);
        if (r.status === 'progress') return;
        pending.current = false;
        setBusy(false);
        if (r.state?.experiment && ['completed', 'cancelled', 'warmup-timeout', 'numerical-failed'].includes(r.state.experiment.status)) stopClock();
        if (r.status === 'complete') {
          target.current = null;
          setResumeTarget(null);
          // accept() already persisted this terminal state without a future target.
        }
        if (r.error) {
          setError(r.error);
          stopClock();
        }
      } catch (problem) {
        invalidate();
        setError(
          `Worker checkpoint rejected. ${diagnosticFor(problem).message} Last validated state retained.`,
        );
      }
    };
    return () => {
      w.terminate();
      if (worker.current === w) worker.current = null;
    };
  }, [workerGeneration, accept, persist, invalidate, stopClock]);
  useEffect(() => {
    diagnosticEvent('ui.design-selected', { revision: design.revision });
    const sameEngineering = current.current !== null && engineeringIdentity(designRef.current) === engineeringIdentity(design);
    designRef.current = design;
    if (sameEngineering && restoredDesign.current !== design) {
      // Economic/report edits update the saved assumptions without touching any operating field.
      committedProject.current = projectFile(design, current.current!, {
        ...(provenance.current ? { provenance: provenance.current } : {}),
        ...(committedProject.current?.execution ? { execution: committedProject.current.execution } : {}),
      });
      persist();
      return;
    }
    if (restoredDesign.current === design) {
      restoredDesign.current = null;
      return;
    }
    invalidate();
    current.current = null;
    provenance.current = undefined;
    target.current = null;
    setResumeTarget(null);
    setProgress(undefined);
    send('initialize');
  }, [design, invalidate, send, persist]);
  useEffect(() => {
    if (
      !running ||
      !clockRunning.current ||
      state?.designRevision !== design.revision
    )
      return;
    const id = setInterval(() => {
      if (clockRunning.current) send('advance', speed);
    }, 1000);
    clockTimer.current = id;
    return () => {
      clearInterval(id);
      if (clockTimer.current === id) clockTimer.current = null;
    };
  }, [running, speed, send, state?.designRevision, design.revision]);
  const replay = useCallback(
    (
      events: OperationEvent[],
      timeS: number,
      source?: ProjectProvenance,
      integrationStepS?: IntegrationStep,
      definition?: ExperimentDefinition,
    ) => {
      const replaySource=current.current;
      const initial=definition&&replaySource?.experiment?.definition.id===definition.id?replayExperimentState(designRef.current,replaySource):undefined;
      invalidate();
      if (source) provenance.current = source;
      setHistory([]);
      send('replay', timeS, definition ? [] : events, false, definition?.integrationStepS??integrationStepS, definition, initial);
      return initial?.experiment?.definition.id!==undefined&&initial.experiment.definition.id!==definition?.id;
    },
    [send, invalidate],
  );
  const restore = useCallback(
    (project: ProjectFile) => {
      const restored = restoreProject(project);
      invalidate();
      restoredDesign.current = restored.design;
      designRef.current = restored.design;
      provenance.current =
        project.schemaVersion === 3 ? project.provenance : undefined;
      target.current =
        project.schemaVersion === 3
          ? (project.execution?.targetTimeS ?? null)
          : null;
      setResumeTarget(target.current);
      recoveryPending.current = false;
      setRecovery(null);
      setRecoveryBlocked(false);
      setProgress(undefined);
      setError('');
      accept(restored.state.experiment && !['completed','cancelled','warmup-timeout','numerical-failed'].includes(restored.state.experiment.status) ? setExperimentStatus(restored.state,'paused','Restored a complete physical and metric checkpoint; resume explicitly.') : restored.state);
      return restored.design;
    },
    [accept, invalidate],
  );
  const cancel = useCallback(() => {
    invalidate();
    if (current.current?.experiment) { accept(setExperimentStatus(current.current, 'cancelled', 'Cancelled at the last UI-committed physical and metric checkpoint.')); target.current = null; setResumeTarget(null); }
    setError('Run cancelled. The last completed numerical state is retained.');
    persist();
  }, [invalidate, persist, accept]);
  const resume = useCallback(() => {
    if (
      current.current &&
      target.current !== null &&
      target.current > current.current.timeS
    ) {
      invalidate();
      send('replay', target.current - current.current.timeS, [], true);
    }
  }, [send, invalidate]);
  const startExperiment = useCallback((definition: ExperimentDefinition) => {
    invalidate();
    provenance.current = undefined;
    setHistory([]);
    send('replay', experimentExecutionDuration(definition), [], false, definition.integrationStepS, definition);
  }, [invalidate, send]);
  const command = useCallback(
    (kind: OperationEvent['kind'], assetId: string, value?: number) => {
      const s = current.current;
      if (!s || pending.current) return;
      send('advance', 0, [
        {
          id: `event-${s.events.length + 1}-${s.timeS}`,
          kind,
          assetId,
          timeS: s.timeS,
          ...(value === undefined ? {} : { value }),
        },
      ]);
    },
    [send],
  );
  const dismissRecovery = useCallback(() => {
    const problem = discardCheckpoint();
    if (problem) {
      setStorageStatus(problem.message);
      return;
    }
    recoveryPending.current = false;
    setRecovery(null);
    setRecoveryBlocked(false);
    setDurableTimeS(null);
    persist();
  }, [persist]);
  useEffect(() => {
    diagnosticEvent('ui.committed', { selectedRevision: design.revision, initializedRevision: state?.designRevision, timeS: state?.timeS, busy });
  }, [design.revision, state, busy]);
  return {
    state: state?.designRevision === design.revision ? state : null,
    running: running && state?.designRevision === design.revision,
    setRunning,
    speed,
    setSpeed,
    error,
    busy,
    history,
    command,
    startExperiment,
    prepareExperiment: (definition: ExperimentDefinition) => { invalidate(); provenance.current = undefined; setHistory([]); send('initialize', 0, [], false, definition.integrationStepS, definition); },
    replay,
    reset: () => replay([], 0),
    cancel,
    resume,
    restore,
    progress,
    resumeTarget,
    recovery,
    recoveryBlocked,
    dismissRecovery,
    storageStatus,
    durableTimeS,
    captureProject,
    advance: (seconds: number) => send('advance', seconds),
  };
}
