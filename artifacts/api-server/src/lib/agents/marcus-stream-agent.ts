// ─── Marcus Streaming Agent — Replit-style tool-calling generation loop ────────
//
// Single pass generation: one NVIDIA streaming call. Marcus emits XML file blocks;
// we stream them token-by-token into the frontend Monaco editor in real-time.
//
// File format (no JSON escaping needed — content goes between XML tags):
//
//   <write_file path="app/page.tsx">
//   [full file content]
//   </write_file>
//
// SSE event types emitted:
//   { phase: "agent-thinking"; token: string }
//   { phase: "file-start";     path: string; language: string }
//   { phase: "file-token";     path: string; token: string }
//   { phase: "file-done";      path: string; content: string }
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
  | { phase: "project-created"; projectId: string }
  | { phase: "done";           projectId: string; data: GeneratedProject }
  | { phase: "error";          message: string };

function sseWrite(res: Response, event: StreamAgentSseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── System prompt — XML file blocks, no JSON content escaping ────────────────
const MARCUS_STREAM_SYSTEM_PROMPT = `You are Marcus, an expert autonomous software engineer inside Website Studio.

Your job: transform a business idea into a complete, production-quality Next.js 14 App Router website.

You operate like a senior engineer — you think briefly, then write files one by one.

━━━ HOW TO WRITE FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Use this exact format for every file. Put the complete file content between the tags:

<write_file path="app/page.tsx">
[complete file content here — exactly as it would appear on disk]
</write_file>

CRITICAL RULES:
- One <write_file> block per file. Never split a file.
- Write the COMPLETE, FINAL file content — no placeholders, no TODOs, no "..."
- The content between the tags is the raw file — do NOT JSON-encode it
- Do NOT wrap in markdown code fences (no \`\`\`tsx)
- Write files in dependency order: layout before page, components before pages

━━━ THINKING ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before the first file, write 3–5 sentences about the design direction, color palette, and key technical decisions. Be specific to this business.

━━━ FILE STRUCTURE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate exactly these files in this order:

1. package.json
2. tailwind.config.ts
3. app/globals.css
4. app/layout.tsx
5. app/page.tsx
6. components/Navbar.tsx
7. components/Hero.tsx
8. components/Features.tsx
9. components/Testimonials.tsx  (or HowItWorks.tsx or Pricing.tsx — pick what fits)
10. components/CTA.tsx
11. components/Footer.tsx

━━━ CODE QUALITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESIGN — Visually exceptional:
  • Specific color palette tied to this business — not generic
  • Google Fonts via @import in globals.css
  • Real visual depth: gradients, shadows, layered backgrounds
  • Every section has a distinct visual treatment
  • Framer Motion animations that feel purposeful
  • Premium whitespace — sections breathe

COPY — Real and specific:
  • Headlines name the specific value ("Cut invoice approval time by 60%")
  • Every claim has numbers and named outcomes
  • CTAs are action-oriented: "Start your free trial", "Book a demo"
  • No lorem ipsum, no placeholder text, no [Company Name] brackets

CODE — Clean and complete:
  • TypeScript throughout — strict types
  • All components: functional, complete, no stubs
  • Tailwind utility classes only
  • Framer Motion: "use client" directive on animated components
  • next/image for images (placeholder divs with backgrounds if no real images)
  • Mobile-first responsive: works at 375px, 768px, 1440px

━━━ WHAT NOT TO DO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ Generic templated designs — every site looks custom-made for THIS company
✗ Repeated section layouts
✗ Placeholder text
✗ Empty or skeleton components
✗ TODO comments
✗ JSON-encoding the file content (write raw content between the XML tags)
✗ Asking for clarification — proceed with what you have`;

// ─── Language inference ───────────────────────────────────────────────────────
function inferLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css"))    return "css";
  if (path.endsWith(".json"))   return "json";
  if (path.endsWith(".md"))     return "markdown";
  if (path.endsWith(".mjs") || path.endsWith(".js")) return "javascript";
  return "text";
}

