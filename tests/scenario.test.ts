import { describe, expect, it } from 'vitest';
import { DEFAULT_SCENARIO, presetScenario, BOUNDS } from '../src/domain/model';
import { encodeScenario, decodeScenario } from '../src/state/scenario';
describe('bounded schema-v1 sharing', () => {
  it.each([1, 2, 3] as const)('round-trips generation %s', (generation) => {
    const s = presetScenario(generation);
    expect(decodeScenario(encodeScenario(s))).toEqual({
      scenario: s,
      restoredDefaults: false,
    });
  });
  it('round-trips all field boundaries without losing units', () => {
    for (const [field, range] of Object.entries(BOUNDS))
      for (const value of range) {
        const s = { ...DEFAULT_SCENARIO, [field]: value };
        expect(decodeScenario(encodeScenario(s)).scenario).toEqual(s);
      }
  });
  it.each([
    '#s=%GG',
    '#s=null',
    '#s=%7B',
    '#s=[]',
    '#s=' + 'x'.repeat(2501),
    '#x=1',
    '#s=' + encodeURIComponent(JSON.stringify({ ...DEFAULT_SCENARIO, v: 2 })),
    '#s=' +
      encodeURIComponent(
        JSON.stringify({ ...DEFAULT_SCENARIO, v: 1, assumedPUE: 0.9 }),
      ),
  ])('restores safe defaults for malformed state', (hash) => {
    expect(decodeScenario(hash)).toEqual({
      scenario: DEFAULT_SCENARIO,
      restoredDefaults: true,
    });
  });
  it('empty hash uses defaults without warning', () => {
    expect(decodeScenario('').restoredDefaults).toBe(false);
  });
  it('discards unexpected keys including markup/URLs', () => {
    const s = decodeScenario(
      '#s=' +
        encodeURIComponent(
          JSON.stringify({
            v: 1,
            ...DEFAULT_SCENARIO,
            payload: '<script>alert(1)</script>',
            redirect: 'https://example.com',
          }),
        ),
    );
    expect(s.scenario).toEqual(DEFAULT_SCENARIO);
    expect(s.scenario).not.toHaveProperty('payload');
  });
  it('refuses serializing invalid input', () => {
    expect(() =>
      encodeScenario({ ...DEFAULT_SCENARIO, utilization: 3 }),
    ).toThrow();
  });
});
