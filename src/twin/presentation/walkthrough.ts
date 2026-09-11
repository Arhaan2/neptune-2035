import type { DecisionCampaign, DecisionResult, PlannedDecisionRun, DecisionRunEvidence } from '../decision/types';
import { resolveAsset } from '../assets/design';
import { experimentRecoveryReport } from '../experiment/report';
import { operatorEvents } from './history';
import { engineeringIdentity } from '../catalog/equipment';
import { identity } from '../persistence/structure';
import type { Design, SimulationState } from '../types';

export interface WalkthroughStep { id: string; title: string; explanation: string; assetId: string; timeS: number; eventId: string | null; workspace: 'Operate' | 'Compare'; boundary: 'post' | 'at-or-after' }
export interface WalkthroughDefinition { run: PlannedDecisionRun; evidence: DecisionRunEvidence & { state: NonNullable<DecisionRunEvidence['state']> }; campaign: DecisionCampaign; result: DecisionResult; steps: WalkthroughStep[] }
const amount = (value: number | null | undefined, unit: string) => value == null ? `unavailable ${unit}` : `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} ${unit}`;

/** Guidance belongs to one complete evidence state, not just a reusable definition ID. */
export function walkthroughSourceIdentity(design: Design, state: SimulationState | null): string | null {
  if (!state) return null;
  const { solverMs: _solverMs, ...evidence } = state;
  return identity({ design: engineeringIdentity(design), evidence });
}

