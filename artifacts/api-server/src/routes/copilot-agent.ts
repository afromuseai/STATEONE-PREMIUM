// ─── Phase O — Marcus Autonomous Coding Agent ─────────────────────────────────
// POST /api/copilot/agent
//
// Stateless LLM caller. The frontend drives the multi-turn agentic loop:
//   1. Frontend sends projectMemory + conversation + (optional) tool results
//   2. Backend returns streaming LLM response with TOOL_CALL XML tags
//   3. Backend parses tool calls server-side, emits typed SSE events
//   4. Frontend executes tools against WebContainer, loops back
//   5. Loop ends when LLM emits TOOL_CALL{"name":"done",...}
//
// Features implemented:
//   O1 — project context injected via projectMemory
//   O2 — tool call format in system prompt (read_file, write_file, etc.)
//   O3 — planning mode (mode:"plan") vs execution mode (mode:"execute")
//   O5 — LLM instructed to run_command to check errors and self-correct
//   O7 — projectMemory object carried in every request

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia } from "../lib/nvidia";
import { z } from "zod";

const router = Router();

// ─── Request schema ────────────────────────────────────────────────────────────
const ProjectMemorySchema = z.object({
  framework:       z.string().optional(),
  style:           z.string().optional(),
  colors:          z.array(z.string()).optional(),
  dependencies:    z.array(z.string()).optional(),
  routeCount:      z.number().optional(),
  componentCount:  z.number().optional(),
  fileTree:        z.string().optional(),
  previousChanges: z.array(z.string()).optional(),
  userPreferences: z.array(z.string()).optional(),
});

const AgentRequestSchema = z.object({
  projectMemory: ProjectMemorySchema.optional(),
  messages: z.array(z.object({
    role:    z.enum(["user", "assistant"]),
    content: z.string(),
  })).min(1),
  mode: z.enum(["plan", "execute"]).default("plan"),
});

