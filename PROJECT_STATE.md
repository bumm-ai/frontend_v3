# PROJECT_STATE.md — Bumm AI Frontend v3

> Living document. Update after every completed feature/session.
> Claude reads this at session start to understand current state.

## Last Updated
- **Date:** 2026-04-30
- **By:** Nikolas + Claude Code — Week 5 + Week 6 frontend deltas: rose-coloured "Re-deploy required" banner driven by Migration 0010's `requires_redeploy` / `stale_program_id` flags, Retry-Deploy button (`canRetryDeploy` derivation), WS+REST polling fallback in `useContractStream` (closes the WS-died-during-deploy edge case), `RegenerateFeedbackModal` for `POST /regenerate`, paste-mode "Apply edits" surface for `PUT /code`, stage timers / pipeline stages card, error-translate utility. Week 5 + Week 6 dev logs added under `docs/`.

---

## Architecture Overview

The frontend is a **thin orchestration client** — it does not contain any LangGraph, knowledge base, or pipeline logic. All heavy lifting happens in `backend_v3`.

```
User → Dashboard.tsx
         ├── useContractStream (WS + REST polling fallback) → backend /ws/contracts/{uid}, /status, /code
         ├── deriveUIFromStatus (pure fn)                   → drives ALL button/animation state
         ├── handleStartStep (optimistic)                   → POST /build/{uid} | /audit/{uid} | /deploy/{uid}
         ├── handleRetryDeploy                              → reuses /deploy/{uid} after find_so-bug recovery
         └── ChatScreen.tsx                                 → chat + ActionButton + code editor + Re-deploy banner
```

### Two distinct user flows

| Flow | Entry | Contract creation | Build trigger |
|------|-------|-------------------|---------------|
| **AI Generate** | User types prompt in chat | `POST /contracts` with `step_mode:true, prompt` | User clicks Build button |
| **Paste Code** | User pastes Rust/Anchor into editor | `POST /contracts` with `step_mode:true, code` | User clicks Review → Build button |

For **API/MCP consumers**: `POST /contracts` with `step_mode:false` — pipeline runs fully automatically through to deploy without any frontend interaction.

---

## Current State (all features complete and verified)

### Core UI Architecture

#### `deriveUIFromStatus` — pure function, single source of truth
**File:** `src/hooks/useContract.ts`

Maps `ContractStatus | null` + `hasCode: boolean` + optional `pendingStep` → `{ buttonState, animationStage }`.

Priority rules:
1. **`pendingStep` optimistic override** — immediately shows loader when user clicks a step button, before first WS heartbeat arrives (prevents the 5–15s dead zone)
2. **`build_ok` / `audit_ok` / `program_id` flags** take precedence over `phase` — stale WS heartbeats cannot re-arm finished animations
3. **Phase-based animation** — only while the step is genuinely running (`phase=building` + `build_ok=false`)
4. **Monotonic idle state** — `program_id → upgrade`, `audit_ok → publish`, `build_ok → audit`, `hasCode → build`, else `inactive`

28 unit tests: `src/hooks/__tests__/deriveUIFromStatus.test.ts` — **28/28 PASS**

#### `pendingStep` — anti-double-click optimistic state
**File:** `src/components/dashboard/Dashboard.tsx`

```typescript
const [pendingStep, setPendingStep] = useState<'build' | 'audit' | 'deploy' | null>(null);
const pendingStepRef = useRef(pendingStep);
```

- Set on button click **before** any async operation
- `pendingStepRef` allows transition effect (locked to `[contract.status]` deps) to read latest value without stale closure
- Guard: `if (pendingStepRef.current) return` at top of `handleStartStep` — O(1), no race possible
- Cleared when WS confirms phase transition, or on error

#### `ChatScreen` — `actionButtonState` derivation fix
**File:** `src/components/dashboard/ChatScreen.tsx`

```typescript
const actionButtonState: ActionButtonState =
  buttonStateProp && buttonStateProp !== 'inactive'
    ? buttonStateProp
    : localButtonState;
```

