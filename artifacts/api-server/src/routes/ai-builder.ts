import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/planGuard";
import { callNvidia, streamNvidia, forwardStream, extractJson } from "../lib/nvidia";
import { MODELS } from "../lib/models";
import { db } from "@workspace/db";
import { builderProjectsTable, builderGenerationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════════
// PLANNING LAYER — Phase 1 (runs BEFORE HTML generation)
// ═══════════════════════════════════════════════════════════════════════════════

interface WebsitePlan {
  business_summary: string;
  target_audience: string;
  value_proposition: string;
  brand_tone: string;
  design_direction: string;
  visual_style: string;
  section_order: string[];
  conversion_strategy: string;
  CTA_strategy: string;
}

interface DesignDna {
  typography_system: string;
  spacing_system: string;
  layout_style: string;
  color_direction: string;
  animation_style: string;
}

interface PlanResult {
  websitePlan: WebsitePlan;
  designDna: DesignDna;
}

function buildPlannerSystemPrompt(): string {
  return `You are a senior website strategist and UX architect. Your role is to analyze a business description and produce a structured strategic plan that will guide website design and implementation.

You must return ONLY valid JSON — no markdown, no code fences, no explanation. The JSON must match this exact structure:

{
  "websitePlan": {
    "business_summary": "one concise sentence describing the business and its core offering",
    "target_audience": "specific demographic and psychographic description of the ideal customer",
    "value_proposition": "the primary benefit and differentiator — what makes this business unique",
    "brand_tone": "e.g. Authoritative and trustworthy | Playful and energetic | Sophisticated and minimal",
    "design_direction": "detailed visual design direction for this specific business type",
    "visual_style": "e.g. Dark luxury editorial | Clean modern SaaS | Bold brutalist | Warm organic",
    "section_order": ["Hero", "SocialProof", "Problem", "Solution", "Features", "Testimonials", "Pricing", "FAQ", "CTA"],
    "conversion_strategy": "primary conversion mechanism and psychological levers to use",
    "CTA_strategy": "specific CTA language, placement, and urgency tactics"
  },
  "designDna": {
    "typography_system": "primary + secondary typeface pairing, weight hierarchy, sizing scale",
    "spacing_system": "section padding rhythm, component density, whitespace philosophy",
    "layout_style": "e.g. Asymmetric editorial | Centered minimal | Dense feature-grid | Full-bleed cinematic",
    "color_direction": "primary color + accent + background palette rationale tied to the business",
    "animation_style": "e.g. Subtle fade-reveals | Kinetic scroll | Entrance cascades | Static/no animation"
  }
}

The section_order must be tailored to the business — not every site needs pricing. Choose from: Hero, SocialProof, Problem, Solution, Features, HowItWorks, Testimonials, Pricing, Trust, FAQ, CTA, Footer. Always include Hero and CTA. Always end implied page with Footer (do not list Footer — it is always included).`;
}

function buildPlannerUserPrompt(prompt: string, style: string, industry: string): string {
  return `Analyze this business and generate a strategic website plan:

BUSINESS DESCRIPTION:
${prompt}

DESIGN STYLE PREFERENCE: ${style}
INDUSTRY: ${industry}

Return the JSON plan now. No explanation. No markdown. Pure JSON only.`;
}

async function generatePlan(prompt: string, style: string, industry: string): Promise<PlanResult> {
  const raw = await callNvidia({
    model: MODELS.WEBSITE_PLANNING,
    messages: [
      { role: "system", content: buildPlannerSystemPrompt() },
      { role: "user", content: buildPlannerUserPrompt(prompt, style, industry) },
    ],
    temperature: 0.6,
    maxTokens: 1500,
  });

  const parsed = extractJson(raw) as Partial<PlanResult>;

  // Ensure we always have a valid structure (fallbacks if model output is partial)
  const websitePlan: WebsitePlan = {
    business_summary: parsed.websitePlan?.business_summary ?? `${industry} business`,
    target_audience: parsed.websitePlan?.target_audience ?? "General audience",
    value_proposition: parsed.websitePlan?.value_proposition ?? "High-quality products and services",
    brand_tone: parsed.websitePlan?.brand_tone ?? style,
    design_direction: parsed.websitePlan?.design_direction ?? `${style} design`,
    visual_style: parsed.websitePlan?.visual_style ?? style,
    section_order: Array.isArray(parsed.websitePlan?.section_order)
      ? parsed.websitePlan!.section_order
      : ["Hero", "Features", "HowItWorks", "Testimonials", "Pricing", "FAQ", "CTA"],
    conversion_strategy: parsed.websitePlan?.conversion_strategy ?? "Lead capture and direct conversion",
    CTA_strategy: parsed.websitePlan?.CTA_strategy ?? "Primary CTA above fold, repeated at section breaks",
  };

  const designDna: DesignDna = {
    typography_system: parsed.designDna?.typography_system ?? "Inter for UI, bold weights for headings",
    spacing_system: parsed.designDna?.spacing_system ?? "Generous section padding, moderate component density",
    layout_style: parsed.designDna?.layout_style ?? "Centered clean layout",
    color_direction: parsed.designDna?.color_direction ?? "Professional primary palette with high contrast",
    animation_style: parsed.designDna?.animation_style ?? "Subtle fade-reveal on scroll",
  };

  return { websitePlan, designDna };
}

function buildImplementationBrief(websitePlan: WebsitePlan, designDna: DesignDna): string {
  return `
━━━ STRATEGIC PLAN (follow this exactly — this overrides generic defaults) ━━━

BUSINESS: ${websitePlan.business_summary}
TARGET AUDIENCE: ${websitePlan.target_audience}
VALUE PROPOSITION: ${websitePlan.value_proposition}
BRAND TONE: ${websitePlan.brand_tone}

PAGE SECTION ORDER (use this exact sequence, in this order):
${websitePlan.section_order.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}
  ${websitePlan.section_order.length + 1}. Footer

CONVERSION STRATEGY: ${websitePlan.conversion_strategy}
CTA STRATEGY: ${websitePlan.CTA_strategy}

━━━ DESIGN DNA (apply these decisions throughout) ━━━

VISUAL DIRECTION: ${websitePlan.design_direction} — ${websitePlan.visual_style}
TYPOGRAPHY: ${designDna.typography_system}
SPACING: ${designDna.spacing_system}
LAYOUT: ${designDna.layout_style}
COLOR DIRECTION: ${designDna.color_direction}
ANIMATION: ${designDna.animation_style}

Apply every one of these decisions. Do not substitute generic defaults.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HTML GENERATION LAYER — Phase 2 (existing system, unchanged)
// ═══════════════════════════════════════════════════════════════════════════════

function buildSystemPrompt(): string {
  return `You are an elite web designer and frontend engineer. Your job is to generate a complete, production-quality, visually stunning website as a single self-contained HTML document.

RETURN FORMAT — CRITICAL:
- Return ONLY a complete HTML document. Nothing else.
- The document MUST start with <!DOCTYPE html> and end with </html>
- Do NOT wrap in markdown fences. Do NOT add any explanation. Pure HTML only.

TECHNICAL CONSTRAINTS — ALL REQUIRED:
- All CSS in a single <style> tag inside <head>
- All JavaScript in a single <script> tag before </body>
- ONLY allowed external resource: Google Fonts via @import inside your <style> tag
- NO Tailwind CDN, NO Bootstrap CDN, NO external CSS frameworks
- NO jQuery, NO GSAP, NO React, NO external JS libraries
- CSS custom properties (:root { --primary: ...; }) for the entire design system
- Mobile-first responsive design with proper @media breakpoints
- All images use free Unsplash URLs: https://images.unsplash.com/photo-XXXXXXX?w=1200&q=80&fit=crop

INTERACTIVITY — ALL REQUIRED:
- Smooth scroll-reveal animations using IntersectionObserver (not CSS alone)
- Sticky nav changes background on scroll
- FAQ accordion with smooth expand/collapse (CSS max-height transition)
- Animated counters for any metric numbers
- Hover micro-interactions on cards and buttons (CSS :hover transitions)
- Mobile menu toggle

VISUAL QUALITY — ALL REQUIRED:
- Gradient text on the main hero headline (background-clip: text)
- Animated background element in hero (glowing orbs / grid lines / particles — based on design style)
- Subtle grain texture overlay or gradient mesh for visual depth
- Card hover effects (translateY + box-shadow)
- Consistent border-radius system (defined in :root)
- Typography hierarchy: at least 3 distinct font sizes with clear visual weight

DESIGN PHILOSOPHY:
Design uniquely for the specific business described. A luxury spa must look completely different from a cybersecurity startup. A children's education app must differ from an enterprise SaaS platform. Use the business context to determine: color palette, typography personality (serif vs sans-serif, weight), layout style (dense/spacious), tone (playful/serious), and visual metaphors. DO NOT produce a generic light-gray SaaS template.`;
}

function buildUserPrompt(prompt: string, style: string, industry: string): string {
  return `Build a complete website for this business:

BUSINESS DESCRIPTION:
${prompt}

DESIGN STYLE: ${style}
INDUSTRY: ${industry}

Design something that feels custom-built for this exact business — unique colors, typography, layout, and visual language appropriate to the industry and style direction.`;
}

function buildEnrichedUserPrompt(
  prompt: string,
  style: string,
  industry: string,
  websitePlan: WebsitePlan,
  designDna: DesignDna,
): string {
  const brief = buildImplementationBrief(websitePlan, designDna);
  return `${buildUserPrompt(prompt, style, industry)}

${brief}

Generate the complete HTML document now.`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/ai-builder/generate — Full pipeline: Plan → Design DNA → HTML
// ═══════════════════════════════════════════════════════════════════════════════
router.post("/api/ai-builder/generate", requireAuth, requireFeature("ai_builder"), async (req, res) => {
  const { prompt, style = "Modern SaaS", industry = "SaaS" } = req.body as {
    prompt: string;
    style?: string;
    industry?: string;
  };

  if (!prompt?.trim()) {
    res.status(400).json({ error: "prompt is required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  let generationId: string | null = null;
  const startTime = Date.now();

  // ── Create generation artifact ─────────────────────────────────────────────
  if (req.user?.userId) {
    try {
      const [gen] = await db
        .insert(builderGenerationsTable)
        .values({
          userId: req.user.userId,
          prompt: prompt.trim(),
          style,
          industry,
          generationStatus: "generating",
          modelUsed: MODELS.EXECUTION,
        })
        .returning({ id: builderGenerationsTable.id });
      generationId = gen?.id ?? null;
    } catch {
      // Non-fatal
    }
  }

  if (generationId) {
    res.write(`data: ${JSON.stringify({ generationId })}\n\n`);
  }

  try {
    // ── PHASE 1: Planning ──────────────────────────────────────────────────
    res.write(`data: ${JSON.stringify({ type: "plan_start" })}\n\n`);

    const { websitePlan, designDna } = await generatePlan(prompt.trim(), style, industry);

    res.write(`data: ${JSON.stringify({ type: "plan", websitePlan, designDna })}\n\n`);

    // ── Persist plan to generation record ─────────────────────────────────
    if (generationId) {
      try {
        await db
          .update(builderGenerationsTable)
          .set({ websitePlan, designDna })
          .where(eq(builderGenerationsTable.id, generationId));
      } catch {
        // Non-fatal
      }
    }

    // ── PHASE 2: HTML generation (existing system, enriched with plan) ─────
    res.write(`data: ${JSON.stringify({ type: "generation_start" })}\n\n`);

    const body = await streamNvidia({
      model: MODELS.EXECUTION,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildEnrichedUserPrompt(prompt.trim(), style, industry, websitePlan, designDna) },
      ],
      temperature: 0.85,
      maxTokens: 12000,
    });

    const fullHtml = await forwardStream(body, res, MODELS.EXECUTION);
    const cleaned = stripMarkdownFences(fullHtml);
    const durationMs = Date.now() - startTime;
    const tokenCount = Math.round(cleaned.length / 4);

    // ── Update generation artifact (completed) ─────────────────────────────
    if (generationId) {
      try {
        await db
          .update(builderGenerationsTable)
          .set({
            generatedHtml: cleaned,
            generationStatus: "completed",
            durationMs,
            tokenCount,
          })
          .where(eq(builderGenerationsTable.id, generationId));
      } catch {
        // Non-fatal
      }
    }

    // ── Also save to builder_projects (existing behaviour preserved) ───────
    if (req.user?.userId) {
      try {
        await db.insert(builderProjectsTable).values({
          userId: req.user.userId,
          prompt: prompt.trim(),
          style,
          industry,
          fullHtml: cleaned,
        });
      } catch {
        // Non-fatal
      }
    }

    res.write(
      `data: ${JSON.stringify({
        done: true,
        fullHtml: cleaned,
        generationId,
        durationMs,
        tokenCount,
        modelUsed: MODELS.EXECUTION,
      })}\n\n`,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    const durationMs = Date.now() - startTime;

    if (generationId) {
      try {
        await db
          .update(builderGenerationsTable)
          .set({ generationStatus: "failed", durationMs, errorMessage: msg })
          .where(eq(builderGenerationsTable.id, generationId));
      } catch {
        // Non-fatal
      }
    }

    res.write(`data: ${JSON.stringify({ error: msg, generationId })}\n\n`);
  } finally {
    res.end();
  }
});

function stripMarkdownFences(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```html")) s = s.slice(7);
  else if (s.startsWith("```")) s = s.slice(3);
  if (s.endsWith("```")) s = s.slice(0, -3);
  return s.trim();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Generation CRUD routes
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/api/ai-builder/generations", requireAuth, async (req, res) => {
  try {
    const generations = await db
      .select({
        id: builderGenerationsTable.id,
        prompt: builderGenerationsTable.prompt,
        style: builderGenerationsTable.style,
        industry: builderGenerationsTable.industry,
        generationStatus: builderGenerationsTable.generationStatus,
        modelUsed: builderGenerationsTable.modelUsed,
        durationMs: builderGenerationsTable.durationMs,
        tokenCount: builderGenerationsTable.tokenCount,
        errorMessage: builderGenerationsTable.errorMessage,
        createdAt: builderGenerationsTable.createdAt,
      })
      .from(builderGenerationsTable)
      .where(eq(builderGenerationsTable.userId, req.user!.userId))
      .orderBy(desc(builderGenerationsTable.createdAt))
      .limit(50);
    res.json({ generations });
  } catch {
    res.status(500).json({ error: "Failed to load generations" });
  }
});

router.get("/api/ai-builder/generations/:id", requireAuth, async (req, res) => {
  try {
    const genId = req.params["id"] as string;
    const [generation] = await db
      .select()
      .from(builderGenerationsTable)
      .where(eq(builderGenerationsTable.id, genId))
      .limit(1);
    if (!generation || generation.userId !== req.user!.userId) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }
    res.json({ generation });
  } catch {
    res.status(500).json({ error: "Failed to load generation" });
  }
});

router.delete("/api/ai-builder/generations/:id", requireAuth, async (req, res) => {
  try {
    const genId = req.params["id"] as string;
    const [generation] = await db
      .select({ id: builderGenerationsTable.id, userId: builderGenerationsTable.userId })
      .from(builderGenerationsTable)
      .where(eq(builderGenerationsTable.id, genId))
      .limit(1);
    if (!generation || generation.userId !== req.user!.userId) {
      res.status(404).json({ error: "Generation not found" });
      return;
    }
    await db.delete(builderGenerationsTable).where(eq(builderGenerationsTable.id, genId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete generation" });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// Builder Projects CRUD (existing)
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/api/ai-builder/projects", requireAuth, async (req, res) => {
  try {
    const projects = await db
      .select({
        id: builderProjectsTable.id,
        prompt: builderProjectsTable.prompt,
        style: builderProjectsTable.style,
        industry: builderProjectsTable.industry,
        createdAt: builderProjectsTable.createdAt,
      })
      .from(builderProjectsTable)
      .where(eq(builderProjectsTable.userId, req.user!.userId))
      .orderBy(desc(builderProjectsTable.createdAt))
      .limit(50);
    res.json({ projects });
  } catch {
    res.status(500).json({ error: "Failed to load projects" });
  }
});

router.get("/api/ai-builder/projects/:id", requireAuth, async (req, res) => {
  try {
    const projId = req.params["id"] as string;
    const [project] = await db
      .select()
      .from(builderProjectsTable)
      .where(eq(builderProjectsTable.id, projId))
      .limit(1);
    if (!project || project.userId !== req.user!.userId) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ project });
  } catch {
    res.status(500).json({ error: "Failed to load project" });
  }
});

router.delete("/api/ai-builder/projects/:id", requireAuth, async (req, res) => {
  try {
    const projId = req.params["id"] as string;
    const [project] = await db
      .select({ id: builderProjectsTable.id, userId: builderProjectsTable.userId })
      .from(builderProjectsTable)
      .where(eq(builderProjectsTable.id, projId))
      .limit(1);
    if (!project || project.userId !== req.user!.userId) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    await db.delete(builderProjectsTable).where(eq(builderProjectsTable.id, projId));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
