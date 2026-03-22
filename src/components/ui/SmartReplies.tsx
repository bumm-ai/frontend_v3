'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Code, Rocket, Settings, Shield, Package } from 'lucide-react';
import { Project, ActionButtonState } from '@/types/dashboard';

interface SmartReply {
  id: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  message: string;
  category: 'quick' | 'context';
}

interface SmartRepliesProps {
  currentProject?: Project | null;
  actionButtonState: ActionButtonState;
  isContractDeployed: boolean;
  onSendMessage: (message: string, currentContractCode?: string) => void;
  currentContractCode?: string;
  className?: string;
}

export const SmartReplies = ({ 
  currentProject, 
  actionButtonState, 
  isContractDeployed,
  onSendMessage,
  currentContractCode,
  className = ""
}: SmartRepliesProps) => {
  
  // Determine contextual buttons based on state
  const getContextualReplies = (): SmartReply[] => {
    // When no project or project in initial state - show start buttons
    if (!currentProject || currentProject?.status === 'draft' || actionButtonState === 'inactive') {
      return [
        {
          id: 'create-defi-token',
          text: 'Create DeFi token',
          icon: Code,
          message: 'Create a DeFi token with minting, burning, and staking capabilities',
          category: 'context'
        },
        {
          id: 'build-nft-marketplace',
          text: 'Build NFT marketplace',
          icon: Package,
          message: 'Build an NFT marketplace with listing, buying, and selling features',
          category: 'context'
        },
        {
          id: 'make-dao-governance',
          text: 'Create DAO governance',
          icon: Settings,
          message: 'Create a DAO governance system with voting and proposal mechanisms',
          category: 'context'
        }
      ];
    }

    // After contract generation
    if (actionButtonState === 'build' || actionButtonState === 'review') {
      return [
        {
          id: 'add-more-features',
          text: 'Add more features',
          icon: Code,
          message: 'Add more features to this smart contract - what functionality would you like to include?',
          category: 'context'
        },
        {
          id: 'optimize-gas',
          text: 'Optimize for gas',
          icon: Zap,
          message: 'Optimize this contract for gas efficiency and reduce transaction costs',
          category: 'context'
        },
        {
          id: 'add-security',
          text: 'Add security checks',
          icon: Shield,
          message: 'Add security checks and access controls to this contract',
          category: 'context'
        }
      ];
    }

    // After Build/Audit
    if (actionButtonState === 'audit' || actionButtonState === 'publish') {
      return [
        {
          id: 'explain-code',
          text: 'Explain the code',
          icon: Code,
          message: 'Explain how this smart contract works and its main functions',
          category: 'context'
        },
        {
          id: 'add-documentation',
          text: 'Add documentation',
          icon: Package,
          message: 'Generate comprehensive documentation for this smart contract',
          category: 'context'
        },
        {
          id: 'create-tests',
          text: 'Create tests',
          icon: Settings,
          message: 'Create unit tests and integration tests for this contract',
          category: 'context'
        }
      ];
    }

    // After Deploy
    if (isContractDeployed) {
      return [
        {
          id: 'how-to-interact',
          text: 'How to interact?',
          icon: Code,
          message: 'How do I interact with this deployed contract? Show me examples',
          category: 'context'
        },
        {
          id: 'frontend-integration',
          text: 'Add frontend integration',
          icon: Package,
          message: 'Create a frontend interface to interact with this contract',
          category: 'context'
        },
        {
          id: 'monitor-transactions',
          text: 'Monitor transactions',
          icon: Settings,
          message: 'Set up monitoring and analytics for this deployed contract',
          category: 'context'
        }
      ];
    }

    return [];
  };

  const replies = getContextualReplies();

  const handleReplyClick = (reply: SmartReply) => {
    console.log('🔘 SmartReply clicked:', reply.text);
    // All SmartReplies buttons work as regular chat messages
    onSendMessage(reply.message, currentContractCode);
  };

  if (replies.length === 0) return null;

  return (
    <div className={`${className}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentProject?.uid}-${actionButtonState}-${isContractDeployed}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap gap-2 mb-3"
        >
          {replies.map((reply, index) => (
            <motion.button
              key={reply.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ 
                duration: 0.2, 
                delay: index * 0.1,
                type: "spring",
                stiffness: 300,
                damping: 20
              }}
              onClick={() => handleReplyClick(reply)}
              className="flex items-center gap-1.5 px-2 py-1 bg-[#111] hover:bg-[#191919] border border-[#333] hover:border-orange-500/30 rounded-md text-xs text-gray-400 hover:text-orange-300 transition-all duration-150 group"
            >
              <reply.icon className="w-2.5 h-2.5 text-orange-500 group-hover:text-orange-400" />
              <span>{reply.text}</span>
            </motion.button>
          ))}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
