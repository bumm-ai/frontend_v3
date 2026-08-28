/**
 * Pure instruction encoders + account decoders for tranched_vault V2.
 * Mirrors the deployed program's account order exactly (verified end-to-end
 * by the out-of-repo script suite before this page was built). Manual borsh —
 * no @coral-xyz/anchor dependency.
 */

import { sha256 } from '@noble/hashes/sha2';
import { Buffer } from 'buffer';
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js';

export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ATA_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
export const RENT_SYSVAR = new PublicKey('SysvarRent111111111111111111111111111111111');

export type Tranche = 'senior' | 'junior';

export interface VaultState {
  authority: PublicKey;
  assetMint: PublicKey;
  seniorMint: PublicKey;
  juniorMint: PublicKey;
  seniorDeposited: bigint;
  juniorDeposited: bigint;
  seniorCouponBps: number;
  seniorPaid: bigint;
  juniorPaid: bigint;
  totalRevenue: bigint;
  seniorLoss: bigint;
  juniorLoss: bigint;
  capitalDrawn: bigint;
  contractMonthly: bigint;
  contractMonths: number;
  seniorClaimed: bigint;
  juniorClaimed: bigint;
}

// Two on-chain layouts are in the wild: the original one, and V4 which adds
// senior_claimed/junior_claimed just before `bump`. Everything up to
// contract_months is byte-identical, so one decoder reads both and reports
// zero claimed coupon for pre-V4 vaults.
const VAULT_PREFIX = 8 + 32 * 4 + 8 + 8 + 2 + 8 + 8 + 8 + 8 + 8 + 8 + 8 + 2;
/** Smallest account that can still be a vault (pre-V4 layout + bump). */
export const VAULT_MIN_SIZE = VAULT_PREFIX + 1;
/** Account size once the claim fields are present. */
export const VAULT_V4_SIZE = VAULT_PREFIX + 8 + 8 + 1;

export interface VaultAddresses {
  vault: PublicKey;
  vaultTokens: PublicKey;
  seniorMint: PublicKey;
  juniorMint: PublicKey;
}

function disc(name: string): Buffer {
  return Buffer.from(sha256(Buffer.from(`global:${name}`, 'utf8')).slice(0, 8));
}

function u64le(v: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(v);
  return b;
}

function u16le(v: number): Buffer {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(v);
  return b;
}

export function deriveAddresses(
  programId: PublicKey,
  assetMint: PublicKey,
  authority: PublicKey,
): VaultAddresses {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), assetMint.toBuffer(), authority.toBuffer()],
    programId,
  );
  const [vaultTokens] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault_tokens'), vault.toBuffer()],
    programId,
  );
  const [seniorMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('senior_mint'), vault.toBuffer()],
    programId,
  );
  const [juniorMint] = PublicKey.findProgramAddressSync(
    [Buffer.from('junior_mint'), vault.toBuffer()],
    programId,
  );
  return { vault, vaultTokens, seniorMint, juniorMint };
}

export function ataFor(owner: PublicKey, mint: PublicKey): PublicKey {
  const [addr] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM_ID,
  );
  return addr;
}

const k = (pubkey: PublicKey, isSigner: boolean, isWritable: boolean) => ({
  pubkey,
  isSigner,
  isWritable,
});

export function ixInitialize(
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  couponBps: number,
  contractMonthly: bigint,
  contractMonths: number,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(d.seniorMint, false, true),
      k(d.juniorMint, false, true),
      k(TOKEN_PROGRAM_ID, false, false),
      k(SystemProgram.programId, false, false),
      k(RENT_SYSVAR, false, false),
    ],
    data: Buffer.concat([
      disc('initialize'),
      u16le(couponBps),
      u64le(contractMonthly),
      u16le(contractMonths),
    ]),
  });
}

export const MINT_ACCOUNT_SIZE = 82;

const BPS_DENOMINATOR = BigInt(10_000);

/**
 * Anchor custom error codes from the deployed IDL. Used to turn a wallet's
 * opaque "Unexpected error" into the actual reason the program rejected.
 */
