'use client';

import { API_PROXY, ENDPOINTS } from '@/config/api';
import type {
  AuthTokens,
  BalanceResponse,
  BuildQueueResponse,
  ChatMessagePayload,
  ChatResponse,
  ContractCreated,
  ContractRequest,
  ContractStatus,
  ContractCode,
  ContractAudit,
  DebateAuditResponse,
  ContractListResponse,
  CreditHistoryResponse,
  CreditRatesResponse,
  DeployEstimate,
  PurchaseResponse,
  CodeHistoryResponse,
  FundDeployResponse,
  ContractIdlResponse,
  SubscriptionPlansResponse,
  SubscriptionStatus,
  SubscribeResponse,
} from '@/lib/api';
import { balanceBus } from '@/services/balanceBus';
import { createCoalescer } from '@/lib/coalesce';

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

/**
 * Wipe every per-session localStorage entry the dashboard caches under
 * the `bumm_*` prefix (per-wallet projects, per-contract chat history,
 * deployment metadata, etc).  Called on Sign out so the next login —
 * even with the same wallet — starts from a clean slate instead of
 * resurrecting "ghost" data the backend no longer authorises.
 *
 * Tokens are NOT touched here — `clearTokens()` handles those — so this
 * helper is safe to call independently if the dashboard ever needs a
 * cache reset without a full sign-out.
 */
export const clearSessionStorage = (): void => {
  if (typeof window === 'undefined') return;
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('bumm_')) keysToRemove.push(key);
  }
  for (const key of keysToRemove) localStorage.removeItem(key);
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

// ── Status read coalescer (scaling #8) ──────────────────────────────────────
// Sub-interval TTL: half the 5 s poll cadence, so two offset poll loops collapse
// to ~1 request/window while keeping the viewed status fresh enough.
const STATUS_COALESCE_TTL_MS = 2500;
const contractStatusCoalescer = createCoalescer<ContractStatus>(
  (uid) => apiFetch<ContractStatus>(ENDPOINTS.CONTRACT_STATUS(uid)),
  STATUS_COALESCE_TTL_MS,
);

// ── ApiClient class ───────────────────────────────────────────────────────────

export class ApiClient {
  /** Legacy compat — no-op (token comes from localStorage) */
  setToken(_token: string): void {}

  /** Legacy compat — no-op */
  setUserId(_id: string): void {}

  async healthCheck(): Promise<Record<string, string>> {
    return apiFetch(ENDPOINTS.HEALTH, { auth: false });
  }

