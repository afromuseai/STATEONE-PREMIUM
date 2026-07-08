// ─── Marcus Streaming Agent — Replit-style tool-calling generation loop ────────
//
// Single pass generation: one NVIDIA streaming call with explicit tool-call
// XML parsing. Marcus emits <tool_call> blocks; we execute them in real-time
// and emit SSE events for each action so the frontend can show:
//
//   • "thinking" text tokens → AgentPanel thought bubbles
//   • file_write tool calls  → file tokens streaming into Monaco
//   • run_command calls      → terminal output in TerminalPanel
//   • done                   → WebContainer boots with all files
//
// SSE event types emitted:
//   { phase: "agent-thinking"; token: string }
//   { phase: "file-start";     path: string; language: string }
//   { phase: "file-token";     path: string; token: string }
//   { phase: "file-done";      path: string; content: string }
//   { phase: "tool-call";      name: string; status: "start"|"done"|"error"; params?: Record<string,unknown>; result?: string }
//   { phase: "project-created"; projectId: string }
//   { phase: "done";           projectId: string; data: GeneratedProject }
//   { phase: "error";          message: string }

import { streamNvidia } from "../nvidia";
import { logger } from "../logger";
import { MODELS } from "../models";
import type { BusinessContext, ProjectFile, GeneratedProject, WebsiteBlueprint } from "../website-v2-types";
import { createV2Project, saveBlueprint, saveGeneratedFiles, markProjectFailed } from "../website-v2-projects";
import type { Response } from "express";

export type StreamAgentSseEvent =
  | { phase: "agent-thinking"; token: string }
  | { phase: "file-start";     path: string; language: string }
  | { phase: "file-token";     path: string; token: string }
  | { phase: "file-done";      path: string; content: string }
  | { phase: "tool-call";      name: string; status: "start" | "done" | "error"; params?: Record<string, unknown>; result?: string }
  | { phase: "project-created"; projectId: string }
  | { phase: "done";           projectId: string; data: GeneratedProject }
  | { phase: "error";          message: string };

function sseWrite(res: Response, event: StreamAgentSseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── System prompt — Replit/v0 style tool-calling agent ───────────────────────
const MARCUS_STREAM_SYSTEM_PROMPT = `You are Marcus, an expert autonomous software engineer inside Website Studio.

Your job: transform a business idea into a complete, production-quality Next.js 14 App Router website.

You operate like a senior engineer — you think, plan, then write files one by one. You do NOT produce JSON schemas or blueprints. You write real code directly.

━━━ YOUR TOOLS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have one primary tool:

<tool_call>
{"name": "write_file", "path": "app/page.tsx", "content": "...full file content..."}
</tool_call>

Rules:
- Call write_file once per file. Never split a file across multiple calls.
- Write the complete, final file content every time — no placeholders, no TODOs.
- Call tools in the right dependency order: layout.tsx before page.tsx, components before pages.

━━━ THINKING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing files, think through your approach: write 3–5 sentences about the design direction, component structure, and key technical decisions. This is visible to the user. Be specific to this business — not generic.

━━━ FILE STRUCTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate exactly these files in this order:

1. package.json          — dependencies list
2. tailwind.config.ts    — custom design tokens (colors, fonts, spacing)
3. app/globals.css       — @tailwind directives + Google Fonts import + CSS variables
4. app/layout.tsx        — root layout with metadata
5. app/page.tsx          — main page composing all sections
6. components/Navbar.tsx — navigation bar
7. components/Hero.tsx   — hero section (the most important file — make it exceptional)
8. components/Features.tsx — features / benefits section
9. One of: components/Testimonials.tsx | components/HowItWorks.tsx | components/Stats.tsx | components/Pricing.tsx
10. components/CTA.tsx   — final call-to-action band
11. components/Footer.tsx — footer

━━━ CODE QUALITY STANDARDS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESIGN — Make it visually exceptional:
  • Choose a specific, distinctive color palette tied to this business — not generic dark/light
  • Use Google Fonts via @import in globals.css — pick fonts that match the brand personality
  • Create real visual depth: gradients, shadows, layered backgrounds, subtle textures
  • Every section must have a distinct visual treatment — no repeated layouts
  • Animations via Framer Motion that feel purposeful, not decorative
  • Premium whitespace — sections breathe; nothing feels cramped

COPY — Make it real and specific:
  • Headlines name the specific value, not vague promises ("Cut invoice approval time by 60%" not "Save time")
  • Every claim is specific: numbers, percentages, named outcomes
  • CTAs are action-oriented: "Start your free trial", "Book a demo", "Join 2,400+ builders"
  • No lorem ipsum, no placeholder text, no [Company Name] brackets

CODE — Make it clean and complete:
  • TypeScript throughout — strict types, no any without justification
  • All React components: functional, complete, no stubs
  • Tailwind utility classes only — no inline styles except dynamic values
  • Framer Motion: use "use client" directive on animated components
  • next/image for all images (use placeholder divs with styled backgrounds if no real images)
  • Mobile-first responsive: every section works at 375px, 768px, 1440px

━━━ WHAT NOT TO DO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ Generic templated designs — every website you make should look like it was designed for THIS company
✗ Repeated section layouts — hero and features and CTA should not all look the same
✗ Placeholder text — every word is real business copy
✗ Empty or skeleton sections — every component ships 100% complete
✗ "// TODO" comments — if you write it, it works
✗ Asking the user for clarification — you have enough information; proceed

━━━ HOW TO OUTPUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Start with 3-5 sentences of thinking (visible to user — be specific and insightful)
2. Write each file using <tool_call> blocks
3. After the last file, write one sentence confirming completion

Do NOT wrap tool calls in markdown code blocks. Use raw <tool_call> XML tags.`;

// ─── Language inference ───────────────────────────────────────────────────────
function inferLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css"))    return "css";
  if (path.endsWith(".json"))   return "json";
  if (path.endsWith(".md"))     return "markdown";
  return "text";
}