const PROGRAM_ERRORS: Record<number, string> = {
  6000: 'Senior coupon must be 100% or less.',
  6001: 'Amount must be greater than zero.',
  6002: 'Arithmetic overflow.',
  6003: 'That loss is bigger than the whole capital stack — junior and senior together cannot absorb it.',
  6004: 'Amount exceeds the outstanding principal of that tranche.',
  6005: 'Your wallet does not hold enough tranche tokens to burn.',
  6006: 'Faucet amount exceeds the per-call cap.',
  6007: 'No coupon has accrued to claim yet.',
  6008: 'Token account mint does not match this vault.',
  6009: 'Token account is not owned by your wallet.',
  6010: 'That much of the vault cash is already earmarked for unclaimed coupons — the operator can only draw what sits above them.',
};

/**
 * Dig the real message out of a wallet error. Adapters wrap the underlying
 * failure ("Unexpected error" is the outer shell), so the useful text sits on
 * `.error`, `.cause` or the attached simulation logs.
 */
export function unwrapWalletError(e: unknown): { message: string; logs: string[] | null } {
  const seen = new Set<unknown>();
  let logs: string[] | null = null;
  const messages: string[] = [];
  let node: unknown = e;
  while (node && typeof node === 'object' && !seen.has(node)) {
    seen.add(node);
    const o = node as { message?: unknown; logs?: unknown; error?: unknown; cause?: unknown };
    if (typeof o.message === 'string' && o.message.trim()) messages.push(o.message.trim());
    if (Array.isArray(o.logs)) logs = o.logs as string[];
    node = o.error ?? o.cause;
  }
  // Prefer the innermost message: the outer one is the generic wrapper.
  const specific = messages.reverse().find((m) => !/^unexpected error$/i.test(m));
  return { message: specific ?? messages[0] ?? String(e), logs };
}

/** Human-readable reason from simulation logs / a thrown wallet error. */
export function explainProgramError(logs: string[] | null | undefined, raw: string): string {
  const joined = (logs ?? []).join('\n');
  const custom = joined.match(/custom program error: 0x([0-9a-fA-F]+)/)
    ?? raw.match(/custom program error: 0x([0-9a-fA-F]+)/);
  if (custom) {
    const code = parseInt(custom[1], 16);
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  }
  if (/[Bb]lockhash not found/.test(joined + raw)) {
    return 'The transaction waited too long for your signature and its blockhash expired — just press the button again and approve promptly.';
  }
  if (/insufficient lamports|Transfer: insufficient lamports/i.test(joined + raw)) {
    return 'Not enough devnet SOL to pay rent for the new accounts — top up at faucet.solana.com and retry.';
  }
  if (/insufficient funds|InsufficientFunds/i.test(joined)) {
    return 'Not enough tokens for this transfer — check vault liquidity and your balance.';
  }
  if (/AccountNotInitialized|3012/.test(joined)) {
    return 'An account this action needs does not exist yet — deposit into that tranche first.';
  }
  const programLine = (logs ?? []).find((l) => l.includes('Error Message:'));
  if (programLine) return programLine.replace(/.*Error Message:\s*/, '');
  return raw;
}

/**
 * Senior's cap for a SINGLE distribution: coupon_bps on SURVIVING senior
 * principal (deposited − loss — burned principal earns nothing). Mirrors
 * `allocate_waterfall` on-chain. Per-distribution, not cumulative — one
 * payment stands in for one monthly settlement.
 */
export function seniorEntitlement(vault: VaultState): bigint {
  return (
    ((vault.seniorDeposited - vault.seniorLoss) * BigInt(vault.seniorCouponBps)) /
    BPS_DENOMINATOR
  );
}

/** How much of the junior tranche can still absorb a loss. */
export function juniorLossCapacity(vault: VaultState): bigint {
  return vault.juniorDeposited - vault.juniorLoss;
}

/** How much of the senior tranche can still absorb a loss (junior gone). */
export function seniorLossCapacity(vault: VaultState): bigint {
  return vault.seniorDeposited - vault.seniorLoss;
}

/** Waterfall, top down: senior takes its capped coupon first, junior the rest. */
export function previewRevenueSplit(
  vault: VaultState,
  amount: bigint,
): { senior: bigint; junior: bigint } {
  const cap = seniorEntitlement(vault);
  const senior = amount < cap ? amount : cap;
  return { senior, junior: amount - senior };
}

