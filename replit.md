# STAGEONE

An AI Operating System platform — one platform to research, design, build, and operate a business using a coordinated swarm of autonomous AI agents (Agent Marcus).

## Stack

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 + Framer Motion + Wouter routing (`artifacts/stageone`, port 5000)
- **API Server**: Node.js + Fastify + Drizzle ORM + PostgreSQL (`artifacts/api-server`, port 8000)
- **Component Preview**: Vite sandbox for UI mockups (`artifacts/mockup-sandbox`, port 8080)
- **Package manager**: pnpm workspaces
- **Language**: TypeScript throughout

## How to run

Three workflows are configured:

| Workflow | Command | Port |
|---|---|---|
| Start application | `cd artifacts/stageone && PORT=5000 BASE_PATH=/ pnpm run dev` | 5000 |
| API Server | `cd artifacts/api-server && pnpm run dev` | 8000 |
| Component Preview Server | `cd artifacts/mockup-sandbox && PORT=8080 BASE_PATH=/__mockup/ ./node_modules/.bin/vite --config vite.config.ts --host 0.0.0.0` | 8080 |

## Environment secrets required

| Secret | Purpose |
|---|---|
| `SESSION_SECRET` | HTTP session signing |
| `JWT_SECRET` | JWT signing for auth middleware and admin impersonation |
| `NVIDIA_API_KEY` | AI generation (codegen, copilot, orchestrator, etc.) |

## Optional environment variables

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST/PORT/USER/PASS/FROM/SECURE` | — | Email delivery (auth flows) |
| `SEED_EMAIL/SEED_PASSWORD/SEED_NAME` | — | Admin seed script (`scripts/seed-admin.ts`) |

## Database

Uses Replit's built-in PostgreSQL. Schema is managed with Drizzle ORM.

- Push schema: `cd lib/db && pnpm exec drizzle-kit push`
- Seed admin: `cd scripts && pnpm exec tsx seed-admin.ts`

## Monorepo layout

```
artifacts/
  stageone/       # Frontend app
  api-server/     # Backend API
  mockup-sandbox/ # Component preview server
lib/
  db/             # Drizzle schema + migrations (~65 tables)
  api-spec/       # Shared API types
  api-client-react/
  api-zod/
scripts/          # Seed + post-merge utilities
docs/             # Roadmap and design docs
```

## Setup status

Re-verified after re-import (July 12, 2026): dependencies reinstalled via pnpm, database schema pushed with drizzle-kit, and all three workflows (frontend, API server, mockup sandbox) confirmed healthy via screenshot. Secrets `SESSION_SECRET`, `JWT_SECRET`, `NVIDIA_API_KEY` are set (`JWT_SECRET` and `NVIDIA_API_KEY` were re-added since re-imports don't carry secrets over).

## User preferences

_None recorded yet._
