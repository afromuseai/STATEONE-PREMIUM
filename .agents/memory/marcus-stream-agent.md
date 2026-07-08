---
name: Marcus Stream Agent — Replit-style generation
description: Single-pass streaming code agent using tool_call XML parsing; new route, hook, and UI for Website Studio
---

## Architecture

The streaming generation pipeline is a **separate path** from the existing V2 pipeline — it does not replace it.

- **Route**: `POST /api/generate/website-v2/stream` (in `generate-website-v2.ts`)
- **Agent**: `artifacts/api-server/src/lib/agents/marcus-stream-agent.ts`
- **Hook**: `artifacts/stageone/src/hooks/useMarcusStreamGeneration.ts`
- **Stream UI**: `artifacts/stageone/src/components/website-v2/StreamGenerationScreen.tsx`
- **Entry page**: `artifacts/stageone/src/pages/website-studio-create.tsx` at route `/website-studio/new`

## SSE event contract (StreamAgentSseEvent)

```
agent-thinking → { phase, token }          Marcus narration tokens
file-start      → { phase, path, language }  new file beginning
file-token      → { phase, path, token }     incremental content chunk
file-done       → { phase, path, content }   file complete (full content)
tool-call       → { phase, name, status }    tool-call lifecycle
project-created → { phase, projectId }       DB record created
done            → { phase, projectId, data }
error           → { phase, message }
```

## Model choice

**Why**: `MODELS.WEBSITE_V2_CODE_GEN` (nemotron-3-super-120b) — not the 550B ultra.
`COMPONENT_GENERATION` (550B ultra) has thinking mode on by default via MODEL_KWARGS, which routes tokens into `reasoning_content` not `content`. The 120B model outputs directly to content, which is what the streaming parser expects.

**How to apply**: Any future streaming code-gen agent should use WEBSITE_V2_CODE_GEN or explicitly pass `chatTemplateKwargs: { enable_thinking: false }` when using COMPONENT_GENERATION.

## Tool-call XML parsing

The agent parses `<tool_call>{"name":"write_file","path":"...","content":"..."}` blocks from the streaming token buffer. Key quirks:

- Content arrives all at once inside the JSON (not character-by-character as the tag streams), so the file-token emission is done via a manual chunking loop after parsing the complete JSON block.
- Partial `<tool_call>` tags are held in the carry buffer rather than emitted as thinking text.
- Thinking tokens (text between tool calls) are emitted as `agent-thinking` events.

## DB persistence

`saveGeneratedFiles(projectId, files, dependencies, preview)` — note the flat signature, NOT accepting a GeneratedProject object. `preview` is empty string `""` for stream-generated projects (no HTML preview generated).
