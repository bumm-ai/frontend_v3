'use client';

import { apiClient, setTokens, clearTokens, clearSessionStorage, getAccessToken } from '@/services/api';
import type { AuthTokens, ChallengeResponse } from '@/lib/api';

// ── Decode JWT payload (no library needed) ────────────────────────────────────

export interface JwtPayload {
  sub: string;
  wallet: string;
  exp: number;
  iat: number;
  jti: string;
  type: 'access' | 'refresh';
}

export function decodeJwt(token: string): JwtPayload | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded) as JwtPayload;
  } catch {
    return null;
  }
}

// ── Challenge / verify ────────────────────────────────────────────────────────

export async function challenge(walletAddress: string): Promise<ChallengeResponse> {
  return apiClient.authChallenge(walletAddress);
}

export async function verify(
  walletAddress: string,
  signature: string,
  nonce: string,
): Promise<AuthTokens> {
  const tokens = await apiClient.authVerify(walletAddress, signature, nonce);
  setTokens(tokens);
  return tokens;
}

// ── Refresh ───────────────────────────────────────────────────────────────────

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const tokens = await apiClient.authRefresh(refreshToken);
  setTokens(tokens);
  return tokens;
}

// Singleton in-flight promise — prevents concurrent refresh calls from consuming
// the refresh token twice (which causes a 401 on the second attempt).
let _refreshPromise: Promise<boolean> | null = null;

/** Read refresh token from localStorage and silently refresh. Returns true on success.
 *  Concurrent calls share the same in-flight request instead of firing separately. */
export async function tryRefresh(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const rt = localStorage.getItem('refresh_token');
  if (!rt) return false;

  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    try {
      await refresh(rt);
      return true;
    } catch {
      clearTokens();
      return false;
    } finally {
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// ── Logout ────────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const rt = typeof window !== 'undefined'
    ? localStorage.getItem('refresh_token')
    : null;
  try {
    if (rt) await apiClient.authLogout(rt);
  } catch { /* best-effort */ } finally {
    clearTokens();
    // Wipe per-wallet / per-contract caches so the next login starts clean.
    clearSessionStorage();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns seconds until the access token expires, or 0 if expired/missing. */
export function accessTokenTtl(): number {
  const token = getAccessToken();
  if (!token) return 0;
  const payload = decodeJwt(token);
  if (!payload) return 0;
  return Math.max(0, payload.exp - Math.floor(Date.now() / 1000));
}
