/** Presentation time is foreground reading time, never simulation time. */
export type PlaybackPhase = 'ready' | 'playing' | 'paused' | 'resolving' | 'completed' | 'invalidated' | 'error';
export interface PlaybackState {
  sourceKey: string; token: number; shotIndex: number; phase: PlaybackPhase;
  automatic: boolean; elapsedMs: number; resolvingMs: number; reason: string;
}
export const initialPlayback: PlaybackState = { sourceKey: '', token: 0, shotIndex: 0, phase: 'invalidated', automatic: false, elapsedMs: 0, resolvingMs: 0, reason: '' };
export const PRESENTATION_READINESS_LIMIT_MS = 15_000;
export type PlaybackAction =
  | { type: 'load'; sourceKey: string }
  | { type: 'navigate'; shotIndex: number; automatic?: boolean }
  | { type: 'play' | 'resume' | 'restart' }
  | { type: 'pause' | 'invalidate'; reason: string }
  | { type: 'scene'; token: number; sourceKey: string; ready: boolean; last: boolean }
  | { type: 'error'; token: number; reason: string }
  | { type: 'tick'; deltaMs: number; dwellMs: number; count: number };
const seek = (state: PlaybackState, shotIndex: number, automatic: boolean): PlaybackState => ({ ...state, shotIndex, automatic, phase: 'resolving', token: state.token + 1, elapsedMs: 0, resolvingMs: 0, reason: '' });
export function playbackReducer(state: PlaybackState, action: PlaybackAction): PlaybackState {
  if (action.type === 'load') return { ...seek(state, 0, false), sourceKey: action.sourceKey };
  if (action.type === 'invalidate') return { ...state, phase: 'invalidated', automatic: false, token: state.token + 1, reason: action.reason };
  if (state.phase === 'invalidated') return state;
  switch (action.type) {
    case 'navigate': return seek(state, action.shotIndex, action.automatic ?? false);
    case 'play': return seek(state, state.phase === 'completed' ? 0 : state.shotIndex, true);
    case 'restart': return seek(state, 0, state.automatic);
    case 'resume': return seek(state, state.shotIndex, state.automatic);
    case 'pause': return state.phase === 'paused' ? state : { ...state, phase: 'paused', token: state.token + 1, reason: action.reason };
    case 'error': return action.token === state.token ? { ...state, phase: 'error', reason: action.reason } : state;
    case 'scene': {
      if (action.token !== state.token || action.sourceKey !== state.sourceKey || ['paused', 'error', 'completed'].includes(state.phase)) return state;
      if (!action.ready) return state.phase === 'resolving' ? state : { ...state, phase: 'resolving', resolvingMs: 0 };
      if (state.phase !== 'resolving') return state;
      return { ...state, phase: state.automatic ? 'playing' : action.last ? 'completed' : 'ready', resolvingMs: 0 };
    }
    case 'tick': {
      if (!Number.isFinite(action.deltaMs) || action.deltaMs <= 0) return state;
      if (state.phase === 'resolving') {
        const resolvingMs = state.resolvingMs + action.deltaMs;
        return resolvingMs >= PRESENTATION_READINESS_LIMIT_MS
          ? { ...state, resolvingMs, phase: 'error', reason: 'The requested history, equipment or camera did not become ready. Resume to retry, choose another chapter, or exit.' }
          : { ...state, resolvingMs };
      }
      if (state.phase !== 'playing') return state;
      const elapsedMs = state.elapsedMs + action.deltaMs;
      if (elapsedMs < action.dwellMs) return { ...state, elapsedMs };
      return state.shotIndex + 1 < action.count ? seek(state, state.shotIndex + 1, true) : { ...state, elapsedMs: action.dwellMs, phase: 'completed' };
    }
  }
}
