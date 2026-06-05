'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  Wand2,
  AlertTriangle,
} from 'lucide-react';
import { PublicKey } from '@solana/web3.js';
import { apiClient } from '@/services/api';
import type { ContractIdlResponse } from '@/lib/api';
import { resolveProgramId } from '@/lib/anchorIx';
import { buildExplorerUrl } from '@/lib/explorer';
import { InstructionActionForm } from './InstructionActionForm';

interface ContractActionsPanelProps {
  /** Contract UID used to fetch the IDL. */
  uid: string;
  /** Deployed program/contract address (fallback display). */
  contractAddress?: string;
  /** Network override; otherwise taken from the IDL response. */
  network?: string;
  onClose: () => void;
}

export function ContractActionsPanel({
  uid,
  contractAddress,
  network,
  onClose,
}: ContractActionsPanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ContractIdlResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiClient
      .getContractIdl(uid)
      .then((resp) => {
        if (!cancelled) setData(resp);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load IDL');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const effectiveNetwork = network ?? data?.network ?? 'devnet';
  const displayProgramId =
    data?.idl?.address ?? data?.program_id ?? contractAddress ?? null;

  // resolveProgramId throws on missing id; only attempt when we have one.
  const programId = useMemo<PublicKey | null>(() => {
    if (!data) return null;
    try {
      return resolveProgramId(data);
    } catch {
      if (contractAddress) {
        try {
          return new PublicKey(contractAddress);
        } catch {
          return null;
        }
      }
      return null;
    }
  }, [data, contractAddress]);

  const instructions = data?.idl?.instructions ?? [];

  const handleCopy = useCallback(() => {
    if (!displayProgramId) return;
    void navigator.clipboard.writeText(displayProgramId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [displayProgramId]);

  if (!mounted) return null;

  const overlay = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-[#FE4A01]" />
            <h2 className="text-sm font-semibold text-white">
              Contract Actions
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#2a2a2a] transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4 space-y-4">
          {/* Program info */}
          {displayProgramId && (
            <div className="bg-[#161616] border border-[#2a2a2a] rounded-md p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-wide text-gray-500">
                  Program ID
                </span>
                <span className="text-[10px] text-gray-500">
                  {effectiveNetwork}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <code className="text-xs text-gray-300 font-mono break-all">
                  {displayProgramId}
                </code>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3 h-3 text-green-400" /> Copied
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" /> Copy
                    </>
                  )}
                </button>
                <a
                  href={buildExplorerUrl(
                    'address',
                    displayProgramId,
                    effectiveNetwork,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
                >
                  Explorer <ExternalLink className="w-3 h-3" />
                </a>
                {!loading && !error && (
                  <span className="text-[11px] text-gray-500 ml-auto">
                    {instructions.length} instruction
                    {instructions.length === 1 ? '' : 's'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* States */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-gray-400 text-sm">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading IDL…
            </div>
          )}

          {!loading && error && (
            <div className="flex items-start gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && (!data || data.idl === null) && (
            <div className="text-center py-8 text-gray-400 text-sm">
              <p>No IDL available for this contract.</p>
              <p className="text-[11px] text-gray-500 mt-1">
                The build produced no IDL — only the program info above is
                available.
              </p>
            </div>
          )}

          {!loading &&
            !error &&
            data?.idl &&
            instructions.length === 0 && (
              <div className="text-center py-8 text-gray-400 text-sm">
                This IDL exposes no callable instructions.
              </div>
            )}

          {!loading && !error && data?.idl && instructions.length > 0 && (
            <>
              {programId ? (
                <div className="space-y-2">
                  {instructions.map((ix, i) => (
                    <InstructionActionForm
                      key={`${ix.name}-${i}`}
                      instruction={ix}
                      programId={programId}
                      network={effectiveNetwork}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex items-start gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded p-3">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    Could not resolve a valid program id, so instructions cannot
                    be sent.
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}
