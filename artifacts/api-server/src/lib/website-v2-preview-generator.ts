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
const PREVIEW_SYSTEM_PROMPT = `You are a frontend rendering engineer.

You receive a Next.js project file set.

Create a standalone HTML preview representing the current website.

Output ONLY valid HTML. No explanation. No markdown. No code fences.

The HTML must:
- Start with <!DOCTYPE html>
- Include all CSS inline in a single <style> tag inside <head>
- Include all interactivity inline in a single <script> tag at end of <body>
- Accurately render the visual appearance described by the components
- Use the exact design-system colors, spacing, typography, and motion from the files
- Include responsive behavior and animations (CSS transitions, keyframes)
- Be fully self-contained — no external imports, no CDN links
- Use real business content from the BusinessContext (company name, industry, taglines)
- Never use placeholder text (Lorem ipsum, "Your Company", "Coming soon")`;

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
    maxTokens:   8000,
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

  const preview = stripCodeFences(rawOutput);

  // Minimal sanity check — model must have produced something HTML-like
  if (!preview.includes("<html") && !preview.includes("<!DOCTYPE") && !preview.includes("<body")) {
    throw new Error(`Preview generator returned non-HTML output (${preview.length} chars)`);
  }

  logger.info({ projectId: options.projectId }, "[v2:preview] Preview ready");
  return preview;
}
