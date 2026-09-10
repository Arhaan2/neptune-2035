import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { once } from 'node:events';
import { chromium } from '@playwright/test';
import ts from 'typescript';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { initialize, advance } from '../src/twin/engine/simulation';
import { solveExchanger } from '../src/twin/solvers/thermal';
import type { Observation } from '../src/twin/types';
import { calibrateUA, calculateResiduals, connectStream, generateObservations, importObservations, normalizeObservation, parseCSV, replayObservations, SIMULATION_EPOCH_MS, TelemetryStore, validateStreamURL, type EventSourceTransport, type StreamStatus, type UACalibrationSample } from '../src/twin/telemetry';
// @ts-expect-error The optional publisher is intentionally plain Node JavaScript.
import { createTelemetryPublisher } from '../scripts/telemetry-publisher.mjs';

const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1280 });
const moduleId = design.modules[0].id;
const epoch = SIMULATION_EPOCH_MS;
const time = (offsetMs = 0) => new Date(epoch + offsetMs).toISOString();
function sample(patch: Partial<Observation> = {}): Observation {
  return { assetId: moduleId, metric: 'temperatureK', value: 310.15, unit: 'K', sourceId: 'measured:test-bench', evidence: 'measured', observedAt: time(), receivedAt: time(), sequence: 0, quality: [], mappingVersion: design.revision, ...patch };
}
afterEach(() => vi.useRealTimers());

