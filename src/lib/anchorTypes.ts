/**
 * Narrow TypeScript types + type-guards for Anchor IDL argument-type shapes,
 * plus a per-type `parseArgValue` validator that turns the raw text a user
 * types into a structured, validated JS value ready for borsh encoding.
 *
 * Anchor 0.30 IDL arg `type` fields are one of:
 *   - a primitive string: "bool" | "u8" | ... | "string" | "bytes" | "pubkey"
 *   - { vec: <type> }
 *   - { option: <type> }
 *   - { array: [<type>, <len>] }
 *   - { defined: ... }   ← structs/enums/custom types — NOT supported here
 *
 * This module is pure (no React); it depends only on web3.js `PublicKey`
 * for base58 validation.
 */
import { PublicKey } from '@solana/web3.js';

export type PrimitiveType =
  | 'bool'
  | 'u8'
  | 'i8'
  | 'u16'
  | 'i16'
  | 'u32'
  | 'i32'
  | 'u64'
  | 'i64'
  | 'u128'
  | 'i128'
  | 'string'
  | 'bytes'
  | 'publicKey'
  | 'pubkey';

export interface VecType {
  vec: IdlType;
}
export interface OptionType {
  option: IdlType;
}
export interface ArrayType {
  array: [IdlType, number];
}
export interface DefinedType {
  defined: unknown;
}

export type IdlType =
  | PrimitiveType
  | VecType
  | OptionType
  | ArrayType
  | DefinedType;

const PRIMITIVES: ReadonlySet<string> = new Set<PrimitiveType>([
  'bool',
  'u8',
  'i8',
  'u16',
  'i16',
  'u32',
  'i32',
  'u64',
  'i64',
  'u128',
  'i128',
  'string',
  'bytes',
  'publicKey',
  'pubkey',
]);

export function isPrimitiveType(t: unknown): t is PrimitiveType {
  return typeof t === 'string' && PRIMITIVES.has(t);
}

function isRecord(t: unknown): t is Record<string, unknown> {
  return typeof t === 'object' && t !== null;
}

export function isVecType(t: unknown): t is VecType {
  return isRecord(t) && 'vec' in t;
}

export function isOptionType(t: unknown): t is OptionType {
  return isRecord(t) && 'option' in t;
}

export function isArrayType(t: unknown): t is ArrayType {
  if (!isRecord(t) || !('array' in t)) return false;
  const a = (t as { array: unknown }).array;
  return (
    Array.isArray(a) &&
    a.length === 2 &&
    typeof a[1] === 'number' &&
    Number.isInteger(a[1])
  );
}

export function isDefinedType(t: unknown): t is DefinedType {
  return isRecord(t) && 'defined' in t;
}

/** Narrow an unknown IDL `type` field to our supported `IdlType` union, or null. */
export function asIdlType(t: unknown): IdlType | null {
  if (isPrimitiveType(t)) return t;
  if (isVecType(t)) return t;
  if (isOptionType(t)) return t;
  if (isArrayType(t)) return t;
  if (isDefinedType(t)) return t;
  return null;
}

/** Signed/unsigned integer bit-widths handled as bigint. */
const INT_BITS: Record<string, { bits: number; signed: boolean }> = {
  u8: { bits: 8, signed: false },
  i8: { bits: 8, signed: true },
  u16: { bits: 16, signed: false },
  i16: { bits: 16, signed: true },
  u32: { bits: 32, signed: false },
  i32: { bits: 32, signed: true },
  u64: { bits: 64, signed: false },
  i64: { bits: 64, signed: true },
  u128: { bits: 128, signed: false },
  i128: { bits: 128, signed: true },
};

export type ParsedValue =
  | { ok: true; value: ParsedArg }
  | { ok: false; error: string };

/**
 * The structured value produced by `parseArgValue`, kept deliberately narrow so
 * the encoder in `anchorIx.ts` can switch on the IDL type with no `any`.
 */
export type ParsedArg =
  | boolean
  | bigint
  | string
  | Uint8Array
  | PublicKey
  | ParsedArg[]
  | { kind: 'some'; value: ParsedArg }
  | { kind: 'none' };

