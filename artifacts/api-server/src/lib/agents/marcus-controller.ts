// ─── Marcus Agent Controller ───────────────────────────────────────────────────
//
// Commit 3 — MarcusController is the owner of the Website Generation pipeline.
//
// The controller receives its runtime (task bus, conversation engine, project
// identity, business context) injected by the caller. It owns every model call
// (Architect Agent, Design Review Agent, Code Generation Agent), the blueprint
// scope/complexity guards, infrastructure file injection, and persistence of
// the blueprint + generated files. It emits MarcusTaskBus events for every
// phase transition so the conversation engine and SSE layer stay narrated.
//
// generate-website-v2.ts is now a thin shell: authenticate, create the project
// record, build the Marcus runtime (bus + engine), call
// `MarcusController.runWebsiteGeneration()`, stream the SSE frames it forwards
// via `onSse`, and write the final `done`/`error` frame.
//
// Data contracts are untouched: WebsiteBlueprint, GeneratedProject,
// ProjectFile[], preview, and dependencies keep their existing shapes so the
// Website Studio frontend requires no changes.

import { streamNvidia, extractJson } from "../nvidia";
import { logger } from "../logger";
import { generateProjectCode, CODE_GENERATOR_MODEL } from "../website-v2-code-generator";
import { saveBlueprint, saveGeneratedFiles, markProjectFailed, updateProjectFiles, updateProjectPreview } from "../website-v2-projects";
import { runEditingAgent, EDITOR_MODEL } from "../website-v2-editor";
import type { TimelineUpdate } from "../timeline-engine";
import { runPreviewGenerator } from "../website-v2-preview-generator";
import type {
  BusinessContext,
  WebsiteBlueprint,
  GeneratedProject,
  V2SseEvent,
  V2EditSseEvent,
  ProjectFile,
  FileModification,
} from "../website-v2-types";
import type { WorkspaceContext } from "../workspace-context";
import { MarcusConversationEngine } from "./marcus-conversation";
import type { MarcusTaskBus } from "./marcus-task-bus";
import { MODELS } from "../models";

// ─── Model assignment ─────────────────────────────────────────────────────────
// Architect + Design Review Agent: meta/llama-4-maverick-17b-128e-instruct —
// fast, structured JSON output.
export const ARCHITECT_MODEL = MODELS.WEBSITE_V2_ARCHITECT;

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
// Runs between blueprint generation and code generation. Critiques the
// blueprint against 4 production-readiness gates and returns an improved
// WebsiteBlueprint in the same JSON schema.
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

// ─── Prompt builders ──────────────────────────────────────────────────────────

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

// ─── Runtime injected into the controller by the route ────────────────────────
//
// The caller (generate-website-v2.ts) owns request-lifecycle concerns —
// auth, SSE headers, project creation — and hands the controller a runtime
// scoped to a single generation request.

export interface MarcusWebsiteRuntime {
  /** Single source of truth for execution events during this run. */
  taskBus: MarcusTaskBus;
  /** Translates task-bus events into narrated ConversationEvents. */
  conversationEngine: MarcusConversationEngine;
  /** Null when the project record failed to persist — pipeline still runs. */
  projectId: string | null;
  userId: string;
  businessContext: BusinessContext;
  /** Wall-clock start of the whole pipeline, for elapsed-time telemetry. */
  pipelineStart: number;
  /**
   * Forward one SSE frame to the client. The controller never touches
   * `res` directly — it only knows about typed V2SseEvent payloads.
   */
  onSse: (event: V2SseEvent) => void;
}

export type MarcusWebsiteRunResult =
  | { ok: true; project: GeneratedProject & { projectId?: string } }
  | { ok: false; code: string; message: string };

// ─── Runtime injected into the controller for an edit request (Commit 4) ──────
//
// edit-website-v2.ts owns request-lifecycle concerns — auth, loading the
// project, SSE headers — and hands the controller a runtime scoped to a
// single edit request. The controller owns the Editing Agent call, the
// BUILD/TEST phases, and persistence of file + preview changes.

export interface MarcusEditRuntime {
  taskBus: MarcusTaskBus;
  conversationEngine: MarcusConversationEngine;
  projectId: string;
  userId: string;
  businessContext: BusinessContext;
  blueprint: WebsiteBlueprint | null;
  /** The project's full current file set — never mutated in place. */
  files: ProjectFile[];
  instruction: string;
  selectedFiles?: string[];
  /** Phase 13.1: WorkspaceContext with project intelligence from frontend scan + DB */
  workspaceContext?: WorkspaceContext;
  pipelineStart: number;
  /** Forward one SSE frame to the client. */
  onSse: (event: V2EditSseEvent) => void;
}

