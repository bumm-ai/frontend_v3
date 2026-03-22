'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MoreVertical, 
  Trash2, 
  Edit3, 
  Archive, 
  Copy, 
  FolderPlus, 
  Users,
  Folder,
  Eye,
  EyeOff,
  Download
} from 'lucide-react';
import { Project } from '@/types/dashboard';

interface ProjectContextMenuProps {
  project: Project;
  onRename?: (project: Project, newName: string) => void;
  onDelete?: (project: Project) => void;
  onArchive?: (project: Project) => void;
  onDuplicate?: (project: Project) => void;
  onCreateGroup?: (project: Project) => void;
  onAddToGroup?: (project: Project) => void;
  onToggleVisibility?: (project: Project) => void;
  onExport?: (project: Project) => void;
  className?: string;
}

export const ProjectContextMenu = ({
  project,
  onRename,
  onDelete,
  onArchive,
  onDuplicate,
  onCreateGroup,
  onAddToGroup,
  onToggleVisibility,
  onExport,
  className = ''
}: ProjectContextMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name || 'Untitled Project');
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsRenaming(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus on input when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  const handleRename = () => {
    if (newName.trim() && newName !== project.name) {
      onRename?.(project, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setNewName(project.name || 'Untitled Project');
      setIsRenaming(false);
    }
  };


  const menuItems = [
    {
      icon: Edit3,
      label: 'Rename',
      action: () => setIsRenaming(true),
      color: 'text-blue-400'
    },
    {
      icon: Copy,
      label: 'Duplicate',
      action: () => onDuplicate?.(project),
      color: 'text-green-400'
    },
    {
      icon: Download,
      label: 'Export',
      action: () => onExport?.(project),
      color: 'text-orange-400'
    },
    {
      icon: Archive,
      label: project.isFrozen ? 'Unarchive' : 'Archive',
      action: () => onArchive?.(project),
      color: 'text-yellow-400'
    },
    {
      icon: FolderPlus,
      label: 'Create Group',
      action: () => onCreateGroup?.(project),
      color: 'text-purple-400'
    },
    {
      icon: Users,
      label: 'Add to Group',
      action: () => onAddToGroup?.(project),
      color: 'text-indigo-400'
    },
    {
      icon: Trash2,
      label: 'Delete',
      action: () => onDelete?.(project),
      color: 'text-red-400',
      destructive: true
    }
  ];

  return (
    <div className={`relative ${className}`} ref={menuRef} style={{ zIndex: isOpen ? 99999 : 'auto' }}>
      {/* Кнопка меню */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setMenuPosition({
              top: rect.bottom + 4,
              left: rect.right - 192 // 192px - ширина меню (w-48)
            });
          }
          setIsOpen(!isOpen);
        }}
        className={`p-1 hover:bg-[#333] rounded transition-colors ${isOpen ? 'relative z-[99999]' : ''}`}
      >
        <MoreVertical className="w-4 h-4 text-[#666] hover:text-white" />
      </button>

      {/* Контекстное меню через портал */}
      {isOpen && createPortal(
        <>
          {/* Backdrop для блокировки других элементов */}
          <div 
            className="fixed inset-0 z-[99998] bg-black/10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Контекстное меню */}
          <AnimatePresence>
            <motion.div
              initial={{ scale: 0.95, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10 }}
              transition={{ duration: 0.15 }}
              className="fixed z-[99999] w-48 bg-[#1a1a1a] border border-[#333] rounded-lg shadow-xl"
              style={{
                top: menuPosition.top,
                left: menuPosition.left
              }}
              ref={menuRef}
            >
            {isRenaming ? (
              <div className="p-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleKeyPress}
                  onBlur={handleRename}
                  className="w-full px-2 py-1 bg-[#333] border border-[#555] rounded text-white text-sm focus:outline-none focus:border-orange-500"
                  placeholder="Project name"
                />
              </div>
            ) : (
              <div className="py-1">
                {menuItems.map((item, index) => (
                  <button
                    key={index}
                    onClick={(e) => {
                      e.stopPropagation();
                      item.action();
                      setIsOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-sm flex items-center gap-3 hover:bg-[#333] transition-colors ${
                      item.destructive ? 'text-red-400 hover:bg-red-600' : 'text-white'
                    }`}
                  >
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            )}
            </motion.div>
          </AnimatePresence>
        </>,
        document.body
      )}
    </div>
  );
};
