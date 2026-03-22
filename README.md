# Bumm AI — Frontend **v3** (thin client)

**Product version:** **3.x** (Hybrid Architecture **v3.1**)  
**Role:** Web UI on top of the new **REST + WebSocket** API. The frontend does **not** implement LangGraph, the knowledge base, or the pipeline — only UI, wallet, API calls, and status streaming.

## Repositories

| Role | Repository |
|------|------------|
| **This frontend (primary for ongoing work)** | [github.com/bumm-ai/frontend_v3](https://github.com/bumm-ai/frontend_v3) |
| **New backend (FastAPI + LangGraph + pipeline)** | [github.com/bumm-ai/backend_v3](https://github.com/bumm-ai/backend_v3) |

## Documentation

| File | Contents |
|------|----------|
| [docs/V3_THIN_CLIENT.md](./docs/V3_THIN_CLIENT.md) | Thin client role, target flow, files to change when migrating |
| [docs/TECHNICAL_SPEC_V3_1.md](./docs/TECHNICAL_SPEC_V3_1.md) | Technical specification **v3.1** (architecture, API, roadmap) |

## Quick start

```bash
npm install
cp .env.example .env.local   # set BACKEND_URL to your API
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

All browser requests go to **`/api/backend/*`** (Next.js Route Handler), which proxies to the backend using **`BACKEND_URL`** (see `.env.example`).

### Production

- Deploy as before: **Vercel** (`vercel.json`).
- On Vercel, set **`BACKEND_URL`** in Environment Variables (public API URL).

## Stack (unchanged from v2 UI)

Next.js 15 (App Router), React 19, Tailwind 4, Solana Wallet Adapter, Framer Motion, GSAP — see `package.json` and `CLAUDE.md`.

## License

[MIT](LICENSE)
