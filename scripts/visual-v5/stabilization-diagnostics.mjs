/** Bounded external diagnostics. This runner never changes application state,
 * test deadlines, trace settings, browser fixtures, or native assertions. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const script = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(script), '../..');
const hash = value => createHash('sha256').update(value).digest('hex');
const arg = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const TARGET = 'VIS5 real Play advances an authored shot, pauses immediately and preserves final evidence on restart and exit';
const FILES = ['prototype', 'phase2', 'phase3', 'phase4', 'phase5', 'phase6', 'phase7', 'phase8', 'visual-v1', 'visual-v2', 'visual-v3', 'visual-v3-clarity', 'visual-v4', 'visual-v5'];
const CONTROLLED_TARGETS = {
  history: 'VIS5 delayed native history preserves the current camera until resolution and rejects a superseded request',
  resize: 'VIS5 missed native resize delivery recovers rendered bounds without losing manual camera ownership or the checkpoint',
};
const KINDS = ['identity', 'history', 'readiness', 'camera', 'settling', 'layout', 'render', 'context', 'visibility'];
// Deliberately finite. Keep this list aligned with the root-owned boundary
// schema before freezing a run; unknown fields invalidate collection.
export const DIAGNOSTIC_FIELDS = new Set([
  'v', 'atMs', 'kind', 'id', 'sha256', 'reason', 'action', 'phase', 'status',
  'token', 'appliedToken', 'source', 'evidence', 'sourceId', 'evidenceId',
  'step', 'shot', 'stepId', 'shotId', 'shotIndex', 'automatic', 'boundary',
  'requestedTimeS', 'displayedTimeS', 'historyStatus', 'historyMatches',
  'owner', 'ownerId', 'request', 'requestId', 'layout', 'layoutId', 'layoutRevision',
  'flightElapsedS', 'flightDurationS', 'camera', 'target', 'goalCamera', 'goalTarget',
  'transitioning', 'manual', 'cancelled', 'position', 'goalPosition',
  'canvasSize', 'parentSize', 'r3fSize', 'cssSize', 'canvas', 'parent', 'r3f',
  'selectedId', 'selected', 'authoredKind', 'assetStatus', 'representation',
  'surfaceVisible', 'renderedMeshes', 'matching', 'terminal', 'rendered',
  'settledFrames', 'renderEpoch', 'lastFrameMs', 'visibility', 'contextState',
  'reportId', 'reportToken', 'reportSource', 'reportStatus', 'reportTimeS',
  'sent', 'accepted', 'rejected', 'elapsedMs', 'resolvingMs', 'blocker', 'blockers',
  'historyRequestedTimeS', 'displayedBoundary', 'visible', 'outcome', 'currentToken',
  'elapsedS', 'durationS', 'r3fWidth', 'r3fHeight', 'parentWidth', 'parentHeight',
  'canvasWidth', 'canvasHeight', 'lastCompletedFrameMs', 'contextLost',
  'authoredSurfaceVisible', 'resetReason',
  'meaningfulLayoutRevision', 'rendererFrame', 'epoch',
]);
const MAX_EVENT_BYTES = 2048, MAX_RECORDS = 50_000, MAX_QUEUE = 256;

function validateEvent(event) {
  if (!event || typeof event !== 'object' || Array.isArray(event) || event.v !== 1 || !KINDS.includes(event.kind) || !Number.isFinite(event.atMs)) throw Error('invalid-event-envelope');
  for (const [key, value] of Object.entries(event)) {
    if (!DIAGNOSTIC_FIELDS.has(key)) throw Error(`unknown-field:${key}`);
    const scalar = value === null || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value));
    const string = typeof value === 'string' && value.length <= 192 && !/https?:\/\/|file:\/\/|[\\/]Users[\\/]/i.test(value);
    const numbers = Array.isArray(value) && value.length <= 16 && value.every(item => typeof item === 'number' && Number.isFinite(item));
    if (!scalar && !string && !numbers) throw Error(`invalid-field:${key}`);
  }
  if (Buffer.byteLength(JSON.stringify(event)) > MAX_EVENT_BYTES) throw Error('event-byte-limit');
  return event;
}

export class DurableDiagnosticWriter {
  static async create(directory) {
    await fs.mkdir(directory, { recursive: true });
    return new DurableDiagnosticWriter(directory, await fs.open(path.join(directory, 'events.jsonl'), 'wx'));
  }
  constructor(directory, handle) {
    this.directory = directory; this.handle = handle; this.tail = Promise.resolve();
    this.sequence = 0; this.durableSequence = 0; this.documents = new Map(); this.failure = null; this.closed = false;
  }
  enqueue(records) {
    const run = async () => {
      if (this.failure) throw this.failure;
      if (this.closed) throw Error('collector-closed');
      if (!Array.isArray(records) || records.length > MAX_QUEUE || this.sequence + records.length > MAX_RECORDS) throw Error('collector-record-limit');
      const rows = records.map(record => ({ v: 1, seq: ++this.sequence, receivedAtMs: performance.now(), ...record }));
      if (rows.length) { await this.handle.writeFile(rows.map(row => JSON.stringify(row) + '\n').join('')); await this.handle.datasync(); this.durableSequence = this.sequence; }
      return { durableSequence: this.durableSequence };
    };
    const task = this.tail.then(run);
    this.tail = task.catch(async error => {
      this.failure = error;
      await fs.writeFile(path.join(this.directory, 'collector-failure.json'), JSON.stringify({ at: new Date().toISOString(), reason: error.message, durableSequence: this.durableSequence }, null, 2)).catch(() => undefined);
    });
    return task;
  }
  async acceptBatch(batch, documentKey = 'controlled-child') {
    try {
      if (!Array.isArray(batch) || batch.length > MAX_QUEUE) throw Error('invalid-batch');
      if (typeof documentKey !== 'string' || !/^[\w-]{1,80}$/.test(documentKey)) throw Error('invalid-document-key');
      if (!this.documents.has(documentKey)) {
        if (this.documents.size >= 64) throw Error('document-limit');
        this.documents.set(documentKey, { ordinal: this.documents.size + 1, sequence: 0 });
      }
      const document = this.documents.get(documentKey);
      const records = batch.map(record => {
        if (record.browserSeq !== ++document.sequence) throw Error('browser-sequence-gap');
        if (record.type === 'app') return { type: 'app', pageOrdinal: document.ordinal, browserSeq: record.browserSeq, event: validateEvent(record.event) };
        if (record.type === 'clock') {
          const value = record.clock;
          if (!value || !['visible', 'hidden', 'prerender'].includes(value.visibility) || !['atMs', 'rafCount', 'lastRafMs', 'maxRafGapMs', 'lastFrameMs'].every(key => value[key] === null || Number.isFinite(value[key]))) throw Error('invalid-clock');
          return { type: 'clock', pageOrdinal: document.ordinal, browserSeq: record.browserSeq, clock: Object.fromEntries(['atMs', 'rafCount', 'lastRafMs', 'maxRafGapMs', 'lastFrameMs', 'visibility'].map(key => [key, value[key]])) };
        }
        if (record.type === 'collector-error' && ['queue-limit', 'event-byte-limit', 'transport-failed'].includes(record.reason)) throw Error(record.reason);
        throw Error('invalid-record-type');
      });
      return await this.enqueue(records);
    } catch (error) {
      this.failure ??= error;
      await fs.writeFile(path.join(this.directory, 'collector-failure.json'), JSON.stringify({ at: new Date().toISOString(), reason: error.message, durableSequence: this.durableSequence }, null, 2));
      throw error;
    }
  }
  async close() {
    await this.tail; this.closed = true; await this.handle.datasync(); await this.handle.close();
    if (this.failure) throw this.failure;
  }
}

/** Imported into every external wrapper, without any test.use/fixture override. */
export function installDiagnosticHooks(test) {
  const states = new WeakMap();
  test.beforeEach(async ({ page, browser }, info) => {
    const out = process.env.NEPTUNE_STABILIZATION_OUT;
    if (!out) throw Error('Explicit persistent output required.');
    const enabled = process.env.NEPTUNE_STABILIZATION_COLLECTION !== 'alternate' || info.repeatEachIndex % 2 === 0;
    const directory = path.join(out, 'tests', `${info.project.name}-${info.repeatEachIndex}-${hash(info.testId).slice(0, 16)}`);
    await fs.mkdir(directory, { recursive: true });
    const identity = { title: info.title, browser: info.project.name, browserVersion: browser.version(), workerIndex: info.workerIndex, parallelIndex: info.parallelIndex, repeatEachIndex: info.repeatEachIndex, retry: info.retry, timeoutMs: info.timeout, collectionEnabled: enabled, startedAt: new Date().toISOString() };
    await fs.writeFile(path.join(directory, 'test.json'), JSON.stringify(identity, null, 2), { flag: 'wx' });
    if (!enabled) { states.set(page, { directory, identity }); return; }
    const writer = await DurableDiagnosticWriter.create(directory);
    states.set(page, { writer, directory, identity });
    await page.exposeBinding('__NEPTUNE_V5_DIAGNOSTIC_WRITE__', (_source, message) => writer.acceptBatch(message.batch, message.documentKey));
    await page.addInitScript(({ queueLimit, eventLimit }) => {
      let queue = [], sequence = 0, inFlight = null, failed = false, stopped = false;
      const documentKey = crypto.randomUUID();
      let rafCount = 0, lastRafMs = null, maxRafGapMs = 0;
      const flush = () => {
        if (inFlight || !queue.length || failed) return inFlight ?? Promise.resolve();
        const batch = queue; queue = [];
        inFlight = window.__NEPTUNE_V5_DIAGNOSTIC_WRITE__({ documentKey, batch }).catch(() => { failed = true; }).finally(() => { inFlight = null; });
        return inFlight;
      };
      const append = record => {
        if (failed || stopped) return;
        if (queue.length >= queueLimit) {
          failed = true;
          void window.__NEPTUNE_V5_DIAGNOSTIC_WRITE__({ documentKey, batch: [{ browserSeq: ++sequence, type: 'collector-error', reason: 'queue-limit' }] }).catch(() => undefined);
          return;
        }
        queue.push({ browserSeq: ++sequence, ...record });
        if (queue.length >= 32) void flush();
      };
      window.__NEPTUNE_V5_DIAGNOSTIC_EMIT__ = event => {
        if (JSON.stringify(event).length > eventLimit) { append({ type: 'collector-error', reason: 'event-byte-limit' }); return; }
        append({ type: 'app', event: Object.fromEntries(Object.entries(event).map(([key, value]) => [key, Array.isArray(value) ? [...value] : value])) });
      };
      let frameId = 0;
      const frame = at => { if (lastRafMs !== null) maxRafGapMs = Math.max(maxRafGapMs, at - lastRafMs); lastRafMs = at; rafCount++; if (!stopped) frameId = requestAnimationFrame(frame); };
      frameId = requestAnimationFrame(frame);
      const flushTimer = setInterval(() => void flush(), 200);
      const clockTimer = setInterval(() => { append({ type: 'clock', clock: { atMs: performance.now(), rafCount, lastRafMs, maxRafGapMs, lastFrameMs: window.__NEPTUNE_V5_LAST_FRAME__ ?? null, visibility: document.visibilityState } }); maxRafGapMs = 0; }, 500);
      window.__NEPTUNE_V5_DIAGNOSTIC_FLUSH__ = async () => { stopped = true; clearInterval(flushTimer); clearInterval(clockTimer); cancelAnimationFrame(frameId); await inFlight; await flush(); return { sequence, failed }; };
    }, { queueLimit: MAX_QUEUE, eventLimit: MAX_EVENT_BYTES });
  });
  test.afterEach(async ({ page }, info) => {
    const state = states.get(page); if (!state) return;
    await fs.writeFile(path.join(state.directory, 'test-result-before-observation.json'), JSON.stringify({ ...state.identity, recordedAt: new Date().toISOString(), status: info.status, expectedStatus: info.expectedStatus, errors: info.errors, timeoutMs: info.timeout }, null, 2));
    // This is a separate failed-test observation. It cannot turn an assertion
    // into a pass or change its12s deadline. It reaches beyond the15s watchdog.
    if (state.writer && ['failed', 'timedOut', 'interrupted'].includes(info.status)) await new Promise(resolve => setTimeout(resolve, 8000));
    if (state.writer) {
      const timeout = new Promise(resolve => setTimeout(() => resolve({ readTimeoutMs: 2000 }), 2000));
      const snapshot = await Promise.race([page.evaluate(() => window.__NEPTUNE_V5_DIAGNOSTIC_FLUSH__?.()).catch(error => ({ readError: String(error) })), timeout]);
      await fs.writeFile(path.join(state.directory, 'flush.json'), JSON.stringify({ at: new Date().toISOString(), snapshot }, null, 2));
      await state.writer.close();
    }
  });
}

