'use client';

/**
 * Deal summary modal — the whole deal on one card: headline totals, then a
 * per-role table of who put in, who earned and who lost what, then the
 * operator / offtaker / vault cash flows. Every figure derives from on-chain
 * vault state (plus the session-tracked invested peaks for percentages), so
 * the card is honest in read-only views too. Presentational only.
 *
 * Accounting identity the table keeps: earned (coupon allocated, before any
 * write-down) − lost (total absorbed: consumed coupon + burned principal)
 * = net at maturity. For junior that means earned = juniorPaid + consumed
 * spread, so 58k − 80k = −22k reads as arithmetic, not as a mystery.
 */

import { useEffect } from 'react';
import { JUNIOR_SYMBOL, SENIOR_SYMBOL } from './constants';
import { fmt } from './format';
import { spreadConsumed, type VaultState } from './vaultTx';

const ZERO = BigInt(0);

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-0.5 font-mono text-base font-bold text-neutral-100">{value}</p>
      {sub && <p className="mt-0.5 text-[10px] text-neutral-500">{sub}</p>}
    </div>
  );
}

function RoleRow({
  role,
  colorClass,
  invested,
  earned,
  lost,
  lostDetail,
}: {
  role: string;
  colorClass: string;
  invested: bigint;
  /** Coupon allocated by the waterfall, before write-downs. */
  earned: bigint;
  /** Total absorbed: consumed coupon + burned principal. */
  lost: bigint;
  lostDetail?: string;
}) {
  const known = invested > ZERO;
  const pct = (v: bigint) => `${v < ZERO ? '' : '+'}${((Number(v) / Number(invested)) * 100).toFixed(2)}%`;
  const net = earned - lost;
  const netAbs = net < ZERO ? -net : net;
  return (
    <div className="grid grid-cols-5 items-center gap-2 border-t border-white/[0.07] py-2.5 text-xs">
      <span className={`font-semibold ${colorClass}`}>{role}</span>
      <span className="text-right font-mono text-neutral-300">{known ? fmt(invested) : '—'}</span>
      <span className="text-right font-mono text-emerald-400">+{fmt(earned)}</span>
      <span className="text-right font-mono text-red-400">
        {lost > ZERO ? `−${fmt(lost)}` : '—'}
        {lost > ZERO && lostDetail && (
          <span className="block font-sans text-[10px] text-neutral-500">{lostDetail}</span>
        )}
      </span>
      <span
        className={`text-right font-mono font-semibold ${
          net > ZERO ? 'text-emerald-400' : net < ZERO ? 'text-red-400' : 'text-neutral-400'
        }`}
      >
        {net >= ZERO ? '+' : '−'}
        {fmt(netAbs)}
        {known && (
          <span className="ml-1 font-sans text-[10px] font-normal text-neutral-500">{pct(net)}</span>
        )}
      </span>
    </div>
  );
}

export default function DealSummary({
  open,
  onClose,
  vault,
  invested,
  vaultLiquidity,
}: {
  open: boolean;
  onClose: () => void;
  vault: VaultState | null;
  /** Peak principal each tranche put in this session (0 = unknown). */
  invested: { senior: bigint; junior: bigint };
  vaultLiquidity: bigint;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !vault) return null;

  const consumed = spreadConsumed(vault);
  const juniorAbsorbed = consumed + vault.juniorLoss;
  const writtenDown = consumed + vault.juniorLoss + vault.seniorLoss;
  const unclaimed =
    vault.seniorPaid - vault.seniorClaimed + (vault.juniorPaid - vault.juniorClaimed);
  const raisedKnown = invested.senior + invested.junior > ZERO;

  return (
    <div className="fixed inset-0 z-50">
      <div onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div
        role="dialog"
        aria-label="Deal summary"
        className="absolute left-1/2 top-1/2 max-h-[85vh] w-[min(92vw,42rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0b0b13] p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-neutral-100">Σ Deal summary</h2>
          <span className="text-[11px] text-neutral-500">live from chain state</span>
          <button
            onClick={onClose}
            aria-label="Close deal summary"
            className="ml-auto rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Headline totals */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Tile
            label="Capital raised"
            value={raisedKnown ? fmt(invested.senior + invested.junior) : '—'}
            sub={
              raisedKnown
                ? `${fmt(invested.senior)} senior · ${fmt(invested.junior)} junior`
                : 'not seen this session'
            }
          />
          <Tile label="Revenue received" value={fmt(vault.totalRevenue)} sub="paid in by the offtaker" />
          <Tile
            label="Written down"
            value={writtenDown > ZERO ? `−${fmt(writtenDown)}` : '0'}
            sub={
              writtenDown > ZERO
                ? `${fmt(consumed)} coupon · ${fmt(vault.juniorLoss + vault.seniorLoss)} principal`
                : 'no loss events'
            }
          />
          <Tile
            label="Vault liquidity"
            value={fmt(vaultLiquidity)}
            sub={unclaimed > ZERO ? `${fmt(unclaimed)} owed as coupons` : 'no coupons pending'}
          />
        </div>

        {/* Per-role table */}
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2">
          <div className="grid grid-cols-5 gap-2 pb-1 text-[10px] uppercase tracking-wider text-neutral-500">
            <span>role</span>
            <span className="text-right">invested</span>
            <span className="text-right">earned</span>
            <span className="text-right">lost</span>
            <span className="text-right">net</span>
          </div>
          <RoleRow
            role={`${SENIOR_SYMBOL} senior`}
            colorClass="text-sky-400"
            invested={invested.senior}
            earned={vault.seniorPaid}
            lost={vault.seniorLoss}
            lostDetail="principal"
          />
          <RoleRow
            role={`${JUNIOR_SYMBOL} junior`}
            colorClass="text-orange-400"
            invested={invested.junior}
            earned={vault.juniorPaid + consumed}
            lost={juniorAbsorbed}
            lostDetail={
              juniorAbsorbed > ZERO
                ? `${fmt(consumed)} coupon + ${fmt(vault.juniorLoss)} principal`
                : undefined
            }
          />
          <p className="mt-2 border-t border-white/[0.07] pt-2 text-[11px] leading-relaxed text-neutral-500">
            <b className="text-neutral-300">Earned</b> is the coupon the waterfall allocated
            before any write-down; <b className="text-neutral-300">Lost</b> is everything a
            loss absorbed (consumed coupon first — excess spread — then burned principal);{' '}
            <b className="text-neutral-300">Net</b> = earned − lost = the return at maturity.
          </p>
        </div>

        {/* Cash flows of the other parties */}
        <div className="mt-3 space-y-2 text-xs text-neutral-400">
          <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <b className="text-emerald-400">Operator</b> — capital outstanding{' '}
            <b className="font-mono text-neutral-200">{fmt(vault.capitalDrawn)}</b>
            {writtenDown > ZERO && (
              <>
                {' '}
                · write-downs forgave{' '}
                <b className="font-mono text-neutral-200">{fmt(writtenDown)}</b> of the
                obligation
              </>
            )}
            {vault.capitalDrawn === ZERO && <> · fully repaid</>}
          </p>
          <p className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
            <b className="text-sky-300">Offtaker</b> (compute buyer) — paid{' '}
            <b className="font-mono text-neutral-200">{fmt(vault.totalRevenue)}</b> into the
            vault, from outside the capital stack (devnet: minted by the offtaker faucet)
          </p>
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-neutral-600">
          Devnet demo: one wallet plays every role. Percentages use the principal this page
          saw deposited during this session.
        </p>
      </div>
    </div>
  );
}
