'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User as UserIcon, Code } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { HeaderWalletButton } from '../ui/HeaderWalletButton';
import { HeaderCreditsButton } from '../ui/HeaderCreditsButton';
import { Navigation } from '../ui/Navigation';
import { InfoPanel } from '../ui/InfoPanel';
import { DashboardFooter } from '../ui/DashboardFooter';
import { InteractiveCodeEditor } from '../ui/InteractiveCodeEditor';
import { SmartActionButton } from '../ui/SmartActionButton';
import { DeployModal } from '../ui/DeployModal';
import { BuildModal } from '../ui/BuildModal';
import { AuditModal } from '../ui/AuditModal';
import { ChatMessage, CodeSource, ActionButtonState, Project, User } from '@/types/dashboard';
import { isGenerationCommand } from '@/utils/generationCommands';

interface ChatScreenProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, currentContractCode?: string) => void;
  onAddAIMessage: (message: string) => void;
  onBuild: (code: string) => void;
  onDeploy: (code: string) => Promise<string | undefined>;
  onGenerateContract?: (description: string) => Promise<Project>;
  onCreateProject?: (name: string) => Promise<Project>;
  onCreateNew?: () => void;
  onSelectProject?: (project: Project) => void;
  onRenameProject?: (project: Project, newName: string) => void;
  onDeleteProject?: (project: Project) => void;
  onArchiveProject?: (project: Project) => void;
  onDuplicateProject?: (project: Project) => void;
  onCreateGroup?: (project: Project) => void;
  onAddToGroup?: (project: Project) => void;
  onToggleVisibility?: (project: Project) => void;
  onExportProject?: (project: Project) => void;
  isBuilding?: boolean;
  currentProject?: Project | null;
  user?: User | null;
  projects?: Project[];
  isLoading?: boolean;
  error?: string | null;
  generatedCode?: { projectUid: string; code: string } | null;
  onGeneratedCodeApplied?: () => void;
  generationAttemptFailed?: number;
  pipelinePhase?: string | null;
}

