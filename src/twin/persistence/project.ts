import { modelForDesign, algorithmForDesign } from '../transfer/version';
import { engineeringIdentity, historicalEngineeringIdentity } from '../catalog/equipment';
import { buildDesign, migrateLegacyDesign, validateConfig } from '../assets/design';
import { failure, finiteNumber, SimulationError } from '../safety';
import { SOLVER_VERSION, type Design, type SimulationState } from '../types';
import { validateDesign } from './design';
import { eventOrder, validateEvents } from './events';
import { CONTRACT } from './limits';
import { validateState } from './state';
import { array, identity, keys, preflightJSON, record, safeJSON, string, validateStructure } from './structure';
import type { CurrentProject, ProjectCompatibility, ProjectFile, ProjectProvenance } from './types';
export type { ProjectFile, CurrentProject, ProjectProvenance } from './types';

function validateProvenance(value: unknown): asserts value is ProjectProvenance {
  record(value, 'provenance'); keys(value, ['origin', 'sourceIds', 'assumptions', 'parent'], 'provenance');
  if (value.origin !== 'simulated' || value.assumptions !== 'design-stage-reference') failure('invalid-input', 'PROJECT_PROVENANCE', 'Project must retain its simulated, design-stage reference assumptions. Measured/generated observations remain separate.');
  array(value.sourceIds, 'provenance.sourceIds', 32); value.sourceIds.forEach(s => string(s, 'sourceId'));
  if (Object.hasOwn(value, 'parent')) {
    record(value.parent, 'provenance.parent'); keys(value.parent, ['identity', 'schemaVersion', 'solverVersion', 'modelId', 'algorithmId', 'action'], 'parent');
    for (const key of ['identity', 'solverVersion', 'modelId', 'algorithmId']) string(value.parent[key], `parent.${key}`, 100);
    finiteNumber(value.parent.schemaVersion, 'parent.schemaVersion', { min: 2, max: 3, integer: true });
    if (value.parent.action !== 'recalculate-current-model') failure('invalid-input', 'PROJECT_PARENT', 'Unknown derived-experiment action.');
  }
}
function validateProject(value: unknown): asserts value is ProjectFile {
  validateStructure(value); record(value, 'project');
  if (value.kind !== 'neptune-project' || value.sourceMode !== 'simulated') failure('invalid-input', 'PROJECT_KIND', 'Unsupported project kind/source mode. Open v1 shared links in Legacy mode.');
  if (value.schemaVersion !== 2 && value.schemaVersion !== CONTRACT.projectSchema) failure('unsupported-configuration', 'PROJECT_SCHEMA', 'Unsupported structural project version; current session retained.');
  keys(value, ['schemaVersion', 'kind', 'design', 'events', 'timeS', 'sourceMode', 'solverVersion', ...(value.schemaVersion === 3 ? ['designSnapshot', 'modelId', 'algorithmId', 'checkpoint', 'provenance', 'execution'] : [])], 'project');
  const config = validateConfig(value.design);
  if (JSON.stringify(value.design) !== JSON.stringify(config)) {
    record(value.design, 'project.design'); keys(value.design, Object.keys(config), 'project.design');
  }
  finiteNumber(value.timeS, 'project.timeS', { min: 0, max: CONTRACT.horizonS, integer: true, unit: 's' });
  string(value.solverVersion, 'project.solverVersion', 100);
  if (!value.solverVersion) failure('invalid-input', 'PROJECT_VERSION', 'Numerical solver identity is required.');
  if (value.schemaVersion === 2) {
    validateEvents(buildDesign(config), value.events, false); return;
  }
  validateDesign(value.designSnapshot);
  if (identity(config) !== identity(value.designSnapshot.config)) failure('invalid-input', 'PROJECT_DESIGN_BINDING', 'Design snapshot/configuration mismatch.');
  validateEvents(value.designSnapshot, value.events);
  for (const key of ['modelId', 'algorithmId']) { string(value[key], key, 100); if (!value[key]) failure('invalid-input', 'PROJECT_VERSION', `${key} is required.`); }
  validateProvenance(value.provenance);
  if (identity(value.provenance.sourceIds) !== identity(value.designSnapshot.sourceIds)) failure('invalid-input', 'PROJECT_SOURCE_BINDING', 'Source provenance disagrees with the saved design.');
  if (value.checkpoint !== null) {
    record(value.checkpoint, 'checkpoint'); keys(value.checkpoint, ['boundary', 'configIdentity', 'state'], 'checkpoint');
    const configIdentity=value.solverVersion==='2.3.0'?historicalEngineeringIdentity(value.designSnapshot,'2.3.0'):engineeringIdentity(value.designSnapshot);
    if (value.checkpoint.boundary !== 'after-events-and-controller' || value.checkpoint.configIdentity !== configIdentity) failure('invalid-input', 'CHECKPOINT_BINDING', 'Checkpoint boundary or design identity mismatch.');
    validateState(value.designSnapshot, value.checkpoint.state, { allowDifferentSolver: true, ...(value.solverVersion==='2.3.0'?{inspectionSolverVersion:'2.3.0' as const}:{}) });
    if (value.checkpoint.state.timeS !== value.timeS || value.checkpoint.state.solverVersion !== value.solverVersion || identity(value.checkpoint.state.events) !== identity(value.events)) failure('invalid-input', 'CHECKPOINT_HISTORY', 'Checkpoint clock, solver or event history mismatch; explicit migration cannot repair inconsistent data.');
  }
  if (Object.hasOwn(value, 'execution')) {
    record(value.execution, 'execution'); keys(value.execution, ['targetTimeS', 'status', 'kind'], 'execution');
    finiteNumber(value.execution.targetTimeS, 'execution.targetTimeS', { min: value.timeS, max: CONTRACT.horizonS, integer: true, unit: 's' });
    if (value.execution.status !== 'paused' || !['advance', 'replay'].includes(String(value.execution.kind))) failure('invalid-input', 'PROJECT_EXECUTION', 'Saved execution must be a paused advance/replay target.');
  }
}
export function projectFile(design: Design, state: SimulationState, options: { provenance?: ProjectProvenance; execution?: CurrentProject['execution'] } = {}): CurrentProject {
  validateDesign(design); validateState(design, state);
  const project: CurrentProject = {
    schemaVersion: CONTRACT.projectSchema, kind: 'neptune-project', design: design.config, designSnapshot: design,
    events: state.events, timeS: state.timeS, sourceMode: 'simulated', solverVersion: state.solverVersion,
    modelId: modelForDesign(design), algorithmId: algorithmForDesign(design),
    checkpoint: { boundary: 'after-events-and-controller', configIdentity: engineeringIdentity(design), state: { ...state, solverMs: 0 } },
    provenance: options.provenance ?? { origin: 'simulated', sourceIds: design.sourceIds, assumptions: 'design-stage-reference' },
    ...(options.execution ? { execution: options.execution } : {}),
  };
  validateProject(project);
  // The detached snapshot cannot subsequently be changed by a UI/worker mutation.
  return JSON.parse(safeJSON(project)) as CurrentProject;
}
export function parseProject(text: string): ProjectFile {
  if (typeof text !== 'string') failure('invalid-input', 'PROJECT_TEXT', 'Project input must be JSON text.');
  try { preflightJSON(text); const value: unknown = JSON.parse(text); validateProject(value); return value; }
  catch (error) {
    if (error instanceof SimulationError) throw error;
    failure('invalid-input', 'PROJECT_PARSE', `Invalid project: ${error instanceof Error ? error.message : 'malformed JSON'}`);
  }
}
export function serializeProject(project: ProjectFile): string { validateProject(project); return safeJSON(project); }
export function normalizeProject(project: ProjectFile): ProjectFile {
  const copy = parseProject(serializeProject(project));
  if (copy.schemaVersion === 3 && copy.checkpoint) copy.checkpoint.state.solverMs = 0;
  return copy;
}
export function compatibilityFor(project: ProjectFile): ProjectCompatibility {
  validateProject(project);
  if (project.schemaVersion === 2) return { mode: 'scenario-only', canResume: false, canRecalculate: true, explanation: `Legacy schema 2 / solver ${project.solverVersion} contains scenario inputs and history, without battery/controller continuation state. Inspect or export the original; explicitly recalculate a separate experiment with the current model.` };
  if (project.modelId !== modelForDesign(project.designSnapshot) || project.algorithmId !== algorithmForDesign(project.designSnapshot) || project.solverVersion !== SOLVER_VERSION) return { mode: 'inspection-only', canResume: false, canRecalculate: true, explanation: `Saved model ${project.modelId}, algorithm ${project.algorithmId}, solver ${project.solverVersion} is unavailable in this runtime. Exact resume/replay is disabled. Archived source is not executable compatibility; explicit recalculation creates a separate derived experiment.` };
  if (!project.checkpoint) return { mode: 'scenario-only', canResume: false, canRecalculate: true, explanation: 'Scenario inputs and events are preserved. No dynamic checkpoint exists; calculation starts from declared initial conditions.' };
  return { mode: 'exact-checkpoint', canResume: true, canRecalculate: true, explanation: 'Compatible model, algorithm and complete checkpoint. Resume preserves physical state, controllers, integration settings and event position.' };
}
export function restoreProject(project: ProjectFile): { design: Design; state: SimulationState } {
  if (!compatibilityFor(project).canResume || project.schemaVersion !== 3 || !project.checkpoint) failure('unsupported-configuration', 'EXACT_RESTORE_UNAVAILABLE', compatibilityFor(project).explanation);
  const detached = normalizeProject(project) as CurrentProject;
  return { design: detached.designSnapshot, state: detached.checkpoint!.state };
}
export function recalculateProject(project: ProjectFile): CurrentProject {
  validateProject(project);
  // Existing representation remains unchanged; a numerical recalculation does not redesign equipment.
  const design = project.schemaVersion === 3 ? migrateLegacyDesign(project.designSnapshot) : buildDesign(project.design);
  const events = project.events.map((e, i) => ({ ...e, sequence: project.schemaVersion === 2 ? i : e.sequence! })).sort(eventOrder);
  const derived: CurrentProject = {
    schemaVersion: 3, kind: 'neptune-project', design: design.config, designSnapshot: design, events, timeS: project.timeS,
    sourceMode: 'simulated', solverVersion: SOLVER_VERSION, modelId: modelForDesign(design), algorithmId: algorithmForDesign(design), checkpoint: null,
    provenance: { origin: 'simulated', sourceIds: design.sourceIds, assumptions: 'design-stage-reference', parent: {
      identity: identity(normalizeProject(project)), schemaVersion: project.schemaVersion, solverVersion: project.solverVersion,
      modelId: project.schemaVersion === 3 ? project.modelId : 'legacy-unspecified', algorithmId: project.schemaVersion === 3 ? project.algorithmId : 'legacy-unspecified', action: 'recalculate-current-model',
    } },
  };
  validateProject(derived); return JSON.parse(safeJSON(derived)) as CurrentProject;
}
