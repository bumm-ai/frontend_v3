'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import {
  challenge,
  verify,
  logout as authLogout,
  tryRefresh,
  accessTokenTtl,
  decodeJwt,
} from '@/services/authService';
import { getAccessToken, clearTokens } from '@/services/api';

export interface AuthState {
  isAuthenticated: boolean;
  walletAddress: string | null;
  userUid: string | null;
  isLoading: boolean;
  error: string | null;
}

export function useAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();

  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    walletAddress: null,
    userUid: null,
    isLoading: false,
    error: null,
  });

  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Restore session from localStorage on mount ──────────────────────────────
  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const payload = decodeJwt(token);
    if (!payload || payload.exp < Date.now() / 1000) {
      tryRefresh().then((ok) => {
        if (ok) restoreFromToken();
      });
      return;
    }
    restoreFromToken();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function restoreFromToken() {
    const token = getAccessToken();
    if (!token) return;
    const payload = decodeJwt(token);
    if (!payload) return;
    setState({
      isAuthenticated: true,
      walletAddress: payload.wallet,
      userUid: payload.sub,
      isLoading: false,
      error: null,
    });
    scheduleRefresh(payload.exp);
  }

  // ── Schedule silent token refresh 60s before expiry ─────────────────────────
  function scheduleRefresh(expUnix: number) {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    const ms = (expUnix - Math.floor(Date.now() / 1000) - 60) * 1000;
    if (ms <= 0) {
      tryRefresh().then((ok) => { if (!ok) signOut(); });
      return;
    }
    refreshTimerRef.current = setTimeout(async () => {
      const ok = await tryRefresh();
      if (ok) {
        const token = getAccessToken();
        if (token) {
          const p = decodeJwt(token);
          if (p) scheduleRefresh(p.exp);
        }
      } else {
        signOut();
      }
    }, ms);
  }

  // ── Login: challenge → signMessage → verify ──────────────────────────────────
  const login = useCallback(async (): Promise<void> => {
    if (!publicKey || !signMessage) {
      setState((s) => ({ ...s, error: 'Wallet not connected or does not support signing' }));
      return;
    }

    setState((s) => ({ ...s, isLoading: true, error: null }));

    try {
      const walletAddress = publicKey.toBase58();
      const { nonce, message } = await challenge(walletAddress);

      const encoded = new TextEncoder().encode(message);
      const signatureBytes = await signMessage(encoded);
      const signature = bs58.encode(signatureBytes);

      const tokens = await verify(walletAddress, signature, nonce);
      const payload = decodeJwt(tokens.access_token);

      setState({
        isAuthenticated: true,
        walletAddress,
        userUid: payload?.sub ?? null,
        isLoading: false,
        error: null,
      });

      if (payload) scheduleRefresh(payload.exp);
    } catch (err) {
      setState((s) => ({
        ...s,
        isLoading: false,
        error: err instanceof Error ? err.message : 'Login failed',
      }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey, signMessage]);

  // ── Logout ────────────────────────────────────────────────────────────────────
  const signOut = useCallback(async (): Promise<void> => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    await authLogout();
    clearTokens();
    setState({ isAuthenticated: false, walletAddress: null, userUid: null, isLoading: false, error: null });
    disconnect().catch(() => {});
  }, [disconnect]);

  // ── Auto-logout when wallet disconnected externally ────────────────────────
  useEffect(() => {
    if (!connected && state.isAuthenticated) {
      signOut();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return {
    ...state,
    login,
    logout: signOut,
  };
}
