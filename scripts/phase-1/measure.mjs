/** Bounded measurements of real engine states; no maximum-duration campus claim. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';

const output = path.resolve(process.argv.find(arg => arg.startsWith('--out='))?.slice(6) ?? 'docs/phase-1/evidence/measurements.json');
const scratch = await fs.mkdtemp(path.join(os.tmpdir(), 'neptune-phase1-measure-'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const memory = () => ({ ...process.memoryUsage(), osFreeMemoryBytes: os.freemem(), runtimeAvailableMemoryBytes: process.availableMemory?.() ?? null });
const suppliedSha = process.env.NEPTUNE_VERIFIED_SOURCE_SHA;
if (suppliedSha && !/^[a-f0-9]{40}$/.test(suppliedSha)) throw Error('NEPTUNE_VERIFIED_SOURCE_SHA must be a full hexadecimal commit identity.');
let head = suppliedSha ?? null, workingTreeChangesPresent = process.env.NEPTUNE_VERIFIED_SOURCE_DIRTY === 'true' ? true : process.env.NEPTUNE_VERIFIED_SOURCE_DIRTY === 'false' ? false : null;
if (!suppliedSha) {
  try {
    head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    workingTreeChangesPresent = Boolean(execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
  } catch { /* Archive-only runs without verified source metadata report unknown, not clean. */ }
}
const result = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  command: 'node scripts/phase-1/measure.mjs',
  scope: 'Real engine-generated one-node long history and largest canonical inventory for one simulated second. Timings and memory are observations on this host only. No equilibrium, physical validation, device-wide maximum or economical largest-campus/longest-duration claim.',
  source: { head, workingTreeChangesPresent, identitySource: suppliedSha ? 'verification environment' : head ? 'git checkout' : 'unavailable archive identity', hashes: {} },
  environment: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model ?? null, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem(), startingMemory: memory() },
  measurements: [],
};
const sourceFiles = ['scripts/phase-1/measure.mjs', 'src/twin/types.ts', 'src/twin/assets/design.ts', 'src/twin/engine/simulation.ts', 'src/twin/engine/worker.ts', 'src/twin/safety.ts'];
for (const directory of ['src/twin/persistence', 'src/twin/solvers']) for (const name of (await fs.readdir(directory)).filter(name => name.endsWith('.ts')).sort()) sourceFiles.push(`${directory}/${name}`);
for (const file of sourceFiles) result.source.hashes[file] = hash(await fs.readFile(file));
const server = await createServer({ configFile: false, cacheDir: path.join(scratch, 'vite-cache'), optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
const measure = (label, action) => {
  const before = memory(), start = performance.now(), value = action();
  result.measurements.push({ label, elapsedMs: performance.now() - start, memoryBefore: before, memoryAfter: memory() });
  return value;
};
try {
  const { buildDesign, DEFAULT_CONFIG } = await server.ssrLoadModule('/src/twin/assets/design.ts');
  const { initialize, advance, summarize } = await server.ssrLoadModule('/src/twin/engine/simulation.ts');
  const { projectFile, serializeProject, parseProject, normalizeProject, restoreProject } = await server.ssrLoadModule('/src/twin/persistence/project.ts');
  const { CONTRACT, MODEL_ID, ALGORITHM_ID } = await server.ssrLoadModule('/src/twin/persistence/limits.ts');
  result.contract = { modelId: MODEL_ID, algorithmId: ALGORITHM_ID, limits: CONTRACT };
  const normalized = (design, state) => normalizeProject(projectFile(design, state));
  const preserve = (label, design, state, continuationS) => {
    const project = measure(`${label}: build detached complete project`, () => projectFile(design, state));
    const text = measure(`${label}: serialize UTF-8 project`, () => serializeProject(project));
    const imported = measure(`${label}: bounded import`, () => parseProject(text));
    measure(`${label}: authoritative round-trip equality`, () => assert.deepEqual(normalizeProject(imported), normalizeProject(project)));
    const restored = measure(`${label}: restore complete checkpoint`, () => restoreProject(imported));
    const continued = measure(`${label}: uninterrupted continuation ${continuationS}s`, () => advance(design, state, continuationS));
    const resumed = measure(`${label}: restored continuation ${continuationS}s`, () => advance(restored.design, restored.state, continuationS));
    measure(`${label}: continued trajectory equality`, () => assert.deepEqual(normalized(design, continued), normalized(restored.design, resumed)));
    const bytes = Buffer.byteLength(text, 'utf8');
    return { requestedAccelerators: design.config.requestedAccelerators, provisionedAccelerators: design.provisionedAccelerators, nodes: design.nodeCount, modules: design.modules.length, rootAssets: design.assets.length, rootConnections: design.connections.length, timeS: state.timeS, integrationStepS: state.integrationStepS, eventCount: state.events.length, appliedEventCount: state.appliedEventIds.length, presentationLogCount: state.log.length, serializedUTF8Bytes: bytes, fractionOfProjectByteLimit: bytes / CONTRACT.maxProjectBytes, projectSHA256: hash(text), normalizedRoundTripExact: true, continuationS, normalizedContinuedTrajectoryExact: true, resultingTimeS: resumed.timeS, summary: summarize(design, state) };
  };
  const small = measure('one node: build', () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, workload: 0 }));
  const events = Array.from({ length: 1001 }, (_, index) => ({ id: `long-event-${index}`, timeS: index, kind: 'workload', assetId: 'shore/grid', value: index % 2 ? 0.1 : 0 }));
  const initial = measure('one node: initialize', () => initialize(small));
  const atDay = measure('one node: actual 86400s advance with 1001 scheduled events', () => advance(small, initial, 86400, events));
  const long = measure('one node: actual advance beyond former day boundary', () => advance(small, atDay, 1));
  assert.equal(long.timeS, 86401); assert.equal(long.events.length, 1001); assert.equal(long.appliedEventIds.length, 1001);
  result.longHistory = preserve('one node / 86401s / 1001 events', small, long, 7);
  const campus = measure('million accelerators: canonical design build', () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1_000_000, supplyW: 10e9 }));
  assert.equal(campus.nodeCount, 125000); assert.equal(campus.modules.length, 782);
  const campusInitial = measure('million accelerators: initialize', () => initialize(campus));
  const campusStep = measure('million accelerators: actual 1s advance', () => advance(campus, campusInitial, 1));
  const future = Array.from({ length: CONTRACT.maxEvents }, (_, index) => ({ id: `future-event-${index}`, timeS: CONTRACT.horizonS, kind: 'workload', assetId: 'shore/grid', value: index % 2 ? 0.7 : 0.8 }));
  const campusWithHistory = measure('million accelerators: admit 10000 future events atomically', () => advance(campus, campusStep, 0, future));
  assert.equal(campusWithHistory.events.length, 10000); assert.equal(campusWithHistory.appliedEventIds.length, 0);
  result.campusShortRun = preserve('million accelerators / 1s / 10000 future events', campus, campusWithHistory, 1);
  result.campusShortRun.limitations = 'Default required cluster traffic overload remains correctly reported. The 10000 events are future history, not 10000 events executed on this campus; replaying their simultaneous final boundary exceeds the worker atomic-event budget. 6250 modules is a structural guard, not the canonical configuration maximum. No full maximum-size/maximum-duration execution was attempted.';
  result.normalization = 'Only presentation timing solverMs is normalized to zero. Full design, integration settings, physical/controller state, authoritative events/cursors, cumulative metrics and provenance compare exactly.';
  result.outcome = 'PASS';
} catch (error) {
  result.outcome = 'FAIL';
  result.error = { name: error.name, message: error.message };
  process.exitCode = 1;
} finally {
  await server.close();
  await fs.rm(scratch, { recursive: true, force: true });
  result.completedAt = new Date().toISOString();
  result.finalMemory = memory();
  result.processResourceUsage = { ...process.resourceUsage(), maxRSSUnit: 'KiB', scope: 'Process lifetime high-water mark, including Vite SSR module loading and all measurements; before/after snapshots are not per-operation peaks.' };
  await fs.mkdir(path.dirname(output), { recursive: true });
  await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ outcome: result.outcome, measurements: result.measurements.length, longHistoryBytes: result.longHistory?.serializedUTF8Bytes, campusBytes: result.campusShortRun?.serializedUTF8Bytes, output: path.relative(process.cwd(), output) }));
}
