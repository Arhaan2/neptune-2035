/** Package the already-built candidate with a verifiable identity; never deploys. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const sourceSha = git('rev-parse', 'HEAD');
const argument = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const production = argument('channel') === 'production';
const releaseEvidence = production ? {
  validatedFeatureSha: argument('validated-sha'),
  sourceCI: argument('ci'),
  pullRequest: argument('pr'),
  preservedRollback: argument('rollback'),
  preservedPreviewTree: argument('preview-tree'),
} : {};
if (production && (git('branch', '--show-current') !== 'main' || Object.values(releaseEvidence).some(value => !value)))
  throw Error('Production packaging requires accepted main and validated-sha, ci, pr, rollback and preview-tree evidence.');
if (production && git('rev-parse', `${releaseEvidence.validatedFeatureSha}^{tree}`) !== git('rev-parse', 'HEAD^{tree}'))
  throw Error('Accepted main tree differs from the independently verified candidate.');
const dirty = git(
  'status',
  '--porcelain',
  '--',
  'src',
  'public',
  'index.html',
  'package.json',
  'package-lock.json',
  'vite.config.ts',
  'scripts',
);
if (dirty)
  throw Error(
    'Commit application/package inputs before packaging a release identity.',
  );
const pkg = JSON.parse(await fs.readFile('package.json', 'utf8'));
await fs.access('dist/index.html');
await fs.writeFile('dist/.nojekyll', '');
const files = [];
async function visit(dir) {
  for (const item of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) await visit(full);
    else if (
      item.isFile() &&
      !['release.json', 'build-manifest.json'].includes(
        path.relative('dist', full),
      )
    ) {
      const bytes = await fs.readFile(full);
      files.push({
        path: path.relative('dist', full).split(path.sep).join('/'),
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
      });
    }
  }
}
await visit('dist');
files.sort((a, b) => a.path.localeCompare(b.path, 'en'));
const manifestText =
  JSON.stringify({ algorithm: 'sha256', files }, null, 2) + '\n';
const artifactSha256 = createHash('sha256').update(manifestText).digest('hex');
await fs.writeFile('dist/build-manifest.json', manifestText);
const release = {
  product: 'NEPTUNE',
  version: pkg.version,
  channel: production ? 'production' : 'separate-preview',
  sourceSha,
  sourceBranch: git('branch', '--show-current'),
  sourceTree: git('rev-parse', 'HEAD^{tree}'),
  lockSha256: createHash('sha256').update(await fs.readFile('package-lock.json')).digest('hex'),
  builtAt: new Date().toISOString(),
  artifactSha256,
  artifactIdentity:
    'SHA-256 of build-manifest.json; its file entries hash all compiled/static files except the two identity manifests.',
  qualifier: 'Simulated, design-stage prototype.',
  physicalValidation: 'pending',
  ...(production ? {
    ...releaseEvidence,
    publicURL: 'https://arhaan2.github.io/neptune-2035/',
    releaseScope: 'Phase 3 workload persistence and explicit scalable network resources; physical validation, training throughput, Phase 4/5 and previously deferred Phase 1 performance/stress gates remain outside scope',
    modelId: 'neptune-reference-3',
    solverVersion: '2.3.0',
    projectSchema: 3,
  } : { productionPromotion: 'not performed' }),
};
await fs.writeFile(
  'dist/release.json',
  JSON.stringify(release, null, 2) + '\n',
);
console.log(
  JSON.stringify(
    {
      ...release,
      fileCount: files.length,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    },
    null,
    2,
  ),
);
