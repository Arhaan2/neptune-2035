import { beforeAll, describe, expect, it } from 'vitest';
import { createDecisionCampaign } from '../src/twin/decision/candidates';
import { evaluateCandidate, evaluateRequirement, rankCampaign } from '../src/twin/decision/evaluate';
import { advance, initialize } from '../src/twin/engine/simulation';
import { constraints } from '../src/twin/analysis/reports';
import { experimentRecoveryReport } from '../src/twin/experiment/report';
import { transferDemonstration } from '../src/twin/transfer/demonstrations';
import type { CandidateEvaluation, DecisionCampaign, DecisionRunEvidence, RequirementEvaluation } from '../src/twin/decision/types';

const campaign = createDecisionCampaign('transfer');
let raw: DecisionRunEvidence[];
beforeAll(() => {
  raw = campaign.candidates.flatMap(candidate => transferDemonstration(candidate.id.includes('disabled') ? 'disabled' : 'eligible').filter(run => run.generation === candidate.design.config.generation).map(run => {
    const state = advance(run.design, initialize(run.design, run.definition), 12);
    return { id: `${candidate.id}-${run.role}`, candidateId: candidate.id, scenarioId: run.role === 'faulted' ? 'eligible-feeder' : 'nominal', sensitivityId: 'central', status: 'completed', reason: null, state,
      // Peak irrelevant to this no-ceiling policy; full upstream accounting is tested through the real campaign runner separately.
      peakSupply: { value: 1000, timeS: 0, assetId: 'shore/grid', samples: 1 }, hardConstraints: constraints(run.design, state), recovery: experimentRecoveryReport(state), incrementalShortfallAcceleratorS: run.role === 'faulted' ? state.experiment!.metrics.shortfallAcceleratorS : null } satisfies DecisionRunEvidence;
  }));
});
function rows(c: DecisionCampaign = campaign, runs = raw) { return c.candidates.map(candidate => evaluateCandidate(c, candidate.id, runs)); }
function syntheticRows(): CandidateEvaluation[] {
  // Deliberately pure ranking fixture: these mutated economics are not real-engine demonstration evidence.
  return rows().map((row, index) => ({ ...row, execution: 'completed', feasibility: 'feasible', rankingCostUSD: 100 + index * 10, workload: 8 + index * 8 }));
}