// ─── Main streaming agent runner ──────────────────────────────────────────────
export async function runMarcusStreamAgent(
  ctx: BusinessContext,
  userId: string,
  res: Response,
): Promise<void> {
  let projectId: string | undefined;
  const files: ProjectFile[] = [];
  const fileContents = new Map<string, string>();

  const userPrompt = `
BUSINESS BRIEF
──────────────
Business idea:     ${ctx.idea}
Company name:      ${ctx.companyName}
Industry:          ${ctx.industry}
Target audience:   ${ctx.targetAudience}
Business goal:     ${ctx.businessGoal}
Brand positioning: ${ctx.brandPositioning}
Conversion goal:   ${ctx.conversionGoal}

Generate the complete Next.js website now. Start with 3-5 sentences of thinking, then write every file using <write_file path="..."> tags.
`.trim();

  try {
    // ── Create project record ────────────────────────────────────────────────
    const project = await createV2Project(userId, ctx);
    projectId = project.id;
    sseWrite(res, { phase: "project-created", projectId });
    logger.info({ projectId, userId }, "[MARCUS_STREAM] Project created");

    // ── Start streaming call ─────────────────────────────────────────────────
    const stream = await streamNvidia({
      model:       MODELS.WEBSITE_V2_CODE_GEN,
      messages: [
        { role: "system", content: MARCUS_STREAM_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.65,
      maxTokens:   32000,
      _feature:    "website-v2-stream",
      _userId:     userId,
      _projectId:  projectId,
    });

    // ── Token processing state machine ───────────────────────────────────────
    // States:
    //   thinking    — between files, emitting agent-thinking events
    //   in_open_tag — we saw "<write_file" and are accumulating the opening tag
    //   in_file     — between open and closing tag, streaming file-token events
    //
    type State = "thinking" | "in_open_tag" | "in_file";

    const decoder = new TextDecoder();
    const reader  = stream.getReader();
    let carry = "";           // incomplete SSE line
    let buf   = "";           // lookahead buffer for tag detection

    let state: State = "thinking";
    let currentPath    = "";
    let currentLang    = "";
    let currentContent = "";  // accumulated file content

    // ── Helper: flush buf as thinking tokens ─────────────────────────────────
    // Keep up to `hold` trailing chars in buf (partial tag guard).
    function flushThinking(hold = 0) {
      const safe = hold > 0 ? buf.slice(0, buf.length - hold) : buf;
      if (safe.trim()) sseWrite(res, { phase: "agent-thinking", token: safe });
      buf = hold > 0 ? buf.slice(buf.length - hold) : "";
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = carry + decoder.decode(value, { stream: true });
      const lines  = chunk.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        let token = "";
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
          };
          // Prefer content; fall back to reasoning_content (some models)
          token = parsed.choices?.[0]?.delta?.content
               ?? parsed.choices?.[0]?.delta?.reasoning_content
               ?? "";
        } catch { continue; }
        if (!token) continue;

        buf += token;

        // ── STATE: thinking ────────────────────────────────────────────────
        if (state === "thinking") {
          // Look for <write_file opening
          const openIdx = buf.indexOf("<write_file");
          if (openIdx !== -1) {
            // Flush everything before the tag as thinking
            const before = buf.slice(0, openIdx);
            if (before.trim()) sseWrite(res, { phase: "agent-thinking", token: before });
            buf   = buf.slice(openIdx);
            state = "in_open_tag";
          } else {
            // Guard against a partial "<write_file" split across chunks
            const partial = "<write_file";
            let holdLen = 0;
            for (let l = partial.length - 1; l >= 1; l--) {
              if (buf.endsWith(partial.slice(0, l))) { holdLen = l; break; }
            }
            flushThinking(holdLen);
          }
          continue;
        }

        // ── STATE: in_open_tag ─────────────────────────────────────────────
        // Accumulate until we see the closing ">" of the opening tag
        if (state === "in_open_tag") {
          const closeAngle = buf.indexOf(">");
          if (closeAngle === -1) continue; // still accumulating

          const openTag = buf.slice(0, closeAngle + 1);
          buf = buf.slice(closeAngle + 1);

          // Extract path attribute
          const pathMatch = openTag.match(/path="([^"]+)"/);
          if (!pathMatch) {
            // Malformed tag — discard and go back to thinking
            logger.warn({ openTag }, "[MARCUS_STREAM] write_file tag missing path attribute");
            state = "thinking";
            continue;
          }

          currentPath    = pathMatch[1];
          currentLang    = inferLanguage(currentPath);
          currentContent = "";

          sseWrite(res, { phase: "file-start", path: currentPath, language: currentLang });
          logger.info({ projectId, path: currentPath }, "[MARCUS_STREAM] File start");

          state = "in_file";

          // There may already be content buffered after the ">"
          // — fall through to in_file handling below by processing buf
        }

        // ── STATE: in_file ────────────────────────────────────────────────
        if (state === "in_file") {
          // Look for closing tag
          const closeTag = "</write_file>";
          const closeIdx = buf.indexOf(closeTag);

          if (closeIdx === -1) {
            // No closing tag yet — stream everything except possible partial close tag
            const guard = closeTag.length - 1;
            if (buf.length > guard) {
              const emittable = buf.slice(0, buf.length - guard);
              sseWrite(res, { phase: "file-token", path: currentPath, token: emittable });
              currentContent += emittable;
              buf = buf.slice(buf.length - guard);
            }
            continue;
          }

          // Closing tag found — emit final content chunk
          const finalChunk = buf.slice(0, closeIdx);
          if (finalChunk) {
            sseWrite(res, { phase: "file-token", path: currentPath, token: finalChunk });
            currentContent += finalChunk;
          }
          buf = buf.slice(closeIdx + closeTag.length);

          // Strip one leading newline from content (right after opening tag)
          const content = currentContent.replace(/^\n/, "");

          sseWrite(res, { phase: "file-done", path: currentPath, content });
          logger.info({ projectId, path: currentPath, bytes: content.length }, "[MARCUS_STREAM] File done");

          fileContents.set(currentPath, content);
          files.push({
            path:      currentPath,
            operation: "create",
            content,
            language:  currentLang,
          });

          currentPath    = "";
          currentContent = "";
          state = "thinking";

          // Any remaining buf might have thinking text or next file — loop continues
        }
      }
    }

    // ── Flush remaining buffer ───────────────────────────────────────────────
    if (state === "thinking" && buf.trim()) {
      sseWrite(res, { phase: "agent-thinking", token: buf });
    }
    if (state === "in_file" && currentContent) {
      // Stream ended mid-file — save what we have
      const content = currentContent.replace(/^\n/, "");
      sseWrite(res, { phase: "file-done", path: currentPath, content });
      files.push({ path: currentPath, operation: "create", content, language: currentLang });
    }

    // ── Persist to DB ────────────────────────────────────────────────────────
    if (files.length === 0) {
      throw new Error("Marcus generated no files — the model may not have followed the write_file format");
    }

    logger.info({ projectId, fileCount: files.length }, "[MARCUS_STREAM] Saving files to DB");

    const minimalBlueprint: WebsiteBlueprint = {
      projectType:    "marketing",
      pages:          [{ route: "/", purpose: ctx.businessGoal, components: [], priority: "primary" }],
      designSystem:   { style: "custom", colorPrimary: "auto", colorAccent: "auto", typography: "auto", motion: "subtle", borderRadius: "md" },
      componentHierarchy:     {},
      responsiveStrategy:     "mobile-first",
      interactionPlan:        [],
      contentStrategy:        ctx.businessGoal,
      technicalRequirements:  ["Next.js 14 App Router", "Tailwind CSS", "Framer Motion"],
      architectRationale:     `Generated for ${ctx.companyName} — ${ctx.idea}`,
    };

    await saveBlueprint(projectId, minimalBlueprint);
    await saveGeneratedFiles(projectId, files, ["framer-motion", "lucide-react"], "");

    const generatedProject: GeneratedProject = {
      projectId,
      files,
      dependencies:    ["framer-motion", "lucide-react"],
      runInstructions: { command: "npm run dev" },
      preview:         "",
      blueprint:       minimalBlueprint,
      context:         ctx,
    };

    sseWrite(res, { phase: "done", projectId, data: generatedProject });
    logger.info({ projectId, fileCount: files.length }, "[MARCUS_STREAM] Generation complete");

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, projectId }, "[MARCUS_STREAM] Generation failed");
    if (projectId) await markProjectFailed(projectId, message).catch(() => {});
    sseWrite(res, { phase: "error", message });
  }
}
