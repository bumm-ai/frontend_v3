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
  prompt: string;    // 1–10 000 chars
  network?: Network; // default "devnet"
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
