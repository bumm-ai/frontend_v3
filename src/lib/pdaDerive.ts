/**
 * Pure (no-React) PDA auto-derivation for IDL action forms.
 *
 * Given an IDL instruction account that carries a `pda` definition, this module
 * turns the declared seeds into concrete `Buffer`s and calls
 * `PublicKey.findProgramAddressSync(seeds, programId)` to derive the account
 * address — so the user no longer has to compute it by hand.
 *
 * Anchor IDL `pda.seeds` shapes handled (0.30 canonical + legacy 0.29 forms):
 *   - const:   { kind: 'const', value: number[] }            ← raw bytes (0.30)
 *              { kind: 'const', value: string, type: 'string' } ← utf8 (legacy)
 *              { kind: 'const', value: number[], type: 'bytes' } ← bytes (legacy)
 *   - arg:     { kind: 'arg', path: 'argName' }              ← value from args
 *   - account: { kind: 'account', path: 'accountName' }      ← value from accts
 *
 * For `arg`/`account` seeds the seed bytes are produced from the *already
 * entered* form value (a pubkey → 32 raw bytes; an integer → little-endian; a
 * string → utf8). When a referenced value is still missing the derivation is
 * "pending" — the caller falls back to a manual input and tells the user which
 * field to fill.
 *
 * Everything here is synchronous and dependency-light (web3.js `PublicKey` +
 * `buffer`) so it is trivially unit-testable.
 */
import { Buffer } from 'buffer';
import { PublicKey } from '@solana/web3.js';

/** A single declared seed from an IDL account's `pda.seeds`. */
export interface IdlPdaSeedConst {
  kind: 'const';
  value: number[] | string;
  type?: string;
}
export interface IdlPdaSeedArg {
  kind: 'arg';
  path: string;
}
export interface IdlPdaSeedAccount {
  kind: 'account';
  path: string;
}
export type IdlPdaSeed =
  | IdlPdaSeedConst
  | IdlPdaSeedArg
  | IdlPdaSeedAccount;

export interface IdlPda {
  seeds: IdlPdaSeed[];
  // `program` (custom program-id for the derivation) is intentionally ignored:
  // the common case derives against the owning program, and supporting an
  // arbitrary program seed would need the resolved address which the form does
  // not always have. Such accounts fall back to manual entry.
  program?: unknown;
}

/** Result of attempting to derive a single seed's bytes. */
type SeedResult =
  | { kind: 'ok'; bytes: Buffer }
  // The seed depends on a form value (arg/account) that has not been entered.
  | { kind: 'pending'; field: string; source: 'arg' | 'account' }
  // The seed (or the whole pda) is malformed / cannot be turned into bytes.
  | { kind: 'error'; message: string };

/**
 * The public derivation outcome consumed by `InstructionActionForm`:
 *   - 'derived'  → address ready, render a read-only "PDA (derived)" field.
 *   - 'pending'  → waiting on a dependent arg/account value; show a hint and
 *                  keep the manual input available.
 *   - 'error'    → seeds are invalid / off-curve / unsupported; surface the
 *                  message and keep the manual input as the escape hatch.
 */
export type PdaDeriveResult =
  | { status: 'derived'; address: string; bump: number }
  | { status: 'pending'; missing: { field: string; source: 'arg' | 'account' } }
  | { status: 'error'; message: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** Narrow an unknown IDL `pda` field to our `IdlPda` shape, or null. */
export function asIdlPda(pda: unknown): IdlPda | null {
  if (!isRecord(pda)) return null;
  const seeds = pda.seeds;
  if (!Array.isArray(seeds) || seeds.length === 0) return null;
  const narrowed: IdlPdaSeed[] = [];
  for (const s of seeds) {
    if (!isRecord(s) || typeof s.kind !== 'string') return null;
    if (s.kind === 'const') {
      if (!('value' in s)) return null;
      const value = s.value;
      if (!Array.isArray(value) && typeof value !== 'string') return null;
      narrowed.push({
        kind: 'const',
        value: value as number[] | string,
        type: typeof s.type === 'string' ? s.type : undefined,
      });
    } else if (s.kind === 'arg' || s.kind === 'account') {
      if (typeof s.path !== 'string' || s.path === '') return null;
      narrowed.push({ kind: s.kind, path: s.path });
    } else {
      // Unknown seed kind (e.g. a future Anchor shape) — bail to manual entry.
      return null;
    }
  }
  return { seeds: narrowed, program: pda.program };
}

/** Encode a non-negative integer string as a little-endian u64 (Anchor default). */
function encodeIntegerSeed(raw: string): Buffer | null {
  if (!/^\d+$/.test(raw)) return null;
  let v: bigint;
  try {
    v = BigInt(raw);
  } catch {
    return null;
  }
  if (v < BigInt(0) || v > (BigInt(1) << BigInt(64)) - BigInt(1)) return null;
  const out = Buffer.alloc(8);
  const mask = BigInt(0xff);
  for (let i = 0; i < 8; i++) {
    out[i] = Number(v & mask);
    v >>= BigInt(8);
  }
  return out;
}

/**
 * Turn an `arg`/`account` form value (always a raw string from the UI) into
 * seed bytes. A base58 pubkey → 32 raw bytes; a non-negative integer → u64 LE;
 * otherwise the literal utf8 bytes. This mirrors how Anchor commonly seeds
 * PDAs (pubkey refs, numeric ids, string labels).
 */
function encodeValueSeed(raw: string): Buffer {
  const trimmed = raw.trim();
  // Pubkey-shaped (base58, plausible length): use raw key bytes.
  if (trimmed.length >= 32 && trimmed.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed)) {
    try {
      return Buffer.from(new PublicKey(trimmed).toBytes());
    } catch {
      /* fall through to other encodings */
    }
  }
  const asInt = encodeIntegerSeed(trimmed);
  if (asInt) return asInt;
  return Buffer.from(trimmed, 'utf8');
}

