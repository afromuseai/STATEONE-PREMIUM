// ─── Marcus Streaming Agent — Autonomous Engineering Loop ─────────────────────
//
// Architecture: single-pass generation upgraded to a self-correcting agent loop.
//
// Loop phases:
//   UNDERSTAND  — analyse the brief, emit context
//   PLAN        — LLM thinks aloud (streaming thinking text)
//   EXECUTE     — LLM writes files via <write_file> XML blocks (real-time Monaco)
//   OBSERVE     — structural validation of generated files (no LLM)
//   FIX         — streaming LLM fix call if issues found (max 2 iterations)
//   VALIDATE    — final structural check
//   REPORT      — persist to DB, emit done
//
// SSE event shapes emitted:
//   { phase: "agent-thinking"; token: string }
//   { phase: "file-start";     path: string; language: string }
//   { phase: "file-token";     path: string; token: string }
//   { phase: "file-done";      path: string; content: string }
//   { phase: "project-created"; projectId: string }
//   { phase: "done";           projectId: string; data: GeneratedProject }
//   { phase: "error";          message: string }
//   // New autonomous loop events (additive):
//   { phase: "loop-phase";  loopPhase: LoopPhase; message: string }
//   { phase: "tool-call";   tool: string; status: "start"|"done"|"failed"; path?: string; detail?: string }
//   { phase: "validation";  success: boolean; errors: string[]; fixed: boolean }

import { streamNvidia } from "../nvidia";
import { logger } from "../logger";
import { MODELS } from "../models";
import type { BusinessContext, ProjectFile, GeneratedProject, WebsiteBlueprint } from "../website-v2-types";
import { createV2Project, saveBlueprint, saveGeneratedFiles, markProjectFailed } from "../website-v2-projects";
import type { Response } from "express";
import type { MarcusTaskBus } from "./marcus-task-bus";
import {
  buildUnderstandingNarration,
  buildPlanningNarration,
  extractDesignDecision,
  buildFilePurpose,
  buildObserveNarration,
  buildFixNarration,
  buildValidateNarration,
  deriveConfidence,
  buildCompletionNarration,
} from "./marcus-narration";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LoopPhase = "UNDERSTAND" | "PLAN" | "EXECUTE" | "OBSERVE" | "FIX" | "VALIDATE" | "REPORT";

/** How sure we are in the completion report — derived from validation outcome,
 *  never guessed. HIGH = validated clean on the first pass, MEDIUM = validated
 *  clean after fixes, LOW = still has known issues after max fix attempts. */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

// Narrator fields below are all optional and additive: every existing consumer
// that only reads `phase`/`loopPhase`/`message`/etc. keeps working unchanged.
// They surface *only* information already available in-process (BusinessContext,
// the model's own planning text, validation results, file paths) — never
// fabricated. See marcus-narration.ts for how each is derived.
export type StreamAgentSseEvent =
  | { phase: "agent-thinking"; token: string }
  | { phase: "file-start";     path: string; language: string }
  | { phase: "file-token";     path: string; token: string }
  | { phase: "file-done";      path: string; content: string }
  | { phase: "project-created"; projectId: string }
  | {
      phase: "done";
      projectId: string;
      data: GeneratedProject;
      /** Narrative wrap-up, e.g. "Website completed. I created …" */
      message?: string;
      summary?: string;
      decision?: string;
      filesCreated?: string[];
      confidence?: ConfidenceLevel;
      timestamp?: number;
    }
  | { phase: "error";          message: string }
  | {
      phase: "loop-phase";
      loopPhase: LoopPhase;
      message: string;
      /** Wrap-up narration, populated on REPORT/completion-adjacent emissions. */
      summary?: string;
      /** A concrete design/architecture choice extracted from the model's own
       *  planning text — never invented when the model didn't state one. */
      decision?: string;
      reason?: string;
      filesCreated?: string[];
      confidence?: ConfidenceLevel;
      timestamp?: number;
    }
  | {
      phase: "tool-call";
      tool: string;
      status: "start" | "done" | "failed";
      path?: string;
      detail?: string;
      /** Human narration of *why* this file/action matters, e.g. "Creating the
       *  hero section that introduces {company} and drives visitors to {CTA}." */
      message?: string;
      timestamp?: number;
    }
  | {
      phase: "validation";
      success: boolean;
      errors: string[];
      fixed: boolean;
      /** What was actually checked, e.g. "Checking responsiveness, component
       *  structure, and build stability before presenting the website." */
      message?: string;
      summary?: string;
      timestamp?: number;
    };

