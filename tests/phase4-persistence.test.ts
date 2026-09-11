import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { advance, initialize } from '../src/twin/engine/simulation';
import { createExperimentDefinition } from '../src/twin/experiment/definition';
import { EXPERIMENT_LIMITS } from '../src/twin/experiment/types';
import { compatibilityFor, parseProject, projectFile, restoreProject, serializeProject } from '../src/twin/persistence/project';
import { readCheckpoint, writeCheckpoint } from '../src/twin/persistence/storage';
import type { CurrentProject } from '../src/twin/persistence/types';

const design = buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const definition = createExperimentDefinition(design, { durationS: 20, disturbances: [{ id: 'trip', timeS: 5, assetId: 'shore/cluster-core', kind: 'trip' }, { id: 'restore', timeS: 15, assetId: 'shore/cluster-core', kind: 'restore' }] });
const checkpoint = () => projectFile(design, advance(design, initialize(design, definition), 7));

describe('PH4 checkpoint extension compatibility and durable recovery', () => {
  it('retains an old-format physical checkpoint without synthesizing whole-run metrics or an inferred PASS', () => {
    const legacyPhysical = projectFile(design, advance(design, initialize(design), 20, definition.disturbances));
    const serialized = serializeProject(legacyPhysical), imported = parseProject(serialized), restored = restoreProject(imported);
    expect(serializeProject(imported)).toBe(serialized);
    expect(restored.state.experiment).toBeUndefined();
    expect(advance(design, restored.state, 1).experiment).toBeUndefined();
    expect(compatibilityFor(imported).canResume).toBe(true);
  });
  it('retains actual Phase 2 checkpoint contents and explicitly refuses its incompatible solver', () => {
    const bytes = readFileSync(new URL('./fixtures/phase-3/phase2-schema3-network-checkpoint.json', import.meta.url), 'utf8');
    const imported = parseProject(bytes);
    expect(imported.solverVersion).toBe('2.2.0');
    expect(compatibilityFor(imported)).toMatchObject({ mode: 'inspection-only', canResume: false, canRecalculate: true });
    expect(() => restoreProject(imported)).toThrow();
    expect(JSON.parse(serializeProject(imported))).toEqual(JSON.parse(bytes));
  });
  it('atomically stores and reloads the metric checkpoint and retains old durable state after quota failure', () => {
    let stored: string | null = null, rejected = false;
    const storage = { getItem: () => stored, setItem: (_key: string, value: string) => { if (rejected) throw Error('Quota exceeded'); stored = value; }, removeItem: () => { stored = null; } };
    const first = checkpoint();
    expect(writeCheckpoint(first, storage).ok).toBe(true);
    expect(readCheckpoint(storage).project).toEqual(first);
    rejected = true;
    const next = projectFile(design, advance(design, first.checkpoint!.state, 10));
    expect(writeCheckpoint(next, storage).ok).toBe(false);
    expect(readCheckpoint(storage).project).toEqual(first);
  });
});

describe('PH4 malformed checkpoint rejection without changing the caller state', () => {
  const cases: [string, (project: CurrentProject) => void][] = [
    ['unknown extension', project => { Object.assign(project.checkpoint!.state.experiment!, { extensionVersion: 99 }); }],
    ['unknown metrics version', project => { Object.assign(project.checkpoint!.state.experiment!.metrics, { version: 'future-unavailable' }); }],
    ['mutated definition', project => { project.checkpoint!.state.experiment!.definition.durationS = 21; }],
    ['mismatched commit boundary', project => { project.checkpoint!.state.experiment!.committedTimeS--; }],
    ['mismatched metric coverage', project => { project.checkpoint!.state.experiment!.metrics.elapsedS--; }],
    ['incomplete history marked complete', project => { project.checkpoint!.state.experiment!.status = 'completed'; }],
    ['negative shortfall', project => { project.checkpoint!.state.experiment!.metrics.shortfallAcceleratorS = -1; }],
    ['invalid campus union', project => { project.checkpoint!.state.experiment!.metrics.anyViolationS = 0; }],
    ['mismatched required input history', project => { project.checkpoint!.state.experiment!.inputs.pop(); }],
    ['wrong initial state identity', project => { project.checkpoint!.state.experiment!.initialStateIdentity = 'not-the-checkpoint'; }],
    ['invented passing evaluation', project => { project.checkpoint!.state.experiment!.evaluation = { outcome: 'PASS', reasons: [] }; }],
    ['oversized trace', project => { const metrics = project.checkpoint!.state.experiment!.metrics; metrics.trace = Array.from({ length: EXPERIMENT_LIMITS.traceSamples + 1 }, () => structuredClone(metrics.trace[0])); }],
    ['oversized controller evidence', project => { const metrics = project.checkpoint!.state.experiment!.metrics; metrics.controllerTransitions = Array.from({ length: EXPERIMENT_LIMITS.evidenceEntries + 1 }, () => ({ timeS: 0, assetId: 'shore/grid', message: 'supplied evidence', affectedIds: [], kind: 'controller' as const })); }],
  ];
  it.each(cases)('rejects %s', (_name, mutate) => {
    const original = checkpoint(), before = serializeProject(original), malformed = structuredClone(original);
    mutate(malformed);
    expect(() => parseProject(JSON.stringify(malformed))).toThrow();
    expect(serializeProject(original)).toBe(before);
  });
  it('rejects nonfinite checkpoint quantities before JSON can turn them into null', () => {
    const project = checkpoint();
    project.checkpoint!.state.experiment!.metrics.batteryDischargeWh = Infinity;
    expect(() => serializeProject(project)).toThrow();
  });
});
