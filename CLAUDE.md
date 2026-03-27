# CLAUDE.md — Bumm AI Frontend v3 (thin client)

> Single source of truth for Claude Code Desktop + Claude Projects.
> Keep under 100 lines. Deep specs → `/docs/`.

## Project Overview

**Bumm AI Frontend v3** — thin API client for the Bumm AI platform.
The frontend does NOT implement LangGraph, KB, or pipeline — only UI, wallet, API calls, WebSocket status streaming.

- **This repo:** `frontend_v3` — Next.js 15 App Router, React 19
- **Backend:** `backend_v3` — FastAPI + LangGraph (separate repo, port 8080)
- **Spec:** `docs/TECHNICAL_SPEC_V3_1.md`, `docs/V3_THIN_CLIENT.md`

## Tech Stack

- **Next.js 15.5** (App Router, NOT Pages Router)
- **React 19** with hooks (functional components only)
- **TypeScript** strict mode
- **Tailwind CSS 4** (utility-first, no custom CSS unless necessary)
- **Framer Motion** + **GSAP** for animations
- **Solana Wallet Adapter** + **Web3.js**

## Architecture

```
Component → useBummApi hook → bummService → ApiClient → Next.js proxy → Backend
```

- Proxy: `src/app/api/backend/[...path]/route.ts` → `BACKEND_URL`
- Mock fallback: `src/lib/mockApi.ts` (auto on network/500 errors)
- Auth: wallet connect → `POST /api/v1/user/wallet/` → `x-user-id` header
- Status: polling (current) → WebSocket (v3.1 target)

## Coding Standards

- Functional components only, no class components
- Custom hooks for all business logic (`use` prefix)
- No `any` types — strict TypeScript
- No god components (max 150 lines, extract sub-components)
- Naming: PascalCase components, camelCase functions/variables
- Imports: absolute paths via `@/` alias
- No direct backend calls from components — always through service layer
- localStorage keys prefixed with `bumm_`

## File Structure Rules

- `src/app/` — pages and API routes (App Router)
- `src/components/` — reusable UI components
- `src/hooks/` — custom React hooks
- `src/services/` — API client, business logic
- `src/config/` — constants, endpoints
- `src/lib/` — utilities, helpers
- `src/types/` — TypeScript types/interfaces

## Testing Strategy

- Jest + React Testing Library
- Test hooks with `renderHook`
- Mock API responses, never hit real backend in tests
- Coverage target: >70%
- Run: `npm test`, `npm run test:coverage`

## Workflow (strict order)

1. **Plan** → discuss in Claude Code, reference spec
2. **Tests** → write component/hook tests first
3. **Implement** → Cursor for UI/styling speed
4. **Review** → Claude Code checks architecture compliance
5. **Docs** → update this file + relevant docs
6. **Integrate** → PR, lint passes, merge

## Commands

```bash
npm run dev          # Start dev server (port 3000)
npm run build        # Production build
npm run lint         # ESLint
npm test             # Jest
npm run test:coverage
```

## Key Migration Notes (v2 → v3.1)

- Replace polling with WebSocket (`/ws/contracts/{uid}`)
- Use `bummUid` only (no fallback to contractCode)
- Credits refresh after pipeline completion
- Chat history from backend, not localStorage

## Hooks (pre-commit)

- `npm run lint`
- `npm run build` (type check)
- `npm test -- --watchAll=false`