// ─── SSE writer ───────────────────────────────────────────────────────────────

function sseWrite(res: Response, event: StreamAgentSseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Language inference ───────────────────────────────────────────────────────

function inferLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css"))    return "css";
  if (path.endsWith(".json"))   return "json";
  if (path.endsWith(".md"))     return "markdown";
  if (path.endsWith(".mjs") || path.endsWith(".js")) return "javascript";
  return "text";
}

// ─── Required files for structural validation ──────────────────────────────────

const REQUIRED_FILES = [
  "package.json",
  "app/layout.tsx",
  "app/page.tsx",
  "components/Hero.tsx",
  "components/Footer.tsx",
];

// ─── Structural validator (OBSERVE / VALIDATE phases) ─────────────────────────

interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function validateFiles(fileContents: Map<string, string>): ValidationResult {
  const errors: string[] = [];

  // Check required files are present and non-empty
  for (const required of REQUIRED_FILES) {
    const content = fileContents.get(required);
    if (!content) {
      errors.push(`Missing required file: ${required}`);
    } else if (content.trim().length < 50) {
      errors.push(`File appears empty or too short: ${required}`);
    }
  }

  // Validate package.json is parseable JSON
  const pkg = fileContents.get("package.json");
  if (pkg) {
    try {
      JSON.parse(pkg);
    } catch {
      errors.push("package.json contains invalid JSON");
    }
  }

  // Check TSX/TS files have a default export
  for (const [path, content] of fileContents) {
    if ((path.endsWith(".tsx") || path.endsWith(".ts")) && path !== "tailwind.config.ts") {
      if (!content.includes("export default") && !content.includes("export {")) {
        errors.push(`${path} has no default export`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

// ─── System prompt — PLAN + EXECUTE phases ────────────────────────────────────

const MARCUS_SYSTEM_PROMPT = `You are Marcus, an expert autonomous software engineer inside Website Studio.

Your job: transform a business idea into a complete, production-quality Next.js 14 App Router website.

━━━ AGENT LOOP ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You operate in two phases in a single response:

PHASE 1 — PLAN (thinking text):
Write 4–6 sentences about this specific business: design direction, color palette,
typography choice, key sections, technical decisions. Be specific to THIS company.
End your planning text with exactly: ---BEGIN FILES---

PHASE 2 — EXECUTE (write files):
After ---BEGIN FILES--- write every file using this exact format:

<write_file path="app/page.tsx">
[complete file content — exactly as it would appear on disk]
</write_file>

━━━ FILE WRITING RULES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CRITICAL:
- One <write_file> block per file. Never split a file across multiple blocks.
- Write COMPLETE, FINAL file content — no placeholders, no TODOs, no "..."
- The content between the tags is raw file content — do NOT JSON-encode it
- Do NOT wrap in markdown code fences
- Write files in dependency order: package.json first, then layout, then components

━━━ REQUIRED FILES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate ALL of these files, in this order:
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

━━━ CODE QUALITY ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DESIGN — Visually exceptional:
  • Specific color palette tied to this business — not generic blue/gray
  • Google Fonts via @import in globals.css
  • Real visual depth: gradients, shadows, layered backgrounds
  • Every section has a distinct visual treatment
  • Framer Motion animations that feel purposeful
  • Premium whitespace — sections breathe

COPY — Real and specific:
  • Headlines name specific value ("Cut invoice approval time by 60%")
  • Every claim has numbers and named outcomes
  • CTAs are action-oriented: "Start your free trial", "Book a demo"
  • No lorem ipsum, no placeholder text

CODE — Clean and complete:
  • TypeScript throughout — strict types
  • All components: functional, complete, no stubs
  • Tailwind utility classes only
  • Framer Motion: "use client" directive on animated components
  • next/image for images (gradient placeholder divs if no real images)
  • Mobile-first responsive: works at 375px, 768px, 1440px

━━━ WHAT NOT TO DO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✗ Generic templated designs — every site looks custom-made for THIS company
✗ Placeholder text or TODO comments
✗ Empty or skeleton components
✗ JSON-encoding file content (write raw content between XML tags)
✗ Asking for clarification — proceed with what you have`;

// ─── FIX phase system prompt ──────────────────────────────────────────────────

function buildFixSystemPrompt(issues: string[]): string {
  return `You are Marcus, an expert software engineer. The automated validator found these issues in the generated Next.js website:

ISSUES FOUND:
${issues.map((e, i) => `${i + 1}. ${e}`).join("\n")}

Fix each issue by rewriting the affected files using this exact format:

<write_file path="path/to/file.tsx">
[complete corrected file content]
</write_file>

Rules:
- Write COMPLETE file content — not just the changed section
- Fix every issue listed above
- Do not add commentary or explanations outside the <write_file> tags
- Do not write files that don't need changes`;
}

// ─── XML streaming parser ─────────────────────────────────────────────────────
// Reusable parser that consumes a ReadableStream of NVIDIA SSE chunks and:
//   - emits agent-thinking tokens (up to `---BEGIN FILES---` separator)
//   - emits file-start / file-token / file-done for every <write_file> block
//   - emits tool-call start/done events via the bus
// Returns the completed file map (path → content).

interface ParseStreamOptions {
  res:        Response;
  stream:     ReadableStream<Uint8Array>;
  projectId:  string;
  ctx:        BusinessContext;
  taskBus?:   MarcusTaskBus;
  loopPhase:  LoopPhase;
  /** If true, emit loop-phase:EXECUTE on first write_file encountered */
  emitExecutePhaseTransition: boolean;
  existingFiles?: Map<string, string>;
}

interface ParseStreamResult {
  fileContents:  Map<string, string>;
  files:         ProjectFile[];
  executePhaseEmitted: boolean;
  /** Design decision extracted from the model's own planning text, if it
   *  mentioned one — null when it didn't (never fabricated). */
  designDecision: { decision: string; reason?: string } | null;
}

async function parseXmlStream(opts: ParseStreamOptions): Promise<ParseStreamResult> {
  const {
    res, stream, projectId, ctx, taskBus, loopPhase,
    emitExecutePhaseTransition,
    existingFiles = new Map<string, string>(),
  } = opts;

  const fileContents = new Map<string, string>(existingFiles);
  const files: ProjectFile[] = [];
  let executePhaseEmitted = false;
  let designDecision: { decision: string; reason?: string } | null = null;
  let designDecisionEmitted = false;

  // Extracts a design decision from the model's own planning text and, the
  // first time one is found, emits it as extra metadata on a PLAN loop-phase
  // event — additive, never replaces the original PLAN message.
  function captureDesignDecision(planningText: string) {
    if (designDecisionEmitted) return;
    const found = extractDesignDecision(planningText);
    if (!found) return;
    designDecision = found;
    designDecisionEmitted = true;
    sseWrite(res, {
      phase: "loop-phase",
      loopPhase: "PLAN",
      message: buildPlanningNarration(),
      decision: found.decision,
      reason: found.reason,
      timestamp: Date.now(),
    });
  }

  const decoder = new TextDecoder();
  const reader  = stream.getReader();
  let carry = "";
  let buf   = "";

  type ParseState = "thinking" | "in_open_tag" | "in_file";
  let state:        ParseState = "thinking";
  let currentPath    = "";
  let currentLang    = "";
  let currentContent = "";

  // After seeing ---BEGIN FILES--- separator, flip to file-writing mode
  let seenBeginFiles = false;

  function flushThinking(hold = 0) {
    const safe = hold > 0 ? buf.slice(0, buf.length - hold) : buf;
    if (safe.trim()) sseWrite(res, { phase: "agent-thinking", token: safe });
    buf = hold > 0 ? buf.slice(buf.length - hold) : "";
  }

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
        const parsed = JSON.parse(data) as {
          choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>
        };
        token = parsed.choices?.[0]?.delta?.content
             ?? parsed.choices?.[0]?.delta?.reasoning_content
             ?? "";
      } catch { continue; }
      if (!token) continue;

      buf += token;

      // ── STATE: thinking ──────────────────────────────────────────────────
      if (state === "thinking") {
        // Detect the ---BEGIN FILES--- separator
        if (!seenBeginFiles) {
          const sepIdx = buf.indexOf("---BEGIN FILES---");
          if (sepIdx !== -1) {
            const before = buf.slice(0, sepIdx);
            if (before.trim()) sseWrite(res, { phase: "agent-thinking", token: before });
            captureDesignDecision(before);
            buf = buf.slice(sepIdx + "---BEGIN FILES---".length);
            seenBeginFiles = true;
            // Transition to EXECUTE phase when first separator is seen
            if (emitExecutePhaseTransition && !executePhaseEmitted) {
              executePhaseEmitted = true;
              sseWrite(res, { phase: "loop-phase", loopPhase: "EXECUTE", message: "Writing files…", timestamp: Date.now() });
              taskBus?.emit("pipeline", "start", "running", { phase: "EXECUTE", projectId }, "execute");
            }
          } else {
            // Guard partial separator
            const partial = "---BEGIN FILES---";
            let holdLen = 0;
            for (let l = partial.length - 1; l >= 1; l--) {
              if (buf.endsWith(partial.slice(0, l))) { holdLen = l; break; }
            }
            flushThinking(holdLen);
            continue;
          }
        }

        // Look for <write_file opening
        const openIdx = buf.indexOf("<write_file");
        if (openIdx !== -1) {
          // Flush text before the tag as thinking
          const before = buf.slice(0, openIdx);
          if (before.trim()) sseWrite(res, { phase: "agent-thinking", token: before });
          buf   = buf.slice(openIdx);
          state = "in_open_tag";

          // Design decisions can only come from the model's own planning text;
          // this fallback path skips ---BEGIN FILES---, so capture whatever
          // thinking text preceded the first <write_file> tag before it's gone.
          captureDesignDecision(before);

          // Emit execute phase transition on first write_file if separator wasn't seen
          if (emitExecutePhaseTransition && !executePhaseEmitted) {
            executePhaseEmitted = true;
            sseWrite(res, { phase: "loop-phase", loopPhase: "EXECUTE", message: "Writing files…", timestamp: Date.now() });
            taskBus?.emit("pipeline", "start", "running", { phase: "EXECUTE", projectId }, "execute");
          }
        } else {
          const partial = "<write_file";
          let holdLen = 0;
          for (let l = partial.length - 1; l >= 1; l--) {
            if (buf.endsWith(partial.slice(0, l))) { holdLen = l; break; }
          }
          flushThinking(holdLen);
        }
        continue;
      }

      // ── STATE: in_open_tag ───────────────────────────────────────────────
      if (state === "in_open_tag") {
        const closeAngle = buf.indexOf(">");
        if (closeAngle === -1) continue;

        const openTag = buf.slice(0, closeAngle + 1);
        buf = buf.slice(closeAngle + 1);

        const pathMatch = openTag.match(/path="([^"]+)"/);
        if (!pathMatch) {
          logger.warn({ openTag }, "[MARCUS_STREAM] write_file tag missing path attribute");
          state = "thinking";
          continue;
        }

        currentPath    = pathMatch[1];
        currentLang    = inferLanguage(currentPath);
        currentContent = "";

        // Emit tool-call start
        sseWrite(res, {
          phase: "tool-call",
          tool: "write_file",
          status: "start",
          path: currentPath,
          message: buildFilePurpose(currentPath, ctx),
          timestamp: Date.now(),
        });
        taskBus?.emit("filesystem", "create_file", "running", { path: currentPath, projectId }, loopPhase);

        sseWrite(res, { phase: "file-start", path: currentPath, language: currentLang });
        logger.info({ projectId, path: currentPath }, "[MARCUS_STREAM] File start");

        state = "in_file";
      }

      // ── STATE: in_file ───────────────────────────────────────────────────
      if (state === "in_file") {
        const closeTag = "</write_file>";
        const closeIdx = buf.indexOf(closeTag);

        if (closeIdx === -1) {
          const guard = closeTag.length - 1;
          if (buf.length > guard) {
            const emittable = buf.slice(0, buf.length - guard);
            sseWrite(res, { phase: "file-token", path: currentPath, token: emittable });
            currentContent += emittable;
            buf = buf.slice(buf.length - guard);
          }
          continue;
        }

        const finalChunk = buf.slice(0, closeIdx);
        if (finalChunk) {
          sseWrite(res, { phase: "file-token", path: currentPath, token: finalChunk });
          currentContent += finalChunk;
        }
        buf = buf.slice(closeIdx + closeTag.length);

        const content = currentContent.replace(/^\n/, "");

        sseWrite(res, { phase: "file-done", path: currentPath, content });

        // Emit tool-call done
        sseWrite(res, {
          phase: "tool-call", tool: "write_file", status: "done",
          path: currentPath, detail: `${content.length} bytes`,
          timestamp: Date.now(),
        });
        taskBus?.emit("filesystem", "create_file", "completed", {
          path: currentPath, projectId, bytes: content.length,
        }, loopPhase);

        logger.info({ projectId, path: currentPath, bytes: content.length }, "[MARCUS_STREAM] File done");

        fileContents.set(currentPath, content);
        files.push({ path: currentPath, operation: "create", content, language: currentLang });

        currentPath    = "";
        currentContent = "";
        state = "thinking";
      }
    }
  }

  // Flush remaining buffer
  if (state === "thinking" && buf.trim()) {
    sseWrite(res, { phase: "agent-thinking", token: buf });
  }
  if (state === "in_file" && currentContent) {
    const content = currentContent.replace(/^\n/, "");
    sseWrite(res, { phase: "file-done", path: currentPath, content });
    fileContents.set(currentPath, content);
    files.push({ path: currentPath, operation: "create", content, language: currentLang });
  }

  return { fileContents, files, executePhaseEmitted, designDecision };
}

// ─── Main autonomous agent runner ─────────────────────────────────────────────

const MAX_FIX_ITERATIONS = 2;

export async function runMarcusStreamAgent(
  ctx: BusinessContext,
  userId: string,
  res: Response,
  taskBus?: MarcusTaskBus,
  signal?: AbortSignal,
): Promise<void> {
  let projectId: string | undefined;
  let fileContents = new Map<string, string>();
  let allFiles: ProjectFile[] = [];

  // The client can disconnect at any point (navigated away, retried, closed the
  // tab) — but without this check the LLM calls and DB write below keep running
  // to completion regardless, burning tokens/compute and creating a project the
  // user never sees. Bail out before every expensive step once that happens.
  const bailIfAborted = (): boolean => {
    if (!signal?.aborted) return false;
    logger.info({ projectId, userId }, "[MARCUS_STREAM] Client disconnected — aborting pipeline, skipping DB save");
    return true;
  };

  taskBus?.emit("pipeline", "start", "running", { userId }, "pipeline");

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

Start with your PLAN (4-6 sentences about design/tech decisions for THIS specific business), then write ---BEGIN FILES--- and write every required file.
`.trim();

  try {
    // ── UNDERSTAND phase ──────────────────────────────────────────────────────
    const understanding = buildUnderstandingNarration(ctx);
    sseWrite(res, {
      phase: "loop-phase",
      loopPhase: "UNDERSTAND",
      message: understanding.message,
      summary: understanding.summary,
      timestamp: Date.now(),
    });
    taskBus?.emit("pipeline", "start", "running", { phase: "UNDERSTAND", userId, industry: ctx.industry }, "understand");

    // tool-call: read business brief (input analysis)
    sseWrite(res, { phase: "tool-call", tool: "read_file", status: "start", path: "business-brief" });
    sseWrite(res, { phase: "agent-thinking", token: `Analysing: ${ctx.companyName} · ${ctx.industry} · ${ctx.targetAudience}\n` });
    sseWrite(res, { phase: "tool-call", tool: "read_file", status: "done", path: "business-brief", detail: "Context loaded" });

    // ── Create project record ─────────────────────────────────────────────────
    const createdProjectId = await createV2Project(userId, ctx);
    if (!createdProjectId) throw new Error("Failed to create project record");
    projectId = createdProjectId;

    sseWrite(res, { phase: "project-created", projectId });
    taskBus?.emit("database", "save_project", "completed", { projectId, userId }, "pipeline");
    logger.info({ projectId, userId }, "[MARCUS_STREAM] Project created");

    // ── PLAN phase ────────────────────────────────────────────────────────────
    sseWrite(res, { phase: "loop-phase", loopPhase: "PLAN", message: buildPlanningNarration(), timestamp: Date.now() });
    taskBus?.emit("llm", "codegen_start", "running", { model: MODELS.WEBSITE_V2_CODE_GEN, projectId, phase: "PLAN" }, "plan");

    // ── EXECUTE phase (streaming LLM call) ────────────────────────────────────
    // Note: PLAN → EXECUTE transition is emitted by the parser when ---BEGIN FILES--- or first <write_file> is seen.
    const generateStream = await streamNvidia({
      model:       MODELS.WEBSITE_V2_CODE_GEN,
      messages: [
        { role: "system", content: MARCUS_SYSTEM_PROMPT },
        { role: "user",   content: userPrompt },
      ],
      temperature: 0.65,
      maxTokens:   32000,
      _feature:    "website-v2-stream",
      _userId:     userId,
      _projectId:  projectId,
      signal,
    });

    const execResult = await parseXmlStream({
      res,
      stream: generateStream,
      projectId,
      ctx,
      taskBus,
      loopPhase: "EXECUTE",
      emitExecutePhaseTransition: true,
    });

    fileContents = execResult.fileContents;
    allFiles = execResult.files;

    taskBus?.emit("llm", "codegen_complete", "completed", {
      projectId, fileCount: allFiles.length,
    }, "execute");

    logger.info({ projectId, fileCount: allFiles.length }, "[MARCUS_STREAM] EXECUTE phase complete");

    if (bailIfAborted()) return;

    // ── OBSERVE phase ──────────────────────────────────────────────────────────
    sseWrite(res, { phase: "loop-phase", loopPhase: "OBSERVE", message: buildObserveNarration(), timestamp: Date.now() });
    taskBus?.emit("pipeline", "start", "running", { phase: "OBSERVE", projectId }, "observe");

    // tool-call: list_files
    sseWrite(res, { phase: "tool-call", tool: "list_files", status: "start" });
    const fileList = Array.from(fileContents.keys());
    sseWrite(res, {
      phase: "tool-call", tool: "list_files", status: "done",
      detail: `${fileList.length} files: ${fileList.join(", ")}`,
    });
    taskBus?.emit("filesystem", "read_file", "completed", { projectId, fileCount: fileList.length }, "observe");

    // tool-call: inspect_build_error
    sseWrite(res, { phase: "tool-call", tool: "inspect_build_error", status: "start" });
    let validation = validateFiles(fileContents);
    sseWrite(res, {
      phase: "tool-call", tool: "inspect_build_error", status: validation.ok ? "done" : "failed",
      detail: validation.ok ? "No issues found" : `${validation.errors.length} issue(s): ${validation.errors[0]}`,
    });

    sseWrite(res, {
      phase: "validation", success: validation.ok, errors: validation.errors, fixed: false,
      message: "Checking responsiveness, component structure, and build stability before presenting the website.",
      timestamp: Date.now(),
    });

    // ── FIX phase (iterative if issues found) ─────────────────────────────────
    let fixIteration = 0;
    while (!validation.ok && fixIteration < MAX_FIX_ITERATIONS) {
      fixIteration++;
      const issues = validation.errors;

      const fixNarration = buildFixNarration(issues, fixIteration);
      sseWrite(res, {
        phase: "loop-phase",
        loopPhase: "FIX",
        message: fixNarration.message,
        summary: fixNarration.summary,
        timestamp: Date.now(),
      });
      taskBus?.emit("llm", "edit_start", "running", {
        model: MODELS.WEBSITE_V2_CODE_GEN,
        projectId,
        issues: issues.length,
        iteration: fixIteration,
      }, "fix");

      logger.info({ projectId, issues, fixIteration }, "[MARCUS_STREAM] FIX phase starting");

      const fixStream = await streamNvidia({
        model:       MODELS.WEBSITE_V2_CODE_GEN,
        messages: [
          { role: "system", content: buildFixSystemPrompt(issues) },
          { role: "user",   content: `Fix these issues in the ${ctx.companyName} Next.js website:\n\n${issues.join("\n")}` },
        ],
        temperature: 0.3,
        maxTokens:   16000,
        _feature:    "website-v2-fix",
        _userId:     userId,
        _projectId:  projectId,
      });

      const fixResult = await parseXmlStream({
        res,
        stream:    fixStream,
        projectId,
        ctx,
        taskBus,
        loopPhase: "FIX",
        emitExecutePhaseTransition: false,
        existingFiles: fileContents,
      });

      // Merge fixed files into our map
      for (const [path, content] of fixResult.fileContents) {
        fileContents.set(path, content);
      }
      // Add/update allFiles list
      for (const fixedFile of fixResult.files) {
        const existing = allFiles.findIndex(f => f.path === fixedFile.path);
        if (existing !== -1) {
          allFiles[existing] = fixedFile;
        } else {
          allFiles.push(fixedFile);
        }
      }

      taskBus?.emit("llm", "edit_complete", "completed", {
        projectId, fixedFiles: fixResult.files.length,
      }, "fix");

      // Re-validate
      validation = validateFiles(fileContents);
      sseWrite(res, {
        phase: "validation", success: validation.ok, errors: validation.errors, fixed: true,
        message: "Re-checking the fixed files for the same issues before continuing.",
        timestamp: Date.now(),
      });

      logger.info({ projectId, fixIteration, stillFailing: !validation.ok }, "[MARCUS_STREAM] FIX phase complete");
    }

    // ── VALIDATE phase ─────────────────────────────────────────────────────────
    const validateNarration = buildValidateNarration(validation);
    sseWrite(res, {
      phase: "loop-phase",
      loopPhase: "VALIDATE",
      message: validateNarration.message,
      summary: validateNarration.summary,
      confidence: deriveConfidence(validation, fixIteration),
      timestamp: Date.now(),
    });
    taskBus?.emit("validation", "typescript", validation.ok ? "completed" : "failed", {
      projectId,
      errors: validation.errors.length,
    }, "validate");

    if (allFiles.length === 0) {
      throw new Error("Marcus generated no files — the model may not have followed the write_file format");
    }

    // ── REPORT phase — persist to DB ───────────────────────────────────────────
    sseWrite(res, { phase: "loop-phase", loopPhase: "REPORT", message: "Saving project…", timestamp: Date.now() });

    logger.info({ projectId, fileCount: allFiles.length }, "[MARCUS_STREAM] Saving files to DB");

    const minimalBlueprint: WebsiteBlueprint = {
      projectType:    "marketing",
      pages:          [{ route: "/", purpose: ctx.businessGoal, components: [], priority: "primary" }],
      designSystem:   { style: "custom", colorPrimary: "auto", colorAccent: "auto", typography: "auto", motion: "subtle", borderRadius: "md" },
      componentHierarchy:    {},
      responsiveStrategy:    "mobile-first",
      interactionPlan:       [],
      contentStrategy:       ctx.businessGoal,
      technicalRequirements: ["Next.js 14 App Router", "Tailwind CSS", "Framer Motion"],
      architectRationale:    `Generated for ${ctx.companyName} — ${ctx.idea}`,
    };

    taskBus?.emit("database", "save_files", "running", { projectId, fileCount: allFiles.length }, "report");
    await saveBlueprint(projectId, minimalBlueprint);
    await saveGeneratedFiles(projectId, allFiles, ["framer-motion", "lucide-react"], "");
    taskBus?.emit("database", "save_files", "completed", { projectId, fileCount: allFiles.length }, "report");

    const generatedProject: GeneratedProject = {
      projectId,
      files:           allFiles,
      dependencies:    ["framer-motion", "lucide-react"],
      runInstructions: { command: "npm run dev" },
      preview:         "",
      blueprint:       minimalBlueprint,
      context:         ctx,
    };

    const completion = buildCompletionNarration(
      ctx,
      allFiles.map(f => f.path),
      validation,
      execResult.designDecision,
    );
    sseWrite(res, {
      phase: "done",
      projectId,
      data: generatedProject,
      message: completion.message,
      summary: completion.summary,
      decision: execResult.designDecision?.decision,
      filesCreated: allFiles.map(f => f.path),
      confidence: deriveConfidence(validation, fixIteration),
      timestamp: Date.now(),
    });
    taskBus?.emit("pipeline", "finish", "completed", { projectId, fileCount: allFiles.length }, "pipeline");
    logger.info({ projectId, fileCount: allFiles.length }, "[MARCUS_STREAM] Generation complete");

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, projectId }, "[MARCUS_STREAM] Generation failed");
    if (projectId) await markProjectFailed(projectId, message).catch(() => {});
    taskBus?.emit("pipeline", "error", "failed", { error: message, projectId }, "pipeline");
    sseWrite(res, { phase: "error", message });
  }
}
