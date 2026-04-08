# CLAUDE.md — Bumm AI Frontend v3

> Single source of truth for Claude Code. Keep under 120 lines. Deep specs → `PROJECT_STATE.md`.

## Project Overview

**Bumm AI Frontend v3** — thin orchestration client for the Bumm AI platform.
The frontend does NOT implement LangGraph, KB, or pipeline — only UI, wallet, API calls, WebSocket streaming.

Two user flows:
- **AI Generate** — user types prompt → backend generates Anchor/Rust → user clicks Build → Audit → Deploy
- **Paste Code** — user pastes own contract → clicks Review → Build → Audit → Deploy

API/MCP clients skip the frontend entirely: `step_mode=false` runs the full pipeline automatically.

## Tech Stack

- **Next.js 15.5** (App Router, NOT Pages Router)
- **React 19** — functional components only, hooks for all business logic
- **TypeScript** strict mode
- **Tailwind CSS 4** (utility-first, no custom CSS unless necessary)
- **Framer Motion** + **GSAP** for animations
- **Solana Wallet Adapter** + **Web3.js**
- **Vitest** for unit tests (NOT Jest)

## Architecture

```
Dashboard.tsx → useContract (WS + API) → ApiClient → Next.js proxy (/api/backend/*) → Backend
                    ↓
             deriveUIFromStatus (pure fn, single source of truth for all button/animation state)
```

Key invariant: `deriveUIFromStatus` is the ONLY place that maps status → UI state. Never derive button state inline in components.

## Critical: `deriveUIFromStatus` Rules

1. `pendingStep` optimistic override fires FIRST (prevents double-click dead zone)
2. `build_ok` / `audit_ok` / `program_id` flags beat `phase` (stale WS heartbeats cannot re-arm done animations)
3. `'inactive'` from backend is treated as a fallback in `ChatScreen` (allows local `'review'` state to surface for paste flow)

See: `src/hooks/useContract.ts`, `src/hooks/__tests__/deriveUIFromStatus.test.ts` (28 tests)

## Coding Standards

- Functional components only, no class components
- Custom hooks for all business logic (`use` prefix)
- No `any` types — strict TypeScript
- No god components (max ~200 lines, extract sub-components)
- Naming: PascalCase components, camelCase functions/variables
- Imports: absolute paths via `@/` alias
- No direct backend calls from components — always through `ApiClient` in `src/services/api.ts`
- `localStorage` keys prefixed with `bumm_`; backend is the source of truth for contract state

## File Structure

```
src/
├── app/                  # Next.js App Router pages + proxy route
├── components/dashboard/ # Dashboard.tsx (orchestrator) + ChatScreen.tsx (UI)
├── hooks/                # useContract, useAuth, useCredits, useGSAPAnimations
│   └── __tests__/        # Vitest unit tests
├── services/             # api.ts (ApiClient), authService.ts
├── lib/                  # api.ts (shared TS types: ContractStatus, etc.)
├── config/               # api.ts (ENDPOINTS constants)
└── types/                # dashboard.ts (ActionButtonState, AnimationStage)
```

## Testing

- **Vitest** — `npm test` (configured in `vitest.config.ts`)
- Unit tests in `src/hooks/__tests__/`
- No E2E (Playwright removed — blocked by Phantom wallet bootstrap)
- Coverage target: >70% for hooks

## Commands

```bash
npm run dev          # Dev server (port 3000)
npm run build        # Production build + TypeScript check
npm run lint         # ESLint
npm test             # Vitest unit tests
npm run test:watch   # Vitest watch mode
```

## Workflow

1. **Read** `PROJECT_STATE.md` to understand current state
2. **Plan** — discuss approach, reference spec
3. **Implement** — Cursor for UI/styling speed
4. **Verify** — `tsc --noEmit` + `npm test`
5. **Update** — `PROJECT_STATE.md` after every completed feature

## Pre-commit checks

- `npm run lint`
- `npm run build` (type check)
- `npm test` (Vitest)
