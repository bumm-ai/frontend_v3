'use client';

import { useEffect, useRef } from 'react';
import {
  Brain,
  BookOpen,
  Sparkles,
  FileCode,
  ShieldCheck,
  CheckCircle,
  Hourglass,
} from 'lucide-react';
import type { ContractStatus } from '@/lib/api';
import { contractCodes, getContractType } from './contractTemplates';
import {
  PipelineStagesCard,
  type StageView,
} from './PipelineStagesCard';
import { usePhaseTimer, pickSubStepIndex } from '@/hooks/usePhaseTimer';

interface CodeGenerationStagesProps {
  isGenerating: boolean;
  onComplete: (code: string) => void;
  onAddAIMessage?: (message: string) => void;
  context?: string; // Demo path: contract type for template
  /** When true, only animate (no fake template) — wait for real code via parent flipping `isGenerating=false`. */
  waitForExternalCode?: boolean;
  /** Live backend status — used as a "we're past generation" signal. */
  contractStatus?: ContractStatus | null;
}

interface DerivedGenStages {
  stages: StageView[];
  currentId: string;
  completedIds: string[];
  footer: string;
}

/**
 * Map backend status → code-generation stage view model.
 *
 * Same architectural caveat as Build/Audit/Deploy: backend pipeline nodes
 * only persist `state.phase` on RETURN. `enrich_node` returns
 * `phase=ENRICHING` after 3s of work, so the checkpoint reports
 * `ENRICHING` for the entire 44-50s LLM call inside `generate_node`,
 * because `generate_node` only writes `phase=GENERATING` when it returns.
 *
 * That means we cannot drive sub-steps off backend phase — the user
 * would sit on "Loading docs and patterns" for 50 seconds. Instead, we
 * use `elapsedSeconds` since the generation card mounted. Backend phase
 * is only used as a "definitely past generation" signal (anything after
 * `generated`).
 *
 * Cosmetic timeline:
 *   0–3s    → Preparing pipeline
 *   3–8s    → Loading docs and patterns
 *   8–15s   → Extracting intent
 *   15–35s  → Drafting program structure
 *   35–55s  → Writing instructions and accounts
 *   55s+    → Final polish & integration check
 */
export function deriveGenerateStages(
  status: ContractStatus | null,
  elapsedSeconds: number = 0,
): DerivedGenStages {
  const phase = status?.phase ?? null;

  const preparing: StageView = {
    id: 'preparing',
    title: 'Preparing pipeline',
    subtitle: 'Reserving resources and dispatching to the generator',
    icon: Hourglass,
  };

  const enriching: StageView = {
    id: 'enriching',
    title: 'Loading docs and patterns',
    subtitle: 'Fetching scoped Anchor / Solana docs and prior contract examples',
    icon: BookOpen,
  };

  const intent: StageView = {
    id: 'intent',
    title: 'Extracting intent',
    subtitle: 'Identifying contract type, instructions and integrations',
    icon: Brain,
  };

  const drafting: StageView = {
    id: 'drafting',
    title: 'Drafting program structure',
    subtitle: 'Writing the program module and account scaffolding',
    icon: FileCode,
  };

  const writing: StageView = {
    id: 'writing',
    title: 'Writing instructions and accounts',
    subtitle: 'Producing handlers, constraints and seed/PDA derivations',
    icon: Sparkles,
  };

  const polishing: StageView = {
    id: 'polishing',
    title: 'Final polish & integration check',
    subtitle: 'Aligning with intent and verifying token / ATA wiring',
    icon: ShieldCheck,
  };

  const done: StageView = {
    id: 'done',
    title: 'Contract generated',
    subtitle: 'Code ready to display',
    icon: CheckCircle,
  };

  const stages: StageView[] = [
    preparing,
    enriching,
    intent,
    drafting,
    writing,
    polishing,
    done,
  ];

  let currentId: string;
  const completedIds: string[] = [];

  // Past-generate signal: any phase strictly after `generating` means
  // backend has emitted GENERATED or further → flip everything to done.
  const pastGenerate =
    phase === 'generated' ||
    phase === 'building' ||
    phase === 'build_fixing' ||
    phase === 'auditing_static' ||
    phase === 'auditing_llm' ||
    phase === 'audit_fixing' ||
    phase === 'deploying' ||
    phase === 'learning' ||
    phase === 'done';

  if (pastGenerate) {
    for (const s of stages) if (s.id !== 'done') completedIds.push(s.id);
    currentId = 'done';
  } else {
    // ── Mount-elapsed-driven progression — see module docstring.
    const subSteps = [
      'preparing',
      'enriching',
      'intent',
      'drafting',
      'writing',
      'polishing',
    ] as const;
    const idx = Math.min(
      subSteps.length - 1,
      pickSubStepIndex(elapsedSeconds, [3, 8, 15, 35, 55]),
    );
    for (let i = 0; i < idx; i++) completedIds.push(subSteps[i]);
    currentId = subSteps[idx];
  }

  let footer: string;
  if (pastGenerate) footer = 'Generation complete';
  else if (elapsedSeconds > 55) footer = 'Final polish — almost done…';
  else if (elapsedSeconds > 35) footer = 'Writing instructions and accounts…';
  else if (elapsedSeconds > 15) footer = 'Drafting program structure…';
  else if (elapsedSeconds > 8) footer = 'Extracting intent…';
  else if (elapsedSeconds > 3) footer = 'Loading docs and patterns…';
  else footer = 'Preparing pipeline…';

  return { stages, currentId, completedIds, footer };
}

