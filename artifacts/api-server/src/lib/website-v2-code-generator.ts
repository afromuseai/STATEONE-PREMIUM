// ─── Website Architect V2 — Phase 2: Code Generation Agent ───────────────────
// Receives BusinessContext + WebsiteBlueprint from Phase 1.
// Produces GeneratedProject: operation-based ProjectFile list + HTML preview.
//
// V1 is untouched. website-html-generator.ts is NOT used here.
// This module is imported only by generate-website-v2.ts.

import { streamNvidia } from "./nvidia";
import { jsonrepair } from "jsonrepair";
import { MODELS } from "./models";
import { logger } from "./logger";
import type {
  BusinessContext,
  WebsiteBlueprint,
  GeneratedProject,
  ProjectFile,
} from "./website-v2-types";

// ─── HTML escaping helpers ────────────────────────────────────────────────────
// Used by generateFallbackPreview to prevent XSS when LLM-generated context
// strings are interpolated into HTML.

/** Escape a string for safe injection into HTML text content or attributes. */
function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitize a CSS color value so it cannot break out of a CSS property context.
 * Allows: hex (#rgb / #rrggbb / #rrggbbaa), rgb/rgba/hsl/hsla functions,
 * and simple named colors (letters only).  Falls back to the supplied default.
 */
function escCssColor(s: string, fallback: string): string {
  const trimmed = s.trim();
  if (/^#([0-9a-fA-F]{3,8})$/.test(trimmed))      return trimmed;
  if (/^(rgb|rgba|hsl|hsla)\([^)]*\)$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]+$/.test(trimmed))                 return trimmed;
  return fallback;
}

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

  // Only fatal if there are no files at all — file count / naming issues
  // are logged as structured warnings but never discard a complete code generation run.
  if (files.length === 0) {
    errors.push("missing or invalid 'files' field — no files generated");
  } else {
    const paths = new Set(files.map((f) => f.path));
    if (!paths.has("app/page.tsx")) {
      logger.warn({ layer: "v2:parse", missingFile: "app/page.tsx" }, "[v2:parse] Generated project is missing app/page.tsx");
    }
    if (!paths.has("components/Navbar.tsx")) {
      logger.warn({ layer: "v2:parse", missingFile: "components/Navbar.tsx" }, "[v2:parse] Generated project is missing components/Navbar.tsx");
    }
  }

  if (errors.length > 0) {
    throw new Error(`GeneratedProject schema errors: ${errors.join("; ")}`);
  }

  // ── Preview HTML — non-fatal: generate a blueprint-aware fallback if omitted ──
  // The model occasionally skips the preview field when the code output is large.
  // A missing preview must never discard an otherwise-complete generation run.
  const rawPreview =
    typeof parsed.preview === "string" && (parsed.preview as string).trim()
      ? (parsed.preview as string)
      : generateFallbackPreview(ctx, blueprint);

  const deps = Array.isArray(parsed.dependencies)
    ? (parsed.dependencies as unknown[]).filter((d): d is string => typeof d === "string")
    : [];

  return {
    files,
    dependencies:    deps,
    runInstructions: { command: "npm run dev" },
    preview:         rawPreview,
    blueprint,
    context:         ctx,
  };
}

