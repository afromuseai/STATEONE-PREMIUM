# STAGEONE

STAGEONE is an AI Business Operating System that transforms any business idea into a complete strategic blueprint AND a fully-generated, launch-ready website — industry analysis, growth plans, competitive insights, tech stack recommendations, live website preview, and exportable React code.

## Run & Operate

- `pnpm --filter @workspace/stageone run dev` — run the frontend (port 22923)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm run typecheck` — full typecheck across all packages
- Required env: `NVIDIA_API_KEY` — for AI generation via NVIDIA NIM API
- Required env: `DATABASE_URL` — PostgreSQL connection string
- Optional env: `JWT_SECRET` — JWT signing secret (defaults to dev string; set in production)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: Vite + React 19, Tailwind CSS v4, wouter routing, framer-motion, JSZip
- API: Express 5, streamed SSE responses, cookie-parser, bcryptjs, jsonwebtoken
- AI: NVIDIA NIM API — multi-model pipeline (see Architecture decisions)
- DB: PostgreSQL + Drizzle ORM (`lib/db/` workspace)
- Auth: JWT cookies (7-day sessions), bcryptjs password hashing
- Build: esbuild (API), Vite (frontend)

## Where things live

- `artifacts/stageone/src/pages/` — route pages (landing, dashboard, login, signup, settings, project, not-found, agent-store, webhooks)
- `artifacts/stageone/src/components/dashboard/` — dashboard UI: input panel, output panel, sidebar, website panel
- `artifacts/stageone/src/components/landing/` — landing page sections: hero, features, how-it-works, CTA
- `artifacts/stageone/src/lib/auth-context.tsx` — real JWT-based auth context (API-backed)
- `artifacts/stageone/src/lib/api.ts` — typed API client (auth + projects CRUD)
- `artifacts/stageone/src/lib/website-html-generator.ts` — pure function that builds a self-contained HTML preview from WebsiteOutput data + Next.js project builder for export
- `artifacts/api-server/src/routes/generate.ts` — POST /api/generate — business intelligence streaming (injects AI memory into prompt)
- `artifacts/api-server/src/routes/generate-website.ts` — POST /api/generate/website — website structure streaming (8 sections, React code, colors, typography)
- `artifacts/api-server/src/routes/auth.ts` — POST /api/auth/signup|login|logout, GET /api/auth/me
- `artifacts/api-server/src/routes/projects.ts` — full projects CRUD (JWT-protected)
- `artifacts/api-server/src/routes/webhooks.ts` — full webhook CRUD + ping/test + HMAC signing + delivery logs
- `artifacts/api-server/src/routes/agents.ts` — agent catalog (12 agents) + install/configure/uninstall CRUD
- `artifacts/api-server/src/routes/templates.ts` — templates CRUD + marketplace + install + rate + clone + share
- `artifacts/api-server/src/routes/deployments.ts` — deployments CRUD + rollback + webhook firing on status changes
- `artifacts/api-server/src/middleware/auth.ts` — JWT cookie middleware
- `lib/db/src/schema/` — Drizzle schema: users, projects, subscriptions, templates, deployments, ai-memory, api-keys, webhooks, agents

## Architecture decisions

- All routing is client-side via wouter (no SSR)
- Auth: real JWT cookies (7-day), bcryptjs hashing — NOT localStorage anymore
- AI responses streamed via SSE from the API server, forwarded from NVIDIA's SSE API
- Website preview HTML is generated CLIENT-SIDE from structured AI output (reliable, editable, fast)
- Preview uses inline CSS + Google Fonts CDN (no Tailwind CDN needed in iframe — most reliable approach)
- ZIP export uses JSZip to create a complete Next.js 14 project structure in the browser
- The API server uses esbuild to bundle to a single ESM file for fast startup
- AI Memory is fetched and injected into the business intelligence prompt (top 10 by importance)
- Webhooks use HMAC-SHA256 signatures when a secret is configured (X-STAGEONE-Signature header)

### Centralized Model Registry (`artifacts/api-server/src/lib/models.ts`)

All AI model assignments are centralized — routes import from `MODELS.*`, never hardcode strings.

| Registry Key | Model | Role |
|---|---|---|
| `BUSINESS_INTELLIGENCE` | `qwen/qwen3.5-397b-a17b` | Business analysis, market strategy |
| `ORCHESTRATION` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Multi-agent coordination, classification |
| `EXECUTION` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Website modification, analysis, generation |
| `AGENT_PLANNING` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Memory-aware agent decomposition |
| `MEMORY` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Context compression, semantic linking |
| `WEBSITE_PLANNING` | `meta/llama-4-maverick-17b-128e-instruct` | Website section planning (streaming JSON) |
| `COMPONENT_GENERATION` | `qwen/qwen3.5-122b-a10b` | React/Tailwind code (thinking disabled) |
| `COPILOT` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Cross-system intelligence assistant |
| `CHATBOT` | `qwen/qwen3.5-397b-a17b` | Chatbot design and message replies |
| `AUTOMATION` | `qwen/qwen3.5-397b-a17b` | Workflow & automation planning |
| `ENHANCE` | `qwen/qwen3.5-397b-a17b` | Idea expansion and business framing |
| `RECOMMENDATIONS` | `nvidia/llama-3.3-nemotron-super-49b-v1` | Operational insight, health analysis |
| `SELF_OPTIMIZE` | `nvidia/llama-3.3-nemotron-super-49b-v1` | OS self-optimization loop |

### Centralized NVIDIA Client (`artifacts/api-server/src/lib/nvidia.ts`)
- `callNvidia(options)` — non-streaming call with full structured logging (model, ms, tokens)
- `streamNvidia(options)` → `ReadableStream` — streaming call, throws explicit error on failure
- `forwardStream(body, res, model)` → accumulates buffer while forwarding SSE chunks to client
- `extractJson(raw)` — strips code fences and extracts first JSON object
- No silent fallbacks anywhere — all failures throw with model name + HTTP status

### Multi-Model Website Generation Pipeline
Website generation uses a **layered multi-model architecture** (no fallbacks — each model must work):

**Phase 1 — Orchestration (streaming to client)**
- Model: `MODELS.WEBSITE_PLANNING` = `meta/llama-4-maverick-17b-128e-instruct`
- Generates: brand, colorPalette, typography, design, websiteStrategy, all section copy, seoMeta
- Streams token-by-token to the client for live preview
- JSON repair via `jsonrepair` package for model output robustness

**Phase 2 — Parallel (after Phase 1 completes)**
- Code: `MODELS.COMPONENT_GENERATION` = `qwen/qwen3.5-122b-a10b` (thinking disabled via `MODEL_KWARGS`)
  - Generates: 6 React/Tailwind components (hero, features, testimonials, pricing, cta, footer)
  - Non-streaming, runs concurrently with image generation
- Image: `black-forest-labs/flux-schnell` (FLUX) — graceful null fallback if not on account

**Available NVIDIA NIM models confirmed on this account:**
- `meta/llama-4-maverick-17b-128e-instruct` ✓ (WEBSITE_PLANNING)
- `qwen/qwen3.5-122b-a10b` ✓ (COMPONENT_GENERATION, thinking disabled)
- `nvidia/llama-3.3-nemotron-super-49b-v1` ✓ (ORCHESTRATION, EXECUTION, COPILOT, RECOMMENDATIONS, SELF_OPTIMIZE)
- `qwen/qwen3.5-397b-a17b` — used for BUSINESS_INTELLIGENCE, CHATBOT, AUTOMATION, ENHANCE (explicit error if unavailable)
- `black-forest-labs/flux-schnell` ✗ (404 on this account — graceful null fallback)

## Product Features

### Business Intelligence (AI Memory-Enhanced)
- Enter a business idea → streaming AI analysis (metrics, competitive advantage, growth plan, tech stack)
- AI Memory is automatically fetched and injected into the system prompt as user context
- Auto-saved to PostgreSQL with project CRUD

### AI Website Builder
- "Generate Website" button after business analysis completes
- AI generates complete website package: 8 sections (nav/hero/features/testimonials/pricing/CTA/FAQ/footer), color palette, typography, brand voice, design system, React + Tailwind components
- **Live Preview**: split-view panel with a real browser-chrome-styled iframe preview
- **Desktop/Mobile toggle**: switches iframe width (full-width vs 390px mobile)
- **Editable sections**: click any field in the Sections tab to edit text inline; preview updates instantly
- **4 tabs**: Design (colors/typography/brand), Sections (editable content), Code (per-component React code), Export
- **Export options**: Copy code, Download standalone HTML, Download Next.js 14 ZIP project (JSZip)
- Website data persisted to project's `websiteOutput` JSONB column

### AI Agent Store (/agents)
- 12 pre-built agents across 7 categories: Sales, Support, Marketing, Research, Operations, Analytics, Cybersecurity
- Install/uninstall agents from a searchable, filterable catalog
- Configure behavior rules per agent (custom instructions)
- Pause/resume installed agents
- Activity dashboard with tasks completed stats
- Tier system: Free, Pro, Enterprise

### Webhooks (/webhooks)
- Full CRUD for webhook subscriptions
- 10 event types: deployment.*, generation.*, template.published, agent.*
- HMAC-SHA256 request signing when a secret is configured
- Ping/test button with live status feedback
- Delivery log (last 50 per webhook) with timestamp, event, status code, error
- Webhooks fire automatically on: deployment created/active/failed/stopped/rollback

### Template Engine (Enhanced)
- Clone any public or own template (creates private copy)
- Share a template (makes it public, returns shareable URL)
- Full marketplace with install, rate, CRUD

### Developer API Platform (/developer)
- API key management (create/revoke)
- Usage logs and rate limiting
- Built-in API tester
- SDK code examples

## Gotchas

- `NVIDIA_API_KEY` must be set as a secret for AI endpoints to work
- `DATABASE_URL` must be set (Replit PostgreSQL)
- The frontend proxies `/api` requests to the API server via the Vite dev proxy (localhost:8080)
- Do NOT run `pnpm dev` at workspace root — use `restart_workflow` or filter commands instead
- stageone artifact requires `index.html` at the artifact root (not inside `src/`)
- Website panel uses `overflow-hidden` + flex height chain for proper split-view layout — don't add `overflow-y-auto` on parent containers when website tab is active
- `/api/generate` now requires auth (was previously unauthenticated) — needed to fetch AI memories

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
