// ─── Website Architect V2 — Phase 2: Code Generation Agent ───────────────────
// Receives BusinessContext + WebsiteBlueprint from Phase 1.
// Produces GeneratedProject: real Next.js 14 App Router files + HTML preview.
//
// V1 is untouched. website-html-generator.ts is NOT used here.
// This module is imported only by generate-website-v2.ts.

import { streamNvidia } from "./nvidia";
import { jsonrepair } from "jsonrepair";
import { MODELS } from "./models";
import type { BusinessContext, WebsiteBlueprint, GeneratedProject } from "./website-v2-types";

// ─── Model assignment ─────────────────────────────────────────────────────────
// Nemotron Ultra 550B: frontier code generation with extended thinking enabled.
export const CODE_GENERATOR_MODEL = MODELS.COMPONENT_GENERATION;

// ─── System prompt ─────────────────────────────────────────────────────────────
export const CODE_GENERATOR_SYSTEM_PROMPT = `You are an elite Next.js 14 engineer at a world-class product studio.

You receive:
1. A BusinessContext — the company brief (name, industry, audience, goal)
2. A WebsiteBlueprint — an architecture document specifying pages, components, design system, and behaviors

Your job is to generate a complete, real, production-quality Next.js 14 App Router project.

YOU MUST generate:
- Real TypeScript (.tsx / .ts) React components using the "use client" directive where needed
- Real Tailwind CSS classes (no inline styles except for dynamic values)
- Real Framer Motion animations matching the blueprint's behavior specs
- Real Next.js 14 App Router file structure (app/page.tsx, app/layout.tsx, etc.)
- Proper component composition — each page imports and composes its components
- A self-contained HTML preview string that visually approximates the design

YOU MUST NOT generate:
- Placeholder components (no "// TODO" stubs)
- Lorem ipsum or generic copy — derive real copy from the BusinessContext
- WebsiteOutput JSON or template renderer structures
- HTML-only implementations (the files must be real React/TSX)
- Code fences, markdown, or any explanation outside the JSON

REQUIRED FILES (always include these):
- app/layout.tsx       — root layout with metadata, global styles import
- app/page.tsx         — home page, imports and composes hero + feature components
- app/globals.css      — Tailwind directives + any CSS variables
- components/Navbar.tsx
- components/HeroSection.tsx
- package.json         — with next, react, react-dom, framer-motion, tailwindcss deps
- tailwind.config.ts   — content paths pointing to app/** and components/**
- tsconfig.json        — standard Next.js 14 tsconfig

ADDITIONAL FILES: Generate all components listed in the blueprint pages array.
Name each file components/<ComponentName>.tsx.
For secondary pages (not "/"), generate app/<route>/page.tsx.

REAL CODE STANDARDS:
- Every component must be a complete, importable React function
- Use "use client" for components with animations or browser interaction
- Framer Motion: import { motion } from "framer-motion" and use motion.div etc.
- Tailwind: use real utility classes, not invented class names
- TypeScript: all props must have explicit interfaces
- next/link for all internal navigation
- next/image for any image placeholders (use width/height props)

COPY: Generate real, specific business copy (headlines, CTAs, feature names) derived
from the BusinessContext. No Lorem Ipsum. No "[COMPANY NAME]" placeholders — use
the actual company name from the context.

DESIGN SYSTEM TRANSLATION:
Map the blueprint designSystem fields to Tailwind classes:
- colorPrimary "deep navy" → bg-slate-900, text-slate-900
- colorPrimary "warm slate" → bg-slate-700
- colorAccent "electric blue" → text-blue-500, bg-blue-500
- colorAccent "amber gold" → text-amber-400, bg-amber-400
- borderRadius "sharp" → rounded-none, "sm"→rounded, "md"→rounded-lg, "lg"→rounded-2xl, "full"→rounded-full
- motion "none" → no Framer Motion, "subtle" → simple fade/slide, "expressive" → spring animations + stagger

PREVIEW HTML:
The preview field must be a complete standalone HTML document (no external imports).
Use inline <style> tags with CSS that approximates the Tailwind design.
Use inline <script> tags only for essential interactivity (hamburger menu toggle).
The preview should look like a real, styled website — not a wireframe.
Include all the key sections from the home page (Navbar, Hero, Features at minimum).

OUTPUT FORMAT:
Return ONLY a single valid JSON object. No markdown. No code fences. No explanation.
All file content strings must be properly JSON-escaped:
- Newlines → \\n
- Quotes inside strings → \\"
- Backslashes → \\\\
- Template literal backticks → use \\u0060 or escape with a backslash

Schema:
{
  "files": {
    "app/layout.tsx": "...",
    "app/page.tsx": "...",
    "app/globals.css": "...",
    "components/Navbar.tsx": "...",
    "components/HeroSection.tsx": "...",
    "package.json": "...",
    "tailwind.config.ts": "...",
    "tsconfig.json": "..."
  },
  "preview": "<!DOCTYPE html><html>...</html>"
}`;

