import { describe, expect, it } from 'vitest';
import { accumulateInterval, createMetrics, observeBoundary, recoveryReport } from '../src/twin/experiment/metrics';
import { EXPERIMENT_LIMITS, type MetricInterval, type MetricSample, type RecoveryCriteria } from '../src/twin/experiment/types';
import oracle from './fixtures/phase-4/arithmetic-oracle.json';

const criteria: RecoveryCriteria = { dwellS: 5, capacityToleranceAccelerators: 0, coolantLimitK: 318.15, airLimitK: 313.15, temperatureToleranceK: 0, thermalComparator: 'strictly-below', scope: 'all-modules-and-required-service' };
function sample(timeS: number, serviceableAccelerators = 100, patch: Partial<MetricSample> = {}): MetricSample {
  return { timeS, requiredAccelerators: 100, serviceableAccelerators, energizedAccelerators: 100,
    temperatures: [{ assetId: 'synthetic-module-a', domain: 'coolant', kelvin: 300 }, { assetId: 'synthetic-module-a', domain: 'air', kelvin: 300 }], batteryWh: 1000, ...patch };
}
function interval(startS: number, endS: number, serviceableAccelerators = 100, patch: Partial<MetricInterval> = {}): MetricInterval {
  return { startS, endS, sample: sample(startS, serviceableAccelerators), batteryDischargeWh: 0, batteryChargeWh: 0, batteryLossWh: 0, ...patch };
}
function oracleMetrics() {
  const metrics = createMetrics(criteria);
  observeBoundary(metrics, sample(0), criteria);
  for (const row of oracle.intervals) {
    observeBoundary(metrics, sample(row.startS, row.serviceable), criteria);
    accumulateInterval(metrics, interval(row.startS, row.endS, row.serviceable), criteria);
  }
  observeBoundary(metrics, sample(20), criteria);
  return metrics;
}