// ─── Fallback preview generator ───────────────────────────────────────────────
// Generates a simple but visually coherent HTML preview from blueprint context
// when the LLM omits the preview field.  Shows brand name, tagline, and the
// primary design palette so the Studio preview pane is never blank.
// All LLM-sourced strings are escaped before injection (XSS prevention).
function generateFallbackPreview(ctx: BusinessContext, blueprint: WebsiteBlueprint): string {
  const ds = blueprint.designSystem;

  // CSS color values — sanitized so they can't break out of a CSS property
  const primaryColor = escCssColor(ds.colorPrimary || "", "#6366f1");
  const accentColor  = escCssColor(ds.colorAccent  || "", "#a78bfa");

  // HTML text values — escaped for safe injection into HTML text / title contexts
  const companyName = escHtml(ctx.companyName  || "Your Website");
  const industry    = escHtml(ctx.industry     || "");
  const positioning = escHtml(ctx.brandPositioning || "");
  const ctaGoal     = escHtml(ctx.conversionGoal   || "Get Started");

  // Derive hero text from pages — first page's first component purpose
  const heroComponent = blueprint.pages?.[0]?.components?.[0];
  const goal          = ctx.businessGoal || "Welcome";
  const heroPurpose   = escHtml(heroComponent?.purpose ?? goal);

  const sections = blueprint.pages?.[0]?.components?.slice(0, 4) ?? [];

  logger.info({ layer: "v2:parse", action: "fallback_preview_generated" }, "[v2:parse] Generating fallback preview HTML (model omitted preview field)");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${companyName}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  :root {
    --primary: ${primaryColor};
    --accent: ${accentColor};
    --bg: #09090b;
    --surface: #18181b;
    --text: #fafafa;
    --muted: #a1a1aa;
  }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; }
  nav { display: flex; align-items: center; justify-content: space-between; padding: 1rem 2rem; border-bottom: 1px solid rgba(255,255,255,.08); }
  .logo { font-size: 1.1rem; font-weight: 800; background: linear-gradient(135deg, var(--primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .nav-links { display: flex; gap: 1.5rem; }
  .nav-links a { color: var(--muted); text-decoration: none; font-size: .875rem; transition: color .2s; }
  .nav-links a:hover { color: var(--text); }
  .hero { text-align: center; padding: 6rem 2rem 4rem; }
  .badge { display: inline-block; font-size: .7rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; padding: .3rem .8rem; border-radius: 9999px; border: 1px solid rgba(255,255,255,.12); color: var(--muted); margin-bottom: 1.5rem; }
  h1 { font-size: clamp(2rem, 5vw, 3.5rem); font-weight: 900; line-height: 1.1; letter-spacing: -.02em; margin-bottom: 1.25rem; }
  .gradient-text { background: linear-gradient(135deg, var(--primary), var(--accent)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .subtitle { font-size: 1.1rem; color: var(--muted); max-width: 560px; margin: 0 auto 2.5rem; }
  .cta-row { display: flex; align-items: center; justify-content: center; gap: 1rem; flex-wrap: wrap; }
  .btn-primary { background: var(--primary); color: #fff; padding: .75rem 2rem; border-radius: 8px; border: none; font-size: .9rem; font-weight: 700; cursor: pointer; }
  .btn-secondary { color: var(--muted); background: transparent; border: 1px solid rgba(255,255,255,.12); padding: .75rem 2rem; border-radius: 8px; font-size: .9rem; font-weight: 600; cursor: pointer; }
  .features { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.5rem; padding: 3rem 2rem; max-width: 960px; margin: 0 auto; }
  .card { background: var(--surface); border: 1px solid rgba(255,255,255,.07); border-radius: 12px; padding: 1.5rem; }
  .card-icon { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, var(--primary), var(--accent)); opacity: .25; margin-bottom: 1rem; }
  .card h3 { font-size: .95rem; font-weight: 700; margin-bottom: .5rem; }
  .card p { font-size: .8rem; color: var(--muted); line-height: 1.5; }
  footer { text-align: center; padding: 2rem; border-top: 1px solid rgba(255,255,255,.06); color: var(--muted); font-size: .75rem; margin-top: 2rem; }
</style>
</head>
<body>
  <nav>
    <div class="logo">${companyName}</div>
    <div class="nav-links">
      <a href="#">Features</a>
      <a href="#">Pricing</a>
      <a href="#">About</a>
    </div>
    <button class="btn-primary" style="padding:.5rem 1.25rem;font-size:.8rem">Get Started</button>
  </nav>
  <section class="hero">
    <div class="badge">${industry}</div>
    <h1>${companyName}<br><span class="gradient-text">${heroPurpose}</span></h1>
    <p class="subtitle">${positioning}</p>
    <div class="cta-row">
      <button class="btn-primary">${ctaGoal}</button>
      <button class="btn-secondary">Learn more &rarr;</button>
    </div>
  </section>
  <div class="features">
    ${sections.map((c) => `
    <div class="card">
      <div class="card-icon"></div>
      <h3>${escHtml(c.name ?? "")}</h3>
      <p>${escHtml(c.purpose ?? "")}</p>
    </div>`).join("")}
  </div>
  <footer>&copy; ${new Date().getFullYear()} ${companyName} &middot; Built with STAGEONE</footer>
</body>
</html>`;
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
