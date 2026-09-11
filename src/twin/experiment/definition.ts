import { equipmentFor, engineeringIdentity } from '../catalog/equipment';
import { resolveAsset } from '../assets/design';
import { SOLVER_VERSION, type Design, type OperationEvent } from '../types';
import { CONTRACT, MODEL_ID, ALGORITHM_ID, INTEGRATION_STEPS } from '../persistence/limits';
import { mergeEventHistory, validateEvents } from '../persistence/events';
import { array, identity, keys, record, string } from '../persistence/structure';
import { failure, finiteNumber } from '../safety';
import { METRICS_VERSION, EXPERIMENT_LIMITS, type ExperimentDefinition, type RecoveryCriteria, type SettlingCriteria, type SuccessCriteria } from './types';

export const DEFAULT_RECOVERY: RecoveryCriteria = Object.freeze({ dwellS: 5, capacityToleranceAccelerators: 0, coolantLimitK: 318.15, airLimitK: 313.15, temperatureToleranceK: 0, thermalComparator: 'strictly-below', scope: 'all-modules-and-required-service' });
export const DEFAULT_SETTLING: SettlingCriteria = Object.freeze({ maxWarmupS: 1200, dwellS: 30, maxTemperatureRateKPerS: 0.001, maxBatteryRateWhPerS: 0.01, requireControllerQuiescence: true, requireService: true, requireThermal: true });
export const DEFAULT_SUCCESS: SuccessCriteria = Object.freeze({ maxShortfallAcceleratorS: 0, maxServiceViolationS: 0, maxThermalViolationS: 0, requireRecovery: true });
export interface ExperimentOptions {
  id?: string; name?: string; durationS: number; disturbances?: OperationEvent[];
  integrationStepS?: ExperimentDefinition['integrationStepS'];
  requiredAccelerators?: number; requiredCapacitySchedule?: ExperimentDefinition['workload']['requiredCapacitySchedule'];
  initial?: { mode: 'cold' | 'settled'; settling?: Partial<SettlingCriteria> };
  recovery?: Partial<RecoveryCriteria>; success?: Partial<SuccessCriteria>;
  parentDefinitionId?: string; note?: string;
}
export function createExperimentDefinition(design: Design, options: ExperimentOptions): ExperimentDefinition {
  const equipment = equipmentFor(design);
  const definition: ExperimentDefinition = {
    version: 1, id: options.id ?? `experiment-${identity({ physical: engineeringIdentity(design), options })}`, name: options.name ?? 'Whole experiment',
    designRevision: design.revision, physicalIdentity: engineeringIdentity(design), modelId: MODEL_ID, solverVersion: SOLVER_VERSION, algorithmId: ALGORITHM_ID, metricsVersion: METRICS_VERSION,
    integrationStepS: options.integrationStepS ?? 1, durationS: options.durationS,
    workload: { requiredAccelerators: options.requiredAccelerators ?? design.config.requestedAccelerators, requiredCapacitySchedule: structuredClone(options.requiredCapacitySchedule ?? []), utilization: design.config.workload, profile: identity(equipment.workloadProfile), requireClusterNetwork: design.config.requireClusterNetwork, requireExternalNetwork: design.config.requireExternalNetwork },
    environment: { seawaterK: design.config.seawaterK, foulingResistanceKPerW: design.config.foulingResistanceKPerW, pumpSpeed: design.config.pumpSpeed }, controllerPolicy: identity(equipment.controlPolicy),
    initial: { mode: options.initial?.mode ?? 'cold', settling: options.initial?.mode === 'settled' ? { ...DEFAULT_SETTLING, ...options.initial.settling } : null, includeWarmupInEvaluation: false },
    disturbances: mergeEventHistory(design, [], options.disturbances ?? [], 0), recovery: { ...DEFAULT_RECOVERY, ...options.recovery }, success: { ...DEFAULT_SUCCESS, ...options.success },
    provenance: { source: 'simulated-definition', parentDefinitionId: options.parentDefinitionId ?? null, note: options.note ?? 'Deterministic simulated design-stage reference; no physical validation.' },
  };
  validateExperimentDefinition(design, definition); return structuredClone(definition);
}
export function validateRecoveryCriteria(value: unknown): asserts value is RecoveryCriteria {
  record(value, 'recovery'); keys(value, ['dwellS','capacityToleranceAccelerators','coolantLimitK','airLimitK','temperatureToleranceK','thermalComparator','scope'], 'recovery');
  finiteNumber(value.dwellS, 'recovery.dwellS', { min: 0, max: CONTRACT.horizonS, integer: true });
  finiteNumber(value.capacityToleranceAccelerators, 'recovery.capacityToleranceAccelerators', { min: 0, max: 1_000_000 });
  for (const key of ['coolantLimitK','airLimitK']) finiteNumber(value[key], `recovery.${key}`, { min: 250, max: 373.15 });
  finiteNumber(value.temperatureToleranceK, 'recovery.temperatureToleranceK', { min: 0, max: 10 });
  if (value.thermalComparator !== 'strictly-below' || value.scope !== 'all-modules-and-required-service') failure('unsupported-configuration', 'EXPERIMENT_CRITERIA', 'Only strict bulk thermal limits across all modules and required service are supported.');
}
export function validateExperimentDefinition(design: Design, value: unknown): asserts value is ExperimentDefinition {
  record(value, 'experiment definition'); keys(value, ['version','id','name','designRevision','physicalIdentity','modelId','solverVersion','algorithmId','metricsVersion','integrationStepS','durationS','workload','environment','controllerPolicy','initial','disturbances','recovery','success','provenance'], 'experiment definition');
  if (value.version !== 1 || value.metricsVersion !== METRICS_VERSION || value.modelId !== MODEL_ID || value.solverVersion !== SOLVER_VERSION || value.algorithmId !== ALGORITHM_ID) failure('unsupported-configuration', 'EXPERIMENT_VERSION', 'Unsupported experiment or numerical version; preserve original and explicitly recalculate.');
  if (value.designRevision !== design.revision || value.physicalIdentity !== engineeringIdentity(design)) failure('invalid-input', 'EXPERIMENT_DESIGN', 'Experiment belongs to a different physical design.');
  for (const key of ['id','name']) { string(value[key], `experiment.${key}`, 160); if (!value[key]) failure('invalid-input','EXPERIMENT_NAME','Experiment identity and name are required.'); }
  finiteNumber(value.durationS, 'experiment.durationS', { min: 0, max: CONTRACT.horizonS, integer: true });
  if (!INTEGRATION_STEPS.includes(value.integrationStepS as never)) failure('invalid-input','EXPERIMENT_STEP','Unsupported integration step.');
  record(value.workload,'experiment.workload'); keys(value.workload,['requiredAccelerators','requiredCapacitySchedule','utilization','profile','requireClusterNetwork','requireExternalNetwork'],'experiment.workload');
  finiteNumber(value.workload.requiredAccelerators,'requiredAccelerators',{min:0,max:1_000_000});
  array(value.workload.requiredCapacitySchedule,'requiredCapacitySchedule',EXPERIMENT_LIMITS.demandChanges);
  let last = -1;
  for (const point of value.workload.requiredCapacitySchedule) { record(point,'demand point'); keys(point,['timeS','requiredAccelerators'],'demand point'); finiteNumber(point.timeS,'demand.timeS',{min:0,max:value.durationS,integer:true}); finiteNumber(point.requiredAccelerators,'demand.requiredAccelerators',{min:0,max:1_000_000}); if (point.timeS <= last) failure('invalid-input','EXPERIMENT_DEMAND_ORDER','Required capacity changes must have strictly increasing times.'); last = point.timeS; }
  const equipment = equipmentFor(design);
  if (value.workload.utilization !== design.config.workload || value.workload.profile !== identity(equipment.workloadProfile) || value.workload.requireClusterNetwork !== design.config.requireClusterNetwork || value.workload.requireExternalNetwork !== design.config.requireExternalNetwork || value.controllerPolicy !== identity(equipment.controlPolicy)) failure('invalid-input','EXPERIMENT_ASSUMPTIONS','Workload/controller assumptions differ from the bound design.');
  record(value.environment,'experiment.environment'); keys(value.environment,['seawaterK','foulingResistanceKPerW','pumpSpeed'],'experiment.environment');
  for (const key of ['seawaterK','foulingResistanceKPerW','pumpSpeed'] as const) if (value.environment[key] !== design.config[key]) failure('invalid-input','EXPERIMENT_ENVIRONMENT','Environment differs from the bound design.');
  record(value.initial,'experiment.initial'); keys(value.initial,['mode','settling','includeWarmupInEvaluation'],'experiment.initial');
  if (!['cold','settled'].includes(String(value.initial.mode)) || value.initial.includeWarmupInEvaluation !== false) failure('unsupported-configuration','EXPERIMENT_START','Supported starts are cold or explicitly settled, with warmup excluded.');
  if (value.initial.mode === 'cold') { if (value.initial.settling !== null) failure('invalid-input','EXPERIMENT_SETTLING','Cold start must not declare settling.'); }
  else { record(value.initial.settling,'settling'); keys(value.initial.settling,['maxWarmupS','dwellS','maxTemperatureRateKPerS','maxBatteryRateWhPerS','requireControllerQuiescence','requireService','requireThermal'],'settling'); const settling=value.initial.settling; finiteNumber(settling.maxWarmupS,'settling.maxWarmupS',{min:1,max:CONTRACT.horizonS-value.durationS,integer:true}); finiteNumber(settling.dwellS,'settling.dwellS',{min:1,max:settling.maxWarmupS,integer:true}); finiteNumber(settling.maxTemperatureRateKPerS,'settling.maxTemperatureRateKPerS',{min:0,max:100}); finiteNumber(settling.maxBatteryRateWhPerS,'settling.maxBatteryRateWhPerS',{min:0,max:1e9}); for (const key of ['requireService','requireThermal','requireControllerQuiescence']) if (typeof settling[key] !== 'boolean') failure('invalid-input','EXPERIMENT_SETTLING','Settling predicates must be booleans.'); }
  validateEvents(design,value.disturbances);
  if (value.disturbances.some(event=>event.timeS > (value.durationS as number))) failure('invalid-input','EXPERIMENT_EVENT_HORIZON','Disturbance falls after the evaluation window.');
  validateRecoveryCriteria(value.recovery);
  record(value.success,'success'); keys(value.success,['maxShortfallAcceleratorS','maxServiceViolationS','maxThermalViolationS','requireRecovery'],'success');
  for (const key of ['maxShortfallAcceleratorS','maxServiceViolationS','maxThermalViolationS']) finiteNumber(value.success[key],`success.${key}`,{min:0});
  if (typeof value.success.requireRecovery !== 'boolean') failure('invalid-input','EXPERIMENT_SUCCESS','Recovery criterion must be boolean.');
  record(value.provenance,'experiment.provenance'); keys(value.provenance,['source','parentDefinitionId','note'],'experiment.provenance');
  if (value.provenance.source !== 'simulated-definition') failure('invalid-input','EXPERIMENT_PROVENANCE','Unknown definition provenance.');
  if (value.provenance.parentDefinitionId !== null) string(value.provenance.parentDefinitionId,'parentDefinitionId',160);
  string(value.provenance.note,'experiment provenance note');
}
export function requiredCapacityAt(definition: ExperimentDefinition, timeS: number): number {
  let required = definition.workload.requiredAccelerators;
  for (const point of definition.workload.requiredCapacitySchedule) { if (point.timeS > timeS) break; required = point.requiredAccelerators; }
  return required;
}
/** Footprints describe actual installed scope; equal slot names alone imply no cross-design equivalence. */
export function disturbanceFootprints(design: Design, definition: ExperimentDefinition) {
  return definition.disturbances.filter(event=>['trip','maintenance','restore'].includes(event.kind)).map(event=>{
    const asset=resolveAsset(design,event.assetId)!;
    const affected=design.modules.filter(module=>event.assetId.startsWith('shore/') || module.id===event.assetId || module.id.startsWith(`${event.assetId}/`) || event.assetId.startsWith(`${module.id}/`) || [module.platformId,module.powerDomainId,module.networkDomainId].includes(event.assetId));
    const accelerators=affected.reduce((sum,module)=>sum+module.nodeCount*8,0);
    return { eventId:event.id, timeS:event.timeS, assetId:asset.id, equipment:`${asset.catalogId}@${asset.revision}`, affectedModuleIds:affected.map(module=>module.id), installedAcceleratorsInScope:accelerators, fractionOfInstalled:accelerators/design.provisionedAccelerators, ratings:asset.ratings, scope:'dependency footprint; actual service effects are evaluated by the canonical solver' };
  });
}
