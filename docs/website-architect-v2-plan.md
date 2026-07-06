# Website Architect V2 — Codebase Audit & Implementation Plan

---

## Part 1: Current Architecture Audit

### Where V1 lives

| Concern | File | Notes |
|---|---|---|
| API route | `artifacts/api-server/src/routes/generate-website.ts` | Single model call, streams JSON |
| LLM utility | `artifacts/api-server/src/lib/nvidia.ts` | `callNvidia`, `streamNvidia`, `extractJson` |
| Output type | `artifacts/stageone/src/lib/website-html-generator.ts` | `WebsiteOutput` interface |
| Renderer | `artifacts/stageone/src/lib/website-html-generator.ts` | `buildPreviewHtml()` — 14 template functions |
| Frontend page | `artifacts/stageone/src/pages/website-generator.tsx` | Generation state, SSE consumer, iframe |
| Next.js export | `artifacts/stageone/src/lib/website-html-generator.ts` | `buildNextjsProject()` — already produces `Record<string, string>` |
| DB persistence | `lib/db/src/schema/` → projects table | Stores `websiteOutput` JSON |

### What can be reused in V2

| Asset | Location | Why it's reusable |
|---|---|---|
| `callNvidia` / `streamNvidia` | `api-server/src/lib/nvidia.ts` | Drop-in for both V2 agent calls |
| `extractJson` | same | JSON repair already handles partial LLM output |
| `useGeneratorOrchestration` | `stageone/src/lib/hooks/` | Manages start/stream/done lifecycle for any generator |
| `module-architecture/` bridges | `stageone/src/lib/module-architecture/` | Existing OS integration wiring |
| `execution-bus/` | `stageone/src/lib/execution-bus/` | Cross-module event dispatch |
| `ensure-project.ts` | `stageone/src/lib/` | Project context + save before generation |
| Job worker + handler registry | `api-server/src/lib/worker.ts` + `job-handlers.ts` | Code generation is slow — good fit for async job |
| `builderProjectsTable` | `lib/db/src/schema/builder-projects.ts` | Already has `fullHtml`, extend for V2 |

### What must stay untouched

- `generate-website.ts` — V1 route
- `WebsiteOutput` interface
- `website-html-generator.ts` — V1 renderer
- Existing iframe preview mechanism
- V1 frontend page `website-generator.tsx`

### Critical constraint: No browser-side runtime

There is **no WebContainer, no StackBlitz SDK, no server-side build runner** in the current stack. The only live preview mechanism is `<iframe srcDoc={htmlString}>`. This shapes the V2 sandbox strategy — see Part 3.

---

## Part 2: V2 Architecture Map

```
User Input (idea, BI context)
         │
         ▼
POST /api/generate/website-v2          [NEW route]
         │
         ▼
 ┌───────────────────────────────────┐
 │  Phase 1: Website Architect Agent │
 │  Model: Llama 4 Maverick          │
 │  System: architect-system-prompt  │
 │  Output: WebsiteBlueprint (JSON)  │
 └───────────────────────────────────┘
         │ SSE: { phase: "blueprint", data: WebsiteBlueprint }
         ▼
 ┌────────────────────────────────────────┐
 │  Phase 2: Code Generation Agent        │
 │  Model: Llama 4 Maverick               │
 │  Input: BusinessContext + Blueprint    │
 │  Output: GeneratedProject              │
 │    → files: Record<string, string>     │
 │      (TSX components, layout, styles)  │
 │    → preview: string (standalone HTML) │
 └────────────────────────────────────────┘
         │ SSE: { phase: "done", data: GeneratedProject }
         ▼
Frontend: useWebsiteV2Generator hook     [NEW hook]
         │
         ├─→ iframe srcDoc={preview}     [reuses existing mechanism]
         │
         └─→ file explorer + download    [new UI panel]
```

### New data types

**`BusinessContext`** — extracted from existing BI output, passed as input to both agents:

```typescript
interface BusinessContext {
  idea:             string
  companyName:      string
  industry:         string
  targetAudience:   string
  businessGoal:     string
  brandPositioning: string
  conversionGoal:   string
  existingBI?:      Record<string, unknown>  // from generate.ts output
}
```

**`WebsiteBlueprint`** — Architect Agent's output, Code Agent's input:

```typescript
interface WebsiteBlueprint {
  projectType: "marketing" | "saas" | "portfolio" | "ecommerce" | "blog"
  pages: Array<{
    route:      string
    purpose:    string
    components: string[]
    priority:   "primary" | "secondary"
  }>
  designSystem: {
    style:        string
    colorPrimary: string
    colorAccent:  string
    typography:   string
    motion:       "none" | "subtle" | "expressive"
    borderRadius: string
  }
  componentHierarchy:    Record<string, string[]>
  responsiveStrategy:    string
  interactionPlan:       string[]
  contentStrategy:       string
  technicalRequirements: string[]
}
```

**`GeneratedProject`** — Code Agent's output:

```typescript
interface GeneratedProject {
  files:     Record<string, string>  // path → file content
  preview:   string                  // standalone HTML for iframe
  blueprint: WebsiteBlueprint
  context:   BusinessContext
}
```

---

## Part 3: Sandbox Runtime Strategy

Since there is no WebContainer or server-side build runner, V2 uses a **dual-output strategy** for the Code Generation Agent.

The Code Agent is prompted to produce **two things** in one call:

1. **Real project files** — actual `app/`, `components/`, `lib/`, `tailwind.config.ts`, `package.json` — stored for download
2. **A standalone preview HTML** — a self-contained single-file rendering of the same design using vanilla HTML/CSS (no build step needed) — shown in the iframe

