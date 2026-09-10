/** Compare the public site to a fixed staged Pages checkout using its existing manifests. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const arg = (key) => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const staged = arg('staged');
const source = arg('source');
const out = arg('out');
assert(staged && source && out, 'Required: --staged=checkout --source=sha --out=receipt.json');
const root = 'https://arhaan2.github.io/neptune-2035/';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const releaseBytes = await fs.readFile(path.join(staged, 'release.json'));
const manifestBytes = await fs.readFile(path.join(staged, 'build-manifest.json'));
const release = JSON.parse(releaseBytes);
const manifest = JSON.parse(manifestBytes);
assert.equal(release.sourceSha, source, 'Staged source identity');
assert.equal(hash(manifestBytes), release.artifactSha256, 'Staged manifest identity');
for (const file of manifest.files) {
  const bytes = await fs.readFile(path.join(staged, file.path));
  assert.equal(bytes.length, file.bytes, `Staged byte count: ${file.path}`);
  assert.equal(hash(bytes), file.sha256, `Staged hash: ${file.path}`);
}
const tracked = execFileSync('git', ['-C', staged, 'ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const results = [];
// GitHub Pages does not serve the .nojekyll marker. Verify it from the committed artifact.
for (const name of tracked) {
  const expected = await fs.readFile(path.join(staged, name));
  if (name.split('/').some(part => part.startsWith('.'))) {
    results.push({ path: name, bytes: expected.length, sha256: hash(expected), verification: 'committed artifact marker' });
    continue;
  }
  const url = new URL(name, root);
  url.searchParams.set('verify', source);
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), cache: 'no-store' });
  assert.equal(response.status, 200, `Public status: ${name}`);
  const actual = Buffer.from(await response.arrayBuffer());
  assert.equal(hash(actual), hash(expected), `Public differs from staged: ${name}`);
  results.push({ path: name, bytes: actual.length, sha256: hash(actual), verification: 'public HTTP matches staged bytes' });
}
const receipt = { checkedAt: new Date().toISOString(), publicURL: root, sourceSha: source,
  deploymentSha: execFileSync('git', ['-C', staged, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  artifactSha256: release.artifactSha256, releaseSha256: hash(releaseBytes),
  files: results, fileCount: results.length, matches: true };
await fs.mkdir(path.dirname(out), { recursive: true });
await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ sourceSha: source, fileCount: results.length, matches: true, receipt: out }));
