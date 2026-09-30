import { afterEach, describe, expect, it, vi } from 'vitest';
import { presentationDiagnostic, presentationDiagnosticChange, presentationDiagnosticIdentity } from '../../src/twin/presentation/diagnostics';

afterEach(() => vi.unstubAllGlobals());
describe('optional presentation observation', () => {
  it('does no identity work without an installed observer', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('crypto', undefined);
    expect(presentationDiagnosticIdentity('private evidence')).toBe('');
    expect(() => presentationDiagnostic('history', { token: 1 })).not.toThrow();
  });
  it('contains observer and synchronous hashing failures without exposing keys', () => {
    const events: unknown[] = [];
    vi.stubGlobal('window', { __NEPTUNE_V5_DIAGNOSTIC_EMIT__: (event: unknown) => { events.push(event); throw Error('observer failure'); } });
    vi.stubGlobal('crypto', undefined);
    const raw = 'private source payload never emitted';
    const id = presentationDiagnosticIdentity(raw);
    expect(id).toMatch(/^identity-\d+$/);
    expect(presentationDiagnosticIdentity(raw)).toBe(id);
    expect(JSON.stringify(events)).not.toContain(raw);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ kind: 'identity', id, reason: 'hash-unavailable' });
  });
  it('emits changed blockers, not changing frame poses under the same blocker', () => {
    const emit = vi.fn();
    vi.stubGlobal('window', { __NEPTUNE_V5_DIAGNOSTIC_EMIT__: emit });
    presentationDiagnosticChange('unit-blocker', 'transition', 'render', { camera: [1, 2, 3] });
    presentationDiagnosticChange('unit-blocker', 'transition', 'render', { camera: [4, 5, 6] });
    presentationDiagnosticChange('unit-blocker', 'stable', 'render', { camera: [7, 8, 9] });
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
