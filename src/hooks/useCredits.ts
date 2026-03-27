'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiClient } from '@/services/api';
import type { BalanceResponse, PurchaseResponse } from '@/lib/api';

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

  // ── load on wallet connect (only if authenticated) ───────────────────────────
  useEffect(() => {
    if (connected) refetch().catch(() => {});
  }, [connected, refetch]);

  // ── legacy compat: old components accessed balance.balance ────────────────
  // `balance` is exported as a legacy CreditBalance-shaped object for old components.
  // `credits` is the raw number for new components.
  const balanceObj = {
    balance:        balance ?? 0,
    totalPurchased: 0,
    totalSpent:     0,
    updatedAt:      new Date().toISOString(),
  };

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
    hasEnoughCredits: (_op: string) => (balance ?? 0) > 0,
    // Legacy stubs — rates/pricing no longer exist in backend_v3
    rates:    { SOL: 100, USDC: 1.0, CREDIT: 0.01 },
    pricing:  { generate: 10, audit: 5, build: 5, deploy: 5, chat: 0, upgrade: 10 },
    getOperationCost: (_op: string) => 10,
    calculateCreditsForTokens: async (_amount: number, _type: string) => ({
      creditsAmount: 0, usdAmount: 0, rates: { SOL: 100, USDC: 1.0, CREDIT: 0.01 },
    }),
    loadRates:   async () => {},
    loadPricing: async () => {},
    spendCredits: async (_op: string) => true,
  };
}
