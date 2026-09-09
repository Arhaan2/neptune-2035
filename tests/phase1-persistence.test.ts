import { describe, expect, it } from 'vitest';
import { buildDesign, DEFAULT_CONFIG } from '../src/twin/assets/design';
import { advance, advanceWithStep, initialize, replay } from '../src/twin/engine/simulation';
import { compatibilityFor, normalizeProject, parseProject, projectFile, recalculateProject, restoreProject, serializeProject } from '../src/twin/persistence/project';
import { CONTRACT, INTEGRATION_STEPS } from '../src/twin/persistence/limits';
import { array, byteLimit, identity, preflightJSON, string, utf8Bytes, validateStructure } from '../src/twin/persistence/structure';
import { validateState } from '../src/twin/persistence/state';
import { validateDesign } from '../src/twin/persistence/design';
import { validateEvent } from '../src/twin/persistence/events';
import { SimulationError } from '../src/twin/safety';
import type { CurrentProject, LegacyProject } from '../src/twin/persistence/types';
import type { Design, OperationEvent, SimulationState } from '../src/twin/types';

const small = () => buildDesign({ ...DEFAULT_CONFIG, requestedAccelerators: 8 });
const event = (i: number, timeS = i): OperationEvent => ({ id: `event-${i}`, timeS, kind: 'workload', assetId: 'shore/grid', value: i % 2 ? 0.7 : 0.8 });
const normalized = (d: Design, s: SimulationState) => normalizeProject(projectFile(d, s));
function code(action: () => unknown, expected: string) {
  try { action(); throw Error('Expected failure'); } catch (error) { expect(error).toBeInstanceOf(SimulationError); expect((error as SimulationError).diagnostic.code).toBe(expected); expect(JSON.stringify((error as SimulationError).diagnostic)).not.toMatch(/:null/); }
}
function roundTrip(d: Design, s: SimulationState) {
  const p = projectFile(d, s), imported = parseProject(serializeProject(p));
  expect(normalizeProject(imported)).toEqual(normalizeProject(p));
  return restoreProject(imported);
}
describe('PH1-PER-01 real historical thresholds', () => {
  it('round-trips real engine-generated 999, 1000, 1001-event applied histories and continues', () => {
    const d = small();
    for (const count of [999, 1000, 1001]) {
      const s = advance(d, initialize(d), count, Array.from({ length: count }, (_, i) => event(i)));
      const restored = roundTrip(d, s);
      expect(restored.state.events).toHaveLength(count); expect(restored.state.appliedEventIds).toHaveLength(count);
      expect(restored.state.log.length).toBeLessThanOrEqual(CONTRACT.maxLogEntries);
      expect(normalized(d, advance(d, s, 1))).toEqual(normalized(restored.design, advance(restored.design, restored.state, 1)));
    }
  }, 30_000);
  it('advances a real one-node run through 86399, 86400 and 86401 seconds, preserving continuation', () => {
    const d = small(), before = advance(d, initialize(d), 86399);
    const at = advance(d, before, 1), after = advance(d, at, 1);
    for (const s of [before, at, after]) { const restored = roundTrip(d, s); expect(restored.state.timeS).toBe(s.timeS); expect(restored.state.facilityEnergyWh).toBeGreaterThan(0); }
    const restored = roundTrip(d, after);
    expect(normalized(d, advance(d, after, 7))).toEqual(normalized(restored.design, advance(restored.design, restored.state, 7)));
  }, 120_000);
});
describe('PH1-PER-02 declared boundaries', () => {
  it('admits 9999/10000 future events through engine/export/import, rejects 10001 atomically', () => {
    const d = small(), initial = initialize(d);
    for (const n of [CONTRACT.maxEvents - 1, CONTRACT.maxEvents]) {
      const s = advance(d, initial, 0, Array.from({ length: n }, (_, i) => event(i, i + 1)));
      expect(roundTrip(d, s).state.events).toHaveLength(n);
    }
    const before = structuredClone(initial);
    expect(() => advance(d, initial, 0, Array.from({ length: CONTRACT.maxEvents + 1 }, (_, i) => event(i, i + 1)))).toThrow();
    expect(initial).toEqual(before);
  }, 30_000);
  it('checks project and event horizon at one-second increments without claiming maximum-duration replay', () => {
    const d = small(), p = projectFile(d, initialize(d));
    for (const t of [CONTRACT.horizonS - 1, CONTRACT.horizonS]) {
      const scenario = { ...p, checkpoint: null, timeS: t, events: [{ ...event(0, t), sequence: 0 }] };
      expect(parseProject(serializeProject(scenario)).timeS).toBe(t);
      validateEvent(d, event(0, t));
    }
    expect(() => serializeProject({ ...p, checkpoint: null, timeS: CONTRACT.horizonS + 1 })).toThrow();
    expect(() => validateEvent(d, event(0, CONTRACT.horizonS + 1))).toThrow();
    expect(() => advance(d, initialize(d), CONTRACT.maxAdvanceS + 1)).toThrow();
    for (const bad of [-1, 0.5, NaN, Infinity, '1', null]) expect(() => advance(d, initialize(d), bad as number)).toThrow();
  });
  it('checks actual UTF-8 bytes below/at/above 64 MiB including multibyte input', () => {
    const d = small(); d.assets[0].name = '潮🌊'; const text = serializeProject(projectFile(d, initialize(d)));
    expect(utf8Bytes(text)).toBeGreaterThan(text.length);
    for (const bytes of [CONTRACT.maxProjectBytes - 1, CONTRACT.maxProjectBytes]) {
      const padded = text + ' '.repeat(bytes - utf8Bytes(text));
      expect(utf8Bytes(padded)).toBe(bytes); expect(parseProject(padded).timeS).toBe(0);
    }
    code(() => byteLimit(text + ' '.repeat(CONTRACT.maxProjectBytes + 1 - utf8Bytes(text))), 'PROJECT_BYTES');
  }, 120_000);
  it('bounds nesting before parse and exact value/key item allocation', () => {
    for (const depth of [CONTRACT.maxDepth - 1, CONTRACT.maxDepth]) {
      const json = '['.repeat(depth) + '0' + ']'.repeat(depth); preflightJSON(json); validateStructure(JSON.parse(json));
    }
    code(() => preflightJSON('['.repeat(CONTRACT.maxDepth + 1) + '0' + ']'.repeat(CONTRACT.maxDepth + 1)), 'STRUCTURE_DEPTH');
    const values = Array(CONTRACT.maxStructuralItems - 2).fill(null); validateStructure(values);
    values.push(null); validateStructure(values); values.push(null); code(() => validateStructure(values), 'STRUCTURE_ITEMS');
  }, 30_000);
  it('checks each shared allocation maximum independently of semantic shape', () => {
    for (const [name, max] of Object.entries({ modules: CONTRACT.maxModules, assets: CONTRACT.maxDesignAssets, connections: CONTRACT.maxConnections, log: CONTRACT.maxLogEntries, events: CONTRACT.maxEvents, savedScenarios: CONTRACT.maxSavedScenarios, ports: 16, routePoints: 64, provenanceSources: 32 })) {
      array(Array(max - 1), name, max); array(Array(max), name, max); code(() => array(Array(max + 1), name, max), 'ARRAY_LIMIT');
    }
    for (const max of [CONTRACT.maxEventIdLength, CONTRACT.maxAssetIdLength, CONTRACT.maxStringLength]) {
      string('x'.repeat(max - 1), 'boundary', max); string('x'.repeat(max), 'boundary', max); code(() => string('x'.repeat(max + 1), 'boundary', max), 'STRING_LIMIT');
    }
    const d = small();
    for (const n of [99, 100]) validateEvent(d, { ...event(0), id: 'x'.repeat(n) });
    expect(() => validateEvent(d, { ...event(0), id: 'x'.repeat(101) })).toThrow();
  });
  it('rejects overflow, duplicate keys, non-JSON values and unsafe fields before serialization', () => {
    const d = small(), p = projectFile(d, initialize(d));
    const text = serializeProject(p);
    expect(() => parseProject(text.replace('"timeS":0', '"timeS":1e309'))).toThrow(/finite/);
    code(() => preflightJSON('{"x":1,"x":2}'), 'DUPLICATE_KEY');
    for (const bad of [NaN, Infinity, -Infinity, undefined, () => 1]) expect(() => validateStructure({ bad })).toThrow();
    const cycle: { child?: unknown } = {}; cycle.child = cycle; code(() => validateStructure(cycle), 'CYCLIC_DATA');
    expect(() => parseProject(text.replace('"kind":"neptune-project"', '"kind":"neptune-project","privateToken":"redacted-fixture"'))).toThrow(/Unknown/);
    expect(() => validateStructure({ get unsafe() { throw Error('Must not execute accessor'); } })).toThrow(/property/);
    const custom = structuredClone(p);
    Object.defineProperty(custom.designSnapshot.assets, 'toJSON', { value: () => [] });
    expect(() => serializeProject(custom)).toThrow(/arrays/);
    let getterExecuted = false;
    const accessor = [1]; Object.defineProperty(accessor, '0', { get() { getterExecuted = true; return 1; } });
    expect(() => validateStructure(accessor)).toThrow(/accessors/); expect(getterExecuted).toBe(false);
  });
});
describe('PH1-CHK-01 / PH1-REP-01 complete boundary checkpoints', () => {
  const scenario = (d: Design): OperationEvent[] => [
    { id: 'z-first', timeS: 0, kind: 'workload', assetId: 'shore/grid', value: 0.2 },
    { id: 'a-second', timeS: 0, kind: 'workload', assetId: 'shore/grid', value: 0.8 },
    { id: 'grid-trip', timeS: 3, kind: 'trip', assetId: 'shore/bus' },
    { id: 'duty-trip', timeS: 5, kind: 'trip', assetId: `${d.modules[0].id}/pump-duty` },
    { id: 'duty-restore', timeS: 11, kind: 'restore', assetId: `${d.modules[0].id}/pump-duty` },
    { id: 'grid-restore', timeS: 25, kind: 'restore', assetId: 'shore/bus' },
  ];
  it('compares intermediate continuous/chunked/fresh restored trajectories around event and startup boundaries', () => {
    const d = small(), events = scenario(d), boundaries = [0, 2, 3, 4, 5, 6, 10, 11, 12, 13, 14, 24, 25, 26, 40];
    let chunked = advance(d, initialize(d), 0, events);
    for (const timeS of boundaries) {
      chunked = advance(d, chunked, timeS - chunked.timeS);
      const continuous = replay(d, events, timeS);
      expect(normalized(d, chunked)).toEqual(normalized(d, continuous));
      const restored = roundTrip(d, chunked);
      expect(normalized(d, advance(d, chunked, 7))).toEqual(normalized(restored.design, advance(restored.design, restored.state, 7)));
      if (timeS === 5) { const m = chunked.modules[0]; expect(m.batteryDischargeW).toBeGreaterThan(0); expect(m.batteryWh).toBeLessThan(d.config.batteryWhPerModule); expect(m.states[`${m.id}/pump-standby`]).toBe('starting'); expect(m.startAtS[`${m.id}/pump-standby`]).toBe(13); }
    }
    expect(chunked.appliedEventIds.slice(0, 2)).toEqual(['z-first', 'a-second']);
  });
  it('same-time interactive admissions equal replay order and duplicate submissions apply exactly once', () => {
    const d = small(), events = scenario(d).slice(0, 2), initial = initialize(d);
    const separately = advance(d, advance(d, initial, 0, [events[0]]), 0, [events[1]]);
    const together = advance(d, initial, 0, events);
    expect(normalized(d, separately)).toEqual(normalized(d, together));
    expect(normalized(d, advance(d, together, 0, events))).toEqual(normalized(d, together));
    expect(() => advance(d, together, 0, [{ ...events[0], value: 0.3 }])).toThrow(/Conflicting/);
  });
  it('persists every allowed integration setting and rejects changing a continuation sequence', () => {
    const d = small();
    for (const step of INTEGRATION_STEPS) {
      const s = advanceWithStep(d, initialize(d), 5, scenario(d), step);
      const restored = roundTrip(d, s);
      expect(restored.state.stepIndex).toBe(5 / step);
      expect(normalized(d, advance(d, s, 7))).toEqual(normalized(d, advance(d, restored.state, 7)));
      expect(() => advanceWithStep(d, s, 1, [], step === 1 ? 0.5 : 1)).toThrow(/retain/);
    }
    for (const step of [0, 0.124, 0.126, 1.001, NaN, Infinity]) expect(() => advanceWithStep(d, initialize(d), 1, [], step)).toThrow();
  });
  it('rejects incoherent/missing state without mutating the active checkpoint', () => {
    const d = small(), state = replay(d, scenario(d), 5), p = projectFile(d, state), original = serializeProject(p);
    const mutations: ((p: CurrentProject) => void)[] = [
      p => { p.checkpoint!.state.appliedEventIds.pop(); }, p => { p.checkpoint!.state.stepIndex++; },
      p => { p.checkpoint!.state.events[0].value = 0.1; }, p => { p.checkpoint!.state.failedAssetIds = []; },
      p => { p.checkpoint!.state.modules[0].startAtS = {}; }, p => { p.checkpoint!.state.modules[0].states = {}; },
      p => { p.checkpoint!.state.modules[0].id = 'unknown'; }, p => { p.checkpoint!.state.modules[0].batteryWh = -1; },
      p => { p.checkpoint!.state.modules[0].gridW = Infinity; }, p => { p.checkpoint!.state.workload = 0.6; },
      p => { p.checkpoint!.state.modules[0].states[`${p.checkpoint!.state.modules[0].id}/pump-duty`] = 'running'; },
      p => { p.designSnapshot.connections[0].capacity++; }, p => { p.checkpoint!.state.log[0].affectedIds = ['unknown']; },
    ];
    for (const mutate of mutations) { const candidate = structuredClone(p); mutate(candidate); expect(() => serializeProject(candidate)).toThrow(); expect(serializeProject(p)).toBe(original); }
    const id = `${state.modules[0].id}/pump-standby`;
    for (const offset of [7, 8]) { const candidate = structuredClone(state); candidate.modules[0].startAtS[id] = state.timeS + offset; validateState(d, candidate); }
    const candidate = structuredClone(state); candidate.modules[0].startAtS[id] = state.timeS + 9; expect(() => validateState(d, candidate)).toThrow(/deadline/);
    const restarting = replay(d, scenario(d), 11);
    restarting.modules[0].startAtS[`${restarting.modules[0].id}/pump-duty`] = 19;
    code(() => validateState(d, restarting), 'STATE_DUTY_DEADLINE');
  });
  it('preserves actual graph changes in the existing design representation', () => {
    const d = small(); d.assets.find(a => a.id === 'shore/cluster-core')!.ports.find(p => p.id === 'cluster-out')!.capacity = 0;
    const s = advance(d, initialize(d), 3), restored = roundTrip(d, s);
    expect(restored.design).toEqual(d); expect(restored.state.modules[0].availableAccelerators).toBe(0);
    expect(normalized(d, advance(d, s, 5))).toEqual(normalized(restored.design, advance(restored.design, restored.state, 5)));
  });
});
describe('PH1-COMP-01 compatibility and provenance', () => {
  it('legacy long histories are scenario-only; explicit recalculation preserves parent and original', () => {
    const d = small(), legacy: LegacyProject = { schemaVersion: 2, kind: 'neptune-project', design: d.config, events: Array.from({ length: 1001 }, (_, i) => event(i)), timeS: 86401, sourceMode: 'simulated', solverVersion: '2.0.0-rc.1' };
    const saved = serializeProject(legacy), imported = parseProject(saved);
    expect(normalizeProject(imported)).toEqual(legacy); expect(compatibilityFor(imported).mode).toBe('scenario-only');
    expect(() => restoreProject(imported)).toThrow();
    const derived = recalculateProject(imported); expect(derived.checkpoint).toBeNull();
    expect(derived.provenance.parent?.identity).toBe(identity(normalizeProject(legacy)));
    expect(derived.provenance.parent?.solverVersion).toBe('2.0.0-rc.1'); expect(serializeProject(legacy)).toBe(saved);
    expect(derived.solverVersion).not.toBe(legacy.solverVersion); expect(derived.events).toHaveLength(1001);
    const mixed = { ...legacy, events: [{ ...event(0), sequence: 1 }, event(1)] };
    const mixedDerived = recalculateProject(parseProject(serializeProject(mixed)));
    expect(mixedDerived.events.map(e => e.sequence)).toEqual([0, 1]);
  });
  it('unknown numerical versions remain inspectable but cannot silently resume', () => {
    const d = small(), p = projectFile(d, advance(d, initialize(d), 4));
    p.solverVersion = p.checkpoint!.state.solverVersion = 'unavailable-7'; p.algorithmId = 'old-algorithm';
    const imported = parseProject(serializeProject(p)); expect(compatibilityFor(imported).mode).toBe('inspection-only');
    expect(() => restoreProject(imported)).toThrow(/unavailable/); expect(normalizeProject(imported)).toEqual(normalizeProject(p));
    const derived = recalculateProject(p); expect(derived.provenance.parent?.algorithmId).toBe('old-algorithm'); expect(derived.checkpoint).toBeNull();
    expect(() => parseProject(serializeProject(p).replace('"schemaVersion":3', '"schemaVersion":4'))).toThrow(/structural/);
  });
});
describe('PH1-NUM-03 candidate publication', () => {
  it('rejects nonfinite and inconsistent direct engine inputs without changing last valid state', () => {
    const d = small(), initial = initialize(d), original = structuredClone(initial);
    for (const bad of [NaN, Infinity, -Infinity, null, '3']) {
      const state = structuredClone(initial); state.modules[0].coolantK = bad as number;
      expect(() => advance(d, state, 1)).toThrow(); expect(initial).toEqual(original);
    }
    const badDesign = structuredClone(d); badDesign.config.supplyW = Infinity;
    expect(() => initialize(badDesign)).toThrow(/finite/); expect(initial).toEqual(original);
    const badGraph = structuredClone(d); badGraph.connections[0].capacity = NaN; expect(() => validateDesign(badGraph)).toThrow();
    const missingSource = structuredClone(d); missingSource.assets = missingSource.assets.filter(a => a.id !== 'shore/grid');
    code(() => initialize(missingSource), 'DESIGN_SOURCE');
    const missingPort = structuredClone(d); missingPort.connections[0].fromPort = 'missing';
    code(() => initialize(missingPort), 'EDGE_REFERENCE');
    const badUnit = structuredClone(d); badUnit.assets[0].ports.find(p => p.id === 'power-out')!.unit = 'bit/s';
    code(() => initialize(badUnit), 'PORT_UNIT');
    const wrongDirection = structuredClone(d); wrongDirection.assets[0].ports.find(p => p.id === 'power-out')!.direction = 'in';
    code(() => initialize(wrongDirection), 'POWER_PORT_TOPOLOGY');
    const changed = structuredClone(d); changed.config.idleFraction = 0.5;
    code(() => advance(changed, initial, 1), 'STATE_DESIGN_BINDING');
    code(() => projectFile(changed, initial), 'STATE_DESIGN_BINDING');
    expect(initial).toEqual(original);
  });
});
