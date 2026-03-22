'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ChevronDown, History } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js';
import { useCredits } from '@/hooks/useCredits';
import { useAnalytics } from '@/hooks/useAnalytics';
import { CreditHistory } from './CreditHistory';

export const HeaderCreditsButton = () => {
  const { connected, publicKey } = useWallet();
  const { connection } = useConnection();
  const analytics = useAnalytics();
  const { 
    balance, 
    rates, 
    isLoading, 
    error, 
    purchaseCredits
  } = useCredits();
  
  const [showDropdown, setShowDropdown] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [usdcBalance, setUsdcBalance] = useState<number>(0);
  const [selectedAmount, setSelectedAmount] = useState<number>(1000);
  const [selectedCurrency, setSelectedCurrency] = useState<'SOL' | 'USDC'>('SOL');
  const [isProcessing, setIsProcessing] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [calculation, setCalculation] = useState<{
    creditsAmount: number;
    usdAmount: number;
  }>({ creditsAmount: 0, usdAmount: 0 });
  const [showHistory, setShowHistory] = useState(false);

  const fetchBalances = async () => {
    if (!publicKey || !connected) return;

    setBalanceLoading(true);
    try {
      const solBalanceInLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceInLamports / LAMPORTS_PER_SOL);
      setUsdcBalance(Math.random() * 100); // Mock USDC
    } catch (error) {
      console.error('Error fetching balances:', error);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (showDropdown && connected && publicKey) {
      fetchBalances();
    }
  }, [showDropdown, connected, publicKey]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      const dropdown = document.querySelector('[data-credits-dropdown]');
      const button = document.querySelector('[data-credits-button]');
      
      if (showDropdown && dropdown && button) {
        // Close only if click outside button and dropdown
        if (!dropdown.contains(target) && !button.contains(target)) {
          setShowDropdown(false);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown]);

  // Credit calculation on parameter change (temporarily disabled - frontend only)
  useEffect(() => {
    const calculateCredits = () => {
      if (selectedAmount > 0) {
        try {
          // Local credit calculation
          const creditsAmount = selectedCurrency === 'SOL' 
            ? selectedAmount * rates.SOL 
            : selectedAmount * rates.USDC;
          
          const result = {
            creditsAmount,
            usdAmount: selectedAmount * (selectedCurrency === 'SOL' ? rates.SOL : rates.USDC)
          };
          
          setCalculation(result);
        } catch (err) {
          console.error('Failed to calculate credits:', err);
        }
      }
    };

    calculateCredits();
  }, [selectedAmount, selectedCurrency, rates]);

  const handlePurchase = async () => {
    if (!connected || !publicKey) return;

    setIsProcessing(true);
    
    try {
      const requiredAmount = selectedCurrency === 'SOL' 
        ? calculation.creditsAmount / rates.SOL 
        : calculation.creditsAmount / rates.USDC;

      await purchaseCredits(requiredAmount, selectedCurrency, {
        publicKey,
        signTransaction: async (tx: Transaction) => {
          // Transaction signing logic should be here
          // Using mock for now
          return tx;
        }
      });

      // Analytics tracking
      analytics.trackCreditPurchase(calculation.creditsAmount * rates.CREDIT, 'USD');
      
      setTimeout(() => {
        setIsProcessing(false);
      }, 1000);
      
    } catch (error) {
      console.error('Purchase failed:', error);
      setIsProcessing(false);
    }
  };

  const getRequiredAmount = () => {
    return selectedCurrency === 'SOL' 
      ? calculation.creditsAmount / rates.SOL 
      : calculation.creditsAmount / rates.USDC;
  };

  const getAvailableBalance = () => {
    return selectedCurrency === 'SOL' ? solBalance : usdcBalance;
  };

  const canAfford = () => {
    return getAvailableBalance() >= getRequiredAmount();
  };

  return (
    <div className="relative">
      <button
        data-credits-button
        onClick={(e) => {
          e.stopPropagation();
          setShowDropdown(!showDropdown);
        }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-yellow-600/30 to-orange-500/30 border border-yellow-500/40 rounded hover:bg-yellow-600 transition-all text-xs"
      >
        <Zap className="w-3.5 h-3.5 text-yellow-400" />
        <span className="text-yellow-400 font-medium">
          {balance.balance.toLocaleString()}
        </span>
        <ChevronDown className="w-2.5 h-2.5 text-yellow-400" />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {showDropdown && (
          <motion.div
            data-credits-dropdown
            className="absolute top-full right-0 mt-2 bg-[#191919] border border-[#333] rounded-lg shadow-xl z-[9998] w-[280px]"
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-3">
              {/* Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <span className="text-white font-semibold text-sm">Credits</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setShowHistory(true)}
                    className="p-1 hover:bg-[#333] rounded transition-colors"
                    title="View History"
                  >
                    <History className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => setShowDropdown(false)}
                    className="p-1 hover:bg-[#333] rounded transition-colors"
                  >
                    <X className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Current Balance */}
              <div className="bg-[#0A0A0A] rounded-lg p-2.5 mb-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400 mb-1">
                    {balance.balance.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">Available Credits</div>
                  <div className="text-xs text-gray-500 mt-1">
                    ≈ ${(balance.balance * rates.CREDIT).toFixed(2)} USD
                  </div>
                </div>
              </div>

              {!connected ? (
                <div className="text-center py-3">
                  <div className="text-gray-400 text-xs">Connect wallet to buy credits</div>
                </div>
              ) : (
                <>
                  {/* Amount Slider */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-400">Amount</span>
                      <span className="text-xs text-white font-medium">
                        {selectedAmount.toLocaleString()} credits
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1000"
                      max="10000"
                      step="500"
                      value={selectedAmount}
                      onChange={(e) => setSelectedAmount(Number(e.target.value))}
                      className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((selectedAmount - 1000) / (10000 - 1000)) * 100}%, #333 ${((selectedAmount - 1000) / (10000 - 1000)) * 100}%, #333 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>1K</span>
                      <span>10K</span>
                    </div>
                  </div>

                  {/* Currency Selection */}
                  <div className="mb-3">
                    <div className="text-xs text-gray-400 mb-2">Payment</div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setSelectedCurrency('SOL')}
                        className={`p-1.5 rounded border text-xs transition-all ${
                          selectedCurrency === 'SOL'
                            ? 'border-yellow-500 bg-yellow-500/20 text-white'
                            : 'border-[#333] text-gray-400 hover:border-[#555]'
                        }`}
                      >
                        <div className="font-medium">SOL</div>
                        <div className="text-xs text-gray-500">
                          {balanceLoading ? '...' : solBalance.toFixed(3)}
                        </div>
                      </button>

                      <button
                        onClick={() => setSelectedCurrency('USDC')}
                        className={`p-1.5 rounded border text-xs transition-all ${
                          selectedCurrency === 'USDC'
                            ? 'border-yellow-500 bg-yellow-500/20 text-white'
                            : 'border-[#333] text-gray-400 hover:border-[#555]'
                        }`}
                      >
                        <div className="font-medium">USDC</div>
                        <div className="text-xs text-gray-500">
                          {balanceLoading ? '...' : usdcBalance.toFixed(1)}
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Cost Display */}
                  <div className="bg-[#0A0A0A] rounded-lg p-2.5 mb-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">You pay</span>
                        <span className="text-white font-medium text-xs">
                          {getRequiredAmount().toFixed(selectedCurrency === 'SOL' ? 3 : 1)} {selectedCurrency}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">≈ USD</span>
                        <span className="text-white font-medium text-xs">
                          ${calculation.usdAmount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#333] pt-1.5">
                        <span className="text-yellow-400 font-medium text-xs">You get</span>
                        <span className="text-yellow-400 font-bold text-xs">
                          {calculation.creditsAmount.toFixed(0)} Credits
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Button */}
                  <button
                    onClick={handlePurchase}
                    disabled={!canAfford() || isProcessing}
                    className={`w-full py-2 rounded-lg font-medium transition-all text-xs ${
                      !canAfford() || isProcessing
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : !canAfford() ? (
                      'Insufficient Balance'
                    ) : (
                      'Buy Credits'
                    )}
                  </button>

                  {/* Rate Info */}
                  <div className="mt-2 text-center text-xs text-gray-500">
                    <div>1 SOL = ${rates.SOL.toFixed(2)} = {(rates.SOL / rates.CREDIT).toFixed(0)} credits</div>
                    <div>1 USDC = ${rates.USDC.toFixed(2)} = {(rates.USDC / rates.CREDIT).toFixed(0)} credits</div>
                    <div className="mt-1 text-yellow-400">1 Credit = ${rates.CREDIT.toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Credit History Modal */}
      <CreditHistory 
        isOpen={showHistory} 
        onClose={() => setShowHistory(false)} 
      />

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          border: 2px solid #0A0A0A;
        }
        .slider::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: #f59e0b;
          cursor: pointer;
          border: 2px solid #0A0A0A;
        }
      `}</style>
    </div>
  );
};
