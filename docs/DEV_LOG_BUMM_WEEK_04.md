# Dev log — BUMM (Week 4 of 4) — Unified streaming client, docs, hardening — **current state**

**Period:** `[insert dates — through today]`  
**Product:** Bumm AI — Solana/Anchor smart contract generation and pipeline (human-in-the-loop + API/MCP)

**Continues:** [Week 3 — Observability & transparency](./DEV_LOG_BUMM_WEEK_03.md)

---

## One-paragraph summary

We **consolidated** the Week 3 real-time pieces into a **single client story**: **`useContractStream`** subscribes via **`wsHub`** to **`contract:{uid}`**, keeps a **cross-navigation status cache**, and **seeds state from REST** on `uid` change so reloads and project switches feel instant. **`deriveAnimationStage`** derives animation purely from backend fields (including **`next_step`**) without fragile client session flags. We **tightened** pipeline paths (**chat**, **finalize**, **fix** nodes) for edge cases, maintained **modals** that combine polling for completion with **SSE log** and **fix-diff** views, and documented **how we report progress** (`WEEKLY_DEV_LOG.md`, dev log series, `PROJECT_STATE.md`). **This week’s document is the “as of today” snapshot** — together with Weeks 1–3 it covers the journey **from platform bootstrap to the current shipped behavior**.

---

## Backend (this phase)

- Incremental **stability** on chat, finalize, and fix nodes aligned with step-mode.
- **No change to the public contract** of Week 3 APIs — SSE, credits WS, code history, contract WS remain the integration surface.

---

## Frontend (this phase)

- **`useContractStream`** — canonical contract runtime view: `wsHub` + cache + REST seed + `deriveAnimationStage`.
- **`wsHub`** — shared connections for contracts and credits; backoff; token factory for post-refresh JWT.
- **`balanceBus` + API client** — propagate `new_balance` from responses where present.
- **Modals** — Build with live logs; Audit with vulnerabilities + applied-fix diff context.
- **Process** — weekly dev-log discipline; links from `PROJECT_STATE.md`.

---

## Architecture (cumulative, as of today)

1. **Thin Next.js client** — orchestration, rendering, auth token lifecycle only.
2. **FastAPI + LangGraph** — all pipeline, credits ledger, builder execution.
3. **Channels:** **WS** for contract status + credits; **SSE** for high-volume build logs; **REST** for authoritative snapshots and mutations.
4. **Deterministic UI** — `deriveUIFromStatus` + tests; stream layer via `useContractStream` for animation consistency.
5. **Step vs full pipeline** — same graph, different interrupt semantics for UI vs API/MCP.

---

## Commercial / roadmap note (KB)

Further **enrichment of internal libraries** (build/audit/deploy assistance) is planned as a **separate track**; scope and timelines are **not disclosed** in this document.

---

## Known gaps (non-KB, public)

| Item | Notes |
|------|--------|
| **`user_sol_balance` in deploy UI** | Backend can expose; UI confirmation still to wire. |
| **E2E** | Blocked without wallet mock / Playwright stub. |
| **Modal polling** | Could be deduplicated if a single `useContractStream` instance is shared from Dashboard. |

---

## Series index

| Week | Focus |
|------|--------|
| [1](./DEV_LOG_BUMM_WEEK_01.md) | Platform, pipeline, auth, builder, first UI |
| [2](./DEV_LOG_BUMM_WEEK_02.md) | Step UX, `deriveUIFromStatus`, WS contract, chat, tests |
| [3](./DEV_LOG_BUMM_WEEK_03.md) | SSE logs, credits WS+Redis, code history, diffs, `wsHub` |
| **4** (this file) | `useContractStream`, integration, docs, **current state** |
