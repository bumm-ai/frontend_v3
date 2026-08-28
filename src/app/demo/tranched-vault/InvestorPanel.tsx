'use client';

/**
 * Investor-facing panel for the tranched-vault demo: two tranche "product"
 * cards to invest into, plus a position card (balances, faucet, coupon
 * claims, redemptions). Presentational only — every on-chain action is
 * delegated to `onAct`; this component owns no wallet/RPC logic.
 */

import { useEffect, useState } from 'react';
import { JUNIOR_SYMBOL, SENIOR_SYMBOL } from './constants';
import { fmt, parseTokens } from './format';
import type { ActionKind } from './useVault';
import { spreadConsumed, unclaimedCoupon, type VaultState } from './vaultTx';

const ZERO = BigInt(0);

const INPUT_CLASS =
  'w-28 rounded-lg border border-white/10 bg-black/40 px-2.5 py-2 font-mono text-sm outline-none focus:border-white/30 placeholder:text-neutral-600';

interface InvestorPanelProps {
  vault: VaultState | null;
  balances: { asset: bigint; senior: bigint; junior: bigint };
  supplies: { senior: bigint; junior: bigint };
  pending: ActionKind | null;
  /** Connected wallet owns this vault. */
  canAct: boolean;
  validate: (kind: ActionKind, raw: string) => string | null;
  onAct: (kind: ActionKind, tokens: bigint) => void;
  /** Last confirmed action, used to clear the matching input. */
  lastSuccess: { kind: ActionKind; at: number } | null;
  /** Peak principal each tranche put in — the base for return figures. */
  invested: { senior: bigint; junior: bigint };
}

/**
 * What a tranche actually made: coupon allocated, loss absorbed, net against
 * what it put in. This is the punchline of the whole product — junior earns a
 * higher rate precisely because it stands in front of the loss.
 */
function ReturnsRow({
  label,
  colorClass,
  invested,
  coupon,
  loss,
  consumed,
}: {
  label: string;
  colorClass: string;
  invested: bigint;
  coupon: bigint;
  loss: bigint;
  /** Coupon this tranche accrued but lost to write-downs (excess spread). */
  consumed?: bigint;
}) {
  // Percentages need the principal this tranche actually put in. When the page
  // opened after the position was already unwound there is no on-chain record
  // of it, so show the absolute figures and omit a rate we cannot stand behind.
  const known = invested > ZERO;
  const pct = (v: bigint) => (Number(v) / Number(invested)) * 100;
  const net = coupon - loss;
  const netAbs = net < ZERO ? -net : net;
  return (
    <div className="grid grid-cols-5 gap-2 border-t border-white/[0.07] py-2 text-xs">
      <span className={`font-semibold ${colorClass}`}>{label}</span>
      <span className="text-right font-mono text-neutral-300">
        {known ? fmt(invested) : '—'}
      </span>
      <span className="text-right font-mono text-emerald-400">
        +{fmt(coupon)}
        {known && (
          <span className="ml-1 font-sans text-[10px] text-neutral-500">
            {pct(coupon).toFixed(2)}%
          </span>
        )}
        {(consumed ?? ZERO) > ZERO && (
          <span className="block font-sans text-[10px] text-orange-400/90">
            −{fmt(consumed ?? ZERO)} consumed by loss
          </span>
        )}
      </span>
      <span className="text-right font-mono text-red-400">
        {loss > ZERO ? `−${fmt(loss)}` : '—'}
      </span>
      <span
        className={`text-right font-mono font-semibold ${
          net > ZERO ? 'text-emerald-400' : net < ZERO ? 'text-red-400' : 'text-neutral-400'
        }`}
      >
        {net >= ZERO ? '+' : '−'}
        {fmt(netAbs)}
        {known && (
          <span className="ml-1 font-sans text-[10px] text-neutral-500">
            {net >= ZERO ? '+' : ''}
            {pct(net).toFixed(2)}%
          </span>
        )}
      </span>
    </div>
  );
}

