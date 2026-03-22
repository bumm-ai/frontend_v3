// API configuration — Bumm Frontend v3 (thin client)
// Target: https://github.com/bumm-ai/backend_v3 (LangGraph pipeline, new REST/WS)
// Planned v3.1 paths (not all implemented yet): src/config/api.v3.planned.ts
// Docs: docs/V3_THIN_CLIENT.md, docs/TECHNICAL_SPEC_V3_1.md
//
// Use Next.js API proxy to bypass CORS (BACKEND_URL in .env.local → route.ts)
export const API_BASE_URL = '/api/backend';

export const API_ENDPOINTS = {
  HEALTH: '/health/',
  BUMM_LIST: '/api/v1/list/',
  BUMM_GENERATE: '/api/v1/generate/',
  BUMM_STATUS_GENERATE: '/api/v1/status/generate/',
  BUMM_AUDIT: '/api/v1/audit/',
  BUMM_AUDIT_STATUS: '/api/v1/audit/status/',
  BUMM_BUILD: '/api/v1/build/',
  BUMM_BUILD_STATUS: '/api/v1/build/status/',
  BUMM_DEPLOY: '/api/v1/deploy/',
  BUMM_DEPLOY_STATUS: '/api/v1/deploy/status/',
  USER_WALLET: '/api/v1/user/wallet/',
  CHAT_MESSAGE: '/api/v1/chat/message/',
  CHAT_HISTORY: '/api/v1/chat/history',
  CHAT_UNLINKED: '/api/v1/chat/unlinked',
  // Credits (NEW)
  CREDITS_BALANCE: '/api/v1/credits/balance',
  CREDITS_RATES: '/api/v1/credits/rates',
  CREDITS_PRICING: '/api/v1/credits/pricing',
  CREDITS_PURCHASE: '/api/v1/credits/purchase',
  CREDITS_SPEND: '/api/v1/credits/spend',
  CREDITS_HISTORY: '/api/v1/credits/history',
} as const;

// HTTP method per endpoint (used by ApiClient when method not overridden)
export const API_METHODS = {
  [API_ENDPOINTS.HEALTH]: 'GET',
  [API_ENDPOINTS.BUMM_LIST]: 'GET',
  [API_ENDPOINTS.BUMM_GENERATE]: 'POST',
  [API_ENDPOINTS.BUMM_STATUS_GENERATE]: 'GET',
  [API_ENDPOINTS.BUMM_AUDIT]: 'POST',
  [API_ENDPOINTS.BUMM_AUDIT_STATUS]: 'GET',
  [API_ENDPOINTS.BUMM_BUILD]: 'POST',
  [API_ENDPOINTS.BUMM_BUILD_STATUS]: 'GET',
  [API_ENDPOINTS.BUMM_DEPLOY]: 'POST',
  [API_ENDPOINTS.BUMM_DEPLOY_STATUS]: 'GET',
  [API_ENDPOINTS.USER_WALLET]: 'POST',
  [API_ENDPOINTS.CHAT_MESSAGE]: 'POST',
  [API_ENDPOINTS.CHAT_HISTORY]: 'GET',
  [API_ENDPOINTS.CHAT_UNLINKED]: 'GET'
} as const;

// Request settings
export const API_CONFIG = {
  TIMEOUT: 60000, // 60 seconds (chat/generation can take 15-30 sec)
  RETRY_ATTEMPTS: 2,
  RETRY_DELAY: 1000, // 1 second
  POLL_INTERVAL: 2000, // 2 seconds for status polling
  MAX_POLL_ATTEMPTS: 10, // 1 minute maximum
} as const;

// Task statuses (must match backend API responses exactly)
export const TASK_STATUS = {
  GENERATE: {
    NEW: 'new',
    INITIALIZING: 'initializing',
    INITIALIZED: 'initialized',
    GENERATING: 'generating',
    GENERATED: 'generated',
    TESTING: 'testing',
    TESTED: 'tested',
    DEPLOYING: 'deploying',
    DEPLOYED: 'deployed',
    ERROR: 'error',
  },
  AUDIT: {
    NEW: 'new',
    AUDITING: 'auditing',
    AUDITED: 'audited',
    ERROR: 'error',
  },
  BUILD: {
    NEW: 'new',
    BUILDING: 'building',
    BUILT: 'built',
    ERROR: 'error',
  },
  DEPLOY: {
    NEW: 'new',
    DEPLOYING: 'deploying',
    DEPLOYED: 'deployed',
    ERROR: 'error',
  },
} as const;

// Check if status is completed
export const isTaskCompleted = (status: string, taskType: 'generate' | 'audit' | 'build' | 'deploy'): boolean => {
  switch (taskType) {
    case 'generate':
      return status === TASK_STATUS.GENERATE.GENERATED || status === TASK_STATUS.GENERATE.DEPLOYED;
    case 'audit':
      return status === TASK_STATUS.AUDIT.AUDITED;
    case 'build':
      return status === TASK_STATUS.BUILD.BUILT;
    case 'deploy':
      return status === TASK_STATUS.DEPLOY.DEPLOYED;
    default:
      return false;
  }
};

// Check if status is error (backend returns 'error' for all task types)
export const isTaskError = (status: string): boolean => {
  return status === 'error';
};

// Get human-readable status
export const getStatusDisplayName = (status: string): string => {
  const statusMap: Record<string, string> = {
    'new': 'New',
    'initializing': 'Initializing',
    'initialized': 'Initialized',
    'generating': 'Generating',
    'generated': 'Generated',
    'testing': 'Testing',
    'tested': 'Tested',
    'deploying': 'Deploying',
    'deployed': 'Deployed',
    'error': 'Error',
    'auditing': 'Auditing',
    'audited': 'Audited',
    'building': 'Building',
    'built': 'Built',
  };

  return statusMap[status] || status;
};

// Get progress from status
export const getProgressFromStatus = (status: string): { stage: string; progress: number; message: string } => {
  const statusMap: Record<string, { stage: string; progress: number; message: string }> = {
    // Generate statuses
    'new': { stage: 'initializing', progress: 10, message: 'Initializing...' },
    'initializing': { stage: 'initializing', progress: 30, message: 'Setting up environment...' },
    'generating': { stage: 'generating', progress: 60, message: 'Generating smart contract...' },
    'generated': { stage: 'completed', progress: 100, message: 'Contract generated successfully!' },
    'testing': { stage: 'testing', progress: 80, message: 'Running tests...' },
    'tested': { stage: 'deploying', progress: 90, message: 'Preparing for deployment...' },
    'deploying': { stage: 'deploying', progress: 95, message: 'Deploying to network...' },
    'deployed': { stage: 'completed', progress: 100, message: 'Contract deployed successfully!' },
    'error': { stage: 'error', progress: 0, message: 'Generation failed' },
    
    // Audit statuses
    'auditing': { stage: 'generating', progress: 50, message: 'Analyzing code...' },
    'audited': { stage: 'completed', progress: 100, message: 'Audit completed!' },
    
    // Build statuses
    'building': { stage: 'generating', progress: 50, message: 'Building contract...' },
    'built': { stage: 'completed', progress: 100, message: 'Build completed!' },
    
    // Deploy statuses (same keys as generate deploying/deployed, context determines meaning)
  };

  return statusMap[status] || { stage: 'initializing', progress: 0, message: 'Processing...' };
};

export default API_BASE_URL;
