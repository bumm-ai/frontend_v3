/**
 * Unit tests for the build-queue chip logic.
 *
 * Mirrors the project's hook-test convention (pure-function tests, no jsdom /
 * renderHook): the show/hide + ETA-formatting decisions are extracted into the
 * pure deriveQueueChip()/formatQueueEta(), which we exercise directly. The
 * interval wiring inside useBuildQueue is the thin useEffect around this logic.
 *
 * Run: npx vitest run src/hooks/__tests__/useBuildQueue.test.ts
 */

import { describe, it, expect } from 'vitest';
import type { BuildQueueResponse } from '@/lib/api';
import { deriveQueueChip, formatQueueEta } from '@/hooks/useBuildQueue';

const resp = (over: Partial<BuildQueueResponse>): BuildQueueResponse => ({
  running: 4,
  queued: 0,
  capacity: 4,
  eta_seconds: 0,
  saturated: false,
  ...over,
});

describe('deriveQueueChip', () => {
  it('shows when saturated with a queue', () => {
    const s = deriveQueueChip(resp({ queued: 3, saturated: true, eta_seconds: 120 }));
    expect(s.visible).toBe(true);
    expect(s.queued).toBe(3);
    expect(s.etaLabel).toBe('~2m');
  });

  it('hides when not saturated', () => {
    expect(deriveQueueChip(resp({ queued: 0, saturated: false })).visible).toBe(false);
  });

  it('hides when saturated but queued is zero (defensive)', () => {
    expect(deriveQueueChip(resp({ queued: 0, saturated: true })).visible).toBe(false);
  });

  it('hides on a null response (error / not-yet-fetched)', () => {
    const s = deriveQueueChip(null);
    expect(s).toEqual({ visible: false, queued: 0, etaLabel: '' });
  });

  it('still shows position when ETA is unknown', () => {
    const s = deriveQueueChip(resp({ queued: 1, saturated: true, eta_seconds: 0 }));
    expect(s.visible).toBe(true);
    expect(s.etaLabel).toBe('');
  });
});

describe('formatQueueEta', () => {
  it('uses seconds under a minute', () => {
    expect(formatQueueEta(30)).toBe('~30s');
  });

  it('uses rounded minutes at/over a minute', () => {
    expect(formatQueueEta(120)).toBe('~2m');
    expect(formatQueueEta(90)).toBe('~2m'); // rounds
  });

  it('returns empty for non-positive / non-finite', () => {
    expect(formatQueueEta(0)).toBe('');
    expect(formatQueueEta(-5)).toBe('');
    expect(formatQueueEta(Number.NaN)).toBe('');
  });
});
