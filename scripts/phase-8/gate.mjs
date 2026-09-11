/** Extend the retained Phase 7 full gate; use one clean immutable checkout and original campaigns. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { root, argument, sourceIdentity } from './results.mjs';

const out = path.resolve(argument('out') ?? 'artifacts/phase-8-gate');
const campaigns = argument('campaigns');
const legacyCheckout = argument('legacy-checkout');
if (!campaigns || !legacyCheckout) throw Error('Pass --campaigns=DIR and --legacy-checkout=clean Phase7 checkout.');
const identity = await sourceIdentity();
if (!identity.trackedClean) throw Error('Freeze tracked changes before the acceptance gate.');
await fs.mkdir(out, { recursive: true });
const startedAt = new Date().toISOString(), commands = [];
async function run(name, script, args) {
  const log = await fs.open(path.join(out, `${name}.log`), 'w'), started = Date.now();
  let exitCode;
  try {
    const child = spawn(process.execPath, [script, ...args], { cwd: root, env: process.env, stdio: ['ignore', log.fd, log.fd] });
    exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  } finally { await log.close(); }
  commands.push({ name, command: ['node', script, ...args], exitCode, elapsedMs: Date.now() - started, log: `${name}.log` });
  console.log(`${name}: ${exitCode}`);
  if (exitCode !== 0) throw Error(`${name} failed; native log retained.`);
}
let error = null;
try {
  await run('software', 'scripts/phase-7/gate.mjs', [`--out=${path.join(out, 'software')}`, '--base-path=/neptune-2035/', '--browser-file=tests/browser/phase8.spec.ts']);
  await run('numerical', 'scripts/phase-8/numerical.mjs', [`--out=${path.join(out, 'numerical')}`]);
  await run('experiments', 'scripts/phase-8/experiments.mjs', [`--out=${path.join(out, 'experiments')}`, `--campaigns=${path.resolve(campaigns)}`, `--legacy-checkout=${path.resolve(legacyCheckout)}`]);
} catch (problem) { error = problem.stack ?? String(problem); console.error(error); }
const finalIdentity = await sourceIdentity();
const unchanged = identity.commit === finalIdentity.commit && identity.tree === finalIdentity.tree && finalIdentity.trackedClean;
const status = !error && unchanged && commands.length === 3 && commands.every(command => command.exitCode === 0) ? 'PASS' : 'FAIL';
await fs.writeFile(path.join(out, 'gate.json'), JSON.stringify({ kind: 'neptune-phase8-gate', schemaVersion: 1, sourceIdentity: identity,
  startedAt, completedAt: new Date().toISOString(), finalIdentity, unchanged, commands, error, status,
  scope: 'Full retained software/browser gate plus frozen numerical and complete-run historical reproduction; independent reviewer, historical original-defect ledger, operating-envelope report, and hosted release gates remain separately required.' }, null, 2) + '\n');
if (status !== 'PASS') process.exitCode = 1;
// The manifest intentionally follows the final receipt. Its own bytes are excluded and separately verifiable.
const child = spawn(process.execPath, ['scripts/phase-8/verify-evidence.mjs', `--directory=${out}`, `--manifest=${path.join(out, 'evidence-manifest.json')}`, '--write'], { cwd: root, stdio: 'inherit' });
const manifestCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
if (manifestCode !== 0) process.exitCode = 1;
