import { describe, expect, it } from 'vitest';
import { advance, advanceWithStep, initialize, summarize, summarizeObservedBoundary } from '../src/twin/engine/simulation';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { createTransferReferenceDesign } from '../src/twin/transfer/design';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { validateState } from '../src/twin/persistence/state';
import { INSPECTION_LIMITS, inspectionRunIdentity, operatorEvents, resolveInspection } from '../src/twin/presentation/history';
import type { SimulationState } from '../src/twin/types';

const canonical = (value: unknown) => JSON.parse(JSON.stringify(value, (key, item) => key === 'solverMs' ? undefined : item));
const immediate = { yieldTask: async () => {} };
function fixture() {
  const design = createTransferReferenceDesign(3), route = design.transfer!.routes[0];
  const definition = createExperimentDefinition(design, { id: 'p7-history', durationS: 12, disturbances: [{ id: 'feeder-trip', timeS: 2, kind: 'trip', assetId: route.originalFeederId }] });
  const initial = initialize(design, definition), observations = new Map<number, SimulationState>();
  const source = advanceWithStep(design, initial, 12, [], 1, undefined, (time, copy) => observations.set(time, copy()));
  return { design, route, initial, source, observations, assetId: `${design.modules[0].id}/pump-duty` };
}

describe('PH7 canonical boundary observation preserves engine semantics', () => {
  it('matches every final state field with and without the observer, excluding only solverMs', () => {
    const { design, initial, source, observations } = fixture();
    expect(canonical(source)).toEqual(canonical(advance(design, initial, 12)));
    expect(observations.has(4.375)).toBe(true);
    expect(observations.get(4.375)!.transfer!.attempts[0]).toMatchObject({ status: 'transferred', tieClosed: true, originalClosed: false });
    expect(observations.get(4)!.transfer!.attempts[0]).toMatchObject({ status: 'waiting', tieClosed: false, originalClosed: false });
    expect(summarizeObservedBoundary(design, source)).toEqual(summarize(design, source));
  });
  it('gives owned snapshot copies whose mutation cannot alter the engine and expires the accessor', () => {
    const { design, initial } = fixture();
    const before = structuredClone(initial);
    let accessor: (() => SimulationState) | undefined;
    const observed = advanceWithStep(design, initial, 12, [], 1, undefined, (_time, copy) => {
      accessor = copy;
      const captured = copy();
      captured.modules[0].batteryWh = -999;
      captured.failedAssetIds.push('not-installed');
      captured.experiment!.metrics.shortfallAcceleratorS = -999;
    });
    expect(initial).toEqual(before);
    expect(canonical(observed)).toEqual(canonical(advance(design, initial, 12)));
    expect(() => accessor!()).toThrow(/expired/);
  });
  it('keeps fractional observed transfer state out of persisted checkpoint and direct advance admission', () => {
    const { design, initial, observations } = fixture();
    expect(() => validateState(design, observations.get(4.375)!)).toThrow();
    expect(() => advance(design, initial, 4.375)).toThrow();
    expect(summarizeObservedBoundary(design, observations.get(4.375)!).availableAccelerators).toBe(24);
  });
});

