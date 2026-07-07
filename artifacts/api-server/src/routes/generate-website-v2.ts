// ─── Website Architect V2 — Phase 1 + Phase 2 + Persistence ──────────────────
// POST /api/generate/website-v2
//
// Full V2 pipeline (Phase 2.5 + Phase 3):
//
//   POST request
//     ↓
//   Create project record (DB) → SSE project-created
//     ↓
//   BusinessContext assembled
//     ↓
//   Phase 1: Website Architect Agent (LLM)
//     ↓
//   Save blueprint (DB) → SSE blueprint
//     ↓
//   Phase 2: Code Generation Agent (LLM) → SSE building chunks
//     ↓
//   Save generated files (DB) → SSE project-saved
//     ↓
//   SSE done
//
// V1 is completely untouched.
// generate-website.ts is NOT imported or modified.
// website-html-generator.ts is NOT used here.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/planGuard";
import { MODELS } from "../lib/models";
import { streamNvidia, extractJson } from "../lib/nvidia";
import { logger } from "../lib/logger";
import { generateProjectCode, CODE_GENERATOR_MODEL } from "../lib/website-v2-code-generator";
import {
  createV2Project,
  saveBlueprint,
  saveGeneratedFiles,
  markProjectFailed,
} from "../lib/website-v2-projects";
import type {
  BusinessContext,
  WebsiteBlueprint,
  V2SseEvent,
} from "../lib/website-v2-types";

const router = Router();

// ─── Model assignment ─────────────────────────────────────────────────────────
// Architect Agent: needs strong structured reasoning and JSON fidelity.
// Llama-4 Maverick is confirmed working for JSON output on this account.
const ARCHITECT_MODEL = MODELS.WEBSITE_PLANNING; // meta/llama-4-maverick-17b-128e-instruct

// ─── Architect Agent system prompt ───────────────────────────────────────────
// The agent acts as a senior frontend architect.
// It MUST NOT generate code, HTML, CSS, or marketing copy.
// Output is exclusively a WebsiteBlueprint JSON object.
const ARCHITECT_SYSTEM_PROMPT = `You are a senior frontend architect at a world-class product studio.

Your role is ARCHITECTURE ONLY. You analyze a business brief and produce a structured engineering blueprint that another AI agent will use to build the website.

YOU MUST NOT:
- Write any HTML
- Write any React, JSX, or TypeScript code
- Write any CSS or Tailwind classes
- Write marketing copy, headlines, taglines, or CTAs
- Generate placeholder text or lorem ipsum

YOU MUST:
- Decide what PAGES are needed and why
- Decide what COMPONENTS belong on each page, and for EACH component specify:
    • purpose   — one sentence: what this component achieves for the user
    • layout    — structural/visual description (e.g. "split hero, text left, product visual right")
    • contentElements — content slots inside the component (no copy, just slot names)
                        e.g. ["headline", "supporting paragraph", "primary CTA", "trust badge"]
    • behavior  — interaction, animation, and responsive rules
                  e.g. ["fade in on mount with staggered children", "stacks vertically on mobile"]
- Decide the COMPONENT HIERARCHY (which components contain which)
- Decide the DESIGN SYSTEM direction (style language, color mood, motion level)
- Decide the RESPONSIVE STRATEGY (how the layout adapts to mobile/tablet/desktop)
- Decide the INTERACTION PLAN (key animation moments, hover states, scroll behaviors)
- Decide the CONTENT STRATEGY (information hierarchy, persuasion flow, trust signal placement)
- Decide the TECHNICAL REQUIREMENTS (Next.js features needed, accessibility, performance)
- Write a brief ARCHITECT RATIONALE explaining why this structure serves the business

COMPONENT NAMING: Use PascalCase names only (e.g. "HeroSection", "FeatureGrid", "PricingCard").
CONTENT ELEMENTS: Name the slot, never the copy. Write "headline", not "AI-Powered Contract Review".
BEHAVIOR: Describe the rule, never the implementation. Write "fade in on scroll", not "opacity-0 → opacity-1".

OUTPUT: Return ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no code fences, no <think> tags.

{
  "projectType": "marketing" | "saas" | "portfolio" | "ecommerce" | "blog" | "agency",
  "pages": [
    {
      "route": "/",
      "purpose": "one sentence describing the page goal",
      "priority": "primary" | "secondary",
      "components": [
        {
          "name": "HeroSection",
          "purpose": "establish value proposition and drive primary CTA click",
          "layout": "split hero with text left and product visual right",
          "contentElements": ["headline", "supporting paragraph", "primary CTA", "trust badge"],
          "behavior": ["fade in on load with staggered children", "stacks vertically below 768px"]
        },
        {
          "name": "FeatureGrid",
          "purpose": "communicate key product capabilities",
          "layout": "3-column icon-card grid",
          "contentElements": ["section heading", "feature card × 3 (icon, title, description)"],
          "behavior": ["cards animate into view on scroll", "collapses to single column on mobile"]
        }
      ]
    }
  ],
  "designSystem": {
    "style": "descriptive style label e.g. 'enterprise futuristic' or 'warm editorial'",
    "colorPrimary": "descriptive color mood e.g. 'deep navy' or 'warm slate'",
    "colorAccent": "descriptive accent mood e.g. 'electric blue' or 'amber gold'",
    "typography": "typographic direction e.g. 'geometric sans with tight tracking'",
    "motion": "none" | "subtle" | "expressive",
    "borderRadius": "sharp" | "sm" | "md" | "lg" | "full"
  },
  "componentHierarchy": {
    "ComponentName": ["ChildComponent", "AnotherChild"]
  },
  "responsiveStrategy": "paragraph describing mobile-first approach, key breakpoint behaviors",
  "interactionPlan": [
    "Hero section fades in with staggered children on load",
    "Nav collapses to hamburger below 768px"
  ],
  "contentStrategy": "paragraph describing information hierarchy and persuasion flow from top to bottom",
  "technicalRequirements": [
    "Next.js 14 App Router",
    "Framer Motion for scroll animations",
    "next/image for all media"
  ],
  "architectRationale": "2-3 sentences explaining why this structure serves the specific business and audience"
}`;

