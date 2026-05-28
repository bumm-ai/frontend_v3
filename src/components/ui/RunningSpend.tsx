'use client';

interface RunningSpendProps {
  /** Cumulative LLM spend (USD) for this contract, from ContractStatus.cost_usd. */
  costUsd?: number | null;
  /** True while a pipeline phase is running — drives the live pulse dot. */
  active?: boolean;
  className?: string;
}

/**
 * Running-spend banner — shows cumulative USD spent on this contract so far.
 *
 * Backed by the backend `contracts.cost_usd` ledger surfaced on ContractStatus,
 * so it reflects real spend during multi-minute auto-fix/audit loops (the exact
 * moment users feel cost anxiety). Renders nothing until there is spend to show.
 */
export const RunningSpend = ({ costUsd, active = false, className = '' }: RunningSpendProps) => {
  if (costUsd == null || costUsd <= 0) return null;

  return (
    <div
      className={`flex items-center gap-1.5 text-[11px] ${className}`}
      title="Total spent on this contract so far"
      aria-live="polite"
    >
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          active ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'
        }`}
      />
      <span className="text-gray-400">Spent so far</span>
      <span className="text-gray-200 font-medium tabular-nums">${costUsd.toFixed(2)}</span>
    </div>
  );
};