/** Select from actual completed evidence. No fixture winner, timestamp or numerical outcome is encoded here. */
export function createResultWalkthrough(campaign: DecisionCampaign, result: DecisionResult): WalkthroughDefinition {
  if (result.status !== 'completed' || !result.ranking.scopeComplete || result.campaignIdentity !== result.plan.campaignIdentity) throw Error('A walkthrough requires a complete evaluated campaign; incomplete results are not a final recommendation.');
  const completed = result.runs.filter(item => item.status === 'completed' && item.state?.experiment && item.sensitivityId === 'central');
  const noBenefitScenario = campaign.scenarios.find(item => item.kind === 'receiving-bus' || item.kind === 'common-source');
  const enabled = (item: DecisionRunEvidence) => result.plan.runs.find(run => run.id === item.id)?.design.transfer?.enabled;
  const selected = (noBenefitScenario && completed.find(item => item.scenarioId === noBenefitScenario.id && enabled(item)))
    || completed.find(item => item.state!.transfer?.transitions.some(transition => transition.reason === 'TRANSFERRED') && result.ranking.winnerIds.includes(item.candidateId))
    || completed.find(item => result.ranking.winnerIds.includes(item.candidateId)) || completed[0];
  const run = selected && result.plan.runs.find(item => item.id === selected.id);
  if (!selected?.state || !run) throw Error('Completed scenario evidence is unavailable for this campaign.');
  const state = selected.state, events = operatorEvents(state), fault = events.find(event => event.kind === 'Simulated trip' || event.kind === 'Simulated maintenance');
  const transition = state.transfer?.transitions.find(item => item.reason === 'TRANSFERRED') ?? state.transfer?.transitions.at(-1);
  const route = run.design.transfer?.routes.find(item => item.id === transition?.id);
  const affectedModule = run.design.modules.find(module => module.platformId === route?.recipientPlatformId) ?? run.design.modules.find(module => fault?.affectedAssetIds.includes(module.id)) ?? run.design.modules[0];
  const pumpId = `${affectedModule.id}/pump-duty`, steps: WalkthroughStep[] = [];
  const add = (id: string, title: string, explanation: string, assetId: string, timeS: number, eventId: string | null = null, workspace: 'Operate' | 'Compare' = 'Operate', boundary: WalkthroughStep['boundary'] = 'post') => { if (resolveAsset(run.design, assetId) && timeS >= 0 && timeS <= state.timeS) steps.push({ id, title, explanation, assetId, timeS, eventId, workspace, boundary }); };
  add('installed', 'Inspect the installed equipment', `This is the actual pump slot in ${affectedModule.id}. The inspector shows its installed specification and module-equivalent flow, pressure, electrical dependencies and separate fluid circuits. This walkthrough loaded ${run.id} from the completed campaign and preserved the previous project in saved scenarios.`, pumpId, 0);
  if (fault) {
    add('fault', 'Identify the initiating disturbance', `${fault.kind}: ${fault.assetId}. ${fault.reason} Recorded affected domains: ${fault.affectedAssetIds.join(', ')}. The selected failed equipment keeps its fault indication and separate selection outline.`, fault.assetId, fault.timeS, fault.id);
    add('downstream', 'Inspect the downstream service effect', `Inspect ${affectedModule.id} at the same post-event boundary. The model records affected domains; downstream unavailability does not mean every component physically failed. Module service, coolant and pump status are resolved from this boundary.`, pumpId, fault.timeS, fault.id);
  }
  if (transition) {
    const eventId = `transfer:${transition.transitionId}`;
    add('controller', 'Inspect the controller action', `${transition.previous} → ${transition.status}: ${transition.reason}. Original path is ${transition.originalClosed ? 'closed' : 'open'} and tie is ${transition.tieClosed ? 'closed' : 'open'} in this transition record. The scene shows the final state after all same-time transitions.`, route?.tieId ?? pumpId, transition.timeS, eventId);
    add('capacity', 'Inspect the bounded transfer decision', `Whole-platform electrical admission ${amount(transition.admittedW, 'W')}; unserved ${amount(transition.unservedW, 'W')}; decision headroom ${amount(transition.headroomW, 'W')}; binding resource ${transition.bindingResourceId ?? 'none recorded'}. These are actual controller records. Native demand, donor equipment and the shared shore source remain capacity constraints; a receiving-bus or common-source fault cannot be repaired by changing the feeder.`, transition.bindingResourceId && resolveAsset(run.design, transition.bindingResourceId) ? transition.bindingResourceId : route?.donorBusId ?? pumpId, transition.timeS, eventId);
  }
  const recovery = experimentRecoveryReport(state), origin = state.experiment?.originTimeS ?? 0;
  if (recovery?.onsetTimeS != null) add('onset', 'Locate restoration onset', `Recovery predicates first qualify at evaluation time ${amount(recovery.onsetTimeS, 's')}. This is an onset candidate; it is not sustained recovery confirmation. Required continuous dwell is ${amount(run.definition.recovery.dwellS, 's')}.`, pumpId, origin + recovery.onsetTimeS);
  if (recovery?.confirmationTimeS != null) add('confirmation', 'Verify sustained recovery', `The accumulated metric confirms continuous useful-service and thermal recovery at evaluation time ${amount(recovery.confirmationTimeS, 's')}. Fault-relative confirmation latency is ${amount(recovery.confirmationFromEventS, 's')}. A dwell confirmation can occur within a dispatched interval: the scene resolves the first canonical boundary at or after this metric marker and names its actual time separately. It does not fabricate an intermediate physical state.`, pumpId, origin + recovery.confirmationTimeS, null, 'Operate', 'at-or-after');
  if (fault && recovery?.confirmationTimeS == null) add('unrecovered', 'Check the recovery limit honestly', `Recovery status: ${recovery?.status ?? 'unavailable'}. No sustained recovery confirmation is recorded during the completed observation. A completed unsuccessful scenario is not a numerical solver failure.`, pumpId, state.timeS);
  const rows = result.evaluations.filter(item => item.sensitivityId === 'central');
  add('decision', 'Explain the complete evaluated decision', `${result.ranking.status}. ${result.ranking.winnerIds.length ? `Preferred evaluated candidates: ${result.ranking.winnerIds.map(id => campaign.candidates.find(item => item.id === id)?.label ?? id).join('; ')}.` : 'No evaluated candidate meets the declared complete suite.'} ${rows.map(row => `${campaign.candidates.find(item => item.id === row.candidateId)?.label ?? row.candidateId}: ${row.feasibility}, included cost ${amount(row.rankingCostUSD, 'USD')}, worst unmet ${amount(row.worst.shortfallAcceleratorS, 'accelerator-s')}, total interruption ${amount(row.worst.totalInterruptionS, 's')}`).join('; ')}. Cost excludes the unassessed items listed in Compare.`, pumpId, state.timeS, null, 'Compare');
  return { run, evidence: { ...selected, state }, campaign, result, steps };
}
