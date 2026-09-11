import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, replaceEquipment } from '../src/twin/assets/design';
import { economicIdentity, engineeringIdentity, updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { createExperimentDefinition, disturbanceFootprints, requiredCapacityAt, validateExperimentDefinition } from '../src/twin/experiment/definition';
import { METRICS_VERSION } from '../src/twin/experiment/types';
import type { OperationEvent } from '../src/twin/types';

const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 72, workload: 0.2 });

describe('PH4 reproducible definition contract', () => {
  it('binds physical design, workload, environment, controller, versions, criteria and supported timestep', () => {
    const definition = createExperimentDefinition(design, { durationS: 20 });
    expect(definition).toMatchObject({ durationS: 20, physicalIdentity: engineeringIdentity(design), designRevision: design.revision, modelId: 'neptune-reference-3', solverVersion: '2.3.0', algorithmId: 'committed-boundary-1', metricsVersion: METRICS_VERSION, integrationStepS: 1 });
    expect(definition.workload).toMatchObject({ requiredAccelerators: 72, utilization: 0.2, requireClusterNetwork: true });
    expect(definition.workload.profile.length).toBeGreaterThan(0);
    expect(definition.controllerPolicy.length).toBeGreaterThan(0);
    expect(definition.environment).toEqual({ seawaterK: design.config.seawaterK, foulingResistanceKPerW: design.config.foulingResistanceKPerW, pumpSpeed: design.config.pumpSpeed });
    expect(definition.recovery).toMatchObject({ dwellS: 5, thermalComparator: 'strictly-below', scope: 'all-modules-and-required-service' });
    expect(definition.initial).toMatchObject({ mode: 'cold', settling: null, includeWarmupInEvaluation: false });
  });
  it('does not scale required accelerator capacity by electrical utilization', () => {
    for (const workload of [0, 0.2, 1]) {
      const d = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 72, workload });
      const definition = createExperimentDefinition(d, { durationS: 10 });
      expect(requiredCapacityAt(definition, 0)).toBe(72);
      expect(requiredCapacityAt(definition, 10)).toBe(72);
    }
  });
  it('persists explicit capacity changes and applies them at the declared boundaries', () => {
    const definition = createExperimentDefinition(design, { durationS: 20, requiredAccelerators: 20, requiredCapacitySchedule: [{ timeS: 5, requiredAccelerators: 40 }, { timeS: 15, requiredAccelerators: 0 }] });
    expect([0, 4.999, 5, 14.999, 15, 20].map(time => requiredCapacityAt(definition, time))).toEqual([20, 20, 40, 40, 0, 0]);
  });
  it('retains deterministic simultaneous event admission order and clones caller event input', () => {
    const disturbances: OperationEvent[] = [{ id: 'z-trip', timeS: 5, assetId: 'shore/cluster-core', kind: 'trip' }, { id: 'a-restore', timeS: 5, assetId: 'shore/cluster-core', kind: 'restore' }];
    const definition = createExperimentDefinition(design, { durationS: 20, disturbances });
    expect(definition.disturbances.map(event => event.id)).toEqual(['z-trip', 'a-restore']);
    expect(definition.disturbances[1].sequence!).toBeGreaterThan(definition.disturbances[0].sequence!);
    disturbances[0].assetId = 'shore/grid';
    expect(definition.disturbances[0].assetId).toBe('shore/cluster-core');
  });
  it('preserves price-only compatibility and rejects a physical replacement', () => {
    const definition = createExperimentDefinition(design, { durationS: 20 });
    const repriced = updateEconomicAssumptions(design, { unitCostScale: 1.5 });
    expect(economicIdentity(repriced)).not.toBe(economicIdentity(design));
    expect(() => validateExperimentDefinition(repriced, definition)).not.toThrow();
    const replaced = replaceEquipment(design, `${design.modules[0].id}/pump-duty`, 'pump-efficient');
    expect(() => validateExperimentDefinition(replaced, definition)).toThrow(/design|physical/i);
  });
  it('persists all continuous settling predicates with an explicit maximum warmup', () => {
    const definition = createExperimentDefinition(design, { durationS: 20, initial: { mode: 'settled', settling: { maxWarmupS: 90, dwellS: 10, maxTemperatureRateKPerS: 0.01, maxBatteryRateWhPerS: 0.1, requireControllerQuiescence: true } } });
    expect(definition.initial).toMatchObject({ mode: 'settled', includeWarmupInEvaluation: false, settling: { maxWarmupS: 90, dwellS: 10, maxTemperatureRateKPerS: 0.01, maxBatteryRateWhPerS: 0.1, requireControllerQuiescence: true, requireService: true, requireThermal: true } });
  });
  it.each([NaN, Infinity, -1, 0.5])('rejects invalid or off-grid duration %s', durationS => {
    expect(() => createExperimentDefinition(design, { durationS })).toThrow();
  });
  it.each([NaN, Infinity, -1])('rejects invalid required capacity %s', requiredAccelerators => {
    expect(() => createExperimentDefinition(design, { durationS: 20, requiredAccelerators })).toThrow();
  });
  it.each([0.5, 21])('rejects disturbance time %s outside supported integer grid or experiment horizon', timeS => {
    expect(() => createExperimentDefinition(design, { durationS: 20, disturbances: [{ id: 'bad-time', timeS, assetId: 'shore/cluster-core', kind: 'trip' }] })).toThrow();
  });
  it('rejects unknown assets and unsupported criteria rather than silently ignoring them', () => {
    expect(() => createExperimentDefinition(design, { durationS: 20, disturbances: [{ id: 'unknown', timeS: 1, assetId: 'unknown/asset', kind: 'trip' }] })).toThrow();
    const definition = createExperimentDefinition(design, { durationS: 20 });
    Object.assign(definition.success, { maxTrainingTokenLoss: 100 });
    expect(() => validateExperimentDefinition(design, definition)).toThrow();
  });
  it('rejects unsupported experiment versions and numerical versions', () => {
    for (const key of ['version', 'metricsVersion', 'solverVersion', 'modelId', 'algorithmId'] as const) {
      const definition = createExperimentDefinition(design, { durationS: 20 });
      Object.assign(definition, { [key]: key === 'version' ? 99 : 'future-unavailable' });
      expect(() => validateExperimentDefinition(design, definition), key).toThrow();
    }
  });
  it('rejects duplicated or unsorted demand boundaries', () => {
    for (const times of [[5, 5], [5, 4]]) expect(() => createExperimentDefinition(design, { durationS: 20, requiredCapacitySchedule: times.map(timeS => ({ timeS, requiredAccelerators: 40 })) })).toThrow();
  });
});

