/**
 * Self-contained Anchor-instruction encoder. Builds a web3.js
 * `TransactionInstruction` from an IDL instruction + user-supplied arg/account
 * values WITHOUT pulling in `@coral-xyz/anchor` (which would bloat the bundle
 * and risk peer-dep churn against the existing web3.js ^1.98 stack).
 *
 * Scope: discriminator (embedded-first, sha256 fallback), borsh encoding of the
 * primitive set + vec/option/array, program-id resolution, and assembling the
 * final `TransactionInstruction`. Pure — no React, fully unit-testable.
 */
import { sha256 } from '@noble/hashes/sha2';
import { Buffer } from 'buffer';
import {
  PublicKey,
  TransactionInstruction,
  type AccountMeta,
} from '@solana/web3.js';
import type { ContractIdlResponse, IDLInstruction } from './api';
import {
  asIdlType,
  isArrayType,
  isOptionType,
  isPrimitiveType,
  isVecType,
  type IdlType,
  type ParsedArg,
  type PrimitiveType,
} from './anchorTypes';

/**
 * The 8-byte Anchor instruction discriminator. Prefer the IDL-embedded
 * `discriminator` array (Anchor 0.30+ always emits it). Fall back to
 * `sha256("global:<name>").slice(0, 8)` for legacy IDLs.
 */
export function getDiscriminator(instruction: IDLInstruction): Buffer {
  const embedded = instruction.discriminator;
  if (Array.isArray(embedded) && embedded.length === 8) {
    return Buffer.from(embedded);
  }
  const hash = sha256(Buffer.from(`global:${instruction.name}`, 'utf8'));
  return Buffer.from(hash.slice(0, 8));
}

/** Resolve the program id: IDL `address` (0.30+) → response `program_id`. */
export function resolveProgramId(idlResponse: ContractIdlResponse): PublicKey {
  const fromIdl = idlResponse.idl?.address;
  const candidate = fromIdl ?? idlResponse.program_id;
  if (!candidate) {
    throw new Error('No program id available (missing IDL address and program_id)');
  }
  return new PublicKey(candidate);
}

/** Little-endian byte width for the fixed-size integer primitives. */
const INT_BYTES: Partial<Record<PrimitiveType, number>> = {
  u8: 1,
  i8: 1,
  u16: 2,
  i16: 2,
  u32: 4,
  i32: 4,
  u64: 8,
  i64: 8,
  u128: 16,
  i128: 16,
};

function encodeUintLE(value: bigint, bytes: number): Buffer {
  // Two's-complement for signed negatives, written little-endian.
  let v = value;
  if (v < BigInt(0)) {
    v = (BigInt(1) << BigInt(bytes * 8)) + v;
  }
  const mask = BigInt(0xff);
  const eight = BigInt(8);
  const out = Buffer.alloc(bytes);
  for (let i = 0; i < bytes; i++) {
    out[i] = Number(v & mask);
    v >>= eight;
  }
  return out;
}

function encodeLengthPrefix(len: number): Buffer {
  return encodeUintLE(BigInt(len), 4); // borsh u32 length prefix
}

function encodePrimitive(type: PrimitiveType, value: ParsedArg): Buffer {
  switch (type) {
    case 'bool':
      if (typeof value !== 'boolean') throw new Error('bool expects boolean');
      return Buffer.from([value ? 1 : 0]);
    case 'string': {
      if (typeof value !== 'string') throw new Error('string expects string');
      const utf8 = Buffer.from(value, 'utf8');
      return Buffer.concat([encodeLengthPrefix(utf8.length), utf8]);
    }
    case 'bytes': {
      if (!(value instanceof Uint8Array)) throw new Error('bytes expects Uint8Array');
      const buf = Buffer.from(value);
      return Buffer.concat([encodeLengthPrefix(buf.length), buf]);
    }
    case 'publicKey':
    case 'pubkey': {
      if (!(value instanceof PublicKey)) throw new Error('pubkey expects PublicKey');
      return Buffer.from(value.toBytes());
    }
    default: {
      const width = INT_BYTES[type];
      if (width === undefined) throw new Error(`Unsupported primitive ${type}`);
      if (typeof value !== 'bigint') throw new Error(`${type} expects bigint`);
      return encodeUintLE(value, width);
    }
  }
}

function encodeValue(type: IdlType, value: ParsedArg): Buffer {
  if (isPrimitiveType(type)) {
    return encodePrimitive(type, value);
  }

  if (isOptionType(type)) {
    if (
      typeof value === 'object' &&
      value !== null &&
      'kind' in value &&
      value.kind === 'none'
    ) {
      return Buffer.from([0]);
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'kind' in value &&
      value.kind === 'some'
    ) {
      const inner = asIdlType(type.option);
      if (inner === null) throw new Error('Unsupported option inner type');
      return Buffer.concat([Buffer.from([1]), encodeValue(inner, value.value)]);
    }
    throw new Error('option expects {kind:some}|{kind:none}');
  }

  if (isVecType(type)) {
    if (!Array.isArray(value)) throw new Error('vec expects array');
    const inner = asIdlType(type.vec);
    if (inner === null) throw new Error('Unsupported vec inner type');
    const parts = value.map((v) => encodeValue(inner, v));
    return Buffer.concat([encodeLengthPrefix(value.length), ...parts]);
  }

  if (isArrayType(type)) {
    if (!Array.isArray(value)) throw new Error('array expects array');
    const inner = asIdlType(type.array[0]);
    if (inner === null) throw new Error('Unsupported array inner type');
    // Fixed-size array: no length prefix.
    return Buffer.concat(value.map((v) => encodeValue(inner, v)));
  }

  throw new Error('Unsupported arg type — use the Anchor CLI');
}

/**
 * Borsh-encode an ordered list of instruction args. `values[i]` is the
 * already-validated `ParsedArg` for `args[i]` (from `parseArgValue`).
 */
export function borshEncodeArgs(
  args: ReadonlyArray<{ name: string; type: unknown }>,
  values: ReadonlyArray<ParsedArg>,
): Buffer {
  if (args.length !== values.length) {
    throw new Error('arg/value count mismatch');
  }
  const parts: Buffer[] = [];
  for (let i = 0; i < args.length; i++) {
    const t = asIdlType(args[i].type);
    if (t === null) {
      throw new Error(`Unsupported type for arg "${args[i].name}"`);
    }
    parts.push(encodeValue(t, values[i]));
  }
  return parts.length === 0 ? Buffer.alloc(0) : Buffer.concat(parts);
}

/** Assemble the final web3.js instruction: data = discriminator ++ encodedArgs. */
export function buildInstruction(params: {
  programId: PublicKey;
  discriminator: Buffer;
  encodedArgs: Buffer;
  accountMetas: AccountMeta[];
}): TransactionInstruction {
  const data = Buffer.concat([params.discriminator, params.encodedArgs]);
  return new TransactionInstruction({
    programId: params.programId,
    keys: params.accountMetas,
    data,
  });
}
