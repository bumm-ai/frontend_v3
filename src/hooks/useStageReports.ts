'use client';

import { useEffect, useRef } from 'react';
import type { ContractStatus } from '@/lib/api';

/**
 * Deterministic mid-pipeline stage-report generator.
 *
 * Covers the events that Dashboard's WS effect does NOT already emit:
 *   - build attempt failed (attempt counter advanced, still not ok)
 *   - fix applied (fixes_applied_count grew)
 *   - audit attempt produced findings (attempt counter advanced, not ok)
 *
 * Terminal transitions (build_ok, audit_ok, program_id, phase=failed) are
 * handled in Dashboard.tsx with richer API follow-up fetches — this hook
 * intentionally does not duplicate them.
 *
 * Dedup: per-contract Set of report ids (transition invariants baked in).
 * No emojis — chat is rendered via MarkdownMessage and should stay clean.
 */

interface UseStageReportsParams {
  uid: string | null | undefined;
  status: ContractStatus | null | undefined;
  onReport: (message: string) => void;
}

function formatVulnSummary(counts: Record<string, number> | undefined): string {
  if (!counts) return '';
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  const parts = order
    .filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${counts[k]} ${k}`);
  return parts.join(', ');
}

export function useStageReports({ uid, status, onReport }: UseStageReportsParams): void {
  const seenRef = useRef<Map<string, Set<string>>>(new Map());
  const prevStatusRef = useRef<Map<string, ContractStatus>>(new Map());

  useEffect(() => {
    if (!uid || !status) return;

    if (!seenRef.current.has(uid)) seenRef.current.set(uid, new Set());
    const seen = seenRef.current.get(uid)!;
    const prev = prevStatusRef.current.get(uid);

    const emit = (id: string, message: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      onReport(message);
    };

    // Build attempt failed — attempt advanced but still not ok
    if (
      !status.build_ok &&
      prev &&
      status.build_attempt > prev.build_attempt &&
      (status.build_errors_count ?? 0) > 0
    ) {
      const attempt = status.build_attempt;
      const count = status.build_errors_count ?? 0;
      const codes = (status.top_error_codes ?? []).filter(Boolean);
      const codesStr = codes.length > 0 ? ` (${codes.join(', ')})` : '';
      emit(
        `build_fail:${attempt}`,
        `**Build attempt ${attempt} failed** — ${count} compiler error${count === 1 ? '' : 's'}${codesStr}. Attempting auto-fix…`,
      );
    }

    // Fix applied — fixes_applied_count grew
    const prevFixes = prev?.fixes_applied_count ?? 0;
    const curFixes = status.fixes_applied_count ?? 0;
    if (curFixes > prevFixes && status.last_fix_description) {
      const src = status.last_fix_source === 'knowledge_base' ? 'KB match' : 'LLM patch';
      emit(
        `fix:${curFixes}`,
        `**Fix applied** (${src}): ${status.last_fix_description}`,
      );
    }

    // Audit attempt produced findings — attempt advanced, not ok yet
    if (
      prev &&
      status.audit_attempt > prev.audit_attempt &&
      !status.audit_ok
    ) {
      const summary = formatVulnSummary(status.vulns_by_severity);
      const attempt = status.audit_attempt;
      if (summary) {
        emit(
          `audit_vulns:${attempt}`,
          `**Audit attempt ${attempt}** found: ${summary}. Applying fixes and rebuilding…`,
        );
      }
    }

    prevStatusRef.current.set(uid, status);
  }, [uid, status, onReport]);
}
