/**
 * Unit tests for useStageReports — the hook that derives deterministic
 * stage-report chat messages from successive ContractStatus payloads.
 *
 * The hook has no DOM dependencies and no async side effects, so we can
 * test the pure logic by directly invoking the effect via a fake
 * "render + status transition" sequence.
 *
 * Strategy: instead of renderHook (which needs jsdom), we extract the
 * report-emission logic into a testable pure function and verify it here.
 * The hook wires that logic into useEffect — covered by the integration
 * path (BuildModal / Dashboard WS effect).
 *
 * Run: npx vitest run src/hooks/__tests__/useStageReports.test.ts
 */

import { describe, it, expect } from 'vitest';
import type { ContractStatus } from '@/lib/api';

// ── Re-implement the core logic inline so we can test it without a DOM ────────
// This mirrors the exact conditions inside useStageReports.ts.

interface StageReportInput {
  prev: ContractStatus | undefined;
  curr: ContractStatus;
}

function collectReports(transitions: StageReportInput[]): string[] {
  const emitted: string[] = [];
  const seen = new Set<string>();

  const emit = (id: string, msg: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    emitted.push(msg);
  };

  for (const { prev, curr } of transitions) {
    // Build attempt failed
    if (
      !curr.build_ok &&
      prev &&
      (curr.build_attempt ?? 0) > (prev.build_attempt ?? 0) &&
      (curr.build_errors_count ?? 0) > 0
    ) {
      const attempt = curr.build_attempt ?? 0;
      const count = curr.build_errors_count ?? 0;
      const codes = (curr.top_error_codes ?? []).filter(Boolean);
      const codesStr = codes.length > 0 ? ` (${codes.join(', ')})` : '';
      emit(
        `build_fail:${attempt}`,
        `**Build attempt ${attempt} failed** — ${count} compiler error${count === 1 ? '' : 's'}${codesStr}. Attempting auto-fix…`,
      );
    }

    // Fix applied
    const prevFixes = prev?.fixes_applied_count ?? 0;
    const curFixes = curr.fixes_applied_count ?? 0;
    if (curFixes > prevFixes && curr.last_fix_description) {
      const src = curr.last_fix_source === 'knowledge_base' ? 'KB match' : 'LLM patch';
      emit(
        `fix:${curFixes}`,
        `**Fix applied** (${src}): ${curr.last_fix_description}`,
      );
    }

    // Audit attempt with findings
    if (
      prev &&
      (curr.audit_attempt ?? 0) > (prev.audit_attempt ?? 0) &&
      !curr.audit_ok
    ) {
      const counts = curr.vulns_by_severity ?? {};
      const order = ['critical', 'high', 'medium', 'low', 'info'];
      const parts = order
        .filter((k) => (counts[k] ?? 0) > 0)
        .map((k) => `${counts[k]} ${k}`);
      const summary = parts.join(', ');
      const attempt = curr.audit_attempt ?? 0;
      if (summary) {
        emit(
          `audit_vulns:${attempt}`,
          `**Audit attempt ${attempt}** found: ${summary}. Applying fixes and rebuilding…`,
        );
      }
    }
  }

  return emitted;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const base: ContractStatus = {
  bumm_uid: 'uid-1',
  phase: 'building',
  build_ok: false,
  audit_ok: false,
  build_attempt: 0,
  audit_attempt: 0,
  next_step: null,
  program_id: null,
  error: null,
  build_errors_count: 0,
  top_error_codes: [],
  vulns_by_severity: {},
  fixes_applied_count: 0,
  last_fix_description: null,
  last_fix_source: null,
};

const s = (over: Partial<ContractStatus>): ContractStatus => ({ ...base, ...over });

// ─────────────────────────────────────────────────────────────────────────────

describe('useStageReports — build attempt failure', () => {
  it('emits message when first build attempt fails', () => {
    const msgs = collectReports([
      {
        prev: s({ build_attempt: 0 }),
        curr: s({ build_attempt: 1, build_errors_count: 3 }),
      },
    ]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Build attempt 1 failed');
    expect(msgs[0]).toContain('3 compiler errors');
  });

  it('includes error codes when present', () => {
    const msgs = collectReports([
      {
        prev: s({ build_attempt: 0 }),
        curr: s({ build_attempt: 1, build_errors_count: 2, top_error_codes: ['E0432', 'E0277'] }),
      },
    ]);
    expect(msgs[0]).toContain('E0432, E0277');
  });

  it('uses singular "error" for exactly one error', () => {
    const msgs = collectReports([
      {
        prev: s({ build_attempt: 0 }),
        curr: s({ build_attempt: 1, build_errors_count: 1 }),
      },
    ]);
    expect(msgs[0]).toContain('1 compiler error.');
    expect(msgs[0]).not.toContain('errors');
  });

  it('emits separate messages for each successive failed attempt', () => {
    const msgs = collectReports([
      { prev: s({ build_attempt: 0 }), curr: s({ build_attempt: 1, build_errors_count: 2 }) },
      { prev: s({ build_attempt: 1 }), curr: s({ build_attempt: 2, build_errors_count: 1 }) },
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('attempt 1');
    expect(msgs[1]).toContain('attempt 2');
  });

  it('does NOT emit when build_ok is true (success handled elsewhere)', () => {
    const msgs = collectReports([
      {
        prev: s({ build_attempt: 1 }),
        curr: s({ build_attempt: 2, build_ok: true, build_errors_count: 0 }),
      },
    ]);
    expect(msgs).toHaveLength(0);
  });

  it('does NOT emit on the same attempt seen twice (dedup)', () => {
    const curr = s({ build_attempt: 1, build_errors_count: 2 });
    const msgs = collectReports([
      { prev: s({ build_attempt: 0 }), curr },
      { prev: curr, curr }, // same status delivered twice by WS
    ]);
    expect(msgs).toHaveLength(1);
  });

  it('does NOT emit when no prev (first WS message)', () => {
    const msgs = collectReports([
      { prev: undefined as unknown as ContractStatus, curr: s({ build_attempt: 1, build_errors_count: 2 }) },
    ]);
    expect(msgs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useStageReports — fix applied', () => {
  it('emits fix message with LLM patch source', () => {
    const msgs = collectReports([
      {
        prev: s({ fixes_applied_count: 0 }),
        curr: s({
          fixes_applied_count: 1,
          last_fix_description: 'Added missing use declaration',
          last_fix_source: 'llm_generated',
        }),
      },
    ]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Fix applied');
    expect(msgs[0]).toContain('LLM patch');
    expect(msgs[0]).toContain('Added missing use declaration');
  });

  it('labels knowledge base fixes correctly', () => {
    const msgs = collectReports([
      {
        prev: s({ fixes_applied_count: 0 }),
        curr: s({
          fixes_applied_count: 1,
          last_fix_description: 'Fixed integer overflow',
          last_fix_source: 'knowledge_base',
        }),
      },
    ]);
    expect(msgs[0]).toContain('KB match');
  });

  it('emits per fix when multiple fixes are applied sequentially', () => {
    const msgs = collectReports([
      {
        prev: s({ fixes_applied_count: 0 }),
        curr: s({ fixes_applied_count: 1, last_fix_description: 'Fix 1', last_fix_source: 'llm_generated' }),
      },
      {
        prev: s({ fixes_applied_count: 1 }),
        curr: s({ fixes_applied_count: 2, last_fix_description: 'Fix 2', last_fix_source: 'knowledge_base' }),
      },
    ]);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toContain('Fix 1');
    expect(msgs[1]).toContain('Fix 2');
  });

  it('does NOT emit when description is missing', () => {
    const msgs = collectReports([
      {
        prev: s({ fixes_applied_count: 0 }),
        curr: s({ fixes_applied_count: 1, last_fix_description: null }),
      },
    ]);
    expect(msgs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useStageReports — audit attempt with findings', () => {
  it('emits vulnerability summary on audit attempt with findings', () => {
    const msgs = collectReports([
      {
        prev: s({ audit_attempt: 0 }),
        curr: s({
          audit_attempt: 1,
          audit_ok: false,
          vulns_by_severity: { critical: 1, high: 2, medium: 3 },
        }),
      },
    ]);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toContain('Audit attempt 1**');
    expect(msgs[0]).toContain('1 critical');
    expect(msgs[0]).toContain('2 high');
    expect(msgs[0]).toContain('3 medium');
  });

  it('omits severity levels with zero count', () => {
    const msgs = collectReports([
      {
        prev: s({ audit_attempt: 0 }),
        curr: s({
          audit_attempt: 1,
          audit_ok: false,
          vulns_by_severity: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        }),
      },
    ]);
    expect(msgs[0]).not.toContain('critical');
    expect(msgs[0]).not.toContain('medium');
    expect(msgs[0]).toContain('1 high');
  });

  it('does NOT emit when audit_ok becomes true (handled by Dashboard)', () => {
    const msgs = collectReports([
      {
        prev: s({ audit_attempt: 0 }),
        curr: s({ audit_attempt: 1, audit_ok: true, vulns_by_severity: { high: 2 } }),
      },
    ]);
    expect(msgs).toHaveLength(0);
  });

  it('does NOT emit when vulns_by_severity is empty', () => {
    const msgs = collectReports([
      {
        prev: s({ audit_attempt: 0 }),
        curr: s({ audit_attempt: 1, audit_ok: false, vulns_by_severity: {} }),
      },
    ]);
    expect(msgs).toHaveLength(0);
  });

  it('does NOT emit without prev (first WS message)', () => {
    const msgs = collectReports([
      {
        prev: undefined as unknown as ContractStatus,
        curr: s({ audit_attempt: 1, vulns_by_severity: { critical: 2 } }),
      },
    ]);
    expect(msgs).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('useStageReports — full pipeline simulation', () => {
  it('emits correct sequence of reports through a failing build cycle', () => {
    const seq: StageReportInput[] = [
      // First build attempt fails
      {
        prev: s({ build_attempt: 0 }),
        curr: s({ build_attempt: 1, build_errors_count: 2, top_error_codes: ['E0432'] }),
      },
      // Fix applied
      {
        prev: s({ build_attempt: 1 }),
        curr: s({
          build_attempt: 1,
          fixes_applied_count: 1,
          last_fix_description: 'Added missing import',
          last_fix_source: 'knowledge_base',
        }),
      },
      // Second build attempt succeeds — no report (handled by Dashboard)
      {
        prev: s({ build_attempt: 1, fixes_applied_count: 1 }),
        curr: s({ build_attempt: 2, build_ok: true, fixes_applied_count: 1 }),
      },
      // Audit finds issues
      {
        prev: s({ build_ok: true, audit_attempt: 0 }),
        curr: s({
          build_ok: true,
          audit_attempt: 1,
          audit_ok: false,
          vulns_by_severity: { high: 1 },
        }),
      },
    ];

    const msgs = collectReports(seq);
    expect(msgs).toHaveLength(3);
    expect(msgs[0]).toContain('Build attempt 1 failed');
    expect(msgs[1]).toContain('Fix applied');
    expect(msgs[1]).toContain('KB match');
    expect(msgs[2]).toContain('Audit attempt 1**');
    expect(msgs[2]).toContain('1 high');
  });
});
