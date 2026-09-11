import { validateExperimentRun } from '../experiment/validation';
import { engineeringIdentity, resolveSpecification, equipmentFor } from '../catalog/equipment';
import { moduleAssets } from '../assets/design';
import { failure, finiteNumber } from '../safety';
import { SOLVER_VERSION, type Design, type SimulationState } from '../types';
import { validateEvents } from './events';
import { CONTRACT, INTEGRATION_STEPS } from './limits';
import { array, keys, record, string, validateStructure } from './structure';

const equipmentStates = ['available', 'starting', 'running', 'standby', 'isolated', 'failed', 'maintenance', 'unknown'];
const nonnegative = ['technicalFlowM3S', 'seawaterFlowM3S', 'pumpPowerW', 'itW', 'facilityW', 'gridW', 'batteryDischargeW', 'batteryChargeW', 'pressurePa'];
const signed = ['rejectedHeatW', 'thermalResidualW', 'electricalResidualW'];
export function validateState(design: Design, value: unknown, options: { allowDifferentSolver?: boolean } = {}): asserts value is SimulationState {
  validateStructure(value); record(value, 'state');
  keys(value, ['schemaVersion', 'designRevision', 'designIdentity', 'solverVersion', 'timeS', 'integrationStepS', 'stepIndex', 'modules', 'events', 'log', 'facilityEnergyWh', 'itEnergyWh', 'gridEnergyWh', 'appliedEventIds', 'workload', 'seawaterK', 'foulingResistanceKPerW', 'pumpSpeed', 'failedAssetIds', 'solverMs', 'experiment'], 'state');
  string(value.solverVersion, 'state.solverVersion', 100);
  if (value.schemaVersion !== CONTRACT.stateSchema || value.designRevision !== design.revision || (!options.allowDifferentSolver && value.solverVersion !== SOLVER_VERSION)) failure('invalid-input', 'STATE_REVISION', 'Simulation revision mismatch; explicit model migration/recalculation required.');
  if (value.designIdentity !== engineeringIdentity(design)) failure('invalid-input', 'STATE_DESIGN_BINDING', 'Checkpoint belongs to a different complete design; restore its saved design or start a separate experiment.');
  finiteNumber(value.timeS, 'state.timeS', { min: 0, max: CONTRACT.horizonS, integer: true, unit: 's' });
  if (!INTEGRATION_STEPS.includes(value.integrationStepS as never)) failure('invalid-input', 'INTEGRATION_STEP', 'Integration step must be 1, 0.5, 0.25, or 0.125 seconds.');
  finiteNumber(value.stepIndex, 'state.stepIndex', { min: 0, max: CONTRACT.horizonS / INTEGRATION_STEPS.at(-1)!, integer: true });
  if (value.stepIndex * (value.integrationStepS as number) !== value.timeS) failure('invalid-input', 'STATE_STEP_POSITION', 'Checkpoint time and integration step position disagree.');
  for (const key of ['facilityEnergyWh', 'itEnergyWh', 'gridEnergyWh']) finiteNumber(value[key], `state.${key}`, { min: 0, unit: 'Wh' });
  finiteNumber(value.solverMs, 'state.solverMs', { min: 0, unit: 'ms' });
  finiteNumber(value.workload, 'state.workload', { min: 0, max: 1 });
  finiteNumber(value.seawaterK, 'state.seawaterK', { min: 275.15, max: 311.15, unit: 'K' });
  finiteNumber(value.foulingResistanceKPerW, 'state.foulingResistanceKPerW', { min: 0, max: 0.0001, unit: 'K/W' });
  finiteNumber(value.pumpSpeed, 'state.pumpSpeed', { min: 0, max: 1.2 });
  validateEvents(design, value.events);
  array(value.appliedEventIds, 'state.appliedEventIds', CONTRACT.maxEvents);
  const due = value.events.filter(e => e.timeS <= (value.timeS as number));
  if (due.length !== value.appliedEventIds.length || due.some((e, i) => e.id !== (value.appliedEventIds as unknown[])[i])) failure('invalid-input', 'STATE_EVENT_CURSOR', 'Checkpoint applied-event cursor must contain exactly the events due at this boundary, in order.');
  const known = new Set(design.assets.map(a => a.id)), moduleIds = new Set(design.modules.map(m => m.id)), local = new Map<string, Set<string>>();
  const assetKnown = (id: string) => {
    if (known.has(id)) return true;
    const m = design.modules.find(m => id.startsWith(`${m.id}/`)); if (!m) return false;
    if (!local.has(m.id)) local.set(m.id, new Set(moduleAssets(design, m.id).map(a => a.id)));
    return local.get(m.id)!.has(id);
  };
  array(value.failedAssetIds, 'state.failedAssetIds', CONTRACT.maxEvents);
  const failures = new Set<string>();
  for (const id of value.failedAssetIds) {
    string(id, 'failed asset', CONTRACT.maxAssetIdLength);
    if (!assetKnown(id) || failures.has(id)) failure('invalid-input', 'STATE_FAILED_ASSET', 'Checkpoint contains an unknown or duplicate failed asset.', { assetId: id }); failures.add(id);
  }
  // Runtime inputs and faults are authoritative too: bind them to the applied history.
  const expectedFailures = new Set<string>();
  const runtime = { workload: design.config.workload, seawater: design.config.seawaterK, fouling: design.config.foulingResistanceKPerW, 'pump-speed': design.config.pumpSpeed };
  for (const e of due) {
    if (e.kind === 'restore') expectedFailures.delete(e.assetId);
    else if (e.kind === 'trip' || e.kind === 'maintenance') expectedFailures.add(e.assetId);
    else runtime[e.kind] = e.value!;
  }
  if (failures.size !== expectedFailures.size || [...failures].some(id => !expectedFailures.has(id))) failure('invalid-input', 'STATE_FAULT_HISTORY', 'Checkpoint faults disagree with applied events.');
  if ((value.workload !== runtime.workload || value.seawaterK !== runtime.seawater || value.foulingResistanceKPerW !== runtime.fouling || value.pumpSpeed !== runtime['pump-speed'])) failure('invalid-input', 'STATE_INPUT_HISTORY', 'Checkpoint runtime inputs disagree with applied events.');
  array(value.modules, 'state.modules', CONTRACT.maxModules);
  if (value.modules.length !== design.modules.length) failure('invalid-input', 'STATE_INVENTORY', 'Simulation inventory mismatch.');
  for (let i = 0; i < value.modules.length; i++) {
    const m = value.modules[i], spec = design.modules[i]; record(m, 'module state');
    keys(m, ['id', 'coolantK', 'airK', 'batteryWh', 'throttle', 'states', 'startAtS', ...nonnegative, ...signed, 'technicalOutletK', 'seawaterOutletK', 'energizedNodes', 'availableAccelerators', 'warnings'], 'module state');
    if (m.id !== spec.id) failure('invalid-input', 'STATE_INVENTORY', 'Simulation module identity/order mismatch.');
    finiteNumber(m.coolantK, 'module.coolantK', { min: 273.15, max: 373.15, unit: 'K' });
    finiteNumber(m.airK, 'module.airK', { min: 250, max: 373.15, unit: 'K' });
    finiteNumber(m.batteryWh, 'module.batteryWh', { min: 0, max: resolveSpecification(design,`${spec.id}/battery`).ratings.energyWh, unit: 'Wh' });
    if (![0, 0.5, 1].includes(m.throttle as number)) failure('invalid-input', 'STATE_THROTTLE', 'Invalid thermal hysteresis state.', { assetId: spec.id });
    for (const key of nonnegative) finiteNumber(m[key], `module.${key}`, { min: 0 });
    for (const key of signed) finiteNumber(m[key], `module.${key}`, { unit: 'W' });
    for (const key of ['technicalOutletK', 'seawaterOutletK']) finiteNumber(m[key], `module.${key}`, { min: Number.MIN_VALUE, unit: 'K' });
    finiteNumber(m.energizedNodes, 'module.energizedNodes', { min: 0, max: spec.nodeCount, integer: true });
    finiteNumber(m.availableAccelerators, 'module.availableAccelerators', { min: 0, max: m.energizedNodes * 8, integer: true });
    if (m.availableAccelerators % 8 !== 0) failure('invalid-input', 'STATE_WHOLE_NODES', 'Available accelerators must represent whole nodes.');
    record(m.states, 'equipment states'); record(m.startAtS, 'startup deadlines');
    for (const [id, state] of Object.entries(m.states)) {
      if ((id !== spec.id && !id.startsWith(`${spec.id}/`)) || !assetKnown(id) || !equipmentStates.includes(String(state))) failure('invalid-input', 'STATE_EQUIPMENT', 'Unknown equipment reference or state.', { assetId: id });
      if ((state === 'failed' || state === 'maintenance') !== failures.has(id)) failure('invalid-input', 'STATE_EQUIPMENT_FAULT', 'Equipment state disagrees with the recorded fault/isolation history.', { assetId: id });
    }
    for (const id of failures) if ((id === spec.id || id.startsWith(`${spec.id}/`)) && !Object.hasOwn(m.states, id)) failure('invalid-input', 'STATE_EQUIPMENT_FAULT', 'A failed local asset is missing its equipment state.', { assetId: id });
    for (const suffix of ['', '/pump-duty', '/pump-sea', '/cdu', '/hx', '/battery', '/distribution', '/rack-network', ...(design.config.standbyPumps ? ['/pump-standby'] : [])]) if (!Object.hasOwn(m.states, `${spec.id}${suffix}`)) failure('invalid-input', 'STATE_EQUIPMENT_MISSING', 'Checkpoint is missing an equipment/controller state.', { assetId: `${spec.id}${suffix}` });
    for (const [id, deadline] of Object.entries(m.startAtS)) {
      if (![`${spec.id}/pump-duty`, `${spec.id}/pump-standby`].includes(id) || !assetKnown(id)) failure('invalid-input', 'STATE_DEADLINE_ASSET', 'Invalid startup deadline asset.', { assetId: id });
      finiteNumber(deadline, 'startup deadline', { min: 0, max: CONTRACT.horizonS + CONTRACT.maxPendingStartupS, unit: 's' });
      if (!Number.isInteger(deadline / (value.integrationStepS as number))) failure('invalid-input', 'STATE_DEADLINE_GRID', 'Startup deadline must lie on the persisted integration grid.', { assetId: id, unit: 's' });
      if (deadline > value.timeS + CONTRACT.maxPendingStartupS) failure('invalid-input', 'STATE_DEADLINE', 'Startup deadline exceeds the supported pending delay.');
    }
    for (const [id, state] of Object.entries(m.states)) if (state === 'starting') {
      if (!Object.hasOwn(m.startAtS, id)) failure('invalid-input', 'STATE_STARTUP_MISSING', 'Starting equipment requires a persisted deadline.', { assetId: id });
      if ((m.startAtS[id] as number) <= value.timeS) failure('invalid-input', 'STATE_STARTUP_EXPIRED', 'An expired startup must be resolved before a checkpoint is committed.', { assetId: id });
      if (id === `${spec.id}/pump-duty`) {
        const last = due.findLast(e => e.assetId === id && ['trip', 'restore', 'maintenance'].includes(e.kind));
        if (last?.kind !== 'restore' || m.startAtS[id] !== last.timeS + equipmentFor(design).controlPolicy.dutyRestartS) failure('invalid-input', 'STATE_DUTY_DEADLINE', 'Duty startup must retain the three-second deadline of its latest recorded restore.', { assetId: id, unit: 's' });
      }
    }
    array(m.warnings, 'module.warnings', CONTRACT.maxLogEntries); m.warnings.forEach(w => string(w, 'module warning'));
  }
  array(value.log, 'state.log', CONTRACT.maxLogEntries);
  for (const entry of value.log) {
    record(entry, 'log entry'); keys(entry, ['timeS', 'assetId', 'message', 'affectedIds', 'kind'], 'log entry');
    finiteNumber(entry.timeS, 'log.timeS', { min: 0, max: value.timeS, unit: 's' });
    string(entry.assetId, 'log.assetId', CONTRACT.maxAssetIdLength); string(entry.message, 'log.message');
    if (!assetKnown(entry.assetId) || !['command', 'controller', 'warning'].includes(String(entry.kind))) failure('invalid-input', 'STATE_LOG', 'Invalid causal trace asset or kind.');
    array(entry.affectedIds, 'log.affectedIds', CONTRACT.maxModules);
    for (const id of entry.affectedIds) if (typeof id !== 'string' || !moduleIds.has(id)) failure('invalid-input', 'STATE_LOG_SCOPE', 'Invalid causal trace module scope.');
  }
  validateExperimentRun(design, value as unknown as SimulationState);
}
