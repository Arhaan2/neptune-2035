import type { Design, Observation, SimulationState } from '../types';
import { METRICS } from './normalize';

export const SIMULATION_EPOCH_MS = Date.UTC(2026, 0, 1);
export interface GeneratedOptions {
  /** Relative uniform noise for non-temperature channels; kelvin noise for temperatures. */
  noiseFraction?: number;
  temperatureNoiseK?: number;
  dropout?: number;
  epochMs?: number;
  sourceId?: string;
}
function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) { result ^= value.charCodeAt(i); result = Math.imul(result, 16777619); }
  return result >>> 0;
}
function random(seed: number): number {
  let value = seed + 0x6D2B79F5;
  value = Math.imul(value ^ value >>> 15, value | 1);
  value ^= value + Math.imul(value ^ value >>> 7, value | 61);
  return ((value ^ value >>> 14) >>> 0) / 4294967296;
}

/** Generated channels are sampled from actual solver state; the clock is explicitly simulated. */
export function generateObservations(design: Design, state: SimulationState, seed = 1, options: GeneratedOptions = {}): Observation[] {
  if (state.designRevision !== design.revision) throw new Error('Cannot sample state from a different design revision.');
  const { noiseFraction = 0, temperatureNoiseK = 0, dropout = 0, epochMs = SIMULATION_EPOCH_MS, sourceId = `generated:simulation-${seed}` } = options;
  if (![seed, state.timeS, epochMs, noiseFraction, temperatureNoiseK, dropout].every(Number.isFinite) || state.timeS < 0 || noiseFraction < 0 || noiseFraction > 0.5 || temperatureNoiseK < 0 || temperatureNoiseK > 20 || dropout < 0 || dropout > 1) throw new RangeError('Invalid generation options.');
  if (!/^generated:[A-Za-z0-9._:/-]+$/.test(sourceId) || sourceId.length > 128) throw new Error('Generated telemetry needs an explicitly generated source identity.');
  const observedAt = new Date(epochMs + Math.round(state.timeS * 1_000)).toISOString();
  // Sequence identifies the simulated millisecond, making repeated state sampling idempotent.
  const sequence = Math.round(state.timeS * 1_000);
  if (!Number.isSafeInteger(sequence)) throw new RangeError('Simulation time exceeds sequence bounds.');
  const observations: Observation[] = [];
  const moduleIds = new Set(design.modules.map(m => m.id));
  for (const moduleState of state.modules) {
    if (!moduleIds.has(moduleState.id)) throw new Error(`State references unknown module ${moduleState.id}.`);
    const channels: [string, number][] = [
      ['temperatureK', moduleState.coolantK], ['airTemperatureK', moduleState.airK],
      ['flowM3S', moduleState.technicalFlowM3S], ['seawaterFlowM3S', moduleState.seawaterFlowM3S],
      ['powerW', moduleState.itW], ['pumpPowerW', moduleState.pumpPowerW],
      ['batteryWh', moduleState.batteryWh], ['pressurePa', moduleState.pressurePa],
    ];
    for (const [metric, truth] of channels) {
      if (!Number.isFinite(truth)) throw new Error(`Non-finite solver channel ${moduleState.id}/${metric}.`);
      const key = `${seed}:${moduleState.id}:${metric}:${sequence}`;
      if (random(hash(`${key}:dropout`)) < dropout) continue;
      const amplitude = metric.endsWith('TemperatureK') || metric === 'temperatureK' ? temperatureNoiseK : Math.abs(truth) * noiseFraction;
      const value = truth + (2 * random(hash(`${key}:noise`)) - 1) * amplitude;
      observations.push({ assetId: moduleState.id, metric, value, unit: METRICS[metric].unit, sourceId, evidence: 'generated', observedAt, receivedAt: observedAt, sequence, quality: ['simulated-clock', 'sequence-simulated-ms', ...(amplitude > 0 ? ['seeded-noise'] : [])], mappingVersion: design.revision });
    }
  }
  return observations;
}