// ─── Build the user prompt ────────────────────────────────────────────────────
export function buildCodeGeneratorPrompt(
  ctx: BusinessContext,
  blueprint: WebsiteBlueprint
): string {
  const pagesSection = blueprint.pages
    .map((p) => {
      const comps = p.components
        .map(
          (c) =>
            `    • ${c.name}\n` +
            `      purpose: ${c.purpose}\n` +
            `      layout: ${c.layout}\n` +
            `      contentElements: ${c.contentElements.join(", ")}\n` +
            `      behavior: ${c.behavior.join("; ")}`
        )
        .join("\n");
      return `  ${p.route} (${p.priority})\n  purpose: ${p.purpose}\n  components:\n${comps}`;
    })
    .join("\n\n");

  const ds = blueprint.designSystem;

  return `BUSINESS CONTEXT
────────────────
Company:          ${ctx.companyName}
Industry:         ${ctx.industry}
Idea:             ${ctx.idea}
Target audience:  ${ctx.targetAudience}
Business goal:    ${ctx.businessGoal}
Brand position:   ${ctx.brandPositioning}
Conversion goal:  ${ctx.conversionGoal}

WEBSITE BLUEPRINT
─────────────────
Project type: ${blueprint.projectType}

Design system:
  Style:        ${ds.style}
  Primary color: ${ds.colorPrimary}
  Accent color:  ${ds.colorAccent}
  Typography:    ${ds.typography}
  Motion:        ${ds.motion}
  Border radius: ${ds.borderRadius}

Pages:
${pagesSection}

Responsive strategy: ${blueprint.responsiveStrategy}

Interaction plan:
${blueprint.interactionPlan.map((i) => `  • ${i}`).join("\n")}

Content strategy: ${blueprint.contentStrategy}

Technical requirements:
${blueprint.technicalRequirements.map((r) => `  • ${r}`).join("\n")}

Architect rationale: ${blueprint.architectRationale}

Generate the complete GeneratedProject JSON for this business. Every component
listed in the blueprint must have a real implementation. Use the company name
"${ctx.companyName}" throughout all copy.`;
}

