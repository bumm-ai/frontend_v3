'use client';

import { Project } from '@/types/dashboard';
import { Calendar, Code, Play, CheckCircle, XCircle, Clock } from 'lucide-react';
import { ProjectContextMenu } from './ProjectContextMenu';

interface ProjectsListProps {
  projects: Project[];
  onSelectProject?: (project: Project) => void;
  selectedProject?: Project | null;
  isLoading?: boolean;
  onRenameProject?: (project: Project, newName: string) => void;
  onDeleteProject?: (project: Project) => void;
  onArchiveProject?: (project: Project) => void;
  onDuplicateProject?: (project: Project) => void;
  onCreateGroup?: (project: Project) => void;
  onAddToGroup?: (project: Project) => void;
  onToggleVisibility?: (project: Project) => void;
  onExportProject?: (project: Project) => void;
}

export default function ProjectsList({ 
  projects, 
  onSelectProject, 
  selectedProject,
  isLoading = false,
  onRenameProject,
  onDeleteProject,
  onArchiveProject,
  onDuplicateProject,
  onCreateGroup,
  onAddToGroup,
  onToggleVisibility,
  onExportProject
}: ProjectsListProps) {
  const getStatusIcon = (status: string) => {
    if (status === 'deployed' || status === 'completed') {
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
    if (status === 'generated' || status === 'built' || status === 'audited') {
      return <CheckCircle className="w-4 h-4 text-blue-500" />;
    }
    return <Clock className="w-4 h-4 text-orange-500" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'deployed' || status === 'completed') {
      return 'text-green-500';
    }
    if (status === 'generated' || status === 'built' || status === 'audited') {
      return 'text-blue-500';
    }
    return 'text-orange-500';
  };

  const getStatusDisplayName = (status: string) => {
    const statusMap: Record<string, string> = {
      'draft': 'Draft',
      'initializing': 'Initializing',
      'in-progress': 'In Progress',
      'generated': 'Generated',
      'built': 'Built',
      'audited': 'Audited',
      'deployed': 'Deployed',
      'completed': 'Completed'
    };
    return statusMap[status] || status;
  };

  const getTaskIcon = (task: string | null) => {
    switch (task) {
      case 'generate':
        return <Code className="w-4 h-4" />;
      case 'build':
        return <Play className="w-4 h-4" />;
      case 'audit':
        return <CheckCircle className="w-4 h-4" />;
      case 'deploy':
        return <Play className="w-4 h-4" />;
      default:
        return <Code className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return (
      <div className="p-3">
        <div className="flex items-center gap-2 text-white text-sm font-semibold mb-3">
          <Code className="w-4 h-4 text-orange-500" />
          My Projects
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-3 border border-[#333] rounded animate-pulse">
              <div className="h-4 bg-[#333] rounded mb-2"></div>
              <div className="h-3 bg-[#333] rounded w-2/3"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 text-white text-sm font-semibold mb-3">
        <Code className="w-4 h-4 text-orange-500" />
        My Projects ({projects.length})
      </div>
      
      {projects.length === 0 ? (
        <div className="text-center py-8">
          <Code className="w-8 h-8 mx-auto mb-3 text-[#333]" />
          <p className="text-[#666] text-sm">No projects yet</p>
          <p className="text-[#666] text-xs mt-1">Start by creating a smart contract</p>
        </div>
      ) : (
        <div className="space-y-1">
          {projects.map((project) => (
            <div
              key={project.uid}
              onClick={() => onSelectProject?.(project)}
              className={`p-3 border border-[#333] rounded cursor-pointer transition-all hover:border-orange-500/50 hover:bg-[#191919] ${
                selectedProject?.uid === project.uid ? 'border-orange-500 bg-orange-500/20' : ''
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getTaskIcon(project.task)}
                  <span className="text-white text-sm font-medium">
                    {project.name || 'Untitled Project'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(project.status)}
                  <ProjectContextMenu
                    project={project}
                    onRename={onRenameProject}
                    onDelete={onDeleteProject}
                    onArchive={onArchiveProject}
                    onDuplicate={onDuplicateProject}
                    onCreateGroup={onCreateGroup}
                    onAddToGroup={onAddToGroup}
                    onToggleVisibility={onToggleVisibility}
                    onExport={onExportProject}
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs">
                <span className={`${getStatusColor(project.status)} font-medium`}>
                  {getStatusDisplayName(project.status)}
                </span>
                <div className="flex items-center gap-1 text-[#666]">
                  <Calendar className="w-3 h-3" />
                  <span>{new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              {project.contractAddress && (
                <div className="mt-2 text-xs text-[#666] font-mono">
                  {typeof project.contractAddress === 'string' 
                    ? `${project.contractAddress.slice(0, 8)}...${project.contractAddress.slice(-8)}`
                    : String(project.contractAddress).slice(0, 8) + '...' + String(project.contractAddress).slice(-8)
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
