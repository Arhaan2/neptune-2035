import type { Design, DesignConfig, OperationEvent, SimulationState } from '../types';
export interface ProjectProvenance {
  origin: 'simulated';
  sourceIds: string[];
  assumptions: 'design-stage-reference';
  parent?: { identity: string; schemaVersion: number; solverVersion: string; modelId: string; algorithmId: string; action: 'recalculate-current-model' };
}
export interface Checkpoint {
  boundary: 'after-events-and-controller';
  configIdentity: string;
  state: SimulationState;
}
export interface CurrentProject {
  schemaVersion: 3;
  kind: 'neptune-project';
  design: DesignConfig;
  designSnapshot: Design;
  events: OperationEvent[];
  timeS: number;
  sourceMode: 'simulated';
  solverVersion: string;
  modelId: string;
  algorithmId: string;
  checkpoint: Checkpoint | null;
  provenance: ProjectProvenance;
  execution?: { targetTimeS: number; status: 'paused'; kind: 'advance' | 'replay' };
}
export interface LegacyProject {
  schemaVersion: 2;
  kind: 'neptune-project';
  design: DesignConfig;
  events: OperationEvent[];
  timeS: number;
  sourceMode: 'simulated';
  solverVersion: string;
}
export type ProjectFile = CurrentProject | LegacyProject;
export interface ProjectCompatibility {
  mode: 'exact-checkpoint' | 'scenario-only' | 'inspection-only';
  canResume: boolean;
  canRecalculate: boolean;
  explanation: string;
}
