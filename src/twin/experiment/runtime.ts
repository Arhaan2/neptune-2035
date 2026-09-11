import { identity } from '../persistence/structure';
import { mergeEventHistory } from '../persistence/events';
import type { CausalEntry, Design, OperationEvent, SimulationState } from '../types';
import { failure } from '../safety';
import { requiredCapacityAt, validateExperimentDefinition } from './definition';
import { accumulateInterval, createMetrics, evaluateExperiment, observeBoundary, sampleConditions } from './metrics';
import { EXPERIMENT_LIMITS, type ExperimentDefinition, type MetricSample, type ExperimentStatus } from './types';

export function physicalCheckpoint(state: SimulationState) {
  const { experiment: _experiment, ...physical } = state;
  return structuredClone({...physical,solverMs:0});
}
export function attachExperiment(design: Design, state: SimulationState, definition: ExperimentDefinition): void {
  validateExperimentDefinition(design,definition);
  if(state.timeS!==0||state.events.length||state.experiment)failure('invalid-input','EXPERIMENT_INITIAL','A reproducible experiment starts from a separate declared initial state.');
  if(state.integrationStepS!==definition.integrationStepS)failure('invalid-input','EXPERIMENT_INITIAL_STEP','Initial state and experiment integration settings differ.');
  const initialState=physicalCheckpoint(state),warming=definition.initial.mode==='settled';
  state.experiment={extensionVersion:1,definition:structuredClone(definition),definitionIdentity:identity(definition),initialState,initialStateIdentity:identity(initialState),status:warming?'warming':'running',evaluation:{outcome:'INCOMPLETE',reasons:['Evaluation has not completed.']},reason:null,originTimeS:warming?null:0,committedTimeS:0,committedStepIndex:0,
    warmup:{elapsedS:0,candidateSinceS:null,settledAtS:null,status:warming?'warming':'not-requested',maxObservedTemperatureRateKPerS:null},metrics:createMetrics(definition.recovery),inputs:[],inputProvenance:'declared-and-recorded-interactive'};
  if(!warming)state.events=mergeEventHistory(design,[],definition.disturbances,0);
  state.experiment.inputs=structuredClone(state.events);
}
export function metricSample(state: SimulationState, timeS: number, temperatures?: MetricSample['temperatures']): MetricSample {
  const run=state.experiment!;
  return{timeS,requiredAccelerators:requiredCapacityAt(run.definition,timeS),serviceableAccelerators:state.modules.reduce((sum,module)=>sum+module.availableAccelerators,0),energizedAccelerators:state.modules.reduce((sum,module)=>sum+module.energizedNodes*8,0),temperatures:temperatures??state.modules.flatMap(module=>[{assetId:module.id,domain:'coolant' as const,kelvin:module.coolantK},{assetId:module.id,domain:'air' as const,kelvin:module.airK}]),batteryWh:state.modules.reduce((sum,module)=>sum+module.batteryWh,0)};
}
export function beginInterval(state: SimulationState) {
  if(!state.experiment)return null;
  return {temperatures:state.modules.flatMap(module=>[{assetId:module.id,domain:'coolant' as const,kelvin:module.coolantK},{assetId:module.id,domain:'air' as const,kelvin:module.airK}]),batteryWh:state.modules.map(module=>module.batteryWh),controllers:state.modules.map(module=>({throttle:module.throttle,states:JSON.stringify(module.states)}))};
}
export function commitExperimentInterval(state: SimulationState, before: ReturnType<typeof beginInterval>, dtS: number, energy:{batteryDischargeWh:number;batteryChargeWh:number;batteryLossWh:number}): void {
  const run=state.experiment;if(!run||!before)return;
  const end=state.timeS+dtS;
  if(run.originTimeS===null){
    const criteria=run.definition.initial.settling!;
    let rate=0,batteryRate=0,controllersQuiet=true;
    state.modules.forEach((module,index)=>{
      rate=Math.max(rate,Math.abs(module.coolantK-before.temperatures[index*2].kelvin)/dtS,Math.abs(module.airK-before.temperatures[index*2+1].kelvin)/dtS);
      batteryRate=Math.max(batteryRate,Math.abs(module.batteryWh-before.batteryWh[index])/dtS);
      if(Object.values(module.states).some(value=>value==='starting')||module.throttle!==before.controllers[index].throttle||JSON.stringify(module.states)!==before.controllers[index].states)controllersQuiet=false;
    });
    run.warmup.elapsedS=end;
    run.warmup.maxObservedTemperatureRateKPerS=Math.max(run.warmup.maxObservedTemperatureRateKPerS??0,rate);
    const conditions=sampleConditions(metricSample(state,0,before.temperatures),run.definition.recovery);
    const good=rate<=criteria.maxTemperatureRateKPerS&&batteryRate<=criteria.maxBatteryRateWhPerS&&(!criteria.requireControllerQuiescence||controllersQuiet)&&(!criteria.requireService||conditions.service===true)&&(!criteria.requireThermal||conditions.thermal===true);
    if(good)run.warmup.candidateSinceS??=state.timeS;else run.warmup.candidateSinceS=null;
    // Confirmation waits for the end-boundary controller solve. Its transition
    // may invalidate quiescence even when the preceding interval was quiet.
  }else{
    const startS=state.timeS-run.originTimeS,sample=metricSample(state,startS,before.temperatures);sample.batteryWh=before.batteryWh.reduce((sum,value)=>sum+value,0);
    accumulateInterval(run.metrics,{startS,endS:startS+dtS,sample,...energy},run.definition.recovery);
  }
}
export function admitExperimentInputs(state: SimulationState, incoming: OperationEvent[]): void {
  const run=state.experiment;if(!run)return;
  const newEvents=incoming.filter(event=>!run.inputs.some(prior=>prior.id===event.id));
  if(newEvents.length&&['completed','cancelled','warmup-timeout','numerical-failed'].includes(run.status))failure('invalid-input','EXPERIMENT_CLOSED','A closed experiment cannot accept new inputs; create an explicit derived rerun.');
  if(newEvents.length&&run.originTimeS===null)failure('invalid-input','EXPERIMENT_WARMUP_INPUT','Interactive disturbances are available after settling; start a derived cold experiment to change warmup inputs.');
  if(newEvents.some(event=>event.timeS>(run.originTimeS??0)+run.definition.durationS))failure('invalid-input','EXPERIMENT_INPUT_HORIZON','Interactive input falls beyond this experiment duration.');
  run.inputs=structuredClone(state.events);
}
export function prepareExperimentBoundary(design: Design, state: SimulationState): void {
  const run=state.experiment;if(!run)return;
  if(run.originTimeS===null){
    const criteria=run.definition.initial.settling!,conditions=sampleConditions(metricSample(state,0),run.definition.recovery);
    if((criteria.requireService&&conditions.service!==true)||(criteria.requireThermal&&conditions.thermal!==true))run.warmup.candidateSinceS=null;
    // External events/checkpoints retain the existing integer-second contract.
    if(Number.isInteger(state.timeS)&&run.warmup.candidateSinceS!==null&&state.timeS-run.warmup.candidateSinceS>=criteria.dwellS){run.warmup.status='settled';run.warmup.settledAtS=state.timeS;run.originTimeS=state.timeS;run.status='running';}
    else if(state.timeS>=criteria.maxWarmupS){run.warmup.status='timeout';run.status='warmup-timeout';run.reason='Settling predicates did not hold continuously before maximum warmup; evaluation did not start.';}
  }
  if(run.originTimeS===state.timeS&&run.warmup.status==='settled'&&state.events.length===0){
    state.events=mergeEventHistory(design,[],run.definition.disturbances.map(event=>({...event,timeS:event.timeS+state.timeS})),state.timeS);run.inputs=structuredClone(state.events);
  }
}
export function finishExperimentBoundary(state: SimulationState): void {
  const run=state.experiment;if(!run)return;
  run.committedTimeS=state.timeS;run.committedStepIndex=state.stepIndex;
  if(run.originTimeS!==null){
    observeBoundary(run.metrics,metricSample(state,state.timeS-run.originTimeS),run.definition.recovery);
    if(run.metrics.elapsedS>=run.definition.durationS&&!['cancelled','numerical-failed','resource-limited'].includes(run.status))run.status='completed';
  }
  run.evaluation=evaluateExperiment(run);
}
export function recordExperimentEvent(state: SimulationState, event: OperationEvent): void {
  const run=state.experiment;
  if(run&&run.originTimeS!==null&&['trip','maintenance'].includes(event.kind))run.metrics.latestReferenceEventId=event.id;
}
export function recordExperimentController(state: SimulationState, entry: CausalEntry): void {
  const run=state.experiment;
  if(!run||entry.kind!=='controller')return;
  if(run.originTimeS===null){
    if(run.definition.initial.settling?.requireControllerQuiescence)run.warmup.candidateSinceS=null;
    return;
  }
  run.metrics.controllerTransitionCount++;
  run.metrics.controllerTransitions.push({...entry,timeS:entry.timeS-run.originTimeS,affectedIds:[...entry.affectedIds]});
  if(run.metrics.controllerTransitions.length>EXPERIMENT_LIMITS.evidenceEntries){run.metrics.controllerTransitions.shift();run.metrics.controllerEvidenceTruncated=true;}
}
export function setExperimentStatus(state: SimulationState, status: ExperimentStatus, reason: string | null = null): SimulationState {
  if(!state.experiment)return state;
  const next={...state,experiment:structuredClone(state.experiment)};
  if(next.experiment.status==='completed'&&['paused','cancelled'].includes(status))return state;
  next.experiment.status=status;next.experiment.reason=reason;next.experiment.evaluation=evaluateExperiment(next.experiment);return next;
}
export function experimentFinished(state: SimulationState): boolean { return !!state.experiment&&['completed','cancelled','numerical-failed','warmup-timeout'].includes(state.experiment.status); }
export function experimentExecutionDuration(definition: ExperimentDefinition): number {return definition.durationS+(definition.initial.settling?.maxWarmupS??0);}
