'use client';

/**
 * Animated capital stack — the centrepiece of the tranched-vault demo page.
 *
 * Three layers, top to bottom: a period timeline saying where in the
 * securitization lifecycle the vault is, the stack bar itself, and a legend.
 * Revenue and loss events replay as brief overlays on top of the bar.
 *
 * Deliberately framer-motion free: animating segment widths through motion's
 * px interpolation left the bar frozen mid-flight (segments stuck at e.g.
 * 207px instead of 71%). Everything here is a plain CSS transition or a
 * keyframe animation, re-triggered by remounting the overlay on a new event.
 */

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { ASSET_LABEL, JUNIOR_SYMBOL, SENIOR_SYMBOL } from './constants';
import { fmt } from './format';
import { seniorEntitlement, type VaultState } from './vaultTx';

const ZERO = BigInt(0);
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

export interface StackEvent {
  /** 'revenue' | 'loss' | any other feed kind (which animates nothing). */
  kind: string;
  amount: bigint;
  senior?: bigint;
  junior?: bigint;
  /** Junior coupon consumed by a loss before any principal burned (V5). */
  spread?: bigint;
  /** Date.now() of the event — the animation trigger key. */
  at: number;
}

const PHASES = ['Origination', 'Funding', 'Drawn', 'Revenue', 'Loss', 'Maturity'] as const;

/** Later phases win: the last condition that holds is the one on screen. */
function phaseIndex(vault: VaultState | null): number {
  if (!vault) return 0;
  let phase = 0;
  if (vault.seniorDeposited + vault.juniorDeposited > ZERO) phase = 1;
  if (vault.capitalDrawn > ZERO) phase = 2;
  if (vault.totalRevenue > ZERO) phase = 3;
  if (vault.juniorLoss > ZERO) phase = 4;
  if (vault.totalRevenue > ZERO && vault.capitalDrawn === ZERO) phase = 5;
  return phase;
}

const KEYFRAMES = `
@keyframes csvPulse {
  0% { box-shadow: 0 0 0 0 rgba(255,255,255,0.30); }
  70% { box-shadow: 0 0 0 7px rgba(255,255,255,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,255,255,0); }
}
@keyframes csvDrop {
  0% { transform: translateY(-130%); opacity: 0; }
  22% { opacity: 1; }
  55% { transform: translateY(0); opacity: 1; }
  100% { transform: translateY(0); opacity: 0; }
}
@keyframes csvSweep {
  0% { transform: scaleX(0); opacity: 0; }
  25% { opacity: 1; }
  60% { transform: scaleX(1); opacity: 1; }
  100% { transform: scaleX(1); opacity: 0; }
}
@keyframes csvFloat {
  0% { transform: translateY(8px); opacity: 0; }
  25% { transform: translateY(0); opacity: 1; }
  70% { transform: translateY(-9px); opacity: 1; }
  100% { transform: translateY(-20px); opacity: 0; }
}
@keyframes csvBurn {
  0% { transform: scaleX(0.12); opacity: 0; }
  30% { transform: scaleX(1); opacity: 0.85; }
  100% { transform: scaleX(1.4); opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .csv-anim { animation: none !important; opacity: 0 !important; }
}
`;

// ── Period timeline ──────────────────────────────────────────────────────────

