/**
 * Unit tests for formatElapsed — the pure seconds→label formatter used by the
 * per-stage timers (`12s`, `1:23`, `12:05`).
 *
 * Pure-function tests only (no jsdom / renderHook), per project convention.
 *
 * Run: npx vitest run src/hooks/__tests__/useStageTimers.test.ts
 */

import { describe, it, expect } from 'vitest';
import { formatElapsed } from '@/hooks/useStageTimers';

describe('formatElapsed', () => {
  it('returns an empty string for null (timer not started)', () => {
    expect(formatElapsed(null)).toBe('');
  });

  it('renders sub-minute durations with an "s" suffix', () => {
    expect(formatElapsed(0)).toBe('0s');
    expect(formatElapsed(12)).toBe('12s');
    expect(formatElapsed(59)).toBe('59s');
  });

  it('switches to m:ss at one minute and zero-pads the seconds', () => {
    expect(formatElapsed(60)).toBe('1:00');
    expect(formatElapsed(83)).toBe('1:23');
    expect(formatElapsed(65)).toBe('1:05');
  });

  it('handles multi-minute durations', () => {
    expect(formatElapsed(725)).toBe('12:05');
    expect(formatElapsed(600)).toBe('10:00');
  });
});
