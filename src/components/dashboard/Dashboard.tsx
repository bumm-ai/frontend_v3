'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardState, ChatMessage, Project } from '@/types/dashboard';
import { useBummApi } from '@/hooks/useBummApi';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useContract, useMultiContract, deriveUIFromStatus } from '@/hooks/useContract';
import { useStageReports } from '@/hooks/useStageReports';
import { apiClient } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import type { ChatMessagePayload } from '@/lib/api';
import { humanizeErrorCodes } from '@/lib/errorTranslate';
// import { WalletDebug } from '../debug/WalletDebug';
// import { SimpleWalletTest } from '../debug/SimpleWalletTest';
import LoginScreen from './LoginScreen';
import ChatScreen from './ChatScreen';
import { PasteCodeModal } from '@/components/ui/PasteCodeModal';
import { RollbackModal } from '@/components/ui/RollbackModal';
import type { Network } from '@/lib/api';

/**
 * Derive the action button label from backend contract state.
 * Pure function — no localStorage involved.
 */
function phaseToAction(
  status: Project['status'],
  hasCode: boolean,
  isDeployed?: boolean,
): 'build' | 'audit' | 'publish' | 'upgrade' | 'inactive' {
  if (isDeployed || status === 'deployed') return 'upgrade';
  if (status === 'audited') return 'publish';
  if (status === 'built') return 'audit';
  if (hasCode || status === 'generated') return 'build';
  return 'inactive';
}

/** Map backend pipeline phase to frontend project status.
 *
 * For terminal phases (`failed`, `paused_degraded`) we don't drop the
 * project to "draft" — instead we surface the highest milestone the
 * contract actually reached, so a user whose deploy failed mid-flight
 * still sees "Audited" and can retry publish without losing context.
 */
function mapPhaseToStatus(
  phase: string,
  programId?: string | null,
  buildOk?: boolean,
  auditOk?: boolean,
): Project['status'] {
  // Terminal hard-success: program is on-chain regardless of phase value.
  if (programId) return 'deployed';

  switch (phase) {
    case 'pending': case 'started': case 'enriching': return 'initializing';
    case 'generating': return 'in-progress';
    // 'generated' = paste-mode: code ready, awaiting build trigger
    case 'generated': case 'building': case 'build_fixing': return 'generated';
    case 'auditing_static': case 'auditing_llm': case 'audit_fixing': return 'built';
    case 'deploying': return 'audited';
    case 'done':
      return 'completed';
    case 'failed':
    case 'paused_degraded':
    case 'cancelled': {
      // Reflect the highest milestone the contract actually reached so the
      // user has correct context (e.g. "Audited" → can retry publish).
      if (auditOk) return 'audited';
      if (buildOk) return 'built';
      return 'draft';
    }
    default: return 'in-progress';
  }
}

