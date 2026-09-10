/** Explicit diagnostic runner, isolated from npm test. A reproduced defect is not repaired behavior. */
import assert, { AssertionError } from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
const selected = process.argv.find(a => /^PH0-00[1-6]$/.test(a));
const desiredOnly = process.argv.includes('--desired');
const out = path.resolve(process.argv.find(a => a.startsWith('--out='))?.slice(6) ?? 'artifacts/phase-0/diagnostics');
await fs.mkdir(out, { recursive: true });
const json = x => JSON.stringify(x, (_k, v) => typeof v === 'number' && !Number.isFinite(v) ? String(v) : v, 2) + '\n';
const hash = b => createHash('sha256').update(b).digest('hex');
const baseline = JSON.parse(await fs.readFile('docs/phase-0/baseline-manifest.json', 'utf8'));
const fixtures = JSON.parse(await fs.readFile('tests/fixtures/phase-0/scenarios.json', 'utf8'));
const result = { startedAt: new Date().toISOString(), baselineSourceSha: baseline.baselineSourceSha, scope: 'Evidence checks only; known defects remain open. No physics validation or physical connection.', environment: { node: process.version, os: os.platform(), release: os.release(), arch: os.arch(), cpu: os.cpus()[0]?.model }, sourceHashes: {}, harnessHashes: {}, findings: [] };
for (const p of ['src/twin/assets/design.ts', 'src/twin/types.ts', 'src/twin/engine/simulation.ts', 'src/twin/analysis/reports.ts', 'src/twin/solvers/hydraulic.ts', 'src/twin/solvers/network.ts', 'src/twin/catalog/reference.ts']) result.sourceHashes[p] = hash(await fs.readFile(p));
for (const p of ['scripts/phase-0/audit.mjs', 'tests/fixtures/phase-0/scenarios.json']) result.harnessHashes[p] = hash(await fs.readFile(p));
const save = async (name, value) => { await fs.writeFile(path.join(out, name), json(value)); };
const protectedInventory = JSON.parse(await fs.readFile('docs/phase-0/evidence/protected-before.json', 'utf8'));
const sourceMismatches = [];
for (const entry of protectedInventory.files.filter(e => e.tracked)) {
  try { if (hash(await fs.readFile(entry.path)) !== entry.sha256) sourceMismatches.push(entry.path); }
  catch { sourceMismatches.push(entry.path); }
}
result.sourceBaselineVerification = { checkedFiles: protectedInventory.files.filter(e => e.tracked).length, mismatches: sourceMismatches };
if (sourceMismatches.length) {
  result.evidenceGate = 'BLOCKED'; result.infrastructureError = 'Source differs from pinned baseline; use clean-check.mjs for historical comparison.';
  await save('audit.json', result); console.error(result.infrastructureError); process.exit(2);
}
const server = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, entries: [] }, server: { middlewareMode: true, watch: null, hmr: false, ws: false }, appType: 'custom' });
let current;
try {
  const { buildDesign, DEFAULT_CONFIG, moduleAssets, resolveAsset, loopGeometry } = await server.ssrLoadModule('/src/twin/assets/design.ts');
  const { initialize, advance, replay, summarize, validateEvent } = await server.ssrLoadModule('/src/twin/engine/simulation.ts');
  const { solveHydraulics } = await server.ssrLoadModule('/src/twin/solvers/hydraulic.ts');
  const { assessNetwork, NETWORK_ASSUMPTIONS } = await server.ssrLoadModule('/src/twin/solvers/network.ts');
  const { projectFile, parseProject, constraints, sizingAssessment, engineeringReport, resultsCSV } = await server.ssrLoadModule('/src/twin/analysis/reports.ts');
  const { HARDWARE } = await server.ssrLoadModule('/src/twin/catalog/reference.ts');
  const small = (overrides = {}) => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 1280, ...overrides });
  // Only errors deliberately thrown by the desired assertion are treated as known defects.
  // All witness/control/API checks run outside this catch and fail the audit on mismatch.
  function desired(name, check) {
    try { check(); }
    catch (error) {
      if (!(error instanceof AssertionError)) throw error;
      current.desiredRegressions.push({ name, outcome: 'EXPECTED SEMANTIC FAILURE', message: error.message, actual: error.actual, expected: error.expected });
      return;
    }
    current.desiredRegressions.push({ name, outcome: 'DESIRED BEHAVIOR PASSES — UPDATE DISPOSITION' });
    current.disposition = 'ALREADY FIXED — disposition update required';
    process.exitCode = 1;
  }
  async function finding(id, classification, run) {
    if (selected && selected !== id) return;
    current = { id, classification, disposition: 'REPRODUCED', desiredRegressions: [] };
    result.findings.push(current);
    const start = performance.now();
    try { await run(); current.evidenceCheck = 'PASS'; }
    catch (error) {
      current.evidenceCheck = 'FAIL';
      current.error = { name: error.name, message: error.message };
      current.disposition = 'BLOCKED/NOT YET REPRODUCED — control, witness, or infrastructure failure';
      process.exitCode = 2;
    }
    current.elapsedMs = performance.now() - start;
    await save(`${id}.json`, current);
    console.log(`${id}: ${current.evidenceCheck}; ${current.disposition}; ${current.desiredRegressions.length} desired regressions`);
  }
  const hydraulicInput = { lengthM: 58, diameterM: 0.18, roughnessM: 0.000045, densityKgM3: 997, dynamicViscosityPaS: 0.000855, fittingsK: 12, equipmentDropPaAtReference: 80000, referenceFlowM3S: 0.05, pumpCount: 1, pumpSpeed: 1, shutoffPa: 250000, freeFlowM3S: 0.1, efficiency: 0.72 };
  await finding('PH0-001', 'correctness defect', async () => {
    const control = solveHydraulics(hydraulicInput);
    assert.ok(Object.values(control).every(Number.isFinite)); assert.ok(control.flowM3S > 0); assert.ok(Math.abs(control.headResidualPa) < 0.01);
    const observations = [];
    for (const field of ['shutoffPa', 'freeFlowM3S', 'efficiency']) {
      const input = { ...hydraulicInput, [field]: Infinity }; // In memory; never JSON.parse.
      let observed;
      try { observed = { kind: 'returned', result: solveHydraulics(input) }; }
      catch (error) { observed = { kind: error.message === 'Invalid pump rating' ? 'explicit-rating-rejection' : 'numerical-or-unrelated-error', message: error.message }; }
      observations.push({ field, value: 'Infinity (constructed directly)', ...observed });
      if (field === 'efficiency') assert.equal(observed.kind, 'explicit-rating-rejection');
      else {
        if (observed.kind !== 'explicit-rating-rejection') {
          if (field === 'shutoffPa') { assert.equal(observed.kind, 'returned'); assert.equal(observed.result.headResidualPa, Infinity); }
          else { assert.equal(observed.kind, 'numerical-or-unrelated-error'); assert.equal(observed.message, 'Reynolds number must be finite and non-negative'); }
        }
        desired(`reject nonfinite ${field} explicitly at pump-rating validation`, () => assert.equal(observed.kind, 'explicit-rating-rejection', `${field}=Infinity must be explicitly rejected as an invalid pump rating`));
      }
    }
    current.control = { input: hydraulicInput, result: control }; current.observations = observations;
  });
  await finding('PH0-002', 'correctness defect', async () => {
    const d = small({ requestedAccelerators: 8, workload: 0 });
    const roundTrip = s => {
      const project = projectFile(d, s), text = JSON.stringify(project);
      let observed;
      try { assert.deepEqual(parseProject(text), project); observed = { accepted: true }; }
      catch (error) { if (error instanceof AssertionError) throw error; observed = { accepted: false, rejection: error.message }; }
      return { timeS: s.timeS, eventCount: s.events.length, eventTimeRangeS: s.events.length ? [s.events[0].timeS, s.events.at(-1).timeS] : [], appliedEventCount: s.appliedEventIds.length, logCount: s.log.length, schemaVersion: project.schemaVersion, solverVersion: project.solverVersion, encodedBytes: Buffer.byteLength(text), ...observed };
    };
    const records = [];
    for (const count of [999, 1000, 1001]) {
      const events = Array.from({ length: count }, (_, i) => ({ id: `work-${String(i).padStart(5, '0')}`, timeS: 0, kind: 'workload', assetId: 'shore/grid', value: i % 2 ? 0.1 : 0 }));
      const state = advance(d, initialize(d), 0, events);
      assert.equal(state.events.length, count); assert.equal(state.appliedEventIds.length, count);
      const observation = roundTrip(state); records.push({ case: `events-${count}`, ...observation });
      if (count <= 1000) assert.equal(observation.accepted, true);
      else {
        if (!observation.accepted) assert.equal(observation.rejection, 'Time or event count exceeds replay bounds.');
        desired('round-trip 1001 valid engine-applied events', () => assert.equal(observation.accepted, true, 'Real exporter output from 1001 legitimate applied engine events must import'));
        await save('PH0-002-minimal-project.json', projectFile(d, state));
      }
    }
    for (const timeS of [86399, 86400, 86401, 30 * 86400]) {
      const s = advance(d, initialize(d), 0, [{ id: 'scheduled', kind: 'workload', assetId: 'shore/grid', timeS, value: 0 }]);
      const observation = roundTrip(s); records.push({ case: 'future-event', ...observation });
      if (timeS <= 86400) assert.equal(observation.accepted, true);
      else {
        if (!observation.accepted) assert.equal(observation.rejection, 'Invalid event record.');
        desired(`round-trip supported scheduled event at ${timeS}s`, () => assert.equal(observation.accepted, true));
      }
    }
    assert.throws(() => validateEvent(d, { id: 'outside', kind: 'workload', assetId: 'shore/grid', timeS: 30 * 86400 + 1, value: 0 }), /30-day replay horizon/);
    const tenThousand = Array.from({ length: 10000 }, (_, i) => ({ id: `e-${i}`, kind: 'workload', assetId: 'shore/grid', timeS: 0, value: 0 }));
    const maximum = advance(d, initialize(d), 0, tenThousand); assert.equal(maximum.events.length, 10000);
    assert.throws(() => advance(d, maximum, 0, [{ id: 'over-max', kind: 'workload', assetId: 'shore/grid', timeS: 0, value: 0 }]), /Event history exceeds 10000 entries/);
    const beforeDay = advance(d, initialize(d), 86399), atDay = advance(d, beforeDay, 1), afterDay = advance(d, atDay, 1);
    for (const s of [beforeDay, atDay, afterDay]) {
      const observation = roundTrip(s); records.push({ case: 'elapsed-time', ...observation });
      if (s.timeS <= 86400) assert.equal(observation.accepted, true);
      else {
        if (!observation.accepted) assert.equal(observation.rejection, 'Time or event count exceeds replay bounds.');
        desired('round-trip legitimate engine clock at 86401s', () => assert.equal(observation.accepted, true));
      }
    }
    current.config = d.config; current.timestepS = 1; current.records = records;
    current.engineBoundary = { maxUniqueEvents: 10000, maxEventsAppliedObserved: maximum.appliedEventIds.length, maxLogEntriesObserved: maximum.log.length, maxAdvanceDurationS: 86400, horizonS: 2592000 };
  });
  await finding('PH0-003', 'intentional constraint / preset adequacy gap', async () => {
    assert.equal(HARDWARE.acceleratorsPerNode, 8); assert.equal(NETWORK_ASSUMPTIONS.clusterBitSPerNode, 100e6);
    assert.deepEqual(fixtures.scenarios.find(f => f.id === 'default-pilot').config, DEFAULT_CONFIG);
    const records = [];
    for (const fixture of fixtures.scenarios) {
      const start = performance.now(), d = buildDesign(fixture.config), initial = initialize(d), state = advance(d, initial, fixture.durationS, fixture.events);
      const expected = fixture.expected, core = resolveAsset(d, 'shore/cluster-core');
      assert.equal(core.ratings.capacityBitS, 400e9); assert.equal(core.ports.find(p => p.id === 'cluster-out').capacity, 400e9);
      assert.equal(d.nodeCount, expected.nodes); assert.equal(d.modules.length, expected.modules); assert.equal(d.assets.filter(a => a.type === 'platform').length, expected.platforms);
      assert.equal([...d.modules].reduce((sum, m) => sum + moduleAssets(d, m.id).filter(a => a.type === 'compute').length, 0), expected.nodes);
      for (const s of [initial, state]) {
        assert.equal(s.modules.reduce((sum, m) => sum + m.energizedNodes, 0), expected.nodes);
        const assessment = assessNetwork(d, s.modules, s.failedAssetIds);
        assert.equal(assessment.clusterDemandBitS, expected.clusterDemandGbitS * 1e9); assert.equal(assessment.status, expected.networkStatus);
        assert.equal(assessment.externalDemandBitS, 0);
        if (expected.networkStatus === 'violated') {
          assert.equal(summarize(d, s).availableAccelerators, 0);
          assert.deepEqual(assessment.bottlenecks.map(b => b.resourceId), ['port:shore/cluster-core:cluster-out']);
        } else assert.equal(summarize(d, s).availableAccelerators, expected.provisionedAccelerators);
      }
      const assessment = assessNetwork(d, state.modules, state.failedAssetIds);
      records.push({ id: fixture.id, designRevision: d.revision, requestedAccelerators: d.config.requestedAccelerators, provisionedAccelerators: d.provisionedAccelerators, nodeCount: d.nodeCount, modules: d.modules.length, platforms: expected.platforms, timeS: state.timeS, initialEnergizedNodes: initial.modules.reduce((s, m) => s + m.energizedNodes, 0), network: assessment, terminalSummary: summarize(d, state), observedExecutionMs: performance.now() - start, equilibrium: 'not assessed' });
    }
    current.disposition = 'DOCUMENTED LIMITATION — undersized presets reproduced; shortfall correctly reported';
    current.capacityArithmetic = '400000000000 bit/s / 100000000 bit/s/node = 4000 nodes = 32000 accelerators'; current.scenarios = records;
  });
  await finding('PH0-004', 'assumption/ownership risk', async () => {
    const d = small(), m = d.modules[0], pump = resolveAsset(d, `${m.id}/pump-duty`), state = initialize(d);
    const input = { ...hydraulicInput, lengthM: loopGeometry(d, m).technicalLengthM, shutoffPa: pump.ratings.shutoffPa, freeFlowM3S: pump.ratings.freeFlowM3S, efficiency: pump.ratings.efficiency };
    const fromInspector = solveHydraulics(input), changedTestLocal = solveHydraulics({ ...input, shutoffPa: input.shutoffPa / 2 });
    assert.equal(fromInspector.flowM3S, state.modules[0].technicalFlowM3S); assert.notEqual(changedTestLocal.flowM3S, fromInspector.flowM3S);
    const engine = await fs.readFile('src/twin/engine/simulation.ts', 'utf8');
    const circuit = engine.slice(engine.indexOf('function circuit('), engine.indexOf('function resolveStep('));
    assert.ok(circuit.includes('solveHydraulics({')); assert.ok(!/shutoffPa|freeFlowM3S|efficiency|\.ratings/.test(circuit));
    assert.equal(DEFAULT_CONFIG.shutoffPa, undefined);
    assert.equal(resolveAsset(d, pump.id).ratings.shutoffPa, 250000);
    current.disposition = 'DOCUMENTED LIMITATION — structural ownership risk, no supported rating edit/runtime mismatch demonstrated';
    current.evidence = { assetId: pump.id, catalogId: pump.catalogId, assetRevision: pump.revision, inspectorRatings: pump.ratings, engineFlowM3S: state.modules[0].technicalFlowM3S, directSolverWithInspectorFlowM3S: fromInspector.flowM3S, testLocalHalfShutoffFlowM3S: changedTestLocal.flowM3S, supportedConfigRatingEdit: false, explanation: 'moduleAssets produces inspector ratings, but circuit omits those optional solver arguments and solveHydraulics owns identical defaults. The hypothetical half-rating is a test-local direct solver input only, not a supported design change or observed shipping numerical mismatch.' };
  });
  const observe = (d, events, durationS) => {
    let state = advance(d, initialize(d), 0, events); const trace = [summarize(d, state)];
    while (state.timeS < durationS) { state = advance(d, state, 1); trace.push(summarize(d, state)); }
    return { state, trace };
  };
  await finding('PH0-005', 'capability/evaluation gap', async () => {
    const d = small({ batteryWhPerModule: 0 }), domain = d.modules[0].powerDomainId;
    const events = [{ id: 'feeder-loss', timeS: 5, kind: 'trip', assetId: domain }, { id: 'feeder-recovery', timeS: 10, kind: 'restore', assetId: domain }];
    const fault = observe(d, events, 15), control = observe(d, [], 15), summary = summarize(d, fault.state);
    assert.ok(control.trace.every(s => s.availableAccelerators === 1280));
    assert.ok(fault.trace.filter(s => s.timeS >= 5 && s.timeS < 10).every(s => s.availableAccelerators === 0));
    assert.equal(summary.availableAccelerators, 1280); assert.equal(fault.state.failedAssetIds.length, 0);
    const finalConstraints = constraints(d, fault.state), report = engineeringReport(d, fault.state), csv = resultsCSV(d, fault.state);
    assert.equal(finalConstraints.find(c => c.id === 'EL-02').status, 'satisfied');
    assert.ok(report.includes('feeder-loss') && report.includes('feeder-recovery')); // Events are preserved: do not overclaim erasure.
    assert.ok(fault.state.log.some(e => e.assetId === domain));
    assert.ok(!('minimumAvailableAccelerators' in summary));
    assert.ok(!csv.includes('availableAccelerators')); assert.ok(!csv.includes('interruption'));
    const sizing = sizingAssessment(d, fault.state);
    assert.equal(sizing.passes, true);
    current.config = d.config; current.events = events; current.timestepS = 1; current.durationS = 15;
    current.controlTrace = control.trace; current.faultTrace = fault.trace; current.terminalSummary = summary; current.terminalConstraints = finalConstraints; current.sizing = { passes: sizing.passes, failures: sizing.failures, unassessed: sizing.unassessed };
    current.observerOnly = { minimumAvailableAccelerators: 0, interruptionIntervalS: [5, 10], note: 'Sampled at every integer second and all event boundaries; this bounded case has a 5 s outage. No general accumulator added.' };
    current.retainedEvidence = { events: fault.state.events, causalLog: fault.state.log, energyPUE: summary.energyPUE };
    current.disposition = 'REPRODUCED — terminal acceptance omits whole-run service continuity; events/log/energy history remain';
    await fs.writeFile(path.join(out, 'PH0-005-engineering-report.md'), report);
    await fs.writeFile(path.join(out, 'PH0-005-terminal-results.csv'), csv);
  });
  await finding('PH0-006', 'capability/evaluation gap', async () => {
    const records = [];
    for (const generation of [2, 3]) {
      const d = small({ generation, requestedAccelerators: 5128, batteryWhPerModule: 0 }), domain = d.modules[0].powerDomainId;
      const events = [{ id: 'feeder-loss', timeS: 5, kind: 'trip', assetId: domain }, { id: 'feeder-recovery', timeS: 10, kind: 'restore', assetId: domain }];
      const run = observe(d, events, 15), interrupted = replay(d, events, 6), openTies = d.connections.filter(e => e.medium === 'power' && !e.enabled);
      assert.equal(summarize(d, initialize(d)).availableAccelerators, 5128);
      assert.equal(summarize(d, interrupted).availableAccelerators, 8); assert.equal(summarize(d, run.state).availableAccelerators, 5128);
      assert.equal(openTies.length, generation === 3 ? 1 : 0);
      const affected = interrupted.modules.filter(m => m.availableAccelerators === 0).map(m => m.id);
      assert.equal(affected.length, 4); assert.ok(affected.every(id => id.startsWith('platform-001/')));
      if (generation === 3) {
        assert.throws(() => validateEvent(d, { id: 'transfer', timeS: 6, kind: 'close-tie', assetId: domain }), /Unsupported event kind/);
        const enabled = { ...d, connections: d.connections.map(e => ({ ...e, enabled: true })) };
        assert.ok(initialize(enabled).modules.some(m => m.warnings.some(w => w.includes('Unsupported power topology'))));
      }
      records.push({ generation, config: d.config, designRevision: d.revision, events, timestepS: 1, durationS: 15, failedAsset: resolveAsset(d, domain), affectedModules: affected, powerDomains: d.modules.map(m => ({ id: m.id, powerDomainId: m.powerDomainId })), openTies, powerConnections: d.connections.filter(e => e.medium === 'power'), trace: run.trace, terminalSummary: summarize(d, run.state) });
    }
    current.disposition = 'DOCUMENTED LIMITATION — no automatic transfer benefit demonstrated in supported radial operation';
    current.experiment = records;
    current.limit = 'Same declared 5128 accelerators, workload and disturbance timing; Gen II switchboards versus Gen III segment feeders, different second-platform geometry/routing and a 2.2 MW normally-open tie. Both share shore/grid. This case does not imply all outputs are identical or that III can never differ. Manually enabling all ties was only a test-local unsupported-topology characterization.';
  });
} catch (error) {
  result.infrastructureError = { name: error.name, message: error.message }; process.exitCode = 2;
} finally {
  await server.close();
  result.completedAt = new Date().toISOString();
  const expectedCount = selected ? 1 : 6;
  result.evidenceGate = result.findings.length === expectedCount && result.findings.every(f => f.evidenceCheck === 'PASS' && !f.disposition.startsWith('ALREADY FIXED')) && !result.infrastructureError ? 'PASS' : 'FAIL';
  if (desiredOnly && !process.exitCode && result.findings.some(f => f.desiredRegressions.some(r => r.outcome === 'EXPECTED SEMANTIC FAILURE'))) process.exitCode = 1;
  result.mode = desiredOnly ? 'desired behavior: known semantic failures return exit 1' : 'diagnostic evidence: reproduced defects allowed, unexpected passes require updated disposition';
  await save('audit.json', result);
  console.log(`Phase 0 diagnostic evidence: ${result.evidenceGate}. Known defects are NOT fixed; this is not the complete preservation gate.`);
  if (result.evidenceGate !== 'PASS' && !process.exitCode) process.exitCode = 2;
}
