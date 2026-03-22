'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, AlertTriangle } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';

interface InsufficientCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  operationType: string;
  requiredCredits: number;
}

export const InsufficientCreditsModal = ({ 
  isOpen, 
  onClose, 
  operationType, 
  requiredCredits 
}: InsufficientCreditsModalProps) => {
  const { balance, getOperationCost } = useCredits();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-[#0C0C0C] border border-[#333] rounded-lg w-full max-w-md mx-4"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-4 border-b border-[#333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              <h3 className="text-white font-semibold">Insufficient Credits</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#333] rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-8 h-8 text-red-400" />
              </div>
              
              <h4 className="text-lg font-semibold text-white mb-2">
                Not Enough Credits
              </h4>
              
              <p className="text-gray-400 text-sm mb-4">
                You need <span className="text-yellow-400 font-medium">{requiredCredits} credits</span> to perform this {operationType} operation, but you only have <span className="text-red-400 font-medium">{balance.balance} credits</span>.
              </p>
            </div>

            {/* Current Balance */}
            <div className="bg-[#0A0A0A] rounded-lg p-3 mb-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Current Balance</span>
                <span className="text-yellow-400 font-medium">
                  {balance.balance.toLocaleString()} credits
                </span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-gray-500 text-xs">Required</span>
                <span className="text-red-400 font-medium text-xs">
                  {requiredCredits} credits
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-2 px-4 bg-[#333] text-gray-300 rounded-lg hover:bg-[#444] transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  // Here you can open credits purchase modal
                  onClose();
                }}
                className="flex-1 py-2 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all text-sm font-medium"
              >
                Buy Credits
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
