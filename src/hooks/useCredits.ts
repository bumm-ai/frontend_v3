'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiClient, getAccessToken } from '@/services/api';
import type { BalanceResponse, PurchaseResponse, CreditRatesResponse, CreditsStreamEvent } from '@/lib/api';
import { wsHub } from '@/services/wsHub';
import { balanceBus } from '@/services/balanceBus';

// Minimum ms between balance HTTP fetches. WS balance_published events bypass
// this guard so realtime updates are never delayed. The 429 storm in prod logs
// (incident 2026-04-18) showed 30+ calls/min when 3 projects polled simultaneously.
const BALANCE_THROTTLE_MS = 15_000;
// Rates rarely change — refresh at most once per session page load (1 hour).
const RATES_THROTTLE_MS = 3_600_000;

// Default rates: 0.1 SOL = 2000 credits → 1 SOL = 20,000 credits
const DEFAULT_CREDITS_PER_SOL = 20_000;

export function useCredits() {
  const { connected } = useWallet();

  const [balance, setBalance]     = useState<number | null>(null);
  const [userUid, setUserUid]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [creditsPerSol, setCreditsPerSol] = useState(DEFAULT_CREDITS_PER_SOL);
  const [chatCreditCost, setChatCreditCost] = useState(1);

  const lastBalanceFetchRef = useRef<number>(0);
  const lastRatesFetchRef   = useRef<number>(0);

  // ── fetch balance (throttled) ─────────────────────────────────────────────────
  // `force=true` bypasses throttle — used when WS sends balance_published so the
  // UI stays in sync without hitting the rate-limit.
  const refetch = useCallback(async (force = false): Promise<void> => {
    const now = Date.now();
    if (!force && now - lastBalanceFetchRef.current < BALANCE_THROTTLE_MS) return;
    lastBalanceFetchRef.current = now;
    setIsLoading(true);
    setError(null);
    try {
      const res: BalanceResponse = await apiClient.getCreditsBalance();
      setBalance(res.credits);
      setUserUid(res.user_uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load balance');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── fetch rates (throttled — rates rarely change) ─────────────────────────────
  const loadRates = useCallback(async (): Promise<void> => {
    const now = Date.now();
    if (now - lastRatesFetchRef.current < RATES_THROTTLE_MS) return;
    lastRatesFetchRef.current = now;
    try {
      const rates = await apiClient.getCreditRates();
      setCreditsPerSol(rates.credits_per_sol);
      setChatCreditCost(rates.chat_credit_cost);
    } catch {
      // Use defaults
    }
  }, []);

  // ── purchase via on-chain tx ──────────────────────────────────────────────────
  const purchase = useCallback(async (solTxSignature: string): Promise<PurchaseResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.purchaseCredits(solTxSignature);
      setBalance(res.new_balance);
      return res;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Purchase failed';
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Subscribe to balance bus (mutations push new balance here) ────────────────
  useEffect(() => {
    return balanceBus.subscribe((n) => {
      setBalance(n);
    });
  }, []);

  // ── Subscribe to live credit updates via WebSocket ────────────────────────────
  // Pass getAccessToken as a factory so that after auth_refresh the reconnect
  // uses the fresh token automatically (wsHub calls factory on every connect).
  useEffect(() => {
    if (!connected) return;

    const unsub = wsHub.subscribe(
      'credits',
      (raw) => {
        const event = raw as CreditsStreamEvent;
        if (typeof event.balance === 'number') {
          // Backend pushed exact balance — use it directly (bypass throttle).
          setBalance(event.balance);
          lastBalanceFetchRef.current = Date.now();
        }
      },
      () => getAccessToken() ?? '',
    );

    return unsub;
  }, [connected]);

  // ── Initial load on wallet connect ───────────────────────────────────────────
  useEffect(() => {
    if (connected && getAccessToken()) {
      refetch().catch(() => {});
      loadRates().catch(() => {});
    }
  }, [connected, refetch, loadRates]);

  // ── legacy compat: old components accessed balance.balance ────────────────
  const balanceObj = useMemo(
    () => ({
      balance:        balance ?? 0,
      totalPurchased: 0,
      totalSpent:     0,
      updatedAt:      new Date().toISOString(),
    }),
    [balance],
  );

  // Rates derived from backend pricing
  const rates = useMemo(
    () => Object.freeze({
      SOL: creditsPerSol,    // credits per 1 SOL
      USDC: 1.0,             // not implemented
      CREDIT: 1 / creditsPerSol, // SOL per 1 credit
    }),
    [creditsPerSol],
  );

  const pricing = useMemo(
    () => Object.freeze({
      generate: 10, audit: 5, build: 5, deploy: 5,
      chat: chatCreditCost, upgrade: 10,
    }),
    [chatCreditCost],
  );

  const getOperationCost = useCallback((op: string): number => {
    return (pricing as Record<string, number>)[op] ?? 10;
  }, [pricing]);

  const hasEnoughCredits = useCallback(
    (_op: string) => (balance ?? 0) > 0,
    [balance],
  );

  return {
    // v3 — use these in new code
    credits: balance,
    userUid,
    isLoading,
    error,
    refetch,
    purchase,
    creditsPerSol,
    chatCreditCost,
    // legacy compat
    balance: balanceObj,
    loadBalance: refetch,
    purchaseCredits: async (
      _amount: number,
      _type: string,
      _wallet: unknown,
    ): Promise<void> => { throw new Error('Use purchase(solTxSignature) instead'); },
    hasEnoughCredits,
    rates,
    pricing,
    getOperationCost,
    calculateCreditsForTokens: async (_amount: number, _type: string) => ({
      creditsAmount: 0, usdAmount: 0, rates,
    }),
    loadRates,
    loadPricing: async () => {},
    spendCredits: async (_op: string) => true,
  };
}
