'use client';

import { use, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  Loader2,
  Wrench,
  Shield,
  Rocket,
  Copy,
  Check,
  ChevronRight,
} from 'lucide-react';
import { useContract } from '@/hooks/useContract';
import { apiClient } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import type { Phase, ContractStatus } from '@/lib/api';

// ── Types ──────────────────────────────────────────────────────────────────────

type ActionStatus = 'idle' | 'triggering' | 'running' | 'done' | 'error';

type StepKey = 'generate' | 'build' | 'audit' | 'deploy';

// ── Constants ─────────────────────────────────────────────────────────────────

const BUILD_PHASES:  Phase[] = ['building', 'build_fixing'];
const AUDIT_PHASES:  Phase[] = ['auditing_static', 'auditing_llm', 'audit_fixing'];
const DEPLOY_PHASES: Phase[] = ['deploying'];

const STEP_ORDER: StepKey[] = ['generate', 'build', 'audit', 'deploy'];

const STEP_META: Record<StepKey, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  generate: { label: 'Generate', icon: ChevronRight },
  build:    { label: 'Build',    icon: Wrench },
  audit:    { label: 'Audit',    icon: Shield },
  deploy:   { label: 'Deploy',   icon: Rocket },
};

const PHASE_LABELS: Partial<Record<Phase, string>> = {
  building:        'Compiling with Anchor CLI…',
  build_fixing:    'Fixing build errors…',
  auditing_static: 'Running static analysis…',
  auditing_llm:    'LLM security review…',
  audit_fixing:    'Applying security fixes…',
  deploying:       'Deploying to Solana…',
  learning:        'Recording results…',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function stepForPhase(phase: Phase): StepKey | null {
  if (BUILD_PHASES.includes(phase))   return 'build';
  if (AUDIT_PHASES.includes(phase))   return 'audit';
  if (DEPLOY_PHASES.includes(phase))  return 'deploy';
  if (phase === 'generating' || phase === 'enriching') return 'generate';
  return null;
}

const GENERATE_IN_PROGRESS: Phase[] = ['pending', 'enriching', 'generating'];

function completedSteps(status: ContractStatus): Set<StepKey> {
  const done = new Set<StepKey>();
  if (!GENERATE_IN_PROGRESS.includes(status.phase)) {
    done.add('generate');
  }
  if (status.build_ok) done.add('build');
  if (status.audit_ok) done.add('audit');
  if (status.program_id) done.add('deploy');
  return done;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function CopyButton({ text, className = '' }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [text]);
  return (
    <button
      onClick={copy}
      className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${className}`}
    >
      {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function Stepper({
  status,
  activeStep,
}: {
  status: ContractStatus;
  activeStep: StepKey | null;
}) {
  const done = completedSteps(status);
  const isFailed = status.phase === 'failed';

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STEP_ORDER.map((step, i) => {
        const isDone   = done.has(step);
        const isActive = activeStep === step && !isFailed;
        const Icon = STEP_META[step].icon;

        return (
          <div key={step} className="flex items-center gap-1">
            <span
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                isDone   ? 'bg-green-600/25 text-green-300 border border-green-600/40' :
                isActive ? 'bg-violet-600/30 text-violet-200 border border-violet-500/50 animate-pulse' :
                isFailed && activeStep === step ? 'bg-red-700/20 text-red-300 border border-red-700/40' :
                           'bg-gray-800/60 text-gray-500 border border-gray-700/50'
              }`}
            >
              {isDone ? (
                <CheckCircle className="w-3 h-3" />
              ) : isActive ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Icon className="w-3 h-3" />
              )}
              {STEP_META[step].label}
            </span>
            {i < STEP_ORDER.length - 1 && (
              <span className="text-gray-700 text-xs">›</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ActionPanel({
  uid,
  status,
  actionStatus,
  actionError,
  onAction,
}: {
  uid: string;
  status: ContractStatus;
  actionStatus: ActionStatus;
  actionError: string | null;
  onAction: (step: 'build' | 'audit' | 'deploy') => void;
}) {
  const nextStep = status.next_step;
  const phase    = status.phase;
  const isRunning = actionStatus === 'running' || actionStatus === 'triggering';

  const activePhaseLabel = PHASE_LABELS[phase] ?? null;

  const phaseColor = BUILD_PHASES.includes(phase)
    ? 'text-orange-400'
    : AUDIT_PHASES.includes(phase)
    ? 'text-blue-400'
    : DEPLOY_PHASES.includes(phase)
    ? 'text-violet-400'
    : 'text-gray-400';

  return (
    <div className="space-y-4">
      {/* Current phase */}
      <div className="rounded-lg bg-[#111] border border-[#2a2a2a] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 uppercase tracking-wider">Phase</span>
          <span className={`text-xs font-semibold uppercase tracking-wider ${phaseColor}`}>
            {phase}
          </span>
        </div>

        {/* Attempt counters */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded bg-[#1a1a1a] border border-[#2a2a2a] p-2 text-center">
            <div className="text-lg font-bold text-white">{status.build_attempt}</div>
            <div className="text-xs text-gray-500">Build attempts</div>
            {status.build_ok && <div className="text-xs text-green-400 mt-0.5">✓ OK</div>}
          </div>
          <div className="rounded bg-[#1a1a1a] border border-[#2a2a2a] p-2 text-center">
            <div className="text-lg font-bold text-white">{status.audit_attempt}</div>
            <div className="text-xs text-gray-500">Audit attempts</div>
            {status.audit_ok && <div className="text-xs text-green-400 mt-0.5">✓ OK</div>}
          </div>
        </div>

        {/* Inline progress — replaces modal */}
        <AnimatePresence>
          {isRunning && activePhaseLabel && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="rounded border border-orange-500/20 bg-orange-500/5 p-3"
            >
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-orange-400 animate-spin flex-shrink-0" />
                <span className="text-sm text-white">{activePhaseLabel}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1 ml-6">This may take 1–6 minutes</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action error */}
        <AnimatePresence>
          {actionError && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded border border-red-700/40 bg-red-900/10 p-3"
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-red-300">{actionError}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Action button */}
      {nextStep && phase !== 'failed' && (
        <button
          onClick={() => onAction(nextStep)}
          disabled={isRunning}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold text-sm transition-all ${
            nextStep === 'build'
              ? 'bg-orange-600 hover:bg-orange-500 disabled:bg-orange-900/50 text-white'
              : nextStep === 'audit'
              ? 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900/50 text-white'
              : 'bg-violet-600 hover:bg-violet-500 disabled:bg-violet-900/50 text-white'
          } disabled:cursor-not-allowed`}
        >
          {isRunning ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : nextStep === 'build' ? (
            <Wrench className="w-4 h-4" />
          ) : nextStep === 'audit' ? (
            <Shield className="w-4 h-4" />
          ) : (
            <Rocket className="w-4 h-4" />
          )}
          {isRunning
            ? 'Running…'
            : nextStep === 'build'
            ? 'Build Contract'
            : nextStep === 'audit'
            ? 'Audit Contract'
            : 'Deploy to Devnet'}
        </button>
      )}

      {/* Done — program ID */}
      {status.program_id && (
        <div className="rounded-lg border border-green-700/40 bg-green-900/10 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-green-400">Program ID</span>
            <CopyButton
              text={status.program_id}
              className="text-green-400 hover:text-green-300 hover:bg-green-900/30"
            />
          </div>
          <p className="font-mono text-xs text-green-300 break-all">{status.program_id}</p>
        </div>
      )}

      {/* Failed */}
      {phase === 'failed' && status.error && (
        <div className="rounded-lg border border-red-700/40 bg-red-900/10 p-4">
          <p className="text-xs font-medium text-red-400 mb-1">Pipeline failed</p>
          <p className="text-sm text-red-300">{status.error}</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ContractPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid }  = use(params);
  const router   = useRouter();
  const { status, isLoading, error, code, getCode } = useContract(uid);

  const [actionStatus, setActionStatus] = useState<ActionStatus>('idle');
  const [actionError,  setActionError]  = useState<string | null>(null);
  const [codeLoading,  setCodeLoading]  = useState(false);
  // Remember which step the user just triggered so we can detect its completion
  // (phase alone is unreliable — e.g. build node leaves phase='building' after
  // pausing at the audit interrupt).
  const triggeredStepRef = useRef<'build' | 'audit' | 'deploy' | null>(null);

  // Fetch code once build succeeds
  useEffect(() => {
    if (status?.build_ok && !code) {
      setCodeLoading(true);
      getCode().finally(() => setCodeLoading(false));
    }
  }, [status?.build_ok, code, getCode]);

  // Detect completion: rely on *_ok flags / program_id, not on phase category.
  useEffect(() => {
    if (actionStatus !== 'running') return;
    if (!status) return;

    if (status.phase === 'failed') {
      setActionStatus('error');
      setActionError(status.error ?? 'Pipeline failed');
      triggeredStepRef.current = null;
      return;
    }

    const step = triggeredStepRef.current;
    const done =
      (step === 'build'  && status.build_ok)                            ||
      (step === 'audit'  && status.audit_ok)                            ||
      (step === 'deploy' && !!status.program_id);

    if (done) {
      setActionStatus('done');
      triggeredStepRef.current = null;
    }
  }, [status, actionStatus]);

  const handleAction = useCallback(async (step: 'build' | 'audit' | 'deploy') => {
    setActionStatus('triggering');
    setActionError(null);
    triggeredStepRef.current = step;
    try {
      await tryRefresh();
      if (step === 'build')  await apiClient.triggerBuild(uid);
      if (step === 'audit')  await apiClient.triggerAudit(uid);
      if (step === 'deploy') await apiClient.triggerDeploy(uid);
      setActionStatus('running');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start operation';
      setActionError(msg);
      setActionStatus('error');
      triggeredStepRef.current = null;
    }
  }, [uid]);

  const activeStep = status ? stepForPhase(status.phase) : null;

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      {/* Top bar */}
      <div className="border-b border-[#1f1f1f] px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <p className="font-mono text-xs text-gray-600 truncate max-w-xs">{uid}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* Stepper */}
        {status && (
          <div>
            <p className="text-xs text-gray-500 mb-3 uppercase tracking-wider">Pipeline progress</p>
            <Stepper status={status} activeStep={activeStep} />
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !status && (
          <div className="space-y-3">
            <div className="h-8 bg-gray-800 rounded animate-pulse w-2/3" />
            <div className="h-5 bg-gray-800 rounded animate-pulse w-1/2" />
          </div>
        )}

        {/* Connection error */}
        {error && !status && (
          <div className="rounded-lg border border-red-700/40 bg-red-900/10 p-4 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Two-column layout */}
        {status && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left — Code panel */}
            <div className="rounded-lg border border-[#1f1f1f] bg-[#0d0d0d] overflow-hidden flex flex-col min-h-96">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1f1f1f] bg-[#111]">
                <span className="text-xs text-gray-400 font-mono">lib.rs</span>
                {code && <CopyButton text={code.code} className="text-gray-500 hover:text-gray-300 hover:bg-gray-800" />}
              </div>

              {codeLoading && (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
                </div>
              )}

              {!code && !codeLoading && !status.build_ok && (
                <div className="flex-1 flex items-center justify-center p-8 text-center">
                  <div>
                    <Wrench className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                    <p className="text-sm text-gray-600">
                      {status.next_step === 'build' || status.phase === 'generated'
                        ? 'Build the contract to see the code'
                        : 'Waiting for code generation…'}
                    </p>
                  </div>
                </div>
              )}

              {code && (
                <div className="flex-1 overflow-auto">
                  <pre className="p-4 text-xs text-gray-300 font-mono leading-relaxed whitespace-pre overflow-x-auto">
                    <code>{code.code}</code>
                  </pre>
                </div>
              )}

              {!code && status.build_ok && !codeLoading && (
                <div className="flex-1 flex items-center justify-center p-8">
                  <button
                    onClick={() => { setCodeLoading(true); getCode().finally(() => setCodeLoading(false)); }}
                    className="px-4 py-2 rounded-lg bg-violet-700 hover:bg-violet-600 text-sm text-white transition"
                  >
                    Load code
                  </button>
                </div>
              )}
            </div>

            {/* Right — Status / action panel */}
            <div>
              <ActionPanel
                uid={uid}
                status={status}
                actionStatus={actionStatus}
                actionError={actionError}
                onAction={handleAction}
              />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
