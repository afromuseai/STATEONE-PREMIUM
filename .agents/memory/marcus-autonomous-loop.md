---
name: Marcus autonomous stream loop
description: marcus-stream-agent.ts upgraded from single-pass to a 7-phase autonomous loop; new SSE events are additive and preserve all existing frontend contracts.
---

# Marcus Autonomous Stream Loop

## Rule
`marcus-stream-agent.ts` is the only place to upgrade the generation brain. Do NOT create duplicate routes or new pipelines. The `/api/generate/website-v2/stream` route in `generate-website-v2.ts` is the sole entry point.

**Why:** The user explicitly locked this — "Do not create duplicate routes or duplicate flows."

## How to apply
When changing generation behaviour, edit `runMarcusStreamAgent` in `marcus-stream-agent.ts` only.

## Loop phases (in order)
```
UNDERSTAND → PLAN → EXECUTE → OBSERVE → FIX (×0–2) → VALIDATE → REPORT
```

- **UNDERSTAND** — emit context events, create DB project record
- **PLAN + EXECUTE** — single streaming LLM call; `---BEGIN FILES---` separator triggers EXECUTE transition; `parseXmlStream()` handles both phases
- **OBSERVE** — `validateFiles()` structural check (required files, non-empty, package.json valid JSON, default exports present)
- **FIX** — second streaming LLM call if issues found, MAX_FIX_ITERATIONS = 2; reuses `parseXmlStream()`
- **VALIDATE** — re-run `validateFiles()` after fixes
- **REPORT** — save blueprint + files to DB, emit `done`

## Key architectural decision: `parseXmlStream()` is extracted and reused
The XML `<write_file>` streaming parser is a standalone function used by both EXECUTE and FIX phases. Pass `existingFiles` map to accumulate across calls.

## SSE events (additive — frontend ignores unknown phases gracefully)
| Event | Shape | Consumer |
|---|---|---|
| `loop-phase` | `{ loopPhase, message }` | `PhaseTracker` in StreamGenerationScreen |
| `tool-call` | `{ tool, status, path?, detail? }` | `ToolEventRow` in StreamGenerationScreen |
| `validation` | `{ success, errors[], fixed }` | validation banner in StreamGenerationScreen |

All pre-existing events (`agent-thinking`, `file-start`, `file-token`, `file-done`, `project-created`, `done`, `error`) are preserved unchanged.

## Frontend files changed
- `hooks/useMarcusStreamGeneration.ts` — added `loopPhase`, `toolEvents`, `lastValidation`, `fixIteration` to `GenerationState`
- `components/website-v2/StreamGenerationScreen.tsx` — added `PhaseTracker`, `ToolEventRow`, fix banner, validation banner

## TaskBus events emitted per phase
- UNDERSTAND: `pipeline:start running`
- PLAN/EXECUTE: `llm:codegen_start running` → `llm:codegen_complete completed`, `filesystem:create_file running/completed` per file
- OBSERVE: `filesystem:read_file completed`
- FIX: `llm:edit_start running` → `llm:edit_complete completed`
- VALIDATE: `validation:typescript completed/failed`
- REPORT: `database:save_files running/completed`, `pipeline:finish completed`
