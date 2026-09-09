/** Reproducible source-only acceptance. No deployment, release, push or repository mutation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const root = process.cwd(), args = process.argv.slice(2);
const ref = args.find(a => a.startsWith('--ref='))?.slice(6);
const snapshot = args.includes('--snapshot');
if (ref && snapshot) throw Error('Choose --ref or --snapshot, not both');
const out = path.resolve(args.find(a => a.startsWith('--out='))?.slice(6) ?? `artifacts/phase-1/verify-${Date.now()}`);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out, { recursive: false });
const git = (...a) => execFileSync('git', a, { cwd: root, maxBuffer: 80e6 }).toString().trim();
const sha = git('rev-parse', ref ?? 'HEAD'), originalStatus = git('status', '--short');
let checkout = root;
const paths = git('ls-files', '--cached', '--others', '--exclude-standard').split('\n');
if (ref || snapshot) {
  checkout = await fs.mkdtemp(path.join(os.tmpdir(), 'neptune-phase1-'));
  if (ref) execFileSync('tar', ['-x', '-C', checkout], { input: execFileSync('git', ['archive', sha], { cwd: root, maxBuffer: 80e6 }) });
  else for (const p of paths) { await fs.mkdir(path.dirname(path.join(checkout, p)), { recursive: true }); await fs.copyFile(path.join(root, p), path.join(checkout, p)); }
}
checkout = await fs.realpath(checkout);
const sanitize = s => s.replaceAll(checkout, '<verified-checkout>').replaceAll(root, '<source-checkout>').replaceAll(os.homedir(), '<home>');
const hash = async p => createHash('sha256').update(await fs.readFile(path.join(checkout, p))).digest('hex');
const sources = (ref ? git('ls-tree', '-r', '--name-only', sha).split('\n') : paths).filter(p => /^(src\/|tests\/|scripts\/|\.github\/|package.*json$|.*config.*\.(ts|json)$)/.test(p));
const before = Object.fromEntries(await Promise.all(sources.map(async p => [p, await hash(p)])));
const protectedFiles = JSON.parse(await fs.readFile(path.join(checkout, 'docs/phase-1/evidence/start.json'), 'utf8')).protectedFiles;
const records = [], startedAt = new Date().toISOString();
let server, serverLog = '';
async function run(name, command, params, env = {}, allowFailure = false) {
  const at = new Date().toISOString(), start = performance.now();
  const child = spawn(command, params, { cwd: checkout, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  const log = sanitize(output); await fs.writeFile(path.join(out, `${name}.log`), log);
  records.push({ name, command: sanitize([command, ...params].join(' ')), environment: env, at, elapsedMs: performance.now() - start, exitCode, log: `${name}.log`, logSha256: createHash('sha256').update(log).digest('hex') });
  console.log(`${name}: exit ${exitCode}`);
  if (exitCode !== 0 && !allowFailure) throw Error(`${name} failed`);
}
try {
  for (const p of protectedFiles) if (await hash(p.path) !== p.sha256) throw Error(`Immutable prerequisite changed: ${p.path}`);
  if (await hash('package-lock.json') !== '87598dcf2ae3397b3b3112c21e67dab67f25cfcb2ce2dacee35de64e263593b9') throw Error('Unrelated lockfile change');
  await run('npm-ci', 'npm', ['ci']);
  await run('typecheck', 'npm', ['run', 'typecheck']);
  await run('lint', 'npm', ['run', 'lint']);
  await run('build', 'npm', ['run', 'build']);
  await new Promise((resolve, reject) => { const probe = net.createServer(); probe.once('error', reject); probe.listen(5173, '127.0.0.1', () => probe.close(resolve)); });
  server = spawn('npm', ['run', 'dev', '--', '--strictPort'], { cwd: checkout, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', b => { serverLog += b; }); server.stderr.on('data', b => { serverLog += b; });
  const deadline = Date.now() + 30000;
  for (;;) { try { if ((await fetch('http://127.0.0.1:5173')).ok) break; } catch {} if (Date.now() > deadline) throw Error('Vite readiness timeout'); await new Promise(r => setTimeout(r, 100)); }
  await run('unit-full', 'npm', ['test', '--', '--reporter=default', '--reporter=json', '--outputFile=artifacts/phase1-unit.json'], { NEPTUNE_TELEMETRY_BROWSER: '1', NEPTUNE_TELEMETRY_APP: '1' }, true);
  const unit = JSON.parse(await fs.readFile(path.join(checkout, 'artifacts/phase1-unit.json'), 'utf8'));
  await fs.writeFile(path.join(out, 'unit-summary.json'), JSON.stringify({ success: unit.success, total: unit.numTotalTests, passed: unit.numPassedTests, failed: unit.numFailedTests, skipped: unit.numPendingTests, files: unit.testResults.map(r => ({ name: r.name.includes('/tests/') ? r.name.slice(r.name.lastIndexOf('/tests/') + 1) : sanitize(path.relative(checkout, r.name)), status: r.status, tests: r.assertionResults.map(t => ({ name: t.fullName, status: t.status, durationMs: t.duration })) })) }, null, 2) + '\n');
  if (!unit.success || unit.numPendingTests) throw Error('Unit coverage has failures or skipped tests');
  await run('browser', 'npm', ['run', 'test:browser'], { NEPTUNE_BASE_URL: 'http://127.0.0.1:5173' }, true);
  const browser = JSON.parse(await fs.readFile(path.join(checkout, 'artifacts/browser-results.json'), 'utf8'));
  const browserTests = [];
  const walk = suites => { for (const suite of suites) { for (const spec of suite.specs ?? []) for (const test of spec.tests) browserTests.push({ file: spec.file, name: spec.title, browser: test.projectName, status: test.status, results: test.results.map(r => ({ status: r.status, durationMs: r.duration })) }); walk(suite.suites ?? []); } };
  walk(browser.suites);
  await fs.writeFile(path.join(out, 'browser-summary.json'), JSON.stringify({ stats: browser.stats, tests: browserTests }, null, 2) + '\n');
  // Preserve textual failure context (including control states) for remote diagnosis.
  // Screenshots, traces and recordings remain outside the published source evidence.
  const contextFiles = [];
  const resultDir = path.join(checkout, 'test-results');
  const resultFiles = await fs.readdir(resultDir, { recursive: true }).catch(error => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  for (const file of resultFiles) {
    if (!file.endsWith('error-context.md')) continue;
    const content = sanitize(await fs.readFile(path.join(resultDir, file), 'utf8'));
    const name = file.replaceAll(path.sep, '--');
    await fs.mkdir(path.join(out, 'browser-contexts'), { recursive: true });
    await fs.writeFile(path.join(out, 'browser-contexts', name), content);
    contextFiles.push({ path: `browser-contexts/${name}`, bytes: Buffer.byteLength(content), sha256: createHash('sha256').update(content).digest('hex') });
  }
  await fs.writeFile(path.join(out, 'browser-contexts.json'), JSON.stringify(contextFiles, null, 2) + '\n');
  if (browser.stats.unexpected || browser.stats.skipped || browser.stats.flaky || records.some(r => r.exitCode !== 0)) throw Error('Coverage has failures, skips or flaky retries');
  const { chromium, firefox, webkit } = await import(pathToFileURL(path.join(checkout, 'node_modules/playwright/index.mjs')));
  const versions = {};
  for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) { const b = await engine.launch({ headless: true }); versions[name] = b.version(); await b.close(); }
  await fs.writeFile(path.join(out, 'browser-versions.json'), JSON.stringify(versions, null, 2) + '\n');
  await run('measurements', 'node', ['scripts/phase-1/measure.mjs', `--out=${path.join(out, 'measurements.json')}`], { NEPTUNE_VERIFIED_SOURCE_SHA: sha, NEPTUNE_VERIFIED_SOURCE_DIRTY: String(Boolean(snapshot && originalStatus)) });
} catch (error) {
  records.push({ name: 'gate', error: sanitize(String(error)), exitCode: 1 }); process.exitCode = 1;
} finally {
  if (server) { try { process.kill(-server.pid, 'SIGTERM'); } catch {} }
  await fs.writeFile(path.join(out, 'server.log'), sanitize(serverLog));
  const mismatches = [];
  for (const [p, expected] of Object.entries(before)) { try { if (await hash(p) !== expected) mismatches.push(p); } catch { mismatches.push(p); } }
  if (mismatches.length) process.exitCode = 1;
  const result = { status: process.exitCode ? 'FAIL' : 'PASS', startedAt, completedAt: new Date().toISOString(), sourceSha: sha, sourceMethod: ref ? 'clean git archive of exact commit' : snapshot ? 'detached working-tree snapshot; clean dependencies; exact source hashes recorded' : 'current checkout; clean dependencies; exact source hashes recorded', originalStatus: sanitize(originalStatus), sourceHashes: before, sourceMismatches: mismatches, protectedFiles: protectedFiles.length, lockSha256: await hash('package-lock.json'), toolchain: { node: process.version, npm: execFileSync('npm', ['--version']).toString().trim(), os: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, totalMemoryBytes: os.totalmem(), availableMemoryBytes: os.freemem() }, records };
  await fs.writeFile(path.join(out, 'execution.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Phase 1 ${result.status}: ${out}`);
}
