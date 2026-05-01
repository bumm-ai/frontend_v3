# Dev log — BUMM (Week 6 of 6) — Audit depth & deploy correctness — **headline: wrong-binary CRITICAL fix**

**Period:** `Apr 23 → Apr 29`
**Product:** Bumm AI — Solana/Anchor smart contract generation and pipeline (human-in-the-loop + API/MCP)

**Continues:** [Week 5 — Pipeline hardening & throughput](./DEV_LOG_BUMM_WEEK_05.md)

---

## One-paragraph summary

Week 5 made the pipeline fast; Week 6 made it **correct**. The headline finding: `find_so` was selecting the warm-seed Hello-World binary (`prebuild.so`) over the actual user crate via a `head -1` glob, meaning **every "successful" deploy since the warm-seed feature shipped had been a Solana program upgrade against a single shared address (`5mozdrt33Af…`, 172 224 bytes), not an initial deploy of user code**. We caught it via stage-duration anomalies (W5 STEP 2 instrumentation paying off) and a `solana program show` byte-length comparison, fixed the resolver to an exact `bumm_<uid>.so` match, added a `seed_cmd rm -f` to clear warm-seed leftovers from `target/deploy/`, and shipped Alembic migration 0010 to backfill three affected contracts (`requires_redeploy=true`, `program_id` → `stale_program_id`, `phase='failed'`) with a rose-coloured "Re-deploy required" UI banner. Around that headline, audit depth grew materially (generate.md rules 17/20/21/22, audit.md categories 13/14, `_check_native_sol_token_mixing` regex detector, three new Qdrant KB seeds → 117 vectors total), reliability tightened (deploy idempotency `runner.is_step_in_flight` + 409, WS+REST polling fallback in `useContractStream`, retry-deploy button), and host warm-up Level 1 dropped cycle-2 `audit_static` from **95s → 3.4s** in production logs. This is the logical next step after Week 5's throughput work: once the pipeline was fast enough to iterate, the question shifted from "how fast" to "is the artefact we just shipped actually the user's contract" — and the answer, until this week, was no.

---

## Headline — `find_so` wrong-binary CRITICAL fix

- **Symptom** — every deploy since warm-seed shipped uploaded the same 172 224-byte binary to a single shared program ID `5mozdrt33AfNJyVPx15dEac9yGGeZ56NH26BLdwnXQ44`. User SOL deductions were anomalously low because each "deploy" was a Solana program *upgrade* (~5 000 lamports tx fee), not an initial deploy (~1.2 SOL of program-account rent).
- **Root cause** — `find /builds/<project>/target/deploy -name '*.so' | head -1` in `BuilderExecutor.find_so` returned `prebuild.so` (warm-seed Hello-World, 172 224 bytes) ahead of `bumm_<uid>.so` (user crate, ~183 KB) in inode order. `solana program deploy <so>` then keyed the deploy by the keypair file sitting next to that binary — `prebuild-keypair.json` from the warm seed — pinning every deploy to the same address.
- **Fix** — `find_so` now uses an exact `test -f /builds/<project>/target/deploy/<project>.so && echo <path>`; if the user crate did not compile, the helper returns `None` so `build_node` emits `NO_SO` and `phase='failed'` instead of uploading the wrong binary. The warm-target seed `seed_cmd` in `setup_project()` additionally `rm -f`s `target/deploy/prebuild.so` and `target/deploy/prebuild-keypair.json` after `cp -r {warm_src}` so the leftovers cannot resurface.
- **Verification** — `solana program show 44DmvsKyhao8avK4ezKhjxYmYopZHjE61F5Qbfr7Uszj` reports `Data Length: 183 520 bytes` (user code) on a fresh, unique program ID — vs `172 224 bytes` for the legacy warm-seed binary on `5mozdrt33Af…`. Server-side keypair pays full initial-deploy rent on each new ID, confirming initial-deploy semantics are restored.
- **Migration 0010 (backfill)** — three affected contracts (`04567d23`, `5563481e`, `a25a642a`) marked `requires_redeploy=true`; `program_id` moved to `stale_program_id`; `phase='failed'` so `_rearm_failed_deploy_if_needed` re-arms the LangGraph state on a fresh `POST /deploy`. `ContractStatus` exposes both flags via REST overlay; `finalize_node` clears `requires_redeploy=False` on a successful re-deploy.
- **UI** — `ChatScreen.tsx` renders a distinct rose-coloured banner with the stale program ID prefix and a Re-deploy button; the existing yellow regenerate banner suppresses itself when this stronger banner is present.

This is the most consequential single change in the platform's history to date: prior to it the deployment surface was structurally wrong, and the demos that worked only worked by accident of program-upgrade semantics.

---

## Backend (this phase)

