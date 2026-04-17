# Dev log — BUMM (Week 2 of 4) — Human-in-the-loop UX & contract streaming

**Period:** `[insert dates]`  
**Product:** Bumm AI — Solana/Anchor smart contract generation and pipeline (human-in-the-loop + API/MCP)

**Continues:** [Week 1 — Platform & pipeline](./DEV_LOG_BUMM_WEEK_01.md)

---

## One-paragraph summary

We productized **step-mode** for real users: after generation (or paste), the pipeline **pauses** at explicit interrupts; the UI drives **Build → Audit → Deploy** with **POST** step endpoints. We introduced **`deriveUIFromStatus`** — a **pure function** mapping backend `ContractStatus` + `hasCode` + optional **`pendingStep`** to **action button state** and **animation stage**, so **stale WebSocket heartbeats** cannot re-arm completed steps. **`pendingStep`** gives **optimistic** feedback on click. **`ChatScreen`** reconciles dashboard-driven state with **paste → Review** flows. We connected **WebSocket `/ws/contracts/{uid}`** for live phase updates, added **pre-generation chat**, rich **milestone messages** in chat after build/audit, and **Vitest** coverage for **`deriveUIFromStatus`**. Modals for build/audit/deploy began tracking pipeline completion via **authorized status polling** where needed.

---

## Backend

- Stable **step routes** and status payloads consumed by `deriveUIFromStatus`.
- **Chat** endpoint for pre-generation assistance (iterative refinement before `POST /contracts`).
- Contract **fixes** list endpoint for summarizing auto-fix metadata after failed/successful build loops.

---

## Frontend

- **Dashboard.tsx** — central orchestration: WS + `deriveUIFromStatus` + `handleStartStep` + optimistic `pendingStep` / `pendingStepRef`.
- **`useContract`** — WebSocket lifecycle, JWT refresh on `4001`, exponential backoff reconnect.
- **ChatScreen** — action button derivation, editor, integration with contract creation.
- **BuildStages / AuditStages / DeployStages** — user-visible progress rails.
- **Unit tests:** `deriveUIFromStatus.test.ts` (Vitest).

---

## Commercial / roadmap note (KB)

Fix and enrich layers consume **internal pattern libraries**; breadth of coverage is a **separate delivery track** — not detailed in this log.

---

## Next

**[Week 3 — Observability, credits, diffs](./DEV_LOG_BUMM_WEEK_03.md)** — SSE logs, credits WS, code history, UI for logs and fix diffs.
