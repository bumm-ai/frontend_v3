# BUMM AI — Final technical specification

**Hybrid Architecture v3.1**  
**Date:** March 20, 2026  
**Version:** 3.1-final  
**Status:** Approved for implementation  
**Author:** Nikolas (solo senior + AI tooling)

This document is the **source of truth** for platform architecture. The `frontend_v3` repo implements only the **thin client** (section 8); the backend is [backend_v3](https://github.com/bumm-ai/backend_v3).

---

## 0. Hybrid comparison and final decision

Two approaches aligned ~80%. The difference: incremental migration of v1 API vs **clean cut**; ARQ vs **LangGraph**; keeping v1 API vs **dropping v1** (no paying clients).

**Decision:** clean cut on the backend + frontend as **thin API client** on the new API.

---

## 1. Product definition

**Bumm AI** — API platform: text description → Solana smart contract (Anchor/Rust) → build → audit → fix → deploy; the system learns from errors.

**Channels:** REST API (SaaS), MCP Server (AI agents), Frontend (Next.js thin client).

**Revenue:** credits (SOL/USDC), MCP marketplace, frontend, enterprise (Phase 2).

---

## 2. Architecture overview

- **API layer:** FastAPI — REST `/api/v1/*`, MCP, WebSocket `/ws/*`, `/health`
- **Pipeline:** LangGraph + `PipelineState` (Pydantic) + Postgres checkpointer
- **LLM:** Claude Sonnet 4 (generate), GPT-4o (audit), Claude Opus 4 (fix)
- **Data:** PostgreSQL 16, Redis 7, Qdrant (RAG)
- **Builder:** Docker — Rust 1.85, Anchor 0.32.1, Solana CLI, `pin-deps.sh`

Detailed diagrams and stack tables live in the full project description (backend_v3).

---

## 3. Pipeline state (central artifact)

State is **Pydantic** `PipelineState`, not TypedDict: validation on every checkpoint.

Key fields: `bumm_uid`, `user_uid`, `prompt`, `code`, `phase` (`Phase` enum), RAG, build/audit/deploy fields, `fixes_applied`, metrics.

---

## 4. LangGraph pipeline

Graph: `enrich → generate → build` → conditional edges → `parse_errors / fix_build / audit_* / fix_vulns / deploy / learn / finalize`.

Routing: `route_after_build`, `route_after_audit`, `can_retry_build`, `can_retry_audit`.

**PipelineRunner** with `PostgresSaver`, `thread_id = f"bumm:{bumm_uid}"`.

---

## 5. Knowledge base

`LearningStore` protocol: `recall`, `process`, `build_context`.  
`KnowledgeEntry` in PostgreSQL + semantic search in Qdrant.  
`KnowledgeService`: exact → semantic → LLM fix.

---

## 6–7. Nodes, API layer

REST: `POST /api/v1/contracts/`, `GET .../status`, `.../code`, `.../audit`, `.../resume`.  
Individual steps: `/generate`, `/build/{uid}`, `/audit/{uid}`, `/deploy/{uid}`.  
MCP tools, WebSocket status stream.

---

## 8. Frontend specification (thin client)

| Change | Before | After |
|--------|--------|--------|
| Base | proxy `/api/backend` → old v1 | proxy → **new** v1 endpoints |
| Flow | generate + separate polling | `POST /contracts` + **WebSocket** |
| Build/Audit/Deploy | separate modals as main path | **pipeline on server**; UI shows progress |
| Status | 5s polling | **WS** real-time |
| Chat history | localStorage + broken calls | **backend** |
| Credits | rarely refreshed | refresh after pipeline completion |
| `bummUid` | fallback to `contractCode` | **bummUid only** |

Planned path constants in the frontend: `src/config/api.v3.planned.ts`.

---

## 9. Docker / builder

`docker-compose`: `bumm-api`, `bumm-builder`, postgres, redis, qdrant; volumes; `docker.sock` for API.

Builder image: Debian Bookworm, Rust 1.85, Solana, Anchor 0.32.1, Node 20, Yarn, `pin-deps.sh`, `cargo-audit`.

---

## 10. File structure (backend)

See **backend_v3** — `app/pipeline/`, `app/knowledge/`, `app/api/`, `builder/`, `scripts/`.

---

## 11. Implementation roadmap (weeks)

| Week | Outcome |
|------|---------|
| 1 | Builder + real anchor build + error parser |
| 2 | Deploy + basic graph generate→build→deploy |
| 3 | KB + fix cycle |
| 4 | Audit + vuln fix cycle |
| 5 | Qdrant RAG + learn |
| 6 | REST + WS + credits |
| 7 | MCP + frontend thin client |
| 8 | Monitoring, load tests, docs |

---

## 12–14. Dependencies, env, Prometheus

- Python: FastAPI, LangGraph, SQLAlchemy async, Qdrant client, Anthropic/OpenAI, MCP, etc.
- Env: `POSTGRES_URI`, `REDIS_URL`, `QDRANT_URL`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `SOLANA_RPC_URL`, `SOLANA_NETWORK`.
- Metrics: `bumm_pipelines_*`, `bumm_kb_*`, `bumm_llm_tokens_total`, etc.

---

## Full text

The complete specification with all code samples (Python/TS/YAML/Docker) can be stored separately in `backend_v3` or here as `TECHNICAL_SPEC_V3_1_FULL.md` if needed. This file keeps **structure and decisions** for quick context in other chats.
