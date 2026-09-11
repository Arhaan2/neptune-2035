import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG, reconfigureDesign, replaceEquipment, withNetworkPreset } from '../src/twin/assets/design';
import { engineeringIdentity, resolveSpecification, updateEconomicAssumptions } from '../src/twin/catalog/equipment';
import { initialize, advance, replay } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { PHASE3_TRAFFIC_PROFILE } from '../src/twin/network-contract';
import { compatibilityFor, normalizeProject, parseProject, projectFile, recalculateProject, restoreProject, serializeProject } from '../src/twin/persistence/project';
import { identity } from '../src/twin/persistence/structure';
import { assessNetworkProvisioning } from '../src/twin/solvers/network';
import { TelemetryStore } from '../src/twin/telemetry/store';
import type { WorkerResponse } from '../src/twin/types';

const small = () => withNetworkPreset(buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8, requireExternalNetwork: true }), 'scalable-reference');
const duty = 'platform-001/module-01/pump-duty';
const fixtureText = () => readFileSync(new URL('./fixtures/phase-3/phase2-schema3-network-checkpoint.json', import.meta.url), 'utf8');

describe('Phase 3 versioned workload, engineering revisions and compatibility', () => {
  it('persists the exact disclosed workload assumptions and declared routing under the new profile identity', () => {
    const design = small(), project = projectFile(design, initialize(design));
    expect(project.designSnapshot.equipment!.networkDesign).toEqual({ id: 'rooted-reference-network', version: '1.0.0', preset: 'scalable-reference' });
    expect(project.designSnapshot.equipment!.workloadProfile).toEqual(PHASE3_TRAFFIC_PROFILE);
    expect(project.designSnapshot.equipment!.workloadProfile).toMatchObject({
      id: 'illustrative-job-traffic-v2', revision: '1.0.0', evidence: 'assumed', acceleratorsPerNode: 8,
      clusterBitSPerNode: 100_000_000, externalBitSPerNode: 1_000_000, unit: 'bit/s per energized node',
      routing: 'deterministic-rooted-source-to-node-v1',
    });
    const profile = project.designSnapshot.equipment!.workloadProfile;
    if (!('provenance' in profile)) throw Error('Phase 3 requires saved workload provenance.');
    expect(profile.provenance).toMatch(/not measured training traffic/);
  });

  it('exports/imports exact supported topology, workload, installed mappings and dynamic state', () => {
    const design = small(), state = advance(design, initialize(design), 2, [
      { id: 'core-failed', timeS: 1, kind: 'trip', assetId: 'shore/cluster-core' },
      { id: 'core-return', timeS: 4, kind: 'restore', assetId: 'shore/cluster-core' },
    ]);
    const project = projectFile(design, state), serialized = serializeProject(project), imported = parseProject(serialized), restored = restoreProject(imported);
    expect(serializeProject(imported)).toBe(serialized);
    expect(restored.design).toEqual(design); expect(restored.state).toEqual({ ...state, solverMs: 0 });
    expect(normalizeProject(projectFile(design, advance(design, state, 3)))).toEqual(normalizeProject(projectFile(restored.design, advance(restored.design, restored.state, 3))));
    expect(restored.state.modules[0].availableAccelerators).toBe(0);
    expect(advance(restored.design, restored.state, 3).modules[0].availableAccelerators).toBe(8);
  });

  it('changes engineering identity for network revisions and prevents old checkpoint transplantation through all boundaries', async () => {
    const original = small(), state = advance(original, initialize(original), 2), before = projectFile(original, state);
    const changed = withNetworkPreset(original, 'undersized-shared-core');
    expect(changed.revision).not.toBe(original.revision); expect(engineeringIdentity(changed)).not.toBe(engineeringIdentity(original));
    expect(projectFile(original, state)).toEqual(before);
    expect(() => advance(changed, state, 1)).toThrow(/design|revision|checkpoint/i);
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'restore', design: changed, state });
    expect(responses.at(-1)?.status).toBe('failed'); expect(responses.at(-1)?.state).toBeUndefined();
    const transplanted = structuredClone(before); transplanted.designSnapshot = changed;
    expect(() => parseProject(JSON.stringify(transplanted))).toThrow(/design|revision|checkpoint/i);
  });

  it('retains selected network semantics across ordinary preset/config changes and preserves installed pumps', () => {
    const original = replaceEquipment(small(), duty, 'pump-efficient'), before = structuredClone(original);
    const design = reconfigureDesign(original, { requestedAccelerators: 100_000, supplyW: 300e6 });
    expect(design.equipment!.networkDesign).toEqual(original.equipment!.networkDesign);
    expect(design.equipment!.workloadProfile).toEqual(original.equipment!.workloadProfile);
    expect(resolveSpecification(design, duty).id).toBe('pump-efficient');
    expect(assessNetworkProvisioning(design).status).toBe('satisfied');
    expect(original).toEqual(before);
  });

  it('retains the authentic Phase 2 schema3 checkpoint with its original fingerprint and explicit derived path', () => {
    const text = fixtureText(), raw = JSON.parse(text), imported = parseProject(text);
    if (imported.schemaVersion !== 3) throw Error('Authentic fixture must remain schema 3.');
    expect(imported.solverVersion).toBe('2.2.0'); expect(imported.timeS).toBe(2);
    expect(imported.checkpoint!.configIdentity).toBe(raw.checkpoint.configIdentity);
    expect(imported.checkpoint!.state).toEqual(raw.checkpoint.state);
    expect(imported.designSnapshot.equipment!.workloadProfile.id).toBe('illustrative-job-traffic-v1');
    expect(imported.designSnapshot.equipment!.networkDesign).toBeUndefined();
    expect(compatibilityFor(imported)).toMatchObject({ mode: 'inspection-only', canResume: false, canRecalculate: true });
    expect(() => restoreProject(imported)).toThrow();
    const before = serializeProject(imported), derived = recalculateProject(imported);
    expect(serializeProject(imported)).toBe(before);
    expect(derived.provenance.parent?.identity).toBe(identity(normalizeProject(imported)));
    expect(derived.checkpoint).toBeNull(); expect(derived.events).toEqual(imported.events);
    expect(derived.designSnapshot.equipment!.networkDesign).toBeUndefined();
    expect(derived.designSnapshot.equipment!.workloadProfile).toEqual(imported.designSnapshot.equipment!.workloadProfile);
    expect(derived.designSnapshot.connections).toEqual(imported.designSnapshot.connections);
    expect(replay(derived.designSnapshot, derived.events, 5).modules[0].availableAccelerators).toBe(8);
  });

  it.each(['profile-version', 'network-version', 'network-preset', 'traffic-meaning', 'routing'] as const)('rejects unknown/altered %s on project and worker admission without substituting latest', async field => {
    const design = small(), valid = projectFile(design, initialize(design)), bad = structuredClone(valid);
    if (field === 'profile-version') Object.assign(bad.designSnapshot.equipment!.workloadProfile, { revision: '99.0.0' });
    if (field === 'network-version') Object.assign(bad.designSnapshot.equipment!.networkDesign!, { version: '99.0.0' });
    if (field === 'network-preset') Object.assign(bad.designSnapshot.equipment!.networkDesign!, { preset: 'unlimited-virtual-cores' });
    if (field === 'traffic-meaning') Object.assign(bad.designSnapshot.equipment!.workloadProfile, { clusterBitSPerNode: 1 });
    if (field === 'routing') Object.assign(bad.designSnapshot.equipment!.workloadProfile, { routing: 'ecmp' });
    bad.checkpoint = null;
    expect(() => parseProject(JSON.stringify(bad))).toThrow();
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'initialize', design: bad.designSnapshot });
    expect(responses.at(-1)?.status).toBe('failed'); expect(responses.at(-1)?.state).toBeUndefined();
    expect(projectFile(design, initialize(design))).toEqual(valid);
  });

  it('keeps complete physical checkpoints and observation records unchanged by network equipment price edits', async () => {
    const design = small(), state = advance(design, initialize(design), 2);
    const store = new TelemetryStore(design), sample = {
      assetId: duty, metric: 'pumpPowerW', value: 1000, unit: 'W', sourceId: 'generated:phase3', evidence: 'generated',
      observedAt: '2026-09-10T00:00:00Z', receivedAt: '2026-09-10T00:00:00Z', sequence: 1, quality: [], mappingVersion: design.revision,
    };
    expect(store.ingest(sample).accepted).toBe(true);
    const observation = store.latest(duty, 'pumpPowerW', 'generated:phase3');
    const priced = updateEconomicAssumptions(design, { unitCostScale: 1.25 });
    expect(projectFile(priced, state).checkpoint).toEqual(projectFile(design, state).checkpoint);
    expect(engineeringIdentity(priced)).toBe(engineeringIdentity(design));
    expect(store.latest(duty, 'pumpPowerW', 'generated:phase3')).toEqual(observation);
    const responses: WorkerResponse[] = [];
    await createWorkerHandler(response => responses.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind: 'advance', design: priced, state, durationS: 1 });
    expect(responses.at(-1)?.status).toBe('complete');
    expect(responses.at(-1)!.state).toEqual({ ...advance(design, state, 1), solverMs: 0 });
  });

  it('rejects stale telemetry mapping and unknown event assets after a network revision', () => {
    const original = small(), changed = withNetworkPreset(original, 'undersized-shared-core'), store = new TelemetryStore(changed);
    expect(store.ingest({ assetId: duty, metric: 'pumpPowerW', value: 1000, unit: 'W', sourceId: 'generated:phase3', evidence: 'generated', observedAt: '2026-09-10T00:00:00Z', receivedAt: '2026-09-10T00:00:00Z', sequence: 1, quality: [], mappingVersion: original.revision })).toMatchObject({ accepted: false, reason: 'version' });
    expect(() => replay(changed, [{ id: 'bad-slot', timeS: 0, kind: 'trip', assetId: 'shore/fabric-that-never-existed' }], 0)).toThrow(/asset|unknown/i);
  });
});
