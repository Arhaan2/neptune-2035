/** Read-only HTTP/Git evidence capture. Never publishes or changes refs. */
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const deployment = '019b24f93a1960fd0ca582bb0f4c3cdccfbc6711';
const base = 'https://arhaan2.github.io/neptune-2035/';
const out = 'docs/phase-0/evidence';
const sha = b => createHash('sha256').update(b).digest('hex');
const git = (...args) => execFileSync('git', args, { maxBuffer: 20e6 });
const paths = git('ls-tree', '-r', '--name-only', deployment).toString().trim().split('\n');
const records = [];
await fs.mkdir(`${out}/published`, { recursive: true });
for (const path of paths) {
  const expected = git('show', `${deployment}:${path}`);
  if (path.endsWith('.nojekyll')) {
    records.push({ path, evidence: 'Git-only build marker', sha256: sha(expected), bytes: expected.length });
    continue;
  }
  const url = new URL(path, base).href, retrievedAt = new Date().toISOString();
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const body = Buffer.from(await response.arrayBuffer());
  const record = { path, url, retrievedAt, status: response.status, contentType: response.headers.get('content-type'), etag: response.headers.get('etag'), sha256: sha(body), expectedSha256: sha(expected), bytes: body.length, matches: response.ok && sha(body) === sha(expected) };
  records.push(record);
  if (path.endsWith('release.json') || path.endsWith('build-manifest.json')) {
    const file = `${out}/published/${path.replaceAll('/', '--')}`;
    await fs.writeFile(file, body);
  }
  console.log(`${record.status} ${record.matches ? 'MATCH' : 'MISMATCH'} ${path}`);
}
// Production had no published file-hash manifest in its immutable artifact; probe explicitly.
const probeURL = `${base}build-manifest.json`, probeResponse = await fetch(probeURL, { signal: AbortSignal.timeout(30000) });
const probeBody = Buffer.from(await probeResponse.arrayBuffer());
await fs.writeFile(`${out}/published/production-build-manifest-probe.txt`, probeBody);
const absentManifestProbe = { url: probeURL, retrievedAt: new Date().toISOString(), status: probeResponse.status, sha256: sha(probeBody), bytes: probeBody.length };
const pagesResponse = await fetch('https://api.github.com/repos/Arhaan2/neptune-2035/pages', { signal: AbortSignal.timeout(30000), headers: { Accept: 'application/vnd.github+json' } });
const pagesBody = Buffer.from(await pagesResponse.arrayBuffer());
await fs.writeFile(`${out}/published/pages-api.json`, pagesBody);
const pagesConfiguration = { url: 'https://api.github.com/repos/Arhaan2/neptune-2035/pages', retrievedAt: new Date().toISOString(), status: pagesResponse.status, sha256: sha(pagesBody) };
const result = { capturedAt: new Date().toISOString(), deploymentArtifactSha: deployment, evidenceKind: 'Generated audit observation; published metadata copied separately', allMatched: records.every(r => r.matches !== false), absentManifestProbe, pagesConfiguration, files: records };
await fs.writeFile(`${out}/hosted-observation.json`, JSON.stringify(result, null, 2) + '\n');
if (!result.allMatched) process.exitCode = 1;
