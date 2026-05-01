'use client';

import { Upload, CheckCircle, Hourglass, Radio, Coins } from 'lucide-react';
import type { ContractStatus } from '@/lib/api';
import {
  PipelineStagesCard,
  type StageView,
} from './PipelineStagesCard';
import { usePhaseTimer, pickSubStepIndex } from '@/hooks/usePhaseTimer';

interface DerivedDeployStages {
  stages: StageView[];
  currentId: string | null;
  completedIds: string[];
  footer: string;
}

/**
 * Map backend status → deploy-stage view model.
 *
 * Backend sets `state.phase = DEPLOYING` only on node return, not at
 * start, so we drive cosmetic sub-steps off `elapsedSeconds` since the
 * deploy card mounted. `program_id` arriving in status is the only
 * reliable "actually finished" signal.
 *
 * Cosmetic timeline:
 *   0–4s   → Preparing deploy (size + fee estimate)
 *   4–10s  → Checking on-chain balance (airdrop fallback if low)
 *   10–25s → Uploading bytecode
 *   25s+   → Awaiting cluster confirmation
 */
export function deriveDeployStages(
  status: ContractStatus | null,
  elapsedSeconds: number = 0,
): DerivedDeployStages {
  const programId = status?.program_id ?? null;
  const deployed = !!programId;

  const preparing: StageView = {
    id: 'preparing',
    title: 'Preparing deploy',
    subtitle: 'Computing program size and estimating SOL fee',
    icon: Hourglass,
  };

  const balance: StageView = {
    id: 'balance',
    title: 'Checking on-chain balance',
    subtitle: 'Falling back to devnet airdrop if balance is low',
    icon: Coins,
  };

  const uploading: StageView = {
    id: 'uploading',
    title: 'Uploading bytecode',
    subtitle: 'Streaming program .so to the cluster RPC',
    icon: Upload,
  };

  const confirming: StageView = {
    id: 'confirming',
    title: 'Awaiting cluster confirmation',
    subtitle: 'Validators picking up the deploy transaction',
    icon: Radio,
  };

  const confirmed: StageView = {
    id: 'confirmed',
    title: 'Deployed',
    subtitle: programId
      ? `Program ID: ${programId}`
      : 'Live on Solana devnet',
    icon: CheckCircle,
  };

  const stages: StageView[] = [preparing, balance, uploading, confirming, confirmed];

  let currentId: string;
  const completedIds: string[] = [];

  if (deployed) {
    completedIds.push('preparing', 'balance', 'uploading', 'confirming');
    currentId = 'confirmed';
  } else {
    // ── Mount-elapsed-driven progression — backend doesn't transition
    // phase to DEPLOYING until the deploy node returns. ──
    const subSteps = ['preparing', 'balance', 'uploading', 'confirming'] as const;
    const idx = Math.min(
      subSteps.length - 1,
      pickSubStepIndex(elapsedSeconds, [4, 10, 25]),
    );
    for (let i = 0; i < idx; i++) completedIds.push(subSteps[i]);
    currentId = subSteps[idx];
  }

  let footer: string;
  if (deployed) footer = 'Deployment complete';
  else if (elapsedSeconds > 25) footer = 'Awaiting cluster confirmation…';
  else if (elapsedSeconds > 10) footer = 'Uploading bytecode…';
  else if (elapsedSeconds > 4) footer = 'Checking on-chain balance…';
  else footer = 'Preparing deploy…';

  return { stages, currentId, completedIds, footer };
}

interface DeployStagesProps {
  isDeploying: boolean;
  status: ContractStatus | null;
}

export const DeployStages = ({ isDeploying, status }: DeployStagesProps) => {
  const timerKey = status?.bumm_uid
    ? `deploy:${status.bumm_uid}`
    : 'deploy:demo';
  const { phaseElapsedSeconds: elapsedSeconds } = usePhaseTimer(
    isDeploying ? 'deploy-active' : null,
    timerKey,
  );
  if (!isDeploying) return null;
  const { stages, currentId, completedIds, footer } = deriveDeployStages(
    status,
    elapsedSeconds,
  );
  return (
    <PipelineStagesCard
      headerLabel="Deploy Contract"
      stages={stages}
      currentId={currentId}
      completedIds={completedIds}
      footer={footer}
      timerKey={timerKey}
    />
  );
};
