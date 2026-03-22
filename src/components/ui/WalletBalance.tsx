'use client';

import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, RefreshCw } from 'lucide-react';

export const WalletBalance = () => {
    const { connection } = useConnection();
    const { publicKey } = useWallet();
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    const fetchBalance = async () => {
        if (!publicKey) return;
        
        setLoading(true);
        try {
            const balanceInLamports = await connection.getBalance(publicKey);
            setBalance(balanceInLamports / LAMPORTS_PER_SOL);
        } catch (error) {
            console.error('Error fetching balance:', error);
            setBalance(null);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [publicKey, connection]);

    if (!publicKey) return null;

    return (
        <motion.div
            className="flex items-center gap-3 p-3 bg-[#191919] border border-[#333] rounded-lg"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <div className="flex items-center gap-2">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="text-white text-sm font-medium">Balance:</span>
            </div>
            
            <div className="flex items-center gap-2">
                {loading ? (
                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                    <span className="text-yellow-400 font-mono text-sm">
                        {balance !== null ? `${balance.toFixed(4)} SOL` : 'Error'}
                    </span>
                )}
                
                <motion.button
                    onClick={fetchBalance}
                    disabled={loading}
                    className="p-1 hover:bg-[#333] rounded transition-colors disabled:opacity-50"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <RefreshCw className={`w-3 h-3 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
                </motion.button>
            </div>
            
            <div className="text-xs text-gray-500">
                (Devnet)
            </div>
        </motion.div>
    );
};