describe('PH4 independent synthetic arithmetic and whole-window meaning', () => {
  it('integrates exactly 400 accelerator-seconds and confirms five seconds of sustained recovery at20', () => {
    const metrics = oracleMetrics();
    expect(metrics).toMatchObject({ elapsedS: 20, shortfallAcceleratorS: 400, serviceViolationS: 10, thermalViolationS: 0, anyViolationS: 10, firstServiceViolationS: 5, firstViolationS: 5, interruptionCount: 1, longestInterruptionS: 10 });
    expect(metrics.minServiceable).toMatchObject({ value: 40, timeS: 5 });
    expect(recoveryReport(metrics, 'completed')).toMatchObject({ status: 'recovered', referenceTimeS: 5, onsetTimeS: 15, confirmationTimeS: 20, onsetElapsedS: 10, confirmationElapsedS: 15 });
  });
  it('keeps zero-duration healthy boundaries at zero energy, time, and interruption', () => {
    const metrics = createMetrics(criteria);
    observeBoundary(metrics, sample(0), criteria);
    observeBoundary(metrics, sample(0), criteria);
    expect(metrics).toMatchObject({ elapsedS: 0, shortfallAcceleratorS: 0, serviceViolationS: 0, anyViolationS: 0, batteryDischargeWh: 0, batteryChargeWh: 0, interruptionCount: 0 });
    expect(recoveryReport(metrics, 'completed').status).toBe('no-qualifying-interruption');
  });
  it('uses explicit changing required capacity and never treats installed capacity as required demand', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 5, 40, { sample: sample(0, 40, { requiredAccelerators: 20 }) }), criteria);
    accumulateInterval(metrics, interval(5, 10, 40, { sample: sample(5, 40, { requiredAccelerators: 100 }) }), criteria);
    expect(metrics.shortfallAcceleratorS).toBe(300);
    expect(metrics.serviceViolationS).toBe(5);
    expect(metrics.firstServiceViolationS).toBe(5);
  });
  it('unions simultaneous thermal and service violations across affected modules', () => {
    const metrics = createMetrics(criteria);
    const hot = (timeS: number, serviceable = 100) => sample(timeS, serviceable, { temperatures: [
      { assetId: 'module-a', domain: 'coolant', kelvin: 320 }, { assetId: 'module-b', domain: 'coolant', kelvin: 321 },
      { assetId: 'module-a', domain: 'air', kelvin: 315 }, { assetId: 'module-b', domain: 'air', kelvin: 316 },
    ] });
    accumulateInterval(metrics, interval(0, 5, 40, { sample: hot(0, 40) }), criteria);
    accumulateInterval(metrics, interval(5, 10, 100, { sample: hot(5) }), criteria);
    expect(metrics.serviceViolationS).toBe(5);
    expect(metrics.thermalViolationS).toBe(10);
    expect(metrics.anyViolationS).toBe(10);
    expect(metrics.shortfallAcceleratorS).toBe(300);
  });
  it('preserves sampled thermal extrema with asset identity and first occurrence time', () => {
    const metrics = createMetrics(criteria);
    observeBoundary(metrics, sample(0), criteria);
    accumulateInterval(metrics, interval(0, 2), criteria);
    observeBoundary(metrics, sample(2, 100, { temperatures: [{ assetId: 'module-z', domain: 'coolant', kelvin: 340 }, { assetId: 'module-q', domain: 'air', kelvin: 330 }] }), criteria);
    accumulateInterval(metrics, interval(2, 4, 100, { sample: sample(2, 100, { temperatures: [{ assetId: 'module-z', domain: 'coolant', kelvin: 340 }, { assetId: 'module-q', domain: 'air', kelvin: 330 }] }) }), criteria);
    observeBoundary(metrics, sample(4, 100, { temperatures: [{ assetId: 'module-other', domain: 'coolant', kelvin: 340 }, { assetId: 'module-other', domain: 'air', kelvin: 329 }] }), criteria);
    expect(metrics.maxCoolant).toEqual({ value: 340, timeS: 2, assetId: 'module-z', domain: 'coolant' });
    expect(metrics.maxAir).toEqual({ value: 330, timeS: 2, assetId: 'module-q', domain: 'air' });
  });
  it('counts equality at the declared strict bulk thermal threshold as a violation', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 1, 100, { sample: sample(0, 100, { temperatures: [{ assetId: 'module-a', domain: 'coolant', kelvin: 318.15 }, { assetId: 'module-a', domain: 'air', kelvin: 313.15 }] }) }), criteria);
    expect(metrics.thermalViolationS).toBe(1);
    expect(metrics.firstThermalViolationS).toBe(0);
  });
  it('retains unavailable observations instead of inventing zero values', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 1, 100, { sample: sample(0, 100, { serviceableAccelerators: null, energizedAccelerators: null, temperatures: [{ assetId: 'module-a', domain: 'coolant', kelvin: null }, { assetId: 'module-a', domain: 'air', kelvin: null }], batteryWh: null }), batteryDischargeWh: null, batteryChargeWh: null, batteryLossWh: null }), criteria);
    expect(metrics.unavailableS).toBe(1);
    expect(metrics.minServiceable).toBeNull();
    expect(metrics.maxCoolant).toBeNull();
    expect(metrics.maxAir).toBeNull();
    expect(metrics.batteryDischargeWh).toBeNull();
    expect(metrics.batteryChargeWh).toBeNull();
    expect(metrics.batteryLossWh).toBeNull();
  });
  it('records thermal observation absence as unavailable rather than satisfied', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 1, 100, { sample: sample(0, 100, { temperatures: [] }) }), criteria);
    expect(metrics.unavailableS).toBe(1);
  });
  it('does not treat an omitted required air domain as a satisfied thermal measurement', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 1, 100, { sample: sample(0, 100, { temperatures: [{ assetId: 'module-a', domain: 'coolant', kelvin: 300 }] }) }), criteria);
    expect(metrics.unavailableS).toBe(1);
    expect(metrics.boundaryHealthy).toBeNull();
    expect(metrics.maxAir).toBeNull();
  });
  it('retains gross discharge and recharge separately from net storage change and losses', () => {
    const metrics = createMetrics(criteria);
    observeBoundary(metrics, sample(0, 100, { batteryWh: 1000 }), criteria);
    accumulateInterval(metrics, interval(0, 5, 100, { batteryDischargeWh: 90, batteryLossWh: 10 }), criteria);
    observeBoundary(metrics, sample(5, 100, { batteryWh: 900 }), criteria);
    accumulateInterval(metrics, interval(5, 10, 100, { sample: sample(5, 100, { batteryWh: 900 }), batteryChargeWh: 110, batteryLossWh: 10 }), criteria);
    observeBoundary(metrics, sample(10, 100, { batteryWh: 1000 }), criteria);
    expect(metrics).toMatchObject({ batteryDischargeWh: 90, batteryChargeWh: 110, batteryLossWh: 20, batteryNetChangeWh: 0 });
    expect(metrics.batteryNetChangeWh).toBe(metrics.batteryChargeWh! - metrics.batteryDischargeWh! - metrics.batteryLossWh!);
  });
});

