/** Rejected delivery uses the existing scene diagnostic cadence, not a new clock. */
export const PRESENTATION_REPORT_RETRY_MS = 250;

export interface PresentationDeliveryState {
  readonly acceptedKey: string | null;
  readonly attemptedKey: string | null;
  readonly attemptedAtMs: number | null;
}

export const initialPresentationDelivery: PresentationDeliveryState = {
  acceptedKey: null,
  attemptedKey: null,
  attemptedAtMs: null,
};

export interface PresentationDeliveryResult {
  state: PresentationDeliveryState;
  outcome: 'accepted' | 'already-accepted' | 'rejected' | 'deferred';
  accepted: boolean;
  sent: boolean;
}

/**
 * Call only for an observed snapshot of the active request. The caller owns
 * render validity, request cleanup and the playback readiness watchdog.
 * Reset the state when request/layout ownership changes. A changed report key
 * bypasses retry delay so loss of readiness can suspend reading immediately.
 */
export function deliverPresentationReport(
  state: PresentationDeliveryState,
  key: string,
  nowMs: number,
  receive: () => boolean,
): PresentationDeliveryResult {
  if (state.acceptedKey === key) {
    return { state, outcome: 'already-accepted', accepted: true, sent: false };
  }
  if (!Number.isFinite(nowMs) || nowMs < 0 ||
      (state.attemptedKey === key && state.attemptedAtMs !== null &&
        nowMs - state.attemptedAtMs < PRESENTATION_REPORT_RETRY_MS)) {
    return { state, outcome: 'deferred', accepted: false, sent: false };
  }
  const accepted = receive() === true;
  return {
    state: {
      acceptedKey: accepted ? key : state.acceptedKey,
      attemptedKey: key,
      attemptedAtMs: nowMs,
    },
    outcome: accepted ? 'accepted' : 'rejected',
    accepted,
    sent: true,
  };
}
