'use client';

import { useState, useCallback } from 'react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';

// Treasury wallet — override via NEXT_PUBLIC_TREASURY_WALLET
const TREASURY = process.env.NEXT_PUBLIC_TREASURY_WALLET ?? '11111111111111111111111111111111';

const PACKAGES = [
  { sol: 0.1, credits: 100,  label: 'Starter'    },
  { sol: 0.5, credits: 600,  label: 'Pro'         },
  { sol: 1.0, credits: 1500, label: 'Power'       },
];

export default function CreditsPage() {
  const { isAuthenticated } = useAuth();
  const { credits: balance, isLoading, error, refetch, purchase } = useCredits();
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [buying, setBuying] = useState(false);
  const [buyError, setBuyError] = useState<string | null>(null);
  const [buySuccess, setBuySuccess] = useState<string | null>(null);

  const handlePurchase = useCallback(async (solAmount: number) => {
    if (!publicKey || !signTransaction || !connected) {
      setBuyError('Wallet not connected');
      return;
    }

    setBuying(true);
    setBuyError(null);
    setBuySuccess(null);

    try {
      const treasury = new PublicKey(TREASURY);
      const lamports = Math.round(solAmount * LAMPORTS_PER_SOL);

      // 1. Build and sign the SOL transfer
      const tx = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: treasury, lamports }),
      );
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signed  = await signTransaction(tx);
      const rawTx   = signed.serialize();
      const txHash  = await connection.sendRawTransaction(rawTx);
      await connection.confirmTransaction(txHash, 'confirmed');

      // Encode signature as base58
      const sigBytes = signed.signatures[0].signature;
      if (!sigBytes) throw new Error('No signature bytes');
      const signature = bs58.encode(sigBytes);

      // 2. Submit signature to backend
      const result = await purchase(signature);
      setBuySuccess(`+${result.credits_added} credits added! New balance: ${result.new_balance}`);
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      setBuying(false);
    }
  }, [publicKey, signTransaction, connected, connection, purchase]);

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <p className="text-gray-400">Connect your wallet to view credits.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto space-y-8">
        {/* Balance */}
        <section>
          <h1 className="text-3xl font-bold mb-1">Credits</h1>
          <div className="flex items-end gap-2 mt-4">
            <span className="text-5xl font-mono font-bold">
              {balance ?? '—'}
            </span>
            <span className="text-gray-500 mb-1">credits</span>
            <button
              onClick={refetch}
              disabled={isLoading}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300 transition"
            >
              ↻ refresh
            </button>
          </div>
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </section>

        {/* Packages */}
        <section>
          <h2 className="text-lg font-semibold mb-4 text-gray-300">Purchase credits</h2>
          <div className="grid grid-cols-3 gap-4">
            {PACKAGES.map((pkg) => (
              <div
                key={pkg.label}
                className="rounded-xl border border-gray-700 bg-gray-900 p-5 flex flex-col gap-3"
              >
                <span className="text-xs font-medium text-violet-400 uppercase tracking-wide">
                  {pkg.label}
                </span>
                <div>
                  <p className="text-2xl font-bold">{pkg.credits}</p>
                  <p className="text-xs text-gray-500">credits</p>
                </div>
                <p className="text-sm text-gray-400">{pkg.sol} SOL</p>
                <button
                  onClick={() => handlePurchase(pkg.sol)}
                  disabled={buying || !connected}
                  className="mt-auto py-2 rounded-lg bg-violet-600 hover:bg-violet-500
                             disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition"
                >
                  {buying ? 'Processing…' : 'Buy'}
                </button>
              </div>
            ))}
          </div>
          {buyError   && <p className="mt-3 text-red-400 text-sm">{buyError}</p>}
          {buySuccess && <p className="mt-3 text-green-400 text-sm">{buySuccess}</p>}
        </section>

        <p className="text-xs text-gray-600">
          Each pipeline run costs 10 credits. SOL sent to the treasury wallet is verified
          on-chain before credits are added.
        </p>
      </div>
    </main>
  );
}
