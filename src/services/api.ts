'use client';

import { API_PROXY, ENDPOINTS } from '@/config/api';
import type {
  AuthTokens,
  BalanceResponse,
  ChatMessagePayload,
  ChatResponse,
  ContractCreated,
  ContractRequest,
  ContractStatus,
  ContractCode,
  ContractAudit,
  PurchaseResponse,
} from '@/lib/api';

// ── Token helpers ─────────────────────────────────────────────────────────────

export const getAccessToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;

export const setTokens = (tokens: AuthTokens): void => {
  localStorage.setItem('access_token',  tokens.access_token);
  localStorage.setItem('refresh_token', tokens.refresh_token);
};

export const clearTokens = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
};

// ── Core fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch<T>(
  path: string,
  options: RequestInit & { auth?: boolean; skipProxy?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const base = options.skipProxy ? '' : API_PROXY;
  const res = await fetch(`${base}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    const message =
      typeof body.detail === 'string'
        ? body.detail
        : Array.isArray(body.detail)
          ? body.detail.map((e: { msg: string }) => e.msg).join('; ')
          : res.statusText;
    throw Object.assign(new Error(message), { status: res.status });
  }

  return res.json() as Promise<T>;
}

// ── ApiClient class ───────────────────────────────────────────────────────────

export class ApiClient {
  /** Legacy compat — no-op (token comes from localStorage) */
  setToken(_token: string): void {}

  /** Legacy compat — no-op */
  setUserId(_id: string): void {}

  async healthCheck(): Promise<Record<string, string>> {
    return apiFetch(ENDPOINTS.HEALTH, { auth: false });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  async authChallenge(walletAddress: string) {
    return apiFetch<{ nonce: string; message: string }>(
      ENDPOINTS.AUTH_CHALLENGE,
      { method: 'POST', body: JSON.stringify({ wallet_address: walletAddress }), auth: false },
    );
  }

  async authVerify(walletAddress: string, signature: string, nonce: string) {
    return apiFetch<AuthTokens>(ENDPOINTS.AUTH_VERIFY, {
      method: 'POST',
      body: JSON.stringify({ wallet_address: walletAddress, signature, nonce }),
      auth: false,
    });
  }

  async authRefresh(refreshToken: string) {
    return apiFetch<AuthTokens>(ENDPOINTS.AUTH_REFRESH, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
      auth: false,
    });
  }

  async authLogout(refreshToken: string) {
    return apiFetch<void>(ENDPOINTS.AUTH_LOGOUT, {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  // ── Chat ──────────────────────────────────────────────────────────────────

  async chatMessage(messages: ChatMessagePayload[]): Promise<ChatResponse> {
    return apiFetch<ChatResponse>(ENDPOINTS.CHAT, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  }

  // ── Contracts ─────────────────────────────────────────────────────────────

  async createContract(req: ContractRequest): Promise<ContractCreated> {
    return apiFetch(ENDPOINTS.CONTRACTS, {
      method: 'POST',
      body: JSON.stringify(req),
    });
  }

  async getContractStatus(uid: string): Promise<ContractStatus> {
    return apiFetch(ENDPOINTS.CONTRACT_STATUS(uid));
  }

  async getContractCode(uid: string): Promise<ContractCode> {
    return apiFetch(ENDPOINTS.CONTRACT_CODE(uid));
  }

  async getContractAudit(uid: string): Promise<ContractAudit> {
    return apiFetch(ENDPOINTS.CONTRACT_AUDIT(uid));
  }

  // ── Credits ───────────────────────────────────────────────────────────────

  async getCreditsBalance(): Promise<BalanceResponse> {
    return apiFetch(ENDPOINTS.CREDITS_BALANCE);
  }

  async purchaseCredits(solTxSignature: string): Promise<PurchaseResponse> {
    return apiFetch(ENDPOINTS.CREDITS_PURCHASE, {
      method: 'POST',
      body: JSON.stringify({ sol_tx_signature: solTxSignature }),
    });
  }
}

export const apiClient = new ApiClient();
