# Dev log — BUMM (Week 5 of 6) — Pipeline hardening & throughput (Phase F closeout, Phase G foundation)

**Period:** `Apr 17 → Apr 23`
**Product:** Bumm AI — Solana/Anchor smart contract generation and pipeline (human-in-the-loop + API/MCP)

**Continues:** [Week 4 — Unified streaming client, docs, hardening](./DEV_LOG_BUMM_WEEK_04.md)

---

## One-paragraph summary

After Week 4 froze the streaming client and UX surface, this week was about **pipeline economics**: making the end-to-end build cycle faster, more parallel, and more measurable, without touching the public API contract. **Phase F** closed (F0–F6 hardening), and **Phase G** delivered eight foundational STEPs: a warm cargo target image (cold builds 900–1200s → 176s), per-stage durations persisted to `Contract.stage_durations` (Alembic migration 0009), KB scoped budget guard (24K char cap), `audit_static_node` parallelised via `asyncio.gather` (clippy + cargo-audit + solana_checks), an Anthropic prompt caching wrapper (Claude-only, gated), Hard-Rule 11 codified (`SystemAccount<'info>` → `Program<'info, System>`), an explicit defer of C3 syntax_check, and a `builds_gc.cleanup_old_projects` helper. Around those STEPs we also shipped paste-mode replay (`PUT /code`), feedback-driven regeneration (`POST /regenerate`), the `dead_account` audit check, structural phantom-field detection, gpt-5.x corrections in `openai_client`, and `docker-stack` compose profiles. This is the logical next step after Week 4: once the UX layer was stable, the bottleneck moved into the pipeline itself, and the only way to keep iteration speed at investor-demo pace was to compress build/audit time and start measuring every stage.

---

## Backend (this phase)

- **Phase F closeout (F0–F6)** — pipeline hardening completed 2026-04-23.
- **STEP 1 — warm cargo target image** — `bumm_warm/universal/target` (1.6 GB seeded). Cold compile 900–1200s → **176s** measured.
- **STEP 2 — per-stage timing** — `Contract.stage_durations` JSON column (Alembic migration 0009); loop-prone nodes get `#N` suffix on retried invocations. SQL-queryable per-stage seconds.
- **STEP 3 — KB scoped budget guard** — `truncate_to_budget` enforces a 24K char cap on injected knowledge so a noisy KB cannot blow the prompt window.
- **STEP 4 — `audit_static_node` parallel mode** — clippy + cargo-audit + `check_solana_patterns` run concurrently via `asyncio.gather`; `solana_checks` wrapped in `asyncio.to_thread` to keep the event loop unblocked. Bottleneck becomes `max()` instead of `sum()`.
- **STEP 5 — Anthropic prompt caching wrapper** — `_system_param` with ephemeral `cache_control` block + `_log_cache_usage` for `cache_read_input_tokens` / `cache_creation_input_tokens`. Claude-only, feature-gated by `PROMPT_CACHING_ENABLED`.
- **STEP 6 — Hard-Rule 11** — `SystemAccount<'info>` field → `Program<'info, System>` correction codified in fix node.
- **STEP 7 — C3 syntax_check** — explicitly deferred with rationale documented; revisit with full Phase G data.
- **STEP 8 — `builds_gc.cleanup_old_projects`** — retention helper (no scheduler hook yet — lands W6).
- **`PUT /code`** — paste-mode replay endpoint: full source override outside the LLM loop, then auto-build trigger.
- **`POST /regenerate`** — LLM regeneration with user feedback + audit findings as input; pauses at `phase=generated` for review.
- **Audit additions** — `dead_account` check (init'd PDA/vault/token account that the corresponding instruction body never touches); phantom-field structural guard.
- **`cargo_deps` cleanup** — dropped `pyth-sdk-solana`, `switchboard-v2`, `spl-token-2022` from `cargo_deps.py` and extended prewarm (transitive `solana-instruction` version conflicts).
- **`openai_client` fixes for gpt-5.x** — `_tokens_param` allocates `n*2`, `_reasoning_param` sets `effort=low`, request timeout 90s → 180s.
- **Ops** — `docker-compose` profiles (`socket-proxy` + `bumm-api` moved into `docker-stack` profile — `docker compose up -d` raises only postgres/redis/qdrant/builder by default); `JWT_SECRET` env var fix.

---

## Frontend (this phase)

- **Regenerate flow** — UI surface for `POST /regenerate`: feedback textarea inside `RegenerateFeedbackModal`, plumbed to existing audit-finding context. Reachable when `phase ∈ {paused_degraded, failed}`.
- **Paste-mode (Apply edits)** — client path for `PUT /code` for power users replaying generated code; chains a build trigger so the pipeline re-runs against the new source.
- **No change to `useContractStream` / `wsHub`** — Week 4 contract preserved.

---

## Commercial / roadmap note (KB)

Internal libraries continue to expand on a separate track; **build economics** (warm targets, parallel audit, prompt caching) are a precondition for the cost model we plan to expose externally — figures and timelines remain undisclosed here.

---

## Known gaps (non-KB, public)

| Item | Notes |
|------|--------|
| **`builds_gc` scheduler hook** | Helper exists (STEP 8); apscheduler tick lands next week. |
| **C3 syntax_check** | Deferred by design (STEP 7); revisit with full Phase G data. |
| **Cache hit-rate visibility** | Prompt caching live but not yet surfaced in UI / metrics. |
| **`user_sol_balance` in deploy UI** | Carried over from Week 4. |
| **E2E** | Still blocked on wallet mock / Playwright stub. |

---

## Series index

| Week | Focus |
|------|--------|
| [1](./DEV_LOG_BUMM_WEEK_01.md) | Platform, pipeline, auth, builder, first UI |
| [2](./DEV_LOG_BUMM_WEEK_02.md) | Step UX, `deriveUIFromStatus`, WS contract, chat, tests |
| [3](./DEV_LOG_BUMM_WEEK_03.md) | SSE logs, credits WS+Redis, code history, diffs, `wsHub` |
| [4](./DEV_LOG_BUMM_WEEK_04.md) | `useContractStream`, integration, docs, current state |
| **5** (this file) | Phase F closeout + Phase G STEPs 1–8: warm target, per-stage timing, parallel audit, prompt caching, regenerate |
| [6](./DEV_LOG_BUMM_WEEK_06.md) | Audit depth, deploy correctness, `find_so` wrong-binary CRITICAL fix |