export type MarcusEditRunResult =
  | { ok: true; changes: FileModification[]; summary: string; fileCount: number }
  | { ok: false; code: string; message: string };

const TAG = "[MARCUS]";

// ─── Engine flush helper ──────────────────────────────────────────────────────
// Drains the conversation engine buffer and forwards every accumulated event
// through onSse, mirroring it to the backend log. Must be called immediately
// after any bus.emit() that produces conversation events so the client
// receives them in the same order they were produced.
function flushEngine(engine: MarcusConversationEngine, onSse: (event: V2SseEvent) => void): void {
  for (const ev of engine.collect()) {
    onSse({ phase: "agent", event: ev });
    logger.info(
      {
        tag: TAG,
        type: ev.type,
        phase: ev.phase,
        ...(ev.metadata?.path !== undefined && { path: ev.metadata.path }),
        ...(ev.metadata?.operation !== undefined && { operation: ev.metadata.operation }),
        ...(ev.metadata?.status !== undefined && { status: ev.metadata.status }),
      },
      `${TAG} conversation event type=${ev.type} phase=${ev.phase ?? "global"}${ev.metadata?.path ? ` path=${String(ev.metadata.path)}` : ""}`,
    );
  }
}

// Same drain-and-forward helper, typed for the edit route's SSE union instead
// of the generation route's. Kept separate rather than generic to avoid
// coupling the two SSE contracts together.
function flushEditEngine(engine: MarcusConversationEngine, onSse: (event: V2EditSseEvent) => void): void {
  for (const ev of engine.collect()) {
    onSse({ phase: "agent", event: ev });
    logger.info(
      {
        tag: TAG,
        type: ev.type,
        phase: ev.phase,
        ...(ev.metadata?.path !== undefined && { path: ev.metadata.path }),
        ...(ev.metadata?.operation !== undefined && { operation: ev.metadata.operation }),
        ...(ev.metadata?.status !== undefined && { status: ev.metadata.status }),
      },
      `${TAG} conversation event type=${ev.type} phase=${ev.phase ?? "global"}${ev.metadata?.path ? ` path=${String(ev.metadata.path)}` : ""}`,
    );
  }
}

