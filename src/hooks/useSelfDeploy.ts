'use client';

/**
 * useSelfDeploy — non-custodial browser deploy (RFC-013).
 *
 * Orchestrates the user-signed upgradeable-loader deploy so the user is the sole
 * + original upgrade authority and pays the SOL, with ONE wallet approval session
 * (signAllTransactions) instead of N popups:
 *   1. generate an ephemeral program + buffer keypair (in-memory only)
 *   2. backend rebuilds the .so pinned to the program id (selfDeployArtifact)
 *   3. assemble create-buffer + N writes + create-program/deploy (buildSelfDeployPlan)
 *   4. wallet.signAllTransactions(...) — one approval
 *   5. send create → writes → deploy, confirming in dependency order
 *   6. report the deploy signature to the backend (selfDeployConfirm), which
 *      verifies on-chain that the user owns the program.
 *
 * The transaction assembly + encodings are unit-tested (lib/selfDeploy,
 * lib/upgradeableLoader); this hook is the network/wallet glue, prod-validated on
 * devnet with a real wallet (see RFC-013). Gated by NEXT_PUBLIC_SELF_DEPLOY_ENABLED
 * + the wallet's signAllTransactions capability.
 */

import { useCallback, useState } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { Keypair } from '@solana/web3.js';
import { apiClient } from '@/services/api';
import {
  base64ToBytes,
  buildSelfDeployPlan,
  selfDeployAccountSizes,
  walletCanSelfDeploy,
} from '@/lib/selfDeploy';

export const SELF_DEPLOY_ENABLED =
  process.env.NEXT_PUBLIC_SELF_DEPLOY_ENABLED === 'true';

export interface SelfDeployProgress {
  phase: 'idle' | 'building' | 'signing' | 'buffer' | 'writing' | 'deploying' | 'confirming';
  written?: number;
  total?: number;
}

// Bounded concurrency for buffer-write sends — enough to be fast, low enough to
// stay friendly to public RPCs.
const WRITE_CONCURRENCY = 8;

export function useSelfDeploy() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<SelfDeployProgress>({ phase: 'idle' });

  const canSelfDeploy = SELF_DEPLOY_ENABLED && walletCanSelfDeploy(wallet);

  const selfDeploy = useCallback(
    async (uid: string): Promise<{ programId: string; signature: string }> => {
      if (!wallet.publicKey || !wallet.signAllTransactions) {
        throw new Error('Connect a wallet that supports batch signing.');
      }
      setBusy(true);
      setError(null);
      try {
        const programKeypair = Keypair.generate();
        const bufferKeypair = Keypair.generate();
        const programId = programKeypair.publicKey.toBase58();

        setProgress({ phase: 'building' });
        const artifact = await apiClient.selfDeployArtifact(uid, programId);
        const programBytes = base64ToBytes(artifact.so_base64);

        const { bufferSize, programSize } = selfDeployAccountSizes(programBytes.length);
        const [bufferLamports, programLamports, { blockhash }] = await Promise.all([
          connection.getMinimumBalanceForRentExemption(bufferSize),
          connection.getMinimumBalanceForRentExemption(programSize),
          connection.getLatestBlockhash('finalized'),
        ]);

        const plan = buildSelfDeployPlan({
          payer: wallet.publicKey,
          programKeypair,
          bufferKeypair,
          programBytes,
          bufferLamports,
          programLamports,
          recentBlockhash: blockhash,
        });

        setProgress({ phase: 'signing' });
        const signed = await wallet.signAllTransactions(plan.ordered);
        // Map signed txs back to roles by their known order.
        const signedCreate = signed[0];
        const signedWrites = signed.slice(1, 1 + plan.writes.length);
        const signedDeploy = signed[signed.length - 1];

        const send = async (tx: (typeof signed)[number]): Promise<string> => {
          const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
          });
          await connection.confirmTransaction(sig, 'confirmed');
          return sig;
        };

        // 1) Buffer must exist before any write.
        setProgress({ phase: 'buffer' });
        await send(signedCreate);

        // 2) Writes — bounded-concurrency batches, all confirmed before deploy.
        let written = 0;
        for (let i = 0; i < signedWrites.length; i += WRITE_CONCURRENCY) {
          const batch = signedWrites.slice(i, i + WRITE_CONCURRENCY);
          await Promise.all(batch.map(send));
          written += batch.length;
          setProgress({ phase: 'writing', written, total: signedWrites.length });
        }

        // 3) Create program + deploy (final).
        setProgress({ phase: 'deploying' });
        const signature = await send(signedDeploy);

        // 4) Tell the backend — it verifies the user owns the program on-chain.
        setProgress({ phase: 'confirming' });
        await apiClient.selfDeployConfirm(uid, programId, signature);

        setProgress({ phase: 'idle' });
        return { programId, signature };
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Self-deploy failed.';
        setError(msg);
        setProgress({ phase: 'idle' });
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [connection, wallet],
  );

  return { selfDeploy, canSelfDeploy, busy, error, progress };
}