describe('telemetry normalization and explicit mappings', () => {
  it.each([
    ['temperatureK', 37, 'C', 310.15, 'K'], ['temperatureK', 98.6, 'F', 310.15, 'K'],
    ['flowM3S', 1200, 'L/min', 0.02, 'm3/s'], ['powerW', 1.2, 'MW', 1.2e6, 'W'],
    ['batteryWh', 3.6e6, 'J', 1000, 'Wh'], ['pressurePa', 2, 'bar', 200000, 'Pa'],
    ['workloadFraction', 80, '%', 0.8, '1'],
  ])('normalizes %s from %s %s', (metric, value, unit, expected, normalizedUnit) => {
    const result = normalizeObservation(sample({ metric: String(metric), value: Number(value), unit: String(unit) }), design);
    expect(result.ok).toBe(true);
    if (result.ok) { expect(result.observation.value).toBeCloseTo(Number(expected), 8); expect(result.observation.unit).toBe(normalizedUnit); }
  });
  it.each([
    [{ assetId: 'unknown/pump' }, 'asset'], [{ metric: 'mystery' }, 'metric'], [{ unit: 'kWh' }, 'unit'],
    [{ value: NaN }, 'value'], [{ value: Infinity }, 'value'], [{ value: -1 }, 'range'],
    [{ mappingVersion: 'old' }, 'version'], [{ evidence: 'generated' }, 'source-evidence'],
    [{ sourceId: 'unlabelled-sensor' }, 'source'], [{ observedAt: '2026-01-01' }, 'time'], [{ observedAt: '2026-02-30T00:00:00Z' }, 'time'],
    [{ sequence: -1 }, 'sequence'], [{ sequence: 0.5 }, 'sequence'], [{ quality: ['bad text with spaces'] }, 'quality'],
  ])('rejects invalid records %#', (patch, code) => {
    const result = normalizeObservation({ ...sample(), ...patch }, design);
    expect(result).toMatchObject({ ok: false, code });
  });
  it('validates lazy exact asset addresses', () => {
    expect(normalizeObservation(sample({ assetId: `${moduleId}/rack-01/node-01`, metric: 'powerW', value: 12000, unit: 'W' }), design).ok).toBe(true);
    expect(normalizeObservation(sample({ assetId: `${moduleId}/rack-99/node-01` }), design).ok).toBe(false);
  });
  it('imports CSV with field/asset/metric mapping and preserves original cells separately', () => {
    const csv = `sensor,channel,reading,unit,sourceId,evidence,observedAt,receivedAt,sequence,quality,mappingVersion\r\nloop-a,bulk,37,C,generated:fixture,generated,${time()},${time()},0,,fixture-v0\r\n`;
    const result = importObservations(csv, 'csv', design, { fields: { assetId: 'sensor', metric: 'channel', value: 'reading' }, assetIds: { 'loop-a': moduleId }, metrics: { bulk: 'temperatureK' }, mappingVersion: design.revision });
    expect(result.errors).toEqual([]);
    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0]).toMatchObject({ assetId: moduleId, metric: 'temperatureK', value: 310.15, quality: ['unit-converted', 'explicit-version-remap'] });
    expect(result.raw[0].value).toMatchObject({ sensor: 'loop-a', reading: '37', unit: 'C', mappingVersion: 'fixture-v0' });
  });
  it('rejects unversioned envelopes, absent evidence, incompatible mappings and malformed bounded inputs visibly', () => {
    expect(importObservations(JSON.stringify({ schemaVersion: 999, observations: [sample()] }), 'json', design).errors).toHaveLength(1);
    expect(importObservations(JSON.stringify([sample({ mappingVersion: 'other' })]), 'json', design).errors[0].code).toBe('version');
    const missingEvidence = { ...sample(), evidence: undefined };
    expect(importObservations(JSON.stringify([missingEvidence]), 'json', design).errors[0].code).toBe('evidence');
    expect(importObservations('a,a\n1,2', 'csv', design).errors[0].code).toBe('parse');
    expect(importObservations('a,b\n"broken,2', 'csv', design).errors[0].code).toBe('parse');
    expect(importObservations('x'.repeat(2_097_153), 'json', design).errors[0].code).toBe('size');
    expect(parseCSV('a,b\r\n"line\none","quote""two"\r\n')).toEqual([['a', 'b'], ['line\none', 'quote"two']]);
  });
  it('accepts good rows while preserving rejected raw rows', () => {
    const result = importObservations(JSON.stringify([sample(), sample({ value: -10 }), sample({ sourceId: 'generated:fixture', evidence: 'generated' })]), 'json', design);
    expect(result.raw).toHaveLength(3); expect(result.accepted).toHaveLength(2); expect(result.errors).toMatchObject([{ row: 2, code: 'range' }]);
  });
  it('keeps generated evidence from being promoted and rejects inherited mapping keys', () => {
    expect(normalizeObservation(sample({ evidence: 'generated', sourceId: 'generated:fixture' }), design, { sourceId: 'measured:claimed', evidence: 'measured' })).toMatchObject({ ok: false, code: 'evidence-promotion' });
    expect(normalizeObservation(sample({ assetId: 'constructor' }), design, { assetIds: {} })).toMatchObject({ ok: false, code: 'asset' });
  });
  it('validates the shipped sample pack against its declared default design', () => {
    const reference = buildDesign(DEFAULT_CONFIG);
    for (const format of ['csv', 'json'] as const) {
      const result = importObservations(readFileSync(new URL(`../public/samples/telemetry-generated.${format}`, import.meta.url), 'utf8'), format, reference);
      expect(result.errors).toEqual([]); expect(result.accepted).toHaveLength(5); expect(result.accepted[0].value).toBeCloseTo(310.15, 8);
    }
    const calibration = JSON.parse(readFileSync(new URL('../public/samples/calibration-generated.json', import.meta.url), 'utf8')) as UACalibrationSample[];
    expect(calibrateUA(reference, calibration).proposedUAWPerK).toBeCloseTo(280_000, 1);
  });
});

describe('generated telemetry is solver-derived and deterministic', () => {
  it('samples the real evolving state and is idempotent across renders', () => {
    const state = advance(design, initialize(design), 5);
    const first = generateObservations(design, state);
    expect(first).toEqual(generateObservations(design, state));
    expect(first.find(s => s.metric === 'temperatureK')?.value).toBe(state.modules[0].coolantK);
    expect(first.find(s => s.metric === 'flowM3S')?.value).toBe(state.modules[0].technicalFlowM3S);
    expect(first.every(s => s.evidence === 'generated' && s.observedAt === time(5000) && s.sequence === 5000)).toBe(true);
    expect(importObservations(JSON.stringify(first), 'json', design).errors).toEqual([]);
  });
  it('seeded noise/dropout are reproducible and never touch simulation truth', () => {
    const state = initialize(design), before = structuredClone(state);
    const options = { noiseFraction: 0.02, temperatureNoiseK: 0.2, dropout: 0.3 };
    expect(generateObservations(design, state, 4, options)).toEqual(generateObservations(design, state, 4, options));
    expect(generateObservations(design, state, 4, options)).not.toEqual(generateObservations(design, state, 5, options));
    expect(generateObservations(design, state, 1, { dropout: 1 })).toEqual([]);
    expect(state).toEqual(before);
    expect(() => generateObservations(design, state, 1, { sourceId: 'measured:bad' })).toThrow();
    expect(() => generateObservations(design, { ...state, designRevision: 'other' })).toThrow();
  });
});

