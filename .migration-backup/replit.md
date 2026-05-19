# STAGEONE

AI Business Operating System — transforms any business idea into a complete blueprint with strategic analysis, growth plans, website structures, and automation workflows, powered by NVIDIA's Llama 3.1 70B.

## Run & Operate

- `pnpm --filter @workspace/stageone run dev` — run the frontend (Vite, port from PORT env)
- `pnpm --filter @workspace/api-server run dev` — run the API server (Express, port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- Required secret: `NVIDIA_API_KEY` — NVIDIA API key for llama-3.1-70b-instruct

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind v4 (OKLCH dark gold theme)
- API: Express 5 (esbuild bundle)
- No database — auth and project history stored in localStorage
- AI: NVIDIA API (meta/llama-3.1-70b-instruct) with SSE streaming

## Where things live

- `artifacts/stageone/src/pages/` — landing, login, signup, dashboard, settings
- `artifacts/stageone/src/components/` — navbar, footer, landing/, dashboard/ panels
- `artifacts/stageone/src/lib/auth-context.tsx` — localStorage-based auth (no backend)
- `artifacts/stageone/src/index.css` — full OKLCH dark gold theme
- `artifacts/api-server/src/routes/generate.ts` — NVIDIA streaming endpoint (`POST /api/generate`)
- `artifacts/stageone/vite.config.ts` — proxies `/api/*` → `http://localhost:8080`

## Architecture decisions

- Auth is localStorage-only (no database needed) — users/sessions stored client-side
- NVIDIA SSE streaming is passed through Express as `text/event-stream` to the frontend
- Vite dev server proxies `/api/*` to Express so no CORS issues in development
- Wouter used instead of Next.js router for lightweight client-side routing
- All project history saved in localStorage under `stageone-projects` key (up to 20 entries)

## Product

- Landing page with hero, features, how-it-works, CTA sections
- Login/signup with localStorage-based auth
- Dashboard: business idea input panel + AI-generated output panel with streaming
- Sidebar with saved project history (add, select, delete)
- Settings page with profile, notifications, data management
- AI output: industry metrics, strategic insights, competitive analysis, growth plan, website pages, tech stack recommendations

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The Vite proxy (`/api` → port 8080) only applies in dev mode — production deployments need a reverse proxy or the frontend must know the API URL
- NVIDIA API key must be set as `NVIDIA_API_KEY` secret for AI generation to work
- Auth is not secure (simple hash) — suitable for demo/prototype use only
