import { resolveAsset } from '../assets/design';
import { conservationResiduals } from '../analysis/reports';
import { advanceWithStep, summarizeObservedBoundary } from '../engine/simulation';
import { replayExperimentState } from '../experiment/runner';
import { CONTRACT } from '../persistence/limits';
import { identity } from '../persistence/structure';
import { validateState } from '../persistence/state';
import type { Design, SimulationState } from '../types';

export const INSPECTION_LIMITS = Object.freeze({ samples: 160, moduleSteps: CONTRACT.maxJobModuleSteps, wallMs: CONTRACT.maxJobWallMs });
export interface InspectionSample { timeS: number; moduleId: string; coolantK: number; technicalFlowM3S: number; seawaterFlowM3S: number; pumpPowerW: number; availableAccelerators: number }
export interface InspectionRequest { assetId: string; timeS: number; boundary: 'post' | 'previous' | 'at-or-after' }
/** View-only engine observation; fractional snapshots cannot be resumed or persisted as checkpoints. */
export interface InspectionResolution {
  status: 'resolved' | 'unsupported' | 'unavailable-history' | 'numerical-failure';
  reason: string; runIdentity: string; requestedTimeS: number; resolvedTimeS: number | null;
  boundary: InspectionRequest['boundary']; state: SimulationState | null; samples: InspectionSample[];
  samplesSeen: number; truncated: boolean; work: number;
  summary: ReturnType<typeof summarizeObservedBoundary> | null; residuals: ReturnType<typeof conservationResiduals> | null;
}
/** Stable throughout stepping/pause; recorded input/design/initial-condition changes invalidate the view. */
export function inspectionRunIdentity(design: Design, state: SimulationState | null): string {
  return identity({ design: state?.designIdentity ?? design.revision, definition: state?.experiment?.definition ?? null, initial: state?.experiment?.initialStateIdentity ?? null, inputs: state?.experiment?.inputs ?? state?.events ?? [] });
}

function compactSamples(samples: InspectionSample[]): InspectionSample[] {
  if (samples.length <= INSPECTION_LIMITS.samples) return samples;
  const keep = new Set([0, samples.length - 1]);
  for (const field of ['coolantK', 'technicalFlowM3S', 'seawaterFlowM3S', 'pumpPowerW', 'availableAccelerators'] as const) {
    let minimum = 0, maximum = 0;
    samples.forEach((sample, index) => { if (sample[field] < samples[minimum][field]) minimum = index; if (sample[field] > samples[maximum][field]) maximum = index; });
    keep.add(minimum); keep.add(maximum);
  }
  samples.forEach((_, index) => { if (index % 2 === 0) keep.add(index); });
  return samples.filter((_, index) => keep.has(index));
}

