import { failure, finiteNumber } from '../safety';
import { validateRecoveryCriteria } from './definition';
import { EXPERIMENT_LIMITS, METRICS_VERSION, type ExperimentMetrics, type MetricInterval, type MetricSample, type RecoveryCriteria, type RecoveryReport, type ExperimentStatus, type ExperimentRun } from './types';

const EPS = 1e-8;
export function createMetrics(criteria: RecoveryCriteria): ExperimentMetrics {
  validateRecoveryCriteria(criteria);
  return { version: METRICS_VERSION, elapsedS: 0, committedIntervals: 0, shortfallAcceleratorS: 0, serviceViolationS: 0, thermalViolationS: 0, anyViolationS: 0, unavailableS: 0,
    firstServiceViolationS: null, firstThermalViolationS: null, firstViolationS: null, minServiceable: null, maxCoolant: null, maxAir: null, interruptionCount: 0, longestInterruptionS: 0, openInterruptionStartS: null,
    batteryDischargeWh: 0, batteryChargeWh: 0, batteryLossWh: 0, initialBatteryWh: null, finalBatteryWh: null, batteryNetChangeWh: null,
    controllerTransitionCount: 0, controllerTransitions: [], controllerEvidenceTruncated: false, intervals: [], intervalEvidenceTruncated: false, trace: [], traceSamplesSeen: 0, traceTruncated: false,
    recoveryEpisodes: [], recoveryEpisodeCount: 0, recoveryEvidenceTruncated: false, pendingRecovery: null, boundaryHealthy: null, latestReferenceEventId: null };
}
function quantity(value: number | null, field: string) { if (value !== null) finiteNumber(value, field, { min: 0 }); }
function validateSample(sample: MetricSample) {
  finiteNumber(sample.timeS, 'metric.timeS', { min: 0 }); finiteNumber(sample.requiredAccelerators, 'metric.requiredAccelerators', { min: 0 });
  for (const key of ['serviceableAccelerators','energizedAccelerators','batteryWh'] as const) quantity(sample[key], `metric.${key}`);
  if (sample.energizedAccelerators !== null && sample.serviceableAccelerators !== null && sample.serviceableAccelerators > sample.energizedAccelerators + EPS) failure('invalid-input','METRIC_CAPACITY','Serviceable capacity cannot exceed energized capacity.');
  if (!Array.isArray(sample.temperatures)) failure('invalid-input','METRIC_TEMPERATURE','Temperature observations must be an array.');
  const seen = new Set<string>();
  for (const observation of sample.temperatures) {
    if (!observation || !['coolant','air'].includes(observation.domain) || typeof observation.assetId !== 'string' || !observation.assetId || seen.has(`${observation.assetId}:${observation.domain}`)) failure('invalid-input','METRIC_TEMPERATURE','Temperature observations need unique supported asset/domain identities.');
    seen.add(`${observation.assetId}:${observation.domain}`); if (observation.kelvin !== null) finiteNumber(observation.kelvin,'metric.temperatureK',{min:Number.MIN_VALUE});
  }
}
export function sampleConditions(sample: MetricSample, criteria: RecoveryCriteria) {
  const service = sample.serviceableAccelerators === null ? null : sample.serviceableAccelerators + criteria.capacityToleranceAccelerators >= sample.requiredAccelerators;
  const missing = sample.temperatures.length === 0 || sample.temperatures.some(value=>value.kelvin===null);
  const thermalViolation = sample.temperatures.some(value=>value.kelvin!==null && value.kelvin >= (value.domain==='coolant'?criteria.coolantLimitK:criteria.airLimitK) + criteria.temperatureToleranceK);
  const thermal = thermalViolation ? false : missing ? null : true;
  return { service, thermal, healthy: service === false || thermal === false ? false : service === null || thermal === null ? null : true };
}
function extrema(metrics: ExperimentMetrics, sample: MetricSample) {
  if (sample.serviceableAccelerators !== null && (!metrics.minServiceable || sample.serviceableAccelerators < metrics.minServiceable.value)) metrics.minServiceable = {value:sample.serviceableAccelerators,timeS:sample.timeS,assetId:'campus',domain:'serviceable-accelerators'};
  for (const observation of sample.temperatures) {
    const key = observation.domain === 'coolant' ? 'maxCoolant' : 'maxAir';
    if (observation.kelvin !== null && (!metrics[key] || observation.kelvin > metrics[key]!.value)) metrics[key] = {value:observation.kelvin,timeS:sample.timeS,assetId:observation.assetId,domain:observation.domain};
  }
}
function recordTrace(metrics: ExperimentMetrics, sample: MetricSample) {
  const maximum = (domain:'coolant'|'air') => { const values=sample.temperatures.filter(value=>value.domain===domain); return !values.length || values.some(value=>value.kelvin===null) ? null : Math.max(...values.map(value=>value.kelvin!)); };
  const point = {timeS:sample.timeS,requiredAccelerators:sample.requiredAccelerators,serviceableAccelerators:sample.serviceableAccelerators,maxCoolantK:maximum('coolant'),maxAirK:maximum('air')};
  if (metrics.trace.at(-1)?.timeS === point.timeS) metrics.trace[metrics.trace.length-1] = point;
  else { metrics.trace.push(point); metrics.traceSamplesSeen++; }
  if (metrics.trace.length > EXPERIMENT_LIMITS.traceSamples) {
    // Retain first/last and all authoritative extrema while thinning oldest ordinary points.
    const protectedTimes = new Set([metrics.trace[0].timeS,metrics.minServiceable?.timeS,metrics.maxCoolant?.timeS,metrics.maxAir?.timeS]);
    const remove = metrics.trace.findIndex((point,index)=>index>0 && index<metrics.trace.length-1 && !protectedTimes.has(point.timeS));
    metrics.trace.splice(remove,1); metrics.traceTruncated = true;
  }
}
function confirmRecovery(metrics: ExperimentMetrics, confirmationTimeS: number) {
  const pending = metrics.pendingRecovery!;
  pending.confirmationTimeS = confirmationTimeS;
  metrics.recoveryEpisodes.push({...pending});
  if (metrics.recoveryEpisodes.length > EXPERIMENT_LIMITS.evidenceEntries) {metrics.recoveryEpisodes.shift();metrics.recoveryEvidenceTruncated=true;}
}
/** Boundary samples include terminal events in observed extrema, but never add elapsed time. */
export function observeBoundary(metrics: ExperimentMetrics, sample: MetricSample, criteria: RecoveryCriteria): void {
  validateSample(sample);
  if (Math.abs(sample.timeS - metrics.elapsedS) > EPS) failure('invalid-input','METRIC_BOUNDARY','Boundary sample must match the committed metric clock.');
  extrema(metrics,sample); recordTrace(metrics,sample);
  if (metrics.committedIntervals === 0 && sample.timeS === 0) metrics.initialBatteryWh = sample.batteryWh;
  metrics.finalBatteryWh = sample.batteryWh;
  metrics.batteryNetChangeWh = metrics.initialBatteryWh === null || sample.batteryWh === null ? null : sample.batteryWh - metrics.initialBatteryWh;
  const conditions = sampleConditions(sample,criteria); metrics.boundaryHealthy = conditions.healthy;
  const pending = metrics.pendingRecovery;
  if (conditions.healthy !== true && pending) {
    // A trip exactly at the dwell terminal boundary cannot certify sustained recovery.
    if (pending.confirmationTimeS !== null && Math.abs(pending.confirmationTimeS-sample.timeS)<EPS) { metrics.recoveryEpisodes.pop();pending.confirmationTimeS=null; }
    if (pending.confirmationTimeS === null) pending.onsetTimeS=null;
  }
  if (conditions.healthy === true && pending && pending.confirmationTimeS === null && pending.onsetTimeS === null) pending.onsetTimeS=sample.timeS;
}
/** Mutates only an admitted candidate; duplicate/gapped intervals are rejected before any aggregate changes. */
export function accumulateInterval(metrics: ExperimentMetrics, interval: MetricInterval, criteria: RecoveryCriteria): void {
  validateRecoveryCriteria(criteria); validateSample(interval.sample);
  finiteNumber(interval.startS,'metric.interval.startS',{min:0});finiteNumber(interval.endS,'metric.interval.endS',{min:0});
  if (interval.endS <= interval.startS || Math.abs(interval.startS-metrics.elapsedS)>EPS || Math.abs(interval.sample.timeS-interval.startS)>EPS) failure('invalid-input','METRIC_INTERVAL','Metric intervals must be positive, contiguous, and committed exactly once.');
  for(const key of ['batteryDischargeWh','batteryChargeWh','batteryLossWh'] as const) quantity(interval[key],`metric.${key}`);
  const dt=interval.endS-interval.startS, sample=interval.sample, conditions=sampleConditions(sample,criteria), service=conditions.service===false, thermal=conditions.thermal===false, unavailable=conditions.service===null||conditions.thermal===null;
  extrema(metrics,sample);
  if (metrics.committedIntervals===0 && metrics.initialBatteryWh===null) metrics.initialBatteryWh=sample.batteryWh;
  if (sample.serviceableAccelerators!==null) metrics.shortfallAcceleratorS+=Math.max(0,sample.requiredAccelerators-sample.serviceableAccelerators)*dt;
  if(service){metrics.serviceViolationS+=dt;metrics.firstServiceViolationS??=interval.startS;if(metrics.openInterruptionStartS===null){metrics.openInterruptionStartS=interval.startS;metrics.interruptionCount++;}metrics.longestInterruptionS=Math.max(metrics.longestInterruptionS,interval.endS-metrics.openInterruptionStartS);} else metrics.openInterruptionStartS=null;
  if(thermal){metrics.thermalViolationS+=dt;metrics.firstThermalViolationS??=interval.startS;}
  if(service||thermal){metrics.anyViolationS+=dt;metrics.firstViolationS??=interval.startS;}
  if(unavailable)metrics.unavailableS+=dt;
  for(const key of ['batteryDischargeWh','batteryChargeWh','batteryLossWh'] as const) metrics[key]=metrics[key]===null||interval[key]===null?null:metrics[key]!+interval[key]!;
  if(service||thermal||unavailable){
    const previous=metrics.intervals.at(-1);
    if(previous&&Math.abs(previous.endS-interval.startS)<EPS&&previous.service===service&&previous.thermal===thermal&&previous.unavailable===unavailable)previous.endS=interval.endS;
    else metrics.intervals.push({startS:interval.startS,endS:interval.endS,service,thermal,unavailable});
    if(metrics.intervals.length>EXPERIMENT_LIMITS.evidenceEntries){metrics.intervals.shift();metrics.intervalEvidenceTruncated=true;}
  }
  if(service||thermal){
    if(!metrics.pendingRecovery||metrics.pendingRecovery.confirmationTimeS!==null){metrics.pendingRecovery={referenceTimeS:interval.startS,referenceEventId:metrics.latestReferenceEventId,onsetTimeS:null,confirmationTimeS:null};metrics.recoveryEpisodeCount++;}
    metrics.pendingRecovery.onsetTimeS=null;
  }else if(conditions.healthy===true&&metrics.pendingRecovery&&metrics.pendingRecovery.confirmationTimeS===null){
    metrics.pendingRecovery.onsetTimeS??=interval.startS;
    if(interval.endS+EPS>=metrics.pendingRecovery.onsetTimeS+criteria.dwellS)confirmRecovery(metrics,metrics.pendingRecovery.onsetTimeS+criteria.dwellS);
  }else if(conditions.healthy===null&&metrics.pendingRecovery&&metrics.pendingRecovery.confirmationTimeS===null)metrics.pendingRecovery.onsetTimeS=null;
  metrics.elapsedS=interval.endS;metrics.committedIntervals++;metrics.boundaryHealthy=conditions.healthy;
}
export function recoveryReport(metrics: ExperimentMetrics, status: ExperimentStatus): RecoveryReport {
  const pending=metrics.pendingRecovery, completed=status==='completed';
  const result:RecoveryReport={status:!completed?'incomplete-observation':metrics.anyViolationS===0?'no-qualifying-interruption':pending?.confirmationTimeS!==null&&pending?.confirmationTimeS!==undefined&&metrics.boundaryHealthy===true?'recovered':'not-recovered',referenceTimeS:pending?.referenceTimeS??null,referenceEventId:pending?.referenceEventId??null,onsetTimeS:pending?.onsetTimeS??null,confirmationTimeS:pending?.confirmationTimeS??null,onsetElapsedS:null,confirmationElapsedS:null};
  if(result.referenceTimeS!==null&&result.onsetTimeS!==null)result.onsetElapsedS=result.onsetTimeS-result.referenceTimeS;
  if(result.referenceTimeS!==null&&result.confirmationTimeS!==null)result.confirmationElapsedS=result.confirmationTimeS-result.referenceTimeS;
  return result;
}
export function evaluateExperiment(run: ExperimentRun): ExperimentRun['evaluation'] {
  if(run.status!=='completed')return{outcome:'INCOMPLETE',reasons:[run.reason??`Experiment ${run.status}; ${run.metrics.elapsedS}/${run.definition.durationS} evaluation seconds observed.`]};
  if(run.metrics.unavailableS>EPS||run.metrics.boundaryHealthy===null)return{outcome:'UNAVAILABLE',reasons:['Required measurements are unavailable; no passing whole-run assessment can be made.']};
  const reasons:string[]=[],success=run.definition.success,metrics=run.metrics;
  if(metrics.shortfallAcceleratorS>success.maxShortfallAcceleratorS+EPS)reasons.push('Cumulative unmet accelerator requirement exceeded its accelerator-second limit.');
  if(metrics.serviceViolationS>success.maxServiceViolationS+EPS)reasons.push('Service violation duration exceeded its seconds limit.');
  if(metrics.thermalViolationS>success.maxThermalViolationS+EPS)reasons.push('Thermal violation duration exceeded its seconds limit.');
  if(success.requireRecovery&&(recoveryReport(metrics,run.status).status==='not-recovered'||metrics.boundaryHealthy!==true))reasons.push('Declared service and thermal conditions did not remain recovered through the required dwell and terminal boundary.');
  return{outcome:reasons.length?'FAIL':'PASS',reasons};
}
