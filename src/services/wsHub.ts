/**
 * wsHub — singleton WebSocket connection manager with CROSS-TAB consolidation.
 *
 * Within a tab it de-duplicates connections: many components subscribing to the
 * same channel share one socket (ref-counted by handler set).
 *
 * Across tabs (B6/B7) it elects ONE "owner" tab per channel that holds the real
 * WebSocket and relays every message to the other tabs over a BroadcastChannel.
 * Follower tabs hold no socket — they deliver the relayed messages to their own
 * local handlers. This collapses N tabs × M channels down to M sockets per user.
 *
 * Safety: if BroadcastChannel is unavailable (SSR, old browser) OR anything in
 * the coordination path throws, every tab falls back to owning its own socket —
 * i.e. EXACTLY the previous behaviour. Realtime delivery is never worse than
 * before; the worst case is simply more sockets.
 *
 * Public API is unchanged:
 *   const unsub = wsHub.subscribe('contract:abc', (msg) => …, () => getToken())
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

// ── Cross-tab coordination ────────────────────────────────────────────────────

const BUS_NAME = 'bumm-wshub-v1';
const HEARTBEAT_MS = 3000;     // owner re-announces ownership this often
const OWNER_TIMEOUT_MS = 9000; // follower reclaims if it hasn't heard from an owner in this long

type BusMsg =
  | { t: 'own'; ch: string; from: string }   // I own this channel (claim / heartbeat / assertion)
  | { t: 'gone'; ch: string; from: string }  // I am releasing this channel (graceful unload/unsub)
  | { t: 'msg'; ch: string; data: unknown }  // relayed WebSocket payload
  | { t: 'open'; ch: string };               // owner's socket (re)connected — followers re-seed

/**
 * Pure ownership tiebreak: on a simultaneous claim, the LOWER tab id wins.
 * Exported for unit testing the deterministic election decision.
 */
export function ownerWins(mine: string, other: string): boolean {
  return mine < other;
}

