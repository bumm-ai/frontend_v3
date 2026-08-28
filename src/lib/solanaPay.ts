'use client';

import type { Connection } from '@solana/web3.js';
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';

const FINALIZATION_TIMEOUT_MS = 60_000;
const FINALIZATION_POLL_MS = 1_500;

/** SPL Memo program — standard Solana program for on-chain text labels. */
const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

/**
 * Build a Memo instruction carrying a BUMM attribution tag. The signer is
 * included as a read-only signer account so the memo is provably authored by
 * the payer. Uses TextEncoder (not Buffer) — Buffer is not available in the
 * browser bundle without a polyfill.
 */
function buildMemoInstruction(text: string, signer: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [{ pubkey: signer, isSigner: true, isWritable: false }],
    data: new TextEncoder().encode(text) as unknown as Buffer,
  });
}

/**
 * Block until a transaction reaches `finalized` commitment.
 *
 * The backend verifies SOL payments (credit purchase, subscription, fund-first
 * deploy) at finalized commitment, so notifying it after only `confirmed` races
 * and yields "not found or not yet finalized". Mirrors the original inline
 * helper in HeaderCreditsButton so all three pay-flows share one definition.
 */
export async function waitForFinalized(
  connection: Connection,
  signature: string,
  timeoutMs = FINALIZATION_TIMEOUT_MS,
  pollMs = FINALIZATION_POLL_MS,
): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statuses.value[0];
    if (status?.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'finalized') return;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error('Transaction was not finalized in time. Please try again.');
}

/** Wallet-adapter `sendTransaction` signature (subset we depend on). */
export type SendTransactionFn = (
  transaction: Transaction,
  connection: Connection,
) => Promise<string>;

/**
 * Build, sign (via the wallet adapter), and send a single SOL transfer.
 *
 * @returns the transaction signature (NOT yet finalized — call
 *   {@link waitForFinalized} before notifying the backend).
 * @throws if `recipient` is not a valid base58 pubkey or `lamports <= 0`.
 */
export async function sendSolTransfer(
  connection: Connection,
  fromPubkey: PublicKey,
  sendTransaction: SendTransactionFn,
  recipient: string,
  lamports: number,
  memo?: string,
): Promise<string> {
  if (!Number.isFinite(lamports) || lamports <= 0) {
    throw new Error('Invalid payment amount.');
  }
  let toPubkey: PublicKey;
  try {
    toPubkey = new PublicKey(recipient);
  } catch {
    throw new Error('Invalid recipient wallet address.');
  }
  const tx = new Transaction().add(
    SystemProgram.transfer({ fromPubkey, toPubkey, lamports: Math.round(lamports) }),
  );
  // On-chain BUMM attribution tag (H4): makes the inflow/deploy provably
  // BUMM-originated on a block explorer.
  if (memo) {
    tx.add(buildMemoInstruction(memo, fromPubkey));
  }
  return sendTransaction(tx, connection);
}

/**
 * Retry a backend-notify call that may transiently 404 while the funding tx
 * propagates to the backend's RPC view, even after the client saw `finalized`.
 */
export async function retryOnNotFinalized<T>(
  fn: () => Promise<T>,
  maxAttempts = 4,
): Promise<T> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNotReadyYet =
        message.includes('not found or not yet finalized') ||
        message.includes('not yet finalized');
      if (!isNotReadyYet || attempt === maxAttempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
  throw new Error('unreachable');
}

export { LAMPORTS_PER_SOL };
