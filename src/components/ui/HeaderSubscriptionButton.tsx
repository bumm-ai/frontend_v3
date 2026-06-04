'use client';

import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { apiClient } from '@/services/api';
import type { SubscriptionStatus } from '@/lib/api';
import { SubscriptionModal } from './SubscriptionModal';

/**
 * Header entry point for subscriptions — sits to the LEFT of the credits
 * button. Shows the active tier as a badge (or "Subscribe" when free) and opens
 * the plan modal. Status is fetched lazily once the wallet is connected; a 401
 * (not yet authenticated) is swallowed so the button still renders as free.
 */
export const HeaderSubscriptionButton = () => {
  const { connected } = useWallet();
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!connected) {
      setStatus(null);
      return;
    }
    let cancelled = false;
    apiClient
      .getSubscription()
      .then((s) => !cancelled && setStatus(s))
      .catch(() => {
        /* unauthenticated or transient — render as free */
      });
    return () => {
      cancelled = true;
    };
  }, [connected]);

  const active = status?.active ? status.tier : null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-all ${
          active
            ? 'border border-orange-500/40 bg-gradient-to-r from-orange-600/30 to-yellow-500/30 text-orange-300 hover:from-orange-600/50'
            : 'border border-[#333] bg-[#1a1a1a] text-gray-300 hover:bg-[#262626]'
        }`}
        title="Subscription plans"
      >
        <Crown className={`h-3.5 w-3.5 ${active ? 'text-orange-400' : 'text-gray-400'}`} />
        <span className="font-medium capitalize">{active ?? 'Subscribe'}</span>
      </button>

      <SubscriptionModal
        isOpen={open}
        onClose={() => setOpen(false)}
        status={status}
        onSubscribed={setStatus}
      />
    </>
  );
};
