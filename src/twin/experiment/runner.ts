import { initialize, advance } from '../engine/simulation';
import type { Design, SimulationState } from '../types';
import { CONTRACT } from '../persistence/limits';
import { identity } from '../persistence/structure';
import { diagnosticFor } from '../safety';
import { createExperimentDefinition, validateExperimentDefinition } from './definition';
import { experimentExecutionDuration, experimentFinished, setExperimentStatus } from './runtime';
import { evaluateExperiment } from './metrics';
import type { ExperimentDefinition } from './types';

export function beginExperiment(design: Design, definition: ExperimentDefinition): SimulationState { return initialize(design,definition); }
/** Bounded synchronous reference runner; the UI uses the same canonical engine in its worker. */
export function runExperiment(design: Design, definition: ExperimentDefinition, options: { chunkS?: number } = {}): SimulationState {
  let state=beginExperiment(design,definition);
  const target=experimentExecutionDuration(definition),chunkS=Math.min(options.chunkS??CONTRACT.maxAdvanceS,CONTRACT.maxAdvanceS);
  if(!Number.isSafeInteger(chunkS)||chunkS<1)throw Error('Experiment chunks must be positive integer seconds.');
  let work=0;const started=performance.now();
  while(state.timeS<target&&!experimentFinished(state)){
    const duration=Math.min(chunkS,target-state.timeS),nextWork=duration/state.integrationStepS*design.modules.length;
    if(work+nextWork>CONTRACT.maxJobModuleSteps||performance.now()-started>CONTRACT.maxJobWallMs)return setExperimentStatus(state,'resource-limited','Bounded reference execution paused at the last committed checkpoint.');
    try{state=advance(design,state,duration);work+=nextWork;}
    catch(error){const diagnostic=diagnosticFor(error);return setExperimentStatus(state,diagnostic.kind==='resource-limit'?'resource-limited':'numerical-failed',diagnostic.message);}
  }
  return state;
}
export function counterfactualDefinition(design: Design, faulted: ExperimentDefinition): ExperimentDefinition {
  validateExperimentDefinition(design,faulted);
  return createExperimentDefinition(design,{
    id:`${faulted.id.slice(0,145)}:unfaulted`,name:`${faulted.name.slice(0,140)} · unfaulted`,durationS:faulted.durationS,integrationStepS:faulted.integrationStepS,
    requiredAccelerators:faulted.workload.requiredAccelerators,requiredCapacitySchedule:faulted.workload.requiredCapacitySchedule,
    disturbances:faulted.disturbances.filter(event=>!['trip','restore','maintenance'].includes(event.kind)).map((event,sequence)=>({...event,sequence})),
    initial:{mode:faulted.initial.mode,...(faulted.initial.settling?{settling:faulted.initial.settling}:{})},recovery:faulted.recovery,success:faulted.success,parentDefinitionId:faulted.id,
    note:'Paired counterfactual suppresses only declared trip, maintenance, and restoration inputs. Initial physical state, workload, environment, controls and numerical settings are identical.',
  });
}
function comparisonAssumptions(definition: ExperimentDefinition) {
  const {id:_id,name:_name,disturbances:_disturbances,provenance:_provenance,...assumptions}=definition;return assumptions;
}
function operationContent(events: ExperimentDefinition['disturbances']) { return events.map(({sequence:_sequence,...event})=>event); }
export function comparePair(faulted: SimulationState, baseline: SimulationState) {
  const f=faulted.experiment,b=baseline.experiment,reasons:string[]=[];
  if(!f||!b)return{status:'mismatched' as const,reasons:['Whole-run metrics unavailable for a legacy or uninstrumented run.'],absolute:null,difference:null};
  if(identity(comparisonAssumptions(f.definition))!==identity(comparisonAssumptions(b.definition)))reasons.push('Physical design, workload, environment, controller, criteria, duration, or numerical settings differ.');
  if(f.initialStateIdentity!==b.initialStateIdentity||identity(f.initialState)!==identity(b.initialState))reasons.push('Initial physical checkpoints differ; the baseline must not start from a faulted state.');
  const expected=operationContent(f.definition.disturbances.filter(event=>!['trip','restore','maintenance'].includes(event.kind)));
  if(identity(expected)!==identity(operationContent(b.definition.disturbances)))reasons.push('Baseline does not suppress exactly the declared fault sequence while retaining other inputs.');
  for(const run of [f,b]){
    const declared=run.definition.disturbances.map(event=>({...event,timeS:event.timeS+(run.originTimeS??0)}));
    if(identity(operationContent(run.inputs))!==identity(operationContent(declared)))reasons.push('Recorded interactive inputs require an explicit derived pair definition.');
  }
  if(reasons.length)return{status:'mismatched' as const,reasons,absolute:null,difference:null};
  if([f,b].some(run=>run.status!=='completed'||run.metrics.elapsedS!==run.definition.durationS||evaluateExperiment(run).outcome==='UNAVAILABLE')||f.originTimeS!==b.originTimeS)return{status:'incomplete' as const,reasons:['Both runs must complete the same evaluation coverage with available metrics and matching warmup origins.'],absolute:null,difference:null};
  const results=(run:typeof f)=>({shortfallAcceleratorS:run.metrics.shortfallAcceleratorS,serviceViolationS:run.metrics.serviceViolationS,thermalViolationS:run.metrics.thermalViolationS,maximumCoolantK:run.metrics.maxCoolant?.value??null,minimumServiceableAccelerators:run.metrics.minServiceable?.value??null,batteryDischargeWh:run.metrics.batteryDischargeWh,warmupS:run.warmup.elapsedS,outcome:run.evaluation.outcome});
  const absolute={faulted:results(f),baseline:results(b)};
  return{status:'comparable' as const,reasons:[],absolute,difference:{shortfallAcceleratorS:f.metrics.shortfallAcceleratorS-b.metrics.shortfallAcceleratorS,serviceViolationS:f.metrics.serviceViolationS-b.metrics.serviceViolationS,thermalViolationS:f.metrics.thermalViolationS-b.metrics.thermalViolationS,batteryDischargeWh:f.metrics.batteryDischargeWh===null||b.metrics.batteryDischargeWh===null?null:f.metrics.batteryDischargeWh-b.metrics.batteryDischargeWh},convention:'signed faulted minus unfaulted; accelerator-seconds are unmet requirement, not delivered throughput or financial loss'};
}
export function runFaultPair(design: Design, definition: ExperimentDefinition) {
  const faulted=runExperiment(design,definition),baseline=runExperiment(design,counterfactualDefinition(design,definition));
  return{faulted,baseline,comparison:comparePair(faulted,baseline)};
}
