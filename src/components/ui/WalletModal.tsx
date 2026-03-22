'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, ExternalLink, Info } from 'lucide-react';
import { useState, useEffect } from 'react';

interface WalletModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const WalletModal = ({ isOpen, onClose }: WalletModalProps) => {
    const { select, wallets, connecting, disconnect, connected, publicKey } = useWallet();
    const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
    const [showTooltip, setShowTooltip] = useState(false);
    
    // Check IP access (including external IP for team)
    const isIPAccess = typeof window !== 'undefined' && 
        (/^\d+\.\d+\.\d+\.\d+$/.test(window.location.hostname) || window.location.hostname === '185.102.186.87');

    // Automatically close modal on successful connection
    useEffect(() => {
        if (connected && publicKey && selectedWallet) {
            setTimeout(() => {
                onClose();
                setSelectedWallet(null);
            }, 800);
        }
    }, [connected, publicKey, selectedWallet, onClose]);

    const handleWalletSelect = async (walletName: string) => {
        try {
            setSelectedWallet(walletName);
            
            // For IP addresses and mobile devices - special handling
            if (isIPAccess && walletName === 'Phantom') {
                // Try to open Phantom mobile app
                const phantomUrl = `https://phantom.app/ul/browse/${encodeURIComponent(window.location.href)}?ref=bumm`;
                
                if (confirm('Phantom extension не поддерживает IP адреса.\n\nОткрыть в мобильном приложении Phantom?')) {
                    window.open(phantomUrl, '_blank');
                    setSelectedWallet(null);
                    return;
                }
                
                setSelectedWallet(null);
                return;
            }
            
            // If another wallet is already connected, disconnect first
            if (connected) {
                try {
                    await disconnect();
                    // Small delay for complete disconnection
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (disconnectError) {
                    console.warn('Disconnect failed:', disconnectError);
                    // Continue even if disconnection failed
                }
            }
            
            // Find wallet object by name
            const walletAdapter = wallets.find(wallet => wallet.adapter.name === walletName);
            if (walletAdapter) {
                select(walletAdapter.adapter.name);
            } else {
                throw new Error(`Wallet ${walletName} not found`);
            }
            
            // useEffect автоматически закроет модалку при успешном подключении
        } catch (error) {
            console.error('Wallet connection failed:', error);
            
            // Show error to user
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            
            if (isIPAccess && walletName === 'Phantom') {
                alert(`Phantom не работает с IP адресами.\n\nПопробуйте:\n1. Использовать localhost:3001\n2. Выбрать Solflare или Coin98\n3. Настроить HTTPS`);
            } else {
                alert(`Failed to connect to ${walletName}: ${errorMessage}\n\nPlease try:\n1. Refreshing the page\n2. Checking if the wallet is unlocked\n3. Choosing a different wallet`);
            }
            
            setSelectedWallet(null);
        }
    };

    const getWalletIcon = (walletName: string) => {
        switch (walletName.toLowerCase()) {
            case 'phantom':
                return '👻';
            case 'solflare':
                return '🔥';
            case 'coin98':
                return '💎';
            case 'trust wallet':
            case 'trust':
                return '';
            default:
                return '👛';
        }
    };

    const getWalletDescription = (walletName: string) => {
        switch (walletName.toLowerCase()) {
            case 'phantom':
                return 'Most popular Solana wallet';
            case 'solflare':
                return 'Web & mobile wallet';
            case 'coin98':
                return 'Multi-chain DeFi wallet';
            case 'trust wallet':
            case 'trust':
                return 'Secure mobile wallet';
            default:
                return 'Solana wallet';
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="bg-[#191919] border border-[#333] rounded-xl p-4 max-w-sm w-full mx-4"
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg flex items-center justify-center">
                                <Wallet className="w-3 h-3 text-white" />
                            </div>
                            <h2 className="text-lg font-semibold text-white">Connect Wallet</h2>
                        </div>
                        <motion.button
                            onClick={onClose}
                            className="p-1.5 hover:bg-[#333] rounded-lg transition-colors"
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </motion.button>
                    </div>

                    {/* Description */}
                    <p className="text-gray-400 text-xs mb-3">
                        Choose your preferred Solana wallet to continue
                    </p>
                    
                    {/* IP Access Warning */}
                    {isIPAccess && (
                        <div className="mb-4 flex items-center justify-center">
                            <div className="relative">
                                <motion.div
                                    onHoverStart={() => setShowTooltip(true)}
                                    onHoverEnd={() => setShowTooltip(false)}
                                    className="p-2 text-yellow-400 cursor-help"
                                >
                                    <Info className="w-5 h-5" />
                                </motion.div>
                                
                                <AnimatePresence>
                                    {showTooltip && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-72 p-2 bg-[#191919] border border-yellow-500/30 rounded-lg shadow-xl z-10"
                                        >
                                            <p className="text-yellow-400 text-xs">
                                                <strong>IP Access ({typeof window !== 'undefined' ? window.location.hostname : ''})</strong><br/>
                                                Browser wallets may have security restrictions with IP addresses.<br/><br/>
                                                <strong>Solutions:</strong><br/>
                                                • <strong>Solflare</strong> - best IP address support<br/>
                                                • <strong>Coin98</strong> - multichain DeFi wallet<br/>
                                                • <strong>Trust Wallet</strong> - works on mobile<br/>
                                                • <strong>Phantom Mobile</strong> - opens automatically<br/>
                                                • Use <code className="bg-black/50 px-1 rounded">http://localhost:3001</code>
                                            </p>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}

                    {/* Wallet List */}
                    <div className="space-y-2">
                        {wallets.map((wallet) => (
                            <motion.button
                                key={wallet.adapter.name}
                                onClick={() => handleWalletSelect(wallet.adapter.name)}
                                disabled={connecting || selectedWallet === wallet.adapter.name}
                                className="w-full flex items-center gap-3 p-3 bg-[#0C0C0C] hover:bg-[#222] border border-[#333] rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="text-xl">
                                    {getWalletIcon(wallet.adapter.name)}
                                </div>
                                
                                <div className="flex-1 text-left">
                                    <div className="text-white font-medium text-sm flex items-center gap-2">
                                        {wallet.adapter.name}
                                        {isIPAccess && wallet.adapter.name === 'Phantom' && (
                                            <span className="text-orange-400 text-xs bg-orange-500/30 px-1 rounded">
                                                Мобильное приложение
                                            </span>
                                        )}
                                        {(wallet.adapter.name === 'Solflare' || wallet.adapter.name === 'Coin98' || wallet.adapter.name === 'Trust Wallet') && isIPAccess && (
                                            <span className="text-green-400 text-xs bg-green-500/30 px-1 rounded">
                                                Рекомендуется
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-gray-400 text-xs">
                                        {isIPAccess && wallet.adapter.name === 'Phantom' 
                                            ? 'Откроется в мобильном приложении'
                                            : getWalletDescription(wallet.adapter.name)
                                        }
                                    </div>
                                </div>

                                {selectedWallet === wallet.adapter.name ? (
                                    <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ExternalLink className="w-4 h-4 text-gray-400" />
                                )}
                            </motion.button>
                        ))}
                    </div>

                    {/* Footer */}
                    <div className="mt-4 pt-3 border-t border-[#333]">
                        <p className="text-xs text-gray-500 text-center">
                            By connecting, you agree to our Terms of Service
                        </p>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
