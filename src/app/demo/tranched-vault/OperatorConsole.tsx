'use client';

/**
 * Operator console as a slide-over drawer. The investor view stays a full,
 * uncluttered page; the operator opens this panel from the header button
 * (visible only when the connected wallet IS the vault authority — the
 * on-chain `has_one` gate mirrored in the UI). A light backdrop keeps the
 * capital stack visible behind the drawer, so waterfall / burn animations
 * still play on camera while the operator acts. Presentational only — all
 * on-chain wiring (wallet, tx building, refresh) stays in useVault/VaultDemo.
 */

import { useEffect, useState } from 'react';
import { fmt, parseTokens } from './format';
import { ONE_TOKEN } from './constants';
import { previewLossSplit, previewRevenueSplit, type VaultState } from './vaultTx';
import type { ActionKind } from './useVault';

const ZERO = BigInt(0);

interface OperatorConsoleProps {
  open: boolean;
  onClose: () => void;
  vault: VaultState | null;
  vaultLiquidity: bigint;
  pending: ActionKind | null;
  validate: (kind: ActionKind, raw: string) => string | null;
  onAct: (kind: ActionKind, tokens: bigint) => void;
  /** Last confirmed action, used to clear the matching input. */
  lastSuccess: { kind: ActionKind; at: number } | null;
  /** Global action error — mirrored here because the page copy of it sits
      behind the drawer's backdrop where a rejected action looks like
      "nothing happened". */
  error: string | null;
}

interface ActionSpec {
  kind: ActionKind;
  label: string;
  busy: string;
  color: string;
  /** Suggested amount, shown as a hint — inputs start empty. */
  placeholder: (vault: VaultState | null) => string;
  /** What this action means in the deal. */
  origin: string;
}

const EMERALD = 'bg-emerald-700 hover:bg-emerald-600';
const ACTIONS: ActionSpec[] = [
  {
    kind: 'draw', label: 'Draw capital', busy: 'Drawing…', color: EMERALD,
    placeholder: () => '900000',
    origin:
      'Capital released to the operator to acquire hardware, against the contracted revenue pledged to this vault. Capped at vault cash above unclaimed coupons — investor coupons are never the operator’s to take.',
  },
  {
    kind: 'revenue', label: 'Offtaker pays revenue', busy: 'Paying…',
    color: 'bg-sky-600 hover:bg-sky-500',
    placeholder: () => '100000',
    origin:
      'Monthly payment from the offtake counterparty — on devnet the offtaker faucet mints it straight into the vault, from outside the capital stack, never from the operator’s wallet. Allocated top-down: senior up to its coupon on surviving principal, junior takes the residual.',
  },
  {
    kind: 'loss', label: 'Record loss', busy: 'Recording…',
    color: 'bg-red-800 hover:bg-red-700',
    placeholder: () => '80000',
    origin:
      'Write-down absorbs bottom-up: junior’s unclaimed coupon is consumed first (excess spread), then junior principal burns, then senior. The operator’s repayment obligation shrinks by the written-down amount.',
  },
  {
    kind: 'repay', label: 'Repay capital', busy: 'Repaying…', color: EMERALD,
    placeholder: (v) => (v && v.capitalDrawn > ZERO ? fmt(v.capitalDrawn) : '820000'),
    origin:
      'Principal returned at maturity from asset sale or refinancing. The obligation already reflects any write-downs — repay exactly the outstanding amount and the vault closes to zero after claims and redemptions.',
  },
];

/** Live senior/junior split preview for the revenue and loss rows only. */
function SplitHint({
  kind,
  vault,
  raw,
}: {
  kind: ActionKind;
  vault: VaultState | null;
  raw: string;
}) {
  if (!vault || (kind !== 'revenue' && kind !== 'loss')) return null;
  const amount = parseTokens(raw);
  if (amount === null) return null;
  const units = amount * ONE_TOKEN;

  if (kind === 'revenue') {
    const { senior, junior } = previewRevenueSplit(vault, units);
    return (
      <p className="mt-1.5 text-[11px] text-neutral-500">
        → senior <span className="text-sky-400">{fmt(senior)}</span> · junior{' '}
        <span className="text-orange-400">{fmt(junior)}</span>
      </p>
    );
  }
  const { spread, junior, senior, exceedsAll } = previewLossSplit(vault, units);
  return (
    <p className="mt-1.5 text-[11px] text-neutral-500">
      {spread > ZERO && (
        <>
          → consumes <span className="text-orange-400">{fmt(spread)}</span> junior coupon{' '}
        </>
      )}
      → junior burns <span className="text-orange-400">{fmt(junior)}</span>
      {senior > ZERO && (
        <>
          {' '}
          · senior burns <span className="text-sky-400">{fmt(senior)}</span>
        </>
      )}
      {exceedsAll && <span className="text-red-400"> · exceeds the stack, will revert</span>}
    </p>
  );
}

