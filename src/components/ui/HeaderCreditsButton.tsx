'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, ChevronDown, History } from 'lucide-react';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL, SystemProgram, Transaction, PublicKey } from '@solana/web3.js';
import { useCredits } from '@/hooks/useCredits';
import { useAnalytics } from '@/hooks/useAnalytics';
import { CreditHistory } from './CreditHistory';

// Treasury wallet for credit purchases.
// Must match backend settings.treasury_wallet_address.
const TREASURY_WALLET = new PublicKey('DJb1g84e1Xs5oBbQsAX2iywKFsaggMrgCL5K8V7eMi8d');
const FINALIZATION_TIMEOUT_MS = 60_000;
const FINALIZATION_POLL_MS = 1_500;

async function waitForFinalized(
  connection: ReturnType<typeof useConnection>['connection'],
  signature: string,
): Promise<void> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < FINALIZATION_TIMEOUT_MS) {
    const statuses = await connection.getSignatureStatuses(
      [signature],
      { searchTransactionHistory: true },
    );
    const status = statuses.value[0];

    if (status?.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`);
    }
    if (status?.confirmationStatus === 'finalized') {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, FINALIZATION_POLL_MS));
  }

  throw new Error('Transaction was not finalized in time. Please try again.');
}

async function purchaseWithRetry(
  purchaseFn: (sig: string) => Promise<unknown>,
  signature: string,
): Promise<void> {
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await purchaseFn(signature);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const isNotReadyYet =
        message.includes('not found or not yet finalized') ||
        message.includes('not yet finalized');
      const isLastAttempt = attempt === maxAttempts;

      if (!isNotReadyYet || isLastAttempt) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, attempt * 1500));
    }
  }
}

export const HeaderCreditsButton = () => {
  const { connected, publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const analytics = useAnalytics();
  const {
    balance,
    creditsPerSol,
    isLoading,
    error,
    purchase,
  } = useCredits();

  const [showDropdown, setShowDropdown] = useState(false);
  const [solBalance, setSolBalance] = useState<number>(0);
  const [selectedCredits, setSelectedCredits] = useState<number>(2000);
  const [isProcessing, setIsProcessing] = useState(false);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Calculate SOL cost for selected credits
  const solCost = creditsPerSol > 0 ? selectedCredits / creditsPerSol : 0;

  const fetchBalances = async () => {
    if (!publicKey || !connected) return;
    setBalanceLoading(true);
    try {
      const solBalanceInLamports = await connection.getBalance(publicKey);
      setSolBalance(solBalanceInLamports / LAMPORTS_PER_SOL);
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
        if (!dropdown.contains(target) && !button.contains(target)) {
          setShowDropdown(false);
        }
      }
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showDropdown]);

  const handlePurchase = async () => {
    if (!connected || !publicKey || !sendTransaction) return;

    setIsProcessing(true);
    try {
      // 1. Create SOL transfer transaction
      const lamports = Math.round(solCost * LAMPORTS_PER_SOL);
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: TREASURY_WALLET,
          lamports,
        })
      );

      // 2. Send and sign via wallet adapter
      const signature = await sendTransaction(transaction, connection);

      // 3. Wait until the tx is FINALIZED.
      // Backend verifies purchases with finalized commitment, so "confirmed"
      // can race and produce "not found or not yet finalized".
      await waitForFinalized(connection, signature);

      // 4. Notify backend — verify on-chain and credit account
      await purchaseWithRetry(purchase, signature);

      analytics.trackCreditPurchase(selectedCredits, 'SOL');
      setShowDropdown(false);
    } catch (error) {
      console.error('Purchase failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const canAfford = solBalance >= solCost && solCost > 0;

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
                        {selectedCredits.toLocaleString()} credits
                      </span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="20000"
                      step="500"
                      value={selectedCredits}
                      onChange={(e) => setSelectedCredits(Number(e.target.value))}
                      className="w-full h-2 bg-[#333] rounded-lg appearance-none cursor-pointer slider"
                      style={{
                        background: `linear-gradient(to right, #f59e0b 0%, #f59e0b ${((selectedCredits - 500) / (20000 - 500)) * 100}%, #333 ${((selectedCredits - 500) / (20000 - 500)) * 100}%, #333 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>500</span>
                      <span>20K</span>
                    </div>
                  </div>

                  {/* Cost Display */}
                  <div className="bg-[#0A0A0A] rounded-lg p-2.5 mb-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">You pay</span>
                        <span className="text-white font-medium text-xs">
                          {solCost.toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-400 text-xs">SOL balance</span>
                        <span className="text-white font-medium text-xs">
                          {balanceLoading ? '...' : solBalance.toFixed(4)} SOL
                        </span>
                      </div>
                      <div className="flex items-center justify-between border-t border-[#333] pt-1.5">
                        <span className="text-yellow-400 font-medium text-xs">You get</span>
                        <span className="text-yellow-400 font-bold text-xs">
                          {selectedCredits.toLocaleString()} Credits
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Purchase Button */}
                  <button
                    onClick={handlePurchase}
                    disabled={!canAfford || isProcessing}
                    className={`w-full py-2 rounded-lg font-medium transition-all text-xs ${
                      !canAfford || isProcessing
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white'
                    }`}
                  >
                    {isProcessing ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Processing...
                      </div>
                    ) : !canAfford ? (
                      'Insufficient SOL Balance'
                    ) : (
                      `Buy ${selectedCredits.toLocaleString()} Credits`
                    )}
                  </button>

                  {/* Rate Info */}
                  <div className="mt-2 text-center text-xs text-gray-500">
                    <div>0.1 SOL = {Math.round(creditsPerSol * 0.1).toLocaleString()} credits</div>
                    <div>1 SOL = {creditsPerSol.toLocaleString()} credits</div>
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
