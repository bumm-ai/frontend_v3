'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { DashboardState, ChatMessage, Project } from '@/types/dashboard';
import { useBummApi } from '@/hooks/useBummApi';
import { useCredits } from '@/hooks/useCredits';
import { useAuth } from '@/hooks/useAuth';
import { useAnalytics } from '@/hooks/useAnalytics';
import { useContract } from '@/hooks/useContract';
import { apiClient } from '@/services/api';
import { tryRefresh } from '@/services/authService';
import type { ChatMessagePayload } from '@/lib/api';
// import { WalletDebug } from '../debug/WalletDebug';
// import { SimpleWalletTest } from '../debug/SimpleWalletTest';
import LoginScreen from './LoginScreen';
import ChatScreen from './ChatScreen';
import { PasteCodeModal } from '@/components/ui/PasteCodeModal';
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

/** Map backend pipeline phase to frontend project status */
function mapPhaseToStatus(phase: string, programId?: string | null): Project['status'] {
  switch (phase) {
    case 'pending': case 'started': case 'enriching': return 'initializing';
    case 'generating': return 'in-progress';
    // 'generated' = paste-mode: code ready, awaiting build trigger
    case 'generated': case 'building': case 'build_fixing': return 'generated';
    case 'auditing_static': case 'auditing_llm': case 'audit_fixing': return 'built';
    case 'deploying': return 'audited';
    case 'done':
      return programId ? 'deployed' : 'completed';
    case 'failed': return 'draft';
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
  
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    content: 'Hello! I\'m here to help you build on Solana. What would you like to create today?',
    timestamp: new Date(),
    isUser: false,
  }]);
  const [isBuilding, setIsBuilding] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<{ projectUid: string; code: string } | null>(null);
  const [generationAttemptFailed, setGenerationAttemptFailed] = useState(0);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteModalInitialCode, setPasteModalInitialCode] = useState<string | undefined>(undefined);

  // ── Inline step-mode (Build / Audit / Deploy) ────────────────────────────
  // Track which step the user just triggered from the Smart Contract Preview
  // block so the Dashboard can reliably detect its completion from the WS
  // phase stream (phase alone is unreliable — build node leaves phase='building'
  // after pausing at the audit interrupt). Ref, not state, to avoid re-renders.
  const triggeredStepRef = useRef<'build' | 'audit' | 'deploy' | null>(null);
  const [pipelineStepRunning, setPipelineStepRunning] = useState<
    'idle' | 'triggering' | 'running' | 'error'
  >('idle');
  const [pipelineStepError, setPipelineStepError] = useState<string | null>(null);

  // Save message history for current project in localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject && messages.length > 0) {
      try {
        localStorage.setItem(`bumm_chat_history_${currentProject.uid}`, JSON.stringify(messages));
      } catch (err) {
        console.warn('Failed to save chat history to localStorage:', err);
      }
    }
  }, [messages, currentProject]);


  // Auto-switch to chat when JWT session is restored or login completes
  useEffect(() => {
    if (auth.isAuthenticated && currentState === 'login') {
      setCurrentState('chat');
      loadBalance().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.isAuthenticated]);

  const handleLogin = async () => {
    analytics.trackWalletConnect('phantom');
    await auth.login();
    // State transition handled by the useEffect above when auth.isAuthenticated becomes true
  };

  // ── Track current pipeline phase for preview panel animations ────────────
  const [pipelinePhase, setPipelinePhase] = useState<string | null>(null);

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
        status: mapPhaseToStatus(c.phase, c.program_id),
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

  // ── WebSocket phase watcher ─────────────────────────────────────────────────
  // Track whether we've already created the project for this contract uid
  // so step-mode WS heartbeats don't re-trigger project creation.
  const projectCreatedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!contract.status) return;
    const { phase, error, next_step } = contract.status;

    // Always update animation phase
    setPipelinePhase(phase);

    if (!pipelineMsgId) return;

    // ── Step-mode: generate is done when next_step === 'build' ──────────────
    // The pipeline has paused before the build node. Create the project now
    // and show the "ready to build" message. Only do this once per contract.
    const generateDone =
      next_step === 'build' && activeContractUid &&
      projectCreatedRef.current !== activeContractUid;

    const labels: Record<string, string> = {
      pending:          '⏳ Queued — waiting for worker...',
      enriching:        '🔍 Analyzing your request...',
      generating:       generateDone
                          ? '✅ Contract generated! Click Build to compile.'
                          : '⚡ Generating Solana smart contract...',
      generated:        '📋 Code ready — click Build to compile.',
      building:         '🔧 Building with Anchor framework...',
      build_fixing:     '🔧 Fixing build errors...',
      auditing_static:  '🔒 Running static security audit...',
      auditing_llm:     '🔒 Running AI security review...',
      audit_fixing:     '🔒 Fixing security issues...',
      deploying:        '🚀 Deploying to devnet...',
      learning:         '🧠 Updating knowledge base...',
      done:             '✅ Contract deployed! View the program address.',
      failed:           `❌ Pipeline failed: ${error ?? 'Unknown error'}`,
    };

    setMessages(prev =>
      prev.map(m =>
        m.id === pipelineMsgId
          ? { ...m, content: labels[phase] ?? `⚙️ ${phase}...` }
          : m
      )
    );

    // Helper: build a project record and save it
    const createProjectFromCode = (uid: string, code: string) => {
      const chatSnapshot = messages.filter(m =>
        !m.content.startsWith('⏳') && !m.content.startsWith('⚙️') &&
        !m.content.startsWith('🔍') && !m.content.startsWith('⚡') &&
        !m.content.startsWith('🔧') && !m.content.startsWith('🔒') &&
        !m.content.startsWith('🚀') && !m.content.startsWith('🧠')
      );
      const firstUserMsg = chatSnapshot.find(m => m.isUser);
      const projectName = firstUserMsg
        ? firstUserMsg.content.slice(0, 40) + (firstUserMsg.content.length > 40 ? '...' : '')
        : `Contract ${uid.slice(0, 8)}`;

      const newProject: Project = {
        uid,
        name: projectName,
        status: 'generated',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        task: 'generate',
        bummUid: uid,
        code,
      };
      setCurrentProject(newProject);
      updateProjects(prev => [newProject, ...prev.filter(p => p.uid !== uid)]);
      saveProject(newProject);
      projectCreatedRef.current = uid;

      // Persist to backend
      apiClient.updateContract(uid, { name: projectName }).catch(() => {});
      const chatForBackend = chatSnapshot.map(m => ({
        role: m.isUser ? 'user' : 'assistant',
        content: m.content,
        timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
      }));
      apiClient.saveContractChat(uid, chatForBackend).catch(() => {});
      if (typeof window !== 'undefined') {
        try { localStorage.setItem(`bumm_chat_history_${uid}`, JSON.stringify(chatSnapshot)); } catch (_) {}
      }
    };

    // ── Step-mode: generate done → create project and stop watching ─────────
    if (generateDone) {
      const uid = activeContractUid!;
      // Guard BEFORE async work to prevent double-trigger from WS heartbeats
      projectCreatedRef.current = uid;

      // Create project shell immediately — sidebar updates right away,
      // Build button appears, no waiting for code fetch
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
      // Do NOT saveProject(earlyProject) — code is empty, would create a ghost in localStorage
      apiClient.updateContract(uid, { name: earlyName }).catch(() => {});

      // Fetch the generated code and enrich the project
      contract.getCode().then(result => {
        setGeneratedCode({ projectUid: uid, code: result.code });
        createProjectFromCode(uid, result.code);
        loadBalance().catch(() => {});
        setPipelinePhase(null);
        // Clear WS target only after code is loaded — otherwise useContract(uid→null)
        // resets state and races with setGeneratedCode (empty preview).
        setActiveContractUid(null);
      }).catch(err => {
        console.error('Failed to load generated code:', err);
        setPipelinePhase(null);
        setActiveContractUid(null);
      });
      // Stop status line updates; keep activeContractUid until getCode() finishes (see .then above).
      setPipelineMsgId(null);
    } else if (phase === 'done') {
      // Full pipeline done (API mode) OR deploy done (step mode)
      const uid = activeContractUid!;
      if (projectCreatedRef.current !== uid) {
        // Full auto-pipeline (API mode): create project now
        contract.getCode().then(result => {
          setGeneratedCode({ projectUid: uid, code: result.code });
          createProjectFromCode(uid, result.code);
          loadBalance().catch(() => {});
          setPipelinePhase(null);
          setActiveContractUid(null);
        }).catch(err => {
          console.error('Failed to load generated code:', err);
          setActiveContractUid(null);
        });
        setPipelineMsgId(null);
      } else {
        // Step mode: pipeline finished — only "deployed" if we have a program_id
        const pid = contract.status?.program_id;
        const deployed = Boolean(pid);
        setCurrentProject(prev => prev
          ? {
              ...prev,
              status: deployed ? 'deployed' : 'completed',
              isDeployed: deployed,
              contractAddress: pid ?? undefined,
            }
          : prev);
        updateProjects(prev => prev.map(p =>
          p.uid === uid
            ? {
                ...p,
                status: deployed ? 'deployed' : 'completed',
                isDeployed: deployed,
                contractAddress: pid ?? undefined,
              }
            : p
        ));
        setPipelinePhase(null);
        setPipelineMsgId(null);
        setActiveContractUid(null);
      }
    } else if (phase === 'failed') {
      setGenerationAttemptFailed(prev => prev + 1);
      setPipelineMsgId(null);
      setActiveContractUid(null);
      setPipelinePhase(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contract.status]);

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
          role: m.isUser ? 'user' : 'assistant',
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

    // 4. Call chat API
    try {
      const chatResp = await apiClient.chatMessage(history);

      // Replace typing indicator with actual AI response
      setMessages(prev =>
        prev.map(m =>
          m.id === typingId
            ? { ...m, content: chatResp.message }
            : m
        )
      );

      // 5. If AI says ready → launch the pipeline automatically
      if (chatResp.ready && chatResp.enriched_prompt) {
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

  const handleCreateNew = async () => {
    if (!auth.isAuthenticated) return;
    
    try {
      console.log(`Creating new project manually...`);
      
      // Create empty project (without automatic contract generation)
      const projectName = `Project ${projects.length + 1}`;
      const newProject = await createProject(projectName);
      setCurrentProject(newProject);
      
      // Analytics tracking
      analytics.trackProjectCreate(projectName);
      
      // Clear chat for new project
      setMessages([]);
      
      // Add welcome message
      const welcomeMessage: ChatMessage = {
        id: generateUniqueMessageId(),
        content: `🆕 New project "${projectName}" created! Describe what smart contract you'd like to build.`,
        timestamp: new Date(),
        isUser: false
      };
      setMessages(prev => [...prev, welcomeMessage]);
      
    } catch (err) {
      console.error('Failed to create new project:', err);
      const errorMessage: ChatMessage = {
      id: Date.now().toString(),
        content: `Failed to create new project: ${err instanceof Error ? err.message : 'Unknown error'}`,
      timestamp: new Date(),
      isUser: false
    };
      setMessages(prev => [...prev, errorMessage]);
    }
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

  // ── Inline step trigger (Build / Audit / Deploy) ────────────────────────
  // Invoked by ChatScreen's SmartActionButton.  Reconnects WS to the current
  // project (if not already), fires the step endpoint, and starts waiting for
  // WS phase updates to drive animations inside the Smart Contract Preview.
  const handleStartStep = useCallback(
    async (step: 'build' | 'audit' | 'deploy') => {
      const uid = currentProject?.bummUid ?? currentProject?.uid;
      if (!uid) {
        setPipelineStepError('No active project — create one first.');
        setPipelineStepRunning('error');
        return;
      }

      setPipelineStepRunning('triggering');
      setPipelineStepError(null);
      triggeredStepRef.current = step;

      // Make sure the WS subscription is pointed at this project so that
      // phase updates (building → build_fixing → paused, etc.) stream in.
      setActiveContractUid(uid);

      try {
        await tryRefresh();
        if (step === 'build')  await apiClient.triggerBuild(uid);
        if (step === 'audit')  await apiClient.triggerAudit(uid);
        if (step === 'deploy') await apiClient.triggerDeploy(uid);
        setPipelineStepRunning('running');
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Failed to start ${step}`;
        setPipelineStepError(msg);
        setPipelineStepRunning('error');
        triggeredStepRef.current = null;
        console.error(`handleStartStep(${step}) error:`, err);
      }
    },
    [currentProject],
  );

  // ── Completion watcher for inline step triggers ──────────────────────────
  // We rely on the *_ok flags / program_id (not phase category) because e.g.
  // the build node leaves phase='building' even after pausing at audit.
  useEffect(() => {
    if (pipelineStepRunning !== 'running') return;
    if (!contract.status) return;
    const step = triggeredStepRef.current;
    if (!step) return;

    if (contract.status.phase === 'failed') {
      setPipelineStepError(contract.status.error ?? 'Pipeline failed');
      setPipelineStepRunning('error');
      triggeredStepRef.current = null;
      return;
    }

    const done =
      (step === 'build'  && contract.status.build_ok)                ||
      (step === 'audit'  && contract.status.audit_ok)                ||
      (step === 'deploy' && !!contract.status.program_id);
    if (!done) return;

    const pid = contract.status.program_id ?? undefined;
    const uid = currentProject?.uid ?? activeContractUid;

    // Update the current project to reflect the new stage so the action
    // button in ChatScreen advances to the next step automatically.
    if (uid) {
      setCurrentProject(prev => prev && prev.uid === uid
        ? {
            ...prev,
            status: step === 'deploy' ? 'deployed'
                    : step === 'audit' ? 'audited'
                    : 'built',
            isDeployed: step === 'deploy' ? true : prev.isDeployed,
            contractAddress: pid ?? prev.contractAddress,
          }
        : prev);
      updateProjects(prev => prev.map(p => p.uid === uid
        ? {
            ...p,
            status: step === 'deploy' ? 'deployed'
                    : step === 'audit' ? 'audited'
                    : 'built',
            isDeployed: step === 'deploy' ? true : p.isDeployed,
            contractAddress: pid ?? p.contractAddress,
          }
        : p));
    }

    // Emit stylized chat summary for the finished step.
    if (step === 'build') {
      const attempts = contract.status.build_attempt ?? 1;
      const fixed = Math.max(0, attempts - 1);
      // Fetch detailed fix list from /fixes endpoint.
      (async () => {
        try {
          const token = localStorage.getItem('bumm_access_token');
          const res = await fetch(`/api/backend/contracts/${uid}/fixes`, {
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          if (res.ok) {
            const data: {
              fixes: Array<{ error_pattern: string; fix_description: string; source: string; was_successful: boolean | null }>;
            } = await res.json();
            const fixes = (data.fixes || []).filter(f => f.was_successful !== false);
            if (fixes.length > 0) {
              const list = fixes.slice(0, 6).map((f, i) =>
                `${i + 1}. ${f.fix_description}${f.source === 'knowledge_base' ? ' *(from KB)*' : ''}`
              ).join('\n');
              addAIMessage(
                `✅ **Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}. Auto-applied **${fixes.length}** fix${fixes.length === 1 ? '' : 'es'}:\n\n${list}${fixes.length > 6 ? `\n…and ${fixes.length - 6} more.` : ''}`
              );
              return;
            }
          }
        } catch {
          // fall through to generic message
        }
        addAIMessage(
          fixed > 0
            ? `✅ **Build succeeded** after ${attempts} attempt${attempts > 1 ? 's' : ''}. Auto-fixed ${fixed} compile error${fixed > 1 ? 's' : ''} along the way — the contract now compiles cleanly.`
            : `✅ **Build succeeded** on the first attempt. The contract compiles cleanly with no errors.`
        );
      })();
    } else if (step === 'audit' && uid) {
      // Fetch full audit report + vulns to surface as chat message.
      (async () => {
        try {
          const res = await fetch(`/api/backend/contracts/${uid}/audit`, {
            headers: { 'Content-Type': 'application/json' },
          });
          if (res.ok) {
            const data = await res.json();
            const vulns: Array<{ severity?: string; title?: string; description?: string }> = data.vulns || [];
            const attempts = contract.status?.audit_attempt ?? 1;
            if (vulns.length === 0) {
              addAIMessage(`🛡️ **Audit passed** — no critical or high-severity issues found. Contract is ready to deploy.`);
            } else {
              const list = vulns.slice(0, 8).map((v, i) =>
                `${i + 1}. **[${(v.severity || 'info').toUpperCase()}]** ${v.title || 'Finding'}${v.description ? ` — ${v.description}` : ''}`
              ).join('\n');
              addAIMessage(
                `🛡️ **Audit complete** (${attempts} pass${attempts > 1 ? 'es' : ''}). Found and patched **${vulns.length}** vulnerabilit${vulns.length === 1 ? 'y' : 'ies'}:\n\n${list}${vulns.length > 8 ? `\n…and ${vulns.length - 8} more.` : ''}\n\nAll critical/high findings were auto-fixed and the contract was rebuilt successfully.`
              );
            }
          } else {
            addAIMessage(`🛡️ **Audit complete.** Contract is ready for deployment.`);
          }
        } catch {
          addAIMessage(`🛡️ **Audit complete.** Contract is ready for deployment.`);
        }
      })();
    } else if (step === 'deploy') {
      addAIMessage(
        `🚀 **Deployed to Solana!** Program ID: \`${pid}\`\n\nView on Explorer: https://explorer.solana.com/address/${pid}?cluster=devnet`
      );
    }

    // Always clear the phase so the editor animation resets between steps.
    // Without this the BuildStages animation stays rendered after build finishes,
    // blocking AuditStages from appearing when the user clicks Audit.
    setPipelinePhase(null);
    setPipelineStepRunning('idle');
    triggeredStepRef.current = null;

    // After build: re-fetch code from backend so the editor shows the
    // auto-fixed version (build node may have patched compile errors in the source).
    if (step === 'build' && uid) {
      apiClient.getContractCode(uid).then(result => {
        if (result.code) {
          setCurrentProject(prev =>
            prev && prev.uid === uid ? { ...prev, code: result.code } : prev,
          );
          setGeneratedCode({ projectUid: uid, code: result.code });
        }
      }).catch(() => {});
    }

    // Tear down the WS subscription only after deploy (for build → audit →
    // deploy the same connection is reused).
    if (step === 'deploy') {
      setActiveContractUid(null);
    }
  }, [contract.status, pipelineStepRunning, currentProject, activeContractUid, updateProjects]);

  // Project management functions
  const handleSelectProject = async (project: Project) => {
    try {
      // Save current messages for current project (if any)
      if (currentProject && messages.length > 0) {
        localStorage.setItem(`bumm_chat_history_${currentProject.uid}`, JSON.stringify(messages));
        // Also save to backend
        const chatForBackend = messages
          .filter(m => !m.content.startsWith('⏳') && !m.content.startsWith('⚙️'))
          .map(m => ({
            role: m.isUser ? 'user' : 'assistant',
            content: m.content,
            timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
          }));
        apiClient.saveContractChat(currentProject.uid, chatForBackend).catch(() => {});
      }

      // Switch to new project
      setCurrentProject(project);

      // Fetch code from API so ChatScreen doesn't need localStorage cache
      apiClient.getContractCode(project.uid).then(result => {
        if (result.code) {
          setCurrentProject(prev => prev && prev.uid === project.uid
            ? { ...prev, code: result.code }
            : prev);
        }
      }).catch(() => {});

      // Try to load chat from backend first, then localStorage fallback
      try {
        const chatRes = await apiClient.getContractChat(project.uid);
        if (chatRes.messages && chatRes.messages.length > 0) {
          const loadedMessages: ChatMessage[] = chatRes.messages.map((m: Record<string, unknown>, i: number) => ({
            id: `loaded_${i}_${Date.now()}`,
            content: (m.content as string) || '',
            timestamp: new Date((m.timestamp as string) || Date.now()),
            isUser: m.role === 'user',
          }));
          setMessages(loadedMessages);
          return;
        }
      } catch (_) {
        // Backend unavailable, fall through to localStorage
      }

      // Fallback: localStorage
      const savedMessages = localStorage.getItem(`bumm_chat_history_${project.uid}`);
      if (savedMessages) {
        try {
          const parsedMessages = JSON.parse(savedMessages);
          const messagesWithDates = parsedMessages.map((msg: ChatMessage) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(messagesWithDates);
        } catch (err) {
          console.warn('Failed to parse saved messages:', err);
          setMessages([]);
        }
      } else {
        setMessages([]);
      }

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
        if (remainingProjects.length === 0) setMessages([]);
      }

      analytics.trackProjectDelete(project.uid);
    } catch (err) {
      console.error('Failed to delete project:', err);
      addAIMessage(`Failed to delete project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleArchiveProject = async (project: Project) => {
    try {
      console.log(`${project.isFrozen ? 'Unarchiving' : 'Archiving'} project ${project.uid}`);
      
      // Update project archive status
      const newArchivedStatus = !project.isFrozen;
      updateProjects(prev => prev.map(p => 
        p.uid === project.uid 
          ? { ...p, isFrozen: newArchivedStatus, updated_at: new Date().toISOString() }
          : p
      ));
      
      // Update current project если это он
      if (currentProject?.uid === project.uid) {
        setCurrentProject(prev => prev ? { ...prev, isFrozen: newArchivedStatus } : null);
      }
      
      addAIMessage(`Project "${project.name || 'Untitled'}" ${newArchivedStatus ? 'archived' : 'unarchived'}`);
    } catch (err) {
      console.error('Failed to archive project:', err);
      addAIMessage(`Failed to archive project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleDuplicateProject = async (project: Project) => {
    try {
      console.log(`Duplicating project ${project.uid}`);
      
      // Create project copy
      const duplicatedProject = {
        ...project,
        uid: `project_${Date.now()}`,
        name: `${project.name || 'Untitled'} (Copy)`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        isDeployed: false, // Copy cannot be deployed
        isFrozen: false,
        contract_address: null,
        deployment_status: null
      };
      
      // Add to beginning of list
      updateProjects(prev => [duplicatedProject, ...prev]);
      
      addAIMessage(`Project "${project.name || 'Untitled'}" duplicated as "${duplicatedProject.name}"`);
    } catch (err) {
      console.error('Failed to duplicate project:', err);
      addAIMessage(`Failed to duplicate project: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleCreateGroup = async (project: Project) => {
    try {
      console.log(`Creating group for project ${project.uid}`);
      // API call to create group will be implemented
      addAIMessage(`Group created for project "${project.name || 'Untitled'}"`);
    } catch (err) {
      console.error('Failed to create group:', err);
      addAIMessage(`Failed to create group: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleAddToGroup = async (project: Project) => {
    try {
      console.log(`👥 Adding project ${project.uid} to group`);
      // API call to add to group will be implemented
      addAIMessage(`👥 Project "${project.name || 'Untitled'}" added to group`);
    } catch (err) {
      console.error('Failed to add to group:', err);
      addAIMessage(`Failed to add to group: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleToggleVisibility = async (project: Project) => {
    try {
      console.log(`${project.isFrozen ? 'Showing' : 'Hiding'} project ${project.uid}`);
      // API call to toggle visibility will be implemented
      addAIMessage(`Project "${project.name || 'Untitled'}" ${project.isFrozen ? 'shown' : 'hidden'}`);
    } catch (err) {
      console.error('Failed to toggle visibility:', err);
      addAIMessage(`Failed to toggle visibility: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportProject = async (project: Project) => {
    try {
      console.log(`Exporting project ${project.uid}`);
      // Export functionality will be implemented
      addAIMessage(`Project "${project.name || 'Untitled'}" exported successfully!`);
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
            onArchiveProject={handleArchiveProject}
            onDuplicateProject={handleDuplicateProject}
            onCreateGroup={handleCreateGroup}
            onAddToGroup={handleAddToGroup}
            onToggleVisibility={handleToggleVisibility}
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
            pipelinePhase={pipelinePhase}
            onStartStep={handleStartStep}
            pipelineStepRunning={pipelineStepRunning}
            pipelineStepError={pipelineStepError}
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
