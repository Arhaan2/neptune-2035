import { resolveAsset } from '../assets/design';
import type { Design, Observation } from '../types';

/** The mapping is a user-reviewed import contract, never guessed from a CSV header. */
export interface ObservationMapping {
  fields?: Partial<Record<keyof Observation, string>>;
  assetIds?: Record<string, string>;
  metrics?: Record<string, string>;
  sourceId?: string;
  evidence?: Observation['evidence'];
  /** Explicit remapping is allowed, and recorded in quality; original input stays in raw. */
  mappingVersion?: string;
  receivedAt?: string;
}
export interface ObservationError { row: number; code: string; message: string }
export interface RawObservation { row: number; value: unknown }
export interface ImportResult { raw: RawObservation[]; accepted: Observation[]; errors: ObservationError[] }
export type NormalizationResult = { ok: true; observation: Observation } | { ok: false; code: string; message: string };

type MetricDefinition = { unit: string; min: number; max: number; conversions: Record<string, (value: number) => number> };
const identity = (value: number) => value;
const kelvin = { K: identity, C: (v: number) => v + 273.15, '°C': (v: number) => v + 273.15, F: (v: number) => (v - 32) * 5 / 9 + 273.15, '°F': (v: number) => (v - 32) * 5 / 9 + 273.15 };
/** Bounded ingestion ranges are validity screens, not component safety limits. */
export const METRICS: Readonly<Record<string, MetricDefinition>> = {
  temperatureK: { unit: 'K', min: 0, max: 1_000, conversions: kelvin },
  airTemperatureK: { unit: 'K', min: 0, max: 1_000, conversions: kelvin },
  flowM3S: { unit: 'm3/s', min: 0, max: 1_000, conversions: { 'm3/s': identity, 'm³/s': identity, 'L/s': v => v / 1_000, 'L/min': v => v / 60_000, 'm3/h': v => v / 3_600 } },
  seawaterFlowM3S: { unit: 'm3/s', min: 0, max: 1_000, conversions: { 'm3/s': identity, 'm³/s': identity, 'L/s': v => v / 1_000, 'L/min': v => v / 60_000 } },
  powerW: { unit: 'W', min: 0, max: 1e12, conversions: { W: identity, kW: v => v * 1_000, MW: v => v * 1e6 } },
  pumpPowerW: { unit: 'W', min: 0, max: 1e12, conversions: { W: identity, kW: v => v * 1_000, MW: v => v * 1e6 } },
  batteryWh: { unit: 'Wh', min: 0, max: 1e13, conversions: { Wh: identity, kWh: v => v * 1_000, MWh: v => v * 1e6, J: v => v / 3_600 } },
  pressurePa: { unit: 'Pa', min: 0, max: 1e9, conversions: { Pa: identity, kPa: v => v * 1_000, bar: v => v * 100_000 } },
  workloadFraction: { unit: '1', min: 0, max: 1, conversions: { '1': identity, '%': v => v / 100 } },
};

