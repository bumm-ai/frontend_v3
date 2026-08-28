'use client';

/**
 * Tranched compute vault — demo platform UI (V3, guided).
 * Isolated demo page: no BUMM backend calls; talks straight to devnet
 * through the connected wallet. Left column is the live vault state
 * ("the stage"); right column is a numbered demo script that walks the
 * whole securitization lifecycle one action at a time, deriving each
 * step's done/next status from on-chain state.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import {
  JUNIOR_SYMBOL,
  ONE_TOKEN,
  PROGRAM_ID,
  SENIOR_SYMBOL,
  SOLSCAN_ACCOUNT,
  SOLSCAN_TX,
} from './constants';
import { useVault, type ActionKind, type FeedEvent } from './useVault';
import CapitalStackView from './CapitalStackView';
import DealSummary from './DealSummary';
import InvestorPanel from './InvestorPanel';
import OperatorConsole from './OperatorConsole';
import {
  previewLossSplit,
  previewRevenueSplit,
  seniorEntitlement,
  type VaultState,
} from './vaultTx';
import '@solana/wallet-adapter-react-ui/styles.css';

const WalletMultiButton = dynamic(
  () => import('@solana/wallet-adapter-react-ui').then((m) => m.WalletMultiButton),
  { ssr: false },
);

const ZERO = BigInt(0);

function fmt(unitsE6: bigint): string {
  return (unitsE6 / ONE_TOKEN).toLocaleString('en-US');
}

function short(addr: string): string {
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

function parseTokens(s: string): bigint | null {
  const clean = s.replace(/[,\s]/g, '');
  if (!/^\d+$/.test(clean) || clean === '0') return null;
  return BigInt(clean);
}

function AddrLink({ addr, className }: { addr: string; className?: string }) {
  return (
    <a
      href={SOLSCAN_ACCOUNT(addr)}
      target="_blank"
      rel="noreferrer"
      className={`font-mono underline decoration-dotted underline-offset-2 hover:text-white ${className ?? ''}`}
    >
      {short(addr)}
    </a>
  );
}

// ── Event feed ───────────────────────────────────────────────────────────────

function eventSentence(ev: FeedEvent): ReactNode {
  switch (ev.kind) {
    case 'init':
      return <>Vault initialized · 6% senior coupon · $10k/mo × 36 mo offtake recorded</>;
    case 'faucet':
      return (
        <>
          Faucet → <b>{fmt(ev.amount)}</b> test USDC minted to your wallet
        </>
      );
    case 'deposit':
      return (
        <>
          Deposit <b>{fmt(ev.amount)}</b> into{' '}
          <b className={ev.tranche === 'senior' ? 'text-sky-400' : 'text-orange-400'}>
            {ev.tranche}
          </b>{' '}
          → {fmt(ev.amount)} {ev.tranche === 'senior' ? SENIOR_SYMBOL : JUNIOR_SYMBOL} minted
        </>
      );
    case 'draw':
      return (
        <>
          Capital draw <b>{fmt(ev.amount)}</b> → vault to operator
        </>
      );
    case 'repay':
      return (
        <>
          Capital repaid <b>{fmt(ev.amount)}</b> → operator back to vault
        </>
      );
    case 'claim':
      return (
        <>
          Coupon paid to{' '}
          <b className={ev.tranche === 'senior' ? 'text-sky-400' : 'text-orange-400'}>
            {ev.tranche}
          </b>{' '}
          → <b>{fmt(ev.amount)}</b> USDC
        </>
      );
    case 'revenue':
      return (
        <>
          Offtaker paid <b>{fmt(ev.amount)}</b> into the vault → Senior{' '}
          <b className="text-sky-400">{fmt(ev.senior ?? ZERO)}</b> · Junior{' '}
          <b className="text-orange-400">{fmt(ev.junior ?? ZERO)}</b>
        </>
      );
    case 'loss':
      return (
        <>
          Loss <b>{fmt(ev.amount)}</b> →{' '}
          {(ev.spread ?? ZERO) > ZERO && (
            <>
              consumed <b className="text-orange-400">{fmt(ev.spread ?? ZERO)}</b> junior coupon
              ·{' '}
            </>
          )}
          {(ev.junior ?? ZERO) > ZERO && (
            <>
              {fmt(ev.junior ?? ZERO)} {JUNIOR_SYMBOL} burned ·{' '}
            </>
          )}
          {(ev.spread ?? ZERO) === ZERO && (ev.junior ?? ZERO) === ZERO && (
            <>principal untouched · </>
          )}
          {(ev.senior ?? ZERO) === ZERO ? (
            <span className="font-semibold text-sky-400">Senior untouched</span>
          ) : (
            <>
              Senior absorbed <b className="text-sky-400">{fmt(ev.senior ?? ZERO)}</b>
            </>
          )}
        </>
      );
    case 'redeem':
      return (
        <>
          Redeem <b>{fmt(ev.amount)}</b>{' '}
          <b className={ev.tranche === 'senior' ? 'text-sky-400' : 'text-orange-400'}>
            {ev.tranche === 'senior' ? SENIOR_SYMBOL : JUNIOR_SYMBOL}
          </b>{' '}
          → {fmt(ev.amount)} USDC returned
        </>
      );
  }
}

const EVENT_ICON: Record<FeedEvent['kind'], string> = {
  init: '✦',
  faucet: '◇',
  deposit: '↓',
  draw: '⇢',
  repay: '⇠',
  claim: '◈',
  revenue: '$',
  loss: '⚡',
  redeem: '↩',
};

function EventRow({ ev }: { ev: FeedEvent }) {
  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <span className="flex items-center gap-3 text-sm text-neutral-200">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-xs text-neutral-400">
          {EVENT_ICON[ev.kind]}
        </span>
        <span>{eventSentence(ev)}</span>
      </span>
      <a
        href={SOLSCAN_TX(ev.signature)}
        target="_blank"
        rel="noreferrer"
        className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-xs text-neutral-400 transition hover:border-white/25 hover:text-white"
      >
        Solscan ↗
      </a>
    </li>
  );
}

// ── Capital stack ────────────────────────────────────────────────────────────

// ── Rules panel: what the two mechanisms will do, before you click ───────────

/**
 * Client-side reason the entered amount cannot work, or null if it can.
 * Catches the cases the program would reject — an empty wallet, a drained
 * vault, an oversized loss — before the user ever reaches the wallet popup.
 */
