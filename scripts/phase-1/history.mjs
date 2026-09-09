/** Execute immutable Phase 0 evidence; each attempt is preserved even when a gate fails. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const historical = process.argv[2];
const historicalSha = 'f676c1f9902008a7096e5e8122a5701953b7c772';
if (!historical || execFileSync('git', ['-C', historical, 'rev-parse', 'HEAD']).toString().trim() !== historicalSha) throw Error('Pass a dedicated Phase 0 checkpoint worktree');
const selectedWebkit = process.argv.includes('--selected-webkit');
const stamp = new Date().toISOString().replaceAll(/[-:.]/g, '');
const base = path.resolve('docs/phase-1/evidence/history');
const out = path.join(base, `attempt-${stamp}${selectedWebkit ? '-webkit' : '-full'}`);
await fs.mkdir(out, { recursive: true });
const records = [];
const sanitize = s => s.replaceAll(historical, '<historical-checkout>').replaceAll(process.cwd(), '<phase1-checkout>').replaceAll(os.homedir(), '<home>');
async function run(name, command, args, expectedExitCode = 0, env = {}) {
  const at = new Date().toISOString(), start = performance.now();
  const child = spawn(command, args, { cwd: historical, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = ''; child.stdout.on('data', b => { output += b; }); child.stderr.on('data', b => { output += b; });
  const exitCode = await new Promise((resolve, reject) => { child.on('error', reject); child.on('exit', resolve); });
  output = sanitize(output); await fs.writeFile(path.join(out, `${name}.log`), output);
  records.push({ name, command: [command, ...args].join(' '), environment: env, at, elapsedMs: performance.now() - start, exitCode, expectedExitCode, logSha256: createHash('sha256').update(output).digest('hex') });
  console.log(`${name}: exit ${exitCode} (expected ${expectedExitCode})`);
  return exitCode;
}
let server;
try {
  if (await run('npm-ci', 'npm', ['ci']) !== 0) throw Error('Historical lockfile installation failed');
  if (selectedWebkit) {
    server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], { cwd: historical, stdio: ['ignore', 'pipe', 'pipe'] });
    let serverText = '';
    server.stdout.on('data', b => { serverText += b; }); server.stderr.on('data', b => { serverText += b; });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw Error(`Historical server failed: ${sanitize(serverText)}`);
      if (serverText.includes('http://127.0.0.1:5173/')) { ready = true; break; }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw Error('Historical server did not announce readiness');
    await run('selected-webkit', 'npm', ['run', 'test:browser', '--', '--project=webkit', 'tests/browser/acceptance.spec.ts:279', 'tests/browser/twin.spec.ts:243'], 0, { NEPTUNE_BASE_URL: 'http://127.0.0.1:5173' });
    const browser = JSON.parse(await fs.readFile(path.join(historical, 'artifacts/browser-results.json'), 'utf8'));
    await fs.writeFile(path.join(out, 'browser-summary.json'), JSON.stringify({ stats: browser.stats, errors: browser.errors }, null, 2) + '\n');
    await fs.writeFile(path.join(out, 'server.log'), sanitize(serverText));
  } else {
    await run('phase0-gate', 'node', ['scripts/phase-0/verify.mjs']);
    const fullLocal = `artifacts/phase1-history-full-${stamp}`;
    await run('phase0-full', 'node', ['scripts/phase-0/clean-check.mjs', `--out=${fullLocal}`]);
    await fs.cp(path.join(historical, fullLocal), path.join(out, 'full'), { recursive: true, force: false, errorOnExist: true });
    for (const id of ['PH0-001', 'PH0-002']) {
      for (const desired of [false, true]) {
        const name = `${id}${desired ? '-desired' : ''}`, local = `artifacts/phase1-history-${stamp}/${name}`;
        await run(name, 'node', ['scripts/phase-0/audit.mjs', id, ...(desired ? ['--desired'] : []), `--out=${local}`], desired ? 1 : 0);
        const audit = JSON.parse(await fs.readFile(path.join(historical, local, 'audit.json'), 'utf8'));
        if (audit.evidenceGate !== 'PASS' || !audit.findings[0].desiredRegressions.every(r => r.outcome === 'EXPECTED SEMANTIC FAILURE')) throw Error(`${name}: non-semantic failure`);
        await fs.cp(path.join(historical, local), path.join(out, name), { recursive: true, force: false, errorOnExist: true });
      }
    }
    const recovery = `artifacts/phase1-historical-recovery-${stamp}`;
    await run('recovery', 'node', ['scripts/phase-0/recover-artifacts.mjs', `--out=${recovery}`]);
    await fs.copyFile(path.join(historical, `${recovery}.receipt.json`), path.join(out, 'recovery.json'));
  }
} catch (error) {
  records.push({ name: 'infrastructure', error: sanitize(String(error)), exitCode: 2, expectedExitCode: 0 });
} finally {
  if (server) server.kill('SIGTERM');
  const status = records.every(r => r.exitCode === r.expectedExitCode) ? 'PASS' : 'FAIL';
  const result = { checkedAt: new Date().toISOString(), historicalSha, selectedWebkit, records, status };
  await fs.writeFile(path.join(out, 'execution.json'), JSON.stringify(result, null, 2) + '\n');
  await fs.writeFile(path.join(base, 'latest.json'), JSON.stringify({ attempt: path.basename(out), status, selectedWebkit }, null, 2) + '\n');
  console.log(`Evidence: ${path.relative(process.cwd(), out)}`);
  if (status !== 'PASS') process.exitCode = 1;
}
