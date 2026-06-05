import { describe, it, expect } from 'vitest';
import { PublicKey } from '@solana/web3.js';
import {
  BPF_UPGRADEABLE_LOADER_ID,
  deriveProgramDataAddress,
  setUpgradeAuthorityIx,
  closeProgramIx,
} from '../upgradeableLoader';

// A deterministic, valid base58 program id for the layout assertions.
const PROGRAM = new PublicKey('BAKRCCTEyqBRi2FcJJJfDwFKSUrDc9zzhE21HCsH8pb2');
const AUTHORITY = new PublicKey('G3SuaZC8nhh7pMRRJLej1kT75ecAzAbZnuxLoREWVzK4');
const NEW_AUTH = new PublicKey('11111111111111111111111111111112');

describe('deriveProgramDataAddress', () => {
  it('is the PDA of [programId] under the upgradeable loader', () => {
    const expected = PublicKey.findProgramAddressSync(
      [PROGRAM.toBuffer()],
      BPF_UPGRADEABLE_LOADER_ID,
    )[0];
    expect(deriveProgramDataAddress(PROGRAM).equals(expected)).toBe(true);
  });

  it('is deterministic and off-curve (a real PDA, not the program id)', () => {
    const a = deriveProgramDataAddress(PROGRAM);
    const b = deriveProgramDataAddress(PROGRAM);
    expect(a.equals(b)).toBe(true);
    expect(a.equals(PROGRAM)).toBe(false);
    expect(PublicKey.isOnCurve(a.toBytes())).toBe(false);
  });
});

describe('setUpgradeAuthorityIx', () => {
  it('transfer: 3 keys, programData writable, authority signs, tag=4', () => {
    const ix = setUpgradeAuthorityIx({
      programId: PROGRAM,
      currentAuthority: AUTHORITY,
      newAuthority: NEW_AUTH,
    });
    expect(ix.programId.equals(BPF_UPGRADEABLE_LOADER_ID)).toBe(true);
    expect(ix.keys).toHaveLength(3);

    const [programData, auth, next] = ix.keys;
    expect(programData.pubkey.equals(deriveProgramDataAddress(PROGRAM))).toBe(true);
    expect(programData.isWritable).toBe(true);
    expect(programData.isSigner).toBe(false);

    expect(auth.pubkey.equals(AUTHORITY)).toBe(true);
    expect(auth.isSigner).toBe(true);
    expect(auth.isWritable).toBe(false);

    expect(next.pubkey.equals(NEW_AUTH)).toBe(true);
    expect(next.isSigner).toBe(false);
    expect(next.isWritable).toBe(false);

    expect([...ix.data]).toEqual([4, 0, 0, 0]);
  });

  it('make immutable: omits the new-authority account (2 keys, tag=4)', () => {
    const ix = setUpgradeAuthorityIx({
      programId: PROGRAM,
      currentAuthority: AUTHORITY,
      newAuthority: null,
    });
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[1].isSigner).toBe(true);
    expect([...ix.data]).toEqual([4, 0, 0, 0]);
  });
});

describe('closeProgramIx', () => {
  it('4 keys in loader order, recipient writable, authority signs, tag=5', () => {
    const ix = closeProgramIx({
      programId: PROGRAM,
      currentAuthority: AUTHORITY,
      recipient: AUTHORITY,
    });
    expect(ix.programId.equals(BPF_UPGRADEABLE_LOADER_ID)).toBe(true);
    expect(ix.keys).toHaveLength(4);

    const [programData, recipient, auth, program] = ix.keys;
    expect(programData.pubkey.equals(deriveProgramDataAddress(PROGRAM))).toBe(true);
    expect(programData.isWritable).toBe(true);

    expect(recipient.pubkey.equals(AUTHORITY)).toBe(true);
    expect(recipient.isWritable).toBe(true);
    expect(recipient.isSigner).toBe(false);

    expect(auth.isSigner).toBe(true);
    expect(auth.isWritable).toBe(false);

    expect(program.pubkey.equals(PROGRAM)).toBe(true);
    expect(program.isWritable).toBe(true);

    expect([...ix.data]).toEqual([5, 0, 0, 0]);
  });
});
