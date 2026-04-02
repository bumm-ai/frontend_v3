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

const TERMINAL: Phase[] = ['done', 'failed'];
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

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
    getCode,
    getAudit,
  };
}
