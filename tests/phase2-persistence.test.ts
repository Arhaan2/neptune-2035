import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allAssets, buildDesign, DEFAULT_CONFIG, replaceEquipment, withDefaultSpecification } from '../src/twin/assets/design';
import { engineeringIdentity, economicIdentity, installedEquipmentIdentity, resolveSpecification, updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { advance, initialize, replay } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { compatibilityFor, normalizeProject, parseProject, projectFile, recalculateProject, restoreProject, serializeProject } from '../src/twin/persistence/project';
import { CONTRACT } from '../src/twin/persistence/limits';
import { identity } from '../src/twin/persistence/structure';
import { TelemetryStore } from '../src/twin/telemetry/store';
import { presentedPosition } from '../src/scene/twinGeometry';
import type { Design, WorkerResponse } from '../src/twin/types';

const duty = 'platform-001/module-01/pump-duty', standby = 'platform-001/module-01/pump-standby';
const small = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const fixture = (name: string) => readFileSync(new URL(`./fixtures/phase-2/${name}`, import.meta.url), 'utf8');

describe('PH2-07/08 stable asset slots and deterministic engineering fingerprints', () => {
  it('keeps identities across nonstructural presentation and changes installed identity with replacement', () => {
    const design = small(), original = structuredClone(design);
    const assetIds = Array.from(allAssets(design), asset => asset.id), run = engineeringIdentity(design);
    for (const asset of allAssets(design)) { presentedPosition(asset, true); presentedPosition(asset, false); }
    expect(design).toEqual(original); expect(engineeringIdentity(design)).toBe(run);
    expect(Array.from(allAssets(design), asset => asset.id)).toEqual(assetIds);
    const changed = replaceEquipment(design, duty, 'pump-efficient');
    expect(Array.from(allAssets(changed), asset => asset.id)).toEqual(assetIds);
    expect(engineeringIdentity(changed)).not.toBe(run);
    expect(installedEquipmentIdentity(changed, duty)).not.toBe(installedEquipmentIdentity(design, duty));
  });
  it('includes component records, topology, workload, controller and environmental inputs, excluding price and unused records', () => {
    const design = small(), original = engineeringIdentity(design);
    const changes = [
      replaceEquipment(design, duty, 'pump-efficient'),
      withDefaultSpecification(design, 'compute', 'compute-efficient'),
      buildDesign({ ...design.config, workload: 0.7 }),
      buildDesign({ ...design.config, seawaterK: 292.15 }),
      buildDesign({ ...design.config, requireExternalNetwork: true }),
    ];
    const topology = structuredClone(design); topology.connections[0].enabled = false; changes.push(topology);
    const policy = structuredClone(design); Object.assign(policy.equipment!.controlPolicy, { standbyStartS: 9 }); changes.push(policy);
    const traffic = structuredClone(design); Object.assign(traffic.equipment!.workloadProfile, { clusterBitSPerNode: 600e6 }); changes.push(traffic);
    for (const changed of changes) expect(engineeringIdentity(changed)).not.toBe(original);
    const costs = updateEconomicAssumptions(design, { unitCostScale: 1.4 });
    expect(engineeringIdentity(costs)).toBe(original); expect(economicIdentity(costs)).not.toBe(economicIdentity(design));
    const unused = structuredClone(design);
    unused.equipment!.specifications.find(s => s.id === 'pump-physical')!.name = 'Unused display wording';
    expect(engineeringIdentity(unused)).toBe(original);
  });
  it('gives equivalent reference dictionaries/catalog ordering the same identity and a stable project roundtrip', () => {
    const design = replaceEquipment(small(), duty, 'pump-efficient');
    const reordered = structuredClone(design);
    reordered.equipment!.defaults = Object.fromEntries(Object.entries(reordered.equipment!.defaults).reverse()) as NonNullable<Design['equipment']>['defaults'];
    reordered.equipment!.specifications.reverse();
    expect(engineeringIdentity(reordered)).toBe(engineeringIdentity(design));
    const saved = projectFile(design, advance(design, initialize(design), 10));
    expect(serializeProject(parseProject(serializeProject(saved)))).toBe(serializeProject(saved));
  });
});

describe('PH2-09 real legacy compatibility and installed-version persistence', () => {
  it('retains the actual 1001-event schema2 fixture and makes explicit derived recalculation with parent provenance', () => {
    const text = fixture('phase0-schema2-project.json'), imported = parseProject(text);
    expect(imported.schemaVersion).toBe(2); expect(imported.events).toHaveLength(1001);
    expect(compatibilityFor(imported)).toMatchObject({ mode: 'scenario-only', canResume: false, canRecalculate: true });
    expect(() => restoreProject(imported)).toThrow();
    const before = serializeProject(imported), recalculated = recalculateProject(imported);
    expect(serializeProject(imported)).toBe(before);
    expect(recalculated.provenance.parent?.identity).toBe(identity(normalizeProject(imported)));
    expect(recalculated.events).toHaveLength(1001); expect(recalculated.checkpoint).toBeNull();
    expect(resolveSpecification(recalculated.designSnapshot, 'pump')).toMatchObject({ id: 'pump-reference', version: '1.0.0' });
  });
  it('reads the actual Phase1 checkpoint without relabeling its solver and follows explicit compatibility semantics', () => {
    const text = fixture('phase1-schema3-checkpoint.json'), imported = parseProject(text);
    expect(imported.schemaVersion).toBe(3);
    if (imported.schemaVersion !== 3) throw Error('Fixture must remain schema3.');
    expect(imported.timeS).toBe(4); expect(imported.solverVersion).toBe('2.1.0');
    expect(imported.checkpoint!.state.modules[0].startAtS[standby]).toBe(10);
    expect(imported.checkpoint!.state.modules[0].batteryWh).toBeLessThan(400000);
    const before = serializeProject(imported), compatibility = compatibilityFor(imported);
    expect(compatibility.canRecalculate).toBe(true);
    if (compatibility.canResume) {
      const restored = restoreProject(imported); expect(restored.state).toEqual(imported.checkpoint!.state);
    } else {
      expect(compatibility.mode).toBe('inspection-only'); expect(() => restoreProject(imported)).toThrow();
    }
    const derived = recalculateProject(imported);
    expect(derived.checkpoint).toBeNull(); expect(derived.events).toEqual(imported.events);
    expect(derived.provenance.parent?.identity).toBe(identity(normalizeProject(imported)));
    expect(resolveSpecification(derived.designSnapshot, 'pump')).toMatchObject({ id: 'pump-reference', version: '1.0.0' });
    expect(serializeProject(imported)).toBe(before);
  });
  it('roundtrips installed versions and economic assumptions and continues the exact dynamic checkpoint', () => {
    const design = updateEconomicAssumptions(replaceEquipment(small(), duty, 'pump-physical'), { unitCostScale: 1.2 });
    const state = advance(design, initialize(design), 5, [{ id: 'work', timeS: 1, assetId: 'shore/grid', kind: 'workload', value: 0.65 }]);
    const saved = projectFile(design, state), restored = restoreProject(parseProject(serializeProject(saved)));
    expect(restored.design).toEqual(design); expect(restored.state).toEqual({ ...state, solverMs: 0 });
    expect(resolveSpecification(restored.design, duty)).toMatchObject({ id: 'pump-physical', version: '1.0.0' });
    expect(restored.design.equipment!.economics.unitCostScale).toBe(1.2);
    expect(normalizeProject(projectFile(restored.design, advance(restored.design, restored.state, 7)))).toEqual(normalizeProject(projectFile(design, advance(design, state, 7))));
  });
  it('preserves the Phase1 horizon/event contract rather than expanding it with catalog changes', () => {
    expect(CONTRACT.horizonS).toBe(2592000); expect(CONTRACT.maxEvents).toBe(10000);
    const design = replaceEquipment(small(), duty, 'pump-efficient');
    expect(() => replay(design, [{ id: 'beyond', timeS: CONTRACT.horizonS + 1, assetId: duty, kind: 'trip' }], 0)).toThrow();
  });
});

describe('PH2-10 mapping and hardware checkpoint integrity', () => {
  it('rejects resuming a prior hardware checkpoint on both main-thread and actual worker boundaries', async () => {
    const original = small(), state = advance(original, initialize(original), 2, [{ id: 'trip', timeS: 1, assetId: duty, kind: 'trip' }]);
    const replaced = replaceEquipment(original, duty, 'pump-efficient');
    expect(() => advance(replaced, state, 1)).toThrow(/design|revision|checkpoint/i);
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'restore', design: replaced, state });
    expect(responses.at(-1)?.status).toBe('failed'); expect(responses.at(-1)?.state).toBeUndefined();
    const exported = projectFile(original, state); exported.designSnapshot = replaced; exported.design = replaced.config;
    expect(() => parseProject(JSON.stringify(exported))).toThrow(/design|revision|checkpoint/i);
  });
  it('rejects telemetry from the previous installation and removed-asset history instead of silent retargeting', () => {
    const original = small(), replaced = replaceEquipment(original, duty, 'pump-physical');
    const store = new TelemetryStore(replaced);
    const sample = { assetId: duty, metric: 'pumpPowerW', value: 1000, unit: 'W', sourceId: 'generated:phase2', evidence: 'generated', observedAt: '2026-09-10T00:00:00Z', receivedAt: '2026-09-10T00:00:00Z', sequence: 1, quality: [], mappingVersion: original.revision };
    expect(store.ingest(sample)).toMatchObject({ accepted: false, reason: 'version' });
    expect(store.latest(duty, 'pumpPowerW', 'generated:phase2')).toBeNull();
    const removed = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, standbyPumps: 0 });
    expect(() => replay(removed, [{ id: 'old-standby', timeS: 0, assetId: standby, kind: 'trip' }], 0)).toThrow(/asset|unknown|removed/i);
  });
});

