'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';

import type { ProposedAction } from '@/types/dashboard';

interface ProposedActionCardProps {
  action: ProposedAction;
  /** Called when the user clicks Apply. Parent flips status optimistically. */
  onApply: () => Promise<void>;
  /** Called when the user clicks Decline (or Cancel). Telemetry only. */
  onDecline: () => Promise<void>;
}

/**
 * Inline card rendered underneath an AI chat bubble when the backend's
 * intent classifier returned a `proposed_action`. Closes the UX gap where
 * the AI used to say "I'll regenerate with these fixes" in plain text and
 * then nothing happened because chat had no pipeline access.
 *
 * The user is shown a one-line summary plus the proposed feedback excerpt;
 * Apply triggers POST /api/v1/chat/{uid}/apply which delegates to the
 * existing regenerate service. Decline records the click in the audit log
 * so we can measure classifier false-positive rate over time.
 *
 * Confidence is intentionally NOT surfaced in the UI — exposing a model
 * score would invite users to second-guess based on a number that they
 * cannot meaningfully calibrate. The backend already applies a per-phase
 * threshold before this card is rendered.
 */
export const ProposedActionCard = ({
  action,
  onApply,
  onDecline,
}: ProposedActionCardProps) => {
  const status = action.status ?? 'proposed';

  if (status === 'applied') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200"
      >
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        <span>Applied — regenerating contract with these changes…</span>
      </motion.div>
    );
  }

  if (status === 'declined') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-2 flex items-center gap-2 rounded-lg border border-neutral-700/50 bg-neutral-800/40 px-3 py-2 text-sm text-neutral-400"
      >
        <XCircle className="h-4 w-4 flex-shrink-0" />
        <span>Dismissed</span>
      </motion.div>
    );
  }

  const isApplying = status === 'applying';
  const isError = status === 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mt-3 overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent shadow-sm"
    >
      <div className="flex items-start gap-3 px-4 pt-3">
        <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-300/80">
            Suggested regenerate
          </div>
          <div className="mt-0.5 text-sm font-medium text-amber-50">
            {action.summary}
          </div>
        </div>
      </div>

      <details className="px-4 pt-1">
        <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
          Show full feedback
        </summary>
        <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-neutral-900/60 p-2 text-xs text-neutral-200">
          {action.feedback}
        </pre>
      </details>

      {isError && action.errorMessage && (
        <div className="mx-4 mt-2 rounded-md bg-rose-500/15 px-2 py-1 text-xs text-rose-200">
          {action.errorMessage}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-amber-500/20 bg-neutral-950/30 px-3 py-2">
        <button
          type="button"
          onClick={onDecline}
          disabled={isApplying}
          className="rounded-md px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Dismiss
        </button>
        <button
          type="button"
          onClick={onApply}
          disabled={isApplying}
          className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/90 px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isApplying ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <RefreshCw className="h-3.5 w-3.5" />
              Apply &amp; regenerate
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
