import { initialize, initializeExperimentFromState, advanceWithStep, summarize } from '../engine/simulation';
import { createExperimentDefinition, disturbanceFootprints } from '../experiment/definition';
import { experimentRecoveryReport } from '../experiment/report';
import { experimentFinished, setExperimentStatus } from '../experiment/runtime';
import { constraints } from '../analysis/reports';
import { identity } from '../persistence/structure';
import { diagnosticFor } from '../safety';
import { applyDecisionSensitivity } from './sensitivity';
import { decisionCampaignIdentity, validateDecisionCampaign } from './contract';
import { evaluateCandidate, rankCampaign } from './evaluate';
import { DECISION_VERSION, type DecisionCampaign, type DecisionPlan, type PlannedDecisionRun, type DecisionRunEvidence, type DecisionRunOptions, type DecisionResult } from './types';

export function planDecisionCampaign(campaign:DecisionCampaign):DecisionPlan {
  validateDecisionCampaign(campaign);const runs:PlannedDecisionRun[]=[];
  for(const candidate of campaign.candidates)for(const sensitivity of campaign.sensitivities){
    const design=applyDecisionSensitivity(candidate.design,sensitivity);
    for(const scenario of campaign.scenarios){
      const route=design.transfer?.routes.find(r=>r.recipientPlatformId==='platform-002');const recipient=design.modules.find(m=>m.platformId==='platform-002');
      const assetId=scenario.kind==='common-source'?'shore/grid':scenario.kind==='eligible-feeder'?(route?.originalFeederId??recipient?.powerDomainId):scenario.kind==='receiving-bus'?(route?.receivingBusId??recipient?.powerDomainId):null;
      if(scenario.disturbanceTimeS!==null&&!assetId)throw Error(`Unresolved required disturbance target: ${candidate.id}/${scenario.id}`);
      const id=`${candidate.id}:${sensitivity.id}:${scenario.id}`,baseline=campaign.scenarios.find(s=>s.kind==='nominal'&&s.durationS===scenario.durationS);
      const definition=createExperimentDefinition(design,{id:`p6:${id}`,name:`${candidate.label} · ${scenario.label}`,durationS:scenario.durationS,integrationStepS:campaign.execution.integrationStepS,requiredAccelerators:candidate.workload,disturbances:assetId?[{id:`fault-${scenario.id}`,assetId,kind:'trip',timeS:scenario.disturbanceTimeS!}]:[],initial:{mode:'cold'},recovery:{dwellS:campaign.requirements.recoveryDwellS},note:'Phase6 policy evaluated separately from the preserved Phase4/5 zero-outage success criterion. Actual cold physical checkpoint retained; no settling or long-term adequacy claimed.'});
      const initialized=initialize(design,definition),initialState=initialized.experiment!.initialState;
      runs.push({id,candidateId:candidate.id,scenarioId:scenario.id,sensitivityId:sensitivity.id,baselineId:assetId&&baseline?`${candidate.id}:${sensitivity.id}:${baseline.id}`:null,design,definition,initialState,initialStateIdentity:identity(initialState),footprints:disturbanceFootprints(design,definition)});
    }
  }
  const estimatedModuleSteps=runs.reduce((sum,r)=>sum+r.design.modules.length*r.definition.durationS/campaign.execution.integrationStepS,0);
  if(estimatedModuleSteps>campaign.execution.maxModuleSteps)throw Error(`Campaign needs ${estimatedModuleSteps} module steps, above the declared execution envelope.`);
  return {campaignIdentity:decisionCampaignIdentity(campaign),candidates:campaign.candidates.length,scenarios:campaign.scenarios.length,sensitivities:campaign.sensitivities.length,totalRuns:runs.length,sharedBaselines:runs.filter(r=>r.baselineId).length,estimatedModuleSteps,runs};
}
function baseEvidence(run:PlannedDecisionRun):DecisionRunEvidence{return {id:run.id,candidateId:run.candidateId,scenarioId:run.scenarioId,sensitivityId:run.sensitivityId,status:'incomplete',reason:null,state:null,peakSupply:null,hardConstraints:[],recovery:null,incrementalShortfallAcceleratorS:null};}
const yieldTask=()=>new Promise<void>(resolve=>setTimeout(resolve,0));
/** Canonical engine, exact saved initialization, isolated per call, and every physical dispatch observed. */
export async function executeDecisionRun(run:PlannedDecisionRun,settings:DecisionCampaign['execution'],signal?:AbortSignal):Promise<DecisionRunEvidence> {
  const evidence=baseEvidence(run);let state:DecisionRunEvidence['state']=null;
  const started=performance.now();let work=0;
  try{
    if(identity(run.initialState)!==run.initialStateIdentity)throw Error('Actual initial checkpoint identity mismatch.');
    state=initializeExperimentFromState(run.design,structuredClone(run.initialState),run.definition);evidence.state=state;
    evidence.hardConstraints=constraints(run.design,state).filter(c=>['EL-01','GE-01','NW-03'].includes(c.id));
    if(evidence.hardConstraints.some(c=>c.status==='unsupported')){evidence.status='unsupported';evidence.reason='Unsupported installed topology or required model screen.';return evidence;}
    evidence.peakSupply={value:summarize(run.design,state).gridW,timeS:0,assetId:'shore/grid',samples:1};
    while(!experimentFinished(state)&&state.timeS<run.definition.durationS){
      await yieldTask();if(signal?.aborted){state=setExperimentStatus(state,'cancelled','Decision campaign cancelled.');break;}
      if(work+run.design.modules.length/settings.integrationStepS>settings.maxModuleSteps||performance.now()-started>120000){state=setExperimentStatus(state,'resource-limited','Bounded decision run reached its work or wall-clock limit.');break;}
      state=advanceWithStep(run.design,state,1,[],settings.integrationStepS,observation=>{const peak=evidence.peakSupply!;peak.samples++;if(!Number.isFinite(observation.gridW))throw Error('Nonfinite upstream dispatch observation.');if(observation.gridW>peak.value){peak.value=observation.gridW;peak.timeS=observation.timeS;}});
      work+=run.design.modules.length/settings.integrationStepS;
    }
    evidence.state=state;evidence.recovery=experimentRecoveryReport(state);
    evidence.status=state.experiment?.status==='completed'?'completed':state.experiment?.status==='cancelled'?'cancelled':state.experiment?.status==='resource-limited'?'resource-limited':state.experiment?.status==='numerical-failed'?'numerical-failure':'incomplete';
    evidence.reason=state.experiment?.reason??null;
    const metrics=state.experiment!.metrics;if(metrics.trace.length>settings.traceSamples){const original=metrics.trace;metrics.trace=Array.from({length:settings.traceSamples},(_,i)=>original[Math.round(i*(original.length-1)/(settings.traceSamples-1))]);metrics.traceTruncated=true;}
  }catch(error){const d=diagnosticFor(error);evidence.status=d.kind==='unsupported-configuration'?'unsupported':d.kind==='invalid-input'?'invalid':d.kind==='resource-limit'?'resource-limited':'numerical-failure';evidence.reason=d.message;evidence.state=state;}
  return evidence;
}
export function assembleDecisionResult(campaign:DecisionCampaign,plan:DecisionPlan,runs:DecisionRunEvidence[],cancelled=false):DecisionResult {
  const paired=runs.map(run=>{const planned=plan.runs.find(r=>r.id===run.id),baseline=runs.find(r=>r.id===planned?.baselineId);return {...run,incrementalShortfallAcceleratorS:run.status==='completed'&&baseline?.status==='completed'&&run.state?.experiment&&baseline.state?.experiment?run.state.experiment.metrics.shortfallAcceleratorS-baseline.state.experiment.metrics.shortfallAcceleratorS:null};});
  const evaluations=campaign.sensitivities.flatMap(s=>campaign.candidates.map(c=>evaluateCandidate(campaign,c.id,paired,s.id)));
  const sensitivityRankings=campaign.sensitivities.map(s=>rankCampaign(campaign,evaluations,s.id));
  const ranking={...sensitivityRankings.find(r=>r.sensitivityId==='central')!};
  const completed=paired.filter(r=>r.status==='completed').length,complete=paired.length===plan.totalRuns&&paired.every(r=>r.status==='completed')&&evaluations.every(e=>e.execution==='completed');
  if(!complete&&ranking.status==='recommended'){ranking.status='provisional';ranking.scopeComplete=false;}
  const central=sensitivityRankings.find(r=>r.sensitivityId==='central')!;
  const changedWinners=sensitivityRankings.filter(r=>identity(r.winnerIds)!==identity(central.winnerIds)).map(r=>r.sensitivityId),changedSets=sensitivityRankings.filter(r=>identity(r.feasibleCandidateIds)!==identity(central.feasibleCandidateIds)).map(r=>r.sensitivityId);
  const sensitivityConclusion=!complete?'Sensitivity assessment incomplete; no final whole-search recommendation.':campaign.sensitivities.length===1?'Central assumptions only; no paired sensitivity robustness assessed.':`Across the ${campaign.sensitivities.length} declared OFAT cases: ${changedWinners.length?`changed winners in ${changedWinners.join(', ')}`:'unchanged winner set'}; ${changedSets.length?`changed feasible sets in ${changedSets.join(', ')}`:'unchanged feasible set'}. ${sensitivityRankings.some(r=>r.ties.length)?'Ties occur within declared tolerance. ':''}Joint combinations untested; bounds are exploratory.`;
  return {version:DECISION_VERSION,campaignIdentity:plan.campaignIdentity,provenance:'executed',status:complete?'completed':cancelled?'cancelled':'incomplete',plan,runs:paired,evaluations,ranking,sensitivityRankings,sensitivityConclusion,coverage:{completed,planned:plan.totalRuns,fullyEvaluatedCandidates:campaign.candidates.filter(c=>evaluations.filter(e=>e.candidateId===c.id).every(e=>e.execution==='completed')).length}};
}
export async function runDecisionCampaign(campaign:DecisionCampaign,options:DecisionRunOptions={}):Promise<DecisionResult> {
  // Freeze this invocation's complete input; caller edits cannot leak into an active run.
  const frozen=structuredClone(campaign),plan=planDecisionCampaign(frozen),runs:DecisionRunEvidence[]=[];
  const executor=options.executor??executeDecisionRun,concurrency=options.concurrency??frozen.execution.concurrency;
  if(![1,2].includes(concurrency))throw Error('Decision worker pool supports one or two workers.');
  let cursor=0;const publish=()=>options.onProgress?.(assembleDecisionResult(frozen,plan,runs,options.signal?.aborted));publish();
  await Promise.all(Array.from({length:concurrency},async()=>{while(!options.signal?.aborted){const run=plan.runs[cursor++];if(!run)return;let evidence:DecisionRunEvidence;try{evidence=await executor(run,frozen.execution,options.signal);}catch(error){evidence={...baseEvidence(run),status:options.signal?.aborted?'cancelled':'numerical-failure',reason:String(error)};}if(evidence.id!==run.id||evidence.candidateId!==run.candidateId||evidence.scenarioId!==run.scenarioId||evidence.sensitivityId!==run.sensitivityId)throw Error('Late or mismatched decision worker response rejected.');runs.push(evidence);publish();}}));
  return assembleDecisionResult(frozen,plan,runs,options.signal?.aborted);
}