describe('source-separated synchronization, staleness, and historical replay', () => {
  it('rejects duplicate/conflicting/out-of-order records and flags actual sequence gaps', () => {
    const store = new TelemetryStore(design);
    expect(store.ingest(sample()).accepted).toBe(true);
    expect(store.ingest(sample()).reason).toBe('duplicate');
    expect(store.ingest(sample({ value: 312 })).reason).toBe('sequence-conflict');
    expect(store.ingest(sample({ sequence: 3, observedAt: time(3000), receivedAt: time(3000) }))).toMatchObject({ accepted: true, warnings: ['sequence-gap:2'] });
    expect(store.ingest(sample({ sequence: 2, observedAt: time(2000) })).reason).toBe('out-of-order');
    expect(store.ingest(sample({ sequence: 4, observedAt: time(1000) })).reason).toBe('out-of-order');
    expect(store.latest(moduleId, 'temperatureK', 'measured:test-bench')?.sequence).toBe(3);
    expect(store.raw).toHaveLength(6);
  });
  it('does not treat simulated milliseconds as missing packet counts', () => {
    const store = new TelemetryStore(design);
    for (const t of [0, 1, 2]) for (const observation of generateObservations(design, advance(design, initialize(design), t))) expect(store.ingest(observation).warnings).toEqual([]);
  });
  it('enforces skew and configurable age thresholds without inventing healthy values', () => {
    const store = new TelemetryStore(design, { staleAfterMs: 1000, maxClockSkewMs: 200 });
    expect(store.staleness(moduleId, 'temperatureK', 'measured:test-bench', epoch).status).toBe('unknown');
    expect(store.ingest(sample({ observedAt: time(201) })).reason).toBe('clock-skew');
    store.ingest(sample());
    expect(store.staleness(moduleId, 'temperatureK', 'measured:test-bench', epoch + 1000).status).toBe('fresh');
    expect(store.staleness(moduleId, 'temperatureK', 'measured:test-bench', epoch + 1001).status).toBe('stale');
    expect(store.staleness(moduleId, 'temperatureK', 'measured:test-bench', epoch - 201).status).toBe('unknown');
    const delayed = store.ingest(sample({ sequence: 1, observedAt: time(1000), receivedAt: time(3000) }));
    expect(delayed.warnings).toContain('delayed');
    expect(store.staleness(moduleId, 'temperatureK', 'measured:test-bench', epoch + 3000).status).toBe('stale');
    store.ingest(sample({ sequence: 2, observedAt: time(4000), receivedAt: time(4000), quality: ['sensor-failed'] }));
    expect(store.staleness(moduleId, 'temperatureK', 'measured:test-bench', epoch + 4000).status).toBe('unknown');
  });
  it('keeps measured and generated values separate, and requires explicit restart boundaries', () => {
    const store = new TelemetryStore(design);
    store.ingest(sample({ value: 311, sequence: 10 }));
    store.ingest(sample({ value: 305, sourceId: 'generated:simulation-1', evidence: 'generated' }));
    expect(store.latest(moduleId, 'temperatureK', 'measured:test-bench')?.value).toBe(311);
    expect(store.latest(moduleId, 'temperatureK', 'generated:simulation-1')?.value).toBe(305);
    expect(store.ingest(sample({ evidence: 'generated' })).reason).toBe('source-evidence');
    expect(store.ingest(sample()).reason).toBe('out-of-order');
    store.resetSource('measured:test-bench', 'Sensor restarted; explicit operator boundary', epoch);
    expect(store.ingest(sample()).accepted).toBe(true);
    expect(store.boundaries).toHaveLength(1);
  });
  it('replays in observation order through the selected time and bounds retained memory', () => {
    const observations = [2, 0, 1].map(i => sample({ sequence: i, value: 310 + i, observedAt: time(i * 1000), receivedAt: time(i * 1000) }));
    const store = replayObservations(observations, design, epoch + 1000);
    expect(store.latest(moduleId, 'temperatureK', 'measured:test-bench')?.value).toBe(311);
    expect(store.samples()).toHaveLength(2);
    const bounded = new TelemetryStore(design, { maxSamples: 2, maxStreams: 1 });
    for (const record of observations.sort((a, b) => a.sequence - b.sequence)) bounded.ingest(record);
    expect(bounded.raw).toHaveLength(2); expect(bounded.samples()).toHaveLength(2);
    expect(bounded.ingest(sample({ metric: 'airTemperatureK' })).reason).toBe('stream-limit');
    const detached = bounded.latest(moduleId, 'temperatureK', 'measured:test-bench')!; detached.value = 0;
    expect(bounded.latest(moduleId, 'temperatureK', 'measured:test-bench')?.value).toBe(312);
  });
});