describe('PH2-11 installed version/unit/rating boundary validation', () => {
  const invalid: [string, (design: Design) => void][] = [
    ['unknown version', d => { d.equipment!.defaults.pump.version = '99.0.0'; }],
    ['incompatible reference', d => { d.equipment!.overrides[duty] = { id: 'battery-reference', version: '1.0.0' }; }],
    ['nonfinite rating', d => { d.equipment!.specifications.find(s => s.id === 'pump-reference')!.ratings.efficiency = Infinity; }],
    ['invalid range', d => { d.equipment!.specifications.find(s => s.id === 'pump-reference')!.ratings.efficiency = 1.1; }],
    ['wrong unit', d => { d.equipment!.specifications.find(s => s.id === 'pump-reference')!.units.shutoffPa = 'kPa'; }],
    ['fabricated dimensional scale', d => { d.equipment!.specifications.find(s => s.id === 'battery-reference')!.dimensionsM = [22, 20, 14]; }],
    ['missing installed snapshot', d => { d.equipment!.specifications = d.equipment!.specifications.filter(s => s.id !== 'pump-reference'); }],
    ['unknown controller', d => { Object.assign(d.equipment!.controlPolicy, { standbyStartS: 1 }); }],
  ];
  it.each(invalid)('rejects %s through imports and real worker admission without replacing a valid state', async (_name, mutate) => {
    const design = small(), valid = projectFile(design, initialize(design)), bad = structuredClone(valid);
    mutate(bad.designSnapshot);
    expect(() => parseProject(JSON.stringify(bad))).toThrow();
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'initialize', design: bad.designSnapshot });
    expect(responses.at(-1)?.status).toBe('failed'); expect(responses.at(-1)?.state).toBeUndefined();
    expect(projectFile(design, initialize(design))).toEqual(valid);
  });
});

