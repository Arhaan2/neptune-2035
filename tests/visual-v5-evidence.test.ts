import { beforeAll, describe, expect, it } from 'vitest';
import { createDecisionCampaign, decisionCandidate } from '../src/twin/decision/candidates';
import { assembleDecisionResult, runDecisionCampaign } from '../src/twin/decision/runner';
import type { DecisionCampaign, DecisionFixture, DecisionResult } from '../src/twin/decision/types';
import { connectionsForModule, replaceEquipment, resolveAsset } from '../src/twin/assets/design';
import { updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { experimentRecoveryReport } from '../src/twin/experiment/report';
import { runExperiment } from '../src/twin/experiment/runner';
import { createResultWalkthrough, walkthroughBindingResource, walkthroughShots, walkthroughSourceIdentity } from '../src/twin/presentation/walkthrough';
import { resolveInspection } from '../src/twin/presentation/history';
import { getVisualKitBinding } from '../src/scene/visuals/kitContract';

const immediate = { yieldTask: async () => {} };
const fixtures = new Map<DecisionFixture, { campaign: DecisionCampaign; result: DecisionResult }>();
beforeAll(async () => {
  for (const fixture of ['transfer', 'nominal', 'no-benefit-bus', 'no-benefit-source'] as const) {
    const campaign = createDecisionCampaign(fixture);
    fixtures.set(fixture, { campaign, result: await runDecisionCampaign(campaign) });
  }
});
function prepared(fixture: DecisionFixture = 'transfer') {
  const { campaign, result } = fixtures.get(fixture)!;
  return createResultWalkthrough(campaign, result);
}

describe('Visual V5 typed evidence and presentation descriptors', () => {
  it('establishes the actual evaluated identity/scale and keeps subshots on one recorded semantic boundary', () => {
    const walkthrough = prepared(), { run, designSummary } = walkthrough, shots = walkthroughShots(walkthrough);
    expect(designSummary).toMatchObject({ candidateId: run.candidateId, revision: run.design.revision, requestedAccelerators: run.design.config.requestedAccelerators, provisionedAccelerators: run.design.provisionedAccelerators, modules: run.design.modules.length, platforms: run.design.assets.filter(asset => asset.type === 'platform').length, nodes: run.design.nodeCount, racks: run.design.rackCount, installedPeakITW: run.design.installedPeakITW });
    expect(walkthrough.steps.map(step => step.id)).toEqual(['installed', 'fault', 'downstream', 'controller', 'capacity', 'onset', 'confirmation', 'decision']);
    expect(shots[0]).toMatchObject({ kind: 'campus', stepId: 'installed', stepIndex: 0, timeS: walkthrough.evidence.state.experiment!.originTimeS });
    expect(shots.filter(shot => shot.stepId === 'installed').map(shot => shot.authoredKind)).toEqual([null, 'pump', 'exchanger', 'cdu']);
    for (const shot of shots) {
      const step = walkthrough.steps[shot.stepIndex];
      expect(shot).toMatchObject({ stepId: step.id, timeS: step.timeS, eventId: step.eventId, boundary: step.boundary });
      expect(resolveAsset(run.design, shot.assetId)).toBeDefined();
      if (shot.authoredKind) {
        const module = run.design.modules.find(item => shot.assetId.startsWith(`${item.id}/`))!;
        expect(getVisualKitBinding(resolveAsset(run.design, shot.assetId)!, connectionsForModule(run.design, module.id))?.kind).toBe(shot.authoredKind);
      }
    }
    expect(new Set(shots.map(shot => shot.id)).size).toBe(shots.length);
    expect(shots.reduce((sum, shot) => sum + shot.transitionMs + shot.dwellMs, 0)).toBeGreaterThanOrEqual(45000);
    expect(shots.reduce((sum, shot) => sum + shot.transitionMs + shot.dwellMs, 0)).toBeLessThanOrEqual(60000);
  });

  it('binds event/controller facts to typed records and retains transition versus final boundary semantics', async () => {
    const campaign = createDecisionCampaign('transfer');
    for (const scenario of campaign.scenarios) scenario.durationS = 3;
    const walkthrough = createResultWalkthrough(campaign, await runDecisionCampaign(campaign));
    const fault = walkthrough.steps.find(step => step.id === 'fault')!, controller = walkthrough.steps.find(step => step.id === 'controller')!;
    expect(fault.source.kind).toBe('recorded-event');
    if (fault.source.kind !== 'recorded-event' || controller.source.kind !== 'controller-transition') throw Error('Expected typed recorded sources');
    expect(fault.source.event.id).toBe(fault.eventId);
    expect(fault.source.event.assetId).toBe(fault.assetId);
    const transition = controller.source.transition;
    expect(walkthrough.evidence.state.transfer!.transitions).toContainEqual(transition);
    const sameTime = walkthrough.evidence.state.transfer!.transitions.filter(item => item.timeS === transition.timeS);
    expect(sameTime.length).toBeGreaterThan(1);
    const resolution = await resolveInspection(walkthrough.run.design, walkthrough.evidence.state, { assetId: controller.assetId, timeS: controller.timeS, boundary: controller.boundary }, immediate);
    expect(resolution.status).toBe('resolved');
    expect(resolution.state!.transfer!.transitions.filter(item => item.timeS === transition.timeS)).toEqual(sameTime);
    expect(controller.caption).toContain('final state');
    expect(controller.explanation).toContain(transition.reason);
  });

  it('does not claim reduced useful service after a real same-time zero-delay transfer restored the canonical boundary', async () => {
    const campaign = createDecisionCampaign('transfer');
    campaign.candidates = campaign.candidates.filter(candidate => candidate.design.transfer?.enabled).map(candidate => {
      const design = structuredClone(candidate.design);
      design.transfer!.delayS = 0;
      design.revision = 'v5-zero-delay-transfer';
      return decisionCandidate(candidate.id, candidate.label, design);
    });
    const walkthrough = createResultWalkthrough(campaign, await runDecisionCampaign(campaign));
    const step = walkthrough.steps.find(step => step.id === 'downstream')!;
    const resolved = await resolveInspection(walkthrough.run.design, walkthrough.evidence.state, { assetId: step.assetId, timeS: step.timeS, boundary: step.boundary }, immediate);
    expect(resolved.status).toBe('resolved');
    const module = walkthrough.run.design.modules.find(module => step.assetId.startsWith(`${module.id}/`))!;
    expect(resolved.state!.modules.find(item => item.id === module.id)!.availableAccelerators).toBe(module.nodeCount * 8);
    const sameTime = resolved.state!.transfer!.transitions.filter(item => item.timeS === step.timeS);
    expect(sameTime.map(item => item.reason)).toContain('FEEDER_FAULT');
    expect(sameTime.map(item => item.reason)).toContain('TRANSFERRED');
    expect(step.shots[0].title).toBe('Inspect useful service');
    expect(step.caption).not.toContain('service is constrained');
  });

  it('separates metric markers from actual canonical observations with no interpolated physical state', async () => {
    const walkthrough = prepared(), confirmation = walkthrough.steps.find(step => step.id === 'confirmation')!;
    expect(confirmation.source.kind).toBe('recovery-marker');
    if (confirmation.source.kind !== 'recovery-marker') throw Error('Expected marker');
    expect(confirmation.timeS).toBe(confirmation.source.originTimeS + confirmation.source.evaluationTimeS);
    const exact = await resolveInspection(walkthrough.run.design, walkthrough.evidence.state, { assetId: confirmation.assetId, timeS: confirmation.timeS, boundary: 'post' }, immediate);
    const actual = await resolveInspection(walkthrough.run.design, walkthrough.evidence.state, { assetId: confirmation.assetId, timeS: confirmation.timeS, boundary: confirmation.boundary }, immediate);
    expect(exact.status).toBe('unavailable-history');
    expect(actual.status).toBe('resolved');
    expect(actual.resolvedTimeS).toBeGreaterThan(confirmation.timeS);
    expect(actual.state!.timeS).toBe(actual.resolvedTimeS);
  });

  it('supports a canonical settled experiment with nonzero evaluation origin without presenting warmup as evaluation', async () => {
    // Campaign preparation is intentionally cold-only. This adapter test uses the
    // existing experiment runner's supported settled mode, not a shifted/fabricated snapshot.
    const { campaign, result: original } = fixtures.get('transfer')!;
    const result = structuredClone(original), chosen = prepared().run.id;
    const planned = result.plan.runs.find(run => run.id === chosen)!;
    const definition = createExperimentDefinition(planned.design, { id: planned.definition.id, durationS: planned.definition.durationS, disturbances: planned.definition.disturbances, recovery: planned.definition.recovery, initial: { mode: 'settled', settling: { maxWarmupS: 10, dwellS: 2, maxTemperatureRateKPerS: 1 } } });
    const state = runExperiment(planned.design, definition);
    expect(state.experiment!.status).toBe('completed');
    expect(state.experiment!.originTimeS).toBeGreaterThan(0);
    Object.assign(planned, { definition, initialState: state.experiment!.initialState, initialStateIdentity: state.experiment!.initialStateIdentity });
    Object.assign(result.runs.find(run => run.id === chosen)!, { state, recovery: experimentRecoveryReport(state) });
    const evaluated = assembleDecisionResult(campaign, result.plan, result.runs), walkthrough = createResultWalkthrough(campaign, evaluated);
    expect(walkthrough.run.id).toBe(chosen);
    expect(walkthrough.steps[0].timeS).toBe(state.experiment!.originTimeS);
    expect(walkthrough.steps[0].source).toMatchObject({ kind: 'evaluation-start', timeS: state.experiment!.originTimeS, checkpointTimeS: state.experiment!.initialState.timeS });
    for (const step of walkthrough.steps) {
      if (step.source.kind === 'recovery-marker') expect(step.timeS).toBe(state.experiment!.originTimeS! + step.source.evaluationTimeS);
      const resolution = await resolveInspection(planned.design, state, { assetId: step.assetId, timeS: step.timeS, boundary: step.boundary }, immediate);
      expect(resolution.status, step.id).toBe('resolved');
    }
  });

  it('omits nonexistent nominal disturbances and reports the actual whole-run and campaign outcomes separately', () => {
    const walkthrough = prepared('nominal');
    expect(walkthrough.steps.map(step => step.id)).toEqual(['installed', 'decision']);
    expect(walkthrough.summary).toMatchObject({ scenarioOutcome: walkthrough.evidence.state.experiment!.evaluation.outcome, recoveryStatus: 'no-qualifying-interruption', totalInterruptionS: walkthrough.evidence.state.experiment!.metrics.serviceViolationS, shortfallAcceleratorS: walkthrough.evidence.state.experiment!.metrics.shortfallAcceleratorS, decisionStatus: walkthrough.result.ranking.status });
    expect(walkthrough.summary.preferredCandidates.map(item => item.id)).toEqual(walkthrough.result.ranking.winnerIds);
    const transfer = prepared();
    expect(transfer.summary.scenarioOutcome).toBe('FAIL');
    expect(transfer.summary.decisionStatus).toBe('recommended');
    expect(transfer.summary.caption).toContain('FAIL');
  });

  it.each(['no-benefit-bus', 'no-benefit-source'] as const)('keeps %s unrecovered with no feasible recommendation or invented restoration', fixture => {
    const walkthrough = prepared(fixture);
    expect(walkthrough.steps.some(step => ['onset', 'confirmation'].includes(step.id))).toBe(false);
    expect(walkthrough.steps.find(step => step.id === 'unrecovered')?.source.kind).toBe('recovery-limit');
    expect(walkthrough.summary).toMatchObject({ headline: 'No feasible evaluated candidate', scenarioOutcome: 'FAIL', recoveryStatus: 'not-recovered', preferredCandidates: [], decisionStatus: 'no-feasible-evaluated-candidate' });
  });

  it('shows onset without confirmation when the completed observation ends before the required dwell', async () => {
    const campaign = createDecisionCampaign('transfer');
    for (const scenario of campaign.scenarios) scenario.durationS = 6;
    const result = await runDecisionCampaign(campaign), walkthrough = createResultWalkthrough(campaign, result);
    expect(walkthrough.run.scenarioId).toBe(campaign.scenarios.find(scenario => scenario.kind === 'eligible-feeder')!.id);
    expect(walkthrough.steps.some(step => step.id === 'onset')).toBe(true);
    expect(walkthrough.steps.some(step => step.id === 'confirmation')).toBe(false);
    expect(walkthrough.steps.some(step => step.id === 'unrecovered')).toBe(true);
    expect(walkthrough.summary.preferredCandidates).toEqual([]);
    expect(walkthrough.summary.recoveryStatus).toBe('not-recovered');
  });

  it('keeps zero-dwell onset and confirmation separate without claiming a pending dwell', async () => {
    const campaign = createDecisionCampaign('transfer', { requirements: { recoveryDwellS: 0 } });
    const walkthrough = createResultWalkthrough(campaign, await runDecisionCampaign(campaign));
    const onset = walkthrough.steps.find(step => step.id === 'onset')!, confirmation = walkthrough.steps.find(step => step.id === 'confirmation')!;
    expect(onset.timeS).toBe(confirmation.timeS);
    expect(onset.source).toMatchObject({ kind: 'recovery-marker', marker: 'onset', dwellS: 0 });
    expect(confirmation.source).toMatchObject({ kind: 'recovery-marker', marker: 'confirmation', dwellS: 0 });
    expect(onset.caption).not.toContain('not yet');
  });

  it('retains a real evaluated cost tie instead of choosing a display-order winner', async () => {
    const campaign = createDecisionCampaign('nominal');
    campaign.candidates = campaign.candidates.map(candidate => decisionCandidate(candidate.id, candidate.label, updateEconomicAssumptions(candidate.design, { unitCostScale: 0 })));
    const result = await runDecisionCampaign(campaign), walkthrough = createResultWalkthrough(campaign, result);
    expect(result.ranking.winnerIds.length).toBeGreaterThan(1);
    expect(walkthrough.summary).toMatchObject({ tied: true, headline: 'Preferred candidates remain tied' });
    expect(walkthrough.summary.preferredCandidates.map(item => item.id)).toEqual(result.ranking.winnerIds);
    expect(walkthrough.summary.preferredCandidates.every(item => item.rankingCostUSD === 0)).toBe(true);
  });

  it('selects a real limiting tie connection instead of an unrelated donor for a completed constrained campaign', async () => {
    const campaign = createDecisionCampaign('transfer');
    campaign.candidates = campaign.candidates.filter(candidate => candidate.design.transfer?.enabled).map(candidate => {
      const design = structuredClone(candidate.design), route = design.transfer!.routes.find(route => route.recipientPlatformId === 'platform-002')!;
      design.connections.find(connection => connection.id === route.tieConnectionIds[1])!.capacity = 1;
      design.revision = 'v5-limited-recipient-tie';
      return decisionCandidate(candidate.id, candidate.label, design);
    });
    const result = await runDecisionCampaign(campaign), walkthrough = createResultWalkthrough(campaign, result);
    expect(result.status).toBe('completed');
    const step = walkthrough.steps.find(step => step.id === 'capacity')!;
    if (step.source.kind !== 'controller-transition') throw Error('Expected a real controller record');
    const transition = step.source.transition;
    const route = walkthrough.run.design.transfer!.routes.find(route => route.id === transition.id)!;
    const connection = walkthrough.run.design.connections.find(connection => connection.id === route.tieConnectionIds[1])!;
    expect(step.source.transition).toMatchObject({ reason: 'INSUFFICIENT_HEADROOM', admittedW: 0, bindingResourceId: `edge:${connection.id}`, headroomW: 1 });
    expect(step.assetId).toBe(connection.from);
    expect(step.assetId).not.toBe(route.donorBusId);
    expect(step.source.bindingResource).toEqual({ kind: 'connection', resourceId: `edge:${connection.id}`, assetId: connection.from, connectionId: connection.id, fromAssetId: connection.from, toAssetId: connection.to });
    expect(step.caption).toContain(`edge:${connection.id}`);
    const resolved = await resolveInspection(walkthrough.run.design, walkthrough.evidence.state, { assetId: step.assetId, timeS: step.timeS, boundary: step.boundary }, immediate);
    expect(resolved.status).toBe('resolved');
    expect(resolved.state!.transfer!.transitions).toContainEqual(step.source.transition);
  });

  it('resolves exact asset, port and grouped resource scope without splitting canonical identifier delimiters', () => {
    const design = prepared().run.design, route = design.transfer!.routes[0];
    const asset = resolveAsset(design, route.tieId)!, port = asset.ports.find(port => port.medium === 'power')!;
    expect(walkthroughBindingResource(design, `asset:${asset.id}`)).toEqual({ kind: 'asset', resourceId: `asset:${asset.id}`, assetId: asset.id });
    expect(walkthroughBindingResource(design, `port:${asset.id}:${port.id}`)).toEqual({ kind: 'port', resourceId: `port:${asset.id}:${port.id}`, assetId: asset.id, portId: port.id });
    const groupId = `bundle:${route.id}:module-distribution`;
    expect(walkthroughBindingResource(design, groupId)).toEqual({ kind: 'module-distribution', resourceId: groupId, assetId: route.receivingBusId, routeId: route.id, platformId: route.recipientPlatformId, moduleIds: design.modules.filter(module => module.platformId === route.recipientPlatformId).map(module => module.id) });
    const unknown = `port:${asset.id}:${port.id}:not-an-owner`;
    expect(walkthroughBindingResource(design, unknown)).toEqual({ kind: 'unavailable', resourceId: unknown, assetId: null });
    expect(walkthroughBindingResource(design, null)).toBeNull();
  });

  it('does not force an authored pump onto an incompatible installed specification', async () => {
    const campaign = createDecisionCampaign('nominal');
    campaign.candidates = campaign.candidates.map(candidate => {
      let design = candidate.design;
      for (const module of design.modules) design = replaceEquipment(design, `${module.id}/pump-duty`, 'pump-physical');
      return decisionCandidate(candidate.id, candidate.label, design);
    });
    const walkthrough = createResultWalkthrough(campaign, await runDecisionCampaign(campaign));
    const pump = walkthroughShots(walkthrough).find(shot => shot.id === 'installed:pump')!;
    expect(resolveAsset(walkthrough.run.design, pump.assetId)!.catalogId).toBe('pump-physical');
    expect(pump.authoredKind).toBeNull();
    expect(walkthroughShots(walkthrough).filter(shot => shot.stepId === 'installed').map(shot => shot.authoredKind)).toEqual([null, null, 'exchanger', 'cdu']);
  });

  it.each(['invalid', 'resource-limited', 'incomplete', 'numerical-failure', 'unsupported'] as const)('refuses a forged completed envelope containing %s evidence', status => {
    const { campaign, result: original } = fixtures.get('transfer')!, result = structuredClone(original);
    result.runs[0].status = status;
    expect(() => createResultWalkthrough(campaign, result)).toThrow(/complete evaluated campaign/);
  });

  it('rejects changed campaign inputs and duplicate run identities behind a completed display label', () => {
    const { campaign, result } = fixtures.get('transfer')!;
    const changed = structuredClone(campaign);
    changed.requirements.totalInterruptionS += 1;
    expect(() => createResultWalkthrough(changed, result)).toThrow(/complete evaluated campaign/);
    const duplicate = structuredClone(result);
    duplicate.runs[1] = structuredClone(duplicate.runs[0]);
    expect(() => createResultWalkthrough(campaign, duplicate)).toThrow(/complete evaluated campaign/);
  });

  it('captures prices, result/provenance and evidence identity independently of later caller edits and reused display IDs', () => {
    const original = fixtures.get('transfer')!, campaign = structuredClone(original.campaign), result = structuredClone(original.result);
    result.provenance = 'imported-supplied-evidence';
    const walkthrough = createResultWalkthrough(campaign, result), before = structuredClone(walkthrough);
    campaign.candidates[0].label = 'Edited later';
    campaign.candidates[0].design.equipment!.economics.unitCostScale = 7;
    result.evaluations[0].rankingCostUSD += 12345;
    expect(walkthrough).toEqual(before);
    expect(walkthrough.result.provenance).toBe('imported-supplied-evidence');
    expect(walkthrough.summary.provenance).toBe('imported-supplied-evidence');
    const priced = updateEconomicAssumptions(walkthrough.run.design, { unitCostScale: 2 });
    expect(walkthroughSourceIdentity(priced, walkthrough.evidence.state)).toBe(walkthroughSourceIdentity(walkthrough.run.design, walkthrough.evidence.state));
    const replaced = structuredClone(original.result);
    replaced.runs.find(run => run.id === walkthrough.run.id)!.state!.experiment!.metrics.shortfallAcceleratorS += 1;
    expect(createResultWalkthrough(original.campaign, replaced).evidenceIdentity).not.toBe(createResultWalkthrough(original.campaign, original.result).evidenceIdentity);
    expect(walkthroughSourceIdentity(walkthrough.run.design, replaced.runs.find(run => run.id === walkthrough.run.id)!.state)).not.toBe(walkthroughSourceIdentity(walkthrough.run.design, walkthrough.evidence.state));
  });
});
