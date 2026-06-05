/**
 * Pure message/decision helpers for the Dashboard contract-status transition
 * effect ([A]–[G]). Extracted VERBATIM from Dashboard so the bug-prone string
 * formatting and firing predicates are unit-testable in isolation. No React, no
 * side effects — every function maps inputs → string/boolean only.
 *
 * The orchestration (fetching data, calling setters, opening modals) stays in
 * useContractTransitions; this module only decides WHAT text/flag results.
 */
import type { ChatMessage } from '@/types/dashboard';
import type { ContractStatus, DeployEstimate } from '@/lib/api';
import { humanizeErrorCodes } from '@/lib/errorTranslate';

type Status = NonNullable<ContractStatus>;

/** [A] Label shown in the live pipeline bubble for the current phase. */
export function phaseStatusLabel(curr: Status): string {
  const phaseLabels: Record<string, string> = {
    pending: '⏳ Queued — waiting for worker...',
    enriching: '🔍 Analyzing your request...',
    generating: '⚡ Generating Solana smart contract...',
    generated: '📋 Code ready — click Build to compile.',
    building: '🔧 Building with Anchor framework...',
    build_fixing: (() => {
      const count = curr.build_errors_count ?? 0;
      const errorDesc = humanizeErrorCodes(curr.top_error_codes ?? []);
      const attempt = curr.build_attempt ?? 1;
      const base =
        count > 0
          ? `🔧 Auto-fixing ${count} error${count > 1 ? 's' : ''} (attempt ${attempt})…`
          : `🔧 Fixing build errors (attempt ${attempt})…`;
      return errorDesc ? `${base}\n${errorDesc}` : base;
    })(),
    auditing_static: '🔒 Running static security audit...',
    auditing_llm: '🔒 Running AI security review...',
    audit_fixing: '🔒 Fixing security issues...',
    deploying: '🚀 Deploying to devnet...',
    learning: '🧠 Updating knowledge base...',
    done: '✅ Contract deployed!',
    failed: `❌ Pipeline failed: ${curr.error ?? 'Unknown error'}`,
  };
  return phaseLabels[curr.phase] ?? `⚙️ ${curr.phase}...`;
}

/** [0] Whether a pending optimistic step should clear given the current status. */
export function shouldClearPendingStep(
  pending: 'build' | 'audit' | 'deploy' | null,
  curr: Status,
): boolean {
  if (
    pending === 'build' &&
    (curr.build_ok ||
      curr.phase === 'building' ||
      curr.phase === 'build_fixing' ||
      curr.phase === 'learning')
  ) {
    return true;
  }
  if (
    pending === 'audit' &&
    (curr.audit_ok ||
      curr.phase === 'auditing_static' ||
      curr.phase === 'auditing_llm' ||
      curr.phase === 'audit_fixing')
  ) {
    return true;
  }
  if (pending === 'deploy' && (!!curr.program_id || curr.phase === 'deploying')) {
    return true;
  }
  return (
    curr.phase === 'done' ||
    curr.phase === 'failed' ||
    curr.phase === 'cancelled' ||
    curr.phase === 'paused_degraded'
  );
}

/** [A2] Applied-fix progress line shown while build_fixing. */
export function appliedFixMessage(curr: Status): string {
  const source =
    curr.last_fix_source === 'knowledge_base'
      ? ' _(KB)_'
      : curr.last_fix_source === 'llm_generated'
        ? ' _(AI)_'
        : '';
  const errorDesc = humanizeErrorCodes(curr.top_error_codes ?? []);
  const desc = (curr.last_fix_description ?? '').replace(/^hard_rule:\s*/i, '').slice(0, 180);
  return `🔧 **Applied fix${source}:** ${desc}${errorDesc ? `\n_Errors: ${errorDesc}_` : ''}`;
}

/** [B] Drop transient pipeline-status bubbles (emoji-prefixed) from a chat snapshot. */
export function filterPipelineNoise(messages: ChatMessage[]): ChatMessage[] {
  return messages.filter(
    (m) =>
      !m.content.startsWith('⏳') &&
      !m.content.startsWith('⚙️') &&
      !m.content.startsWith('🔍') &&
      !m.content.startsWith('⚡') &&
      !m.content.startsWith('🔧') &&
      !m.content.startsWith('🔒') &&
      !m.content.startsWith('🚀') &&
      !m.content.startsWith('🧠'),
  );
}

/** [B] Derive an early project name from the first user message (or a uid fallback). */
export function deriveEarlyName(snapshot: ChatMessage[], uid: string): string {
  const firstUserMsg = snapshot.find((m) => m.isUser);
  return firstUserMsg
    ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
    : `Contract ${uid.slice(0, 8)}`;
}

export interface FixItem {
  fix_description?: string;
  error_pattern?: string;
  source?: string;
  was_successful?: boolean | null;
}

/** Keep only fixes that were not explicitly unsuccessful (shared by [C]/[D]). */
export function successfulFixes(fixes: FixItem[]): FixItem[] {
  return (fixes || []).filter((f) => f.was_successful !== false);
}

