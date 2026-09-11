import { billOfEquipment } from '../analysis/reports';
import { applyDecisionSensitivity } from './sensitivity';
import type { CandidateEvaluation, DecisionCampaign, DecisionRanking, DecisionRunEvidence, RequirementEvaluation } from './types';

export function evaluateRequirement(input:Omit<RequirementEvaluation,'margin'|'status'>,nearBindingFraction=0.01):RequirementEvaluation {
  const actual=input.actual!==null&&Number.isFinite(input.actual)?input.actual:null,margin=actual===null?null:input.operator==='='?-Math.abs(input.threshold-actual):input.threshold-actual;
  const status=margin===null?'unavailable':margin < -input.tolerance?'violated':margin<=Math.max(input.tolerance,Math.abs(input.threshold)*nearBindingFraction)?'binding':'satisfied';
  return {...input,actual,margin,status};
}
function executionOf(runs:DecisionRunEvidence[],required:number):CandidateEvaluation['execution'] {
  for(const status of ['invalid','unsupported','numerical-failure','resource-limited','cancelled'] as const)if(runs.some(r=>r.status===status))return status;
  return runs.length===required&&runs.every(r=>r.status==='completed')?'completed':'incomplete';
}
export function evaluateCandidate(campaign:DecisionCampaign,candidateId:string,allRuns:DecisionRunEvidence[],sensitivityId='central'):CandidateEvaluation {
  const candidate=campaign.candidates.find(c=>c.id===candidateId),sensitivity=campaign.sensitivities.find(s=>s.id===sensitivityId);
  if(!candidate||!sensitivity)throw Error('Unknown candidate or sensitivity.');
  const ids=new Set(campaign.scenarios.map(s=>s.id));const runs=allRuns.filter(r=>r.candidateId===candidateId&&r.sensitivityId===sensitivityId&&ids.has(r.scenarioId));
  if(new Set(runs.map(r=>r.scenarioId)).size!==runs.length)throw Error('Duplicate candidate scenario evidence.');
  const includedCost=billOfEquipment(applyDecisionSensitivity(candidate.design,sensitivity)),centralCost=billOfEquipment(candidate.design);
  const upperCostUSD=centralCost.totalUSD*campaign.costPolicy.equipmentScaleUpper;
  const rankingCostUSD=campaign.objective.rankingCostBasis==='upper-bound'?upperCostUSD:includedCost.totalUSD;
  const budgetCostUSD=campaign.objective.budgetBasis==='upper-bound'?upperCostUSD:includedCost.totalUSD;
  const requirements:RequirementEvaluation[]=[],t=campaign.tolerances,p=campaign.requirements;
  const add=(id:string,actual:number|null,threshold:number,unit:RequirementEvaluation['unit'],tolerance:number,scenarioId:string|null,reason:string,assetIds:string[]=[],timeS:number|null=null,kind:RequirementEvaluation['class']='operating')=>requirements.push(evaluateRequirement({id,class:kind,actual,threshold,unit,tolerance,operator:'<=',scenarioId,sensitivityId,reason,assetIds,timeS},t.nearBindingFraction));
  for(const scenario of campaign.scenarios){
    const run=runs.find(r=>r.scenarioId===scenario.id),metrics=run?.state?.experiment?.metrics;
    const available=!!metrics&&run?.status==='completed'&&run.state?.experiment?.status==='completed'&&metrics.elapsedS===scenario.durationS&&metrics.unavailableS===0;
    const metric=(field:'shortfallAcceleratorS'|'serviceViolationS'|'thermalViolationS')=>available&&Number.isFinite(metrics[field])?metrics[field]:null;
    const fault=scenario.disturbanceTimeS!==null,assets=run?.state?.events.map(e=>e.assetId)??[];
    add('unmet-demand',metric('shortfallAcceleratorS'),fault?p.faultUnmetAcceleratorS:p.nominalUnmetAcceleratorS,'accelerator-s',t.acceleratorSeconds,scenario.id,'Whole-run unmet requested useful service; required network remains enforced.',assets,metrics?.firstServiceViolationS??null);
    add('total-interruption',metric('serviceViolationS'),fault?p.totalInterruptionS:0,'s',t.seconds,scenario.id,'Total interval union of required-service interruption; longest interval is separately reported.',assets,metrics?.firstServiceViolationS??null);
    add('thermal-duration',metric('thermalViolationS'),p.thermalViolationS,'s',t.seconds,scenario.id,'Duration at/above existing bulk coolant or air limits across every module.',[metrics?.maxCoolant?.assetId,metrics?.maxAir?.assetId].filter((v):v is string=>!!v),metrics?.firstThermalViolationS??null);
    if(fault){
      const recovery=run?.recovery;const actual=!available||!recovery?null:recovery.status==='no-qualifying-interruption'?0:recovery.confirmationTimeS;
      add('confirmed-recovery',actual,p.recoveryConfirmationDeadlineS,'s',t.seconds,scenario.id,'Absolute evaluation time of dwell-confirmed useful-service AND thermal recovery, not restoration onset.',assets,actual);
      if(available&&recovery&&actual===null){const requirement=requirements.at(-1)!;requirement.status='violated';requirement.reason=`${recovery.status}: observation does not contain required dwell confirmation; missing confirmation is not zero.`;}
    }
    if(campaign.objective.supplyCeilingW!==null)add('upstream-supply-peak',available&&Number.isFinite(run?.peakSupply?.value)?run!.peakSupply!.value:null,campaign.objective.supplyCeilingW,'W',t.watts,scenario.id,'Maximum canonical upstream dispatch over every interval and boundary, including network/cooling/conversion/standby.', ['shore/grid'],run?.peakSupply?.timeS??null);
    for(const id of ['EL-01','GE-01','NW-03']){const hard=run?.hardConstraints.find(c=>c.id===id);add(id,hard?(hard.status==='satisfied'?0:1):null,0,'boolean',0,scenario.id,hard?.detail??'Required installed model screen unavailable.',hard?.assetId?[hard.assetId]:[],null,'hard-model');}
  }
  add('included-cost-known',includedCost.completeWithinIncludedScope?0:1,0,'boolean',0,null,includedCost.completeWithinIncludedScope?'Every included installed price is known.':`Unknown included prices: ${includedCost.missingCostAssetIds.join(', ')}`,includedCost.missingCostAssetIds,null,'cost');
  if(campaign.objective.budgetUSD!==null)add('included-cost-budget',includedCost.completeWithinIncludedScope?budgetCostUSD:null,campaign.objective.budgetUSD,'USD',t.USD,null,`${campaign.objective.budgetBasis} included-cost budget; equipment, installation, contingency in authoritative order.`,[],null,'cost');
  let execution=executionOf(runs,campaign.scenarios.length);if(execution==='completed'&&requirements.some(r=>r.status==='unavailable'))execution='incomplete';
  const feasibility=execution!=='completed'?'unresolved':requirements.some(r=>r.status==='violated')?'infeasible':'feasible';
  const worstMetric=(field:'shortfallAcceleratorS'|'longestInterruptionS'|'serviceViolationS'|'thermalViolationS')=>runs.length===campaign.scenarios.length&&runs.every(r=>r.status==='completed'&&r.state?.experiment&&Number.isFinite(r.state.experiment.metrics[field]))?Math.max(...runs.map(r=>r.state!.experiment!.metrics[field])):null;
  const recoveryValues=requirements.filter(r=>r.id==='confirmed-recovery');
  return {candidateId,sensitivityId,execution,feasibility,workload:candidate.workload,includedCost,rankingCostUSD,budgetCostUSD,requirements,
    worst:{shortfallAcceleratorS:worstMetric('shortfallAcceleratorS'),longestInterruptionS:worstMetric('longestInterruptionS'),totalInterruptionS:worstMetric('serviceViolationS'),thermalViolationS:worstMetric('thermalViolationS'),recoveryConfirmationS:recoveryValues.length&&recoveryValues.every(r=>r.actual!==null)?Math.max(...recoveryValues.map(r=>r.actual!)):null,peakSupplyW:runs.length===campaign.scenarios.length&&runs.every(r=>r.peakSupply)?Math.max(...runs.map(r=>r.peakSupply!.value)):null},
    reasons:[...requirements.filter(r=>r.status==='violated'||r.status==='unavailable').map(r=>`${r.scenarioId??'cost'} · ${r.id}: ${r.reason}`),...runs.filter(r=>r.reason).map(r=>`${r.scenarioId}: ${r.reason}`)],completedRuns:runs.filter(r=>r.status==='completed').length,requiredRuns:campaign.scenarios.length};
}
export function rankCampaign(campaign:DecisionCampaign,evaluations:CandidateEvaluation[],sensitivityId='central'):DecisionRanking {
  const rows=evaluations.filter(r=>r.sensitivityId===sensitivityId),validIds=new Set(campaign.candidates.map(c=>c.id));
  if(rows.some(r=>!validIds.has(r.candidateId))||new Set(rows.map(r=>r.candidateId)).size!==rows.length)throw Error('Unexpected or duplicate evaluation candidate identity.');
  const feasible=rows.filter(r=>r.feasibility==='feasible'&&r.execution==='completed'&&r.includedCost.completeWithinIncludedScope);
  const objective=(r:CandidateEvaluation)=>campaign.objective.mode==='minimum-included-cost'?r.rankingCostUSD:-r.workload;
  const tolerance=campaign.objective.mode==='minimum-included-cost'?campaign.tolerances.USD:campaign.tolerances.accelerators;
  const ordered=[...feasible].sort((a,b)=>objective(a)-objective(b)||a.candidateId.localeCompare(b.candidateId));
  const groups:CandidateEvaluation[][]=[];for(const row of ordered){const last=groups.at(-1);if(last&&Math.abs(objective(row)-objective(last[0]))<=tolerance)last.push(row);else groups.push([row]);}
  const groupsIds=groups.map(g=>g.map(r=>r.candidateId).sort());
  const unresolvedCandidateIds=campaign.candidates.filter(c=>!rows.some(r=>r.candidateId===c.id&&r.execution==='completed'&&r.feasibility!=='unresolved')).map(c=>c.id).sort();
  const scopeComplete=unresolvedCandidateIds.length===0;
  let status:DecisionRanking['status']=scopeComplete?(feasible.length?'recommended':'no-feasible-evaluated-candidate'):feasible.length?'provisional':'evaluation-incomplete';
  if(!campaign.candidates.length||rows.length===campaign.candidates.length&&rows.every(r=>['invalid','unsupported'].includes(r.execution)))status='no-admissible-candidates';
  else if(rows.length===campaign.candidates.length&&rows.every(r=>r.execution==='numerical-failure'))status='numerical-execution-failed';
  return {status,sensitivityId,winnerIds:groupsIds[0]??[],orderedCandidateIds:groupsIds.flat(),ties:groupsIds.filter(g=>g.length>1),feasibleCandidateIds:feasible.map(r=>r.candidateId).sort(),unresolvedCandidateIds,scopeComplete};
}
