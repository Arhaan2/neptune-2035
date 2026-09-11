import { describe, expect, it } from 'vitest';
import { advance, initialize, summarize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { recoveryReport } from '../src/twin/experiment/metrics';
import { billOfEquipment, COST_ASSUMPTIONS } from '../src/twin/analysis/reports';
import { transferDemonstration, type Phase5Case } from '../src/twin/transfer/demonstrations';
import type { SimulationState } from '../src/twin/types';

// Independent policy oracle fixed before the decision evaluator is implemented.
// Uses raw whole-run fields; never consults a production Phase6 ranking or winner.
const policy = Object.freeze({ nominalUnmet: 0, faultUnmet: 24, totalInterruptionS: 3, confirmationAbsoluteS: 10, thermalDurationS: 0, tolerance: 1e-8 });
function admissible(state: SimulationState, nominal: boolean) {
  const run = state.experiment;
  if (!run || run.status !== 'completed') return false;
  const m = run.metrics, recovery = recoveryReport(m, run.status);
  return Number.isFinite(m.shortfallAcceleratorS) && m.shortfallAcceleratorS <= (nominal ? policy.nominalUnmet : policy.faultUnmet) + policy.tolerance
    && m.serviceViolationS <= (nominal ? 0 : policy.totalInterruptionS) + policy.tolerance
    && m.thermalViolationS <= policy.thermalDurationS + policy.tolerance
    && (nominal || recovery.status === 'no-qualifying-interruption' || (recovery.status === 'recovered' && recovery.confirmationTimeS !== null && recovery.confirmationTimeS <= policy.confirmationAbsoluteS + policy.tolerance));
}
function reference(kind: Phase5Case = 'eligible') {
  return transferDemonstration(kind).map(run => ({ ...run, state: advance(run.design, initialize(run.design, run.definition), run.definition.durationS) }));
}

describe('PH6 frozen policy against independently executed Phase5 engine evidence', () => {
  it('A requires total service history and confirmed recovery while leaving the original zero-outage FAIL unchanged', () => {
    const runs = reference(), ii = runs.find(r => r.generation === 2 && r.role === 'faulted')!, iii = runs.find(r => r.generation === 3 && r.role === 'faulted')!;
    for (const run of runs) {
      expect(run.design.config).toMatchObject({ requestedAccelerators: 24, workload: 0.8, seawaterK: 291.15, requireClusterNetwork: true });
      expect(run.design.assets.filter(a => a.type === 'platform')).toHaveLength(3);
      expect(run.state.experiment!.metrics.initialBatteryWh).toBe(0);
      expect(run.definition).toMatchObject({ durationS: 12, initial: { mode: 'cold' }, recovery: { dwellS: 5 } });
      const baseline = runs.find(b => b.generation === run.generation && b.role === 'unfaulted')!;
      expect(run.state.experiment!.initialState).toEqual(baseline.state.experiment!.initialState);
      expect(admissible(baseline.state, true)).toBe(true);
    }
    expect(ii.state.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 80, serviceViolationS: 10, longestInterruptionS: 10 });
    expect(iii.state.experiment!.metrics).toMatchObject({ shortfallAcceleratorS: 19, serviceViolationS: 2.375, longestInterruptionS: 2.375, thermalViolationS: 0 });
    expect(recoveryReport(iii.state.experiment!.metrics, 'completed')).toMatchObject({ onsetTimeS: 4.375, confirmationTimeS: 9.375 });
    expect(admissible(ii.state, false)).toBe(false); expect(admissible(iii.state, false)).toBe(true);
    expect(iii.state.experiment!.evaluation.outcome).toBe('FAIL');
    expect(summarize(iii.design, iii.state).availableAccelerators).toBe(24);
    expect(iii.state.experiment!.metrics.shortfallAcceleratorS).toBeGreaterThan(0);
    const a = billOfEquipment(ii.design), b = billOfEquipment(iii.design);
    expect(b.totalUSD - a.totalUSD).toBe(240_000);
    expect(b.equipment - a.equipment).toBe(160_000);
    expect(b.installation).toBe(b.equipment * COST_ASSUMPTIONS.installationFraction);
    expect(b.contingency).toBe((b.equipment + b.installation) * COST_ASSUMPTIONS.contingencyFraction);
  });
  it.each(['bus', 'source'] as const)('B mandatory %s failures produce an empty feasible set without dropping successful baselines', kind => {
    const runs = reference(kind), faulted = runs.filter(r => r.role === 'faulted');
    expect(runs.filter(r => r.role === 'unfaulted').every(r => admissible(r.state, true))).toBe(true);
    expect(faulted.filter(r => admissible(r.state, false))).toEqual([]);
    expect(faulted.map(r => r.state.experiment!.metrics.shortfallAcceleratorS)).toEqual(kind === 'bus' ? [80, 80] : [240, 240]);
    expect(faulted.every(r => r.state.experiment!.status === 'completed')).toBe(true);
  });
  it('C a separately declared nominal-only scope admits both and prefers authoritative lower included cost II', () => {
    const healthy = reference().filter(r => r.role === 'unfaulted');
    expect(healthy.every(r => admissible(r.state, true))).toBe(true);
    expect(healthy.map(r => ({ generation: r.generation, includedUSD: billOfEquipment(r.design).totalUSD })).sort((a, b) => a.includedUSD - b.includedUSD)[0].generation).toBe(2);
  });
  it('restoration before the end cannot pass when the observation ends before dwell confirmation', () => {
    const { design, definition } = transferDemonstration().find(r => r.generation === 3 && r.role === 'faulted')!;
    const short = createExperimentDefinition(design, { id: 'phase6-short-observation', durationS: 9, disturbances: definition.disturbances, initial: { mode: 'cold' }, recovery: { dwellS: 5 } });
    const state = advance(design, initialize(design, short), 9);
    expect(summarize(design, state).availableAccelerators).toBe(24);
    expect(recoveryReport(state.experiment!.metrics, 'completed')).toMatchObject({ status: 'not-recovered', onsetTimeS: 4.375, confirmationTimeS: null });
    expect(admissible(state, false)).toBe(false);
  });
  it('retains shared-donor 160/99 history and native headroom instead of fractional transferable bundles', () => {
    const runs = reference('partial').filter(r => r.role === 'faulted'), iii = runs.find(r => r.generation === 3)!;
    expect(runs.map(r => r.state.experiment!.metrics.shortfallAcceleratorS)).toEqual([160, 99]);
    const transfer = iii.state.transfer!, blocked = transfer.attempts.find(a => a.reason === 'INSUFFICIENT_HEADROOM')!, resource = transfer.resources.find(r => r.id === blocked.bindingResourceId)!;
    expect(blocked.admittedW).toBe(0); expect(blocked.unservedW).toBeGreaterThan(resource.headroomW);
    expect(resource.nativeW).toBeGreaterThan(0); expect(resource.nativeW + resource.transferredW).toBeLessThanOrEqual(resource.capacityW + 1e-6);
    expect(admissible(iii.state, false)).toBe(false);
  });
});