  /** Global build-farm queue state. Public (no auth); polled while a build runs. */
  async getBuildQueue(): Promise<BuildQueueResponse> {
    return apiFetch(ENDPOINTS.SYSTEM_BUILD_QUEUE, { auth: false });
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

  async chatMessage(messages: ChatMessagePayload[], contractUid?: string): Promise<ChatResponse> {
    return apiFetch<ChatResponse>(ENDPOINTS.CHAT, {
      method: 'POST',
      body: JSON.stringify({ messages, ...(contractUid ? { contract_uid: contractUid } : {}) }),
    });
  }

  /**
   * Apply a previously-proposed auto-regenerate action (Tier 2 chat flow).
   *
   * Returns the same shape as `regenerateContract` because /apply delegates
   * to the existing regenerate route; callers can reuse the same status
   * polling and progress-card logic that the manual modal flow uses.
   */
  async applyChatProposal(contractUid: string, logUid: string): Promise<{
    uid: string;
    phase: string;
    code_version?: number;
  }> {
    return apiFetch(ENDPOINTS.CHAT_APPLY(contractUid), {
      method: 'POST',
      body: JSON.stringify({ log_uid: logUid }),
    });
  }

  /**
   * Mark a proposal as declined. Pure telemetry — no pipeline side effects.
   * Idempotent on already-finalized rows so the UI does not need extra
   * guard logic around double-clicks.
   */
  async declineChatProposal(contractUid: string, logUid: string): Promise<{
    status: string;
    log_uid: string;
  }> {
    return apiFetch(ENDPOINTS.CHAT_DECLINE(contractUid), {
      method: 'POST',
      body: JSON.stringify({ log_uid: logUid }),
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
    // Coalesce REST status reads (#8): the active contract is polled by both
    // useContractStream's fallback and the Dashboard global poll. Sharing
    // in-flight requests + a sub-interval micro-cache collapses the per-tab
    // fan-out to ~1 request/window without changing any call site. WS updates
    // bypass this entirely (they don't go through getContractStatus).
    return contractStatusCoalescer.get(uid);
  }

  /** Drop the coalescer cache for a uid (e.g. on project delete / hard refresh). */
  invalidateContractStatus(uid: string): void {
    contractStatusCoalescer.invalidate(uid);
  }

  async getContractCode(uid: string): Promise<ContractCode> {
    return apiFetch(ENDPOINTS.CONTRACT_CODE(uid));
  }

  async getContractAudit(uid: string): Promise<ContractAudit> {
    return apiFetch(ENDPOINTS.CONTRACT_AUDIT(uid));
  }

  /**
   * M1: run a paid on-demand multi-LLM (debate/ensemble) re-audit. Charges
   * `credit_cost_debate` (12 credits) on success. Throws an Error whose
   * `.status` is 402 (insufficient credits), 503 (not configured), or 409
   * (no code) so callers can branch on the failure mode.
   */
  async debateAudit(uid: string): Promise<DebateAuditResponse> {
    return apiFetch(ENDPOINTS.CONTRACT_DEBATE_AUDIT(uid), { method: 'POST' });
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

  async cancelContract(uid: string): Promise<{
    uid: string;
    cancelled: boolean;
    phase_at_cancel: string;
    note: string;
  }> {
    return apiFetch(ENDPOINTS.CONTRACT_CANCEL(uid), { method: 'POST' });
  }

  async rollbackContract(uid: string, version: number): Promise<{
    uid: string;
    version: number;
    code_length: number;
  }> {
    return apiFetch(ENDPOINTS.CONTRACT_ROLLBACK(uid), {
      method: 'POST',
      body: JSON.stringify({ version }),
    });
  }

  async forkContract(uid: string): Promise<{
    uid: string;
    source_uid: string;
    name: string;
    phase: string;
  }> {
    return apiFetch(ENDPOINTS.CONTRACT_FORK(uid), { method: 'POST' });
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

  /**
   * User-signed deploy (B3): after the user signs a SOL transfer to the
   * deployer wallet (mainnet) the funding signature is submitted here; the
   * backend verifies it on-chain and resumes the deploy. On test nets the
   * signature is ignored (free airdrop) — pass any 64-char placeholder.
   */
  async fundDeploy(uid: string, fundingTxSignature: string): Promise<FundDeployResponse> {
    return apiFetch(ENDPOINTS.CONTRACT_FUND_DEPLOY(uid), {
      method: 'POST',
      body: JSON.stringify({ funding_tx_signature: fundingTxSignature }),
    });
  }

  /**
   * Non-custodial self-deploy (RFC-013) step 1: the backend rebuilds the .so with
   * `declare_id!` pinned to the user's ephemeral program pubkey and returns it
   * (base64), so the browser can deploy it from the user's own wallet.
   */
  async selfDeployArtifact(
    uid: string,
    programId: string,
  ): Promise<{ program_id: string; so_base64: string; byte_len: number }> {
    return apiFetch(ENDPOINTS.CONTRACT_SELF_DEPLOY_ARTIFACT(uid), {
      method: 'POST',
      body: JSON.stringify({ program_id: programId }),
    });
  }

  /**
   * Non-custodial self-deploy (RFC-013) final step: after the browser deploys,
   * report the program id + deploy signature. The backend verifies on-chain that
   * the user's wallet is the upgrade authority and records the deploy.
   */
  async selfDeployConfirm(
    uid: string,
    programId: string,
    deploySignature: string,
  ): Promise<{ program_id: string; upgrade_authority: string; network: string; recorded: boolean }> {
    return apiFetch(ENDPOINTS.CONTRACT_SELF_DEPLOY_CONFIRM(uid), {
      method: 'POST',
      body: JSON.stringify({ program_id: programId, deploy_signature: deploySignature }),
    });
  }

  /**
   * The contract's Anchor IDL for the instruction-aware action UI. Returns
   * `idl: null` (never 404) when the build produced none — callers degrade to
   * the static action menu.
   */
  async getContractIdl(uid: string): Promise<ContractIdlResponse> {
    return apiFetch(ENDPOINTS.CONTRACT_IDL(uid));
  }

  async getContractFixes(uid: string): Promise<{
    uid: string;
    build_ok: boolean;
    build_attempts: number;
    fixes: Array<{
      source: string;
      kb_entry_id: string | null;
      error_pattern: string;
      fix_description: string;
      was_successful: boolean | null;
    }>;
  }> {
    return apiFetch(ENDPOINTS.CONTRACT_FIXES(uid));
  }

  async getCodeHistory(uid: string): Promise<CodeHistoryResponse> {
    return apiFetch(`/api/v1/contracts/${uid}/code/history`);
  }

  async saveContractChat(uid: string, messages: Array<Record<string, unknown>>): Promise<{ status: string; message_count: number }> {
    return apiFetch(ENDPOINTS.CONTRACT_CHAT(uid), {
      method: 'PUT',
      body: JSON.stringify({ messages }),
    });
  }

  /**
   * Replace contract source with user-edited code.
   * Backend rearms pipeline at `phase=generated`; caller must follow up
   * with `triggerBuild(uid)` to compile.
   */
  async replaceContractCode(
    uid: string,
    code: string,
  ): Promise<{ uid: string; phase: string; code_version: number; next_step: string }> {
    return apiFetch(ENDPOINTS.CONTRACT_CODE(uid), {
      method: 'PUT',
      body: JSON.stringify({ code }),
    });
  }

  /**
   * Re-generate the contract with explicit user-supplied directives.
   * Used to escape PAUSED_DEGRADED or to apply architectural changes the
   * audit pipeline cannot self-fix. Backend rearms at `phase=generated`;
   * caller must follow up with `triggerBuild(uid)`.
   */
  async regenerateContract(
    uid: string,
    feedback: string,
  ): Promise<{ uid: string; phase: string; code_version?: number }> {
    return apiFetch(`/api/v1/contracts/${uid}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ feedback }),
    });
  }

  /**
   * Tier 2.2 — release a paused-for-approval deep-regen.
   * Backend replays the deep_regen prompt via regenerate_with_feedback then
   * restarts paste-mode; the WS contract stream will push the new code.
   */
  async approveRegen(uid: string): Promise<{
    uid: string;
    decision: 'approved' | 'declined';
    new_phase: string;
  }> {
    return apiFetch(ENDPOINTS.CONTRACT_APPROVE_REGEN(uid), { method: 'POST' });
  }

  /**
   * Tier 2.2 — mark a paused-for-approval contract as declined. Pure
   * telemetry; contract stays paused so the user can drive next step via
   * chat-Apply instead.
   */
  async declineRegen(uid: string): Promise<{
    uid: string;
    decision: 'approved' | 'declined';
    new_phase: string;
  }> {
    return apiFetch(ENDPOINTS.CONTRACT_DECLINE_REGEN(uid), { method: 'POST' });
  }

  // ── Credits ───────────────────────────────────────────────────────────────

  async getCreditsBalance(): Promise<BalanceResponse> {
    return apiFetch(ENDPOINTS.CREDITS_BALANCE);
  }

  async purchaseCredits(solTxSignature: string): Promise<PurchaseResponse> {
    const res = await apiFetch<PurchaseResponse>(ENDPOINTS.CREDITS_PURCHASE, {
      method: 'POST',
      body: JSON.stringify({ sol_tx_signature: solTxSignature }),
    });
    // Emit new balance so useCredits updates immediately
    balanceBus.emit(res.new_balance);
    return res;
  }

  async getCreditHistory(limit = 50, offset = 0): Promise<CreditHistoryResponse> {
    return apiFetch(`${ENDPOINTS.CREDITS_HISTORY}?limit=${limit}&offset=${offset}`);
  }

  async getCreditRates(): Promise<CreditRatesResponse> {
    return apiFetch(ENDPOINTS.CREDITS_RATES);
  }

  // ── Subscriptions ───────────────────────────────────────────────────────────

  /** Public catalogue of subscription tiers + the treasury recipient. */
  async getSubscriptionPlans(): Promise<SubscriptionPlansResponse> {
    return apiFetch(ENDPOINTS.SUBSCRIPTION_PLANS, { auth: false });
  }

  /** The authenticated user's current plan, expiry, and active flag. */
  async getSubscription(): Promise<SubscriptionStatus> {
    return apiFetch(ENDPOINTS.SUBSCRIPTION_STATUS);
  }

  /** Verify the SOL payment and activate/renew a plan; bumps the credit bus. */
  async subscribe(planId: string, solTxSignature: string): Promise<SubscribeResponse> {
    const res = await apiFetch<SubscribeResponse>(ENDPOINTS.SUBSCRIPTION_SUBSCRIBE, {
      method: 'POST',
      body: JSON.stringify({ plan_id: planId, sol_tx_signature: solTxSignature }),
    });
    balanceBus.emit(res.new_balance);
    return res;
  }
}

export const apiClient = new ApiClient();
