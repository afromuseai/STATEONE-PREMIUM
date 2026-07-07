---
name: Phase O Marcus Autonomous Coding Agent
description: Implementation for Phase O — Marcus as an autonomous coding agent operating inside WebContainer
---

## Architecture

- **Backend:** `artifacts/api-server/src/routes/copilot-agent.ts` — stateless `POST /api/copilot/agent`; uses `MODELS.AGENT_PLANNING` (Nemotron 49B); streams SSE; accepts `{projectMemory, messages, mode}`
- **Frontend loop:** `artifacts/stageone/src/components/website-v2/ide/AgentPanel.tsx` — drives multi-turn agentic loop; max 8 iterations; parses `<tool_call>{...}</tool_call>` XML
- **WC extensions:** `runtime-types.ts` + `WebContainerProvider.tsx` + `WCContext.ts` — added `readFile`, `listDir`, `runCommand` to WCContextValue

## Tool system

LLM emits `<tool_call>{"name":"...","params":{...}}</tool_call>` XML tags. Frontend executes against WC: read_file, write_file, list_dir, search_code, run_command, done.

## Phase O features

- O1: Auto-scan on wcStatus=ready → reads package.json, lists dirs → projectMemory state
- O2: 6 tools in executeTool()
- O3: mode=plan → confirm/reject bar → mode=execute
- O4: All non-done tools executed before honoring "done"
- O5: LLM prompted to run_command(npm run build) after writes and self-correct
- O7: projectMemory state in every request; previousChanges tracked

## Critical decisions & fixes

**Why:** Frontend drives the loop — WC is browser-only, backend cannot touch WC fs.
**writeFile:** Now throws on error (was silently swallowing failures before).
**runCommand:** 60s timeout via Promise.race; blocks dev/start/serve/watch commands.
**XSS:** Replaced dangerouslySetInnerHTML with safe InlineBold component.
**done ordering:** nonDoneCalls executed before checking for done.
**Path joins:** Use joinPath() helper, not string concatenation.

## Known gaps

- O6 (visual screenshot) not implemented — NVIDIA stack has no vision model available.
- /copilot/agent lacks requireFeature plan gating — cost risk in production.
