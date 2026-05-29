/**
 * Unit tests for the wallet-disconnected banner logic.
 *
 * Mirrors the project's hook-test convention (pure-function tests, no jsdom /
 * renderHook): the show/hide decision is extracted into the pure
 * deriveWalletBanner(), which we exercise directly. The useWallet() wiring inside
 * useWalletBanner is the thin wrapper around this logic.
 *
 * Run: npx vitest run src/hooks/__tests__/useWalletBanner.test.ts
 */

import { describe, it, expect } from 'vitest';
import { deriveWalletBanner } from '@/hooks/useWalletBanner';

const args = (over: Partial<Parameters<typeof deriveWalletBanner>[0]>) => ({
  isAuthenticated: true,
  walletConnected: false,
  walletConnecting: false,
  ...over,
});

describe('deriveWalletBanner', () => {
  it('shows when authenticated but wallet is disconnected and idle', () => {
    expect(deriveWalletBanner(args({})).visible).toBe(true);
  });

  it('hides when not authenticated (login screen handles that case)', () => {
    expect(deriveWalletBanner(args({ isAuthenticated: false })).visible).toBe(false);
  });

  it('hides when the wallet is connected', () => {
    expect(deriveWalletBanner(args({ walletConnected: true })).visible).toBe(false);
  });

  it('hides while the wallet is (re)connecting — prevents a flash on page load', () => {
    expect(deriveWalletBanner(args({ walletConnecting: true })).visible).toBe(false);
  });

  it('stays hidden when connecting even if not yet connected', () => {
    expect(
      deriveWalletBanner(args({ walletConnected: false, walletConnecting: true })).visible,
    ).toBe(false);
  });

  it('hides for an unauthenticated, disconnected visitor', () => {
    expect(
      deriveWalletBanner(args({ isAuthenticated: false, walletConnected: false })).visible,
    ).toBe(false);
  });
});