`'inactive'` is treated as a fallback (like `null`) so that `localButtonState = 'review'` (from user pasting code) can surface even when Dashboard returns `'inactive'` (no project loaded from its perspective).

### API Client
**File:** `src/services/api.ts`

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `createContract` | `POST /api/v1/contracts` | Start pipeline (prompt or paste mode) |
| `getContractStatus` | `GET /api/v1/contracts/{uid}/status` | Poll status |
| `getContractCode` | `GET /api/v1/contracts/{uid}/code` | Fetch generated code |
| `getContractAudit` | `GET /api/v1/contracts/{uid}/audit` | Fetch audit vulns |
| `getContractFixes` | `GET /api/v1/contracts/{uid}/fixes` | Fetch build auto-fixes |
| `triggerBuild` | `POST /api/v1/build/{uid}` | Trigger build step |
| `triggerAudit` | `POST /api/v1/audit/{uid}` | Trigger audit step |
| `triggerDeploy` | `POST /api/v1/deploy/{uid}?confirm=true` | Trigger deploy step |

### WebSocket + REST polling fallback (`useContractStream`)
**File:** `src/hooks/useContractStream.ts`

- Connects to `/ws/contracts/{uid}?token=<jwt>`.
- JWT expiry (code 4001) → auto refresh via `tryRefresh()` → reconnect.
- Exponential backoff on disconnect: 1 s, 2 s, 5 s, 10 s.
- Closes cleanly on `phase=done|failed` (code 1000).
- **Week 6 — REST polling fallback.** Parallel `setInterval(fetchStatus, 5000)` polls `GET /api/v1/contracts/{uid}/status`; auto-stops on terminal phase via shared `statusCache` check. Closes the WS-died-during-deploy edge case identified in Week 4 known gaps.
- `deriveUIFromStatus` called with live `status` on every WS message *or* polling tick.

### Re-deploy required banner + Retry-Deploy button (Week 6)
**File:** `src/components/dashboard/ChatScreen.tsx`

- `requiresRedeploy = !!contractStatus?.requires_redeploy` — driven by Migration 0010 backend flag.
- Rose-coloured banner with `stale_program_id` prefix and a Re-deploy button. When this banner is active, the existing yellow regenerate banner suppresses itself so the user sees the stronger signal.
- `canRetryDeploy = isFailed && build_ok && audit_ok && !program_id` — surfaces a Retry-Deploy button that reuses backend `_rearm_failed_deploy_if_needed` via `apiClient.triggerDeploy`. Local `retryingDeploy` state gates double-clicks.

### Regenerate feedback flow (Week 5)
**File:** `src/components/ui/RegenerateFeedbackModal.tsx`

- Reachable when `phase ∈ {paused_degraded, failed}`.
- Captures user feedback in a textarea, posts to `/contracts/{uid}/regenerate` with audit-finding context attached server-side.
- Pipeline pauses again at `phase=generated` for review.

### Paste-mode "Apply edits" (Week 5)
- Power-user surface for `PUT /contracts/{uid}/code`. Replaces source on an existing contract outside the LLM loop and chains a build trigger so the pipeline re-runs against the new source.

### Enhanced Chat Notifications
**File:** `src/components/dashboard/Dashboard.tsx`

After each pipeline milestone, a detailed AI message is added to chat:

**[A] Contract generated** — confirms code is ready, shows "Click Build to compile"

**[B] Build complete (first try)** — "✅ Build succeeded on first attempt"

**[C] Build fixed** — shows each fix: `error_pattern → fix_description`, grouped by source (KB vs LLM), e.g.:
```
🔧 Auto-Fix Applied (2 compile errors fixed):
  [KB] Bumps not satisfied → Added #[derive(Accounts)] to TransferNft
  [LLM] Type mismatch in constraint → Changed &ctx.accounts.mint to ctx.accounts.mint
```

**[D] Audit complete** — vulnerability report grouped by severity (CRITICAL > HIGH > MEDIUM > LOW > INFO), each showing title + `suggested_fix`:
```
🔍 Security Audit Complete — 3 issues found:

⚠️ HIGH (1)
  • Reentrancy in transfer — account not locked before CPI
    ↳ Fix applied: Added is_locked flag; check before transfer

📋 Final state before deploy:
  Build: ✅ Passed  |  Audit: ✅ Clean
  Click Publish to deploy to devnet
```

