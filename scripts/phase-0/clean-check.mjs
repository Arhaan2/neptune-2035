/** Archive an exact commit into a fresh directory, install its lockfile, then overlay test-only tooling. */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd();
const manifest = JSON.parse(await fs.readFile('docs/phase-0/baseline-manifest.json', 'utf8'));
const source = manifest.baselineSourceSha;
const baselineOnly = process.argv.includes('--baseline-only');
const diagnosticsOnly = process.argv.includes('--diagnostics-only');
if (baselineOnly && diagnosticsOnly) throw Error('Choose either baseline-only or diagnostics-only');
const runnerSha256 = createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex');
const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? `artifacts/phase-0/clean-${Date.now()}`);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out, { recursive: false });
const checkout = await fs.mkdtemp(path.join(os.tmpdir(), 'neptune-phase0-'));
const sanitize = s => s.replaceAll(checkout, '<clean-checkout>').replaceAll(root, '<audit-repository>').replaceAll(os.homedir(), '<home>');
execFileSync('tar', ['-x', '-C', checkout], { input: execFileSync('git', ['archive', source], { maxBuffer: 40e6 }) });
const commands = [], startedAt = new Date().toISOString();
const sourcePaths = execFileSync('git', ['ls-tree', '-r', '--name-only', source]).toString().trim().split('\n');
const sourceHashes = {};
for (const p of sourcePaths) sourceHashes[p] = createHash('sha256').update(await fs.readFile(path.join(checkout, p))).digest('hex');
const lockHash = () => createHash('sha256').update(execFileSync('cat', [path.join(checkout, 'package-lock.json')])).digest('hex');
const beforeLock = lockHash();
async function run(name, command, args, env = {}, expectedExitCode = 0) {
  const started = performance.now(), at = new Date().toISOString();
  const child = spawn(command, args, { cwd: checkout, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  const log = sanitize(output);
  await fs.writeFile(path.join(out, `${name}.log`), log);
  commands.push({ name, command: sanitize([command, ...args].join(' ')), environment: env, startedAt: at, exitCode: code, expectedExitCode, elapsedMs: performance.now() - started, log: `${name}.log`, logSha256: createHash('sha256').update(log).digest('hex') });
  console.log(`${name}: exit ${code}`);
  return code;
}
let server;
try {
  if (await run('npm-ci', 'npm', ['ci']) !== 0) throw Error('Clean installation failed');
  if (!diagnosticsOnly) {
    await run('typecheck', 'npm', ['run', 'typecheck']);
    await run('lint', 'npm', ['run', 'lint']);
    await run('build', 'npm', ['run', 'build']);
  }
  if (baselineOnly) await run('unit', 'npm', ['test']);
  else if (!diagnosticsOnly) {
    // The existing opt-in app test requires exactly this origin. Strict port prevents reuse.
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: checkout, stdio: ['ignore', 'pipe', 'pipe'] });
    let serverText = '';
    server.stdout.on('data', b => { serverText += b; }); server.stderr.on('data', b => { serverText += b; });
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (server.exitCode !== null) throw Error(`Disposable server failed: ${sanitize(serverText)}`);
      if (serverText.includes('http://127.0.0.1:5173/')) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw Error('Disposable server did not announce readiness');
    await run('unit-full', 'npm', ['test'], { NEPTUNE_TELEMETRY_BROWSER: '1', NEPTUNE_TELEMETRY_APP: '1' });
    await run('browser', 'npm', ['run', 'test:browser'], { NEPTUNE_BASE_URL: 'http://127.0.0.1:5173' });
    const browser = JSON.parse(await fs.readFile(path.join(checkout, 'artifacts/browser-results.json'), 'utf8'));
    await fs.writeFile(path.join(out, 'browser-summary.json'), JSON.stringify({ stats: browser.stats, errors: browser.errors }, null, 2) + '\n');
    await fs.writeFile(path.join(out, 'server.log'), sanitize(serverText));
  }
  if (!baselineOnly) {
    // No baseline runtime/configuration file is overlaid.
    await fs.cp(path.join(root, 'scripts/phase-0'), path.join(checkout, 'scripts/phase-0'), { recursive: true });
    await fs.cp(path.join(root, 'tests/fixtures/phase-0'), path.join(checkout, 'tests/fixtures/phase-0'), { recursive: true });
    await fs.mkdir(path.join(checkout, 'docs/phase-0'), { recursive: true });
    await fs.copyFile(path.join(root, 'docs/phase-0/baseline-manifest.json'), path.join(checkout, 'docs/phase-0/baseline-manifest.json'));
    await fs.mkdir(path.join(checkout, 'docs/phase-0/evidence'), { recursive: true });
    await fs.copyFile(path.join(root, 'docs/phase-0/evidence/protected-before.json'), path.join(checkout, 'docs/phase-0/evidence/protected-before.json'));
    await run('phase-0', 'node', ['scripts/phase-0/audit.mjs', `--out=${path.join(out, 'diagnostics')}`]);
    await run('desired-hydraulic', 'node', ['scripts/phase-0/audit.mjs', 'PH0-001', '--desired', `--out=${path.join(out, 'desired-hydraulic')}`], {}, 1);
    await run('desired-persistence', 'node', ['scripts/phase-0/audit.mjs', 'PH0-002', '--desired', `--out=${path.join(out, 'desired-persistence')}`], {}, 1);
    for (const dir of ['diagnostics', 'desired-hydraulic', 'desired-persistence']) {
      const diagnostic = JSON.parse(await fs.readFile(path.join(out, dir, 'audit.json'), 'utf8'));
      if (diagnostic.evidenceGate !== 'PASS') throw Error(`${dir}: semantic evidence failed`);
      if (dir !== 'diagnostics' && !diagnostic.findings[0]?.desiredRegressions.every(r => r.outcome === 'EXPECTED SEMANTIC FAILURE')) throw Error(`${dir}: expected defect claim needs updating`);
    }
  }
} catch (error) {
  commands.push({ name: 'infrastructure', exitCode: 2, error: sanitize(String(error)) });
  console.error(sanitize(String(error)));
} finally {
  if (server) server.kill('SIGTERM');
  const afterLock = lockHash();
  const sourceMismatches = [];
  for (const p of sourcePaths) {
    try { if (createHash('sha256').update(await fs.readFile(path.join(checkout, p))).digest('hex') !== sourceHashes[p]) sourceMismatches.push(p); }
    catch { sourceMismatches.push(p); }
  }
  const result = { startedAt, completedAt: new Date().toISOString(), sourceSha: source, sourceMethod: 'git archive of full pinned commit into fresh mkdtemp; no node_modules or output inherited', harnessMethod: baselineOnly ? 'not overlaid' : 'only scripts/phase-0, tests/fixtures/phase-0 and provenance evidence copied after requested checks', runnerSha256, protectedSourceFiles: sourcePaths.length, sourceMismatches, toolchain: { node: process.version, npm: execFileSync('npm', ['--version']).toString().trim(), platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem() }, baselineOnly, diagnosticsOnly, beforeLock, afterLock, commands };
  await fs.writeFile(path.join(out, 'execution.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`Evidence: ${path.relative(root, out)}`);
  if (commands.some(c => c.exitCode !== (c.expectedExitCode ?? 0)) || afterLock !== beforeLock || sourceMismatches.length) process.exitCode = 1;
}
