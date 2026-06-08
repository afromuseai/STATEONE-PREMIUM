import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { streamNvidia, forwardStream } from "../lib/nvidia";
import { MODELS } from "../lib/models";
import { db } from "@workspace/db";
import { builderProjectsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";

const router = Router();

// ─── System prompt — the AI has FULL creative control ─────────────────────────
// No template constraints. The model writes raw HTML/CSS/JS from scratch.
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

SECTIONS — include ALL of these:
1. Navigation: sticky, logo left, links center, CTA button right, mobile hamburger
2. Hero: large headline, subheadline, 2 CTAs, one social proof stat or badge
3. Features/Services: 3-6 items in a grid with icons (use SVG icons inline)
4. How It Works: 3-4 numbered steps
5. Testimonials: 2-4 customer quotes with name and role
6. Pricing (or Trust/Credibility section if pricing doesn't fit)
7. FAQ: accordion with 4-6 questions (JS-powered open/close)
8. CTA: large conversion section
9. Footer: links, copyright, brief description

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

Design something that feels custom-built for this exact business — unique colors, typography, layout, and visual language appropriate to the industry and style direction.

Generate the complete HTML document now.`;
}

// ─── POST /api/ai-builder/generate ────────────────────────────────────────────
// Streaming SSE — returns raw HTML chunks the client accumulates
router.post("/api/ai-builder/generate", requireAuth, async (req, res) => {
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

  try {
    const body = await streamNvidia({
      model: MODELS.EXECUTION,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(prompt, style, industry) },
      ],
      temperature: 0.85,
      maxTokens: 12000,
    });

    const fullHtml = await forwardStream(body, res, MODELS.EXECUTION);

    // Strip markdown fences if the model wrapped the output
    const cleaned = stripMarkdownFences(fullHtml);

    // Auto-save for logged-in user
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
        // Non-fatal — don't fail the response if save fails
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, fullHtml: cleaned })}\n\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
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

// ─── GET /api/ai-builder/projects ─────────────────────────────────────────────
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
  } catch (err) {
    res.status(500).json({ error: "Failed to load projects" });
  }
});

// ─── GET /api/ai-builder/projects/:id ─────────────────────────────────────────
router.get("/api/ai-builder/projects/:id", requireAuth, async (req, res) => {
  try {
    const [project] = await db
      .select()
      .from(builderProjectsTable)
      .where(eq(builderProjectsTable.id, req.params.id))
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

// ─── DELETE /api/ai-builder/projects/:id ──────────────────────────────────────
router.delete("/api/ai-builder/projects/:id", requireAuth, async (req, res) => {
  try {
    const [project] = await db
      .select({ id: builderProjectsTable.id, userId: builderProjectsTable.userId })
      .from(builderProjectsTable)
      .where(eq(builderProjectsTable.id, req.params.id))
      .limit(1);

    if (!project || project.userId !== req.user!.userId) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    await db.delete(builderProjectsTable).where(eq(builderProjectsTable.id, req.params.id));
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

export default router;