export default function ChatScreen({ 
  messages, 
  onSendMessage, 
  onAddAIMessage,
  onBuild, 
  onDeploy, 
  onGenerateContract,
  onCreateProject,
  onCreateNew,
  onSelectProject,
  onRenameProject,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onCreateGroup,
  onAddToGroup,
  onToggleVisibility,
  onExportProject,
  isBuilding = false,
  currentProject,
  user,
  projects = [],
  isLoading = false,
  error,
  generatedCode,
  onGeneratedCodeApplied,
  generationAttemptFailed = 0,
  pipelinePhase,
}: ChatScreenProps) {
  const [inputValue, setInputValue] = useState('');
  const [mobileActiveTab, setMobileActiveTab] = useState<'chat' | 'code' | 'network'>('chat');
  const messagesEndRefDesktop = useRef<HTMLDivElement>(null);
  const messagesEndRefMobile = useRef<HTMLDivElement>(null);

  // Function for smooth scrolling to bottom - only within chat
  const scrollToBottom = () => {
    // Try to scroll to desktop anchor
    if (messagesEndRefDesktop.current) {
      const chatContainer = messagesEndRefDesktop.current.closest('.overflow-y-auto') as HTMLElement;
      if (chatContainer) {
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
    // Try to scroll to mobile anchor
    if (messagesEndRefMobile.current) {
      const chatContainer = messagesEndRefMobile.current.closest('.overflow-y-auto') as HTMLElement;
      if (chatContainer) {
        chatContainer.scrollTo({
          top: chatContainer.scrollHeight,
          behavior: 'smooth'
        });
      }
    }
  };

  // useEffect сработает каждый раз, когда массив `messages` обновится
  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  const [contractCode, setContractCode] = useState(() => {
    // Load contract code for current project from localStorage
    if (typeof window !== 'undefined' && currentProject) {
      try {
        const savedCode = localStorage.getItem(`bumm_contract_code_${currentProject.uid}`);
        return savedCode || '';
      } catch (err) {
        console.warn('Failed to load contract code from localStorage:', err);
        return '';
      }
    }
    return '';
  });
  const [actionButtonState, setActionButtonState] = useState<ActionButtonState>(() => {
    // Load button state from localStorage
    if (typeof window !== 'undefined') {
      try {
        const savedState = localStorage.getItem('bumm_action_button_state');
        return savedState ? savedState as ActionButtonState : 'inactive';
      } catch (err) {
        console.warn('Failed to load action button state from localStorage:', err);
        return 'inactive';
      }
    }
    return 'inactive';
  });
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [isBuildModalOpen, setIsBuildModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Derive animation flags from the live pipeline phase coming from Dashboard
  const isPipelineGenerating = pipelinePhase === 'generating' || pipelinePhase === 'enriching';
  const isPipelineBuilding   = pipelinePhase === 'building' || pipelinePhase === 'build_fixing';
  const isPipelineAuditing   = pipelinePhase === 'auditing_static' || pipelinePhase === 'auditing_llm' || pipelinePhase === 'audit_fixing';
  const isPipelineDeploying  = pipelinePhase === 'deploying';
  const [isContractDeployed, setIsContractDeployed] = useState(() => {
    if (typeof window !== 'undefined' && currentProject) {
      try {
        const saved = localStorage.getItem(`bumm_contract_deployed_${currentProject.uid}`);
        return saved === 'true';
      } catch (err) {
        return false;
      }
    }
    return false;
  });
  const [deployedContractAddress, setDeployedContractAddress] = useState<string | undefined>(() => {
    if (typeof window !== 'undefined' && currentProject) {
      try {
        const saved = localStorage.getItem(`bumm_deployed_contract_address_${currentProject.uid}`);
        return saved || undefined;
      } catch (err) {
        return undefined;
      }
    }
    return undefined;
  });
  const [contractIsFrozen, setContractIsFrozen] = useState(false);
  const [deploymentDate, setDeploymentDate] = useState<Date | undefined>(() => {
    if (typeof window !== 'undefined' && currentProject) {
      try {
        const saved = localStorage.getItem(`bumm_deployment_date_${currentProject.uid}`);
        return saved ? new Date(saved) : undefined;
      } catch (err) {
        return undefined;
      }
    }
    return undefined;
  });
  const [lastUpdateDate, setLastUpdateDate] = useState<Date | undefined>(() => {
    if (typeof window !== 'undefined' && currentProject) {
      try {
        const saved = localStorage.getItem(`bumm_last_update_date_${currentProject.uid}`);
        return saved ? new Date(saved) : undefined;
      } catch (err) {
        return undefined;
      }
    }
    return undefined;
  });

  // Save contract code for current project to localStorage on change
  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject && contractCode) {
      try {
        localStorage.setItem(`bumm_contract_code_${currentProject.uid}`, contractCode);
      } catch (err) {
        console.warn('Failed to save contract code to localStorage:', err);
      }
    }
  }, [contractCode, currentProject]);

  // Load all project states when switching projects
  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject) {
      try {
        // Load contract code
        const savedCode = localStorage.getItem(`bumm_contract_code_${currentProject.uid}`);
        setContractCode(savedCode || '');
        
        // Load deployment state
        const savedDeployed = localStorage.getItem(`bumm_contract_deployed_${currentProject.uid}`);
        setIsContractDeployed(savedDeployed === 'true');
        
        // Load contract address
        const savedAddress = localStorage.getItem(`bumm_deployed_contract_address_${currentProject.uid}`);
        setDeployedContractAddress(savedAddress || undefined);
        
        // Load dates
        const savedDeploymentDate = localStorage.getItem(`bumm_deployment_date_${currentProject.uid}`);
        setDeploymentDate(savedDeploymentDate ? new Date(savedDeploymentDate) : undefined);
        
        const savedUpdateDate = localStorage.getItem(`bumm_last_update_date_${currentProject.uid}`);
        setLastUpdateDate(savedUpdateDate ? new Date(savedUpdateDate) : undefined);
        
        // Update button state: per-project saved state takes priority over heuristic
        const savedButtonState = localStorage.getItem(`bumm_action_button_state_${currentProject.uid}`);
        const validStates: ActionButtonState[] = ['build', 'audit', 'publish', 'upgrade', 'review', 'inactive'];
        if (savedButtonState && validStates.includes(savedButtonState as ActionButtonState)) {
          setActionButtonState(savedButtonState as ActionButtonState);
        } else if (savedCode && savedCode.trim()) {
          if (savedDeployed === 'true') {
            setActionButtonState('upgrade');
          } else {
            setActionButtonState('review');
          }
        } else {
          setActionButtonState('inactive');
        }
      } catch (err) {
        console.warn('Failed to load project states:', err);
        // Reset all states on error
        setContractCode('');
        setActionButtonState('inactive');
        setIsContractDeployed(false);
        setDeployedContractAddress(undefined);
        setDeploymentDate(undefined);
        setLastUpdateDate(undefined);
      }
    } else if (!currentProject) {
      // If no project, clear all states
      setContractCode('');
      setActionButtonState('inactive');
      setIsContractDeployed(false);
      setDeployedContractAddress(undefined);
      setDeploymentDate(undefined);
      setLastUpdateDate(undefined);
    }
  }, [currentProject]);

  // Save action button state to localStorage (global + per-project)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('bumm_action_button_state', actionButtonState);
        if (currentProject) {
          localStorage.setItem(`bumm_action_button_state_${currentProject.uid}`, actionButtonState);
        }
      } catch (err) {
        console.warn('Failed to save action button state to localStorage:', err);
      }
    }
  }, [actionButtonState, currentProject]);

  // Save deployment state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject) {
      try {
        localStorage.setItem(`bumm_contract_deployed_${currentProject.uid}`, isContractDeployed.toString());
      } catch (err) {
        console.warn('Failed to save deployment state to localStorage:', err);
      }
    }
  }, [isContractDeployed, currentProject]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject && deployedContractAddress) {
      try {
        localStorage.setItem(`bumm_deployed_contract_address_${currentProject.uid}`, deployedContractAddress);
      } catch (err) {
        console.warn('Failed to save contract address to localStorage:', err);
      }
    }
  }, [deployedContractAddress, currentProject]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject && deploymentDate) {
      try {
        localStorage.setItem(`bumm_deployment_date_${currentProject.uid}`, deploymentDate.toISOString());
      } catch (err) {
        console.warn('Failed to save deployment date to localStorage:', err);
      }
    }
  }, [deploymentDate, currentProject]);

  useEffect(() => {
    if (typeof window !== 'undefined' && currentProject && lastUpdateDate) {
      try {
        localStorage.setItem(`bumm_last_update_date_${currentProject.uid}`, lastUpdateDate.toISOString());
      } catch (err) {
        console.warn('Failed to save last update date to localStorage:', err);
      }
    }
  }, [lastUpdateDate, currentProject]);

  // Sync deployed address from parent (when deploy completes from Dashboard)
  useEffect(() => {
    if (currentProject?.contractAddress) {
      setDeployedContractAddress(currentProject.contractAddress);
      setIsContractDeployed(true);
    }
  }, [currentProject?.contractAddress]);

  // Apply real generated code from API (no demo templates)
  useEffect(() => {
    if (generatedCode && generatedCode.projectUid === currentProject?.uid && generatedCode.code) {
      setContractCode(generatedCode.code);
      setIsGenerating(false);
      setActionButtonState('build'); // Build → Audit → Publish flow
      onGeneratedCodeApplied?.();
    }
  }, [generatedCode, currentProject?.uid, onGeneratedCodeApplied]);

  // Clear loading state when generation fails (e.g. timeout)
  useEffect(() => {
    if (generationAttemptFailed > 0) {
      setIsGenerating(false);
    }
  }, [generationAttemptFailed]);

  const handleSend = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim(), contractCode);
      setInputValue('');
      
      // Check generation commands and start animation
      const isGenerationCmd = isGenerationCommand(inputValue);
      
      if (isGenerationCmd && (!contractCode || contractCode.trim().length === 0)) {
        setIsGenerating(true);
      }
    }
  };


  const handleCodeChange = (code: string, source: CodeSource) => {
    setContractCode(code);
    
    if (code.trim() === '') {
      setActionButtonState('inactive');
    } else if (isContractDeployed && !contractIsFrozen) {
      // If contract is already deployed and not frozen, show Upgrade (even on manual change)
      setActionButtonState('upgrade');
    } else if (source === 'user-input') {
      // Only if contract is NOT deployed, manual change gives Review
      setActionButtonState('review');
    } else if (source === 'ai-generated') {
      // AI-generated code - don't set state here,
      // it will be set in handleGenerationComplete after generation completion
      // setActionButtonState('build'); // Removed - will be set after generation completion
    } else {
      setActionButtonState('publish');
    }
  };



  const handleGenerationComplete = () => {
    setIsGenerating(false);
    setActionButtonState('build');
    
    // Remove duplicate message - it's added in Dashboard.tsx during real generation
    onAddAIMessage("Smart contract generated successfully! The contract is ready for building and testing.");
  };

  const handleActionClick = async () => {
    if (actionButtonState === 'review') {
      // Code is ready for building — open Build modal directly (no demo simulation)
      setIsBuildModalOpen(true);
    } else if (actionButtonState === 'build') {
      // Open build modal
      setIsBuildModalOpen(true);
    } else if (actionButtonState === 'audit') {
      // Open audit modal
      setIsAuditModalOpen(true);
    } else if (actionButtonState === 'publish') {
      // Open deploy modal
      setIsDeployModalOpen(true);
    } else if (actionButtonState === 'upgrade') {
      // Contract upgrade - update lastUpdateDate
      setLastUpdateDate(new Date());
      setIsDeployModalOpen(true);
    }
  };

  const handleBuildComplete = () => {
    // After successful build show Audit button and open Audit modal (do NOT start another build)
    setActionButtonState('audit');
    setIsBuildModalOpen(false);
    setIsAuditModalOpen(true);
  };

  const handleAuditClick = () => {
    setIsAuditModalOpen(true);
  };

  const handleAuditComplete = (applyPatches: boolean) => {
    setIsAuditModalOpen(false);
    
    if (applyPatches) {
      // If applying patches, return to build for rebuild
      setActionButtonState('build');
      onAddAIMessage('🔧 Security patches applied! Please rebuild the contract.');
    } else {
      // If not applying patches, go to publish
    if (isContractDeployed && !contractIsFrozen) {
      setActionButtonState('upgrade');
    } else {
      setActionButtonState('publish');
    }
      onAddAIMessage('Audit completed! Contract is ready for deployment.');
    }
  };

  const handleBuildModalClose = () => {
    setIsBuildModalOpen(false);
  };

  const handleDeployComplete = (address?: string) => {
    const now = new Date();
    setIsContractDeployed(true);
    setDeployedContractAddress(address ?? '');
    setDeploymentDate(now);
    setLastUpdateDate(now);
    setActionButtonState('upgrade');
    setIsDeployModalOpen(false);
  };

  const handleContractFreeze = () => {
    setContractIsFrozen(true);
    setActionButtonState('publish'); // After freeze return to Publish for new contracts
  };

  const handleDeployModalClose = () => {
    setIsDeployModalOpen(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div 
      className="flex flex-col w-full h-screen bg-[#0C0C0C]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <header className="h-[48px] border-b border-[#191919] flex items-center justify-between px-3 md:px-6 flex-shrink-0">
        <div className="flex items-center gap-8">
          <motion.button
            onClick={() => window.location.href = '/'}
            className="group flex items-center gap-1.5"
            whileHover={{ scale: 1.02, y: -1 }}
            whileTap={{ scale: 0.98 }}
          >
            {/* SVG Логотип */}
            <svg width="90" height="20" viewBox="0 0 267 59" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-5">
              <path d="M104.795 35.1355C104.795 30.6792 100.088 28.6266 96.1319 28.6266C89.9736 28.6266 86.1178 31.831 86.1178 36.337C86.1178 40.7933 90.8246 42.8962 94.7302 42.8962C100.889 42.8962 104.795 39.6415 104.795 35.1355ZM84.2151 41.3441H83.3641L82.7133 48.454H74.8518L83.6146 13.4047H91.4754L89.6231 20.7651C88.7721 24.1193 87.2193 27.0738 86.0675 29.1767H86.9185C89.6231 24.6707 93.4285 22.367 99.6869 22.367C106.547 22.367 112.655 26.423 112.655 33.8338C112.655 42.2958 106.497 49.1055 96.4328 49.1055C90.7245 49.1055 85.6671 46.6023 84.2151 41.3441Z" fill="#E34B13"/>
              <path d="M119.912 33.533L122.517 23.0185H130.378L128.024 32.682C126.572 38.6904 129.276 42.4953 134.884 42.4953C139.991 42.4953 143.346 39.7416 144.547 34.8346L147.501 23.0185H155.364L149.054 48.454H141.143L144.047 41.5946H143.196C140.692 46.4512 136.937 49.1055 130.728 49.1055C122.767 49.1055 117.509 43.2966 119.912 33.533Z" fill="#E34B13"/>
              <path d="M157.112 48.4531L163.421 23.0176H171.283L168.879 28.7252H169.729C172.084 24.4187 175.087 22.3661 179.794 22.3661C185.853 22.3661 188.606 25.8714 189.158 29.2256H189.859C192.312 24.4187 195.566 22.3661 200.172 22.3661C207.334 22.3661 211.289 27.5733 209.336 35.4851L206.083 48.4531H198.22L201.225 36.2864C202.377 31.679 200.024 29.026 196.167 29.026C192.212 29.026 189.758 31.3794 188.908 34.9847L185.552 48.4531H177.641L180.646 36.2864C181.798 31.679 179.444 29.026 175.588 29.026C171.682 29.026 169.23 31.3794 168.328 34.9847L164.973 48.4531H157.112Z" fill="#E34B13"/>
              <path d="M213.888 48.4531L220.197 23.0176H228.057L225.654 28.7252H226.506C228.858 24.4187 231.863 22.3661 236.57 22.3661C242.629 22.3661 245.383 25.8714 245.933 29.2256H246.635C249.088 24.4187 252.342 22.3661 256.95 22.3661C264.109 22.3661 268.066 27.5733 266.113 35.4851L262.857 48.4531H254.996L258.001 36.2864C259.152 31.679 256.798 29.026 252.944 29.026C248.987 29.026 246.534 31.3794 245.683 34.9847L242.328 48.4531H234.418L237.422 36.2864C238.572 31.679 236.22 29.026 232.365 29.026C228.459 29.026 226.005 31.3794 225.104 34.9847L221.748 48.4531H213.888Z" fill="#E34B13"/>
              <path d="M42.3199 22.3857L71.1428 22.4459C71.6481 22.4471 71.731 23.171 71.2392 23.2858L37.747 31.1153C31.4641 32.584 25.4593 36.457 22.0572 41.014L9.20773 58.2259C8.91854 58.6139 8.30947 58.2952 8.46358 57.8366L14.0779 41.0822C15.4593 36.9599 14.0017 34.006 10.6359 33.5381L0.366965 32.11C-0.0806303 32.048 -0.135273 31.4229 0.294517 31.2836L14.3038 26.7487C18.6656 25.3371 23.6738 21.6336 26.7603 17.3977L39.3065 0.17723C39.5883 -0.208966 40.1949 0.0906602 40.0586 0.549307L35.6361 15.4163C34.3922 19.5976 36.8481 22.374 42.3199 22.3857Z" fill="#E34B13"/>
            </svg>
          </motion.button>
          
          <Navigation currentPage="vibe" />
        </div>
        
        <div className="flex items-center gap-3">
          <HeaderCreditsButton />
          <HeaderWalletButton />
        </div>
      </header>
      
      {/* Mobile Tabs - только на мобильных */}
      <div className="md:hidden h-[40px] bg-[#191919] border-b border-[#333] flex flex-shrink-0">
        <button 
          onClick={() => setMobileActiveTab('chat')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            mobileActiveTab === 'chat' 
              ? 'text-orange-500 bg-orange-500/10' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Bot className="w-3.5 h-3.5" />
          AI Chat
        </button>
        <button 
          onClick={() => setMobileActiveTab('code')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            mobileActiveTab === 'code' 
              ? 'text-orange-500 bg-orange-500/10' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <Code className="w-3.5 h-3.5" />
          Contract
        </button>
        <button 
          onClick={() => setMobileActiveTab('network')}
          className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium transition-colors ${
            mobileActiveTab === 'network' 
              ? 'text-orange-500 bg-orange-500/10' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 7L12 12L22 7L12 2Z"/>
            <path d="M2 17L12 22L22 17"/>
            <path d="M2 12L12 17L22 12"/>
          </svg>
          Network
        </button>
      </div>
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* Desktop Layout - Flexbox для правильного позиционирования */}
        <div className="hidden md:flex flex-1 gap-1 p-2">
          {/* Left Panel - AI Agent Chat (40%) */}
          <div className="w-[calc(40%-1px)] flex flex-col bg-[#0C0C0C] border border-[#333] rounded">
        {/* Fixed Header */}
            <div className="p-3 pb-0 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-white text-sm font-semibold mb-2">
            <Bot className="w-4 h-4 text-orange-500" />
            AI Agent Chat
          </div>
        </div>
        
        {/* Scrollable Messages - flex-1 to fill available space */}
            <div className="flex-1 px-3 overflow-y-auto space-y-3 min-h-0">
          <AnimatePresence>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex gap-2 ${message.isUser ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  message.isUser 
                    ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                    : 'bg-[#191919]'
                }`}>
                  {message.isUser ? (
                    <UserIcon className="w-3 h-3 text-white" />
                  ) : (
                    <Bot className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className={`flex-1 max-w-[85%] ${message.isUser ? 'text-right' : ''}`}>
                  <div className={`rounded p-2 ${
                    message.isUser
                      ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30'
                      : 'bg-[#191919] border border-[#333]'
                  }`}>
                    <div className="text-white text-xs leading-relaxed">{message.content}</div>
                    {message.codeSnippet && (
                      <div className="mt-1.5 bg-black/50 rounded p-1.5 font-mono text-xs text-green-400">
                        {message.codeSnippet}
                      </div>
                    )}
                  </div>
                  <div className="text-xs text-[#666] mt-0.5">
                    {message.timestamp instanceof Date 
                      ? message.timestamp.toLocaleTimeString() 
                      : new Date(message.timestamp).toLocaleTimeString()
                    }
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          
          {/* Этот пустой div является "якорем", к которому мы всегда скроллим */}
          <div ref={messagesEndRefDesktop} />
          
          {messages.length === 0 && (
            <div className="text-center text-[#666] py-12">
              <Bot className="w-12 h-12 mx-auto mb-4 text-[#333]" />
              <p>Start a conversation with AI agents to build your smart contract</p>
            </div>
          )}
        </div>
        
            {/* Fixed Input - sticky at bottom */}
            <div className="border-t border-[#191919] bg-[#0C0C0C] flex-shrink-0">
              <div className="px-3 pt-2 pb-2 h-14 flex items-center">
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Describe your smart contract requirements..."
              className="flex-1 px-3 py-2 bg-[#191919] border border-[#333] rounded text-white placeholder-[#666] text-xs focus:outline-none focus:border-orange-500 transition-colors"
            />
            <motion.button
              onClick={handleSend}
              disabled={!inputValue.trim()}
              className="px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Send className="w-3.5 h-3.5" />
            </motion.button>
            </div>
          </div>
        </div>
      </div>
      
          {/* Center Panel - Smart Contract Preview (40%) */}
          <div className="w-[calc(40%-1px)] flex flex-col bg-[#0A0A0A] border border-[#333] rounded">
        {/* Fixed Header */}
            <div className="p-3 pb-0 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-white text-sm font-semibold mb-2">
            <Code className="w-4 h-4 text-orange-500" />
            Smart Contract Preview
          </div>
        </div>
        
            {/* Interactive Code Area - flex-1 to fill space */}
            <div className="flex-1 p-3 min-h-0">
            <InteractiveCodeEditor
              initialCode={contractCode}
              onCodeChange={handleCodeChange}
              isGenerating={isGenerating || isPipelineGenerating}
              isBuilding={isPipelineBuilding}
              isAuditing={isPipelineAuditing}
              isDeploying={isPipelineDeploying}
              onGenerationComplete={handleGenerationComplete}
              onAddAIMessage={onAddAIMessage}
              placeholder="Paste your smart contract here or chat with AI to generate one..."
              useRealApi
            />
        </div>
        
            {/* Fixed Bottom Section */}
            <div className="px-3 pt-2 pb-2 border-t border-[#191919] bg-[#0A0A0A] flex-shrink-0 h-14 flex items-center">
          <div className="flex items-center justify-between w-full">
            {/* Contract Info or Default Text */}
            <div className="text-[#989898] text-xs flex-1">
              {isContractDeployed && deploymentDate && lastUpdateDate && deployedContractAddress ? (
                <div className="space-y-0.5" style={{ fontSize: '9px', lineHeight: '1.2' }}>
                  <div>Published: {deploymentDate.toLocaleDateString('en-GB')} {deploymentDate.toLocaleTimeString('en-GB')}</div>
                  <div>Last Update: {lastUpdateDate.toLocaleDateString('en-GB')} {lastUpdateDate.toLocaleTimeString('en-GB')}</div>
                  <div>Address: <a href={`https://explorer.solana.com/address/${deployedContractAddress}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline truncate max-w-[120px] inline-block align-bottom" title={deployedContractAddress}>{deployedContractAddress}</a></div>
                </div>
              ) : (
                <div>This preview updates as you chat with AI agents</div>
              )}
            </div>
            
            {/* Smart Action Button */}
            <div className="ml-4">
              <SmartActionButton 
                state={actionButtonState}
                onClick={handleActionClick}
                disabled={isBuilding}
                isDeployed={isContractDeployed}
                contractAddress={deployedContractAddress}
                isFrozen={contractIsFrozen}
                onContractFreeze={handleContractFreeze}
              />
            </div>
          </div>
        </div>
      </div>
      
          {/* Right Panel - Network Panel (20%) */}
          <div className="w-[calc(20%-1px)] flex flex-col">
            <InfoPanel 
              projects={projects}
              onSelectProject={onSelectProject}
              selectedProject={currentProject}
              isLoading={isLoading}
              onCreateNew={onCreateNew}
              onRenameProject={onRenameProject}
              onDeleteProject={onDeleteProject}
              onArchiveProject={onArchiveProject}
              onDuplicateProject={onDuplicateProject}
              onCreateGroup={onCreateGroup}
              onAddToGroup={onAddToGroup}
              onToggleVisibility={onToggleVisibility}
              onExportProject={onExportProject}
            />
          </div>
        </div>
        
        {/* Mobile Layout - абсолютное позиционирование для мобильных */}
        <div className="md:hidden flex-1 relative">
          {/* AI Agent Chat - мобильная версия */}
          <div className={`absolute inset-0 flex flex-col bg-[#0C0C0C] border border-[#333] rounded ${
            mobileActiveTab === 'chat' ? 'block' : 'hidden'
          }`}>
            {/* Fixed Header */}
            <div className="p-2 pb-0 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-white text-sm font-semibold mb-2">
                <Bot className="w-4 h-4 text-orange-500" />
                AI Agent Chat
              </div>
            </div>
            
            {/* Scrollable Messages */}
            <div className="flex-1 px-2 overflow-y-auto space-y-3 min-h-0">
              <AnimatePresence>
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className={`flex gap-2 ${message.isUser ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                      message.isUser 
                        ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                        : 'bg-[#191919]'
                    }`}>
                      {message.isUser ? (
                        <UserIcon className="w-3 h-3 text-white" />
                      ) : (
                        <Bot className="w-3 h-3 text-white" />
                      )}
                    </div>
                    <div className={`flex-1 max-w-[85%] ${message.isUser ? 'text-right' : ''}`}>
                      <div className={`rounded p-2 ${
                        message.isUser
                          ? 'bg-gradient-to-r from-orange-500/20 to-red-500/20 border border-orange-500/30'
                          : 'bg-[#191919] border border-[#333]'
                      }`}>
                        <div className="text-white text-xs leading-relaxed">
                          {message.content}
                        </div>
                        <div className="text-xs text-[#666] mt-0.5">
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              
              {/* Этот пустой div является "якорем", к которому мы всегда скроллим */}
              <div ref={messagesEndRefMobile} />
            </div>
            
            {/* Input field */}
            <div className="px-2 pt-2 pb-2 h-14 flex items-center flex-shrink-0">
              <div className="flex gap-2 w-full">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Describe your smart contract requirements..."
                  className="flex-1 px-3 py-2 bg-[#191919] border border-[#333] rounded text-white placeholder-[#666] text-xs focus:outline-none focus:border-orange-500 transition-colors"
                />
                <motion.button
                  onClick={handleSend}
                  disabled={!inputValue.trim()}
                  className="px-3 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Send className="w-3.5 h-3.5" />
                </motion.button>
              </div>
            </div>
          </div>
          
          {/* Smart Contract Preview - мобильная версия */}
          <div className={`absolute inset-0 flex flex-col bg-[#0A0A0A] border border-[#333] rounded ${
            mobileActiveTab === 'code' ? 'block' : 'hidden'
          }`}>
            {/* Fixed Header */}
            <div className="p-2 pb-0 flex-shrink-0">
              <div className="flex items-center gap-1.5 text-white text-sm font-semibold mb-2">
                <Code className="w-4 h-4 text-orange-500" />
                Smart Contract Preview
              </div>
            </div>
            
            {/* Interactive Code Area */}
            <div className="flex-1 p-2 min-h-0">
              <InteractiveCodeEditor 
                initialCode={contractCode}
                onCodeChange={handleCodeChange}
                isGenerating={isGenerating}
                onGenerationComplete={handleGenerationComplete}
                onAddAIMessage={onAddAIMessage}
                placeholder="Paste your smart contract here or chat with AI to generate one..."
                useRealApi
              />
            </div>
            
            {/* Fixed Bottom Section */}
            <div className="px-2 pt-2 pb-2 border-t border-[#191919] bg-[#0A0A0A] flex-shrink-0 h-14 flex items-center">
              <div className="flex items-center justify-between w-full">
                <div className="text-[#989898] text-xs flex-1">
                  {isContractDeployed && deploymentDate && lastUpdateDate && deployedContractAddress ? (
                    <div className="space-y-0.5" style={{ fontSize: '9px', lineHeight: '1.2' }}>
                      <div>Published: {deploymentDate.toLocaleDateString('en-GB')} {deploymentDate.toLocaleTimeString('en-GB')}</div>
                      <div>Last Update: {lastUpdateDate.toLocaleDateString('en-GB')} {lastUpdateDate.toLocaleTimeString('en-GB')}</div>
                      <div>Address: <a href={`https://explorer.solana.com/address/${deployedContractAddress}?cluster=devnet`} target="_blank" rel="noopener noreferrer" className="text-orange-400 hover:underline truncate max-w-[120px] inline-block align-bottom" title={deployedContractAddress}>{deployedContractAddress}</a></div>
                    </div>
                  ) : (
                    <div>This preview updates as you chat with AI agents</div>
                  )}
                </div>
                
                <div className="ml-4">
                  <SmartActionButton 
                    state={actionButtonState}
                    onClick={handleActionClick}
                    disabled={isBuilding}
                    isDeployed={isContractDeployed}
                    contractAddress={deployedContractAddress}
                    isFrozen={contractIsFrozen}
                    onContractFreeze={handleContractFreeze}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Network Panel - мобильная версия */}
          <div className={`absolute inset-0 ${
            mobileActiveTab === 'network' ? 'block' : 'hidden'
        }`}>
        <InfoPanel 
          projects={projects}
          onSelectProject={onSelectProject}
          selectedProject={currentProject}
          isLoading={isLoading}
          onCreateNew={onCreateNew}
          onRenameProject={onRenameProject}
          onDeleteProject={onDeleteProject}
          onArchiveProject={onArchiveProject}
          onDuplicateProject={onDuplicateProject}
          onCreateGroup={onCreateGroup}
          onAddToGroup={onAddToGroup}
          onToggleVisibility={onToggleVisibility}
          onExportProject={onExportProject}
        />
          </div>
      </div>
      </div>
      
      <DashboardFooter />

      {/* Build Modal */}
      <BuildModal 
        isOpen={isBuildModalOpen}
        onClose={handleBuildModalClose}
        onComplete={handleBuildComplete}
        contractCode={contractCode}
        onAddMessage={onAddAIMessage}
        bummUid={currentProject?.bummUid}
      />

      {/* Deploy Modal */}
      <DeployModal 
        isOpen={isDeployModalOpen}
        onClose={handleDeployModalClose}
        onDeploy={onDeploy}
        onComplete={handleDeployComplete}
        contractCode={contractCode}
        network="devnet"
        bummUid={currentProject?.bummUid}
      />

      {/* Audit Modal */}
      <AuditModal 
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        onComplete={handleAuditComplete}
        contractCode={contractCode}
        onAddMessage={onAddAIMessage}
        messages={messages.map(msg => ({ ...msg }))}
        bummUid={currentProject?.bummUid}
      />
    </motion.div>
  );
}