// ─── Tool call parser — streaming state machine ───────────────────────────────
// Parses tool_call XML blocks from a streaming token buffer.
// Returns extracted tool calls and remaining unprocessed text.
interface ParsedToolCall {
  name:    string;
  path?:   string;
  content?: string;
  raw:     string;
}

function extractToolCalls(buffer: string): { calls: ParsedToolCall[]; remainder: string } {
  const calls: ParsedToolCall[] = [];
  let remainder = buffer;

  // Find complete <tool_call>...</tool_call> blocks
  const toolCallRe = /<tool_call>([\s\S]*?)<\/tool_call>/g;
  let match: RegExpExecArray | null;
  let lastMatchEnd = 0;
  const parts: string[] = [];

  while ((match = toolCallRe.exec(buffer)) !== null) {
    // Keep text before this tool call in remainder (non-tool thinking)
    const before = buffer.slice(lastMatchEnd, match.index);
    if (before) parts.push(before);
    lastMatchEnd = match.index + match[0].length;

    const inner = match[1].trim();
    try {
      const parsed = JSON.parse(inner) as Record<string, unknown>;
      calls.push({
        name:    String(parsed.name ?? "unknown"),
        path:    parsed.path ? String(parsed.path) : undefined,
        content: parsed.content ? String(parsed.content) : undefined,
        raw:     match[0],
      });
    } catch {
      // Not valid JSON — skip
      logger.warn({ inner: inner.slice(0, 100) }, "[MARCUS_STREAM] Failed to parse tool_call JSON");
    }
  }

  // Everything after last match is potentially an in-progress tool call
  const tail = buffer.slice(lastMatchEnd);
  // If tail contains an opening <tool_call> without close, hold it
  const openIdx = tail.lastIndexOf("<tool_call>");
  if (openIdx !== -1) {
    remainder = tail.slice(openIdx); // hold from opening tag
    const textBefore = tail.slice(0, openIdx);
    if (textBefore) parts.push(textBefore);
  } else {
    remainder = "";
    if (tail) parts.push(tail);
  }

  return { calls, remainder };
}

