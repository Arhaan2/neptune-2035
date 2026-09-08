import {
  DEFAULT_SCENARIO,
  validateScenario,
  type Scenario,
} from '../domain/model';
export const SCHEMA_VERSION = 1;
export function encodeScenario(scenario: Scenario): string {
  const parsed = validateScenario(scenario);
  if (!parsed.valid) throw new RangeError(parsed.errors.join(' '));
  return (
    '#s=' +
    encodeURIComponent(
      JSON.stringify({ v: SCHEMA_VERSION, ...parsed.scenario }),
    )
  );
}
export function decodeScenario(hash: string): {
  scenario: Scenario;
  restoredDefaults: boolean;
} {
  if (!hash || hash === '#')
    return { scenario: { ...DEFAULT_SCENARIO }, restoredDefaults: false };
  try {
    if (hash.length > 2500 || !hash.startsWith('#s='))
      throw new Error('Invalid shared scenario');
    const decoded: unknown = JSON.parse(decodeURIComponent(hash.slice(3)));
    if (
      !decoded ||
      typeof decoded !== 'object' ||
      !('v' in decoded) ||
      decoded.v !== SCHEMA_VERSION
    )
      throw new Error('Unknown version');
    const parsed = validateScenario(decoded);
    if (!parsed.valid) throw new Error('Invalid values');
    return { scenario: parsed.scenario, restoredDefaults: false };
  } catch {
    return { scenario: { ...DEFAULT_SCENARIO }, restoredDefaults: true };
  }
}
