/** Explicit solver-version bridge: exact archived replay, then separately judged current recalculation. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
import { root, argument, sha256, sourceIdentity } from './results.mjs';

const LEGACY_COMMIT = 'c22964d48ddca0e7f7db18ede972125f79dad2df';
const LEGACY_TREE = 'ce6cd0c2009a7eb78e7b41230a8ab6a94cfe0226';
const ORIGINAL_ARCHIVE_SHA256 = '1060e1debeea9a960dc0bf558ba9c0e08fd4b0f72a171684d84b020a0988ba75';
const ORIGINAL_HASHES = Object.freeze({
  nominal: '9a5feff6ea56fffa3f703565b406cec31245c64b18200f0ff7e6b1c89678c501',
  transfer: 'ff41783c01ab690bdbc2572af31cf1ec5cac33643287869cae145bf0872880c8',
  'no-benefit-bus': '188eaf2141eefbda41c29f5b80f42dd2a4dbe4f0a3151a8838dd34b4cc6a0967',
  'no-benefit-source': '26cba1cd546d81e0c0e56ee717082d721a79d4016ba307285e6e5a91f76e7232',
  sizing: '0c0d8794fd5c407d6e0c0aca2a6ed02e662e3ceafdbd9ebe83533a14068f2f22',
  sensitivity: 'd439d85221b3fc460b311ec0ab82a2527213e59cd62352d126d972f017848e26',
});
const normalizedResult = result => ({ ...result, runs: [...result.runs].sort((a, b) => a.id.localeCompare(b.id)),
  evaluations: [...result.evaluations].sort((a, b) => `${a.candidateId}:${a.sensitivityId}`.localeCompare(`${b.candidateId}:${b.sensitivityId}`)) });

/** All designs, specifications, inputs and identity-bearing definitions stay exact.
 * Only initial-state computed physical floats gain the SAME unit tolerances used for run outputs.
 * This is a cross-version comparison, not the archived same-solver replay contract. */
