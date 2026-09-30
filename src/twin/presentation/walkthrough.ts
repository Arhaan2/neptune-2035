import type { DecisionCampaign, DecisionResult, PlannedDecisionRun, DecisionRunEvidence, CandidateEvaluation, DecisionRanking } from '../decision/types';
import { connectionsForModule, resolveAsset } from '../assets/design';
import { decisionCampaignIdentity } from '../decision/contract';
import { experimentRecoveryReport } from '../experiment/report';
import { operatorEvents, type OperatorEvent } from './history';
import { engineeringIdentity } from '../catalog/equipment';
import { identity } from '../persistence/structure';
import type { Design, SimulationState } from '../types';
import type { TransferTransition } from '../transfer/types';
import type { ExperimentRun } from '../experiment/types';
import { getVisualKitBinding, type VisualKitKind } from '../../scene/visuals/kitContract';

export type WalkthroughShotKind = 'campus' | 'cooling' | 'equipment' | 'fault' | 'response' | 'summary';
export interface WalkthroughShot {
  id: string; stepId: string; kind: WalkthroughShotKind; assetId: string;
  title: string; caption: string; transitionMs: number; dwellMs: number;
  /** Compatibility is established from installed specifications and canonical routes. Loading is a separate readiness condition. */
  authoredKind: VisualKitKind | null;
}
export type WalkthroughBindingResource =
  | { kind: 'asset'; resourceId: string; assetId: string }
  | { kind: 'port'; resourceId: string; assetId: string; portId: string }
  | { kind: 'connection'; resourceId: string; assetId: string; connectionId: string; fromAssetId: string; toAssetId: string }
  | { kind: 'module-distribution'; resourceId: string; assetId: string; routeId: string; platformId: string; moduleIds: string[] }
  | { kind: 'unavailable'; resourceId: string; assetId: null };

/** Resource identifiers belong to the transfer model, not the asset namespace.
 * Compare complete generated identities so delimiters inside canonical IDs
 * cannot be mistaken for a resource owner. No engineering limit is recalculated. */
export function walkthroughBindingResource(design: Design, resourceId: string | null): WalkthroughBindingResource | null {
  if (resourceId === null) return null;
  for (const asset of design.assets) {
    if (resourceId === `asset:${asset.id}`) return { kind: 'asset', resourceId, assetId: asset.id };
    for (const port of asset.ports) {
      if (port.medium === 'power' && resourceId === `port:${asset.id}:${port.id}`) return { kind: 'port', resourceId, assetId: asset.id, portId: port.id };
    }
  }
  for (const connection of design.connections) {
    if (connection.medium === 'power' && resourceId === `edge:${connection.id}`) return { kind: 'connection', resourceId, assetId: connection.from, connectionId: connection.id, fromAssetId: connection.from, toAssetId: connection.to };
  }
  for (const route of design.transfer?.routes ?? []) {
    if (resourceId === `bundle:${route.id}:module-distribution`) return { kind: 'module-distribution', resourceId, assetId: route.receivingBusId, routeId: route.id, platformId: route.recipientPlatformId, moduleIds: design.modules.filter(module => module.platformId === route.recipientPlatformId).map(module => module.id) };
  }
  return { kind: 'unavailable', resourceId, assetId: null };
}

export type WalkthroughStepSource =
  | { kind: 'evaluation-start'; timeS: number; checkpointTimeS: number; initialStateIdentity: string }
  | { kind: 'recorded-event'; event: OperatorEvent }
  | { kind: 'controller-transition'; transition: TransferTransition; bindingResource?: WalkthroughBindingResource | null }
  | { kind: 'recovery-marker'; marker: 'onset' | 'confirmation'; evaluationTimeS: number; originTimeS: number; dwellS: number }
  | { kind: 'recovery-limit'; recovery: NonNullable<ReturnType<typeof experimentRecoveryReport>> }
  | { kind: 'campaign-decision'; ranking: DecisionRanking; evaluations: CandidateEvaluation[] };
