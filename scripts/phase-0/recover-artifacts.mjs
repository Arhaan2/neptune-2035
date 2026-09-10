/** Recover verified compiled bytes into a NEW directory. Never publishes or touches a working site. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
const observation = JSON.parse(await fs.readFile('docs/phase-0/evidence/hosted-observation.json', 'utf8'));
const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? `artifacts/phase-0/recovered-${Date.now()}`);
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.mkdir(out); // An existing destination is an error; no overwrite/clean/reset.
execFileSync('tar', ['-x', '-C', out], { input: execFileSync('git', ['archive', observation.deploymentArtifactSha], { maxBuffer: 20e6 }) });
const files = [];
for (const entry of observation.files) {
  const body = await fs.readFile(path.join(out, entry.path));
  const sha256 = createHash('sha256').update(body).digest('hex');
  assert.equal(sha256, entry.sha256, `Recovery mismatch: ${entry.path}`);
  files.push({ path: entry.path, sha256, bytes: body.length });
}
const receipt = { recoveredAt: new Date().toISOString(), deploymentArtifactSha: observation.deploymentArtifactSha, method: 'git archive of preserved compiled deployment; every file checked against captured HTTP hashes (dotfile markers against Git)', count: files.length, matches: true, sourceRebuildClaim: false, files };
await fs.writeFile(`${out}.receipt.json`, JSON.stringify(receipt, null, 2) + '\n');
console.log(`Recovered and verified ${files.length} files, including original production and v2-preview/, into ${path.relative(process.cwd(), out)}. Nothing published.`);
