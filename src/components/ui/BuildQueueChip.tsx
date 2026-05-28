'use client';

import type { QueueChipState } from '@/hooks/useBuildQueue';

interface BuildQueueChipProps {
  state: QueueChipState;
  className?: string;
}

/**
 * Build-queue position chip — "#N in queue · ETA ~Xm".
 *
 * Shown only while the build farm is saturated (state.visible), so users waiting
 * during congestion see their position instead of an unexplained stall. Pure
 * presentational; renders nothing when not visible.
 */
export const BuildQueueChip = ({ state, className = '' }: BuildQueueChipProps) => {
  if (!state.visible) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] text-amber-300/90 ${className}`}
      title="The build farm is busy — your build is queued"
      aria-live="polite"
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
      <span className="font-medium tabular-nums">#{state.queued} in queue</span>
      {state.etaLabel && <span className="text-amber-300/60">· ETA {state.etaLabel}</span>}
    </div>
  );
};