export function compareCrossVersion(original, current, identityChanges = []) {
  const allowed = new Map(identityChanges.map(change => [change.path, change]));
  const tol = original.campaign.tolerances, differences = [], numericalChanges = [], timingChanges = [];
  let numericFields = 0, exactNumericFields = 0, otherFields = 0;
  const physicalInitial = /^result\.(?:plan\.runs\[\d+\]\.initialState|runs\[\d+\]\.state\.experiment\.initialState)\./;
  const timing = /^result\.(?:plan\.runs\[\d+\]\.initialState|runs\[\d+\]\.state(?:\.experiment\.initialState)?)\.solverMs$/;
  function toleranceFor(location, parentUnit) {
    const field = location.replace(/\[\d+\]/g, '').split('.').at(-1);
    if (location.startsWith('campaign.') || /\.design\./.test(location) || /\.definition\./.test(location)) return 0;
    if (location.startsWith('result.plan.') && !physicalInitial.test(location)) return 0;
    if (['threshold', 'tolerance', 'version', 'schemaVersion', 'extensionVersion', 'integrationStepS'].includes(field)) return 0;
    if (['workload', 'pumpSpeed', 'seawaterK', 'foulingResistanceKPerW', 'throttle'].includes(field)) return 0;
    if (/Count$|^count$|^samples$|^stepIndex$|^committedIntervals$|^traceSamplesSeen$|^committedStepIndex$|^completedRuns$|^requiredRuns$|^completed$|^planned$|^fullyEvaluatedCandidates$|^workload$/.test(field)) return 0;
    if (physicalInitial.test(location) && (field.endsWith('S') && !field.endsWith('M3S') && !field.endsWith('BitS') || location.includes('.startAtS.') || field === 'throttle' || field === 'capacityW' || field === 'accelerators' || field === 'priority')) return 0;
    if (field.endsWith('Nodes') || field.endsWith('Accelerators') || field === 'requiredAccelerators' || field === 'serviceableAccelerators' || location.includes('.minServiceable.value')) return tol.accelerators;
    if (['actual', 'margin'].includes(field) && parentUnit) {
      const byUnit = { s: tol.seconds, W: tol.watts, USD: tol.USD, 'accelerator-s': tol.acceleratorSeconds, boolean: 0 };
      if (parentUnit in byUnit) return byUnit[parentUnit];
    }
    if (field.endsWith('AcceleratorS')) return tol.acceleratorSeconds;
    if (field.endsWith('K') || /\.max(?:Coolant|Air)\.value$/.test(location)) return tol.kelvin;
    if (field.endsWith('PerS') || field.endsWith('M3S') || field.endsWith('BitS')) return 1e-6;
    if (field.endsWith('S') || location.includes('.startAtS.')) return tol.seconds;
    if (field.endsWith('W') || location.endsWith('.peakSupply.value')) return tol.watts;
    if (field.endsWith('USD') || location.includes('.includedCost.') && ['equipment', 'installation', 'contingency'].includes(field)) return tol.USD;
    return 1e-6;
  }
  function visit(a, b, location, parentUnit) {
    const identityChange = allowed.get(location);
    if (identityChange) {
      if (a !== identityChange.old || b !== identityChange.new) differences.push({ path: location, old: a, new: b, reason: 'Identity differs from independently verified mapping.' });
      return;
    }
    if (timing.test(location)) { if (a !== b) timingChanges.push({ path: location, old: a, new: b, reason: 'Execution timing only; exact same paths excluded by original replay comparator.' }); return; }
    if (typeof a === 'number' && typeof b === 'number') {
      numericFields++;
      const absoluteTolerance = toleranceFor(location, parentUnit), absoluteError = Math.abs(a - b);
      const row = { path: location, old: a, new: b, absoluteError, absoluteTolerance, relativeTolerance: 0, outcome: Number.isFinite(a) && Number.isFinite(b) && absoluteError <= absoluteTolerance ? 'PASS' : 'FAIL' };
      if (a === b) exactNumericFields++; else numericalChanges.push(row);
      if (row.outcome === 'FAIL') differences.push(row);
      return;
    }
    if (a === b) { otherFields++; return; }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) differences.push({ path: location, oldLength: a.length, newLength: b.length, reason: 'Array shape changed.' });
      for (let index = 0; index < Math.max(a.length, b.length); index++) visit(a[index], b[index], `${location}[${index}]`, parentUnit);
      return;
    }
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      for (const key of [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()) {
        if (!Object.hasOwn(a, key) || !Object.hasOwn(b, key)) differences.push({ path: `${location}.${key}`, reason: 'Object key set changed.' });
        else visit(a[key], b[key], location ? `${location}.${key}` : key, typeof a.unit === 'string' ? a.unit : parentUnit);
      }
      return;
    }
    differences.push({ path: location, old: a, new: b, reason: 'Unapproved exact field difference.' });
  }
  visit(original, current, '');
  return { matches: differences.length === 0, numericFields, exactNumericFields, otherFields, numericalChanges, identityChanges, timingChanges, differences,
    toleranceBasis: 'Original Phase6 field/unit tolerances. Campaign/design/specification/definition values exact; only computed physical floats inside initial checkpoints use corresponding output units. Initial clocks, counts, controls and capacities remain exact.' };
}

