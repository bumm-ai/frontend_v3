import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import { Buffer } from 'buffer';
import {
  asIdlPda,
  deriveSeedBuffers,
  tryDerivePda,
  type IdlPda,
} from '../pdaDerive';

const PROGRAM_ID = new PublicKey('So11111111111111111111111111111111111111112');
// A valid base58 pubkey used as an account-seed value.
const AUTHORITY = '11111111111111111111111111111111';

describe('asIdlPda', () => {
  it('returns null for non-pda values', () => {
    expect(asIdlPda(null)).toBeNull();
    expect(asIdlPda(undefined)).toBeNull();
    expect(asIdlPda({})).toBeNull();
    expect(asIdlPda({ seeds: [] })).toBeNull();
    expect(asIdlPda({ seeds: 'nope' })).toBeNull();
  });

  it('narrows the 0.30 const/account/arg seed shapes', () => {
    const pda = asIdlPda({
      seeds: [
        { kind: 'const', value: [104, 105] },
        { kind: 'account', path: 'authority' },
        { kind: 'arg', path: 'id' },
      ],
    });
    expect(pda).not.toBeNull();
    expect(pda?.seeds).toHaveLength(3);
  });

  it('rejects an unknown seed kind', () => {
    expect(
      asIdlPda({ seeds: [{ kind: 'wat', path: 'x' }] }),
    ).toBeNull();
  });

  it('rejects an arg/account seed with no path', () => {
    expect(asIdlPda({ seeds: [{ kind: 'arg' }] })).toBeNull();
    expect(asIdlPda({ seeds: [{ kind: 'account', path: '' }] })).toBeNull();
  });
});

describe('deriveSeedBuffers', () => {
  it('encodes a const number[] seed as raw bytes', () => {
    const pda: IdlPda = { seeds: [{ kind: 'const', value: [1, 2, 3] }] };
    const r = deriveSeedBuffers(pda, {}, {});
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') expect([...r.buffers[0]]).toEqual([1, 2, 3]);
  });

  it('encodes a legacy string const seed as utf8', () => {
    const pda: IdlPda = { seeds: [{ kind: 'const', value: 'hello' }] };
    const r = deriveSeedBuffers(pda, {}, {});
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.buffers[0].equals(Buffer.from('hello', 'utf8'))).toBe(true);
    }
  });

  it('reports pending when an arg seed value is missing', () => {
    const pda: IdlPda = { seeds: [{ kind: 'arg', path: 'name' }] };
    const r = deriveSeedBuffers(pda, {}, {});
    expect(r).toEqual({ kind: 'pending', field: 'name', source: 'arg' });
  });

  it('reports pending when an account seed value is missing', () => {
    const pda: IdlPda = { seeds: [{ kind: 'account', path: 'authority' }] };
    const r = deriveSeedBuffers(pda, {}, {});
    expect(r).toEqual({ kind: 'pending', field: 'authority', source: 'account' });
  });

  it('encodes an account-seed pubkey value as 32 raw bytes', () => {
    const pda: IdlPda = { seeds: [{ kind: 'account', path: 'authority' }] };
    const r = deriveSeedBuffers(pda, {}, { authority: AUTHORITY });
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.buffers[0].length).toBe(32);
      expect([...r.buffers[0]]).toEqual([...new PublicKey(AUTHORITY).toBytes()]);
    }
  });

  it('encodes a numeric arg-seed value as little-endian u64', () => {
    const pda: IdlPda = { seeds: [{ kind: 'arg', path: 'id' }] };
    const r = deriveSeedBuffers(pda, { id: '258' }, {});
    expect(r.kind).toBe('ok');
    // 258 = 0x0102 → LE u64
    if (r.kind === 'ok') expect([...r.buffers[0]]).toEqual([2, 1, 0, 0, 0, 0, 0, 0]);
  });

  it('encodes a non-pubkey/non-numeric arg-seed value as utf8', () => {
    const pda: IdlPda = { seeds: [{ kind: 'arg', path: 'label' }] };
    const r = deriveSeedBuffers(pda, { label: 'vault' }, {});
    expect(r.kind).toBe('ok');
    if (r.kind === 'ok') {
      expect(r.buffers[0].equals(Buffer.from('vault', 'utf8'))).toBe(true);
    }
  });

  it('flags a const seed with an out-of-range byte', () => {
    const pda: IdlPda = { seeds: [{ kind: 'const', value: [1, 999] }] };
    const r = deriveSeedBuffers(pda, {}, {});
    expect(r.kind).toBe('error');
  });
});

describe('tryDerivePda', () => {
  it('returns null when the account has no derivable pda', () => {
    expect(tryDerivePda(null, PROGRAM_ID, {}, {})).toBeNull();
    expect(tryDerivePda({}, PROGRAM_ID, {}, {})).toBeNull();
  });

  it('derives a stable address from a const-only seed', () => {
    const pda = { seeds: [{ kind: 'const', value: [...Buffer.from('config')] }] };
    const r1 = tryDerivePda(pda, PROGRAM_ID, {}, {});
    const r2 = tryDerivePda(pda, PROGRAM_ID, {}, {});
    expect(r1?.status).toBe('derived');
    if (r1?.status === 'derived') {
      // Cross-check against the canonical web3.js derivation.
      const [expected, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('config')],
        PROGRAM_ID,
      );
      expect(r1.address).toBe(expected.toBase58());
      expect(r1.bump).toBe(bump);
      // Deterministic across calls.
      expect(r2?.status === 'derived' && r2.address).toBe(r1.address);
    }
  });

  it('derives a const + account-pubkey seed PDA', () => {
    const pda = {
      seeds: [
        { kind: 'const', value: [...Buffer.from('user')] },
        { kind: 'account', path: 'authority' },
      ],
    };
    const r = tryDerivePda(pda, PROGRAM_ID, {}, { authority: AUTHORITY });
    expect(r?.status).toBe('derived');
    if (r?.status === 'derived') {
      const [expected] = PublicKey.findProgramAddressSync(
        [Buffer.from('user'), new PublicKey(AUTHORITY).toBytes()],
        PROGRAM_ID,
      );
      expect(r.address).toBe(expected.toBase58());
    }
  });

  it('returns pending (waits) when an arg seed has no value yet', () => {
    const pda = { seeds: [{ kind: 'arg', path: 'name' }] };
    const r = tryDerivePda(pda, PROGRAM_ID, {}, {});
    expect(r).toEqual({
      status: 'pending',
      missing: { field: 'name', source: 'arg' },
    });
  });

  it('returns error (no crash) on an off-curve / oversized seed', () => {
    // A seed longer than 32 bytes is rejected by findProgramAddressSync.
    const tooLong = Array.from({ length: 33 }, () => 1);
    const pda = { seeds: [{ kind: 'const', value: tooLong }] };
    const r = tryDerivePda(pda, PROGRAM_ID, {}, {});
    expect(r?.status).toBe('error');
    if (r?.status === 'error') expect(r.message).toMatch(/manually|derive/i);
  });

  it('falls back to manual entry for a custom-program pda', () => {
    const pda = {
      seeds: [{ kind: 'const', value: [1] }],
      program: { kind: 'const', value: [1, 2, 3] },
    };
    const r = tryDerivePda(pda, PROGRAM_ID, {}, {});
    expect(r?.status).toBe('error');
    if (r?.status === 'error') expect(r.message).toMatch(/custom program/i);
  });
});