/** Amount input + action button, wired straight to props.validate / onAct. */
function AmountAction({
  kind,
  placeholder,
  clearToken,
  label,
  busyLabel,
  colorClass,
  pending,
  canAct,
  validate,
  onAct,
}: {
  kind: ActionKind;
  /** Suggested amount, shown as a hint — the input starts empty. */
  placeholder: string;
  /** Changes when this action confirms on-chain; wipes the typed amount. */
  clearToken: number;
  label: string;
  busyLabel: string;
  colorClass: string;
  pending: ActionKind | null;
  canAct: boolean;
  validate: (kind: ActionKind, raw: string) => string | null;
  onAct: (kind: ActionKind, tokens: bigint) => void;
}) {
  const [value, setValue] = useState('');
  useEffect(() => {
    if (clearToken > 0) setValue('');
  }, [clearToken]);
  const blocked = validate(kind, value);
  return (
    <div>
      <div className="flex items-center gap-2">
        <input
          aria-label={`${label} amount`}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          inputMode="numeric"
          className={INPUT_CLASS}
        />
        <button
          onClick={() => {
            const tokens = parseTokens(value);
            if (tokens !== null) onAct(kind, tokens);
          }}
          disabled={!canAct || pending !== null || blocked !== null || parseTokens(value) === null}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${colorClass}`}
        >
          {pending === kind ? busyLabel : label}
        </button>
      </div>
      {blocked !== null && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-400">{blocked}</p>
      )}
    </div>
  );
}

/**
 * One tranche's claimable-coupon row.
 *
 * The number shown is what actually survives on-chain: a write-down consumes
 * this tranche's unclaimed coupon FIRST (excess spread) and only then burns
 * principal, so after a loss the junior row can honestly read zero — the
 * coupon wasn't withheld, it absorbed the loss so principal didn't have to.
 */
function ClaimRow({
  label,
  coupon,
  loss,
  redeemable,
  consumed = ZERO,
  kind,
  pending,
  canAct,
  onAct,
}: {
  label: string;
  coupon: bigint;
  loss: bigint;
  redeemable: bigint;
  /** Coupon this tranche accrued but lost to write-downs (excess spread). */
  consumed?: bigint;
  kind: ActionKind;
  pending: ActionKind | null;
  canAct: boolean;
  onAct: (kind: ActionKind, tokens: bigint) => void;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
      <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-neutral-300">
        {label} coupon accrued, unpaid:{' '}
        <b className="font-mono text-neutral-100">{fmt(coupon)}</b> USDC
      </span>
      <button
        onClick={() => onAct(kind, BigInt(1))}
        disabled={!canAct || pending !== null || coupon === ZERO}
        className="shrink-0 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending === kind ? 'Claiming…' : 'Claim'}
      </button>
      </div>
      {(loss > ZERO || consumed > ZERO) && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-neutral-500">
          {consumed > ZERO && (
            <>
              The write-down consumed{' '}
              <b className="text-orange-300">{fmt(consumed)}</b> of this tranche&apos;s
              accrued coupon first (excess spread)
              {loss > ZERO ? (
                <>
                  , then <b className="text-neutral-300">{fmt(loss)}</b> of principal.
                </>
              ) : (
                <> — principal untouched.</>
              )}{' '}
            </>
          )}
          {consumed === ZERO && loss > ZERO && (
            <>
              The write-down burned <b className="text-neutral-300">{fmt(loss)}</b> of this
              tranche&apos;s principal.{' '}
            </>
          )}
          At maturity it receives <b className="text-neutral-300">{fmt(coupon)}</b> in coupon
          plus <b className="text-neutral-300">{fmt(redeemable)}</b> in surviving principal ={' '}
          <b className="text-neutral-200">{fmt(coupon + redeemable)}</b>.
        </p>
      )}
    </div>
  );
}

export default function InvestorPanel({
  vault,
  balances,
  supplies,
  pending,
  canAct,
  validate,
  onAct,
  lastSuccess,
  invested,
}: InvestorPanelProps) {
  const clearTokenFor = (kind: ActionKind) =>
    lastSuccess !== null && lastSuccess.kind === kind ? lastSuccess.at : 0;
  const couponPct = vault ? (vault.seniorCouponBps / 100).toFixed(0) : '6';
  const seniorCoupon = vault ? unclaimedCoupon(vault, 'senior') : ZERO;
  const juniorCoupon = vault ? unclaimedCoupon(vault, 'junior') : ZERO;
  // Junior coupon eaten by write-downs (excess spread) — derived from chain
  // state, so it survives reloads and read-only views.
  const consumed = vault ? spreadConsumed(vault) : ZERO;

  return (
    <div className="space-y-6">
      {/* Product cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-sky-500/20 bg-sky-500/[0.04] p-4">
          <p className="text-sm font-bold text-sky-400">{SENIOR_SYMBOL} · Senior tranche</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            {couponPct}% coupon · paid first · loses last
          </p>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Outstanding supply
          </p>
          <p className="text-lg font-bold text-neutral-100">{fmt(supplies.senior)}</p>
          <div className="mt-3">
            <AmountAction
              kind="deposit_senior"
              clearToken={clearTokenFor('deposit_senior')}
              placeholder="700000"
              label="Invest"
              busyLabel="Investing…"
              colorClass="bg-sky-600 hover:bg-sky-500"
              pending={pending}
              canAct={canAct}
              validate={validate}
              onAct={onAct}
            />
          </div>
        </div>

        <div className="rounded-xl border border-orange-500/20 bg-orange-500/[0.04] p-4">
          <p className="text-sm font-bold text-orange-400">{JUNIOR_SYMBOL} · Junior tranche</p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            uncapped upside · paid last · absorbs losses first
          </p>
          <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Outstanding supply
          </p>
          <p className="text-lg font-bold text-neutral-100">{fmt(supplies.junior)}</p>
          <div className="mt-3">
            <AmountAction
              kind="deposit_junior"
              clearToken={clearTokenFor('deposit_junior')}
              placeholder="300000"
              label="Invest"
              busyLabel="Investing…"
              colorClass="bg-orange-600 hover:bg-orange-500"
              pending={pending}
              canAct={canAct}
              validate={validate}
              onAct={onAct}
            />
          </div>
        </div>
      </section>

      {/* Tranche performance */}
      {vault !== null && (vault.seniorPaid > ZERO || vault.juniorPaid > ZERO || invested.senior > ZERO) && (
        <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
            Tranche performance
          </p>
          <div className="grid grid-cols-5 gap-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-500">
            <span>tranche</span>
            <span className="text-right">invested</span>
            <span className="text-right">coupon</span>
            <span className="text-right">loss</span>
            <span className="text-right">net</span>
          </div>
          <ReturnsRow
            label={`${SENIOR_SYMBOL} senior`}
            colorClass="text-sky-400"
            invested={invested.senior}
            coupon={vault.seniorPaid}
            loss={vault.seniorLoss}
          />
          <ReturnsRow
            label={`${JUNIOR_SYMBOL} junior`}
            colorClass="text-orange-400"
            invested={invested.junior}
            coupon={vault.juniorPaid}
            loss={vault.juniorLoss}
            consumed={consumed}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-500">
            Junior earns a higher rate on a smaller stake — the premium for absorbing losses
            first. A write-down consumes junior&apos;s unclaimed coupon first{' '}
            (<b className="text-neutral-300">excess spread</b>), then junior principal, and
            only then senior — the <b className="text-neutral-300">Coupon</b> column already
            shows what survives, <b className="text-neutral-300">Loss</b> is principal written
            off, and <b className="text-neutral-300">Net</b> is the return at maturity.{' '}
            <b className="text-neutral-300">Claim</b> pays the surviving coupon,{' '}
            <b className="text-neutral-300">Redeem</b> returns surviving principal.
          </p>
        </section>
      )}

      {/* Your position */}
      <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
        <p className="mb-3 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
          Your position
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 font-mono text-xs">
            {fmt(balances.asset)} USDC
          </span>
          <span className="rounded-full border border-sky-500/25 bg-sky-500/10 px-3 py-1 font-mono text-xs text-sky-300">
            {fmt(balances.senior)} {SENIOR_SYMBOL}
          </span>
          <span className="rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 font-mono text-xs text-orange-300">
            {fmt(balances.junior)} {JUNIOR_SYMBOL}
          </span>
          <button
            onClick={() => onAct('faucet', BigInt(1_000_000))}
            disabled={!canAct || pending !== null}
            className="ml-auto rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending === 'faucet' ? 'Minting…' : '◇ Get 1,000,000 test USDC'}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          <ClaimRow
            label={SENIOR_SYMBOL}
            coupon={seniorCoupon}
            loss={vault ? vault.seniorLoss : ZERO}
            redeemable={vault ? vault.seniorDeposited - vault.seniorLoss : ZERO}
            kind="claim_senior"
            pending={pending}
            canAct={canAct}
            onAct={onAct}
          />
          <ClaimRow
            label={JUNIOR_SYMBOL}
            coupon={juniorCoupon}
            loss={vault ? vault.juniorLoss : ZERO}
            redeemable={vault ? vault.juniorDeposited - vault.juniorLoss : ZERO}
            consumed={consumed}
            kind="claim_junior"
            pending={pending}
            canAct={canAct}
            onAct={onAct}
          />
        </div>

        <div className="mt-4 space-y-3 border-t border-white/[0.07] pt-4">
          <AmountAction
            kind="redeem_senior"
            clearToken={clearTokenFor('redeem_senior')}
            placeholder="700000"
            label={`Redeem ${SENIOR_SYMBOL}`}
            busyLabel="Redeeming…"
            colorClass="bg-neutral-700 hover:bg-neutral-600"
            pending={pending}
            canAct={canAct}
            validate={validate}
            onAct={onAct}
          />
          <AmountAction
            kind="redeem_junior"
            clearToken={clearTokenFor('redeem_junior')}
            placeholder="220000"
            label={`Redeem ${JUNIOR_SYMBOL}`}
            busyLabel="Redeeming…"
            colorClass="bg-neutral-700 hover:bg-neutral-600"
            pending={pending}
            canAct={canAct}
            validate={validate}
            onAct={onAct}
          />
        </div>
      </section>
    </div>
  );
}
