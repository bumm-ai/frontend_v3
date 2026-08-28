import { describe, it, expect } from 'vitest';
import {
  shortenSignature,
  txStatus,
  relativeTime,
  absoluteTime,
  explorerTxUrl,
  explorerProgramUrl,
  toTxRowView,
  type SignatureRow,
} from '../txHistory';

// A realistic ~88-char base58 signature for the shortening assertions.
const SIG =
  '5VER5jTfjiVdJZ4kQ8x1xWQ2qH3o1m6Yk9pZ8m7L2cN4bV6dF8gH1jK3lM5nP7qR9sT1uW3xY5zA7';
const PROGRAM = 'BAKRCCTEyqBRi2FcJJJfDwFKSUrDc9zzhE21HCsH8pb2';

describe('shortenSignature', () => {
  it('renders head…tail for a long signature', () => {
    expect(shortenSignature(SIG)).toBe(`${SIG.slice(0, 4)}…${SIG.slice(-4)}`);
  });

  it('uses a single ellipsis as separator (not "...")', () => {
    expect(shortenSignature(SIG)).toContain('…');
    expect(shortenSignature(SIG)).not.toContain('...');
  });

  it('respects custom head/tail lengths', () => {
    expect(shortenSignature(SIG, 6, 6)).toBe(
      `${SIG.slice(0, 6)}…${SIG.slice(-6)}`,
    );
  });

  it('returns short strings unchanged (no ellipsis when it would not save space)', () => {
    expect(shortenSignature('abc')).toBe('abc');
    // length exactly head+tail+1 is left intact
    expect(shortenSignature('123456789')).toBe('123456789');
  });

  it('handles empty input', () => {
    expect(shortenSignature('')).toBe('');
  });
});

describe('txStatus', () => {
  it('maps null err to success', () => {
    expect(txStatus(null)).toBe('success');
  });

  it('maps undefined err to success', () => {
    expect(txStatus(undefined)).toBe('success');
  });

  it('maps a non-null err object to failed', () => {
    expect(txStatus({ InstructionError: [0, 'Custom'] })).toBe('failed');
  });

  it('treats a falsy-but-present value like 0 as failed (only null/undefined are success)', () => {
    expect(txStatus(0 as unknown)).toBe('failed');
  });
});

describe('relativeTime', () => {
  const NOW_MS = 1_700_000_000_000; // fixed anchor
  const nowSec = NOW_MS / 1000;

  it('returns null when block time is missing', () => {
    expect(relativeTime(null, NOW_MS)).toBeNull();
    expect(relativeTime(undefined, NOW_MS)).toBeNull();
  });

  it('shows "just now" for very recent times', () => {
    expect(relativeTime(nowSec, NOW_MS)).toBe('just now');
    expect(relativeTime(nowSec - 3, NOW_MS)).toBe('just now');
  });

  it('shows seconds, minutes, hours, days', () => {
    expect(relativeTime(nowSec - 30, NOW_MS)).toBe('30s ago');
    expect(relativeTime(nowSec - 5 * 60, NOW_MS)).toBe('5m ago');
    expect(relativeTime(nowSec - 3 * 3600, NOW_MS)).toBe('3h ago');
    expect(relativeTime(nowSec - 2 * 86400, NOW_MS)).toBe('2d ago');
  });

  it('shows months and years for older times', () => {
    expect(relativeTime(nowSec - 60 * 86400, NOW_MS)).toBe('2mo ago');
    expect(relativeTime(nowSec - 400 * 86400, NOW_MS)).toBe('1y ago');
  });

  it('never shows a future time (clamps clock skew to "just now")', () => {
    expect(relativeTime(nowSec + 120, NOW_MS)).toBe('just now');
  });
});

describe('absoluteTime', () => {
  it('returns null when block time is missing', () => {
    expect(absoluteTime(null)).toBeNull();
    expect(absoluteTime(undefined)).toBeNull();
  });

  it('returns a non-empty locale string for a real block time', () => {
    const out = absoluteTime(1_700_000_000);
    expect(typeof out).toBe('string');
    expect((out ?? '').length).toBeGreaterThan(0);
  });

  it('matches Date#toLocaleString for the same instant', () => {
    expect(absoluteTime(1_700_000_000)).toBe(
      new Date(1_700_000_000 * 1000).toLocaleString(),
    );
  });
});

describe('explorerTxUrl', () => {
  it('adds ?cluster=devnet for devnet', () => {
    expect(explorerTxUrl(SIG, 'devnet')).toBe(
      `https://explorer.solana.com/tx/${SIG}?cluster=devnet`,
    );
  });

  it('omits the cluster param for mainnet-beta', () => {
    expect(explorerTxUrl(SIG, 'mainnet-beta')).toBe(
      `https://explorer.solana.com/tx/${SIG}`,
    );
  });

  it('falls back to devnet when network is missing', () => {
    expect(explorerTxUrl(SIG, null)).toBe(
      `https://explorer.solana.com/tx/${SIG}?cluster=devnet`,
    );
    expect(explorerTxUrl(SIG)).toBe(
      `https://explorer.solana.com/tx/${SIG}?cluster=devnet`,
    );
  });
});

describe('explorerProgramUrl', () => {
  it('builds an address URL with the right cluster', () => {
    expect(explorerProgramUrl(PROGRAM, 'devnet')).toBe(
      `https://explorer.solana.com/address/${PROGRAM}?cluster=devnet`,
    );
    expect(explorerProgramUrl(PROGRAM, 'mainnet-beta')).toBe(
      `https://explorer.solana.com/address/${PROGRAM}`,
    );
  });
});

describe('toTxRowView', () => {
  const NOW_MS = 1_700_000_000_000;
  const row: SignatureRow = {
    signature: SIG,
    blockTime: NOW_MS / 1000 - 120,
    slot: 123456,
    err: null,
  };

  it('derives the full view model from a successful row', () => {
    const v = toTxRowView(row, 'devnet', NOW_MS);
    expect(v.signature).toBe(SIG);
    expect(v.shortSignature).toBe(`${SIG.slice(0, 4)}…${SIG.slice(-4)}`);
    expect(v.relativeTime).toBe('2m ago');
    expect(v.absoluteTime).toBe(new Date((NOW_MS / 1000 - 120) * 1000).toLocaleString());
    expect(v.slot).toBe(123456);
    expect(v.status).toBe('success');
    expect(v.explorerUrl).toBe(
      `https://explorer.solana.com/tx/${SIG}?cluster=devnet`,
    );
  });

  it('reflects a failed transaction and missing block time', () => {
    const v = toTxRowView(
      { signature: SIG, blockTime: null, slot: 7, err: { x: 1 } },
      'mainnet-beta',
      NOW_MS,
    );
    expect(v.status).toBe('failed');
    expect(v.relativeTime).toBeNull();
    expect(v.absoluteTime).toBeNull();
    expect(v.explorerUrl).toBe(`https://explorer.solana.com/tx/${SIG}`);
  });
});
