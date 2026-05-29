/**
 * Unit tests for pickSubStepIndex — the pure bucket-picker that maps elapsed
 * seconds onto an ascending list of cumulative thresholds, driving which
 * sub-step label is highlighted during a long-running phase.
 *
 * Pure-function tests only (no jsdom / renderHook), per project convention.
 *
 * Run: npx vitest run src/hooks/__tests__/usePhaseTimer.test.ts
 */

import { describe, it, expect } from 'vitest';
import { pickSubStepIndex } from '@/hooks/usePhaseTimer';

describe('pickSubStepIndex', () => {
  const thresholds = [10, 30, 90];

  it('returns 0 before the first threshold', () => {
    expect(pickSubStepIndex(0, thresholds)).toBe(0);
    expect(pickSubStepIndex(9, thresholds)).toBe(0);
  });

  it('advances at each threshold boundary (inclusive lower edge)', () => {
    expect(pickSubStepIndex(10, thresholds)).toBe(1);
    expect(pickSubStepIndex(29, thresholds)).toBe(1);
    expect(pickSubStepIndex(30, thresholds)).toBe(2);
    expect(pickSubStepIndex(89, thresholds)).toBe(2);
  });

  it('sits in the final unbounded bucket at/after the last threshold', () => {
    expect(pickSubStepIndex(90, thresholds)).toBe(3);
    expect(pickSubStepIndex(10_000, thresholds)).toBe(3);
  });

  it('returns 0 for an empty threshold list', () => {
    expect(pickSubStepIndex(0, [])).toBe(0);
    expect(pickSubStepIndex(999, [])).toBe(0);
  });

  it('treats the exact threshold as belonging to the next bucket', () => {
    // strictly-less-than comparison: elapsed === threshold advances.
    expect(pickSubStepIndex(5, [5])).toBe(1);
    expect(pickSubStepIndex(4, [5])).toBe(0);
  });
});
