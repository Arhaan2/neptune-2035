import { describe, expect, it, vi } from 'vitest';
import { deliverPresentationReport, initialPresentationDelivery, PRESENTATION_REPORT_RETRY_MS } from '../../src/scene/presentationDelivery';
import { initialPlayback, playbackReducer, PRESENTATION_READINESS_LIMIT_MS, type PlaybackAction, type PlaybackState } from '../../src/twin/presentation/playback';

const playingRequest = (sourceKey = 'captured-evidence-A') => playbackReducer(
  playbackReducer(initialPlayback, { type: 'load', sourceKey }), { type: 'play' },
);
const readyAction = (state: PlaybackState): Extract<PlaybackAction, { type: 'scene' }> => ({
  type: 'scene', token: state.token, sourceKey: state.sourceKey, ready: true, last: false,
});
const reportKey = (state: PlaybackState) => `${state.sourceKey}:${state.token}:campus:layout-1:ready:procedural`;

describe('presentation report acknowledgment', () => {
  it('delivers a rejected current snapshot after an injected receiver barrier opens, then stops duplicates', () => {
    // This deliberate receiver-only barrier covers a delivery contract. It is
    // not proof that TwinApp naturally produces this ordering or that it caused
    // the original lost WebKit failure.
    let playback = playingRequest();
    const action = readyAction(playback), key = reportKey(playback);
    let eligible = false;
    const receive = vi.fn(() => {
      if (!eligible) return false;
      playback = playbackReducer(playback, action);
      return true;
    });
    const before = Object.freeze({ ...initialPresentationDelivery });
    const rejected = deliverPresentationReport(before, key, 1000, receive);
    expect(rejected).toMatchObject({ outcome: 'rejected', accepted: false, sent: true });
    expect(rejected.state.acceptedKey).toBeNull();
    expect(before).toEqual(initialPresentationDelivery);
    expect(playback.phase).toBe('resolving');

    eligible = true;
    const deferred = deliverPresentationReport(rejected.state, key, 1249, receive);
    expect(deferred).toMatchObject({ outcome: 'deferred', accepted: false, sent: false });
    expect(playback.phase).toBe('resolving');
    const accepted = deliverPresentationReport(deferred.state, key, 1250, receive);
    expect(accepted).toMatchObject({ outcome: 'accepted', accepted: true, sent: true });
    expect(playback.phase).toBe('playing');
    expect(deliverPresentationReport(accepted.state, key, 5000, receive)).toMatchObject({
      outcome: 'already-accepted', accepted: true, sent: false,
    });
    expect(receive).toHaveBeenCalledTimes(2);
  });

  it('limits repeated rejected snapshots to the existing 250ms cadence', () => {
    let state = initialPresentationDelivery;
    const attempts: number[] = [];
    for (let now = 0; now <= 1000; now += 10) {
      state = deliverPresentationReport(state, 'same-valid-render', now, () => {
        attempts.push(now);
        return false;
      }).state;
    }
    expect(attempts).toEqual([0, 250, 500, 750, 1000]);
    expect(state.acceptedKey).toBeNull();
  });

  it('publishes changed readiness immediately without broadcasting accepted frames', () => {
    const receive = vi.fn(() => true);
    const ready = deliverPresentationReport(initialPresentationDelivery, 'owner:layout:ready', 1000, receive);
    const settling = deliverPresentationReport(ready.state, 'owner:layout:settling', 1001, receive);
    expect(settling).toMatchObject({ outcome: 'accepted', sent: true });
    const duplicate = deliverPresentationReport(settling.state, 'owner:layout:settling', 1002, receive);
    expect(duplicate.sent).toBe(false);
    const reframed = deliverPresentationReport(duplicate.state, 'owner:new-layout:ready', 1003, receive);
    expect(reframed).toMatchObject({ outcome: 'accepted', sent: true });
    expect(receive).toHaveBeenCalledTimes(3);
  });

  it.each(['pause', 'exit', 'source replacement'] as const)('does not revive stale delivery after %s', reason => {
    const old = playingRequest(), oldAction = readyAction(old);
    let playback = reason === 'pause'
      ? playbackReducer(old, { type: 'pause', reason: 'User takeover' })
      : reason === 'exit'
        ? playbackReducer(old, { type: 'invalidate', reason: 'Exit' })
        // Reused token and display position deliberately leave source identity
        // as the distinguishing guard in the actual playback reducer.
        : playingRequest('captured-evidence-B');
    const retired = playback;
    const stale = deliverPresentationReport(initialPresentationDelivery, reportKey(old), 0, () => {
      const next = playbackReducer(playback, oldAction);
      const accepted = next !== playback;
      playback = next;
      return accepted;
    });
    expect(stale.accepted).toBe(false);
    expect(playback).toBe(retired);
    expect(stale.state.acceptedKey).toBeNull();

    playback = reason === 'pause'
      ? playbackReducer(playback, { type: 'resume' })
      : reason === 'exit'
        ? playbackReducer(playback, { type: 'load', sourceKey: 'captured-evidence-B' })
        : playback;
    const currentAction = readyAction(playback);
    const current = deliverPresentationReport(stale.state, reportKey(playback), 1, () => {
      playback = playbackReducer(playback, currentAction);
      return true;
    });
    expect(current.accepted).toBe(true);
    expect(['ready', 'playing']).toContain(playback.phase);
  });

  it('a rejected old report cannot erase an acknowledged current request', () => {
    const old = playingRequest();
    let playback = playbackReducer(old, { type: 'navigate', shotIndex: 1, automatic: true });
    const currentKey = reportKey(playback);
    const accepted = deliverPresentationReport(initialPresentationDelivery, currentKey, 0, () => {
      playback = playbackReducer(playback, readyAction(playback));
      return true;
    });
    const retired = deliverPresentationReport(accepted.state, reportKey(old), 1, () => {
      const next = playbackReducer(playback, readyAction(old));
      expect(next).toBe(playback);
      return false;
    });
    const receive = vi.fn(() => true);
    expect(deliverPresentationReport(retired.state, currentKey, 2, receive).outcome).toBe('already-accepted');
    expect(receive).not.toHaveBeenCalled();
    expect(playback.phase).toBe('playing');
  });

  it('unacknowledged retries remain bounded by the real playback watchdog', () => {
    let playback = playingRequest(), delivery = initialPresentationDelivery;
    const key = reportKey(playback), receive = vi.fn(() => false);
    let now = 0;
    while (playback.phase === 'resolving') {
      delivery = deliverPresentationReport(delivery, key, now, receive).state;
      playback = playbackReducer(playback, {
        type: 'tick', deltaMs: PRESENTATION_REPORT_RETRY_MS, dwellMs: 4000, count: 11,
      });
      now += PRESENTATION_REPORT_RETRY_MS;
    }
    expect(playback).toMatchObject({ phase: 'error', elapsedMs: 0, shotIndex: 0 });
    expect(now).toBe(PRESENTATION_READINESS_LIMIT_MS);
    expect(receive).toHaveBeenCalledTimes(PRESENTATION_READINESS_LIMIT_MS / PRESENTATION_REPORT_RETRY_MS);
    expect(delivery.acceptedKey).toBeNull();
    expect(playbackReducer(playback, readyAction(playback))).toBe(playback);
  });
});
