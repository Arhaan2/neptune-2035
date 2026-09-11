/** Execute from a clean accepted Phase 7 checkout; this script never changes old runtime files. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const out = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'artifacts/phase8-compatibility-fixtures');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceCommit = git('rev-parse', 'HEAD'), sourceTree = git('rev-parse', 'HEAD^{tree}');
assert.equal(sourceCommit, 'c22964d48ddca0e7f7db18ede972125f79dad2df');
assert.equal(sourceTree, 'ce6cd0c2009a7eb78e7b41230a8ab6a94cfe0226');
assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
await fs.mkdir(out, { recursive: true });
const { createServer } = await import(pathToFileURL(path.resolve('node_modules/vite/dist/node/index.js')).href);
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
try {
  const { buildDesign, DEFAULT_CONFIG, withNetworkPreset } = await server.ssrLoadModule('/src/twin/assets/design.ts');
  const { initialize, advance } = await server.ssrLoadModule('/src/twin/engine/simulation.ts');
  const { createExperimentDefinition } = await server.ssrLoadModule('/src/twin/experiment/definition.ts');
  const { transferDemonstration } = await server.ssrLoadModule('/src/twin/transfer/demonstrations.ts');
  const { projectFile, parseProject, serializeProject } = await server.ssrLoadModule('/src/twin/persistence/project.ts');
  const basicDesign = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
  const networkDesign = withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, requireExternalNetwork: true }), 'scalable-reference');
  const networkDefinition = createExperimentDefinition(networkDesign, { id: 'phase7-supplied-network', durationS: 12, disturbances: [{ id: 'network-fault', kind: 'trip', assetId: 'shore/cluster-core', timeS: 2 }, { id: 'network-recovery', kind: 'restore', assetId: 'shore/cluster-core', timeS: 8 }] });
  const transfer = transferDemonstration('eligible').find(item => item.generation === 3 && item.role === 'faulted');
  const cases = [
    ['phase7-basic.json', basicDesign, advance(basicDesign, initialize(basicDesign), 3, [{ id: 'duty-fault', kind: 'trip', assetId: `${basicDesign.modules[0].id}/pump-duty`, timeS: 1 }])],
    ['phase7-network-experiment.json', networkDesign, advance(networkDesign, initialize(networkDesign, networkDefinition), 5)],
    ['phase7-transfer.json', transfer.design, advance(transfer.design, initialize(transfer.design, transfer.definition), 5)],
  ];
  const files = [];
  for (const [name, design, state] of cases) {
    const original = projectFile(design, state), text = serializeProject(original);
    assert.deepEqual(parseProject(text), original);
    assert.equal(original.solverVersion, '2.3.0');
    await fs.writeFile(path.join(out, name), text);
    files.push({ path: name, bytes: Buffer.byteLength(text), sha256: hash(text), requestedAccelerators: design.config.requestedAccelerators, timeS: state.timeS, experimentStatus: state.experiment?.status ?? null });
  }
  assert(files.reduce((sum, file) => sum + file.bytes, 0) < 1024 * 1024);
  const sourceHashes = {};
  for (const file of ['package-lock.json', 'src/twin/types.ts', 'src/twin/solvers/thermal.ts', 'src/twin/catalog/equipment.ts', 'src/twin/persistence/project.ts', 'src/twin/persistence/state.ts', 'src/twin/experiment/definition.ts', 'src/twin/experiment/validation.ts']) sourceHashes[file] = hash(await fs.readFile(file));
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
  await fs.writeFile(path.join(out, 'manifest.json'), JSON.stringify({ kind: 'neptune-phase8-original-project-fixtures', version: 1, sourceCommit, sourceTree, sourceHashes, node: process.version, generatorSha256: hash(await fs.readFile(new URL(import.meta.url))), sourceUnchanged: true, files }, null, 2) + '\n');
  console.log(JSON.stringify({ sourceCommit, sourceTree, files, sourceUnchanged: true }));
} finally { await server.close(); }
