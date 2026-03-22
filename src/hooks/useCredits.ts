import { useState, useEffect, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { API_BASE_URL } from '@/config/api';

export interface CreditBalance {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
  updatedAt: string;
}

export interface CreditRates {
  SOL: number;
  USDC: number;
  CREDIT: number;
}

// Treasury wallet for receiving SOL payments — replace with real address
const TREASURY_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_TREASURY_WALLET || '11111111111111111111111111111111'
);

export const useCredits = () => {
  const { connected, publicKey, signTransaction } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<CreditBalance>({
    balance: 0, totalPurchased: 0, totalSpent: 0, updatedAt: new Date().toISOString()
  });
  const [rates, setRates] = useState<CreditRates>({ SOL: 100, USDC: 1.0, CREDIT: 0.01 });
  const [pricing, setPricing] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getUserId = useCallback((): string => {
    return localStorage.getItem('bumm_user_uid') || 'anonymous';
  }, []);

  const headers = useCallback(() => {
    return { 'Content-Type': 'application/json', 'x-user-id': getUserId() };
  }, [getUserId]);

  // ===== Load balance from backend (fallback to localStorage) =====
  const loadBalance = useCallback(async () => {
    if (!connected || !publicKey) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/credits/balance`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setBalance({
          balance: data.balance,
          totalPurchased: data.totalPurchased,
          totalSpent: data.totalSpent,
          updatedAt: data.updatedAt,
        });
      } else {
        // Fallback to localStorage for offline/demo
        const userId = getUserId();
        const local = localStorage.getItem(`credits_${userId}`);
        if (local) setBalance(JSON.parse(local));
        else setBalance({ balance: 1000, totalPurchased: 1000, totalSpent: 0, updatedAt: new Date().toISOString() });
      }
    } catch (err) {
      console.error('Failed to load balance:', err);
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, getUserId, headers]);

  // ===== Load rates from backend =====
  const loadRates = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/credits/rates`);
      if (res.ok) setRates(await res.json());
    } catch { /* use defaults */ }
  }, []);

  // ===== Load pricing from backend =====
  const loadPricing = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/credits/pricing`);
      if (res.ok) setPricing(await res.json());
      else setPricing({ generate: 100, audit: 50, build: 25, deploy: 75, chat: 0.1, upgrade: 150 });
    } catch {
      setPricing({ generate: 100, audit: 50, build: 25, deploy: 75, chat: 0.1, upgrade: 150 });
    }
  }, []);

  // ===== Purchase credits with real SOL transfer =====
  const purchaseCredits = useCallback(async (
    tokenAmount: number,
    tokenType: 'SOL' | 'USDC',
    wallet: { publicKey: PublicKey; signTransaction: (tx: Transaction) => Promise<Transaction> }
  ): Promise<void> => {
    if (!connected || !publicKey || !wallet.signTransaction) throw new Error('Wallet not connected');
    setIsLoading(true);
    setError(null);

    try {
      if (tokenType === 'SOL') {
        const lamports = Math.round(tokenAmount * LAMPORTS_PER_SOL);
        const transaction = new Transaction().add(
          SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: TREASURY_WALLET, lamports })
        );
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = publicKey;

        const signed = await wallet.signTransaction(transaction);
        const txHash = await connection.sendRawTransaction(signed.serialize());
        await connection.confirmTransaction(txHash, 'confirmed');

        // Record on backend
        await fetch(`${API_BASE_URL}/api/v1/credits/purchase`, {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ tokenAmount, tokenType: 'SOL', txHash }),
        });

        await loadBalance();
      } else {
        throw new Error('USDC purchases not yet supported. Use SOL.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Purchase failed');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, connection, headers, loadBalance]);

  // Backend deducts credits automatically — just refresh balance
  const spendCredits = useCallback(async (
    operationType: 'generate' | 'audit' | 'build' | 'deploy' | 'chat' | 'upgrade',
    _bummId?: string,
    _metadata?: Record<string, unknown>
  ): Promise<boolean> => {
    await loadBalance();
    return true;
  }, [loadBalance]);

  const getOperationCost = useCallback((op: string): number => pricing[op] || 0, [pricing]);

  const hasEnoughCredits = useCallback((op: string): boolean => {
    return balance.balance >= getOperationCost(op);
  }, [balance.balance, getOperationCost]);

  const calculateCreditsForTokens = useCallback(async (
    tokenAmount: number, tokenType: 'SOL' | 'USDC'
  ) => {
    const creditsAmount = tokenType === 'SOL' ? tokenAmount * rates.SOL : tokenAmount * rates.USDC;
    const usdAmount = tokenType === 'SOL' ? tokenAmount * 100 : tokenAmount;
    return { creditsAmount, usdAmount, rates };
  }, [rates]);

  // Load on wallet connect
  useEffect(() => {
    if (connected && publicKey) { loadBalance(); loadRates(); loadPricing(); }
  }, [connected, publicKey, loadBalance, loadRates, loadPricing]);

  return {
    balance, rates, pricing, isLoading, error,
    loadBalance, loadRates, loadPricing,
    purchaseCredits, spendCredits,
    getOperationCost, hasEnoughCredits, calculateCreditsForTokens,
  };
};
