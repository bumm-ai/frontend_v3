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
  ContractListResponse,
  CreditHistoryResponse,
  CreditRatesResponse,
  DeployEstimate,
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

  async listContracts(limit = 50, offset = 0, hasCode = true): Promise<ContractListResponse> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
      has_code: String(hasCode),
    });
    return apiFetch(`${ENDPOINTS.CONTRACTS}?${params}`);
  }

  async updateContract(uid: string, data: { name?: string }): Promise<{ uid: string; name: string }> {
    return apiFetch(ENDPOINTS.CONTRACT_UPDATE(uid), {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async deleteContract(uid: string): Promise<{ status: string; uid: string }> {
    return apiFetch(ENDPOINTS.CONTRACT_DELETE(uid), { method: 'DELETE' });
  }

  async getContractChat(uid: string): Promise<{ messages: Array<Record<string, unknown>> }> {
    return apiFetch(ENDPOINTS.CONTRACT_CHAT(uid));
  }

  // ── Step-mode triggers ────────────────────────────────────────────────────

  async triggerBuild(uid: string): Promise<{ status: string; uid: string }> {
    return apiFetch(ENDPOINTS.CONTRACT_BUILD(uid), { method: 'POST' });
  }

  async triggerAudit(uid: string): Promise<{ status: string; uid: string }> {
    return apiFetch(ENDPOINTS.CONTRACT_AUDIT_STEP(uid), { method: 'POST' });
  }

  async triggerDeploy(uid: string): Promise<{ status: string; uid: string }> {
    // confirm=true is required by the backend deploy endpoint to prevent accidental deploys
    return apiFetch(`${ENDPOINTS.CONTRACT_DEPLOY_STEP(uid)}?confirm=true`, { method: 'POST' });
  }

  async getDeployEstimate(uid: string): Promise<DeployEstimate> {
    return apiFetch(ENDPOINTS.CONTRACT_DEPLOY_ESTIMATE(uid));
  }

  async saveContractChat(uid: string, messages: Array<Record<string, unknown>>): Promise<{ status: string; message_count: number }> {
    return apiFetch(ENDPOINTS.CONTRACT_CHAT(uid), {
      method: 'PUT',
      body: JSON.stringify({ messages }),
    });
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

  async getCreditHistory(limit = 50, offset = 0): Promise<CreditHistoryResponse> {
    return apiFetch(`${ENDPOINTS.CREDITS_HISTORY}?limit=${limit}&offset=${offset}`);
  }

  async getCreditRates(): Promise<CreditRatesResponse> {
    return apiFetch(ENDPOINTS.CREDITS_RATES);
  }
}

export const apiClient = new ApiClient();
