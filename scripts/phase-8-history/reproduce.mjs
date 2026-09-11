/** Reuse the original pinned archive harness, then exercise corrected behavior on this commit. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const value = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const out = path.resolve(value('out') ?? 'artifacts/phase-8-history');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
if (git('status', '--porcelain', '--untracked-files=no')) throw Error('Commit the candidate before generating historical regression evidence.');
await fs.mkdir(out, { recursive: false });
const receipt = { candidateCommit: git('rev-parse', 'HEAD'), candidateTree: git('rev-parse', 'HEAD^{tree}'), historicalCommit: '23de38a50cf702bbe1e0f0bf56f61c0b5af4a78f', startedAt: new Date().toISOString(), commands: [] };
async function run(name, command, args) {
  const log = path.join(out, `${name}.log`);
  const file = await fs.open(log, 'w');
  const started = Date.now();
  const child = spawn(command, args, { stdio: ['ignore', file.fd, file.fd] });
  const exitCode = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
  await file.close();
  receipt.commands.push({ name, command: [command, ...args], exitCode, elapsedMs: Date.now() - started, log: `${name}.log`, sha256: createHash('sha256').update(await fs.readFile(log)).digest('hex') });
  if (exitCode !== 0) throw Error(`${name} failed with native exit ${exitCode}; see retained log.`);
}
try {
  await run('original', 'node', ['scripts/phase-0/clean-check.mjs', '--diagnostics-only', `--out=${path.join(out, 'original')}`]);
  const execution = JSON.parse(await fs.readFile(path.join(out, 'original/execution.json'), 'utf8'));
  if (execution.sourceSha !== receipt.historicalCommit || execution.sourceMismatches.length) throw Error('Historical source identity was not preserved.');
  for (const name of ['desired-hydraulic', 'desired-persistence']) {
    if (execution.commands.find(command => command.name === name)?.exitCode !== 1) throw Error(`${name} did not retain its native desired-behavior failure.`);
  }
  await run('current', 'npx', ['vitest', 'run', 'tests/phase8-original-regressions.test.ts', 'tests/phase1-persistence.test.ts', 'tests/phase1-deferred.test.ts', 'tests/phase4-metrics.test.ts', 'tests/phase5-engine.test.ts', '--reporter=default', '--reporter=json', `--outputFile=${path.join(out, 'current.json')}`]);
  receipt.status = 'PASS';
} catch (error) { receipt.status = 'FAIL'; receipt.error = String(error); process.exitCode = 1; }
finally {
  receipt.completedAt = new Date().toISOString();
  receipt.unchanged = receipt.candidateCommit === git('rev-parse', 'HEAD') && receipt.candidateTree === git('rev-parse', 'HEAD^{tree}') && !git('status', '--porcelain', '--untracked-files=no');
  if (!receipt.unchanged) { receipt.status = 'FAIL'; process.exitCode = 1; }
  await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  console.log(`${receipt.status}: ${out}`);
}