describe('PH7 isolated history resolves actual final boundaries without source mutation', () => {
  it.each([12, 2, 4.375, 0, 5, 4])('resolves exact time %s in nonmonotonic order against independently captured engine evidence', async timeS => {
    const { design, source, observations, assetId } = fixture(), before = structuredClone({ design, source });
    const result = await resolveInspection(design, source, { assetId, timeS, boundary: 'post' }, immediate);
    expect(result).toMatchObject({ status: 'resolved', requestedTimeS: timeS, resolvedTimeS: timeS, boundary: 'post' });
    expect(canonical(result.state)).toEqual(canonical(observations.get(timeS)));
    expect(result.summary).toEqual(summarizeObservedBoundary(design, observations.get(timeS)!));
    expect(result.samples.at(-1)?.timeS).toBe(timeS);
    expect({ design, source }).toEqual(before);
  });
  it.each([[4.375, 4], [2, 1], [12, 11]])('previous boundary before %s resolves actual time %s rather than an epsilon interpolation', async (timeS, expectedTime) => {
    const { design, source, observations, assetId } = fixture();
    const result = await resolveInspection(design, source, { assetId, timeS, boundary: 'previous' }, immediate);
    expect(result.resolvedTimeS).toBe(expectedTime);
    expect(canonical(result.state)).toEqual(canonical(observations.get(expectedTime)));
  });
  it.each([4.3, 4.374999, -1, NaN, 13])('time %s produces explicit unavailable history and no invented summary', async timeS => {
    const { design, source, assetId } = fixture();
    const result = await resolveInspection(design, source, { assetId, timeS, boundary: 'post' }, immediate);
    expect(result).toMatchObject({ status: 'unavailable-history', state: null, resolvedTimeS: null, summary: null, residuals: null });
  });
  it('rejects absent asset, legacy initial history, and a pre-zero boundary explicitly', async () => {
    const { design, source, assetId } = fixture();
    expect(await resolveInspection(design, source, { assetId: 'missing', timeS: 2, boundary: 'post' }, immediate)).toMatchObject({ status: 'unsupported', state: null });
    expect(await resolveInspection(design, initialize(design), { assetId, timeS: 0, boundary: 'post' }, immediate)).toMatchObject({ status: 'unsupported', state: null });
    expect(await resolveInspection(design, source, { assetId, timeS: 0, boundary: 'previous' }, immediate)).toMatchObject({ status: 'unavailable-history', state: null });
  });
  it('shows all same-time external inputs before any physical scene at that time', async () => {
    const d = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 }), id = `${d.modules[0].id}/pump-duty`;
    const def = createExperimentDefinition(d, { id: 'p7-simultaneous', durationS: 5, disturbances: [
      { id: 'trip-first', sequence: 0, timeS: 2, kind: 'trip', assetId: id },
      { id: 'restore-second', sequence: 1, timeS: 2, kind: 'restore', assetId: id },
    ] });
    const initial = initialize(d, def), source = advance(d, initial, 5), expected = advance(d, initial, 2);
    const resolved = await resolveInspection(d, source, { assetId: id, timeS: 2, boundary: 'post' }, immediate);
    expect(canonical(resolved.state)).toEqual(canonical(expected));
    expect(resolved.state!.appliedEventIds).toEqual(['trip-first', 'restore-second']);
    expect(resolved.state!.failedAssetIds).not.toContain(id);
    expect(operatorEvents(source).filter(event => event.id.startsWith('input:')).map(event => event.id)).toEqual(['input:trip-first', 'input:restore-second']);
  });
  it('cancellation and replay wall budget retain source and return no partial scene', async () => {
    const { design, source, assetId } = fixture(), before = structuredClone(source);
    const cancelled = await resolveInspection(design, source, { assetId, timeS: 12, boundary: 'post' }, { ...immediate, cancelled: () => true });
    expect(cancelled).toMatchObject({ status: 'unavailable-history', state: null, summary: null, work: 0 });
    expect(cancelled.reason).toContain('cancelled');
    let ticks = 0;
    const budget = await resolveInspection(design, source, { assetId, timeS: 12, boundary: 'post' }, { ...immediate, now: () => ticks++ * INSPECTION_LIMITS.wallMs });
    expect(budget).toMatchObject({ status: 'unavailable-history', state: null, summary: null, work: 0 });
    expect(budget.reason).toContain('budget');
    expect(source).toEqual(before);
  });
  it('binds history identity to original run inputs and initial state, independently of stepping', () => {
    const { design, initial, source } = fixture();
    expect(inspectionRunIdentity(design, source)).toBe(inspectionRunIdentity(design, initial));
    const different = initialize(design, createExperimentDefinition(design, { id: 'another-run', durationS: 12 }));
    expect(inspectionRunIdentity(design, different)).not.toBe(inspectionRunIdentity(design, source));
    const edited = advance(design, initial, 1, [{ id: 'new-workload', timeS: 0, kind: 'workload', assetId: 'shore/grid', value: 0.3 }]);
    expect(inspectionRunIdentity(design, edited)).not.toBe(inspectionRunIdentity(design, initial));
  });
  it('invalidates a captured history request when the selected design changes before active state catches up', () => {
    const { design, source } = fixture();
    const replacement = buildDesign({ ...design.config, requestedAccelerators: 48 });
    expect(replacement.revision).not.toBe(design.revision);
    expect(inspectionRunIdentity(replacement, source)).not.toBe(inspectionRunIdentity(design, source));
  });
  it('bounds retained chart data and preserves sampled extrema without reducing exact aggregates', async () => {
    const d = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 }), id = `${d.modules[0].id}/pump-duty`;
    const def = createExperimentDefinition(d, { id: 'p7-retention', durationS: 200 });
    const coolant: number[] = [];
    const source = advanceWithStep(d, initialize(d, def), 200, [], 1, undefined, (_time, copy) => coolant.push(copy().modules[0].coolantK));
    const before = structuredClone(source), started = performance.now(), memory = process.memoryUsage();
    const result = await resolveInspection(d, source, { assetId: id, timeS: 200, boundary: 'post' }, immediate);
    expect(result.status).toBe('resolved');
    expect(result.samples.length).toBeLessThanOrEqual(INSPECTION_LIMITS.samples);
    expect(result.truncated).toBe(true);
    expect(result.samplesSeen).toBe(coolant.length);
    expect(Math.min(...result.samples.map(sample => sample.coolantK))).toBe(Math.min(...coolant));
    expect(Math.max(...result.samples.map(sample => sample.coolantK))).toBe(Math.max(...coolant));
    expect(canonical(result.state)).toEqual(canonical(source));
    expect(source).toEqual(before);
    console.info(JSON.stringify({ evidence: 'phase7-history-retention', node: process.version, platform: process.platform, architecture: process.arch, modules: d.modules.length, durationS: 200, elapsedMs: performance.now() - started, rssBefore: memory.rss, rssAfter: process.memoryUsage().rss, samples: result.samples.length, seen: result.samplesSeen }));
  });
});
