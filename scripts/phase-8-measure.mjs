/** Bounded, serial performance observations using the existing Phase 1 measurement schema. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const argument = key => process.argv.find(value => value.startsWith(`--${key}=`))?.slice(key.length + 3);
const out = path.resolve(argument('out') ?? 'artifacts/phase-8-measure');
const selected = argument('case');
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const hash = input => createHash('sha256').update(input).digest('hex');
const memory = () => ({ ...process.memoryUsage(), osFreeMemoryBytes: os.freemem(), runtimeAvailableMemoryBytes: process.availableMemory?.() ?? null });
const identity = { commit: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), lockSha256: hash(await fs.readFile('package-lock.json')) };
if (git('status', '--porcelain', '--untracked-files=no')) throw Error('Freeze tracked source before measuring.');
if (!selected) {
  await fs.mkdir(out, { recursive: false });
  const receipt = { schemaVersion: 1, ...identity, startedAt: new Date().toISOString(), scenarioTimeoutMs: 180_000, commands: [], outcome: 'PASS' };
  const commands = [
    ['historical-envelope', ['scripts/phase-1/measure.mjs', `--out=${path.join(out, 'historical-envelope.json')}`]],
    ...['storage-recovery', 'transfer-network'].map(name => [name, ['scripts/phase-8-measure.mjs', `--case=${name}`, `--out=${out}`]]),
  ];
  try {
    for (const [name, args] of commands) {
      const output = await fs.open(path.join(out, `${name}.log`), 'w');
      const start = Date.now();
      const child = spawn(process.execPath, args, { stdio: ['ignore', output.fd, output.fd] });
      let timedOut = false;
      const timeout = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, receipt.scenarioTimeoutMs);
      const exitCode = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); });
      clearTimeout(timeout); await output.close();
      receipt.commands.push({ name, command: [process.execPath, ...args], exitCode, timedOut, elapsedMs: Date.now() - start });
      if (timedOut || exitCode !== 0) throw Error(`${name}: native exit ${exitCode}, timedOut=${timedOut}`);
      console.log(`${name}: PASS`);
    }
  } catch (error) { receipt.outcome = 'FAIL'; receipt.error = String(error); process.exitCode = 1; }
  finally {
    receipt.completedAt = new Date().toISOString();
    receipt.unchanged = identity.commit === git('rev-parse', 'HEAD') && identity.tree === git('rev-parse', 'HEAD^{tree}') && !git('status', '--porcelain', '--untracked-files=no');
    if (!receipt.unchanged) { receipt.outcome = 'FAIL'; process.exitCode = 1; }
    await fs.writeFile(path.join(out, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  }
} else {
  if (!['storage-recovery', 'transfer-network'].includes(selected)) throw Error('Unknown bounded measurement case.');
  const record = { schemaVersion: 1, source: identity, case: selected, startedAt: new Date().toISOString(), environment: { node: process.version, npm: execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim(), platform: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model ?? null, logicalCPUs: os.cpus().length, totalMemoryBytes: os.totalmem(), startingMemory: memory() }, sampleCount: 3, samples: [], outcome: 'PASS' };
  const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' });
  try {
    const { buildDesign, DEFAULT_CONFIG, withNetworkPreset } = await server.ssrLoadModule('/src/twin/assets/design.ts');
    const { withTransferPreset } = await server.ssrLoadModule('/src/twin/transfer/design.ts');
    const { initialize, advance, advanceWithStep, summarize } = await server.ssrLoadModule('/src/twin/engine/simulation.ts');
    const { createWorkerHandler } = await server.ssrLoadModule('/src/twin/engine/worker.ts');
    const { createExperimentDefinition } = await server.ssrLoadModule('/src/twin/experiment/definition.ts');
    const { projectFile, serializeProject, parseProject, normalizeProject, restoreProject } = await server.ssrLoadModule('/src/twin/persistence/project.ts');
    const { recoveryReport } = await server.ssrLoadModule('/src/twin/experiment/metrics.ts');
    const { CONTRACT } = await server.ssrLoadModule('/src/twin/persistence/limits.ts');
    const { equipmentFor, resolveModuleEngineering } = await server.ssrLoadModule('/src/twin/catalog/equipment.ts');
    const normalized = (design, state) => normalizeProject(projectFile(design, state));
    record.contract = CONTRACT;
    for (let sample = 0; sample < 3; sample++) {
      const observations = [];
      const measure = async (label, action) => { const before = memory(), started = performance.now(), value = await action(); observations.push({ label, elapsedMs: performance.now() - started, memoryBefore: before, memoryAfter: memory() }); return value; };
      const start = performance.now();
      let design = await measure('build design', () => buildDesign({ ...DEFAULT_CONFIG, generation: selected === 'storage-recovery' ? 1 : 3, requestedAccelerators: selected === 'storage-recovery' ? 1280 : 5128, supplyW: 30e6, batteryWhPerModule: selected === 'storage-recovery' ? 1000 : 0, workload: 0.8 }));
      if (selected === 'transfer-network') design = withTransferPreset(withNetworkPreset(design, 'scalable-reference'));
      const durationS = selected === 'storage-recovery' ? 1800 : 60;
      const disturbances = selected === 'storage-recovery'
        ? [{ id: 'grid-loss', kind: 'trip', assetId: 'shore/bus', timeS: 30 }, { id: 'grid-restored', kind: 'restore', assetId: 'shore/bus', timeS: 300 }]
        : [{ id: 'feeder-loss', kind: 'trip', assetId: design.transfer.routes[0].originalFeederId, timeS: 5 }, { id: 'feeder-restored', kind: 'restore', assetId: design.transfer.routes[0].originalFeederId, timeS: 15 }, { id: 'network-loss', kind: 'trip', assetId: 'shore/cluster-core', timeS: 30 }, { id: 'network-restored', kind: 'restore', assetId: 'shore/cluster-core', timeS: 40 }];
      const definition = createExperimentDefinition(design, { id: `phase8-envelope-${selected}`, durationS, disturbances });
      const initial = await measure('initialize cold physical state', () => initialize(design, definition));
      const equipment = resolveModuleEngineering(design, design.modules[0].id);
      // Fixed pump speed and no pump faults: this is the same declared critical demand
      // throughout the storage case. The indivisible circuit can stop above reserve.
      const criticalReferenceW = initial.modules[0].pumpPowerW + equipment.cdu.ratings.capacityW + equipment.moduleSupport.ratings.capacityW + (equipment.network?.ratings.capacityW ?? 0);
      const storageBounds = selected === 'storage-recovery' ? { reserveWh: 100, absoluteToleranceWh: 1e-8, criticalReferenceW, dischargeEfficiency: equipment.electrical.dischargeEfficiency, maximumStoppedEnergyWh: 100 + criticalReferenceW / (equipment.electrical.dischargeEfficiency * 3600) } : null;
      let minimumBatteryWh = Infinity;
      const final = await measure('production engine continuous run', () => advanceWithStep(design, initial, durationS, [], 1, undefined, (_timeS, copy) => { minimumBatteryWh = Math.min(minimumBatteryWh, ...copy().modules.map(module => module.batteryWh)); }));
      const checkpointTimeS = selected === 'storage-recovery' ? 100 : 7;
      const checkpoint = await measure('independent rerun to disturbed checkpoint', () => advance(design, initialize(design, definition), checkpointTimeS));
      const text = await measure('serialize complete checkpoint', () => serializeProject(projectFile(design, checkpoint)));
      const restored = await measure('parse and restore complete checkpoint', () => restoreProject(parseProject(text)));
      const continued = await measure('continue restored checkpoint', () => advance(restored.design, restored.state, durationS - checkpointTimeS));
      assert.deepEqual(normalized(restored.design, continued), normalized(design, final));
      const replies = [];
      await measure('production worker handler replay with default yielding and chunks', () => createWorkerHandler(reply => replies.push(reply))({ version: 2, requestId: 1, epoch: 1, kind: 'replay', design, durationS, experimentDefinition: definition }));
      const worker = replies.at(-1);
      assert.equal(worker.status, 'complete');
      assert.deepEqual(normalized(design, worker.state), normalized(design, final));
      assert.equal(final.timeS, durationS);
      assert(final.experiment.metrics.shortfallAcceleratorS > 0);
      if (selected === 'storage-recovery') {
        // Frozen from the documented 10% controller reserve before running this case.
        assert.equal(equipmentFor(design).controlPolicy.batteryReserveFraction, 0.1);
        assert(minimumBatteryWh >= storageBounds.reserveWh - storageBounds.absoluteToleranceWh, 'Storage must never cross its declared reserve.');
        assert(minimumBatteryWh <= storageBounds.maximumStoppedEnergyWh + storageBounds.absoluteToleranceWh, 'Stopped energy must lie within one critical-circuit step above reserve.');
        assert.equal(summarize(design, checkpoint).availableAccelerators, 0);
        assert.equal(checkpoint.modules[0].batteryDischargeW, 0);
        assert(final.modules[0].batteryWh > 100);
      }
      else assert(final.transfer.transitions.some(transition => transition.reason === 'TRANSFERRED'));
      record.samples.push({ sample, processCondition: sample === 0 ? 'first scenario after module import' : 'same-process warm; fresh design and cold physical initial state', requestedAccelerators: design.config.requestedAccelerators, modules: design.modules.length, simulatedDurationS: durationS, integrationStepS: 1, disturbances, definition, designIdentity: design.revision, wallMs: performance.now() - start, measurements: observations, minimumBatteryWh, storageBounds, summary: summarize(design, final), metrics: final.experiment.metrics, evaluation: final.experiment.evaluation, recovery: recoveryReport(final.experiment.metrics, final.experiment.status), transfer: final.transfer ?? null, checkpointTimeS, checkpointBytes: Buffer.byteLength(text), checkpointSHA256: hash(text), finalCheckpointSHA256: hash(serializeProject(projectFile(design, final))), normalizedRestoredTrajectoryExact: true, normalizedWorkerReplayExact: true, workerReplyStatuses: replies.map(reply => reply.status) });
    }
  } catch (error) { record.outcome = 'FAIL'; record.error = { name: error.name, message: error.message }; process.exitCode = 1; }
  finally {
    await server.close(); record.completedAt = new Date().toISOString(); record.finalMemory = memory();
    record.processResourceUsage = { ...process.resourceUsage(), maxRSSUnit: 'KiB', scope: 'Process-lifetime high-water mark including Vite SSR imports, all three samples, serialization and equality checks; not a per-operation heap peak.' };
    record.measurementLimits = 'Single host observations. Before/after heap snapshots do not prove peak heap usage. Module import is cold per case process; subsequent scenarios warm runtime caches but always initialize a fresh physical state. Production worker handler scheduling is in-process here; the separate all-browser check exercises the compiled native Worker transport. No physical validation or universal runtime guarantee.';
    await fs.writeFile(path.join(out, `${selected}.json`), JSON.stringify(record, null, 2) + '\n');
    console.log(`${selected}: ${record.outcome}`);
  }
}
