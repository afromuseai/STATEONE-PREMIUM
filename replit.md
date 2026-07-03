# StageOne Premium

An AI Business Operating System — a full-stack pnpm monorepo with a React/Vite frontend, an Express API server, and shared workspace libraries.

## Architecture

| Layer | Location | Port |
|---|---|---|
| Frontend (React 19 + Vite + Tailwind) | `artifacts/stageone/` | 5000 |
| API Server (Express 5 + TypeScript) | `artifacts/api-server/` | 8000 |
| Database schema & migrations (Drizzle ORM) | `lib/db/` | — |
| Shared API types / Zod schemas | `lib/api-spec/`, `lib/api-zod/`, `lib/api-client-react/` | — |
| Mockup sandbox (Shadcn component previews) | `artifacts/mockup-sandbox/` | 8080 |

The frontend proxies all `/api` requests to the API server at `localhost:8000`.

## How to Run

Three workflows are pre-configured:

- **Start application** — starts the Vite dev server on port 5000
- **API Server** — builds and starts the Express server on port 8000
- **Component Preview Server** — starts the mockup sandbox on port 8080 (start on demand)

## Database

Uses Replit's built-in PostgreSQL (connection via `DATABASE_URL`). Schema is managed with Drizzle Kit.

To push schema changes to the database:

```bash
cd lib/db && pnpm run push
```

## Required Secrets

| Secret | Purpose |
|---|---|
| `JWT_SECRET` | Signs authentication tokens |
| `SESSION_SECRET` | Session middleware signing |
| `NVIDIA_API_KEY` | AI model API access |

## Optional Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `SMTP_HOST` | — | Email sending (password reset, notifications) |
| `SMTP_PORT` | 587 | SMTP port |
| `SMTP_USER` | — | SMTP username |
| `SMTP_PASS` | — | SMTP password (set as secret) |
| `SMTP_FROM` | `noreply@stageone.ai` | Sender address |
| `LOG_LEVEL` | `info` | Pino log level |

Without SMTP configured, password reset links are logged to the server console (development only).

## User Preferences

- Keep the existing monorepo structure and pnpm workspace setup.
