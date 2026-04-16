/**
 * balanceBus — singleton event emitter for live credit balance updates.
 *
 * Usage:
 *   balanceBus.subscribe((n) => setBalance(n))
 *   balanceBus.emit(newBalance)
 *
 * Why: avoids prop-drilling; useCredits subscribes once; any mutation
 * (build/audit/chat response) calls emit() to update globally.
 */

type BalanceListener = (balance: number) => void;

class BalanceBus {
  private listeners = new Set<BalanceListener>();

  subscribe(fn: BalanceListener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(balance: number): void {
    this.listeners.forEach((fn) => fn(balance));
  }
}

export const balanceBus = new BalanceBus();
