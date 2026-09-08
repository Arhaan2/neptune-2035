import { describe, expect, it } from 'vitest';
import {
  BOUNDS,
  CAPACITY,
  DEFAULT_SCENARIO as S,
  presetScenario,
  simulate,
  validateScenario,
} from '../src/domain/model';
import { makeLayout, EXPLODE } from '../src/scene/layout';
describe('deterministic electrical model', () => {
  it('matches an independently hand-calculated 8-GPU node', () => {
    const r = simulate({ ...S, requestedGpuCount: 8 });
    expect(r.nodeCount).toBe(1);
    expect(r.computePeakKW).toBe(14.3);
    expect(r.itPeakMW).toBeCloseTo(0.015444, 9);
    expect(r.itOperatingMW).toBeCloseTo(0.013442, 9);
    expect(r.facilityPeakMW).toBeCloseTo(0.0177606, 9);
    expect(r.facilityOperatingMW).toBeCloseTo(0.0154583, 9);
    expect(r.annualEnergyMWh).toBeCloseTo(0.0154583 * 8760, 8);
  });
  it('is deterministic and does not mutate input', () => {
    const input = Object.freeze({ ...S });
    expect(simulate(input)).toEqual(simulate(input));
    expect(input).toEqual(S);
  });
  it.each([
    [8, 1, 8],
    [9, 2, 16],
    [31, 4, 32],
    [32, 4, 32],
    [33, 5, 40],
  ])('rounds %i GPUs into whole nodes', (requestedGpuCount, nodes, gpus) => {
    const r = simulate({ ...S, requestedGpuCount });
    expect(r.nodeCount).toBe(nodes);
    expect(r.provisionedGpuCount).toBe(gpus);
    expect(r.roundingGpuCount).toBe(gpus - requestedGpuCount);
  });
  it.each([
    [2560, 80, 1],
    [2561, 81, 2],
    [20480, 640, 8],
    [20481, 641, 9],
  ])(
    'crosses rack and module boundaries at %i',
    (requestedGpuCount, rackCount, moduleCount) => {
      const r = simulate({ ...S, requestedGpuCount });
      expect(r.rackCount).toBe(rackCount);
      expect(r.moduleCount).toBe(moduleCount);
      expect(r.platformCount).toBe(Math.ceil(moduleCount / 8));
    },
  );
  it('preserves idle draw and installed peak at zero utilization', () => {
    const idle = simulate({ ...S, utilization: 0 });
    const full = simulate({ ...S, utilization: 1 });
    expect(idle.facilityOperatingMW).toBeGreaterThan(0);
    expect(idle.facilityOperatingMW).toBeLessThan(full.facilityOperatingMW);
    expect(idle.facilityPeakMW).toBe(full.facilityPeakMW);
    expect(idle.moduleCount).toBe(full.moduleCount);
    expect(full.facilityOperatingMW).toBeCloseTo(full.facilityPeakMW, 10);
  });
  it('uses peak demand for supply warnings even at idle', () => {
    const r = simulate({ ...S, utilization: 0, availableSupplyMW: 100 });
    expect(r.facilityOperatingMW).toBeLessThan(100);
    expect(r.warnings.some((w) => w.code === 'supply')).toBe(true);
  });
  it('increases facility demand with PUE without changing IT capacity or heat boundary', () => {
    const a = simulate({ ...S, assumedPUE: 1 });
    const b = simulate({ ...S, assumedPUE: 2 });
    expect(b.facilityOperatingMW).toBeCloseTo(a.facilityOperatingMW * 2);
    expect(b.itPeakMW).toBe(a.itPeakMW);
    expect(b.heatRejectedOperatingMW).toBe(a.heatRejectedOperatingMW);
  });
  it('rack space and power allocations fit the declared supported envelope', () => {
    expect(CAPACITY.nodeHeightU * CAPACITY.nodesPerRack).toBeLessThanOrEqual(
      CAPACITY.rackHeightU,
    );
    expect(BOUNDS.nodePeakKW[1] * CAPACITY.nodesPerRack).toBeLessThanOrEqual(
      CAPACITY.rackPowerLimitKW,
    );
    expect(CAPACITY.moduleFloorAreaM2 / CAPACITY.racksPerModule).toBe(4);
  });
});
describe('thermal accounting', () => {
  it('conserves heat in watts through seawater density, heat capacity and rise', () => {
    const r = simulate(S);
    const recoveredW =
      r.operatingFlowM3PerS * 1025 * 3990 * S.seawaterTemperatureRiseK;
    expect(recoveredW).toBeCloseTo(r.itOperatingMW * 1e6, 5);
    expect(
      r.peakFlowM3PerS * 1025 * 3990 * S.seawaterTemperatureRiseK,
    ).toBeCloseTo(r.itPeakMW * 1e6, 5);
  });
  it('halves flow when assumed discharge rise doubles', () => {
    expect(
      simulate({ ...S, seawaterTemperatureRiseK: 10 }).operatingFlowM3PerS,
    ).toBeCloseTo(simulate(S).operatingFlowM3PerS / 2);
  });
  it('warmer water reduces headroom without secretly changing PUE or flow', () => {
    const a = simulate(S);
    const b = simulate({ ...S, seawaterInletC: S.seawaterInletC + 3 });
    expect(b.temperatureHeadroomC).toBe(a.temperatureHeadroomC - 3);
    expect(b.facilityOperatingMW).toBe(a.facilityOperatingMW);
    expect(b.operatingFlowM3PerS).toBe(a.operatingFlowM3PerS);
  });
  it.each([27, 28, 38])(
    'warns at zero/negative headroom with %i °C inlet',
    (seawaterInletC) => {
      expect(
        simulate({ ...S, seawaterInletC }).warnings.some(
          (w) => w.code === 'thermal',
        ),
      ).toBe(true);
    },
  );
});
describe('validated domain and extreme scenarios', () => {
  it.each([NaN, Infinity, -Infinity, -1, 0, 7, 1e9, 10.5])(
    'rejects invalid GPU count %s',
    (requestedGpuCount) => {
      expect(() => simulate({ ...S, requestedGpuCount })).toThrow(RangeError);
    },
  );
  it('rejects missing fields, arrays, strings, non-numeric inputs and invalid generations', () => {
    for (const bad of [
      null,
      [],
      {},
      'x',
      { ...S, utilization: '0.5' },
      { ...S, generation: 4 },
      { ...S, assumedPUE: 0.99 },
      { ...S, seawaterTemperatureRiseK: 0 },
    ])
      expect(validateScenario(bad).valid).toBe(false);
  });
  it('every supported bound returns finite nonnegative demands', () => {
    for (const [field, bounds] of Object.entries(BOUNDS))
      for (const value of bounds) {
        const r = simulate({ ...S, [field]: value });
        for (const key of [
          'nodeCount',
          'facilityPeakMW',
          'facilityOperatingMW',
          'annualEnergyMWh',
          'operatingFlowM3PerS',
          'peakFlowM3PerS',
        ] as const) {
          expect(Number.isFinite(r[key])).toBe(true);
          expect(r[key]).toBeGreaterThanOrEqual(0);
        }
        expect(r.facilityOperatingMW).toBeLessThanOrEqual(
          r.facilityPeakMW + 1e-9,
        );
      }
  });
  it('presets give a pilot, campus, and actual gigawatt peak', () => {
    expect(simulate(presetScenario(1)).facilityPeakMW).toBeGreaterThan(10);
    expect(simulate(presetScenario(1)).facilityPeakMW).toBeLessThan(50);
    expect(simulate(presetScenario(2)).facilityPeakMW).toBeGreaterThan(100);
    expect(simulate(presetScenario(3)).facilityPeakMW).toBeGreaterThan(1000);
  });
  it.each([8, 2561, 100000, 500000, 1000000])(
    'layout conserves actual platform and module counts at %i GPUs',
    (requestedGpuCount) => {
      const m = simulate({ ...S, requestedGpuCount });
      const l = makeLayout(m, S.generation);
      expect(l.reduce((a, b) => a + b.modules, 0)).toBe(m.moduleCount);
      expect(l.reduce((a, b) => a + b.representedPlatforms, 0)).toBe(
        m.platformCount,
      );
      expect(l.length).toBeLessThanOrEqual(25);
      expect(l).toEqual(makeLayout(m, S.generation));
      expect(new Set(l.map((p) => p.id)).size).toBe(l.length);
    },
  );
  it('generation changes canonical arrangement and exploded offsets do not mutate it', () => {
    const m = simulate(S);
    const before = makeLayout(m, 2);
    expect(makeLayout(m, 3)).not.toEqual(before);
    for (let i = 0; i < 20; i++)
      for (const delta of Object.values(EXPLODE))
        expect(delta.every(Number.isFinite)).toBe(true);
    expect(makeLayout(m, 2)).toEqual(before);
  });
});