describe('PH4 actual disturbance footprint fairness', () => {
  it.each([
    ['rack-01/node-01', 8],
    ['rack-01', 32],
    ['rack-03', 8],
  ])('reports actual installed capacity affected by %s, not the whole containing module', (suffix, expectedAffected) => {
    const assetId = `${design.modules[0].id}/${suffix}`;
    const definition = createExperimentDefinition(design, { durationS: 20, disturbances: [{ id: 'footprint-trip', timeS: 0, assetId, kind: 'trip' }] });
    const state = advance(design, initialize(design), 0, definition.disturbances);
    expect(summarize(design, state).availableAccelerators).toBe(72 - expectedAffected);
    const footprint = disturbanceFootprints(design, definition)[0];
    expect(footprint.assetId).toBe(assetId);
    expect(footprint.installedAcceleratorsInScope).toBe(expectedAffected);
    expect(footprint.fractionOfInstalled).toBe(expectedAffected / 72);
  });
  it('follows Generation II transformer power ancestry while preserving the unaffected second platform', () => {
    const campus = buildDesign({ ...DEFAULT_CONFIG, generation: 2, requestedAccelerators: 5128 });
    const definition = createExperimentDefinition(campus, { durationS: 20, disturbances: [{ id: 'transformer-trip', timeS: 0, assetId: 'platform-001/transformer', kind: 'trip' }] });
    const footprint = disturbanceFootprints(campus, definition)[0];
    expect(footprint.affectedModuleIds).toEqual(campus.modules.filter(module => module.platformId === 'platform-001').map(module => module.id));
    expect(footprint.installedAcceleratorsInScope).toBe(5120);
    expect(footprint.fractionOfInstalled).toBe(5120 / 5128);
    expect(footprint.affectedModuleIds).not.toContain(campus.modules.at(-1)!.id);
  });
});