/** [C] Build-succeeded chat message (with or without an auto-fix breakdown). */
export function buildSuccessMessage(attempts: number, fixes: FixItem[]): string {
  const fixed = Math.max(0, attempts - 1);
  const ok = successfulFixes(fixes);
  if (ok.length > 0) {
    const kbCount = ok.filter((f) => f.source === 'knowledge_base').length;
    const llmCount = ok.length - kbCount;
    const lines = ok
      .slice(0, 8)
      .map((f, i) => {
        const pattern = (f.error_pattern || 'compile error').replace(/\n/g, ' ').slice(0, 80);
        const desc = (f.fix_description || '').replace(/\n/g, ' ').slice(0, 200);
        const tag = f.source === 'knowledge_base' ? '_(from KB)_' : '_(LLM)_';
        return `${i + 1}. \`${pattern}\` → ${desc} ${tag}`;
      })
      .join('\n');
    const sourceBreakdown =
      kbCount > 0 && llmCount > 0
        ? ` (${kbCount} from KB, ${llmCount} LLM-generated)`
        : kbCount > 0
          ? ' (all from KB)'
          : ' (all LLM-generated)';
    return (
      `**Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}.\n\n` +
      `**Auto-fixed ${ok.length} compile error${ok.length === 1 ? '' : 's'}**${sourceBreakdown}:\n\n` +
      `${lines}` +
      `${ok.length > 8 ? `\n\n_…and ${ok.length - 8} more._` : ''}\n\n` +
      `Contract compiles cleanly. Click **Audit** to run security checks.`
    );
  }
  return fixed > 0
    ? `**Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}. Auto-fixed ${fixed} compile error${fixed > 1 ? 's' : ''}.\n\nContract compiles cleanly. Click **Audit** to run security checks.`
    : `**Build succeeded on the first attempt** — contract compiles cleanly with no errors.\n\nClick **Audit** to run security checks.`;
}

export interface VulnItem {
  severity?: string;
  category?: string;
  title?: string;
  description?: string;
  suggested_fix?: string | null;
  code_location?: string | null;
  source?: string;
}

/** Deploy-cost preview line appended to the [D] audit summary (empty if no estimate). */
export function deployEstimateLine(deployEst: DeployEstimate | null): string {
  if (!deployEst) return '';
  return (
    `\n\n**Estimated deploy cost:** ~${deployEst.estimated_sol.toFixed(4)} SOL network fee` +
    ` (~${deployEst.estimated_credits} credit${deployEst.estimated_credits === 1 ? '' : 's'})` +
    ` on Solana ${deployEst.network}.` +
    (deployEst.sufficient === false
      ? ` _Balance is short by ${deployEst.missing_credits} credit${deployEst.missing_credits === 1 ? '' : 's'} — top up before publishing._`
      : '')
  );
}

/** [D] Audit-complete chat message (clean pass or grouped vulnerability breakdown). */
export function auditCompleteMessage(params: {
  vulns: VulnItem[];
  attempts: number;
  buildFixCount: number;
  deployEst: DeployEstimate | null;
}): string {
  const { vulns, attempts, buildFixCount, deployEst } = params;
  const deployLine = deployEstimateLine(deployEst);

  if (vulns.length === 0) {
    return (
      `**Audit passed on the first try** — no security issues found.\n\n` +
      `**Final state before deploy:**\n` +
      `- Static analysis: clippy + cargo audit passed\n` +
      `- AI security review: passed\n` +
      `${buildFixCount > 0 ? `- Build fixes applied earlier: ${buildFixCount}\n` : ''}` +
      `\nContract is ready to deploy.${deployLine}\n\nClick **Publish** to deploy to Solana devnet.`
    );
  }

  const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
  const SEV_LABELS: Record<string, string> = {
    critical: 'CRITICAL',
    high: 'HIGH',
    medium: 'MEDIUM',
    low: 'LOW',
    info: 'INFO',
  };
  const grouped: Record<string, VulnItem[]> = {};
  for (const v of vulns) {
    const sev = (v.severity || 'info').toLowerCase();
    if (!grouped[sev]) grouped[sev] = [];
    grouped[sev].push(v);
  }

  const sections: string[] = [];
  for (const sev of SEV_ORDER) {
    const items = grouped[sev];
    if (!items || items.length === 0) continue;
    const label = SEV_LABELS[sev] || sev.toUpperCase();
    const lines = items
      .slice(0, 5)
      .map((v, i) => {
        const title = (v.title || 'Finding').replace(/\n/g, ' ').slice(0, 120);
        const desc = (v.description || '').replace(/\n/g, ' ').slice(0, 220);
        const fix = v.suggested_fix
          ? `\n  ↳ **Fix applied:** ${v.suggested_fix.replace(/\n/g, ' ').slice(0, 220)}`
          : '';
        const loc = v.code_location ? ` _(at ${v.code_location})_` : '';
        return `${i + 1}. **${title}**${loc}\n  ${desc}${fix}`;
      })
      .join('\n\n');
    const more = items.length > 5 ? `\n\n_…and ${items.length - 5} more in this severity._` : '';
    sections.push(`**${label} (${items.length})**\n\n${lines}${more}`);
  }

  return (
    `**Audit complete** after ${attempts} pass${attempts > 1 ? 'es' : ''} — ` +
    `found and patched **${vulns.length}** issue${vulns.length === 1 ? '' : 's'}.\n\n` +
    `**Vulnerabilities found and fixed:**\n\n` +
    `${sections.join('\n\n')}\n\n` +
    `**Final state before deploy:**\n` +
    `${buildFixCount > 0 ? `- Compile-time fixes: **${buildFixCount}**\n` : ''}` +
    `- Security fixes: **${vulns.length}**\n` +
    `- Static analysis: clippy + cargo audit passed\n` +
    `- AI security review: passed\n\n` +
    `Contract is ready to deploy.${deployLine}\n\nClick **Publish** to deploy to Solana devnet.`
  );
}

/** [F] Pipeline-failed chat message. errorDesc is the humanized code summary (may be ''/null). */
export function buildFailedMessage(errorDesc: string | null, rawError: string): string {
  const userFacingError = errorDesc
    ? `${errorDesc}\n\n_Technical detail: ${rawError.slice(0, 200)}_`
    : rawError;
  return `**Build failed after all auto-repair attempts.**\n\n${userFacingError}\n\nYou can edit the prompt and try again, or paste corrected code.`;
}
