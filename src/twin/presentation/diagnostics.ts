/** Optional observation only: never awaited by playback, history or the renderer. */
export interface PresentationDiagnostic {
  v: 1;
  atMs: number;
  kind: 'identity' | 'history' | 'readiness' | 'camera' | 'settling' | 'layout' | 'render' | 'context' | 'visibility';
  [field: string]: string | number | boolean | null | readonly number[];
}
declare global {
  interface Window {
    __NEPTUNE_V5_DIAGNOSTIC_EMIT__?: (event: PresentationDiagnostic) => void;
    __NEPTUNE_V5_LAST_FRAME__?: number;
  }
}
const identities = new Map<string, string>();
const changes = new Map<string, string>();
let identitySequence = 0;
export function presentationDiagnosticsEnabled(): boolean {
  return typeof window !== 'undefined' && typeof window.__NEPTUNE_V5_DIAGNOSTIC_EMIT__ === 'function';
}
export function presentationDiagnostic(kind: PresentationDiagnostic['kind'], fields: Omit<PresentationDiagnostic, 'v' | 'atMs' | 'kind'>): void {
  if (!presentationDiagnosticsEnabled()) return;
  try { window.__NEPTUNE_V5_DIAGNOSTIC_EMIT__!({ ...fields, v: 1, atMs: performance.now(), kind }); } catch { /* An observer cannot take ownership. */ }
}
/** Raw source/owner keys contain evidence. Only an opaque id and SHA leave here.
 * Hashing runs asynchronously and never gates a request or readiness report. */
export function presentationDiagnosticIdentity(value: string | undefined): string {
  if (!value || !presentationDiagnosticsEnabled()) return '';
  const previous = identities.get(value);
  if (previous) return previous;
  const id = `identity-${++identitySequence}`;
  if (identities.size >= 128) identities.delete(identities.keys().next().value!);
  identities.set(value, id);
  try {
    void crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)).then(bytes => {
      presentationDiagnostic('identity', { id, sha256: Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('') });
    }).catch(() => presentationDiagnostic('identity', { id, reason: 'hash-unavailable' }));
  } catch { presentationDiagnostic('identity', { id, reason: 'hash-unavailable' }); }
  return id;
}
/** Call only at existing boundaries. Changing poses/elapsed time are attached to
 * events but deliberately excluded from the condition key. */
export function presentationDiagnosticChange(channel: string, condition: string, kind: PresentationDiagnostic['kind'], fields: Omit<PresentationDiagnostic, 'v' | 'atMs' | 'kind'>): void {
  if (!presentationDiagnosticsEnabled() || changes.get(channel) === condition) return;
  if (changes.size >= 64 && !changes.has(channel)) changes.delete(changes.keys().next().value!);
  changes.set(channel, condition);
  presentationDiagnostic(kind, fields);
}
