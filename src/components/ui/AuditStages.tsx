'use client';

import {
  Shield,
  Search,
  Zap,
  CheckCircle,
  Hourglass,
  RefreshCw,
  ScanLine,
  Brain,
  FileSearch,
} from 'lucide-react';
import type { ContractStatus } from '@/lib/api';
import {
  PipelineStagesCard,
  type StageView,
} from './PipelineStagesCard';
import { usePhaseTimer, pickSubStepIndex } from '@/hooks/usePhaseTimer';

interface DerivedAuditStages {
  stages: StageView[];
  currentId: string | null;
  completedIds: string[];
  footer: string;
}

function formatVulnSummary(vulns: Record<string, number>): string {
  const order = ['critical', 'high', 'medium', 'low', 'info'];
  return order
    .filter((k) => (vulns[k] ?? 0) > 0)
    .map((k) => `${vulns[k]} ${k}`)
    .join(', ');
}

/**
 * Map backend status → audit-stage view model.
 *
 * Backend sets `state.phase = AUDITING_STATIC` only when the static
 * analysis node returns, and `AUDITING_LLM` only when the LLM node
 * returns — so during the actual work the checkpoint reports the
 * previous phase. We drive cosmetic sub-steps off `elapsedSeconds`
 * since the audit card mounted; backend phase is used for major
 * transitions (`audit_fixing`, `audit_ok`).
 *
 * Cosmetic timeline (calibrated on warm builder):
 *   0–4s    → Preparing audit
 *   4–50s   → Running clippy lints
 *   50–80s  → Running cargo audit (CVE scan)
 *   80–95s  → Submitting code to AI
 *   95–115s → AI reasoning over code
 *   115s+   → Generating findings report
 */