export interface WalkthroughStep {
  id: string; title: string; explanation: string; assetId: string; timeS: number;
  eventId: string | null; workspace: 'Operate' | 'Compare'; boundary: 'post' | 'at-or-after';
  chapter: string; caption: string; source: WalkthroughStepSource; shots: WalkthroughShot[];
}
export interface WalkthroughPresentationShot extends WalkthroughShot {
  stepIndex: number; chapter: string; timeS: number; eventId: string | null;
  workspace: WalkthroughStep['workspace']; boundary: WalkthroughStep['boundary'];
}
export interface WalkthroughDesignSummary {
  candidateId: string; candidateLabel: string; scenarioId: string; scenarioLabel: string;
  revision: string; engineeringIdentity: string; requestedAccelerators: number; provisionedAccelerators: number;
  modules: number; platforms: number; nodes: number; racks: number; installedPeakITW: number; initialTimeS: number;
}
export interface WalkthroughSummary {
  headline: string; caption: string; scenarioLabel: string; scenarioOutcome: ExperimentRun['evaluation']['outcome'];
  scenarioReasons: string[]; recoveryStatus: NonNullable<ReturnType<typeof experimentRecoveryReport>>['status'];
  shortfallAcceleratorS: number; totalInterruptionS: number; interruptionCount: number;
  incrementalShortfallAcceleratorS: number | null; observationS: number;
  decisionStatus: DecisionRanking['status']; preferredCandidates: { id: string; label: string; rankingCostUSD: number | null }[];
  tied: boolean; scope: { candidates: number; scenarios: number; sensitivities: number; completedRuns: number; plannedRuns: number };
  objective: DecisionCampaign['objective']; exclusions: string[]; provenance: DecisionResult['provenance'];
}
export interface WalkthroughDefinition {
  run: PlannedDecisionRun; evidence: DecisionRunEvidence & { state: NonNullable<DecisionRunEvidence['state']> };
  campaign: DecisionCampaign; result: DecisionResult; steps: WalkthroughStep[];
  /** Captured complete result, including prices/provenance. Display IDs alone cannot identify a narrative. */
  evidenceIdentity: string; designSummary: WalkthroughDesignSummary; summary: WalkthroughSummary;
}
const amount = (value: number | null | undefined, unit: string) => value == null ? `unavailable ${unit}` : `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${unit}`;

/** Guidance belongs to one complete evidence state, not just a reusable definition ID. */
export function walkthroughSourceIdentity(design: Design, state: SimulationState | null): string | null {
  if (!state) return null;
  const { solverMs: _solverMs, ...evidence } = state;
  return identity({ design: engineeringIdentity(design), evidence });
}

/** Presentation subshots reuse their semantic step's exact history request, never another physical timeline. */
export function walkthroughShots(walkthrough: WalkthroughDefinition): WalkthroughPresentationShot[] {
  return walkthrough.steps.flatMap((step, stepIndex) => step.shots.map(shot => ({ ...shot, stepIndex, chapter: step.chapter, timeS: step.timeS, eventId: step.eventId, workspace: step.workspace, boundary: step.boundary })));
}

