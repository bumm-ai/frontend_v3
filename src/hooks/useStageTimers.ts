'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Tracks wall-clock duration spent in each pipeline stage.
 *
 * Pure client-side bookkeeping — backend does not (yet) emit per-stage
 * timestamps, so we stamp the first time we *see* a stage become current,
 * and stamp the first time we see it land in `completedIds`.
 *
 *   - `getElapsed(id)` → whole seconds the stage has run; live while active,
 *     frozen once completed, `null` if the stage hasn't started yet.
 *   - `isRunning(id)` → started, not yet completed.
 *
 * Timers reset when `resetKey` changes (e.g. new contract uid or re-run).
 *
 * IMPORTANT: stamping is done synchronously during render, NOT in an
 * effect with `[currentId, completedIds]` deps. The previous version had
 * a race: when `resetKey` changed, the synchronous reset wiped the stamp
 * store, but the stamping effect did not re-fire if `currentId` /
 * `completedIds` were unchanged — so timers were pinned at 0 forever.
 */
export interface StageTimersApi {
  getElapsed: (stageId: string) => number | null;
  isRunning: (stageId: string) => boolean;
}

export function useStageTimers(
  currentId: string | null,
  completedIds: string[],
  resetKey: string = 'default',
): StageTimersApi {
  const startsRef = useRef<Record<string, number>>({});
  const endsRef = useRef<Record<string, number>>({});
  const keyRef = useRef<string>(resetKey);
  const [, forceTick] = useState(0);

  // Reset when the caller signals a new tracking session.
  if (keyRef.current !== resetKey) {
    keyRef.current = resetKey;
    startsRef.current = {};
    endsRef.current = {};
  }

  // Synchronous stamping — every render that observes a non-stamped stage
  // captures `now` immediately. Survives `resetKey` changes correctly.
  const now = Date.now();
  if (currentId && startsRef.current[currentId] === undefined) {
    startsRef.current[currentId] = now;
  }
  for (const id of completedIds) {
    if (startsRef.current[id] === undefined) {
      // Completed before we ever observed it active — stamp both so the
      // display reads "0s" instead of blank.
      startsRef.current[id] = now;
    }
    if (endsRef.current[id] === undefined) {
      endsRef.current[id] = now;
    }
  }

  // Live tick — drives re-renders so `getElapsed` updates while a stage runs.
  // Always running (cheap 500ms interval) so we don't have to chase deps.
  useEffect(() => {
    const iv = setInterval(() => forceTick((x) => x + 1), 500);
    return () => clearInterval(iv);
  }, []);

  const getElapsed = (id: string): number | null => {
    const start = startsRef.current[id];
    if (start === undefined) return null;
    const end = endsRef.current[id] ?? Date.now();
    return Math.max(0, Math.floor((end - start) / 1000));
  };

  const isRunning = (id: string): boolean =>
    startsRef.current[id] !== undefined && endsRef.current[id] === undefined;

  return { getElapsed, isRunning };
}

/** Format whole seconds as `12s` / `1:23` / `12:05`. */
export function formatElapsed(seconds: number | null): string {
  if (seconds === null) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
