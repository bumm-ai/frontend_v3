'use client';

import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { useState, useEffect } from 'react';
import { Rocket, Loader2 } from 'lucide-react';
import { WalletModal } from './WalletModal';

interface StartBuildingButtonProps {
  onLogin: () => void;
}

export const StartBuildingButton = ({ onLogin }: StartBuildingButtonProps) => {
  const { connected, connecting } = useWallet();
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Automatically transition to next screen when wallet connects
  useEffect(() => {
    if (connected && isTransitioning) {
      setTimeout(() => {
        onLogin();
        setIsTransitioning(false);
      }, 1000); // Small delay for smooth transition
    }
  }, [connected, isTransitioning, onLogin]);

  const handleStartBuilding = () => {
    if (connected) {
      // If wallet is already connected, transition immediately
      onLogin();
    } else {
      // If wallet is not connected, open connection modal
      setIsWalletModalOpen(true);
      setIsTransitioning(true);
    }
  };

  const handleWalletModalClose = () => {
    setIsWalletModalOpen(false);
    if (!connected) {
      setIsTransitioning(false);
    }
  };

  return (
    <>
      <motion.button
        onClick={handleStartBuilding}
        disabled={connecting || isTransitioning}
        className="group px-8 py-4 bg-gradient-to-r from-orange-500 to-red-500 text-white font-semibold rounded-lg text-lg hover:from-orange-600 hover:to-red-600 transition-all shadow-lg shadow-orange-500/30 disabled:opacity-70 disabled:cursor-not-allowed min-w-[200px]"
        whileHover={{ scale: connected ? 1.05 : 1.02, boxShadow: "0 20px 40px rgba(254, 74, 1, 0.3)" }}
        whileTap={{ scale: 0.95 }}
      >
        <div className="flex items-center justify-center gap-3">
          {connecting || isTransitioning ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {connecting ? 'Connecting...' : 'Redirecting...'}
            </>
          ) : connected ? (
            <>
              <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
              Start Building
            </>
          ) : (
            <>
              <Rocket className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
              Start Building
            </>
          )}
        </div>
      </motion.button>

      {/* Wallet connection modal */}
      <WalletModal 
        isOpen={isWalletModalOpen} 
        onClose={handleWalletModalClose} 
      />

      {/* Status indicator */}
      {connected && (
        <motion.div
          className="flex items-center gap-2 text-green-400 text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          Wallet Connected - Ready to build!
        </motion.div>
      )}
    </>
  );
};
