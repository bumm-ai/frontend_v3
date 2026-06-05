/**
 * Native BPF Upgradeable Loader instruction builders.
 *
 * These drive the wallet-signed "Manage program" actions in ContractActionsPanel
 * — they work for ANY deployed program regardless of whether the build produced
 * an Anchor IDL, because they target the loader itself, not the program's own
 * instructions. After a Bumm deploy the upgrade authority is transferred to the
 * user's wallet, so the connected wallet is the signer for all of these.
 *
 * Instruction encoding: the upgradeable loader uses bincode, which serialises
 * the instruction enum variant as a little-endian u32 tag. We only need the
 * tag bytes for SetAuthority (4) and Close (5) — neither carries extra data.
 *
 * Layouts (from solana-program / bpf_loader_upgradeable):
 *   SetAuthority (4):
 *     0. [writable] Buffer or ProgramData account to change the authority of
 *     1. [signer]   current authority
 *     2. []         new authority (OPTIONAL — omit to remove authority forever)
 *   Close (5):
 *     0. [writable] account to close (ProgramData)
 *     1. [writable] recipient of the reclaimed lamports
 *     2. [signer]   current authority
 *     3. [writable] the Program account (present when closing a program)
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
} from '@solana/web3.js';

/** The on-chain BPF Upgradeable Loader program. */
export const BPF_UPGRADEABLE_LOADER_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

// ── UpgradeableLoaderState account sizes (from solana bpf_loader_upgradeable) ──
// Buffer       = 4 (enum) + 1 (Option) + 32 (authority)                = 37 + program_len
// ProgramData  = 4 (enum) + 8 (slot) + 1 (Option) + 32 (authority)     = 45 + program_len
// Program      = 4 (enum) + 32 (programdata pubkey)                    = 36
export const BUFFER_METADATA_SIZE = 37;
export const PROGRAMDATA_METADATA_SIZE = 45;
export const PROGRAM_ACCOUNT_SIZE = 36;

/** On-chain byte size of a Buffer account holding `programLen` ELF bytes. */
export function bufferAccountSize(programLen: number): number {
  return BUFFER_METADATA_SIZE + programLen;
}

/** On-chain byte size of a ProgramData account sized for `maxDataLen`. */
export function programDataAccountSize(maxDataLen: number): number {
  return PROGRAMDATA_METADATA_SIZE + maxDataLen;
}

// Max ELF bytes per Write transaction. The Solana CLI uses ~1011 to stay under
// the 1232-byte packet limit after the tx header + instruction overhead.
export const MAX_WRITE_CHUNK = 1011;

/**
 * Derive the ProgramData account address for an upgradeable program.
 * `ProgramData = PDA([programId], BPFUpgradeableLoader)`.
 */
export function deriveProgramDataAddress(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    BPF_UPGRADEABLE_LOADER_ID,
  )[0];
}

/** Little-endian u32 enum tag — the entire data payload for these variants. */
function tag(variant: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(variant, 0);
  return b;
}

/** Little-endian u32. */
function u32le(n: number): Buffer {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(n, 0);
  return b;
}

/** Little-endian u64 (bincode collection lengths + max_data_len). */
function u64le(n: number | bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(BigInt(n), 0);
  return b;
}

/**
 * Create + initialize a Buffer account owned by the loader (deploy step 1).
 *
 * Returns TWO instructions for one transaction: SystemProgram.createAccount
 * (funds the buffer's rent — paid by `payer`, so the USER pays) followed by
 * InitializeBuffer (loader variant 0), which sets the buffer authority. The
 * buffer keypair must co-sign the createAccount; the authority is the user.
 *
 * @param lamports rent-exemption for `bufferAccountSize(programLen)` (from RPC).
 */
export function createBufferIxs(params: {
  payer: PublicKey;
  buffer: PublicKey;
  authority: PublicKey;
  programLen: number;
  lamports: number;
}): TransactionInstruction[] {
  const create = SystemProgram.createAccount({
    fromPubkey: params.payer,
    newAccountPubkey: params.buffer,
    lamports: params.lamports,
    space: bufferAccountSize(params.programLen),
    programId: BPF_UPGRADEABLE_LOADER_ID,
  });
  const initialize = new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys: [
      { pubkey: params.buffer, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: false, isWritable: false },
    ],
    data: tag(0), // InitializeBuffer
  });
  return [create, initialize];
}

