// ─── Website Architect V2 — Phase 1: Architect Agent ─────────────────────────
// POST /api/generate/website-v2
//
// Implements Phase 1 of the V2 pipeline only:
//
//   User Input (idea + BI context)
//     ↓
//   BusinessContext (assembled here)
//     ↓
//   Website Architect Agent (LLM call)
//     ↓
//   WebsiteBlueprint (JSON) → SSE done event
//
// V1 is completely untouched.
// generate-website.ts is NOT imported or modified.
// website-html-generator.ts is NOT used here.
//
// Phase 2 (Code Generation Agent) will be added to this file when Phase 1
// is verified working.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/planGuard";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, extractJson } from "../lib/nvidia";
import { logger } from "../lib/logger";
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
- Decide what COMPONENTS belong on each page
- Decide the COMPONENT HIERARCHY (which components contain which)
- Decide the DESIGN SYSTEM direction (style language, color mood, motion level)
- Decide the RESPONSIVE STRATEGY (how the layout adapts to mobile/tablet/desktop)
- Decide the INTERACTION PLAN (key animation moments, hover states, scroll behaviors)
- Decide the CONTENT STRATEGY (information hierarchy, persuasion flow, trust signal placement)
- Decide the TECHNICAL REQUIREMENTS (Next.js features needed, accessibility, performance)
- Write a brief ARCHITECT RATIONALE explaining why this structure serves the business

COMPONENT NAMING: Use PascalCase component names only (e.g. "HeroSection", "FeatureGrid", "PricingCard"). No implementation details.

OUTPUT: Return ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no code fences, no <think> tags.

{
  "projectType": "marketing" | "saas" | "portfolio" | "ecommerce" | "blog" | "agency",
  "pages": [
    {
      "route": "/",
      "purpose": "one sentence describing the page goal",
      "components": ["ComponentName", "ComponentName"],
      "priority": "primary" | "secondary"
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
        "[v2:architect] Starting Website Architect V2 — Phase 1"
      );

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
      // extractJson succeeds but the model may omit required keys.
      const schemaErrors: string[] = [];
      if (!blueprint || typeof blueprint !== "object") schemaErrors.push("root is not an object");
      if (!blueprint.projectType)                       schemaErrors.push("missing projectType");
      if (!Array.isArray(blueprint.pages) || blueprint.pages.length === 0)
                                                        schemaErrors.push("missing or empty pages");
      if (!blueprint.designSystem || typeof blueprint.designSystem !== "object")
                                                        schemaErrors.push("missing designSystem");
      if (!blueprint.architectRationale)                schemaErrors.push("missing architectRationale");

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
      res.end();

    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");

      const message = isTimeout
        ? "The Architect Agent timed out — the AI service is busy. Please try again."
        : "An unexpected error occurred in the Website Architect. Please try again.";

      req.log.error({ err: String(err), isTimeout, userId }, "[v2:architect] Unhandled error");

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
