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
import {
  MarcusConversationEngine,
} from "../lib/agents/marcus-conversation";
import type { ConversationEvent } from "../lib/agents/marcus-conversation";
import { MarcusTaskBus } from "../lib/agents/marcus-task-bus";

const router = Router();

// ─── Model assignment ─────────────────────────────────────────────────────────
// Architect Agent: meta/llama-4-maverick-17b-128e-instruct — fast, structured
// JSON output. stepfun-ai/step-3.7-flash is not accessible on this account (401).
const ARCHITECT_MODEL = MODELS.WEBSITE_V2_ARCHITECT; // meta/llama-4-maverick-17b-128e-instruct

// ─── Architect Agent system prompt ───────────────────────────────────────────
// Constrained to produce a minimal first-generation landing page blueprint:
//   • Single route "/" only
//   • Max 6 components using canonical names (Navbar/Hero/Features/CTA/Footer + 1 optional)
//   • No auth, dashboards, pricing systems, multi-page navigation, or backend features
// The Code Generation agent maps these components to exactly 8 canonical files.
const ARCHITECT_SYSTEM_PROMPT = `You are the Website Architect Agent — a senior practitioner combining four disciplines:

  Product Strategist    — you understand conversion funnels, user psychology, and growth levers
  UX Designer           — you think in experiences, not wireframes
  Conversion Specialist — you know what makes visitors become customers
  Frontend Architect    — you define component hierarchies, design systems, and technical constraints

Your job is not simply producing a schema. You are designing the experience a real product team would build. The output must represent a premium production website — something a real startup would pay a design agency for.

━━━ THINK BEFORE YOU OUTPUT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before writing any JSON, reason through these questions internally:

BUSINESS
  • Who exactly is the customer — their role, their pain, their decision-making context?
  • What specific problem does this product solve better than any alternative?
  • What single action should a visitor take after 30 seconds on this page?

EXPERIENCE
  • What must visitors understand within the first 5 seconds above the fold?
  • What builds immediate credibility for this specific audience? (logo bars? numbers? faces? guarantees?)
  • What objections will visitors have, and which section handles each?
  • What emotional pull makes someone stop scrolling and click?

DESIGN
  • What visual identity matches this brand's positioning and their audience's expectations?
  • What typography personality reinforces the brand voice — geometric, editorial, humanist, slab?
  • What color psychology serves the emotional goal — trust, energy, luxury, approachability?
  • What motion strategy fits the product's energy — none, subtle, expressive?

Every architectural decision in your blueprint must be traceable to one of these answers.

━━━ SCOPE — HARD CONSTRAINTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONE PAGE ONLY: route "/" — do not add /about, /pricing, /dashboard, /login, or any other route.

MAXIMUM 6 COMPONENTS — always include these 5 canonical components:
  Navbar    — top navigation bar
  Hero      — primary above-fold value proposition
  Features  — key product/service highlights (2–4 items)
  CTA       — final conversion call-to-action band
  Footer    — footer with links and copyright

You may add ONE optional 6th section between Features and CTA. Choose the most conversion-relevant for this specific business:
  Testimonials | HowItWorks | SocialProof | Stats | Pricing

DO NOT include any of the following:
  - Authentication, login, sign-up, or account management
  - Dashboards, admin panels, or management interfaces
  - Pricing tables that link to checkout (Pricing section = marketing display only)
  - Multiple routes or multi-page navigation
  - Backend APIs, server actions, or database logic
  - Any feature not visible on a public landing page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

YOU MUST NOT:
- Write any HTML, React, JSX, TypeScript, or CSS
- Write marketing copy, headlines, taglines, or CTAs
- Generate placeholder text or lorem ipsum

YOU MUST for EACH component specify:
  • purpose          — one sentence: what this component achieves for conversion
  • layout           — structural/visual description informed by the business type
                       e.g. "split hero, founder photo right, headline and proof points left"
  • contentElements  — content slots inside the component (no copy, just slot names)
                       e.g. ["headline", "supporting paragraph", "primary CTA", "trust badge"]
  • behavior         — interaction, animation, and responsive rules
                       e.g. ["fade in on mount with staggered children", "stacks vertically on mobile"]

AND decide:
  - DESIGN SYSTEM: a specific visual language tailored to this business — not generic
  - RESPONSIVE STRATEGY: how the layout adapts, with specific breakpoint reasoning
  - INTERACTION PLAN: key animation moments that reinforce brand energy
  - CONTENT STRATEGY: the persuasion flow from first glance to conversion click
  - TECHNICAL REQUIREMENTS: Next.js features, motion libraries, accessibility
  - ARCHITECT RATIONALE: why this specific structure serves this specific business

CONTENT ELEMENTS: Name the slot, never the copy. Write "headline", not "AI-Powered Contract Review".
BEHAVIOR: Describe the rule, never the implementation. Write "fade in on scroll", not "opacity-0 → opacity-1".
DESIGN SYSTEM: Be specific to the business. Not "modern blue" — instead "cold-process charcoal with oxidized copper accent, conveying handcrafted premium".

OUTPUT: Return ONLY a valid JSON object matching this exact schema. No markdown, no explanation, no code fences, no <think> tags.

{
  "projectType": "marketing" | "saas" | "portfolio" | "ecommerce" | "blog" | "agency",
  "pages": [
    {
      "route": "/",
      "purpose": "one sentence describing the conversion goal of this specific landing page",
      "priority": "primary",
      "components": [
        {
          "name": "Navbar",
          "purpose": "orient the visitor and provide navigation anchors",
          "layout": "horizontal bar with logo left, nav links center, CTA button right",
          "contentElements": ["logo", "nav links (3–4)", "primary CTA button"],
          "behavior": ["sticky on scroll", "collapses to hamburger below 768px"]
        },
        {
          "name": "Hero",
          "purpose": "establish value proposition and drive primary CTA click",
          "layout": "centered hero with headline, sub-headline, and two CTAs",
          "contentElements": ["headline", "supporting paragraph", "primary CTA", "secondary CTA", "trust badge"],
          "behavior": ["fade in on load with staggered children", "stacks vertically below 768px"]
        },
        {
          "name": "Features",
          "purpose": "communicate key product or service capabilities",
          "layout": "3-column icon-card grid",
          "contentElements": ["section heading", "feature card × 3 (icon, title, description)"],
          "behavior": ["cards animate into view on scroll", "collapses to single column on mobile"]
        },
        {
          "name": "CTA",
          "purpose": "drive the final conversion action at the bottom of the page",
          "layout": "full-width band with headline and primary button",
          "contentElements": ["headline", "supporting line", "primary CTA button"],
          "behavior": ["fade in on scroll into view"]
        },
        {
          "name": "Footer",
          "purpose": "close the page with brand and legal information",
          "layout": "single row with logo, nav links, and copyright",
          "contentElements": ["logo", "nav links", "copyright line"],
          "behavior": ["static, no animation"]
        }
      ]
    }
  ],
  "designSystem": {
    "style": "specific style label tied to the brand — e.g. 'cold-process industrial' or 'warm artisan editorial'",
    "colorPrimary": "specific color direction tied to psychology — e.g. 'deep oxidized navy, conveys institutional trust'",
    "colorAccent": "specific accent direction — e.g. 'amber gold, signals premium and warmth'",
    "typography": "specific typographic direction — e.g. 'humanist sans with wide tracking, approachable authority'",
    "motion": "none" | "subtle" | "expressive",
    "borderRadius": "sharp" | "sm" | "md" | "lg" | "full"
  },
  "componentHierarchy": {
    "Navbar": [],
    "Hero": [],
    "Features": [],
    "CTA": [],
    "Footer": []
  },
  "responsiveStrategy": "specific mobile-first reasoning tied to the likely audience device split",
  "interactionPlan": [
    "Hero section fades in with staggered children on load",
    "Nav collapses to hamburger below 768px"
  ],
  "contentStrategy": "specific persuasion flow from top to bottom — what the visitor learns at each section and why it moves them toward the CTA",
  "technicalRequirements": [
    "Next.js 14 App Router",
    "Framer Motion for scroll animations",
    "next/image for all media"
  ],
  "architectRationale": "2-3 sentences explaining why THIS specific structure serves THIS specific business and audience — not generic justification"
}`;

