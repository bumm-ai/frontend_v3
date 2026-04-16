/**
 * useContractStream — single source of truth for a contract's runtime state.
 *
 * Responsibilities:
 *   1. Subscribe to `contract:{uid}` via wsHub (shared, ref-counted connection).
 *   2. Seed state from an in-memory cache so project switches render the last
 *      known status instantly (no blank UI waiting for the first WS tick).
 *   3. Fetch authoritative initial status via REST on uid change so reloads do
 *      not depend on a WS heartbeat arriving.
 *   4. Derive animation stage purely from backend fields (phase + next_step +
 *      ok flags) — no client-side "isGenerationActive" flag needed.
 *
 * The derivation rule for `generating` uses `next_step === null` as the signal
 * that the pipeline is actively running (not paused at an interrupt). That
 * removes the entire class of bugs where a stale session flag prevented the
 * animation from coming back on reload / project switch.
 */
'use client';

import { useEffect, useState } from 'react';
import { wsHub } from '@/services/wsHub';
import { apiClient, getAccessToken } from '@/services/api';
import type { ContractStatus } from '@/lib/api';

export type AnimationStage =
  | 'generating'
  | 'building'
  | 'auditing'
  | 'deploying'
  | null;

export interface ContractStream {
  status: ContractStatus | null;
  isGenerating: boolean;
  isBuilding: boolean;
  isAuditing: boolean;
  isDeploying: boolean;
  animationStage: AnimationStage;
}

// Shared across every useContractStream call so any subscriber to a given uid
// renders immediately with the last known status — no null flicker when
// switching projects back-and-forth.
const statusCache = new Map<string, ContractStatus>();

/**
 * Derive the current animation stage from raw backend status.
 *
 * Rules (all backend-driven, no client session flags):
 *  - generating: phase is enriching/generating AND next_step is null AND no
 *                downstream progress. next_step=null means the pipeline is
 *                mid-run; when it parks at the build interrupt next_step
 *                becomes 'build' and the animation stops.
 *  - building:   build phase family AND build_ok=false. ok flag beats phase,
 *                so a stale heartbeat after build_ok=true never re-arms.
 *  - auditing:   audit phase family AND audit_ok=false.
 *  - deploying:  phase=deploying AND program_id is null.
 */
export function deriveAnimationStage(
  status: ContractStatus | null,
): AnimationStage {
  if (!status) return null;
  const { phase, build_ok, audit_ok, program_id, next_step } = status;

  if (
    (phase === 'enriching' || phase === 'generating') &&
    next_step === null &&
    !build_ok &&
    !audit_ok &&
    !program_id
  ) {
    return 'generating';
  }

  if (
    !build_ok &&
    (phase === 'building' || phase === 'build_fixing' || phase === 'learning')
  ) {
    return 'building';
  }

  if (
    !audit_ok &&
    (phase === 'auditing_static' ||
      phase === 'auditing_llm' ||
      phase === 'audit_fixing')
  ) {
    return 'auditing';
  }

  if (!program_id && phase === 'deploying') {
    return 'deploying';
  }

  return null;
}

export function useContractStream(uid: string | null): ContractStream {
  const [status, setStatus] = useState<ContractStatus | null>(
    uid ? (statusCache.get(uid) ?? null) : null,
  );

  useEffect(() => {
    if (!uid) {
      setStatus(null);
      return;
    }

    // Seed from cache for instant paint on project switch.
    setStatus(statusCache.get(uid) ?? null);

    // Authoritative initial state via REST. Handles reload / first mount.
    let cancelled = false;
    apiClient
      .getContractStatus(uid)
      .then((s) => {
        if (cancelled) return;
        statusCache.set(uid, s);
        setStatus(s);
      })
      .catch(() => {
        /* network/auth transient — WS will deliver status when it connects */
      });

    // Live updates via shared hub.
    // eslint-disable-next-line prefer-const
    let unsub: (() => void) | undefined;
    unsub = wsHub.subscribe(
      `contract:${uid}`,
      (data) => {
        if (!data || typeof data !== 'object') return;
        const msg = data as ContractStatus;
        if (!('phase' in msg)) return;
        statusCache.set(uid, msg);
        setStatus(msg);
        // Backend closes WS with code 1000 on terminal phases. Without this,
        // wsHub reconnects immediately and gets another ws_pipeline_complete →
        // infinite reconnect loop.
        if (msg.phase === 'done' || msg.phase === 'failed') {
          setTimeout(() => unsub?.(), 0);
        }
      },
      () => getAccessToken() ?? '',
    );

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [uid]);

  const stage = deriveAnimationStage(status);
  return {
    status,
    isGenerating: stage === 'generating',
    isBuilding: stage === 'building',
    isAuditing: stage === 'auditing',
    isDeploying: stage === 'deploying',
    animationStage: stage,
  };
}

/** Clear the shared cache for a uid (e.g. on project delete). */
export function invalidateContractStatus(uid: string): void {
  statusCache.delete(uid);
}

/** Test hook — read the cached status without subscribing. */
export function __peekContractStatus(uid: string): ContractStatus | null {
  return statusCache.get(uid) ?? null;
}