// ─── Build the user prompt from BusinessContext ───────────────────────────────
function buildArchitectPrompt(ctx: BusinessContext): string {
  const biSection = ctx.existingBI
    ? `\nBUSINESS INTELLIGENCE ANALYSIS:\n${JSON.stringify(ctx.existingBI, null, 2)}`
    : "";

  return `BUSINESS BRIEF
──────────────
Business idea:    ${ctx.idea}
Company name:     ${ctx.companyName}
Industry:         ${ctx.industry}
Target audience:  ${ctx.targetAudience}
Business goal:    ${ctx.businessGoal}
Brand position:   ${ctx.brandPositioning}
Conversion goal:  ${ctx.conversionGoal}
${biSection}

Based on this brief, produce the WebsiteBlueprint JSON for this business. Make every architectural decision count — this blueprint will drive AI code generation directly.`;
}

// ─── Extract BusinessContext from request body ────────────────────────────────
// The idea is always required. All other fields are derived from BI output
// or fall back to sensible defaults inferred from the idea.
function extractBusinessContext(body: Record<string, unknown>): BusinessContext {
  const idea = String(body.idea ?? "").trim();
  const bi = (body.businessIntelligence ?? {}) as Record<string, unknown>;

  return {
    idea,
    companyName:      String(bi.companyName ?? bi.name ?? "The Company"),
    industry:         String(bi.industry   ?? "SaaS"),
    targetAudience:   String(bi.targetAudience ?? bi.audience ?? "professionals"),
    businessGoal:     String(bi.businessGoal   ?? bi.goal    ?? "grow the business"),
    brandPositioning: String(bi.brandPositioning ?? bi.positioning ?? "leading solution in the space"),
    conversionGoal:   String(bi.conversionGoal   ?? bi.conversion  ?? "sign up / get started"),
    existingBI:       Object.keys(bi).length > 0 ? bi : undefined,
  };
}

