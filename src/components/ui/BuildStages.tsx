'use client';

import {
  Wrench,
  Search,
  CheckCircle,
  Hourglass,
  BookOpen,
  RefreshCw,
  Package,
  Cpu,
  Link2,
} from 'lucide-react';
import type { ContractStatus } from '@/lib/api';
import {
  PipelineStagesCard,
  type StageView,
} from './PipelineStagesCard';
import { usePhaseTimer, pickSubStepIndex } from '@/hooks/usePhaseTimer';

interface DerivedBuildStages {
  stages: StageView[];
  currentId: string | null;
  completedIds: string[];
  footer: string;
}

/**
 * Map backend status → build-stage view model.
 *
 * Important architectural note: backend pipeline nodes only persist
 * `state.phase = Phase.BUILDING` when they RETURN — i.e. after the
 * 4-5 min `cargo build-bpf` completes. During the actual compile the
 * checkpoint still reports the previous phase (usually `generated`).
 *
 * That means we cannot rely on `phase === 'building'` to drive sub-step
 * progression — it would lock us on "Preparing" for the entire compile.
 * Instead, we drive cosmetic sub-steps off `elapsedSeconds` since the
 * stages-card mounted (provided by the parent component, which times
 * from the moment `isBuilding` became true). Backend `phase` is still
 * used for *major* transitions: `build_fixing`, `learning`, `build_ok`.
 *
 * Cosmetic sub-step thresholds (calibrated for warm builder image):
 *   0–3s    → Preparing build environment
 *   3–15s   → Resolving dependencies
 *   15–90s  → Compiling Rust crate (largest chunk)
 *   90–200s → Generating BPF bytecode
 *   200s+   → Linking program (sits here until phase advances)
 */
