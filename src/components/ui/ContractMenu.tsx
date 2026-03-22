'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { MoreVertical, Archive, Trash2, Edit3, Copy, Download } from 'lucide-react';

interface ContractMenuProps {
  contractId: string;
  contractName: string;
  onDestroy: (contractId: string) => void;
  onArchive?: (contractId: string) => void;
  onRename?: (contractId: string, newName: string) => void;
  onDuplicate?: (contractId: string) => void;
  onExport?: (contractId: string) => void;
}

export const ContractMenu = ({ 
  contractId, 
  contractName,
  onDestroy, 
  onArchive,
  onRename,
  onDuplicate,
  onExport 
}: ContractMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(contractName);

  const handleAction = (action: string) => {
    switch (action) {
      case 'rename':
        setIsRenaming(true);
        return; // Don't close menu
      case 'archive':
        onArchive?.(contractId);
        break;
      case 'duplicate':
        onDuplicate?.(contractId);
        break;
      case 'export':
        onExport?.(contractId);
        break;
      case 'destroy':
        onDestroy(contractId);
        break;
    }
    setIsOpen(false);
  };

  const handleRename = () => {
    if (newName.trim() && newName !== contractName) {
      onRename?.(contractId, newName.trim());
    }
    setIsRenaming(false);
    setIsOpen(false);
  };

  const handleCancelRename = () => {
    setNewName(contractName);
    setIsRenaming(false);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-400 hover:text-white transition-colors"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <MoreVertical className="w-3 h-3" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-10" 
              onClick={() => setIsOpen(false)} 
            />
            
            {/* Menu */}
            <motion.div
              className="absolute right-0 top-full mt-1 bg-[#191919] border border-[#333] rounded-lg shadow-xl z-20 min-w-[120px]"
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
            >
              <div className="py-1">
                {isRenaming ? (
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename();
                        if (e.key === 'Escape') handleCancelRename();
                      }}
                      className="w-full px-2 py-1 bg-[#0A0A0A] border border-[#555] rounded text-xs text-white focus:outline-none focus:border-orange-500"
                      autoFocus
                    />
                    <div className="flex gap-1 mt-2">
                      <button
                        onClick={handleRename}
                        className="flex-1 px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={handleCancelRename}
                        className="flex-1 px-2 py-1 bg-[#333] text-gray-300 text-xs rounded hover:bg-[#444] transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleAction('rename')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                      Rename
                    </button>
                    
                    <button
                      onClick={() => handleAction('duplicate')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                    >
                      <Copy className="w-3 h-3" />
                      Duplicate
                    </button>
                    
                    <button
                      onClick={() => handleAction('export')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      Export
                    </button>
                    
                    <button
                      onClick={() => handleAction('archive')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-[#333] transition-colors"
                    >
                      <Archive className="w-3 h-3" />
                      Archive
                    </button>
                    
                    <hr className="my-1 border-[#333]" />
                    
                    <button
                      onClick={() => handleAction('destroy')}
                      className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-[#333] transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