export function deriveAuditStages(
  status: ContractStatus | null,
  elapsedSeconds: number = 0,
): DerivedAuditStages {
  const phase = status?.phase ?? null;
  const auditOk = status?.audit_ok ?? false;
  const attempt = status?.audit_attempt ?? 0;
  const vulns = status?.vulns_by_severity ?? {};
  const lastFix = status?.last_fix_description ?? null;
  const lastFixSource = status?.last_fix_source ?? null;
  const fixesCount = status?.fixes_applied_count ?? 0;

  const vulnSummary = formatVulnSummary(vulns);
  const vulnTotal = Object.values(vulns).reduce(
    (a, b) => a + (b ?? 0),
    0,
  );

  let fixBadge: string | undefined;
  if (lastFixSource === 'knowledge_base') fixBadge = 'KB';
  else if (lastFixSource === 'llm_generated') fixBadge = 'AI';

  const preparing: StageView = {
    id: 'preparing',
    title: 'Preparing audit',
    subtitle: 'Loading compiled binary and security rule set',
    icon: Hourglass,
  };

  const clippy: StageView = {
    id: 'clippy',
    title: 'Running clippy lints',
    subtitle: 'Detecting Rust anti-patterns and best-practice violations',
    icon: ScanLine,
  };

  const cargoAudit: StageView = {
    id: 'cargo-audit',
    title: 'Running cargo audit (CVE scan)',
    subtitle: 'Cross-checking dependencies against the RustSec advisory DB',
    icon: Search,
  };

  const llmSubmitting: StageView = {
    id: 'llm-submitting',
    title: 'Submitting to AI reviewer',
    subtitle: 'Packaging code and intent into the security review prompt',
    icon: Brain,
  };

  const llmReasoning: StageView = {
    id: 'llm-reasoning',
    title: 'AI reasoning over code',
    subtitle: vulnSummary
      ? `Detected so far: ${vulnSummary}`
      : 'Inspecting account validation, math, and authority checks',
    icon: Shield,
  };

  const llmReporting: StageView = {
    id: 'llm-reporting',
    title: 'Generating findings report',
    subtitle: 'Ranking vulnerabilities by severity and writing remediation hints',
    icon: FileSearch,
  };

  const patching: StageView = {
    id: 'patching',
    title:
      vulnTotal > 0
        ? `Patching vulnerabilities — ${vulnTotal} found`
        : 'Patching vulnerabilities',
    subtitle: lastFix
      ? `Latest fix: ${lastFix}`
      : 'Applying suggested remediations',
    icon: Zap,
    badge: fixBadge,
  };

  const reaudit: StageView = {
    id: 'reaudit',
    title: `Re-auditing — pass ${attempt}`,
    subtitle: 'Verifying fixes did not introduce new findings',
    icon: RefreshCw,
  };

  const passes: StageView = {
    id: 'audit-passes',
    title: 'Audit passes',
    subtitle: 'No unresolved security issues',
    icon: CheckCircle,
  };

  const showPatching = phase === 'audit_fixing' || vulnTotal > 0 || fixesCount > 0;
  const showReaudit =
    fixesCount > 0 && (phase === 'auditing_static' || phase === 'auditing_llm' || auditOk);
  const isFirstAudit = attempt <= 1 && fixesCount === 0;

  // Sub-step ids in cosmetic order (preparing → static tools → LLM stages).
  const auditSubSteps = [
    'preparing',
    'clippy',
    'cargo-audit',
    'llm-submitting',
    'llm-reasoning',
    'llm-reporting',
  ] as const;

  const stages: StageView[] = [];
  if (isFirstAudit || auditOk) {
    stages.push(preparing, clippy, cargoAudit, llmSubmitting, llmReasoning, llmReporting);
  } else {
    stages.push(preparing, clippy, cargoAudit, llmReasoning);
  }
  if (showPatching) stages.push(patching);
  if (showReaudit) stages.push(reaudit);
  stages.push(passes);

  let currentId: string | null;
  const completedIds: string[] = [];

  if (auditOk) {
    for (const s of stages) if (s.id !== 'audit-passes') completedIds.push(s.id);
    currentId = 'audit-passes';
  } else if (phase === 'audit_fixing') {
    for (const id of auditSubSteps) completedIds.push(id);
    currentId = 'patching';
  } else if (attempt > 1 && showReaudit) {
    for (const id of auditSubSteps) completedIds.push(id);
    if (showPatching && fixesCount > 0) completedIds.push('patching');
    currentId = 'reaudit';
  } else if (isFirstAudit) {
    // ── Mount-elapsed-driven progression through cosmetic audit sub-steps.
    //   0–4s    → preparing
    //   4–50s   → clippy
    //   50–80s  → cargo-audit
    //   80–95s  → llm-submitting
    //   95–115s → llm-reasoning
    //   115s+   → llm-reporting
    const idx = Math.min(
      auditSubSteps.length - 1,
      pickSubStepIndex(elapsedSeconds, [4, 50, 80, 95, 115]),
    );
    for (let i = 0; i < idx; i++) completedIds.push(auditSubSteps[i]);
    currentId = auditSubSteps[idx];
  } else {
    completedIds.push('preparing', 'clippy', 'cargo-audit');
    currentId = 'llm-reasoning';
  }

  let footer: string;
  if (auditOk) footer = 'Audit complete';
  else if (phase === 'audit_fixing')
    footer = `Patching vulnerabilities (pass ${attempt || 1})…`;
  else if (isFirstAudit) {
    if (elapsedSeconds > 115) footer = 'Generating findings report…';
    else if (elapsedSeconds > 95) footer = 'AI reasoning over code…';
    else if (elapsedSeconds > 80) footer = 'Submitting code to AI reviewer…';
    else if (elapsedSeconds > 50) footer = 'Cross-checking CVEs (cargo audit)…';
    else if (elapsedSeconds > 4) footer = 'Running clippy lints…';
    else footer = 'Preparing audit…';
  } else footer = 'Auditing…';

  return { stages, currentId, completedIds, footer };
}

interface AuditStagesProps {
  isAuditing: boolean;
  status: ContractStatus | null;
}

export const AuditStages = ({ isAuditing, status }: AuditStagesProps) => {
  const timerKey = status?.bumm_uid
    ? `audit:${status.bumm_uid}`
    : 'audit:demo';
  const { phaseElapsedSeconds: elapsedSeconds } = usePhaseTimer(
    isAuditing ? 'audit-active' : null,
    timerKey,
  );
  if (!isAuditing) return null;
  const { stages, currentId, completedIds, footer } = deriveAuditStages(
    status,
    elapsedSeconds,
  );
  return (
    <PipelineStagesCard
      headerLabel="Audit Smart Contract"
      stages={stages}
      currentId={currentId}
      completedIds={completedIds}
      footer={footer}
      timerKey={timerKey}
    />
  );
};