describe('PH2-08 installed asset presentation is excluded from physics identity', () => {
  it.each(['name', 'provenance', 'sourceIds'] as const)('keeps the same engineering fingerprint when only %s display wording changes', field => {
    const design = small(), formatted = structuredClone(design);
    const asset = formatted.assets.find(a => a.id === 'shore/transformer')!;
    if (field === 'name') asset.name = 'Reference shore transformer — display wording only';
    else if (field === 'provenance') asset.provenance = ['display-source-label'];
    else formatted.sourceIds = ['display-source-list'];
    expect(engineeringIdentity(formatted)).toBe(engineeringIdentity(design));
  });
});

describe('PH2-11 cached asset values cannot override installed authoritative transformer', () => {
  it.each(['efficiency', 'capacityW', 'dimensionsM'] as const)('rejects stored transformer %s drift at direct/worker/import boundaries', async field => {
    const design = small(), bad = structuredClone(design), transformer = bad.assets.find(a => a.id === 'shore/transformer')!;
    if (field === 'dimensionsM') transformer.dimensionsM = [40, 40, 60];
    else transformer.ratings[field] = field === 'efficiency' ? 0.5 : 1000;
    // No dynamic checkpoint: this must be rejected by design/spec admission itself.
    expect(() => initialize(bad)).toThrow(/specification|installed|rating|envelope|design|immutable/i);
    const exported = projectFile(design, initialize(design)); exported.checkpoint = null; exported.designSnapshot = bad;
    expect(() => parseProject(JSON.stringify(exported))).toThrow();
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'initialize', design: bad });
    expect(responses.at(-1)?.status).toBe('failed'); expect(responses.at(-1)?.state).toBeUndefined();
  });
});