// ─── Design Review Agent system prompt ───────────────────────────────────────
// Runs between blueprint generation and code generation (Step 5).
// Critiques the blueprint against 4 production-readiness gates and returns
// an improved WebsiteBlueprint in the same JSON schema.
const DESIGN_REVIEWER_SYSTEM_PROMPT = `You are the Design Review Agent — a senior creative director at a top-tier product agency.

You have just received a website architecture blueprint produced by the Architect Agent.
Your job is to stress-test it against four quality gates before any code is written.

━━━ FOUR QUALITY GATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. REAL COMPANY TEST
   Does this feel like a real company website, or a generic template?
   Look for: business-specific layouts, unique value propositions in the structure,
   industry-appropriate design signals.

2. INVESTMENT TEST
   Would a startup pay a design agency money for this?
   Look for: distinctive visual identity, premium design system choices,
   layouts that couldn't be confused for another company.

3. TRUST TEST
   Does the layout communicate trust to first-time visitors?
   Look for: credibility signals in the right positions (above the fold, near CTAs),
   appropriate social proof placement, professional information hierarchy.

4. UNIQUENESS TEST
   Are the sections meaningfully unique to this specific business?
   Look for: generic "lorem ipsum" style component specs that could apply to any company,
   missed opportunities to reflect the specific industry or audience.

━━━ YOUR TASK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For each gate that fails: improve the blueprint to address the issue.
For each gate that passes: keep those decisions unchanged.

RULES:
  - Return the COMPLETE WebsiteBlueprint JSON — same schema, all fields
  - Keep the same 5–6 components — do not add or remove sections
  - You may update: layout, contentElements, behavior, designSystem, contentStrategy, architectRationale
  - Every change must directly address one of the four gates above
  - Do not add new routes, components, or fields outside the schema

OUTPUT: Return ONLY valid JSON — no markdown, no code fences, no <think> tags, no explanation.`;

