import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { attachExperiment, finishExperimentBoundary } from '../src/twin/experiment/runtime';
import { replayExperimentState } from '../src/twin/experiment/runner';
import { validateState } from '../src/twin/persistence/state';
import { CONTRACT } from '../src/twin/persistence/limits';
import type { WorkerRequest, WorkerResponse } from '../src/twin/types';

const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const definition = createExperimentDefinition(design, { durationS: 20, disturbances: [
  { id: 'worker-trip', timeS: 5, assetId: 'shore/cluster-core', kind: 'trip' },
  { id: 'worker-restore', timeS: 15, assetId: 'shore/cluster-core', kind: 'restore' },
] });
const request = (patch: Partial<WorkerRequest> = {}): WorkerRequest => ({ version: 2, requestId: 1, epoch: 1, kind: 'replay', design, experimentDefinition: definition, durationS: 20, ...patch });
async function run(patch: Partial<WorkerRequest> = {}, cadenceMs = 0) {
  const responses: WorkerResponse[] = [];
  let clock = 0;
  await createWorkerHandler(response => responses.push(structuredClone(response)), async () => { clock += cadenceMs; }, () => clock)(request(patch));
  return responses;
}

describe('PH4 authoritative metrics independent of worker grouping and delivery', () => {
  it.each([1, 2, 3, 9, 10])('reproduces complete metrics with %is worker requests', async chunkS => {
    const expected = advance(design, initialize(design, definition), 20), responses = await run({ chunkS });
    expect(responses.at(-1)?.status).toBe('complete');
    expect(responses.at(-1)?.state?.experiment).toEqual(expected.experiment);
    for (const response of responses.filter(value => value.status === 'progress')) {
      const canonical = advance(design, initialize(design, definition), response.state!.timeS);
      expect(response.state!.experiment!.metrics).toEqual(canonical.experiment!.metrics);
      expect(response.state!.experiment!.committedTimeS).toBe(response.state!.timeS);
    }
  });
  it.each([0, 249, 250, 1000])('changing progress cadence to %ims cannot change accumulated results', async cadenceMs => {
    const responses = await run({ chunkS: 2 }, cadenceMs);
    expect(responses.at(-1)?.state?.experiment).toEqual(advance(design, initialize(design, definition), 20).experiment);
  });
  it('ignores duplicate or stale requests without delivering or accumulating a second completed experiment', async () => {
    const responses: WorkerResponse[] = [];
    const handler = createWorkerHandler(response => responses.push(structuredClone(response)), async () => {}, () => 0);
    await handler(request({ epoch: 2, requestId: 5 }));
    const completed = structuredClone(responses);
    await handler(request({ epoch: 2, requestId: 5 }));
    await handler(request({ epoch: 1, requestId: 6 }));
    expect(responses).toEqual(completed);
    expect(responses.at(-1)!.state!.experiment!.metrics.shortfallAcceleratorS).toBe(80);
  });
  it('restores pending recovery in a fresh worker and continues exactly once', async () => {
    const state = advance(design, initialize(design, definition), 17);
    const restored = await run({ kind: 'restore', state, experimentDefinition: undefined, durationS: 0, events: [] });
    expect(restored.at(-1)?.state?.experiment).toEqual(state.experiment);
    const resumed = await run({ kind: 'advance', state: restored.at(-1)!.state, experimentDefinition: undefined, durationS: 3, chunkS: 1, events: [] });
    expect(resumed.at(-1)?.state?.experiment).toEqual(advance(design, initialize(design, definition), 20).experiment);
  });
  it('cancellation retains the last accepted interval and an incomplete lifecycle', async () => {
    const responses: WorkerResponse[] = [], waiters: (() => void)[] = [];
    const handler = createWorkerHandler(response => responses.push(structuredClone(response)), () => new Promise<void>(resolve => waiters.push(resolve)), () => 0);
    const running = handler(request({ chunkS: 3 }));
    const tick = async () => { expect(waiters.length).toBeGreaterThan(0); waiters.shift()!(); await Promise.resolve(); await Promise.resolve(); };
    await tick(); // First complete 3-second chunk; definition events are already admitted.
    await tick(); // Second complete chunk at t=6, after the t=5 fault.
    await handler(request({ kind: 'cancel', epoch: 2, requestId: 2 }));
    const cancelled = responses.at(-1)!;
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.state?.timeS).toBe(6);
    expect(cancelled.state?.experiment?.status).toBe('cancelled');
    expect(cancelled.state?.experiment?.evaluation.outcome).toBe('INCOMPLETE');
    expect(cancelled.state?.experiment?.metrics).toMatchObject({ elapsedS: 6, shortfallAcceleratorS: 8, serviceViolationS: 1 });
    await tick(); await running;
    expect(responses.at(-1)).toBe(cancelled);
  });
  it('resource-limited execution preserves zero completed coverage without manufacturing PASS', async () => {
    let clock = 0;
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => { clock = CONTRACT.maxJobWallMs; }, () => clock)(request());
    const result = responses.at(-1)!;
    expect(result.status).toBe('resource-limited');
    expect(result.state?.experiment?.status).toBe('resource-limited');
    expect(result.state?.experiment?.evaluation.outcome).toBe('INCOMPLETE');
    expect(result.state?.experiment?.metrics.elapsedS).toBe(0);
  });
  it('replays an explicit custom initial physical checkpoint without refilling or resetting it', async () => {
    let custom = initialize(design);
    Object.assign(custom.modules[0], { coolantK: 305, airK: 303, batteryWh: 200000 });
    custom = advance(design, custom, 0);
    attachExperiment(design, custom, definition);
    finishExperimentBoundary(custom); // Commit the initial observation before creating the source run.
    validateState(design, custom);
    const source = advance(design, custom, 20);
    validateState(design, source);
    const initial = replayExperimentState(design, source);
    expect(() => validateState(design, initial)).not.toThrow();
    expect(initial.experiment!.initialState).toEqual(source.experiment!.initialState);
    expect(initial.experiment!.initialState.modules[0].batteryWh).toBe(200000);
    expect(initial.experiment!.initialState.modules[0].coolantK).toBe(305);
    const replayed = await run({ kind: 'replay', state: initial, experimentDefinition: undefined, durationS: 20, events: [] });
    expect(replayed.at(-1)?.status).toBe('complete');
    expect(replayed.at(-1)?.state?.modules).toEqual(source.modules);
    expect(replayed.at(-1)?.state?.experiment?.metrics).toEqual(source.experiment!.metrics);
  });
  it.each([0, 20])('commits declared time-zero inputs before admitting a %is replay checkpoint', async durationS => {
    const definition = createExperimentDefinition(design, { durationS, disturbances: [
      { id: 'replay-initial-trip', timeS: 0, assetId: 'shore/cluster-core', kind: 'trip' },
    ] });
    const source = advance(design, initialize(design, definition), durationS);
    const initial = replayExperimentState(design, source);
    expect(() => validateState(design, initial)).not.toThrow();
    expect(initial.appliedEventIds).toContain('replay-initial-trip');
    const replayed = await run({ kind: 'replay', state: initial, experimentDefinition: undefined, durationS, events: [] });
    expect(replayed.at(-1)?.status).toBe('complete');
    expect(replayed.at(-1)?.state?.experiment).toEqual(source.experiment);
    expect(replayed.at(-1)?.state?.modules).toEqual(source.modules);
  });
  it.each(['cold', 'settled'] as const)('replay retains all interactive inputs in an explicit derived %s definition', async mode => {
    const definition = createExperimentDefinition(design, { durationS: 20, disturbances: [
      { id: 'worker-trip', timeS: 5, assetId: 'shore/cluster-core', kind: 'trip' },
      { id: 'worker-restore', timeS: 15, assetId: 'shore/cluster-core', kind: 'restore' },
    ], initial: { mode, settling: { maxWarmupS: 10, dwellS: 2, maxTemperatureRateKPerS: 1 } } });
    const prepared = mode === 'settled' ? advance(design, initialize(design, definition), 2) : initialize(design, definition);
    const origin = prepared.experiment!.originTimeS!;
    const source = advance(design, prepared, 20, [{ id: 'recorded-interactive-workload', timeS: origin + 6, kind: 'workload', assetId: 'shore/grid', value: 0.3 }]);
    const initial = replayExperimentState(design, source);
    expect(() => validateState(design, initial)).not.toThrow();
    expect(initial.experiment!.definition.provenance.parentDefinitionId).toBe(definition.id);
    expect(initial.experiment!.definition.disturbances.find(event => event.id === 'recorded-interactive-workload')).toMatchObject({ timeS: 6, kind: 'workload', value: 0.3 });
    const replayed = await run({ kind: 'replay', state: initial, experimentDefinition: undefined, durationS: source.timeS, events: [] });
    expect(replayed.at(-1)?.status).toBe('complete');
    expect(replayed.at(-1)?.state?.appliedEventIds).toEqual(source.appliedEventIds);
    expect(replayed.at(-1)?.state?.modules).toEqual(source.modules);
    expect(replayed.at(-1)?.state?.experiment?.metrics).toEqual(source.experiment!.metrics);
  });
});
