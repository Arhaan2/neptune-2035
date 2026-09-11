import { describe, expect, it } from 'vitest';
import { createDecisionCampaign } from '../src/twin/decision/candidates';
import { runDecisionCampaign } from '../src/twin/decision/runner';
import { resolveAsset } from '../src/twin/assets/design';
import { createResultWalkthrough } from '../src/twin/presentation/walkthrough';
import { resolveInspection } from '../src/twin/presentation/history';

describe('PH7 walkthrough derives narrative and times from complete authoritative campaigns', () => {
  it.each(['transfer', 'nominal', 'no-benefit-bus', 'no-benefit-source'] as const)('explains actual %s outcome with inspectable equipment and original evidence', async fixture => {
    const campaign = createDecisionCampaign(fixture), result = await runDecisionCampaign(campaign);
    const before = structuredClone({ campaign, result }), walkthrough = createResultWalkthrough(campaign, result);
    expect(walkthrough.evidence).toEqual(result.runs.find(run => run.id === walkthrough.run.id));
    expect(walkthrough.run).toEqual(result.plan.runs.find(run => run.id === walkthrough.run.id));
    for (const step of walkthrough.steps) {
      expect(resolveAsset(walkthrough.run.design, step.assetId)).toBeDefined();
      const observation = await resolveInspection(walkthrough.run.design, walkthrough.evidence.state, { assetId: step.assetId, timeS: step.timeS, boundary: step.boundary }, { yieldTask: async () => {} });
      expect(observation.status, `${fixture}/${step.id}`).toBe('resolved');
      if (step.boundary === 'post') expect(observation.resolvedTimeS).toBe(step.timeS);
      else expect(observation.resolvedTimeS).toBeGreaterThanOrEqual(step.timeS);
    }
    const decision = walkthrough.steps.find(step => step.id === 'decision')!;
    expect(decision.explanation).toContain(result.ranking.status);
    for (const id of result.ranking.winnerIds) expect(decision.explanation).toContain(campaign.candidates.find(candidate => candidate.id === id)!.label);
    if (fixture === 'transfer') {
      const transition = walkthrough.evidence.state.transfer!.transitions.find(item => item.reason === 'TRANSFERRED')!;
      expect(walkthrough.steps.find(step => step.id === 'controller')!.timeS).toBe(transition.timeS);
      expect(walkthrough.steps.find(step => step.id === 'controller')!.explanation).toContain(transition.reason);
      expect(walkthrough.steps.find(step => step.id === 'confirmation')).toMatchObject({ timeS: walkthrough.evidence.state.experiment!.metrics.pendingRecovery!.confirmationTimeS, boundary: 'at-or-after' });
      expect(walkthrough.evidence.state.experiment!.evaluation.outcome).toBe('FAIL');
      expect(result.ranking.winnerIds).toEqual(['iii-24']);
    } else if (fixture === 'nominal') {
      expect(walkthrough.steps.some(step => step.id === 'fault')).toBe(false);
      expect(result.ranking.winnerIds).toEqual(['ii-24']);
    } else {
      expect(walkthrough.run.scenarioId).toBe(fixture === 'no-benefit-bus' ? 'receiving-bus' : 'common-source');
      expect(walkthrough.steps.some(step => step.id === 'confirmation')).toBe(false);
      expect(decision.explanation).toContain('No evaluated candidate meets');
      expect(walkthrough.steps.find(step => step.id === 'unrecovered')!.explanation).toContain('not a numerical solver failure');
    }
    expect({ campaign, result }).toEqual(before);
  });
  it('refuses incomplete or cancelled results and retains supplied provenance on completed imported evidence', async () => {
    const campaign = createDecisionCampaign('nominal'), result = await runDecisionCampaign(campaign);
    for (const status of ['incomplete', 'cancelled'] as const) expect(() => createResultWalkthrough(campaign, { ...result, status })).toThrow(/complete evaluated campaign/);
    expect(() => createResultWalkthrough(campaign, { ...result, ranking: { ...result.ranking, scopeComplete: false } })).toThrow();
    const supplied = { ...result, provenance: 'imported-supplied-evidence' as const };
    expect(createResultWalkthrough(campaign, supplied).result.provenance).toBe('imported-supplied-evidence');
  });
});
