/**
 * M1 Premium Audit (Debate) — pure helpers.
 *
 * Kept out of the component so the failure-mode mapping is unit-testable and
 * the UI stays a thin render layer.
 */

/** Credit price of one debate audit — mirrors backend `credit_cost_debate`. */
export const DEBATE_AUDIT_COST = 12;

/**
 * Map a failed debate-audit request to a message a user can act on.
 *
 * The raw backend `detail` is a poor error surface here: a 404 renders as
 * "Not Found", which reads like the contract vanished when it actually means
 * the deployed API predates the debate-audit endpoint. Every status we can
 * name gets a sentence that says what happened and what to do about it.
 */
export function debateAuditErrorMessage(status: number | undefined, fallback: string): string {
  switch (status) {
    case 401:
    case 403:
      return 'Session expired — reconnect your wallet and try again.';
    case 402:
      return `Not enough credits — a premium audit costs ${DEBATE_AUDIT_COST} credits.`;
    case 404:
      return 'Premium audit is not available on this server yet.';
    case 409:
      return 'This contract has no code to audit yet.';
    case 429:
      return 'Too many requests — wait a moment and try again.';
    case 503:
      return 'Premium audit is temporarily unavailable.';
    default:
      if (status !== undefined && status >= 500) {
        return 'The audit failed on the server. Your credits were not charged.';
      }
      return fallback || 'Premium audit failed.';
  }
}

/** One-line summary of a finished audit, e.g. "3 findings · 2 models · −12 cr". */
export function debateAuditSummary(input: {
  vulnCount: number;
  modelsSucceeded: number;
  modelsFailed: number;
  creditsCharged: number;
}): string {
  const findings = `${input.vulnCount} finding${input.vulnCount === 1 ? '' : 's'}`;
  const models = `${input.modelsSucceeded} model${input.modelsSucceeded === 1 ? '' : 's'}`;
  const failed = input.modelsFailed > 0 ? ` (${input.modelsFailed} failed)` : '';
  return `${findings} · ${models}${failed} · −${input.creditsCharged} cr`;
}
