// ─── Website Architect V2 — Phase 2: Code Generation Agent ───────────────────
// Receives BusinessContext + WebsiteBlueprint from Phase 1.
// Produces GeneratedProject: operation-based ProjectFile list + HTML preview.
//
// V1 is untouched. website-html-generator.ts is NOT used here.
// This module is imported only by generate-website-v2.ts.

import { streamNvidia } from "./nvidia";
import { jsonrepair } from "jsonrepair";
import { MODELS } from "./models";
import type {
  BusinessContext,
  WebsiteBlueprint,
  GeneratedProject,
  ProjectFile,
} from "./website-v2-types";

// ─── Model assignment ─────────────────────────────────────────────────────────
// Nemotron Ultra 550B: frontier code generation with extended thinking enabled.
export const CODE_GENERATOR_MODEL = MODELS.COMPONENT_GENERATION;

// ─── Language inference from file extension ───────────────────────────────────
function inferLanguage(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css"))                           return "css";
  if (path.endsWith(".json"))                          return "json";
  if (path.endsWith(".md"))                            return "markdown";
  return "text";
}

// ─── System prompt ─────────────────────────────────────────────────────────────
export const CODE_GENERATOR_SYSTEM_PROMPT = `You are an elite Next.js 14 engineer at a world-class product studio.

You receive:
1. A BusinessContext — the company brief (name, industry, audience, goal)
2. A WebsiteBlueprint — an architecture document specifying pages, components, design system, and behaviors

Your job is to generate a complete, real, production-quality Next.js 14 App Router project as an operation-based file list.

YOU MUST generate:
- Real TypeScript (.tsx / .ts) React components using "use client" where needed
- Real Tailwind CSS classes (no inline styles except for dynamic values)
- Real Framer Motion animations matching the blueprint behavior specs
- Real Next.js 14 App Router file structure (app/page.tsx, app/layout.tsx, etc.)
- Proper component composition — pages import and compose their components
- A self-contained HTML preview string that visually approximates the design
- A dependencies array listing all npm packages beyond the Next.js defaults

YOU MUST NOT generate:
- Placeholder stubs or "// TODO" comments
- Lorem ipsum or generic copy — derive real copy from BusinessContext
- WebsiteOutput JSON or template renderer structures
- HTML-only implementations
- Code fences, markdown, or explanation outside the JSON

REQUIRED FILES — always include all of these as separate entries:
- app/layout.tsx       — root layout with metadata, global styles import
- app/page.tsx         — home page composing hero + key section components
- app/globals.css      — Tailwind directives + CSS variables
- components/Navbar.tsx
- components/HeroSection.tsx
- package.json         — with next, react, react-dom, framer-motion, tailwindcss
- tailwind.config.ts   — content paths for app/** and components/**
- tsconfig.json        — standard Next.js 14 tsconfig

ADDITIONAL FILES: Generate a components/<ComponentName>.tsx file for every
component listed in the blueprint pages. For secondary pages (route != "/"),
generate app/<route>/page.tsx. All operations must be "create".

REAL CODE STANDARDS:
- Every component must be a complete, importable React function
- "use client" for all Framer Motion or browser-interactive components
- Framer Motion: import { motion } from "framer-motion"
- Tailwind: use real utility classes only
- TypeScript: all component props must have explicit interfaces
- next/link for all internal navigation, next/image for images
- No placeholder image URLs — use next/image with width/height props only

COPY: Generate real, specific business copy from BusinessContext. Use the
actual company name (never "[COMPANY NAME]" placeholders).

DESIGN SYSTEM TRANSLATION — map blueprint designSystem to Tailwind:
- "deep navy" → bg-slate-900 / text-slate-900
- "warm slate" → bg-slate-700
- "electric blue" → text-blue-500 / bg-blue-500
- "amber gold" → text-amber-400 / bg-amber-400
- borderRadius: "sharp"→rounded-none, "sm"→rounded, "md"→rounded-lg, "lg"→rounded-2xl, "full"→rounded-full
- motion "none"→no animations, "subtle"→simple fade/slide, "expressive"→spring + stagger

DEPENDENCIES: List every npm package used that is not in a standard Next.js 14
install. Common ones: framer-motion, lucide-react, clsx, tailwind-merge.

RUN INSTRUCTIONS: always "npm run dev".

PREVIEW HTML: A complete standalone HTML document with inline <style> and
optional inline <script>. Must look like a real styled website (not a wireframe).
Cover all primary-page sections. No external CDN imports.

OUTPUT FORMAT — return ONLY a single valid JSON object, no markdown, no fences:
{
  "files": [
    {
      "path": "app/page.tsx",
      "operation": "create",
      "content": "full file content here, all special chars JSON-escaped"
    },
    {
      "path": "components/Navbar.tsx",
      "operation": "create",
      "content": "..."
    }
  ],
  "dependencies": ["framer-motion", "lucide-react"],
  "preview": "<!DOCTYPE html><html>...</html>"
}

JSON escaping rules for file content strings:
- Newlines must be written as \\n
- Double quotes inside content must be written as \\"
- Backslashes must be written as \\\\`;

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
  Style:         ${ds.style}
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

