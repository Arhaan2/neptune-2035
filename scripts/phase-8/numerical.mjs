/** Bounded extension of reference/benchmarks.py and the production numerical interfaces. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createServer } from 'vite';
import { root, argument, sha256, sourceIdentity, tolerances as t, resultSet, writeResults } from './results.mjs';

const out = path.resolve(argument('out') ?? 'artifacts/phase-8-numerical');
const identity = await sourceIdentity(), results = resultSet(), residualSummaries = [], timestepCases = [], switchingSensitivityCases = [];
const startedAt = new Date().toISOString();
const server = await createServer({ root, configFile: false, server: { middlewareMode: true, ws: false }, appType: 'custom', optimizeDeps: { noDiscovery: true } });
let error = null;
try {
  const [electrical, hydraulic, thermal, designAPI, simulation, definition, network] = await Promise.all([
    'solvers/electrical', 'solvers/hydraulic', 'solvers/thermal', 'assets/design', 'engine/simulation', 'experiment/definition', 'solvers/network',
  ].map(name => server.ssrLoadModule(`/src/twin/${name}.ts`)));
  // Re-run the existing independent generator in an isolated directory. Never refresh the oracle in place.
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'neptune-reference-'));
  let benchmarks;
  try {
    await fs.copyFile(path.join(root, 'reference/benchmarks.py'), path.join(temporary, 'benchmarks.py'));
    const stdout = execFileSync('python3', [path.join(temporary, 'benchmarks.py')], { encoding: 'utf8' });
    const original = await fs.readFile(path.join(root, 'reference/benchmarks.json'));
    const regenerated = await fs.readFile(path.join(temporary, 'benchmarks.json'));
    benchmarks = JSON.parse(original);
    results.exact('P8-NUM/reference-reproduction', JSON.parse(regenerated), benchmarks, { generator: 'reference/benchmarks.py', originalSha256: sha256(original), regeneratedSha256: sha256(regenerated), stdout });
  } finally { await fs.rm(temporary, { recursive: true, force: true }); }

  const eBase = { desiredNodes: 1, workload: 1, idleFraction: 0.3, networkAvailable: true, criticalLoadW: 0,
    gridAvailableW: 0, batteryWh: 10000, batteryCapacityWh: 10000, batteryMaxW: 500000,
    batteryAvailable: true, isolated: false, dtS: 1 };
  const electricComponents = [];
  for (const [name, patch, expectedWh, expectedChargeW, expectedDischargeW] of [
    ['discharge', {}, 10000 - 12000 / 0.95 / 3600, 0, 12000],
    ['charge', { desiredNodes: 0, batteryWh: 9000, gridAvailableW: 10000 }, 9000 + 10000 * 0.9506 * 0.95 / 3600, 9506, 0],
    ['reserve', { batteryWh: 1000 }, 1000, 0, 0],
    ['full', { desiredNodes: 0, gridAvailableW: 10000 }, 10000, 0, 0],
    ['instantaneous', { dtS: 0 }, 10000, 0, 12000],
    ['isolated', { isolated: true }, 10000, 0, 0],
  ]) {
    const input = { ...eBase, ...patch }, actual = electrical.solveElectrical(input);
    results.numeric(`P8-NUM/electrical/${name}/energy`, actual.batteryWh, expectedWh, t.batteryWh, 'Wh');
    results.numeric(`P8-NUM/electrical/${name}/charge`, actual.batteryChargeW, expectedChargeW, t.componentResidualW, 'W');
    results.numeric(`P8-NUM/electrical/${name}/discharge`, actual.batteryDischargeW, expectedDischargeW, t.componentResidualW, 'W');
    results.exact(`P8-NUM/electrical/${name}/exclusive-actions`, actual.batteryChargeW === 0 || actual.batteryDischargeW === 0, true);
    // Reconstruct the declared facility boundary independently of the solver's residual field.
    const inputW = actual.gridW + actual.batteryDischargeW / 0.95;
    electricComponents.push({ id: name, denominatorW: inputW,
      residualW: inputW - actual.batteryChargeW * 0.95 - actual.facilityW });
  }
  residualSummaries.push(results.residuals('P8-NUM/electrical', electricComponents, { normalization: 'max(1 W, total component input W)' }));
  const gridRequests = [{ domainId: 'A', requestedW: 80, moduleLimitW: 100 }, { domainId: 'A', requestedW: 20, moduleLimitW: 100 }, { domainId: 'B', requestedW: 100, moduleLimitW: 100 }];
  const allocated = electrical.allocateGrid(gridRequests, 90, new Map([['A', 50], ['B', 100]]));
  results.exact('P8-NUM/electrical/shared-upstream-and-domains', allocated, [24, 6, 60]);

  const hydraulicBase = { lengthM: 0, diameterM: 0.18, roughnessM: 0.000045, densityKgM3: 997,
    dynamicViscosityPaS: 0.000855, fittingsK: 0, equipmentDropPaAtReference: 80000,
    referenceFlowM3S: 0.05, shutoffPa: 250000, freeFlowM3S: 0.1, efficiency: 0.72 };
  for (const pumpCount of [0, 1, 2]) for (const pumpSpeed of [0, 0.5, 1, 1.2]) {
    const actual = hydraulic.solveHydraulics({ ...hydraulicBase, pumpCount, pumpSpeed });
    // Algebraic intersection of two quadratics, independent of production bisection.
    const flow = pumpCount === 0 || pumpSpeed === 0 ? 0 : Math.sqrt(250000 * pumpSpeed ** 2 / (32000000 + 25000000 / pumpCount ** 2));
    const pressure = 32000000 * flow ** 2;
    const prefix = `P8-NUM/hydraulic/${pumpCount}-pumps/${pumpSpeed}-speed`;
    results.numeric(`${prefix}/flow`, actual.flowM3S, flow, t.hydraulicFlowM3S, 'm³/s');
    results.numeric(`${prefix}/pressure`, actual.pressurePa, pressure, t.hydraulicPressurePa, 'Pa');
    results.numeric(`${prefix}/head-residual`, actual.headResidualPa, 0, t.hydraulicPressurePa, 'Pa');
    results.numeric(`${prefix}/power`, actual.electricalW, pressure * flow / 0.72, t.componentResidualW, 'W');
    results.exact(`${prefix}/bounded-iteration`, actual.iterations <= 60, true);
  }

  const hxBase = { technicalInletK: 313.15, seawaterInletK: 293.15, technicalFlowM3S: 0.001,
    seawaterFlowM3S: 0.001, cleanUAWPerK: 1000, foulingResistanceKPerW: 0,
    technicalDensityKgM3: 1000, technicalCpJKgK: 1000, seawaterDensityKgM3: 1000, seawaterCpJKgK: 1000 };
  for (const [name, patch, expectedW] of [
    ['equal-capacity', {}, benchmarks.heatExchangerEqualCapacity.heatW],
    ['near-equal-capacity', { seawaterFlowM3S: 0.001000000000001 }, 10000],
    ['near-equal-branch-boundary', { seawaterFlowM3S: 0.001 / (1 - 5e-9) }, 10000],
    ['reverse', { technicalInletK: 293.15, seawaterInletK: 313.15 }, -10000],
    ['zero-technical', { technicalFlowM3S: 0 }, 0], ['zero-seawater', { seawaterFlowM3S: 0 }, 0],
    ['zero-UA', { cleanUAWPerK: 0 }, 0], ['zero-difference', { seawaterInletK: 313.15 }, 0],
  ]) {
    const input = { ...hxBase, ...patch }, actual = thermal.solveExchanger(input);
    results.numeric(`P8-NUM/HX/${name}/transfer`, actual.heatW, expectedW, name.startsWith('near-equal') ? t.exchangerNearEqualW : t.exchangerBenchmarkW, 'W');
    const hotW = input.technicalFlowM3S * 1e6 * (input.technicalInletK - actual.technicalOutletK);
    const coldW = input.seawaterFlowM3S * 1e6 * (actual.seawaterOutletK - input.seawaterInletK);
    results.numeric(`P8-NUM/HX/${name}/hot-stream`, hotW, actual.heatW, t.exchangerStreamsW, 'W');
    results.numeric(`P8-NUM/HX/${name}/cold-stream`, coldW, actual.heatW, t.exchangerStreamsW, 'W');
    results.numeric(`P8-NUM/HX/${name}/streams`, hotW - coldW, 0, t.exchangerStreamsW, 'W');
  }
  const normalInput = { ...hxBase, technicalFlowM3S: 0.05, seawaterFlowM3S: 0.05, technicalDensityKgM3: 997, technicalCpJKgK: 4180, seawaterDensityKgM3: 1025, seawaterCpJKgK: 3990, cleanUAWPerK: 350000 };
  const normal = thermal.solveExchanger(normalInput);
  results.numeric('P8-NUM/HX/normal/streams', 0.05 * 997 * 4180 * (313.15 - normal.technicalOutletK) - 0.05 * 1025 * 3990 * (normal.seawaterOutletK - 293.15), 0, t.exchangerStreamsW, 'W');

  for (const stepS of [1, 0.5, 0.25]) {
    let coolantK = 303.15, airK = 298.15;
    const components = [];
    for (let timeS = 0; timeS < 120; timeS += stepS) {
      const actual = thermal.advanceThermal({ coolantK, airK, itW: 0, facilityW: 100000,
        technicalPumpW: 0, seawaterPumpW: 0, technicalFlowM3S: 0, seawaterFlowM3S: 0,
        seawaterK: 291.15, exchangerUAWPerK: 0, foulingResistanceKPerW: 0, fanPowered: true, dtS: stepS });
      const storedW = (actual.coolantK - coolantK) * 24e6 / stepS + (actual.airK - airK) * 12e6 / stepS;
      components.push({ id: `time-${timeS}`, denominatorW: 100000,
        residualW: 100000 - actual.rejectedHeatW - actual.ambientHeatW - storedW });
      ({ coolantK, airK } = actual);
    }
    results.numeric(`P8-NUM/air-RK4/${stepS}`, airK, benchmarks.airTransientRK4.finalK, t.independentAirK, 'K');
    residualSummaries.push(results.residuals(`P8-NUM/thermal/${stepS}`, components, { normalization: 'max(1 W, component facility W)' }));
  }

  const build = patch => designAPI.buildDesign({ ...designAPI.DEFAULT_CONFIG, requestedAccelerators: 1280, workload: 1, ...patch });
  for (const [caseId, durationS, workload, disturbances] of [
    ['smooth-0.6', 120, 0.6, []],
    ['smooth-1', 120, 1, []],
    ['aligned-network-switch', 60, 1, [{ id: 'core-trip', kind: 'trip', assetId: 'shore/cluster-core', timeS: 20 }, { id: 'core-restore', kind: 'restore', assetId: 'shore/cluster-core', timeS: 40 }]],
  ]) {
    const design = build({ workload }), runs = [];
    for (const stepS of [1, 0.5, 0.25]) {
      const def = definition.createExperimentDefinition(design, { id: `phase8-${caseId}-${stepS}`, name: caseId,
        durationS, integrationStepS: stepS, disturbances });
      const initial = simulation.initialize(design, def), matched = [];
      let state = initial;
      for (const targetS of [30, 60, 120].filter(timeS => timeS <= durationS)) {
        state = simulation.advance(design, state, targetS - state.timeS);
        matched.push({ timeS: state.timeS, modules: state.modules.map(module => ({ id: module.id, coolantK: module.coolantK, airK: module.airK })),
          facilityEnergyWh: state.facilityEnergyWh, itEnergyWh: state.itEnergyWh, gridEnergyWh: state.gridEnergyWh,
          batteryWh: state.modules.reduce((sum, module) => sum + module.batteryWh, 0),
          serviceableAccelerators: state.modules.reduce((sum, module) => sum + module.availableAccelerators, 0) });
        residualSummaries.push(results.residuals(`P8-NUM/coupled/${caseId}/${stepS}/${targetS}/electrical`, state.modules.map(module => ({ id: module.id, residualW: module.electricalResidualW, denominatorW: module.gridW + module.batteryDischargeW / 0.95 })), { normalization: 'max(1 W, total component input W)' }));
        residualSummaries.push(results.residuals(`P8-NUM/coupled/${caseId}/${stepS}/${targetS}/thermal`, state.modules.map(module => ({ id: module.id, residualW: module.thermalResidualW, denominatorW: module.facilityW })), { normalization: 'max(1 W, component facility W)' }));
      }
      results.exact(`P8-NUM/coupled/${caseId}/${stepS}/completed`, state.experiment.status, 'completed');
      if (caseId === 'aligned-network-switch') {
        results.numeric(`P8-NUM/timestep/network/${stepS}/unmet`, state.experiment.metrics.shortfallAcceleratorS, 1280 * 20, t.integratedMetric, 'accelerator·s');
        results.numeric(`P8-NUM/timestep/network/${stepS}/interruption`, state.experiment.metrics.serviceViolationS, 20, t.integratedMetric, 's');
        results.exact(`P8-NUM/timestep/network/${stepS}/events`, state.log.filter(row => row.kind === 'command').map(row => ({ timeS: row.timeS, assetId: row.assetId })), [{ timeS: 20, assetId: 'shore/cluster-core' }, { timeS: 40, assetId: 'shore/cluster-core' }]);
      }
      runs.push({ stepS, matched, metrics: state.experiment.metrics, controllerTransitions: state.experiment.metrics.controllerTransitions });
    }
    for (const [coarse, fine] of [[runs[0], runs[1]], [runs[0], runs[2]], [runs[1], runs[2]]]) {
      const pairId = `${coarse.stepS}-vs-${fine.stepS}`;
      for (let index = 0; index < coarse.matched.length; index++) {
        const a = coarse.matched[index], b = fine.matched[index];
        for (const key of ['facilityEnergyWh', 'itEnergyWh', 'gridEnergyWh', 'batteryWh']) results.numeric(`P8-NUM/timestep/${caseId}/${pairId}/${a.timeS}/${key}`, a[key], b[key], t.coupledEnergyWh, 'Wh');
        for (let m = 0; m < a.modules.length; m++) for (const key of ['coolantK', 'airK']) results.numeric(`P8-NUM/timestep/${caseId}/${pairId}/${a.timeS}/${a.modules[m].id}/${key}`, a.modules[m][key], b.modules[m][key], t.coupledTemperatureK, 'K');
        results.exact(`P8-NUM/timestep/${caseId}/${pairId}/${a.timeS}/service`, a.serviceableAccelerators, b.serviceableAccelerators);
      }
      results.exact(`P8-NUM/timestep/${caseId}/${pairId}/controller-transitions`, coarse.controllerTransitions, fine.controllerTransitions);
    }
    timestepCases.push({ id: caseId, requestedAccelerators: 1280, workload, durationS, disturbances, interpretation: 'Same initial conditions and physical times; exact linear-node update with adequate supply and no thermal controller switching. Network event times align at every tested resolution.', runs });
  }

  for (const [accelerators, expectedNodes, expectedDemand, expectedStatus] of [[8, 1, 1e8, 'satisfied'], [32000, 4000, 400e9, 'satisfied'], [32008, 4001, 400.1e9, 'violated']]) {
    const design = build({ requestedAccelerators: accelerators }), allocation = design.modules.map(module => ({ id: module.id, energizedNodes: module.nodeCount }));
    const actual = network.assessNetwork(design, allocation);
    results.exact(`P8-NUM/network/${accelerators}/nodes`, actual.energizedNodes, expectedNodes);
    results.numeric(`P8-NUM/network/${accelerators}/offered`, actual.clusterDemandBitS, expectedDemand, 0, 'bit/s');
    results.exact(`P8-NUM/network/${accelerators}/status`, actual.status, expectedStatus);
    const core = actual.resources.find(resource => resource.resourceId === 'port:shore/cluster-core:cluster-out');
    results.numeric(`P8-NUM/network/${accelerators}/shared-port`, core?.demandBitS, expectedDemand, 0, 'bit/s');
    results.numeric(`P8-NUM/network/${accelerators}/capacity`, core?.capacityBitS, 400e9, 0, 'bit/s');
  }

  // Existing Phase 5 fixture and pre-Phase-8 independent interruption oracle.
  const [transferDemonstrations, experimentReports] = await Promise.all([
    server.ssrLoadModule('/src/twin/transfer/demonstrations.ts'), server.ssrLoadModule('/src/twin/experiment/report.ts'),
  ]);
  const transferFixture = transferDemonstrations.transferDemonstration('eligible').find(fixture => fixture.generation === 3 && fixture.role === 'faulted');
  const transferOracleBytes = await fs.readFile(path.join(root, 'tests/fixtures/phase-5/frozen-expectations.json'));
  const transferOracle = JSON.parse(transferOracleBytes).service;
  const transferRuns = [];
  for (const stepS of [1, 0.5, 0.25]) {
    const design = transferFixture.design, def = { ...structuredClone(transferFixture.definition), integrationStepS: stepS };
    const initial = simulation.initialize(design, def), resourceHistory = [], matched = [];
    const state = simulation.advanceWithStep(design, initial, def.durationS, [], stepS, undefined, (timeS, snapshot) => {
      const boundary = snapshot();
      const resourceRows = boundary.transfer.resources.map(resource => ({ ...resource, excessW: resource.nativeW + resource.transferredW - resource.capacityW }));
      for (const resource of resourceRows) results.numeric(`P8-NUM/transfer-step/${stepS}/${timeS}/${resource.id}/capacity-excess`, Math.max(0, resource.excessW), 0, 1e-6, 'W');
      for (const attempt of boundary.transfer.attempts) results.exact(`P8-NUM/transfer-step/${stepS}/${timeS}/${attempt.id}/no-parallel-feed`, attempt.originalClosed && attempt.tieClosed, false);
      results.exact(`P8-NUM/transfer-step/${stepS}/${timeS}/native-service`, boundary.modules.find(module => module.id.startsWith('platform-001/')).availableAccelerators, 8);
      if (resourceRows.length) resourceHistory.push({ timeS, resources: resourceRows });
      if ([2, 4.375, 5, 9.375, 12].includes(timeS)) matched.push({ timeS, modules: boundary.modules.map(module => ({ id: module.id, coolantK: module.coolantK, airK: module.airK, batteryWh: module.batteryWh, serviceableAccelerators: module.availableAccelerators })), facilityEnergyWh: boundary.facilityEnergyWh, gridEnergyWh: boundary.gridEnergyWh });
    });
    results.exact(`P8-NUM/transfer-step/${stepS}/completed`, state.experiment.status, 'completed');
    results.numeric(`P8-NUM/transfer-step/${stepS}/unmet`, state.experiment.metrics.shortfallAcceleratorS, transferOracle.generationIIIShortfallAcceleratorS, t.integratedMetric, 'accelerator·s');
    results.numeric(`P8-NUM/transfer-step/${stepS}/interruption`, state.experiment.metrics.serviceViolationS, transferOracle.generationIIIInterruptionS, t.integratedMetric, 's');
    results.numeric(`P8-NUM/transfer-step/${stepS}/recovery-confirmation`, experimentReports.experimentRecoveryReport(state).confirmationTimeS, transferOracle.recoveryConfirmationS, t.integratedMetric, 's');
    results.exact(`P8-NUM/transfer-step/${stepS}/internal-deadline`, state.transfer.transitions.filter(transition => transition.reason === 'TRANSFERRED').map(transition => transition.timeS), [transferOracle.transferS]);
    results.exact(`P8-NUM/transfer-step/${stepS}/observed-capacity-resources`, resourceHistory.length > 0, true);
    transferRuns.push({ stepS, matched, resourceHistory, metrics: state.experiment.metrics, transitions: state.transfer.transitions,
      recovery: experimentReports.experimentRecoveryReport(state) });
  }
  switchingSensitivityCases.push({ id: 'phase5-eligible-transfer', source: 'src/twin/transfer/demonstrations.ts: transferDemonstration(eligible), Generation III faulted',
    originalOracle: { path: 'tests/fixtures/phase-5/frozen-expectations.json', sha256: sha256(transferOracleBytes), service: transferOracle },
    interpretation: 'Fixed external fault at 2 s and internal transfer deadline 4.375 s split every production resolution exactly. Discrete service area and recovery are independently fixed; no smooth convergence order is imposed.', runs: transferRuns });

  // Storage depletion makes terminal power and whole-node allocation timestep-dependent.
  // Record those differences while independently enforcing the energy boundary and reserve.
  const storageDesign = build({ batteryWhPerModule: 1000, requireClusterNetwork: false, requireExternalNetwork: false });
  const equipmentAPI = await server.ssrLoadModule('/src/twin/catalog/equipment.ts');
  const storageEquipment = equipmentAPI.resolveModuleEngineering(storageDesign, storageDesign.modules[0].id);
  results.exact('P8-NUM/storage-step/fixture-equipment', { nodePeakW: storageEquipment.electrical.nodePeakW,
    batteryCapacityWh: storageEquipment.battery.ratings.energyWh, dischargeEfficiency: storageEquipment.electrical.dischargeEfficiency,
    chargeEfficiency: storageEquipment.electrical.chargeEfficiency, reserveFraction: storageEquipment.electrical.batteryReserveFraction },
  { nodePeakW: 12000, batteryCapacityWh: 1000, dischargeEfficiency: 0.95, chargeEfficiency: 0.95, reserveFraction: 0.1 });
  const storageEvents = [{ id: 'storage-source-trip', kind: 'trip', assetId: 'shore/grid', timeS: 2 }, { id: 'storage-source-restore', kind: 'restore', assetId: 'shore/grid', timeS: 20 }];
  const storageRuns = [], storageSampleTimes = [2, 10, 19, 20, 30, 60];
  for (const stepS of [1, 0.5, 0.25]) {
    const def = definition.createExperimentDefinition(storageDesign, { id: 'phase8-storage-step-sensitivity', name: 'Storage exhaustion timestep sensitivity', durationS: 60, integrationStepS: stepS, disturbances: storageEvents });
    const initial = simulation.initialize(storageDesign, def), initialWh = initial.modules.reduce((sum, module) => sum + module.batteryWh, 0);
    const initialCriticalW = initial.modules[0].pumpPowerW + storageEquipment.cdu.ratings.capacityW + storageEquipment.moduleSupport.ratings.capacityW;
    const remainingUpperWh = 100 + initialCriticalW * stepS / (0.95 * 3600), matched = [], boundaryEnergy = [];
    let rechargeObserved = false;
    const state = simulation.advanceWithStep(storageDesign, initial, 60, [], stepS, undefined, (timeS, snapshot) => {
      const boundary = snapshot(), batteryWh = boundary.modules.reduce((sum, module) => sum + module.batteryWh, 0);
      const residualWh = boundary.gridEnergyWh - (batteryWh - initialWh) - boundary.facilityEnergyWh;
      results.numeric(`P8-NUM/storage-step/${stepS}/${timeS}/energy-closure`, residualWh, 0, 1e-6, 'Wh', { equation: 'gridEnergyWh - (storedWh - initialStoredWh) - facilityEnergyWh' });
      // No network requirement and full workload: delivered accelerator-time derives from actual integrated IT energy, not zero-dt display dispatch.
      const independentUnmet = 1280 * timeS - boundary.itEnergyWh * 3600 * 8 / 12000;
      results.numeric(`P8-NUM/storage-step/${stepS}/${timeS}/service-area`, boundary.experiment.metrics.shortfallAcceleratorS, independentUnmet, t.integratedMetric, 'accelerator·s', { reference: '1280*t - actual integrated IT Wh * 3600 s/h * 8 accelerators/node / 12000 W/node; full utilization and neither network requirement' });
      for (const module of boundary.modules) {
        results.exact(`P8-NUM/storage-step/${stepS}/${timeS}/${module.id}/reserve`, module.batteryWh >= 100 - t.batteryWh, true);
        results.exact(`P8-NUM/storage-step/${stepS}/${timeS}/${module.id}/capacity`, module.batteryWh <= 1000 + t.batteryWh, true);
        results.exact(`P8-NUM/storage-step/${stepS}/${timeS}/${module.id}/exclusive-actions`, module.batteryChargeW === 0 || module.batteryDischargeW === 0, true);
        results.exact(`P8-NUM/storage-step/${stepS}/${timeS}/${module.id}/finite`, [module.coolantK, module.airK, module.batteryWh, module.gridW, module.facilityW, module.itW].every(Number.isFinite), true);
        if (timeS >= 2 && timeS < 20) results.numeric(`P8-NUM/storage-step/${stepS}/${timeS}/${module.id}/source-lost`, module.gridW, 0, 0, 'W');
        if (timeS === 19) {
          results.numeric(`P8-NUM/storage-step/${stepS}/exhausted-upper-energy`, Math.max(0, module.batteryWh - remainingUpperWh), 0, t.batteryWh, 'Wh', { reserveWh: 100, initialCriticalW, remainingUpperWh });
          results.exact(`P8-NUM/storage-step/${stepS}/exhausted-nodes`, module.energizedNodes, 0);
          results.numeric(`P8-NUM/storage-step/${stepS}/exhausted-discharge`, module.batteryDischargeW, 0, 0, 'W');
        }
        if (timeS >= 20 && module.batteryChargeW > 0) rechargeObserved = true;
      }
      boundaryEnergy.push({ timeS, residualWh, batteryWh, independentUnmet, recordedUnmet: boundary.experiment.metrics.shortfallAcceleratorS });
      if (storageSampleTimes.includes(timeS)) matched.push({ timeS, batteryWh, coolantK: boundary.modules[0].coolantK, airK: boundary.modules[0].airK,
        shortfallAcceleratorS: boundary.experiment.metrics.shortfallAcceleratorS, serviceViolationS: boundary.experiment.metrics.serviceViolationS,
        serviceableAccelerators: boundary.modules[0].availableAccelerators, facilityEnergyWh: boundary.facilityEnergyWh, itEnergyWh: boundary.itEnergyWh,
        gridEnergyWh: boundary.gridEnergyWh, controllerTransitions: structuredClone(boundary.experiment.metrics.controllerTransitions) });
    });
    results.exact(`P8-NUM/storage-step/${stepS}/completed`, state.experiment.status, 'completed');
    results.exact(`P8-NUM/storage-step/${stepS}/recharge-observed`, rechargeObserved, true);
    storageRuns.push({ stepS, initialWh, reserveWh: 100, initialCriticalW, remainingUpperWh, matched, boundaryEnergy,
      metrics: state.experiment.metrics, recovery: experimentReports.experimentRecoveryReport(state), controllerTransitions: state.experiment.metrics.controllerTransitions });
  }
  const storageDifferences = [];
  for (const [coarse, fine] of [[storageRuns[0], storageRuns[1]], [storageRuns[0], storageRuns[2]], [storageRuns[1], storageRuns[2]]]) {
    storageDifferences.push({ coarseStepS: coarse.stepS, fineStepS: fine.stepS,
      matched: coarse.matched.map((sample, index) => ({ timeS: sample.timeS, differenceCoarseMinusFine: Object.fromEntries(
        ['batteryWh', 'coolantK', 'airK', 'shortfallAcceleratorS', 'serviceViolationS', 'serviceableAccelerators', 'facilityEnergyWh', 'itEnergyWh', 'gridEnergyWh'].map(key => [key, sample[key] - fine.matched[index][key]])) })) });
  }
  switchingSensitivityCases.push({ id: 'storage-depletion-and-recovery', requestedAccelerators: 1280, workload: 1, capacityWh: 1000, reserveWh: 100,
    durationS: 60, disturbances: storageEvents, networkRequirements: 'neither required', resolvedEquipment: storageEquipment,
    interpretation: 'Identical cold state, source fault/restoration, controller policy and physical sample times. Energy-limited whole-node dispatch and residual usable storage can depend on timestep. Differences below are descriptive, with no convergence-order or exact-service-independence claim. Energy closure, reserve and independent service-area arithmetic remain mandatory.',
    runs: storageRuns, differences: storageDifferences });
} catch (problem) { error = problem.stack ?? String(problem); }
finally {
  await server.close();
  await writeResults(out, 'numerical', identity, results, { startedAt, completedAt: new Date().toISOString(),
    residualSummaries, timestepCases, switchingSensitivityCases,
    limitations: ['Series-circuit mass equality is structural and does not establish arbitrary hydraulic network conservation.',
      'Timestep comparisons cover smooth thermal evolution, aligned network faults, internal transfer deadlines, and storage depletion/recovery; no smooth convergence order is claimed across controller or whole-node allocation discontinuities.',
      'Integrated transfer native-load/capacity behavior and additional storage/switching scenarios are tested by the retained acceptance suites.'] }, error);
}