export type Validator = (kind: ActionKind, raw: string) => string | null;

/** Live split preview for the revenue / loss inputs. */
function SplitPreview({
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
      <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
        → senior <b className="text-sky-400">{fmt(senior)}</b> (capped at{' '}
        {fmt(seniorEntitlement(vault))}) · junior <b className="text-orange-400">{fmt(junior)}</b>{' '}
        (the rest)
      </p>
    );
  }
  const { spread, junior, senior, exceedsAll } = previewLossSplit(vault, units);
  return (
    <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
      {spread > ZERO && (
        <>
          → consumes <b className="text-orange-400">{fmt(spread)}</b> of junior&apos;s accrued
          coupon (excess spread){' '}
        </>
      )}
      → junior burns <b className="text-orange-400">{fmt(junior)}</b> ·{' '}
      {senior === ZERO ? (
        <span className="text-sky-400">senior untouched</span>
      ) : (
        <>
          senior burns <b className="text-sky-400">{fmt(senior)}</b> (junior is exhausted)
        </>
      )}
      {exceedsAll && <span className="text-red-400"> · exceeds the whole stack, will revert</span>}
    </p>
  );
}

// ── Guided demo script ───────────────────────────────────────────────────────

interface StepStatusInput {
  vault: ReturnType<typeof useVault>['vault'];
  balances: ReturnType<typeof useVault>['balances'];
  supplies: ReturnType<typeof useVault>['supplies'];
}

interface StepSpec {
  kind: ActionKind;
  title: string;
  note: string;
  button: string;
  busy: string;
  color: string;
  /** Editable token amount; null = no amount input (initialize). */
  defaultValue: string | null;
  /** False for one-shot steps that must never be re-run (initialize). */
  repeatable: boolean;
  /** Shown once the step is done, in place of the generic re-run note. */
  doneNote?: string;
  isDone: (s: StepStatusInput) => boolean;
}