function PeriodTimeline({ phase }: { phase: number }) {
  return (
    <div className="relative mb-5">
      {/* Line runs dot-centre to dot-centre: six equal columns, so 1/12 in. */}
      <div className="absolute left-[8.333%] right-[8.333%] top-[6px] h-px bg-white/10" />
      <ol className="relative flex items-start">
        {PHASES.map((label, i) => {
          const state = i < phase ? 'done' : i === phase ? 'now' : 'later';
          return (
            <li key={label} className="flex flex-1 flex-col items-center gap-2">
              <span
                className={`h-3 w-3 rounded-full border transition-colors duration-500 ${
                  state === 'done'
                    ? 'border-neutral-400/30 bg-neutral-400/70'
                    : state === 'now'
                      ? 'border-white/60 bg-white'
                      : 'border-white/10 bg-white/[0.07]'
                }`}
                style={state === 'now' ? { animation: `csvPulse 2.4s ${EASE} infinite` } : undefined}
              />
              <span
                className={`text-center text-[10px] uppercase tracking-wider ${
                  state === 'now'
                    ? 'font-medium text-neutral-200'
                    : state === 'done'
                      ? 'text-neutral-500'
                      : 'text-neutral-600'
                }`}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ── Stack bar ────────────────────────────────────────────────────────────────

/**
 * One slice of the capital stack. Its in-bar label is dropped when the slice
 * gets too narrow to hold it — a truncated "Junior 20,000 …" reads worse than
 * nothing, and the legend below the bar carries the numbers regardless.
 */
function StackSegment({
  pct, value, label, tooltip, className, textClassName, hatched, onHover,
}: {
  pct: number; value: bigint; label: string; tooltip: string; className: string;
  textClassName?: string; hatched?: boolean; onHover: (tooltip: string | null) => void;
}) {
  const showLabel = pct >= 16 && value > ZERO;
  return (
    <div
      title={tooltip}
      onMouseEnter={() => onHover(tooltip)}
      onMouseLeave={() => onHover(null)}
      className={`relative flex items-center justify-center ${className}`}
      style={{
        width: `${pct}%`,
        transition: `width 700ms ${EASE}`,
        ...(hatched
          ? {
              backgroundImage:
                'repeating-linear-gradient(135deg, rgba(239,68,68,0.22) 0 6px, rgba(0,0,0,0.35) 6px 12px)',
            }
          : {}),
      }}
    >
      {showLabel && (
        <span className={`truncate px-2 text-sm font-semibold ${textClassName ?? 'text-white'}`}>
          {label} {fmt(value)} · {pct.toFixed(0)}%
        </span>
      )}
    </div>
  );
}

function LegendItem({
  swatch, label, value, pct,
}: {
  swatch: string; label: string; value: string; pct: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${swatch}`} />
      <dt className="text-neutral-400">{label}</dt>
      <dd className="font-mono font-semibold text-neutral-100">
        {value}
        <span className="ml-1 font-sans font-normal text-neutral-500">{pct.toFixed(0)}%</span>
      </dd>
    </div>
  );
}

// ── Event overlays ───────────────────────────────────────────────────────────

interface FloatLabel {
  leftPct: number;
  delayMs: number;
  durationMs: number;
  /** Tailwind border/bg/text trio for the pill. */
  tone: string;
  text: ReactNode;
}

interface Overlay {
  /** Flow strips, clipped to the bar. */
  strips: CSSProperties[];
  /** Pills that drift upward across the bar and fade. */
  labels: FloatLabel[];
}

// Dark backing, not a tinted one: these pills float over saturated sky/orange
// gradients, and a translucent tint on top of them is unreadable on camera.
const SKY_PILL = 'border-sky-400/40 bg-black/70 text-sky-200';
const ORANGE_PILL = 'border-orange-400/40 bg-black/70 text-orange-200';
const RED_PILL = 'border-red-400/40 bg-black/70 text-red-200';

/**
 * Turns one event into its overlay, or null if that kind animates nothing.
 * Revenue: a sky strip drops from the top edge onto senior, then an orange one
 * sweeps across junior. Loss: a red glow spreads out of the junior/burned seam.
 * Both stay under ~1.8s so the bar is readable again before anyone can ask.
 */
function overlayFor(ev: StackEvent, seniorPct: number, juniorPct: number): Overlay | null {
  const senior = ev.senior ?? ZERO;
  const junior = ev.junior ?? ZERO;

  if (ev.kind === 'revenue') {
    return {
      strips: [
        {
          left: 0,
          width: `${seniorPct}%`,
          backgroundImage:
            'linear-gradient(180deg, rgba(186,230,253,0.55) 0%, rgba(56,189,248,0.20) 55%, transparent 100%)',
          animation: `csvDrop 900ms ${EASE} both`,
        },
        {
          left: `${seniorPct}%`,
          width: `${juniorPct}%`,
          transformOrigin: 'left center',
          backgroundImage:
            'linear-gradient(180deg, rgba(254,215,170,0.50) 0%, rgba(249,115,22,0.20) 55%, transparent 100%)',
          animation: `csvSweep 900ms ${EASE} 700ms both`,
        },
      ],
      labels: [
        ...(senior > ZERO
          ? [{ leftPct: seniorPct / 2, delayMs: 200, durationMs: 1100, tone: SKY_PILL,
               text: <>+{fmt(senior)} → senior</> }]
          : []),
        ...(junior > ZERO
          ? [{ leftPct: seniorPct + juniorPct / 2, delayMs: 800, durationMs: 1000, tone: ORANGE_PILL,
               text: <>+{fmt(junior)} → junior</> }]
          : []),
      ],
    };
  }

  if (ev.kind === 'loss') {
    const spread = ev.spread ?? ZERO;
    const seam = seniorPct + juniorPct;
    return {
      strips: [
        {
          left: `${seam}%`,
          width: '34%',
          marginLeft: '-17%',
          backgroundImage:
            'linear-gradient(90deg, transparent 0%, rgba(239,68,68,0.55) 50%, transparent 100%)',
          animation: `csvBurn 1000ms ${EASE} both`,
        },
      ],
      labels: [
        // The spread pill leads: the accrued junior coupon absorbs the hit
        // before any principal burns — that ordering IS the V5 story.
        ...(spread > ZERO
          ? [{ leftPct: seniorPct + juniorPct / 2, delayMs: 100, durationMs: 1200, tone: ORANGE_PILL,
               text: <>−{fmt(spread)} junior coupon consumed</> }]
          : []),
        ...(junior > ZERO
          ? [{ leftPct: seam, delayMs: spread > ZERO ? 500 : 100, durationMs: 1200, tone: RED_PILL,
               text: <>−{fmt(junior)} {JUNIOR_SYMBOL} burned</> }]
          : []),
        ...(senior > ZERO
          ? [{ leftPct: seam - 22, delayMs: spread > ZERO ? 700 : 300, durationMs: 1200, tone: RED_PILL,
               text: <>−{fmt(senior)} {SENIOR_SYMBOL} burned</> }]
          : []),
      ],
    };
  }

  return null;
}

/** Keeps a floating pill off the bar edges so it never renders half-cropped. */
const clampPct = (pct: number) => Math.min(Math.max(pct, 13), 87);

function EventOverlay({ overlay }: { overlay: Overlay }) {
  return (
    <>
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
        {overlay.strips.map((style, i) => (
          // Strips match the bar's own width transition so a slice that is
          // still sliding to its new size does not leave its strip behind.
          <div
            key={`strip-${i}`}
            className="csv-anim absolute inset-y-0"
            style={{ transition: `left 700ms ${EASE}, width 700ms ${EASE}`, ...style }}
          />
        ))}
      </div>
      <div className="pointer-events-none absolute inset-x-0 top-0">
        {overlay.labels.map((l, i) => (
          <div
            key={`label-${i}`}
            // Anchored inside the 80px bar: the drift peaks near its top edge,
            // so a pill never rides up into the period timeline above.
            className="absolute top-7 whitespace-nowrap"
            style={{ left: `${clampPct(l.leftPct)}%`, transform: 'translateX(-50%)' }}
          >
            {/* Positioning lives on the parent so the child owns transform alone. */}
            <span
              className={`csv-anim inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold shadow-sm backdrop-blur-sm ${l.tone}`}
              style={{ animation: `csvFloat ${l.durationMs}ms ${EASE} ${l.delayMs}ms both` }}
            >
              {l.text}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

// ── View ─────────────────────────────────────────────────────────────────────

export default function CapitalStackView({
  vault, loaded, viewOnly, connected, lastEvent,
}: {
  vault: VaultState | null;
  loaded: boolean;
  viewOnly: boolean;
  connected: boolean;
  lastEvent: StackEvent | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const stack = useMemo(() => {
    if (!vault) return null;
    const senior = vault.seniorDeposited - vault.seniorLoss;
    const junior = vault.juniorDeposited - vault.juniorLoss;
    const burned = vault.seniorLoss + vault.juniorLoss;
    // Burned capital keeps its width in the bar so the loss reads as a hole
    // punched in the stack, not as the whole stack quietly rescaling.
    const total = senior + junior + burned;
    if (total === ZERO) return null;
    const pct = (v: bigint) => Number((v * BigInt(1000)) / total) / 10;
    return { senior, junior, burned,
      seniorPct: pct(senior), juniorPct: pct(junior), burnedPct: pct(burned) };
  }, [vault]);

  const overlay = stack && lastEvent ? overlayFor(lastEvent, stack.seniorPct, stack.juniorPct) : null;

  const placeholder = !loaded
    ? 'Loading vault from devnet…'
    : vault
      ? 'Vault is live and empty — the stack fills with the first deposit.'
      : viewOnly
        ? 'No vault yet for this authority + mint.'
        : connected
          ? 'No vault yet — create one from the panel.'
          : 'Connect any devnet wallet to start.';

  return (
    <section>
      <style>{KEYFRAMES}</style>

      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-neutral-400">
          Capital stack
        </h2>
        <span className="text-[11px] text-neutral-500">{ASSET_LABEL}</span>
      </div>

      <PeriodTimeline phase={phaseIndex(vault)} />

      {stack && vault ? (
        <>
          {/* Overlays anchor to this wrapper, not to the bar itself: the bar
              is overflow-hidden and would clip the flow strips mid-sweep. */}
          <div className="relative">
            <div className="flex h-20 w-full overflow-hidden rounded-xl border border-white/10">
              <StackSegment
                pct={stack.seniorPct}
                value={stack.senior}
                label="Senior"
                tooltip={`Senior · ${fmt(stack.senior)} still standing · paid first, up to ${fmt(seniorEntitlement(vault))} per distribution, loses last`}
                className="bg-gradient-to-b from-sky-500/90 to-sky-700/90"
                onHover={setHovered}
              />
              <StackSegment
                pct={stack.juniorPct}
                value={stack.junior}
                label="Junior"
                tooltip={`Junior · ${fmt(stack.junior)} left of ${fmt(vault.juniorDeposited)} deposited · absorbs losses first`}
                className="bg-gradient-to-b from-orange-500/90 to-orange-700/90"
                onHover={setHovered}
              />
              <StackSegment
                pct={stack.burnedPct}
                value={stack.burned}
                label="Burned"
                tooltip={`Burned by loss events · ${fmt(stack.burned)} of tranche tokens destroyed for good`}
                className="border-l border-red-500/30"
                textClassName="text-red-300"
                hatched
                onHover={setHovered}
              />
            </div>
            {/* Remounting on lastEvent.at is what replays the keyframes. */}
            {overlay && lastEvent && <EventOverlay key={lastEvent.at} overlay={overlay} />}
          </div>

          {/* Always-legible readout: narrow slices hide their own text, and the
              bar's overflow-hidden would clip a floating tip. */}
          <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            <LegendItem swatch="bg-sky-500" label="Senior" value={fmt(stack.senior)} pct={stack.seniorPct} />
            <LegendItem swatch="bg-orange-500" label="Junior" value={fmt(stack.junior)} pct={stack.juniorPct} />
            {stack.burned > ZERO && (
              <LegendItem swatch="bg-red-500/60" label="Burned" value={fmt(stack.burned)} pct={stack.burnedPct} />
            )}
          </dl>
          <p className="mt-2 h-4 text-[11px] text-neutral-400">{hovered ?? ''}</p>
        </>
      ) : (
        <div className="flex h-20 items-center justify-center rounded-xl border border-dashed border-white/15 px-6 text-center text-sm text-neutral-500">
          {placeholder}
        </div>
      )}
    </section>
  );
}