describe('residuals and bounded calibration are evidence-aware', () => {
  it('pairs only compatible versions/units/times and handles zero predictions', () => {
    const observed = [sample({ value: 312 }), sample({ metric: 'powerW', value: 20, unit: 'W' }), sample({ observedAt: time(5000), sequence: 1 })];
    const predicted = [sample({ value: 310, sourceId: 'generated:prediction', evidence: 'generated' }), sample({ metric: 'powerW', value: 0, unit: 'W', sourceId: 'generated:prediction', evidence: 'generated' })];
    const result = calculateResiduals(observed, predicted, 1000);
    expect(result.pairs.map(p => p.residual)).toEqual([2, 20]);
    expect(result.pairs[1].relativeResidual).toBeNull(); expect(result.unmatched).toHaveLength(1);
    expect(result.groups[0]).toMatchObject({ rmse: 2, measuredCount: 1 });
    expect(result.validationStatus).toBe('Calibration/physical validation pending');
    expect(calculateResiduals(observed, predicted.map(p => ({ ...p, mappingVersion: 'old' }))).pairs).toEqual([]);
  });
  const calibrationSamples = (ua = 240_000): UACalibrationSample[] => Array.from({ length: 10 }, (_, i) => {
    const boundary = { technicalInletK: 309 + i, seawaterInletK: 291 + i / 3, technicalFlowM3S: 0.05 + i / 1000, seawaterFlowM3S: 0.06, foulingResistanceKPerW: 0 };
    return { assetId: `${moduleId}/hx`, mappingVersion: design.revision, sourceId: 'generated:calibration-fixture', evidence: 'generated', observedAt: time(i * 1000), observedHeatW: solveExchanger({ ...boundary, cleanUAWPerK: ua }).heatW, boundary };
  });
  it('recovers a generated UA with chronological held-out evaluation but no physical-validation claim', () => {
    const result = calibrateUA(design, calibrationSamples(), { minUAWPerK: 100_000, maxUAWPerK: 500_000 });
    expect(result.proposedUAWPerK).toBeCloseTo(240_000, 1);
    expect(result.trainingCount).toBe(7); expect(result.heldOutCount).toBe(3);
    expect(result.trainingRmseAfterW).toBeLessThan(0.1); expect(result.heldOutRmseAfterW).toBeLessThan(0.1);
    expect(result.heldOutRmseBeforeW).toBeGreaterThan(1000);
    expect(result.measuredCount).toBe(0); expect(result.validationStatus).toBe('Calibration/physical validation pending');
    expect(result).toEqual(calibrateUA(design, calibrationSamples(), { minUAWPerK: 100_000, maxUAWPerK: 500_000 }));
    expect(design.config.exchangerUAWPerK).toBe(DEFAULT_CONFIG.exchangerUAWPerK);
  });
  it('flags bounds and held-out deterioration; rejects unidentifiable fitting', () => {
    expect(calibrateUA(design, calibrationSamples(700_000), { minUAWPerK: 100_000, maxUAWPerK: 500_000 }).atBound).toBe(true);
    const changed = calibrationSamples(150_000).map((s, i) => i < 7 ? s : { ...s, observedHeatW: solveExchanger({ ...s.boundary, cleanUAWPerK: design.config.exchangerUAWPerK }).heatW });
    expect(calibrateUA(design, changed).warnings.some(w => w.includes('Held-out error worsened'))).toBe(true);
    expect(() => calibrateUA(design, calibrationSamples().map(s => ({ ...s, boundary: { ...s.boundary, technicalFlowM3S: 0 } })))).toThrow('unidentifiable');
    expect(() => calibrateUA(design, calibrationSamples().slice(0, 3))).toThrow();
    expect(() => calibrateUA(design, calibrationSamples().map(s => ({ ...s, boundary: {} as UACalibrationSample['boundary'] })))).toThrow('boundary');
    expect(() => calibrateUA(design, calibrationSamples().map(s => ({ ...s, observedHeatW: 1e308 })))).toThrow('finite signed heat');
  });
});

