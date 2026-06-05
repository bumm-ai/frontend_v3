import { describe, it, expect } from 'vitest';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import {
  BPF_UPGRADEABLE_LOADER_ID,
  BUFFER_METADATA_SIZE,
  PROGRAM_ACCOUNT_SIZE,
  PROGRAMDATA_METADATA_SIZE,
  bufferAccountSize,
  chunkProgram,
  closeProgramIx,
  createBufferIxs,
  deployWithMaxDataLenIxs,
  deriveProgramDataAddress,
  programDataAccountSize,
  setUpgradeAuthorityIx,
  writeBufferIx,
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

const BUFFER = new PublicKey('9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin');
const PAYER = new PublicKey('G3SuaZC8nhh7pMRRJLej1kT75ecAzAbZnuxLoREWVzK4');

describe('account size helpers', () => {
  it('match the UpgradeableLoaderState layout constants', () => {
    expect(BUFFER_METADATA_SIZE).toBe(37);
    expect(PROGRAMDATA_METADATA_SIZE).toBe(45);
    expect(PROGRAM_ACCOUNT_SIZE).toBe(36);
    expect(bufferAccountSize(1000)).toBe(1037);
    expect(programDataAccountSize(2000)).toBe(2045);
  });
});

describe('createBufferIxs', () => {
  it('createAccount(owner=loader, sized) then InitializeBuffer(tag 0)', () => {
    const ixs = createBufferIxs({
      payer: PAYER,
      buffer: BUFFER,
      authority: AUTHORITY,
      programLen: 1000,
      lamports: 7_000_000,
    });
    expect(ixs).toHaveLength(2);

    // 1) SystemProgram.createAccount → owner is the loader, space sized for buffer.
    const [create, init] = ixs;
    expect(create.programId.equals(SystemProgram.programId)).toBe(true);

    // 2) InitializeBuffer: [buffer writable, authority], tag=0.
    expect(init.programId.equals(BPF_UPGRADEABLE_LOADER_ID)).toBe(true);
    expect(init.keys).toHaveLength(2);
    expect(init.keys[0].pubkey.equals(BUFFER)).toBe(true);
    expect(init.keys[0].isWritable).toBe(true);
    expect(init.keys[0].isSigner).toBe(false);
    expect(init.keys[1].pubkey.equals(AUTHORITY)).toBe(true);
    expect([...init.data]).toEqual([0, 0, 0, 0]);
  });
});

describe('writeBufferIx', () => {
  it('encodes Write{offset:u32, bytes:Vec<u8>} = tag1 + offsetLE + lenU64LE + bytes', () => {
    const bytes = new Uint8Array([0xaa, 0xbb, 0xcc]);
    const ix = writeBufferIx({ buffer: BUFFER, authority: AUTHORITY, offset: 1011, bytes });
    expect(ix.programId.equals(BPF_UPGRADEABLE_LOADER_ID)).toBe(true);

    // buffer writable, authority SIGNS.
    expect(ix.keys[0].pubkey.equals(BUFFER)).toBe(true);
    expect(ix.keys[0].isWritable).toBe(true);
    expect(ix.keys[1].pubkey.equals(AUTHORITY)).toBe(true);
    expect(ix.keys[1].isSigner).toBe(true);

    // data: [1,0,0,0] tag + [0xF3,0x03,0,0] offset(1011) + [3,0,0,0,0,0,0,0] u64 len + bytes
    expect([...ix.data]).toEqual([
      1, 0, 0, 0,
      0xf3, 0x03, 0, 0,
      3, 0, 0, 0, 0, 0, 0, 0,
      0xaa, 0xbb, 0xcc,
    ]);
  });
});

describe('deployWithMaxDataLenIxs', () => {
  it('createAccount(program) + DeployWithMaxDataLen(tag 2, u64 max_data_len), 8 keys', () => {
    const programData = deriveProgramDataAddress(PROGRAM);
    const ixs = deployWithMaxDataLenIxs({
      payer: PAYER,
      program: PROGRAM,
      programData,
      buffer: BUFFER,
      authority: PAYER,
      programLamports: 1_000_000,
      maxDataLen: 2000,
    });
    expect(ixs).toHaveLength(2);
    const [createProgram, deploy] = ixs;
    expect(createProgram.programId.equals(SystemProgram.programId)).toBe(true);

    // Loader deploy: exact 8-account order.
    expect(deploy.programId.equals(BPF_UPGRADEABLE_LOADER_ID)).toBe(true);
    expect(deploy.keys).toHaveLength(8);
    expect(deploy.keys[0].pubkey.equals(PAYER)).toBe(true);
    expect(deploy.keys[0].isSigner).toBe(true);
    expect(deploy.keys[0].isWritable).toBe(true);
    expect(deploy.keys[1].pubkey.equals(programData)).toBe(true);
    expect(deploy.keys[1].isWritable).toBe(true);
    expect(deploy.keys[2].pubkey.equals(PROGRAM)).toBe(true);
    expect(deploy.keys[2].isWritable).toBe(true);
    expect(deploy.keys[3].pubkey.equals(BUFFER)).toBe(true);
    expect(deploy.keys[3].isWritable).toBe(true);
    // 4=rent, 5=clock, 6=system (read-only), 7=authority signs.
    expect(deploy.keys[6].pubkey.equals(SystemProgram.programId)).toBe(true);
    expect(deploy.keys[7].pubkey.equals(PAYER)).toBe(true);
    expect(deploy.keys[7].isSigner).toBe(true);
    expect(deploy.keys[7].isWritable).toBe(false);

    // data: [2,0,0,0] tag + [0xD0,0x07,0,0,0,0,0,0] u64(2000)
    expect([...deploy.data]).toEqual([2, 0, 0, 0, 0xd0, 0x07, 0, 0, 0, 0, 0, 0]);
  });
});

describe('chunkProgram', () => {
  it('splits into MAX_WRITE_CHUNK-bounded [offset, chunk] pairs', () => {
    const bytes = new Uint8Array(2500);
    const parts = chunkProgram(bytes, 1011);
    expect(parts.map((p) => p.offset)).toEqual([0, 1011, 2022]);
    expect(parts[0].chunk.length).toBe(1011);
    expect(parts[2].chunk.length).toBe(2500 - 2022); // 478 (last, short)
    // Concatenation reconstructs the original length.
    expect(parts.reduce((n, p) => n + p.chunk.length, 0)).toBe(2500);
  });

  it('empty program yields no writes', () => {
    expect(chunkProgram(new Uint8Array(0))).toEqual([]);
  });
});
