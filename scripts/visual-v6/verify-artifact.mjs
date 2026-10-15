#!/usr/bin/env node
/** Independently verify an unpacked, locally served frozen candidate. Never builds or promotes.
 * node verify-artifact.mjs --directory=/artifact/root --url=http://127.0.0.1:4173/neptune-2035/ --out=/external/new-attempt [--source=/source/root] [--archive=/candidate.tar.gz --archive-sha256=HEX]
 * --source defaults to cwd. Archive comparison accepts an explicit checksum or
 * an existing ARCHIVE.sha256 sidecar; otherwise its digest is recorded as unverified.
 */
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { lookup } from 'node:dns/promises';

const GLBS = Object.freeze({
  'visuals/v2/pump.glb': {
    bytes: 325180,
    sha256: '349db03c6513239aac075c85942ae8a79f90827f40c96b52fdcd593b992eaf75',
  },
  'visuals/v2/exchanger.glb': {
    bytes: 559236,
    sha256: 'b18e9ad1d69d2b588e34e9eb06d728a891449d61959d8150b41a47631424c559',
  },
  'visuals/v3/cdu.glb': {
    bytes: 296508,
    sha256: 'f5274b9846026b674773bc2f8170b7175aeee202fbbcb9dd34bf38ebff9ee110',
  },
});
const GLB_PROVENANCE =
  'Accepted Visual V5 source 11448dfe6b9d096807a4b2736e5d48140e7eb311; public/visuals/v2 and v3 raw payloads. These are byte invariants, not a fresh authoring/semantic validation.';
const METADATA = ['build-manifest.json', 'release.json'];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const within = (child, parent) =>
  child === parent || child.startsWith(parent + path.sep);
const validPath = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !/[\\\0\r\n?#%]/.test(value) &&
  !path.posix.isAbsolute(value) &&
  value
    .split('/')
    .every((part) => part !== '' && part !== '.' && part !== '..');
const args = {};
for (const item of process.argv.slice(2)) {
  const match = item.match(
    /^--(directory|url|out|source|archive|archive-sha256)=(.+)$/,
  );
  if (!match || Object.hasOwn(args, match[1]))
    throw Error(`Invalid or repeated argument: ${item}`);
  args[match[1]] = match[2];
}
if (!args.directory || !args.url || !args.out)
  throw Error(
    'Required: --directory=ABSOLUTE --url=http://LOOPBACK/neptune-2035/ --out=NEW_EXTERNAL_DIR',
  );
if (!path.isAbsolute(args.directory) || !path.isAbsolute(args.out))
  throw Error('--directory and --out must be absolute.');
if (args['archive-sha256'] && !args.archive)
  throw Error('--archive-sha256 requires --archive.');
const directory = await fs.realpath(args.directory),
  source = await fs.realpath(args.source ?? process.cwd());
const out = path.resolve(args.out);
if (within(out, directory) || within(out, source))
  throw Error(
    'Evidence destination must be outside the artifact and source directories.',
  );
await fs.mkdir(path.dirname(out), { recursive: true });
const parent = await fs.realpath(path.dirname(out));
if (within(parent, directory) || within(parent, source))
  throw Error('Evidence parent resolves inside artifact or source.');
// Exclusive mkdir preserves every earlier attempt, including failed receipts.
await fs.mkdir(out);
const receipt = {
  kind: 'neptune-v6-local-artifact-verification',
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  directory,
  source,
  url: args.url,
  out,
  verifierSha256: sha256(await fs.readFile(new URL(import.meta.url))),
  runtime: {
    node: process.version,
    platform: process.platform,
    architecture: process.arch,
  },
  scope:
    'Exact local disk inventory and all served payload/metadata bytes, release source/tree/lock binding, accepted raw GLB invariants. HTTP decoded response bodies are hashed; this is not a browser transfer/performance measurement. No compilation, production promotion or hosted V6 acceptance.',
  checks: [],
  failures: [],
  metadata: {},
  files: [],
  rawGLBInvariants: { provenance: GLB_PROVENANCE, expected: GLBS },
};
const check = (name, passed, detail = null) => {
  receipt.checks.push({ name, passed: Boolean(passed), detail });
  if (!passed) receipt.failures.push({ name, detail });
};
const persist = () =>
  fs.writeFile(
    path.join(out, 'artifact-verification.json'),
    JSON.stringify(receipt, null, 2) + '\n',
  );
const git = (...values) =>
  execFileSync('git', ['-C', source, ...values], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 15000,
  }).trim();