describe('read-only SSE adapter', () => {
  it.each(['http://example.com/events', 'file:///etc/passwd', 'https://user:pass@example.com/events', 'https://example.com/events?api_key=secret', 'https://example.com/events#secret'])('rejects unsafe/unsupported URL %s', url => expect(() => validateStreamURL(url)).toThrow());
  it('allows explicit loopback development and credential-free HTTPS', () => {
    expect(validateStreamURL('http://127.0.0.1:8787/events')).toContain('127.0.0.1');
    expect(validateStreamURL('https://telemetry.example.com/events')).toContain('https:');
  });
  it('passes actual reception metadata, observes reconnect/staleness, and closes the transport', () => {
    vi.useFakeTimers();
    const close = vi.fn();
    const transport: EventSourceTransport = { readyState: 0, onopen: null, onmessage: null, onerror: null, close };
    const statuses: StreamStatus[] = [], received: unknown[] = [];
    const disconnect = connectStream('http://127.0.0.1:8787/events', (raw, reception) => received.push({ raw, reception }), s => statuses.push(s), { eventSourceFactory: (_url, options) => { expect(options.withCredentials).toBe(false); return transport; }, staleAfterMs: 100, now: () => epoch + 10 });
    transport.onopen?.(new Event('open'));
    transport.onmessage?.({ data: JSON.stringify(sample()), lastEventId: '0' } as MessageEvent<string>);
    expect(received).toMatchObject([{ raw: { receivedAt: time() }, reception: { receivedAt: time(10), lastEventId: '0' } }]);
    transport.onerror?.(new Event('error')); transport.onopen?.(new Event('open'));
    expect(statuses.at(-1)).toMatchObject({ state: 'connected', reconnects: 1 });
    vi.advanceTimersByTime(101); expect(statuses.at(-1)?.state).toBe('stale');
    transport.onmessage?.({ data: '{broken', lastEventId: '' } as MessageEvent<string>);
    expect(statuses.at(-1)?.state).toBe('error');
    disconnect(); disconnect(); expect(close).toHaveBeenCalledOnce(); expect(statuses.at(-1)?.state).toBe('closed');
    expect(vi.getTimerCount()).toBe(0);
  });
});

type Publisher = { server: Server; diagnostics: { connections: number; lastEventIds: (string | null)[]; rejectedOrigins: number }; close: () => Promise<void> };
async function listen(server: Server): Promise<number> { server.listen(0, '127.0.0.1'); await once(server, 'listening'); const address = server.address(); if (!address || typeof address === 'string') throw Error('Missing test port'); return address.port; }
async function readEvent(response: Response): Promise<Observation> {
  const reader = response.body!.getReader(); let text = '';
  try { for (let i = 0; i < 20; i++) { const chunk = await reader.read(); if (chunk.done) break; text += new TextDecoder().decode(chunk.value); const data = text.split('\n').find(line => line.startsWith('data: ')); if (data) return JSON.parse(data.slice(6)) as Observation; } }
  finally { await reader.cancel(); }
  throw new Error('Publisher did not deliver an SSE observation.');
}