function metadataMappings(original, derived, api) {
  const changes = [];
  const add = (location, old, actual, independent, reason) => {
    if (actual !== independent) throw Error(`New fingerprint does not match its actual own-version content: ${location}`);
    if (old !== actual) changes.push({ path: location, old, new: actual, independentlyRecomputed: independent, reason });
  };
  add('campaign.versions.solver', original.campaign.versions.solver, derived.campaign.versions.solver, api.solver, 'Explicit V8-05 stable heat-exchanger arithmetic repair; old solver is unavailable for current exact resume.');
  derived.campaign.candidates.forEach((candidate, i) => add(`campaign.candidates[${i}].physicalIdentity`, original.campaign.candidates[i].physicalIdentity, candidate.physicalIdentity, api.engineeringIdentity(candidate.design), 'Own-version engineering fingerprint, with unchanged design/specification input content.'));
  const campaignIdentity = api.identity(derived.campaign);
  for (const location of ['result.campaignIdentity', 'result.plan.campaignIdentity']) add(location, location === 'result.campaignIdentity' ? original.result.campaignIdentity : original.result.plan.campaignIdentity, campaignIdentity, campaignIdentity, 'Campaign fingerprint changes only through the explicitly recorded version/engineering identities.');
  function definitionMap(old, current, base, design) {
    add(`${base}.designRevision`, old.designRevision, current.designRevision, design.revision, 'Definition retains the recorded revision of its resolved design.');
    add(`${base}.solverVersion`, old.solverVersion, current.solverVersion, api.solver, 'Experiment names its executed solver.');
    add(`${base}.physicalIdentity`, old.physicalIdentity, current.physicalIdentity, api.engineeringIdentity(design), 'Definition binds the unchanged design under the current solver identity.');
  }
  function physicalMap(old, current, base, design) {
    add(`${base}.designRevision`, old.designRevision, current.designRevision, design.revision, 'Checkpoint retains the recorded revision of its resolved design.');
    add(`${base}.solverVersion`, old.solverVersion, current.solverVersion, api.solver, 'Actual physical checkpoint records the solver that calculated it.');
    add(`${base}.designIdentity`, old.designIdentity, current.designIdentity, api.engineeringIdentity(design), 'Own-version checkpoint design binding.');
    if (current.transfer) add(`${base}.transfer.designIdentity`, old.transfer?.designIdentity, current.transfer.designIdentity, api.engineeringIdentity(design), 'Own-version transfer-state design binding.');
  }
  derived.result.plan.runs.forEach((run, index) => {
    const before = original.result.plan.runs[index], base = `result.plan.runs[${index}]`;
    if (before.id !== run.id) throw Error('Resolved plan order or candidate/scenario identity changed.');
    if (before.design.revision !== run.design.revision) add(`${base}.design.revision`, before.design.revision, run.design.revision,
      `decision-${api.engineeringIdentity(run.design)}`, 'Existing noncentral physical sensitivity names its derived revision from the own-version engineering fingerprint; all physical design inputs remain exact.');
    definitionMap(before.definition, run.definition, `${base}.definition`, run.design);
    physicalMap(before.initialState, run.initialState, `${base}.initialState`, run.design);
    add(`${base}.initialStateIdentity`, before.initialStateIdentity, run.initialStateIdentity, api.identity(run.initialState), 'Fingerprint computed from the actual newly calculated initial checkpoint; physical differences are separately compared.');
  });
  derived.result.runs.forEach((run, index) => {
    const before = original.result.runs[index], plan = derived.result.plan.runs.find(row => row.id === run.id), base = `result.runs[${index}].state`;
    if (before.id !== run.id || !run.state || !before.state || !plan) throw Error('Completed result identity or state is missing.');
    physicalMap(before.state, run.state, base, plan.design);
    const oldExperiment = before.state.experiment, experiment = run.state.experiment;
    definitionMap(oldExperiment.definition, experiment.definition, `${base}.experiment.definition`, plan.design);
    physicalMap(oldExperiment.initialState, experiment.initialState, `${base}.experiment.initialState`, plan.design);
    add(`${base}.experiment.definitionIdentity`, oldExperiment.definitionIdentity, experiment.definitionIdentity, api.identity(experiment.definition), 'Fingerprint of this executed experiment definition.');
    add(`${base}.experiment.initialStateIdentity`, oldExperiment.initialStateIdentity, experiment.initialStateIdentity, api.identity(experiment.initialState), 'Fingerprint of this actual physical initial state.');
  });
  return changes;
}

