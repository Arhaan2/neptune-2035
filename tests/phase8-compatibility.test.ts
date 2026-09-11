import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { initialize, advance } from '../src/twin/engine/simulation';
import { createWorkerHandler } from '../src/twin/engine/worker';
import { compatibilityFor, normalizeProject, parseProject, recalculateProject, restoreProject, serializeProject } from '../src/twin/persistence/project';
import { identity } from '../src/twin/persistence/structure';
import type { CurrentProject } from '../src/twin/persistence/types';
import type { WorkerResponse } from '../src/twin/types';
import manifest from './fixtures/phase-8/manifest.json';

const source = (name: string) => readFileSync(new URL(`./fixtures/phase-8/${name}`, import.meta.url), 'utf8');
const original = (name: string) => JSON.parse(source(name)) as CurrentProject;
const names = ['phase7-basic.json', 'phase7-network-experiment.json', 'phase7-transfer.json'];

describe('P8-S02 V8-05 real Phase 7 solver 2.3.0 evidence after the numerical repair', () => {
  it('binds the actual old-project fixtures to their unchanged accepted-source generator and hashes', () => {
    expect(manifest).toMatchObject({ sourceCommit: 'c22964d48ddca0e7f7db18ede972125f79dad2df', sourceTree: 'ce6cd0c2009a7eb78e7b41230a8ab6a94cfe0226', sourceUnchanged: true });
    for (const file of manifest.files) {
      expect(Buffer.byteLength(source(file.path))).toBe(file.bytes);
      expect(createHash('sha256').update(source(file.path)).digest('hex')).toBe(file.sha256);
      expect(original(file.path).solverVersion).toBe('2.3.0');
    }
  });

  it.each(names)('%s preserves full original export semantics and explicitly forbids direct or worker continuation', async name => {
    const text = source(name), imported = parseProject(text) as CurrentProject;
    expect(imported).toEqual(original(name));
    expect(serializeProject(imported)).toBe(text);
    expect(compatibilityFor(imported)).toMatchObject({ mode: 'inspection-only', canResume: false, canRecalculate: true });
    expect(() => restoreProject(imported)).toThrow();
    expect(() => advance(imported.designSnapshot, imported.checkpoint!.state, 1)).toThrow();
    for (const kind of ['restore', 'advance', 'replay'] as const) {
      const replies: WorkerResponse[] = [];
      await createWorkerHandler(response => replies.push(response), async () => {}, () => 0)({ version: 2, requestId: 1, epoch: 1, kind, design: imported.designSnapshot, state: imported.checkpoint!.state, durationS: kind === 'restore' ? 0 : 1 });
      expect(replies.at(-1)?.status).toBe('failed');
      expect(replies.at(-1)?.state).toBeUndefined();
    }
    expect(serializeProject(imported)).toBe(text);
  });

  it.each(names)('%s recalculates only as separate current-solver inputs with parent identity and fresh physical state', name => {
    const imported = parseProject(source(name));
    const derived = recalculateProject(imported);
    expect(derived.solverVersion).toBe('2.3.1');
    expect(derived.checkpoint).toBeNull();
    expect(derived.design).toEqual(imported.design);
    expect(derived.events).toEqual(imported.events);
    expect(derived.provenance.parent).toMatchObject({ identity: identity(normalizeProject(imported)), solverVersion: '2.3.0', schemaVersion: 3, action: 'recalculate-current-model' });
    const cold = initialize(derived.designSnapshot);
    expect(cold).toMatchObject({ solverVersion: '2.3.1', timeS: 0, facilityEnergyWh: 0, itEnergyWh: 0, gridEnergyWh: 0, appliedEventIds: [], failedAssetIds: [] });
    expect(cold.experiment).toBeUndefined();
    expect(cold.modules.every(module => module.batteryWh === derived.design.batteryWhPerModule)).toBe(true);
    expect(serializeProject(imported)).toBe(source(name));
  });

  it.each(['phase7-network-experiment.json', 'phase7-transfer.json'])('%s rejects forged binding, mixed nested versions and unsupported historical validation contexts', name => {
    const mutations: ((project: CurrentProject) => void)[] = [
      project => { project.checkpoint!.configIdentity = 'forged'; },
      project => { project.checkpoint!.state.designIdentity = 'forged'; },
      project => { project.solverVersion = '2.3.1'; },
      project => { project.checkpoint!.state.experiment!.definition.solverVersion = '2.3.1'; },
      project => { project.checkpoint!.state.experiment!.initialState!.solverVersion = '2.3.1'; },
      project => { project.solverVersion = project.checkpoint!.state.solverVersion = project.checkpoint!.state.experiment!.definition.solverVersion = project.checkpoint!.state.experiment!.initialState!.solverVersion = 'unknown-historical-99'; },
      project => { project.checkpoint!.state.experiment!.metrics.shortfallAcceleratorS = -1; },
      project => { project.timeS++; project.checkpoint!.state.timeS++; },
    ];
    for (const mutate of mutations) {
      const altered = original(name); mutate(altered);
      expect(() => parseProject(JSON.stringify(altered))).toThrow();
    }
    expect(parseProject(source(name))).toEqual(original(name));
  });

  it('retains actual legacy schema 2 and earlier schema 3 inspection/recalculation behavior', () => {
    for (const file of ['phase-2/phase0-schema2-project.json', 'phase-3/phase2-schema3-network-checkpoint.json']) {
      const text = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8');
      const imported = parseProject(text);
      expect(compatibilityFor(imported).canResume).toBe(false);
      expect(JSON.parse(serializeProject(imported))).toEqual(JSON.parse(text));
      const derived = recalculateProject(imported);
      expect(derived.solverVersion).toBe('2.3.1');
      expect(derived.checkpoint).toBeNull();
      expect(derived.provenance.parent?.solverVersion).toBe(imported.solverVersion);
    }
  });
});
