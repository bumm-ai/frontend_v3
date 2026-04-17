# Dev log — BUMM (Week 1 of 4) — Platform & pipeline core

**Period:** `[insert dates]`  
**Product:** Bumm AI — Solana/Anchor smart contract generation and pipeline (human-in-the-loop + API/MCP)

**Series:** This is **part 1 of 4** — together, Weeks 1–4 describe the project from first commit to the current state. Each week adds the next layer; later weeks do not repeat the full stack.

---

## One-paragraph summary

We stood up the **backend platform**: FastAPI application, async PostgreSQL, Redis, wallet-based **authentication** (challenge/response, JWT access/refresh), and the **LangGraph pipeline** with a shared **PipelineState** (code, build, audit, deploy, learning fields). We implemented **PipelineRunner** with **step-mode** (interrupts after generate / build / audit), **full/auto mode** for API/MCP, and **paste mode** (user-supplied code). Exposed **REST** for contracts lifecycle, **step triggers** (`/build`, `/audit`, `/deploy`), health and rate limiting, and integration with a **Dockerized Anchor/Rust builder**. On the frontend we delivered a **Next.js 15** shell: **API proxy** to the backend, wallet providers, routing, and the first **Dashboard / chat** wiring so the product is end-to-end testable.

---

## Backend

- **Pipeline graph:** enrich → generate → build → parse_errors / fix_build → audit (static + LLM) → fix_vulns → deploy → learn → finalize (architecture per `ARCHITECTURE.md`).
- **PipelineState & runner:** checkpoint-backed execution; `get_status` for polling/WS consumers; resume paths for step and paste flows.
- **API surface (initial):** contract creation, status, code, audit payloads; wallet auth routes; credits service foundation (balance, ledger, purchase path).
- **Infrastructure:** PostgreSQL migrations, Redis for auth nonces / sessions, builder container for `anchor build`, optional vector store hooks for enrichment (implementation details evolve in later weeks).

---

## Frontend

- **Thin client:** no pipeline logic in the browser — only HTTP and (in later weeks) WS/SSE.
- **App structure:** App Router, layout, environment-driven backend URLs, **`api.ts`** client beginnings.
- **Dashboard & chat (first iteration):** contract creation from prompt or paste, navigation toward build/audit/deploy.

---

## Commercial / roadmap note (KB)

Structured **knowledge and error-pattern data** used by enrich/fix paths is part of our **commercial roadmap**; Week 1 establishes hooks only — **no public detail** here.

---

## Next

**[Week 2 — Human-in-the-loop UX](./DEV_LOG_BUMM_WEEK_02.md)** — deterministic UI, step buttons, contract WS, chat milestones.
