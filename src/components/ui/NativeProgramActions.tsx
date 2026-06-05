'use client';

import { useState } from 'react';
import {
  Crown,
  Snowflake,
  Trash2,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction } from '@solana/web3.js';
import {
  setUpgradeAuthorityIx,
  closeProgramIx,
} from '@/lib/upgradeableLoader';
import { waitForFinalized } from '@/lib/solanaPay';
import { buildExplorerUrl } from '@/lib/explorer';

interface NativeProgramActionsProps {
  programId: PublicKey;
  network: string;
}

type ActionId = 'transfer' | 'immutable' | 'close';

/**
 * Wallet-signed program-management actions that need NO IDL: transfer the
 * upgrade authority, make the program immutable, or close it to reclaim rent.
 * These target the BPF Upgradeable Loader directly and are signed by the
 * connected wallet (which holds the upgrade authority after a Bumm deploy).
 */
export function NativeProgramActions({
  programId,
  network,
}: NativeProgramActionsProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [open, setOpen] = useState<ActionId | null>(null);
  const [newAuthority, setNewAuthority] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const reset = () => {
    setArmed(false);
    setError(null);
    setSignature(null);
  };

  const toggle = (id: ActionId) => {
    setOpen((cur) => (cur === id ? null : id));
    setNewAuthority('');
    reset();
  };

  const buildTx = (id: ActionId): Transaction => {
    if (!publicKey) throw new Error('Connect your wallet first.');
    if (id === 'transfer') {
      const raw = newAuthority.trim();
      if (raw === '') throw new Error('Enter the new authority address.');
      let next: PublicKey;
      try {
        next = new PublicKey(raw);
      } catch {
        throw new Error('Invalid base58 address.');
      }
      return new Transaction().add(
        setUpgradeAuthorityIx({
          programId,
          currentAuthority: publicKey,
          newAuthority: next,
        }),
      );
    }
    if (id === 'immutable') {
      return new Transaction().add(
        setUpgradeAuthorityIx({
          programId,
          currentAuthority: publicKey,
          newAuthority: null,
        }),
      );
    }
    // close
    return new Transaction().add(
      closeProgramIx({
        programId,
        currentAuthority: publicKey,
        recipient: publicKey,
      }),
    );
  };

  const arm = (id: ActionId) => {
    setError(null);
    setSignature(null);
    try {
      buildTx(id); // validate inputs before showing the confirm step
      setArmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const send = async (id: ActionId) => {
    if (!connected || !publicKey || !sendTransaction) {
      setError('Connect your wallet first.');
      return;
    }
    setBusy(true);
    setError(null);
    setSignature(null);
    try {
      const tx = buildTx(id);
      const sig = await sendTransaction(tx, connection);
      await waitForFinalized(connection, sig);
      setSignature(sig);
      setArmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setArmed(false);
    } finally {
      setBusy(false);
    }
  };

  const ACTIONS: {
    id: ActionId;
    label: string;
    icon: typeof Crown;
    danger?: boolean;
    warn: string;
  }[] = [
    {
      id: 'transfer',
      label: 'Transfer upgrade authority',
      icon: Crown,
      warn: 'Hand the upgrade authority to another wallet. Double-check the address — an unchecked transfer to the wrong key cannot be undone.',
    },
    {
      id: 'immutable',
      label: 'Make immutable (freeze)',
      icon: Snowflake,
      danger: true,
      warn: 'Removes the upgrade authority forever. The program can never be upgraded or closed again. Irreversible.',
    },
    {
      id: 'close',
      label: 'Close program (reclaim rent)',
      icon: Trash2,
      danger: true,
      warn: 'Permanently disables the program and returns its rent lamports to your wallet. The program can never be invoked again. Irreversible.',
    },
  ];

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-500">
        Manage program
      </p>
      {!connected && (
        <p className="text-[11px] text-amber-400/80">
          Connect the wallet that holds the upgrade authority to run these.
        </p>
      )}
      {ACTIONS.map((a) => {
        const isOpen = open === a.id;
        const Icon = a.icon;
        return (
          <div
            key={a.id}
            className="border border-[#2a2a2a] rounded-md overflow-hidden bg-[#161616]"
          >
            <button
              onClick={() => toggle(a.id)}
              className={`w-full flex items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-[#1e1e1e] ${
                a.danger ? 'text-red-300' : 'text-gray-200'
              }`}
            >
              <span className="flex items-center gap-2">
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <Icon className="w-3.5 h-3.5" />
                {a.label}
              </span>
            </button>

            {isOpen && (
              <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[#2a2a2a]">
                <div
                  className={`flex items-start gap-2 text-[11px] rounded p-2 border ${
                    a.danger
                      ? 'text-red-300 bg-red-500/10 border-red-500/30'
                      : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  <span>{a.warn}</span>
                </div>

                {a.id === 'transfer' && (
                  <label className="block">
                    <span className="text-xs text-gray-400 font-mono">
                      new authority{' '}
                      <span className="text-gray-600">base58 pubkey</span>
                    </span>
                    <input
                      type="text"
                      value={newAuthority}
                      onChange={(e) => {
                        setNewAuthority(e.target.value);
                        reset();
                      }}
                      placeholder="paste base58 address"
                      className="mt-1 w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#FE4A01]/60"
                    />
                  </label>
                )}

                {error && (
                  <div className="flex items-start gap-2 text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded p-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="break-words">{error}</span>
                  </div>
                )}
                {signature && (
                  <div className="flex items-start gap-2 text-[11px] text-green-400 bg-green-500/10 border border-green-500/30 rounded p-2">
                    <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span className="break-all">
                      Finalized.{' '}
                      <a
                        href={buildExplorerUrl('tx', signature, network)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline inline-flex items-center gap-1"
                      >
                        View transaction
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </span>
                  </div>
                )}

                {!armed ? (
                  <button
                    onClick={() => arm(a.id)}
                    disabled={busy || !connected}
                    className="w-full px-3 py-2 rounded-md text-xs font-medium bg-[#FE4A01] text-white hover:bg-[#FE4A01]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {connected ? 'Continue' : 'Connect wallet to continue'}
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => send(a.id)}
                      disabled={busy}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium text-white disabled:opacity-50 transition-colors ${
                        a.danger
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-[#FE4A01] hover:bg-[#FE4A01]/90'
                      }`}
                    >
                      {busy ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Sending…
                        </>
                      ) : (
                        `Confirm & sign on ${network}`
                      )}
                    </button>
                    <button
                      onClick={() => setArmed(false)}
                      disabled={busy}
                      className="px-3 py-2 rounded-md text-xs font-medium bg-[#2a2a2a] text-gray-300 hover:bg-[#333] disabled:opacity-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
