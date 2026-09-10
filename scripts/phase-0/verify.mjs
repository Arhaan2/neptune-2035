/** Verify retained Phase 0 provenance/preservation, then rerun the diagnostic evidence. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
const evidence = 'docs/phase-0/evidence';
const read = async p => JSON.parse(await fs.readFile(p, 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 20e6 });
const out = path.resolve(`artifacts/phase-0/gate-${Date.now()}`);
await fs.mkdir(out, { recursive: true });
const checks = [];
async function check(name, fn) {
  try { await fn(); checks.push({ name, status: 'PASS' }); }
  catch (error) { checks.push({ name, status: error.code === 'ENOENT' ? 'BLOCKED' : 'FAIL', message: error.message }); }
}
const baseline = await read('docs/phase-0/baseline-manifest.json');
const before = await read(`${evidence}/protected-before.json`);
await check('source checkpoint and unchanged original tag', async () => {
  assert.equal(git('rev-parse', `${baseline.localBaselineTag}^{commit}`).toString().trim(), baseline.baselineSourceSha);
  assert.equal(git('rev-parse', baseline.localBaselineTag).toString().trim(), baseline.localBaselineTagObject);
  assert.equal(git('rev-parse', 'v0.1.0').toString().trim(), baseline.priorLegacyBaseline.tagObject);
  assert.equal(git('rev-parse', 'v0.1.0^{commit}').toString().trim(), baseline.priorLegacyBaseline.sourceSha);
});
await check('216 baseline tracked files equal pinned Git source and current checkout', async () => {
  for (const p of before.files.filter(p => p.tracked)) {
    assert.equal(sha(git('show', `${baseline.baselineSourceSha}:${p.path}`)), p.sha256, `Pinned inventory: ${p.path}`);
    assert.equal(sha(await fs.readFile(p.path)), p.sha256, `Current source: ${p.path}`);
  }
});
await check('recorded before/after preservation of every application and publication file', async () => {
  const after = await read(`${evidence}/protected-after.json`);
  assert.equal(after.allMatched, true); assert.equal(after.files.length, before.files.length);
  for (const p of before.files) {
    const observed = after.files.find(e => e.path === p.path);
    assert.ok(observed?.matches); assert.equal(observed.sha256, p.sha256);
    // Existing ignored local build artifacts must still match. A fresh checkout may not contain them.
    if (!p.tracked) {
      try { assert.equal(sha(await fs.readFile(p.path)), p.sha256, `Existing local artifact: ${p.path}`); }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
    }
  }
});
await check('raw evidence content hashes and executed harness identity', async () => {
  const inventory = await read(`${evidence}/evidence-manifest.json`);
  for (const p of inventory.files) assert.equal(sha(await fs.readFile(p.path)), p.sha256, p.path);
  const harness = await read(`${evidence}/harness-manifest.json`);
  for (const p of harness.files) assert.equal(sha(await fs.readFile(p.path)), p.sha256, p.path);
  const audit = await read(`${evidence}/diagnostic-verified/diagnostics/audit.json`);
  for (const [p, h] of Object.entries(audit.harnessHashes)) assert.equal(sha(await fs.readFile(p)), h, `Executed diagnostic identity: ${p}`);
});
await check('final diagnostic helper revision rechecked with fresh baseline npm ci', async () => {
  const run = await read(`${evidence}/diagnostic-verified/execution.json`);
  assert.equal(run.diagnosticsOnly, true); assert.equal(run.sourceSha, baseline.baselineSourceSha);
  assert.deepEqual(run.sourceMismatches, []); assert.equal(run.beforeLock, run.afterLock);
  assert.equal(run.runnerSha256, sha(await fs.readFile('scripts/phase-0/clean-check.mjs')));
  for (const name of ['npm-ci', 'phase-0', 'desired-hydraulic', 'desired-persistence']) {
    const c = run.commands.find(c => c.name === name); assert.ok(c); assert.equal(c.exitCode, c.expectedExitCode);
    assert.equal(sha(await fs.readFile(`${evidence}/diagnostic-verified/${c.log}`)), c.logSha256);
  }
  for (const dir of ['diagnostics', 'desired-hydraulic', 'desired-persistence']) {
    const audit = await read(`${evidence}/diagnostic-verified/${dir}/audit.json`);
    assert.equal(audit.evidenceGate, 'PASS');
    if (dir !== 'diagnostics') assert.ok(audit.findings[0].desiredRegressions.length > 0 && audit.findings[0].desiredRegressions.every(r => r.outcome === 'EXPECTED SEMANTIC FAILURE'));
  }
});
await check('observed identities, complete compiled recovery and published manifest', async () => {
  const observed = await read(`${evidence}/hosted-observation.json`);
  assert.equal(observed.allMatched, true); assert.equal(observed.files.length, 53);
  assert.equal(git('rev-parse', `${baseline.recovery.artifactTag}^{commit}`).toString().trim(), observed.deploymentArtifactSha);
  assert.equal(git('rev-parse', baseline.recovery.artifactTag).toString().trim(), baseline.recovery.artifactTagObject);
  for (const p of observed.files) assert.equal(sha(git('show', `${observed.deploymentArtifactSha}:${p.path}`)), p.sha256, p.path);
  const originalPaths = git('ls-tree', '-r', '--name-only', baseline.deploymentVerification.production.compiledArtifactSha).toString().trim().split('\n');
  assert.equal(originalPaths.length, 8);
  for (const p of originalPaths) assert.equal(sha(git('show', `${baseline.deploymentVerification.production.compiledArtifactSha}:${p}`)), observed.files.find(e => e.path === p).sha256, `Original production preservation: ${p}`);
  const manifestBytes = await fs.readFile(`${evidence}/published/v2-preview--build-manifest.json`);
  const release = await read(`${evidence}/published/v2-preview--release.json`);
  assert.equal(sha(manifestBytes), release.artifactSha256);
  for (const p of JSON.parse(manifestBytes).files) assert.equal(sha(git('show', `${observed.deploymentArtifactSha}:v2-preview/${p.path}`)), p.sha256);
  const production = await read(`${evidence}/published/release.json`);
  assert.equal(production.sourceCommit, baseline.deploymentVerification.production.publishedMetadata.sourceCommit);
  assert.equal(release.sourceSha, baseline.deploymentVerification.preview.publishedMetadata.sourceSha);
  assert.equal(observed.absentManifestProbe.status, 404);
  for (const ref of [release.sourceSha, production.sourceCommit]) assert.equal(git('cat-file', '-t', ref).toString().trim(), 'commit');
  const recovery = await read(`${evidence}/recovery-receipt.json`);
  assert.equal(recovery.matches, true); assert.equal(recovery.count, 53);
  for (const p of recovery.files) assert.equal(p.sha256, observed.files.find(e => e.path === p.path).sha256);
});
await check('read-only Pages publication trigger evidence', async () => {
  const settings = await read(`${evidence}/remote-settings.json`);
  assert.ok(settings.every(s => s.exitCode === 0));
  const pages = settings.find(s => s.name === 'pages').output;
  assert.deepEqual(pages.source, { branch: 'codex/pages', path: '/' }); assert.equal(pages.build_type, 'legacy');
});
await check('fresh install/build/existing tests and semantic desired failures', async () => {
  const run = await read(`${evidence}/clean-final/execution.json`);
  assert.equal(run.sourceSha, baseline.baselineSourceSha); assert.deepEqual(run.sourceMismatches, []);
  assert.equal(run.protectedSourceFiles, 216); assert.equal(run.beforeLock, baseline.lockfiles[0].sha256); assert.equal(run.afterLock, run.beforeLock);
  assert.equal(run.baselineOnly, false);
  for (const name of ['npm-ci', 'typecheck', 'lint', 'build', 'unit-full', 'browser', 'phase-0', 'desired-hydraulic', 'desired-persistence']) {
    const command = run.commands.find(c => c.name === name); assert.ok(command, name);
    assert.equal(command.exitCode, command.expectedExitCode, name);
    assert.equal(sha(await fs.readFile(`${evidence}/clean-final/${command.log}`)), command.logSha256);
  }
  const unit = await fs.readFile(`${evidence}/clean-final/unit-full.log`, 'utf8');
  assert.match(unit, /162 passed/); assert.doesNotMatch(unit, /\d+ skipped/);
  const browser = await read(`${evidence}/clean-final/browser-summary.json`);
  assert.equal(browser.stats.expected, 48); assert.equal(browser.stats.unexpected, 0); assert.equal(browser.stats.skipped, 0); assert.equal(browser.stats.flaky, 0); assert.deepEqual(browser.errors, []);
  for (const dir of ['desired-hydraulic', 'desired-persistence']) {
    const diagnostic = await read(`${evidence}/clean-final/${dir}/audit.json`);
    assert.equal(diagnostic.evidenceGate, 'PASS'); assert.equal(diagnostic.findings.length, 1);
    assert.ok(diagnostic.findings[0].desiredRegressions.length > 0);
    assert.ok(diagnostic.findings[0].desiredRegressions.every(r => r.outcome === 'EXPECTED SEMANTIC FAILURE'));
  }
});
await check('all six findings reproduce now with a fresh baseline source and npm ci', async () => {
  const fresh = path.join(out, 'fresh');
  const run = spawnSync(process.execPath, ['scripts/phase-0/clean-check.mjs', '--diagnostics-only', `--out=${fresh}`], { encoding: 'utf8' });
  await fs.writeFile(path.join(out, 'diagnostics.log'), run.stdout + run.stderr);
  assert.equal(run.status, 0, 'Diagnostic runner returned nonzero; inspect diagnostics.log');
  const diagnostic = await read(path.join(fresh, 'diagnostics/audit.json'));
  assert.equal(diagnostic.evidenceGate, 'PASS'); assert.equal(diagnostic.findings.length, 6);
  assert.equal(diagnostic.sourceBaselineVerification.mismatches.length, 0);
});
const status = checks.some(c => c.status === 'FAIL') ? 'FAIL' : checks.some(c => c.status === 'BLOCKED') ? 'BLOCKED' : 'PASS';
await fs.writeFile(path.join(out, 'gate.json'), JSON.stringify({ checkedAt: new Date().toISOString(), status, baselineSourceSha: baseline.baselineSourceSha, meaning: 'Phase 0 evidence and preservation only. Known defects remain; no physical validation or production promotion.', checks }, null, 2) + '\n');
for (const c of checks) console.log(`${c.status}: ${c.name}${c.message ? ` — ${c.message}` : ''}`);
console.log(`Phase 0 status: ${status}. Evidence preservation only; known defects remain. Receipt: ${path.relative(process.cwd(), out)}/gate.json`);
if (status !== 'PASS') process.exitCode = status === 'BLOCKED' ? 2 : 1;
