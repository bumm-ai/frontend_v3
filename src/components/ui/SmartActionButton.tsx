'use client';

import { motion } from 'framer-motion';
import { Rocket, Eye, Loader2, RefreshCw, Shield } from 'lucide-react';
import { ActionButtonState } from '@/types/dashboard';
import { DeployedContractMenu } from './DeployedContractMenu';
import { OperationCost } from './OperationCost';

interface SmartActionButtonProps {
  state: ActionButtonState;
  onClick: () => void;
  disabled?: boolean;
  isDeployed?: boolean;
  contractAddress?: string;
  isFrozen?: boolean;
  onContractFreeze?: () => void;
}

export const SmartActionButton = ({ 
  state, 
  onClick, 
  disabled = false, 
  isDeployed = false,
  contractAddress,
  isFrozen = false,
  onContractFreeze
}: SmartActionButtonProps) => {
  const getButtonConfig = () => {
    switch (state) {
      case 'inactive':
        return {
          text: 'Publish',
          icon: Rocket,
          className: 'bg-[#FE4A01]/40 text-[#FE4A01]/60 cursor-not-allowed',
          disabled: true
        };
      case 'review':
        return {
          text: 'Review',
          icon: Eye,
          className: 'bg-blue-600 text-white hover:bg-blue-700',
          disabled: false
        };
      case 'build':
        return {
          text: 'Build',
          icon: Rocket,
          className: 'bg-yellow-600 text-white hover:bg-yellow-700',
          disabled: false
        };
      case 'building':
        return {
          text: 'Building',
          icon: Loader2,
          className: 'bg-yellow-600/40 text-yellow-600/80 cursor-not-allowed',
          disabled: true
        };
      case 'audit':
        return {
          text: 'Audit',
          icon: Shield,
          className: 'bg-blue-600 text-white hover:bg-blue-700',
          disabled: false
        };
      case 'publish':
        return {
          text: 'Publish',
          icon: Rocket,
          className: 'bg-[#FE4A01] text-white hover:bg-[#FE4A01]',
          disabled: false
        };
      case 'publishing':
        return {
          text: 'Publishing',
          icon: Loader2,
          className: 'bg-[#FE4A01]/40 text-[#FE4A01]/80 cursor-not-allowed',
          disabled: true
        };
      case 'upgrade':
        return {
          text: 'Upgrade',
          icon: RefreshCw,
          className: 'bg-blue-600 text-white hover:bg-blue-700',
          disabled: false
        };
      default:
        return {
          text: 'Publish',
          icon: Rocket,
          className: 'bg-[#FE4A01]/40 text-[#FE4A01]/60 cursor-not-allowed',
          disabled: true
        };
    }
  };

  const config = getButtonConfig();
  const Icon = config.icon;
  const isDisabled = disabled || config.disabled;

  const handleContractAction = (action: string) => {
    console.log(`Contract action: ${action} for ${contractAddress}`);
    if (action === 'freeze' && onContractFreeze) {
      onContractFreeze();
    }
    // Here you can add logic for each action
  };

  const getOperationType = (state: ActionButtonState): 'generate' | 'audit' | 'build' | 'deploy' | 'chat' | 'upgrade' | null => {
    switch (state) {
      case 'review': return 'audit';
      case 'build': return 'build';
      case 'publish': return 'deploy';
      case 'upgrade': return 'upgrade';
      default: return null;
    }
  };

  const operationType = getOperationType(state);

  return (
    <div className="flex items-center gap-2">
      {/* Стоимость операции слева */}
      {operationType && (
        <OperationCost 
          operationType={operationType} 
          className="text-left"
        />
      )}
      
      <motion.button
        onClick={isDisabled ? undefined : onClick}
        className={`
          flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-all
          ${config.className}
          ${isDisabled ? '' : 'active:scale-95'}
        `}
        style={{
          width: '90px',
          height: '32px',
          boxShadow: state === 'publish' || state === 'review' ? '0px 1px 2px rgba(0, 0, 0, 0.05)' : 'none'
        }}
        whileHover={isDisabled ? {} : { scale: 1.02 }}
        whileTap={isDisabled ? {} : { scale: 0.98 }}
        disabled={isDisabled}
      >
        <Icon 
          className={`w-4 h-4 ${state === 'publishing' ? 'animate-spin' : ''}`} 
        />
        {config.text}
      </motion.button>

      {/* Menu действий с задеплоенным контрактом */}
      <DeployedContractMenu
        isDeployed={isDeployed}
        contractAddress={contractAddress}
        onSignature={() => handleContractAction('signature')}
        onFreeze={() => handleContractAction('freeze')}
        onOwnership={() => handleContractAction('ownership')}
        onDestroy={() => handleContractAction('destroy')}
      />
    </div>
  );
};