const STEPS: StepSpec[] = [
  {
    kind: 'faucet',
    title: 'Get test USDC',
    note: 'The on-chain faucet mints demo USDC to your wallet. One wallet plays every role today: senior investor, junior investor, operator.',
    button: 'Mint test USDC',
    busy: 'Minting…',
    color: 'bg-emerald-700 hover:bg-emerald-600',
    defaultValue: '1000000',
    repeatable: true,
    isDone: (s) => s.balances.asset > ZERO || (s.vault !== null && s.vault.seniorDeposited > ZERO),
  },
  {
    kind: 'init',
    title: 'Create the vault',
    note: 'Records the offtake terms on-chain — $10k/mo × 36 months of contracted GPU revenue — and issues the two tranche mints. Every wallet gets its own vault.',
    button: 'Initialize vault',
    busy: 'Initializing…',
    color: 'bg-white/90 hover:bg-white text-black',
    defaultValue: null,
    repeatable: false,
    isDone: (s) => s.vault !== null,
  },
  {
    kind: 'deposit_senior',
    title: 'Senior invests',
    note: `USDC moves into the vault; ${SENIOR_SYMBOL} tranche tokens are minted 1:1. Senior is paid first, capped at a 6% coupon, and loses last.`,
    doneNote: `Top up any time — type another amount and deposit again. Senior's coupon is 6% of whatever the principal becomes, so the payout figure moves with it.`,
    button: 'Deposit senior',
    busy: 'Depositing…',
    color: 'bg-sky-600 hover:bg-sky-500',
    defaultValue: '700000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.seniorDeposited > ZERO,
  },
  {
    kind: 'deposit_junior',
    title: 'Junior invests',
    note: `${JUNIOR_SYMBOL} is minted 1:1. Junior is paid last, keeps the uncapped upside, and absorbs losses first — the operator's skin in the game.`,
    doneNote: 'Top up any time — type another amount and deposit again. More junior means a thicker loss cushion under senior.',
    button: 'Deposit junior',
    busy: 'Depositing…',
    color: 'bg-orange-600 hover:bg-orange-500',
    defaultValue: '300000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.juniorDeposited > ZERO,
  },
  {
    kind: 'draw',
    title: 'Operator draws capital',
    note: 'The raised capital leaves the vault to the operator to buy hardware. This is the whole point: cash now against future contracted revenue.',
    button: 'Draw capital',
    busy: 'Drawing…',
    color: 'bg-emerald-700 hover:bg-emerald-600',
    defaultValue: '900000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.capitalDrawn > ZERO,
  },
  {
    kind: 'revenue',
    title: 'Offtaker pays — waterfall',
    note: 'The compute buyer pays its monthly bill straight into the vault — on devnet the offtaker faucet mints it, so the money enters from OUTSIDE the capital stack, never from the operator’s wallet. The waterfall pays top-down: senior takes its capped 42k (6% of 700k), junior takes the residual 58k.',
    button: 'Offtaker pays revenue',
    busy: 'Paying…',
    color: 'bg-sky-600 hover:bg-sky-500',
    defaultValue: '100000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.totalRevenue > ZERO,
  },
  {
    kind: 'loss',
    title: 'Loss event — spread absorbs first',
    note: `Losses absorb bottom-up with excess spread: junior's accrued 58k coupon is consumed first, then 22k of junior principal burns (${JUNIOR_SYMBOL} tokens destroyed). Senior is untouched. The operator's repayment obligation drops by the full 80k write-down.`,
    button: 'Record loss',
    busy: 'Recording…',
    color: 'bg-red-800 hover:bg-red-700',
    defaultValue: '80000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.juniorLoss > ZERO,
  },
  {
    kind: 'repay',
    title: 'Period ends — operator repays',
    note: 'The offtake term is over: hardware is sold or refinanced at its written-down value and the outstanding obligation — 900k drawn minus the 80k loss = 820k — comes back into the vault. That is exactly what the remaining claims and redemptions need: the vault closes to zero.',
    button: 'Repay capital',
    busy: 'Repaying…',
    color: 'bg-emerald-700 hover:bg-emerald-600',
    defaultValue: '820000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.capitalDrawn === ZERO,
  },
  {
    kind: 'claim_senior',
    title: 'Senior collects its coupon',
    note: 'The coupon the waterfall allocated to senior is paid out in USDC. Principal is untouched — this is the yield, not the exit.',
    button: 'Claim senior coupon',
    busy: 'Claiming…',
    color: 'bg-sky-600 hover:bg-sky-500',
    defaultValue: null,
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.seniorClaimed > ZERO,
  },
  {
    kind: 'redeem_senior',
    title: 'Senior exits whole',
    note: `All ${SENIOR_SYMBOL} burns and the full principal comes back. Senior absorbed no loss, so it walks away with principal plus coupon — a capped return, paid first.`,
    button: `Redeem all ${SENIOR_SYMBOL}`,
    busy: 'Redeeming…',
    color: 'bg-sky-600 hover:bg-sky-500',
    defaultValue: '700000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.seniorDeposited - s.vault.seniorLoss === ZERO,
  },
  {
    kind: 'redeem_junior',
    title: 'Junior exits with what survived',
    note: 'Junior redeems 278,000 of its 300,000 — the loss consumed its entire 58k accrued coupon first (nothing left to claim), then 22k of principal. Junior stood in front of the loss and paid for it; that asymmetry, priced and enforced by the contract, is the whole product.',
    button: `Redeem all ${JUNIOR_SYMBOL}`,
    busy: 'Redeeming…',
    color: 'bg-orange-600 hover:bg-orange-500',
    defaultValue: '278000',
    repeatable: true,
    isDone: (s) => s.vault !== null && s.vault.juniorDeposited - s.vault.juniorLoss === ZERO,
  },
];