function makeTabId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `t-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
}

interface CoordinatorHooks {
  openTransport: (ch: string) => void;          // open the real socket (owner only)
  closeTransport: (ch: string) => void;         // close the real socket
  deliver: (ch: string, data: unknown) => void; // dispatch to this tab's local handlers
  fireConnect: (ch: string) => void;            // run onConnect handlers (re-seed)
  hasLocalSubscribers: (ch: string) => boolean; // does this tab still have handlers for ch?
}

class CrossTab {
  private bc: BroadcastChannel | null = null;
  private readonly tabId = makeTabId();
  private owned = new Set<string>();
  private lastOwnerSeen = new Map<string, number>(); // ch → ts of last remote owner signal

  constructor(private readonly hooks: CoordinatorHooks) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.bc = new BroadcastChannel(BUS_NAME);
        this.bc.onmessage = (e: MessageEvent) => {
          try {
            this.onBus(e.data as BusMsg);
          } catch {
            /* never let a malformed peer message break this tab */
          }
        };
        if (typeof window !== 'undefined') {
          const release = () => this.releaseAllOwned();
          window.addEventListener('pagehide', release);
          window.addEventListener('beforeunload', release);
        }
        // Owner re-announces ownership so followers keep their lastOwnerSeen
        // fresh; the hub drives the reclaim pass (see WsHub constructor).
        setInterval(() => this.onHeartbeat(), HEARTBEAT_MS);
      }
    } catch {
      this.bc = null;
    }
  }

  /** A channel just gained its first local subscriber — secure a socket for it. */
  acquire(ch: string): void {
    if (!this.bc) {
      // No cross-tab bus → own it directly (legacy single-tab behaviour).
      if (!this.owned.has(ch)) {
        this.owned.add(ch);
        this.hooks.openTransport(ch);
      }
      return;
    }
    if (this.owned.has(ch)) return;
    // Optimistic claim: open immediately (no connect latency) and yield later if
    // a peer with a winning id is already the owner.
    this.claim(ch);
  }

  /** A channel lost its last local subscriber — drop the socket if we own it. */
  release(ch: string): void {
    if (this.owned.has(ch)) {
      this.owned.delete(ch);
      this.hooks.closeTransport(ch);
      this.post({ t: 'gone', ch, from: this.tabId });
    }
    this.lastOwnerSeen.delete(ch);
  }

  /** True when this tab holds the real socket for ch (owner, or no-bus fallback). */
  isOwner(ch: string): boolean {
    return this.owned.has(ch) || !this.bc;
  }

  /** Owner relays a received socket payload to peer tabs. */
  relayMessage(ch: string, data: unknown): void {
    if (this.bc && this.owned.has(ch)) this.post({ t: 'msg', ch, data });
  }

  /** Owner announces its socket (re)connected so followers re-seed. */
  relayOpen(ch: string): void {
    if (this.bc && this.owned.has(ch)) this.post({ t: 'open', ch });
  }

  private claim(ch: string): void {
    this.owned.add(ch);
    this.hooks.openTransport(ch);
    this.post({ t: 'own', ch, from: this.tabId });
  }

  private yield(ch: string): void {
    if (!this.owned.has(ch)) return;
    this.owned.delete(ch);
    this.hooks.closeTransport(ch);
    this.lastOwnerSeen.set(ch, Date.now());
  }

  private hasFreshOwner(ch: string): boolean {
    const seen = this.lastOwnerSeen.get(ch);
    return seen != null && Date.now() - seen < OWNER_TIMEOUT_MS;
  }

  private onBus(m: BusMsg): void {
    switch (m.t) {
      case 'own': {
        this.lastOwnerSeen.set(m.ch, Date.now());
        if (this.owned.has(m.ch) && m.from !== this.tabId) {
          if (ownerWins(m.from, this.tabId)) {
            this.yield(m.ch); // the peer outranks us — hand the channel over
          } else {
            this.post({ t: 'own', ch: m.ch, from: this.tabId }); // assert: we outrank them
          }
        }
        break;
      }
      case 'gone': {
        this.lastOwnerSeen.delete(m.ch);
        // Owner left gracefully — if we still need the channel, take it over now.
        if (!this.owned.has(m.ch) && this.hooks.hasLocalSubscribers(m.ch)) {
          this.claim(m.ch);
        }
        break;
      }
      case 'msg': {
        this.lastOwnerSeen.set(m.ch, Date.now());
        if (!this.owned.has(m.ch) && this.hooks.hasLocalSubscribers(m.ch)) {
          this.hooks.deliver(m.ch, m.data);
        }
        break;
      }
      case 'open': {
        this.lastOwnerSeen.set(m.ch, Date.now());
        if (!this.owned.has(m.ch) && this.hooks.hasLocalSubscribers(m.ch)) {
          this.hooks.fireConnect(m.ch);
        }
        break;
      }
    }
  }

  private onHeartbeat(): void {
    for (const ch of this.owned) this.post({ t: 'own', ch, from: this.tabId });
  }

  /** Hub-driven watchdog: reclaim ch if we need it but no owner is alive. */
  reclaimIfNeeded(ch: string): void {
    if (!this.bc) return;
    if (this.owned.has(ch)) return;
    if (!this.hooks.hasLocalSubscribers(ch)) return;
    if (this.hasFreshOwner(ch)) return;
    this.claim(ch);
  }

  private releaseAllOwned(): void {
    for (const ch of this.owned) this.post({ t: 'gone', ch, from: this.tabId });
    this.owned.clear();
  }

  private post(m: BusMsg): void {
    try {
      this.bc?.postMessage(m);
    } catch {
      /* bus closed — ignore */
    }
  }
}

class WsHub {
  private channels = new Map<string, ChannelState>();
  private xt: CrossTab;

  constructor() {
    this.xt = new CrossTab({
      openTransport: (ch) => this._openWs(ch),
      closeTransport: (ch) => this._closeWs(ch),
      deliver: (ch, data) => this._deliver(ch, data),
      fireConnect: (ch) => this._fireConnect(ch),
      hasLocalSubscribers: (ch) => {
        const s = this.channels.get(ch);
        return !!s && s.handlers.size > 0;
      },
    });
    // Hub-driven reclaim pass: lets followers retake a channel whose owner tab
    // crashed without a graceful 'gone'.
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        for (const ch of this.channels.keys()) this.xt.reclaimIfNeeded(ch);
      }, HEARTBEAT_MS);
    }
  }

  /**
   * Subscribe to a WebSocket channel.
   *
   * @param channel   - 'contract:{uid}' or 'credits'
   * @param onMessage - handler called with parsed JSON data
   * @param getToken  - factory returning the current JWT (called on every
   *                    connect/reconnect) OR a static string for backward compat
   * @param onConnect - optional, runs when the owning socket (re)connects
   */
  subscribe(
    channel: string,
    onMessage: MessageHandler,
    getToken: TokenFactory | string,
    onConnect?: ConnectHandler,
  ): () => void {
    const factory: TokenFactory =
      typeof getToken === 'function' ? getToken : () => getToken;

    let state = this.channels.get(channel);
    const isFirst = !state;

    if (!state) {
      state = {
        ws: null,
        handlers: new Set(),
        connectHandlers: new Set(),
        getToken: factory,
        attempt: 0,
        timer: null,
        closing: false,
      };
      this.channels.set(channel, state);
    } else {
      // Update the token factory so a future reconnect uses fresh credentials.
      state.getToken = factory;
    }

    state.handlers.add(onMessage);
    if (onConnect) state.connectHandlers.add(onConnect);

    // Secure a socket for this channel (owner) or rely on a peer's relay.
    if (isFirst) this.xt.acquire(channel);

    return () => {
      const s = this.channels.get(channel);
      if (!s) return;
      s.handlers.delete(onMessage);
      if (onConnect) s.connectHandlers.delete(onConnect);
      if (s.handlers.size === 0) {
        this.xt.release(channel);
        this.channels.delete(channel);
      }
    };
  }

  // ── Transport (owner only) ──────────────────────────────────────────────────

  private _openWs(channel: string): void {
    const state = this.channels.get(channel);
    if (!state || state.closing) return;
    const token = state.getToken();
    if (!token) {
      // No token yet — retry after the first backoff interval.
      state.timer = setTimeout(() => this._openWs(channel), BACKOFF[0]);
      return;
    }
    try {
      const url = channelToUrl(channel, token);
      const ws = new WebSocket(url);
      state.ws = ws;

      ws.onopen = () => {
        this._fireConnect(channel);
        this.xt.relayOpen(channel);
      };

      ws.onmessage = (e) => {
        state.attempt = 0;
        let data: unknown;
        try { data = JSON.parse(e.data as string); } catch { data = e.data; }
        this._deliver(channel, data);
        this.xt.relayMessage(channel, data);
      };

      ws.onclose = (e) => {
        if (state.closing) return;
        // Only the owner reconnects; if we yielded ownership we won't reach here.
        if (!this.xt.isOwner(channel)) return;
        if (e.code === 4001 || e.code === 4003 || e.code === 4004) return;
        const delay = BACKOFF[Math.min(state.attempt, BACKOFF.length - 1)];
        state.attempt++;
        state.timer = setTimeout(() => this._openWs(channel), delay);
      };

      ws.onerror = () => { /* handled by onclose */ };
    } catch {
      const delay = BACKOFF[Math.min(state.attempt, BACKOFF.length - 1)];
      state.attempt++;
      state.timer = setTimeout(() => this._openWs(channel), delay);
    }
  }

  private _closeWs(channel: string): void {
    const state = this.channels.get(channel);
    if (!state) return;
    if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    if (state.ws) {
      // Mark closing transiently so the onclose handler does not reconnect.
      const ws = state.ws;
      state.ws = null;
      try { ws.onclose = null; ws.close(); } catch { /* already closed */ }
    }
    state.attempt = 0;
  }

  private _deliver(channel: string, data: unknown): void {
    const state = this.channels.get(channel);
    state?.handlers.forEach((h) => h(data));
  }

  private _fireConnect(channel: string): void {
    const state = this.channels.get(channel);
    state?.connectHandlers.forEach((h) => h());
  }
}

export const wsHub = new WsHub();