// ─── MarcusController ─────────────────────────────────────────────────────────
export const MarcusController = {
  /**
   * Owns the full Website Generation pipeline: Architect Agent → blueprint
   * scope/complexity guards → Design Review Agent → Code Generation Agent →
   * infrastructure file injection → persistence.
   *
   * Every phase transition is emitted on the injected task bus so the
   * conversation engine (and therefore the SSE stream) stays narrated exactly
   * as before this pipeline moved out of the route.
   */
  async runWebsiteGeneration(rt: MarcusWebsiteRuntime): Promise<MarcusWebsiteRunResult> {
    const { taskBus: bus, conversationEngine: engine, projectId, userId, businessContext: context, pipelineStart, onSse } = rt;
    const flush = () => flushEngine(engine, onSse);

    // ── Phase: Architect Agent (DESIGN) ─────────────────────────────────────
    const architectStart = Date.now();
    bus.emit("llm", "architect_start", "running", {
      model: ARCHITECT_MODEL,
      maxTokens: 3000,
      userId,
      industry: context.industry,
      elapsedMsPipeline: Date.now() - pipelineStart,
    }, "architect");
    flush();

    const stream = await streamNvidia({
      model: ARCHITECT_MODEL,
      temperature: 0.7,
      maxTokens: 3000,
      messages: [
        { role: "system", content: ARCHITECT_SYSTEM_PROMPT },
        { role: "user", content: buildArchitectPrompt(context) },
      ],
      _feature: "website_generator_v2_architect",
      _userId: userId,
    });

    const decoder = new TextDecoder();
    const reader = stream.getReader();
    let carry = "";
    let buffer = "";
    let thinkingActive = false;
    let thinkingSent = false;
    let contentStarted = false;

    const processLines = (text: string) => {
      const lines = text.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data) as Record<string, unknown>;
          const delta = (parsed.choices as Array<{ delta?: { content?: string; reasoning_content?: string } }>)?.[0]?.delta;
          const content = delta?.content;
          const thinking = delta?.reasoning_content;

          if (thinking && !thinkingActive && !contentStarted) {
            thinkingActive = true;
            thinkingSent = true;
            onSse({ phase: "thinking", active: true });
          }

          if (content) {
            if (thinkingActive && !contentStarted) {
              thinkingActive = false;
              onSse({ phase: "thinking", active: false });
            }
            contentStarted = true;
            buffer += content;
            onSse({ phase: "architect", content });
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

      const tail = decoder.decode();
      if (tail) carry += tail;
      if (carry.startsWith("data: ")) {
        const data = carry.slice(6).trim();
        if (data && data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
            if (content) { buffer += content; onSse({ phase: "architect", content }); }
          } catch { /* incomplete fragment — discard */ }
        }
      }

      if (thinkingSent && thinkingActive) {
        onSse({ phase: "thinking", active: false });
      }
    } finally {
      reader.releaseLock();
    }

    const architectMs = Date.now() - architectStart;
    bus.emit("llm", "architect_complete", "completed", {
      model: ARCHITECT_MODEL,
      durationMs: architectMs,
      bufLen: buffer.length,
      elapsedMsPipeline: Date.now() - pipelineStart,
      thinkingWasActive: thinkingSent,
    }, "architect");

    if (!buffer || buffer.length < 50) {
      bus.emit("pipeline", "error", "failed", { error: "EMPTY_RESPONSE", bufLen: buffer.length, userId }, "architect");
      engine.emitError("UNDERSTAND", "Generation stopped — the architecture agent returned an empty response. Please try again.");
      flush();
      return { ok: false, code: "EMPTY_RESPONSE", message: "The Architect Agent returned an empty response. Please try again." };
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
        error: String(parseErr),
        bufLen: buffer.length,
        bufSnippet: buffer.slice(0, 200),
        userId,
      }, "blueprint-parse");
      bus.emit("pipeline", "error", "failed", { error: "PARSE_ERROR", userId }, "blueprint-parse");
      engine.emitError("UNDERSTAND", "Generation stopped while parsing the architecture blueprint. Collecting diagnostic information.");
      flush();
      return { ok: false, code: "PARSE_ERROR", message: "Failed to parse the architecture blueprint. Please try again." };
    }

    bus.emit("validation", "blueprint", "completed", {
      durationMs: Date.now() - blueprintParseStart,
      projectType: String((blueprint as unknown as Record<string, unknown>)?.projectType ?? ""),
      pageCount: Array.isArray((blueprint as unknown as Record<string, unknown>)?.pages)
        ? ((blueprint as unknown as Record<string, unknown>).pages as unknown[]).length
        : 0,
    }, "blueprint-parse");

    // ── Validate blueprint schema ────────────────────────────────────────────
    const blueprintValidateStart = Date.now();
    bus.emit("validation", "schema", "running", {}, "schema-validate");

    const schemaErrors: string[] = [];

    if (!blueprint || typeof blueprint !== "object") {
      schemaErrors.push("root is not an object");
    } else {
      if (!blueprint.projectType) schemaErrors.push("missing projectType");
      if (!blueprint.architectRationale) schemaErrors.push("missing architectRationale");
      if (!blueprint.designSystem || typeof blueprint.designSystem !== "object") schemaErrors.push("missing designSystem");

      if (!Array.isArray(blueprint.pages) || blueprint.pages.length === 0) {
        schemaErrors.push("missing or empty pages");
      } else {
        blueprint.pages.forEach((page, pi) => {
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

            if (typeof comp === "string") {
              schemaErrors.push(
                `${id} is a plain string ("${comp}") — expected an object with name/purpose/layout/contentElements/behavior`
              );
              return;
            }

            if (!comp || typeof comp !== "object") {
              schemaErrors.push(`${id} is not an object (got ${comp === null ? "null" : typeof comp})`);
              return;
            }

            const c = comp as Record<string, unknown>;

            for (const field of ["name", "purpose", "layout"] as const) {
              if (typeof c[field] !== "string" || !(c[field] as string).trim()) {
                schemaErrors.push(`${id} missing or empty "${field}"`);
              }
            }

            for (const field of ["contentElements", "behavior"] as const) {
              if (!Array.isArray(c[field])) {
                schemaErrors.push(`${id} "${field}" is not an array`);
              } else {
                const nonStrings = (c[field] as unknown[]).filter((item) => typeof item !== "string");
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
        durationMs: blueprintValidateMs,
        error: schemaErrors.join(", "),
        errorCount: schemaErrors.length,
        bufSnippet: buffer.slice(0, 300),
        userId,
      }, "schema-validate");
      bus.emit("pipeline", "error", "failed", { error: "SCHEMA_ERROR", schemaErrorCount: schemaErrors.length, userId }, "schema-validate");
      engine.emitError("UNDERSTAND", "Generation stopped while validating the project architecture. Collecting diagnostic information.");
      flush();
      return { ok: false, code: "SCHEMA_ERROR", message: `The architecture blueprint is incomplete (${schemaErrors.join(", ")}). Please try again.` };
    }

    bus.emit("validation", "schema", "completed", {
      durationMs: blueprintValidateMs,
      projectType: blueprint.projectType,
      pageCount: blueprint.pages?.length ?? 0,
      componentCount: blueprint.pages?.reduce((n, p) => n + (p.components?.length ?? 0), 0) ?? 0,
      elapsedMsPipeline: Date.now() - pipelineStart,
    }, "schema-validate");

    // Flush UNDERSTAND complete — events generated by validation:schema completed above.
    flush();

    // ── Save blueprint ────────────────────────────────────────────────────────
    const blueprintSaveStart = Date.now();
    if (projectId) {
      bus.emit("database", "save_blueprint", "running", { projectId }, "architect");
      await saveBlueprint(projectId, blueprint);
      bus.emit("database", "save_blueprint", "completed", {
        projectId,
        durationMs: Date.now() - blueprintSaveStart,
      }, "architect");
    }

    onSse({ phase: "blueprint", data: blueprint });

    // ── Blueprint scope enforcement ──────────────────────────────────────────
    // Belt-and-suspenders: keep the blueprint within first-generation landing-
    // page scope even if the Architect Agent exceeded its prompt constraints.

    if (blueprint.pages.length > 1) {
      const originalPageCount = blueprint.pages.length;
      const homePage = blueprint.pages.find((p) => p.route === "/") ?? blueprint.pages[0];
      blueprint = { ...blueprint, pages: [{ ...homePage, route: "/" }] };
      logger.warn(
        { layer: "v2:scope", originalPageCount, action: "trim_to_single_route" },
        "[v2:scope] Architect produced multiple routes — trimmed to single '/' page"
      );
    }

    const MAX_COMPONENTS = 6;
    if ((blueprint.pages[0]?.components.length ?? 0) > MAX_COMPONENTS) {
      blueprint = {
        ...blueprint,
        pages: blueprint.pages.map((p) => ({
          ...p,
          components: p.components.slice(0, MAX_COMPONENTS),
        })),
      };
      logger.warn(
        { layer: "v2:scope", action: "trim_components", cap: MAX_COMPONENTS },
        `[v2:scope] Architect exceeded component cap — trimmed to ${MAX_COMPONENTS} components`
      );
    }

    // ── Blueprint complexity estimate ────────────────────────────────────────
    const TOKENS_BASE = 2_500;
    const TOKENS_PER_COMP = 1_200;
    const TOKENS_PREVIEW = 1_000;
    const TOKEN_THRESHOLD = 12_000;
    const initialComponents = blueprint.pages[0]?.components.length ?? 0;
    let estimatedTokens = TOKENS_BASE + initialComponents * TOKENS_PER_COMP + TOKENS_PREVIEW;
    let blueprintSimplified = false;

    if (estimatedTokens > TOKEN_THRESHOLD) {
      const trimTo = Math.max(3, Math.floor((TOKEN_THRESHOLD - TOKENS_BASE - TOKENS_PREVIEW) / TOKENS_PER_COMP));
      blueprint = {
        ...blueprint,
        pages: blueprint.pages.map((p) => ({
          ...p,
          components: p.components.slice(0, trimTo),
        })),
      };
      blueprintSimplified = true;
      logger.warn(
        { layer: "v2:complexity", trimTo, TOKEN_THRESHOLD, elapsedMsPipeline: Date.now() - pipelineStart },
        `[v2:complexity] Blueprint simplified — estimate exceeded ${TOKEN_THRESHOLD.toLocaleString()} token threshold; trimmed to ${trimTo} components`
      );
    }

    const finalComponents = blueprint.pages[0]?.components.length ?? 0;
    const finalFiles = Math.min(3 + finalComponents, 8);
    estimatedTokens = TOKENS_BASE + finalComponents * TOKENS_PER_COMP + TOKENS_PREVIEW;

    logger.info(
      {
        layer: "v2:complexity",
        finalComponents,
        finalFiles,
        estimatedTokens,
        blueprintSimplified,
        elapsedMsPipeline: Date.now() - pipelineStart,
      },
      `[v2:complexity] Blueprint summary — components: ${finalComponents}, files: ${finalFiles}, ~${estimatedTokens.toLocaleString()} estimated tokens`
    );

    onSse({ phase: "blueprint-summary", components: finalComponents, files: finalFiles, estimatedTokens, simplified: blueprintSimplified });

    if (blueprintSimplified) {
      engine.emitWarning(null, "The original architecture was too large. I've simplified it to ensure reliable generation.");
    }
    flush();

    // ── Design Review Agent ──────────────────────────────────────────────────
    const reviewStart = Date.now();
    bus.emit("llm", "architect_start", "running", {
      model: ARCHITECT_MODEL,
      elapsedMsPipeline: Date.now() - pipelineStart,
    }, "design-review");
    flush();

    onSse({ phase: "design-review" });

    try {
      const reviewStream = await streamNvidia({
        model: ARCHITECT_MODEL,
        temperature: 0.6,
        maxTokens: 3500,
        messages: [
          { role: "system", content: DESIGN_REVIEWER_SYSTEM_PROMPT },
          { role: "user", content: buildDesignReviewPrompt(context, blueprint) },
        ],
        _feature: "website_generator_v2_design_review",
        _userId: userId,
      });

      const reviewDecoder = new TextDecoder();
      const reviewReader = reviewStream.getReader();
      let reviewCarry = "";
      let reviewBuffer = "";

      const processReviewLines = (text: string) => {
        const lines = text.split("\n");
        reviewCarry = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data) as Record<string, unknown>;
            const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
            if (content) {
              reviewBuffer += content;
              onSse({ phase: "design-review", content });
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
        const tail = reviewDecoder.decode();
        if (tail) reviewCarry += tail;
        if (reviewCarry.startsWith("data: ")) {
          const data = reviewCarry.slice(6).trim();
          if (data && data !== "[DONE]") {
            try {
              const parsed = JSON.parse(data) as Record<string, unknown>;
              const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
              if (content) { reviewBuffer += content; onSse({ phase: "design-review", content }); }
            } catch { /* discard */ }
          }
        }
      } finally {
        reviewReader.releaseLock();
      }

      const reviewMs = Date.now() - reviewStart;
      logger.info(
        { layer: "v2:design-review", reviewMs, bufLen: reviewBuffer.length, elapsedMsPipeline: Date.now() - pipelineStart },
        `[v2:design-review] ── Design Review ended in ${reviewMs}ms ──`
      );

      if (reviewBuffer.length >= 50) {
        try {
          const improved = extractJson(reviewBuffer) as WebsiteBlueprint;
          const MIN_COMPONENTS = 5;
          if (
            improved &&
            Array.isArray(improved.pages) &&
            improved.pages.length > 0 &&
            Array.isArray(improved.pages[0]?.components) &&
            improved.pages[0].components.length >= MIN_COMPONENTS
          ) {
            const reviewedPage = improved.pages.find((p) => p.route === "/") ?? improved.pages[0];
            const reviewedComponents = reviewedPage.components.slice(0, MAX_COMPONENTS);
            blueprint = {
              ...improved,
              pages: [{ ...reviewedPage, route: "/", components: reviewedComponents }],
            };
            onSse({ phase: "blueprint-updated", data: blueprint });
            logger.info(
              { layer: "v2:design-review", components: blueprint.pages[0].components.length },
              "[v2:design-review] Blueprint improved and updated"
            );
          } else {
            logger.warn({ layer: "v2:design-review" }, "[v2:design-review] Improved blueprint failed validation — using original");
          }
        } catch (parseErr) {
          logger.warn({ layer: "v2:design-review", parseErr }, "[v2:design-review] Failed to parse improved blueprint JSON — using original");
        }
      }
    } catch (reviewErr) {
      logger.warn({ layer: "v2:design-review", reviewErr }, "[v2:design-review] Design Review Agent failed — proceeding with original blueprint");
    }

    bus.emit("llm", "architect_complete", "completed", { durationMs: Date.now() - reviewStart }, "design-review");
    flush();

    // ── Code Generation Agent ────────────────────────────────────────────────
    const codegenStart = Date.now();
    bus.emit("llm", "codegen_start", "running", {
      model: CODE_GENERATOR_MODEL,
      projectId: projectId ?? undefined,
      pageCount: blueprint.pages?.length ?? 0,
      componentCount: blueprint.pages?.reduce((n, p) => n + (p.components?.length ?? 0), 0) ?? 0,
      elapsedMsPipeline: Date.now() - pipelineStart,
    }, "codegen");

    onSse({ phase: "building" });
    flush();

    let project: GeneratedProject;
    try {
      project = await generateProjectCode(
        context,
        blueprint,
        userId,
        (content) => onSse({ phase: "building", content }),
        (active) => onSse({ phase: "thinking", active }),
      );
      const codegenMs = Date.now() - codegenStart;
      const totalChars = project.files.reduce((n, f) => n + f.content.length, 0);
      const largestFile = project.files.reduce(
        (best, f) => (f.content.length > best.size ? { path: f.path, size: f.content.length } : best),
        { path: "(none)", size: 0 }
      );
      bus.emit("llm", "codegen_complete", "completed", {
        model: CODE_GENERATOR_MODEL,
        durationMs: codegenMs,
        elapsedMsPipeline: Date.now() - pipelineStart,
        fileCount: project.files.length,
        depCount: project.dependencies.length,
        totalChars,
        largestFilePath: largestFile.path,
        largestFileChars: largestFile.size,
        previewLen: project.preview.length,
        projectId: projectId ?? undefined,
        bottleneckFlag:
          codegenMs > 180_000 ? "SLOW_MODEL_OVER_3MIN" :
          codegenMs > 60_000 ? "SLOW_MODEL_OVER_1MIN" :
          totalChars > 500_000 ? "LARGE_OUTPUT_OVER_500K" :
          largestFile.size > 100_000 ? "LARGE_SINGLE_FILE_OVER_100K" :
          "OK",
      }, "codegen");

      // ── Infrastructure file injection ──────────────────────────────────────
      // The code gen prompt is constrained to 8 component/page files and does
      // not produce package.json, tailwind.config.ts, or tsconfig.json.
      // Inject canonical boilerplate for any missing infrastructure files so
      // the mounted project is always runnable without changing AI output scope.
      for (const f of project.files) {
        bus.emit("filesystem", "create_file", "completed", { path: f.path }, "codegen");
      }
      flush();

      const existingPaths = new Set(project.files.map((f) => f.path));

      if (!existingPaths.has("package.json")) {
        bus.emit("filesystem", "create_file", "completed", { path: "package.json", operation: "injected" }, "build");
        flush();
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
          path: "package.json",
          operation: "create",
          language: "json",
          content: JSON.stringify({
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
        logger.info({ layer: "v2:inject" }, "[v2:inject] Injected package.json");
      }

      if (!existingPaths.has("tailwind.config.ts")) {
        bus.emit("filesystem", "create_file", "completed", { path: "tailwind.config.ts", operation: "injected" }, "build");
        flush();
        project.files.push({
          path: "tailwind.config.ts",
          operation: "create",
          language: "typescript",
          content: [
            "import type { Config } from 'tailwindcss'",
            "const config: Config = {",
            "  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],",
            "  theme: { extend: {} },",
            "  plugins: [],",
            "}",
            "export default config",
          ].join("\n"),
        });
        logger.info({ layer: "v2:inject" }, "[v2:inject] Injected tailwind.config.ts");
      }

      if (!existingPaths.has("tsconfig.json")) {
        bus.emit("filesystem", "create_file", "completed", { path: "tsconfig.json", operation: "injected" }, "build");
        flush();
        project.files.push({
          path: "tsconfig.json",
          operation: "create",
          language: "json",
          content: JSON.stringify({
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
        logger.info({ layer: "v2:inject" }, "[v2:inject] Injected tsconfig.json");
      }

      if (!existingPaths.has("postcss.config.mjs")) {
        bus.emit("filesystem", "create_file", "completed", { path: "postcss.config.mjs", operation: "injected" }, "build");
        flush();
        project.files.push({
          path: "postcss.config.mjs",
          operation: "create",
          language: "javascript",
          content: [
            "const config = {",
            "  plugins: { tailwindcss: {}, autoprefixer: {} },",
            "}",
            "export default config",
          ].join("\n"),
        });
        logger.info({ layer: "v2:inject" }, "[v2:inject] Injected postcss.config.mjs");
      }

      // Close BUILD phase now that all files (LLM-generated + injected) are known.
      engine.emitPhaseComplete("BUILD");
      flush();

    } catch (codeErr) {
      const codegenMs = Date.now() - codegenStart;
      const failureCategory =
        String(codeErr).includes("JSON parse failed") ? "JSON_PARSE_ERROR" :
        String(codeErr).includes("schema errors") ? "SCHEMA_VALIDATION_ERROR" :
        String(codeErr).includes("empty response") ? "EMPTY_RESPONSE" :
        String(codeErr).includes("HTTP 4") ? "NVIDIA_HTTP_ERROR" :
        String(codeErr).includes("HTTP 5") ? "NVIDIA_HTTP_ERROR" :
        String(codeErr).includes("TimeoutError") ? "TIMEOUT" :
        String(codeErr).includes("AbortError") ? "ABORTED" :
        "UNKNOWN";
      bus.emit("pipeline", "error", "failed", {
        error: String(codeErr),
        errName: codeErr instanceof Error ? codeErr.name : "unknown",
        errMsg: codeErr instanceof Error ? codeErr.message : String(codeErr),
        userId,
        projectId: projectId ?? undefined,
        durationMs: codegenMs,
        elapsedMsPipeline: Date.now() - pipelineStart,
        failureCategory,
      }, "codegen");
      if (projectId) await markProjectFailed(projectId, String(codeErr));
      engine.emitError("BUILD", "Generation stopped while building the project. Collecting diagnostic information.");
      flush();
      return { ok: false, code: "CODEGEN_ERROR", message: "The Code Generation Agent failed to produce a valid project. Please try again." };
    }

    // ── Save generated files ─────────────────────────────────────────────────
    const dbSaveStart = Date.now();
    let resultProject: GeneratedProject & { projectId?: string } = project;
    if (projectId) {
      bus.emit("database", "save_files", "running", { projectId, fileCount: project.files.length }, "persist");
      flush();
      await saveGeneratedFiles(projectId, project.files, project.dependencies, project.preview);
      const dbSaveMs = Date.now() - dbSaveStart;
      resultProject = { ...project, projectId };
      bus.emit("database", "save_files", "completed", {
        projectId,
        durationMs: dbSaveMs,
        fileCount: project.files.length,
      }, "persist");
    } else {
      engine.emitPhaseStart("REPORT");
      flush();
    }

    // ── Pipeline complete ────────────────────────────────────────────────────
    const totalPipelineMs = Date.now() - pipelineStart;
    const totalCharsAll = resultProject.files.reduce((n, f) => n + f.content.length, 0);
    const largestFileAll = resultProject.files.reduce(
      (best, f) => (f.content.length > best.size ? { path: f.path, size: f.content.length } : best),
      { path: "(none)", size: 0 }
    );
    bus.emit("pipeline", "finish", "completed", {
      durationMs: totalPipelineMs,
      fileCount: resultProject.files.length,
      depCount: resultProject.dependencies.length,
      totalChars: totalCharsAll,
      largestFilePath: largestFileAll.path,
      largestFileChars: largestFileAll.size,
      projectId: projectId ?? undefined,
      userId,
    }, "pipeline");
    flush();

    return { ok: true, project: resultProject };
  },

  /**
   * Owns the Website Studio edit pipeline (Commit 4): inspect current files →
   * decide + write modifications via the Editing Agent → persist file changes
   * → regenerate + validate the preview → report what changed.
   *
   * Maps onto the five relevant Marcus phases: UNDERSTAND, PLAN, BUILD, TEST,
   * REPORT. Every step emits real ConversationEvents — no timers, no fake
   * typing — driven entirely by confirmed work (files read, files written,
   * a completed LLM call, a completed persistence write).
   *
   * The final file-modification system is untouched: this method returns
   * FileModification[] which the caller applies via the existing DB update
   * path; Marcus never edits Monaco or the WebContainer directly.
   */
  async runEditFlow(rt: MarcusEditRuntime): Promise<MarcusEditRunResult> {
    const {
      taskBus: bus,
      conversationEngine: engine,
      projectId,
      userId,
      businessContext: context,
      blueprint,
      files,
      instruction,
      selectedFiles,
      workspaceContext,
      pipelineStart,
      onSse,
    } = rt;
    const flush = () => flushEditEngine(engine, onSse);

    // ── UNDERSTAND: inspect current files ────────────────────────────────────
    engine.emitPhaseStart("UNDERSTAND");
    flush();

    // Only narrate specific file reads for files we can *guarantee* were sent
    // to the editing agent — the user's own file-focus selection. Otherwise
    // describe the review truthfully without naming files we didn't confirm.
    if (selectedFiles?.length) {
      for (const path of selectedFiles) {
        engine.emitFileOperation(path, "read", "UNDERSTAND");
      }
    } else {
      // UNDERSTAND phase is active — the frontend activity strip already shows
      // "Reading project files…" via the phase→description mapping. No separate
      // message event needed.
    }
    flush();
    engine.emitPhaseComplete("UNDERSTAND");
    flush();

    // ── PLAN: the Editing Agent decides + writes the modifications ──────────
    engine.emitPhaseStart("PLAN");
    flush();

    const editStart = Date.now();
    bus.emit("llm", "edit_start", "running", {
      model: EDITOR_MODEL,
      userId,
      projectId,
      elapsedMsPipeline: Date.now() - pipelineStart,
    }, "edit");
    flush();

    let result: { changes: FileModification[]; summary: string };
    try {
      result = await runEditingAgent(context, blueprint, files, instruction, selectedFiles, {
        userId, projectId, workspaceContext,
        // Phase 14.1: Forward timeline updates as SSE events
        onTimelineUpdate: (update: TimelineUpdate) => {
          onSse({ phase: "timeline", data: update });
        },
        // Phase 14.2: Forward confidence payload as SSE event
        onConfidenceUpdate: (data) => {
          onSse({ phase: "confidence", data });
        },
        // Phase 14.3: Forward preview intelligence as SSE event
        onPreviewUpdate: (data) => {
          onSse({ phase: "preview", data });
        },
        // Phase 14.4: Forward visual verification as SSE event
        onVisualUpdate: (data) => {
          onSse({ phase: "visual", data });
        },
        // Phase 14.5: Forward recovery & rollback events as SSE events
        onRecoveryUpdate: (data) => {
          onSse({ phase: "recovery", data });
        },
        // Phase 14.6: Forward engineering decision as SSE event
        onDecisionUpdate: (data) => {
          onSse({ phase: "decision", data });
        },
        // Phase 15.1: Forward engineering audit as SSE event
        onAuditUpdate: (data) => {
          onSse({ phase: "audit", data });
        },
        // Phase 16.1: Forward product intelligence as SSE event
        onProductUpdate: (data) => {
          onSse({ phase: "product", data });
        },
        // Phase 16.2: Forward engineering advisor as SSE event
        onAdvisorUpdate: (data) => {
          onSse({ phase: "advisor", data });
        },
        onRoadmapUpdate: (data) => {
          onSse({ phase: "roadmap", data });
        },
      });
    } catch (err) {
      const editMs = Date.now() - editStart;
      bus.emit("llm", "edit_complete", "failed", {
        model: EDITOR_MODEL, userId, projectId, durationMs: editMs, error: String(err),
      }, "edit");
      engine.emitPhaseFailed("PLAN", "Could not generate valid changes for that request. Try rephrasing it.", editMs);
      flush();
      return { ok: false, code: "EDIT_ERROR", message: err instanceof Error ? err.message : "Edit failed" };
    }

    const editMs = Date.now() - editStart;
    bus.emit("llm", "edit_complete", "completed", {
      model: EDITOR_MODEL, userId, projectId, durationMs: editMs, changeCount: result.changes.length,
    }, "edit");
    // The edit-agent summary is sent by the route as `{ phase: "changes" }`
    // after runEditFlow returns, so we do NOT emit it here as a message event
    // — that would duplicate the summary in the conversation.
    engine.emitPhaseComplete("PLAN", editMs);
    flush();

    if (result.changes.length === 0) {
      engine.emitWarning(null, "No changes needed for that instruction.");
      engine.emitDone(Date.now() - pipelineStart, "No changes were needed.");
      flush();
      return { ok: true, changes: [], summary: result.summary, fileCount: 0 };
    }

    // ── BUILD: apply + persist the file modifications ────────────────────────
    engine.emitPhaseStart("BUILD");
    flush();

    for (const change of result.changes) {
      const fsAction = change.operation === "create" ? "create_file" : change.operation === "delete" ? "delete_file" : "update_file";
      bus.emit("filesystem", fsAction, "completed", { path: change.path }, "BUILD");
      engine.emitFileOperation(change.path, change.operation, "BUILD", change.reason);
      flush();
    }

    bus.emit("database", "save_edit", "running", { projectId, fileCount: result.changes.length }, "BUILD");
    flush();

    const { files: updatedFiles, ok: savedOk } = await updateProjectFiles(projectId, result.changes);
    if (!savedOk) {
      bus.emit("database", "save_edit", "failed", { projectId }, "BUILD");
      engine.emitPhaseFailed("BUILD", "Could not save changes to the project.");
      flush();
      return { ok: false, code: "SAVE_ERROR", message: "Failed to save changes to database" };
    }

    bus.emit("database", "save_edit", "completed", { projectId, fileCount: result.changes.length }, "BUILD");
    engine.emitPhaseComplete("BUILD");
    flush();

    // ── TEST: regenerate + validate the preview ───────────────────────────────
    engine.emitPhaseStart("TEST");
    flush();

    try {
      const preview = await runPreviewGenerator(
        context, blueprint, updatedFiles.length > 0 ? updatedFiles : files, { userId, projectId },
      );
      await updateProjectPreview(projectId, preview);
      engine.emitPhaseComplete("TEST");
    } catch (previewErr) {
      // Preview failure is non-fatal — files are already saved.
      logger.warn({ err: String(previewErr), projectId }, "[v2:edit] Preview regeneration failed (non-fatal)");
      engine.emitWarning("TEST", "The live preview couldn't be regenerated, but your file changes were saved.");
      engine.emitPhaseComplete("TEST");
    }
    flush();

    // ── REPORT: explain what changed ──────────────────────────────────────────
    const totalMs = Date.now() - pipelineStart;
    engine.emitPhaseStart("REPORT");
    // The summary is already delivered to the conversation via the route's
    // `{ phase: "changes" }` event — no need to re-emit it here.
    engine.emitPhaseComplete("REPORT", totalMs);
    engine.emitDone(totalMs, result.summary);
    flush();

    return { ok: true, changes: result.changes, summary: result.summary, fileCount: result.changes.length };
  },
} as const;
