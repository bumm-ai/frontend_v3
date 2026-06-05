import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  getDiscriminator,
  borshEncodeArgs,
  resolveProgramId,
  buildInstruction,
} from '../anchorIx';
import { parseArgValue } from '../anchorTypes';
import type { ContractIdlResponse, IDLInstruction } from '../api';
import { Buffer } from 'buffer';

// Helper: parse a raw string against a type, asserting success.
function parsed(type: unknown, raw: string) {
  const r = parseArgValue(type, raw);
  if (!r.ok) throw new Error(`unexpected parse failure: ${r.error}`);
  return r.value;
}

describe('getDiscriminator', () => {
  it('uses the embedded discriminator array when present', () => {
    const ix: IDLInstruction = {
      name: 'whatever',
      discriminator: [1, 2, 3, 4, 5, 6, 7, 8],
    };
    expect([...getDiscriminator(ix)]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('falls back to sha256("global:<name>").slice(0,8) for legacy IDLs', () => {
    const ix: IDLInstruction = { name: 'initialize' };
    // Golden vector computed from @noble/hashes sha256.
    expect([...getDiscriminator(ix)]).toEqual([175, 175, 109, 31, 13, 152, 155, 237]);
  });

  it('ignores a malformed (wrong-length) embedded discriminator', () => {
    const ix: IDLInstruction = { name: 'initialize', discriminator: [1, 2, 3] };
    expect([...getDiscriminator(ix)]).toEqual([175, 175, 109, 31, 13, 152, 155, 237]);
  });
});

describe('borshEncodeArgs', () => {
  it('encodes u64 little-endian', () => {
    const out = borshEncodeArgs([{ name: 'amount', type: 'u64' }], [parsed('u64', '4242')]);
    expect([...out]).toEqual([146, 16, 0, 0, 0, 0, 0, 0]);
  });

  it('encodes bool', () => {
    const t = borshEncodeArgs([{ name: 'f', type: 'bool' }], [parsed('bool', 'true')]);
    const f = borshEncodeArgs([{ name: 'f', type: 'bool' }], [parsed('bool', 'false')]);
    expect([...t]).toEqual([1]);
    expect([...f]).toEqual([0]);
  });

  it('encodes string with u32 length prefix + utf8', () => {
    const out = borshEncodeArgs([{ name: 's', type: 'string' }], [parsed('string', 'abc')]);
    expect([...out]).toEqual([3, 0, 0, 0, 0x61, 0x62, 0x63]);
  });

  it('encodes publicKey as 32 raw bytes', () => {
    const pk = '11111111111111111111111111111111';
    const out = borshEncodeArgs([{ name: 'k', type: 'pubkey' }], [parsed('pubkey', pk)]);
    expect(out.length).toBe(32);
    expect([...out]).toEqual([...new PublicKey(pk).toBytes()]);
  });

  it('encodes vec<u8> with length prefix', () => {
    const out = borshEncodeArgs([{ name: 'v', type: { vec: 'u8' } }], [parsed({ vec: 'u8' }, '1,2,3')]);
    expect([...out]).toEqual([3, 0, 0, 0, 1, 2, 3]);
  });

  it('encodes option<u32>: none then some', () => {
    const none = borshEncodeArgs([{ name: 'o', type: { option: 'u32' } }], [parsed({ option: 'u32' }, '')]);
    expect([...none]).toEqual([0]);
    const some = borshEncodeArgs([{ name: 'o', type: { option: 'u32' } }], [parsed({ option: 'u32' }, '7')]);
    expect([...some]).toEqual([1, 7, 0, 0, 0]);
  });

  it('encodes fixed array [u8; 3] WITHOUT a length prefix', () => {
    const ty = { array: ['u8', 3] };
    const out = borshEncodeArgs([{ name: 'a', type: ty }], [parsed(ty, '9,8,7')]);
    expect([...out]).toEqual([9, 8, 7]);
  });

  it('throws on arg/value count mismatch', () => {
    expect(() => borshEncodeArgs([{ name: 'x', type: 'u8' }], [])).toThrow();
  });
});

describe('parseArgValue validation', () => {
  it('rejects bad base58 pubkey', () => {
    expect(parseArgValue('pubkey', 'not-base58!!!').ok).toBe(false);
  });

  it('rejects non-numeric integer', () => {
    expect(parseArgValue('u64', 'abc').ok).toBe(false);
  });

  it('rejects u8 overflow', () => {
    expect(parseArgValue('u8', '256').ok).toBe(false);
    expect(parseArgValue('u8', '255').ok).toBe(true);
  });

  it('rejects negative for unsigned', () => {
    expect(parseArgValue('u32', '-1').ok).toBe(false);
  });

  it('accepts in-range signed and rejects out-of-range', () => {
    expect(parseArgValue('i8', '-128').ok).toBe(true);
    expect(parseArgValue('i8', '-129').ok).toBe(false);
    expect(parseArgValue('i8', '127').ok).toBe(true);
    expect(parseArgValue('i8', '128').ok).toBe(false);
  });

  it('rejects unsupported defined/struct type', () => {
    const r = parseArgValue({ defined: 'MyStruct' }, 'anything');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/unsupported|CLI/i);
  });

  it('rejects unknown type shape', () => {
    expect(parseArgValue({ weird: true }, 'x').ok).toBe(false);
  });

  it('rejects wrong array length', () => {
    expect(parseArgValue({ array: ['u8', 3] }, '1,2').ok).toBe(false);
  });
});

describe('resolveProgramId', () => {
  it('prefers IDL address over program_id', () => {
    const pk = 'So11111111111111111111111111111111111111112';
    const resp: ContractIdlResponse = {
      idl: { address: pk },
      program_id: '11111111111111111111111111111111',
      network: 'devnet',
    };
    expect(resolveProgramId(resp).toBase58()).toBe(pk);
  });

  it('falls back to program_id when IDL has no address', () => {
    const pk = '11111111111111111111111111111111';
    const resp: ContractIdlResponse = { idl: { instructions: [] }, program_id: pk, network: 'devnet' };
    expect(resolveProgramId(resp).toBase58()).toBe(pk);
  });

  it('throws when neither is available', () => {
    const resp: ContractIdlResponse = { idl: null, program_id: null, network: 'devnet' };
    expect(() => resolveProgramId(resp)).toThrow();
  });
});

describe('buildInstruction', () => {
  it('assembles data = discriminator ++ encodedArgs and sets keys', () => {
    const programId = new PublicKey('11111111111111111111111111111111');
    const discriminator = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);
    const encodedArgs = Buffer.from([9, 10]);
    const signer = new PublicKey('So11111111111111111111111111111111111111112');
    const ix = buildInstruction({
      programId,
      discriminator,
      encodedArgs,
      accountMetas: [{ pubkey: signer, isSigner: true, isWritable: true }],
    });
    expect(ix.programId.toBase58()).toBe(programId.toBase58());
    expect([...ix.data]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(ix.keys).toHaveLength(1);
    expect(ix.keys[0].isSigner).toBe(true);
  });
});
