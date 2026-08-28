import type { Network } from './api';
import { buildExplorerUrl } from './explorer';

/**
 * Pure, testable helpers for the on-chain transaction-history feed
 * ("Solscan-lite"). The React component (ContractTxHistory) owns the RPC
 * calls and rendering; everything that can be unit-tested without a wallet
 * connection lives here.
 */

/** Minimal shape we consume from `connection.getSignaturesForAddress`. */
export interface SignatureRow {
  signature: string;
  /** Unix seconds, or null/undefined when the block time is unavailable. */
  blockTime?: number | null;
  slot: number;
  /** Non-null when the transaction failed. Web3.js types this as object|null. */
  err: unknown | null;
}

/** Derived view model the component maps each signature into for rendering. */
export interface TxRowView {
  signature: string;
  shortSignature: string;
  /** Human, locale-aware absolute time, or null when no block time. */
  absoluteTime: string | null;
  /** Compact relative time ("just now", "3m ago"), or null when no block time. */
  relativeTime: string | null;
  slot: number;
  status: TxStatus;
  explorerUrl: string;
}

export type TxStatus = 'success' | 'failed';

/**
 * Shorten a base58 signature/address to `head…tail`. Signatures are long
 * (~88 chars) so a 4/4 split keeps rows scannable while staying unambiguous.
 */
export function shortenSignature(
  signature: string,
  head = 4,
  tail = 4,
): string {
  if (!signature) return '';
  if (signature.length <= head + tail + 1) return signature;
  return `${signature.slice(0, head)}…${signature.slice(-tail)}`;
}

/**
 * Map a transaction's `err` field to a coarse status. Solana returns `null`
 * on success and a non-null object (instruction error, etc.) on failure.
 */
export function txStatus(err: unknown | null): TxStatus {
  return err == null ? 'success' : 'failed';
}

/**
 * Compact relative time from a Unix-seconds block time, anchored to `now`
 * (defaults to the current time; injectable for deterministic tests).
 * Returns null when no block time is available (unconfirmed / pruned).
 */
export function relativeTime(
  blockTime: number | null | undefined,
  now: number = Date.now(),
): string | null {
  if (blockTime == null) return null;
  const diffSec = Math.floor((now - blockTime * 1000) / 1000);
  if (diffSec < 0) return 'just now'; // clock skew — never show "in the future"
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

/**
 * Locale-aware absolute time string from a Unix-seconds block time, or null
 * when unavailable. Kept separate from {@link relativeTime} so callers can
 * show the relative form inline and the absolute form as a tooltip.
 */
export function absoluteTime(
  blockTime: number | null | undefined,
): string | null {
  if (blockTime == null) return null;
  return new Date(blockTime * 1000).toLocaleString();
}

/**
 * Explorer URL for a transaction signature on the program's actual network.
 * Thin wrapper over {@link buildExplorerUrl} so the component (and tests)
 * have a single, intention-revealing entry point for tx links.
 */
export function explorerTxUrl(
  signature: string,
  network?: Network | string | null,
): string {
  return buildExplorerUrl('tx', signature, network);
}

/**
 * Explorer URL for the program/address itself (the feed header links here).
 */
export function explorerProgramUrl(
  programId: string,
  network?: Network | string | null,
): string {
  return buildExplorerUrl('address', programId, network);
}

/**
 * Turn a raw signature row from the RPC into the view model the component
 * renders. Pure: all time/status/url derivation flows through the helpers
 * above so it is fully unit-testable.
 */
export function toTxRowView(
  row: SignatureRow,
  network?: Network | string | null,
  now: number = Date.now(),
): TxRowView {
  return {
    signature: row.signature,
    shortSignature: shortenSignature(row.signature),
    absoluteTime: absoluteTime(row.blockTime),
    relativeTime: relativeTime(row.blockTime, now),
    slot: row.slot,
    status: txStatus(row.err),
    explorerUrl: explorerTxUrl(row.signature, network),
  };
}
