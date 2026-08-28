'use client';

import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { apiClient } from '@/services/api';
import { balanceBus } from '@/services/balanceBus';
import {
  DEBATE_AUDIT_COST,
  debateAuditErrorMessage,
  debateAuditSummary,
} from '@/lib/debateAudit';
import type { DebateAuditResponse } from '@/lib/api';

interface DebateAuditButtonProps {
  /** Contract UID to re-audit. */
  uid: string;
  /** Disable the trigger (e.g. while a pipeline step is running). */
  disabled?: boolean;
}

/**
 * M1 — "Premium Audit (Debate)": a paid on-demand multi-LLM re-audit.
 *
 * Renders as a single icon so it costs the surrounding header no layout at all.
 * Everything else — the priced action, errors, and the report — lives in an
 * absolutely-positioned popover, which is what keeps a long report from
 * pushing the main action button around (the previous version rendered the
 * report inline and shifted the whole action column).
 */
export function DebateAuditButton({ uid, disabled }: DebateAuditButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebateAuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the popover, except mid-audit where closing would hide a
  // request the user is still paying for.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, loading]);

  const handleRun = useCallback(async () => {
    if (loading || disabled) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await apiClient.debateAudit(uid);
      setResult(resp);
      // Keep the global credit balance in sync (backend also pushes via WS).
      balanceBus.emit(resp.remaining_credits);
    } catch (err: unknown) {
      const status = (err as { status?: number })?.status;
      setError(
        debateAuditErrorMessage(status, err instanceof Error ? err.message : ''),
      );
    } finally {
      setLoading(false);
    }
  }, [uid, loading, disabled]);

  return (
    <div className="relative">
      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        aria-label={`Premium audit (debate) — ${DEBATE_AUDIT_COST} credits`}
        aria-expanded={open}
        title={`Premium Audit (Debate) · ${DEBATE_AUDIT_COST} cr`}
        className="relative p-1.5 rounded-md text-[#FE4A01]/80 hover:text-[#FE4A01] hover:bg-[#FE4A01]/10 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FE4A01] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        whileHover={{ scale: disabled ? 1 : 1.1 }}
        whileTap={{ scale: disabled ? 1 : 0.9 }}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <ShieldCheck className="w-4 h-4" />
        )}
        {/* Unread-result dot — the report is one click away after the popover closes. */}
        {!open && result && (
          <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-[#FE4A01]" />
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => !loading && setOpen(false)}
            />
            <motion.div
              className="absolute right-0 top-full mt-1 w-72 bg-[#191919] border border-[#333] rounded-lg shadow-xl z-20 p-3 space-y-2"
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-medium text-white">Premium Audit</div>
                  <div className="text-[10px] text-gray-500">
                    Multi-model debate on the current code
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => !loading && setOpen(false)}
                  aria-label="Close"
                  className="p-0.5 text-gray-500 hover:text-white transition-colors disabled:opacity-40"
                  disabled={loading}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleRun}
                disabled={loading || disabled}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border border-[#FE4A01]/40 text-[#FE4A01] hover:bg-[#FE4A01]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Auditing…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {result ? 'Run again' : 'Run audit'} · {DEBATE_AUDIT_COST} cr
                  </>
                )}
              </button>

              {error && (
                <div className="flex items-start gap-1.5 text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {result && (
                <div className="text-[10px] text-gray-300 bg-[#101010] border border-[#2a2a2a] rounded p-2 space-y-1">
                  <div className="text-gray-400">
                    {debateAuditSummary({
                      vulnCount: result.vuln_count,
                      modelsSucceeded: result.models_succeeded,
                      modelsFailed: result.models_failed,
                      creditsCharged: result.credits_charged,
                    })}
                  </div>
                  <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-gray-300">
                    {result.report}
                  </pre>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
