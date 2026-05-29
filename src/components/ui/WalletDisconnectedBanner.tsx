'use client';

import { useState } from 'react';

import type { WalletBannerState } from '@/hooks/useWalletBanner';
import { WalletModal } from './WalletModal';

interface WalletDisconnectedBannerProps {
  state: WalletBannerState;
  className?: string;
}

/**
 * Non-blocking "wallet disconnected" banner.
 *
 * Auth survives wallet disconnect (JWT-based), so a logged-in user may have no
 * connected wallet. This pinned banner warns them and offers a one-click
 * reconnect (reuses the existing WalletModal) before a signing action fails.
 * Purely presentational + a local modal toggle; renders nothing when not visible.
 */
export const WalletDisconnectedBanner = ({
  state,
  className = '',
}: WalletDisconnectedBannerProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  if (!state.visible) return null;

  return (
    <>
      <div
        className={`flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-[13px] text-amber-200 shadow-lg backdrop-blur ${className}`}
        role="status"
        aria-live="polite"
      >
        <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
        <span className="flex-1">
          Your wallet is disconnected. Reconnect to sign transactions and deploy.
        </span>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="shrink-0 rounded-md bg-amber-500/20 px-3 py-1 font-medium text-amber-100 transition-colors hover:bg-amber-500/30"
        >
          Reconnect
        </button>
      </div>
      <WalletModal isOpen={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
};
