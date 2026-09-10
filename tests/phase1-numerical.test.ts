import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, routeLengthM } from '../src/twin/assets/design';
import { billOfEquipment, sizingAssessment } from '../src/twin/analysis/reports';
import { advance, initialize } from '../src/twin/engine/simulation';
import { CONTRACT } from '../src/twin/persistence/limits';
import { SimulationError, type FailureDiagnostic } from '../src/twin/safety';
import { allocateGrid, nodeDrawW, solveElectrical, type ElectricalInput } from '../src/twin/solvers/electrical';
import { darcyFrictionFactor, solveHydraulics, systemPressurePa, type HydraulicInput } from '../src/twin/solvers/hydraulic';
import { assessNetwork, createNetworkEvaluator } from '../src/twin/solvers/network';
import { advanceThermal, solveExchanger, type ExchangerInput, type ThermalInput } from '../src/twin/solvers/thermal';

const hydraulic: HydraulicInput = { lengthM: 50.4, diameterM: 0.18, roughnessM: 0.000045, densityKgM3: 997, dynamicViscosityPaS: 0.000855, fittingsK: 12, equipmentDropPaAtReference: 80000, referenceFlowM3S: 0.05, pumpCount: 1, pumpSpeed: 1 };
const electrical: ElectricalInput = { desiredNodes: 160, workload: 1, idleFraction: 0.3, networkAvailable: true, criticalLoadW: 50000, gridAvailableW: 3e6, batteryWh: 10000, batteryCapacityWh: 10000, batteryMaxW: 2.2e6, batteryAvailable: true, isolated: false, dtS: 1 };
const exchanger: ExchangerInput = { technicalInletK: 313.15, seawaterInletK: 293.15, technicalFlowM3S: 0.05, seawaterFlowM3S: 0.05, cleanUAWPerK: 350000, foulingResistanceKPerW: 0 };
const thermal: ThermalInput = { coolantK: 303.15, airK: 298.15, itW: 1e6, facilityW: 1.1e6, technicalPumpW: 0, seawaterPumpW: 0, technicalFlowM3S: 0.05, seawaterFlowM3S: 0.05, seawaterK: 291.15, exchangerUAWPerK: 350000, foulingResistanceKPerW: 0, fanPowered: true, dtS: 1 };
function diagnostic(run: () => unknown, kind: FailureDiagnostic['kind'], code?: string) {
  let caught: unknown;
  try { run(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(SimulationError);
  const result = (caught as SimulationError).diagnostic;
  expect(result.kind).toBe(kind);
  if (code) expect(result.code).toBe(code);
  expect(JSON.parse(JSON.stringify(result))).toMatchObject({ kind, code: result.code, message: result.message });
  return result;
}
function finiteTree(value: unknown): void {
  if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
  else if (value && typeof value === 'object') Object.values(value).forEach(finiteTree);
}
const invalidValues: unknown[] = [undefined, null, NaN, Infinity, -Infinity, '1', true, {}, []];

describe('PH1-NUM-01 / PH1-NUM-02: pump boundary rejects explicit malformed ratings', () => {
  it('retains omitted defaults exactly, including an absent own property', () => {
    expect(solveHydraulics(hydraulic)).toEqual(solveHydraulics({ ...hydraulic, shutoffPa: 250000, freeFlowM3S: 0.1, efficiency: 0.72 }));
    expect(solveHydraulics(Object.assign(Object.create({ shutoffPa: Infinity }), hydraulic))).toEqual(solveHydraulics(hydraulic));
  });
  for (const field of ['shutoffPa', 'freeFlowM3S', 'efficiency'] as const) {
    it(`rejects each explicit invalid ${field}, even with a disabled circuit`, () => {
      for (const value of [...invalidValues, 0, -1]) {
        const input = { ...hydraulic, [field]: value } as HydraulicInput;
        expect(diagnostic(() => solveHydraulics(input), 'invalid-input', 'INVALID_NUMBER').field).toBe(field);
        diagnostic(() => solveHydraulics({ ...input, pumpCount: 0 }), 'invalid-input', 'INVALID_NUMBER');
        diagnostic(() => systemPressurePa(input, 0), 'invalid-input', 'INVALID_NUMBER');
      }
    });
  }
  it('accepts finite positive ratings and inclusive unit efficiency but rejects efficiency above one', () => {
    finiteTree(solveHydraulics({ ...hydraulic, shutoffPa: 100000, freeFlowM3S: 0.05, efficiency: 1 }));
    diagnostic(() => solveHydraulics({ ...hydraulic, efficiency: 1.0000000001 }), 'invalid-input');
  });
  it('keeps nonfinite diagnostics safely serializable with exact affected field and SI unit', () => {
    const error = diagnostic(() => solveHydraulics({ ...hydraulic, shutoffPa: Infinity }), 'invalid-input', 'INVALID_NUMBER');
    expect(JSON.parse(JSON.stringify(error))).toMatchObject({ field: 'shutoffPa', unit: 'Pa', details: { received: 'Infinity' } });
  });
  it('validates every required hydraulic scalar and standalone flow before calculating a zero', () => {
    for (const field of Object.keys(hydraulic) as (keyof HydraulicInput)[]) {
      for (const value of invalidValues) diagnostic(() => solveHydraulics({ ...hydraulic, [field]: value } as HydraulicInput), 'invalid-input');
    }
    for (const flow of [...invalidValues, -1]) diagnostic(() => systemPressurePa(hydraulic, flow as number), 'invalid-input');
    diagnostic(() => systemPressurePa({ ...hydraulic, diameterM: 0 }, 0), 'invalid-input');
    diagnostic(() => darcyFrictionFactor(-1, 0), 'invalid-input');
    diagnostic(() => darcyFrictionFactor(1000, Infinity), 'invalid-input');
  });
  it('separates unsupported topology/affinity range from valid stopped pumps and small capacity', () => {
    diagnostic(() => solveHydraulics({ ...hydraulic, pumpCount: 3 }), 'unsupported-configuration', 'HYDRAULIC_TOPOLOGY');
    diagnostic(() => solveHydraulics({ ...hydraulic, pumpSpeed: 1.21 }), 'unsupported-configuration', 'HYDRAULIC_AFFINITY_RANGE');
    expect(solveHydraulics({ ...hydraulic, pumpCount: 0 }).flowM3S).toBe(0);
    expect(solveHydraulics({ ...hydraulic, pumpSpeed: 0 }).flowM3S).toBe(0);
    const small = solveHydraulics({ ...hydraulic, shutoffPa: 100, freeFlowM3S: 0.0001 });
    finiteTree(small);
    expect(small.flowM3S).toBeLessThan(0.0001);
  });
});

describe('PH1-NUM-03: actual numerical guard failures do not masquerade as success', () => {
  it('reports overflow, underflow and Darcy singular arithmetic as numerical failures', () => {
    diagnostic(() => solveHydraulics({ ...hydraulic, shutoffPa: Number.MAX_VALUE, pumpSpeed: 1.2 }), 'numerical-failure', 'NONFINITE_OUTPUT');
    diagnostic(() => solveHydraulics({ ...hydraulic, freeFlowM3S: Number.MAX_VALUE, pumpCount: 2 }), 'numerical-failure');
    diagnostic(() => solveHydraulics({ ...hydraulic, pumpSpeed: Number.MIN_VALUE }), 'numerical-failure', 'HYDRAULIC_UNDERFLOW');
    diagnostic(() => systemPressurePa(hydraulic, Number.MAX_VALUE), 'numerical-failure');
    diagnostic(() => darcyFrictionFactor(Number.MIN_VALUE, 0), 'numerical-failure');
  });
  it('uses a real finite poorly resolved bracket to exercise bounded nonconvergence', () => {
    const error = diagnostic(() => solveHydraulics({ ...hydraulic, diameterM: 1e8, freeFlowM3S: 1e8, lengthM: 0, fittingsK: 0, equipmentDropPaAtReference: 0 }), 'numerical-failure', 'HYDRAULIC_NONCONVERGENCE');
    expect(error.details!.iterations).toBeLessThanOrEqual(60);
    expect(error.details!.flowBracketM3S).toBeGreaterThan(error.details!.flowToleranceM3S as number);
    finiteTree(error.details);
  });
  it('rejects overflow before battery power limits or allocation scaling can hide it', () => {
    diagnostic(() => solveElectrical({ ...electrical, batteryWh: 1e308, batteryCapacityWh: 1e308 }), 'numerical-failure');
    const requests = [{ domainId: 'bus', requestedW: 1e308, moduleLimitW: 1e308 }, { domainId: 'bus', requestedW: 1e308, moduleLimitW: 1e308 }];
    diagnostic(() => allocateGrid(requests, 100, new Map([['bus', 100]])), 'numerical-failure');
  });
  it('rejects finite exchanger and bulk-thermal combinations that overflow', () => {
    diagnostic(() => solveExchanger({ ...exchanger, technicalFlowM3S: 1e308 }), 'numerical-failure');
    diagnostic(() => advanceThermal({ ...thermal, itW: 1e308, technicalPumpW: 1e308, facilityW: Number.MAX_VALUE }), 'numerical-failure');
  });
  it('never mutates standalone input objects when solving or rejecting', () => {
    const before = structuredClone(thermal);
    finiteTree(advanceThermal(Object.freeze(thermal)));
    diagnostic(() => advanceThermal(Object.freeze({ ...thermal, airK: NaN })), 'invalid-input');
    expect(thermal).toEqual(before);
  });
});

describe('PH1-NUM-02: electrical, thermal and network standalone input audit', () => {
  it('rejects missing, nonfinite, mistyped and out-of-range electrical fields', () => {
    for (const field of Object.keys(electrical) as (keyof ElectricalInput)[]) {
      for (const value of invalidValues) {
        if (typeof electrical[field] === 'boolean' && typeof value === 'boolean') continue;
        diagnostic(() => solveElectrical({ ...electrical, [field]: value } as ElectricalInput), 'invalid-input');
      }
    }
    diagnostic(() => solveElectrical({ ...electrical, batteryWh: electrical.batteryCapacityWh + 1 }), 'invalid-input', 'BATTERY_CAPACITY');
    diagnostic(() => solveElectrical({ ...electrical, desiredNodes: 161 }), 'unsupported-configuration');
    diagnostic(() => solveElectrical({ ...electrical, dtS: 1.01 }), 'invalid-input');
    diagnostic(() => nodeDrawW(NaN, 0.3), 'invalid-input');
    diagnostic(() => nodeDrawW(1, 0.3, 'false' as unknown as boolean), 'invalid-input');
  });
  it('validates each grid allocation branch and preserves real zero supply/capacity', () => {
    const request = { domainId: 'bus', requestedW: 100, moduleLimitW: 100 };
    diagnostic(() => allocateGrid([{ ...request, requestedW: -1 }], 100, new Map([['bus', 100]])), 'invalid-input');
    diagnostic(() => allocateGrid([{ ...request, moduleLimitW: NaN }], 100, new Map([['bus', 100]])), 'invalid-input');
    diagnostic(() => allocateGrid([request], 100, new Map([['bus', Infinity]])), 'invalid-input');
    diagnostic(() => allocateGrid([request], 100, new Map()), 'invalid-input', 'GRID_DOMAIN_MISSING');
    expect(allocateGrid([request], 0, new Map([['bus', 100]]))).toEqual([0]);
    expect(allocateGrid([request], 100, new Map([['bus', 0]]))).toEqual([0]);
    expect(allocateGrid([request, request], 150, new Map([['bus', 120]]))).toEqual([60, 60]);
    expect(nodeDrawW(0, 0.3)).toBe(3600);
    expect(solveElectrical({ ...electrical, isolated: true })).toMatchObject({ energizedNodes: 0, gridW: 0, facilityW: 0 });
  });
  it('checks all required exchanger/bulk-thermal scalars and supplied optional properties', () => {
    for (const field of Object.keys(exchanger) as (keyof ExchangerInput)[]) {
      for (const value of invalidValues) diagnostic(() => solveExchanger({ ...exchanger, [field]: value } as ExchangerInput), 'invalid-input');
    }
    for (const field of ['technicalDensityKgM3', 'technicalCpJKgK', 'seawaterDensityKgM3', 'seawaterCpJKgK'] as const) {
      for (const value of [...invalidValues, 0, -1]) diagnostic(() => solveExchanger({ ...exchanger, [field]: value } as ExchangerInput), 'invalid-input');
    }
    for (const field of Object.keys(thermal) as (keyof ThermalInput)[]) {
      for (const value of invalidValues) {
        if (field === 'fanPowered' && typeof value === 'boolean') continue;
        diagnostic(() => advanceThermal({ ...thermal, [field]: value } as ThermalInput), 'invalid-input');
      }
    }
    diagnostic(() => solveExchanger({ ...exchanger, technicalInletK: 400 }), 'unsupported-configuration');
    diagnostic(() => advanceThermal({ ...thermal, facilityW: 1 }), 'invalid-input', 'THERMAL_ENERGY_BOUNDARY');
  });
  it('retains equal-temperature, zero-flow, zero-UA and signed heat transfer', () => {
    expect(solveExchanger({ ...exchanger, technicalInletK: exchanger.seawaterInletK }).heatW).toBe(0);
    expect(solveExchanger({ ...exchanger, technicalFlowM3S: 0 }).heatW).toBe(0);
    expect(solveExchanger({ ...exchanger, cleanUAWPerK: 0 }).heatW).toBe(0);
    expect(solveExchanger({ ...exchanger, technicalInletK: 293.15, seawaterInletK: 313.15 }).heatW).toBeLessThan(0);
    const reverse = advanceThermal({ ...thermal, coolantK: 293.15, seawaterK: 303.15, airK: 293.15, itW: 0, facilityW: 0 });
    expect(reverse.rejectedHeatW).toBeLessThan(0);
    expect(reverse.ambientHeatW).toBeLessThan(0);
    finiteTree(reverse);
  });
  it('reports zero/very small network capacity as violated with an explicit unavailable ratio', () => {
    const base = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
    for (const capacity of [0, Number.MIN_VALUE]) {
      const design = { ...base, assets: base.assets.map(asset => asset.id !== 'shore/cluster-core' ? asset : { ...asset, ports: asset.ports.map(port => port.id === 'cluster-out' ? { ...port, capacity } : port) }) };
      const result = assessNetwork(design, design.modules.map(m => ({ id: m.id, energizedNodes: m.nodeCount })));
      expect(result.status).toBe('violated');
      expect(result.maxUtilization).toBeNull();
      expect(result.bottlenecks).toContainEqual(expect.objectContaining({ capacityBitS: capacity }));
      finiteTree(result);
      expect(JSON.parse(JSON.stringify(result))).toEqual(result);
      const subBitDemand = assessNetwork(design, design.modules.map(m => ({ id: m.id, energizedNodes: m.nodeCount })), [], { clusterBitSPerNode: 0.1, externalBitSPerNode: 0 });
      expect(subBitDemand.status).toBe('violated');
      expect(subBitDemand.maxUtilization).toBeNull();
    }
  });
  it('rejects malformed capacity even on a disabled path or before zero-demand early return', () => {
    const base = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
    const index = base.connections.findIndex(c => c.medium === 'cluster');
    for (const value of invalidValues) {
      const design = { ...base, connections: base.connections.map((c, i) => i === index ? { ...c, enabled: false, capacity: value as number } : c) };
      diagnostic(() => assessNetwork(design, design.modules.map(m => ({ id: m.id, energizedNodes: 0 }))), 'invalid-input');
    }
    diagnostic(() => createNetworkEvaluator(base, { clusterBitSPerNode: Infinity, externalBitSPerNode: 0 }), 'invalid-input');
    diagnostic(() => assessNetwork(base, [{ id: base.modules[0].id, energizedNodes: NaN }]), 'invalid-input');
    diagnostic(() => createNetworkEvaluator({ ...base, modules: [{ ...base.modules[0], rackCount: Infinity }] }), 'invalid-input');
    const link = base.connections[index];
    const multipath = { ...base, connections: [...base.connections, { ...link, id: 'extra-path' }] };
    expect(assessNetwork(multipath, multipath.modules.map(m => ({ id: m.id, energizedNodes: m.nodeCount }))).status).toBe('unsupported');
  });
});

describe('PH1-NUM-02/03 geometry, allocation and report boundaries', () => {
  it('rejects sparse allocation and bounds actual allocation work at shared limits', () => {
    expect(() => allocateGrid(Array(1), 10, new Map())).toThrow();
    const request = { domainId: 'bus', requestedW: 1, moduleLimitW: 1 };
    for (const count of [CONTRACT.maxModules - 1, CONTRACT.maxModules]) expect(allocateGrid(Array(count).fill(request), 10, new Map([['bus', 10]]))).toHaveLength(count);
    expect(() => allocateGrid(Array(CONTRACT.maxModules + 1).fill(request), 10, new Map([['bus', 10]]))).toThrow(/limits/);
  });
  it('preserves zero and signed routes but rejects invalid coordinates and actual finite overflow', () => {
    expect(routeLengthM([])).toBe(0); expect(routeLengthM([[-1, 0, 0], [1, 0, 0]])).toBe(2);
    for (const count of [63, 64]) expect(routeLengthM(Array.from({ length: count }, () => [0, 0, 0]))).toBe(0);
    expect(() => routeLengthM(Array.from({ length: 65 }, () => [0, 0, 0]))).toThrow();
    expect(() => routeLengthM([[NaN, 0, 0]])).toThrow(/finite/);
    expect(() => routeLengthM([[-Number.MAX_VALUE, 0, 0], [Number.MAX_VALUE, 0, 0]])).toThrow(/nonfinite/);
  });
  it('actual engine numerical failure leaves its input intact and report overflow cannot masquerade as a number', () => {
    const d = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
    // Finite, structurally valid vertical geometry overflows the derived sea-loop length.
    d.modules[0].positionM[1] = Number.MAX_VALUE;
    expect(() => initialize(d)).toThrow(/nonfinite/);
    const valid = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 }), before = initialize(valid), original = structuredClone(before);
    const longLoop = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, pumpSpeed: 0 }); longLoop.modules[0].positionM[1] = 1e300;
    const disabled = initialize(longLoop), saved = structuredClone(disabled);
    try { advance(longLoop, disabled, 1, [{ id: 'start', kind: 'pump-speed', timeS: 0, assetId: 'shore/grid', value: 1 }]); throw Error('Expected solver failure'); }
    catch (error) { expect(error).toBeInstanceOf(SimulationError); expect((error as SimulationError).diagnostic.kind).toBe('numerical-failure'); }
    expect(disabled).toEqual(saved);
    // A corrupt physical candidate is rejected at the numerical boundary rather than silently serialized.
    expect(() => billOfEquipment(valid, Number.MAX_VALUE)).toThrow(/nonfinite/);
    expect(() => sizingAssessment(valid, before, NaN)).toThrow(/finite/);
    expect(() => advance(valid, before, 1, [{ id: 'overflow', kind: 'workload', timeS: 0, assetId: 'shore/grid', value: Infinity }])).toThrow();
    expect(before).toEqual(original);
  });
});