export async function recalculateHistorical({ campaigns, legacyCheckout, out }) {
  if (!campaigns || !legacyCheckout || !out) throw Error('Use --campaigns=ORIGINAL_DIR --legacy-checkout=CLEAN_PHASE7_DIR --out=OUTPUT_DIR.');
  campaigns = path.resolve(campaigns); legacyCheckout = path.resolve(legacyCheckout); out = path.resolve(out);
  const currentIdentity = await sourceIdentity();
  if (!currentIdentity.trackedClean) throw Error('Freeze current tracked source before historical recalculation.');
  const legacyGit = (...args) => execFileSync('git', ['-C', legacyCheckout, ...args], { encoding: 'utf8' }).trim();
  const legacyIdentity = { commit: legacyGit('rev-parse', 'HEAD'), tree: legacyGit('rev-parse', 'HEAD^{tree}'),
    lockSha256: sha256(await fs.readFile(path.join(legacyCheckout, 'package-lock.json'))) };
  if (legacyIdentity.commit !== LEGACY_COMMIT || legacyIdentity.tree !== LEGACY_TREE || legacyGit('status', '--porcelain', '--untracked-files=no')) throw Error('Historical replay requires clean exact accepted Phase7 source.');
  if (legacyIdentity.lockSha256 !== currentIdentity.lockSha256) throw Error('Historical/current dependency lock differs; this bridge has not admitted a dependency migration.');
  await fs.mkdir(out, { recursive: true });
  const commands = [], originals = [], records = [];
  const receipt = { kind: 'neptune-phase8-historical-recalculation', version: 1, startedAt: new Date().toISOString(), sourceIdentity: currentIdentity,
    legacyIdentity, originalArchive: { url: 'https://github.com/Arhaan2/neptune-2035/releases/download/phase-7-2026-09-11/phase-7-evidence.zip', sha256: ORIGINAL_ARCHIVE_SHA256, entryPrefix: 'phase-7-evidence/local-final-2/', canonicalFileHashes: ORIGINAL_HASHES },
    commands, campaigns: records, status: 'FAIL', qualification: 'Simulated, design-stage prototype; physical validation pending.' };
  let server;
  async function run(name, command, args, cwd) {
    const logPath = path.join(out, `${name}.log`), log = await fs.open(logPath, 'w');
    let exitCode;
    try { const child = spawn(command, args, { cwd, stdio: ['ignore', log.fd, log.fd] }); exitCode = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); }); }
    finally { await log.close(); }
    commands.push({ name, command: [command, ...args], exitCode, log: `${name}.log` });
    if (exitCode !== 0) throw Error(`${name} failed with exit ${exitCode}; native output retained.`);
  }
  try {
    for (const [family, expectedHash] of Object.entries(ORIGINAL_HASHES)) {
      const input = path.join(campaigns, `reproduce-${family}`, 'campaign.json'), bytes = await fs.readFile(input);
      if (sha256(bytes) !== expectedHash) throw Error(`Historical ${family} bytes differ from the immutable Phase7 release export.`);
      const parsed = JSON.parse(bytes);
      if (parsed.campaign.fixture !== family || parsed.campaign.versions.solver !== '2.3.0') throw Error('Wrong historical fixture or solver.');
      originals.push({ family, input, bytes, parsed, sha256: expectedHash });
    }
    await run('legacy-npm-ci', 'npm', ['ci'], legacyCheckout);
    // Finish all original same-solver comparisons before deriving any new current result.
    for (const original of originals) {
      const destination = path.join(out, 'legacy', `reproduce-${original.family}`);
      await run(`legacy-${original.family}`, process.execPath, ['scripts/phase-6/reproduce.mjs', `--input=${original.input}`, `--out=${destination}`], legacyCheckout);
      const replay = JSON.parse(await fs.readFile(path.join(destination, 'reproduction.json'), 'utf8'));
      if (replay.sourceIdentity.commit !== LEGACY_COMMIT || replay.sourceIdentity.sourceTree !== LEGACY_TREE || replay.status !== 'completed' || replay.comparison?.matches !== true || replay.coverage.completed !== replay.coverage.planned) throw Error(`Original ${original.family} replay did not pass its unmodified historical comparator.`);
      original.legacyReplay = replay;
    }
    server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
    const [decision, equipment, structure, types] = await Promise.all(['decision/index', 'catalog/equipment', 'persistence/structure', 'types'].map(name => server.ssrLoadModule(`/src/twin/${name}.ts`)));
    if (types.SOLVER_VERSION !== '2.3.1') throw Error('This explicit bridge is restricted to the reviewed 2.3.0 → 2.3.1 arithmetic repair.');
    for (const original of originals) {
      let historicalImportRejection;
      try { decision.importDecisionCampaign(original.bytes.toString('utf8')); }
      catch (problem) { historicalImportRejection = String(problem); }
      if (!historicalImportRejection || !/unsupported.*version/i.test(historicalImportRejection)) throw Error('Current strict import must clearly reject unsupported original-solver evidence; do not silently migrate it.');
      const campaign = structuredClone(original.parsed.campaign);
      campaign.versions.solver = types.SOLVER_VERSION;
      for (const candidate of campaign.candidates) candidate.physicalIdentity = equipment.engineeringIdentity(candidate.design);
      decision.validateDecisionCampaign(campaign);
      const result = await decision.runDecisionCampaign(campaign, { concurrency: 1 });
      const exported = decision.exportDecisionCampaign(campaign, result, { commit: currentIdentity.commit, sourceTree: currentIdentity.tree });
      // Current portable output must pass its ordinary strict import, without any bridge tolerance.
      decision.importDecisionCampaign(exported);
      const originalCompared = { campaign: original.parsed.campaign, result: normalizedResult(original.parsed.result) };
      const derivedCompared = { campaign, result: normalizedResult(result) };
      const mappings = metadataMappings(originalCompared, derivedCompared, { solver: types.SOLVER_VERSION, identity: structure.identity, engineeringIdentity: equipment.engineeringIdentity });
      const comparison = compareCrossVersion(originalCompared, derivedCompared, mappings);
      const destination = path.join(out, 'current', `reproduce-${original.family}`);
      await fs.mkdir(destination, { recursive: true });
      await fs.writeFile(path.join(destination, 'campaign.json'), exported + '\n');
      await fs.writeFile(path.join(destination, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n');
      await fs.writeFile(path.join(destination, 'report.md'), decision.decisionReport(campaign, result, { commit: currentIdentity.commit, sourceTree: currentIdentity.tree }));
      const record = { family: original.family, parentOriginalSha256: original.sha256, originalSourceIdentity: original.parsed.sourceIdentity,
        sourceIdentity: currentIdentity, originalSolver: '2.3.0', currentSolver: types.SOLVER_VERSION, legacyReplay: original.legacyReplay, historicalImportRejection,
        originalRanking: original.parsed.result.ranking, currentRanking: result.ranking, currentCoverage: result.coverage,
        currentStatus: result.status, comparison: { matches: comparison.matches, numericFields: comparison.numericFields, exactNumericFields: comparison.exactNumericFields,
          numericalChanges: comparison.numericalChanges.length, identityChanges: comparison.identityChanges.length, failures: comparison.differences.length },
        artifacts: { currentExport: `current/reproduce-${original.family}/campaign.json`, currentSha256: sha256(exported + '\n'), comparison: `current/reproduce-${original.family}/comparison.json` },
        exportMetadataChanges: [{ path: 'sourceIdentity', old: original.parsed.sourceIdentity, new: { commit: currentIdentity.commit, sourceTree: currentIdentity.tree }, reason: 'New execution identifies the actual current source; original source remains preserved above.' },
          { path: 'evidenceIdentity', old: original.parsed.evidenceIdentity, new: JSON.parse(exported).evidenceIdentity, reason: 'Digest of the complete separately generated current campaign, result and source identity; current strict export/import validates the new content.' }],
        interpretation: 'Original evidence replayed exactly with its original solver. This separately derived current export is newly executed evidence; it does not relabel or mutate the historical export.' };
      records.push(record);
      console.log(`Historical bridge ${original.family}: ${comparison.matches ? 'PASS' : 'FAIL'}; ${comparison.numericalChanges.length} numerical deltas, ${comparison.identityChanges.length} explained identities.`);
    }
    receipt.status = records.length === 6 && records.every(row => row.comparison.matches && row.currentStatus === 'completed' && row.currentCoverage.completed === row.currentCoverage.planned) ? 'PASS' : 'FAIL';
  } catch (problem) { receipt.error = problem.stack ?? String(problem); }
  finally {
    if (server) await server.close();
    receipt.completedAt = new Date().toISOString();
    receipt.originalInputsUnchanged = (await Promise.all(originals.map(async original => sha256(await fs.readFile(original.input)) === original.sha256))).every(Boolean);
    receipt.legacyUnchanged = legacyGit('rev-parse', 'HEAD') === LEGACY_COMMIT && legacyGit('rev-parse', 'HEAD^{tree}') === LEGACY_TREE && !legacyGit('status', '--porcelain', '--untracked-files=no');
    const finalIdentity = await sourceIdentity();
    receipt.currentUnchanged = currentIdentity.commit === finalIdentity.commit && currentIdentity.tree === finalIdentity.tree && finalIdentity.trackedClean;
    if (!receipt.originalInputsUnchanged || !receipt.legacyUnchanged || !receipt.currentUnchanged) receipt.status = 'FAIL';
    await fs.writeFile(path.join(out, 'historical-recalculation.json'), JSON.stringify(receipt, null, 2) + '\n');
  }
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const receipt = await recalculateHistorical({ campaigns: argument('campaigns'), legacyCheckout: argument('legacy-checkout'), out: argument('out') });
  console.log(`Historical recalculation: ${receipt.status}`);
  if (receipt.status !== 'PASS') process.exitCode = 1;
}