// ─── System prompt builder ─────────────────────────────────────────────────────
function buildSystemPrompt(
  mem: z.infer<typeof ProjectMemorySchema> | undefined,
  mode: "plan" | "execute",
): string {
  const memLines: string[] = [];
  if (mem?.framework)          memLines.push(`Framework: ${mem.framework}`);
  if (mem?.style)              memLines.push(`Style: ${mem.style}`);
  if (mem?.colors?.length)     memLines.push(`Colors: ${mem.colors.join(", ")}`);
  if (mem?.dependencies?.length) memLines.push(`Key dependencies: ${mem.dependencies.slice(0, 12).join(", ")}`);
  if (mem?.routeCount)         memLines.push(`Routes: ${mem.routeCount}`);
  if (mem?.componentCount)     memLines.push(`Components: ${mem.componentCount}`);
  if (mem?.fileTree)           memLines.push(`\nFile tree:\n${mem.fileTree}`);
  if (mem?.previousChanges?.length)
    memLines.push(`\nRecent changes:\n${mem.previousChanges.slice(-5).map(c => `- ${c}`).join("\n")}`);
  if (mem?.userPreferences?.length)
    memLines.push(`\nUser preferences:\n${mem.userPreferences.map(p => `- ${p}`).join("\n")}`);

  const memBlock = memLines.length
    ? `## Project Memory\n${memLines.join("\n")}`
    : "## Project Memory\nNo project context yet — use list_dir and read_file to explore.";

  const modeBlock = mode === "plan"
    ? `## Mode: PLAN
Before making any changes, analyze the request carefully and present a structured plan.
Format EXACTLY like this:

Analyzing request...

I will:

1. [specific concrete action]
2. [specific concrete action]
3. [etc.]

Continue?

Do NOT emit any TOOL_CALL tags in plan mode. Just the plan text and "Continue?".`
    : `## Mode: EXECUTE
Execute the plan now. Use tool calls to make all the changes.
Narrate briefly what you are doing between tool calls.
After all changes, always verify with run_command (npm run build) and self-correct any errors.
End by calling the "done" tool with a summary of what changed.`;

  return `You are Marcus, an autonomous AI software engineer operating inside a live WebContainer environment. You have direct access to the project filesystem and terminal.

${memBlock}

${modeBlock}

## Tool Call Format (EXECUTE mode only)
Emit ONE tool call per line using this exact XML format:

TOOL_CALL{"name": "read_file",    "params": {"path": "src/app/page.tsx"}}
TOOL_CALL{"name": "write_file",   "params": {"path": "src/components/Hero.tsx", "content": "// FULL FILE CONTENT — never truncate"}}
TOOL_CALL{"name": "write_files",  "params": {"files": [{"path": "src/components/Hero.tsx", "content": "// file 1"}, {"path": "src/components/Footer.tsx", "content": "// file 2"}]}}
TOOL_CALL{"name": "list_dir",     "params": {"path": "src/components"}}
TOOL_CALL{"name": "search_code",  "params": {"query": "className", "path": "src"}}
TOOL_CALL{"name": "run_command",  "params": {"cmd": "npm", "args": ["run", "build"]}}
TOOL_CALL{"name": "background_task", "params": {"cmd": "npm", "args": ["test", "--watch"], "webhook": "/api/agent/task-progress"}}
TOOL_CALL{"name": "list_background_tasks", "params": {}}
TOOL_CALL{"name": "git_status", "params": {}}
TOOL_CALL{"name": "git_diff", "params": {}}
TOOL_CALL{"name": "git_commit", "params": {"message": "feat: add new feature"}}
TOOL_CALL{"name": "git_add", "params": {"files": ["src/components/Button.tsx"]}}
TOOL_CALL{"name": "git_branch", "params": {"name": "feature/new-ui", "create": true}}
TOOL_CALL{"name": "git_push", "params": {"remote": "origin", "branch": "feature/new-ui"}}
TOOL_CALL{"name": "git_log", "params": {"limit": 10}}
TOOL_CALL{"name": "checkpoint",   "params": {"label": "before-refactor"}}
TOOL_CALL{"name": "rollback",     "params": {"label": "before-refactor"}}
TOOL_CALL{"name": "list_checkpoints", "params": {}}
TOOL_CALL{"name": "done",         "params": {"summary": "Brief description of all changes made"}}

## Engineering Rules
1. ALWAYS read files before modifying them — never guess the current content
2. Write COMPLETE file content — never use "..." or placeholder comments
3. Match the project's existing TypeScript patterns, imports, and code style
4. After writing files, run the build: TOOL_CALL{"name":"run_command","params":{"cmd":"npm","args":["run","build"]}}
5. If build fails: read the failing file → identify the error → fix it → rebuild
6. Maximum 14 tool calls before calling "done"
7. Always end with the "done" tool
8. Use "write_files" (plural) for multi-file edits — single call, multiple files
9. Create a checkpoint before major changes with TOOL_CALL{"name":"checkpoint","params":{"label":"descriptive-name"}}
10. Rollback to a checkpoint with TOOL_CALL{"name":"rollback","params":{"label":"checkpoint-name"}}
11. For long-running tasks (build, test, dev server), use "background_task" — it returns immediately with a task ID and streams progress via webhook
12. List checkpoints with "list_checkpoints"
13. Git operations: "git_status", "git_diff", "git_add", "git_commit", "git_branch", "git_push", "git_log"
14. List background tasks with "list_background_tasks"`;
}

// ─── Tool call parser (server-side) ────────────────────────────────────────────
const TOOL_CALL_RE = /TOOL_CALL(\{[\s\S]*?\})/g;

interface ParsedToolCall {
  name: string;
  params: Record<string, unknown>;
  raw: string;
}

function parseToolCalls(text: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];
  let match: RegExpExecArray | null;
  while ((match = TOOL_CALL_RE.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as { name?: string; params?: Record<string, unknown> };
      if (parsed.name) {
        calls.push({ name: parsed.name, params: parsed.params ?? {}, raw: match[0] });
      }
    } catch {
      // malformed — skip
    }
  }
  return calls;
}

function stripToolCalls(text: string): string {
  return text.replace(TOOL_CALL_RE, "").trim();
}

