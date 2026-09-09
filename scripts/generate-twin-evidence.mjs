/** Reproducible generated experiments and local timing samples, never measurements. */
import { createServer } from 'vite';
import fs from 'node:fs/promises';
import os from 'node:os';
const server = await createServer({
  server: { middlewareMode: true, watch: null, hmr: false },
  appType: 'custom',
});
try {
  const { buildDesign, DEFAULT_CONFIG } = await server.ssrLoadModule(
    '/src/twin/assets/design.ts',
  );
  const { initialize, advance, replay, summarize } = await server.ssrLoadModule(
    '/src/twin/engine/simulation.ts',
  );
  const {
    projectFile,
    resultsCSV,
    inventoryCSV,
    engineeringReport,
    signatureEvents,
  } = await server.ssrLoadModule('/src/twin/analysis/reports.ts');
  await fs.mkdir('public/experiments', { recursive: true });
  await fs.mkdir('artifacts/v2', { recursive: true });
  const experiments = [];
  for (const standbyPumps of [0, 1]) {
    const design = buildDesign({
        ...DEFAULT_CONFIG,
        requestedAccelerators: 1280,
        standbyPumps,
      }),
      events = signatureEvents(design),
      state = replay(design, events, 240),
      stem = `module-pump-${standbyPumps}-standby`;
    await fs.writeFile(
      `public/experiments/${stem}.json`,
      JSON.stringify(projectFile(design, state), null, 2) + '\n',
    );
    await fs.writeFile(
      `public/experiments/${stem}-results.csv`,
      resultsCSV(design, state),
    );
    const trace = [];
    let s = advance(design, initialize(design), 0, events);
    for (let t = 0; t <= 240; t += 10) {
      if (t) s = advance(design, s, 10);
      trace.push({
        timeS: s.timeS,
        coolantK: s.modules[0].coolantK,
        technicalFlowM3S: s.modules[0].technicalFlowM3S,
        itW: s.modules[0].itW,
        availableAccelerators: s.modules[0].availableAccelerators,
        pump: s.modules[0].states[`${design.modules[0].id}/pump-duty`],
        standby:
          s.modules[0].states[`${design.modules[0].id}/pump-standby`] ??
          'not-installed',
      });
    }
    await fs.writeFile(
      `public/experiments/${stem}-trace.json`,
      JSON.stringify(
        {
          evidence: 'generated',
          designRevision: design.revision,
          solverVersion: state.solverVersion,
          trace,
          log: state.log,
        },
        null,
        2,
      ) + '\n',
    );
    experiments.push({
      name: stem,
      designRevision: design.revision,
      summary: summarize(design, state),
    });
  }
  const pilot = buildDesign(DEFAULT_CONFIG),
    pilotState = replay(pilot, signatureEvents(pilot), 240);
  await fs.writeFile(
    'public/experiments/pilot-project.json',
    JSON.stringify(projectFile(pilot, pilotState), null, 2) + '\n',
  );
  await fs.writeFile(
    'public/experiments/pilot-engineering.md',
    engineeringReport(pilot, pilotState),
  );
  await fs.writeFile(
    'public/experiments/pilot-inventory.csv',
    inventoryCSV(pilot),
  );
  async function writeExperiment(name, design, events, durationS, sampleS = 30) {
    let state = advance(design, initialize(design), 0, events);
    const trace = [summarize(design, state)];
    while (state.timeS < durationS) {
      state = advance(design, state, Math.min(sampleS, durationS - state.timeS));
      trace.push(summarize(design, state));
    }
    await fs.writeFile(`public/experiments/${name}.json`, JSON.stringify(projectFile(design, state), null, 2) + '\n');
    await fs.writeFile(`public/experiments/${name}-trace.json`, JSON.stringify({evidence:'generated', designRevision:design.revision, solverVersion:state.solverVersion, trace, log:state.log}, null, 2) + '\n');
    experiments.push({name, designRevision:design.revision, summary:summarize(design,state)});
  }
  for (const generation of [1, 2, 3]) {
    const design = buildDesign({...DEFAULT_CONFIG, generation});
    await writeExperiment(`family-${generation}-feeder-recovery`, design, [
      {id:'load', timeS:0, kind:'workload', assetId:'shore/grid', value:1},
      {id:'feeder-loss', timeS:30, kind:'trip', assetId:design.modules[0].powerDomainId},
      {id:'feeder-return', timeS:1200, kind:'restore', assetId:design.modules[0].powerDomainId},
    ], 1260, 60);
  }
  const module = buildDesign({...DEFAULT_CONFIG,requestedAccelerators:1280});
  for (const [name, kind, value] of [['warm-seawater','seawater',303.15],['exchanger-fouling','fouling',0.00001]]) {
    await writeExperiment(name,module,[{id:'load',timeS:0,kind:'workload',assetId:'shore/grid',value:1},{id:name,timeS:30,kind,assetId:'shore/grid',value}],300);
  }
  await writeExperiment('workload-ramp',module,[0.2,0.5,1].map((value,index)=>({id:`load-${index}`,timeS:index*30,kind:'workload',assetId:'shore/grid',value})),300);
  for (const name of ['module-maintenance','cluster-link-loss','required-external-loss']) {
    const design=buildDesign({...DEFAULT_CONFIG,generation:2,requireExternalNetwork:name==='required-external-loss'});
    const assetId=name==='module-maintenance'?design.modules[0].id:name==='cluster-link-loss'?design.modules[0].networkDomainId:'shore/fiber';
    await writeExperiment(name,design,[{id:'disturbance',timeS:30,kind:name==='module-maintenance'?'maintenance':'trip',assetId},{id:'recovery',timeS:180,kind:'restore',assetId}],240);
  }
  const timings = [];
  for (const requestedAccelerators of [1280, 10000, 100000, 500000, 1000000]) {
    const samples = [];
    for (let run = 0; run < 3; run++) {
      const start = performance.now(),
        d = buildDesign({
          ...DEFAULT_CONFIG,
          generation: requestedAccelerators > 100000 ? 3 : 2,
          requestedAccelerators,
          supplyW: 10e9,
        }),
        built = performance.now(),
        initial = initialize(d),
        ready = performance.now(),
        end = advance(d, initial, 10),
        done = performance.now();
      samples.push({
        buildMs: built - start,
        initializeMs: ready - built,
        advance10SecondsMs: done - ready,
        moduleCount: d.modules.length,
        itW: end.modules.reduce((s, m) => s + m.itW, 0),
      });
    }
    timings.push({ requestedAccelerators, samples });
  }
  await fs.writeFile(
    'artifacts/v2/numerical-performance.json',
    JSON.stringify(
      {
        observedAt: new Date().toISOString(),
        platform: os.platform(),
        arch: os.arch(),
        cpu: os.cpus()[0]?.model,
        logicalCPUs: os.cpus().length,
        node: process.version,
        scope:
          'Local numerical CPU timings; excludes rendering/worker messaging, not ordinary-laptop benchmark.',
        timings,
      },
      null,
      2,
    ) + '\n',
  );
  await fs.writeFile(
    'public/experiments/index.json',
    JSON.stringify(
      {
        schemaVersion: 2,
        evidence: 'generated',
        physicalValidation: 'pending',
        experiments,
      },
      null,
      2,
    ) + '\n',
  );
  console.log(
    JSON.stringify({
      experiments: experiments.length,
      performanceScenarios: timings.length,
      outputs: 'public/experiments; artifacts/v2/numerical-performance.json',
    }),
  );
} finally {
  await server.close();
}
