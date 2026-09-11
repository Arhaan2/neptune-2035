import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import type { ExperimentDefinition } from '../src/twin/experiment/types';
import { recoveryReport } from '../src/twin/experiment/metrics';
import { parseProject, projectFile, restoreProject, serializeProject } from '../src/twin/persistence/project';
import type { Design, OperationEvent, SimulationState } from '../src/twin/types';

const small = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const beginExperiment = (design: Design, definition: ExperimentDefinition) => initialize(design, definition);
const runExperiment = (design: Design, definition: ExperimentDefinition) => advance(design, initialize(design, definition), definition.durationS + (definition.initial.settling?.maxWarmupS ?? 0));
const faults = (tripS = 5, restoreS = 15): OperationEvent[] => [
  { id: 'core-trip', timeS: tripS, assetId: 'shore/cluster-core', kind: 'trip' },
  { id: 'core-restore', timeS: restoreS, assetId: 'shore/cluster-core', kind: 'restore' },
];
function physical(state: SimulationState) { const { experiment: _experiment, solverMs: _solverMs, ...rest } = state; return rest; }

describe('PH4 canonical execution path and boundary behavior', () => {
  it('exposes the whole earlier outage although the final physical snapshot is healthy', () => {
    const design = small(), definition = createExperimentDefinition(design, { durationS: 20, disturbances: faults() });
    const state = runExperiment(design, definition), run = state.experiment!;
    expect(summarize(design, state)).toMatchObject({ timeS: 20, availableAccelerators: 8, energizedAccelerators: 8, curtailedAccelerators: 0 });
    expect(run.status).toBe('completed');
    expect(run.evaluation.outcome).toBe('FAIL');
    expect(run.metrics).toMatchObject({ elapsedS: 20, shortfallAcceleratorS: 80, serviceViolationS: 10, firstServiceViolationS: 5, interruptionCount: 1, longestInterruptionS: 10 });
    expect(run.metrics.minServiceable).toMatchObject({ value: 0, timeS: 5 });
    expect(recoveryReport(run.metrics, run.status)).toMatchObject({ status: 'recovered', onsetTimeS: 15, confirmationTimeS: 20, referenceEventId: 'core-trip' });
  });
  it.each([[0, 5, 40, 5], [5, 20, 120, 15]])('trip %is restore %is integrates %i accelerator-seconds over %is', (tripS, restoreS, shortfall, violationS) => {
    const design = small(), state = runExperiment(design, createExperimentDefinition(design, { durationS: 20, disturbances: faults(tripS, restoreS) }));
    expect(state.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: shortfall, serviceViolationS: violationS, firstServiceViolationS: tripS });
    expect(summarize(design, state).availableAccelerators).toBe(8);
    if (restoreS === 20) expect(recoveryReport(state.experiment!.metrics, state.experiment!.status).status).toBe('not-recovered');
  });
  it('records a terminal trip with zero integrated outage while refusing recovered/PASS', () => {
    const design = small(), state = runExperiment(design, createExperimentDefinition(design, { durationS: 20, disturbances: [faults(20, 20)[0]] }));
    expect(state.experiment!.metrics).toMatchObject({ elapsedS: 20, shortfallAcceleratorS: 0, serviceViolationS: 0 });
    expect(summarize(design, state).availableAccelerators).toBe(0);
    expect(state.experiment!.metrics.minServiceable).toMatchObject({ value: 0, timeS: 20 });
    expect(recoveryReport(state.experiment!.metrics, 'completed').status).toBe('not-recovered');
    expect(state.experiment!.evaluation.outcome).toBe('FAIL');
  });
  it('supports a healthy zero-duration completed observation without adding a numerical interval', () => {
    const design = small(), state = runExperiment(design, createExperimentDefinition(design, { durationS: 0 }));
    expect(state.experiment!.status).toBe('completed');
    expect(state.experiment!.evaluation.outcome).toBe('PASS');
    expect(state.experiment!.metrics).toMatchObject({ elapsedS: 0, committedIntervals: 0, shortfallAcceleratorS: 0, serviceViolationS: 0, batteryDischargeWh: 0, batteryChargeWh: 0 });
  });
  it('keeps simultaneous trip/restore order deterministic with zero interval-duration outage', () => {
    const design = small(), definition = createExperimentDefinition(design, { durationS: 20, disturbances: faults(5, 5) });
    const state = runExperiment(design, definition);
    expect(state.appliedEventIds).toEqual(['core-trip', 'core-restore']);
    expect(state.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 0, serviceViolationS: 0 });
    expect(summarize(design, state).availableAccelerators).toBe(8);
  });
  it('applies explicit required-capacity changes without inventing an outage after demand is removed', () => {
    const design = small(), state = runExperiment(design, createExperimentDefinition(design, { durationS: 20, disturbances: faults(), requiredCapacitySchedule: [{ timeS: 10, requiredAccelerators: 0 }] }));
    expect(state.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 40, serviceViolationS: 5, firstServiceViolationS: 5 });
  });
  it('keeps all accumulated metrics independent of manual stepping and sparse snapshots', () => {
    const design = small(), definition = createExperimentDefinition(design, { durationS: 20, disturbances: faults() });
    const continuous = runExperiment(design, definition);
    let stepped = beginExperiment(design, definition);
    for (let second = 0; second < 20; second++) stepped = advance(design, stepped, 1);
    expect(physical(stepped)).toEqual(physical(continuous));
    expect(stepped.experiment).toEqual(continuous.experiment);
    const before = structuredClone(stepped.experiment);
    for (let snapshot = 0; snapshot < 5; snapshot++) { summarize(design, stepped); projectFile(design, stepped); }
    expect(stepped.experiment).toEqual(before);
  });
});

