---
name: Website save reliability — projectId context preservation
description: projectId can be cleared during a long stream; capture before fetch and echo server-side
---

# Website generator save reliability pattern

`ensureProject` reads `loadProjectContext()` from sessionStorage. During a long stream, the context can be cleared by a concurrent mount/unmount cycle, leaving `ensureProject` to create a duplicate project instead of patching the existing one.

**Fix applied:**
1. **Frontend (`generateWithIdea`):** Capture `_capturedProjectId` from `loadProjectContext()` at the start of the function, BEFORE the fetch.
2. **Frontend request body:** Send `projectId: _capturedProjectId` in the POST body so the server knows the current project.
3. **Server (`generate-website.ts`):** Echo `_projectId` back in the `done` SSE event.
4. **Frontend done handler:** Use `msg._projectId ?? _capturedProjectId` as `_resolvedProjectId`; if `loadProjectContext()?.projectId` is now empty, call `saveProjectContext(...)` with the resolved ID to restore it before `ensureProject` runs.

**Why:** The restore check `!loadProjectContext()?.projectId` avoids overwriting a valid (different) context if one is present.

**How to apply:** Any generator that calls `ensureProject` inside a streaming done handler should capture project context before the fetch, not inside the async done callback.
