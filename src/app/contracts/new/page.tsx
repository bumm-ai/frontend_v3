'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useContract } from '@/hooks/useContract';
import { useAuth } from '@/hooks/useAuth';
import type { Network } from '@/lib/api';

const NETWORKS: { value: Network; label: string }[] = [
  { value: 'devnet',       label: 'Devnet'       },
  { value: 'testnet',      label: 'Testnet'      },
  { value: 'mainnet-beta', label: 'Mainnet Beta' },
];

export default function NewContractPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { createContract, isLoading, error } = useContract(null);

  const [prompt,  setPrompt]  = useState('');
  const [network, setNetwork] = useState<Network>('devnet');

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Connect your wallet to continue</p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition"
          >
            Go to Home
          </button>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    try {
      const contract = await createContract(prompt.trim(), network);
      router.push(`/contracts/${contract.uid}`);
    } catch { /* error state shown below */ }
  }

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">New Smart Contract</h1>
        <p className="text-gray-400 mb-8">
          Describe your Solana program in plain English. Bumm AI generates, builds, audits
          and deploys it.
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Prompt */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Contract description
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={6}
              maxLength={10_000}
              placeholder="Create a simple token vesting contract that releases 1000 tokens per month to a beneficiary..."
              className="w-full rounded-lg bg-gray-900 border border-gray-700 focus:border-violet-500 focus:outline-none
                         p-4 text-white placeholder-gray-500 resize-none text-sm"
            />
            <div className="flex justify-between mt-1">
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <p className="text-gray-600 text-xs ml-auto">{prompt.length} / 10 000</p>
            </div>
          </div>

          {/* Network */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Network</label>
            <div className="flex gap-3">
              {NETWORKS.map((n) => (
                <button
                  key={n.value}
                  type="button"
                  onClick={() => setNetwork(n.value)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition
                    ${network === n.value
                      ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-500'}`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading || prompt.trim().length === 0}
            className="w-full py-3 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-50
                       disabled:cursor-not-allowed text-white font-semibold transition"
          >
            {isLoading ? 'Starting pipeline…' : 'Generate contract →'}
          </button>
        </form>
      </div>
    </main>
  );
}
