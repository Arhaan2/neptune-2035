import { resolveAsset } from '../assets/design';
import { solveExchanger, type ExchangerInput } from '../solvers/thermal';
import type { Design, Observation } from '../types';
import { validTimestamp } from './normalize';

export interface UACalibrationSample {
  assetId: string; mappingVersion: string; sourceId: string; evidence: Observation['evidence']; observedAt: string;
  /** Signed heat transfer, positive technical coolant → seawater. */
  observedHeatW: number;
  boundary: Omit<ExchangerInput, 'cleanUAWPerK'>;
}
export interface UACalibrationOptions { minUAWPerK?: number; maxUAWPerK?: number; trainingFraction?: number }
export interface UACalibrationResult {
  parameter: 'exchangerUAWPerK'; proposedUAWPerK: number; baselineUAWPerK: number;
  boundsWPerK: [number, number]; trainingCount: number; heldOutCount: number;
  trainingRmseBeforeW: number; trainingRmseAfterW: number; heldOutRmseBeforeW: number; heldOutRmseAfterW: number;
  iterations: number; converged: boolean; atBound: boolean; measuredCount: number;
  designRevision: string; assetId: string; sourceIds: string[]; splitAt: string;
  validationStatus: 'Calibration/physical validation pending'; warnings: string[];
}

