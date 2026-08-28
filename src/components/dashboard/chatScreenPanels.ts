/**
 * Pure render-condition helpers for the build-log / fix-timeline panels that
 * ChatScreen wires in (F1). Kept side-effect-free so they can be unit-tested
 * without a DOM (vitest runs in the `node` environment).
 *
 * Invariant (CLAUDE.md): these helpers DO NOT map status → UI button/animation
 * state — that is `deriveUIFromStatus`'s sole job. They only read the already-
 * derived `animationStage` / fix-history results to decide panel visibility.
 */
import type { AnimationStage } from '@/hooks/useContract';

/**
 * Whether the live build-log stream should be active.
 *
 * `animationStage === 'building'` already folds in the building / build_fixing /
 * learning phases (see `deriveAnimationStage`), so we simply read that derived
 * result rather than re-inspecting raw phase. A uid is required because the SSE
 * endpoint is keyed by contract uid.
 */
export function shouldStreamBuildLogs(
  uid: string | undefined,
  animationStage: AnimationStage,
): boolean {
  return !!uid && animationStage === 'building';
}

/**
 * Whether the fix timeline panel should be shown.
 *
 * Shown when there is fix activity to surface: any applied-fix entries exist, or
 * the history request is in-flight / errored while a contract is selected. The
 * loader/error states are forwarded straight from `useFixDiff`, so callers pass
 * those through here to avoid flashing the panel when there is genuinely nothing
 * (no uid, no entries, not loading, no error).
 */
export function shouldShowFixTimeline(
  uid: string | undefined,
  entryCount: number,
  isLoading: boolean,
  error: string | null,
): boolean {
  if (!uid) return false;
  return entryCount > 0 || isLoading || !!error;
}
