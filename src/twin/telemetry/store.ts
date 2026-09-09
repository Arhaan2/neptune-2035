import type { Design, Observation } from '../types';
import { normalizeObservation, type ObservationMapping } from './normalize';

export interface StoreOptions { staleAfterMs?: number; maxClockSkewMs?: number; maxSamples?: number; maxStreams?: number }
export interface IngestResult { accepted: boolean; reason?: string; observation?: Observation; warnings: string[] }
export interface StoredRaw { raw: unknown; result: IngestResult }
export interface SourceBoundary { sourceId: string; reason: string; resetAt: string }
export interface ReadingStatus { status: 'fresh' | 'stale' | 'unknown'; ageMs: number | null; observation: Observation | null; reason: string }
const keyOf = (assetId: string, metric: string, sourceId: string) => JSON.stringify([assetId, metric, sourceId]);

/** Source identity is part of every key. Reading a different source is always explicit. */
export class TelemetryStore {
  readonly design: Design;
  readonly options: Required<StoreOptions>;
  readonly raw: StoredRaw[] = [];
  readonly boundaries: SourceBoundary[] = [];
  private readings = new Map<string, Observation>();
  private history: Observation[] = [];
  private listeners = new Set<() => void>();
  private revision = 0;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = (): number => this.revision;
  private publish(): void { this.revision++; for (const listener of this.listeners) listener(); }

  constructor(design: Design, options: StoreOptions = {}) {
    this.design = design;
    this.options = { staleAfterMs: 5_000, maxClockSkewMs: 2_000, maxSamples: 5_000, maxStreams: 2_000, ...options };
    if (!Object.values(this.options).every(v => Number.isFinite(v) && v > 0) || this.options.maxSamples > 50_000 || this.options.maxStreams > 20_000 || !Number.isInteger(this.options.maxSamples) || !Number.isInteger(this.options.maxStreams)) throw new RangeError('Invalid telemetry store bounds.');
  }

  ingest(raw: unknown, mapping: ObservationMapping = {}): IngestResult {
    const normalized = normalizeObservation(raw, this.design, mapping);
    let result: IngestResult;
    if (!normalized.ok) result = { accepted: false, reason: normalized.code, warnings: [normalized.message] };
    else {
      const sample = normalized.observation;
      const key = keyOf(sample.assetId, sample.metric, sample.sourceId);
      const previous = this.readings.get(key);
      const observedMs = Date.parse(sample.observedAt), receivedMs = Date.parse(sample.receivedAt);
      const warnings: string[] = [];
      if (previous && previous.evidence !== sample.evidence) result = { accepted: false, reason: 'source-collision', warnings: ['Evidence kind cannot change within a source identity.'] };
      else if (observedMs - receivedMs > this.options.maxClockSkewMs) result = { accepted: false, reason: 'clock-skew', warnings: ['Observation timestamp is too far ahead of reception time.'] };
      else if (previous && sample.sequence === previous.sequence) result = { accepted: false, reason: sample.value === previous.value && sample.observedAt === previous.observedAt ? 'duplicate' : 'sequence-conflict', warnings: [] };
      else if (previous && (sample.sequence < previous.sequence || observedMs < Date.parse(previous.observedAt))) result = { accepted: false, reason: 'out-of-order', warnings: ['Earlier sequence/time preserved as raw; latest reading is unchanged.'] };
      else if (!previous && this.readings.size >= this.options.maxStreams) result = { accepted: false, reason: 'stream-limit', warnings: ['Stream limit reached. Explicitly reset or use a smaller import.'] };
      else {
        // Simulated sequences express milliseconds, not packet counts, so only packet streams infer gaps.
        if (previous && sample.sequence > previous.sequence + 1 && !sample.quality.includes('sequence-simulated-ms')) warnings.push(`sequence-gap:${sample.sequence - previous.sequence - 1}`);
        if (receivedMs - observedMs > this.options.staleAfterMs) warnings.push('delayed');
        sample.quality = [...new Set([...sample.quality, ...warnings])];
        this.readings.set(key, sample);
        this.history.push(sample);
        if (this.history.length > this.options.maxSamples) this.history.shift();
        result = { accepted: true, observation: sample, warnings };
      }
    }
    this.raw.push({ raw: structuredClone(raw), result: structuredClone(result) });
    if (this.raw.length > this.options.maxSamples) this.raw.shift();
    this.publish();
    return structuredClone(result);
  }

  latest(assetId: string, metric: string, sourceId: string): Observation | null {
    const sample = this.readings.get(keyOf(assetId, metric, sourceId));
    return sample ? structuredClone(sample) : null;
  }

  staleness(assetId: string, metric: string, sourceId: string, nowMs = Date.now()): ReadingStatus {
    if (!Number.isFinite(nowMs)) throw new RangeError('Invalid observation clock.');
    const observation = this.latest(assetId, metric, sourceId);
    if (!observation) return { status: 'unknown', ageMs: null, observation: null, reason: 'No accepted observation for this asset, metric, and source.' };
    const observedMs = Date.parse(observation.observedAt), receivedMs = Date.parse(observation.receivedAt);
    if (observedMs > nowMs + this.options.maxClockSkewMs || receivedMs > nowMs + this.options.maxClockSkewMs) return { status: 'unknown', ageMs: null, observation, reason: 'Observation clock is ahead of the selected replay/live clock.' };
    const ageMs = Math.max(0, nowMs - observedMs, nowMs - receivedMs);
    const invalidQuality = observation.quality.some(q => q === 'bad' || q === 'invalid' || q === 'sensor-failed');
    if (invalidQuality) return { status: 'unknown', ageMs, observation, reason: 'Source marked the reading invalid.' };
    return { status: ageMs > this.options.staleAfterMs ? 'stale' : 'fresh', ageMs, observation, reason: ageMs > this.options.staleAfterMs ? `No fresh reading within ${this.options.staleAfterMs} ms. No gap filling applied.` : 'Fresh within the configured observation/reception age threshold.' };
  }

  samples(): Observation[] { return structuredClone(this.history); }
  sources(assetId: string, metric: string): string[] { return [...this.readings.values()].filter(s => s.assetId === assetId && s.metric === metric).map(s => s.sourceId).sort(); }

  /** Explicit boundary permits a publisher sequence restart; no automatic reset on reconnect. */
  resetSource(sourceId: string, reason: string, nowMs = Date.now()): void {
    if (!reason.trim()) throw new Error('A source reset requires a reason.');
    for (const [key, reading] of this.readings) if (reading.sourceId === sourceId) this.readings.delete(key);
    // Reusing sequence/time coordinates starts a new replay segment; do not interleave histories.
    this.history = this.history.filter(reading => reading.sourceId !== sourceId);
    this.boundaries.push({ sourceId, reason: reason.slice(0, 240), resetAt: new Date(nowMs).toISOString() });
    if (this.boundaries.length > 100) this.boundaries.shift();
    this.publish();
  }
}

/** Historical replay uses observation time and never silently fills gaps or mutates the solver. */
export function replayObservations(observations: readonly Observation[], design: Design, throughMs: number, options: StoreOptions = {}): TelemetryStore {
  if (!Number.isFinite(throughMs)) throw new RangeError('Invalid replay time.');
  const store = new TelemetryStore(design, options);
  const ordered = observations.filter(o => Date.parse(o.observedAt) <= throughMs).map((sample, i) => ({ sample, i })).sort((a, b) => Date.parse(a.sample.observedAt) - Date.parse(b.sample.observedAt) || a.sample.sequence - b.sample.sequence || a.i - b.i);
  for (const { sample } of ordered) store.ingest(sample);
  return store;
}