/** Bounded 1-D least squares using the production exchanger; never changes the live design. */
export function calibrateUA(design: Design, input: readonly UACalibrationSample[], options: UACalibrationOptions = {}): UACalibrationResult {
  const min = options.minUAWPerK ?? 10_000, max = options.maxUAWPerK ?? 2_000_000, trainingFraction = options.trainingFraction ?? 0.7;
  if (![min, max, trainingFraction].every(Number.isFinite) || min < 10_000 || max > 2_000_000 || max <= min || trainingFraction < 0.5 || trainingFraction > 0.8) throw new RangeError('UA bounds must be inside 10,000–2,000,000 W/K and training fraction 0.5–0.8.');
  if (input.length < 6 || input.length > 1_000) throw new RangeError('UA calibration requires 6–1,000 chronological boundary/heat observations.');
  const samples = [...input].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const assetId = samples[0].assetId;
  if (resolveAsset(design, assetId)?.type !== 'exchanger') throw new Error('UA calibration requires an exact mapped exchanger asset.');
  for (let i = 0; i < samples.length; i++) {
    const sample = samples[i];
    if (sample.assetId !== assetId || sample.mappingVersion !== design.revision) throw new Error('Calibration samples must map to one exchanger and the current design revision.');
    if (!validTimestamp(sample.observedAt) || (i > 0 && Date.parse(sample.observedAt) <= Date.parse(samples[i - 1].observedAt))) throw new Error('Calibration timestamps must be unique, valid, and time-zoned.');
    if (!['measured', 'generated'].includes(sample.evidence) || typeof sample.sourceId !== 'string' || !sample.sourceId.startsWith(`${sample.evidence}:`) || !Number.isFinite(sample.observedHeatW) || Math.abs(sample.observedHeatW) > 1e12) throw new Error('Calibration needs finite signed heat within ±10¹² W and explicit source/evidence identity.');
    const boundary = sample.boundary;
    if (!boundary || typeof boundary !== 'object' || ['technicalInletK', 'seawaterInletK', 'technicalFlowM3S', 'seawaterFlowM3S', 'foulingResistanceKPerW'].some(key => typeof boundary[key as keyof typeof boundary] !== 'number' || !Number.isFinite(boundary[key as keyof typeof boundary]))) throw new Error('Calibration boundary is missing a required finite temperature, flow, or fouling value.');
    if (boundary.technicalFlowM3S > 1_000 || boundary.seawaterFlowM3S > 1_000) throw new Error('Calibration flow exceeds the observation ingestion range.');
    // Production solver validates boundary fluid properties and the supported operating domain.
    solveExchanger({ ...sample.boundary, cleanUAWPerK: min });
  }
  const split = Math.min(samples.length - 2, Math.max(3, Math.floor(samples.length * trainingFraction)));
  const training = samples.slice(0, split), heldOut = samples.slice(split);
  const predict = (sample: UACalibrationSample, ua: number) => solveExchanger({ ...sample.boundary, cleanUAWPerK: ua }).heatW;
  const mse = (rows: UACalibrationSample[], ua: number) => rows.reduce((sum, sample) => sum + (sample.observedHeatW - predict(sample, ua)) ** 2, 0) / rows.length;
  const span = training.reduce((sum, sample) => sum + Math.abs(predict(sample, max) - predict(sample, min)), 0) / training.length;
  if (span < 1) throw new Error('UA is unidentifiable in these boundaries: zero flow, equal temperatures, or negligible parameter sensitivity.');
  // Coarse bounded scan first: least squares with inconsistent observations need not be unimodal.
  const gridSize = 80;
  let best = min, bestScore = mse(training, min), bestIndex = 0;
  for (let i = 1; i <= gridSize; i++) {
    const ua = min + (max - min) * i / gridSize, score = mse(training, ua);
    if (score < bestScore) { best = ua; bestScore = score; bestIndex = i; }
  }
  let low = min + (max - min) * Math.max(0, bestIndex - 1) / gridSize;
  let high = min + (max - min) * Math.min(gridSize, bestIndex + 1) / gridSize;
  const ratio = (Math.sqrt(5) - 1) / 2;
  let left = high - ratio * (high - low), right = low + ratio * (high - low);
  let leftScore = mse(training, left), rightScore = mse(training, right), iterations = 0;
  for (; iterations < 80 && high - low > Math.max(0.01, best * 1e-8); iterations++) {
    if (leftScore < rightScore) { high = right; right = left; rightScore = leftScore; left = high - ratio * (high - low); leftScore = mse(training, left); }
    else { low = left; left = right; leftScore = rightScore; right = low + ratio * (high - low); rightScore = mse(training, right); }
  }
  const candidate = (low + high) / 2, candidateScore = mse(training, candidate);
  if (candidateScore < bestScore) { best = candidate; bestScore = candidateScore; }
  const atBound = Math.min(Math.abs(best - min), Math.abs(best - max)) <= Math.max(0.1, (max - min) * 1e-6);
  const measuredCount = samples.filter(sample => sample.evidence === 'measured').length;
  const baseline = design.config.exchangerUAWPerK;
  const heldOutBefore = Math.sqrt(mse(heldOut, baseline)), heldOutAfter = Math.sqrt(mse(heldOut, best));
  return { parameter: 'exchangerUAWPerK', proposedUAWPerK: best, baselineUAWPerK: baseline, boundsWPerK: [min, max], trainingCount: training.length, heldOutCount: heldOut.length, trainingRmseBeforeW: Math.sqrt(mse(training, baseline)), trainingRmseAfterW: Math.sqrt(bestScore), heldOutRmseBeforeW: heldOutBefore, heldOutRmseAfterW: heldOutAfter, iterations, converged: iterations < 80, atBound, measuredCount, designRevision: design.revision, assetId, sourceIds: [...new Set(samples.map(sample => sample.sourceId))], splitAt: heldOut[0].observedAt, validationStatus: 'Calibration/physical validation pending', warnings: [
    ...(measuredCount < samples.length ? ['Generated fixtures verify parameter fitting and data plumbing; they do not physically validate the exchanger.'] : []),
    ...(atBound ? ['Fit touches a parameter bound; inspect boundary uncertainty and model mismatch.'] : []),
    ...(heldOutAfter > heldOutBefore ? ['Held-out error worsened; do not apply this proposal.'] : []),
    'Fouling, flow, fluid properties, inlet temperatures, and heat measurements are held fixed; their errors can bias UA.',
    'The time holdout is a software evaluation, not independent physical commissioning. No parameter is applied automatically.',
  ] };
}
