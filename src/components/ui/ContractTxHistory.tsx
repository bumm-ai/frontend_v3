'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { useConnection } from '@solana/wallet-adapter-react';
import {
  toTxRowView,
  explorerProgramUrl,
  type SignatureRow,
  type TxRowView,
} from '@/lib/txHistory';

interface ContractTxHistoryProps {
  /** Base58 address of the deployed program. */
  programId: string;
  /** Network the program is deployed to (devnet / mainnet-beta / testnet). */
  network: string;
  /** How many recent signatures to fetch. */
  limit?: number;
}

type LoadState = 'loading' | 'error' | 'ready';

/**
 * "Solscan-lite" — a lightweight on-chain activity feed for a deployed
 * program, rendered inline in the dashboard. Reads the same env-parameterised
 * connection as the rest of the app (useConnection / WalletProvider) and lists
 * the most recent signatures via getSignaturesForAddress — cheap and enough
 * for a feed; per-tx detail can be layered on later with getParsedTransaction.
 *
 * Self-contained: all time/status/url derivation lives in pure helpers in
 * `@/lib/txHistory` (unit-tested); this component only owns the RPC call,
 * the loading/error/empty states, and rendering.
 */
export function ContractTxHistory({
  programId,
  network,
  limit = 10,
}: ContractTxHistoryProps) {
  const { connection } = useConnection();
  const [state, setState] = useState<LoadState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<TxRowView[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  // Validate the program id once; an invalid base58 string means there's
  // nothing to fetch and we surface a clear error instead of throwing.
  const pubkey = useMemo<PublicKey | null>(() => {
    try {
      return new PublicKey(programId);
    } catch {
      return null;
    }
  }, [programId]);

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      if (!pubkey) {
        setState('error');
        setError('Invalid program address.');
        return;
      }
      setState('loading');
      setError(null);
      try {
        const sigs = await connection.getSignaturesForAddress(pubkey, {
          limit,
        });
        if (signal?.cancelled) return;
        const now = Date.now();
        const view = sigs.map((s) =>
          toTxRowView(s as SignatureRow, network, now),
        );
        setRows(view);
        setState('ready');
      } catch (err) {
        if (signal?.cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to load on-chain activity.',
        );
        setState('error');
      }
    },
    [connection, pubkey, limit, network],
  );

  useEffect(() => {
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [load]);

  const copySignature = useCallback((sig: string) => {
    void navigator.clipboard.writeText(sig).then(() => {
      setCopied(sig);
      setTimeout(() => setCopied((cur) => (cur === sig ? null : cur)), 1500);
    });
  }, []);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <a
          href={explorerProgramUrl(programId, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-gray-500 hover:text-gray-300 transition-colors"
        >
          <Activity className="w-3 h-3" />
          On-chain activity
          <ExternalLink className="w-3 h-3" />
        </a>
        <button
          onClick={() => void load()}
          disabled={state === 'loading'}
          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw
            className={`w-3 h-3 ${state === 'loading' ? 'animate-spin' : ''}`}
          />
          Refresh
        </button>
      </div>

      {state === 'loading' && (
        <div className="flex items-center justify-center gap-2 py-6 text-gray-400 text-xs">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading activity…
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="break-words">
            {error ?? 'Could not reach the network.'}
          </span>
        </div>
      )}

      {state === 'ready' && rows.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-xs">
          No transactions yet.
        </div>
      )}

      {state === 'ready' && rows.length > 0 && (
        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li
              key={row.signature}
              className="flex items-center gap-2 bg-[#161616] border border-[#2a2a2a] rounded-md px-2.5 py-2"
            >
              {row.status === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
              ) : (
                <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
              )}

              <a
                href={row.explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-gray-300 font-mono hover:text-white inline-flex items-center gap-1 transition-colors"
                title={row.signature}
              >
                {row.shortSignature}
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </a>

              <button
                onClick={() => copySignature(row.signature)}
                className="text-gray-500 hover:text-white transition-colors shrink-0"
                title="Copy signature"
              >
                {copied === row.signature ? (
                  <Check className="w-3 h-3 text-green-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
              </button>

              <span
                className="ml-auto text-[10px] text-gray-500 whitespace-nowrap"
                title={row.absoluteTime ?? undefined}
              >
                {row.relativeTime ?? 'pending'}
              </span>

              <span className="text-[10px] text-gray-600 whitespace-nowrap">
                slot {row.slot}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
