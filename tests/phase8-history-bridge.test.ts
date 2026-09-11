import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { DecisionExport } from '../src/twin/decision/types';

type Compared = Pick<DecisionExport, 'campaign' | 'result'>;
type Mapping = { path: string; old: unknown; new: unknown };
let compare: (a: Compared, b: Compared, mappings?: Mapping[]) => { matches: boolean; differences: unknown[]; numericalChanges: { absoluteError: number; absoluteTolerance: number }[] };
const saved = JSON.parse(readFileSync(new URL('./fixtures/phase-8/phase7-decision-nominal.json', import.meta.url), 'utf8')) as DecisionExport;
const original: Compared = { campaign: saved.campaign, result: saved.result };
beforeAll(async () => {
  const moduleURL = new URL('../scripts/phase-8/recalculate-historical.mjs', import.meta.url).href;
  compare = (await import(/* @vite-ignore */ moduleURL)).compareCrossVersion;
});

describe('P8-E08 independent historical bridge acceptance boundaries', () => {
  it('accepts exact actual archived campaign content and explicitly named identity-only changes', () => {
    expect(compare(original, structuredClone(original)).matches).toBe(true);
    const revised = structuredClone(original);
    revised.campaign.versions.solver = '2.3.1';
    expect(compare(original, revised).matches).toBe(false);
    expect(compare(original, revised, [{ path: 'campaign.versions.solver', old: '2.3.0', new: '2.3.1' }]).matches).toBe(true);
    expect(compare(original, revised, [{ path: 'campaign.versions.solver', old: 'wrong-original', new: '2.3.1' }]).matches).toBe(false);
  });

  it.each([
    ['campaign tolerance', (value: Compared) => { value.campaign.tolerances.watts += 1e-12; }],
    ['installed specification rating', (value: Compared) => { value.result.plan.runs[0].design.equipment!.specifications[0].ratings.capacityW += 1e-7; }],
    ['definition threshold', (value: Compared) => { value.result.plan.runs[0].definition.recovery.coolantLimitK += 1e-7; }],
    ['initial physical clock', (value: Compared) => { value.result.plan.runs[0].initialState.timeS += 1e-9; }],
    ['initial discrete service count', (value: Compared) => { value.result.plan.runs[0].initialState.modules[0].availableAccelerators += 1e-7; }],
    ['initial controller throttle', (value: Compared) => { value.result.plan.runs[0].initialState.modules[0].throttle += 1e-7; }],
  ] as const)('requires exact %s even when the difference is beneath numerical tolerance', (_label, change) => {
    const revised = structuredClone(original); change(revised);
    expect(compare(original, revised).matches).toBe(false);
  });

  it.each(['runtime', 'initial'] as const)('uses fixed original physical tolerances for %s floats and rejects larger errors', location => {
    for (const [field, tolerance] of [['gridW', original.campaign.tolerances.watts], ['coolantK', original.campaign.tolerances.kelvin], ['batteryWh', 1e-6]] as const) {
      const revised = structuredClone(original);
      const state = location === 'initial' ? revised.result.plan.runs[0].initialState : revised.result.runs[0].state!;
      state.modules[0][field] += tolerance / 2;
      expect(compare(original, revised).matches, `${location}.${field} inside existing tolerance`).toBe(true);
      state.modules[0][field] += tolerance * 2;
      expect(compare(original, revised).matches, `${location}.${field} outside existing tolerance`).toBe(false);
    }
  });

  it('rejects added metadata keys and preserves unrecognized numeric metadata exactly', () => {
    const added = structuredClone(original);
    Object.assign(added.result, { unrecognizedCounter: 1 });
    expect(compare(original, added).matches).toBe(false);
    const left = structuredClone(original), right = structuredClone(original);
    Object.assign(left.result, { unrecognizedCounter: 0 });
    Object.assign(right.result, { unrecognizedCounter: 1e-7 });
    expect(compare(left, right).matches).toBe(false);
  });
});
