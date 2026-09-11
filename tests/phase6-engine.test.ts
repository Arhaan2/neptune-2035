import { describe, expect, it } from 'vitest';
import { createDecisionCampaign } from '../src/twin/decision/candidates';
import { planDecisionCampaign, runDecisionCampaign, executeDecisionRun, assembleDecisionResult } from '../src/twin/decision/runner';
import { decisionCampaignIdentity } from '../src/twin/decision/contract';
import type { DecisionResult, DecisionRunExecutor } from '../src/twin/decision/types';

const byId = (result: DecisionResult) => [...result.runs].sort((a, b) => a.id.localeCompare(b.id));
describe('PH6 whole campaigns run the canonical engine with bounded isolated state', () => {
  it('plans the entire A matrix and matching actual baseline checkpoints with explicit fault footprints', () => {
    const c = createDecisionCampaign(), p = planDecisionCampaign(c);
    expect(p).toMatchObject({ totalRuns: 6, sharedBaselines: 3, candidates: 3, scenarios: 2, sensitivities: 1 });
    for (const faulted of p.runs.filter(r => r.baselineId)) {
      const nominal = p.runs.find(r => r.id === faulted.baselineId)!;
      expect(faulted.initialState).toEqual(nominal.initialState); expect(faulted.initialStateIdentity).toBe(nominal.initialStateIdentity);
      expect(faulted.footprints).toHaveLength(1); expect(JSON.stringify(faulted.footprints)).toContain('platform-002');
      expect(faulted.definition.disturbances).toHaveLength(1); expect(faulted.definition.disturbances[0].timeS).toBe(2);
    }
  });
  it.each([
    ['transfer', ['iii-24'], 'recommended'],
    ['nominal', ['ii-24'], 'recommended'],
    ['no-benefit-bus', [], 'no-feasible-evaluated-candidate'],
    ['no-benefit-source', [], 'no-feasible-evaluated-candidate'],
  ] as const)('executes every %s cell and retains original Phase5 outcomes', async (fixture, winners, status) => {
    const c = createDecisionCampaign(fixture), result = await runDecisionCampaign(c);
    expect(result).toMatchObject({ status: 'completed', ranking: { status, winnerIds: [...winners], scopeComplete: true } });
    expect(result.coverage.completed).toBe(result.plan.totalRuns); expect(result.runs).toHaveLength(result.plan.totalRuns);
    expect(result.coverage.fullyEvaluatedCandidates).toBe(c.candidates.length);
    for (const run of result.runs) {
      expect(run.state?.experiment?.metrics.initialBatteryWh).toBe(0); expect(run.peakSupply!.samples).toBeGreaterThan(12);
      expect(run.state?.experiment?.metrics.trace.length).toBeLessThanOrEqual(c.execution.traceSamples);
      if (run.scenarioId === 'eligible-feeder') {
        const loss = run.candidateId === 'iii-24' ? 19 : 80;
        expect(run.state!.experiment!.metrics.shortfallAcceleratorS).toBe(loss);
        expect(run.incrementalShortfallAcceleratorS).toBe(loss);
        expect(run.state!.experiment!.evaluation.outcome).toBe('FAIL');
      }
      if (run.scenarioId === 'receiving-bus') expect(run.state!.experiment!.metrics.shortfallAcceleratorS).toBe(80);
      if (run.scenarioId === 'common-source') expect(run.state!.experiment!.metrics.shortfallAcceleratorS).toBe(240);
    }
  });
  it('D exhaustively admits capacities through40 while48 breaches actual upstream ceiling with full useful service', async () => {
    const result = await runDecisionCampaign(createDecisionCampaign('sizing'));
    expect(result.status).toBe('completed'); expect(result.ranking.winnerIds).toEqual(['ii-40']);
    expect(result.ranking.feasibleCandidateIds).toEqual(['ii-16', 'ii-24', 'ii-32', 'ii-40', 'ii-8']);
    const passing = result.evaluations.find(r => r.candidateId === 'ii-40')!, failing = result.evaluations.find(r => r.candidateId === 'ii-48')!;
    expect(passing.worst.peakSupplyW).toBeCloseTo(113505.31181070539, 6); expect(failing.worst.peakSupplyW).toBeCloseTo(124361.61148697861, 6);
    expect(failing.requirements.find(r => r.id === 'upstream-supply-peak' && r.scenarioId === 'thermal')).toMatchObject({ status: 'violated', threshold: 120000, unit: 'W' });
    expect(failing.worst.shortfallAcceleratorS).toBe(0);
    for (const thermal of result.runs.filter(r => r.scenarioId === 'thermal')) expect(thermal.state?.experiment).toMatchObject({ warmup: { status: 'not-requested' }, metrics: { elapsedS: 120 } });
  });
  it('serial and bounded parallel matrices produce identical physical histories, requirements and rankings', async () => {
    const c = createDecisionCampaign(), serial = await runDecisionCampaign(c, { concurrency: 1 }), parallel = await runDecisionCampaign(c, { concurrency: 2 });
    expect(byId(parallel)).toEqual(byId(serial)); expect(parallel.evaluations).toEqual(serial.evaluations); expect(parallel.ranking).toEqual(serial.ranking);
  });
  it('the bounded scheduler never exceeds two active cells and caller edits cannot leak into a started campaign', async () => {
    const c = createDecisionCampaign(), identity = decisionCampaignIdentity(c); let active = 0, peak = 0;
    const executor: DecisionRunExecutor = async (...args) => { active++; peak = Math.max(peak, active); try { return await executeDecisionRun(...args); } finally { active--; } };
    const pending = runDecisionCampaign(c, { executor, concurrency: 2 }); c.requirements.totalInterruptionS = 0;
    const result = await pending;
    expect(peak).toBe(2); expect(active).toBe(0); expect(result.campaignIdentity).toBe(identity); expect(result.ranking.winnerIds).toEqual(['iii-24']);
  });
  it('economic assumptions alone preserve the exact simulated operating history and upper budget is applied once', async () => {
    const c = createDecisionCampaign('sensitivity'); c.scenarios = c.scenarios.filter(s => s.kind !== 'thermal');
    c.sensitivities = c.sensitivities.filter(s => ['central', 'cost-lower', 'cost-upper'].includes(s.id));
    c.objective.budgetBasis = 'upper-bound'; c.objective.budgetUSD = 20_000_000;
    const result = await runDecisionCampaign(c);
    expect(result.status).toBe('completed');
    for (const candidate of c.candidates) for (const scenario of c.scenarios) {
      const runs = result.runs.filter(r => r.candidateId === candidate.id && r.scenarioId === scenario.id), central = runs.find(r => r.sensitivityId === 'central')!;
      for (const run of runs) {
        expect(run.state?.modules).toEqual(central.state?.modules); expect(run.state?.transfer).toEqual(central.state?.transfer);
        expect(run.state?.experiment?.metrics).toEqual(central.state?.experiment?.metrics); expect(run.peakSupply).toEqual(central.peakSupply);
      }
    }
    for (const candidate of c.candidates) {
      const rows = result.evaluations.filter(r => r.candidateId === candidate.id), central = rows.find(r => r.sensitivityId === 'central')!;
      expect(rows.every(row => row.budgetCostUSD === central.includedCost.totalUSD * 1.5)).toBe(true);
    }
  });
  it('cancellation after real progress preserves unresolved coverage, and restarting creates isolated initial histories', async () => {
    const c = createDecisionCampaign(), abort = new AbortController(), progress: DecisionResult[] = [];
    const cancelled = await runDecisionCampaign(c, { signal: abort.signal, onProgress: result => { progress.push(result); if (result.coverage.completed >= 1) abort.abort(); } });
    expect(progress[0].coverage.completed).toBe(0); expect(cancelled.status).toBe('cancelled'); expect(cancelled.ranking.scopeComplete).toBe(false);
    expect(cancelled.ranking.status).not.toBe('recommended'); expect(cancelled.coverage.completed).toBeLessThan(cancelled.coverage.planned);
    const restarted = await runDecisionCampaign(c);
    expect(restarted.status).toBe('completed'); expect(restarted.ranking.winnerIds).toEqual(['iii-24']);
    expect(restarted.runs.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'eligible-feeder')?.state?.experiment?.metrics.shortfallAcceleratorS).toBe(19);
  });
  it('incomplete sensitivity coverage prohibits a final no-feasible conclusion even when central evidence is complete', async () => {
    const c = createDecisionCampaign('transfer'); c.requirements.totalInterruptionS = 0;
    c.sensitivities.push(createDecisionCampaign('sensitivity').sensitivities.find(s => s.id === 'idle-upper')!);
    const plan = planDecisionCampaign(c), runs = await Promise.all(plan.runs.filter(r => r.sensitivityId === 'central').map(r => executeDecisionRun(r, c.execution)));
    const partial = assembleDecisionResult(c, plan, runs);
    expect(partial.status).toBe('incomplete'); expect(partial.ranking.scopeComplete).toBe(false); expect(partial.ranking.status).toBe('evaluation-incomplete');
  });
  it('required unresolved targets fail before execution instead of silently becoming nominal runs', () => {
    const c = createDecisionCampaign('sizing'); c.scenarios = createDecisionCampaign('transfer').scenarios;
    expect(() => planDecisionCampaign(c)).toThrow(/Unresolved required disturbance target/);
  });
  it('rejects mismatched responses rather than associating a late result with another cell', async () => {
    const c = createDecisionCampaign();
    await expect(runDecisionCampaign(c, { executor: async (run, settings) => ({ ...await executeDecisionRun(run, settings), id: 'wrong-run' }) })).rejects.toThrow(/Late or mismatched/);
  });
});