/**
 * Loss absorption, bottom up with excess spread: junior's accrued-but-
 * unclaimed coupon is consumed first (no burn — the cash stays and funds
 * redemptions), then junior principal burns, then senior principal.
 * Mirrors `record_loss` on-chain.
 */
export function previewLossSplit(
  vault: VaultState,
  amount: bigint,
): { spread: bigint; junior: bigint; senior: bigint; exceedsAll: boolean } {
  const spreadCap = vault.juniorPaid - vault.juniorClaimed;
  const spread = amount < spreadCap ? amount : spreadCap;
  const afterSpread = amount - spread;
  const jCap = juniorLossCapacity(vault);
  const junior = afterSpread < jCap ? afterSpread : jCap;
  const senior = afterSpread - junior;
  return { spread, junior, senior, exceedsAll: senior > seniorLossCapacity(vault) };
}

/** PDA that holds mint authority for faucet-enabled demo asset mints. */
export function faucetAuthorityFor(programId: PublicKey, assetMint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('faucet'), assetMint.toBuffer()],
    programId,
  )[0];
}

/**
 * SPL-Token InitializeMint2 (instruction 20) — used by "fresh run" to create
 * a brand-new demo asset mint whose mint authority is the faucet PDA, so the
 * on-chain faucet can serve it immediately. No freeze authority.
 */
export function ixInitializeMint2(
  mint: PublicKey,
  decimals: number,
  mintAuthority: PublicKey,
): TransactionInstruction {
  const data = Buffer.alloc(1 + 1 + 32 + 1);
  data.writeUInt8(20, 0);
  data.writeUInt8(decimals, 1);
  mintAuthority.toBuffer().copy(data, 2);
  data.writeUInt8(0, 34);
  return new TransactionInstruction({
    programId: TOKEN_PROGRAM_ID,
    keys: [k(mint, false, true)],
    data,
  });
}

export function ixFaucet(
  programId: PublicKey,
  user: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const [faucetAuthority] = PublicKey.findProgramAddressSync(
    [Buffer.from('faucet'), assetMint.toBuffer()],
    programId,
  );
  return new TransactionInstruction({
    programId,
    keys: [
      k(user, true, true),
      k(assetMint, false, true),
      k(faucetAuthority, false, false),
      k(ataFor(user, assetMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
      k(ATA_PROGRAM_ID, false, false),
      k(SystemProgram.programId, false, false),
    ],
    data: Buffer.concat([disc('faucet'), u64le(amount)]),
  });
}

export function ixDeposit(
  tranche: Tranche,
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  const trancheMint = tranche === 'senior' ? d.seniorMint : d.juniorMint;
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(ataFor(authority, assetMint), false, true),
      k(trancheMint, false, true),
      k(ataFor(authority, trancheMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
      k(ATA_PROGRAM_ID, false, false),
      k(SystemProgram.programId, false, false),
    ],
    data: Buffer.concat([disc(`deposit_${tranche}`), u64le(amount)]),
  });
}

/** Operator returns drawn capital — same accounts as a deposit/revenue call. */
export function ixRepayCapital(
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(ataFor(authority, assetMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.concat([disc('repay_capital'), u64le(amount)]),
  });
}

/** Pay out the coupon a tranche has accrued but not yet received. */
export function ixClaim(
  tranche: Tranche,
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(ataFor(authority, assetMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: disc(tranche === 'senior' ? 'claim_senior' : 'claim_junior'),
  });
}

/** Coupon accrued to a tranche that has not been paid out yet. */
export function unclaimedCoupon(vault: VaultState, tranche: Tranche): bigint {
  return tranche === 'senior'
    ? vault.seniorPaid - vault.seniorClaimed
    : vault.juniorPaid - vault.juniorClaimed;
}

/**
 * Junior coupon consumed by losses so far (excess spread), derived purely
 * from on-chain state: every distribution credits senior_paid + junior_paid
 * with the full amount, and the ONLY thing that ever reduces them is a loss
 * eating junior's unclaimed coupon — so the gap to total_revenue IS the
 * consumed spread. Survives reloads, unlike the session event feed.
 */
export function spreadConsumed(vault: VaultState): bigint {
  return vault.totalRevenue - vault.seniorPaid - vault.juniorPaid;
}

export function ixDrawCapital(
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(ataFor(authority, assetMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.concat([disc('draw_capital'), u64le(amount)]),
  });
}

/**
 * The offtake counterparty pays its monthly bill: the offtaker faucet PDA
 * mints the payment straight into the vault's token account and the waterfall
 * allocates it — revenue enters from OUTSIDE the capital stack, never from
 * the operator's wallet.
 */
export function ixOfftakerPayment(
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, true),
      k(faucetAuthorityFor(programId, assetMint), false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.concat([disc('offtaker_payment'), u64le(amount)]),
  });
}

