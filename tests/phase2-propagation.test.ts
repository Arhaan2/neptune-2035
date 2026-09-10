import { describe, expect, it } from 'vitest';
import { allAssets, buildDesign, DEFAULT_CONFIG, replaceEquipment, resolveAsset, withDefaultSpecification } from '../src/twin/assets/design';
import { economicIdentity, engineeringIdentity, installedEquipmentIdentity, resolveSpecification, updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { billOfEquipment, constraints, engineeringReport, inventoryCSV } from '../src/twin/analysis/reports';
import { footprintBounds, presentedPosition } from '../src/scene/twinGeometry';
import { projectFile } from '../src/twin/persistence/project';
import type { Design, SimulationState, WorkerResponse } from '../src/twin/types';

const moduleId = 'platform-001/module-01';
const duty = `${moduleId}/pump-duty`, standby = `${moduleId}/pump-standby`, battery = `${moduleId}/battery`;
const small = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const physicalState = (state: SimulationState) => ({ ...state, solverMs: 0 });
async function worker(design: Design, state?: SimulationState, durationS = 0) {
  const responses: WorkerResponse[] = [];
  const handler = createWorkerHandler(response => responses.push(response), async () => {}, () => 0);
  await handler({ version: 2, requestId: 1, epoch: 1, kind: state ? 'advance' : 'initialize', design, state, durationS, events: [] });
  expect(responses.at(-1)?.status, JSON.stringify(responses.at(-1)?.diagnostic)).toBe('complete');
  return responses.at(-1)!.state!;
}

describe('PH2-02 installed pump efficiency reaches the actual engine and worker', () => {
  it('changes electrical work while unconstrained flow, pressure, geometry and mass remain the same', async () => {
    const original = small(), replaced = replaceEquipment(original, duty, 'pump-efficient');
    const a = initialize(original).modules[0], b = (await worker(replaced)).modules[0];
    expect(a.energizedNodes).toBe(1); expect(b.energizedNodes).toBe(1);
    expect(b.technicalFlowM3S).toBe(a.technicalFlowM3S);
    expect(b.pressurePa).toBe(a.pressurePa);
    expect(b.seawaterFlowM3S).toBe(a.seawaterFlowM3S);
    const oldTechnicalW = a.pressurePa * a.technicalFlowM3S / 0.72;
    expect(b.pumpPowerW).toBeCloseTo(a.pumpPowerW - oldTechnicalW + oldTechnicalW * 0.72 / 0.84, 6);
    expect(b.gridW).toBeLessThan(a.gridW);
    const oldAsset = resolveAsset(original, duty)!, nextAsset = resolveAsset(replaced, duty)!;
    expect(nextAsset.dimensionsM).toEqual([1.2, 1.2, 0.8]);
    expect(nextAsset.dimensionsM).toEqual(oldAsset.dimensionsM);
    expect(nextAsset.operationalMassKg).toBe(180);
    expect(nextAsset.positionM).toEqual(oldAsset.positionM);
    expect(nextAsset.id).toBe(oldAsset.id);
    expect(installedEquipmentIdentity(replaced, duty)).not.toBe(installedEquipmentIdentity(original, duty));
  });

  it('uses the installed standby specification after real duty failure and startup, without reusing duty cached efficiency', () => {
    const original = small(), replaced = replaceEquipment(original, standby, 'pump-efficient');
    const events = [{ id: 'duty-fails', timeS: 0, assetId: duty, kind: 'trip' as const }];
    const a = advance(original, initialize(original), 9, events).modules[0];
    const b = advance(replaced, initialize(replaced), 9, events).modules[0];
    expect(a.states[standby]).toBe('running'); expect(b.states[standby]).toBe('running');
    expect(b.technicalFlowM3S).toBe(a.technicalFlowM3S);
    expect(b.pressurePa).toBe(a.pressurePa);
    const oldTechnicalW = a.pressurePa * a.technicalFlowM3S / 0.72;
    expect(b.pumpPowerW).toBeCloseTo(a.pumpPowerW - oldTechnicalW + oldTechnicalW * 0.72 / 0.84, 6);
  });
});

describe('PH2-03 physical replacement propagation', () => {
  it('agrees across installed record, actual solver, scene envelope, inventory and report', () => {
    const original = small(), replaced = replaceEquipment(original, duty, 'pump-physical');
    const asset = resolveAsset(replaced, duty)!, specification = resolveSpecification(replaced, duty);
    expect(specification).toMatchObject({ id: 'pump-physical', version: '1.0.0', dimensionsM: [1.35, 1.3, 0.9], operationalMassKg: 240 });
    expect(asset.ratings).toMatchObject({ shutoffPa: 280000, freeFlowM3S: 0.11, efficiency: 0.8, capacityW: 55000 });
    expect(asset.dimensionsM).toEqual([1.35, 1.3, 0.9]); expect(asset.operationalMassKg).toBe(240);
    const bounds = footprintBounds([asset]);
    expect(bounds.maxX - bounds.minX).toBeCloseTo(1.35, 12);
    expect(bounds.maxZ - bounds.minZ).toBeCloseTo(0.9, 12);
    expect(presentedPosition(asset, true)).toEqual([asset.positionM[0], asset.positionM[1] + 3, asset.positionM[2] + 5]);
    const state = initialize(replaced), a = initialize(original).modules[0], b = state.modules[0];
    expect(b.technicalFlowM3S).toBeGreaterThan(a.technicalFlowM3S);
    const expectedCurvePressure = 280000 * (1 - (b.technicalFlowM3S / 0.11) ** 2);
    expect(b.pressurePa).toBeCloseTo(expectedCurvePressure, 4);
    const row = inventoryCSV(replaced).split('\n').find(line => line.startsWith(`"${duty}"`))!;
    for (const value of ['pump-physical', '1.35', '1.3', '0.9', '240']) expect(row).toContain(`"${value}"`);
    const report = engineeringReport(replaced, state);
    expect(report).toContain('pump-physical'); expect(report).toContain('1.0.0');
    expect(report).toContain('280000'); expect(report).toContain('240');
    expect(billOfEquipment(replaced).totalUSD - billOfEquipment(original).totalUSD).toBeCloseTo(7000 * 1.2 * 1.25, 6);
  });
});

describe('PH2-04 compute and conversion actual electrical linkage', () => {
  it('uses an installed 10 kW server in main-thread and actual worker electrical calculations', async () => {
    const design = withDefaultSpecification(small(), 'compute', 'compute-efficient');
    const main = initialize(design), threaded = await worker(design);
    expect(design.installedPeakITW).toBe(10000);
    expect(main.modules[0].itW).toBeCloseTo(10000 * (0.3 + 0.7 * 0.8), 8);
    expect(threaded.modules[0].itW).toBeCloseTo(8600, 8);
    expect(physicalState(threaded)).toEqual(physicalState(main));
    expect(resolveAsset(design, `${moduleId}/rack-01/node-01`)!.ratings.capacityW).toBe(10000);
    expect(engineeringReport(design, main)).toContain('10000');
  });
  it('uses installed conversion efficiency and its declared rating in actual grid demand', async () => {
    const design = withDefaultSpecification(small(), 'distribution', 'distribution-efficient');
    const state = await worker(design), m = state.modules[0];
    expect(resolveAsset(design, `${moduleId}/distribution`)!.ratings).toMatchObject({ efficiency: 0.99, capacityW: 2000000 });
    expect(m.itW).toBeCloseTo(10320, 8);
    expect(m.gridW).toBeCloseTo((10320 + m.pumpPowerW + 3000 + 15000) / (0.98 * 0.99), 6);
    expect(m.batteryDischargeW).toBe(0);
  });
});

describe('PH2-05 battery declared consistency', () => {
  it('uses the alternative fixed dimensions, mass, capacity, power ratings, losses and economic assumption', () => {
    const original = small(), design = replaceEquipment(original, battery, 'battery-extended');
    const asset = resolveAsset(design, battery)!;
    expect(asset.dimensionsM).toEqual([2.4, 2.1, 1.5]); expect(asset.operationalMassKg).toBe(4600);
    expect(asset.operationalMassKg).not.toBe(600000 / 130 + 300);
    expect(asset.ratings).toMatchObject({ energyWh: 600000, storageMaxW: 1800000, capacityW: 2200000, chargeEfficiency: 0.94, dischargeEfficiency: 0.94 });
    const initial = initialize(design); expect(initial.modules[0].batteryWh).toBe(600000);
    const state = advance(design, initial, 1, [{ id: 'grid-loss', timeS: 0, assetId: 'shore/grid', kind: 'trip' }]);
    const m = state.modules[0];
    expect(m.gridW).toBe(0);
    const busW = 10320 + m.pumpPowerW + 3000 + 15000;
    expect(m.batteryDischargeW).toBeCloseTo(busW, 6);
    expect(m.batteryWh).toBeCloseTo(600000 - busW / 0.94 / 3600, 6);
    expect(billOfEquipment(design).totalUSD - billOfEquipment(original).totalUSD).toBeCloseTo(100000 * 1.2 * 1.25, 6);
    const row = inventoryCSV(design).split('\n').find(line => line.startsWith(`"${battery}"`))!;
    expect(row).toContain('"4600"'); expect(row).toContain('"2.4"');
    expect(engineeringReport(design, state)).toContain('battery-extended');
  });
});

describe('PH2-06 economic edits preserve every dynamic state field', () => {
  it('changes financial output only and preserves checkpoint plus actual worker continuation', async () => {
    const design = small();
    const state = advance(design, initialize(design), 4, [
      { id: 'loss', timeS: 1, assetId: 'shore/grid', kind: 'trip' },
      { id: 'duty-loss', timeS: 2, assetId: duty, kind: 'trip' },
      { id: 'future', timeS: 10, assetId: 'shore/grid', kind: 'restore' },
    ]);
    const before = structuredClone(state);
    const priced = updateEconomicAssumptions(design, { unitCostScale: 1.25 });
    expect(engineeringIdentity(priced)).toBe(engineeringIdentity(design));
    expect(priced.revision).toBe(design.revision); expect(economicIdentity(priced)).not.toBe(economicIdentity(design));
    expect(billOfEquipment(priced).totalUSD).toBeCloseTo(billOfEquipment(design).totalUSD * 1.25, 5);
    expect(state).toEqual(before);
    expect(projectFile(priced, state).checkpoint!.state).toEqual(projectFile(design, state).checkpoint!.state);
    expect(physicalState(await worker(priced, state, 8))).toEqual(physicalState(advance(design, before, 8)));
  });
});

describe('PH2-11 valid inadequate designs remain runnable', () => {
  it('reports an installed electrical shortfall without inventing capacity or rejecting the run', async () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1280, supplyW: 0, batteryWhPerModule: 0, batteryMaxWPerModule: 0 });
    const state = await worker(design);
    expect(state.modules[0].energizedNodes).toBe(0);
    expect(state.modules[0].gridW).toBe(0);
    expect(constraints(design, state).find(c => c.id === 'EL-01')?.status).toBe('violated');
    expect(Array.from(allAssets(design)).filter(a => a.type === 'compute')).toHaveLength(160);
  });
});