// ─── Main streaming agent runner ──────────────────────────────────────────────
export async function runMarcusStreamAgent(
  ctx: BusinessContext,
  userId: string,
  res: Response,
): Promise<void> {
  let projectId: string | undefined;
  const files: ProjectFile[] = [];
  const fileContents = new Map<string, string>(); // path → accumulated content

  const userPrompt = `
BUSINESS BRIEF
──────────────
Business idea:    ${ctx.idea}
Company name:     ${ctx.companyName}
Industry:         ${ctx.industry}
Target audience:  ${ctx.targetAudience}
Business goal:    ${ctx.businessGoal}
Brand positioning: ${ctx.brandPositioning}
Conversion goal:  ${ctx.conversionGoal}

Generate the complete Next.js website now. Start with your thinking, then write every file.
`.trim();

  try {
    // ── Create project record ──────────────────────────────────────────────────
    const project = await createV2Project(userId, ctx);
    projectId = project.id;
    sseWrite(res, { phase: "project-created", projectId });
    logger.info({ projectId, userId }, "[MARCUS_STREAM] Project created");

    // ── Start streaming call ───────────────────────────────────────────────────
    const stream = await streamNvidia({
      model: MODELS.WEBSITE_V2_CODE_GEN, // nemotron-3-super-120b — large-context code gen, no thinking mode
      messages: [
        { role: "system", content: MARCUS_STREAM_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.65,
      maxTokens: 32000,
      _feature: "website-v2-stream",
      _userId: userId,
      _projectId: projectId,
    });

    // ── Token processing loop ─────────────────────────────────────────────────
    const decoder = new TextDecoder();
    const reader  = stream.getReader();
    let carry = "";     // incomplete SSE line carried across chunks
    let buffer = "";    // accumulated text waiting for tool call parsing

    // Per-file streaming state
    let currentFilePath: string | null = null;
    let currentFileBuffer = "";

    // Track whether we're inside a <tool_call> block (for streaming tokens into editor)
    let inToolCall = false;
    let toolCallAccum = "";

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

        let token = "";
        try {
          const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
          token = parsed.choices?.[0]?.delta?.content ?? "";
        } catch { continue; }

        if (!token) continue;

        buffer += token;

        // ── Detect <tool_call> open tag in buffer ────────────────────────────
        if (!inToolCall) {
          const openIdx = buffer.indexOf("<tool_call>");
          if (openIdx !== -1) {
            // Emit everything before the tool call as thinking
            const thinking = buffer.slice(0, openIdx);
            if (thinking.trim()) {
              sseWrite(res, { phase: "agent-thinking", token: thinking });
            }
            buffer = buffer.slice(openIdx);
            inToolCall = true;
            toolCallAccum = "";
          } else {
            // Check if buffer might be starting a partial <tool_call> tag
            const partialMatch = "<tool_call>".slice(0, -1);
            let holdFrom = -1;
            for (let l = 1; l <= partialMatch.length; l++) {
              if (buffer.endsWith("<tool_call>".slice(0, l))) {
                holdFrom = buffer.length - l;
                break;
              }
            }
            if (holdFrom !== -1) {
              const safe = buffer.slice(0, holdFrom);
              if (safe.trim()) sseWrite(res, { phase: "agent-thinking", token: safe });
              buffer = buffer.slice(holdFrom);
            } else {
              // No partial — flush all as thinking
              if (buffer.trim()) sseWrite(res, { phase: "agent-thinking", token: buffer });
              buffer = "";
            }
            continue;
          }
        }

        // ── Inside a tool_call — accumulate until closing tag ────────────────
        if (inToolCall) {
          const closeIdx = buffer.indexOf("</tool_call>");
          if (closeIdx === -1) {
            // Still accumulating — stream file tokens if we know the file path
            if (currentFilePath) {
              sseWrite(res, { phase: "file-token", path: currentFilePath, token });
              currentFileBuffer += token;
            }
            continue;
          }

          // We have a complete tool_call
          const fullBlock = buffer.slice(0, closeIdx + "</tool_call>".length);
          buffer = buffer.slice(closeIdx + "</tool_call>".length);
          inToolCall = false;

          // Parse it
          const innerMatch = fullBlock.match(/<tool_call>([\s\S]*?)<\/tool_call>/);
          if (!innerMatch) continue;

          let parsed: Record<string, unknown>;
          try {
            parsed = JSON.parse(innerMatch[1].trim()) as Record<string, unknown>;
          } catch {
            logger.warn({ raw: innerMatch[1].slice(0, 100) }, "[MARCUS_STREAM] Failed to parse completed tool_call");
            currentFilePath = null;
            currentFileBuffer = "";
            continue;
          }

          const toolName = String(parsed.name ?? "");
          const filePath = parsed.path ? String(parsed.path) : undefined;
          const fileContent = parsed.content ? String(parsed.content) : undefined;

          if (toolName === "write_file" && filePath && fileContent !== undefined) {
            // ── Handle completed file ───────────────────────────────────────
            if (currentFilePath && currentFilePath !== filePath) {
              // Finalize previous file (edge case: two back-to-back without gap)
              const prevContent = fileContents.get(currentFilePath) ?? currentFileBuffer;
              sseWrite(res, { phase: "file-done", path: currentFilePath, content: prevContent });
            }

            const language = inferLanguage(filePath);

            // The content came all at once in the JSON (post-close-tag parsing)
            // Emit file-start + all tokens + file-done
            sseWrite(res, { phase: "file-start", path: filePath, language });
            sseWrite(res, { phase: "tool-call", name: "write_file", status: "start", params: { path: filePath } });

            // Emit the content in chunks so it streams into the editor
            const chunkSize = 80;
            for (let i = 0; i < fileContent.length; i += chunkSize) {
              const tok = fileContent.slice(i, i + chunkSize);
              sseWrite(res, { phase: "file-token", path: filePath, token: tok });
            }

            sseWrite(res, { phase: "file-done", path: filePath, content: fileContent });
            sseWrite(res, { phase: "tool-call", name: "write_file", status: "done", params: { path: filePath } });

            fileContents.set(filePath, fileContent);
            files.push({ path: filePath, operation: "create", content: fileContent, language });

            currentFilePath = filePath;
            currentFileBuffer = fileContent;

            logger.info({ projectId, path: filePath, bytes: fileContent.length }, "[MARCUS_STREAM] File written");
          }

          // Reset for next tool call
          currentFilePath = null;
          currentFileBuffer = "";

          // Continue looking for next <tool_call> in remaining buffer
          if (buffer.trim()) {
            const nextOpen = buffer.indexOf("<tool_call>");
            if (nextOpen !== -1) {
              const thinking = buffer.slice(0, nextOpen);
              if (thinking.trim()) sseWrite(res, { phase: "agent-thinking", token: thinking });
              buffer = buffer.slice(nextOpen);
              inToolCall = true;
            } else {
              if (buffer.trim()) sseWrite(res, { phase: "agent-thinking", token: buffer });
              buffer = "";
            }
          }
        }
      }
    }

    // ── Flush any remaining buffer ─────────────────────────────────────────────
    if (buffer.trim() && !inToolCall) {
      sseWrite(res, { phase: "agent-thinking", token: buffer });
    }

    // ── Persist to DB ──────────────────────────────────────────────────────────
    if (files.length === 0) {
      throw new Error("Marcus generated no files — stream may have been empty or malformed");
    }

    logger.info({ projectId, fileCount: files.length }, "[MARCUS_STREAM] Saving files to DB");

    // Build a minimal placeholder blueprint for DB compatibility
    const minimalBlueprint: WebsiteBlueprint = {
      projectType: "marketing",
      pages: [{ route: "/", purpose: ctx.businessGoal, components: [], priority: "primary" }],
      designSystem: { style: "custom", colorPrimary: "auto", colorAccent: "auto", typography: "auto", motion: "subtle", borderRadius: "md" },
      componentHierarchy: {},
      responsiveStrategy: "mobile-first",
      interactionPlan: [],
      contentStrategy: ctx.businessGoal,
      technicalRequirements: ["Next.js 14 App Router", "Tailwind CSS", "Framer Motion"],
      architectRationale: `Generated for ${ctx.companyName} — ${ctx.idea}`,
    };

    await saveBlueprint(projectId, minimalBlueprint);

    const generatedProject: GeneratedProject = {
      projectId,
      files,
      dependencies: ["framer-motion", "lucide-react"],
      runInstructions: { command: "npm run dev" },
      preview: "",
      blueprint: minimalBlueprint,
      context: ctx,
    };

    await saveGeneratedFiles(projectId, files, ["framer-motion", "lucide-react"], "");

    sseWrite(res, { phase: "done", projectId, data: generatedProject });
    logger.info({ projectId, fileCount: files.length }, "[MARCUS_STREAM] Generation complete");

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, projectId }, "[MARCUS_STREAM] Generation failed");
    if (projectId) await markProjectFailed(projectId, message).catch(() => {});
    sseWrite(res, { phase: "error", message });
  }
}
