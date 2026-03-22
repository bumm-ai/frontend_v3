'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Zap, CreditCard, History, Settings, TrendingUp } from 'lucide-react';
import { useCredits } from '@/hooks/useCredits';
import { CreditHistory } from './CreditHistory';

export const CreditSystemDemo = () => {
  const { balance, rates, pricing, isLoading } = useCredits();
  const [showHistory, setShowHistory] = useState(false);

  const operations = [
    { type: 'generate', name: 'Contract Generation', icon: '', cost: pricing.generate || 100 },
    { type: 'audit', name: 'Security Audit', icon: '', cost: pricing.audit || 50 },
    { type: 'build', name: 'Contract Build', icon: '', cost: pricing.build || 25 },
    { type: 'deploy', name: 'Deploy Contract', icon: '', cost: pricing.deploy || 75 },
    { type: 'chat', name: 'AI Chat', icon: '', cost: pricing.chat || 0.1 },
    { type: 'upgrade', name: 'Contract Upgrade', icon: '', cost: pricing.upgrade || 150 },
  ];

  return (
    <div className="bg-[#0C0C0C] border border-[#333] rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap className="w-6 h-6 text-yellow-400" />
          <h2 className="text-xl font-bold text-white">Credit System</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(true)}
            className="p-2 hover:bg-[#333] rounded-lg transition-colors"
            title="View History"
          >
            <History className="w-4 h-4 text-gray-400" />
          </button>
          <button className="p-2 hover:bg-[#333] rounded-lg transition-colors" title="Settings">
            <Settings className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      </div>

      {/* Balance Overview */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-[#0A0A0A] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-yellow-400 mb-1">
            {balance.balance.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Available</div>
        </div>
        <div className="bg-[#0A0A0A] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-400 mb-1">
            {balance.totalPurchased.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Purchased</div>
        </div>
        <div className="bg-[#0A0A0A] rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-red-400 mb-1">
            {balance.totalSpent.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">Spent</div>
        </div>
      </div>

      {/* Exchange Rates */}
      <div className="bg-[#0A0A0A] rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">Exchange Rates</h3>
        </div>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">1 SOL</span>
            <span className="text-white">${rates.SOL.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">1 USDC</span>
            <span className="text-white">${rates.USDC.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">1 Credit</span>
            <span className="text-white">${rates.CREDIT.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Credits per SOL</span>
            <span className="text-yellow-400">{(rates.SOL / rates.CREDIT).toFixed(0)}</span>
          </div>
        </div>
      </div>

      {/* Operation Costs */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-white mb-3">Operation Costs</h3>
        <div className="space-y-2">
          {operations.map((operation) => (
            <motion.div
              key={operation.type}
              className="flex items-center justify-between p-3 bg-[#191919] rounded-lg border border-[#333]"
              whileHover={{ backgroundColor: '#1a1a1a' }}
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{operation.icon}</span>
                <span className="text-sm text-gray-300">{operation.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  ${(operation.cost * rates.CREDIT).toFixed(2)}
                </span>
                <span className="text-yellow-400 font-medium text-sm">
                  {operation.cost} credits
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <button className="flex-1 py-2 px-4 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all text-sm font-medium flex items-center justify-center gap-2">
          <CreditCard className="w-4 h-4" />
          Buy Credits
        </button>
        <button 
          onClick={() => setShowHistory(true)}
          className="px-4 py-2 bg-[#333] text-gray-300 rounded-lg hover:bg-[#444] transition-colors text-sm font-medium flex items-center justify-center gap-2"
        >
          <History className="w-4 h-4" />
          History
        </button>
      </div>

      {/* Credit History Modal */}
      <CreditHistory 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
      />
    </div>
  );
};
