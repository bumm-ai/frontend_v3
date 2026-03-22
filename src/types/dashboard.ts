export type DashboardState = 
  | 'login'
  | 'chat';

// Updated types to match backend API
export interface Project {
  uid: string;
  name: string | null;
  status: 'draft' | 'initializing' | 'in-progress' | 'generated' | 'built' | 'audited' | 'deployed' | 'completed';
  created_at: string;
  updated_at: string;
  task: 'generate' | 'audit' | 'deploy' | 'build' | null;
  // Backend bumm UID for status polling (may differ from local project uid)
  bummUid?: string;
  // Additional fields for UI
  description?: string;
  code?: string;
  contractAddress?: string;
  isDeployed?: boolean;
  isFrozen?: boolean;
  groupId?: string;
  isHidden?: boolean;
}

export interface ChatMessage {
  id: string;
  content: string;
  timestamp: Date;
  isUser: boolean;
  codeSnippet?: string;
  // Project relationship
  projectUid?: string;
  taskType?: 'generate' | 'audit' | 'build' | 'deploy';
}

export type CodeSource = 'empty' | 'user-input' | 'ai-generated';
export type ActionButtonState = 'inactive' | 'review' | 'build' | 'building' | 'audit' | 'publish' | 'publishing' | 'upgrade';

// New types for API work
export interface User {
  uid: string;
  wallet?: string;
}

export interface TaskStatus {
  uid: string;
  status: string;
  progress?: number;
  error?: string;
}

export interface GenerationProgress {
  stage: 'initializing' | 'generating' | 'testing' | 'deploying' | 'completed' | 'error';
  progress: number;
  message: string;
  code?: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  projects: Project[];
  isExpanded?: boolean;
  createdAt: string;
}

export interface DashboardProps {
  currentState: DashboardState;
  onStateChange: (state: DashboardState) => void;
  project?: Project;
  messages?: ChatMessage[];
  user?: User;
}
