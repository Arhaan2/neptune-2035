import type { Observation } from '../types';

export interface ResidualPair {
  assetId: string; metric: string; unit: string; mappingVersion: string;
  observedAt: string; predictedAt: string; observedValue: number; predictedValue: number;
  residual: number; relativeResidual: number | null; timeDeltaMs: number;
  observationSourceId: string; predictionSourceId: string; observationEvidence: Observation['evidence'];
}
export interface ResidualGroup {
  assetId: string; metric: string; unit: string; sourceId: string;
  count: number; bias: number; meanAbsoluteError: number; rmse: number; measuredCount: number;
}
export interface ResidualResult {
  pairs: ResidualPair[];
  unmatched: { observation: Observation; reason: string }[];
  groups: ResidualGroup[];
  validationStatus: 'Calibration/physical validation pending';
}
const channel = (sample: Observation) => JSON.stringify([sample.assetId, sample.metric, sample.unit, sample.mappingVersion]);

/** Nearest explicit prediction, without interpolation, assimilation, gap filling, or clock adjustment. */
export function calculateResiduals(observations: readonly Observation[], predictions: readonly Observation[], maxTimeDeltaMs = 1_000): ResidualResult {
  if (!Number.isFinite(maxTimeDeltaMs) || maxTimeDeltaMs < 0 || maxTimeDeltaMs > 60_000) throw new RangeError('Residual time tolerance must be 0–60,000 ms.');
  const result: ResidualResult = { pairs: [], unmatched: [], groups: [], validationStatus: 'Calibration/physical validation pending' };
  const byChannel = new Map<string, Observation[]>();
  for (const sample of predictions) {
    if (sample.evidence !== 'generated' || !Number.isFinite(sample.value) || !Number.isFinite(Date.parse(sample.observedAt))) continue;
    const key = channel(sample);
    const samples = byChannel.get(key) ?? [];
    samples.push(sample);
    byChannel.set(key, samples);
  }
  for (const samples of byChannel.values()) samples.sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  for (const observation of observations) {
    const predictionsForChannel = byChannel.get(channel(observation));
    const time = Date.parse(observation.observedAt);
    if (!predictionsForChannel?.length || !Number.isFinite(observation.value) || !Number.isFinite(time) || observation.quality.some(q => ['bad', 'invalid', 'sensor-failed'].includes(q))) {
      result.unmatched.push({ observation, reason: 'No compatible prediction or invalid observation quality/value/time.' }); continue;
    }
    let low = 0, high = predictionsForChannel.length;
    while (low < high) { const middle = Math.floor((low + high) / 2); if (Date.parse(predictionsForChannel[middle].observedAt) < time) low = middle + 1; else high = middle; }
    const candidates = [predictionsForChannel[low], predictionsForChannel[low - 1]].filter((sample): sample is Observation => Boolean(sample));
    candidates.sort((a, b) => Math.abs(Date.parse(a.observedAt) - time) - Math.abs(Date.parse(b.observedAt) - time));
    const prediction = candidates[0];
    const timeDeltaMs = Date.parse(prediction.observedAt) - time;
    if (Math.abs(timeDeltaMs) > maxTimeDeltaMs) { result.unmatched.push({ observation, reason: 'No prediction inside the allowed timestamp tolerance. No gap filling applied.' }); continue; }
    const residual = observation.value - prediction.value;
    result.pairs.push({ assetId: observation.assetId, metric: observation.metric, unit: observation.unit, mappingVersion: observation.mappingVersion, observedAt: observation.observedAt, predictedAt: prediction.observedAt, observedValue: observation.value, predictedValue: prediction.value, residual, relativeResidual: prediction.value === 0 ? null : residual / Math.abs(prediction.value), timeDeltaMs, observationSourceId: observation.sourceId, predictionSourceId: prediction.sourceId, observationEvidence: observation.evidence });
  }
  const groups = new Map<string, ResidualPair[]>();
  for (const pair of result.pairs) {
    const key = JSON.stringify([pair.assetId, pair.metric, pair.unit, pair.observationSourceId]);
    const group = groups.get(key) ?? [];
    group.push(pair); groups.set(key, group);
  }
  for (const samples of groups.values()) {
    const first = samples[0], count = samples.length;
    result.groups.push({ assetId: first.assetId, metric: first.metric, unit: first.unit, sourceId: first.observationSourceId, count, bias: samples.reduce((sum, sample) => sum + sample.residual, 0) / count, meanAbsoluteError: samples.reduce((sum, sample) => sum + Math.abs(sample.residual), 0) / count, rmse: Math.sqrt(samples.reduce((sum, sample) => sum + sample.residual ** 2, 0) / count), measuredCount: samples.filter(sample => sample.observationEvidence === 'measured').length });
  }
  return result;
}
