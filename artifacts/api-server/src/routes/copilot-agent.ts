// ─── Phase O — Marcus Autonomous Coding Agent ─────────────────────────────────
// POST /api/copilot/agent
//
// Stateless LLM caller. The frontend drives the multi-turn agentic loop:
//   1. Frontend sends projectMemory + conversation + (optional) tool results
//   2. Backend returns streaming LLM response with <tool_call> XML tags
//   3. Frontend parses tags, executes tools against WebContainer, loops back
//   4. Loop ends when LLM emits <tool_call>{"name":"done",...}</tool_call>
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
import { streamNvidia, forwardStream } from "../lib/nvidia";
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

Do NOT emit any <tool_call> tags in plan mode. Just the plan text and "Continue?".`
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

<tool_call>{"name": "read_file",    "params": {"path": "src/app/page.tsx"}}</tool_call>
<tool_call>{"name": "write_file",   "params": {"path": "src/components/Hero.tsx", "content": "// FULL FILE CONTENT — never truncate"}}</tool_call>
<tool_call>{"name": "list_dir",     "params": {"path": "src/components"}}</tool_call>
<tool_call>{"name": "search_code",  "params": {"query": "className", "path": "src"}}</tool_call>
<tool_call>{"name": "run_command",  "params": {"cmd": "npm", "args": ["run", "build"]}}</tool_call>
<tool_call>{"name": "done",         "params": {"summary": "Brief description of all changes made"}}</tool_call>

## Engineering Rules
1. ALWAYS read files before modifying them — never guess the current content
2. Write COMPLETE file content — never use "..." or placeholder comments
3. Match the project's existing TypeScript patterns, imports, and code style
4. After writing files, run the build: <tool_call>{"name":"run_command","params":{"cmd":"npm","args":["run","build"]}}</tool_call>
5. If build fails: read the failing file → identify the error → fix it → rebuild
6. Maximum 14 tool calls before calling "done"
7. Always end with the "done" tool`;
}

// ─── Route ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post("/copilot/agent", requireAuth, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  const userId: string = (anyReq.user?.id ?? anyReq.user?.userId ?? "") as string;

  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { projectMemory, messages, mode } = parsed.data;

  // ── SSE setup ────────────────────────────────────────────────────────────────
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

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

    await forwardStream(streamBody, res, MODELS.AGENT_PLANNING, {
      feature:  "copilot_agent_o",
      userId,
    });
  } catch (err) {
    req.log?.error({ err }, "[Marcus:agent] Stream failed");
    const msg = err instanceof Error ? err.message : "Agent stream failed";
    res.write(`data: ${JSON.stringify({ content: `\n\nError: ${msg}` })}\n\n`);
  }

  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  res.end();
});

export default router;
