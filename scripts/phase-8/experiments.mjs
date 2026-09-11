/** Complete-run regression and replay. Historical decision exports remain immutable inputs. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'vite';
import { root, argument, sha256, sourceIdentity, tolerances, resultSet, writeResults } from './results.mjs';

const out = path.resolve(argument('out') ?? 'artifacts/phase-8-experiments');
const campaignDirectory = argument('campaigns');
if (!campaignDirectory) throw Error('Pass --campaigns=DIR containing the six historical reproduce-FAMILY/campaign.json files. Generate no replacement expected values.');
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

// Every portable historical campaign is recomputed by the existing command, with its native comparison.
// A failure is retained and does not prevent collection of the remaining historical campaign evidence.
for (const family of ['nominal', 'transfer', 'no-benefit-bus', 'no-benefit-source', 'sizing', 'sensitivity']) {
  const input = path.resolve(campaignDirectory, `reproduce-${family}`, 'campaign.json');
  const destination = path.join(out, `reproduce-${family}`);
  const logName = `reproduce-${family}.log`;
  try {
    const before = await fs.readFile(input), supplied = JSON.parse(before);
    results.exact(`P8-EXP/campaign/${family}/fixture-identity`, supplied.campaign.fixture, family);
    const log = await fs.open(path.join(out, logName), 'w');
    const command = [path.join(root, 'scripts/phase-6/reproduce.mjs'), `--input=${input}`, `--out=${destination}`];
    let code;
    try {
      const child = spawn(process.execPath, command, { cwd: root, stdio: ['ignore', log.fd, log.fd] });
      code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
    } finally { await log.close(); }
    results.exact(`P8-EXP/campaign/${family}/native-exit`, code, 0, { log: logName });
    results.exact(`P8-EXP/campaign/${family}/input-preserved`, sha256(await fs.readFile(input)), sha256(before));
    const receipt = JSON.parse(await fs.readFile(path.join(destination, 'reproduction.json'), 'utf8'));
    results.exact(`P8-EXP/campaign/${family}/full-evidence-comparison`, receipt.comparison?.matches, true, { differences: receipt.comparison?.differences });
    results.exact(`P8-EXP/campaign/${family}/complete-coverage`, receipt.coverage.completed, receipt.coverage.planned);
    results.exact(`P8-EXP/campaign/${family}/source`, receipt.sourceIdentity.commit, identity.commit);
    campaigns.push({ family, originalSha256: sha256(before), originalSourceIdentity: supplied.sourceIdentity,
      preservedInputs: supplied.campaign, originalRanking: supplied.result.ranking, reproducedRanking: receipt.ranking,
      coverage: receipt.coverage, comparison: receipt.comparison, exitCode: code, log: logName,
      command: ['node', 'scripts/phase-6/reproduce.mjs', `--input=HISTORICAL/reproduce-${family}/campaign.json`, `--out=OUTPUT/reproduce-${family}`] });
    console.log(`Historical ${family}: exit ${code}; matches ${receipt.comparison?.matches}.`);
  } catch (problem) {
    results.exact(`P8-EXP/campaign/${family}/available-reproduction`, String(problem), 'successful historical comparison');
    campaigns.push({ family, error: String(problem), log: logName });
  }
}
await writeResults(out, 'experiments', identity, results, { startedAt, completedAt: new Date().toISOString(), experiments, campaigns,
  limitations: ['Decision conclusions apply only to the original finite candidate set, included costs, and recorded assumptions.',
    'Full metrics are retained independently of bounded display trace detail; generated evidence is not physical measurement.',
    'This command measures correctness. Worker/browser timings and maximum-campus resource measurements belong to the separate operating-envelope report.'] }, error);
