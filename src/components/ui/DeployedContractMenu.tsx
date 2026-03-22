'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, FileSignature, Snowflake, Crown, Trash2 } from 'lucide-react';

interface DeployedContractMenuProps {
  isDeployed: boolean;
  contractAddress?: string;
  onSignature?: () => void;
  onFreeze?: () => void;
  onOwnership?: () => void;
  onDestroy?: () => void;
}

export const DeployedContractMenu = ({ 
  isDeployed, 
  contractAddress,
  onSignature,
  onFreeze,
  onOwnership,
  onDestroy 
}: DeployedContractMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);

  // If contract is not deployed, don't show menu
  if (!isDeployed) {
    return null;
  }

  const menuItems = [
    {
      id: 'signature',
      label: 'Signature',
      icon: FileSignature,
      action: onSignature,
      color: 'text-gray-400 hover:text-white hover:bg-[#333]'
    },
    {
      id: 'freeze',
      label: 'Freeze',
      icon: Snowflake,
      action: onFreeze,
      color: 'text-gray-400 hover:text-white hover:bg-[#333]'
    },
    {
      id: 'ownership',
      label: 'Ownership',
      icon: Crown,
      action: onOwnership,
      color: 'text-gray-400 hover:text-white hover:bg-[#333]'
    },
    {
      id: 'destroy',
      label: 'Destroy',
      icon: Trash2,
      action: onDestroy,
      color: 'text-red-400 hover:text-red-300 hover:bg-red-500'
    }
  ];

  const handleItemClick = (action?: () => void) => {
    if (action) {
      action();
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="p-1.5 hover:bg-[#2a2a2a] rounded transition-colors"
        title="Contract Actions"
      >
        <MoreVertical className="w-3.5 h-3.5 text-gray-500 hover:text-gray-300" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Menu */}
            <motion.div
              className="absolute right-0 bottom-full mb-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-md shadow-lg z-50 min-w-[140px] overflow-hidden"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
            >
              {/* Menu Items */}
              <div className="py-1">
                {menuItems.map((item, index) => (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item.action)}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${item.color} ${
                      index < menuItems.length - 1 ? '' : 'border-t border-[#2a2a2a] mt-1'
                    }`}
                  >
                    <item.icon className="w-3.5 h-3.5" />
                    {item.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
