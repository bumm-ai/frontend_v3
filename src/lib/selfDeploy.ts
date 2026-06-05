'use client';

/**
 * Non-custodial self-deploy transaction assembly (RFC-013).
 *
 * Builds the upgradeable-loader deploy as the user's OWN wallet: a buffer-create
 * tx, N buffer-write txs, and a final create-program + deploy tx. The user is the
 * fee payer and the ORIGINAL upgrade authority — no custodial key ever signs.
 *
 * This module is the PURE, testable core (given a blockhash it produces the exact
 * transactions). The network + wallet glue (RPC rent lookups, signAllTransactions,
 * send/confirm, the /self-deploy confirm call) lives in `useSelfDeploy`.
 */

import {
  Keypair,
  PublicKey,
  Transaction,
} from '@solana/web3.js';
import {
  bufferAccountSize,
  chunkProgram,
  createBufferIxs,
  deployWithMaxDataLenIxs,
  deriveProgramDataAddress,
  PROGRAM_ACCOUNT_SIZE,
  writeBufferIx,
} from '@/lib/upgradeableLoader';

/** Minimal shape of the wallet-adapter we depend on for self-deploy. */
export interface SelfDeployWallet {
  publicKey: PublicKey | null;
  signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
}

/** A wallet can self-deploy only if it can batch-sign (else the UX is N popups). */
export function walletCanSelfDeploy(wallet: SelfDeployWallet | null | undefined): boolean {
  return !!wallet && !!wallet.publicKey && typeof wallet.signAllTransactions === 'function';
}

/** Decode a base64 `.so` payload into raw ELF bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64.trim());
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Bytes needed for the buffer + program accounts so callers can fetch rent. */
export function selfDeployAccountSizes(programLen: number): {
  bufferSize: number;
  programSize: number;
} {
  return { bufferSize: bufferAccountSize(programLen), programSize: PROGRAM_ACCOUNT_SIZE };
}

export interface SelfDeployPlan {
  /** create-buffer + initialize (co-signed by the buffer keypair). */
  create: Transaction;
  /** one Write tx per ELF chunk (signed by the wallet authority). */
  writes: Transaction[];
  /** create-program + DeployWithMaxDataLen (co-signed by the program keypair). */
  deploy: Transaction;
  /** All transactions in dependency order — feed to signAllTransactions. */
  ordered: Transaction[];
}

/**
 * Assemble every transaction for a non-custodial deploy.
 *
 * The ephemeral `bufferKeypair`/`programKeypair` partial-sign their own
 * account-creation txs here; the wallet adds its signatures later via
 * signAllTransactions. `maxDataLen` defaults to 2× the program (upgrade headroom,
 * matching the Solana CLI).
 */
export function buildSelfDeployPlan(params: {
  payer: PublicKey;
  programKeypair: Keypair;
  bufferKeypair: Keypair;
  programBytes: Uint8Array;
  bufferLamports: number;
  programLamports: number;
  recentBlockhash: string;
  maxDataLen?: number;
}): SelfDeployPlan {
  const {
    payer,
    programKeypair,
    bufferKeypair,
    programBytes,
    bufferLamports,
    programLamports,
    recentBlockhash,
  } = params;
  const maxDataLen = params.maxDataLen ?? programBytes.length * 2;
  const buffer = bufferKeypair.publicKey;
  const program = programKeypair.publicKey;
  const programData = deriveProgramDataAddress(program);

  const prep = (tx: Transaction): Transaction => {
    tx.feePayer = payer;
    tx.recentBlockhash = recentBlockhash;
    return tx;
  };

  // 1) Create + initialize the buffer (buffer keypair co-signs the createAccount).
  const create = prep(
    new Transaction().add(
      ...createBufferIxs({
        payer,
        buffer,
        authority: payer,
        programLen: programBytes.length,
        lamports: bufferLamports,
      }),
    ),
  );
  create.partialSign(bufferKeypair);

  // 2) Write the ELF in chunks (authority = the user wallet).
  const writes = chunkProgram(programBytes).map(({ offset, chunk }) =>
    prep(new Transaction().add(writeBufferIx({ buffer, authority: payer, offset, bytes: chunk }))),
  );

  // 3) Create the program account + deploy (program keypair co-signs).
  const deploy = prep(
    new Transaction().add(
      ...deployWithMaxDataLenIxs({
        payer,
        program,
        programData,
        buffer,
        authority: payer,
        programLamports,
        maxDataLen,
      }),
    ),
  );
  deploy.partialSign(programKeypair);

  return { create, writes, deploy, ordered: [create, ...writes, deploy] };
}