/** Select from actual completed evidence. No fixture winner, timestamp or numerical outcome is encoded here. */
export function createResultWalkthrough(inputCampaign: DecisionCampaign, inputResult: DecisionResult): WalkthroughDefinition {
  if (inputResult.status !== 'completed' || !inputResult.ranking.scopeComplete || inputResult.campaignIdentity !== inputResult.plan.campaignIdentity || inputResult.campaignIdentity !== decisionCampaignIdentity(inputCampaign) ||
      inputResult.coverage.completed !== inputResult.coverage.planned || inputResult.coverage.planned !== inputResult.plan.totalRuns || inputResult.runs.length !== inputResult.plan.totalRuns ||
      new Set(inputResult.runs.map(item => item.id)).size !== inputResult.runs.length ||
      inputResult.runs.some(item => item.status !== 'completed' || item.state?.experiment?.status !== 'completed') ||
      inputResult.evaluations.some(item => item.execution !== 'completed' || item.feasibility === 'unresolved') ||
      !['recommended', 'no-feasible-evaluated-candidate', 'no-admissible-candidates'].includes(inputResult.ranking.status)) {
    throw Error('A walkthrough requires a complete evaluated campaign; incomplete results are not a final recommendation.');
  }
  // Narration owns a capture, not a live reference to mutable Compare controls or future price edits.
  const campaign = structuredClone(inputCampaign), result = structuredClone(inputResult);
  const evidenceIdentity = identity({ campaign, result });
  const completed = result.runs.filter(item => item.status === 'completed' && item.state?.experiment && item.sensitivityId === 'central');
  const noBenefitScenario = campaign.scenarios.find(item => item.kind === 'receiving-bus' || item.kind === 'common-source');
  const enabled = (item: DecisionRunEvidence) => result.plan.runs.find(run => run.id === item.id)?.design.transfer?.enabled;
  const selected = (noBenefitScenario && completed.find(item => item.scenarioId === noBenefitScenario.id && enabled(item)))
    || completed.find(item => item.state!.transfer?.transitions.some(transition => transition.reason === 'TRANSFERRED') && result.ranking.winnerIds.includes(item.candidateId))
    || completed.find(item => result.ranking.winnerIds.includes(item.candidateId))
    || completed.find(item => item.state!.transfer?.transitions.some(transition => transition.reason === 'TRANSFERRED'))
    || completed.find(item => enabled(item) && campaign.scenarios.find(scenario => scenario.id === item.scenarioId)?.disturbanceTimeS != null)
    || completed.find(item => item.state!.events.some(event => ['trip', 'maintenance'].includes(event.kind))) || completed[0];
  const run = selected && result.plan.runs.find(item => item.id === selected.id);
  if (!selected?.state?.experiment || !run) throw Error('Completed scenario evidence is unavailable for this campaign.');
  const state = selected.state, experiment = state.experiment!, events = operatorEvents(state);
  const fault = events.find(event => event.kind === 'Simulated trip' || event.kind === 'Simulated maintenance');
  const transition = state.transfer?.transitions.find(item => item.reason === 'TRANSFERRED') ?? state.transfer?.transitions.at(-1);
  const route = run.design.transfer?.routes.find(item => item.id === transition?.id);
  const affectedModule = run.design.modules.find(module => module.platformId === route?.recipientPlatformId)
    ?? run.design.modules.find(module => fault?.affectedAssetIds.some(id => id === module.id || id.startsWith(`${module.id}/`) || id === module.powerDomainId || id === module.networkDomainId))
    ?? run.design.modules[0];
  if (!affectedModule) throw Error('Completed scenario has no installed module to inspect.');
  const pumpId = `${affectedModule.id}/pump-duty`, initialTimeS = experiment.originTimeS;
  if (initialTimeS === null) throw Error('A completed walkthrough requires its recorded evaluation origin.');
  const candidateLabel = campaign.candidates.find(item => item.id === run.candidateId)?.label ?? run.candidateId;
  const scenarioLabel = campaign.scenarios.find(item => item.id === run.scenarioId)?.label ?? run.scenarioId;
  const designSummary: WalkthroughDesignSummary = {
    candidateId: run.candidateId, candidateLabel, scenarioId: run.scenarioId, scenarioLabel,
    revision: run.design.revision, engineeringIdentity: engineeringIdentity(run.design), requestedAccelerators: run.design.config.requestedAccelerators,
    provisionedAccelerators: run.design.provisionedAccelerators, modules: run.design.modules.length,
    platforms: run.design.assets.filter(asset => asset.type === 'platform').length, nodes: run.design.nodeCount, racks: run.design.rackCount,
    installedPeakITW: run.design.installedPeakITW, initialTimeS,
  };
  const moduleConnections = connectionsForModule(run.design, affectedModule.id);
  const authoredKind = (assetId: string) => {
    const asset = resolveAsset(run.design, assetId);
    return asset ? getVisualKitBinding(asset, moduleConnections)?.kind ?? null : null;
  };
  const shot = (stepId: string, kind: WalkthroughShotKind, assetId: string, title: string, caption: string, dwellMs = 3500, suffix = ''): WalkthroughShot => ({
    id: suffix ? `${stepId}:${suffix}` : stepId, stepId, kind, assetId, title, caption, transitionMs: 1600, dwellMs,
    authoredKind: ['cooling', 'equipment'].includes(kind) ? authoredKind(assetId) : null,
  });
  const steps: WalkthroughStep[] = [];
  const add = (step: WalkthroughStep) => {
    if (resolveAsset(run.design, step.assetId) && Number.isFinite(step.timeS) && step.timeS >= initialTimeS && step.timeS <= state.timeS) steps.push(step);
  };
  const openingCaption = `${candidateLabel}: ${amount(designSummary.provisionedAccelerators, 'installed accelerators')} across ${designSummary.modules} modules and ${designSummary.platforms} platforms. This is the evaluated design, at its recorded initial boundary.`;
  const systemsCaption = `Power, cooling and networking jointly constrain useful service in ${affectedModule.id}. Inspect its installed pump and the separate technical-coolant and seawater circuits.`;
  const installedShots = [shot('installed', 'campus', pumpId, 'The evaluated design', openingCaption, 3000, 'campus'), shot('installed', 'cooling', pumpId, 'Reveal the cooling system', systemsCaption, 2800, 'pump')];
  // Only compatible, installed authored assets receive a detail subshot. Ordinary procedural inspection remains available.
  const exchangerId = `${affectedModule.id}/hx`, cduId = `${affectedModule.id}/cdu`;
  if (authoredKind(exchangerId) === 'exchanger') installedShots.push(shot('installed', 'equipment', exchangerId, 'Separate fluid circuits', 'The installed exchanger transfers modeled heat between two separate circuits. Seawater stays on its own side; it never becomes a path to compute equipment.', 2600, 'exchanger'));
  if (authoredKind(cduId) === 'cdu') installedShots.push(shot('installed', 'equipment', cduId, 'Distribution to the racks', 'The installed CDU belongs to the technical cooling loop. Its authored exterior represents the same catalog equipment; the recorded model still owns service and temperature.', 2800, 'cdu'));
  add({ id: 'installed', title: 'Inspect the installed equipment', explanation: `This is the actual pump slot in ${affectedModule.id}. The inspector shows its installed specification and module-equivalent flow, pressure, electrical dependencies and separate fluid circuits. This walkthrough loaded ${run.id} from the completed campaign and preserved the previous project in saved scenarios.`, assetId: pumpId, timeS: initialTimeS, eventId: null, workspace: 'Operate', boundary: 'post', chapter: 'Evaluated design', caption: openingCaption, source: { kind: 'evaluation-start', timeS: initialTimeS, checkpointTimeS: experiment.initialState.timeS, initialStateIdentity: experiment.initialStateIdentity }, shots: installedShots });
  if (fault) {
    const caption = `${fault.kind} at ${fault.assetId}, recorded at ${amount(fault.timeS, 's')}. The highlighted dependency path identifies the affected domain; selection and equipment fault remain distinct.`;
    add({ id: 'fault', title: 'Identify the initiating disturbance', explanation: `${fault.kind}: ${fault.assetId}. ${fault.reason} Recorded affected domains: ${fault.affectedAssetIds.join(', ')}. The selection outline remains separate from canonical equipment state; any same-time restoration is reflected in the scene.`, assetId: fault.assetId, timeS: fault.timeS, eventId: fault.id, workspace: 'Operate', boundary: 'post', chapter: 'Disturbance', caption, source: { kind: 'recorded-event', event: fault }, shots: [shot('fault', 'fault', fault.assetId, 'Locate the disturbance', caption)] });
    const downstreamCaption = `Inspect useful service in ${affectedModule.id} at the same resolved boundary. Loss of an upstream dependency can interrupt service without physically failing every downstream component.`;
    add({ id: 'downstream', title: 'Inspect the downstream service effect', explanation: `Inspect ${affectedModule.id} at the same post-event boundary. The model records affected domains; downstream unavailability does not mean every component physically failed. Module service, coolant and pump status are resolved from this boundary.`, assetId: pumpId, timeS: fault.timeS, eventId: fault.id, workspace: 'Operate', boundary: 'post', chapter: 'Service consequence', caption: downstreamCaption, source: { kind: 'recorded-event', event: fault }, shots: [shot('downstream', 'cooling', pumpId, 'Inspect useful service', downstreamCaption)] });
  }
  if (transition) {
    const eventId = `transfer:${transition.transitionId}`, controllerAsset = route?.tieId ?? pumpId;
    const caption = `${transition.previous} → ${transition.status}: ${transition.reason}. This transition records the controller response; the scene shows the final state after every event at the same timestamp.`;
    add({ id: 'controller', title: 'Inspect the controller action', explanation: `${transition.previous} → ${transition.status}: ${transition.reason}. Original path is ${transition.originalClosed ? 'closed' : 'open'} and tie is ${transition.tieClosed ? 'closed' : 'open'} in this transition record. The scene shows the final state after all same-time transitions.`, assetId: controllerAsset, timeS: transition.timeS, eventId, workspace: 'Operate', boundary: 'post', chapter: 'Recorded response', caption, source: { kind: 'controller-transition', transition }, shots: [shot('controller', 'response', controllerAsset, 'The recorded controller action', caption)] });
    const bindingResource = walkthroughBindingResource(run.design, transition.bindingResourceId);
    const capacityAsset = bindingResource?.assetId ?? (bindingResource ? route?.receivingBusId : route?.donorBusId) ?? pumpId;
    const bindingContext = bindingResource?.kind === 'module-distribution' ? 'This is a grouped module-distribution constraint; the receiving bus supplies scene context, not a uniquely identified limiting component.'
      : bindingResource?.kind === 'connection' ? `The scene selects the recorded connection's upstream endpoint ${bindingResource.fromAssetId}; its incident path retains the displayed switch state.`
      : bindingResource?.kind === 'port' ? `The scene selects port owner ${bindingResource.assetId}; the constrained interface is ${bindingResource.portId}.`
      : bindingResource?.kind === 'asset' ? `The scene selects the recorded constrained asset ${bindingResource.assetId}.`
      : bindingResource?.kind === 'unavailable' ? 'The resource owner is unavailable; the receiving-domain view is context only.'
      : 'No binding resource is recorded; the donor supply view supplies context.';
    const capacityCaption = `${amount(transition.admittedW, 'W')} admitted; ${amount(transition.unservedW, 'W')} unserved. Recorded headroom is ${amount(transition.headroomW, 'W')}; ${transition.bindingResourceId ? `binding resource: ${transition.bindingResourceId}` : 'no binding resource is recorded'}.${bindingResource?.kind === 'module-distribution' ? ' Group constraint; receiving bus shown for context.' : bindingResource?.kind === 'unavailable' ? ' Resource owner unavailable; domain context shown.' : ' Shared-source limits still apply.'}`;
    add({ id: 'capacity', title: 'Inspect the bounded transfer decision', explanation: `Whole-platform electrical admission ${amount(transition.admittedW, 'W')}; unserved ${amount(transition.unservedW, 'W')}; decision headroom ${amount(transition.headroomW, 'W')}; binding resource ${transition.bindingResourceId ?? 'none recorded'}. These are actual controller records. ${bindingContext} Native demand, donor equipment and the shared shore source remain capacity constraints; a receiving-bus or common-source fault cannot be repaired by changing the feeder.`, assetId: capacityAsset, timeS: transition.timeS, eventId, workspace: 'Operate', boundary: 'post', chapter: 'Capacity limit', caption: capacityCaption, source: { kind: 'controller-transition', transition, bindingResource }, shots: [shot('capacity', 'response', capacityAsset, 'Admission stays within limits', capacityCaption)] });
  }
  const recovery = experimentRecoveryReport(state)!, origin = experiment.originTimeS;
  if (origin === null) throw Error('A completed walkthrough requires its recorded evaluation origin.');
  if (recovery.onsetTimeS != null) {
    const caption = `Recovery predicates first qualify at evaluation time ${amount(recovery.onsetTimeS, 's')}. Onset and confirmation are separate evidence fields; the required continuous dwell is ${amount(run.definition.recovery.dwellS, 's')}.`;
    add({ id: 'onset', title: 'Locate restoration onset', explanation: `Recovery predicates first qualify at evaluation time ${amount(recovery.onsetTimeS, 's')}. This is an onset candidate; it is not sustained recovery confirmation. Required continuous dwell is ${amount(run.definition.recovery.dwellS, 's')}.`, assetId: pumpId, timeS: origin + recovery.onsetTimeS, eventId: null, workspace: 'Operate', boundary: 'post', chapter: 'Restoration onset', caption, source: { kind: 'recovery-marker', marker: 'onset', evaluationTimeS: recovery.onsetTimeS, originTimeS: origin, dwellS: run.definition.recovery.dwellS }, shots: [shot('onset', 'cooling', pumpId, 'Onset is not confirmation', caption)] });
  }
  if (recovery.confirmationTimeS != null) {
    const caption = `Continuous recovery is confirmed at evaluation marker ${amount(recovery.confirmationTimeS, 's')}. The displayed scene uses the first actual canonical boundary at or after that marker, shown separately.`;
    add({ id: 'confirmation', title: 'Verify sustained recovery', explanation: `The accumulated metric confirms continuous useful-service and thermal recovery at evaluation time ${amount(recovery.confirmationTimeS, 's')}. Fault-relative confirmation latency is ${amount(recovery.confirmationFromEventS, 's')}. A dwell confirmation can occur within a dispatched interval: the scene resolves the first canonical boundary at or after this metric marker and names its actual time separately. It does not fabricate an intermediate physical state.`, assetId: pumpId, timeS: origin + recovery.confirmationTimeS, eventId: null, workspace: 'Operate', boundary: 'at-or-after', chapter: 'Dwell confirmation', caption, source: { kind: 'recovery-marker', marker: 'confirmation', evaluationTimeS: recovery.confirmationTimeS, originTimeS: origin, dwellS: run.definition.recovery.dwellS }, shots: [shot('confirmation', 'cooling', pumpId, 'Verify sustained recovery', caption)] });
  }
  if (fault && recovery.confirmationTimeS == null) {
    const limit = transition?.reason === 'COMMON_SOURCE_FAILED' ? 'The transfer shares the failed upstream source; it supplies no independent source.'
      : transition?.reason === 'RECEIVING_BUS_FAILED' ? 'Changing feeders cannot repair the recorded receiving-bus failure.'
      : recovery.onsetTimeS != null ? 'Restoration onset does not establish that the required continuous dwell completed.'
      : 'The recorded service and thermal conditions did not establish sustained recovery.';
    const caption = `Recovery status: ${recovery.status}. The completed observation contains no sustained confirmation. ${limit}`;
    add({ id: 'unrecovered', title: 'Check the recovery limit honestly', explanation: `Recovery status: ${recovery.status}. No sustained recovery confirmation is recorded during the completed observation. A completed unsuccessful scenario is not a numerical solver failure.`, assetId: pumpId, timeS: state.timeS, eventId: null, workspace: 'Operate', boundary: 'post', chapter: 'Recovery limit', caption, source: { kind: 'recovery-limit', recovery }, shots: [shot('unrecovered', 'cooling', pumpId, 'No confirmed recovery', caption)] });
  }
  const rows = result.evaluations.filter(item => item.sensitivityId === 'central');
  const preferredCandidates = result.ranking.winnerIds.map(id => ({ id, label: campaign.candidates.find(item => item.id === id)?.label ?? id, rankingCostUSD: rows.find(row => row.candidateId === id)?.rankingCostUSD ?? null }));
  const tied = preferredCandidates.length > 1;
  const headline = !preferredCandidates.length ? 'No feasible evaluated candidate' : tied ? 'Preferred candidates remain tied' : 'Preferred under the evaluated scope';
  const decisionCaption = `${experiment.evaluation.outcome} for this scenario: ${amount(experiment.metrics.serviceViolationS, 's')} total interruption and ${amount(experiment.metrics.shortfallAcceleratorS, 'accelerator-s')} unmet service. ${!preferredCandidates.length ? 'No feasible evaluated candidate.' : tied ? 'The evaluated preference remains tied.' : 'Campaign preference applies only to its declared requirements.'}`;
  const summary: WalkthroughSummary = { headline, caption: decisionCaption, scenarioLabel, scenarioOutcome: experiment.evaluation.outcome, scenarioReasons: [...experiment.evaluation.reasons], recoveryStatus: recovery.status,
    shortfallAcceleratorS: experiment.metrics.shortfallAcceleratorS, totalInterruptionS: experiment.metrics.serviceViolationS, interruptionCount: experiment.metrics.interruptionCount, incrementalShortfallAcceleratorS: selected.incrementalShortfallAcceleratorS, observationS: experiment.metrics.elapsedS,
    decisionStatus: result.ranking.status, preferredCandidates, tied, scope: { candidates: campaign.candidates.length, scenarios: campaign.scenarios.length, sensitivities: campaign.sensitivities.length, completedRuns: result.coverage.completed, plannedRuns: result.coverage.planned }, objective: structuredClone(campaign.objective), exclusions: [...campaign.exclusions], provenance: result.provenance };
  add({ id: 'decision', title: 'Explain the complete evaluated decision', explanation: `${result.ranking.status}. ${result.ranking.winnerIds.length ? `Preferred evaluated candidates: ${preferredCandidates.map(item => item.label).join('; ')}.` : 'No evaluated candidate meets the declared complete suite.'} ${rows.map(row => `${campaign.candidates.find(item => item.id === row.candidateId)?.label ?? row.candidateId}: ${row.feasibility}, included cost ${amount(row.rankingCostUSD, 'USD')}, worst unmet ${amount(row.worst.shortfallAcceleratorS, 'accelerator-s')}, total interruption ${amount(row.worst.totalInterruptionS, 's')}`).join('; ')}. Cost excludes the unassessed items listed in Compare.`, assetId: pumpId, timeS: state.timeS, eventId: null, workspace: 'Compare', boundary: 'post', chapter: 'Evaluated decision', caption: decisionCaption, source: { kind: 'campaign-decision', ranking: result.ranking, evaluations: rows }, shots: [shot('decision', 'summary', pumpId, headline, decisionCaption, 4000)] });
  return { run, evidence: { ...selected, state }, campaign, result, steps, evidenceIdentity, designSummary, summary };
}
