'use client';

import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { Wallet, Copy, ExternalLink, ChevronDown, RefreshCw } from 'lucide-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { WalletModal } from './WalletModal';

export const HeaderWalletButton = () => {
  const { connected, connecting, publicKey, disconnect, wallet } = useWallet();
  const { connection } = useConnection();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  const fetchBalance = async () => {
    if (!publicKey) return;
    
    setBalanceLoading(true);
    try {
      const balanceInLamports = await connection.getBalance(publicKey);
      setBalance(balanceInLamports / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error('Error fetching balance:', error);
      setBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      fetchBalance();
    }
  }, [connected, publicKey, connection]);

  // Determine wallet status based on balance
  const getWalletStatus = () => {
    if (balance === null) {
      return {
        ready: true,
        emoji: '⏳',
        text: 'Loading wallet status...',
        color: 'text-yellow-400'
      };
    }
    
    if (balance > 0) {
      return {
        ready: true,
        emoji: '✅',
        text: 'Wallet connected and ready',
        color: 'text-green-400'
      };
    }
    
    return {
      ready: false,
      emoji: '',
      text: 'Low balance - you can explore, but need SOL for deployment',
      color: 'text-yellow-400'
    };
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showDropdown) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('click', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [showDropdown]);

  return (
    <>
      <div
        className="relative"
      >
        {!connected ? (
          <button
            onClick={() => setIsModalOpen(true)}
            disabled={connecting}
            className="px-3 py-1.5 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded hover:from-orange-600 hover:to-red-600 transition-all shadow-md shadow-orange-500/25 disabled:opacity-50 text-xs"
          >
            {connecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
        ) : (
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(!showDropdown);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gradient-to-r from-green-600/30 to-green-500/30 border border-green-500/40 rounded hover:bg-green-600 transition-all text-xs"
            >
              <Wallet className="w-3.5 h-3.5 text-green-400" />
              <span className="text-green-400 font-medium">
                {publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : wallet?.adapter.name}
              </span>
              <ChevronDown className="w-2.5 h-2.5 text-green-400" />
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <div
                className="absolute top-full right-0 mt-2 bg-[#191919] border border-[#333] rounded-lg shadow-xl z-[9998] min-w-[280px] opacity-100 transform translate-y-0 transition-all duration-200 ease-out"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-3">
                  {/* Wallet Info Header */}
                  <div className="flex items-center gap-3 mb-3 pb-3 border-b border-[#333]">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                      <Wallet className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-green-400 font-semibold">{wallet?.adapter.name}</span>
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      </div>
                      <div className="text-xs text-gray-400">{publicKey ? `${publicKey.toString().slice(0, 6)}...${publicKey.toString().slice(-6)}` : 'Connected Wallet'}</div>
                    </div>
                  </div>

                  {/* Balance Section */}
                  <div className="mb-3 pb-3 border-b border-[#333]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Balance</span>
                      <button
                        onClick={fetchBalance}
                        disabled={balanceLoading}
                        className="p-1 hover:bg-green-500 rounded transition-colors"
                      >
                        <RefreshCw className={`w-3 h-3 text-green-400 ${balanceLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    <div className="text-lg font-bold text-green-400">
                      {balanceLoading ? (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          Loading...
                        </div>
                      ) : (
                        `${balance !== null ? balance.toFixed(4) : '-.----'} SOL`
                      )}
                    </div>
                    <div className="text-xs text-gray-500">Devnet Network</div>
                  </div>


                  {/* Actions */}
                  <div className="space-y-1">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(publicKey?.toString() || '');
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[#333] rounded transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Copy Address
                    </button>
                    
                    <button
                      onClick={() => {
                        window.open(`https://solscan.io/account/${publicKey?.toString()}?cluster=devnet`, '_blank');
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white hover:bg-[#333] rounded transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View on Solscan
                    </button>
                    
                    <button
                      onClick={() => {
                        disconnect();
                        setShowDropdown(false);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-[#333] rounded transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {connecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
      </div>

      {/* Wallet Modal - БЕЗ автоматического перехода */}
      <WalletModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </>
  );
};
