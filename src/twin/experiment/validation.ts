import { identity, array, record, keys, string } from '../persistence/structure';
import { validateState } from '../persistence/state';
import { validateEvents } from '../persistence/events';
import { failure, finiteNumber } from '../safety';
import type { Design, SimulationState } from '../types';
import { EXPERIMENT_LIMITS, METRICS_VERSION, type ExperimentRun } from './types';
import { validateExperimentDefinition } from './definition';
import { evaluateExperiment } from './metrics';
const EPS=1e-8;
export function validateExperimentRun(design: Design, state: SimulationState): void {
  const candidate:unknown=state.experiment;if(candidate===undefined)return;
  record(candidate,'experiment run');keys(candidate,['extensionVersion','definition','definitionIdentity','initialState','initialStateIdentity','status','evaluation','reason','originTimeS','committedTimeS','committedStepIndex','warmup','metrics','inputs','inputProvenance'],'experiment run');
  if(candidate.extensionVersion!==1)failure('unsupported-configuration','EXPERIMENT_EXTENSION','Unknown experiment checkpoint extension.');
  validateExperimentDefinition(design,candidate.definition);
  if(candidate.definitionIdentity!==identity(candidate.definition))failure('invalid-input','EXPERIMENT_DEFINITION_BINDING','Definition changed underneath accumulated metrics. Create a derived rerun.');
  record(candidate.initialState,'experiment initialState');
  if(Object.hasOwn(candidate.initialState,'experiment'))failure('invalid-input','EXPERIMENT_RECURSION','Initial physical state cannot contain an experiment.');
  validateState(design,candidate.initialState);
  if(candidate.initialState.timeS!==0||candidate.initialState.events.length||candidate.initialState.integrationStepS!==candidate.definition.integrationStepS||candidate.initialStateIdentity!==identity(candidate.initialState))failure('invalid-input','EXPERIMENT_INITIAL_BINDING','Initial physical state or numerical settings disagree with the persisted identity.');
  if(candidate.committedTimeS!==state.timeS||candidate.committedStepIndex!==state.stepIndex||state.integrationStepS!==candidate.definition.integrationStepS)failure('invalid-input','EXPERIMENT_COMMIT_BINDING','Experiment metrics and physical state must share one committed boundary.');
  if(!['running','warming','paused','completed','cancelled','numerical-failed','resource-limited','warmup-timeout'].includes(String(candidate.status)))failure('invalid-input','EXPERIMENT_STATUS','Unknown lifecycle status.');
  if(candidate.reason!==null)string(candidate.reason,'experiment reason');
  if(candidate.originTimeS!==null)finiteNumber(candidate.originTimeS,'experiment.originTimeS',{min:0,max:state.timeS,integer:true});
  validateEvents(design,candidate.inputs);
  if(identity(candidate.inputs)!==identity(state.events)||candidate.inputProvenance!=='declared-and-recorded-interactive')failure('invalid-input','EXPERIMENT_INPUT_BINDING','Run inputs must match committed operation history.');
  if(candidate.originTimeS!==null){
    for(const event of candidate.definition.disturbances){const actual=candidate.inputs.find(input=>input.id===event.id);if(!actual||actual.kind!==event.kind||actual.assetId!==event.assetId||actual.timeS!==event.timeS+candidate.originTimeS||actual.value!==event.value)failure('invalid-input','EXPERIMENT_DECLARED_INPUT','A declared disturbance was omitted or changed in execution evidence.');}
  }else if(candidate.inputs.length)failure('invalid-input','EXPERIMENT_WARMUP_INPUT','Warmup cannot contain undeclared disturbance inputs.');
  record(candidate.warmup,'warmup');keys(candidate.warmup,['elapsedS','candidateSinceS','settledAtS','status','maxObservedTemperatureRateKPerS'],'warmup');
  finiteNumber(candidate.warmup.elapsedS,'warmup.elapsedS',{min:0,max:state.timeS});
  for(const key of ['candidateSinceS','settledAtS'] as const)if(candidate.warmup[key]!==null)finiteNumber(candidate.warmup[key],`warmup.${key}`,{min:0,max:candidate.warmup.elapsedS});
  if(candidate.warmup.maxObservedTemperatureRateKPerS!==null)finiteNumber(candidate.warmup.maxObservedTemperatureRateKPerS,'warmup.maxObservedTemperatureRateKPerS',{min:0});
  if(!['not-requested','warming','settled','timeout'].includes(String(candidate.warmup.status)))failure('invalid-input','EXPERIMENT_WARMUP','Unknown warmup status.');
  if(candidate.definition.initial.mode==='cold'&&(candidate.originTimeS!==0||candidate.warmup.status!=='not-requested'||candidate.warmup.elapsedS!==0))failure('invalid-input','EXPERIMENT_WARMUP','Cold start must retain a zero evaluation origin without warmup.');
  if(candidate.definition.initial.mode==='settled'&&candidate.originTimeS!==null&&(candidate.warmup.status!=='settled'||candidate.warmup.settledAtS!==candidate.originTimeS))failure('invalid-input','EXPERIMENT_WARMUP','Settled evaluation needs an explicit confirmed warmup origin.');
  record(candidate.metrics,'experiment metrics');
  const m=candidate.metrics;
  keys(m,['version','elapsedS','committedIntervals','shortfallAcceleratorS','serviceViolationS','thermalViolationS','anyViolationS','unavailableS','firstServiceViolationS','firstThermalViolationS','firstViolationS','minServiceable','maxCoolant','maxAir','interruptionCount','longestInterruptionS','openInterruptionStartS','batteryDischargeWh','batteryChargeWh','batteryLossWh','initialBatteryWh','finalBatteryWh','batteryNetChangeWh','controllerTransitionCount','controllerTransitions','controllerEvidenceTruncated','intervals','intervalEvidenceTruncated','trace','traceSamplesSeen','traceTruncated','recoveryEpisodes','recoveryEpisodeCount','recoveryEvidenceTruncated','pendingRecovery','boundaryHealthy','latestReferenceEventId'],'experiment metrics');
  if(m.version!==METRICS_VERSION)failure('unsupported-configuration','EXPERIMENT_METRICS_VERSION','Unknown whole-run metric semantics.');
  finiteNumber(m.elapsedS,'metrics.elapsedS',{min:0,max:candidate.definition.durationS});
  if(Math.abs(m.elapsedS-(candidate.originTimeS===null?0:state.timeS-candidate.originTimeS))>EPS)failure('invalid-input','EXPERIMENT_COVERAGE','Metric coverage does not match physical time and evaluation origin.');
  finiteNumber(m.committedIntervals,'metrics.committedIntervals',{min:0,integer:true});
  if(Math.abs((m.committedIntervals-(state.transfer?.splitTimesS.filter(t=>t>((candidate.originTimeS as number|null)??state.timeS)&&t<state.timeS).length??0))*state.integrationStepS-m.elapsedS)>EPS)failure('invalid-input','EXPERIMENT_INTERVAL_COUNT','Metric interval count disagrees with the committed numerical grid.');
  for(const key of ['shortfallAcceleratorS','serviceViolationS','thermalViolationS','anyViolationS','unavailableS','longestInterruptionS'])finiteNumber(m[key],`metrics.${key}`,{min:0,max:key==='shortfallAcceleratorS'?1_000_000*m.elapsedS:m.elapsedS});
  if((m.anyViolationS as number)+EPS<Math.max(m.serviceViolationS as number,m.thermalViolationS as number)||(m.anyViolationS as number)>(m.serviceViolationS as number)+(m.thermalViolationS as number)+EPS)failure('invalid-input','EXPERIMENT_UNION','Campus violation duration must be a union, bounded by individual durations.');
  for(const key of ['interruptionCount','controllerTransitionCount','traceSamplesSeen','recoveryEpisodeCount'])finiteNumber(m[key],`metrics.${key}`,{min:0,integer:true});
  for(const key of ['firstServiceViolationS','firstThermalViolationS','firstViolationS','openInterruptionStartS'])if(m[key]!==null)finiteNumber(m[key],`metrics.${key}`,{min:0,max:m.elapsedS});
  for(const key of ['batteryDischargeWh','batteryChargeWh','batteryLossWh','initialBatteryWh','finalBatteryWh'])if(m[key]!==null)finiteNumber(m[key],`metrics.${key}`,{min:0});
  if(m.batteryNetChangeWh!==null)finiteNumber(m.batteryNetChangeWh,'metrics.batteryNetChangeWh');
  if(m.initialBatteryWh!==null&&m.finalBatteryWh!==null&&Math.abs((m.finalBatteryWh as number)-(m.initialBatteryWh as number)-(m.batteryNetChangeWh as number))>EPS)failure('invalid-input','EXPERIMENT_BATTERY_NET','Net stored energy change disagrees with initial and final stored energy.');
  for(const key of ['minServiceable','maxCoolant','maxAir'])if(m[key]!==null){record(m[key],`metrics.${key}`);const extremum=m[key];keys(extremum,['value','timeS','assetId','domain'],'extremum');finiteNumber(extremum.value,'extremum.value',{min:0});finiteNumber(extremum.timeS,'extremum.timeS',{min:0,max:m.elapsedS});string(extremum.assetId,'extremum.assetId',180);string(extremum.domain,'extremum.domain',100);}
  for(const key of ['controllerEvidenceTruncated','intervalEvidenceTruncated','traceTruncated','recoveryEvidenceTruncated'])if(typeof m[key]!=='boolean')failure('invalid-input','EXPERIMENT_RETENTION','Evidence truncation flags must be explicit booleans.');
  if(m.boundaryHealthy!==null&&typeof m.boundaryHealthy!=='boolean')failure('invalid-input','EXPERIMENT_CONDITION','Boundary condition must be true, false or unavailable.');
  if(m.latestReferenceEventId!==null&&!candidate.inputs.some(event=>event.id===m.latestReferenceEventId))failure('invalid-input','EXPERIMENT_REFERENCE','Unknown recovery reference event.');
  array(m.controllerTransitions,'controller transitions',EXPERIMENT_LIMITS.evidenceEntries);
  for(const entry of m.controllerTransitions){record(entry,'controller evidence');keys(entry,['timeS','assetId','message','affectedIds','kind'],'controller evidence');finiteNumber(entry.timeS,'controller.timeS',{min:0,max:m.elapsedS});string(entry.assetId,'controller.assetId',180);string(entry.message,'controller.message');array(entry.affectedIds,'controller.affectedIds',design.modules.length);if(entry.kind!=='controller')failure('invalid-input','EXPERIMENT_CONTROLLER','Only controller transitions belong in controller evidence.');}
  if(m.controllerTransitions.length>(m.controllerTransitionCount as number))failure('invalid-input','EXPERIMENT_CONTROLLER_COUNT','Retained transition evidence exceeds its total count.');
  array(m.intervals,'violation intervals',EXPERIMENT_LIMITS.evidenceEntries);let previousEnd=0;
  for(const interval of m.intervals){record(interval,'violation interval');keys(interval,['startS','endS','service','thermal','unavailable'],'violation interval');finiteNumber(interval.startS,'interval.startS',{min:previousEnd,max:m.elapsedS});finiteNumber(interval.endS,'interval.endS',{min:interval.startS,max:m.elapsedS});if(interval.startS===interval.endS)failure('invalid-input','EXPERIMENT_INTERVAL','Retained interval must be positive.');for(const key of ['service','thermal','unavailable'])if(typeof interval[key]!=='boolean')failure('invalid-input','EXPERIMENT_INTERVAL','Violation flags must be booleans.');previousEnd=interval.endS;}
  array(m.trace,'metric trace',EXPERIMENT_LIMITS.traceSamples);let previous=-1;
  for(const point of m.trace){record(point,'trace point');keys(point,['timeS','requiredAccelerators','serviceableAccelerators','maxCoolantK','maxAirK'],'trace point');finiteNumber(point.timeS,'trace.timeS',{min:0,max:m.elapsedS});if(point.timeS<=previous)failure('invalid-input','EXPERIMENT_TRACE_ORDER','Trace timestamps must increase.');previous=point.timeS;finiteNumber(point.requiredAccelerators,'trace.requiredAccelerators',{min:0,max:1_000_000});for(const key of ['serviceableAccelerators','maxCoolantK','maxAirK'])if(point[key]!==null)finiteNumber(point[key],`trace.${key}`,{min:0});}
  const recoveryElapsed=m.elapsedS, recoveryInputs=candidate.inputs, recoveryCriteria=candidate.definition.recovery;
  const recovery=(value:unknown)=>{record(value,'recovery episode');keys(value,['referenceTimeS','referenceEventId','onsetTimeS','confirmationTimeS'],'recovery episode');finiteNumber(value.referenceTimeS,'recovery.referenceTimeS',{min:0,max:recoveryElapsed});if(value.referenceEventId!==null&&!recoveryInputs.some(event=>event.id===value.referenceEventId))failure('invalid-input','EXPERIMENT_REFERENCE','Unknown recovery episode reference.');if(value.onsetTimeS!==null)finiteNumber(value.onsetTimeS,'recovery.onsetTimeS',{min:value.referenceTimeS,max:recoveryElapsed});if(value.confirmationTimeS!==null){finiteNumber(value.confirmationTimeS,'recovery.confirmationTimeS',{min:value.referenceTimeS,max:recoveryElapsed});if(value.onsetTimeS===null||Math.abs(value.confirmationTimeS-(value.onsetTimeS as number)-recoveryCriteria.dwellS)>EPS)failure('invalid-input','EXPERIMENT_DWELL','Recovery confirmation must follow onset by the declared dwell.');}};
  array(m.recoveryEpisodes,'recovery episodes',EXPERIMENT_LIMITS.evidenceEntries);m.recoveryEpisodes.forEach(recovery);if(m.pendingRecovery!==null)recovery(m.pendingRecovery);
  if(candidate.status==='completed'&&(candidate.originTimeS===null||m.elapsedS!==candidate.definition.durationS))failure('invalid-input','EXPERIMENT_COMPLETION','Completion requires full evaluation coverage.');
  record(candidate.evaluation,'experiment evaluation');keys(candidate.evaluation,['outcome','reasons'],'experiment evaluation');array(candidate.evaluation.reasons,'evaluation reasons',100);candidate.evaluation.reasons.forEach(reason=>string(reason,'evaluation reason'));
  if(identity(candidate.evaluation)!==identity(evaluateExperiment(candidate as unknown as ExperimentRun)))failure('invalid-input','EXPERIMENT_EVALUATION','Stored outcome disagrees with lifecycle and authoritative aggregate criteria. Imported aggregates are user-supplied evidence, not independently verified.');
}