export function ixDistribute(
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(ataFor(authority, assetMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.concat([disc('distribute_revenue'), u64le(amount)]),
  });
}

export function ixRecordLoss(
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, false),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.seniorMint, false, true),
      k(d.juniorMint, false, true),
      k(ataFor(authority, d.seniorMint), false, true),
      k(ataFor(authority, d.juniorMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.concat([disc('record_loss'), u64le(amount)]),
  });
}

export function ixRedeem(
  tranche: Tranche,
  programId: PublicKey,
  authority: PublicKey,
  assetMint: PublicKey,
  amount: bigint,
): TransactionInstruction {
  const d = deriveAddresses(programId, assetMint, authority);
  const trancheMint = tranche === 'senior' ? d.seniorMint : d.juniorMint;
  return new TransactionInstruction({
    programId,
    keys: [
      k(authority, true, true),
      k(assetMint, false, false),
      k(d.vault, false, true),
      k(d.vaultTokens, false, true),
      k(trancheMint, false, true),
      k(ataFor(authority, trancheMint), false, true),
      k(ataFor(authority, assetMint), false, true),
      k(TOKEN_PROGRAM_ID, false, false),
    ],
    data: Buffer.concat([disc(`redeem_${tranche}`), u64le(amount)]),
  });
}

// Vault V2 layout: 8 disc | 4 pubkeys | senior_deposited 8 | junior_deposited 8
// | senior_coupon_bps 2 | senior_paid 8 | junior_paid 8 | total_revenue 8
// | senior_loss 8 | junior_loss 8 | capital_drawn 8 | contract_monthly 8
// | contract_months 2 | bump 1
export function decodeVault(data: Uint8Array): VaultState | null {
  if (data.length < VAULT_MIN_SIZE) return null;
  const hasClaimFields = data.length >= VAULT_V4_SIZE;
  const d = Buffer.from(data);
  let o = 8;
  const pk = () => {
    const v = new PublicKey(d.subarray(o, o + 32));
    o += 32;
    return v;
  };
  const u64 = () => {
    const v = d.readBigUInt64LE(o);
    o += 8;
    return v;
  };
  const u16 = () => {
    const v = d.readUInt16LE(o);
    o += 2;
    return v;
  };
  return {
    authority: pk(),
    assetMint: pk(),
    seniorMint: pk(),
    juniorMint: pk(),
    seniorDeposited: u64(),
    juniorDeposited: u64(),
    seniorCouponBps: u16(),
    seniorPaid: u64(),
    juniorPaid: u64(),
    totalRevenue: u64(),
    seniorLoss: u64(),
    juniorLoss: u64(),
    capitalDrawn: u64(),
    contractMonthly: u64(),
    contractMonths: u16(),
    seniorClaimed: hasClaimFields ? u64() : BigInt(0),
    juniorClaimed: hasClaimFields ? u64() : BigInt(0),
  };
}

/** Token account balance (amount @ offset 64); 0 if the account is absent. */
export function decodeTokenAmount(data: Uint8Array | null): bigint {
  if (!data || data.length < 72) return BigInt(0);
  return Buffer.from(data).readBigUInt64LE(64);
}

/** Mint supply (@ offset 36); 0 if absent. */
export function decodeMintSupply(data: Uint8Array | null): bigint {
  if (!data || data.length < 44) return BigInt(0);
  return Buffer.from(data).readBigUInt64LE(36);
}