// ─── Parse and validate the generated project ─────────────────────────────────
export function parseGeneratedProject(
  raw: string,
  ctx: BusinessContext,
  blueprint: WebsiteBlueprint
): GeneratedProject {
  let clean = raw.trim();
  // Strip <think> / reasoning blocks that may leak through
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  // Strip code fences
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```")) clean = clean.slice(3);
  if (clean.endsWith("```")) clean = clean.slice(0, -3);
  clean = clean.trim();
  // Extract outermost JSON object
  const objStart = clean.indexOf("{");
  const objEnd   = clean.lastIndexOf("}");
  if (objStart !== -1 && objEnd !== -1) {
    clean = clean.slice(objStart, objEnd + 1);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(clean) as Record<string, unknown>;
  } catch {
    parsed = JSON.parse(jsonrepair(clean)) as Record<string, unknown>;
  }

  // ── Validate required fields ────────────────────────────────────────────────
  const errors: string[] = [];

  if (!parsed.files || typeof parsed.files !== "object" || Array.isArray(parsed.files)) {
    errors.push("missing or invalid 'files' object");
  } else {
    const files = parsed.files as Record<string, unknown>;
    const required = ["app/page.tsx", "components/Navbar.tsx", "components/HeroSection.tsx"];
    for (const f of required) {
      if (typeof files[f] !== "string" || !(files[f] as string).trim()) {
        errors.push(`missing required file: ${f}`);
      }
    }
  }

  if (typeof parsed.preview !== "string" || !(parsed.preview as string).trim()) {
    errors.push("missing or empty 'preview' HTML string");
  }

  if (errors.length > 0) {
    throw new Error(`GeneratedProject schema errors: ${errors.join("; ")}`);
  }

  return {
    files:     parsed.files as Record<string, string>,
    preview:   parsed.preview as string,
    blueprint,
    context:   ctx,
  };
}

// ─── Code Generation Agent ────────────────────────────────────────────────────
// Streams generation tokens to the caller via onChunk, then returns the
// fully validated GeneratedProject. Throws on schema or parse failure.
export async function generateProjectCode(
  ctx: BusinessContext,
  blueprint: WebsiteBlueprint,
  userId: string,
  onChunk: (content: string) => void,
  onThinking: (active: boolean) => void
): Promise<GeneratedProject> {
  const stream = await streamNvidia({
    model:       CODE_GENERATOR_MODEL,
    temperature: 0.4,
    maxTokens:   16000,
    messages: [
      { role: "system", content: CODE_GENERATOR_SYSTEM_PROMPT },
      { role: "user",   content: buildCodeGeneratorPrompt(ctx, blueprint) },
    ],
    _feature: "website_generator_v2_code",
    _userId:  userId,
  });

  const decoder = new TextDecoder();
  const reader  = stream.getReader();
  let carry          = "";
  let buffer         = "";
  let thinkingActive = false;
  let thinkingSent   = false;
  let contentStarted = false;

  const processLines = (text: string) => {
    const lines = text.split("\n");
    carry = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") continue;

      try {
        const parsed   = JSON.parse(data) as Record<string, unknown>;
        const delta    = (parsed.choices as Array<{ delta?: { content?: string; reasoning_content?: string } }>)?.[0]?.delta;
        const content  = delta?.content;
        const thinking = delta?.reasoning_content;

        if (thinking && !thinkingActive && !contentStarted) {
          thinkingActive = true;
          thinkingSent   = true;
          onThinking(true);
        }

        if (content) {
          if (thinkingActive && !contentStarted) {
            thinkingActive = false;
            onThinking(false);
          }
          contentStarted = true;
          buffer += content;
          onChunk(content);
        }
      } catch {
        // Malformed SSE fragment — skip
      }
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      processLines(carry + decoder.decode(value, { stream: true }));
    }

    // Flush tail
    const tail = decoder.decode();
    if (tail) carry += tail;
    if (carry.startsWith("data: ")) {
      const data = carry.slice(6).trim();
      if (data && data !== "[DONE]") {
        try {
          const parsed  = JSON.parse(data) as Record<string, unknown>;
          const content = (parsed.choices as Array<{ delta?: { content?: string } }>)?.[0]?.delta?.content;
          if (content) { buffer += content; onChunk(content); }
        } catch { /* incomplete — discard */ }
      }
    }

    // Close thinking if content never arrived
    if (thinkingSent && thinkingActive) {
      onThinking(false);
    }
  } finally {
    reader.releaseLock();
  }

  if (!buffer || buffer.length < 100) {
    throw new Error("Code Generation Agent returned an empty response");
  }

  return parseGeneratedProject(buffer, ctx, blueprint);
}