/**
 * Animation card for the code-generation pipeline.
 *
 * Two paths:
 *   - **Real pipeline** (`waitForExternalCode=true`): stages progression
 *     driven by `elapsedSeconds` since mount; the parent flips
 *     `isGenerating=false` once `phase=generated` and the code is fetched,
 *     which unmounts this component.
 *   - **Demo** (`waitForExternalCode=false`): no backend; we mount a one-shot
 *     timer that calls `onComplete(template)` after a fixed delay so the
 *     interactive demo flow keeps working.
 */
export const CodeGenerationStages = ({
  isGenerating,
  onComplete,
  context,
  waitForExternalCode = false,
  contractStatus,
}: CodeGenerationStagesProps) => {
  const timerKey = contractStatus?.bumm_uid
    ? `generate:${contractStatus.bumm_uid}`
    : 'generate:demo';
  // Synthetic constant phase: timer starts when isGenerating flips true,
  // independent of backend phase transitions.
  const { phaseElapsedSeconds: elapsedSeconds } = usePhaseTimer(
    isGenerating ? 'generate-active' : null,
    timerKey,
  );

  // Demo fallback: when there's no backend status, fire onComplete after
  // a cosmetic delay so InteractiveDemo flows still terminate.
  const demoFiredRef = useRef(false);
  useEffect(() => {
    if (!isGenerating || waitForExternalCode) return;
    if (demoFiredRef.current) return;
    demoFiredRef.current = true;
    const t = setTimeout(() => {
      const contractType = getContractType(context || '');
      const code =
        contractCodes[contractType as keyof typeof contractCodes] ??
        contractCodes.defi;
      onComplete(code);
    }, 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, waitForExternalCode]);

  // Reset demo flag when generation cycle restarts.
  useEffect(() => {
    if (!isGenerating) demoFiredRef.current = false;
  }, [isGenerating]);

  if (!isGenerating) return null;

  const { stages, currentId, completedIds, footer } = deriveGenerateStages(
    contractStatus ?? null,
    elapsedSeconds,
  );

  return (
    <PipelineStagesCard
      headerLabel="AI Smart Contract Generation"
      stages={stages}
      currentId={currentId}
      completedIds={completedIds}
      footer={footer}
      timerKey={timerKey}
    />
  );
};
