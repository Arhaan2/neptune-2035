import { describe, expect, it } from 'vitest';
import { solveExchanger } from '../src/twin/solvers/thermal';

// Independent verifier's 2048-cell spatial RK4 shooting oracle, cross-checked at
// 70 decimal digits. Reference and thresholds were frozen before observing repair.
const base = { technicalInletK: 313.15, seawaterInletK: 293.15, technicalFlowM3S: 0.001, cleanUAWPerK: 1000, foulingResistanceKPerW: 0, technicalDensityKgM3: 1000, technicalCpJKgK: 1000, seawaterDensityKgM3: 1000, seawaterCpJKgK: 1000 };
describe('P8-N04 V8-05 independently referenced near-equal counterflow heat', () => {
  it.each([
    { label: 'outside equal-rate approximation branch', seawaterFlowM3S: 0.0010000000110000002, heatW: 10000.0000275000002227, toleranceW: 1e-6, technicalOutletK: 303.1499999724999, seawaterOutletK: 303.14999991749994 },
    { label: 'inside declared equal-rate approximation branch', seawaterFlowM3S: 0.001000000009, heatW: 10000.0000224999998144, toleranceW: 1e-4, technicalOutletK: 303.1499999775, seawaterOutletK: 303.1499999325 },
  ])('$label retains its preregistered numerical and stream-closure bounds', fixture => {
    const output = solveExchanger({ ...base, seawaterFlowM3S: fixture.seawaterFlowM3S });
    expect(Math.abs(output.heatW - fixture.heatW)).toBeLessThanOrEqual(fixture.toleranceW);
    expect(Math.abs(output.technicalOutletK - fixture.technicalOutletK)).toBeLessThanOrEqual(1e-7);
    expect(Math.abs(output.seawaterOutletK - fixture.seawaterOutletK)).toBeLessThanOrEqual(1e-7);
    expect(Math.abs(output.balanceResidualW)).toBeLessThanOrEqual(1e-6);
    const hotStreamW = 1000 * (base.technicalInletK - output.technicalOutletK);
    const coldStreamW = fixture.seawaterFlowM3S * 1e6 * (output.seawaterOutletK - base.seawaterInletK);
    expect(Math.abs(hotStreamW - output.heatW)).toBeLessThanOrEqual(1e-6);
    expect(Math.abs(coldStreamW - output.heatW)).toBeLessThanOrEqual(1e-6);
  });
});
