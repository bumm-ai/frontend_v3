'use client';

import { useEffect, useState } from 'react';

import { apiClient } from '@/services/api';
import type { BuildQueueResponse } from '@/lib/api';

export interface QueueChipState {
  /** True only when the farm is saturated and at least one build is queued. */
  visible: boolean;
  /** Number of builds waiting ahead (the "#N in queue" figure). */
  queued: number;
  /** Coarse, prefixed ETA label ("~2m" / "~30s"), or "" when unknown. */
  etaLabel: string;
}

const HIDDEN: QueueChipState = { visible: false, queued: 0, etaLabel: '' };

/** Format a rough ETA. Coarse + "~"-prefixed to signal it's an estimate. */
export function formatQueueEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  return `~${Math.round(seconds / 60)}m`;
}

/**
 * Pure decision: should the queue chip show, and with what text?
 *
 * Renders nothing unless the farm is saturated AND something is queued, so a
 * null/empty/errored response (cosmetic feature) silently hides the chip.
 */
export function deriveQueueChip(resp: BuildQueueResponse | null): QueueChipState {
  if (!resp || !resp.saturated || resp.queued <= 0) return HIDDEN;
  return { visible: true, queued: resp.queued, etaLabel: formatQueueEta(resp.eta_seconds) };
}

/**
 * Poll the global build-farm queue while `active` (i.e. a build is in flight).
 *
 * Queue state is GLOBAL, not per-contract, so this lives in its own hook and
 * polls the public `/system/build-queue` endpoint rather than riding the
 * per-contract WS stream. Polling only runs while `active` and is torn down on
 * deactivation/unmount — zero idle traffic when nobody is building. Fetch
 * errors are swallowed (the chip just stays hidden).
 */
export function useBuildQueue(active: boolean): QueueChipState {
  const [resp, setResp] = useState<BuildQueueResponse | null>(null);

  useEffect(() => {
    if (!active) {
      setResp(null);
      return;
    }
    let cancelled = false;
    const tick = async () => {
      try {
        const q = await apiClient.getBuildQueue();
        if (!cancelled) setResp(q);
      } catch {
        /* cosmetic chip — never surface queue-poll errors to the user */
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [active]);

  return deriveQueueChip(resp);
}
