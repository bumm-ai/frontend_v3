'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Loader2, Rocket, Wallet } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { apiClient } from '@/services/api';
import type { DeployEstimate } from '@/lib/api';
import {
  sendSolTransfer,
  waitForFinalized,
  retryOnNotFinalized,
  LAMPORTS_PER_SOL,
} from '@/lib/solanaPay';
import { useSelfDeploy } from '@/hooks/useSelfDeploy';

export interface FundDeployCardProps {
  /** Contract uid to deploy. */
  uid: string;
  /** Whether this is an upgrade of an already-deployed contract. */
  isUpgrade?: boolean;
  /** Network fallback label until the estimate loads. */
  network?: string | null;
  /**
   * Test-net deploy path (free airdrop, server-paid) — the existing
   * `onStartStep('deploy')` → triggerDeploy. Used when the estimate says the
   * target is not mainnet.
   */
  onTestnetDeploy: () => Promise<void>;
  /** Dismiss without deploying. */
  onCancel: () => void;
  /** Optional note after a successful mainnet fund + deploy hand-off. */
  onFunded?: (lamports: number) => void;
}

/**
 * Inline deploy confirmation that is FUND-AWARE (B3 fund-first deploy).
 *
 * - On test nets it is the same "yes, spend it" gate as before and resumes the
 *   server-paid deploy.
 * - On mainnet the USER pays: it signs a SOL transfer of the estimated rent to
 *   the deployer wallet, waits for finalization, then POSTs the funding
 *   signature to `/fund-deploy`, which verifies it on-chain and resumes the
 *   deploy with the user owning the program's upgrade authority immediately.
 */
export const FundDeployCard = ({
  uid,
  isUpgrade,
  network,
  onTestnetDeploy,
  onCancel,
  onFunded,
}: FundDeployCardProps) => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  // Non-custodial deploy (RFC-013): when enabled + the wallet can batch-sign, the
  // user deploys from their OWN wallet (sole + original owner). Default off → the
  // existing fund-first / testnet paths below are unchanged.
  const { selfDeploy, canSelfDeploy, progress: sdProgress } = useSelfDeploy();

  const [estimate, setEstimate] = useState<DeployEstimate | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiClient
      .getDeployEstimate(uid)
      .then((e) => !cancelled && setEstimate(e))
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : 'Estimate failed'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [uid]);

  const net = estimate?.network || network || 'devnet';
  const isMainnet = net === 'mainnet-beta';
  const lamports =
    estimate?.estimated_lamports ??
    (estimate ? Math.round(estimate.estimated_sol * LAMPORTS_PER_SOL) : 0);
  const sol = lamports / LAMPORTS_PER_SOL;

  const handleConfirm = async () => {
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      // Non-custodial path (RFC-013): the user deploys from their own wallet and
      // owns the program from block 0 — no custodial signer, on any network.
      if (canSelfDeploy) {
        await selfDeploy(uid);
        onFunded?.(lamports);
        return;
      }
      if (!isMainnet) {
        // Test net — free airdrop, server-paid resume (existing path).
        await onTestnetDeploy();
        return;
      }
      // Mainnet — user pays. Validate prerequisites before touching the wallet.
      if (!connected || !publicKey || !sendTransaction) {
        throw new Error('Connect your wallet to fund the deploy.');
      }
      if (!estimate?.deployer_pubkey) {
        throw new Error('Mainnet deploy is unavailable: deployer wallet not configured.');
      }
      if (lamports <= 0) {
        throw new Error('Could not determine the deploy cost. Please retry.');
      }
      // 1. Sign + send the SOL transfer to the deployer wallet.
      const signature = await sendSolTransfer(
        connection,
        publicKey,
        sendTransaction,
        estimate.deployer_pubkey,
        lamports,
        `bumm:v1|kind=deploy|net=${net}`,
      );
      // 2. Wait for finalization (backend verifies at finalized commitment).
      await waitForFinalized(connection, signature);
      // 3. Hand the signature to the backend → it verifies + resumes deploy.
      await retryOnNotFinalized(() => apiClient.fundDeploy(uid, signature));
      onFunded?.(lamports);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Deploy failed.');
    } finally {
      setBusy(false);
    }
  };

  const insufficient =
    isMainnet &&
    estimate?.user_sol_balance != null &&
    estimate.user_sol_balance < sol;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="mx-3 mb-2 overflow-hidden rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-transparent shadow-sm"
    >
      <div className="flex items-start gap-3 px-4 pt-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
        <div className="flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
            {isUpgrade ? 'Confirm re-deploy?' : 'Confirm publish?'}
          </div>
          <div className="mt-0.5 text-sm font-medium text-emerald-50">
            This deploys your program to Solana <span className="font-semibold">{net}</span>.
            You&apos;ll hold the upgrade authority — you can upgrade, transfer, or close it
            afterwards.
          </div>
          {loading ? (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-neutral-400">
              <Loader2 className="h-3 w-3 animate-spin" /> Estimating network fee…
            </div>
          ) : isMainnet ? (
            <div className="mt-1 text-[11px] text-neutral-300">
              You pay <span className="font-semibold text-emerald-200">{sol.toFixed(4)} SOL</span>
              {estimate?.estimated_usd ? ` (~$${estimate.estimated_usd})` : ''} from your wallet to
              deploy — and you own the program&apos;s upgrade authority immediately. Most of
              it is a refundable rent deposit you can reclaim later by closing the program.
              {estimate?.user_sol_balance != null && (
                <span className="ml-1 text-neutral-500">
                  Balance: {estimate.user_sol_balance.toFixed(4)} SOL.
                </span>
              )}
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-neutral-400">
              {net} uses free test SOL — no payment needed.
            </div>
          )}
          {canSelfDeploy && !loading && (
            <div className="mt-1 text-[11px] text-emerald-300/90">
              You deploy from your own wallet — sole owner from the first byte.
              {sdProgress.phase === 'writing' && sdProgress.total
                ? ` Uploading ${sdProgress.written}/${sdProgress.total}…`
                : sdProgress.phase !== 'idle'
                  ? ` ${sdProgress.phase}…`
                  : ''}
            </div>
          )}
          {insufficient && !canSelfDeploy && (
            <div className="mt-1 text-[11px] font-medium text-amber-300">
              Insufficient SOL — add at least {(sol - (estimate?.user_sol_balance ?? 0)).toFixed(4)}{' '}
              SOL to your wallet first.
            </div>
          )}
          {error && <div className="mt-1 text-[11px] font-medium text-red-300">{error}</div>}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2 border-t border-emerald-500/20 bg-neutral-950/30 px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800/60 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={busy || loading || (insufficient && !canSelfDeploy)}
          className="inline-flex items-center gap-1.5 rounded-md bg-emerald-400/90 px-3 py-1.5 text-xs font-semibold text-neutral-900 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {isMainnet ? 'Funding & publishing…' : 'Publishing…'}
            </>
          ) : isMainnet ? (
            <>
              <Wallet className="h-3.5 w-3.5" />
              {`Pay ${sol > 0 ? sol.toFixed(3) : ''} SOL & publish`}
            </>
          ) : (
            <>
              <Rocket className="h-3.5 w-3.5" />
              {isUpgrade ? 'Confirm re-deploy' : 'Confirm publish'}
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
};
