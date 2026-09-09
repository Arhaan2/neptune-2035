#!/usr/bin/env node
/** Local-only generated fixture publisher. This is not deployed with the static site. */
import { createServer as createHTTPServer } from 'node:http';
import { createServer as createHTTPSServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFAULT_ORIGINS = ['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173'];

export function createTelemetryPublisher(options = {}) {
  const {
    mappingVersion = 'neptune-reference-v2', assetId = 'platform-001/module-01',
    intervalMs = 1_000, disconnectEvery = 0, dropoutEvery = 0,
    allowedOrigins = DEFAULT_ORIGINS, now = Date.now, tls,
  } = options;
  if (!Number.isInteger(intervalMs) || intervalMs < 10 || intervalMs > 60_000) throw new Error('intervalMs must be 10–60,000.');
  if (![disconnectEvery, dropoutEvery].every(value => Number.isInteger(value) && value >= 0)) throw new Error('Disconnect/dropout intervals must be nonnegative integers.');
  if (typeof mappingVersion !== 'string' || !/^[A-Za-z0-9._-]{1,128}$/.test(mappingVersion)) throw new Error('Invalid mapping version.');
  if (typeof assetId !== 'string' || !/^[A-Za-z0-9._/-]{1,256}$/.test(assetId)) throw new Error('Invalid asset ID.');
  for (const origin of allowedOrigins) {
    const url = new URL(origin);
    if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) throw new Error('CORS origins must be exact HTTP(S) origins; wildcards are forbidden.');
  }
  const clients = new Set();
  const replay = [];
  let sequence = 0;
  const diagnostics = { connections: 0, lastEventIds: [], rejectedOrigins: 0 };
  const encode = sample => `id: ${sample.sequence}\ndata: ${JSON.stringify(sample)}\n\n`;
  const handler = (request, response) => {
    const origin = request.headers.origin;
    if (origin && !allowedOrigins.includes(origin)) {
      diagnostics.rejectedOrigins++;
      response.writeHead(403, { 'Content-Type': 'text/plain' }); response.end('Origin not allowed'); return;
    }
    if (origin) { response.setHeader('Access-Control-Allow-Origin', origin); response.setHeader('Vary', 'Origin'); }
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.method === 'OPTIONS') { response.writeHead(204, { 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'Last-Event-ID' }); response.end(); return; }
    if (request.method !== 'GET' || request.url !== '/events') { response.writeHead(404, { 'Content-Type': 'text/plain' }); response.end('Only GET /events is available.'); return; }
    const lastId = request.headers['last-event-id'];
    if (lastId !== undefined && (typeof lastId !== 'string' || !/^\d+$/.test(lastId) || !Number.isSafeInteger(Number(lastId)))) { response.writeHead(400); response.end('Invalid Last-Event-ID'); return; }
    diagnostics.connections++;
    diagnostics.lastEventIds.push(lastId ?? null);
    if (diagnostics.lastEventIds.length > 100) diagnostics.lastEventIds.shift();
    response.writeHead(200, { 'Content-Type': 'text/event-stream', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
    response.write('retry: 250\n: NEPTUNE generated fixture; physical validation pending\n\n');
    if (lastId !== undefined) for (const sample of replay) if (sample.sequence > Number(lastId)) response.write(encode(sample));
    const client = { response, sent: 0 };
    clients.add(client);
    request.on('close', () => clients.delete(client));
  };
  const server = tls ? createHTTPSServer(tls, handler) : createHTTPServer(handler);
  const timer = setInterval(() => {
    sequence++;
    // Deterministic signal by sequence; timestamps use the publisher's actual clock.
    const timestamp = new Date(now()).toISOString();
    const sample = { assetId, metric: 'temperatureK', value: 310.15 + 0.5 * Math.sin(sequence / 10), unit: 'K', sourceId: 'generated:local-publisher', evidence: 'generated', observedAt: timestamp, receivedAt: timestamp, sequence, quality: ['fixture-generated'], mappingVersion };
    if (dropoutEvery && sequence % dropoutEvery === 0) return;
    replay.push(sample);
    if (replay.length > 300) replay.shift();
    for (const client of clients) {
      if (!client.response.write(encode(sample))) { client.response.end(); clients.delete(client); continue; }
      client.sent++;
      if (disconnectEvery && client.sent >= disconnectEvery) { client.response.end(); clients.delete(client); }
    }
  }, intervalMs);
  timer.unref();
  const close = async () => {
    clearInterval(timer);
    for (const client of clients) client.response.end();
    clients.clear();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  };
  return { server, diagnostics, close };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const allowedArgs = ['--port', '--mapping-version', '--asset-id', '--interval-ms', '--disconnect-every', '--dropout-every', '--origin', '--tls-cert', '--tls-key'];
  const values = new Map();
  for (let i = 0; i < args.length; i += 2) {
    if (!allowedArgs.includes(args[i]) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Usage: node scripts/telemetry-publisher.mjs [${allowedArgs.join(' value] [')} value]`);
    values.set(args[i], args[i + 1]);
  }
  const port = Number(values.get('--port') ?? 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Port must be 1–65535.');
  const cert = values.get('--tls-cert'), key = values.get('--tls-key');
  if (Boolean(cert) !== Boolean(key)) throw new Error('Supply both --tls-cert and --tls-key. Keep private keys outside the repository.');
  const publisher = createTelemetryPublisher({
    mappingVersion: values.get('--mapping-version'), assetId: values.get('--asset-id'),
    intervalMs: Number(values.get('--interval-ms') ?? 1_000),
    disconnectEvery: Number(values.get('--disconnect-every') ?? 0),
    dropoutEvery: Number(values.get('--dropout-every') ?? 0),
    allowedOrigins: values.has('--origin') ? values.get('--origin').split(',') : DEFAULT_ORIGINS,
    ...(cert && key ? { tls: { cert: readFileSync(cert), key: readFileSync(key) } } : {}),
  });
  publisher.server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`NEPTUNE generated fixture SSE: ${cert ? 'https' : 'http'}://127.0.0.1:${port}/events\nMapping version: ${values.get('--mapping-version') ?? 'neptune-reference-v2'}; must match the selected design.\nRead-only; no real equipment. Physical validation pending.\n`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void publisher.close().then(() => process.exit(0)); });
}
