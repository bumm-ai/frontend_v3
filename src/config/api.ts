// API configuration — Bumm AI Backend v3
// REST: when NEXT_PUBLIC_API_URL is set, calls go DIRECT to the backend
// (CORS-allowed). Without it, falls back to the Next.js proxy at /api/backend/*.
// WebSocket connects DIRECTLY to WS_BASE (proxies don't support WS upgrade).

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';
export const WS_BASE  = process.env.NEXT_PUBLIC_WS_URL  ?? 'ws://localhost:8080';

// Direct-to-backend mode: set NEXT_PUBLIC_API_URL=https://api.bumm.io on Vercel
// to skip the Next.js proxy. Backend must include the frontend origin in
// FRONTEND_URL (comma-separated list) so CORS allows the call.
export const API_PROXY = process.env.NEXT_PUBLIC_API_URL ?? '/api/backend';

// Backward-compatible alias used by legacy code
export const API_BASE_URL = API_PROXY;

export const ENDPOINTS = {
  HEALTH:           '/health',
  AUTH_CHALLENGE:   '/api/v1/auth/challenge',
  AUTH_VERIFY:      '/api/v1/auth/verify',
  AUTH_REFRESH:     '/api/v1/auth/refresh',
  AUTH_LOGOUT:      '/api/v1/auth/logout',
  CHAT:             '/api/v1/chat',
  CHAT_APPLY:       (uid: string) => `/api/v1/chat/${uid}/apply`,
  CHAT_DECLINE:     (uid: string) => `/api/v1/chat/${uid}/decline`,
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
  // Tier 2.2 — deep-regen approval gate. Frontend RegenConfirmCard calls
  // these when the user clicks Approve / Decline on a paused-for-approval
  // contract (intervention_reason === "awaiting_regen_approval").
  CONTRACT_APPROVE_REGEN:   (uid: string) => `/api/v1/contracts/${uid}/approve-regen`,
  CONTRACT_DECLINE_REGEN:   (uid: string) => `/api/v1/contracts/${uid}/decline-regen`,
  // Step-mode endpoints — used by BuildModal / AuditModal / DeployModal
  CONTRACT_BUILD:        (uid: string) => `/api/v1/build/${uid}`,
  CONTRACT_AUDIT_STEP:   (uid: string) => `/api/v1/audit/${uid}`,
  CONTRACT_DEPLOY_STEP:  (uid: string) => `/api/v1/deploy/${uid}`,
  CREDITS_BALANCE:  '/api/v1/credits/balance',
  CREDITS_PURCHASE: '/api/v1/credits/purchase',
  CREDITS_HISTORY:  '/api/v1/credits/history',
  CREDITS_RATES:    '/api/v1/credits/rates',
  // Connects directly to the backend (bypasses Next.js proxy which buffers streams)
  // Token passed as ?token= query param since EventSource cannot set headers.
  LOGS_STREAM:      (uid: string) => `${API_BASE}/api/v1/contracts/${uid}/logs/stream`,
  // Global build-farm queue state (public, no auth). Polled while a build runs.
  SYSTEM_BUILD_QUEUE: '/api/v1/system/build-queue',
} as const;

export const API_CONFIG = {
  TIMEOUT:          60_000,
  RETRY_ATTEMPTS:   2,
  RETRY_DELAY:      1_000,
  POLL_INTERVAL:    2_000,
  MAX_POLL_ATTEMPTS: 10,
} as const;

export default API_PROXY;
