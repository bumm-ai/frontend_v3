import { describe, it, expect } from 'vitest';
import {
  shouldStreamBuildLogs,
  shouldShowFixTimeline,
} from '../chatScreenPanels';

describe('shouldStreamBuildLogs', () => {
  it('streams only while the derived stage is building and a uid exists', () => {
    expect(shouldStreamBuildLogs('uid-1', 'building')).toBe(true);
  });

  it('does not stream without a uid', () => {
    expect(shouldStreamBuildLogs(undefined, 'building')).toBe(false);
  });

  it('does not stream for non-building stages', () => {
    expect(shouldStreamBuildLogs('uid-1', 'generating')).toBe(false);
    expect(shouldStreamBuildLogs('uid-1', 'auditing')).toBe(false);
    expect(shouldStreamBuildLogs('uid-1', 'deploying')).toBe(false);
    expect(shouldStreamBuildLogs('uid-1', null)).toBe(false);
  });
});

describe('shouldShowFixTimeline', () => {
  it('shows when there are applied-fix entries', () => {
    expect(shouldShowFixTimeline('uid-1', 3, false, null)).toBe(true);
  });

  it('shows while loading or on error so the hook state is surfaced', () => {
    expect(shouldShowFixTimeline('uid-1', 0, true, null)).toBe(true);
    expect(shouldShowFixTimeline('uid-1', 0, false, 'boom')).toBe(true);
  });

  it('hides when there is nothing to show', () => {
    expect(shouldShowFixTimeline('uid-1', 0, false, null)).toBe(false);
  });

  it('hides when no contract is selected, even mid-load', () => {
    expect(shouldShowFixTimeline(undefined, 5, true, 'boom')).toBe(false);
  });
});
