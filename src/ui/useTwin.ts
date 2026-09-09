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
): Promise<SimulationState> {
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
        r.epoch !== 1 ||
        r.status === 'progress'
      )
        return;
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
      events,
      durationS,
      integrationStepS,
    } satisfies WorkerRequest);
  });
}
export function useTwin(design: Design) {
  const [state, setState] = useState<SimulationState | null>(null),
    [running, setRunning] = useState(false),
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
      const result = writeCheckpoint(captureProject());
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
      validateState(designRef.current, next);
      // Admit the complete user project, including provenance and paused execution,
      // before replacing either the physical state or the exportable checkpoint.
      const candidate = projectFile(designRef.current, next, {
        ...(provenance.current ? { provenance: provenance.current } : {}),
        ...(target.current !== null && target.current > next.timeS
          ? {
              execution: {
                targetTimeS: target.current,
                status: 'paused' as const,
                kind: 'replay' as const,
              },
            }
          : {}),
      });
      const summary = summarize(designRef.current, next);
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
  const invalidate = useCallback((acceptCancellation = false) => {
    epoch.current++;
    pending.current = false;
    setRunning(false);
    setBusy(false);
    worker.current?.postMessage({
      version: 2,
      requestId: ++requestId.current,
      epoch: epoch.current,
      kind: 'cancel',
    } satisfies WorkerRequest);
    if (!acceptCancellation) requestId.current++;
  }, []);
  const send = useCallback(
    (
      kind: WorkerRequest['kind'],
      durationS = 0,
      events: OperationEvent[] = [],
      continuing = false,
      integrationStepS: IntegrationStep = current.current?.integrationStepS ??
        1,
    ) => {
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
        setRunning(false);
        return;
      }
      pending.current = true;
      setBusy(true);
      setError('');
      worker.current.postMessage({
        version: 2,
        requestId: ++requestId.current,
        epoch: epoch.current,
        kind,
        design: designRef.current,
        durationS,
        events,
        integrationStepS,
        ...((kind === 'advance' || kind === 'restore' || continuing) &&
        current.current
          ? { state: current.current }
          : {}),
      } satisfies WorkerRequest);
    },
    [],
  );
  useEffect(() => {
    const w = new Worker(new URL('../twin/engine/worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.current = w;
    w.onerror = (e) => {
      if (worker.current !== w) return;
      epoch.current++;
      pending.current = false;
      setBusy(false);
      setRunning(false);
      setError(
        `Simulation worker interrupted: ${e.message}. Last received checkpoint at ${current.current?.timeS ?? 0}s retained; any later in-flight progress was lost. Resume uses a new worker.`,
      );
      w.terminate();
      worker.current = null;
      setWorkerGeneration((value) => value + 1);
    };
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const r = e.data;
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
        if (r.status === 'complete') {
          target.current = null;
          setResumeTarget(null);
          persist();
        }
        if (r.error) {
          setError(r.error);
          setRunning(false);
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
  }, [workerGeneration, accept, persist, invalidate]);
  useEffect(() => {
    designRef.current = design;
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
  }, [design, invalidate, send]);
  useEffect(() => {
    if (!running || state?.designRevision !== design.revision) return;
    const id = setInterval(() => send('advance', speed), 1000);
    return () => clearInterval(id);
  }, [running, speed, send, state?.designRevision, design.revision]);
  const replay = useCallback(
    (
      events: OperationEvent[],
      timeS: number,
      source?: ProjectProvenance,
      integrationStepS?: IntegrationStep,
    ) => {
      invalidate();
      if (source) provenance.current = source;
      setHistory([]);
      send('replay', timeS, events, false, integrationStepS);
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
      accept(restored.state);
      return restored.design;
    },
    [accept, invalidate],
  );
  const cancel = useCallback(() => {
    invalidate(true);
    setError('Run cancelled. The last completed numerical state is retained.');
    persist();
  }, [invalidate, persist]);
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
