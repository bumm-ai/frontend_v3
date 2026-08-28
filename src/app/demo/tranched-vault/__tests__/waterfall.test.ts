import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  explainProgramError,
  juniorLossCapacity,
  previewLossSplit,
  previewRevenueSplit,
  seniorEntitlement,
  spreadConsumed,
  type VaultState,
} from '../vaultTx';

const M = (n: number) => BigInt(n) * BigInt(1_000_000); // 6 decimals

function vault(over: Partial<VaultState> = {}): VaultState {
  const zero = new PublicKey('11111111111111111111111111111111');
  return {
    authority: zero,
    assetMint: zero,
    seniorMint: zero,
    juniorMint: zero,
    seniorDeposited: M(700_000),
    juniorDeposited: M(300_000),
    seniorCouponBps: 600,
    seniorPaid: BigInt(0),
    juniorPaid: BigInt(0),
    totalRevenue: BigInt(0),
    seniorLoss: BigInt(0),
    juniorLoss: BigInt(0),
    capitalDrawn: BigInt(0),
    contractMonthly: M(10_000),
    contractMonths: 36,
    seniorClaimed: BigInt(0),
    juniorClaimed: BigInt(0),
    ...over,
  };
}

describe('seniorEntitlement', () => {
  it('is the coupon on senior principal, per distribution', () => {
    expect(seniorEntitlement(vault())).toBe(M(42_000)); // 6% of 700k
  });

  it('shrinks after senior redeems principal', () => {
    expect(seniorEntitlement(vault({ seniorDeposited: M(350_000) }))).toBe(M(21_000));
  });

  it('accrues nothing on burned principal', () => {
    expect(seniorEntitlement(vault({ seniorLoss: M(100_000) }))).toBe(M(36_000)); // 6% of 600k
  });
});

describe('previewRevenueSplit — waterfall pays top down', () => {
  it('caps senior and hands the remainder to junior', () => {
    expect(previewRevenueSplit(vault(), M(100_000))).toEqual({
      senior: M(42_000),
      junior: M(58_000),
    });
  });

  it('gives junior nothing when revenue is under the senior cap', () => {
    expect(previewRevenueSplit(vault(), M(30_000))).toEqual({
      senior: M(30_000),
      junior: BigInt(0),
    });
  });

  it('is per-distribution, not cumulative — a second identical call splits the same', () => {
    const afterOne = vault({ seniorPaid: M(42_000), juniorPaid: M(58_000), totalRevenue: M(100_000) });
    expect(previewRevenueSplit(afterOne, M(100_000))).toEqual({
      senior: M(42_000),
      junior: M(58_000),
    });
  });
});

describe('previewLossSplit — excess spread, then junior principal, then senior', () => {
  it('with no accrued coupon the whole hit lands on junior principal', () => {
    expect(previewLossSplit(vault(), M(80_000))).toEqual({
      spread: BigInt(0),
      junior: M(80_000),
      senior: BigInt(0),
      exceedsAll: false,
    });
  });

  it('consumes the unclaimed junior coupon before burning any principal (the demo scenario)', () => {
    const funded = vault({ seniorPaid: M(42_000), juniorPaid: M(58_000) });
    expect(previewLossSplit(funded, M(80_000))).toEqual({
      spread: M(58_000),
      junior: M(22_000),
      senior: BigInt(0),
      exceedsAll: false,
    });
  });

  it('a loss smaller than the spread never touches principal at all', () => {
    const funded = vault({ juniorPaid: M(58_000) });
    expect(previewLossSplit(funded, M(30_000))).toEqual({
      spread: M(30_000),
      junior: BigInt(0),
      senior: BigInt(0),
      exceedsAll: false,
    });
  });

  it('coupon already claimed is out of reach — cash in the wallet cannot absorb anything', () => {
    const claimed = vault({ juniorPaid: M(58_000), juniorClaimed: M(58_000) });
    expect(previewLossSplit(claimed, M(80_000))).toEqual({
      spread: BigInt(0),
      junior: M(80_000),
      senior: BigInt(0),
      exceedsAll: false,
    });
  });

  it('spills into senior only once spread and junior principal are both exhausted', () => {
    const funded = vault({ juniorPaid: M(58_000) });
    expect(previewLossSplit(funded, M(400_000))).toEqual({
      spread: M(58_000),
      junior: M(300_000),
      senior: M(42_000),
      exceedsAll: false,
    });
  });

  it('junior can be wiped out entirely', () => {
    const wiped = vault({ juniorLoss: M(300_000) });
    expect(juniorLossCapacity(wiped)).toBe(BigInt(0));
    expect(previewLossSplit(wiped, M(10_000))).toEqual({
      spread: BigInt(0),
      junior: BigInt(0),
      senior: M(10_000),
      exceedsAll: false,
    });
  });

  it('flags a loss larger than the whole stack (the on-chain call would revert)', () => {
    expect(previewLossSplit(vault(), M(1_200_000)).exceedsAll).toBe(true);
  });
});

describe('spreadConsumed — coupon eaten by write-downs, derived from chain state', () => {
  it('is zero while every distribution is still fully credited', () => {
    const funded = vault({ seniorPaid: M(42_000), juniorPaid: M(58_000), totalRevenue: M(100_000) });
    expect(spreadConsumed(funded)).toBe(BigInt(0));
  });

  it('equals the gap the loss carved out of junior_paid (the demo scenario)', () => {
    const after = vault({ seniorPaid: M(42_000), juniorPaid: BigInt(0), totalRevenue: M(100_000), juniorLoss: M(22_000) });
    expect(spreadConsumed(after)).toBe(M(58_000));
  });

  it('claims do not count — they move cash, not the paid counters', () => {
    const claimed = vault({
      seniorPaid: M(42_000), seniorClaimed: M(42_000),
      juniorPaid: M(58_000), juniorClaimed: M(58_000),
      totalRevenue: M(100_000),
    });
    expect(spreadConsumed(claimed)).toBe(BigInt(0));
  });
});

describe('explainProgramError', () => {
  // Captured verbatim from a devnet simulation of an oversized record_loss.
  const realLogs = [
    'Program log: Instruction: RecordLoss',
    'Program log: AnchorError thrown in src/lib.rs:276. Error Code: LossExceedsCapacity. Error Number: 6003. Error Message: loss exceeds remaining tranche capacity.',
    'Program DvqUzXXWUdLqCnpy6Nb59PY29oVamfC7ME6bNimHxCGa failed: custom program error: 0x1773',
  ];

  it('turns the 0x1773 revert into the capital-stack explanation', () => {
    expect(explainProgramError(realLogs, 'Unexpected error')).toMatch(/bigger than the whole capital stack/);
  });

  it('reads the code out of a thrown wallet error when no logs are attached', () => {
    expect(explainProgramError(null, 'custom program error: 0x1775')).toMatch(/not hold enough tranche tokens/);
  });

  it('explains the coupon-solvency guard on an oversized draw', () => {
    expect(explainProgramError(null, 'custom program error: 0x177a')).toMatch(/earmarked for unclaimed coupons/);
  });

  it('explains a missing account instead of leaking the raw code', () => {
    expect(
      explainProgramError(['Program log: AnchorError caused by account: senior_account. Error Code: AccountNotInitialized.'], 'x'),
    ).toMatch(/does not exist yet/);
  });

  it('falls back to the raw message when nothing matches', () => {
    expect(explainProgramError(null, 'User rejected the request')).toBe('User rejected the request');
  });
});