// ─── Build the design review user prompt ─────────────────────────────────────
function buildDesignReviewPrompt(ctx: BusinessContext, blueprint: WebsiteBlueprint): string {
  return `BUSINESS BRIEF
──────────────
Business idea:    ${ctx.idea}
Company name:     ${ctx.companyName}
Industry:         ${ctx.industry}
Target audience:  ${ctx.targetAudience}
Conversion goal:  ${ctx.conversionGoal}
Brand position:   ${ctx.brandPositioning}

CURRENT ARCHITECTURE (produced by Architect Agent)
──────────────────────────────────────────────────
${JSON.stringify(blueprint, null, 2)}

Apply the four quality gates. Return the improved WebsiteBlueprint JSON.`;
}

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

// ─── Marcus Conversation helpers ──────────────────────────────────────────────
// Emit a single ConversationEvent over SSE and mirror it to the backend log.
// The log line matches the pattern: [MARCUS] conversation event type=… phase=… path=…
function sseWriteAgent(res: import("express").Response, event: ConversationEvent): void {
  sseWrite(res, { phase: "agent", event });
  logger.info(
    {
      tag:       "[MARCUS]",
      type:      event.type,
      phase:     event.phase,
      ...(event.metadata?.path      !== undefined && { path:      event.metadata.path }),
      ...(event.metadata?.operation !== undefined && { operation: event.metadata.operation }),
      ...(event.metadata?.status    !== undefined && { status:    event.metadata.status }),
    },
    `[MARCUS] conversation event type=${event.type} phase=${event.phase ?? "global"}${event.metadata?.path ? ` path=${String(event.metadata.path)}` : ""}`,
  );
}

