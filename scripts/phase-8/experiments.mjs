/** Complete-run regression and replay. Historical decision exports remain immutable inputs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer } from 'vite';
import { root, argument, sha256, sourceIdentity, tolerances, resultSet, writeResults } from './results.mjs';
import { recalculateHistorical } from './recalculate-historical.mjs';

const out = path.resolve(argument('out') ?? 'artifacts/phase-8-experiments');
const campaignDirectory = argument('campaigns');
const legacyCheckout = argument('legacy-checkout');
if (!campaignDirectory || !legacyCheckout) throw Error('Pass --campaigns=DIR with the six original exports and --legacy-checkout=clean Phase7 checkout.');
const identity = await sourceIdentity(), results = resultSet(), experiments = [], campaigns = [];
const startedAt = new Date().toISOString();
await fs.mkdir(out, { recursive: true });
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
let error = null;
try {
  const [designAPI, simulation, definition, runner, demonstrations, project, reports] = await Promise.all([
    'assets/design', 'engine/simulation', 'experiment/definition', 'experiment/runner', 'experiment/demonstrations', 'persistence/project', 'experiment/report',
  ].map(name => server.ssrLoadModule(`/src/twin/${name}.ts`)));
  const physicalDigest = state => sha256(JSON.stringify({ ...state, solverMs: 0 }));
  async function exercise(id, design, experimentDefinition, expected) {
    const direct = runner.runExperiment(design, experimentDefinition);
    const splitS = Math.floor(experimentDefinition.durationS / 2);
    const first = simulation.advance(design, simulation.initialize(design, experimentDefinition), splitS);
    const serialized = project.serializeProject(project.projectFile(design, first));
    const restored = project.restoreProject(project.parseProject(serialized));
    const resumed = simulation.advance(restored.design, restored.state, experimentDefinition.durationS - splitS);
    const replayed = simulation.advance(design, runner.replayExperimentState(design, direct), experimentDefinition.durationS);
    const chunked = runner.runExperiment(design, experimentDefinition, { chunkS: 10 });
    const digest = physicalDigest(direct);
    results.exact(`P8-EXP/${id}/completion`, direct.experiment.status, 'completed');
    results.numeric(`P8-EXP/${id}/coverage`, direct.experiment.metrics.elapsedS, experimentDefinition.durationS, 0, 's');
    results.exact(`P8-EXP/${id}/restored-checkpoint`, physicalDigest(resumed), digest);
    results.exact(`P8-EXP/${id}/replay`, physicalDigest(replayed), digest);
    results.exact(`P8-EXP/${id}/chunks`, physicalDigest(chunked), digest);
    if (expected.shortfall !== undefined) results.numeric(`P8-EXP/${id}/unmet`, direct.experiment.metrics.shortfallAcceleratorS, expected.shortfall, tolerances.integratedMetric, 'accelerator·s');
    if (expected.interruption !== undefined) results.numeric(`P8-EXP/${id}/interruption`, direct.experiment.metrics.serviceViolationS, expected.interruption, tolerances.integratedMetric, 's');
    const report = reports.wholeExperimentReport(direct);
    if (expected.recovery) results.exact(`P8-EXP/${id}/recovery`, report.recovery.status, expected.recovery);
    if (expected.maxCoolantK !== undefined) results.numeric(`P8-EXP/${id}/historical-extremum`, direct.experiment.metrics.maxCoolant.value, expected.maxCoolantK, 1e-6, 'K', { reference: 'docs/phase-4/DEMONSTRATIONS.md and tests/phase4-demonstrations.test.ts; preserved pre-Phase8 reference' });
    const baseline = runner.runExperiment(design, runner.counterfactualDefinition(design, experimentDefinition));
    const pair = runner.comparePair(direct, baseline);
    results.exact(`P8-EXP/${id}/paired-counterfactual`, pair.status, 'comparable');
    await fs.writeFile(path.join(out, `${id}-project.json`), project.serializeProject(project.projectFile(design, direct)) + '\n');
    await fs.writeFile(path.join(out, `${id}-checkpoint.json`), serialized + '\n');
    await fs.writeFile(path.join(out, `${id}-whole-run.json`), JSON.stringify({ report, baseline: reports.wholeExperimentReport(baseline), pair }, null, 2) + '\n');
    experiments.push({ id, modules: design.modules.length, requestedAccelerators: design.config.requestedAccelerators,
      durationS: experimentDefinition.durationS, stepS: experimentDefinition.integrationStepS, initialMode: experimentDefinition.initial.mode,
      source: 'production complete-run metrics; historical or analytical expectations named per check',
      report: `${id}-whole-run.json`, project: `${id}-project.json`, checkpoint: `${id}-checkpoint.json`, physicalDigest: digest,
      metrics: { shortfallAcceleratorS: direct.experiment.metrics.shortfallAcceleratorS, serviceViolationS: direct.experiment.metrics.serviceViolationS,
        thermalViolationS: direct.experiment.metrics.thermalViolationS, maxCoolant: direct.experiment.metrics.maxCoolant,
        controllerTransitionCount: direct.experiment.metrics.controllerTransitionCount, traceTruncated: direct.experiment.metrics.traceTruncated,
        recovery: report.recovery, evaluation: direct.experiment.evaluation } });
    return direct;
  }
  for (const generation of [1, 2, 3]) {
    const design = designAPI.buildDesign({ ...designAPI.DEFAULT_CONFIG, generation, requestedAccelerators: 1280, workload: 1 });
    await exercise(`nominal-generation-${generation}`, design,
      definition.createExperimentDefinition(design, { id: `phase8-nominal-${generation}`, name: `Nominal generation ${generation}`, durationS: 30 }),
      { shortfall: 0, interruption: 0, recovery: 'no-qualifying-interruption' });
  }
  const small = designAPI.buildDesign({ ...designAPI.DEFAULT_CONFIG, requestedAccelerators: 8 });
  const reference = await exercise('reference-core', small, demonstrations.referenceExperiment(small), { shortfall: 80, interruption: 10, recovery: 'recovered' });
  results.exact('P8-EXP/reference-core/recovery-dwell', reports.wholeExperimentReport(reference).recovery.confirmationTimeS, 20);
  const signatures = [];
  for (const fixture of demonstrations.signatureDemonstration()) {
    const standby = fixture.design.config.standbyPumps;
    const state = await exercise(`signature-${standby}-standby`, fixture.design, fixture.definition,
      standby ? { shortfall: 0, interruption: 0, maxCoolantK: 303.67182668317, recovery: 'no-qualifying-interruption' }
        : { shortfall: 79360, interruption: 124, maxCoolantK: 320.48382684974, recovery: 'recovered' });
    results.exact(`P8-EXP/signature-${standby}/downsampled-evidence-retains-full-coverage`, state.experiment.metrics.traceTruncated, true);
    signatures.push(state);
  }
  results.numeric('P8-EXP/signature/similar-coolant-endpoints', signatures[0].modules[0].coolantK - signatures[1].modules[0].coolantK, 0, 0.01, 'K', { purpose: 'historically declared demonstration endpoint similarity, not numerical accuracy' });
  results.numeric('P8-EXP/signature/similar-air-endpoints', signatures[0].modules[0].airK - signatures[1].modules[0].airK, 0, 0.1, 'K', { purpose: 'historically declared demonstration endpoint similarity, not numerical accuracy' });
  const storage = designAPI.buildDesign({ ...designAPI.DEFAULT_CONFIG, requestedAccelerators: 1280, workload: 1, batteryWhPerModule: 10000 });
  const storageDef = definition.createExperimentDefinition(storage, { id: 'phase8-storage-recovery', name: 'Storage exhaustion and recovery', durationS: 1800,
    disturbances: [{ id: 'source-loss', timeS: 30, kind: 'trip', assetId: 'shore/grid' }, { id: 'source-return', timeS: 300, kind: 'restore', assetId: 'shore/grid' }] });
  const stored = await exercise('storage-recovery', storage, storageDef, { recovery: 'recovered' });
  results.exact('P8-EXP/storage-recovery/observed-interruption', stored.experiment.metrics.shortfallAcceleratorS > 0, true);
  results.exact('P8-EXP/storage-recovery/storage-depleted', stored.experiment.metrics.batteryDischargeWh > 0, true);
  const exhausted = simulation.advance(storage, simulation.initialize(storage, storageDef), 299);
  results.exact('P8-EXP/storage-recovery/reserve-respected', exhausted.modules.every(module => module.batteryWh >= 1000 - tolerances.batteryWh && module.energizedNodes === 0), true);
  const unrecovered = definition.createExperimentDefinition(small, { id: 'phase8-no-recovery', name: 'Unrecovered service loss', durationS: 20,
    disturbances: [{ id: 'permanent-core-loss', timeS: 5, kind: 'trip', assetId: 'shore/cluster-core' }] });
  await exercise('not-recovered', small, unrecovered, { shortfall: 120, interruption: 15, recovery: 'not-recovered' });
  const timeoutDefinition = definition.createExperimentDefinition(small, { id: 'phase8-warmup-timeout', name: 'Explicit bounded settling timeout', durationS: 20,
    initial: { mode: 'settled', settling: { maxWarmupS: 30 } } });
  const timeout = runner.runExperiment(small, timeoutDefinition);
  results.exact('P8-EXP/warmup-timeout/status', timeout.experiment.status, 'warmup-timeout');
  results.numeric('P8-EXP/warmup-timeout/no-evaluation-invented', timeout.experiment.metrics.elapsedS, 0, 0, 's');
  await fs.writeFile(path.join(out, 'warmup-timeout.json'), JSON.stringify(reports.wholeExperimentReport(timeout), null, 2) + '\n');
} catch (problem) { error = problem.stack ?? String(problem); }
finally { await server.close(); }

// V8-05 changes solver identity. Preserve exact original-solver replay before explicitly deriving current evidence.
try {
  const bridge = await recalculateHistorical({ campaigns: campaignDirectory, legacyCheckout, out: path.join(out, 'historical-bridge') });
  results.exact('P8-EXP/historical-bridge/status', bridge.status, 'PASS', { error: bridge.error });
  results.exact('P8-EXP/historical-bridge/originals-preserved', bridge.originalInputsUnchanged, true);
  for (const row of bridge.campaigns) {
    results.exact(`P8-EXP/campaign/${row.family}/original-solver-comparison`, row.legacyReplay.comparison.matches, true);
    results.exact(`P8-EXP/campaign/${row.family}/current-cross-version-comparison`, row.comparison.matches, true);
    results.exact(`P8-EXP/campaign/${row.family}/current-complete-coverage`, row.currentCoverage.completed, row.currentCoverage.planned);
    results.exact(`P8-EXP/campaign/${row.family}/current-source`, row.sourceIdentity.commit, identity.commit);
    campaigns.push({ family: row.family, originalSha256: row.parentOriginalSha256, originalSourceIdentity: row.originalSourceIdentity,
      originalRanking: row.originalRanking, reproducedRanking: row.currentRanking, coverage: row.currentCoverage,
      comparison: row.comparison, originalComparison: row.legacyReplay.comparison, bridge: row });
  }
  results.exact('P8-EXP/historical-bridge/all-original-families', campaigns.length, 6);
} catch (problem) {
  results.exact('P8-EXP/historical-bridge/available-reproduction', String(problem), 'successful archived replay and current recalculation');
}
await writeResults(out, 'experiments', identity, results, { startedAt, completedAt: new Date().toISOString(), experiments, campaigns,
  limitations: ['Decision conclusions apply only to the original finite candidate set, included costs, and recorded assumptions.',
    'Full metrics are retained independently of bounded display trace detail; generated evidence is not physical measurement.',
    'This command measures correctness. Worker/browser timings and maximum-campus resource measurements belong to the separate operating-envelope report.'] }, error);