async function createAttempt(out) {
  await fs.mkdir(path.dirname(out), { recursive: true });
  await fs.mkdir(out); // Existing output is an error, never an overwrite.
  const disk = await fs.statfs(out), availableBytes = disk.bavail * disk.bsize;
  await fs.writeFile(path.join(out, 'disk.json'), JSON.stringify({ at: new Date().toISOString(), availableBytes, availableGiB: availableBytes / 1024 ** 3 }, null, 2));
  if (availableBytes < 20 * 1024 ** 3) throw Error('Less than20GiB available; no large native collection started.');
}
async function indexAttempt(out) {
  const files = [];
  async function walk(directory) { for (const entry of await fs.readdir(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name); if (entry.isDirectory()) await walk(file); else if (entry.name !== 'artifact-index.json') { const bytes = await fs.readFile(file); files.push({ path: path.relative(out, file), bytes: bytes.length, sha256: hash(bytes) }); } } }
  await walk(out); await fs.writeFile(path.join(out, 'artifact-index.json'), JSON.stringify({ at: new Date().toISOString(), files }, null, 2));
}

async function interruptionProof(out) {
  await createAttempt(out);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  const diff = git('diff', 'HEAD', '--binary'), untracked = git('ls-files', '--others', '--exclude-standard').trim().split('\n').filter(Boolean);
  const launchIdentity = { capturedAt: new Date().toISOString(), sourceCommit: git('rev-parse', 'HEAD').trim(), sourceTree: git('rev-parse', 'HEAD^{tree}').trim(), dirtyStatus: git('status', '--short'), trackedDiffSha256: hash(diff), untracked: await Promise.all(untracked.map(async file => ({ path: file, sha256: hash(await fs.readFile(path.join(root, file))) }))), collectorSha256: hash(await fs.readFile(script)), compiledIdentity: null, scope: 'Node writer transport proof only; no compiled application executed.' };
  await fs.writeFile(path.join(out, 'launch-identity.json'), JSON.stringify(launchIdentity, null, 2));
  await fs.writeFile(path.join(out, 'source-diff.patch'), diff);
  await fs.copyFile(script, path.join(out, 'collector-source.mjs'));
  const child = spawn(process.execPath, [script, '--child=interruption', `--out=${path.join(out, 'child')}`], { cwd: root, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const stdout = await fs.open(path.join(out, 'child.log'), 'wx');
  child.stdout.on('data', data => void stdout.write(data)); child.stderr.on('data', data => void stdout.write(data));
  const exit = new Promise(resolve => child.once('exit', (code, signal) => resolve({ code, signal })));
  const ack = await Promise.race([new Promise((resolve, reject) => { child.once('message', resolve); child.once('error', reject); }), new Promise((_, reject) => setTimeout(() => reject(Error('Disposable child did not acknowledge within5s.')), 5000))]).catch(async error => { child.kill('SIGTERM'); await exit; await stdout.close(); throw error; });
  if (!ack || ack.durableSequence !== 1) { child.kill('SIGTERM'); await exit; throw Error('Invalid durable child acknowledgment.'); }
  child.kill('SIGKILL'); // Exact owned child only; never the acceptance host.
  const termination = await exit; await stdout.close();
  const raw = await fs.readFile(path.join(out, 'child/events.jsonl'), 'utf8');
  const rows = raw.trimEnd().split('\n').map(line => JSON.parse(line));
  const pass = termination.signal === 'SIGKILL' && raw.endsWith('\n') && rows.length >= ack.durableSequence && rows.every((row, index) => row.seq === index + 1);
  const receipt = { at: new Date().toISOString(), status: pass ? 'PASS' : 'FAIL', scope: 'Node collector callback→append→datasync durability only; no browser/app acceptance or browser transport claim.', childPid: child.pid, acknowledgedDurableSequence: ack.durableSequence, termination, parseableRows: rows.length, completeFinalNewline: raw.endsWith('\n'), logSha256: hash(raw), collectorSha256: hash(await fs.readFile(script)) };
  await fs.writeFile(path.join(out, 'interruption-proof.json'), JSON.stringify(receipt, null, 2)); await indexAttempt(out);
  if (!pass) throw Error('Interrupted diagnostic prefix verification failed.');
  console.log(JSON.stringify(receipt));
}

async function runNative(mode, out, declarationFile, url) {
  if (!['target', 'full-order', 'stability', 'history', 'resize'].includes(mode) || !declarationFile || !url) throw Error('Pass a declared mode, declaration=FILE, url=URL and out=NEW_DIRECTORY.');
  const declarationBytes = await fs.readFile(declarationFile), declaration = JSON.parse(declarationBytes);
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  if (git('status', '--porcelain', '--untracked-files=no')) throw Error('Freeze tracked source changes before native diagnostics.');
  if (declaration.sourceCommit !== git('rev-parse', 'HEAD') || declaration.sourceTree !== git('rev-parse', 'HEAD^{tree}')) throw Error('Declaration/source identity mismatch.');
  const manifestBytes = await fs.readFile(path.join(root, 'dist/build-manifest.json'));
  if (hash(manifestBytes) !== declaration.manifestSha256 || hash(await fs.readFile(path.join(root, 'package-lock.json'))) !== declaration.lockSha256) throw Error('Declaration/compiled identity mismatch.');
  if (!declaration.allowedModes?.includes(mode)) throw Error('Mode not predeclared.');
  for (const entry of JSON.parse(manifestBytes).files) if (hash(await fs.readFile(path.join(root, 'dist', entry.path))) !== entry.sha256) throw Error(`Compiled file mismatch:${entry.path}`);
  const served = Buffer.from(await (await fetch(new URL('build-manifest.json', url))).arrayBuffer());
  if (hash(served) !== declaration.manifestSha256) throw Error('Served manifest does not match the declaration.');
  await createAttempt(out);
  await fs.writeFile(path.join(out, 'declaration.json'), declarationBytes);
  await fs.writeFile(path.join(out, 'identity.json'), JSON.stringify({ ...declaration, mode, collectorSha256: hash(await fs.readFile(script)), declarationSha256: hash(declarationBytes), createdAt: new Date().toISOString(), node: process.version }, null, 2));
  await fs.writeFile(path.join(out, 'package.json'), '{"type":"module","private":true}\n');
  const testDir = path.join(out, 'wrappers'); await fs.mkdir(testDir);
  const files = mode === 'full-order' ? FILES : ['visual-v5'];
  const testImport = JSON.stringify(path.join(root, 'node_modules/@playwright/test/index.mjs'));
  for (const file of files) await fs.writeFile(path.join(testDir, `${file}.spec.ts`), `import { test } from ${testImport};\nimport ${JSON.stringify(path.join(root, 'tests/browser', `${file}.spec.ts`))};\nimport { installDiagnosticHooks } from ${JSON.stringify(pathToFileURL(script).href)};\ninstallDiagnosticHooks(test);\n`);
  const reporter = path.join(out, 'lifetime-reporter.mjs');
  await fs.writeFile(reporter, `import fs from 'node:fs';export default class {write(event){fs.appendFileSync(process.env.NEPTUNE_STABILIZATION_METADATA_FILE||${JSON.stringify(path.join(out, 'runner-lifetime.jsonl'))},JSON.stringify({at:new Date().toISOString(),...event})+'\\n');}onBegin(config,suite){this.write({event:'begin',workers:config.workers,total:suite.allTests().length,tests:suite.allTests().map(test=>({title:test.title,workerHash:test._workerHash,poolDigest:test._poolDigest,repeatEachIndex:test.repeatEachIndex,file:test.location.file,line:test.location.line}))});}onTestBegin(test,result){this.write({event:'test-begin',title:test.title,workerIndex:result.workerIndex,parallelIndex:result.parallelIndex,repeatEachIndex:test.repeatEachIndex,retry:result.retry});}onTestEnd(test,result){this.write({event:'test-end',title:test.title,status:result.status,duration:result.duration,workerIndex:result.workerIndex,repeatEachIndex:test.repeatEachIndex,retry:result.retry});}onEnd(result){this.write({event:'end',status:result.status});}}\n`);
  const config = path.join(out, 'diagnostic.config.mts');
  await fs.writeFile(config, `import retained from ${JSON.stringify(path.join(root, 'playwright.config.ts'))};\nexport default {...retained,testDir:${JSON.stringify(testDir)},outputDir:${JSON.stringify(path.join(out, 'native-test-results'))},webServer:undefined,reporter:[['list'],['json',{outputFile:process.env.NEPTUNE_STABILIZATION_JSON||${JSON.stringify(path.join(out, 'browser.json'))}}],[${JSON.stringify(reporter)}]],use:{...retained.use,baseURL:${JSON.stringify(url)}},projects:retained.projects${mode === 'full-order' ? '' : ".filter(project=>project.name==='webkit')"}};\n`);
  const args = [path.join(root, 'node_modules/@playwright/test/cli.js'), 'test', ...files.map(file => path.join(testDir, `${file}.spec.ts`)), `--config=${config}`, '--workers=1', '--retries=0', '--max-failures=1'];
  if (mode !== 'full-order') args.push(`--grep=${CONTROLLED_TARGETS[mode] ?? TARGET}$`);
  if (mode === 'stability') args.push('--repeat-each=10');
  // Compare discovery with the unchanged source specs before launching any
  // browser. Worker fixture hashes catch accidental lifetime changes.
  const referenceConfig = path.join(out, 'original.config.mts');
  await fs.writeFile(referenceConfig, (await fs.readFile(config, 'utf8')).replace(`testDir:${JSON.stringify(testDir)}`, `testDir:${JSON.stringify(path.join(root, 'tests/browser'))}`));
  for (const label of ['original', 'wrapper']) {
    const discoveryArgs = args.map(value => label === 'original' ? value.replace(`--config=${config}`, `--config=${referenceConfig}`).replace(`${testDir}/`, `${root}/tests/browser/`) : value);
    discoveryArgs.push('--list');
    const discoveryLog = await fs.open(path.join(out, `${label}-discovery.log`), 'wx');
    const discovery = spawn(process.execPath, discoveryArgs, { cwd: root, env: { ...process.env, NEPTUNE_STABILIZATION_OUT: out, NEPTUNE_STABILIZATION_JSON: path.join(out, `${label}-discovery.json`), NEPTUNE_STABILIZATION_METADATA_FILE: path.join(out, `${label}-discovery-lifetime.jsonl`) }, stdio: ['ignore', discoveryLog.fd, discoveryLog.fd] });
    const result = await new Promise((resolve, reject) => { discovery.once('error', reject); discovery.once('exit', resolve); }); await discoveryLog.close();
    if (result !== 0) { await indexAttempt(out); throw Error(`${label} discovery failed; no browser launched.`); }
  }
  const inventory = async label => JSON.parse((await fs.readFile(path.join(out, `${label}-discovery-lifetime.jsonl`), 'utf8')).trim().split('\n')[0]).tests;
  const original = await inventory('original'), wrapper = await inventory('wrapper');
  const expectedPositions = declaration.expectedPositionsByMode?.[mode];
  const equivalent = JSON.stringify(original) === JSON.stringify(wrapper) && original.length === expectedPositions && original.every(item => item.workerHash);
  await fs.writeFile(path.join(out, 'discovery-equivalence.json'), JSON.stringify({ at: new Date().toISOString(), equivalent, expectedPositions, original, wrapper }, null, 2));
  if (!equivalent) { await indexAttempt(out); throw Error('Original order/worker discovery mismatch; no browser launched.'); }
  if (arg('list-only') === '1') { await indexAttempt(out); return; }
  await fs.writeFile(path.join(out, 'command.json'), JSON.stringify({ executable: process.execPath, args, collection: mode === 'stability' ? declaration.stabilityCollection ?? 'all' : 'all', classification: 'DIAGNOSTIC_OR_FINITE_STABILITY; never substitute for the required full gate.' }, null, 2));
  const log = await fs.open(path.join(out, 'browser.log'), 'wx');
  const child = spawn(process.execPath, args, { cwd: root, env: { ...process.env, NEPTUNE_STABILIZATION_OUT: out, NEPTUNE_STABILIZATION_COLLECTION: mode === 'stability' ? declaration.stabilityCollection ?? 'all' : 'all' }, stdio: ['ignore', log.fd, log.fd] });
  const termination = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', (code, signal) => resolve({ code, signal })); }); await log.close();
  const sourceUnchanged = declaration.sourceCommit === git('rev-parse', 'HEAD') && declaration.sourceTree === git('rev-parse', 'HEAD^{tree}') && !git('status', '--porcelain', '--untracked-files=no');
  await fs.writeFile(path.join(out, 'execution.json'), JSON.stringify({ at: new Date().toISOString(), ...termination, sourceUnchanged, mode, autoRetry: false }, null, 2));
  await indexAttempt(out); if (termination.code !== 0 || !sourceUnchanged) process.exitCode = termination.code || 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === script) {
  const out = arg('out');
  if (!out) throw Error('An explicit new persistent out directory is required.');
  if (arg('child') === 'interruption') {
    const writer = await DurableDiagnosticWriter.create(path.resolve(out));
    const ack = await writer.acceptBatch([{ browserSeq: 1, type: 'app', event: { v: 1, atMs: performance.now(), kind: 'readiness', action: 'durability-proof', token: 1, status: 'settling' } }]);
    process.send?.(ack); setInterval(() => undefined, 1000);
  } else if (arg('mode') === 'interruption-proof') await interruptionProof(path.resolve(out));
  else await runNative(arg('mode'), path.resolve(out), arg('declaration'), arg('url'));
}