export default function Dashboard() {
  const { disconnect } = useWallet();
  const { hasEnoughCredits, loadBalance } = useCredits();
  const analytics = useAnalytics();
  const auth = useAuth();
  const [currentState, setCurrentState] = useState<DashboardState>('login');
  
  // Counter for generating unique message IDs
  const messageIdCounter = useRef(0);
  const generateUniqueMessageId = () => {
    messageIdCounter.current++;
    return `${Date.now()}_${messageIdCounter.current}`;
  };
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  
  // ── New v3 contract hook ────────────────────────────────────────────────────
  const [activeContractUid, setActiveContractUid] = useState<string | null>(null);
  const [pipelineMsgId, setPipelineMsgId] = useState<string | null>(null);
  const contract = useContract(activeContractUid);

  // Per-project status map — updated by useMultiContract for background projects
  const [projectStatuses, setProjectStatuses] = useState<Record<string, import('@/lib/api').ContractStatus>>({});
  // trackedContracts: { [projectId]: contractUid } — only projects with an active WS
  const [trackedContracts, setTrackedContracts] = useState<Record<string, string>>({});
  // Stable ref so REST poll always reads the latest trackedContracts without restarting interval
  const trackedContractsRef = useRef<Record<string, string>>({});
  trackedContractsRef.current = trackedContracts;

  useMultiContract(trackedContracts, (projectId, status) => {
    setProjectStatuses(prev => ({ ...prev, [projectId]: status }));
  });

  // API хук (compat stubs for project management UI)
  const {
    user,
    isLoading,
    error,
    generateContract,
    generateInProject,
    auditContract,
    buildContract,
    deployContract,
    trackTaskStatus,
    loadProjects,
    createProject,
    loadChatHistory,
  } = useBummApi();

  // ── Real projects state (useBummApi.projects / updateProjects are no-op stubs) ──
  const [projects, setProjects] = useState<Project[]>([]);
  const updateProjects = useCallback(
    (updater: ((prev: Project[]) => Project[]) | Project[]) => {
      setProjects(prev => typeof updater === 'function' ? updater(prev) : updater);
    },
    [],
  );
  
  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      // Don't show alert for every error to avoid spam
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Show user-friendly error message
      if (event.reason && typeof event.reason === 'object' && 'message' in event.reason) {
        console.error('Error details:', event.reason.message);
      }
      
      event.preventDefault(); // Prevent error display in console
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  // Per-project message map: uid → ChatMessage[]. Switching projects is instant
  // (no fetch needed if already loaded this session). Fixes history loss on switch.
  const [messagesByUid, setMessagesByUid] = useState<Record<string, ChatMessage[]>>({});

  // Key used for the "new chat" scratch buffer — no project selected yet.
  const SCRATCH_UID = '__scratch__';

  const _WELCOME_MSG: ChatMessage = {
    id: 'welcome',
    content: 'Hello! I\'m here to help you build on Solana. What would you like to create today?',
    timestamp: new Date(),
    isUser: false,
  };

  // Derived: messages for the currently viewed project (or scratch buffer if none).
  const activeUid = currentProject?.uid ?? SCRATCH_UID;
  const messages: ChatMessage[] = messagesByUid[activeUid] ?? [_WELCOME_MSG];

  // Drop-in replacement for the old useState setter. Always writes to the slot of
  // the project that is active at call time (uses ref so async handlers are safe).
  // Falls back to SCRATCH_UID so "new chat" messages are never silently dropped.
  const setMessages = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setMessagesByUid(prevMap => {
        const uid = currentProjectRef.current?.uid ?? SCRATCH_UID;
        const prev = prevMap[uid] ?? [_WELCOME_MSG];
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return { ...prevMap, [uid]: next };
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [isBuilding, setIsBuilding] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{ projectUid: string; code: string } | null>(null);
  const [generationAttemptFailed, setGenerationAttemptFailed] = useState(0);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalInitialCode, setPasteModalInitialCode] = useState<string | undefined>(undefined);
  const [rollbackProject, setRollbackProject] = useState<Project | null>(null);
  // Per-project flag: true when the inline code editor holds user edits that
  // haven't been PUT'd back to /code yet. While true, the main Build/Audit/
  // Deploy action is gated — running the pipeline would operate on the OLD
  // persisted code, silently discarding the user's textarea changes.
  // Editor unmount (on project switch) flushes false, so stale entries
  // for closed projects can't trap a future click.
  const [editorDirtyByUid, setEditorDirtyByUid] = useState<Record<string, boolean>>({});
  const handleEditorDirtyChange = useCallback((uid: string, dirty: boolean) => {
    setEditorDirtyByUid(prev => {
      if (!dirty) {
        if (!(uid in prev)) return prev;
        const next = { ...prev };
        delete next[uid];
        return next;
      }
      if (prev[uid] === true) return prev;
      return { ...prev, [uid]: true };
    });
  }, []);
  // Generation animation is derived from backend status (phase + next_step),
  // not from a client-side session flag. See deriveAnimationStage.

  // Step triggering state removed — button/animation derive from contract.status
  // via deriveUIFromStatus (no local mirrors needed).

  // Persist every project's messages to localStorage on change.
  // This is a write-only cache: cold-start reads happen in handleSelectProject.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    for (const [uid, msgs] of Object.entries(messagesByUid)) {
      if (msgs.length > 0) {
        try {
          localStorage.setItem(`bumm_chat_history_${uid}`, JSON.stringify(msgs));
        } catch {
          // Storage full — non-fatal
        }
      }
    }
  }, [messagesByUid]);

  // ── Backend chat persistence ─────────────────────────────────────────────
  // Mirror messagesByUid to the backend so build/audit/deploy progress
  // messages survive logout/login. Without this, only the initial chat
  // snapshot saved at project-create time persists — every "Build
  // succeeded", "Audit complete", "Deploy failed" added later via
  // addAIMessageForProject lives only in local state and disappears on
  // sign-out. Per-project hash-guard avoids redundant PUTs when nothing
  // changed; debounce coalesces bursts (e.g. multiple stage reports).
  const lastSavedChatHashRef = useRef<Record<string, string>>({});
  useEffect(() => {
    if (!auth.isAuthenticated) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const [uid, msgs] of Object.entries(messagesByUid)) {
      if (uid === SCRATCH_UID) continue;
      if (!msgs || msgs.length === 0) continue;
      // Cheap content hash — id + content length covers every additive
      // change (most chat updates are appends; we don't edit history).
      const hash = `${msgs.length}:${msgs.map(m => `${m.id}#${m.content.length}`).join('|')}`;
      if (lastSavedChatHashRef.current[uid] === hash) continue;
      const t = setTimeout(() => {
        const chatForBackend = msgs.map(m => ({
          role: m.isUser ? 'user' : 'assistant',
          content: m.content,
          timestamp:
            m.timestamp instanceof Date
              ? m.timestamp.toISOString()
              : String(m.timestamp),
        }));
        apiClient
          .saveContractChat(uid, chatForBackend)
          .then(() => {
            lastSavedChatHashRef.current[uid] = hash;
          })
          .catch(() => {
            // Best-effort — leave hash un-set so we retry on next change.
          });
      }, 1500);
      timers.push(t);
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messagesByUid, auth.isAuthenticated]);


  // Auto-switch to chat when JWT session is restored or login completes
  useEffect(() => {
    if (auth.isAuthenticated && currentState === 'login') {
      setCurrentState('chat');
      loadBalance().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  // ── Sign-out cleanup ──────────────────────────────────────────────────────
  // When the auth state flips to false (Sign out button), wipe ALL local
  // dashboard state so the next login (even with the same wallet) starts
  // from a clean slate. Without this, projects/messages/currentProject
  // survived in memory and the user saw "ghost" data from the prior session
  // until they cleared browser cache.
  const wasAuthedRef = useRef(auth.isAuthenticated);
  useEffect(() => {
    if (wasAuthedRef.current && !auth.isAuthenticated) {
      setCurrentProject(null);
      setProjects([]);
      setMessagesByUid({});
      setActiveContractUid(null);
      setTrackedContracts({});
      setGeneratedCode(null);
      setPendingStep(null);
      setCurrentState('login');
    }
    wasAuthedRef.current = auth.isAuthenticated;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  const handleLogin = async () => {
    analytics.trackWalletConnect('phantom');
    await auth.login();
    // State transition handled by the useEffect above when auth.isAuthenticated becomes true
  };

  // pipelinePhase removed — animationStage is now derived via deriveUIFromStatus

  // ── Optimistic step pending state ────────────────────────────────────────
  // Set immediately on button click → clears when WS confirms phase is active.
  // Prevents double-clicks during the gap between HTTP trigger and first heartbeat.
  // Scoped to a specific project so switching projects never leaks a pending animation
  const [pendingStep, setPendingStep] = useState<{
    projectId: string;
    step: 'build' | 'audit' | 'deploy';
  } | null>(null);
  const pendingStepRef = useRef(pendingStep); // always-current copy for use inside effects
  pendingStepRef.current = pendingStep;

  // ── Terminal/confirming cleanup from multiContract WS ─────────────────────
  // Expand the useMultiContract callback so terminal phases clean up immediately
  // without waiting for the single-WS status-effect to fire.
  useEffect(() => {
    // This runs whenever projectStatuses updates (multiContract WS delivered a message).
    // Mirror of status-effect [0] for pendingStep, so clearing happens from EITHER WS.
    if (!pendingStep) return;
    const status = projectStatuses[pendingStep.projectId];
    if (!status) return;
    const { step } = pendingStep;
    if (
      (step === 'build'  && (status.build_ok || status.phase === 'building' || status.phase === 'build_fixing' || status.phase === 'learning')) ||
      (step === 'audit'  && (status.audit_ok || status.phase === 'auditing_static' || status.phase === 'auditing_llm' || status.phase === 'audit_fixing')) ||
      (step === 'deploy' && (!!status.program_id || status.phase === 'deploying'))
    ) {
      setPendingStep(null);
    }
    // Terminal: clean up trackedContracts so multiContract WS stops for this project
    if (
      status.phase === 'done' ||
      status.phase === 'failed' ||
      status.phase === 'cancelled' ||
      status.phase === 'paused_degraded'
    ) {
      const pid = pendingStep.projectId;
      setPendingStep(null);
      setTrackedContracts(prev => { const n = { ...prev }; delete n[pid]; return n; });
    }
  }, [projectStatuses, pendingStep]);

  // ── REST API fallback poll ────────────────────────────────────────────────
  // Single interval polls ALL trackedContracts simultaneously.
  // Reads from trackedContractsRef so deps never change — avoids the bug where
  // activeContractUid + currentProject?.uid mismatch writes the wrong project's
  // status into the wrong slot when the user switches projects mid-pipeline.
  useEffect(() => {
    const poll = async () => {
      const entries = Object.entries(trackedContractsRef.current);
      if (entries.length === 0) return;
      await Promise.all(entries.map(async ([pid, cuid]) => {
        try {
          const status = await apiClient.getContractStatus(cuid);
          setProjectStatuses(prev => ({ ...prev, [pid]: status }));
          if (
            status.phase === 'done' ||
            status.phase === 'failed' ||
            status.phase === 'cancelled' ||
            status.phase === 'paused_degraded'
          ) {
            setTrackedContracts(prev => { const n = { ...prev }; delete n[pid]; return n; });
            setPendingStep(prev => prev?.projectId === pid ? null : prev);
          }
        } catch { /* WS is primary; REST is last-resort */ }
      }));
    };
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Transition detector: previous status ref ──────────────────────────────
  // Used to detect *changes* in ok flags / program_id / next_step
  // without any local state mirrors. This is the ONLY effect watching contract.status.
  const prevStatusRef = useRef<typeof contract.status>(null);
  const projectCreatedRef = useRef<string | null>(null);

  // Stable ref so transition effects [C-F] can read the currently-viewed project
  // without being listed as useEffect dependencies (avoids stale-closure bugs).
  const currentProjectRef = useRef(currentProject);
  currentProjectRef.current = currentProject;

  useEffect(() => {
    if (!contract.status) return;
    const prev = prevStatusRef.current;
    const curr = contract.status;
    prevStatusRef.current = curr;

    // [0] Clear pendingStep once backend confirms the step is active or complete
    const pendingEntry = pendingStepRef.current;
    const pending = pendingEntry?.step ?? null;
    if (pending === 'build' && (curr.build_ok ||
        curr.phase === 'building' || curr.phase === 'build_fixing' || curr.phase === 'learning')) {
      setPendingStep(null);
    }
    if (pending === 'audit' && (curr.audit_ok ||
        curr.phase === 'auditing_static' || curr.phase === 'auditing_llm' || curr.phase === 'audit_fixing')) {
      setPendingStep(null);
    }
    if (pending === 'deploy' && (!!curr.program_id || curr.phase === 'deploying')) {
      setPendingStep(null);
    }
    if (
      curr.phase === 'done' ||
      curr.phase === 'failed' ||
      curr.phase === 'cancelled' ||
      curr.phase === 'paused_degraded'
    ) setPendingStep(null);

    // [A] Generate phase: update status message in chat while generating
    if (pipelineMsgId) {
      const phaseLabels: Record<string, string> = {
        pending:          '⏳ Queued — waiting for worker...',
        enriching:        '🔍 Analyzing your request...',
        generating:       '⚡ Generating Solana smart contract...',
        generated:        '📋 Code ready — click Build to compile.',
        building:         '🔧 Building with Anchor framework...',
        build_fixing: (() => {
          const count = curr.build_errors_count ?? 0;
          const errorDesc = humanizeErrorCodes(curr.top_error_codes ?? []);
          const attempt = curr.build_attempt ?? 1;
          const base = count > 0
            ? `🔧 Auto-fixing ${count} error${count > 1 ? 's' : ''} (attempt ${attempt})…`
            : `🔧 Fixing build errors (attempt ${attempt})…`;
          return errorDesc ? `${base}\n${errorDesc}` : base;
        })(),
        auditing_static:  '🔒 Running static security audit...',
        auditing_llm:     '🔒 Running AI security review...',
        audit_fixing:     '🔒 Fixing security issues...',
        deploying:        '🚀 Deploying to devnet...',
        learning:         '🧠 Updating knowledge base...',
        done:             '✅ Contract deployed!',
        failed:           `❌ Pipeline failed: ${curr.error ?? 'Unknown error'}`,
      };
      setMessages(prev => prev.map(m =>
        m.id === pipelineMsgId
          ? { ...m, content: phaseLabels[curr.phase] ?? `⚙️ ${curr.phase}...` }
          : m
      ));
    }

    // [A2] Build-fixing progress: last_fix_description changed → show what was patched.
    // Only fires while phase=build_fixing and only when the description actually changes
    // so we don't spam repeated messages on WS heartbeats.
    if (
      curr.phase === 'build_fixing' &&
      curr.last_fix_description &&
      curr.last_fix_description !== prev?.last_fix_description &&
      activeContractUid
    ) {
      const source = curr.last_fix_source === 'knowledge_base' ? ' _(KB)_' : curr.last_fix_source === 'llm_generated' ? ' _(AI)_' : '';
      const errorDesc = humanizeErrorCodes(curr.top_error_codes ?? []);
      const desc = curr.last_fix_description.replace(/^hard_rule:\s*/i, '').slice(0, 180);
      addAIMessageForProject(
        activeContractUid,
        `🔧 **Applied fix${source}:** ${desc}${errorDesc ? `\n_Errors: ${errorDesc}_` : ''}`,
      );
    }

    // [B] Generate complete: next_step just became 'build'
    if (
      curr.next_step === 'build' &&
      prev?.next_step !== 'build' &&
      activeContractUid &&
      projectCreatedRef.current !== activeContractUid
    ) {
      const uid = activeContractUid;
      projectCreatedRef.current = uid;

      // Build early project shell so sidebar shows immediately
      const chatSnapshot = messages.filter(m =>
        !m.content.startsWith('⏳') && !m.content.startsWith('⚙️') &&
        !m.content.startsWith('🔍') && !m.content.startsWith('⚡') &&
        !m.content.startsWith('🔧') && !m.content.startsWith('🔒') &&
        !m.content.startsWith('🚀') && !m.content.startsWith('🧠')
      );
      const firstUserMsg = chatSnapshot.find(m => m.isUser);
      const earlyName = firstUserMsg
        ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
        : `Contract ${uid.slice(0, 8)}`;

      const earlyProject: Project = {
        uid,
        name: earlyName,
        status: 'generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task: 'generate',
        bummUid: uid,
        code: '',
      };
      setCurrentProject(earlyProject);
      updateProjects(prev => [earlyProject, ...prev.filter(p => p.uid !== uid)]);
      // Migrate scratch messages → new project slot so the chat stays visible
      setMessagesByUid(prev => {
        const scratch = prev[SCRATCH_UID];
        if (!scratch || prev[uid]) return prev;
        const { [SCRATCH_UID]: _, ...rest } = prev;
        return { ...rest, [uid]: scratch };
      });
      apiClient.updateContract(uid, { name: earlyName }).catch(() => {});
      const chatForBackend = chatSnapshot.map(m => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));
      apiClient.saveContractChat(uid, chatForBackend).catch(() => {});

      // Fetch generated code and enrich project
      contract.getCode().then(result => {
        setGeneratedCode({ projectUid: uid, code: result.code });
        const richProject: Project = {
          uid, name: earlyName, status: 'generated',
          created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          task: 'generate', bummUid: uid, code: result.code,
        };
        setCurrentProject(richProject);
        updateProjects(prev => [richProject, ...prev.filter(p => p.uid !== uid)]);
        loadBalance().catch(() => {});
        setActiveContractUid(null);
        setTrackedContracts(prev => { const next = { ...prev }; delete next[uid]; return next; });
      }).catch(() => {
        setActiveContractUid(null);
        setTrackedContracts(prev => { const next = { ...prev }; delete next[uid]; return next; });
      });

      setPipelineMsgId(null);
    }

    // [C] Build complete: build_ok just became true
    // Guard: prev must be non-null — if prev is null this is the first WS message
    // (connecting to an already-built project), not a real transition.
    if (prev && !prev.build_ok && curr.build_ok && activeContractUid) {
      const uid = activeContractUid;
      setCurrentProject(p => p?.uid === uid ? { ...p, status: 'built' } : p);
      updateProjects(ps => ps.map(p => p.uid === uid ? { ...p, status: 'built' } : p));
      // Fetch fixes and refresh code in background
      (async () => {
        const attempts = curr.build_attempt ?? 1;
        const fixed = Math.max(0, attempts - 1);
        try {
          const data = await apiClient.getContractFixes(uid);
          type FixItem = {
            fix_description?: string;
            error_pattern?: string;
            source?: string;
            was_successful?: boolean | null;
          };
          const fixes: FixItem[] = (data.fixes || []).filter(
            (f: FixItem) => f.was_successful !== false
          );
          if (fixes.length > 0) {
            // Group by source: KB hits vs LLM-generated
            const kbCount = fixes.filter(f => f.source === 'knowledge_base').length;
            const llmCount = fixes.length - kbCount;

            const lines = fixes.slice(0, 8).map((f, i) => {
              const pattern = (f.error_pattern || 'compile error').replace(/\n/g, ' ').slice(0, 80);
              const desc = (f.fix_description || '').replace(/\n/g, ' ').slice(0, 200);
              const tag = f.source === 'knowledge_base' ? '_(from KB)_' : '_(LLM)_';
              return `${i + 1}. \`${pattern}\` → ${desc} ${tag}`;
            }).join('\n');

            const sourceBreakdown =
              kbCount > 0 && llmCount > 0
                ? ` (${kbCount} from KB, ${llmCount} LLM-generated)`
                : kbCount > 0
                ? ' (all from KB)'
                : ' (all LLM-generated)';

            addAIMessageForProject(
              uid,
              `**Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}.\n\n` +
              `**Auto-fixed ${fixes.length} compile error${fixes.length === 1 ? '' : 's'}**${sourceBreakdown}:\n\n` +
              `${lines}` +
              `${fixes.length > 8 ? `\n\n_…and ${fixes.length - 8} more._` : ''}\n\n` +
              `Contract compiles cleanly. Click **Audit** to run security checks.`
            );
          } else {
            addAIMessageForProject(
              uid,
              fixed > 0
                ? `**Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}. Auto-fixed ${fixed} compile error${fixed > 1 ? 's' : ''}.\n\nContract compiles cleanly. Click **Audit** to run security checks.`
                : `**Build succeeded on the first attempt** — contract compiles cleanly with no errors.\n\nClick **Audit** to run security checks.`
            );
          }
        } catch {
          addAIMessageForProject(uid, `**Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}. Click **Audit** to continue.`);
        }
        // Refresh code (build may have patched the source)
        try {
          const result = await apiClient.getContractCode(uid);
          if (result.code) {
            setCurrentProject(p => p?.uid === uid ? { ...p, code: result.code } : p);
            setGeneratedCode({ projectUid: uid, code: result.code });
          }
        } catch {}
        loadBalance().catch(() => {});
      })();
    }

    // [D] Audit complete: audit_ok just became true
    // Guard: prev must be non-null — first WS message must not trigger this.
    if (prev && !prev.audit_ok && curr.audit_ok && activeContractUid) {
      const uid = activeContractUid;
      setCurrentProject(p => p?.uid === uid ? { ...p, status: 'audited' } : p);
      updateProjects(ps => ps.map(p => p.uid === uid ? { ...p, status: 'audited' } : p));
      (async () => {
        try {
          // Fetch BOTH audit findings and the cumulative build fixes so we can render
          // a complete "what was changed before deploy" summary in the chat.
          const [auditData, fixesData] = await Promise.all([
            apiClient.getContractAudit(uid),
            apiClient.getContractFixes(uid).catch(() => ({ fixes: [] })),
          ]);
          type Vuln = {
            severity?: string;
            category?: string;
            title?: string;
            description?: string;
            suggested_fix?: string | null;
            code_location?: string | null;
            source?: string;
          };
          const vulns: Vuln[] = auditData.vulns || [];
          const attempts = curr.audit_attempt ?? 1;
          const buildFixCount = ((fixesData?.fixes || []) as Array<{ was_successful?: boolean | null }>)
            .filter(f => f.was_successful !== false).length;

          if (vulns.length === 0) {
            addAIMessageForProject(
              uid,
              `**Audit passed on the first try** — no security issues found.\n\n` +
              `**Final state before deploy:**\n` +
              `- Static analysis: clippy + cargo audit passed\n` +
              `- AI security review: passed\n` +
              `${buildFixCount > 0 ? `- Build fixes applied earlier: ${buildFixCount}\n` : ''}` +
              `\nContract is ready to deploy. Click **Publish** to deploy to Solana devnet.`
            );
          } else {
            // Group vulnerabilities by severity
            const SEV_ORDER = ['critical', 'high', 'medium', 'low', 'info'];
            const SEV_LABELS: Record<string, string> = {
              critical: 'CRITICAL',
              high:     'HIGH',
              medium:   'MEDIUM',
              low:      'LOW',
              info:     'INFO',
            };
            const grouped: Record<string, Vuln[]> = {};
            for (const v of vulns) {
              const sev = (v.severity || 'info').toLowerCase();
              if (!grouped[sev]) grouped[sev] = [];
              grouped[sev].push(v);
            }

            const sections: string[] = [];
            for (const sev of SEV_ORDER) {
              const items = grouped[sev];
              if (!items || items.length === 0) continue;
              const label = SEV_LABELS[sev] || sev.toUpperCase();
              const lines = items.slice(0, 5).map((v, i) => {
                const title = (v.title || 'Finding').replace(/\n/g, ' ').slice(0, 120);
                const desc = (v.description || '').replace(/\n/g, ' ').slice(0, 220);
                const fix = v.suggested_fix
                  ? `\n  ↳ **Fix applied:** ${v.suggested_fix.replace(/\n/g, ' ').slice(0, 220)}`
                  : '';
                const loc = v.code_location ? ` _(at ${v.code_location})_` : '';
                return `${i + 1}. **${title}**${loc}\n  ${desc}${fix}`;
              }).join('\n\n');
              const more = items.length > 5 ? `\n\n_…and ${items.length - 5} more in this severity._` : '';
              sections.push(`**${label} (${items.length})**\n\n${lines}${more}`);
            }

            addAIMessageForProject(
              uid,
              `**Audit complete** after ${attempts} pass${attempts > 1 ? 'es' : ''} — ` +
              `found and patched **${vulns.length}** issue${vulns.length === 1 ? '' : 's'}.\n\n` +
              `**Vulnerabilities found and fixed:**\n\n` +
              `${sections.join('\n\n')}\n\n` +
              `**Final state before deploy:**\n` +
              `${buildFixCount > 0 ? `- Compile-time fixes: **${buildFixCount}**\n` : ''}` +
              `- Security fixes: **${vulns.length}**\n` +
              `- Static analysis: clippy + cargo audit passed\n` +
              `- AI security review: passed\n\n` +
              `Contract is ready to deploy. Click **Publish** to deploy to Solana devnet.`
            );
          }
        } catch {
          addAIMessageForProject(uid, `**Audit complete.** Contract is ready for deployment. Click **Publish** to deploy.`);
        }
        loadBalance().catch(() => {});
      })();
    }

    // [E] Deploy complete: program_id just appeared
    // Guard: prev must be non-null — first WS message must not trigger this.
    if (prev && !prev.program_id && curr.program_id && activeContractUid) {
      const uid = activeContractUid;
      const pid = curr.program_id;
      setCurrentProject(p => p?.uid === uid
        ? { ...p, status: 'deployed', isDeployed: true, contractAddress: pid }
        : p);
      updateProjects(ps => ps.map(p => p.uid === uid
        ? { ...p, status: 'deployed', isDeployed: true, contractAddress: pid }
        : p));
      addAIMessageForProject(
        uid,
        `**Deployed to Solana.** Program ID: \`${pid}\`\n\nView on Explorer: https://explorer.solana.com/address/${pid}?cluster=devnet`
      );
      setPipelineMsgId(null);
      setActiveContractUid(null);
      setTrackedContracts(prev => { const next = { ...prev }; delete next[uid]; return next; });
      loadBalance().catch(() => {});
    }

    // [F] Pipeline failed
    // Guard: prev must be non-null — connecting to an already-failed project
    // (e.g. deploy ran out of funds earlier) must not re-add a failure message.
    if (prev && curr.phase === 'failed' && prev.phase !== 'failed' && activeContractUid) {
      const errorDesc = humanizeErrorCodes(curr.top_error_codes ?? []);
      const rawError = curr.error ?? 'Unknown error';
      // Show human-readable error description when available; raw error as fallback.
      const userFacingError = errorDesc
        ? `${errorDesc}\n\n_Technical detail: ${rawError.slice(0, 200)}_`
        : rawError;
      addAIMessageForProject(
        activeContractUid,
        `**Build failed after all auto-repair attempts.**\n\n${userFacingError}\n\nYou can edit the prompt and try again, or paste corrected code.`,
      );
      setPipelineMsgId(null);
    }

    // [G] Auto-pause on degradation — backend detected fix loop / audit
    // regression / syntax regression. Show reason and open the rollback modal.
    if (
      prev &&
      curr.phase === 'paused_degraded' &&
      prev.phase !== 'paused_degraded' &&
      activeContractUid
    ) {
      const uid = activeContractUid;
      const reason = curr.pause_report || 'Pipeline paused due to degradation signal.';
      addAIMessageForProject(
        uid,
        `**Pipeline auto-paused.** ${reason}\n\nReview the code, or use the rollback dialog to restore a prior version.`,
      );
      const pausedProject = projects.find(p => p.uid === uid) ?? currentProject;
      if (pausedProject) setRollbackProject(pausedProject);
      setPipelineMsgId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.status]);

  // ── Mid-pipeline stage reports (build-fail / fix-applied / audit-vulns) ──
  // Terminal events (build_ok / audit_ok / deploy / failed) are handled in the
  // effect above with richer API follow-up — this hook only fills the gaps.
  useStageReports({
    uid: activeContractUid,
    status: contract.status,
    onReport: (content) => {
      if (activeContractUid) addAIMessageForProject(activeContractUid, content);
    },
  });

  // ── Helper: save project to backend + localStorage cache ─────────────────
  const saveProject = useCallback((project: Project) => {
    // Skip ghost projects — no code yet, would pollute the sidebar on refresh
    if (!project.code && project.status === 'generated') return;
    if (typeof window === 'undefined') return;
    const wallet = auth.walletAddress;
    if (!wallet) return;
    const key = `bumm_projects_${wallet}`;
    try {
      const existing: Project[] = JSON.parse(localStorage.getItem(key) || '[]');
      const updated = [project, ...existing.filter(p => p.uid !== project.uid)];
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (_) {}
  }, [auth.walletAddress]);

  // ── Load projects from BACKEND when wallet connects ─────────────────────
  const loadProjectsFromBackend = useCallback(async () => {
    try {
      const res = await apiClient.listContracts();
      const backendProjects: Project[] = res.contracts.map(c => ({
        uid: c.uid,
        name: c.name || `Contract ${c.uid.slice(0, 8)}`,
        status: mapPhaseToStatus(c.phase, c.program_id, c.build_ok, c.audit_ok),
        created_at: c.created_at,
        updated_at: c.updated_at,
        task: 'generate' as const,
        bummUid: c.uid,
        contractAddress: c.program_id || undefined,
        isDeployed: !!c.program_id,
      }));
      updateProjects(() => backendProjects);
      // Also cache in localStorage
      if (auth.walletAddress) {
        try {
          localStorage.setItem(`bumm_projects_${auth.walletAddress}`, JSON.stringify(backendProjects));
        } catch (_) {}
      }
    } catch (err) {
      console.warn('Failed to load projects from backend, using localStorage:', err);
      // Fallback to localStorage — only show projects with code (no ghosts)
      if (auth.walletAddress) {
        const key = `bumm_projects_${auth.walletAddress}`;
        try {
          const saved: Project[] = JSON.parse(localStorage.getItem(key) || '[]');
          const withCode = saved.filter(p => p.code && p.code.length > 0);
          if (withCode.length > 0) updateProjects(() => withCode);
        } catch (_) {}
      }
    }
  }, [auth.walletAddress, updateProjects]);

  useEffect(() => {
    if (!auth.isAuthenticated) return;
    loadProjectsFromBackend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  // ── Helper: launch the pipeline with an enriched prompt ──────────────────
  const launchPipeline = useCallback(async (enrichedPrompt: string) => {
    if (!hasEnoughCredits('generate')) {
      setMessages(prev => [...prev, {
        id: generateUniqueMessageId(),
        content: 'Insufficient credits for contract generation. Please top up to continue.',
        timestamp: new Date(),
        isUser: false,
      }]);
      return;
    }

    const statusMsgId = generateUniqueMessageId();
    setPipelineMsgId(statusMsgId);
    setMessages(prev => [...prev, {
      id: statusMsgId,
      content: '⏳ Starting pipeline...',
      timestamp: new Date(),
      isUser: false,
    }]);

    try {
      // Pass chat history so it's saved with the contract in DB
      const chatHistory = messages
        .filter(m => !m.content.startsWith('⏳') && !m.content.startsWith('⚙️'))
        .map(m => ({
          role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
          content: m.content,
        }));
      const firstUserMsg = chatHistory.find(m => m.role === 'user');
      const projectName = firstUserMsg
        ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
        : 'New Contract';

      const created = await contract.createContract(enrichedPrompt, 'devnet', {
        name: projectName,
        chat_history: chatHistory,
      });
      setActiveContractUid(created.uid);
    } catch (err) {
      console.error('launchPipeline error:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id === statusMsgId
            ? { ...m, content: `❌ Failed to start: ${err instanceof Error ? err.message : 'Unknown error'}` }
            : m
        )
      );
      setPipelineMsgId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEnoughCredits, contract]);

  // ── Main send handler: chat-first → pipeline when ready ─────────────────
  const handleSendMessage = async (content: string, currentContractCode?: string) => {
    // 1. Add user message to chat UI
    setMessages(prev => [...prev, {
      id: generateUniqueMessageId(),
      content,
      timestamp: new Date(),
      isUser: true,
    }]);

    // 2. Build conversation history for the chat API
    //    Include current editor code as context if relevant
    let userContent = content;
    if (currentContractCode && currentContractCode.trim().length > 50) {
      const codeWords = ['this code', 'my code', 'the code', 'this contract', 'improve', 'fix', 'review', 'audit', 'build'];
      if (codeWords.some(w => content.toLowerCase().includes(w))) {
        userContent = `${content}\n\nCurrent contract code:\n\`\`\`rust\n${currentContractCode}\n\`\`\``;
      }
    }

    // Convert chat messages to API format (skip system / status messages)
    const history: ChatMessagePayload[] = messages
      .filter(m => m.content && !m.content.startsWith('⏳') && !m.content.startsWith('⚡') && !m.content.startsWith('🔧') && !m.content.startsWith('🔍') && !m.content.startsWith('🔒') && !m.content.startsWith('🚀') && !m.content.startsWith('❌') && !m.content.startsWith('✅'))
      .map(m => ({
        role: (m.isUser ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));

    // Add current message
    history.push({ role: 'user', content: userContent });

    // 3. Show typing indicator
    const typingId = generateUniqueMessageId();
    setMessages(prev => [...prev, {
      id: typingId,
      content: '...',
      timestamp: new Date(),
      isUser: false,
    }]);

    // 4. Call chat API.
    // Read via ref so we always have the project that was active when the user
    // pressed Send, even if a project switch raced with the async call.
    // Passing contract_uid switches the backend to "existing contract advisor"
    // mode (never returns ready=true) — first line of defence against spurious
    // re-generation. isNewContractFlow is the second line of defence client-side.
    const projectAtSendTime = currentProjectRef.current;
    const existingContractUid =
      projectAtSendTime?.bummUid ?? projectAtSendTime?.uid ?? undefined;
    // A real project has a UUID uid; stub- means no contract has been created yet.
    const isNewContractFlow = !projectAtSendTime || projectAtSendTime.uid.startsWith('stub-');

    try {
      const chatResp = await apiClient.chatMessage(history, existingContractUid);

      // Replace typing indicator with actual AI response. When the backend
      // attached a `proposed_action` block (Tier 2 auto-regen flow), surface
      // it on the message so ChatScreen renders the inline action card.
      const aiMessageId = typingId;
      setMessages(prev =>
        prev.map(m =>
          m.id === typingId
            ? {
                ...m,
                content: chatResp.message,
                proposedAction: chatResp.proposed_action
                  ? { ...chatResp.proposed_action, status: 'proposed' }
                  : undefined,
              }
            : m
        )
      );
      void aiMessageId;

      // 5. If AI says ready → launch the pipeline automatically.
      // Guard: ONLY fire for blank new-contract flow. If the user is viewing an
      // existing project, isNewContractFlow is false and we never re-generate,
      // even if the backend somehow leaked ready=true.
      if (chatResp.ready && chatResp.enriched_prompt && isNewContractFlow) {
        await launchPipeline(chatResp.enriched_prompt);
      }
    } catch (err) {
      console.error('handleSendMessage chat error:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id === typingId
            ? { ...m, content: `❌ Chat error: ${err instanceof Error ? err.message : 'Unknown error'}` }
            : m
        )
      );
    }
  };

  const addAIMessage = (content: string) => {
    const aiMessage: ChatMessage = {
      id: generateUniqueMessageId(),
      content,
      timestamp: new Date(),
      isUser: false
    };
    setMessages(prev => [...prev, aiMessage]);
  };

  /**
   * Send an AI message scoped to a specific project uid.
   *
   * • If the user is currently viewing that project → append to live chat (setMessages).
   * • Otherwise → persist silently to localStorage so the message appears the
   *   next time the user opens that project (handleSelectProject loads from there).
   *   Also fire-and-forget backend save so the message survives a page refresh.
   */
  const addAIMessageForProject = useCallback((projectUid: string, content: string) => {
    const viewed = currentProjectRef.current;
    const isViewing = viewed && (viewed.bummUid ?? viewed.uid) === projectUid;

    const msg: ChatMessage = {
      id: generateUniqueMessageId(),
      content,
      timestamp: new Date(),
      isUser: false,
    };

    if (isViewing) {
      // User sees this project right now — show immediately
      setMessages(prev => [...prev, msg]);
    } else {
      // Background project: stash in localStorage so it appears on next switch
      try {
        const key = `bumm_chat_history_${projectUid}`;
        const existing: ChatMessage[] = JSON.parse(localStorage.getItem(key) || '[]');
        localStorage.setItem(key, JSON.stringify([...existing, msg]));
      } catch { /* storage full — drop silently */ }
      // Also try to persist to backend (best-effort, fire-and-forget)
      apiClient.getContractChat(projectUid).then(res => {
        const prev = (res.messages || []) as Array<{ role: string; content: string; timestamp?: string }>;
        return apiClient.saveContractChat(projectUid, [
          ...prev,
          { role: 'assistant', content, timestamp: msg.timestamp.toISOString() },
        ]);
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const addUserMessage = (content: string) => {
    const userMessage: ChatMessage = {
      id: generateUniqueMessageId(),
      content,
      timestamp: new Date(),
      isUser: true
    };
    setMessages(prev => [...prev, userMessage]);
  };


  const generateAIResponse = (userMessage: string): string => {
    const responses = [
      "I'll help you create that smart contract. Let me generate the Rust code for you.",
      "Great idea! I'm analyzing the best approach for your Solana program.",
      "I can help you implement that feature. Here's what I suggest...",
      "That's an interesting use case for Solana. Let me create the program structure.",
      "I'll generate the anchor framework code for your project. This will include the necessary instructions and account structures."
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  };

  const handleBuild = async (code: string) => {
    if (!auth.isAuthenticated || !code.trim()) return;
    
    // Credit check temporarily disabled - frontend only
    // if (!hasEnoughCredits('build')) {
    //   const insufficientCreditsMessage: ChatMessage = {
    //     id: generateUniqueMessageId(),
    //     content: 'Insufficient credits for contract build. Please buy more credits to continue.',
    //     timestamp: new Date(),
    //     isUser: false
    //   };
    //   setMessages(prev => [...prev, insufficientCreditsMessage]);
    //   return;
    // }
    
    setIsBuilding(true);
    
    try {
      // Add build status message (will be updated with real status)
      const buildStatusMessageId = generateUniqueMessageId();
      const buildingMessage: ChatMessage = {
        id: buildStatusMessageId,
        content: '🔧 Initializing build...',
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, buildingMessage]);
      
      // Start build via API (use current project if exists)
      const project = await buildContract(code, currentProject?.uid);
      
      // Track build progress (use bummUid for API polling)
      const buildBummUid = project.bummUid || project.uid;
      console.log(`🔄 Tracking build: projectUid=${project.uid}, bummUid=${buildBummUid}`);
      trackTaskStatus(
        project.uid,
        'build',
        (progress) => {
          setMessages(prev =>
            prev.map(m =>
              m.id === buildStatusMessageId
                ? { ...m, content: `🔧 ${progress.message}` }
                : m
            )
          );
        },
        (result) => {
          // Analytics tracking
          analytics.trackContractBuild(project.uid);
          analytics.trackCreditSpend('build', 25, project.uid);
           
          // Build completed
          setIsBuilding(false);
          const successMessage: ChatMessage = {
            id: generateUniqueMessageId(),
            content: 'Build completed successfully! Your Solana program is ready for deployment.',
            timestamp: new Date(),
            isUser: false,
            projectUid: project.uid,
            taskType: 'build'
          };
          setMessages(prev => [...prev, successMessage]);
        },
        (error) => {
          // Build error
          setIsBuilding(false);
          const errorMessage: ChatMessage = {
            id: generateUniqueMessageId(),
            content: `Build failed: ${error}`,
            timestamp: new Date(),
            isUser: false,
            projectUid: project.uid,
            taskType: 'build'
          };
          setMessages(prev => [...prev, errorMessage]);
        },
        buildBummUid // Pass backend bumm UID for API polling
      );
    } catch (err) {
      setIsBuilding(false);
      const errorMessage: ChatMessage = {
        id: generateUniqueMessageId(),
        content: `Failed to start build: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const handleDeploy = async (code: string): Promise<string | undefined> => {
    if (!auth.isAuthenticated || !code.trim()) return undefined;
    
    try {
      // Add message about deployment start
      const deployingMessage: ChatMessage = {
        id: generateUniqueMessageId(),
        content: 'Starting deployment...',
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, deployingMessage]);
      
      // Start deployment via API
      const contractAddress = await deployContract(code);
      
      // Update current project
      if (currentProject) {
        const updatedProject = {
          ...currentProject,
          contractAddress,
          isDeployed: true,
          status: 'deployed' as const,
          updated_at: new Date().toISOString()
        };
        
        setCurrentProject(updatedProject);
        
        // Also update project in projects list
        updateProjects(prev => prev.map(p => 
          p.uid === currentProject.uid ? updatedProject : p
        ));
      }
      
      // Analytics tracking
      if (currentProject) {
        analytics.trackContractDeploy(currentProject.uid, contractAddress);
      }

      // Add successful deployment message
      const successMessage: ChatMessage = {
        id: generateUniqueMessageId(),
        content: `Deployment successful! Your smart contract is now live on Solana. Contract address: ${contractAddress}`,
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, successMessage]);
      return contractAddress;
    } catch (err) {
      const errorMessage: ChatMessage = {
        id: generateUniqueMessageId(),
        content: `Deployment failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, errorMessage]);
      throw err;
    }
  };

  const handleCreateNew = () => {
    if (!auth.isAuthenticated) return;

    // Reset to blank-slate state — a real contract UID is assigned only after
    // the user sends their first prompt (createContract returns the real UUID).
    // We intentionally do NOT call useBummApi.createProject here because it
    // returns a stub-${Date.now()} uid that would cause 500 errors if the
    // frontend ever tried to save chat history or status for it.
    setCurrentProject(null);
    setActiveContractUid(null);
    // Clear UI-only optimistic state so the new blank project starts clean.
    // NOTE: we do NOT touch trackedContracts — background pipelines keep running.
    setPendingStep(null);
    setPipelineMsgId(null);
    setMessages([{
      id: generateUniqueMessageId(),
      content: `🆕 New project created! Describe what smart contract you'd like to build.`,
      timestamp: new Date(),
      isUser: false,
    }]);
  };

  // ── Paste-mode contract creation ─────────────────────────────────────────────
  const handlePasteCode = useCallback(
    async (code: string, network: Network, name: string) => {
      if (!auth.isAuthenticated) return;

      const statusMsgId = generateUniqueMessageId();
      setPipelineMsgId(statusMsgId);
      setMessages(prev => [
        ...prev,
        {
          id: statusMsgId,
          content: '📋 Registering pasted contract — ready to build…',
          timestamp: new Date(),
          isUser: false,
        },
      ]);

      try {
        const created = await contract.createPasteContract(code, network, { name });
        setActiveContractUid(created.uid);

        // Immediately materialise the project — code is already available
        const projectName = name || `Pasted contract ${created.uid.slice(0, 8)}`;
        const newProject: Project = {
          uid: created.uid,
          name: projectName,
          status: 'generated',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          task: 'generate',
          bummUid: created.uid,
          code,
        };
        setCurrentProject(newProject);
        updateProjects(prev => [newProject, ...prev.filter(p => p.uid !== created.uid)]);
        projectCreatedRef.current = created.uid;

        // Migrate scratch messages (review chat before paste) → new project slot
        // so the conversation that led to this paste stays visible.
        setMessagesByUid(prev => {
          const scratch = prev[SCRATCH_UID];
          if (!scratch || prev[created.uid]) return prev;
          const { [SCRATCH_UID]: _, ...rest } = prev;
          return { ...rest, [created.uid]: scratch };
        });

        // Show code in the editor immediately (no need to wait for WS)
        setGeneratedCode({ projectUid: created.uid, code });

        // Persist name to backend
        apiClient.updateContract(created.uid, { name: projectName }).catch(() => {});
      } catch (err) {
        console.error('handlePasteCode error:', err);
        setMessages(prev =>
          prev.map(m =>
            m.id === statusMsgId
              ? {
                  ...m,
                  content: `❌ Failed to create paste project: ${err instanceof Error ? err.message : 'Unknown error'}`,
                }
              : m
          )
        );
        setPipelineMsgId(null);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [auth.isAuthenticated, contract],
  );

  // ── Step trigger — fire-and-forget (no local state mirrors) ─────────────
  // All completion handling is done by the transition effect watching contract.status.
  const handleStartStep = useCallback(
    async (step: 'build' | 'audit' | 'deploy') => {
      // Guard: ignore if this specific project already has a pending step in flight.
      if (pendingStepRef.current?.projectId === currentProject?.uid) return;

      const uid = currentProject?.bummUid ?? currentProject?.uid;
      if (!uid) {
        addAIMessage('No active project — create one first.');
        return;
      }

      // Safety net: ChatScreen already disables the action button when the
      // editor is dirty, but if anything bypasses the visual gate we still
      // refuse to fire build/audit/deploy on the stale persisted code. The
      // user has to clear the dirty state via "Save & rebuild" first.
      if (uid && editorDirtyByUid[uid]) {
        addAIMessage(
          'You have unsaved code changes. Click "Save & rebuild" in the editor first — otherwise the pipeline would run on the old persisted code.',
        );
        return;
      }

      // Immediately show loader — no waiting for WS heartbeat
      setPendingStep({ projectId: currentProject!.uid, step });
      // Ensure WS is connected to this project
      setActiveContractUid(uid);
      if (currentProject) {
        setTrackedContracts(prev => ({ ...prev, [currentProject.uid]: uid }));
      }
      try {
        await tryRefresh();
        if (step === 'build')  await apiClient.triggerBuild(uid);
        if (step === 'audit')  await apiClient.triggerAudit(uid);
        if (step === 'deploy') await apiClient.triggerDeploy(uid);
      } catch (err) {
        setPendingStep(null); // restore button so user can retry
        addAIMessage(`Failed to start ${step}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    },
    // editorDirtyByUid is read inside the callback; include it so a fresh
    // dirty flip takes effect on the very next click without waiting for
    // currentProject to also change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentProject, editorDirtyByUid],
  );

  // ── Code-edit + regenerate flows ──────────────────────────────────────────
  // Save user-edited code via PUT /code, then chain a build trigger so the
  // pipeline re-runs against the new source. Errors propagate to the editor
  // (it shows them inline next to the Save button).
  const handleSaveCode = useCallback(
    async (uid: string, code: string) => {
      try {
        await tryRefresh();
        await apiClient.replaceContractCode(uid, code);
      } catch (err) {
        addAIMessage(
          `Save failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        throw err;
      }
      // Trigger build only after save succeeds; failure here is non-fatal
      // for the save itself — user can retry build from the action button.
      try {
        setActiveContractUid(uid);
        await apiClient.triggerBuild(uid);
        addAIMessage('Code saved (v↑) — rebuilding…');
      } catch (err) {
        addAIMessage(
          `Code saved but build trigger failed: ${
            err instanceof Error ? err.message : 'Unknown error'
          }. Press Build to retry.`,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Retry a deploy that previously failed mid-upload. Backend's
  // `_rearm_failed_deploy_if_needed` detects (build_ok && audit_ok &&
  // !program_id && phase=failed) and repositions the LangGraph at the
  // pre-deploy interrupt — so a plain POST /deploy resumes from there.
  // No regenerate / rebuild needed: the .so is still in /builds/_cache.
  const handleRetryDeploy = useCallback(
    async (uid: string) => {
      try {
        await tryRefresh();
        setActiveContractUid(uid);
        await apiClient.triggerDeploy(uid);
        addAIMessage('Retrying deploy…');
      } catch (err) {
        addAIMessage(
          `Retry deploy failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        throw err;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Regenerate from user feedback. Backend rewrites the source via LLM and
  // pauses at `phase=generated`; we follow up with a build trigger.
  const handleRegenerateWithFeedback = useCallback(
    async (uid: string, feedback: string) => {
      try {
        await tryRefresh();
        await apiClient.regenerateContract(uid, feedback);
        addAIMessage('Regenerating with your feedback…');
      } catch (err) {
        addAIMessage(
          `Regenerate failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        );
        throw err;
      }
      try {
        setActiveContractUid(uid);
        await apiClient.triggerBuild(uid);
      } catch (err) {
        addAIMessage(
          `Regenerated but build trigger failed: ${
            err instanceof Error ? err.message : 'Unknown error'
          }. Press Build to retry.`,
        );
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /**
   * Flip the `proposedAction.status` on a specific chat message so the inline
   * card reflects the in-flight lifecycle. Lives outside the apply/decline
   * handlers so both can share the same setter and so the optimistic update
   * can be rolled back from a single place on error.
   */
  const updateProposalStatus = useCallback(
    (
      messageId: string,
      status: 'applying' | 'applied' | 'declined' | 'error',
      errorMessage?: string,
    ) => {
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId && m.proposedAction
            ? { ...m, proposedAction: { ...m.proposedAction, status, errorMessage } }
            : m,
        ),
      );
    },
    [setMessages],
  );

  const handleApplyProposal = useCallback(
    async (messageId: string, logUid: string) => {
      const uid = currentProjectRef.current?.bummUid ?? currentProjectRef.current?.uid;
      if (!uid) return;
      updateProposalStatus(messageId, 'applying');
      try {
        await tryRefresh();
        const result = await apiClient.applyChatProposal(uid, logUid);
        updateProposalStatus(messageId, 'applied');
        // /apply already wired the regenerate; kick off the build so the user
        // sees the next pipeline phase animate without a manual click.
        setActiveContractUid(uid);
        try {
          await apiClient.triggerBuild(uid);
        } catch (err) {
          addAIMessageForProject(
            uid,
            `Applied your suggestions but build trigger failed: ${
              err instanceof Error ? err.message : 'Unknown error'
            }. Press Build to retry.`,
          );
        }
        void result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        updateProposalStatus(messageId, 'error', msg);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateProposalStatus],
  );

  const handleDeclineProposal = useCallback(
    async (messageId: string, logUid: string) => {
      const uid = currentProjectRef.current?.bummUid ?? currentProjectRef.current?.uid;
      if (!uid) return;
      // Optimistic — telemetry-only endpoint, no need to wait before the UI
      // hides the card.
      updateProposalStatus(messageId, 'declined');
      try {
        await apiClient.declineChatProposal(uid, logUid);
      } catch (err) {
        // Don't bother the user — decline is telemetry. Just log.
        console.warn('declineChatProposal failed:', err);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [updateProposalStatus],
  );

  // ── Computed UI state (no useState — pure derivation every render) ────────
  // Priority: REST-pre-loaded or multiContract WS status → single WS status.
  // handleSelectProject no longer opens a WS (to avoid spurious transitions),
  // so contract.status is only relevant when the user triggered a step
  // (which sets activeContractUid = currentProject's uid).
  const currentProjectContractUid = currentProject
    ? (currentProject.bummUid ?? currentProject.uid)
    : null;
  const singleWsMatchesCurrent = activeContractUid === currentProjectContractUid;
  const activeStatus = currentProject
    ? (projectStatuses[currentProject.uid] ?? (singleWsMatchesCurrent ? contract.status : null))
    : contract.status;
  // Only apply the optimistic pending state if it belongs to the currently viewed project
  const currentPendingStep = (pendingStep && pendingStep.projectId === currentProject?.uid)
    ? pendingStep.step
    : null;
  const ui = deriveUIFromStatus(
    activeStatus,
    !!(currentProject?.code?.trim()),
    currentPendingStep,
  );

  // Project management functions
  const handleSelectProject = async (project: Project) => {
    try {
      // CRITICAL: reset prevStatusRef BEFORE setCurrentProject so stale WS
      // heartbeats arriving after the switch see prev=null and silently skip.
      prevStatusRef.current = null;
      setCurrentProject(project);

      // Pre-populate projectStatuses via REST so activeStatus is correct immediately.
      apiClient.getContractStatus(project.bummUid ?? project.uid)
        .then(status => setProjectStatuses(prev => ({ ...prev, [project.uid]: status })))
        .catch(() => {});

      // Fetch code so ChatScreen always shows the latest source.
      apiClient.getContractCode(project.uid).then(result => {
        if (result.code) {
          setCurrentProject(prev => prev && prev.uid === project.uid
            ? { ...prev, code: result.code }
            : prev);
        }
      }).catch(() => {});

      // Messages: if already loaded in this session, switch is instant — no fetch.
      if (messagesByUid[project.uid] !== undefined) return;

      // Cold load: try backend first, then localStorage.
      // This path only runs once per project per session.
      try {
        const chatRes = await apiClient.getContractChat(project.uid);
        if (chatRes.messages && chatRes.messages.length > 0) {
          const loadedMessages: ChatMessage[] = chatRes.messages.map((m: Record<string, unknown>, i: number) => ({
            id: `loaded_${i}_${Date.now()}`,
            content: (m.content as string) || '',
            timestamp: new Date((m.timestamp as string) || Date.now()),
            isUser: m.role === 'user',
          }));
          setMessagesByUid(prev => ({ ...prev, [project.uid]: loadedMessages }));
          // Pre-seed the save-hash so the auto-save effect doesn't immediately
          // PUT the same messages back to the backend on this cold load.
          const initHash = `${loadedMessages.length}:${loadedMessages
            .map(m => `${m.id}#${m.content.length}`)
            .join('|')}`;
          lastSavedChatHashRef.current[project.uid] = initHash;
          return;
        }
      } catch (_) {
        // Backend unavailable — fall through to localStorage
      }

      const savedMessages = localStorage.getItem(`bumm_chat_history_${project.uid}`);
      if (savedMessages) {
        try {
          const parsed = JSON.parse(savedMessages);
          const withDates = parsed.map((msg: ChatMessage) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
          }));
          setMessagesByUid(prev => ({ ...prev, [project.uid]: withDates }));
        } catch {
          setMessagesByUid(prev => ({ ...prev, [project.uid]: [] }));
        }
      }
      // If nothing found: first visit — welcome message shown via derived `messages`.

    } catch (err) {
      console.error('Failed to switch project:', err);
    }
  };

  const handleRenameProject = async (project: Project, newName: string) => {
    try {
      // Update on backend
      await apiClient.updateContract(project.uid, { name: newName });

      // Update locally
      updateProjects(prev => prev.map(p =>
        p.uid === project.uid
          ? { ...p, name: newName, updated_at: new Date().toISOString() }
          : p
      ));

      if (currentProject?.uid === project.uid) {
        setCurrentProject(prev => prev ? { ...prev, name: newName } : null);
      }
    } catch (err) {
      console.error('Failed to rename project:', err);
      addAIMessage(`Failed to rename project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDeleteProject = async (project: Project) => {
    try {
      // Delete on backend
      await apiClient.deleteContract(project.uid);

      // Remove locally
      updateProjects(prev => prev.filter(p => p.uid !== project.uid));

      if (currentProject?.uid === project.uid) {
        const remainingProjects = projects.filter(p => p.uid !== project.uid);
        setCurrentProject(remainingProjects.length > 0 ? remainingProjects[0] : null);
        // Drop deleted project's messages from the map.
        setMessagesByUid(prev => { const n = { ...prev }; delete n[project.uid]; return n; });
      }

      analytics.trackProjectDelete(project.uid);
    } catch (err) {
      console.error('Failed to delete project:', err);
      addAIMessage(`Failed to delete project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleStopProject = async (project: Project) => {
    try {
      const res = await apiClient.cancelContract(project.uid);
      // Always clear pending animation immediately — backend confirmed the state.
      setPendingStep(prev => prev?.projectId === project.uid ? null : prev);
      // Refresh cached status so the animation stops without waiting for the next WS tick.
      apiClient.getContractStatus(project.uid).then(freshStatus => {
        setProjectStatuses(prev => ({ ...prev, [project.uid]: freshStatus }));
      }).catch(() => {});
      if (res.cancelled) {
        addAIMessage(`Pipeline stopped for "${project.name || 'Untitled'}" (was: ${res.phase_at_cancel}). Do you want to roll back the code?`);
        setRollbackProject(project);
      } else {
        addAIMessage(`Nothing to stop — "${project.name || 'Untitled'}" is not running (phase: ${res.phase_at_cancel}).`);
      }
    } catch (err) {
      console.error('Failed to cancel project:', err);
      addAIMessage(`Failed to stop project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleForkProject = async (project: Project) => {
    try {
      const res = await apiClient.forkContract(project.uid);
      const forkProject: Project = {
        ...project,
        uid: res.uid,
        bummUid: res.uid,
        name: res.name,
        status: res.phase as Project['status'],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDeployed: false,
        isFrozen: false,
        contractAddress: undefined,
      };
      updateProjects(prev => [forkProject, ...prev]);
      addAIMessage(`Forked "${project.name || 'Untitled'}" → "${res.name}".`);
    } catch (err) {
      console.error('Failed to fork project:', err);
      addAIMessage(`Failed to fork project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleShareLinkProject = async (project: Project) => {
    // UI stub — full share feature arrives with a dedicated backend endpoint.
    addAIMessage(`Share link for "${project.name || 'Untitled'}" is coming soon.`);
  };

  const handleExportProject = async (project: Project) => {
    try {
      const code = (project.code || '').trim();
      if (!code) {
        addAIMessage(`Cannot export "${project.name || 'Untitled'}" — contract has no code yet.`);
        return;
      }
      const safeName = (project.name || 'contract').replace(/[^\w.-]+/g, '_').slice(0, 80) || 'contract';
      const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeName}.rs`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addAIMessage(`Exported "${project.name || 'Untitled'}" as ${safeName}.rs`);
    } catch (err) {
      console.error('Failed to export project:', err);
      addAIMessage(`Failed to export project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const renderCurrentScreen = () => {
    switch (currentState) {
      case 'login':
        return <LoginScreen onLogin={handleLogin} />;
      
      case 'chat':
        return (
          <ChatScreen
            messages={messages}
            onSendMessage={handleSendMessage}
            onAddAIMessage={addAIMessage}
            onGenerateContract={generateContract}
            onCreateProject={createProject}
            onCreateNew={handleCreateNew}
            onOpenPasteModal={(initialCode) => {
              setPasteModalInitialCode(initialCode);
              setIsPasteModalOpen(true);
            }}
            onSelectProject={handleSelectProject}
            onRenameProject={handleRenameProject}
            onDeleteProject={handleDeleteProject}
            onStopProject={handleStopProject}
            onForkProject={handleForkProject}
            onShareLinkProject={handleShareLinkProject}
            onExportProject={handleExportProject}
            isBuilding={isBuilding}
            currentProject={currentProject}
            user={user}
            projects={projects}
            isLoading={isLoading}
            error={error}
            generatedCode={generatedCode}
            onGeneratedCodeApplied={() => setGeneratedCode(null)}
            generationAttemptFailed={generationAttemptFailed}
            buttonState={ui.buttonState}
            animationStage={ui.animationStage}
            contractStatus={contract.status}
            onStartStep={handleStartStep}
            onSaveCode={handleSaveCode}
            onRegenerateWithFeedback={handleRegenerateWithFeedback}
            onRetryDeploy={handleRetryDeploy}
            onApplyProposal={handleApplyProposal}
            onDeclineProposal={handleDeclineProposal}
            onEditorDirtyChange={handleEditorDirtyChange}
            editorDirty={
              !!(currentProject && editorDirtyByUid[currentProject.uid])
            }
          />
        );
      
      default:
        return <LoginScreen onLogin={handleLogin} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#101010] flex items-center justify-center">
      <AnimatePresence mode="wait">
        {renderCurrentScreen()}
      </AnimatePresence>
      {/* <WalletDebug /> */}
      {/* <SimpleWalletTest /> */}

      {/* Rollback modal — appears after Stop to offer version restore */}
      <RollbackModal
        isOpen={rollbackProject !== null}
        projectUid={rollbackProject?.uid ?? ''}
        projectName={rollbackProject?.name ?? 'Untitled'}
        onClose={() => setRollbackProject(null)}
        onKeepCurrent={() => {
          addAIMessage(`Keeping current code for "${rollbackProject?.name || 'Untitled'}".`);
          setRollbackProject(null);
        }}
        onRolledBack={(version) => {
          addAIMessage(`Code restored to version ${version} for "${rollbackProject?.name || 'Untitled'}". Pipeline is paused before build — trigger build when ready.`);
          setRollbackProject(null);
        }}
      />

      {/* Paste-code modal — lives at Dashboard level so it persists across chat renders */}
      <PasteCodeModal
        isOpen={isPasteModalOpen}
        initialCode={pasteModalInitialCode}
        onClose={() => { setIsPasteModalOpen(false); setPasteModalInitialCode(undefined); }}
        onSwitchToPrompt={() => {
          setIsPasteModalOpen(false);
          setPasteModalInitialCode(undefined);
        }}
        onSubmit={handlePasteCode}
      />
      
      {/* Временная кнопка для отключения кошелька */}
      <div className="fixed top-4 left-4 hidden">
        <button 
          onClick={() => {
            disconnect();
            setCurrentState('login');
          }}
          className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