describe('PH4 sustained recovery and repeated disruptions', () => {
  it('resets pending dwell after a relapse', () => {
    const metrics = createMetrics(criteria);
    for (const [start, end, serviceable] of [[0, 5, 40], [5, 8, 100], [8, 10, 40], [10, 15, 100]]) {
      observeBoundary(metrics, sample(start, serviceable), criteria);
      accumulateInterval(metrics, interval(start, end, serviceable), criteria);
    }
    observeBoundary(metrics, sample(15), criteria);
    expect(metrics.interruptionCount).toBe(2);
    expect(metrics.serviceViolationS).toBe(7);
    expect(metrics.longestInterruptionS).toBe(5);
    expect(recoveryReport(metrics, 'completed')).toMatchObject({ status: 'recovered', onsetTimeS: 10, confirmationTimeS: 15 });
  });
  it('does not claim recovery before the full final dwell', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 5, 40), criteria);
    observeBoundary(metrics, sample(5), criteria);
    accumulateInterval(metrics, interval(5, 9), criteria);
    observeBoundary(metrics, sample(9), criteria);
    expect(recoveryReport(metrics, 'completed')).toMatchObject({ status: 'not-recovered', onsetTimeS: 5, confirmationTimeS: null });
    expect(recoveryReport(metrics, 'cancelled').status).toBe('incomplete-observation');
  });
  it('does not let an earlier recovered episode hide a later unresolved interruption', () => {
    const metrics = oracleMetrics();
    accumulateInterval(metrics, interval(20, 22), criteria);
    observeBoundary(metrics, sample(22, 0), criteria);
    accumulateInterval(metrics, interval(22, 24, 0), criteria);
    observeBoundary(metrics, sample(24, 0), criteria);
    expect(metrics.interruptionCount).toBe(2);
    expect(recoveryReport(metrics, 'completed')).toMatchObject({ status: 'not-recovered', referenceTimeS: 22, confirmationTimeS: null });
  });
  it('cancels recovery at a terminal renewed failure without inventing extra elapsed outage', () => {
    const metrics = oracleMetrics();
    observeBoundary(metrics, sample(20, 0), criteria);
    expect(metrics.shortfallAcceleratorS).toBe(400);
    expect(metrics.serviceViolationS).toBe(10);
    expect(metrics.elapsedS).toBe(20);
    expect(recoveryReport(metrics, 'completed').status).toBe('not-recovered');
  });
  it('confirms an explicitly zero dwell at the healthy terminal restoration boundary', () => {
    const zeroDwell = { ...criteria, dwellS: 0 }, metrics = createMetrics(zeroDwell);
    accumulateInterval(metrics, interval(0, 5, 0), zeroDwell);
    observeBoundary(metrics, sample(5), zeroDwell);
    expect(recoveryReport(metrics, 'completed')).toMatchObject({ status: 'recovered', onsetTimeS: 5, confirmationTimeS: 5 });
  });
});

