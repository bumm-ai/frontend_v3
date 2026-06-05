'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const MAX_FEEDBACK = 2000;

interface RegenerateFeedbackModalProps {
  open: boolean;
  /** Optional pause/failure context shown above the input. */
  pauseReport?: string | null;
  contractName?: string;
  onClose: () => void;
  /** Async — modal stays open with loader until this resolves. */
  onSubmit: (feedback: string) => Promise<void>;
}

/**
 * Lightweight modal for POST /regenerate. The user describes what should
 * change in plain language; backend rewrites the source via LLM and re-arms
 * the pipeline at `phase=generated`.
 *
 * Used to escape PAUSED_DEGRADED, structural-guard rejections, or audit
 * findings the auto-fix loop can't resolve (e.g. "drop the unused vault and
 * switch from mint_to to transfer").
 */
export const RegenerateFeedbackModal = ({
  open,
  pauseReport,
  contractName,
  onClose,
  onSubmit,
}: RegenerateFeedbackModalProps) => {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setFeedback('');
      setError(null);
      setSubmitting(false);
      // Focus on next tick to let the modal mount.
      const id = setTimeout(() => textareaRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  const trimmed = feedback.trim();
  const canSubmit = trimmed.length >= 5 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit(trimmed);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regenerate failed');
      setSubmitting(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl + Enter to submit
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => !submitting && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.96 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative w-full max-w-lg mx-4 bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="absolute top-3 right-3 text-[#666] hover:text-white disabled:opacity-30 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <RefreshCw className="w-4 h-4 text-orange-400" />
                <h2 className="text-white font-medium text-sm">
                  Regenerate with feedback
                </h2>
              </div>
              <p className="text-[#888] text-xs leading-relaxed mb-3">
                Describe what should change.{' '}
                {contractName && (
                  <span className="text-[#aaa]">[{contractName}]</span>
                )}{' '}
                The AI will rewrite the contract preserving working logic and
                the original intent.
              </p>

              {pauseReport && (
                <div className="mb-3 p-2.5 rounded-md bg-yellow-500/10 border border-yellow-500/20 text-yellow-200/90 text-[11px] leading-relaxed">
                  <span className="font-medium">Why you&apos;re seeing this: </span>
                  {pauseReport}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={feedback}
                onChange={(e) =>
                  setFeedback(e.target.value.slice(0, MAX_FEEDBACK))
                }
                onKeyDown={handleKey}
                disabled={submitting}
                placeholder="e.g. Drop the unused reward_vault. Switch token::mint_to to token::transfer from the vault. Use init_if_needed for the position account."
                rows={6}
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-md p-3 text-gray-200 text-xs font-mono resize-none focus:outline-none focus:border-orange-500/50 disabled:opacity-50"
              />

              <div className="mt-1 flex items-center justify-between text-[10px] text-[#666]">
                <span>Cmd/Ctrl + Enter to submit</span>
                <span>
                  {feedback.length}/{MAX_FEEDBACK}
                </span>
              </div>

              {error && (
                <div className="mt-2 text-[11px] text-red-400">{error}</div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-md text-[#aaa] hover:text-white text-xs disabled:opacity-30 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-500/20 text-orange-300 border border-orange-500/40 hover:bg-orange-500/30 hover:border-orange-500/60 disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-colors"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Regenerating…
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-3 h-3" />
                      Regenerate
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
