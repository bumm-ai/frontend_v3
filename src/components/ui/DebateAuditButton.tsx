'use client';

import { useState, useCallback } from 'react';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { apiClient } from '@/services/api';
import { balanceBus } from '@/services/balanceBus';
import type { DebateAuditResponse } from '@/lib/api';

interface DebateAuditButtonProps {
  /** Contract UID to re-audit. */
  uid: string;
  /** Disable the trigger (e.g. while a pipeline step is running). */
  disabled?: boolean;
}

/**
 * M1 — "Premium Audit (Debate)" — a self-contained, paid on-demand multi-LLM
 * re-audit. One click runs an ensemble audit across several models on the
 * contract's current code, charges `credit_cost_debate` (12 credits) on
 * success, and renders the report + cost inline.
 *
 * Deliberately self-contained (its own loading/error/result state) so it can be
 * dropped next to the main action button without touching the Dashboard god
 * component. Maps the backend's status codes to friendly messages:
 *   402 → not enough credits, 503 → not configured, 409 → no code to audit.
 */
export function DebateAuditButton({ uid, disabled }: DebateAuditButtonProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DebateAuditResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = useCallback(async () => {
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
      if (status === 402) {
        setError('Not enough credits for a premium audit (12 credits).');
      } else if (status === 503) {
        setError('Premium audit is not available right now.');
      } else if (status === 409) {
        setError('This contract has no code to audit yet.');
      } else {
        setError(err instanceof Error ? err.message : 'Premium audit failed.');
      }
    } finally {
      setLoading(false);
    }
  }, [uid, loading, disabled]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || disabled}
        title="Run a paid multi-LLM debate audit on the current code (12 credits)"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium border border-[#FE4A01]/40 text-[#FE4A01] hover:bg-[#FE4A01]/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
      >
        {loading ? (
          <>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Auditing…
          </>
        ) : (
          <>
            <ShieldCheck className="w-3.5 h-3.5" />
            Premium Audit (Debate) · 12 cr
          </>
        )}
      </button>

      {error && (
        <div className="flex items-start gap-1.5 max-w-xs text-[10px] text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="max-w-md w-full text-[10px] text-gray-300 bg-[#161616] border border-[#2a2a2a] rounded p-2 space-y-1">
          <div className="flex items-center justify-between gap-2 text-gray-400">
            <span>
              {result.vuln_count} finding{result.vuln_count === 1 ? '' : 's'} ·{' '}
              {result.models_succeeded} model
              {result.models_succeeded === 1 ? '' : 's'}
              {result.models_failed > 0 ? ` (${result.models_failed} failed)` : ''}
            </span>
            <span className="text-[#FE4A01]">−{result.credits_charged} cr</span>
          </div>
          <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap font-mono text-[10px] text-gray-300">
            {result.report}
          </pre>
        </div>
      )}
    </div>
  );
}
