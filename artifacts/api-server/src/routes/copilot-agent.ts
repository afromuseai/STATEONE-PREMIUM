// ─── Phase 12.5 — Website Studio Conversation Engine ─────────────────────────
// POST /api/copilot/agent
//
// Pure conversation endpoint. No tool calls, no execution protocol.
// The AI responds naturally as Website Studio's conversational interface.
// Execution belongs to the autonomous edit endpoint, not this route.
//
// Streams only: thinking, text, done, error
//
// The system prompt is built by the centralized Website Studio AI identity
// module. Do NOT define identity text here — import it.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia } from "../lib/nvidia";
import { z } from "zod";
import { buildWebsiteStudioConversationPrompt } from "../ai/website-studio-ai";

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
});

// ─── Route ────────────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post("/copilot/agent", requireAuth, async (req, res) => {
  const userId = req.user!.userId;

  const parsed = AgentRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { projectMemory, messages } = parsed.data;

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
    const systemPrompt = buildWebsiteStudioConversationPrompt(projectMemory);

    const streamBody = await streamNvidia({
      model:       MODELS.AGENT_PLANNING,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature:  0.7,
      topP:         0.9,
      maxTokens:    4096,
      signal:       AbortSignal.timeout(60_000),
      _feature:    "website_studio_conversation",
      _userId:      userId,
    });

    // Stream NVIDIA response as plain conversation text only
    const decoder = new TextDecoder();
    const reader = streamBody.getReader();
    let carry = "";
    let inThinking = false;

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
          }

          // Emit text content directly — no tool call parsing
          if (content) {
            if (inThinking) {
              inThinking = false;
            }
            writeEvent({ type: "text", content });
          }
        } catch {
          // Incomplete JSON fragment — skip
        }
      }
    }

    writeEvent({ type: "done" });
    res.end();
  } catch (err) {
    req.log?.error({ err }, "[WebsiteStudio:conversation] Stream failed");
    const msg = err instanceof Error ? err.message : "Conversation failed";
    writeEvent({ type: "text", content: `\n\nError: ${msg}` });
    writeEvent({ type: "done" });
    res.end();
  }
});

export default router;