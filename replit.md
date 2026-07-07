# STAGEONE-PREMIUM

AI Business Operating System — transforms any business idea into a complete blueprint with strategic analysis, growth plans, website structures, and automation workflows, powered by NVIDIA's Llama 3.1 70B.

## How to run

All three services start together via the **Project** workflow (the green Run button):

| Service | Port | Command |
|---------|------|---------|
| Frontend (Vite / React) | 5000 | `cd artifacts/stageone && PORT=5000 BASE_PATH=/ pnpm run dev` |
| API Server (Express 5) | 8000 | `cd artifacts/api-server && pnpm run dev` |
| Mockup sandbox (Vite) | 8080 | `cd artifacts/mockup-sandbox && PORT=8080 pnpm run dev` |

## First-time setup

```bash
pnpm install                           # install all workspace deps
pnpm --filter @workspace/db run push  # push DB schema to Postgres
```

## Stack

- **Monorepo**: pnpm workspaces (`artifacts/*`, `lib/*`)
- **Frontend**: React 19, Vite 7, Tailwind v4, Wouter, Radix UI, TanStack Query
- **API**: Express 5, Drizzle ORM, Postgres (`lib/db`)
- **AI**: NVIDIA API (meta/llama-3.1-70b-instruct) via SSE streaming
- **Auth**: JWT sessions (`JWT_SECRET` env var), bcrypt passwords

## Required secrets / env vars

| Key | Type | Notes |
|-----|------|-------|
| `NVIDIA_API_KEY` | Secret | NVIDIA API for all AI generation endpoints |
| `JWT_SECRET` | Secret | Signing key for auth tokens |
| `DATABASE_URL` | Runtime-managed | Auto-injected by Replit Postgres |

Optional (email features):
`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Where things live

```
artifacts/
  stageone/           # React frontend (Vite)
    src/
      pages/          # landing, login, signup, dashboard, admin, etc.
      components/     # navbar, footer, landing/, dashboard/ panels
      lib/            # auth context, API client, hooks
  api-server/         # Express API
    src/
      routes/         # generate, copilot, auth, admin, websites, etc.
      lib/            # worker, job-handlers, logger
  mockup-sandbox/     # Canvas component previewer (Vite)
lib/
  db/                 # Drizzle schema + pool (DATABASE_URL)
  api-spec/           # Shared API type definitions
  api-zod/            # Zod schemas mirroring the API spec
  api-client-react/   # TanStack Query hooks for the frontend
```

## Architecture decisions

- Vite dev server proxies `/api/*` → `http://localhost:8000`
- AI responses stream via `text/event-stream` (SSE) through Express to the frontend
- Business graph stored in Postgres; Marcus copilot loads it before every response
- Execution Bus pattern dispatches `generate_*` jobs; results streamed back via SSE

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- `BASE_PATH` must be set when starting the frontend dev server (workflow sets it to `/`)
- SMTP vars are optional; missing them silently disables email features (no startup error)
- `admin.tsx` is >500 KB and triggers Babel deopt warning — normal, not a crash
