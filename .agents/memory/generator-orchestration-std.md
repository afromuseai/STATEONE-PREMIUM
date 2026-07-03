---
name: Generator orchestration standardization
description: Rules and outcomes from migrating all 5 generator modules to the shared useGeneratorOrchestration hook (or targeted fix).
---

## What was done

All 5 generator modules now emit the correct workspace completion events and use `ensureProject()` for persistence.

### Full hook migration (chatbot, automation)
- `useGeneratorOrchestration` hook replaces: inline `consumePendingIntent`, `_mountIntentCache` module var, `stageone:autoGenerate` event handler, `dequeueWorkspaceSignals` + `subscribeWorkspaceSignal` effect, `registerController`/`unregisterController`, and the `saveToProject`+`emit` pattern.
- `completeGeneration(output, idea)` replaces `saveToProject(out)` + `emit({ type })` in the done block.
- Bridge effects (`registerBridge`/`unregisterBridge`) stay on each page — they are NOT handled by the hook.
- `registerController` lines inside bridge effects must be removed (hook owns registration).

### Automation BI fallback pattern
- Automation has a BI GenerationContext fallback (from intelligence page) that the hook doesn't handle.
- `intentHandledRef = useRef(false)` is set inside `onPopulate` to detect if hook found a pendingIntent.
- Phase 1 effect checks `intentHandledRef.current` before running the BI fallback.
- Phase 2 effect (autoGenPending) is kept for BI fallback auto-generation; `autoGenFired.current = true` is set in `onAutoGenerate` to prevent Phase 2 from double-triggering.

### Targeted fixes (website, BI, orchestrator)
These modules were NOT migrated to the hook (they have unique lifecycle or BI fallback complexity); they received only the missing pieces:
- **Website**: Added `emit` to `useWorkspaceController` destructuring + emitted `website.generated` in both done blocks after `ensureProject`.
- **BI**: Renamed `generation.complete` → `bi.generated`; replaced inline `api.projects.create`/`api.projects.update` completion block with `ensureProject()` + `saveProjectContext()`; added `api.projects.update(id, { status: "active" })` fire-and-forget after `ensureProject` since BI creates draft projects during streaming and `ensureProject` continuation-PATCH does not promote status.
- **Orchestrator**: Added `orchestratorController` import + `registerController`/`unregisterController` effect; changed fire-and-forget `ensureProject` to `await`; emitted `orchestrator.generated`.

## Why

The spec says only chatbot and automation had fully duplicated orchestration code. Website/BI/orchestrator had most of the lifecycle already; only completion events and save paths were missing or wrong.

## Critical rules for future changes

- **BI draft status**: `ensureProject` in continuation mode only PATCHes `output`. If the project was created as `draft` during streaming, you must explicitly call `api.projects.update(id, { status: "active" })` after `ensureProject` resolves.
- **`useGeneratorOrchestration` config**: `projectType` must match the `ProjectType` union in `ensure-project.ts`; `outputField` must match `OutputField`.
- **Bridge + hook coexistence**: Always keep `registerBridge`/`unregisterBridge` in the page's own effect. The hook handles `registerController`/`unregisterController`. Never have both.
- **`intentHandledRef` must be declared before the hook call** and checked in any parallel mount effect (like Phase 1 fallbacks). React runs effects in declaration order within the same render commit, so the hook's effect (registered first) runs before Phase 1's effect.