describe('PH4 atomic persistence and operational continuity', () => {
  it.each([7, 17])('roundtrips and resumes physical+metric state mid-violation or dwell at %is', checkpointS => {
    const design = small(), definition = createExperimentDefinition(design, { durationS: 20, disturbances: faults() });
    const checkpoint = advance(design, beginExperiment(design, definition), checkpointS);
    const serialized = serializeProject(projectFile(design, checkpoint));
    const imported = parseProject(serialized), restored = restoreProject(imported);
    expect(serializeProject(imported)).toBe(serialized);
    expect(restored.state.experiment).toEqual(checkpoint.experiment);
    const resumed = advance(restored.design, restored.state, 20 - checkpointS), continuous = runExperiment(design, definition);
    expect(physical(resumed)).toEqual(physical(continuous));
    expect(resumed.experiment).toEqual(continuous.experiment);
  });
  it('price-only edits preserve the exact accumulated physical experiment', () => {
    const design = small(), definition = createExperimentDefinition(design, { durationS: 20, disturbances: faults() });
    const checkpoint = advance(design, beginExperiment(design, definition), 7), repriced = updateEconomicAssumptions(design, { unitCostScale: 1.5 });
    const resumed = advance(repriced, checkpoint, 13), continuous = runExperiment(design, definition);
    expect(physical(resumed)).toEqual(physical(continuous));
    expect(resumed.experiment).toEqual(continuous.experiment);
  });
  it('keeps discharge followed by recharge separate and replays controller transitions exactly once', () => {
    const design = small(), disturbances: OperationEvent[] = [{ id: 'grid-trip', timeS: 2, assetId: 'shore/grid', kind: 'trip' }, { id: 'grid-restore', timeS: 8, assetId: 'shore/grid', kind: 'restore' }];
    const definition = createExperimentDefinition(design, { durationS: 20, disturbances });
    const state = runExperiment(design, definition), metrics = state.experiment!.metrics;
    expect(metrics.batteryDischargeWh).toBeGreaterThan(0);
    expect(metrics.batteryChargeWh).toBeGreaterThan(0);
    expect(metrics.batteryLossWh).toBeGreaterThan(0);
    expect(metrics.batteryNetChangeWh).toBeCloseTo(metrics.batteryChargeWh! - metrics.batteryDischargeWh! - metrics.batteryLossWh!, 6);
    const replayed = runExperiment(design, definition);
    expect(replayed.experiment!.metrics).toEqual(metrics);
    const refreshed = restoreProject(parseProject(serializeProject(projectFile(design, state))));
    expect(refreshed.state.experiment!.metrics.controllerTransitionCount).toBe(metrics.controllerTransitionCount);
  });
});

describe('PH4 actual settling boundaries and state preservation', () => {
  it('starts evaluation only after continuous physical settling and preserves the warmed physical state', () => {
    const design = small(), definition = createExperimentDefinition(design, { durationS: 20, initial: { mode: 'settled', settling: { dwellS: 2, maxWarmupS: 10, maxTemperatureRateKPerS: 1 } } });
    const initial = beginExperiment(design, definition), warmed = advance(design, initial, 2);
    expect(warmed.experiment!.warmup).toMatchObject({ status: 'settled', settledAtS: 2, elapsedS: 2 });
    expect(warmed.experiment!.originTimeS).toBe(2);
    expect(warmed.experiment!.metrics.elapsedS).toBe(0);
    expect(warmed.modules).toEqual(advance(design, initialize(design), 2).modules);
    const completed = advance(design, warmed, 20);
    expect(completed.timeS).toBe(22);
    expect(completed.experiment!.metrics.elapsedS).toBe(20);
    expect(completed.experiment!.status).toBe('completed');
  });
  it('records a genuine warmup timeout with no fabricated successful equilibrium or evaluation window', () => {
    const design = small(), state = runExperiment(design, createExperimentDefinition(design, { durationS: 20, initial: { mode: 'settled', settling: { maxWarmupS: 2, dwellS: 2, maxTemperatureRateKPerS: 0 } } }));
    expect(state.timeS).toBe(2);
    expect(state.experiment!.warmup.status).toBe('timeout');
    expect(state.experiment!.status).toBe('warmup-timeout');
    expect(state.experiment!.originTimeS).toBeNull();
    expect(state.experiment!.metrics.elapsedS).toBe(0);
    expect(state.experiment!.evaluation.outcome).toBe('INCOMPLETE');
    expect(state.experiment!.reason).toMatch(/settling|warmup/i);
  });
  it('cannot confirm controller-quiescent settling at a boundary where thermal control actually changes', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1280, workload: 1, pumpSpeed: 0 });
    const physicalRun = advance(design, initialize(design), 600);
    const transition = physicalRun.log.find(entry => entry.kind === 'controller' && entry.message.includes('Thermal hysteresis'));
    expect(transition).toBeDefined();
    const crossingS = transition!.timeS;
    expect(crossingS).toBeGreaterThan(0);
    const definition = createExperimentDefinition(design, { durationS: 1, initial: { mode: 'settled', settling: { maxWarmupS: crossingS + 10, dwellS: crossingS, maxTemperatureRateKPerS: 100, maxBatteryRateWhPerS: 1000, requireControllerQuiescence: true, requireService: false, requireThermal: false } } });
    const state = advance(design, beginExperiment(design, definition), crossingS);
    expect(state.log.some(entry => entry.kind === 'controller' && entry.timeS === crossingS && entry.message.includes('Thermal hysteresis'))).toBe(true);
    expect(state.experiment!.originTimeS).toBeNull();
    expect(state.experiment!.warmup.status).toBe('warming');
    expect(state.experiment!.warmup.candidateSinceS).toBeNull();
  });
});
