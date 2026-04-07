// API Types — Bumm AI Backend v3
// Single source of truth for all REST + WebSocket types.
// Matches backend_v3 Pydantic models exactly.

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface ChallengeResponse {
  nonce: string;   // 64-char hex
  message: string; // human-readable sign message
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
  expires_in: number; // seconds (900 = 15 min)
}

// ── Contracts ─────────────────────────────────────────────────────────────────

export type Network = 'devnet' | 'testnet' | 'mainnet-beta';

export interface ContractRequest {
  /** Generate-from-prompt flow: natural language description (required unless code is set). */
  prompt?: string;
  /** Paste-existing-code flow: verbatim Anchor/Rust source. Skips enrich → generate. */
  code?: string;
  network?: Network; // default "devnet"
  name?: string;
  chat_history?: ChatMessagePayload[];
  // When true the pipeline pauses after generate so the frontend can trigger
  // build / audit / deploy separately via the step endpoints.
  step_mode?: boolean;
}

export interface ContractCreated {
  uid: string;
  status: string;
  status_url: string;
  ws_url: string;
}

export type Phase =
  | 'pending'
  | 'enriching'
  | 'generating'
  | 'generated'      // paste-mode: code exists, paused before build
  | 'building'
  | 'build_fixing'
  | 'auditing_static'
  | 'auditing_llm'
  | 'audit_fixing'
  | 'deploying'
  | 'learning'
  | 'done'
  | 'failed';

export const TERMINAL_PHASES: Phase[] = ['done', 'failed'];

export interface ContractStatus {
  bumm_uid: string;
  phase: Phase;
  build_attempt: number;
  build_ok: boolean;
  audit_attempt: number;
  audit_ok: boolean;
  program_id: string | null;
  error: string | null;
  // Step-mode: next step waiting to be triggered, or null if pipeline running/done.
  next_step: 'build' | 'audit' | 'deploy' | null;
}

export interface ContractCode {
  code: string;
  version: number;
}

export interface ContractAudit {
  report: string;
  vulns: Record<string, unknown>;
}

// ── Credits ───────────────────────────────────────────────────────────────────

export interface BalanceResponse {
  user_uid: string;
  credits: number;
}

export interface PurchaseRequest {
  sol_tx_signature: string; // 64-128 chars base58
}

export interface PurchaseResponse {
  credits_added: number;
  new_balance: number;
  sol_tx_signature: string;
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatMessagePayload {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  messages: ChatMessagePayload[];
}

export interface ChatResponse {
  message: string;           // AI reply to display
  ready: boolean;            // true → enriched_prompt is available
  enriched_prompt?: string;  // detailed spec for pipeline generation
}

// ── Contract List ────────────────────────────────────────────────────────────

export interface ContractSummary {
  uid: string;
  name: string;
  phase: Phase;
  build_ok: boolean;
  audit_ok: boolean;
  program_id: string | null;
  deploy_network: string;
  created_at: string;
  updated_at: string;
}

export interface ContractListResponse {
  contracts: ContractSummary[];
  total: number;
}

// ── Credit History ──────────────────────────────────────────────────────────

export interface CreditTransactionItem {
  uid: string;
  tx_type: 'purchase' | 'deduct' | 'refund';
  credits_delta: number;
  credits_before: number;
  credits_after: number;
  sol_tx_signature: string | null;
  pipeline_uid: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreditHistoryResponse {
  transactions: CreditTransactionItem[];
  total: number;
}

export interface CreditRatesResponse {
  lamports_per_credit: number;
  credits_per_sol: number;
  chat_credit_cost: number;
  pipeline_credit_cost: number;
}

// ── Deploy Estimate ──────────────────────────────────────────────────────────

export interface DeployEstimate {
  so_size_bytes: number | null;
  estimated_sol: number;
  estimated_credits: number;
  user_balance_credits: number;
  user_sol_balance: number | null;
  sufficient: boolean;
  missing_credits: number;
  network: string;
  note: string | null;
}

// ── Errors ────────────────────────────────────────────────────────────────────

export interface ApiError {
  detail: string | Array<{ msg: string; type: string }>;
}

// ── JWT Payload (decoded client-side) ────────────────────────────────────────

export interface JwtPayload {
  sub: string;    // user_uid
  wallet: string; // wallet_address
  exp: number;    // Unix timestamp
  iat: number;
  jti: string;
  type: 'access' | 'refresh';
}
