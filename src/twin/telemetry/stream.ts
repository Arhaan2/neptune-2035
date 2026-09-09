export interface StreamStatus {
  state: 'connecting' | 'connected' | 'reconnecting' | 'stale' | 'closed' | 'error';
  message: string;
  reconnects: number;
  lastEventId: string | null;
}
export interface StreamReception { receivedAt: string; lastEventId: string | null }
/** Structural subset permits deterministic adapter tests; production uses browser EventSource. */
export interface EventSourceTransport {
  readonly readyState: number;
  onopen: ((event: Event) => void) | null;
  onmessage: ((event: MessageEvent<string>) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}
export interface StreamOptions {
  staleAfterMs?: number;
  eventSourceFactory?: (url: string, options: { withCredentials: false }) => EventSourceTransport;
  now?: () => number;
}

export function validateStreamURL(input: string): string {
  if (input.length > 2_048) throw new Error('Stream URL exceeds 2,048 characters.');
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('Enter an absolute HTTPS or localhost HTTP stream URL.'); }
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new Error('Streaming requires HTTPS, except explicit loopback HTTP development URLs.');
  if (url.username || url.password || url.hash) throw new Error('Credentials and fragments are forbidden in stream URLs.');
  for (const name of url.searchParams.keys()) if (/token|secret|password|authorization|api.?key|signature|credential/i.test(name)) throw new Error('Secret-bearing URL parameters are forbidden. This adapter does not implement authentication.');
  return url.toString();
}

/** A working read-only SSE client. Native EventSource owns reconnect and Last-Event-ID. */
export function connectStream(
  inputURL: string,
  onSample: (raw: unknown, reception: StreamReception) => void,
  onStatus: (status: StreamStatus) => void,
  options: StreamOptions = {},
): () => void {
  const url = validateStreamURL(inputURL);
  const staleAfterMs = options.staleAfterMs ?? 5_000;
  if (!Number.isFinite(staleAfterMs) || staleAfterMs < 50 || staleAfterMs > 3_600_000) throw new RangeError('Stream stale threshold must be 50 ms–1 hour.');
  const now = options.now ?? Date.now;
  const factory = options.eventSourceFactory ?? ((value: string, init: { withCredentials: false }) => new EventSource(value, init));
  let closed = false, opened = false, reconnects = 0, lastEventId: string | null = null;
  let staleTimer: ReturnType<typeof setTimeout> | undefined;
  const status = (state: StreamStatus['state'], message: string) => { if (!closed || state === 'closed') onStatus({ state, message, reconnects, lastEventId }); };
  const armStaleness = () => {
    if (staleTimer) clearTimeout(staleTimer);
    staleTimer = setTimeout(() => status('stale', 'No new stream sample within the configured threshold; readings must become stale or unknown.'), staleAfterMs);
  };
  status('connecting', 'Opening read-only SSE stream.');
  let connection: EventSourceTransport;
  try { connection = factory(url, { withCredentials: false }); }
  catch (error) { status('error', error instanceof Error ? error.message : 'Browser refused the stream connection.'); throw error; }
  connection.onopen = () => {
    if (closed) return;
    if (opened) reconnects++;
    opened = true;
    status('connected', reconnects ? 'Reconnected; source sequences continue to be validated.' : 'Connected. Transport connectivity does not establish physical validation.');
    armStaleness();
  };
  connection.onmessage = event => {
    if (closed) return;
    if (event.data.length > 65_536) { status('error', 'Rejected SSE payload larger than 64 KiB.'); return; }
    try {
      const raw: unknown = JSON.parse(event.data);
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('SSE payload must be a JSON observation object.');
      lastEventId = event.lastEventId || null;
      onSample(raw, { receivedAt: new Date(now()).toISOString(), lastEventId });
      status('connected', 'Received sample; identity, version, units, and sequencing require ingestion validation.');
      armStaleness();
    } catch (error) { status('error', error instanceof Error ? error.message : 'Rejected invalid SSE observation.'); }
  };
  connection.onerror = () => {
    if (closed) return;
    if (connection.readyState === 2) status('error', 'Stream closed by the browser/server. Reconnect explicitly after resolving URL, HTTPS, or CORS errors.');
    else status('reconnecting', 'Connection interrupted. EventSource will retry with Last-Event-ID; source identity is unchanged.');
    armStaleness();
  };
  return () => {
    if (closed) return;
    closed = true;
    if (staleTimer) clearTimeout(staleTimer);
    connection.onmessage = null;
    connection.onopen = null;
    connection.onerror = null;
    connection.close();
    status('closed', 'Stream disconnected. Existing readings continue to age.');
  };
}