export function deriveBuildStages(
  status: ContractStatus | null,
  elapsedSeconds: number = 0,
): DerivedBuildStages {
  const phase = status?.phase ?? null;
  const buildOk = status?.build_ok ?? false;
  const attempt = status?.build_attempt ?? 0;
  const errorsCount = status?.build_errors_count ?? 0;
  const fixesCount = status?.fixes_applied_count ?? 0;
  const lastFix = status?.last_fix_description ?? null;
  const lastFixSource = status?.last_fix_source ?? null;

  let fixBadge: string | undefined;
  if (lastFixSource === 'knowledge_base') fixBadge = 'KB';
  else if (lastFixSource === 'llm_generated') fixBadge = 'AI';

  // ─── Stage definitions ──────────────────────────────────────────────────
  const preparing: StageView = {
    id: 'preparing',
    title: 'Preparing build environment',
    subtitle: 'Spinning up Anchor toolchain and warming up cache',
    icon: Hourglass,
  };

  const resolving: StageView = {
    id: 'resolving',
    title: 'Resolving dependencies',
    subtitle: 'Reading Cargo.lock and pinning crate versions',
    icon: Package,
  };

  const compiling: StageView = {
    id: 'compiling',
    title: attempt > 1 ? `Compiling (attempt ${attempt})` : 'Compiling Rust crate',
    subtitle:
      attempt > 1
        ? `Recompiling after auto-fix — attempt ${attempt}`
        : 'Type-checking and lowering Rust to MIR',
    icon: Wrench,
  };

  const codegen: StageView = {
    id: 'codegen',
    title: 'Generating BPF bytecode',
    subtitle: 'Lowering MIR through LLVM to BPF target',
    icon: Cpu,
  };

  const linking: StageView = {
    id: 'linking',
    title: 'Linking program',
    subtitle: 'Producing final .so artifact and stripping symbols',
    icon: Link2,
  };

  const fixing: StageView = {
    id: 'fixing',
    title:
      fixesCount > 0
        ? `Auto-fixing errors — ${fixesCount} applied`
        : 'Auto-fixing build errors',
    subtitle: lastFix
      ? `Latest fix: ${lastFix}`
      : `Analysing ${errorsCount} compile error${errorsCount === 1 ? '' : 's'}…`,
    icon: Search,
    badge: fixBadge,
  };

  const recompiling: StageView = {
    id: 'recompiling',
    title: `Recompiling — attempt ${attempt}`,
    subtitle: 'Running Anchor build with patched source',
    icon: RefreshCw,
  };

  const learning: StageView = {
    id: 'learning',
    title: 'Learning from this fix',
    subtitle: 'Persisting successful pattern to the knowledge base',
    icon: BookOpen,
  };

  const passes: StageView = {
    id: 'passes',
    title: 'Build passes',
    subtitle: 'Contract compiles cleanly',
    icon: CheckCircle,
  };

  // ─── Conditional stage list ─────────────────────────────────────────────
  const showFixing = phase === 'build_fixing' || fixesCount > 0;
  const showRecompiling =
    fixesCount > 0 && (phase === 'building' || phase === 'learning' || buildOk);
  const showLearning = phase === 'learning' || (buildOk && fixesCount > 0);

  // First-attempt compile shows the granular sub-steps; on a subsequent
  // attempt the user already saw them, so collapse to a single Recompiling.
  const isFirstCompile = attempt <= 1 && fixesCount === 0;

  const stages: StageView[] = [];
  if (isFirstCompile || buildOk) {
    stages.push(preparing, resolving, compiling, codegen, linking);
  } else {
    stages.push(preparing, compiling);
  }
  if (showFixing) stages.push(fixing);
  if (showRecompiling) stages.push(recompiling);
  if (showLearning) stages.push(learning);
  stages.push(passes);

  // ─── Current / completed derivation ─────────────────────────────────────
  let currentId: string | null;
  const completedIds: string[] = [];

  if (buildOk) {
    for (const s of stages) if (s.id !== 'passes') completedIds.push(s.id);
    currentId = 'passes';
  } else if (phase === 'learning') {
    if (isFirstCompile) {
      completedIds.push('preparing', 'resolving', 'compiling', 'codegen', 'linking');
    } else {
      completedIds.push('preparing', 'compiling');
    }
    if (showFixing) completedIds.push('fixing');
    if (showRecompiling) completedIds.push('recompiling');
    currentId = 'learning';
  } else if (phase === 'build_fixing') {
    if (isFirstCompile) {
      completedIds.push('preparing', 'resolving', 'compiling', 'codegen', 'linking');
    } else {
      completedIds.push('preparing', 'compiling');
    }
    currentId = 'fixing';
  } else if (attempt > 1 && showRecompiling) {
    completedIds.push('preparing', 'compiling');
    if (showFixing) completedIds.push('fixing');
    currentId = 'recompiling';
  } else if (isFirstCompile) {
    // ── Mount-elapsed-driven progression through cosmetic compile sub-steps.
    // We DO NOT gate on phase==='building' because backend doesn't transition
    // phase to BUILDING until the build returns. See module docstring.
    const subSteps = ['preparing', 'resolving', 'compiling', 'codegen', 'linking'] as const;
    const idx = Math.min(
      subSteps.length - 1,
      pickSubStepIndex(elapsedSeconds, [3, 15, 90, 200]),
    );
    for (let i = 0; i < idx; i++) completedIds.push(subSteps[i]);
    currentId = subSteps[idx];
  } else {
    // Fallback — second-attempt compile that's not yet in fixing/learning
    completedIds.push('preparing');
    currentId = 'compiling';
  }

  // ─── Footer ─────────────────────────────────────────────────────────────
  let footer: string;
  if (buildOk) footer = 'Build complete';
  else if (phase === 'learning') footer = 'Updating knowledge base…';
  else if (phase === 'build_fixing')
    footer = `Auto-fixing errors (attempt ${attempt || 1})…`;
  else if (attempt > 1) footer = `Recompiling — attempt ${attempt}…`;
  else if (isFirstCompile) {
    if (elapsedSeconds > 200) footer = 'Linking program — almost there…';
    else if (elapsedSeconds > 90) footer = 'Generating BPF bytecode…';
    else if (elapsedSeconds > 15) footer = 'Compiling Rust crate…';
    else if (elapsedSeconds > 3) footer = 'Resolving dependencies…';
    else footer = 'Preparing build environment…';
  } else footer = 'Compiling contract…';

  return { stages, currentId, completedIds, footer };
}

interface BuildStagesProps {
  isBuilding: boolean;
  status: ContractStatus | null;
}

export const BuildStages = ({ isBuilding, status }: BuildStagesProps) => {
  const timerKey = status?.bumm_uid
    ? `build:${status.bumm_uid}`
    : 'build:demo';
  // Synthetic constant phase: the timer stamps the moment `isBuilding`
  // becomes true and counts elapsed seconds since component mount,
  // independent of when (or whether) the backend transitions
  // `state.phase` to BUILDING.
  const { phaseElapsedSeconds: elapsedSeconds } = usePhaseTimer(
    isBuilding ? 'build-active' : null,
    timerKey,
  );
  if (!isBuilding) return null;
  const { stages, currentId, completedIds, footer } = deriveBuildStages(
    status,
    elapsedSeconds,
  );
  return (
    <PipelineStagesCard
      headerLabel="Build Smart Contract"
      stages={stages}
      currentId={currentId}
      completedIds={completedIds}
      footer={footer}
      timerKey={timerKey}
    />
  );
};