// ─── SSE helper ───────────────────────────────────────────────────────────────
function sseWrite(res: import("express").Response, event: V2SseEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

// ─── Route ────────────────────────────────────────────────────────────────────
router.post(
  "/generate/website-v2",
  requireAuth,
  requireFeature("website_generator"),
  async (req, res): Promise<void> => {
    // Open SSE stream immediately so the client receives typed error events
    // rather than a plain HTTP error that the SSE reader treats as a network failure.
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const userId = req.user?.userId ?? "";

    try {
      const body = req.body as Record<string, unknown>;

      // ── Input validation ────────────────────────────────────────────────────
      if (!body.idea || typeof body.idea !== "string" || !String(body.idea).trim()) {
        sseWrite(res, {
          phase: "error",
          message: "No business idea provided. Please describe your business.",
          code: "NO_IDEA",
        });
        res.end();
        return;
      }

      // ── Assemble BusinessContext ────────────────────────────────────────────
      const context = extractBusinessContext(body);

      req.log.info(
        { userId, industry: context.industry, ideaLength: context.idea.length },
        "[v2:architect] Starting Website Architect V2 — Phase 1 + Persistence"
      );

      // ── Create project record (Phase 3) ─────────────────────────────────────
      const projectId = await createV2Project(userId, context);
      if (projectId) {
        sseWrite(res, { phase: "project-created", projectId });
      }

      // ── Signal start to client ──────────────────────────────────────────────
      sseWrite(res, {
        phase: "start",
        model: ARCHITECT_MODEL,
        industry: context.industry,
      });

      // ── Phase 1: Website Architect Agent ────────────────────────────────────
      // Stream the architect agent's JSON generation token-by-token.
      // Each content chunk is forwarded as { phase: "architect", content: "..." }
      // so the client can show a live typing indicator.
      const stream = await streamNvidia({
        model:       ARCHITECT_MODEL,
        temperature: 0.7,
        maxTokens:   3000,
        messages: [
          { role: "system",  content: ARCHITECT_SYSTEM_PROMPT },
          { role: "user",    content: buildArchitectPrompt(context) },
        ],
        _feature:   "website_generator_v2_architect",
        _userId:    userId,
      });

      // Forward stream tokens to client, accumulate full buffer.
      // We re-label each content chunk with { phase: "architect", content } rather
      // than using forwardStream() directly, which emits the raw { content } shape.
      const decoder = new TextDecoder();
      const reader  = stream.getReader();
      let carry          = "";
      let buffer         = "";
      // Fix: thinking state machine — emit each transition at most once
      let thinkingActive = false;
      let thinkingSent   = false;
      let contentStarted = false;

      const processLines = (text: string) => {
        const lines = text.split("\n");
        // Keep the last (possibly incomplete) fragment in carry
        carry = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed  = JSON.parse(data) as Record<string, unknown>;
            const delta    = (parsed.choices as Array<{ delta?: { content?: string; reasoning_content?: string } }>)?.[0]?.delta;
            const content  = delta?.content;
            const thinking = delta?.reasoning_content;

            // Thinking started: emit once when first reasoning token arrives
            if (thinking && !thinkingActive && !contentStarted) {
              thinkingActive = true;
              thinkingSent   = true;
              sseWrite(res, { phase: "thinking", active: true });
            }

            if (content) {
              // Content started: close thinking phase once if it was open
              if (thinkingActive && !contentStarted) {
                thinkingActive = false;
                sseWrite(res, { phase: "thinking", active: false });
              }
              contentStarted = true;
              buffer += content;
              sseWrite(res, { phase: "architect", content });
            }
          } catch {
            // Malformed SSE fragment — skip silently
          }
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          processLines(carry + decoder.decode(value, { stream: true }));
        }

        // Fix: flush decoder tail and any remaining carry after stream ends
        const tail = decoder.decode(); // flush internal state
        if (tail) carry += tail;
        if (carry.startsWith("data: ")) {
          const data = carry.slice(6).trim();
          if (data && data !== "[DONE]") {
            try {
              const parsed  = JSON.parse(data) as Record<string, unknown>;
              const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
              if (content) { buffer += content; sseWrite(res, { phase: "architect", content }); }
            } catch { /* incomplete fragment — discard */ }
          }
        }

        // If thinking was opened but content never arrived, close it
        if (thinkingSent && thinkingActive) {
          sseWrite(res, { phase: "thinking", active: false });
        }
      } finally {
        reader.releaseLock();
      }

      if (!buffer || buffer.length < 50) {
        req.log.error({ userId, bufLen: buffer.length }, "[v2:architect] Empty response from Architect Agent");
        sseWrite(res, {
          phase:   "error",
          message: "The Architect Agent returned an empty response. Please try again.",
          code:    "EMPTY_RESPONSE",
        });
        res.end();
        return;
      }

      // ── Parse blueprint ──────────────────────────────────────────────────────
      let blueprint: WebsiteBlueprint;
      try {
        blueprint = extractJson(buffer) as WebsiteBlueprint;
      } catch (parseErr) {
        req.log.error(
          { userId, parseErr, bufLen: buffer.length, bufSnippet: buffer.slice(0, 200) },
          "[v2:architect] Blueprint JSON parse failed"
        );
        sseWrite(res, {
          phase:   "error",
          message: "Failed to parse the architecture blueprint. Please try again.",
          code:    "PARSE_ERROR",
        });
        res.end();
        return;
      }

      // Fix: runtime schema guard — validate required fields before emitting.
      // extractJson succeeds but the model may omit required keys or produce
      // null/non-object entries; all property accesses are guarded to avoid throws.
      const schemaErrors: string[] = [];

      if (!blueprint || typeof blueprint !== "object") {
        schemaErrors.push("root is not an object");
      } else {
        if (!blueprint.projectType)
          schemaErrors.push("missing projectType");
        if (!blueprint.architectRationale)
          schemaErrors.push("missing architectRationale");
        if (!blueprint.designSystem || typeof blueprint.designSystem !== "object")
          schemaErrors.push("missing designSystem");

        if (!Array.isArray(blueprint.pages) || blueprint.pages.length === 0) {
          schemaErrors.push("missing or empty pages");
        } else {
          blueprint.pages.forEach((page, pi) => {
            // Guard: page entry itself may be null or non-object
            if (!page || typeof page !== "object") {
              schemaErrors.push(`pages[${pi}] is not an object`);
              return;
            }
            const route = typeof page.route === "string" ? page.route : `[${pi}]`;

            if (!Array.isArray(page.components) || page.components.length === 0) {
              schemaErrors.push(`pages[${pi}] (${route}) has no components`);
              return;
            }

            page.components.forEach((comp: unknown, ci: number) => {
              const id = `pages[${pi}].components[${ci}]`;

              // Plain strings: legacy format — explicit rejection with clear message
              if (typeof comp === "string") {
                schemaErrors.push(
                  `${id} is a plain string ("${comp}") — expected an object with name/purpose/layout/contentElements/behavior`
                );
                return;
              }

              // Guard: comp must be a non-null object before any property access
              if (!comp || typeof comp !== "object") {
                schemaErrors.push(`${id} is not an object (got ${comp === null ? "null" : typeof comp})`);
                return;
              }

              const c = comp as Record<string, unknown>;

              // Required string fields — must be non-empty strings
              for (const field of ["name", "purpose", "layout"] as const) {
                if (typeof c[field] !== "string" || !(c[field] as string).trim()) {
                  schemaErrors.push(`${id} missing or empty "${field}"`);
                }
              }

              // Required array fields — must be arrays of strings
              for (const field of ["contentElements", "behavior"] as const) {
                if (!Array.isArray(c[field])) {
                  schemaErrors.push(`${id} "${field}" is not an array`);
                } else {
                  const nonStrings = (c[field] as unknown[]).filter(item => typeof item !== "string");
                  if (nonStrings.length > 0) {
                    schemaErrors.push(`${id} "${field}" contains ${nonStrings.length} non-string item(s)`);
                  }
                }
              }
            });
          });
        }
      }

      if (schemaErrors.length > 0) {
        req.log.error(
          { userId, schemaErrors, bufSnippet: buffer.slice(0, 300) },
          "[v2:architect] Blueprint failed schema validation"
        );
        sseWrite(res, {
          phase:   "error",
          message: `The architecture blueprint is incomplete (${schemaErrors.join(", ")}). Please try again.`,
          code:    "SCHEMA_ERROR",
        });
        res.end();
        return;
      }

      // ── Save blueprint (Phase 3) ─────────────────────────────────────────────
      if (projectId) {
        await saveBlueprint(projectId, blueprint);
      }

      // ── Emit completed blueprint ─────────────────────────────────────────────
      req.log.info(
        {
          userId,
          projectType:  blueprint.projectType,
          pageCount:    blueprint.pages?.length ?? 0,
          industry:     context.industry,
        },
        "[v2:architect] Blueprint complete"
      );

      sseWrite(res, { phase: "blueprint", data: blueprint });

      // ── Phase 2: Code Generation Agent ──────────────────────────────────────
      const codegenStart = Date.now();
      req.log.info(
        {
          userId,
          model:      CODE_GENERATOR_MODEL,
          projectId:  projectId ?? "(none)",
          pageCount:  blueprint.pages?.length ?? 0,
          stage:      "codegen_start",
        },
        "[v2:codegen] STAGE ENTERED: Code Generation Agent"
      );

      // Emit building phase-start signal (no content = signal only)
      sseWrite(res, { phase: "building" });

      let project;
      try {
        project = await generateProjectCode(
          context,
          blueprint,
          userId,
          (content) => sseWrite(res, { phase: "building", content }),
          (active)  => sseWrite(res, { phase: "thinking", active }),
        );
        req.log.info(
          {
            userId,
            projectId:  projectId ?? "(none)",
            fileCount:  project.files.length,
            depCount:   project.dependencies.length,
            previewLen: project.preview.length,
            elapsedMs:  Date.now() - codegenStart,
            stage:      "codegen_ok",
          },
          `[v2:codegen] STAGE COMPLETE: Code Generation Agent succeeded in ${Date.now() - codegenStart}ms`
        );
      } catch (codeErr) {
        const elapsedMs = Date.now() - codegenStart;
        req.log.error(
          {
            err:       String(codeErr),
            errName:   codeErr instanceof Error ? codeErr.name : "unknown",
            errMsg:    codeErr instanceof Error ? codeErr.message : String(codeErr),
            userId,
            projectId: projectId ?? "(none)",
            elapsedMs,
            stage:     "codegen_failed",
            // Determine failure category from error message
            failureCategory:
              String(codeErr).includes("JSON parse failed")       ? "JSON_PARSE_ERROR" :
              String(codeErr).includes("schema errors")           ? "SCHEMA_VALIDATION_ERROR" :
              String(codeErr).includes("empty response")          ? "EMPTY_RESPONSE" :
              String(codeErr).includes("HTTP 4")                  ? "NVIDIA_HTTP_ERROR" :
              String(codeErr).includes("HTTP 5")                  ? "NVIDIA_HTTP_ERROR" :
              String(codeErr).includes("TimeoutError")            ? "TIMEOUT" :
              String(codeErr).includes("AbortError")              ? "ABORTED" :
              "UNKNOWN",
          },
          `[v2:codegen] FAILURE: Code Generation Agent threw after ${elapsedMs}ms — ${String(codeErr).slice(0, 300)}`
        );
        if (projectId) await markProjectFailed(projectId, String(codeErr));
        sseWrite(res, {
          phase:   "error",
          message: "The Code Generation Agent failed to produce a valid project. Please try again.",
          code:    "CODEGEN_ERROR",
        });
        res.end();
        return;
      }

      req.log.info(
        {
          userId,
          fileCount:  project.files.length,
          previewLen: project.preview.length,
        },
        "[v2:codegen] Project generation complete"
      );

      // ── Save generated files (Phase 3) ──────────────────────────────────────
      if (projectId) {
        await saveGeneratedFiles(
          projectId,
          project.files,
          project.dependencies,
          project.preview
        );
        project = { ...project, projectId };
        sseWrite(res, { phase: "project-saved", projectId });
      }

      sseWrite(res, { phase: "done", projectId: projectId ?? "", data: project });
      res.end();

    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");

      const message = isTimeout
        ? "The Architect Agent timed out — the AI service is busy. Please try again."
        : "An unexpected error occurred in the Website Architect. Please try again.";

      req.log.error({ err: String(err), isTimeout, userId }, "[v2:architect] Unhandled error");

      // Best-effort: mark project failed if we created one
      // (projectId may not be in scope here if the error happened before creation;
      //  we rely on the local catch blocks above for codegen failures)

      // Only write SSE error if headers are already sent (stream was opened)
      if (res.headersSent) {
        sseWrite(res, { phase: "error", message, code: isTimeout ? "TIMEOUT" : "INTERNAL_ERROR" });
        res.end();
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

export default router;
