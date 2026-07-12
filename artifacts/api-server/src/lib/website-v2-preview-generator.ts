// ─── Website Architect V2 — Preview Generator ─────────────────────────────────
// Converts the current set of project files into a self-contained HTML preview
// that can be injected into <iframe srcDoc>. Runs after every AI edit so the
// iframe always reflects the latest code without a build step.
//
// V1 is completely untouched. website-html-generator.ts is NOT imported here.

import { streamNvidia } from "./nvidia";
import { MODELS } from "./models";
import { logger } from "./logger";
import type { BusinessContext, WebsiteBlueprint, ProjectFile } from "./website-v2-types";

// ─── Model ────────────────────────────────────────────────────────────────────
const PREVIEW_MODEL = MODELS.COMPONENT_GENERATION;

// ─── File priority heuristics ─────────────────────────────────────────────────
// Include the files most likely to shape the visual output first, then fill
// the remaining budget with whatever is left.
const MAX_PREVIEW_FILES = 8;
const PRIORITY_PATTERNS   = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/globals.css",
  "components/HeroSection",
  "components/Navbar",
  "components/Header",
  "components/Footer",
];

// ─── System prompt ────────────────────────────────────────────────────────────
const PREVIEW_SYSTEM_PROMPT = `You are a senior frontend engineer producing a pixel-quality, production-grade
HTML preview of a real website — this is what the client sees first, so sloppy
spacing or layout is not acceptable.

You receive a Next.js project file set.

Create a standalone HTML preview representing the current website.

Output ONLY valid HTML. No explanation. No markdown. No code fences.

The HTML must:
- Start with <!DOCTYPE html>
- Include <meta charset="UTF-8"> and <meta name="viewport" content="width=device-width, initial-scale=1"> in <head>
- Include all CSS inline in a single <style> tag inside <head>
- Include all interactivity inline in a single <script> tag at end of <body>
- Accurately render the visual appearance described by the components
- Use the exact design-system colors, spacing, typography, and motion from the files
- Include responsive behavior and animations (CSS transitions, keyframes)
- Be fully self-contained — no external imports, no CDN links
- Use real business content from the BusinessContext (company name, industry, taglines)
- Never use placeholder text (Lorem ipsum, "Your Company", "Coming soon")
- ALWAYS finish with the closing </body></html> tags. Never stop mid-element or mid-stylesheet — if you are running low on space, wrap up the current section cleanly rather than starting a new one, and always close every tag you open.

LAYOUT & SPACING RULES (violating these produces a broken, "raw HTML" look — avoid it):
- Always start the stylesheet with a reset: \`*{box-sizing:border-box;margin:0;padding:0}\` plus sensible defaults for img/svg (display:block, max-width:100%).
- Every section is a full-width block with its own vertical padding (e.g. 80-120px desktop, 48-64px mobile); content inside sits in a centered container with a fixed max-width (1200-1280px) and consistent horizontal padding (24-32px) — never let text or elements touch the viewport edge.
- Use a real spacing scale (e.g. multiples of 4/8px) consistently for gaps, margins, and padding — no arbitrary one-off values that create uneven rhythm between elements.
- Decorative elements (gradient blobs, background shapes, glows) MUST live inside a parent with \`position:relative; overflow:hidden\` and be sized/positioned so they never spill outside their section or cut across unrelated content — they are background texture, not foreground elements crossing the layout diagonally over text or buttons.
- Any \`position:absolute\` or \`position:fixed\` element must have an explicit, intentional placement verified against its container's bounds — never leave one floating disconnected from the content it belongs to.
- Headings, body copy, and buttons need deliberate line-height (1.1-1.3 for headings, 1.5-1.7 for body) and spacing between them (never stacked with zero gap, never overlapping).
- Verify nothing overlaps: stack unrelated elements vertically with clear gaps rather than absolute-positioning them on top of each other unless it's an intentional, correctly z-indexed composition.`;

