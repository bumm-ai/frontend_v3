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

import { PublicKey, TransactionInstruction } from '@solana/web3.js';

/** The on-chain BPF Upgradeable Loader program. */
export const BPF_UPGRADEABLE_LOADER_ID = new PublicKey(
  'BPFLoaderUpgradeab1e11111111111111111111111',
);

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