function StepCard({
  index,
  spec,
  state,
  open,
  onOpen,
  pending,
  disabled,
  locked,
  vault,
  validate,
  onRun,
}: {
  index: number;
  spec: StepSpec;
  state: 'done' | 'next' | 'later';
  open: boolean;
  onOpen: () => void;
  pending: ActionKind | null;
  disabled: boolean;
  /** Previous steps not done yet — the script runs strictly in order. */
  locked: boolean;
  vault: VaultState | null;
  validate: Validator;
  onRun: (kind: ActionKind, tokens: bigint) => void;
}) {
  const [value, setValue] = useState(spec.defaultValue ?? '');
  const blocked = validate(spec.kind, value);
  const badge =
    state === 'done' ? (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-400">
        ✓
      </span>
    ) : (
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          state === 'next' ? 'bg-white text-black' : 'bg-white/10 text-neutral-500'
        }`}
      >
        {index + 1}
      </span>
    );

  return (
    <li
      className={`rounded-xl border transition ${
        open
          ? 'border-white/25 bg-white/[0.05]'
          : state === 'done'
            ? 'border-emerald-500/15 bg-emerald-500/[0.03]'
            : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <button
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
      >
        {badge}
        <span
          className={`flex-1 text-sm font-medium ${
            state === 'later' && !open ? 'text-neutral-500' : 'text-neutral-100'
          }`}
        >
          {spec.title}
        </span>
        {state === 'next' && !open && (
          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
            next
          </span>
        )}
        {state === 'done' && spec.repeatable && !open && (
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">
            run again
          </span>
        )}
      </button>
      {open && (
        <div className="px-3 pb-3 pl-12">
          <p className="mb-3 text-xs leading-relaxed text-neutral-400">{spec.note}</p>
          {locked ? (
            <p className="rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-[11px] text-neutral-500">
              The script runs in order — finish the previous steps first.
            </p>
          ) : (
            <div className="flex items-center gap-2">
              {spec.defaultValue !== null && (
                <input
                  aria-label={`${spec.title} amount`}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  inputMode="numeric"
                  className="w-28 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 font-mono text-sm outline-none focus:border-white/30"
                />
              )}
              <button
                onClick={() => {
                  const v = spec.defaultValue === null ? BigInt(1) : parseTokens(value);
                  if (v) onRun(spec.kind, v);
                }}
                disabled={
                  disabled ||
                  pending !== null ||
                  (state === 'done' && !spec.repeatable) ||
                  blocked !== null
                }
                className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                  spec.color.includes('text-black') ? spec.color : `text-white ${spec.color}`
                }`}
              >
                {pending === spec.kind
                  ? spec.busy
                  : state === 'done' && !spec.repeatable
                    ? 'Vault already exists ✓'
                    : spec.button}
              </button>
            </div>
          )}
          {!locked && blocked !== null ? (
            <p className="mt-2 text-[11px] leading-relaxed text-amber-400">{blocked}</p>
          ) : (
            !locked && <SplitPreview kind={spec.kind} vault={vault} raw={value} />
          )}
          {state === 'done' && !locked && (
            <p className="mt-2 text-[11px] text-neutral-500">
              {spec.repeatable
                ? (spec.doneNote ??
                  'already done — running it again is fine, every click is a real transaction')
                : 'one-time step — use ↻ fresh run for a brand-new vault'}
            </p>
          )}
        </div>
      )}
    </li>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function VaultDemo() {
  const {
    connected,
    viewOnly,
    isOperator,
    vault,
    addresses,
    balances,
    supplies,
    invested,
    vaultLiquidity,
    events,
    pending,
    error,
    loaded,
    solLamports,
    lastSuccess,
    act,
    creatingMint,
    startFreshRun,
  } = useVault();

  const [openStep, setOpenStep] = useState<number | null>(null);
  const [showTour, setShowTour] = useState(false);
  const [operatorOpen, setOperatorOpen] = useState(false);
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Slide the drawer away the moment an operator action confirms: the
  // waterfall/burn animation fires on that same confirmation, and it must
  // play on the full stage — not behind the drawer's backdrop.
  useEffect(() => {
    if (
      lastSuccess !== null &&
      (lastSuccess.kind === 'draw' ||
        lastSuccess.kind === 'revenue' ||
        lastSuccess.kind === 'loss' ||
        lastSuccess.kind === 'repay')
    ) {
      setOperatorOpen(false);
    }
  }, [lastSuccess]);
  // Four account creations at init cost ~0.01 SOL of rent; warn well above it.
  const lowSol = solLamports !== null && solLamports < 20_000_000;

  const validate = useCallback<Validator>(
    (kind, raw) => {
      const amount = parseTokens(raw);
      if (amount === null) return null;
      const units = amount * ONE_TOKEN;
      const needAsset = () =>
        units > balances.asset
          ? `You hold ${fmt(balances.asset)} USDC — mint more with the “Get test USDC” step first.`
          : null;

      switch (kind) {
        case 'init':
          return null;
        case 'deposit_senior':
        case 'deposit_junior':
          return needAsset();
        case 'revenue':
          // Minted by the offtaker faucet — needs no wallet balance at all.
          return amount > BigInt(10_000_000)
            ? 'The offtaker faucet mints at most 10,000,000 per payment.'
            : null;
        case 'repay': {
          const owed = vault?.capitalDrawn ?? ZERO;
          if (units > owed) {
            return `Outstanding obligation is ${fmt(owed)} — repaying more than that would strand cash in the vault that belongs to nobody.`;
          }
          return needAsset();
        }
        case 'draw': {
          const unclaimed = vault
            ? vault.seniorPaid - vault.seniorClaimed + (vault.juniorPaid - vault.juniorClaimed)
            : ZERO;
          const free = vaultLiquidity > unclaimed ? vaultLiquidity - unclaimed : ZERO;
          return units > free
            ? `The vault holds ${fmt(vaultLiquidity)}, of which ${fmt(unclaimed)} is earmarked for unclaimed coupons — at most ${fmt(free)} can be drawn.`
            : null;
        }
        case 'redeem_senior':
        case 'redeem_junior': {
          const held = kind === 'redeem_senior' ? balances.senior : balances.junior;
          const symbol = kind === 'redeem_senior' ? SENIOR_SYMBOL : JUNIOR_SYMBOL;
          if (units > held) return `You hold ${fmt(held)} ${symbol}.`;
          return units > vaultLiquidity
            ? `Vault liquidity is ${fmt(vaultLiquidity)} — the operator drew capital out, so distribute revenue before redeeming this much.`
            : null;
        }
        case 'loss':
          return vault && previewLossSplit(vault, units).exceedsAll
            ? 'Bigger than the whole capital stack — junior and senior together cannot absorb it.'
            : null;
        default:
          return null;
      }
    },
    [balances, vault, vaultLiquidity],
  );

  const statusInput: StepStatusInput = { vault, balances, supplies };
  // Gate on `loaded` so statuses settle once instead of cascading while the
  // first devnet fetch is in flight.
  const doneFlags = loaded ? STEPS.map((s) => s.isDone(statusInput)) : STEPS.map(() => false);
  const currentIdx = doneFlags.indexOf(false) === -1 ? STEPS.length - 1 : doneFlags.indexOf(false);
  const effectiveOpen = openStep ?? currentIdx;
  const doneCount = doneFlags.filter(Boolean).length;
  // Strict order: a step is runnable only when everything before it is done.
  const unlocked = (i: number) => i === 0 || doneFlags.slice(0, i).every(Boolean);

  return (
    <main
      className="min-h-screen bg-[#07070c] text-neutral-100 antialiased"
      style={{
        backgroundImage:
          'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(56,130,246,0.13), transparent), radial-gradient(ellipse 60% 40% at 90% 110%, rgba(249,115,22,0.07), transparent)',
        fontFamily: 'var(--font-display), ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-6">
        {/* Top bar */}
        <header className="mb-8 flex items-center justify-between gap-4 border-b border-white/[0.07] pb-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold tracking-tight">
              TRNCH<span className="text-sky-500">◢</span>
            </span>
            <span className="hidden text-xs text-neutral-500 sm:block">
              compute securitization vault
            </span>
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400">
              devnet
            </span>
            {viewOnly && (
              <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-xs text-neutral-400">
                read-only
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <AddrLink addr={PROGRAM_ID} className="hidden text-xs text-neutral-500 md:block" />
            {vault !== null && (
              <button
                onClick={() => setSummaryOpen(true)}
                className="rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition hover:bg-white/10"
              >
                Σ Summary
              </button>
            )}
            {isOperator && vault !== null && (
              <button
                onClick={() => setOperatorOpen(true)}
                className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
              >
                ⚙ Operator console
              </button>
            )}
            <WalletMultiButton />
          </div>
        </header>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
          {/* ── Left: the stage ── */}
          <div className="min-w-0">
            <CapitalStackView
              vault={vault}
              loaded={loaded}
              viewOnly={viewOnly}
              connected={connected}
              lastEvent={events[0] ?? null}
            />

            <div className="mt-6">
              <InvestorPanel
                vault={vault}
                balances={balances}
                supplies={supplies}
                pending={pending}
                canAct={isOperator && vault !== null}
                validate={validate}
                onAct={(kind, v) => void act(kind, v)}
                lastSuccess={lastSuccess}
                invested={invested}
              />
            </div>

            {error && (
              <p className="mb-6 break-all rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </p>
            )}

            {/* Event feed */}
            {events.length > 0 && (
              <section>
                <div className="mb-3 flex items-center justify-between gap-4">
                  <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
                    On-chain events
                  </h2>
                  <a
                    href={SOLSCAN_TX(events[0].signature)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                  >
                    Verify last transaction on Solscan ↗
                  </a>
                </div>
                <ul className="space-y-2">
                  {events.map((ev) => (
                    <EventRow key={ev.signature} ev={ev} />
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* ── Right: operator console + optional guided tour ── */}
          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
              {!viewOnly && connected && lowSol && (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs leading-relaxed text-amber-300">
                  Your wallet holds {(solLamports ?? 0) / 1e9} devnet SOL. Creating a vault
                  writes four new accounts and needs roughly 0.01 SOL of rent — top up at{' '}
                  <a
                    href="https://faucet.solana.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-dotted"
                  >
                    faucet.solana.com
                  </a>{' '}
                  first, or the wallet will reject the transaction.
                </p>
              )}
              {!viewOnly && connected && loaded && !vault && (
                <button
                  onClick={() => void act('init', BigInt(1))}
                  disabled={pending !== null || creatingMint}
                  className="w-full rounded-xl bg-white/90 px-4 py-3 text-sm font-semibold text-black transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {pending === 'init'
                    ? 'Initializing…'
                    : 'Create vault · 6% coupon · $10k/mo × 36 mo'}
                </button>
              )}

              {/* Access-control proof for non-operators: the console itself
                  lives in a drawer behind the header button, which only the
                  vault authority ever sees — this pill is what everyone else
                  gets (mirrors the on-chain has_one gate). */}
              {vault !== null && !isOperator && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
                  <p className="text-sm font-semibold text-neutral-100">🔒 Operator console</p>
                  <p className="mt-1 text-xs text-neutral-400">
                    restricted to the vault authority ·{' '}
                    <AddrLink addr={vault.authority.toBase58()} />
                  </p>
                  <p className="mt-1 text-[11px] text-neutral-500">
                    connected wallet is not the operator of this vault
                  </p>
                </div>
              )}

              {!viewOnly && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowTour((s) => !s)}
                  className="flex-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5"
                >
                  {showTour ? 'Hide guided tour' : 'Guided tour (step by step)'}
                </button>
                {connected && (
                  <button
                    onClick={() => void startFreshRun()}
                    disabled={creatingMint || pending !== null}
                    title="Creates a brand-new demo asset mint and reloads with an empty vault"
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-neutral-400 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {creatingMint ? 'creating…' : '↻ fresh run'}
                  </button>
                )}
              </div>
              )}

              {!viewOnly && showTour && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">Demo script</h2>
                  <span className="text-[11px] text-neutral-500">
                    {doneCount}/{STEPS.length} done
                  </span>
                </div>
                {!connected && (
                  <p className="mb-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-neutral-300">
                    First: <b>Select Wallet</b> (top right). Any devnet wallet works — the demo
                    is fully self-service.
                  </p>
                )}
                {connected && !loaded && (
                  <p className="mb-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-neutral-400">
                    Syncing on-chain state…
                  </p>
                )}
                {connected && loaded && currentIdx > 0 && (
                  <p className="mb-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-neutral-400">
                    Steps 1–{currentIdx} were detected as already done on-chain for this wallet.
                    For a clean take from step 1, hit <b>↻ fresh run</b>.
                  </p>
                )}
                <ol className="space-y-2">
                  {STEPS.map((spec, i) => (
                    <StepCard
                      key={spec.kind}
                      index={i}
                      spec={spec}
                      state={doneFlags[i] ? 'done' : i === currentIdx ? 'next' : 'later'}
                      open={effectiveOpen === i}
                      onOpen={() => setOpenStep(openStep === i ? null : i)}
                      pending={pending}
                      locked={!unlocked(i)}
                      vault={vault}
                      validate={validate}
                      disabled={!connected || !loaded || creatingMint || !unlocked(i)}
                      // Keep whatever step the user pinned open after the
                      // action: collapsing it here made the rail jump away
                      // mid-top-up, so re-depositing looked impossible.
                      // In auto-follow mode (openStep === null) the rail
                      // still advances on its own as doneFlags move.
                      onRun={(kind, v) => void act(kind, v)}
                    />
                  ))}
                </ol>
                <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
                  Devnet demonstration · one wallet plays the operator and both tranches; the
                  offtaker&apos;s payments are simulated by an on-chain faucet, external to the
                  capital stack · in production the draw is covenant-gated and Token-2022
                  transfer hooks gate tranche transfers
                </p>
              </div>
              )}
            </aside>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.07] pt-4 text-xs text-neutral-600">
          <span>
            vault {addresses ? <AddrLink addr={addresses.vault.toBase58()} /> : '—'} · program{' '}
            <AddrLink addr={PROGRAM_ID} />
          </span>
          <span>devnet toy · no mainnet, no audit, no legal structure</span>
        </footer>
      </div>

      <DealSummary
        open={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        vault={vault}
        invested={invested}
        vaultLiquidity={vaultLiquidity}
      />

      <OperatorConsole
        open={operatorOpen && isOperator && vault !== null}
        onClose={() => setOperatorOpen(false)}
        vault={vault}
        vaultLiquidity={vaultLiquidity}
        pending={pending}
        lastSuccess={lastSuccess}
        validate={validate}
        onAct={(kind, v) => void act(kind, v)}
        error={error}
      />
    </main>
  );
}
