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

export function runWorkerExperiment(
  design: Design,
  events: OperationEvent[],
  durationS: number,
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
          'Experiment exceeded 120-second execution bound. Reduce scenario or duration.',
        ),
      );
    }, 120_000);
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
      if (r.version !== 2 || r.requestId !== 1) return;
      end();
      if (r.error || !r.state) reject(Error(r.error ?? 'No solver result'));
      else resolve(r.state);
    };
    worker.postMessage({
      version: 2,
      requestId: 1,
      epoch: 1,
      kind: 'replay',
      design,
      events,
      durationS,
    } satisfies WorkerRequest);
  });
}
export function useTwin(design: Design) {
  const [state, setState] = useState<SimulationState | null>(null),
    [running, setRunning] = useState(false),
    [speed, setSpeed] = useState(1),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<Summary[]>([]);
  const worker = useRef<Worker | null>(null),
    current = useRef<SimulationState | null>(null),
    epoch = useRef(0),
    requestId = useRef(0),
    pending = useRef(false),
    designRef = useRef(design);
  const send = useCallback(
    (
      kind: WorkerRequest['kind'],
      durationS = 0,
      events: OperationEvent[] = [],
    ) => {
      if (!worker.current || pending.current) return;
      pending.current = true;
      setBusy(true);
      setError('');
      worker.current.postMessage({
        version: 2,
        requestId: ++requestId.current,
        epoch: epoch.current,
        kind,
        design: designRef.current,
        state: current.current ?? undefined,
        durationS,
        events,
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
      setError(`Simulation worker: ${e.message}`);
      setRunning(false);
      pending.current = false;
      setBusy(false);
    };
    w.onmessage = (e: MessageEvent<WorkerResponse>) => {
      const r = e.data;
      if (
        r.version !== 2 ||
        r.epoch !== epoch.current ||
        r.requestId !== requestId.current
      )
        return;
      pending.current = false;
      setBusy(false);
      if (r.error) {
        setError(r.error);
        setRunning(false);
        return;
      }
      if (r.state && r.state.designRevision === designRef.current.revision) {
        const initializing = current.current === null;
        if (initializing) setRunning(false);
        current.current = r.state;
        setState(r.state);
        const s = summarize(designRef.current, r.state);
        setHistory((old) =>
          [
            ...(initializing ? [] : old.filter((p) => p.timeS < s.timeS)),
            s,
          ].slice(-600),
        );
      }
    };
    return () => {
      w.terminate();
      worker.current = null;
    };
  }, []);
  useEffect(() => {
    designRef.current = design;
    epoch.current++;
    current.current = null;
    pending.current = false;
    worker.current?.postMessage({
      version: 2,
      requestId: ++requestId.current,
      epoch: epoch.current,
      kind: 'cancel',
    } satisfies WorkerRequest);
    send('initialize');
  }, [design, send]);
  useEffect(() => {
    if (!running || state?.designRevision !== design.revision) return;
    const id = setInterval(() => send('advance', speed), 1000);
    return () => clearInterval(id);
  }, [running, speed, send, state?.designRevision, design.revision]);
  const replay = useCallback(
    (events: OperationEvent[], timeS: number) => {
      setRunning(false);
      epoch.current++;
      pending.current = false;
      setHistory([]);
      send('replay', timeS, events);
    },
    [send],
  );
  const reset = useCallback(() => replay([], 0), [replay]);
  const cancel = useCallback(() => {
    epoch.current++;
    pending.current = false;
    worker.current?.postMessage({
      version: 2,
      requestId: ++requestId.current,
      epoch: epoch.current,
      kind: 'cancel',
    } satisfies WorkerRequest);
    setBusy(false);
    setRunning(false);
    setError('Run cancelled. The last completed numerical state is retained.');
  }, []);
  const command = useCallback(
    (kind: OperationEvent['kind'], assetId: string, value?: number) => {
      const s = current.current;
      if (!s || pending.current) return;
      const event: OperationEvent = {
        id: `event-${s.events.length + 1}-${s.timeS}`,
        kind,
        assetId,
        timeS: s.timeS,
        ...(value === undefined ? {} : { value }),
      };
      send('advance', 0, [event]);
    },
    [send],
  );
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
    reset,
    cancel,
    advance: (seconds: number) => send('advance', seconds),
  };
}
