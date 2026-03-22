'use client';

import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';

interface PublishButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export const PublishButton = ({ onClick, disabled = false }: PublishButtonProps) => {
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center justify-center gap-2 px-3 py-2 bg-[#FE4A01] text-[#FAFAFA] rounded-md font-medium text-xs border border-[#FAFAFA]/20 shadow-sm hover:bg-[#FE4A01]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all w-[90px] h-[32px]"
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      style={{
        fontFamily: 'Inter',
        fontWeight: 500,
        fontSize: '12px',
        lineHeight: '16px',
        boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)'
      }}
    >
      <Upload className="w-4 h-4" />
      Publish
    </motion.button>
  );
};
