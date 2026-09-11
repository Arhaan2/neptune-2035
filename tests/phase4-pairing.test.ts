import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { referenceExperiment } from '../src/twin/experiment/demonstrations';
import { beginExperiment, comparePair, counterfactualDefinition, runExperiment, runFaultPair } from '../src/twin/experiment/runner';
import { wholeExperimentReport } from '../src/twin/experiment/report';
import { setExperimentStatus } from '../src/twin/experiment/runtime';
import { evaluateExperiment } from '../src/twin/experiment/metrics';
import { parseProject, projectFile, restoreProject, serializeProject } from '../src/twin/persistence/project';

const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });

describe('PH4 fair faulted/unfaulted pairs and reported evidence', () => {
  it('starts both branches from identical physical state and reports the actual incremental shortfall', () => {
    const definition = referenceExperiment(design), { faulted, baseline, comparison } = runFaultPair(design, definition);
    expect(faulted.experiment!.initialState).toEqual(baseline.experiment!.initialState);
    expect(faulted.experiment!.initialStateIdentity).toBe(baseline.experiment!.initialStateIdentity);
    expect(faulted.experiment!.initialState.failedAssetIds).toEqual([]);
    expect(baseline.experiment!.initialState.failedAssetIds).toEqual([]);
    expect(comparison.status).toBe('comparable');
    expect(comparison.absolute).toMatchObject({ faulted: { shortfallAcceleratorS: 80, serviceViolationS: 10, minimumServiceableAccelerators: 0, outcome: 'FAIL' }, baseline: { shortfallAcceleratorS: 0, serviceViolationS: 0, minimumServiceableAccelerators: 8, outcome: 'PASS' } });
    expect(comparison.difference).toMatchObject({ shortfallAcceleratorS: 80, serviceViolationS: 10 });
  });
  it('suppresses only the declared fault sequence while retaining environmental/workload inputs', () => {
    const definition = createExperimentDefinition(design, { durationS: 20, disturbances: [
      { id: 'trip', timeS: 5, kind: 'trip', assetId: 'shore/cluster-core' },
      { id: 'utilization', timeS: 10, kind: 'workload', assetId: 'shore/grid', value: 0.3 },
      { id: 'sea', timeS: 10, kind: 'seawater', assetId: 'shore/grid', value: 295.15 },
      { id: 'restore', timeS: 15, kind: 'restore', assetId: 'shore/cluster-core' },
    ] });
    const unfaulted = counterfactualDefinition(design, definition);
    expect(unfaulted.disturbances.map(event => event.id)).toEqual(['utilization', 'sea']);
    expect(unfaulted.provenance.parentDefinitionId).toBe(definition.id);
    expect(unfaulted.workload).toEqual(definition.workload);
    expect(unfaulted.environment).toEqual(definition.environment);
    const result = runFaultPair(design, definition);
    expect(result.comparison.status).toBe('comparable');
    expect(result.faulted.workload).toBe(0.3);
    expect(result.baseline.workload).toBe(0.3);
    expect(result.faulted.seawaterK).toBe(295.15);
    expect(result.baseline.seawaterK).toBe(295.15);
  });
  it('reports matching settled origins and retains warmup independently of evaluation', () => {
    const definition = createExperimentDefinition(design, { durationS: 20, disturbances: referenceExperiment(design).disturbances, initial: { mode: 'settled', settling: { maxWarmupS: 10, dwellS: 2, maxTemperatureRateKPerS: 1 } } });
    const result = runFaultPair(design, definition);
    expect(result.comparison.status).toBe('comparable');
    expect(result.faulted.experiment!.originTimeS).toBe(2);
    expect(result.baseline.experiment!.originTimeS).toBe(2);
    expect(result.comparison.absolute).toMatchObject({ faulted: { warmupS: 2, shortfallAcceleratorS: 80 }, baseline: { warmupS: 2, shortfallAcceleratorS: 0 } });
  });
  it('rejects mismatched workload and numerical settings with no apparent valid delta', () => {
    const faulted = runExperiment(design, referenceExperiment(design));
    const changed = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, workload: 0.3 });
    const changedBaseline = runExperiment(changed, createExperimentDefinition(changed, { durationS: 20 }));
    expect(comparePair(faulted, changedBaseline)).toMatchObject({ status: 'mismatched', difference: null, absolute: null });
    const changedStep = runExperiment(design, createExperimentDefinition(design, { durationS: 20, integrationStepS: 0.5 }));
    expect(comparePair(faulted, changedStep)).toMatchObject({ status: 'mismatched', difference: null });
  });
  it.each(['paused', 'cancelled', 'numerical-failed', 'resource-limited'] as const)('rejects a %s partial branch without publishing incremental results', status => {
    const definition = referenceExperiment(design), baseline = runExperiment(design, counterfactualDefinition(design, definition));
    const partial = setExperimentStatus(advance(design, beginExperiment(design, definition), 7), status, 'Controlled incomplete observation fixture');
    expect(comparePair(partial, baseline)).toMatchObject({ status: 'incomplete', difference: null, absolute: null });
  });
  it('rejects an undeclared interactive input instead of claiming a controlled counterfactual pair', () => {
    const definition = referenceExperiment(design);
    const state = advance(design, beginExperiment(design, definition), 20, [{ id: 'interactive', timeS: 10, assetId: 'shore/grid', kind: 'workload', value: 0.2 }]);
    const baseline = runExperiment(design, counterfactualDefinition(design, definition));
    expect(comparePair(state, baseline)).toMatchObject({ status: 'mismatched', difference: null });
  });
  it('retains pair results across project import/export and labels supplied evidence honestly', () => {
    const result = runFaultPair(design, referenceExperiment(design));
    const restored = [result.faulted, result.baseline].map(state => restoreProject(parseProject(serializeProject(projectFile(design, state)))).state);
    expect(comparePair(restored[0], restored[1])).toEqual(result.comparison);
    const report = wholeExperimentReport(restored[0]);
    expect(report.available).toBe(true);
    if (!report.available) throw Error('Expected explicit whole-run report.');
    expect(report.units.shortfallAcceleratorS).toBe('accelerator-seconds of unmet requirement');
    expect(report.evidence.source).toMatch(/supplied evidence, not independently verified/);
    expect(report.evidence.trace).toMatch(/authoritative aggregate metrics/);
    expect(report.finalState.serviceableAccelerators).toBe(8);
    expect(report.metrics.shortfallAcceleratorS).toBe(80);
    const legacy = wholeExperimentReport(advance(design, initialize(design), 20));
    expect(legacy).toMatchObject({ available: false });
    expect(legacy.explanation).toMatch(/Whole-run metrics unavailable for this legacy run/);
  });
  it('refuses an incremental comparison when the imported terminal observation is unavailable', () => {
    const { faulted, baseline } = runFaultPair(design, referenceExperiment(design));
    const supplied = structuredClone(faulted);
    supplied.experiment!.metrics.boundaryHealthy = null;
    supplied.experiment!.evaluation = evaluateExperiment(supplied.experiment!);
    expect(supplied.experiment!.evaluation.outcome).toBe('UNAVAILABLE');
    const restored = restoreProject(parseProject(serializeProject(projectFile(design, supplied)))).state;
    expect(comparePair(restored, baseline)).toMatchObject({ status: 'incomplete', absolute: null, difference: null });
  });
});