async function digestFile(location) {
  const stat = await fs.lstat(location);
  if (!stat.isFile() || stat.isSymbolicLink())
    throw Error(`Expected a regular file: ${location}`);
  const digest = createHash('sha256');
  let bytes = 0;
  for await (const chunk of createReadStream(location)) {
    digest.update(chunk);
    bytes += chunk.length;
  }
  return { bytes, sha256: digest.digest('hex') };
}
async function inventory(folder, prefix = '') {
  const rows = [];
  for (const item of await fs.readdir(folder, { withFileTypes: true })) {
    const name = prefix ? `${prefix}/${item.name}` : item.name;
    if (!validPath(name)) throw Error(`Invalid inventory path: ${name}`);
    const location = path.join(folder, item.name);
    if (item.isSymbolicLink()) throw Error(`Symlink in artifact: ${name}`);
    if (item.isDirectory()) rows.push(...(await inventory(location, name)));
    else if (item.isFile())
      rows.push({ path: name, ...(await digestFile(location)) });
    else throw Error(`Unsupported artifact entry: ${name}`);
    if (rows.length > 10000)
      throw Error('Artifact inventory exceeds 10,000 files.');
  }
  return rows.sort((a, b) => compare(a.path, b.path));
}
async function identity() {
  const lock = await digestFile(path.join(source, 'package-lock.json'));
  return {
    sourceSha: git('rev-parse', 'HEAD'),
    sourceTree: git('rev-parse', 'HEAD^{tree}'),
    sourceBranch: git('branch', '--show-current'),
    lockSha256: lock.sha256,
    trackedStatus: git('status', '--porcelain', '--untracked-files=no'),
  };
}
let base;
async function served(name) {
  const url = new URL(name.split('/').map(encodeURIComponent).join('/'), base)
    .href;
  const start = performance.now();
  try {
    const response = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      headers: { 'Accept-Encoding': 'identity' },
      signal: AbortSignal.timeout(15000),
    });
    const body = Buffer.from(await response.arrayBuffer());
    const detail = {
      url,
      status: response.status,
      bytes: body.length,
      sha256: sha256(body),
      elapsedMs: performance.now() - start,
      contentType: response.headers.get('content-type'),
      contentEncoding: response.headers.get('content-encoding'),
      declaredContentLength: response.headers.get('content-length'),
    };
    check(
      `HTTP 200: ${name}`,
      response.status === 200 && response.url === url,
      detail,
    );
    return { body, detail };
  } catch (error) {
    const detail = {
      url,
      error: String(error),
      elapsedMs: performance.now() - start,
    };
    check(`HTTP fetch: ${name}`, false, detail);
    return { body: null, detail };
  }
}
try {
  base = new URL(args.url);
  if (
    base.protocol !== 'http:' ||
    !['127.0.0.1', '[::1]', 'localhost'].includes(base.hostname) ||
    base.pathname !== '/neptune-2035/' ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    throw Error(
      '--url must be an HTTP loopback URL with exact /neptune-2035/ path and no credentials/query/fragment.',
    );
  if (base.hostname === 'localhost') {
    const addresses = await lookup('localhost', { all: true });
    if (
      !addresses.length ||
      addresses.some(
        (entry) => entry.address !== '::1' && !/^127\./.test(entry.address),
      )
    )
      throw Error('localhost did not resolve exclusively to loopback.');
  }
  receipt.localSourceBefore = await identity();
  check(
    'Source tracked tree is clean',
    receipt.localSourceBefore.trackedStatus === '',
    receipt.localSourceBefore,
  );
  const disk = await inventory(directory);
  receipt.diskInventory = disk;
  receipt.diskInventorySha256 = sha256(JSON.stringify(disk));
  const manifestBytes = await fs.readFile(
    path.join(directory, 'build-manifest.json'),
  );
  const releaseBytes = await fs.readFile(path.join(directory, 'release.json'));
  const manifest = JSON.parse(manifestBytes),
    release = JSON.parse(releaseBytes);
  receipt.release = release;
  for (const [name, bytes] of [
    ['build-manifest.json', manifestBytes],
    ['release.json', releaseBytes],
  ]) {
    await fs.writeFile(path.join(out, `local-${name}`), bytes);
    const remote = await served(name);
    if (remote.body)
      await fs.writeFile(path.join(out, `served-${name}`), remote.body);
    receipt.metadata[name] = {
      disk: { bytes: bytes.length, sha256: sha256(bytes) },
      served: remote.detail,
    };
    check(
      `Identical served metadata: ${name}`,
      remote.body?.equals(bytes) === true,
    );
  }
  if (manifest.algorithm !== 'sha256' || !Array.isArray(manifest.files))
    throw Error('Unsupported build manifest.');
  const names = new Set();
  for (const file of manifest.files) {
    if (
      !validPath(file.path) ||
      METADATA.includes(file.path) ||
      names.has(file.path) ||
      !Number.isSafeInteger(file.bytes) ||
      file.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(file.sha256)
    )
      throw Error(`Invalid/duplicate manifest entry: ${JSON.stringify(file)}`);
    names.add(file.path);
  }
  check(
    'Required static entry and Pages marker are inventoried',
    names.has('index.html') && names.has('.nojekyll'),
  );
  const actualPaths = disk.map((row) => row.path),
    expectedPaths = [...names, ...METADATA].sort(compare);
  check(
    'Exact disk file inventory',
    JSON.stringify(actualPaths) === JSON.stringify(expectedPaths),
    {
      missing: expectedPaths.filter((name) => !actualPaths.includes(name)),
      unexpected: actualPaths.filter((name) => !expectedPaths.includes(name)),
    },
  );
  check(
    'Release binds exact manifest hash',
    release.artifactSha256 === sha256(manifestBytes),
    { declared: release.artifactSha256, observed: sha256(manifestBytes) },
  );
  for (const key of ['sourceSha', 'sourceTree', 'lockSha256'])
    check(
      `Release ${key} matches local source`,
      release[key] === receipt.localSourceBefore[key],
      { declared: release[key], observed: receipt.localSourceBefore[key] },
    );
  check(
    'Release source identifiers are well formed',
    /^[a-f0-9]{40}$/.test(release.sourceSha) &&
      /^[a-f0-9]{40}$/.test(release.sourceTree) &&
      /^[a-f0-9]{64}$/.test(release.lockSha256),
  );
  const byPath = new Map(disk.map((row) => [row.path, row]));
  for (const file of manifest.files) {
    const local = byPath.get(file.path),
      remote = await served(file.path);
    const diskMatches =
      local?.bytes === file.bytes && local?.sha256 === file.sha256;
    const servedMatches =
      remote.detail.status === 200 &&
      remote.detail.bytes === file.bytes &&
      remote.detail.sha256 === file.sha256;
    receipt.files.push({
      path: file.path,
      expected: file,
      disk: local ?? null,
      served: remote.detail,
      diskMatches,
      servedMatches,
    });
    check(`Disk bytes match manifest: ${file.path}`, diskMatches);
    check(`Served bytes match manifest: ${file.path}`, servedMatches);
  }
  check(
    'Exactly the retained three raw GLBs',
    JSON.stringify(
      actualPaths.filter((name) => /\.glb$/i.test(name)).sort(compare),
    ) === JSON.stringify(Object.keys(GLBS).sort(compare)),
  );
  for (const [name, expected] of Object.entries(GLBS)) {
    const local = byPath.get(name),
      remote = receipt.files.find((file) => file.path === name)?.served;
    check(
      `Accepted raw GLB invariant: ${name}`,
      local?.bytes === expected.bytes &&
        local?.sha256 === expected.sha256 &&
        remote?.bytes === expected.bytes &&
        remote?.sha256 === expected.sha256,
      { expected, disk: local, served: remote },
    );
  }
  if (args.archive) {
    const archive = await fs.realpath(args.archive),
      observed = await digestFile(archive);
    let expected = args['archive-sha256'] ?? null,
      expectationSource = expected ? '--archive-sha256' : null;
    if (!expected) {
      try {
        const sidecar = await fs.readFile(`${archive}.sha256`, 'utf8');
        expected = sidecar.match(/^([a-fA-F0-9]{64})(?:\s|$)/)?.[1] ?? null;
        if (!expected)
          throw Error(
            'Archive checksum sidecar does not begin with a SHA-256 digest.',
          );
        expectationSource = `${archive}.sha256`;
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    }
    if (expected && !/^[a-fA-F0-9]{64}$/.test(expected))
      throw Error('Invalid archive expected SHA-256.');
    receipt.archive = {
      path: archive,
      ...observed,
      expectedSha256: expected?.toLowerCase() ?? null,
      expectationSource,
      status: expected
        ? observed.sha256 === expected.toLowerCase()
          ? 'PASS'
          : 'FAIL'
        : 'HASH_RECORDED_UNVERIFIED',
      scope:
        'Hash identity only. Archive member/unpacked-tree equality is not claimed by this check.',
    };
    if (expected)
      check(
        'Archive SHA-256 matches explicit expectation',
        observed.sha256 === expected.toLowerCase(),
        receipt.archive,
      );
  }
  receipt.diskInventoryAfter = await inventory(directory);
  check(
    'Artifact bytes unchanged during verification',
    JSON.stringify(receipt.diskInventoryAfter) === JSON.stringify(disk),
  );
  receipt.localSourceAfter = await identity();
  check(
    'Source identity unchanged during verification',
    JSON.stringify(receipt.localSourceAfter) ===
      JSON.stringify(receipt.localSourceBefore),
  );
  for (const name of METADATA) {
    const remote = await served(name);
    check(
      `Served metadata stable at end: ${name}`,
      remote.detail.sha256 === receipt.metadata[name].disk.sha256,
    );
  }
} catch (error) {
  check('Verifier completed all mandatory checks', false, {
    message: String(error),
    stack: error.stack ?? null,
  });
} finally {
  receipt.completedAt = new Date().toISOString();
  receipt.status = receipt.failures.length ? 'FAIL' : 'PASS';
  receipt.summary = {
    verifiedFiles: receipt.files.length,
    staticBytes: receipt.files.reduce(
      (sum, file) => sum + file.expected.bytes,
      0,
    ),
    checks: receipt.checks.length,
    failures: receipt.failures.length,
  };
  await persist();
  console.log(
    JSON.stringify({
      status: receipt.status,
      out,
      ...receipt.summary,
      archiveStatus: receipt.archive?.status ?? 'not requested',
    }),
  );
  if (receipt.status !== 'PASS') process.exitCode = 1;
}
