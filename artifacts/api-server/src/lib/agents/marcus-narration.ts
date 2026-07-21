// ─── Marcus Narration — pure text/metadata builders for generation signals ────
// Phase 10.2: these functions turn data ALREADY available in the generation
// pipeline (BusinessContext, the model's own planning text, validation
// results, file paths) into human-readable narration + structured metadata.
//
// Hard rule enforced throughout this file: never invent a fact. Every string
// returned here is built only from values passed in — no guessed colors,
// no fabricated design rationale, no made-up file descriptions beyond what
// the filename/path conventionally implies (e.g. "Hero.tsx" is a hero
// section — that's a naming convention, not a fabricated business fact).
//
// This file has zero side effects and no imports from the streaming/SSE
// layer, so it can be unit tested in isolation from marcus-stream-agent.ts.

import type { BusinessContext } from "../website-v2-types";
import type { ConfidenceLevel } from "./marcus-stream-agent";

// ─── UNDERSTAND phase ──────────────────────────────────────────────────────────

export function buildUnderstandingNarration(ctx: BusinessContext): { message: string; summary: string } {
  return {
    message: `Analyzing ${ctx.companyName}'s business type, target audience, and website goals before deciding the structure.`,
    summary: `Company: ${ctx.companyName} · Industry: ${ctx.industry} · Audience: ${ctx.targetAudience} · Goal: ${ctx.businessGoal}`,
  };
}

// ─── PLAN phase ─────────────────────────────────────────────────────────────────

export function buildPlanningNarration(): string {
  return "Creating the website architecture and deciding how users will navigate through the main sections.";
}

/**
 * Design decisions are never fabricated. This only extracts what the model
 * *already said* in its own planning text (the free-text "thinking" the
 * model writes before ---BEGIN FILES---, per MARCUS_SYSTEM_PROMPT PHASE 1).
 * If the model didn't mention design/palette/typography in that text, this
 * returns null — no design-phase event is emitted, per spec: "do not fake it".
 */
export function extractDesignDecision(planningText: string): { decision: string; reason?: string } | null {
  const text = planningText.trim();
  if (!text) return null;

  // Split into sentences; find the first one that actually discusses a
  // design/visual decision (palette, typography, layout style, motion).
  const sentences = text.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
  const designKeywords = /\b(palette|colou?r|typograph|font|layout|visual|design system|minimal|modern|bold|elegant|gradient|whitespace|motion|animation)\b/i;

  const decisionIdx = sentences.findIndex(s => designKeywords.test(s));
  if (decisionIdx === -1) return null;

  const decision = sentences[decisionIdx];
  // The next sentence, if present, often supplies the "why" — only use it as
  // `reason` if it reads like a rationale, not just another unrelated fact.
  const next = sentences[decisionIdx + 1];
  const reason = next && /\b(because|since|matches|fits|reflects|reinforces|aligns|suits|for)\b/i.test(next)
    ? next
    : undefined;

  return { decision, reason };
}

// ─── EXECUTE / DEVELOPMENT phase ───────────────────────────────────────────────

// Well-known component roles inferred from filename conventions — this is a
// naming-convention lookup, not a fabricated fact about the specific project.
const FILE_ROLE_BY_NAME: Record<string, string> = {
  "hero.tsx":         "the hero section that introduces the company and drives visitors toward the primary call to action",
  "navbar.tsx":       "the navigation bar that lets visitors move between the main sections",
  "footer.tsx":       "the footer with closing links and contact information",
  "features.tsx":     "the features section that explains what the product/service does",
  "testimonials.tsx": "the testimonials section that builds trust with social proof",
  "howitworks.tsx":   "the section explaining how the product/service works step by step",
  "pricing.tsx":      "the pricing section that lays out plans and costs",
  "cta.tsx":          "a call-to-action section that prompts visitors to take the next step",
  "page.tsx":         "the homepage layout that assembles all sections in order",
  "layout.tsx":       "the root layout that wraps every page with shared structure and fonts",
  "package.json":     "the project's dependency manifest",
  "tailwind.config.ts": "the design tokens (colors, fonts, spacing) used across the site",
  "globals.css":      "the global styles and font imports shared by every page",
};

export function buildFilePurpose(path: string, ctx: BusinessContext): string {
  const filename = (path.split("/").pop() ?? path).toLowerCase();
  const role = FILE_ROLE_BY_NAME[filename];
  if (role) {
    return `Creating ${role} for ${ctx.companyName}.`;
  }
  // Fall back to a generic-but-honest description rather than guessing.
  return `Writing ${path}.`;
}

// ─── OBSERVE / FIX / VALIDATE phases (QUALITY CHECK) ───────────────────────────

export function buildObserveNarration(): string {
  return "Checking responsiveness, component structure, and build stability before presenting the website.";
}

export function buildFixNarration(issues: string[], iteration: number): { message: string; summary: string } {
  return {
    message: `Fixing ${issues.length} issue${issues.length === 1 ? "" : "s"} found during review — attempt ${iteration}.`,
    summary: issues.join("; "),
  };
}

export function buildValidateNarration(validation: { ok: boolean; errors: string[] }): { message: string; summary?: string } {
  if (validation.ok) {
    return { message: "All files validated successfully — structure, syntax, and required components are in place." };
  }
  return {
    message: "Validation complete with known issues remaining after the maximum fix attempts.",
    summary: validation.errors.join("; "),
  };
}

// ─── COMPLETION / REPORT phase ─────────────────────────────────────────────────

export function deriveConfidence(validation: { ok: boolean }, fixIteration: number): ConfidenceLevel {
  if (validation.ok && fixIteration === 0) return "HIGH";
  if (validation.ok) return "MEDIUM";
  return "LOW";
}

export function buildCompletionNarration(
  ctx: BusinessContext,
  filesCreated: string[],
  validation: { ok: boolean; errors: string[] },
  decision: { decision: string; reason?: string } | null,
): { message: string; summary: string } {
  const fileWord = filesCreated.length === 1 ? "file" : "files";
  const validationClause = validation.ok
    ? "all validation checks passed"
    : `${validation.errors.length} known issue${validation.errors.length === 1 ? "" : "s"} remain`;

  const message = `Website completed for ${ctx.companyName} — ${filesCreated.length} ${fileWord} generated, ${validationClause}.`;

  const summaryParts = [`${filesCreated.length} ${fileWord} generated`];
  if (decision) summaryParts.push(`Design: ${decision.decision}`);
  summaryParts.push(validation.ok ? "Validation: passed" : `Validation: ${validation.errors.length} issue(s) remaining`);

  return { message, summary: summaryParts.join(" · ") };
}
