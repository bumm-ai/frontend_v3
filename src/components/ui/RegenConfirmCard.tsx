'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

const formatUsd = (usd: number): string => {
  if (usd <= 0) return '$0.00';
  if (usd < 0.01) return '<$0.01';
  return `$${usd.toFixed(2)}`;
};

const formatSeconds = (seconds: number): string => {
  if (seconds <= 0) return '~?';
  if (seconds < 60) return `~${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `~${mins}m`;
};

export interface RegenConfirmCardProps {
  pauseReason: string;
  estimatedCredits: number;
  estimatedCostUsd: number;
  estimatedSeconds: number;
  /** Resolves when backend confirms approval. Parent should refresh status after. */
  onApprove: () => Promise<void>;
  /** Telemetry-only; parent decides if it dismisses the card or leaves it. */
  onDecline: () => Promise<void>;
}

/**
 * Tier 2.2 — confirmation card shown when the fix-build loop detector tripped
 * and the pipeline paused awaiting user approval before firing the next
 * (paid) deep-regenerate. Rendered in chat when:
 *   contractStatus.phase === 'paused_degraded'
 *   AND contractStatus.intervention_reason === 'awaiting_regen_approval'
 *
 * Yellow / amber styling distinguishes it from the orange ProposedActionCard
 * which fires AFTER paused_degraded once the user chats their own fix.
 * Confidence score is intentionally hidden — the user is making a money
 * decision, not a probability one.
 */
export const RegenConfirmCard = ({
  pauseReason,
  estimatedCredits,
  estimatedCostUsd,
  estimatedSeconds,
  onApprove,
  onDecline,
}: RegenConfirmCardProps) => {
  const [status, setStatus] = useState<
    'idle' | 'approving' | 'approved' | 'declining' | 'declined' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApprove = async () => {
    if (status !== 'idle') return;
    setStatus('approving');
    setErrorMessage(null);
    try {
      await onApprove();
      setStatus('approved');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Approval failed — please try again.',
      );
    }
  };

  const handleDecline = async () => {
    if (status !== 'idle') return;
    setStatus('declining');
    try {
      await onDecline();
      setStatus('declined');
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Decline failed — please try again.',
      );
    }
  };

  if (status === 'approved') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
      >
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        <span>Approved — regenerating contract from scratch…</span>
      </motion.div>
    );
  }

  if (status === 'declined') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 flex items-center gap-2 rounded-lg border border-neutral-700/50 bg-neutral-800/40 px-3 py-2 text-sm text-neutral-400"
      >
        <XCircle className="h-4 w-4 flex-shrink-0" />
        <span>Declined — describe a manual fix in the chat to continue.</span>
      </motion.div>
    );
  }

  const isApproving = status === 'approving';
  const isDeclining = status === 'declining';
  const busy = isApproving || isDeclining;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-3 overflow-hidden rounded-xl border border-yellow-500/40 bg-gradient-to-br from-yellow-500/15 via-yellow-500/5 to-transparent shadow-sm"
    >
      <div className="flex items-start gap-3 px-4 pt-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-yellow-300" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-yellow-300/90">
            Approve regeneration?
          </div>
          <div className="mt-0.5 text-sm font-medium text-yellow-50">
            Fix-loop detected — I can rewrite the contract from scratch.
          </div>
        </div>
      </div>

      <div className="mx-4 mt-2 rounded-md bg-neutral-900/60 px-3 py-2 text-xs text-neutral-300 whitespace-pre-line">
        {pauseReason}
      </div>

      <div className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-yellow-500/20 bg-neutral-950/40 px-2.5 py-1.5 text-[11px] text-neutral-300">
        {estimatedCredits > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Coins className="h-3 w-3 text-yellow-300/80" />
            <span className="font-medium text-yellow-100">
              {estimatedCredits} credits
            </span>
          </span>
        ) : null}
        {estimatedCostUsd > 0 ? (
          <span className="inline-flex items-center gap-1 text-neutral-400">
            <span className="opacity-60">·</span>
            <span>~{formatUsd(estimatedCostUsd)} LLM</span>
          </span>
        ) : null}
        {estimatedSeconds > 0 ? (
          <span className="inline-flex items-center gap-1 text-neutral-400">
            <span className="opacity-60">·</span>
            <Clock className="h-3 w-3" />
            <span>{formatSeconds(estimatedSeconds)}</span>
          </span>
        ) : null}
        <span className="ml-auto italic text-neutral-500">estimated</span>
      </div>

      {status === 'error' && errorMessage ? (
        <div className="mx-4 mt-2 rounded-md bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-yellow-500/20 bg-neutral-950/30 px-3 py-2">
        <button
          type="button"
          onClick={handleDecline}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDeclining ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Declining…
            </span>
          ) : (
            'Decline — I’ll fix it in chat'
          )}
        </button>
        <button
          type="button"
          onClick={handleApprove}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-yellow-400/90 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-yellow-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApproving ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Approving…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Approve &amp; regenerate
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
