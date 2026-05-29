'use client';

import { useWallet } from '@solana/wallet-adapter-react';

export interface WalletBannerState {
  /** True when the user has an authenticated session but no connected wallet. */
  visible: boolean;
}

const HIDDEN: WalletBannerState = { visible: false };

/**
 * Pure decision: should the "wallet disconnected" banner show?
 *
 * Auth is JWT-based and deliberately survives wallet disconnect (see useAuth —
 * disconnecting the wallet does NOT log the user out). So an authenticated user
 * can end up with no connected wallet, at which point any wallet-signed action
 * (credits purchase, future on-chain ops) silently fails with a confusing error.
 * Show a non-blocking reconnect prompt in exactly that state.
 *
 * `walletConnecting` suppresses the banner during autoConnect on page load, so
 * returning users don't see a flash before the wallet reattaches.
 */
export function deriveWalletBanner(args: {
  isAuthenticated: boolean;
  walletConnected: boolean;
  walletConnecting: boolean;
}): WalletBannerState {
  const { isAuthenticated, walletConnected, walletConnecting } = args;
  if (!isAuthenticated || walletConnected || walletConnecting) return HIDDEN;
  return { visible: true };
}

/**
 * Surface the wallet-disconnected banner state for an authenticated session.
 *
 * Thin wrapper around the wallet-adapter connection flags + deriveWalletBanner.
 * The show/hide decision lives in the pure function above (unit-tested); this
 * hook only wires it to the live wallet state.
 */
export function useWalletBanner(isAuthenticated: boolean): WalletBannerState {
  const { connected, connecting } = useWallet();
  return deriveWalletBanner({
    isAuthenticated,
    walletConnected: connected,
    walletConnecting: connecting,
  });
}
