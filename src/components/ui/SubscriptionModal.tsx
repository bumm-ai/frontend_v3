'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Crown, Loader2, Zap } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { apiClient } from '@/services/api';
import type { SubscriptionPlan, SubscriptionStatus } from '@/lib/api';
import {
  sendSolTransfer,
  waitForFinalized,
  retryOnNotFinalized,
  LAMPORTS_PER_SOL,
} from '@/lib/solanaPay';

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Current subscription, if already loaded by the header button. */
  status: SubscriptionStatus | null;
  /** Called after a successful subscribe/renew so the header can refresh. */
  onSubscribed: (next: SubscriptionStatus) => void;
}

export function SubscriptionModal({ isOpen, onClose, status, onSubscribed }: SubscriptionModalProps) {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();

  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [treasury, setTreasury] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setLoadingPlans(true);
    setError(null);
    setDone(null);
    apiClient
      .getSubscriptionPlans()
      .then((res) => {
        if (cancelled) return;
        setPlans(res.plans);
        setTreasury(res.treasury_wallet);
        setEnabled(res.enabled);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Failed to load plans'))
      .finally(() => !cancelled && setLoadingPlans(false));
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    setError(null);
    setDone(null);
    if (!connected || !publicKey || !sendTransaction) {
      setError('Connect your wallet to subscribe.');
      return;
    }
    if (!enabled) {
      setError('Subscriptions are not currently available.');
      return;
    }
    if (!treasury) {
      setError('Payment wallet is not configured. Please try again later.');
      return;
    }
    setBusyPlan(plan.plan_id);
    try {
      // 1. Pay the plan price in SOL to the treasury, signed by the user.
      const signature = await sendSolTransfer(
        connection,
        publicKey,
        sendTransaction,
        treasury,
        plan.price_lamports,
        `bumm:v1|kind=subscription|plan=${plan.plan_id}|net=mainnet`,
      );
      // 2. Wait for finalization (backend verifies at finalized commitment).
      await waitForFinalized(connection, signature);
      // 3. Notify the backend to verify + activate the plan and grant credits.
      const res = await retryOnNotFinalized(() => apiClient.subscribe(plan.plan_id, signature));
      setDone(`${plan.label} active — ${res.credits_added.toLocaleString()} credits added.`);
      onSubscribed({ tier: res.plan_id, expires_at: res.expires_at, active: res.active });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subscription failed.');
    } finally {
      setBusyPlan(null);
    }
  };

  const activeTier = status?.active ? status.tier : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-2xl rounded-2xl border border-[#333] bg-[#141414] shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#333] px-5 py-4">
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-orange-400" />
                <h2 className="text-base font-semibold text-white">Subscription</h2>
                {activeTier && (
                  <span className="ml-2 rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium capitalize text-orange-300">
                    {activeTier} active
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                className="rounded p-1 text-gray-400 transition-colors hover:bg-[#333]"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4">
              <p className="mb-4 text-sm text-gray-400">
                Subscribe to top up credits every month at a discount. Each renewal is a single
                on-chain SOL payment — cancel anytime by simply not renewing.
                {status?.active && status.expires_at && (
                  <span className="mt-1 block text-xs text-gray-500">
                    Current period ends {new Date(status.expires_at).toLocaleDateString()}.
                  </span>
                )}
              </p>

              {loadingPlans ? (
                <div className="flex items-center justify-center py-10 text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {plans.map((plan) => {
                    const isActive = activeTier === plan.plan_id;
                    const busy = busyPlan === plan.plan_id;
                    const sol = plan.price_lamports / LAMPORTS_PER_SOL;
                    return (
                      <div
                        key={plan.plan_id}
                        className={`flex flex-col rounded-xl border p-4 ${
                          isActive ? 'border-orange-500/60 bg-orange-500/5' : 'border-[#333] bg-[#0d0d0d]'
                        }`}
                      >
                        <div className="mb-1 flex items-baseline justify-between">
                          <span className="text-sm font-semibold text-white">{plan.label}</span>
                          <span className="text-xs text-gray-500">${plan.price_usd}/mo</span>
                        </div>
                        <div className="mb-2 flex items-center gap-1.5">
                          <Zap className="h-4 w-4 text-yellow-400" />
                          <span className="text-lg font-bold text-yellow-400">
                            {plan.monthly_credits.toLocaleString()}
                          </span>
                          <span className="text-xs text-gray-400">credits / month</span>
                        </div>
                        <p className="mb-3 flex-1 text-xs text-gray-500">{plan.blurb}</p>
                        <div className="mb-3 text-xs text-gray-400">≈ {sol.toFixed(4)} SOL</div>
                        <button
                          onClick={() => handleSubscribe(plan)}
                          disabled={busy || busyPlan !== null || !connected}
                          className={`w-full rounded-lg py-2 text-xs font-medium transition-all ${
                            busy || busyPlan !== null || !connected
                              ? 'cursor-not-allowed bg-gray-700 text-gray-400'
                              : 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white hover:from-orange-600 hover:to-yellow-600'
                          }`}
                        >
                          {busy ? (
                            <span className="flex items-center justify-center gap-2">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                            </span>
                          ) : isActive ? (
                            'Renew / Extend'
                          ) : !connected ? (
                            'Connect wallet'
                          ) : (
                            `Subscribe`
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {done && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-300">
                  <Check className="h-4 w-4" /> {done}
                </div>
              )}
              {error && (
                <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
