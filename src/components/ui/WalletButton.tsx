'use client';

import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { motion } from 'framer-motion';
import { Wallet, Copy, ExternalLink, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { WalletModal } from './WalletModal';

export const CustomWalletButton = () => {
    const { publicKey, disconnect, connected, wallet, connecting } = useWallet();
    const [copied, setCopied] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const copyAddress = async () => {
        if (publicKey) {
            await navigator.clipboard.writeText(publicKey.toString());
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const shortenAddress = (address: string) => {
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    };


    if (connected && publicKey) {
        return (
            <div className="flex items-center gap-2">
                {/* Wallet Info */}
                <motion.div
                    className="flex items-center gap-2 px-3 py-2 bg-[#191919] border border-[#333] rounded-lg"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                >
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-green-400 text-sm font-mono">
                        {wallet?.adapter.name} {shortenAddress(publicKey.toString())}
                    </span>
                    
                    <motion.button
                        onClick={copyAddress}
                        className="p-1 hover:bg-[#333] rounded transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Copy className="w-3 h-3 text-gray-400" />
                    </motion.button>
                    
                    <motion.button
                        onClick={() => window.open(`https://solscan.io/account/${publicKey.toString()}?cluster=devnet`, '_blank')}
                        className="p-1 hover:bg-[#333] rounded transition-colors"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <ExternalLink className="w-3 h-3 text-gray-400" />
                    </motion.button>
                </motion.div>

                {/* Disconnect Button */}
                <motion.button
                    onClick={disconnect}
                    className="px-3 py-2 bg-red-600/30 border border-red-600/40 text-red-400 rounded-lg text-sm hover:bg-red-600 transition-colors"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    Disconnect
                </motion.button>

                {/* Copy Success Toast */}
                {copied && (
                    <motion.div
                        className="absolute top-full mt-2 right-0 px-3 py-1 bg-green-600 text-white text-xs rounded shadow-lg"
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        Address copied!
                    </motion.div>
                )}
            </div>
        );
    }

    return (
        <>
            <motion.button
                onClick={() => setIsModalOpen(true)}
                disabled={connecting}
                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {connecting ? 'Connecting...' : 'Connect Wallet'}
            </motion.button>
            
            <WalletModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />
        </>
    );
};

export const SimpleWalletButton = () => {
    const { connected, connecting, publicKey, disconnect, wallet } = useWallet();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);

    return (
        <>
            <motion.div
                className="relative"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
            >
                {!connected ? (
                    <motion.button
                        onClick={() => setIsModalOpen(true)}
                        disabled={connecting}
                        className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/25 disabled:opacity-50"
                    >
                        {connecting ? 'Connecting...' : 'Connect Wallet'}
                    </motion.button>
                ) : (
                    <div className="relative">
                        <motion.button
                            onClick={() => setShowDropdown(!showDropdown)}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600/30 to-green-500/30 border border-green-500/40 rounded-lg hover:bg-green-600 transition-all"
                            whileHover={{ scale: 1.02 }}
                        >
                            <Wallet className="w-4 h-4 text-green-400" />
                            <span className="text-green-400 text-sm font-medium">
                                {wallet?.adapter.name} ({publicKey ? `${publicKey.toString().slice(0, 4)}...${publicKey.toString().slice(-4)}` : 'Connected'})
                            </span>
                            <ChevronDown className="w-3 h-3 text-green-400" />
                        </motion.button>

                        {/* Dropdown */}
                        {showDropdown && (
                            <motion.div
                                className="absolute top-full right-0 mt-2 bg-[#191919] border border-[#333] rounded-lg shadow-xl z-50 min-w-[200px]"
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                            >
                                <div className="p-2">
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
                                    <hr className="my-1 border-[#333]" />
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
                            </motion.div>
                        )}
                    </div>
                )}

                {connecting && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                        <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </motion.div>

            <WalletModal 
                isOpen={isModalOpen} 
                onClose={() => setIsModalOpen(false)} 
            />
        </>
    );
};