/** Replay an isolated saved experiment through its existing engine; no chart reconstructs physical state. */
export async function resolveInspection(design: Design, source: SimulationState, request: InspectionRequest, options: { yieldTask?: () => Promise<void>; cancelled?: () => boolean; now?: () => number } = {}): Promise<InspectionResolution> {
  const runIdentity = inspectionRunIdentity(design, source);
  const base: InspectionResolution = { status: 'unavailable-history', reason: '', runIdentity, requestedTimeS: request.timeS, resolvedTimeS: null, boundary: request.boundary, state: null, samples: [], samplesSeen: 0, truncated: false, work: 0, summary: null, residuals: null };
  if (!resolveAsset(design, request.assetId)) return { ...base, status: 'unsupported', reason: 'Unsupported asset identity; select an installed asset.' };
  if (!Number.isFinite(request.timeS) || request.timeS < 0 || request.timeS > source.timeS || !['post', 'previous', 'at-or-after'].includes(request.boundary)) return { ...base, reason: 'History time must be within the retained source observation. No nearest sample is substituted.' };
  if (!source.experiment) return { ...base, status: 'unsupported', reason: 'This legacy run has no recorded physical initial checkpoint. Exact history is unavailable; prepare a recorded experiment to inspect its boundaries.' };
  const now = options.now ?? (() => performance.now()), started = now(), yieldTask = options.yieldTask ?? (() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  let samples: InspectionSample[] = [], snapshot: SimulationState | null = null, samplesSeen = 0, lastSampleTime = -1, work = 0;
  const moduleId = design.modules.find(module => request.assetId === module.id || request.assetId.startsWith(`${module.id}/`))?.id;
  const observe = (timeS: number, copy: () => SimulationState) => {
    const eligible = request.boundary === 'previous' ? timeS < request.timeS : timeS <= (request.boundary === 'at-or-after' ? Math.ceil(request.timeS) : request.timeS);
    if (!eligible || timeS === lastSampleTime) return;
    const copied = copy();
    if (request.boundary === 'previous' || timeS === request.timeS || request.boundary === 'at-or-after' && snapshot === null && timeS >= request.timeS) snapshot = copied;
    if (moduleId) {
      const module = copied.modules.find(item => item.id === moduleId);
      if (module) { samplesSeen++; samples.push({ timeS, moduleId, coolantK: module.coolantK, technicalFlowM3S: module.technicalFlowM3S, seawaterFlowM3S: module.seawaterFlowM3S, pumpPowerW: module.pumpPowerW, availableAccelerators: module.availableAccelerators }); samples = compactSamples(samples); }
    }
    lastSampleTime = timeS;
  };
  try {
    validateState(design, source);
    let current = replayExperimentState(design, source);
    observe(current.timeS, () => structuredClone(current));
    const target = Math.ceil(request.timeS);
    while (current.timeS < target) {
      if (options.cancelled?.()) return { ...base, reason: 'History inspection cancelled. Active experiment retained.', work };
      const seconds = Math.min(CONTRACT.maxChunkS, target - current.timeS);
      const nextWork = design.modules.length * seconds / current.integrationStepS;
      if (work + nextWork > INSPECTION_LIMITS.moduleSteps || now() - started >= INSPECTION_LIMITS.wallMs) return { ...base, reason: 'Exact history exceeded the documented replay budget; active experiment retained.', work };
      const next = advanceWithStep(design, current, seconds, [], current.integrationStepS, undefined, observe);
      work += nextWork;
      if (next.timeS <= current.timeS) break;
      current = next;
      await yieldTask();
    }
    const resolved = snapshot as SimulationState | null;
    if (!resolved) return { ...base, reason: request.boundary === 'previous' ? 'No earlier committed boundary exists.' : 'Requested time is not a canonical committed boundary. No interpolation or nearest-time substitution was used.', work };
    // Persisted checkpoints remain integer-only. This copy was captured inside the canonical engine,
    // and its containing completed replay chunk passed ordinary candidate validation.
    const summary = summarizeObservedBoundary(design, resolved);
    const residuals = conservationResiduals(design, resolved, summary);
    return { ...base, status: 'resolved', reason: request.boundary === 'at-or-after' ? `Metric marker at ${request.timeS} s; scene is the first canonical boundary observed at or after that marker, at ${resolved.timeS} s. No physical state is interpolated at the metric time.` : request.boundary === 'previous' ? 'Previous committed boundary before the selected event; actual resolved time shown.' : 'Exact final post-boundary state after all admitted same-time inputs and controller transitions.', resolvedTimeS: resolved.timeS, state: resolved, samples, samplesSeen, truncated: samplesSeen > samples.length, work, summary, residuals };
  } catch (error) { return { ...base, status: 'numerical-failure', reason: `Isolated history replay failed: ${String(error)}. Active experiment retained.`, work }; }
}

export interface OperatorEvent { id: string; assetId: string; timeS: number; kind: string; reason: string; affectedAssetIds: string[]; transitionId?: string }
export function operatorEvents(state: SimulationState): OperatorEvent[] {
  const events: OperatorEvent[] = state.events.filter(event => state.appliedEventIds.includes(event.id)).map(event => ({ id: `input:${event.id}`, assetId: event.assetId, timeS: event.timeS, kind: `Simulated ${event.kind}`, reason: `Recorded ${event.kind} input${event.value === undefined ? '' : ` with value ${event.value}`}.`, affectedAssetIds: state.log.find(entry => entry.kind === 'command' && entry.timeS === event.timeS && entry.assetId === event.assetId)?.affectedIds ?? [event.assetId] }));
  for (const transition of state.transfer?.transitions ?? []) events.push({ id: `transfer:${transition.transitionId}`, transitionId: transition.transitionId, assetId: transition.affectedAssetIds[0], timeS: transition.timeS, kind: `Controller ${transition.previous} → ${transition.status}`, reason: transition.reason, affectedAssetIds: transition.affectedAssetIds });
  state.log.forEach((entry, index) => { if (entry.kind !== 'command') events.push({ id: `log:${index}:${entry.timeS}:${entry.assetId}`, assetId: entry.assetId, timeS: entry.timeS, kind: entry.kind, reason: entry.message, affectedAssetIds: entry.affectedIds }); });
  return events.sort((a, b) => a.timeS - b.timeS).slice(-CONTRACT.maxLogEntries);
}
