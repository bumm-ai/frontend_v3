'use client';

import { useCredits } from '@/hooks/useCredits';

interface OperationCostProps {
  operationType: 'generate' | 'audit' | 'build' | 'deploy' | 'chat' | 'upgrade';
  className?: string;
}

export const OperationCost = ({ operationType, className = '' }: OperationCostProps) => {
  const { getOperationCost, hasEnoughCredits } = useCredits();
  
  const cost = getOperationCost(operationType);
  const hasEnough = hasEnoughCredits(operationType);

  if (cost === 0) return null;

  return (
    <div className={`flex items-center gap-1 text-xs ${className}`}>
      <span className={`${hasEnough ? 'text-green-400' : 'text-red-400'}`}>
        {hasEnough ? '✓' : '✗'}
      </span>
      <span className="text-gray-300 font-medium">
        {cost > 0 ? `${cost} credits` : 'Free'}
      </span>
    </div>
  );
};
