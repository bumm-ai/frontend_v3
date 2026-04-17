// API configuration — Bumm AI Backend v3
// REST goes through the Next.js proxy at /api/backend/* (avoids CORS).
// WebSocket connects DIRECTLY to WS_BASE (proxies don't support WS upgrade).

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
export const WS_BASE  = process.env.NEXT_PUBLIC_WS_URL  ?? 'ws://localhost:8080';

// Browser-facing base for REST calls through Next.js proxy
export const API_PROXY = '/api/backend';

// Backward-compatible alias used by legacy code
export const API_BASE_URL = API_PROXY;

export const ENDPOINTS = {
  HEALTH:           '/health',
  AUTH_CHALLENGE:   '/api/v1/auth/challenge',
  AUTH_VERIFY:      '/api/v1/auth/verify',
  AUTH_REFRESH:     '/api/v1/auth/refresh',
  AUTH_LOGOUT:      '/api/v1/auth/logout',
  CHAT:             '/api/v1/chat',
  CONTRACTS:        '/api/v1/contracts',
  CONTRACT_STATUS:  (uid: string) => `/api/v1/contracts/${uid}/status`,
  CONTRACT_CODE:    (uid: string) => `/api/v1/contracts/${uid}/code`,
  CONTRACT_AUDIT:   (uid: string) => `/api/v1/contracts/${uid}/audit`,
  CONTRACT_CHAT:            (uid: string) => `/api/v1/contracts/${uid}/chat`,
  CONTRACT_UPDATE:          (uid: string) => `/api/v1/contracts/${uid}`,
  CONTRACT_DELETE:          (uid: string) => `/api/v1/contracts/${uid}`,
  CONTRACT_DEPLOY_ESTIMATE: (uid: string) => `/api/v1/contracts/${uid}/deploy-estimate`,
  CONTRACT_FIXES:           (uid: string) => `/api/v1/contracts/${uid}/fixes`,
  CONTRACT_CANCEL:          (uid: string) => `/api/v1/contracts/${uid}/cancel`,
  CONTRACT_FORK:            (uid: string) => `/api/v1/contracts/${uid}/fork`,
  CONTRACT_ROLLBACK:        (uid: string) => `/api/v1/contracts/${uid}/rollback`,
  // Step-mode endpoints — used by BuildModal / AuditModal / DeployModal
  CONTRACT_BUILD:        (uid: string) => `/api/v1/build/${uid}`,
  CONTRACT_AUDIT_STEP:   (uid: string) => `/api/v1/audit/${uid}`,
  CONTRACT_DEPLOY_STEP:  (uid: string) => `/api/v1/deploy/${uid}`,
  CREDITS_BALANCE:  '/api/v1/credits/balance',
  CREDITS_PURCHASE: '/api/v1/credits/purchase',
  CREDITS_HISTORY:  '/api/v1/credits/history',
  CREDITS_RATES:    '/api/v1/credits/rates',
  WS_CONTRACT:      (uid: string) => `${WS_BASE}/ws/contracts/${uid}`,
  WS_CREDITS:       `${WS_BASE}/ws/credits`,
  // Connects directly to the backend (bypasses Next.js proxy which buffers streams)
  // Token passed as ?token= query param since EventSource cannot set headers.
  LOGS_STREAM:      (uid: string) => `${API_BASE}/api/v1/contracts/${uid}/logs/stream`,
} as const;

// Legacy v2 endpoints — kept for backward compat with existing UI components.
// These no longer exist in backend_v3 and will return 404.
// TODO: remove when all UI components are migrated to v3.
const LEGACY_ENDPOINTS = {
  BUMM_LIST:           '/api/v1/list/',
  BUMM_GENERATE:       '/api/v1/generate/',
  BUMM_STATUS_GENERATE:'/api/v1/status/generate/',
  BUMM_AUDIT:          '/api/v1/audit/',
  BUMM_AUDIT_STATUS:   '/api/v1/audit/status/',
  BUMM_BUILD:          '/api/v1/build/',
  BUMM_BUILD_STATUS:   '/api/v1/build/status/',
  BUMM_DEPLOY:         '/api/v1/deploy/',
  BUMM_DEPLOY_STATUS:  '/api/v1/deploy/status/',
  USER_WALLET:         '/api/v1/user/wallet/',
  CHAT_MESSAGE:        '/api/v1/chat/message/',
  CHAT_HISTORY:        '/api/v1/chat/history',
  CHAT_UNLINKED:       '/api/v1/chat/unlinked',
  CREDITS_RATES:       '/api/v1/credits/rates',
  CREDITS_PRICING:     '/api/v1/credits/pricing',
  CREDITS_SPEND:       '/api/v1/credits/spend',
  CREDITS_HISTORY:     '/api/v1/credits/history',
} as const;

// Keep old ENDPOINTS name for legacy imports — merges v3 + legacy v2
export const API_ENDPOINTS = { ...ENDPOINTS, ...LEGACY_ENDPOINTS } as const;

export const API_CONFIG = {
  TIMEOUT:          60_000,
  RETRY_ATTEMPTS:   2,
  RETRY_DELAY:      1_000,
  POLL_INTERVAL:    2_000,
  MAX_POLL_ATTEMPTS: 10,
} as const;

export default API_PROXY;
