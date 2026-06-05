'use client';

import { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type AccountMeta,
} from '@solana/web3.js';
import type { IDLInstruction, IDLInstructionAccount } from '@/lib/api';
import {
  getDiscriminator,
  borshEncodeArgs,
  buildInstruction,
} from '@/lib/anchorIx';
import { parseArgValue, describeType, type ParsedArg } from '@/lib/anchorTypes';
import { waitForFinalized } from '@/lib/solanaPay';
import { buildExplorerUrl } from '@/lib/explorer';

interface InstructionActionFormProps {
  instruction: IDLInstruction;
  programId: PublicKey;
  network: string;
}

const SYSTEM_PROGRAM_NAMES = new Set(['systemProgram', 'system_program']);

function isSigner(acc: IDLInstructionAccount): boolean {
  return acc.signer === true || acc.isSigner === true;
}
function isWritable(acc: IDLInstructionAccount): boolean {
  return acc.writable === true || acc.isMut === true;
}
function isSystemProgram(acc: IDLInstructionAccount): boolean {
  return SYSTEM_PROGRAM_NAMES.has(acc.name);
}

export function InstructionActionForm({
  instruction,
  programId,
  network,
}: InstructionActionFormProps) {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [expanded, setExpanded] = useState(false);
  const [argValues, setArgValues] = useState<Record<string, string>>({});
  const [accountValues, setAccountValues] = useState<Record<string, string>>({});
  const [confirmArmed, setConfirmArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const args = useMemo(() => instruction.args ?? [], [instruction.args]);
  const accounts = useMemo(
    () => instruction.accounts ?? [],
    [instruction.accounts],
  );

  const resetResult = () => {
    setError(null);
    setSignature(null);
    setConfirmArmed(false);
  };

  const handleArmConfirm = () => {
    setError(null);
    setSignature(null);
    // Validate everything before arming the explicit confirm step.
    const validation = validateAll();
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setConfirmArmed(true);
  };

  function validateAll():
    | { ok: true; parsedArgs: ParsedArg[]; metas: AccountMeta[] }
    | { ok: false; error: string } {
    if (!connected || !publicKey) {
      return { ok: false, error: 'Connect your wallet first.' };
    }

    // Args
    const parsedArgs: ParsedArg[] = [];
    for (const arg of args) {
      const raw = argValues[arg.name] ?? '';
      const r = parseArgValue(arg.type, raw);
      if (!r.ok) {
        return { ok: false, error: `Arg "${arg.name}": ${r.error}` };
      }
      parsedArgs.push(r.value);
    }

    // Accounts
    const metas: AccountMeta[] = [];
    for (const acc of accounts) {
      let pubkey: PublicKey;
      if (isSigner(acc)) {
        pubkey = publicKey;
      } else if (isSystemProgram(acc)) {
        pubkey = SystemProgram.programId;
      } else {
        const raw = (accountValues[acc.name] ?? '').trim();
        if (raw === '') {
          return { ok: false, error: `Account "${acc.name}" is required.` };
        }
        try {
          pubkey = new PublicKey(raw);
        } catch {
          return {
            ok: false,
            error: `Account "${acc.name}": invalid base58 address.`,
          };
        }
      }
      metas.push({
        pubkey,
        isSigner: isSigner(acc),
        isWritable: isWritable(acc),
      });
    }

    return { ok: true, parsedArgs, metas };
  }

  const handleSend = async () => {
    if (!connected || !publicKey || !sendTransaction) {
      setError('Connect your wallet first.');
      return;
    }
    const validation = validateAll();
    if (!validation.ok) {
      setError(validation.error);
      setConfirmArmed(false);
      return;
    }

    setBusy(true);
    setError(null);
    setSignature(null);
    try {
      const discriminator = getDiscriminator(instruction);
      const encodedArgs = borshEncodeArgs(
        args.map((a) => ({ name: a.name, type: a.type })),
        validation.parsedArgs,
      );
      const ix = buildInstruction({
        programId,
        discriminator,
        encodedArgs,
        accountMetas: validation.metas,
      });
      const tx = new Transaction().add(ix);
      const sig = await sendTransaction(tx, connection);
      await waitForFinalized(connection, sig);
      setSignature(sig);
      setConfirmArmed(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      setConfirmArmed(false);
    } finally {
      setBusy(false);
    }
  };

  const hasUnsupportedArg = args.some((a) => describeType(a.type) === null);

  return (
    <div className="border border-[#2a2a2a] rounded-md overflow-hidden bg-[#161616]">
      <button
        onClick={() => {
          setExpanded((v) => !v);
          if (expanded) resetResult();
        }}
        className="w-full flex items-center justify-between px-3 py-2.5 text-sm text-gray-200 hover:bg-[#1e1e1e] transition-colors"
      >
        <span className="flex items-center gap-2 font-mono">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
          {instruction.name}
        </span>
        <span className="text-[10px] text-gray-500">
          {args.length} arg{args.length === 1 ? '' : 's'} ·{' '}
          {accounts.length} acct{accounts.length === 1 ? '' : 's'}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-[#2a2a2a]">
          {hasUnsupportedArg && (
            <div className="flex items-start gap-2 text-[11px] text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>
                This instruction has a struct/enum/custom arg type that this UI
                cannot encode. Use the Anchor CLI instead.
              </span>
            </div>
          )}

          {/* Args */}
          {args.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                Arguments
              </p>
              {args.map((arg) => {
                const hint = describeType(arg.type);
                return (
                  <label key={arg.name} className="block">
                    <span className="text-xs text-gray-400 font-mono">
                      {arg.name}{' '}
                      <span className="text-gray-600">
                        {hint ?? 'unsupported'}
                      </span>
                    </span>
                    <input
                      type="text"
                      disabled={hint === null}
                      value={argValues[arg.name] ?? ''}
                      onChange={(e) => {
                        setArgValues((p) => ({
                          ...p,
                          [arg.name]: e.target.value,
                        }));
                        resetResult();
                      }}
                      placeholder={hint ?? ''}
                      className="mt-1 w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#FE4A01]/60 disabled:opacity-40"
                    />
                  </label>
                );
              })}
            </div>
          )}

          {/* Accounts */}
          {accounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">
                Accounts
              </p>
              {accounts.map((acc) => {
                const auto = isSigner(acc)
                  ? 'wallet (signer)'
                  : isSystemProgram(acc)
                    ? 'System Program'
                    : null;
                const hasPda = acc.pda != null;
                return (
                  <div key={acc.name}>
                    <span className="text-xs text-gray-400 font-mono">
                      {acc.name}
                      {isWritable(acc) && (
                        <span className="text-gray-600"> · writable</span>
                      )}
                    </span>
                    {auto ? (
                      <div className="mt-1 w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-gray-500 italic">
                        auto-filled: {auto}
                      </div>
                    ) : (
                      <>
                        <input
                          type="text"
                          value={accountValues[acc.name] ?? ''}
                          onChange={(e) => {
                            setAccountValues((p) => ({
                              ...p,
                              [acc.name]: e.target.value,
                            }));
                            resetResult();
                          }}
                          placeholder="paste base58 address"
                          className="mt-1 w-full bg-[#0f0f0f] border border-[#2a2a2a] rounded px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-[#FE4A01]/60"
                        />
                        {hasPda && (
                          <p className="mt-1 text-[10px] text-amber-400/80">
                            This is a PDA — derive it yourself and paste the
                            address (no auto-derivation).
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Result / error */}
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

          {/* Action */}
          {!confirmArmed ? (
            <button
              onClick={handleArmConfirm}
              disabled={busy || hasUnsupportedArg || !connected}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-[#FE4A01] text-white hover:bg-[#FE4A01]/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {connected ? 'Build & Send' : 'Connect wallet to send'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-start gap-2 text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>
                  This signs a REAL transaction on{' '}
                  <span className="font-semibold">{network}</span>. Confirm to
                  proceed.
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSend}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium bg-[#FE4A01] text-white hover:bg-[#FE4A01]/90 disabled:opacity-50 transition-colors"
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
                  onClick={() => setConfirmArmed(false)}
                  disabled={busy}
                  className="px-3 py-2 rounded-md text-xs font-medium bg-[#2a2a2a] text-gray-300 hover:bg-[#333] disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
