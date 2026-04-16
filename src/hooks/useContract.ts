'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { ENDPOINTS } from '@/config/api';
import { apiClient } from '@/services/api';
import { getAccessToken } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import type {
  ContractStatus,
  ContractCode,
  ContractAudit,
  ContractCreated,
  Network,
  Phase,
} from '@/lib/api';
import type { ActionButtonState } from '@/types/dashboard';

const TERMINAL: Phase[] = ['done', 'failed'];
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

// ── Pure derivation ───────────────────────────────────────────────────────────

/** Which stage animation is currently active in the preview panel. */
export type AnimationStage = 'generating' | 'building' | 'auditing' | 'deploying' | null;

/**
 * Derive button state and animation stage from raw backend ContractStatus.
 *
 * Rules:
 *  1. build_ok / audit_ok / program_id take priority over raw `phase`.
 *     This means stale WS heartbeats (e.g. phase='building' after build_ok=true)
 *     can NEVER re-arm an animation that has already finished.
 *  2. While a step is actively running (phase matches AND ok flag is false),
 *     return the loader button state.
 *  3. When idle, derive button monotonically from ok flags.
 */
export function deriveUIFromStatus(
  status: ContractStatus | null,
  hasCode: boolean,
  pendingStep?: 'build' | 'audit' | 'deploy' | null,
  isGenerationActive?: boolean,
): { buttonState: ActionButtonState; animationStage: AnimationStage } {
  // Optimistic override: immediately show loader between button click and the
  // first WS heartbeat that confirms the phase changed. Prevents double-clicks.
  if (pendingStep === 'build'  && !status?.build_ok)  return { buttonState: 'building',   animationStage: 'building'   };
  if (pendingStep === 'audit'  && !status?.audit_ok)  return { buttonState: 'auditing',   animationStage: 'auditing'   };
  if (pendingStep === 'deploy' && !status?.program_id) return { buttonState: 'publishing', animationStage: 'deploying'  };

  if (!status) {
    return { buttonState: hasCode ? 'build' : 'inactive', animationStage: null };
  }

  const { phase, build_ok, audit_ok, program_id } = status;

  // Derive animation stage — only when the corresponding step is NOT yet complete
  let animationStage: AnimationStage = null;
  // Show "generating" animation ONLY if this frontend actually started the
  // generation in the current session. Prevents re-arming the animation when
  // the user switches projects or reloads the page while the backend phase is
  // still "enriching"/"generating" for an already-existing contract.
  if (
    isGenerationActive &&
    (phase === 'enriching' || phase === 'generating')
  ) {
    animationStage = 'generating';
  } else if (
    !build_ok &&
    (phase === 'building' || phase === 'build_fixing' || phase === 'learning')
  ) {
    animationStage = 'building';
  } else if (
    !audit_ok &&
    (phase === 'auditing_static' || phase === 'auditing_llm' || phase === 'audit_fixing')
  ) {
    animationStage = 'auditing';
  } else if (!program_id && phase === 'deploying') {
    animationStage = 'deploying';
  }

  // While running → loader button overrides idle state
  if (animationStage === 'generating' || animationStage === 'building') {
    return { buttonState: 'building', animationStage };
  }
  if (animationStage === 'auditing') {
    return { buttonState: 'auditing', animationStage };
  }
  if (animationStage === 'deploying') {
    return { buttonState: 'publishing', animationStage };
  }

  // Idle — monotonically forward from ok flags
  if (program_id) return { buttonState: 'upgrade',  animationStage: null };
  if (audit_ok)   return { buttonState: 'publish',   animationStage: null };
  if (build_ok)   return { buttonState: 'audit',     animationStage: null };
  if (hasCode)    return { buttonState: 'build',     animationStage: null };
  return           { buttonState: 'inactive',  animationStage: null };
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useContract(uid: string | null) {
  const [status, setStatus]     = useState<ContractStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const [code, setCode]   = useState<ContractCode | null>(null);
  const [audit, setAudit] = useState<ContractAudit | null>(null);

  const wsRef       = useRef<WebSocket | null>(null);
  const attemptRef  = useRef(0);
  const closedRef   = useRef(false);

  // ── Reset all fetched data when uid changes (new contract) ──────────────────
  useEffect(() => {
    setCode(null);
    setAudit(null);
    setStatus(null);
    setError(null);
  }, [uid]);

  // ── WebSocket lifecycle ──────────────────────────────────────────────────────
  const connectWs = useCallback((contractUid: string, attempt = 0) => {
    const token = getAccessToken();
    if (!token) return;

    closedRef.current = false;
    const url = `${ENDPOINTS.WS_CONTRACT(contractUid)}?token=${token}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data as string) as ContractStatus;
        setStatus(msg);
        setError(null);
        if (TERMINAL.includes(msg.phase)) {
          ws.close(1000);
        }
      } catch { /* ignore malformed frame */ }
    };

    ws.onerror = () => setError('WebSocket error');

    ws.onclose = (evt) => {
      if (closedRef.current) return; // explicit close
      if (evt.code === 1000) return; // normal close — done/failed

      if (evt.code === 4001) {
        // JWT expired — refresh and reconnect
        tryRefresh().then((ok) => {
          if (ok) connectWs(contractUid, attempt);
          else    setError('Session expired — please log in again');
        });
        return;
      }
      if (evt.code === 4003) { setError('Access denied');        return; }
      if (evt.code === 4004) { setError('Contract not found');   return; }

      const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
      setTimeout(() => connectWs(contractUid, attempt + 1), delay);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!uid) return;
    attemptRef.current = 0;
    connectWs(uid);

    return () => {
      closedRef.current = true;
      wsRef.current?.close(1000);
    };
  }, [uid, connectWs]);

  // ── createContract ────────────────────────────────────────────────────────────
  const createContract = useCallback(
    async (
      prompt: string,
      network: Network = 'devnet',
      opts?: { name?: string; chat_history?: Array<{ role: string; content: string }> },
    ): Promise<ContractCreated> => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await apiClient.createContract({
          prompt,
          network,
          name: opts?.name,
          chat_history: opts?.chat_history as any,
          // Frontend always uses step-mode: generate → user clicks Build →
          // user clicks Audit → user clicks Deploy.
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

  // ── createPasteContract ───────────────────────────────────────────────────────
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
          // Paste mode always uses step-mode (paused before build from the start)
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

  // ── lazy getters (called when phase === "done") ───────────────────────────────
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
 * Manages N concurrent WebSocket connections — one per actively tracked project.
 * Does NOT close a WS when the user switches projects; only closes on terminal
 * phase or when a uid is removed from trackedUids.
 */
export function useMultiContract(
  trackedUids: Record<string, string>,
  onStatusChange: (projectId: string, status: ContractStatus) => void,
) {
  const socketsRef = useRef<Map<string, WebSocket>>(new Map());
  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  useEffect(() => {
    const sockets = socketsRef.current;
    const trackedProjectIds = Object.keys(trackedUids);

    // Open new WS for newly tracked project IDs
    for (const projectId of trackedProjectIds) {
      if (sockets.has(projectId)) continue;
      const contractUid = trackedUids[projectId];

      const connect = (attempt = 0) => {
        const token = getAccessToken();
        if (!token) return;
        const ws = new WebSocket(`${ENDPOINTS.WS_CONTRACT(contractUid)}?token=${token}`);
        sockets.set(projectId, ws);

        ws.onmessage = (evt) => {
          try {
            const msg = JSON.parse(evt.data as string) as ContractStatus;
            callbackRef.current(projectId, msg);
            if (TERMINAL.includes(msg.phase)) {
              ws.close(1000);
              sockets.delete(projectId);
            }
          } catch { /* ignore malformed frame */ }
        };

        ws.onerror = () => { sockets.delete(projectId); };

        ws.onclose = (evt) => {
          if (evt.code === 1000) return;
          if (evt.code === 4001) {
            tryRefresh().then(ok => {
              if (ok) connect(attempt);
            });
            return;
          }
          if (evt.code === 4003 || evt.code === 4004) return;
          const delay = RECONNECT_DELAYS[Math.min(attempt, RECONNECT_DELAYS.length - 1)];
          setTimeout(() => connect(attempt + 1), delay);
        };
      };
      connect();
    }

    // Close WS for projects no longer tracked
    for (const [projectId, ws] of sockets.entries()) {
      if (!trackedUids[projectId]) {
        ws.close(1000);
        sockets.delete(projectId);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackedUids]);

  // Cleanup all sockets on unmount
  useEffect(() => {
    return () => {
      for (const ws of socketsRef.current.values()) ws.close(1000);
      socketsRef.current.clear();
    };
  }, []);
}
