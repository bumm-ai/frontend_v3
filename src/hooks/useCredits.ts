'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiClient, getAccessToken } from '@/services/api';
import type { BalanceResponse, PurchaseResponse } from '@/lib/api';

/** Stable references — new object literals each render break useEffect deps in HeaderCreditsButton etc. */
const LEGACY_RATES = Object.freeze({ SOL: 100, USDC: 1.0, CREDIT: 0.01 });
const LEGACY_PRICING = Object.freeze({
  generate: 10, audit: 5, build: 5, deploy: 5, chat: 0, upgrade: 10,
});

export function useCredits() {
  const { connected } = useWallet();

  const [balance, setBalance]     = useState<number | null>(null);
  const [userUid, setUserUid]     = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  // ── fetch balance ─────────────────────────────────────────────────────────────
  const refetch = useCallback(async (): Promise<void> => {
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

  // ── load on wallet connect — only if JWT token exists ────────────────────────
  useEffect(() => {
    if (connected && getAccessToken()) refetch().catch(() => {});
  }, [connected, refetch]);

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

  const getOperationCost = useCallback((_op: string): number => {
    void _op;
    return 10;
  }, []);
  const hasEnoughCredits = useCallback(
    (_op: string) => (balance ?? 0) > 0,
    [balance],
  );

  const calculateCreditsForTokens = useCallback(
    async (_amount: number, _type: string) => ({
      creditsAmount: 0,
      usdAmount:       0,
      rates:           LEGACY_RATES,
    }),
    [],
  );

  return {
    // v3 — use these in new code
    credits: balance,
    userUid,
    isLoading,
    error,
    refetch,
    purchase,
    // legacy compat — old components use balance.balance
    balance: balanceObj,
    loadBalance: refetch,
    purchaseCredits: async (
      _amount: number,
      _type: string,
      _wallet: unknown,
    ): Promise<void> => { throw new Error('Use purchase(solTxSignature) instead'); },
    hasEnoughCredits,
    rates:    LEGACY_RATES,
    pricing:  LEGACY_PRICING,
    getOperationCost,
    calculateCreditsForTokens,
    loadRates:   async () => {},
    loadPricing: async () => {},
    spendCredits: async (_op: string) => true,
  };
}
