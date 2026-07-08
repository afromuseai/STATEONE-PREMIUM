---
name: Unified website generation flow
description: Website generation has exactly one live entry point end-to-end; how to verify a page is actually dead before deleting/porting logic from it.
---

# Unified website generation flow

## Rule
There is exactly one live path for website generation:
`User → Website Studio (website-studio-create.tsx) → useMarcusStreamGeneration → /api/generate/website-v2/stream
(runMarcusStreamAgent) → MarcusTaskBus (additive, for observability) → saveGeneratedFiles → WebContainer workspace`.

The non-stream `/api/generate/website-v2` route (MarcusController.runWebsiteGeneration, full task-bus-driven
pipeline) still exists and still works, but has no live frontend caller except the `webcontainer-test.tsx`
diagnostics page — it is intentionally left alone, not part of the production flow.

**Why:** A prior "legacy vs new" duplicate-flow investigation turned out to be moot — the supposed legacy page
(`website-generator.tsx`) was already unreachable at the router level (the route rendered the new page instead), so
there was only ever one live UI flow. The real bug was the opposite of "two systems": the module-architecture bridge
that Copilot's `generate_website` ExecutionBus command needs was never registered anywhere, because only the dead
page used to register it.

**How to apply:**
- Before treating any page as "the legacy flow" to delete or migrate away from, check what the router actually
  resolves its route to — an unused import in `App.tsx` does not mean the file backing it still renders.
- If Copilot/ExecutionBus commands for a module (`bus.execute({ module, action })`) silently no-op, check whether
  the live page for that module actually calls `registerBridge`/`registerController` on mount — sibling modules
  (chatbot, automation) are a good working reference for the pattern.
- The streaming SSE route intentionally does not share pipeline code with the non-stream MarcusController route
  (duplicated prompt/file-saving logic by design, not an oversight) — don't try to unify them without a stated need.
