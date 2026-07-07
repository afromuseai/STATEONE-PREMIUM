# STAGEONE-PREMIUM

An AI operating system platform for modern businesses. Allows users to research, design, build, and operate an entire business using autonomous AI agents. Powered by NVIDIA's API.

## Stack

- **Frontend**: React + Vite (TypeScript), Tailwind CSS v4, Wouter routing — `artifacts/stageone/`
- **API Server**: Express 5 (TypeScript), built with esbuild, pino logging — `artifacts/api-server/`
- **Database**: Replit PostgreSQL + Drizzle ORM — `lib/db/`
- **AI**: NVIDIA NIM APIs (LLMs), accessed via `NVIDIA_API_KEY`
- **Shared libraries**: `lib/api-zod/`, `lib/api-client-react/`, `lib/api-spec/`
- **Canvas / mockup sandbox**: `artifacts/mockup-sandbox/` (Vite, port 8080)

## How to Run

Two workflows must be running:

| Workflow | Command | Port |
|---|---|---|
| Start application | `cd artifacts/stageone && PORT=5000 BASE_PATH=/ pnpm run dev` | 5000 |
| API Server | `cd artifacts/api-server && pnpm run dev` | 8000 |

The frontend proxies `/api/*` to the API server automatically (configured in `artifacts/stageone/vite.config.ts`).

## Required Secrets

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Signs/verifies auth tokens (any long random string) |
| `NVIDIA_API_KEY` | NVIDIA NIM API access for AI generation |
| `SESSION_SECRET` | Session signing |

Optional (email features):
- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

## Database

Drizzle ORM with Replit-managed PostgreSQL. Schema lives in `lib/db/src/schema/`.

To apply schema changes: `pnpm --filter @workspace/db exec drizzle-kit push`

## Package Management

Uses pnpm workspaces. Install all dependencies from the root: `pnpm install`

## User Preferences

(none yet)