function ActionRow({
  spec,
  vault,
  pending,
  clearToken,
  validate,
  onAct,
}: {
  spec: ActionSpec;
  vault: VaultState | null;
  pending: ActionKind | null;
  /** Changes when this action confirms on-chain; wipes the typed amount. */
  clearToken: number;
  validate: (kind: ActionKind, raw: string) => string | null;
  onAct: (kind: ActionKind, tokens: bigint) => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (clearToken > 0) setValue('');
  }, [clearToken]);
  const blocked = validate(spec.kind, value);

  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${spec.label} amount`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={spec.placeholder(vault)}
          inputMode="numeric"
          className="w-28 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-white/30 placeholder:text-neutral-600"
        />
        <button
          onClick={() => {
            const tokens = parseTokens(value);
            if (tokens !== null) onAct(spec.kind, tokens);
          }}
          disabled={pending !== null || blocked !== null || parseTokens(value) === null}
          className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${spec.color}`}
        >
          {pending === spec.kind ? spec.busy : spec.label}
        </button>
      </div>
      <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">{spec.origin}</p>
      {blocked !== null ? (
        <p className="mt-1.5 text-[11px] text-amber-400">{blocked}</p>
      ) : (
        <SplitHint kind={spec.kind} vault={vault} raw={value} />
      )}
    </div>
  );
}

export default function OperatorConsole({
  open,
  onClose,
  vault,
  vaultLiquidity,
  pending,
  validate,
  onAct,
  lastSuccess,
  error,
}: OperatorConsoleProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const clearTokenFor = (kind: ActionKind) =>
    lastSuccess !== null && lastSuccess.kind === kind ? lastSuccess.at : 0;
  const unclaimed = vault
    ? vault.seniorPaid - vault.seniorClaimed + (vault.juniorPaid - vault.juniorClaimed)
    : ZERO;

  return (
    <div
      aria-hidden={!open}
      className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`}
    >
      {/* Light backdrop: dim just enough to focus the drawer while the
          capital stack stays readable behind it for the camera. */}
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/25 transition-opacity duration-300 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />
      <aside
        role="dialog"
        aria-label="Operator console"
        className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0b0b13] shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2 border-b border-white/[0.07] px-5 py-4">
          <h2 className="text-sm font-semibold text-neutral-100">⚙ Operator console</h2>
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-medium text-emerald-400">
            you are the vault authority
          </span>
          <button
            onClick={onClose}
            aria-label="Close operator console"
            className="ml-auto rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {error && (
            <p className="break-words rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-relaxed text-red-300">
              {error}
            </p>
          )}
          <p className="text-[11px] leading-relaxed text-neutral-500">
            vault liquidity <b className="font-mono text-neutral-300">{fmt(vaultLiquidity)}</b>
            {vault && vault.capitalDrawn > ZERO && (
              <>
                {' · '}capital outstanding{' '}
                <b className="font-mono text-neutral-300">{fmt(vault.capitalDrawn)}</b>
              </>
            )}
            {unclaimed > ZERO && (
              <>
                {' · '}unclaimed coupons{' '}
                <b className="font-mono text-neutral-300">{fmt(unclaimed)}</b>
              </>
            )}
          </p>

          {ACTIONS.map((spec) => (
            <ActionRow
              key={spec.kind}
              spec={spec}
              vault={vault}
              pending={pending}
              clearToken={clearTokenFor(spec.kind)}
              validate={validate}
              onAct={onAct}
            />
          ))}
        </div>
      </aside>
    </div>
  );
}
