import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, resolveAsset } from '../src/twin/assets/design';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { billOfEquipment } from '../src/twin/analysis/reports';
import { solveHydraulics } from '../src/twin/solvers/hydraulic';
import baseline from './fixtures/phase-2/phase1-baseline-values.json';
import manifest from './fixtures/phase-2/manifest.json';

// Frozen historical captures establish equivalence; the analytic fixture below is independent.
describe('PH2-01 frozen deployed Phase 1 equivalence', () => {
  it('retains the byte identities of the real compatibility and historical numeric fixtures', () => {
    expect(manifest.sourceCommit).toBe('06899f0668a05c6ba7f0a1bc0c96d33304eef580');
    for (const [name, hash] of Object.entries(manifest.files)) {
      const bytes = readFileSync(new URL(`./fixtures/phase-2/${name}`, import.meta.url));
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(hash);
    }
  });
  for (const fixture of baseline.captures) {
    it(`${fixture.requestedAccelerators} accelerators preserve default 0s/10s behavior and declared envelopes`, () => {
      const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: fixture.requestedAccelerators });
      const initial = initialize(design);
      for (const [state, expected] of [[initial, fixture.initial], [advance(design, initial, 10), fixture.stepped]] as const) {
        const actual = summarize(design, state);
        for (const [key, value] of Object.entries(expected)) {
          const result = actual[key as keyof typeof actual];
          if (typeof value === 'number') expect(result, key).toBeCloseTo(value, 6);
          else expect(result, key).toEqual(value);
        }
      }
      expect(billOfEquipment(design).totalUSD).toBeCloseTo(fixture.includedCostUSD, 5);
      for (const equipment of fixture.equipment) {
        const asset = resolveAsset(design, equipment.id)!;
        expect(asset.dimensionsM, equipment.id).toEqual(equipment.dimensionsM);
        expect(asset.operationalMassKg, equipment.id).toBeCloseTo(equipment.operationalMassKg!, 6);
      }
    });
  }
});

describe('PH2-02 independent controlled pump equation', () => {
  it('agrees with an analytical quadratic-system operating point and inverse-efficiency electrical work', () => {
    // Δp_system = 100000*(Q/.05)^2; Δp_pump = 250000*(1-(Q/.1)^2).
    // Solving these two polynomials gives Q² = 250000 / 65000000.
    const expectedQ = Math.sqrt(250000 / 65000000);
    const expectedPressure = 100000 * (expectedQ / 0.05) ** 2;
    const common = { lengthM: 0, diameterM: 0.18, roughnessM: 0, densityKgM3: 997,
      dynamicViscosityPaS: 0.000855, fittingsK: 0, equipmentDropPaAtReference: 100000,
      referenceFlowM3S: 0.05, pumpCount: 1, pumpSpeed: 1, shutoffPa: 250000, freeFlowM3S: 0.1 };
    const a = solveHydraulics({ ...common, efficiency: 0.72 });
    const b = solveHydraulics({ ...common, efficiency: 0.84 });
    for (const [actual, efficiency] of [[a, 0.72], [b, 0.84]] as const) {
      expect(actual.flowM3S).toBeCloseTo(expectedQ, 10);
      expect(actual.pressurePa).toBeCloseTo(expectedPressure, 4);
      expect(actual.electricalW).toBeCloseTo(expectedPressure * expectedQ / efficiency, 5);
    }
    expect(b.flowM3S).toBe(a.flowM3S);
    expect(b.pressurePa).toBe(a.pressurePa);
    expect(b.electricalW / a.electricalW).toBeCloseTo(0.72 / 0.84, 12);
  });
});
