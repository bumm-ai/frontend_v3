/**
 * BUMM AI v3.1 — planned API surface (thin client target).
 * NOT wired yet — use as reference when backend_v3 implements OpenAPI.
 *
 * @see docs/V3_THIN_CLIENT.md
 * @see docs/TECHNICAL_SPEC_V3_1.md
 */

export const API_V3_PLANNED = {
  /** Auth */
  AUTH_WALLET: '/api/v1/auth/wallet',

  /** Full pipeline (LangGraph on server) */
  CONTRACTS: '/api/v1/contracts/',
  contractStatus: (uid: string) => `/api/v1/contracts/${uid}/status`,
  contractCode: (uid: string) => `/api/v1/contracts/${uid}/code`,
  contractAudit: (uid: string) => `/api/v1/contracts/${uid}/audit`,
  contractResume: (uid: string) => `/api/v1/contracts/${uid}/resume`,

  /** Individual steps (advanced) */
  GENERATE: '/api/v1/generate',
  build: (uid: string) => `/api/v1/build/${uid}`,
  audit: (uid: string) => `/api/v1/audit/${uid}`,
  deploy: (uid: string) => `/api/v1/deploy/${uid}`,

  /** Credits */
  CREDITS_BALANCE: '/api/v1/credits/balance',
  CREDITS_PURCHASE: '/api/v1/credits/purchase',

  /**
   * WebSocket path (browser may need absolute URL: wss://host/ws/...)
   * Spec: /ws/contracts/{uid}
   */
  wsContract: (uid: string) => `/ws/contracts/${uid}`,
} as const;
