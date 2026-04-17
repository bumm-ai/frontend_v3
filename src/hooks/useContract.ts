'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/api';
import { wsHub } from '@/services/wsHub';
import type {
  ContractStatus,
  ContractCode,
  ContractAudit,
  ContractCreated,
  Network,
  Phase,
  ChatMessagePayload,
} from '@/lib/api';
import type { ActionButtonState } from '@/types/dashboard';
import { deriveAnimationStage, useContractStream } from './useContractStream';

const TERMINAL: Phase[] = ['done', 'failed'];

// ── Pure derivation ───────────────────────────────────────────────────────────

/** Which stage animation is currently active in the preview panel. */
export type AnimationStage = 'generating' | 'building' | 'auditing' | 'deploying' | null;

/**
 * Derive button state and animation stage from raw backend ContractStatus.
 *
 * Rules:
 *  1. build_ok / audit_ok / program_id take priority over raw `phase`.
 *     Stale WS heartbeats (e.g. phase='building' after build_ok=true) can
 *     NEVER re-arm a finished animation.
 *  2. The "generating" animation fires purely from backend signals:
 *     phase ∈ {enriching, generating} AND next_step === null. Once the
 *     pipeline parks at the build interrupt, next_step becomes 'build' and
 *     the animation stops — even across reloads and project switches.
 *  3. Optimistic `pendingStep` override fires FIRST to close the gap between
 *     button click and the confirming heartbeat (prevents double-clicks).
 */
export function deriveUIFromStatus(
  status: ContractStatus | null,
  hasCode: boolean,
  pendingStep?: 'build' | 'audit' | 'deploy' | null,
): { buttonState: ActionButtonState; animationStage: AnimationStage } {
  if (pendingStep === 'build'  && !status?.build_ok)  return { buttonState: 'building',   animationStage: 'building'   };
  if (pendingStep === 'audit'  && !status?.audit_ok)  return { buttonState: 'auditing',   animationStage: 'auditing'   };
  if (pendingStep === 'deploy' && !status?.program_id) return { buttonState: 'publishing', animationStage: 'deploying'  };

  if (!status) {
    return { buttonState: hasCode ? 'build' : 'inactive', animationStage: null };
  }

  const animationStage = deriveAnimationStage(status);

  if (animationStage === 'generating' || animationStage === 'building') {
    return { buttonState: 'building', animationStage };
  }
  if (animationStage === 'auditing') {
    return { buttonState: 'auditing', animationStage };
  }
  if (animationStage === 'deploying') {
    return { buttonState: 'publishing', animationStage };
  }

  const { build_ok, audit_ok, program_id } = status;
  if (program_id) return { buttonState: 'upgrade',  animationStage: null };
  if (audit_ok)   return { buttonState: 'publish',  animationStage: null };
  if (build_ok)   return { buttonState: 'audit',    animationStage: null };
  if (hasCode)    return { buttonState: 'build',    animationStage: null };
  return           { buttonState: 'inactive', animationStage: null };
}

// ── hook ──────────────────────────────────────────────────────────────────────

/**
 * useContract — single-contract facade.
 *
 * WebSocket lifecycle is delegated to wsHub (ref-counted shared connections,
 * auto-reconnect with backoff, fresh JWT on every reconnect). This hook owns
 * only the lazy code/audit getters and create mutations.
 */
export function useContract(uid: string | null) {
  // Status is sourced from useContractStream: single shared subscription via
  // wsHub (ref-counted), REST seed on uid change, and an in-memory cache so
  // project switches render immediately without a WS round-trip.
  const { status } = useContractStream(uid);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const [code, setCode]   = useState<ContractCode | null>(null);
  const [audit, setAudit] = useState<ContractAudit | null>(null);

  // Reset fetched artifacts when uid changes.
  useEffect(() => {
    setCode(null);
    setAudit(null);
    setError(null);
  }, [uid]);

  const createContract = useCallback(
    async (
      prompt: string,
      network: Network = 'devnet',
      opts?: { name?: string; chat_history?: ChatMessagePayload[] },
    ): Promise<ContractCreated> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiClient.createContract({
          prompt,
          network,
          name: opts?.name,
          chat_history: opts?.chat_history,
          step_mode: true,
        });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create contract';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const createPasteContract = useCallback(
    async (
      code: string,
      network: Network = 'devnet',
      opts?: { name?: string },
    ): Promise<ContractCreated> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiClient.createContract({
          code,
          network,
          name: opts?.name,
          step_mode: true,
        });
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to create contract';
        setError(msg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const getCode = useCallback(async (): Promise<ContractCode> => {
    if (!uid) throw new Error('No contract uid');
    if (code) return code;
    const result = await apiClient.getContractCode(uid);
    setCode(result);
    return result;
  }, [uid, code]);

  const getAudit = useCallback(async (): Promise<ContractAudit> => {
    if (!uid) throw new Error('No contract uid');
    if (audit) return audit;
    const result = await apiClient.getContractAudit(uid);
    setAudit(result);
    return result;
  }, [uid, audit]);

  return {
    status,
    isLoading,
    error,
    code,
    audit,
    createContract,
    createPasteContract,
    getCode,
    getAudit,
  };
}

/**
 * useMultiContract — streams N concurrent contracts (one per tracked project).
 *
 * Subscribes via wsHub per uid. When a contract hits a terminal phase, its
 * subscription is dropped so we don't keep the connection alive needlessly.
 * Reference counting in wsHub means if another hook also listens to the same
 * contract:uid channel, the underlying WS stays open for them.
 */
export function useMultiContract(
  trackedUids: Record<string, string>,
  onStatusChange: (projectId: string, status: ContractStatus) => void,
) {
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    const unsubs = new Map<string, () => void>();

    for (const [projectId, contractUid] of Object.entries(trackedUids)) {
      const unsub = wsHub.subscribe(
        `contract:${contractUid}`,
        (data) => {
          if (!data || typeof data !== 'object') return;
          const msg = data as ContractStatus;
          if (!('phase' in msg)) return;
          callbackRef.current(projectId, msg);
          if (TERMINAL.includes(msg.phase)) {
            const u = unsubs.get(projectId);
            if (u) {
              u();
              unsubs.delete(projectId);
            }
          }
        },
        () => getAccessToken() ?? '',
      );
      unsubs.set(projectId, unsub);
    }

    return () => {
      for (const u of unsubs.values()) u();
      unsubs.clear();
    };
  }, [trackedUids]);
}