/**
 * Write a chunk of the ELF into the buffer at `offset` (deploy step 2).
 *
 * Loader variant 1: `Write { offset: u32, bytes: Vec<u8> }`. bincode encodes the
 * Vec length as a little-endian u64. Signed by the buffer `authority` (the user).
 */
export function writeBufferIx(params: {
  buffer: PublicKey;
  authority: PublicKey;
  offset: number;
  bytes: Uint8Array;
}): TransactionInstruction {
  const data = Buffer.concat([
    tag(1),
    u32le(params.offset),
    u64le(params.bytes.length),
    Buffer.from(params.bytes),
  ]);
  return new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys: [
      { pubkey: params.buffer, isSigner: false, isWritable: true },
      { pubkey: params.authority, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * Create the program account + deploy from the buffer (deploy step 3, final tx).
 *
 * Returns TWO instructions for one transaction:
 *   1. SystemProgram.createAccount for the Program account (signed by the program
 *      keypair; rent paid by `payer` = the user).
 *   2. DeployWithMaxDataLen (loader variant 2): `{ max_data_len: u64 }`. The loader
 *      creates the ProgramData PDA via CPI and funds it from `payer` — so the USER
 *      pays the program rent and is the ORIGINAL upgrade authority from block 0.
 *
 * Required signers for this tx: payer (user), program keypair, authority (user).
 *
 * @param programLamports rent-exemption for `PROGRAM_ACCOUNT_SIZE` (from RPC).
 * @param maxDataLen      permanent upgrade headroom (≥ programLen; CLI uses 2×).
 */
export function deployWithMaxDataLenIxs(params: {
  payer: PublicKey;
  program: PublicKey;
  programData: PublicKey;
  buffer: PublicKey;
  authority: PublicKey;
  programLamports: number;
  maxDataLen: number;
}): TransactionInstruction[] {
  const createProgram = SystemProgram.createAccount({
    fromPubkey: params.payer,
    newAccountPubkey: params.program,
    lamports: params.programLamports,
    space: PROGRAM_ACCOUNT_SIZE,
    programId: BPF_UPGRADEABLE_LOADER_ID,
  });
  const deploy = new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys: [
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: params.programData, isSigner: false, isWritable: true },
      { pubkey: params.program, isSigner: false, isWritable: true },
      { pubkey: params.buffer, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: params.authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat([tag(2), u64le(params.maxDataLen)]),
  });
  return [createProgram, deploy];
}

/** Split an ELF into [offset, chunk] pairs of at most MAX_WRITE_CHUNK bytes. */
export function chunkProgram(
  bytes: Uint8Array,
  chunkSize: number = MAX_WRITE_CHUNK,
): Array<{ offset: number; chunk: Uint8Array }> {
  const out: Array<{ offset: number; chunk: Uint8Array }> = [];
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    out.push({ offset, chunk: bytes.subarray(offset, offset + chunkSize) });
  }
  return out;
}

/**
 * Set (transfer) the program's upgrade authority, OR remove it permanently.
 *
 * Uses the *unchecked* SetAuthority variant: the new authority does NOT have to
 * co-sign (same as `solana program set-upgrade-authority`). Pass
 * `newAuthority = null` to make the program IMMUTABLE — there is no way to undo
 * that, the program can never be upgraded or closed again.
 */
export function setUpgradeAuthorityIx(params: {
  programId: PublicKey;
  currentAuthority: PublicKey;
  newAuthority: PublicKey | null;
}): TransactionInstruction {
  const keys = [
    {
      pubkey: deriveProgramDataAddress(params.programId),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: params.currentAuthority, isSigner: true, isWritable: false },
  ];
  if (params.newAuthority) {
    keys.push({
      pubkey: params.newAuthority,
      isSigner: false,
      isWritable: false,
    });
  }
  return new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys,
    data: tag(4),
  });
}

/**
 * Close the program permanently, reclaiming the ProgramData account's rent
 * lamports to `recipient`. The program can never be invoked again. Irreversible.
 */
export function closeProgramIx(params: {
  programId: PublicKey;
  currentAuthority: PublicKey;
  recipient: PublicKey;
}): TransactionInstruction {
  return new TransactionInstruction({
    programId: BPF_UPGRADEABLE_LOADER_ID,
    keys: [
      {
        pubkey: deriveProgramDataAddress(params.programId),
        isSigner: false,
        isWritable: true,
      },
      { pubkey: params.recipient, isSigner: false, isWritable: true },
      { pubkey: params.currentAuthority, isSigner: true, isWritable: false },
      { pubkey: params.programId, isSigner: false, isWritable: true },
    ],
    data: tag(5),
  });
}
