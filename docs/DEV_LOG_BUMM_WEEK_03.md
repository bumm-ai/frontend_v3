# Dev log — BUMM (Week 3 of 4) — Observability, credits, and change transparency

**Period:** `[insert dates]`  
**Product:** Bumm AI — Solana/Anchor smart contract generation and pipeline (human-in-the-loop + API/MCP)

**Continues:** [Week 2 — Human-in-the-loop UX](./DEV_LOG_BUMM_WEEK_02.md)

---

## One-paragraph summary

We removed **blind waits** during long builds and made **credit balance** and **code changes** visible. **Backend:** **SSE** endpoint **`GET /api/v1/contracts/{uid}/logs/stream`** streaming `build_log_version` / `build_log_tail` until terminal phases; **Redis pub/sub** + **`publish_balance()`**; **WebSocket `/ws/credits`** for live balance; **`GET /api/v1/contracts/{uid}/code/history`** linking versions to **applied fixes**. **Frontend:** **`useBuildLogs`**, **`sseClient`**, **`BuildLogStream`** in the build modal; **`useCredits`** with **`wsHub`** channel **`credits`** and **`balanceBus`** for mutation-driven updates; **`useFixDiff`** and **AuditModal** tab for **fixes vs vulnerabilities**; shared **`wsHub`** for reconnect and JWT factory. Together, this is the **transparency layer** on top of Week 2’s orchestration.

---

## Backend

| Area | Delivered |
|------|-----------|
| **Build logs (SSE)** | `/contracts/{uid}/logs/stream`, auth via header or `?token=` |
| **Credits events** | Redis channel `credits:{user_uid}`, WS push, heartbeats |
| **Code history** | `/code/history` + linkage to fix records |
| **Fixes list** | `/fixes` + `AppliedFix`-style summaries |

---

## Frontend

| Area | Delivered |
|------|-----------|
| **Logs** | `useBuildLogs`, `BuildLogStream`, ANSI-friendly terminal-style output |
| **Credits** | `useCredits`, `balanceBus`, `wsHub` → `/ws/credits` |
| **Diffs** | `useFixDiff`, `FixDiffViewer` / timeline patterns in Audit flow |
| **API** | `getCodeHistory`, logs URL in config, `api.ts` extensions |

---

## Commercial / roadmap note (KB)

Automated fix suggestions combine **LLM** and **internal rule libraries**; scaling that library is ongoing — **no technical detail** in external reports.

---

## Next

**[Week 4 — Integration & current state](./DEV_LOG_BUMM_WEEK_04.md)** — `useContractStream`, docs, hardening, and where we are today.
