/** NEPTUNE design-stage contract v2. SI throughout; temperatures are kelvin. */
export const TWIN_SCHEMA = 2 as const;
export const SOLVER_VERSION = '2.2.0';
import type { EquipmentConfiguration } from './catalog/equipment';
import type { IntegrationStep } from './persistence/limits';
import type { FailureDiagnostic } from './safety';
export type Vec3 = [number, number, number];
export type EvidenceKind = 'sourced' | 'assumed' | 'derived' | 'generated' | 'measured';
export type AssetType = 'platform' | 'hull' | 'module' | 'rack' | 'compute' | 'cdu' | 'exchanger' | 'pump' | 'valve' | 'pipe' | 'transformer' | 'switchboard' | 'battery' | 'network' | 'external';
export type Medium = 'power' | 'technical' | 'seawater' | 'cluster' | 'external-network';
export type EquipmentState = 'available' | 'starting' | 'running' | 'standby' | 'isolated' | 'failed' | 'maintenance' | 'unknown';
export interface Port { id: string; medium: Medium; direction: 'in' | 'out' | 'bidirectional'; capacity: number; unit: string }
export interface Asset {
  id: string; type: AssetType; name: string; parentId: string | null; catalogId: string;
  revision: string; dimensionsM: Vec3; positionM: Vec3; operationalMassKg: number | null;
  ratings: Record<string, number>; ports: Port[]; failureDomain: string; provenance: string[];
}
export interface Connection { id: string; from: string; fromPort: string; to: string; toPort: string; medium: Medium; capacity: number; enabled: boolean; routeM: Vec3[]; allowanceM: number }
export interface DesignConfig {
  schemaVersion: 2; generation: 1 | 2 | 3; requestedAccelerators: number; supplyW: number;
  standbyPumps: 0 | 1; seawaterK: number; workload: number; idleFraction: number;
  exchangerUAWPerK: number; foulingResistanceKPerW: number; batteryWhPerModule: number;
  batteryMaxWPerModule: number; pumpSpeed: number; requireExternalNetwork: boolean;
  requireClusterNetwork: boolean; budgetUSD: number | null;
}
export interface ModuleSpec { id: string; platformId: string; powerDomainId: string; networkDomainId: string; nodeCount: number; rackCount: number; positionM: Vec3 }
export interface Design {
  schemaVersion: 2; revision: string; config: DesignConfig; assets: Asset[]; connections: Connection[];
  modules: ModuleSpec[]; nodeCount: number; rackCount: number; provisionedAccelerators: number;
  installedPeakITW: number; sourceIds: string[];
  equipment?: EquipmentConfiguration;
}
export interface ModuleState {
  id: string; coolantK: number; airK: number; batteryWh: number; throttle: number;
  states: Record<string, EquipmentState>; startAtS: Record<string, number>;
  technicalFlowM3S: number; seawaterFlowM3S: number; pumpPowerW: number;
  itW: number; facilityW: number; gridW: number; batteryDischargeW: number; batteryChargeW: number;
  rejectedHeatW: number; thermalResidualW: number; electricalResidualW: number;
  technicalOutletK: number; seawaterOutletK: number; pressurePa: number;
  energizedNodes: number; availableAccelerators: number; warnings: string[];
}
export type EventKind = 'trip' | 'restore' | 'maintenance' | 'workload' | 'seawater' | 'fouling' | 'pump-speed';
export interface OperationEvent { id: string; timeS: number; kind: EventKind; assetId: string; value?: number; sequence?: number }
export interface CausalEntry { timeS: number; assetId: string; message: string; affectedIds: string[]; kind: 'command' | 'controller' | 'warning' }
export interface SimulationState {
  schemaVersion: 3; designRevision: string; designIdentity: string; solverVersion: string; timeS: number;
  integrationStepS: IntegrationStep; stepIndex: number;
  modules: ModuleState[]; events: OperationEvent[]; log: CausalEntry[];
  facilityEnergyWh: number; itEnergyWh: number; gridEnergyWh: number;
  appliedEventIds: string[]; workload: number; seawaterK: number; foulingResistanceKPerW: number;
  pumpSpeed: number; failedAssetIds: string[]; solverMs: number;
}
export interface Summary {
  timeS: number; itW: number; facilityW: number; gridW: number; pumpPowerW: number;
  availableAccelerators: number; energizedAccelerators: number; curtailedAccelerators: number;
  maxCoolantK: number; batteryWh: number; instantaneousPUE: number | null; energyPUE: number | null;
  electricalResidualW: number; thermalResidualW: number; warnings: string[];
}
export interface WorkerRequest { diagnostics?: boolean; version: 2; requestId: number; epoch: number; kind: 'initialize' | 'advance' | 'replay' | 'restore' | 'cancel'; design?: Design; state?: SimulationState; events?: OperationEvent[]; durationS?: number; chunkS?: number; integrationStepS?: IntegrationStep }
export interface WorkerResponse { version: 2; requestId: number; epoch: number; state?: SimulationState; error?: string; diagnostic?: FailureDiagnostic; status?: 'progress' | 'complete' | 'cancelled' | 'failed' | 'resource-limited'; progress?: { completedTimeS: number; targetTimeS: number; completedWork: number; totalWork: number } }
export interface Observation {
  assetId: string; metric: string; value: number; unit: string; sourceId: string;
  evidence: 'generated' | 'measured'; observedAt: string; receivedAt: string; sequence: number;
  quality: string[]; mappingVersion: string;
}
export interface Constraint { id: string; title: string; status: 'satisfied' | 'violated' | 'unsupported' | 'unassessed'; detail: string; assetId?: string }
