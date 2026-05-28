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
  | 'failed'
  | 'cancelled'
  | 'paused_degraded';

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
  // Stage-report summary fields — used by useStageReports to build chat entries.
  build_errors_count?: number;
  top_error_codes?: string[];
  vulns_by_severity?: Record<string, number>;
  fixes_applied_count?: number;
  last_fix_description?: string | null;
  last_fix_source?: string | null;
  pause_report?: string | null;
  // Tier 2.2 — structured pause reason. When equal to "awaiting_regen_approval"
  // the UI renders RegenConfirmCard instead of the generic paused banner.
  intervention_reason?: string | null;
  // Tier 2.2 — cost forecast for the pending deep_regen. Populated only when
  // intervention_reason === "awaiting_regen_approval"; zero/absent otherwise.
  pending_regen_credits?: number;
  pending_regen_cost_usd?: number;
  pending_regen_seconds?: number;
  // Migration 0010: contract was deployed BEFORE the find_so fix and ended up
  // re-uploading the warm-seed Hello-World binary on a shared address.
  // Frontend shows a redeploy banner when this is true.
  requires_redeploy?: boolean;
  stale_program_id?: string | null;
  // Cumulative LLM spend (USD) attributed to this contract so far. Incremented
  // per LLM call by the backend budget ledger; drives the running-spend banner.
  cost_usd?: number;
}

export interface ContractCode {
  code: string;
  version: number;
}

export interface ContractAudit {
  report: string;
  vulns: Array<{ severity?: string; title?: string; description?: string }>;
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
  /** Client-generated id so /apply can reference the exact AI bubble. */
  message_id?: string;
}

export interface ChatRequest {
  messages: ChatMessagePayload[];
  /** UID of an existing contract. When set, backend uses advisor mode (never ready=true). */
  contract_uid?: string;
}

/**
 * Auto-regenerate proposal attached by the backend when the AI classified the
 * user's latest message as a regeneration request with sufficient confidence.
 * Rendered as an inline card with [Apply] / [Refine] / [Cancel] buttons.
 */
export interface ProposedAction {
  type: 'regenerate';
  /** Short one-line description shown in the card body. */
  summary: string;
  /** Verbatim feedback that would be sent to /regenerate on Apply. */
  feedback: string;
  /** Classifier confidence (0.0-1.0). */
  confidence: number;
  /** uid of the auto_regenerate_log row — pass back to /apply or /decline. */
  log_uid: string;
  /** Tier 2.1 — fixed pipeline charge in credits (defaults to 10). */
  estimated_credits?: number;
  /** Tier 2.1 — USD forecast (regen + ~1 fix iteration). */
  estimated_cost_usd?: number;
  /** Tier 2.1 — wall-clock estimate in seconds. */
  estimated_seconds?: number;
}

export interface ChatResponse {
  message: string;           // AI reply to display
  ready: boolean;            // true → enriched_prompt is available
  enriched_prompt?: string;  // detailed spec for pipeline generation
  proposed_action?: ProposedAction | null;
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

// ── Code History (for diff view) ──────────────────────────────────────────────

export interface AppliedFixItem {
  source: 'knowledge_base' | 'llm_generated';
  kb_entry_id: string | null;
  error_pattern: string;
  fix_description: string;
  was_successful: boolean | null;
}

export interface CodeVersionItem {
  index: number;
  code: string;
  linked_fix: AppliedFixItem | null;
}

export interface CodeHistoryResponse {
  bumm_uid: string;
  versions: CodeVersionItem[];
}

// ── Credits stream ────────────────────────────────────────────────────────────

export interface CreditsStreamEvent {
  balance?: number;
  reason?: string;
  tx_ref?: string | null;
  type?: 'heartbeat';
}
