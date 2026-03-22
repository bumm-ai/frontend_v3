'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { ExternalLink } from 'lucide-react';

interface NetworkToggleProps {
  onChange?: (network: 'devnet' | 'mainnet') => void;
}

export const NetworkToggle = ({ onChange }: NetworkToggleProps) => {
  const [isDevnet, setIsDevnet] = useState(true);

  const handleToggle = () => {
    const newNetwork = isDevnet ? 'mainnet' : 'devnet';
    setIsDevnet(!isDevnet);
    onChange?.(newNetwork);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Toggle Switch - миниатюрная версия */}
      <motion.button
        onClick={handleToggle}
        className="w-[28px] h-[14px] bg-[#FE4A01] rounded-[50px] cursor-pointer relative flex-shrink-0"
        whileTap={{ scale: 0.95 }}
      >
        {/* Thumb */}
        <motion.div
          className="absolute w-[10px] h-[10px] bg-[#F4F4F5] rounded-full shadow-sm"
          style={{
            boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.1)',
            top: '2px'
          }}
          animate={{
            x: isDevnet ? 2 : 16
          }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        />
      </motion.button>

      {/* Label - рядом с переключателем */}
      <span className="text-[#F4F4F5] font-medium text-[10px] flex-shrink-0">
        {isDevnet ? 'DevNet' : 'MainNet'}
      </span>

      {/* Get DevNet SOL link - справа */}
      {isDevnet && (
        <motion.a
          href="https://faucet.solana.com"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-0.5 text-[8px] text-blue-400 hover:text-blue-300 transition-colors ml-auto"
          initial={{ opacity: 0, x: -5 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -5 }}
        >
          <ExternalLink className="w-1.5 h-1.5" />
          Get SOL
        </motion.a>
      )}
    </div>
  );
};