This reuses the existing `<iframe srcDoc>` mechanism with zero new infrastructure while still giving users real downloadable Next.js files. It matches what `buildNextjsProject()` already does conceptually (V1 produces both HTML preview and Next.js files from the same data).

The long-term path to a true live sandbox is a WebContainer integration — proposed as a follow-up, not part of V2.

---

## Part 4: Files to Create / Touch

### New files (V2 only — nothing V1 touches)

```
artifacts/api-server/src/routes/
  generate-website-v2.ts               ← new route + both agent prompts

artifacts/api-server/src/lib/
  website-v2-types.ts                  ← BusinessContext, WebsiteBlueprint, GeneratedProject

artifacts/stageone/src/pages/
  website-generator-v2.tsx             ← new frontend page

artifacts/stageone/src/lib/
  website-v2-types.ts                  ← shared TS types (mirrors server)
  hooks/use-website-v2-generator.ts    ← SSE consumer + state management

lib/db/src/schema/
  website-v2-projects.ts               ← new table for V2 blueprint + files
```

### Modified files (minimal, additive only)

| File | Change |
|---|---|
| `artifacts/api-server/src/routes/index.ts` | Mount new V2 router at `/api/generate/website-v2` |
| `lib/db/src/schema/index.ts` | Export new V2 table |
| `artifacts/stageone/src/App.tsx` (or router) | Add route `/website-v2` → new page |

---

## Part 5: Agent Prompt Strategy

### Website Architect Agent (Phase 1)

**Task:** Analyze the business, decide architecture — produce `WebsiteBlueprint`.

**Prompt design:**
- **System:** *"You are a senior front-end architect. You receive a business brief and produce an engineering blueprint — not code, not content. Decide pages, components, UX flow, design system, responsive strategy. Output ONLY valid JSON matching the WebsiteBlueprint schema."*
- **User:** injects `BusinessContext` + schema definition
- **Temperature:** `0.7` — enough creativity for layout decisions, constrained enough for valid JSON
- **Model:** `meta/llama-4-maverick-17b-128e-instruct` (same as V1, proven JSON capable)

### Code Generation Agent (Phase 2)

**Task:** Receive blueprint + business context, generate all project files.

**Prompt design:**
- **System:** *"You are a senior React/Next.js engineer. You receive a website blueprint and business context. Generate production-quality Next.js 14 App Router code: TypeScript, Tailwind CSS, responsive, animated. ALSO produce a self-contained HTML preview file. Output raw JSON: `{ files: Record<string, string>, preview: string }`."*
- **User:** injects full `WebsiteBlueprint` + `BusinessContext`
- **Temperature:** `0.85` — higher for creative code generation
- **Model:** same model (single model for both phases, different prompts/roles)
- **Token budget:** higher than V1 — code generation needs more tokens

**SSE flow:** Phase 1 streams tokens (same as V1 for visible progress). Phase 2 streams tokens. Both phases send typed phase events so the frontend can show distinct progress states.

---

## Part 6: Frontend Page Behaviour

The V2 page (`website-generator-v2.tsx`) has three states:

**`"input"`** — same idea input form as V1 (can share the same UI components)

**`"generating"`** with two sub-phases:
- `"architect"` — progress: *"Designing your website architecture…"* (while Phase 1 streams)
- `"building"` — progress: *"Writing your React components…"* (while Phase 2 streams)

**`"done"`** — two-panel layout:
- **Left:** file explorer showing generated files (`app/page.tsx`, `components/Hero.tsx`, etc.) with syntax highlighting
- **Right:** iframe `srcDoc` with the standalone HTML preview
- **Download button:** packages all files into a ZIP (reuses existing `JSZip` dependency from V1)

---

## Part 7: What This Does NOT Include (Deferred)

| Deferred item | Why | Natural follow-up |
|---|---|---|
| WebContainer live Next.js runtime | Requires `@webcontainer/api` + COOP/COEP headers — significant infra change | V3 milestone |
| Multi-page navigation in preview | Needs a runtime to handle routing | Same as above |
| Component-level editing | Requires a full code editor (Monaco) wired to re-render | Separate task |
| Full-stack generation (API routes, DB) | Out of scope for marketing website generator | Later expansion |
| V2 feature flag / gating | Should be behind `requireFeature("website_generator_v2")` | Add before launch |

---

## Part 8: Full Pipeline (V1 vs V2 side-by-side)

```
V1 (current)                          V2 (new)
─────────────────────────────────     ──────────────────────────────────────
User idea                             User idea + BI context
  ↓                                     ↓
POST /api/generate/website            POST /api/generate/website-v2
  ↓                                     ↓
Single LLM call                       Phase 1: Architect Agent
  ↓                                       → WebsiteBlueprint JSON
WebsiteOutput JSON                      ↓
  ↓                                   Phase 2: Code Generation Agent
buildPreviewHtml()                        → files: Record<string, string>
  ↓                                       → preview: string (HTML)
14 template functions                   ↓
  ↓                                   useWebsiteV2Generator hook
<iframe srcDoc={html}>                  ↓
                                      ┌─────────────────────────────┐
                                      │ Left: file explorer         │
                                      │ Right: <iframe srcDoc=…>    │
                                      │ Bottom: Download ZIP        │
                                      └─────────────────────────────┘
```

---

## Summary

V2 adds a two-agent pipeline — **Architect Agent** (blueprint) then **Code Generation Agent** (React files + standalone HTML preview) — running as a new isolated route and page, touching nothing in V1.

The sandbox is solved with a dual-output prompt (real files for download + standalone HTML for the iframe), requiring no new runtime infrastructure.

**Scope:** 6 new files, 3 additive line-level modifications.
