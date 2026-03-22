'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, ArrowUpRight, ArrowDownLeft, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { CreditTransaction } from '@/services/creditService';
import { API_BASE_URL } from '@/config/api';

interface CreditHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreditHistory = ({ isOpen, onClose }: CreditHistoryProps) => {
  const { balance } = useCredits();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHistory();
    }
  }, [isOpen]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const userId = localStorage.getItem('bumm_user_uid') || '';
      const res = await fetch(`${API_BASE_URL}/api/v1/credits/history?limit=50`, {
        headers: { 'x-user-id': userId }
      });
      if (res.ok) {
        const data = await res.json();
        const txList: CreditTransaction[] = (data.transactions || []).map((tx: any) => ({
          id: tx.id,
          operationType: tx.operationType,
          creditsSpent: Math.abs(tx.creditsSpent),
          usdEquivalent: Math.abs(tx.creditsSpent) * 0.01,
          description: tx.description,
          createdAt: tx.createdAt,
          bummId: tx.bummId,
        }));
        setTransactions(txList);
      }
    } catch (error) {
      console.error('Failed to load credit history:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getOperationIcon = (type: string) => {
    switch (type) {
      case 'generate': return '';
      case 'audit': return '';
      case 'build': return '';
      case 'deploy': return '';
      case 'chat': return '';
      case 'upgrade': return '';
      default: return '';
    }
  };

  const getOperationColor = (type: string) => {
    switch (type) {
      case 'generate': return 'text-blue-400';
      case 'audit': return 'text-yellow-400';
      case 'build': return 'text-orange-400';
      case 'deploy': return 'text-green-400';
      case 'chat': return 'text-purple-400';
      case 'upgrade': return 'text-cyan-400';
      default: return 'text-gray-400';
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

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
          className="bg-[#0C0C0C] border border-[#333] rounded-lg w-full max-w-sm max-h-[70vh] overflow-hidden"
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-3 border-b border-[#333] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-400" />
              <h3 className="text-white font-semibold text-sm">Credit History</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#333] rounded transition-colors"
            >
              <XCircle className="w-3.5 h-3.5 text-gray-400" />
            </button>
          </div>

          {/* Current Balance */}
          <div className="p-3 border-b border-[#333]">
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-400 mb-1">
                {balance.balance.toLocaleString()}
              </div>
              <div className="text-xs text-gray-400">Available Credits</div>
            </div>
          </div>

          {/* Transactions */}
          <div className="p-3 max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-6">
                <div className="w-5 h-5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                <div className="text-gray-400 text-xs">Loading history...</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-6">
                <div className="text-gray-400 text-xs">No transactions yet</div>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((transaction) => (
                  <motion.div
                    key={transaction.id}
                    className="bg-[#191919] rounded-lg p-2.5 border border-[#333]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{getOperationIcon(transaction.operationType)}</span>
                        <span className={`text-xs font-medium capitalize ${getOperationColor(transaction.operationType)}`}>
                          {transaction.operationType}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <ArrowDownLeft className="w-2.5 h-2.5 text-red-400" />
                        <span className="text-red-400 font-medium text-xs">
                          -{transaction.creditsSpent}
                        </span>
                      </div>
                    </div>
                    
                    <div className="text-xs text-gray-400 mb-1">
                      {transaction.description}
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        ${transaction.usdEquivalent.toFixed(2)} USD
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(transaction.createdAt)}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