describe('actual localhost SSE transport', () => {
  it('connects over HTTP, replays Last-Event-ID, validates mappings, and enforces exact CORS', async () => {
    const publisher = createTelemetryPublisher({ mappingVersion: design.revision, assetId: moduleId, intervalMs: 20, allowedOrigins: ['http://127.0.0.1:5173'] }) as Publisher;
    const port = await listen(publisher.server), url = `http://127.0.0.1:${port}/events`;
    try {
      const first = await fetch(url, { headers: { Origin: 'http://127.0.0.1:5173' }, signal: AbortSignal.timeout(3000) });
      expect(first.headers.get('content-type')).toBe('text/event-stream');
      expect(first.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173');
      const a = await readEvent(first); expect(normalizeObservation(a, design).ok).toBe(true);
      const second = await fetch(url, { headers: { 'Last-Event-ID': String(a.sequence) }, signal: AbortSignal.timeout(3000) });
      const b = await readEvent(second); expect(b.sequence).toBeGreaterThan(a.sequence);
      expect(publisher.diagnostics.lastEventIds).toEqual([null, String(a.sequence)]);
      const forbidden = await fetch(url, { headers: { Origin: 'https://unapproved.example' } }); expect(forbidden.status).toBe(403);
      const malformed = await fetch(url, { headers: { 'Last-Event-ID': 'NaN' } }); expect(malformed.status).toBe(400);
      const proxy = await fetch(`http://127.0.0.1:${port}/events?url=https://example.com`); expect(proxy.status).toBe(404);
    } finally { await publisher.close(); }
  });
  it.runIf(process.env.NEPTUNE_TELEMETRY_BROWSER === '1')('uses the production adapter with native browser reconnect/Last-Event-ID and source validation', async () => {
    const adapterJS = ts.transpileModule(readFileSync(new URL('../src/twin/telemetry/stream.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
    const pageServer = createServer((request, response) => { response.setHeader('Content-Type', request.url === '/stream.js' ? 'text/javascript' : 'text/html'); response.end(request.url === '/stream.js' ? adapterJS : '<!doctype html><title>NEPTUNE transport verification</title><script type="module">import {connectStream} from "/stream.js"; window.neptuneConnect = connectStream;</script>'); });
    const pagePort = await listen(pageServer), origin = `http://127.0.0.1:${pagePort}`;
    const publisher = createTelemetryPublisher({ mappingVersion: design.revision, assetId: moduleId, intervalMs: 30, disconnectEvery: 2, dropoutEvery: 4, allowedOrigins: [origin] }) as Publisher;
    const port = await listen(publisher.server);
    const browser = await chromium.launch({ headless: true });
    try {
      const page = await browser.newPage(); await page.goto(origin); await page.waitForFunction(() => 'neptuneConnect' in window);
      const result = await page.evaluate(async streamURL => {
        const connect = (window as unknown as { neptuneConnect: typeof connectStream }).neptuneConnect;
        return await new Promise<{ samples: Observation[]; states: StreamStatus[] }>((resolve, reject) => {
          const samples: Observation[] = [], states: StreamStatus[] = [];
          const timer = setTimeout(() => { stop(); reject(new Error('Native EventSource reconnect timeout')); }, 6000);
          const stop = connect(streamURL, raw => {
            samples.push(raw as Observation);
            if (samples.length >= 5 && states.some(s => s.reconnects >= 1)) { clearTimeout(timer); stop(); resolve({ samples, states }); }
          }, (status: StreamStatus) => states.push(status), { staleAfterMs: 100 });
        });
      }, `http://127.0.0.1:${port}/events`);
      expect(result.states.some(s => s.state === 'reconnecting')).toBe(true);
      expect(result.states.some(s => s.state === 'stale')).toBe(true);
      expect(result.states.some(s => s.reconnects >= 1)).toBe(true);
      expect(publisher.diagnostics.lastEventIds.some(id => id !== null)).toBe(true);
      const store = new TelemetryStore(design);
      const accepted = result.samples.map(record => store.ingest(record));
      expect(accepted.every(r => r.accepted)).toBe(true);
      expect(accepted.some(r => r.warnings.some(w => w.startsWith('sequence-gap:')))).toBe(true);
      expect(result.samples.every(s => s.evidence === 'generated')).toBe(true);
    } finally { await browser.close(); await publisher.close(); await new Promise<void>(resolve => pageServer.close(() => resolve())); }
  }, 15_000);
});

describe('running DataPanel acceptance', () => {
  it.runIf(process.env.NEPTUNE_TELEMETRY_APP === '1')('operates mapping, raw inspection, simulated dropout, calibration, and actual streaming in the app', async () => {
    const browser = await chromium.launch({ headless: true });
    let publisher: Publisher | undefined;
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
      const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
      await page.goto('http://127.0.0.1:5173');
      await page.getByRole('button', { name: 'Data & replay', exact: true }).click();
      await page.getByRole('heading', { name: 'Observations & synchronization' }).waitFor();
      const downloadPending = page.waitForEvent('download');
      await page.getByLabel('Export artifact', { exact: true }).selectOption('project');
      const exported = await downloadPending;
      expect(await exported.failure()).toBeNull();
      const revision = JSON.parse(readFileSync((await exported.path())!, 'utf8')).designSnapshot.revision;
      expect(typeof revision).toBe('string');
      expect(await page.locator('.twin-mode').innerText()).toContain(revision);
      await page.getByLabel('Drop generated observations', { exact: true }).check();
      await page.getByRole('button', { name: 'Step 10s', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('[data-testid="sim-time"]')?.textContent === '10s');
      await page.locator('.twin-data .twin-tag.stale').first().waitFor();
      await page.getByLabel('Drop generated observations', { exact: true }).uncheck();
      await page.locator('.twin-data .twin-tag.fresh').first().waitFor();
      await page.getByText('Field, asset, and metric mapping', { exact: true }).click();
      await page.getByLabel('Telemetry mapping JSON').fill(JSON.stringify({ fields: { assetId: 'sensor', metric: 'channel', value: 'reading' }, assetIds: { 'loop-a': moduleId }, metrics: { bulk: 'temperatureK' } }));
      const csv = `sensor,channel,reading,unit,sourceId,evidence,observedAt,receivedAt,sequence,quality,mappingVersion\nloop-a,bulk,37,C,generated:ui-import,generated,${time(10000)},${time(10000)},0,fixture-generated,${revision}\n`;
      await page.getByLabel('Import telemetry CSV or JSON').setInputFiles({ name: 'mapped-fixture.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
      await page.getByText('1 accepted; 0 rejected.', { exact: false }).waitFor();
      await page.getByText('Raw imports and reset boundaries', { exact: true }).click();
      await page.getByText('mapped-fixture.csv: 1 raw rows / 0 mapping errors', { exact: true }).waitFor();
      expect(await page.locator('.twin-data pre').innerText()).toContain('"reading": "37"');
      await page.getByText('Bounded exchanger UA calibration', { exact: true }).click();
      await page.getByRole('button', { name: 'Run generated calibration fixture', exact: true }).click();
      await page.getByText('Proposed UA:', { exact: false }).waitFor();
      expect(await page.locator('.twin-data').innerText()).toContain('Held out');
      publisher = createTelemetryPublisher({ mappingVersion: revision, assetId: moduleId, intervalMs: 100, disconnectEvery: 2, allowedOrigins: ['http://127.0.0.1:5173'] }) as Publisher;
      const port = await listen(publisher.server);
      await page.getByLabel('Stream URL', { exact: true }).fill(`http://127.0.0.1:${port}/events`);
      await page.getByRole('button', { name: 'Connect stream', exact: true }).click();
      await page.getByText('Accepted stream sample.', { exact: false }).waitFor();
      await page.waitForFunction(() => [...document.querySelectorAll('.twin-data output')].some(output => /reconnects [1-9]/.test(output.textContent ?? '')));
      expect(publisher.diagnostics.connections).toBeGreaterThanOrEqual(2);
      expect(publisher.diagnostics.lastEventIds.some(id => id !== null)).toBe(true);
      expect(await page.getByLabel('Observation source', { exact: true }).inputValue()).toBe('generated:local-publisher');
      await page.getByRole('button', { name: 'Disconnect', exact: true }).click();
      mkdirSync('artifacts/v2', { recursive: true });
      await page.locator('.twin-data').screenshot({ path: 'artifacts/v2/telemetry-panel.png' });
      expect(errors).toEqual([]);
    } finally { await publisher?.close(); await browser.close(); }
  }, 40_000);
});
