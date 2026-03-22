'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Folder, FolderOpen, Plus, X } from 'lucide-react';
import { Project } from '@/types/dashboard';
import { ProjectContextMenu } from './ProjectContextMenu';

interface ProjectGroupProps {
  name: string;
  projects: Project[];
  isExpanded?: boolean;
  onToggleExpanded?: () => void;
  onRenameGroup?: (oldName: string, newName: string) => void;
  onDeleteGroup?: (name: string) => void;
  onAddProject?: (groupName: string) => void;
  onRenameProject?: (project: Project, newName: string) => void;
  onDeleteProject?: (project: Project) => void;
  onArchiveProject?: (project: Project) => void;
  onDuplicateProject?: (project: Project) => void;
  onRemoveFromGroup?: (project: Project) => void;
  onToggleVisibility?: (project: Project) => void;
  onSelectProject?: (project: Project) => void;
  selectedProject?: Project | null;
}

export const ProjectGroup = ({
  name,
  projects,
  isExpanded = true,
  onToggleExpanded,
  onRenameGroup,
  onDeleteGroup,
  onAddProject,
  onRenameProject,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onRemoveFromGroup,
  onToggleVisibility,
  onSelectProject,
  selectedProject
}: ProjectGroupProps) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setName] = useState(name);

  const handleRename = () => {
    if (newName.trim() && newName !== name) {
      onRenameGroup?.(name, newName.trim());
    }
    setIsRenaming(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRename();
    } else if (e.key === 'Escape') {
      setName(name);
      setIsRenaming(false);
    }
  };

  return (
    <div className="mb-3">
      {/* Group Header */}
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onToggleExpanded}
          className="p-1 hover:bg-[#333] rounded transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-[#666]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[#666]" />
          )}
        </button>
        
        {isExpanded ? (
          <FolderOpen className="w-4 h-4 text-orange-500" />
        ) : (
          <Folder className="w-4 h-4 text-orange-500" />
        )}
        
        {isRenaming ? (
          <input
            type="text"
            value={newName}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleRename}
            className="flex-1 px-2 py-1 bg-[#333] border border-[#555] rounded text-white text-sm focus:outline-none focus:border-orange-500"
            autoFocus
          />
        ) : (
          <span className="text-white text-sm font-medium flex-1">{name}</span>
        )}
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => onAddProject?.(name)}
            className="p-1 hover:bg-[#333] rounded transition-colors"
            title="Add project to group"
          >
            <Plus className="w-3 h-3 text-green-400" />
          </button>
          
          {!isRenaming && (
            <>
              <button
                onClick={() => setIsRenaming(true)}
                className="p-1 hover:bg-[#333] rounded transition-colors"
                title="Rename group"
              >
                <span className="text-blue-400 text-xs"></span>
              </button>
              
              <button
                onClick={() => onDeleteGroup?.(name)}
                className="p-1 hover:bg-[#333] rounded transition-colors"
                title="Delete group"
              >
                <X className="w-3 h-3 text-red-400" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Group Projects */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-6 space-y-2"
          >
            {projects.map((project) => (
              <motion.div
                key={project.uid}
                onClick={() => onSelectProject?.(project)}
                className={`p-2 bg-[#191919] border border-[#333] rounded cursor-pointer transition-all hover:border-orange-500/50 ${
                  selectedProject?.uid === project.uid ? 'border-orange-500 bg-orange-500/10' : ''
                }`}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-white text-sm">
                      {project.name || 'Untitled Project'}
                    </span>
                    <span className="text-xs text-[#666]">
                      ({project.status})
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFromGroup?.(project);
                      }}
                      className="p-1 hover:bg-[#333] rounded transition-colors"
                      title="Remove from group"
                    >
                      <X className="w-3 h-3 text-red-400" />
                    </button>
                    
                    <ProjectContextMenu
                      project={project}
                      onRename={onRenameProject}
                      onDelete={onDeleteProject}
                      onArchive={onArchiveProject}
                      onDuplicate={onDuplicateProject}
                      onToggleVisibility={onToggleVisibility}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
            
            {projects.length === 0 && (
              <div className="text-center py-4 text-[#666] text-sm">
                No projects in this group
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