export function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!parts || !Number.isFinite(Date.parse(value))) return false;
  const [, year, month, day, hour, minute, second] = parts.map(Number);
  const days = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1] && hour < 24 && minute < 60 && second < 60;
}
function numeric(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const fail = (code: string, message: string): NormalizationResult => ({ ok: false, code, message });

export function validateObservationMapping(value: unknown): ObservationMapping {
  if (!isRecord(value)) throw new Error('Mapping JSON must be an object.');
  const allowed = ['fields', 'assetIds', 'metrics', 'sourceId', 'evidence', 'mappingVersion', 'receivedAt'];
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new Error('Unknown mapping option. Use fields, assetIds, metrics, sourceId, evidence, mappingVersion, or receivedAt.');
  for (const key of ['fields', 'assetIds', 'metrics']) if (value[key] !== undefined && (!isRecord(value[key]) || Object.keys(value[key]).length > 1_000 || Object.values(value[key]).some(v => typeof v !== 'string' || v.length > 256))) throw new Error(`${key} must be a bounded dictionary of strings.`);
  for (const key of ['sourceId', 'mappingVersion', 'receivedAt']) if (value[key] !== undefined && (typeof value[key] !== 'string' || value[key].length > 256)) throw new Error(`${key} must be a bounded string.`);
  if (value.evidence !== undefined && value.evidence !== 'generated' && value.evidence !== 'measured') throw new Error('Mapping evidence must be generated or measured.');
  return value as ObservationMapping;
}

export function normalizeObservation(raw: unknown, design: Design, mapping: ObservationMapping = {}): NormalizationResult {
  if (!isRecord(raw)) return fail('schema', 'Observation must be an object.');
  const field = (name: keyof Observation) => raw[mapping.fields?.[name] ?? name];
  const rawAsset = field('assetId');
  const assetId = typeof rawAsset === 'string' ? mapping.assetIds && Object.hasOwn(mapping.assetIds, rawAsset) ? mapping.assetIds[rawAsset] : rawAsset : null;
  if (!assetId || !resolveAsset(design, assetId)) return fail('asset', `Unknown asset mapping: ${String(rawAsset).slice(0, 128)}.`);
  const rawMetric = field('metric');
  const metric = typeof rawMetric === 'string' ? mapping.metrics && Object.hasOwn(mapping.metrics, rawMetric) ? mapping.metrics[rawMetric] : rawMetric : '';
  const spec = Object.hasOwn(METRICS, metric) ? METRICS[metric] : undefined;
  if (!spec) return fail('metric', `Unsupported metric: ${String(rawMetric).slice(0, 80)}.`);
  const unit = field('unit');
  if (typeof unit !== 'string' || !Object.hasOwn(spec.conversions, unit)) return fail('unit', `Unit ${String(unit).slice(0, 32)} is incompatible with ${metric}.`);
  const inputValue = numeric(field('value'));
  if (inputValue === null) return fail('value', 'Value must be a finite number.');
  const value = spec.conversions[unit](inputValue);
  if (!Number.isFinite(value) || value < spec.min || value > spec.max) return fail('range', `${metric} outside ingestion range ${spec.min}–${spec.max} ${spec.unit}.`);
  const sourceId = mapping.sourceId ?? field('sourceId');
  const evidence = mapping.evidence ?? field('evidence');
  if (evidence !== 'generated' && evidence !== 'measured') return fail('evidence', 'Evidence must explicitly be generated or measured; imports do not imply measurement.');
  if (field('evidence') === 'generated' && evidence === 'measured') return fail('evidence-promotion', 'Explicitly generated input cannot be relabelled as measured evidence.');
  if (typeof sourceId !== 'string' || sourceId.length > 128 || !/^(generated|measured):[A-Za-z0-9._:/-]+$/.test(sourceId)) return fail('source', 'Source ID must be namespaced generated: or measured: and contain only safe identifier characters.');
  if (!sourceId.startsWith(`${evidence}:`)) return fail('source-evidence', 'Source namespace and evidence disagree. Change source identity explicitly.');
  const rawVersion = field('mappingVersion');
  const mappingVersion = mapping.mappingVersion ?? rawVersion;
  if (mappingVersion !== design.revision) return fail('version', `Mapping version must match design revision ${design.revision}.`);
  const observedAt = field('observedAt');
  const receivedAt = mapping.receivedAt ?? field('receivedAt');
  if (!validTimestamp(observedAt) || !validTimestamp(receivedAt)) return fail('time', 'Observation and reception timestamps must be ISO 8601 with a time zone.');
  const sequence = numeric(field('sequence'));
  if (sequence === null || !Number.isSafeInteger(sequence) || sequence < 0) return fail('sequence', 'Sequence must be a nonnegative safe integer.');
  const rawQuality = field('quality');
  const quality: unknown = rawQuality === undefined || rawQuality === '' ? [] : typeof rawQuality === 'string' ? rawQuality.split('|') : rawQuality;
  if (!Array.isArray(quality) || quality.length > 32 || quality.some(q => typeof q !== 'string' || q.length > 80 || !/^[a-zA-Z0-9._:-]+$/.test(q))) return fail('quality', 'Quality must be up to 32 short flags, or pipe-delimited CSV flags.');
  const flags = [...quality] as string[];
  if (unit !== spec.unit) flags.push('unit-converted');
  if (mapping.mappingVersion && rawVersion !== mappingVersion) flags.push('explicit-version-remap');
  if (mapping.sourceId && field('sourceId') !== sourceId) flags.push('explicit-source-remap');
  return { ok: true, observation: { assetId, metric, value, unit: spec.unit, sourceId, evidence, observedAt: new Date(observedAt).toISOString(), receivedAt: new Date(receivedAt).toISOString(), sequence, quality: [...new Set(flags)], mappingVersion } };
}

/** RFC 4180-style quoted cells and embedded newlines; no spreadsheet evaluation. */
export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false, closedQuote = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else cell += char;
    } else if (char === ',' || char === '\n' || char === '\r') {
      row.push(cell); cell = ''; closedQuote = false;
      if (char !== ',') {
        if (char === '\r' && input[i + 1] === '\n') i++;
        if (row.some(v => v.length > 0)) rows.push(row);
        row = [];
      }
    } else if (char === '"' && cell === '' && !closedQuote) quoted = true;
    else {
      if (closedQuote || char === '"') throw new Error('Malformed CSV quoting.');
      cell += char;
    }
  }
  if (quoted) throw new Error('Unterminated CSV quoted field.');
  row.push(cell);
  if (row.some(v => v.length > 0)) rows.push(row);
  return rows;
}

export function importObservations(text: string, format: 'csv' | 'json', design: Design, mapping: ObservationMapping = {}): ImportResult {
  const result: ImportResult = { raw: [], accepted: [], errors: [] };
  if (new TextEncoder().encode(text).length > 2_097_152) return { ...result, errors: [{ row: 0, code: 'size', message: 'Import exceeds 2 MiB.' }] };
  try {
    if (format === 'json') {
      const input: unknown = JSON.parse(text);
      let rows: unknown[];
      if (Array.isArray(input)) rows = input;
      else if (isRecord(input) && input.schemaVersion === 2 && Array.isArray(input.observations)) rows = input.observations;
      else throw new Error('Expected an observation array or {schemaVersion:2, observations:[...]}.');
      result.raw = rows.map((value, i) => ({ row: i + 1, value }));
    } else if (format === 'csv') {
      const [headers, ...rows] = parseCSV(text);
      if (!headers || headers.some(h => h === '') || new Set(headers).size !== headers.length) throw new Error('CSV needs unique nonempty column headers.');
      result.raw = rows.map((values, i) => ({ row: i + 2, value: values.length === headers.length ? Object.fromEntries(headers.map((key, j) => [key, values[j]])) : values }));
    } else throw new Error('Unsupported import format.');
    if (result.raw.length > 20_000) throw new Error('Import exceeds 20,000 observations.');
    for (const { row, value } of result.raw) {
      const normalized = normalizeObservation(value, design, mapping);
      if (normalized.ok) result.accepted.push(normalized.observation);
      else result.errors.push({ row, code: normalized.code, message: normalized.message });
    }
  } catch (error) {
    result.accepted = [];
    result.errors.push({ row: 0, code: 'parse', message: error instanceof Error ? error.message : 'Unable to parse observations.' });
  }
  return result;
}
