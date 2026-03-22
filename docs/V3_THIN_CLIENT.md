# BUMM Frontend v3 — Thin API client

**Spec version:** Hybrid Architecture **v3.1** (March 20, 2026)  
**Status:** This repository is the **primary frontend** for the new platform; the backend lives in a separate repo.

## Repositories

| Component | GitHub |
|-----------|--------|
| **Frontend (this project)** | [bumm-ai/frontend_v3](https://github.com/bumm-ai/frontend_v3) |
| **Backend (LangGraph pipeline, FastAPI)** | [bumm-ai/backend_v3](https://github.com/bumm-ai/backend_v3) |

## Role of the frontend

The frontend does **not** know about LangGraph, KB, Qdrant, etc. It only:

- Connects the wallet and obtains `user_uid`;
- Calls the new **REST** API (`/api/v1/...`);
- Signs credit purchase transactions (SOL/USDC) when needed;
- Subscribes via **WebSocket** to pipeline phases (`generating`, `building`, `deploying`, …);
- Displays code, audit report, `program_id`, and Explorer links.

## Target flow (after backend implementation)

1. `POST /api/v1/auth/wallet` (or equivalent) → `user_uid`
2. `POST /api/v1/contracts/` with `{ prompt, network? }` → `{ uid, status_url, ws_url }`
3. WebSocket on `ws_url` → stream of phase updates
4. On completion: code, audit, `program_id`

For full endpoint details see **BUMM AI v3.1** (sections 7–8); planned path constants: `src/config/api.v3.planned.ts`.

## Files that change when migrating from the “old” API

Per v3.1 (guideline):

- `src/config/api.ts` — new paths + WS
- `src/services/api.ts` — client + optional WS helper
- `src/services/bummService.ts` / `src/hooks/useBummApi.ts` — pipeline + WS instead of separate poll modals for build/audit/deploy where appropriate
- `ChatScreen.tsx`, `Dashboard.tsx` — simplified flow
- `InteractiveCodeEditor.tsx` — overflow / `pre` styles

## Local development

1. Run the backend from [backend_v3](https://github.com/bumm-ai/backend_v3) (typically port **8080**).
2. Copy `.env.example` → `.env.local` in the frontend root and set `BACKEND_URL` to your API.
3. `npm install && npm run dev` — requests go to the backend via `/api/backend/*`.

## Full technical specification

The **Hybrid Architecture v3.1** summary lives in `docs/TECHNICAL_SPEC_V3_1.md` (for context in other chats and for Claude).
