'use client';

import { motion } from 'framer-motion';
import { useWallet } from '@solana/wallet-adapter-react';
import { useEffect } from 'react';
import { SimpleWalletButton } from '../ui/WalletButton';
import { HeaderWalletButton } from '../ui/HeaderWalletButton';
import { StartBuildingButton } from '../ui/StartBuildingButton';
import { useBummApi } from '@/hooks/useBummApi';
import Footer from '../ui/Footer';
import InteractiveDemo from '../demo/InteractiveDemo';

interface LoginScreenProps {
  onLogin: () => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const { connected } = useWallet();
  const { user, initializeUser, isLoading, error } = useBummApi();

  // Initialize user when wallet connects
  useEffect(() => {
    if (connected && !user && !isLoading) {
      initializeUser();
    }
  }, [connected, user, isLoading, initializeUser]);
  return (
    <motion.div 
      className="flex flex-col w-full max-w-6xl min-h-[832px] mx-auto bg-[#101010] overflow-x-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <header className="h-[60px] border-b border-[#191919] flex items-center justify-between px-8">
        {/* Logo */}
        <motion.div
          className="group flex items-center gap-2 cursor-default"
          whileHover={{ scale: 1.02, y: -1 }}
          transition={{ duration: 0.3 }}
        >
          {/* SVG Логотип */}
          <svg width="120" height="27" viewBox="0 0 267 59" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-7">
            <path d="M104.795 35.1355C104.795 30.6792 100.088 28.6266 96.1319 28.6266C89.9736 28.6266 86.1178 31.831 86.1178 36.337C86.1178 40.7933 90.8246 42.8962 94.7302 42.8962C100.889 42.8962 104.795 39.6415 104.795 35.1355ZM84.2151 41.3441H83.3641L82.7133 48.454H74.8518L83.6146 13.4047H91.4754L89.6231 20.7651C88.7721 24.1193 87.2193 27.0738 86.0675 29.1767H86.9185C89.6231 24.6707 93.4285 22.367 99.6869 22.367C106.547 22.367 112.655 26.423 112.655 33.8338C112.655 42.2958 106.497 49.1055 96.4328 49.1055C90.7245 49.1055 85.6671 46.6023 84.2151 41.3441Z" fill="#E34B13"/>
            <path d="M119.912 33.533L122.517 23.0185H130.378L128.024 32.682C126.572 38.6904 129.276 42.4953 134.884 42.4953C139.991 42.4953 143.346 39.7416 144.547 34.8346L147.501 23.0185H155.364L149.054 48.454H141.143L144.047 41.5946H143.196C140.692 46.4512 136.937 49.1055 130.728 49.1055C122.767 49.1055 117.509 43.2966 119.912 33.533Z" fill="#E34B13"/>
            <path d="M157.112 48.4531L163.421 23.0176H171.283L168.879 28.7252H169.729C172.084 24.4187 175.087 22.3661 179.794 22.3661C185.853 22.3661 188.606 25.8714 189.158 29.2256H189.859C192.312 24.4187 195.566 22.3661 200.172 22.3661C207.334 22.3661 211.289 27.5733 209.336 35.4851L206.083 48.4531H198.22L201.225 36.2864C202.377 31.679 200.024 29.026 196.167 29.026C192.212 29.026 189.758 31.3794 188.908 34.9847L185.552 48.4531H177.641L180.646 36.2864C181.798 31.679 179.444 29.026 175.588 29.026C171.682 29.026 169.23 31.3794 168.328 34.9847L164.973 48.4531H157.112Z" fill="#E34B13"/>
            <path d="M213.888 48.4531L220.197 23.0176H228.057L225.654 28.7252H226.506C228.858 24.4187 231.863 22.3661 236.57 22.3661C242.629 22.3661 245.383 25.8714 245.933 29.2256H246.635C249.088 24.4187 252.342 22.3661 256.95 22.3661C264.109 22.3661 268.066 27.5733 266.113 35.4851L262.857 48.4531H254.996L258.001 36.2864C259.152 31.679 256.798 29.026 252.944 29.026C248.987 29.026 246.534 31.3794 245.683 34.9847L242.328 48.4531H234.418L237.422 36.2864C238.572 31.679 236.22 29.026 232.365 29.026C228.459 29.026 226.005 31.3794 225.104 34.9847L221.748 48.4531H213.888Z" fill="#E34B13"/>
            <path d="M42.3199 22.3857L71.1428 22.4459C71.6481 22.4471 71.731 23.171 71.2392 23.2858L37.747 31.1153C31.4641 32.584 25.4593 36.457 22.0572 41.014L9.20773 58.2259C8.91854 58.6139 8.30947 58.2952 8.46358 57.8366L14.0779 41.0822C15.4593 36.9599 14.0017 34.006 10.6359 33.5381L0.366965 32.11C-0.0806303 32.048 -0.135273 31.4229 0.294517 31.2836L14.3038 26.7487C18.6656 25.3371 23.6738 21.6336 26.7603 17.3977L39.3065 0.17723C39.5883 -0.208966 40.1949 0.0906602 40.0586 0.549307L35.6361 15.4163C34.3922 19.5976 36.8481 22.374 42.3199 22.3857Z" fill="#E34B13"/>
          </svg>
        </motion.div>
        
        {/* Header Wallet Button - только кошелек на лендинге */}
        <HeaderWalletButton />
      </header>
      
      {/* Main Content */}
      <main className="flex flex-col min-h-0 flex-1">
        <div className="flex-1 flex items-center justify-center px-8 pt-16">
          <div className="text-center max-w-2xl">
            <motion.h1 
              className="text-4xl md:text-6xl font-bold text-white mb-6"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.8 }}
            >
              AI-Powered{' '}
              <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                Solana
              </span>{' '}
              Development
            </motion.h1>
            
            <motion.p 
              className="text-lg text-[#989898] mb-8 leading-relaxed"
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              Generate, deploy, and manage Solana smart contracts with the power of AI. 
              Build the future of decentralized applications in minutes, not months.
            </motion.p>
            
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.8 }}
              className="flex flex-col items-center gap-4"
            >
              <StartBuildingButton onLogin={onLogin} />
              
              {!connected && (
                <p className="text-sm text-[#666] text-center">
                  Connect your Solana wallet to start building smart contracts
                </p>
              )}
              
              {connected && !user && isLoading && (
                <p className="text-sm text-orange-500 text-center">
                  Initializing your account...
                </p>
              )}
              
              {error && (
                <p className="text-sm text-red-500 text-center">
                  Error: {error}
                </p>
              )}
              
            </motion.div>
          </div>
        </div>
        
        {/* Interactive Demo Section */}
        <div className="px-8 py-16">
          <InteractiveDemo />
        </div>
        
        {/* Footer - теперь в потоке документа */}
        <Footer />
      </main>
    </motion.div>
  );
}
