# CLAUDE.md — Project Context for Claude AI

## Bumm Frontend **v3** (primary repo for new work)

- **This codebase** is **Bumm AI Frontend v3** — a **thin API client** for the new backend.
- **Backend (new stack):** [bumm-ai/backend_v3](https://github.com/bumm-ai/backend_v3) — FastAPI + LangGraph pipeline (Hybrid Architecture v3.1). Do **not** assume legacy `bumm-api-2.0` behavior for new features.
- **Spec:** `docs/TECHNICAL_SPEC_V3_1.md`, thin-client notes: `docs/V3_THIN_CLIENT.md`.
- **Planned API paths (reference only):** `src/config/api.v3.planned.ts`.
- **Proxy:** `src/app/api/backend/[...path]/route.ts` uses `BACKEND_URL` from env (default `http://127.0.0.1:8080`). Set in `.env.local` for local `backend_v3`.

The sections below still describe the **current** UI structure (inherited from v2); migrating to WebSocket pipeline + `/api/v1/contracts/` is **in progress** per v3.1 spec.

---

This file provides context for Claude AI when working with this codebase. It describes the architecture, conventions, and key patterns used in the project.

## Project Overview

**Bumm Frontend** is a Next.js 15 (App Router) dApp for AI-powered Solana smart contract generation. Users connect their Solana wallet, describe a smart contract in natural language, and the platform generates, audits, builds, and deploys it.

## Technology Stack

- **Next.js 15.5** with App Router (NOT Pages Router)
- **React 19** with hooks
- **TypeScript** strict mode
- **Tailwind CSS 4** for styling
- **Framer Motion** + **GSAP** for animations
- **Solana Wallet Adapter** for blockchain connectivity
- **Solana Web3.js** for blockchain interactions

## Architecture & Data Flow

### API Layer (3-tier)
```
Component → useBummApi hook → bummService → ApiClient (services/api.ts) → Next.js proxy → Backend
```

1. **`src/config/api.ts`** — All API endpoints, status constants, and helper functions
2. **`src/services/api.ts`** — Low-level HTTP client (`ApiClient` class) with retries, timeouts, x-user-id header
3. **`src/services/bummService.ts`** — Business logic wrapper around ApiClient
4. **`src/lib/api.ts`** — `BummApiClient` facade that delegates to bummService (for backward compatibility)
5. **`src/hooks/useBummApi.ts`** — React hook that components use. Handles state, mock fallback, and status polling

### API Proxy (CORS bypass)
Frontend calls `/api/backend/*` which are Next.js API routes that proxy to the FastAPI backend. This avoids CORS issues since browser only talks to localhost:3000.

- **Proxy route**: `src/app/api/backend/[...path]/route.ts`
- **Backend URL**: `BACKEND_URL` environment variable (see `.env.example`; default `http://127.0.0.1:8080` in `route.ts`)
- **Health check**: `src/app/api/backend/health/route.ts`

### Mock API Fallback
When the real backend is unavailable, the system falls back to `src/lib/mockApi.ts`. The fallback is triggered by critical errors (network, CORS, timeout, 500) in `useBummApi.ts`.

### Authentication
1. User connects Solana wallet → `POST /api/v1/user/wallet/` with `{ wallet: "<pubkey>" }`
2. Backend returns `{ uid: "<uuid>" }`
3. UUID is saved to `localStorage` and sent as `x-user-id` header on all subsequent requests
4. `ApiClient` manages the header via `setUserId()`

### Status Polling
Long-running operations (generate, audit, build, deploy) use polling:
1. `POST /api/v1/bumm/generate/` returns `{ uid: "<bumm-uid>", status: "new" }`
2. Frontend polls `GET /api/v1/bumm/status/generate/<bumm-uid>/` every 5 seconds
3. Status progresses: `new` → `initializing` → `generating` → `generated` (or `error`)
4. **Important**: The `bumm-uid` from the backend response must be used for polling, NOT the local project UID. Projects store this in the `bummUid` field.

## Key Files to Understand

| File | What it does | When to modify |
|------|-------------|----------------|
| `src/hooks/useBummApi.ts` | Main API integration hook with mock fallback | Adding new API operations or changing flow |
| `src/components/dashboard/Dashboard.tsx` | Main orchestrator — handles all user actions | Adding new features or changing user flows |
| `src/components/dashboard/ChatScreen.tsx` | AI chat UI + code editor + modals | Changing chat UX or adding new modals |
| `src/config/api.ts` | API config, endpoints, status constants | Adding new endpoints or changing status values |
| `src/services/api.ts` | HTTP client with retries | Changing HTTP behavior |
| `src/services/bummService.ts` | Business logic wrapping API calls | Adding new backend operations |
| `src/types/dashboard.ts` | All TypeScript interfaces | Adding new data fields |
| `src/app/api/backend/[...path]/route.ts` | API proxy to backend | Changing backend URL |

## Code Conventions

### Component Structure
- All page components are in `src/app/` (Next.js App Router)
- Dashboard is a single-page app: `page.tsx` → `Dashboard.tsx` → `ChatScreen.tsx`
- UI components are in `src/components/ui/`
- State is managed via React hooks (no Redux/Zustand)

### Naming
- Hooks: `use*.ts` in `src/hooks/`
- Services: `*Service.ts` in `src/services/`
- Types: defined in `src/types/dashboard.ts`
- Components: PascalCase `.tsx` files

### State Management
- `useBummApi` hook manages: user, projects, loading, errors, API calls
- `useCredits` hook manages: credit balance, spending, pricing
- Projects are stored in React state and localStorage
- No global state library — everything flows through hooks

### Styling
- Tailwind CSS utility classes (no CSS modules)
- Color scheme: dark theme with `bg-[#101010]` as base
- Animations: Framer Motion for page transitions, GSAP for complex sequences
- Responsive: Mobile-first approach

## Backend API (FastAPI)

**Production / legacy reference:** [bumm-ai/bumm-api-2.0](https://github.com/bumm-ai/bumm-api-2.0).  
**v3 target:** [bumm-ai/backend_v3](https://github.com/bumm-ai/backend_v3) — new endpoints per `docs/TECHNICAL_SPEC_V3_1.md`.

### Endpoints the frontend uses:
- `POST /api/v1/user/wallet/` — Create/get user by wallet
- `GET /api/v1/bumm/list/` — List user projects (requires `x-user-id`)
- `POST /api/v1/bumm/generate/` — Start contract generation
- `GET /api/v1/bumm/status/generate/{uid}/` — Poll generation status
- `POST /api/v1/bumm/audit/` — Start security audit
- `GET /api/v1/bumm/audit/status/{uid}/` — Poll audit status
- `POST /api/v1/bumm/build/` — Start contract build
- `GET /api/v1/bumm/build/status/{uid}/` — Poll build status
- `POST /api/v1/bumm/deploy/` — Start deployment
- `GET /api/v1/bumm/deploy/status/{uid}/` — Poll deploy status

### Status Values (from backend):
- **Generate**: `new`, `initializing`, `initialized`, `generating`, `generated`, `testing`, `tested`, `deploying`, `deployed`, `error`
- **Audit**: `new`, `auditing`, `audited`, `error`
- **Build**: `new`, `building`, `built`, `error`
- **Deploy**: `new`, `deploying`, `deployed`, `error`

## Common Tasks

### Adding a new API endpoint
1. Add endpoint path to `src/config/api.ts` → `API_ENDPOINTS`
2. Add HTTP method to `API_METHODS`
3. Add method to `src/services/api.ts` → `ApiClient`
4. Add wrapper to `src/services/bummService.ts`
5. Add facade method to `src/lib/api.ts` if needed
6. Use in `useBummApi` hook or create a new hook

### Adding a new UI modal
1. Create component in `src/components/ui/YourModal.tsx`
2. Add state to `ChatScreen.tsx` for visibility toggle
3. Wire trigger from SmartActionButton or other component
4. Add corresponding API call if needed

### Changing the backend URL
Set `BACKEND_URL` in `.env.local` (see `.env.example`). Defaults are defined in `src/app/api/backend/[...path]/route.ts` if unset.

### Adding a new status to track
1. Update `TASK_STATUS` in `src/config/api.ts`
2. Update `isTaskCompleted()` and `isTaskError()` if needed
3. Update `getStatusDisplayName()` and `getProgressFromStatus()`
4. Update `trackTaskStatus` in `useBummApi.ts` if new task type

## Known Patterns & Gotchas

1. **bummUid vs project.uid**: When a user creates a project locally, it gets a local UID like `project_123456`. When calling the backend (generate/build/audit), the backend returns its own `bummUid`. The `bummUid` must be used for status polling, not the local project UID. Projects store this in the `bummUid` field.

2. **Mock API fallback**: If the backend returns a critical error (network, CORS, 500), `useBummApi` automatically falls back to `mockApi.ts`. This is logged with `🔄 Falling back to Mock API`.

3. **localStorage usage**: User UID, wallet address, current project, chat history, and contract code are all persisted in localStorage. Keys are prefixed with `bumm_`.

4. **API calls go through proxy**: Never call the backend directly from the browser. Always use the Next.js API proxy at `/api/backend/*` to avoid CORS.

5. **Credit system**: Currently credits are tracked client-side only. The backend credit endpoints exist but are not fully wired up on the frontend yet.

6. **Wallet connection flow**: `WalletProvider.tsx` sets up the Solana wallet adapter. When wallet connects, `useBummApi`'s `useEffect` fires → calls `initializeUser()` → `POST /api/v1/user/wallet/`.
