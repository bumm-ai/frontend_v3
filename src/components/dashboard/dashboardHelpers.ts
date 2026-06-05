import type { Project } from '@/types/dashboard';

/** Per-tab scratch slot for "new chat" messages before a project UID exists. */
export const SCRATCH_UID = '__scratch__';

/**
 * Derive the action button label from backend contract state.
 * Pure function — no localStorage involved.
 */
export function phaseToAction(
  status: Project['status'],
  hasCode: boolean,
  isDeployed?: boolean,
): 'build' | 'audit' | 'publish' | 'upgrade' | 'inactive' {
  if (isDeployed || status === 'deployed') return 'upgrade';
  if (status === 'audited') return 'publish';
  if (status === 'built') return 'audit';
  if (hasCode || status === 'generated') return 'build';
  return 'inactive';
}

/** Map backend pipeline phase to frontend project status.
 *
 * For terminal phases (`failed`, `paused_degraded`) we don't drop the
 * project to "draft" — instead we surface the highest milestone the
 * contract actually reached, so a user whose deploy failed mid-flight
 * still sees "Audited" and can retry publish without losing context.
 */
export function mapPhaseToStatus(
  phase: string,
  programId?: string | null,
  buildOk?: boolean,
  auditOk?: boolean,
): Project['status'] {
  // Terminal hard-success: program is on-chain regardless of phase value.
  if (programId) return 'deployed';

  switch (phase) {
    case 'pending': case 'started': case 'enriching': return 'initializing';
    case 'generating': return 'in-progress';
    // 'generated' = paste-mode: code ready, awaiting build trigger
    case 'generated': case 'building': case 'build_fixing': return 'generated';
    case 'auditing_static': case 'auditing_llm': case 'audit_fixing': return 'built';
    case 'deploying': return 'audited';
    case 'done':
      return 'completed';
    case 'failed':
    case 'paused_degraded':
    case 'cancelled': {
      // Reflect the highest milestone the contract actually reached so the
      // user has correct context (e.g. "Audited" → can retry publish).
      if (auditOk) return 'audited';
      if (buildOk) return 'built';
      return 'draft';
    }
    default: return 'in-progress';
  }
}
