# STAGEONE-PREMIUM

An AI Business Operating System — a full-stack pnpm monorepo with a React/Vite frontend, Express API server, and PostgreSQL database.

## Stack

- **Frontend**: React 19 + Vite 7 + Tailwind CSS 4 (`artifacts/stageone`, port 5000)
- **API Server**: Express + TypeScript, built with esbuild (`artifacts/api-server`, port 8000)
- **Database**: Replit PostgreSQL via Drizzle ORM (`lib/db`)
- **Shared libs**: `lib/api-spec`, `lib/api-zod`, `lib/api-client-react`, `lib/db`
- **Package manager**: pnpm workspaces

## How to Run

Three workflows are configured:

| Workflow | Command | Port |
|---|---|---|
| Start application | `cd artifacts/stageone && PORT=5000 BASE_PATH=/ pnpm run dev` | 5000 |
| API Server | `cd artifacts/api-server && pnpm run dev` | 8000 |
| Component Preview Server | `cd artifacts/mockup-sandbox && PORT=8080 ...` | 8080 |

Start all three via the **Project** run button, or individually via the Workflows panel.

## Environment Variables

| Key | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection (Replit-managed) | ✅ auto |
| `SESSION_SECRET` | Session signing | ✅ secret |
| `JWT_SECRET` | JWT token signing | ✅ env var |
| `NVIDIA_API_KEY` | NVIDIA AI services | ✅ secret |
| `API_PORT` | API server port (default 8000) | set to 8000 |

## Database

Schema is managed with Drizzle ORM. To push schema changes to the development database:

```bash
pnpm --filter @workspace/db run push
```

## User Preferences

- Keep pnpm workspace structure intact
- Do not restructure or migrate the existing stack