Generate the complete GeneratedProject JSON for "${ctx.companyName}".
Every component in the blueprint must have a real, complete implementation.
All file content strings must be valid JSON — escape newlines as \\n, quotes as \\".`;
}

// ─── Parse and validate the generated project ─────────────────────────────────
export function parseGeneratedProject(
  raw: string,
  ctx: BusinessContext,
  blueprint: WebsiteBlueprint
): GeneratedProject {
  let clean = raw.trim();
  clean = clean.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  if (clean.startsWith("```json")) clean = clean.slice(7);
  else if (clean.startsWith("```"))  clean = clean.slice(3);
  if (clean.endsWith("```"))         clean = clean.slice(0, -3);
  clean = clean.trim();

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

  // ── Validate and normalise files ──────────────────────────────────────────
  const errors: string[] = [];

  let files: ProjectFile[] = [];

  // Support both new (array) and legacy (object) formats from the model
  if (Array.isArray(parsed.files)) {
    files = (parsed.files as Array<Record<string, unknown>>).map((f, i) => {
      const path    = typeof f.path    === "string" ? f.path    : `unknown-${i}`;
      const content = typeof f.content === "string" ? f.content : "";
      const op      = f.operation === "update" || f.operation === "delete"
                      ? (f.operation as "update" | "delete")
                      : "create";
      return {
        path,
        operation: op,
        content,
        language:  inferLanguage(path),
      };
    });
  } else if (parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)) {
    // Legacy Record<string,string> — convert to ProjectFile[]
    files = Object.entries(parsed.files as Record<string, unknown>).map(([path, content]) => ({
      path,
      operation: "create" as const,
      content:   typeof content === "string" ? content : "",
      language:  inferLanguage(path),
    }));
  } else {
    errors.push("missing or invalid 'files' field");
  }

  // Require the two most important files
  if (files.length > 0) {
    const paths = new Set(files.map((f) => f.path));
    if (!paths.has("app/page.tsx"))           errors.push("missing required file: app/page.tsx");
    if (!paths.has("components/Navbar.tsx"))  errors.push("missing required file: components/Navbar.tsx");
  }

  if (typeof parsed.preview !== "string" || !(parsed.preview as string).trim()) {
    errors.push("missing or empty 'preview' HTML string");
  }

  if (errors.length > 0) {
    throw new Error(`GeneratedProject schema errors: ${errors.join("; ")}`);
  }

  const deps = Array.isArray(parsed.dependencies)
    ? (parsed.dependencies as unknown[]).filter((d): d is string => typeof d === "string")
    : [];

  return {
    files,
    dependencies:    deps,
    runInstructions: { command: "npm run dev" },
    preview:         parsed.preview as string,
    blueprint,
    context:         ctx,
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

    if (thinkingSent && thinkingActive) onThinking(false);
  } finally {
    reader.releaseLock();
  }

  if (!buffer || buffer.length < 100) {
    throw new Error("Code Generation Agent returned an empty response");
  }

  return parseGeneratedProject(buffer, ctx, blueprint);
}
