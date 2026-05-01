/**
 * wsHub — singleton WebSocket connection manager.
 *
 * Prevents duplicate connections when multiple components
 * subscribe to the same channel (e.g. BuildModal + StatusBar → same contract).
 *
 * Accepts a `getToken` factory so that after auth_refresh the reconnect
 * automatically uses the fresh token instead of the stale one at subscribe time.
 *
 * Usage:
 *   const unsub = wsHub.subscribe('contract:abc-123', (msg) => handleMsg(msg), () => getAccessToken() ?? '')
 *   // cleanup:
 *   unsub()
 */

import { WS_BASE } from '@/config/api';

type MessageHandler = (data: unknown) => void;
type ConnectHandler = () => void;
type TokenFactory  = () => string;

interface ChannelState {
  ws: WebSocket | null;
  handlers: Set<MessageHandler>;
  connectHandlers: Set<ConnectHandler>;
  getToken: TokenFactory;
  attempt: number;
  timer: ReturnType<typeof setTimeout> | null;
  closing: boolean;
}

const BACKOFF = [1000, 2000, 4000, 8000, 30000];

function channelToUrl(channel: string, token: string): string {
  if (channel.startsWith('contract:')) {
    const uid = channel.slice('contract:'.length);
    return `${WS_BASE}/ws/contracts/${uid}?token=${encodeURIComponent(token)}`;
  }
  if (channel === 'credits') {
    return `${WS_BASE}/ws/credits?token=${encodeURIComponent(token)}`;
  }
  throw new Error(`Unknown wsHub channel: ${channel}`);
}

class WsHub {
  private channels = new Map<string, ChannelState>();

  /**
   * Subscribe to a WebSocket channel.
   *
   * @param channel   - 'contract:{uid}' or 'credits'
   * @param onMessage - handler called with parsed JSON data
   * @param getToken  - factory that returns the current JWT (called on every
   *                    connect/reconnect so a refreshed token is always used)
   *                    OR a static string for backward compat
   */
  subscribe(
    channel: string,
    onMessage: MessageHandler,
    getToken: TokenFactory | string,
    onConnect?: ConnectHandler,
  ): () => void {
    // Normalise: accept static string for backward compat
    const factory: TokenFactory =
      typeof getToken === 'function' ? getToken : () => getToken;

    let state = this.channels.get(channel);

    if (!state) {
      state = { ws: null, handlers: new Set(), connectHandlers: new Set(), getToken: factory, attempt: 0, timer: null, closing: false };
      this.channels.set(channel, state);
      this._connect(channel, state);
    } else {
      // Update token factory so next reconnect uses fresh credentials
      state.getToken = factory;
    }

    state.handlers.add(onMessage);
    if (onConnect) state.connectHandlers.add(onConnect);

    return () => {
      state!.handlers.delete(onMessage);
      if (onConnect) state!.connectHandlers.delete(onConnect);
      if (state!.handlers.size === 0) {
        this._close(channel, state!);
      }
    };
  }

  private _connect(channel: string, state: ChannelState): void {
    if (state.closing) return;
    // Resolve current token at connect time (not at subscribe time)
    const token = state.getToken();
    if (!token) {
      // No token yet — retry after first backoff interval
      state.timer = setTimeout(() => this._connect(channel, state), BACKOFF[0]);
      return;
    }
    try {
      const url = channelToUrl(channel, token);
      const ws = new WebSocket(url);
      state.ws = ws;

      ws.onopen = () => {
        // Notify subscribers that the (re)connection is established.
        // useContractStream uses this to re-seed from REST after server restarts.
        state.connectHandlers.forEach((h) => h());
      };

      ws.onmessage = (e) => {
        state.attempt = 0;
        let data: unknown;
        try { data = JSON.parse(e.data as string); } catch { data = e.data; }
        state.handlers.forEach((h) => h(data));
      };

      ws.onclose = (e) => {
        if (state.closing) return;
        // Don't reconnect on permanent auth/not-found codes
        if (e.code === 4001 || e.code === 4003 || e.code === 4004) return;
        const delay = BACKOFF[Math.min(state.attempt, BACKOFF.length - 1)];
        state.attempt++;
        state.timer = setTimeout(() => this._connect(channel, state), delay);
      };

      ws.onerror = () => { /* handled by onclose */ };
    } catch {
      // URL construction failed — retry after backoff
      const delay = BACKOFF[Math.min(state.attempt, BACKOFF.length - 1)];
      state.attempt++;
      state.timer = setTimeout(() => this._connect(channel, state), delay);
    }
  }

  private _close(channel: string, state: ChannelState): void {
    state.closing = true;
    if (state.timer) clearTimeout(state.timer);
    state.ws?.close();
    this.channels.delete(channel);
  }
}

export const wsHub = new WsHub();