describe('PH4 arithmetic fixture input validation', () => {
  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid required capacity %s without accumulating', requiredAccelerators => {
    const metrics = createMetrics(criteria), before = structuredClone(metrics);
    expect(() => accumulateInterval(metrics, interval(0, 1, 100, { sample: sample(0, 100, { requiredAccelerators }) }), criteria)).toThrow();
    expect(metrics).toEqual(before);
  });
  it.each([NaN, Infinity, -Infinity, -1])('rejects invalid serviceable capacity %s without accumulating', serviceableAccelerators => {
    const metrics = createMetrics(criteria), before = structuredClone(metrics);
    expect(() => accumulateInterval(metrics, interval(0, 1, serviceableAccelerators), criteria)).toThrow();
    expect(metrics).toEqual(before);
  });
  it.each(['batteryDischargeWh', 'batteryChargeWh', 'batteryLossWh'] as const)('rejects invalid %s without partial metric mutation', key => {
    for (const invalid of [NaN, Infinity, -1]) {
      const metrics = createMetrics(criteria), before = structuredClone(metrics);
      expect(() => accumulateInterval(metrics, interval(0, 1, 100, { [key]: invalid }), criteria)).toThrow();
      expect(metrics).toEqual(before);
    }
  });
  it('rejects a backward interval and gaps in authoritative committed coverage', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 1), criteria);
    const before = structuredClone(metrics);
    expect(() => accumulateInterval(metrics, interval(1, 0), criteria)).toThrow();
    expect(metrics).toEqual(before);
    expect(() => accumulateInterval(metrics, interval(2, 3), criteria)).toThrow();
    expect(metrics).toEqual(before);
  });
});

describe('PH4 accumulator checkpoint independence', () => {
  it.each([7, 17])('JSON restoration at t=%i preserves violation or pending recovery exactly', checkpointS => {
    let metrics = createMetrics(criteria);
    observeBoundary(metrics, sample(0), criteria);
    for (let second = 0; second < 20; second++) {
      const serviceable = second < 5 || second >= 15 ? 100 : second < 10 ? 40 : 80;
      observeBoundary(metrics, sample(second, serviceable), criteria);
      accumulateInterval(metrics, interval(second, second + 1, serviceable), criteria);
      if (second + 1 === checkpointS) metrics = JSON.parse(JSON.stringify(metrics));
    }
    observeBoundary(metrics, sample(20), criteria);
    // Detail segmentation may differ; recovery semantics must not depend on request grouping.
    expect(recoveryReport(metrics, 'completed')).toEqual(recoveryReport(oracleMetrics(), 'completed'));
  });
  it('keeps exact online aggregates and sampled extrema after detailed chart/evidence retention is exceeded', () => {
    const metrics = createMetrics(criteria);
    for (let second = 0; second < 2202; second++) {
      const serviceable = second % 2 === 0 ? 0 : 100;
      const observation = sample(second, serviceable, { temperatures: [{ assetId: 'module-a', domain: 'coolant', kelvin: second === 0 ? 340 : 300 }, { assetId: 'module-a', domain: 'air', kelvin: 300 }] });
      observeBoundary(metrics, observation, criteria);
      accumulateInterval(metrics, interval(second, second + 1, serviceable, { sample: observation }), criteria);
    }
    observeBoundary(metrics, sample(2202), criteria);
    expect(metrics).toMatchObject({ elapsedS: 2202, shortfallAcceleratorS: 110100, serviceViolationS: 1101, thermalViolationS: 1, anyViolationS: 1101, interruptionCount: 1101, longestInterruptionS: 1, traceTruncated: true, intervalEvidenceTruncated: true });
    expect(metrics.minServiceable).toMatchObject({ value: 0, timeS: 0 });
    expect(metrics.maxCoolant).toMatchObject({ value: 340, timeS: 0 });
    expect(metrics.trace.length).toBeLessThanOrEqual(EXPERIMENT_LIMITS.traceSamples);
    expect(metrics.intervals.length).toBeLessThanOrEqual(EXPERIMENT_LIMITS.evidenceEntries);
    expect(metrics.trace.some(point => point.timeS === 0 && point.maxCoolantK === 340)).toBe(true);
  });
  it('cannot add a committed interval twice', () => {
    const metrics = createMetrics(criteria);
    accumulateInterval(metrics, interval(0, 5, 40), criteria);
    const checkpoint = structuredClone(metrics);
    // Both an explicit duplicate rejection and an idempotent no-op are permitted.
    try { accumulateInterval(metrics, interval(0, 5, 40), criteria); } catch { /* no candidate accepted */ }
    expect(metrics).toEqual(checkpoint);
  });
});
