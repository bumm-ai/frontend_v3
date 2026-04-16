/**
 * sseClient — SSE stream factory with exponential-backoff reconnect.
 *
 * The backend logs endpoint authenticates via ?token= query param
 * (same pattern as WebSocket /ws/contracts/{uid}?token=xxx).
 */

export interface SseLogEvent {
  version: number;
  tail: string;
}

const BACKOFF_DELAYS_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function createSseStream(
  url: string,
  token: string,
  onEvent: (data: SseLogEvent) => void,
  onClose?: () => void,
): () => void {
  let es: EventSource | null = null;
  let attempt = 0;
  let stopped = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  function connect() {
    if (stopped) return;
    const fullUrl = `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
    es = new EventSource(fullUrl);

    es.addEventListener('log', (e: MessageEvent) => {
      attempt = 0; // reset backoff on success
      try {
        const data = JSON.parse(e.data) as SseLogEvent;
        onEvent(data);
      } catch {
        // ignore malformed events
      }
    });

    es.onerror = () => {
      es?.close();
      es = null;
      if (stopped) return;
      const delay = BACKOFF_DELAYS_MS[Math.min(attempt, BACKOFF_DELAYS_MS.length - 1)];
      attempt++;
      reconnectTimer = setTimeout(connect, delay);
    };

    // When stream ends normally (done/failed phase), server closes connection
    // EventSource readyState becomes CLOSED — we detect via onerror (it fires on close too)
    // but we don't want infinite reconnect after normal close.
    // The server sends a final event with phase=done/failed — after that we stop.
    es.addEventListener('done', () => {
      stopped = true;
      es?.close();
      onClose?.();
    });
  }

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    es?.close();
    es = null;
  };
}
