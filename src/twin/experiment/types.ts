import type { CausalEntry, OperationEvent, SimulationState } from '../types';
import type { IntegrationStep } from '../persistence/limits';

export const METRICS_VERSION = 'whole-run-1' as const;
export const EXPERIMENT_VERSION = 1 as const;
export const EXPERIMENT_LIMITS = Object.freeze({ traceSamples: 600, evidenceEntries: 1000, demandChanges: 1000 });
export interface RecoveryCriteria {
  dwellS: number;
  capacityToleranceAccelerators: number;
  coolantLimitK: number;
  airLimitK: number;
  temperatureToleranceK: number;
  thermalComparator: 'strictly-below';
  scope: 'all-modules-and-required-service';
}
export interface SettlingCriteria {
  maxWarmupS: number;
  dwellS: number;
  maxTemperatureRateKPerS: number;
  maxBatteryRateWhPerS: number;
  requireControllerQuiescence: boolean;
  requireService: boolean;
  requireThermal: boolean;
}
export interface SuccessCriteria {
  maxShortfallAcceleratorS: number;
  maxServiceViolationS: number;
  maxThermalViolationS: number;
  requireRecovery: boolean;
}
export type PhysicalCheckpoint = Omit<SimulationState, 'experiment'>;
export interface ExperimentDefinition {
  version: 1;
  id: string;
  name: string;
  designRevision: string;
  physicalIdentity: string;
  modelId: string;
  solverVersion: string;
  algorithmId: string;
  metricsVersion: typeof METRICS_VERSION;
  integrationStepS: IntegrationStep;
  durationS: number;
  workload: {
    requiredAccelerators: number;
    requiredCapacitySchedule: { timeS: number; requiredAccelerators: number }[];
    utilization: number;
    profile: string;
    requireClusterNetwork: boolean;
    requireExternalNetwork: boolean;
  };
  environment: { seawaterK: number; foulingResistanceKPerW: number; pumpSpeed: number };
  controllerPolicy: string;
  initial: { mode: 'cold' | 'settled'; settling: SettlingCriteria | null; includeWarmupInEvaluation: false };
  disturbances: OperationEvent[];
  recovery: RecoveryCriteria;
  success: SuccessCriteria;
  provenance: { source: 'simulated-definition'; parentDefinitionId: string | null; note: string };
}
export interface TemperatureObservation { assetId: string; domain: 'coolant' | 'air'; kelvin: number | null }
export interface MetricSample {
  timeS: number;
  requiredAccelerators: number;
  serviceableAccelerators: number | null;
  energizedAccelerators: number | null;
  temperatures: TemperatureObservation[];
  batteryWh: number | null;
}
/** Actual dispatch for [startS,endS), thermal values held from the interval start. */
export interface MetricInterval {
  startS: number;
  endS: number;
  sample: MetricSample;
  batteryDischargeWh: number | null;
  batteryChargeWh: number | null;
  batteryLossWh: number | null;
}
export interface Extremum { value: number; timeS: number; assetId: string; domain: string }
export interface ViolationInterval { startS: number; endS: number; service: boolean; thermal: boolean; unavailable: boolean }
export interface RecoveryEpisode {
  referenceTimeS: number;
  referenceEventId: string | null;
  onsetTimeS: number | null;
  confirmationTimeS: number | null;
}
export interface RecoveryReport {
  status: 'no-qualifying-interruption' | 'recovered' | 'not-recovered' | 'incomplete-observation';
  referenceTimeS: number | null;
  referenceEventId: string | null;
  onsetTimeS: number | null;
  confirmationTimeS: number | null;
  onsetElapsedS: number | null;
  confirmationElapsedS: number | null;
}
export interface ExperimentMetrics {
  version: typeof METRICS_VERSION;
  elapsedS: number;
  committedIntervals: number;
  shortfallAcceleratorS: number;
  serviceViolationS: number;
  thermalViolationS: number;
  anyViolationS: number;
  unavailableS: number;
  firstServiceViolationS: number | null;
  firstThermalViolationS: number | null;
  firstViolationS: number | null;
  minServiceable: Extremum | null;
  maxCoolant: Extremum | null;
  maxAir: Extremum | null;
  interruptionCount: number;
  longestInterruptionS: number;
  openInterruptionStartS: number | null;
  batteryDischargeWh: number | null;
  batteryChargeWh: number | null;
  batteryLossWh: number | null;
  initialBatteryWh: number | null;
  finalBatteryWh: number | null;
  batteryNetChangeWh: number | null;
  controllerTransitionCount: number;
  controllerTransitions: CausalEntry[];
  controllerEvidenceTruncated: boolean;
  intervals: ViolationInterval[];
  intervalEvidenceTruncated: boolean;
  trace: { timeS: number; requiredAccelerators: number; serviceableAccelerators: number | null; maxCoolantK: number | null; maxAirK: number | null }[];
  traceSamplesSeen: number;
  traceTruncated: boolean;
  recoveryEpisodes: RecoveryEpisode[];
  recoveryEpisodeCount: number;
  recoveryEvidenceTruncated: boolean;
  pendingRecovery: RecoveryEpisode | null;
  boundaryHealthy: boolean | null;
  latestReferenceEventId: string | null;
}
export type ExperimentStatus = 'running' | 'warming' | 'paused' | 'completed' | 'cancelled' | 'numerical-failed' | 'resource-limited' | 'warmup-timeout';
export interface ExperimentRun {
  extensionVersion: 1;
  definition: ExperimentDefinition;
  definitionIdentity: string;
  initialState: PhysicalCheckpoint;
  initialStateIdentity: string;
  status: ExperimentStatus;
  evaluation: { outcome: 'PASS' | 'FAIL' | 'INCOMPLETE' | 'UNAVAILABLE'; reasons: string[] };
  reason: string | null;
  originTimeS: number | null;
  committedTimeS: number;
  committedStepIndex: number;
  warmup: { elapsedS: number; candidateSinceS: number | null; settledAtS: number | null; status: 'not-requested' | 'warming' | 'settled' | 'timeout'; maxObservedTemperatureRateKPerS: number | null };
  metrics: ExperimentMetrics;
  inputs: OperationEvent[];
  inputProvenance: 'declared-and-recorded-interactive';
}
