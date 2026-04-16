/**
 * wsHub — singleton WebSocket connection manager.
 *
 * Prevents duplicate connections when multiple components
 * subscribe to the same channel (e.g. BuildModal + StatusBar → same contract).
 *
 * Usage:
 *   const unsub = wsHub.subscribe('contract:abc-123', (msg) => handleMsg(msg), token)
 *   // cleanup:
 *   unsub()
 */

import { WS_BASE } from '@/config/api';

type MessageHandler = (data: unknown) => void;

interface ChannelState {
  ws: WebSocket | null;
  handlers: Set<MessageHandler>;
  token: string;
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

  subscribe(channel: string, onMessage: MessageHandler, token: string): () => void {
    let state = this.channels.get(channel);

    if (!state) {
      state = { ws: null, handlers: new Set(), token, attempt: 0, timer: null, closing: false };
      this.channels.set(channel, state);
      this._connect(channel, state);
    }

    state.handlers.add(onMessage);

    return () => {
      state!.handlers.delete(onMessage);
      if (state!.handlers.size === 0) {
        this._close(channel, state!);
      }
    };
  }

  private _connect(channel: string, state: ChannelState): void {
    if (state.closing) return;
    try {
      const url = channelToUrl(channel, state.token);
      const ws = new WebSocket(url);
      state.ws = ws;

      ws.onmessage = (e) => {
        state.attempt = 0;
        let data: unknown;
        try { data = JSON.parse(e.data as string); } catch { data = e.data; }
        state.handlers.forEach((h) => h(data));
      };

      ws.onclose = (e) => {
        if (state.closing) return;
        // Don't reconnect on auth/not-found codes
        if (e.code === 4001 || e.code === 4003 || e.code === 4004) return;
        const delay = BACKOFF[Math.min(state.attempt, BACKOFF.length - 1)];
        state.attempt++;
        state.timer = setTimeout(() => this._connect(channel, state), delay);
      };

      ws.onerror = () => { /* handled by onclose */ };
    } catch {
      // URL construction failed
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