function deriveConstSeed(seed: IdlPdaSeedConst): SeedResult {
  const { value, type } = seed;
  if (typeof value === 'string') {
    // Legacy string const, or a const that was emitted as a plain string.
    return { kind: 'ok', bytes: Buffer.from(value, 'utf8') };
  }
  // number[] — validate each byte is 0..255.
  for (const b of value) {
    if (typeof b !== 'number' || !Number.isInteger(b) || b < 0 || b > 255) {
      return { kind: 'error', message: 'const seed has non-byte value' };
    }
  }
  if (type === 'string') {
    // Unusual, but be defensive: bytes already are the utf8 representation.
    return { kind: 'ok', bytes: Buffer.from(value) };
  }
  return { kind: 'ok', bytes: Buffer.from(value) };
}

function deriveOneSeed(
  seed: IdlPdaSeed,
  argValues: Record<string, string>,
  accountValues: Record<string, string>,
): SeedResult {
  if (seed.kind === 'const') {
    return deriveConstSeed(seed);
  }
  const source = seed.kind; // 'arg' | 'account'
  const pool = source === 'arg' ? argValues : accountValues;
  const raw = (pool[seed.path] ?? '').trim();
  if (raw === '') {
    return { kind: 'pending', field: seed.path, source };
  }
  return { kind: 'ok', bytes: encodeValueSeed(raw) };
}

/**
 * Build the ordered list of seed `Buffer`s for an account's pda. Returns the
 * first blocking condition (pending or error) instead of partial buffers so the
 * caller can act on a single, actionable outcome.
 */
export function deriveSeedBuffers(
  pda: IdlPda,
  argValues: Record<string, string>,
  accountValues: Record<string, string>,
):
  | { kind: 'ok'; buffers: Buffer[] }
  | { kind: 'pending'; field: string; source: 'arg' | 'account' }
  | { kind: 'error'; message: string } {
  const buffers: Buffer[] = [];
  for (const seed of pda.seeds) {
    const r = deriveOneSeed(seed, argValues, accountValues);
    if (r.kind === 'pending') {
      return { kind: 'pending', field: r.field, source: r.source };
    }
    if (r.kind === 'error') {
      return { kind: 'error', message: r.message };
    }
    buffers.push(r.bytes);
  }
  return { kind: 'ok', buffers };
}

/**
 * Top-level entry point used by the form. Narrows the raw IDL `pda`, derives the
 * seed buffers from the current form state, then calls
 * `findProgramAddressSync`. Never throws — failures are returned as an `error`
 * outcome so the form can degrade to manual entry instead of crashing.
 *
 * Returns `null` when the account has no derivable pda (caller treats it as a
 * plain manual-entry account).
 */
export function tryDerivePda(
  rawPda: unknown,
  programId: PublicKey,
  argValues: Record<string, string>,
  accountValues: Record<string, string>,
): PdaDeriveResult | null {
  const pda = asIdlPda(rawPda);
  if (pda === null) return null;

  // A custom derivation program isn't supported — fall back to manual entry.
  if (pda.program != null) {
    return {
      status: 'error',
      message: 'PDA uses a custom program id — enter the address manually.',
    };
  }

  const seeds = deriveSeedBuffers(pda, argValues, accountValues);
  if (seeds.kind === 'pending') {
    return { status: 'pending', missing: { field: seeds.field, source: seeds.source } };
  }
  if (seeds.kind === 'error') {
    return { status: 'error', message: seeds.message };
  }

  try {
    const [address, bump] = PublicKey.findProgramAddressSync(
      seeds.buffers,
      programId,
    );
    return { status: 'derived', address: address.toBase58(), bump };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      status: 'error',
      message: `Could not derive PDA (${message}). Enter the address manually.`,
    };
  }
}