describe('PH6 explicit requirement classification and ranking semantics', () => {
  const limit: Omit<RequirementEvaluation, 'margin' | 'status'> = { id: 'limit', class: 'operating', actual: 3, threshold: 3, unit: 's', operator: '<=', tolerance: 1e-8, scenarioId: 'eligible-feeder', sensitivityId: 'central', assetIds: ['platform-002'], timeS: 2, reason: 'frozen total interruption policy' };
  it('uses full precision at equality and either side of absolute tolerance', () => {
    expect(evaluateRequirement(limit)).toMatchObject({ status: 'binding', margin: 0 });
    expect(evaluateRequirement({ ...limit, actual: 3 + 0.5e-8 }).status).toBe('binding');
    expect(evaluateRequirement({ ...limit, actual: 3 + 2e-8 }).status).toBe('violated');
    expect(evaluateRequirement({ ...limit, actual: 2.5 })).toMatchObject({ status: 'satisfied', margin: 0.5 });
    expect(evaluateRequirement({ ...limit, actual: 3.004 }).status).toBe('violated');
  });
  it.each([null, NaN, Infinity, -Infinity])('missing/nonfinite actual %s is unavailable with no invented signed margin', actual => {
    expect(evaluateRequirement({ ...limit, actual })).toMatchObject({ actual: null, status: 'unavailable', margin: null });
  });
  it('the real reference feasible set is III only, while original Phase5 zero-outage failure is retained', () => {
    const evaluated = rows(), result = rankCampaign(campaign, evaluated);
    expect(result).toMatchObject({ status: 'recommended', winnerIds: ['iii-24'], feasibleCandidateIds: ['iii-24'], scopeComplete: true });
    const iii = evaluated.find(row => row.candidateId === 'iii-24')!;
    expect(iii.worst).toMatchObject({ shortfallAcceleratorS: 19, totalInterruptionS: 2.375, longestInterruptionS: 2.375, recoveryConfirmationS: 9.375 });
    expect(iii.requirements.find(r => r.id === 'confirmed-recovery')).toMatchObject({ actual: 9.375, threshold: 10, margin: 0.625, scenarioId: 'eligible-feeder', unit: 's' });
    expect(raw.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'eligible-feeder')!.state!.experiment!.evaluation.outcome).toBe('FAIL');
  });
  it('tightening operating thresholds cannot enlarge the feasible set on unchanged physical evidence', () => {
    const original = rankCampaign(campaign, rows()).feasibleCandidateIds;
    for (const patch of [{ totalInterruptionS: 2 }, { faultUnmetAcceleratorS: 18 }, { recoveryConfirmationDeadlineS: 9 }]) {
      const c = structuredClone(campaign); Object.assign(c.requirements, patch);
      const tightened = rankCampaign(c, rows(c));
      expect(tightened.feasibleCandidateIds.every(id => original.includes(id))).toBe(true);
      expect(tightened).toMatchObject({ status: 'no-feasible-evaluated-candidate', winnerIds: [] });
    }
  });
  it('complete raw endpoint restoration cannot erase mandatory whole-run failure', () => {
    const c = structuredClone(campaign); c.requirements.faultUnmetAcceleratorS = 18;
    const row = evaluateCandidate(c, 'iii-24', raw);
    expect(raw.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'eligible-feeder')!.state!.modules.every(m => m.availableAccelerators === 8)).toBe(true);
    expect(row.feasibility).toBe('infeasible');
    expect(row.requirements.find(r => r.id === 'unmet-demand' && r.scenarioId === 'eligible-feeder')).toMatchObject({ actual: 19, margin: -1, status: 'violated' });
  });
  it('minimum cost and maximum workload use opposite transparent objective directions', () => {
    const evaluated = syntheticRows(); expect(rankCampaign(campaign, evaluated).winnerIds).toEqual(['ii-24']);
    const sizing = { ...campaign, objective: { ...campaign.objective, mode: 'maximum-passing-workload' as const, unit: 'accelerators' as const, direction: 'descending' as const, fixedWorkload: null, supplyCeilingW: 120000 } };
    expect(rankCampaign(sizing, evaluated).winnerIds).toEqual(['iii-disabled-24']);
  });
  it('tolerance ties and display order are deterministic under candidate/evaluation reversal', () => {
    const evaluated = syntheticRows(); evaluated[1].rankingCostUSD = 100.005;
    const normal = rankCampaign(campaign, evaluated), reversed = rankCampaign({ ...campaign, candidates: [...campaign.candidates].reverse() }, [...evaluated].reverse());
    expect(normal.winnerIds).toEqual(['ii-24', 'iii-24']); expect(normal.ties).toEqual([['ii-24', 'iii-24']]);
    expect(reversed).toEqual(normal);
  });
  it('a cheaper infeasible candidate cannot win', () => {
    const evaluated = rows(); evaluated.find(r => r.candidateId === 'ii-24')!.rankingCostUSD = 0;
    expect(rankCampaign(campaign, evaluated).winnerIds).toEqual(['iii-24']);
  });
  it.each(['incomplete', 'cancelled', 'resource-limited', 'numerical-failure', 'unsupported', 'invalid'] as const)('unfinished/failed %s evidence cannot yield a final recommendation', execution => {
    const evaluated = syntheticRows(); evaluated[0] = { ...evaluated[0], execution, feasibility: 'unresolved' };
    expect(rankCampaign(campaign, evaluated)).toMatchObject({ status: 'provisional', scopeComplete: false, unresolvedCandidateIds: ['ii-24'] });
  });
  it('no candidates, all errors, all infeasible and all incomplete remain distinct', () => {
    expect(rankCampaign({ ...campaign, candidates: [] }, []).status).toBe('no-admissible-candidates');
    const evaluated = syntheticRows();
    const status = (execution: CandidateEvaluation['execution'], feasibility: CandidateEvaluation['feasibility']) => rankCampaign(campaign, evaluated.map(row => ({ ...row, execution, feasibility }))).status;
    expect(status('numerical-failure', 'unresolved')).toBe('numerical-execution-failed');
    expect(status('unsupported', 'unresolved')).toBe('no-admissible-candidates');
    expect(status('completed', 'infeasible')).toBe('no-feasible-evaluated-candidate');
    expect(status('incomplete', 'unresolved')).toBe('evaluation-incomplete');
  });
  it('duplicate scenario evidence is rejected instead of counted as complete coverage', () => {
    expect(() => evaluateCandidate(campaign, 'iii-24', [...raw, structuredClone(raw.find(r => r.candidateId === 'iii-24')!)])).toThrow();
  });
  it('missing mandatory metrics leaves the candidate unresolved', () => {
    const runs = structuredClone(raw), m = runs.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'eligible-feeder')!.state!.experiment!.metrics;
    delete (m as Partial<typeof m>).shortfallAcceleratorS;
    expect(evaluateCandidate(campaign, 'iii-24', runs)).toMatchObject({ execution: 'incomplete', feasibility: 'unresolved' });
  });
  it('unavailable terminal observations cannot be declared feasible from previously accumulated finite metrics', () => {
    const runs = structuredClone(raw); runs.find(r => r.candidateId === 'iii-24' && r.scenarioId === 'nominal')!.state!.experiment!.metrics.boundaryHealthy = null;
    expect(evaluateCandidate(campaign, 'iii-24', runs)).toMatchObject({ execution: 'incomplete', feasibility: 'unresolved' });
  });
  it('central included cost can meet a boundary budget while upper-bound accounting fails exactly once', () => {
    const central = rows().find(r => r.candidateId === 'iii-24')!, c = structuredClone(campaign);
    c.objective.budgetUSD = central.includedCost.totalUSD;
    expect(evaluateCandidate(c, 'iii-24', raw)).toMatchObject({ feasibility: 'feasible', budgetCostUSD: central.includedCost.totalUSD });
    c.objective.budgetBasis = 'upper-bound';
    const upper = evaluateCandidate(c, 'iii-24', raw);
    expect(upper.budgetCostUSD).toBe(central.includedCost.totalUSD * 1.5); expect(upper.feasibility).toBe('infeasible');
    expect(upper.requirements.find(r => r.id === 'included-cost-budget')).toMatchObject({ status: 'violated', unit: 'USD' });
  });
});
