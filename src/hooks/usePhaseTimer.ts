'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks how long the current phase has been active.
 *
 * Caller passes a `phase` string (real backend phase, or a synthetic
 * constant like `'build-active'` when the timer should start at component
 * mount regardless of backend phase transitions). The hook stamps the
 * wall-clock time the first time it sees a particular phase value and
 * exposes a live-updating elapsed-seconds counter.
 *
 *   - `getPhaseElapsed()` → seconds since the *current* phase first appeared.
 *
 * Resets when `resetKey` changes (e.g. new contract uid).
 *
 * IMPORTANT: stamping is done **synchronously during render**, not in a
 * `useEffect`. A previous version stamped via effect with deps `[phase]`,
 * which had a fatal race when `resetKey` changed mid-flight: the reset
 * wiped the stamp store, but because `phase` itself was unchanged, the
 * effect did not re-fire — leaving the elapsed counter pinned at 0
 * forever. With synchronous stamping, the next render after a reset
 * always re-stamps and the timer resumes correctly.
 */
export function usePhaseTimer(
  phase: string | null | undefined,
  resetKey: string = 'default',
  tickIntervalMs: number = 1000,
): { phaseElapsedSeconds: number } {
  const startsRef = useRef<Record<string, number>>({});
  const keyRef = useRef<string>(resetKey);
  const [, setTick] = useState(0);

  // Reset when the caller signals a new tracking session.
  if (keyRef.current !== resetKey) {
    keyRef.current = resetKey;
    startsRef.current = {};
  }

  // Synchronous stamping — every render that observes a non-stamped phase
  // captures `now` immediately. Survives `resetKey` changes correctly.
  if (phase && startsRef.current[phase] === undefined) {
    startsRef.current[phase] = Date.now();
  }

  // Live tick — drives re-renders so `phaseElapsedSeconds` updates.
  useEffect(() => {
    const iv = setInterval(() => setTick((x) => x + 1), tickIntervalMs);
    return () => clearInterval(iv);
  }, [tickIntervalMs]);

  let phaseElapsedSeconds = 0;
  if (phase && startsRef.current[phase] !== undefined) {
    phaseElapsedSeconds = Math.max(
      0,
      Math.floor((Date.now() - startsRef.current[phase]) / 1000),
    );
  }

  return { phaseElapsedSeconds };
}

/**
 * Pick the index of the active sub-step given elapsed seconds and an
 * ascending list of cumulative thresholds.
 *
 * Example: thresholds=[10, 30, 90] → returns 0 for 0–9s, 1 for 10–29s,
 * 2 for 30–89s, 3 for 90s+. The final bucket has no upper bound — it
 * sits there until the outer phase changes.
 */
export function pickSubStepIndex(
  elapsedSeconds: number,
  thresholds: number[],
): number {
  let i = 0;
  for (const t of thresholds) {
    if (elapsedSeconds < t) return i;
    i += 1;
  }
  return i;
}