### Paste Flow
When user pastes existing Anchor/Rust into the code editor:
1. `ChatScreen` detects code change → sets `localButtonState = 'review'`
2. User clicks Review → modal → `createPasteContract(code)` → `POST /contracts` with `code` field
3. Contract created with `phase=generated`, `source=paste`, `pipeline_mode=step`
4. WebSocket connects → `deriveUIFromStatus` returns `buttonState='build'`
5. Standard Build → Audit → Deploy flow continues

---

## Test Coverage

| Category | Count | Status |
|----------|-------|--------|
| Unit — `deriveUIFromStatus` | 28 | ✅ all passing (Vitest) |
| E2E | — | Removed (requires auth/Phantom wallet bootstrap) |

Run: `npm test` (Vitest, configured in `vitest.config.ts`)

---

## File Map (key files)

```
frontend_v3/src/
├── app/
│   ├── layout.tsx                    # Root layout + providers
│   ├── page.tsx                      # Landing / redirect to /login
│   └── api/backend/[...path]/route.ts  # Next.js reverse proxy → backend
├── components/dashboard/
│   ├── Dashboard.tsx                 # Main orchestrator — state, WS, step triggers
│   └── ChatScreen.tsx                # Chat UI + ActionButton + code editor
├── hooks/
│   ├── useContract.ts                # deriveUIFromStatus + WebSocket hook
│   ├── useAuth.ts                    # Wallet connect + JWT lifecycle
│   ├── useCredits.ts                 # Credit balance
│   └── __tests__/
│       └── deriveUIFromStatus.test.ts  # 28 unit tests
├── services/
│   ├── api.ts                        # ApiClient (all HTTP + WS calls)
│   └── authService.ts               # tryRefresh + token storage
├── lib/
│   └── api.ts                        # Shared TypeScript types (ContractStatus, etc.)
├── config/
│   └── api.ts                        # Endpoint constants (ENDPOINTS.*)
└── types/
    └── dashboard.ts                  # ActionButtonState, AnimationStage
```

---

## How to Run

```bash
cd frontend_v3
npm install
npm run dev          # localhost:3000
npm test             # Vitest unit tests
npm run build        # TypeScript check + production build
```

Required env vars:
```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8080
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

---

## Weekly dev reports (hackathon / stakeholders)

- **How to write:** **`docs/WEEKLY_DEV_LOG.md`** — each report should **continue** the previous one (delta + logical next step), not restate the entire stack every time.
- **Full journey (6 parts, start → today):**  
  **[Week 1](./docs/DEV_LOG_BUMM_WEEK_01.md)** · **[Week 2](./docs/DEV_LOG_BUMM_WEEK_02.md)** · **[Week 3](./docs/DEV_LOG_BUMM_WEEK_03.md)** · **[Week 4](./docs/DEV_LOG_BUMM_WEEK_04.md)** · **[Week 5](./docs/DEV_LOG_BUMM_WEEK_05.md)** · **[Week 6 — current state](./docs/DEV_LOG_BUMM_WEEK_06.md)** — Week 6 is the **as-of-today** snapshot (audit depth + the `find_so` wrong-binary CRITICAL fix as headline).

---

## Known Gaps / Next Steps

| Item | Priority | Notes |
|------|----------|-------|
| Wallet mock / Playwright E2E | High | Still blocked — carry forward from Week 4. |
| Prompt-cache hit-rate visibility in UI | Medium | Backend logs `cache_read_input_tokens` / `cache_creation_input_tokens`; frontend should surface in dev/admin view. |
| `user_sol_balance` display in deploy modal | Medium | Already filled by backend (`requires_redeploy`, `stale_program_id` exposed); generic SOL surfacing still partial. |
| KB / internal libraries (roadmap) | Medium | Commercial track — scope not detailed in public docs. |
| Modal polling deduplication | ✅ Resolved | Single `useContractStream` instance from Dashboard + REST polling fallback (Week 6). |