// ─── Route ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post("/copilot/agent", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { projectMemory, messages, mode } = parsed.data;

  // ── SSE setup ────────────────────────────────────────────────────────────────
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const writeEvent = (event: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const systemPrompt = buildSystemPrompt(projectMemory, mode);

    const streamBody = await streamNvidia({
      model:       MODELS.AGENT_PLANNING,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature:  0.2,
      topP:         0.9,
      maxTokens:    8192,
      signal:       AbortSignal.timeout(120_000),
      _feature:    "copilot_agent_o",
      _userId:      userId,
    });

    // Parse the NVIDIA stream and emit structured events
    const decoder = new TextDecoder();
    const reader = streamBody.getReader();
    let carry = "";
    let buffer = "";
    let inThinking = false;
    let toolCallBuffer = "";
    let completedToolCalls = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = carry + decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta;
          const content = delta?.content ?? "";
          const reasoning = delta?.reasoning_content;

          // Handle thinking/reasoning phase
          if (reasoning && !inThinking) {
            inThinking = true;
            writeEvent({ type: "thinking", content: reasoning });
          } else if (content && inThinking) {
            inThinking = false;
            writeEvent({ type: "thinking_end" });
          }

          // Accumulate content for tool call parsing
          if (content) {
            buffer += content;
            toolCallBuffer += content;

            // Check for complete tool calls in the buffer
            const calls = parseToolCalls(toolCallBuffer);
            for (const call of calls) {
              // Find the position of this tool call in buffer
              const idx = toolCallBuffer.indexOf(call.raw);
              if (idx !== -1) {
                // Emit text before the tool call
                const beforeText = toolCallBuffer.slice(0, idx).trim();
                if (beforeText) {
                  writeEvent({ type: "text", content: beforeText });
                }

                // Emit tool call event
                completedToolCalls++;
                const toolCallId = `tc-${Date.now()}-${completedToolCalls}`;
                writeEvent({
                  type: "tool_call",
                  id: toolCallId,
                  name: call.name,
                  params: call.params,
                  status: "running",
                });

                // If write_file, we'll emit a diff preview after frontend reads old content
                // (frontend will read file first, then we can send diff)

                // Remove processed portion from toolCallBuffer
                toolCallBuffer = toolCallBuffer.slice(idx + call.raw.length);
              }
            }

            // Emit any remaining text that's not part of tool calls
            const textOnly = stripToolCalls(toolCallBuffer);
            if (textOnly) {
              writeEvent({ type: "text", content: textOnly });
              toolCallBuffer = ""; // reset after emitting
            }
          }
        } catch {
          // Incomplete JSON fragment — skip
        }
      }
    }

    // Flush any remaining carry
    if (carry.startsWith("data: ")) {
      const data = carry.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            buffer += content;
            toolCallBuffer += content;
            const calls = parseToolCalls(toolCallBuffer);
            for (const call of calls) {
              const idx = toolCallBuffer.indexOf(call.raw);
              if (idx !== -1) {
                const beforeText = toolCallBuffer.slice(0, idx).trim();
                if (beforeText) writeEvent({ type: "text", content: beforeText });
                completedToolCalls++;
                const toolCallId = `tc-${Date.now()}-${completedToolCalls}`;
                writeEvent({ type: "tool_call", id: toolCallId, name: call.name, params: call.params, status: "running" });
                toolCallBuffer = toolCallBuffer.slice(idx + call.raw.length);
              }
            }
            const textOnly = stripToolCalls(toolCallBuffer);
            if (textOnly) {
              writeEvent({ type: "text", content: textOnly });
            }
          }
        } catch { /* ignore */ }
      }
    }

    writeEvent({ type: "done" });
    res.end();
  } catch (err) {
    req.log?.error({ err }, "[Marcus:agent] Stream failed");
    const msg = err instanceof Error ? err.message : "Agent stream failed";
    writeEvent({ type: "text", content: `\n\nError: ${msg}` });
    writeEvent({ type: "done" });
    res.end();
  }
});

export default router;