function parseInteger(
  raw: string,
  kind: keyof typeof INT_BITS,
): ParsedValue {
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) {
    return { ok: false, error: `Invalid integer for ${kind}` };
  }
  let value: bigint;
  try {
    value = BigInt(trimmed);
  } catch {
    return { ok: false, error: `Invalid integer for ${kind}` };
  }
  const { bits, signed } = INT_BITS[kind];
  const one = BigInt(1);
  const zero = BigInt(0);
  if (signed) {
    const max = (one << BigInt(bits - 1)) - one;
    const min = -(one << BigInt(bits - 1));
    if (value < min || value > max) {
      return { ok: false, error: `${kind} out of range` };
    }
  } else {
    const max = (one << BigInt(bits)) - one;
    if (value < zero || value > max) {
      return { ok: false, error: `${kind} out of range` };
    }
  }
  return { ok: true, value };
}

function parsePrimitive(type: PrimitiveType, raw: string): ParsedValue {
  switch (type) {
    case 'bool': {
      const v = raw.trim().toLowerCase();
      if (v === 'true' || v === '1') return { ok: true, value: true };
      if (v === 'false' || v === '0') return { ok: true, value: false };
      return { ok: false, error: 'Expected true or false' };
    }
    case 'string':
      return { ok: true, value: raw };
    case 'bytes': {
      const hex = raw.trim().replace(/^0x/, '');
      if (hex.length === 0) return { ok: true, value: new Uint8Array(0) };
      if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) {
        return { ok: false, error: 'Expected hex bytes (even length)' };
      }
      const out = new Uint8Array(hex.length / 2);
      for (let i = 0; i < out.length; i++) {
        out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
      }
      return { ok: true, value: out };
    }
    case 'publicKey':
    case 'pubkey': {
      try {
        return { ok: true, value: new PublicKey(raw.trim()) };
      } catch {
        return { ok: false, error: 'Invalid base58 public key' };
      }
    }
    default:
      return parseInteger(raw, type);
  }
}

/**
 * Validate + parse one raw user string against an IDL type.
 *
 * For compound types (vec/array) the raw string is interpreted as a
 * comma-separated list of element strings. For `option`, an empty string means
 * `none`; any other value is parsed as `some(<inner>)`. `defined` types are
 * rejected with a clear message — the user is told to use the CLI instead.
 */
export function parseArgValue(type: unknown, raw: string): ParsedValue {
  const t = asIdlType(type);
  if (t === null) {
    return { ok: false, error: 'Unsupported arg type — use the Anchor CLI' };
  }

  if (isPrimitiveType(t)) {
    return parsePrimitive(t, raw);
  }

  if (isOptionType(t)) {
    if (raw.trim() === '') return { ok: true, value: { kind: 'none' } };
    const inner = parseArgValue(t.option, raw);
    if (!inner.ok) return inner;
    return { ok: true, value: { kind: 'some', value: inner.value } };
  }

  if (isVecType(t)) {
    const parts = splitList(raw);
    const out: ParsedArg[] = [];
    for (const part of parts) {
      const inner = parseArgValue(t.vec, part);
      if (!inner.ok) return inner;
      out.push(inner.value);
    }
    return { ok: true, value: out };
  }

  if (isArrayType(t)) {
    const [elemType, len] = t.array;
    const parts = splitList(raw);
    if (parts.length !== len) {
      return { ok: false, error: `Expected ${len} comma-separated values` };
    }
    const out: ParsedArg[] = [];
    for (const part of parts) {
      const inner = parseArgValue(elemType, part);
      if (!inner.ok) return inner;
      out.push(inner.value);
    }
    return { ok: true, value: out };
  }

  // isDefinedType — structs/enums/custom types are not supported.
  return {
    ok: false,
    error: 'Struct/enum/custom arg type unsupported — use the Anchor CLI',
  };
}

/** Split a comma-separated list, dropping a single trailing empty token. */
function splitList(raw: string): string[] {
  const trimmed = raw.trim();
  if (trimmed === '') return [];
  return trimmed.split(',').map((s) => s.trim());
}

/**
 * A short human label for a type, used to render the input placeholder/hint.
 * Returns `null` for unsupported (defined) types so the UI can disable them.
 */
export function describeType(type: unknown): string | null {
  const t = asIdlType(type);
  if (t === null) return null;
  if (isPrimitiveType(t)) return t;
  if (isVecType(t)) {
    const inner = describeType(t.vec);
    return inner ? `vec<${inner}> (comma-separated)` : null;
  }
  if (isOptionType(t)) {
    const inner = describeType(t.option);
    return inner ? `option<${inner}> (blank = none)` : null;
  }
  if (isArrayType(t)) {
    const inner = describeType(t.array[0]);
    return inner ? `[${inner}; ${t.array[1]}] (comma-separated)` : null;
  }
  return null; // defined
}
