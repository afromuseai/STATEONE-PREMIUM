---
name: Phase K WebContainer diagnostics
description: Phase K end-to-end runtime validation tab in webcontainer-test.tsx — design decisions and gotchas
---

## What it is
Phase K is the 11th tab in `artifacts/stageone/src/pages/webcontainer-test.tsx`. It validates the entire Website V2 pipeline using real API calls and a live WebContainer runtime.

## API routes used
- `POST /api/generate/website-v2` — SSE stream; events: project-created, thinking, architect, blueprint, building, project-saved, done, error
- `POST /api/website-v2/projects/:id/edit` — SSE stream; events: analyzing, editing, changes (with `data.changes: ProjectFile[]`), saved, preview-ready
- `GET /api/website-v2/projects/:id` — returns `{ files: ProjectFile[], dependencies: string[] }`
- `GET /api/website-v2/projects` — returns `{ projects: V2Summary[] }`
- All require `credentials: "include"` (cookie-based JWT auth)

## Key types
- `ProjectFile: { path, operation: "create"|"update"|"delete", content, language? }` — NOT V2File
- `KStepStatus` must include `"warn"` — all Record<KStepStatus, ...> maps need a warn entry

## Critical gotchas
- **wc.on() must always unsubscribe**: `wc.on("server-ready", cb)` returns an unsubscribe fn. Always call it in cleanup (timeout + success paths) or listeners stack up across repeated runs causing cross-run state corruption.
- **KStepStatus includes "warn"**: if you add a Record<KStepStatus, ...> lookup table, include the "warn" key or TypeScript errors occur (TS2741).
- **parseSSEStream is module-level**: the SSE parser lives outside the component. It handles `data: {...}\n\n` format; multi-line `data:` fields are not supported (acceptable for current backend).
- **projectFilesToTree is module-level**: converts ProjectFile[] → FileSystemTree; skips "delete" operations and strips leading slashes.

## Architecture
- Phase K uses the shared `wcRef` (same WC instance as Core tab) — WC is a singleton per page
- `kDevRef` tracks the current Phase K dev server process for kill-on-remount
- `kTermBuf` is a ref (not state) for terminal accumulation; `waitForKTerm` polls it for compiled/HMR signals
- `kAbortRef` stops between-scenario loops; in-flight SSE/install/server-ready waits run to completion before abort takes effect

## Scenario summary
1. Full Generation Pipeline — calls architect+codegen API, retrieves project, mounts into WC, npm install, next dev
2. AI Editing Pipeline — edits project via edit API, writes changed files to WC, measures HMR latency
3. Sequential Editing — 5 sequential edit+apply cycles on same project
4. Project Switching — remounts 2-3 DB projects in sequence (skips if < 2 ready projects)
5. Runtime Stability — 5 edit cycles collecting HMR trend and error count

## Report
10 components: Architect Agent, Code Generation, Persistence, Project Retrieval, WebContainer, Dependency Installation, Live Preview, AI Editing, HMR, Runtime Stability.
Score ≥ 80% = ready for Website Studio Integration.
