// ─── Website Architect V2 — AI Editing Agent ──────────────────────────────────
// Receives the current project state and a user instruction.
// Returns a set of file modifications (FileModification[]) — never a full
// regeneration. Only files that need to change are returned.
//
// V1 is completely untouched. website-html-generator.ts is NOT used here.

import { streamNvidia, extractJson } from "./nvidia";
import { jsonrepair } from "jsonrepair";
import { MODELS } from "./models";
import { logger } from "./logger";
import type {
  BusinessContext,
  WebsiteBlueprint,
  ProjectFile,
  EditResult,
} from "./website-v2-types";

// ─── Model ────────────────────────────────────────────────────────────────────
// Same model as the code generator — strongest TypeScript/TSX output.
export const EDITOR_MODEL = MODELS.COMPONENT_GENERATION;

// ─── Max files to include in context ─────────────────────────────────────────
const MAX_CONTEXT_FILES = 12;

// ─── System prompt ────────────────────────────────────────────────────────────
const EDITOR_SYSTEM_PROMPT = `You are a senior frontend engineer at a world-class product studio, specialising in Next.js 14 App Router and TypeScript.

You receive:
1. BusinessContext — the company name, industry, target audience, goals
2. WebsiteBlueprint — the architecture and design system specification
3. Existing project files — the actual TypeScript/TSX source code
4. User instruction — exactly what the user wants to change

Your job:
- Understand the intent of the instruction precisely
- Identify which files need to change to satisfy the request
- Return ONLY those files — never return files that do not change
- Write complete, valid file content (not diffs or partial snippets)
- Maintain TypeScript correctness, existing import paths, and component interfaces
- Preserve the overall architecture, naming conventions, and file structure
- Derive all copy (headlines, labels) from BusinessContext — never use placeholder text

Return ONLY this JSON object (no markdown, no code fences, no explanation outside the JSON):
{
  "changes": [
    {
      "path": "components/HeroSection.tsx",
      "operation": "update",
      "content": "...complete file content...",
      "reason": "One-sentence description of what changed and why"
    }
  ],
  "summary": "Human-readable summary of all changes made"
}

STRICT RULES:
- Every "content" field must be the COMPLETE file (no partial code, no ellipsis)
- operation is exactly one of: "update", "create", "delete"
- For "delete", content should be an empty string
- Never include files that are unchanged
- No TypeScript errors, no missing imports, no undefined components
- If you need a new sub-component, create it as a separate file with operation "create"
- Keep Tailwind classes — do not switch to inline styles unless the value is dynamic`;

// ─── Build user prompt ────────────────────────────────────────────────────────
function buildUserPrompt(
  context: BusinessContext,
  blueprint: WebsiteBlueprint | null,
  files: ProjectFile[],
  instruction: string,
  selectedFilePaths?: string[]
): string {
  let contextFiles: ProjectFile[];
  if (selectedFilePaths?.length) {
    const sel = new Set(selectedFilePaths);
    const focused = files.filter((f) => sel.has(f.path));
    const rest    = files.filter((f) => !sel.has(f.path)).slice(0, MAX_CONTEXT_FILES - focused.length);
    contextFiles = [...focused, ...rest];
  } else {
    contextFiles = files.slice(0, MAX_CONTEXT_FILES);
  }

  const fileSection = contextFiles
    .map((f) => `### FILE: ${f.path}\n\`\`\`${f.language ?? "typescript"}\n${f.content}\n\`\`\``)
    .join("\n\n");

  const blueprintStr = blueprint ? `\n\nWEBSITE BLUEPRINT:\n${JSON.stringify(blueprint, null, 2)}` : "";

  return `BUSINESS CONTEXT:
Company: ${context.companyName}
Industry: ${context.industry}
Target Audience: ${context.targetAudience}
Business Goal: ${context.businessGoal}
Brand Positioning: ${context.brandPositioning}
${blueprintStr}

ALL PROJECT FILES (${files.length} total; showing ${contextFiles.length} in context):
${fileSection}

USER INSTRUCTION:
${instruction}
${selectedFilePaths?.length ? `\nUSER FOCUSED ON: ${selectedFilePaths.join(", ")}` : ""}

Apply the instruction. Return only the JSON with "changes" and "summary".`;
}

// ─── Stream reader — accumulates all content tokens from NVIDIA SSE ───────────
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
          const choices = parsed.choices as Array<{ delta?: { content?: string; reasoning_content?: string } }>;
          const content = choices?.[0]?.delta?.content;
          if (content) buffer += content;
        } catch {
          // skip malformed SSE fragment
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return buffer;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runEditingAgent(
  context: BusinessContext,
  blueprint: WebsiteBlueprint | null,
  files: ProjectFile[],
  instruction: string,
  selectedFilePaths?: string[],
  options: { userId?: string; projectId?: string } = {}
): Promise<EditResult> {
  logger.info(
    { projectId: options.projectId, instruction: instruction.slice(0, 100) },
    "[v2:editor] Starting edit"
  );

  const stream = await streamNvidia({
    model:       EDITOR_MODEL,
    temperature: 0.35,
    maxTokens:   16000,
    messages: [
      { role: "system", content: EDITOR_SYSTEM_PROMPT },
      { role: "user",   content: buildUserPrompt(context, blueprint, files, instruction, selectedFilePaths) },
    ],
    _feature:   "website-v2-edit",
    _userId:    options.userId,
    _projectId: options.projectId,
  });

  const rawOutput = await accumulateStream(stream);

  logger.info({ projectId: options.projectId, rawLen: rawOutput.length }, "[v2:editor] Stream complete");

  let result: EditResult;
  try {
    const repaired = jsonrepair(rawOutput);
    result = extractJson(repaired) as EditResult;
  } catch (err) {
    logger.error({ err: String(err), rawLen: rawOutput.length }, "[v2:editor] JSON parse failed");
    throw new Error("Editing agent returned malformed JSON — please try again");
  }

  if (!Array.isArray(result?.changes)) {
    throw new Error("Editing agent response missing 'changes' array");
  }

  logger.info(
    { projectId: options.projectId, changeCount: result.changes.length },
    "[v2:editor] Edit complete"
  );

  return result;
}
