/** Explicit development/release probe; scalar timings only, no project payloads. */
export const diagnosticsEnabled = typeof location !== 'undefined' &&
  new URLSearchParams(location.search).get('phase1Diagnostics') === '1';
let remaining = 1000;
export function diagnosticEvent(stage: string, fields: Record<string, string | number | boolean | null | undefined> = {}, enabled = diagnosticsEnabled) {
  if (!enabled || remaining-- <= 0) return;
  console.debug('[neptune-step] ' + JSON.stringify({ at: performance.timeOrigin + performance.now(), stage, ...fields }));
}
