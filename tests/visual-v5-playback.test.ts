import { describe, expect, it } from 'vitest';
import { initialPlayback, playbackReducer as reduce, PRESENTATION_READINESS_LIMIT_MS } from '../src/twin/presentation/playback';
const load = () => reduce(initialPlayback, { type: 'load', sourceKey: 'original-evidence:run-1' });
describe('V5 single presentation owner', () => {
  it('loads manually, binds readiness to a request and spends no reading time resolving', () => {
    let state = load();
    state = reduce(state, { type: 'tick', deltaMs: 5000, dwellMs: 1000, count: 3 });
    expect(state).toMatchObject({ phase: 'resolving', elapsedMs: 0, shotIndex: 0 });
    expect(reduce(state, { type: 'scene', token: state.token - 1, sourceKey: state.sourceKey, ready: true, last: false })).toBe(state);
    state = reduce(state, { type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: true, last: false });
    expect(state.phase).toBe('ready');
    expect(reduce(state, { type: 'tick', deltaMs: 60000, dwellMs: 1000, count: 3 })).toBe(state);
  });
  it('supersedes competing completions and advances once per actual readable hold', () => {
    let state = reduce(load(), { type: 'play' });
    const old = state;
    state = reduce(state, { type: 'navigate', shotIndex: 1, automatic: true });
    expect(reduce(state, { type: 'scene', token: old.token, sourceKey: old.sourceKey, ready: true, last: false })).toBe(state);
    state = reduce(state, { type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: true, last: false });
    state = reduce(state, { type: 'tick', deltaMs: 10000, dwellMs: 1000, count: 3 });
    expect(state).toMatchObject({ shotIndex: 2, phase: 'resolving', elapsedMs: 0 });
    state = reduce(state, { type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: true, last: true });
    state = reduce(state, { type: 'tick', deltaMs: 1000, dwellMs: 1000, count: 3 });
    expect(state.phase).toBe('completed');
    expect(reduce(state, { type: 'tick', deltaMs: 100000, dwellMs: 1000, count: 3 })).toBe(state);
  });
  it('pause cancels in-flight work and never catches up hidden time; resume starts a fresh hold', () => {
    let state = reduce(load(), { type: 'play' });
    const token = state.token;
    state = reduce(state, { type: 'pause', reason: 'Document hidden' });
    state = reduce(state, { type: 'scene', token, sourceKey: state.sourceKey, ready: true, last: false });
    state = reduce(state, { type: 'tick', deltaMs: 600000, dwellMs: 1000, count: 3 });
    expect(state).toMatchObject({ phase: 'paused', shotIndex: 0, elapsedMs: 0 });
    expect(reduce(state, { type: 'resume' })).toMatchObject({ phase: 'resolving', automatic: true, elapsedMs: 0 });
  });
  it('reflow suspends dwell, bounded failure stops progression, and restart has no load side effect', () => {
    let state = reduce(load(), { type: 'play' });
    state = reduce(state, { type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: true, last: false });
    state = reduce(state, { type: 'tick', deltaMs: 500, dwellMs: 1000, count: 3 });
    state = reduce(state, { type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: false, last: false });
    state = reduce(state, { type: 'tick', deltaMs: PRESENTATION_READINESS_LIMIT_MS, dwellMs: 1000, count: 3 });
    expect(state).toMatchObject({ phase: 'error', elapsedMs: 500, shotIndex: 0 });
    const restart = reduce(state, { type: 'restart' });
    expect(restart).toMatchObject({ sourceKey: state.sourceKey, phase: 'resolving', shotIndex: 0, automatic: true, elapsedMs: 0 });
  });
  it('retires reused display IDs by source identity and ignores replies after exit', () => {
    const original = load();
    let state = reduce(original, { type: 'load', sourceKey: 'new-evidence:run-1' });
    expect(reduce(state, { type: 'scene', token: original.token, sourceKey: original.sourceKey, ready: true, last: false })).toBe(state);
    state = reduce(state, { type: 'invalidate', reason: 'Exit' });
    expect(reduce(state, { type: 'resume' })).toBe(state);
    expect(reduce(state, { type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: true, last: false })).toBe(state);
  });
});
