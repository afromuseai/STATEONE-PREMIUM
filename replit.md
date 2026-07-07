# STAGEONE-PREMIUM

An AI Operating System platform for modern businesses — lets users research, design, build, and operate a business using a coordinated swarm of autonomous AI agents.

## Stack

- **Frontend**: React 19 + Vite 7, Tailwind CSS v4, Radix UI, Framer Motion, TanStack Query, Wouter (routing), Monaco Editor, WebContainer API
- **Backend**: Express 5 (Node.js), TypeScript, Pino logging, JWT auth, Nodemailer (SMTP)
- **Database**: PostgreSQL via Drizzle ORM (`lib/db`)
- **Monorepo**: pnpm workspaces — `artifacts/stageone` (frontend), `artifacts/api-server` (backend), `lib/db`, `lib/api-zod`, `lib/api-spec`, `lib/api-client-react`

## How to Run

Three workflows run in parallel (configured in `.replit`):

| Workflow | Command | Port |
|---|---|---|
| Start application | `cd artifacts/stageone && pnpm run dev` | 5000 |
| API Server | `cd artifacts/api-server && pnpm run dev` | 8000 |
| Component Preview Server | `cd artifacts/mockup-sandbox && vite` | 8080 |

## Environment Variables / Secrets

| Key | Type | Notes |
|---|---|---|
| `DATABASE_URL` | Runtime-managed | Auto-injected by Replit |
| `JWT_SECRET` | Secret | Required for auth token signing |
| `NVIDIA_API_KEY` | Secret | Used for AI features |
| `APP_ORIGIN` | Env var | Set to `https://${REPLIT_DEV_DOMAIN}` |
| `APP_URL` | Env var | Set to `https://${REPLIT_DEV_DOMAIN}` |
| `SMTP_*` | Secret (optional) | Email delivery (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, SMTP_SECURE) |

## Database

Schema managed with Drizzle Kit. To push schema changes to the dev database:

```bash
cd lib/db && pnpm run push
```

## User Preferences

(None yet)