// ─── Build user prompt ────────────────────────────────────────────────────────
function buildPreviewPrompt(
  context: BusinessContext,
  blueprint: WebsiteBlueprint | null,
  files: ProjectFile[]
): string {
  // Sort: priority files first, fill with the rest up to MAX_PREVIEW_FILES
  const prioritised = [
    ...files.filter((f) => PRIORITY_PATTERNS.some((p) => f.path.includes(p))),
    ...files.filter((f) => !PRIORITY_PATTERNS.some((p) => f.path.includes(p))),
  ].slice(0, MAX_PREVIEW_FILES);

  const fileSection = prioritised
    .map((f) => `### FILE: ${f.path}\n\`\`\`${f.language ?? "typescript"}\n${f.content}\n\`\`\``)
    .join("\n\n");

  const designSection = blueprint
    ? `DESIGN SYSTEM:
Style: ${blueprint.designSystem.style}
Primary Color: ${blueprint.designSystem.colorPrimary}
Accent Color: ${blueprint.designSystem.colorAccent}
Typography: ${blueprint.designSystem.typography}
Motion: ${blueprint.designSystem.motion}
Border Radius: ${blueprint.designSystem.borderRadius}

`
    : "";

  return `BUSINESS CONTEXT:
Company: ${context.companyName}
Industry: ${context.industry}
Target Audience: ${context.targetAudience}
Business Goal: ${context.businessGoal}
Brand Positioning: ${context.brandPositioning}

${designSection}PROJECT FILES (${prioritised.length} of ${files.length} total):
${fileSection}

Generate a complete, standalone HTML preview of this website. Output ONLY the HTML starting with <!DOCTYPE html>.`;
}

// ─── Stream accumulator ───────────────────────────────────────────────────────
async function accumulateStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  const reader  = stream.getReader();
  let carry  = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text  = carry + decoder.decode(value, { stream: true });
      const lines = text.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed  = JSON.parse(data) as Record<string, unknown>;
          const choices = parsed.choices as Array<{ delta?: { content?: string } }>;
          const content = choices?.[0]?.delta?.content;
          if (content) buffer += content;
        } catch { /* skip malformed SSE fragment */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return buffer;
}

// ─── Strip markdown wrappers ──────────────────────────────────────────────────
// Some NVIDIA models prefix/suffix HTML with ```html / ``` even when instructed
// not to. Strip those defensively.
function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/,       "")
    .replace(/\s*```\s*$/,    "")
    .trim();
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runPreviewGenerator(
  context: BusinessContext,
  blueprint: WebsiteBlueprint | null,
  files: ProjectFile[],
  options: { userId?: string; projectId?: string } = {}
): Promise<string> {
  logger.info({ projectId: options.projectId, fileCount: files.length }, "[v2:preview] Starting preview generation");

  const stream = await streamNvidia({
    model:       PREVIEW_MODEL,
    temperature: 0.25,
    maxTokens:   24000,
    messages: [
      { role: "system", content: PREVIEW_SYSTEM_PROMPT },
      { role: "user",   content: buildPreviewPrompt(context, blueprint, files) },
    ],
    _feature:   "website-v2-preview",
    _userId:    options.userId,
    _projectId: options.projectId,
  });

  const rawOutput = await accumulateStream(stream);
  logger.info({ projectId: options.projectId, rawLen: rawOutput.length }, "[v2:preview] Stream complete");

  let preview = stripCodeFences(rawOutput);

  // Minimal sanity check — model must have produced something HTML-like
  if (!preview.includes("<html") && !preview.includes("<!DOCTYPE") && !preview.includes("<body")) {
    throw new Error(`Preview generator returned non-HTML output (${preview.length} chars)`);
  }

  // Truncation safety net — if the model ran out of budget mid-document, the
  // response can be cut off before the closing tags, which renders as raw,
  // unstyled, overlapping markup in the iframe (an unclosed <style>/<script>
  // block leaks its contents as visible text and breaks all layout below it).
  // Close whatever is still open rather than shipping broken HTML.
  if (!/<\/html>\s*$/i.test(preview)) {
    logger.warn({ projectId: options.projectId }, "[v2:preview] Output appears truncated — repairing unclosed tags");
    preview = repairTruncatedHtml(preview);
  }

  logger.info({ projectId: options.projectId }, "[v2:preview] Preview ready");
  return preview;
}

// ─── Truncation repair ─────────────────────────────────────────────────────────
// Best-effort close of any tag left open when the stream was cut short, so the
// iframe never renders raw source text instead of the intended page.
function repairTruncatedHtml(html: string): string {
  let repaired = html;

  const openCount  = (tag: string) => (repaired.match(new RegExp(`<${tag}(\\s|>)`, "gi")) ?? []).length;
  const closeCount = (tag: string) => (repaired.match(new RegExp(`</${tag}\\s*>`, "gi")) ?? []).length;

  // Close core structural/content tags in the order they'd naturally nest.
  for (const tag of ["script", "style", "body", "html"]) {
    while (openCount(tag) > closeCount(tag)) {
      repaired += `</${tag}>`;
    }
  }

  if (!/<\/html>\s*$/i.test(repaired)) {
    repaired += "</html>";
  }

  return repaired;
}
