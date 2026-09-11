import { useEffect, useMemo, useRef, useState } from 'react';
import type { Design, SimulationState } from '../twin/types';
import { INSPECTION_LIMITS, inspectionRunIdentity, type InspectionResolution } from '../twin/presentation/history';
import type { HistoryWorkerRequest, HistoryWorkerResponse } from '../twin/presentation/worker';

export function useInspection(design: Design, active: SimulationState | null, assetId: string) {
  const runIdentity = useMemo(() => inspectionRunIdentity(design, active), [design, active]);
  const [request, setRequest] = useState<{ source: SimulationState; runIdentity: string; timeS: number; boundary: 'post' | 'previous' } | null>(null);
  const [reply, setReply] = useState<{ key: string; resolution: InspectionResolution } | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const epoch = useRef(0), worker = useRef<Worker | null>(null);
  const validRequest = request?.runIdentity === runIdentity ? request : null;
  const key = validRequest ? `${runIdentity}:${assetId}:${validRequest.timeS}:${validRequest.boundary}` : '';
  const resolution = reply?.key === key ? reply.resolution : null;
  useEffect(() => {
    worker.current?.terminate(); worker.current = null;
    const mine = ++epoch.current;
    if (!validRequest) return;
    const instance = new Worker(new URL('../twin/presentation/worker.ts', import.meta.url), { type: 'module' });
    worker.current = instance;
    const fail = (reason: string) => { if (epoch.current !== mine) return; instance.terminate(); setReply({ key, resolution: { status: 'unavailable-history', reason, runIdentity, requestedTimeS: validRequest.timeS, resolvedTimeS: null, boundary: validRequest.boundary, state: null, samples: [], samplesSeen: 0, truncated: false, work: 0, summary: null, residuals: null } }); };
    const watchdog = setTimeout(() => fail('History worker exceeded its execution budget. Active experiment retained.'), INSPECTION_LIMITS.wallMs + 1000);
    instance.onerror = event => { clearTimeout(watchdog); fail(`History worker unavailable: ${event.message}. Active experiment retained.`); };
    instance.onmessage = (event: MessageEvent<HistoryWorkerResponse>) => {
      const response = event.data;
      if (epoch.current !== mine || response.version !== 1 || response.epoch !== mine || response.runIdentity !== runIdentity || response.assetId !== assetId || response.resolution.runIdentity !== runIdentity) return;
      clearTimeout(watchdog); instance.terminate(); setReply({ key, resolution: response.resolution });
    };
    instance.postMessage({ version: 1, epoch: mine, runIdentity, design, source: validRequest.source, request: { assetId, timeS: validRequest.timeS, boundary: validRequest.boundary } } satisfies HistoryWorkerRequest);
    return () => { clearTimeout(watchdog); instance.terminate(); };
  }, [validRequest, key, runIdentity, assetId, design]);
  const inspect = (timeS: number, boundary: 'post' | 'previous' = 'post') => { if (!active) return; setCancelled(false); setReply(null); setRequest({ source: structuredClone(active), runIdentity, timeS, boundary }); };
  const returnToCurrent = (wasCancelled = false) => { ++epoch.current; worker.current?.terminate(); worker.current = null; setRequest(null); setReply(null); setCancelled(wasCancelled); };
  return { mode: validRequest ? 'history' as const : 'current' as const, status: validRequest ? resolution?.status ?? 'loading' : cancelled ? 'cancelled' : active ? 'current' : 'loading', displayState: validRequest ? resolution?.state ?? null : active, requestedTimeS: validRequest?.timeS ?? null, resolution, inspect, returnToCurrent, runIdentity };
}
