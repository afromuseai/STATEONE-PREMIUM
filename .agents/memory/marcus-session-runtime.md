---
name: Marcus Session Runtime
description: Unified MarcusSession runtime that replaces all disconnected agent state systems in Website Studio. Types, reducer, context, and compat shim locations; no-redirect workspace transition.
---

# Marcus Session Runtime

## Files
- `src/lib/marcus-session/types.ts` — `MarcusSessionEvent` discriminated union, `MarcusSessionState`, `ConversationEntry`, `MarcusFileState`
- `src/lib/marcus-session/reducer.ts` — pure `marcusSessionReducer(state, event)` — no side effects
- `src/lib/marcus-session/context.tsx` — `MarcusSessionProvider`, `useMarcusSessionContext`, `useMarcusSessionSelector`, `useMarcusSessionStream` (SSE consumer), `useOptionalMarcusSession`
- `src/lib/marcus-session/compat.ts` — `deriveGenerationState(s): GenerationState` — backward compat shim for existing `StreamGenerationScreen` prop consumers

## Key decisions

### deriveGenerationState must be in compat.ts, NOT context.tsx
Vite Fast Refresh rejects files that export both React components and non-component functions.  
`context.tsx` has `MarcusSessionProvider` (component), so `deriveGenerationState` caused a Fast Refresh warning.  
**Fix:** `compat.ts` is pure TypeScript (no React imports). `context.tsx` re-exports it via `export { deriveGenerationState } from "./compat"`.

### Reducer map() narrowing
TypeScript doesn't narrow union members through `map()` automatically. Mutate-and-narrow pattern:
```typescript
const updated = state.conversation.map((e, i) => {
  if (i !== realIdx || e.kind !== "tool") return e   // narrows to tool
  return { ...e, status: "done" as const, ... }
})
```
Without the `e.kind` guard, TypeScript infers the spread as a union and flags it against the target type.

### No-redirect workspace transition (website-studio-create.tsx)
- `step: "workspace"` renders `WebContainerProvider + StudioShell` inline
- `history.replaceState` updates the URL to `/website-studio/:projectId` without triggering Wouter navigation
- The project is built from `session.files` (in-memory, no DB round-trip) via `sessionToProject()`
- `WebContainerProvider` accepts this in-memory `V2Project` and writes files to the WC FS at boot

### useOptionalMarcusSession for AgentPanel
`AgentPanel` must work both inside the create flow (session context available) and in isolation. It uses `useOptionalMarcusSession()` which returns `null` outside a provider — no throw. All dispatch calls use optional chaining `sessionDispatch?.({ ... })`.

### SSE event mapping (backend → MarcusSessionEvent)
| Backend `phase` field | Dispatched event |
|---|---|
| `project-created` | `session.started` |
| `agent-thinking` | `thinking.token` |
| `file-start` | `file.opened` |
| `file-token` | `file.token` |
| `file-done` | `file.completed` |
| `loop-phase` | `phase.changed` |
| `tool-call` (status: start/done/error) | `tool.started/completed/failed` |
| `validation` | `validation.result` |
| `done` | `session.completed` |
| `error` | `session.failed` |

### AgentPanel dispatch injection points
Additive-only — existing `timeline` local state continues to work. Events are ALSO dispatched to the session context:
- `submit()` → `user.message`
- Plan mode → `plan.created`
- Execute mode agent text → `agent.message`
- Tool loop `addEntry` → `tool.started`
- Tool loop `updateEntry` → `tool.completed` or `tool.failed`
- `write_file` → `file.changed`
- `scanProject` → `scan.started`, `scan.completed`, `scan.failed`

## Still to do (not yet wired)
- `StreamGenerationScreen` still reads from `state` prop (derived via `deriveGenerationState`) — could read directly from context in the future
- `ThinkingPanel` live streaming not yet dispatched (only complete thinking entries added to conversation)
- Signal system: `marcus_workspace_signal`, `marcus_website_generate_intent`, `copilot_autorun` not yet retired (kept for compatibility)