- **`generate.md` hardening** — rule **17** (`/// CHECK:` doc on every `UncheckedAccount` to avoid Anchor `Safety checks failed` panic), rule **20** (seed binding to `let` for `CpiContext::new_with_signer` to avoid E0716), rule **21** (`u128::checked_pow` over hand-rolled `while` loops for CU economy), rule **22** (wSOL pattern on the SOL leg of any AMM/pool/DEX, never native-lamport mixing).
- **`audit.md` new categories** — **#13** `native_sol_token_mixing` (CRITICAL: pool/AMM/DEX with `try_borrow_mut_lamports` ∧ `anchor_spl::token` CPIs), **#14** `vault_rent_exemption` (HIGH: lamport drain without `Rent::get` / `minimum_balance` / `is_rent_exempt` guard).
- **`solana_checks.py`** — new `_check_native_sol_token_mixing` regex detector: lamport-drain × SPL CPI × pool-shape identifiers, plus rent-awareness sub-check that downgrades severity when a guard is present. Validated against the 5e366f1e `defi_amm` contract that originally exposed the gap.
- **KB re-seed** — `audit_vulns.json` gains `NativeSolTokenMixing` + `VaultRentExemption`; `generation_pitfalls.json` gains `amm_native_sol_antipattern` (with full wSOL example). Qdrant `bumm_knowledge` re-indexed via `scripts/seed_kb.py`: **117 vectors** total, 3 new entries persisted via `kb_qdrant_upserted`.
- **Deploy idempotency** — `PipelineRunner.is_step_in_flight(uid)` non-blocking lock check; `POST /api/v1/deploy/{uid}?confirm=true` returns **409** if a step is already in flight, so React-StrictMode double-renders or fast double-clicks no longer enqueue redundant `pipeline_resume_step` no-ops.
- **Host target pre-warm Level 1** — `cargo check --offline` fired-and-forget after `build_success` in `build.py` (`asyncio.create_task(_warm_host_target(...))`). Cycle-2 `audit_static` measured **95s → 3.4s** in production logs (`host_target_warmed duration_s=3.4`) — root cause of the original 95s was BPF vs host target split (`anchor build` writes to `target/sbf-solana-solana/`, `cargo clippy` to `target/debug/`; warm seed only covered BPF).
- **GC scheduler hook live** — `builds_gc_tick` runs every 5 min via apscheduler, retention 7 days. Closes the W5 gap (helper-only → scheduled).
- **Disk hygiene** — `/builds` 5.4 GB → 2.1 MB (removed `test_*` directories from earlier dev work and four finished-contract `target/` trees ~2 GB each). Warm-seed `cp -r 1.6 GB` no longer fights for cold-disk I/O.

---

## Frontend (this phase)

- **Re-deploy required banner** (`ChatScreen.tsx`) — rose-coloured surface, stale program ID prefix, "Re-deploy" button driven by the new `requiresRedeploy` derivation (`!!contractStatus?.requires_redeploy`). Suppresses the yellow regenerate banner when active so the user sees the stronger signal.
- **Retry Deploy button** — `canRetryDeploy` derivation (`isFailed && build_ok && audit_ok && !program_id`); reuses backend `_rearm_failed_deploy_if_needed`. Retried clicks gated locally via `retryingDeploy` state.
- **WS+REST polling fallback** in `useContractStream` — parallel `setInterval(fetchStatus, 5000)` REST status poll, auto-stops on terminal phase via shared `statusCache` check. Closes the WS-died-during-deploy edge case identified in Week 4 known gaps.

---

## Commercial / roadmap note (KB)

Audit-rule depth (rules 17–22, categories 13–14) and the AMM/wSOL detector mark the point where the internal library starts catching real-world misses (e.g. confirmed gap on contract `5e366f1e` / defi_amm — pre-fix audit changed zero characters; post-fix the same flow flags `vault_rent_exemption` on the first audit cycle). Library scope and pricing remain undisclosed here.

---

## Known gaps (non-KB, public)

| Item | Notes |
|------|--------|
| **Wallet mock / Playwright E2E** | Still open — carry forward. |
| **`user_sol_balance` deploy UI confirmation** | Pydantic flags exposed (`requires_redeploy`, `stale_program_id`); generic balance surfacing still partial. |
| **Cache hit-rate visibility** | W5 prompt caching still not surfaced in metrics UI. |
| **Long-tail warm-seed audit** | Migration 0010 backfilled the three known contracts; need a sweep that no other warm-seed-era artefacts (off-platform forks, MCP-mode rows) went undetected. |
| **C3 syntax_check** | Still deferred by design (W5 STEP 7). |
| **Multi-worker idempotency** | `is_step_in_flight` is asyncio-Lock-scoped, single-process. Multi-worker deployments will need a Redis-backed lock. |

**Resolved from Week 4 backlog:** modal polling deduplication is now satisfied by a single `useContractStream` instance from Dashboard plus the REST polling fallback.

---

## Series index

| Week | Focus |
|------|--------|
| [1](./DEV_LOG_BUMM_WEEK_01.md) | Platform, pipeline, auth, builder, first UI |
| [2](./DEV_LOG_BUMM_WEEK_02.md) | Step UX, `deriveUIFromStatus`, WS contract, chat, tests |
| [3](./DEV_LOG_BUMM_WEEK_03.md) | SSE logs, credits WS+Redis, code history, diffs, `wsHub` |
| [4](./DEV_LOG_BUMM_WEEK_04.md) | `useContractStream`, integration, docs, current state |
| [5](./DEV_LOG_BUMM_WEEK_05.md) | Phase F closeout + Phase G STEPs 1–8: warm target, parallel audit, prompt caching |
| **6** (this file) | Audit depth (rules 17–22, categories 13–14), **`find_so` wrong-binary CRITICAL fix**, deploy correctness, idempotency |
