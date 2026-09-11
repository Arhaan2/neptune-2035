import { describe, expect, it } from 'vitest';
import frozen from './fixtures/phase-5/frozen-expectations.json';
import { capacityOracle, serviceOracle, type ServiceInterval } from './fixtures/phase-5/independent-oracles';
import { accumulateInterval, createMetrics, observeBoundary, recoveryReport } from '../src/twin/experiment/metrics';
import type { MetricSample, RecoveryCriteria } from '../src/twin/experiment/types';

const criteria: RecoveryCriteria = { dwellS: frozen.service.dwellS, capacityToleranceAccelerators: 0, coolantLimitK: 330, airLimitK: 330, temperatureToleranceK: 0, thermalComparator: 'strictly-below', scope: 'all-modules-and-required-service' };
function evaluate(intervals: ServiceInterval[]) {
  const metrics = createMetrics(criteria);
  const sample = (timeS: number, serviceable: number): MetricSample => ({ timeS, requiredAccelerators: 24, serviceableAccelerators: serviceable, energizedAccelerators: serviceable, temperatures: [{ assetId: 'isolated-fixture', domain: 'coolant', kelvin: 300 }, { assetId: 'isolated-fixture', domain: 'air', kelvin: 300 }], batteryWh: 0 });
  for (const interval of intervals) {
    const observation = sample(interval.startS, interval.serviceable);
    observeBoundary(metrics, observation, criteria);
    accumulateInterval(metrics, { startS: interval.startS, endS: interval.endS, sample: observation, batteryChargeWh: 0, batteryDischargeWh: 0, batteryLossWh: 0 }, criteria);
  }
  observeBoundary(metrics, sample(intervals.at(-1)!.endS, intervals.at(-1)!.serviceable), criteria);
  return metrics;
}

describe('PH5 independent frozen arithmetic acceptance oracles', () => {
  it('derives native protection and indivisible shared capacity by exhaustive subsets', () => {
    expect(capacityOracle(frozen.capacity.resources, frozen.capacity.bundles)).toEqual(frozen.capacity.expected);
    expect(capacityOracle(frozen.capacity.resources, [...frozen.capacity.bundles].reverse())).toEqual(frozen.capacity.expected);
  });
  it.each([[60000, []], [89999, []], [90000, ['recipient-a']], [100000, ['recipient-a']], [120000, ['recipient-a', 'recipient-b']]])('independently resolves rating %i W with zero/insufficient/exact/sufficient headroom', (ratingW, admittedIds) => {
    expect(capacityOracle([{ id: 'shared', ratingW, nativeW: 60000 }], frozen.capacity.bundles).admittedIds).toEqual(admittedIds);
  });
  it('derives II loss and III recovery separately from the whole-run evaluator', () => {
    const f = frozen.service;
    const healthy = { startS: 0, endS: f.faultS, required: 24, serviceable: 24 };
    const ii = [healthy, { startS: f.faultS, endS: f.horizonS, required: 24, serviceable: 16 }];
    const iii = [healthy, { startS: f.faultS, endS: f.transferS, required: 24, serviceable: 16 }, { startS: f.transferS, endS: f.horizonS, required: 24, serviceable: 24 }];
    expect(serviceOracle(ii).shortfallAcceleratorS).toBe(f.affectedDemand * (f.horizonS - f.faultS));
    expect(serviceOracle(iii).shortfallAcceleratorS).toBe(f.affectedDemand * (f.transferS - f.faultS));
    expect(evaluate(ii).shortfallAcceleratorS).toBe(f.generationIIShortfallAcceleratorS);
    const metrics = evaluate(iii);
    expect(metrics.shortfallAcceleratorS).toBe(f.generationIIIShortfallAcceleratorS);
    expect(metrics.serviceViolationS).toBe(f.generationIIIInterruptionS);
    expect(recoveryReport(metrics, 'completed')).toMatchObject({ status: 'recovered', onsetTimeS: f.recoveryOnsetS, confirmationTimeS: f.recoveryConfirmationS });
  });
  it('independently sums partial restoration shortfall without claiming full recovery', () => {
    const expected = serviceOracle(frozen.partialService.intervals);
    expect(expected).toEqual(frozen.partialService.expected);
    const metrics = evaluate(frozen.partialService.intervals);
    expect(metrics).toMatchObject({ shortfallAcceleratorS: expected.shortfallAcceleratorS, serviceViolationS: expected.serviceViolationS, firstServiceViolationS: expected.firstServiceViolationS, minServiceable: { value: expected.minimumServiceable } });
    expect(recoveryReport(metrics, 'completed').status).toBe('not-recovered');
  });
});
