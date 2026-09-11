import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { conservationResiduals, engineeringReport } from '../src/twin/analysis/reports';
import { advance, initialize } from '../src/twin/engine/simulation';

describe('P8-NUM V8-01 non-cancelling conservation evidence', () => {
  it('opposing component errors remain visible even with exact-zero signed totals and a large neighboring load', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1288 });
    const state = initialize(design);
    expect(state.modules).toHaveLength(2);
    // Reporting fixture only: deliberately inject residual witnesses, never solver input.
    Object.assign(state.modules[0], { electricalResidualW: 3, thermalResidualW: 4, gridW: 0, batteryDischargeW: 0, facilityW: 0 });
    Object.assign(state.modules[1], { electricalResidualW: -3, thermalResidualW: -4, gridW: 1e6, batteryDischargeW: 0, facilityW: 1e6 });
    const before = structuredClone(state);
    const actual = conservationResiduals(design, state);
    expect(actual).toMatchObject({
      electricalResidualW: 0, electricalNormalized: 0, thermalResidualW: 0, thermalNormalized: 0,
      electricalDenominatorW: 1e6, thermalDenominatorW: 1e6,
      electricalSumAbsoluteResidualW: 6, electricalMaxAbsoluteResidualW: 3,
      electricalSumAbsoluteNormalized: 6e-6, electricalMaxAbsoluteNormalized: 3,
      thermalSumAbsoluteResidualW: 8, thermalMaxAbsoluteResidualW: 4,
      thermalSumAbsoluteNormalized: 8e-6, thermalMaxAbsoluteNormalized: 4,
    });
    expect(state).toEqual(before);
    const report = engineeringReport(design, state);
    expect(report).toMatch(/sum[^\n]*absolute[^\n]*6/iu);
    expect(report).toMatch(/max(?:imum)?[^\n]*absolute[^\n]*3/iu);
    expect(report).toContain('physical validation pending');
  });

  it('actual nominal module residuals and all added normalizations remain finite and within frozen accounting bounds', () => {
    const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1288 });
    const state = advance(design, initialize(design), 60);
    const actual = conservationResiduals(design, state);
    expect(Object.values(actual).every(Number.isFinite)).toBe(true);
    for (const name of ['electricalSumAbsoluteResidualW', 'electricalMaxAbsoluteResidualW', 'thermalSumAbsoluteResidualW', 'thermalMaxAbsoluteResidualW']) {
      expect(actual).toHaveProperty(name);
      expect((actual as Record<string, number>)[name]).toBeLessThanOrEqual(1e-5);
    }
    for (const name of ['electricalSumAbsoluteNormalized', 'electricalMaxAbsoluteNormalized', 'thermalSumAbsoluteNormalized', 'thermalMaxAbsoluteNormalized']) {
      expect((actual as Record<string, number>)[name]).toBeLessThanOrEqual(1e-9);
    }
  });
});