// Drain the engine buffer and stream every accumulated event to the client.
// Always call this immediately after emitting engine events so the client
// receives them in the same order they were produced.
function flushEngine(
  engine: MarcusConversationEngine,
  res:    import("express").Response,
): void {
  for (const ev of engine.collect()) {
    sseWriteAgent(res, ev);
  }
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
    const pipelineStart = Date.now();

    // Marcus Conversation Engine — one instance per request.
    // Accumulates ConversationEvents and flushes them to SSE via flushEngine().
    const engine = new MarcusConversationEngine();

    // ── Marcus Task Bus — one instance per request ─────────────────────────────
    // Single source of truth for every execution action during generation.
    // A subscriber translates bus events into SSE writes (preserving all
    // existing frame shapes) and replaces scattered req.log.info milestone calls.
    // No globals. No singletons. Lifetime = this request only.
    const bus = new MarcusTaskBus();
    const unsubscribeBus = bus.subscribe((event) => {
      // llm:architect_start running → { phase: "start", model, industry }
      if (event.category === "llm" && event.action === "architect_start" && event.status === "running") {
        sseWrite(res, {
          phase:    "start",
          model:    String(event.metadata.model    ?? ARCHITECT_MODEL),
          industry: String(event.metadata.industry ?? ""),
        });
      }
      // database:save_project completed → { phase: "project-created", projectId }
      if (event.category === "database" && event.action === "save_project" && event.status === "completed") {
        const pid = event.metadata.projectId;
        if (pid) sseWrite(res, { phase: "project-created", projectId: String(pid) });
      }
      // database:save_files completed → { phase: "project-saved", projectId }
      if (event.category === "database" && event.action === "save_files" && event.status === "completed") {
        const pid = event.metadata.projectId;
        if (pid) sseWrite(res, { phase: "project-saved", projectId: String(pid) });
      }
    });

    bus.emit("pipeline", "start", "running", { userId }, "pipeline");

    try {
      const body = req.body as Record<string, unknown>;

      // ── Input validation ────────────────────────────────────────────────────
      if (!body.idea || typeof body.idea !== "string" || !String(body.idea).trim()) {
        bus.emit("pipeline", "error", "failed", { error: "NO_IDEA", userId }, "pipeline");
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

      // ── Create project record (Phase 3) ─────────────────────────────────────
      bus.emit("database", "save_project", "running", { userId, industry: context.industry, ideaLength: context.idea.length }, "pipeline");
      const projectId = await createV2Project(userId, context);
      bus.emit(
        "database", "save_project",
        projectId ? "completed" : "failed",
        { projectId: projectId ?? undefined, userId, industry: context.industry, ideaLength: context.idea.length },
        "pipeline",
      );
      // ↑ subscriber writes sseWrite({ phase: "project-created", projectId }) when completed

      // Marcus: UNDERSTAND phase begins — narrate the architect LLM work.
      engine.emitPhaseStart("UNDERSTAND");
      flushEngine(engine, res);

      // ── Phase 1: Website Architect Agent ────────────────────────────────────
      // Stream the architect agent's JSON generation token-by-token.
      // Each content chunk is forwarded as { phase: "architect", content: "..." }
      // so the client can show a live typing indicator.
      const architectStart = Date.now();
      bus.emit("llm", "architect_start", "running", {
        model:             ARCHITECT_MODEL,
        maxTokens:         3000,
        userId,
        industry:          context.industry,
        elapsedMsPipeline: Date.now() - pipelineStart,
      }, "architect");
      // ↑ subscriber writes sseWrite({ phase: "start", model, industry })

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

      const architectMs = Date.now() - architectStart;
      bus.emit("llm", "architect_complete", "completed", {
        model:             ARCHITECT_MODEL,
        durationMs:        architectMs,
        bufLen:            buffer.length,
        elapsedMsPipeline: Date.now() - pipelineStart,
        thinkingWasActive: thinkingSent,
      }, "architect");

      if (!buffer || buffer.length < 50) {
        bus.emit("pipeline", "error", "failed", { error: "EMPTY_RESPONSE", bufLen: buffer.length, userId }, "architect");
        engine.emitError("UNDERSTAND", "Generation stopped — the architecture agent returned an empty response. Please try again.");
        flushEngine(engine, res);
        sseWrite(res, {
          phase:   "error",
          message: "The Architect Agent returned an empty response. Please try again.",
          code:    "EMPTY_RESPONSE",
        });
        res.end();
        return;
      }

      // ── Parse blueprint ──────────────────────────────────────────────────────
      const blueprintParseStart = Date.now();
      bus.emit("validation", "blueprint", "running", { bufLen: buffer.length }, "blueprint-parse");
      let blueprint: WebsiteBlueprint;
      try {
        blueprint = extractJson(buffer) as WebsiteBlueprint;
      } catch (parseErr) {
        bus.emit("validation", "blueprint", "failed", {
          durationMs: Date.now() - blueprintParseStart,
          error:      String(parseErr),
          bufLen:     buffer.length,
          bufSnippet: buffer.slice(0, 200),
          userId,
        }, "blueprint-parse");
        bus.emit("pipeline", "error", "failed", { error: "PARSE_ERROR", userId }, "blueprint-parse");
        engine.emitError("UNDERSTAND", "Generation stopped while parsing the architecture blueprint. I'm collecting diagnostic information.");
        flushEngine(engine, res);
        sseWrite(res, {
          phase:   "error",
          message: "Failed to parse the architecture blueprint. Please try again.",
          code:    "PARSE_ERROR",
        });
        res.end();
        return;
      }

      bus.emit("validation", "blueprint", "completed", {
        durationMs:  Date.now() - blueprintParseStart,
        projectType: String((blueprint as unknown as Record<string,unknown>)?.projectType ?? ""),
        pageCount:   Array.isArray((blueprint as unknown as Record<string,unknown>)?.pages)
                       ? ((blueprint as unknown as Record<string,unknown>).pages as unknown[]).length
                       : 0,
      }, "blueprint-parse");

      // ── Validate blueprint schema ────────────────────────────────────────────
      const blueprintValidateStart = Date.now();
      bus.emit("validation", "schema", "running", {}, "schema-validate");

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

      const blueprintValidateMs = Date.now() - blueprintValidateStart;
      if (schemaErrors.length > 0) {
        bus.emit("validation", "schema", "failed", {
          durationMs:  blueprintValidateMs,
          error:       schemaErrors.join(", "),
          errorCount:  schemaErrors.length,
          bufSnippet:  buffer.slice(0, 300),
          userId,
        }, "schema-validate");
        bus.emit("pipeline", "error", "failed", { error: "SCHEMA_ERROR", schemaErrorCount: schemaErrors.length, userId }, "schema-validate");
        engine.emitError("UNDERSTAND", "Generation stopped while validating the project architecture. I'm collecting diagnostic information.");
        flushEngine(engine, res);
        sseWrite(res, {
          phase:   "error",
          message: `The architecture blueprint is incomplete (${schemaErrors.join(", ")}). Please try again.`,
          code:    "SCHEMA_ERROR",
        });
        res.end();
        return;
      }

      bus.emit("validation", "schema", "completed", {
        durationMs:        blueprintValidateMs,
        projectType:       blueprint.projectType,
        pageCount:         blueprint.pages?.length ?? 0,
        componentCount:    blueprint.pages?.reduce((n, p) => n + (p.components?.length ?? 0), 0) ?? 0,
        elapsedMsPipeline: Date.now() - pipelineStart,
      }, "schema-validate");

      // Marcus: UNDERSTAND phase complete — we have a validated blueprint.
      // Then emit a brief PLAN thought to narrate the transition to code generation.
      engine.emitPhaseComplete("UNDERSTAND");
      engine.emitMessage(null, "Preparing the implementation...");
      flushEngine(engine, res);

      // ── Save blueprint (Phase 3) ─────────────────────────────────────────────
      const blueprintSaveStart = Date.now();
      if (projectId) {
        bus.emit("database", "save_blueprint", "running", { projectId }, "architect");
        await saveBlueprint(projectId, blueprint);
        bus.emit("database", "save_blueprint", "completed", {
          projectId,
          durationMs: Date.now() - blueprintSaveStart,
        }, "architect");
      }

      sseWrite(res, { phase: "blueprint", data: blueprint });

      // ── Blueprint scope enforcement ──────────────────────────────────────────
      // Belt-and-suspenders: keep the blueprint within first-generation landing-
      // page scope even if the Architect Agent exceeded its prompt constraints.

      // 1. Single route: retain only the "/" page (or pages[0] as fallback).
      if (blueprint.pages.length > 1) {
        const originalPageCount = blueprint.pages.length;
        const homePage = blueprint.pages.find((p) => p.route === "/") ?? blueprint.pages[0];
        blueprint = { ...blueprint, pages: [{ ...homePage, route: "/" }] };
        req.log.warn(
          { layer: "v2:scope", originalPageCount, action: "trim_to_single_route" },
          "[v2:scope] Architect produced multiple routes — trimmed to single '/' page"
        );
      }

      // 2. Component cap: max 6 components on the single page.
      const MAX_COMPONENTS = 6;
      if ((blueprint.pages[0]?.components.length ?? 0) > MAX_COMPONENTS) {
        blueprint = {
          ...blueprint,
          pages: blueprint.pages.map((p) => ({
            ...p,
            components: p.components.slice(0, MAX_COMPONENTS),
          })),
        };
        req.log.warn(
          { layer: "v2:scope", action: "trim_components", cap: MAX_COMPONENTS },
          `[v2:scope] Architect exceeded component cap — trimmed to ${MAX_COMPONENTS} components`
        );
      }

      // ── Blueprint complexity estimate ────────────────────────────────────────
      // Estimate output token count before dispatching to the Code Gen agent.
      // Formula: base app-layer files + N × per-component average + preview HTML.
      //   Base (layout + page + globals + JSON boilerplate) ≈ 2 500 tokens
      //   Per component (avg ~120 LoC each)                ≈ 1 200 tokens
      //   Standalone preview HTML                          ≈ 1 000 tokens
      // Threshold: if estimate > 12 000 tokens, simplify further before codegen.
      const TOKENS_BASE      = 2_500;
      const TOKENS_PER_COMP  = 1_200;
      const TOKENS_PREVIEW   = 1_000;
      const TOKEN_THRESHOLD  = 12_000;
      const initialComponents = blueprint.pages[0]?.components.length ?? 0;
      let   estimatedTokens   = TOKENS_BASE + initialComponents * TOKENS_PER_COMP + TOKENS_PREVIEW;
      let   blueprintSimplified = false;

      if (estimatedTokens > TOKEN_THRESHOLD) {
        const trimTo = Math.max(
          3,
          Math.floor((TOKEN_THRESHOLD - TOKENS_BASE - TOKENS_PREVIEW) / TOKENS_PER_COMP)
        );
        blueprint = {
          ...blueprint,
          pages: blueprint.pages.map((p) => ({
            ...p,
            components: p.components.slice(0, trimTo),
          })),
        };
        blueprintSimplified = true;
        req.log.warn(
          {
            layer:          "v2:complexity",
            trimTo,
            TOKEN_THRESHOLD,
            elapsedMsPipeline: Date.now() - pipelineStart,
          },
          `[v2:complexity] Blueprint simplified — estimate exceeded ${TOKEN_THRESHOLD.toLocaleString()} token threshold; trimmed to ${trimTo} components`
        );
      }

      // Recompute from the final (post-trim) blueprint so the SSE payload is accurate.
      const finalComponents = blueprint.pages[0]?.components.length ?? 0;
      const finalFiles      = Math.min(3 + finalComponents, 8); // 3 app files + N component files
      estimatedTokens       = TOKENS_BASE + finalComponents * TOKENS_PER_COMP + TOKENS_PREVIEW;

      req.log.info(
        {
          layer:             "v2:complexity",
          finalComponents,
          finalFiles,
          estimatedTokens,
          blueprintSimplified,
          elapsedMsPipeline: Date.now() - pipelineStart,
        },
        `[v2:complexity] Blueprint summary — components: ${finalComponents}, files: ${finalFiles}, ~${estimatedTokens.toLocaleString()} estimated tokens`
      );

      sseWrite(res, {
        phase:           "blueprint-summary",
        components:      finalComponents,
        files:           finalFiles,
        estimatedTokens,
        simplified:      blueprintSimplified,
      });

      // Marcus: narrate the blueprint outcome before design review begins.
      engine.emitAction(
        null,
        `Architecture complete. ${finalComponents} reusable component${finalComponents === 1 ? "" : "s"} selected. Estimated generation size: ${finalFiles} file${finalFiles === 1 ? "" : "s"}.`,
      );
      if (blueprintSimplified) {
        engine.emitWarning(
          null,
          "The original architecture was too large. I've simplified it to ensure reliable generation.",
        );
      }
      flushEngine(engine, res);

      // ── Design Review Agent (Step 5) ─────────────────────────────────────────
      // Critiques the blueprint against 4 quality gates before code generation.
      // Streams its reasoning to the client via { phase: "design-review", content }
      // events, then emits { phase: "blueprint-updated", data } if the blueprint
      // was improved. Falls through to original blueprint on any parse failure.
      const reviewStart = Date.now();
      req.log.info(
        { layer: "v2:design-review", stage: "start", elapsedMsPipeline: Date.now() - pipelineStart },
        "[v2:design-review] ── Design Review Agent started ──"
      );

      // Marcus: DESIGN phase begins — narrate the design review work.
      engine.emitPhaseStart("DESIGN");
      flushEngine(engine, res);

      sseWrite(res, { phase: "design-review" });

      try {
        const reviewStream = await streamNvidia({
          model:       ARCHITECT_MODEL,   // same fast model as architect
          temperature: 0.6,
          maxTokens:   3500,
          messages: [
            { role: "system", content: DESIGN_REVIEWER_SYSTEM_PROMPT },
            { role: "user",   content: buildDesignReviewPrompt(context, blueprint) },
          ],
          _feature: "website_generator_v2_design_review",
          _userId:  userId,
        });

        const reviewDecoder = new TextDecoder();
        const reviewReader  = reviewStream.getReader();
        let   reviewCarry   = "";
        let   reviewBuffer  = "";

        const processReviewLines = (text: string) => {
          const lines = text.split("\n");
          reviewCarry = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed  = JSON.parse(data) as Record<string, unknown>;
              const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
              if (content) {
                reviewBuffer += content;
                sseWrite(res, { phase: "design-review", content });
              }
            } catch { /* incomplete fragment — skip */ }
          }
        };

        try {
          while (true) {
            const { done, value } = await reviewReader.read();
            if (done) break;
            processReviewLines(reviewCarry + reviewDecoder.decode(value, { stream: true }));
          }
          // Flush decoder tail
          const tail = reviewDecoder.decode();
          if (tail) reviewCarry += tail;
          if (reviewCarry.startsWith("data: ")) {
            const data = reviewCarry.slice(6).trim();
            if (data && data !== "[DONE]") {
              try {
                const parsed  = JSON.parse(data) as Record<string, unknown>;
                const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
                if (content) { reviewBuffer += content; sseWrite(res, { phase: "design-review", content }); }
              } catch { /* discard */ }
            }
          }
        } finally {
          reviewReader.releaseLock();
        }

        const reviewMs = Date.now() - reviewStart;
        req.log.info(
          { layer: "v2:design-review", reviewMs, bufLen: reviewBuffer.length, elapsedMsPipeline: Date.now() - pipelineStart },
          `[v2:design-review] ── Design Review ended in ${reviewMs}ms ──`
        );

        // Attempt to parse the improved blueprint
        if (reviewBuffer.length >= 50) {
          try {
            const improved = extractJson(reviewBuffer) as WebsiteBlueprint;
            // Validate: must have pages array with at least one route
            // Enforce architect minimum: 5 canonical components required.
            // Accepting fewer would violate the codegen contract (Navbar/Hero/Features/CTA/Footer).
            const MIN_COMPONENTS = 5;
            if (
              improved &&
              Array.isArray(improved.pages) &&
              improved.pages.length > 0 &&
              Array.isArray(improved.pages[0]?.components) &&
              improved.pages[0].components.length >= MIN_COMPONENTS
            ) {
              // Apply the same scope guards to the improved blueprint
              const reviewedPage = improved.pages.find((p) => p.route === "/") ?? improved.pages[0];
              const reviewedComponents = reviewedPage.components.slice(0, MAX_COMPONENTS);
              blueprint = {
                ...improved,
                pages: [{ ...reviewedPage, route: "/", components: reviewedComponents }],
              };
              sseWrite(res, { phase: "blueprint-updated", data: blueprint });
              req.log.info(
                { layer: "v2:design-review", components: blueprint.pages[0].components.length },
                "[v2:design-review] Blueprint improved and updated"
              );
            } else {
              req.log.warn(
                { layer: "v2:design-review" },
                "[v2:design-review] Improved blueprint failed validation — using original"
              );
            }
          } catch (parseErr) {
            req.log.warn(
              { layer: "v2:design-review", parseErr },
              "[v2:design-review] Failed to parse improved blueprint JSON — using original"
            );
          }
        }
      } catch (reviewErr) {
        // Design review is best-effort — log and continue with original blueprint
        req.log.warn(
          { layer: "v2:design-review", reviewErr },
          "[v2:design-review] Design Review Agent failed — proceeding with original blueprint"
        );
      }

      // Marcus: DESIGN phase complete — design review finished (success or best-effort).
      engine.emitPhaseComplete("DESIGN");
      flushEngine(engine, res);

      // ── Phase 2: Code Generation Agent ──────────────────────────────────────
      const codegenStart = Date.now();
      bus.emit("llm", "codegen_start", "running", {
        model:             CODE_GENERATOR_MODEL,
        projectId:         projectId ?? undefined,
        pageCount:         blueprint.pages?.length ?? 0,
        componentCount:    blueprint.pages?.reduce((n, p) => n + (p.components?.length ?? 0), 0) ?? 0,
        elapsedMsPipeline: Date.now() - pipelineStart,
      }, "codegen");

      // Emit building phase-start signal (no content = signal only)
      sseWrite(res, { phase: "building" });

      // Marcus: BUILD phase begins — narrate the code generation work.
      engine.emitPhaseStart("BUILD");
      flushEngine(engine, res);

      let project;
      try {
        project = await generateProjectCode(
          context,
          blueprint,
          userId,
          (content) => sseWrite(res, { phase: "building", content }),
          (active)  => sseWrite(res, { phase: "thinking", active }),
        );
        const codegenMs = Date.now() - codegenStart;
        // Analyse output for bottleneck signals
        const totalChars    = project.files.reduce((n, f) => n + f.content.length, 0);
        const largestFile   = project.files.reduce(
          (best, f) => f.content.length > best.size ? { path: f.path, size: f.content.length } : best,
          { path: "(none)", size: 0 }
        );
        bus.emit("llm", "codegen_complete", "completed", {
          model:             CODE_GENERATOR_MODEL,
          durationMs:        codegenMs,
          elapsedMsPipeline: Date.now() - pipelineStart,
          fileCount:         project.files.length,
          depCount:          project.dependencies.length,
          totalChars,
          largestFilePath:   largestFile.path,
          largestFileChars:  largestFile.size,
          previewLen:        project.preview.length,
          projectId:         projectId ?? undefined,
          bottleneckFlag:
            codegenMs > 180_000          ? "SLOW_MODEL_OVER_3MIN" :
            codegenMs > 60_000           ? "SLOW_MODEL_OVER_1MIN" :
            totalChars > 500_000         ? "LARGE_OUTPUT_OVER_500K" :
            largestFile.size > 100_000   ? "LARGE_SINGLE_FILE_OVER_100K" :
            "OK",
        }, "codegen");

        // ── Infrastructure file injection ──────────────────────────────────────
        // The code gen prompt is constrained to 8 component/page files and does
        // not produce package.json, tailwind.config.ts, or tsconfig.json.
        // WebContainer requires package.json to run `npm install` and `npm run dev`.
        // Inject canonical boilerplate for any missing infrastructure files so
        // the mounted project is always runnable without changing the AI output scope.

        // Emit filesystem events for every LLM-generated file, then flush narration once.
        for (const f of project.files) {
          bus.emit("filesystem", "create_file", "completed", { path: f.path }, "codegen");
          engine.emitFileOperation(f.path, "create", "BUILD");
        }
        flushEngine(engine, res);

        const existingPaths = new Set(project.files.map((f) => f.path));

        if (!existingPaths.has("package.json")) {
          bus.emit("filesystem", "create_file", "completed", { path: "package.json", operation: "injected" }, "build");
          engine.emitWarning("BUILD", "The generated project doesn't include package.json. Creating it automatically.");
          engine.emitFileOperation("package.json", "create", "BUILD");
          flushEngine(engine, res);
          const deps: Record<string, string> = {
            next: "14.2.5",
            react: "^18",
            "react-dom": "^18",
            "framer-motion": "^11.0.0",
          };
          for (const dep of project.dependencies) {
            if (!deps[dep]) deps[dep] = "latest";
          }
          project.files.push({
            path:      "package.json",
            operation: "create",
            language:  "json",
            content:   JSON.stringify({
              name: "stageone-website",
              version: "0.1.0",
              private: true,
              scripts: { dev: "next dev", build: "next build", start: "next start" },
              dependencies: deps,
              devDependencies: {
                typescript: "^5",
                "@types/node": "^20",
                "@types/react": "^18",
                "@types/react-dom": "^18",
                tailwindcss: "^3.4.0",
                autoprefixer: "^10.0.0",
                postcss: "^8.0.0",
              },
            }, null, 2),
          });
          req.log.info({ layer: "v2:inject" }, "[v2:inject] Injected package.json");
        }

        if (!existingPaths.has("tailwind.config.ts")) {
          bus.emit("filesystem", "create_file", "completed", { path: "tailwind.config.ts", operation: "injected" }, "build");
          engine.emitWarning("BUILD", "The generated project doesn't include tailwind.config.ts. Creating it automatically.");
          engine.emitFileOperation("tailwind.config.ts", "create", "BUILD");
          flushEngine(engine, res);
          project.files.push({
            path:      "tailwind.config.ts",
            operation: "create",
            language:  "typescript",
            content:   [
              "import type { Config } from 'tailwindcss'",
              "const config: Config = {",
              "  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],",
              "  theme: { extend: {} },",
              "  plugins: [],",
              "}",
              "export default config",
            ].join("\n"),
          });
          req.log.info({ layer: "v2:inject" }, "[v2:inject] Injected tailwind.config.ts");
        }

        if (!existingPaths.has("tsconfig.json")) {
          bus.emit("filesystem", "create_file", "completed", { path: "tsconfig.json", operation: "injected" }, "build");
          engine.emitWarning("BUILD", "The generated project doesn't include tsconfig.json. Creating it automatically.");
          engine.emitFileOperation("tsconfig.json", "create", "BUILD");
          flushEngine(engine, res);
          project.files.push({
            path:      "tsconfig.json",
            operation: "create",
            language:  "json",
            content:   JSON.stringify({
              compilerOptions: {
                target: "ES2017",
                lib: ["dom", "dom.iterable", "esnext"],
                allowJs: true,
                skipLibCheck: true,
                strict: true,
                noEmit: true,
                esModuleInterop: true,
                module: "esnext",
                moduleResolution: "bundler",
                resolveJsonModule: true,
                isolatedModules: true,
                jsx: "preserve",
                incremental: true,
                plugins: [{ name: "next" }],
                paths: { "@/*": ["./*"] },
              },
              include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
              exclude: ["node_modules"],
            }, null, 2),
          });
          req.log.info({ layer: "v2:inject" }, "[v2:inject] Injected tsconfig.json");
        }

        if (!existingPaths.has("postcss.config.mjs")) {
          bus.emit("filesystem", "create_file", "completed", { path: "postcss.config.mjs", operation: "injected" }, "build");
          engine.emitWarning("BUILD", "The generated project doesn't include postcss.config.mjs. Creating it automatically.");
          engine.emitFileOperation("postcss.config.mjs", "create", "BUILD");
          flushEngine(engine, res);
          project.files.push({
            path:      "postcss.config.mjs",
            operation: "create",
            language:  "javascript",
            content:   [
              "const config = {",
              "  plugins: { tailwindcss: {}, autoprefixer: {} },",
              "}",
              "export default config",
            ].join("\n"),
          });
          req.log.info({ layer: "v2:inject" }, "[v2:inject] Injected postcss.config.mjs");
        }

        // Marcus: BUILD phase complete — all files generated and infrastructure injected.
        engine.emitPhaseComplete("BUILD");
        flushEngine(engine, res);

      } catch (codeErr) {
        const codegenMs = Date.now() - codegenStart;
        const failureCategory =
          String(codeErr).includes("JSON parse failed")  ? "JSON_PARSE_ERROR"        :
          String(codeErr).includes("schema errors")      ? "SCHEMA_VALIDATION_ERROR" :
          String(codeErr).includes("empty response")     ? "EMPTY_RESPONSE"          :
          String(codeErr).includes("HTTP 4")             ? "NVIDIA_HTTP_ERROR"       :
          String(codeErr).includes("HTTP 5")             ? "NVIDIA_HTTP_ERROR"       :
          String(codeErr).includes("TimeoutError")       ? "TIMEOUT"                 :
          String(codeErr).includes("AbortError")         ? "ABORTED"                 :
          "UNKNOWN";
        bus.emit("pipeline", "error", "failed", {
          error:             String(codeErr),
          errName:           codeErr instanceof Error ? codeErr.name    : "unknown",
          errMsg:            codeErr instanceof Error ? codeErr.message : String(codeErr),
          userId,
          projectId:         projectId ?? undefined,
          durationMs:        codegenMs,
          elapsedMsPipeline: Date.now() - pipelineStart,
          failureCategory,
        }, "codegen");
        if (projectId) await markProjectFailed(projectId, String(codeErr));
        engine.emitError("BUILD", "Generation stopped while building the project. I'm collecting diagnostic information.");
        flushEngine(engine, res);
        sseWrite(res, {
          phase:   "error",
          message: "The Code Generation Agent failed to produce a valid project. Please try again.",
          code:    "CODEGEN_ERROR",
        });
        res.end();
        return;
      }

      // Marcus: REPORT phase begins — project is being persisted.
      engine.emitPhaseStart("REPORT");
      engine.emitMessage("REPORT", "Saving your project...");
      flushEngine(engine, res);

      // ── Save generated files (Phase 3) ──────────────────────────────────────
      const dbSaveStart = Date.now();
      if (projectId) {
        bus.emit("database", "save_files", "running", {
          projectId,
          fileCount: project.files.length,
        }, "persist");
        await saveGeneratedFiles(
          projectId,
          project.files,
          project.dependencies,
          project.preview
        );
        const dbSaveMs = Date.now() - dbSaveStart;
        project = { ...project, projectId };
        bus.emit("database", "save_files", "completed", {
          projectId,
          durationMs: dbSaveMs,
          fileCount:  project.files.length,
        }, "persist");
        // ↑ subscriber writes sseWrite({ phase: "project-saved", projectId })
      }

      // ── Pipeline complete — emit final summary log before SSE done ───────────
      const totalPipelineMs = Date.now() - pipelineStart;
      const totalCharsAll   = project.files.reduce((n: number, f: { content: string }) => n + f.content.length, 0);
      const largestFileAll  = project.files.reduce(
        (best: { path: string; size: number }, f: { path: string; content: string }) =>
          f.content.length > best.size ? { path: f.path, size: f.content.length } : best,
        { path: "(none)", size: 0 }
      );
      bus.emit("pipeline", "finish", "completed", {
        durationMs:        totalPipelineMs,
        fileCount:         project.files.length,
        depCount:          project.dependencies.length,
        totalChars:        totalCharsAll,
        largestFilePath:   largestFileAll.path,
        largestFileChars:  largestFileAll.size,
        projectId:         projectId ?? undefined,
        userId,
      }, "pipeline");
      // Marcus: REPORT phase complete — entire pipeline finished.
      engine.emitPhaseComplete("REPORT", Date.now() - pipelineStart);
      engine.emitDone(Date.now() - pipelineStart);
      flushEngine(engine, res);

      sseWrite(res, { phase: "done", projectId: projectId ?? "", data: project });
      res.end();

    } catch (err) {
      const isTimeout =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");

      const message = isTimeout
        ? "The Architect Agent timed out — the AI service is busy. Please try again."
        : "An unexpected error occurred in the Website Architect. Please try again.";

      bus.emit("pipeline", "error", "failed", {
        error:     String(err),
        isTimeout,
        userId,
      }, "pipeline");

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
    } finally {
      // Tear down the per-request bus: remove the subscriber and discard history.
      // This prevents memory leaks and ensures no cross-request event delivery.
      unsubscribeBus();
      bus.clear();
    }
  }
);

export default router;
