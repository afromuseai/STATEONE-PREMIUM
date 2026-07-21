// ─── Context Budget Manager — Token-Aware Context Selection ───────────────────
// Phase 13.3.1
//
// Replaces the old file-count-based MAX_CONTEXT_FILES approach with token-budget-
// aware context management. Ranks files by importance, fits them into the
// available token budget, and summarizes oversized files when needed.
//
// The editor model (Nemotron Ultra 550B) has a 128K context window. We reserve
// 16K for output (matching the hard maxTokens=16000) and 6K for prompt overhead
// (system prompt + business context + blueprint + workspace context + instruction),
// leaving ~106K tokens for file content. Conservative default: allocate 96K.

import type { ProjectFile } from "./website-v2-types";
import type { WorkspaceContext } from "./workspace-context";

// ─── Configuration ────────────────────────────────────────────────────────────

export interface ContextBudgetConfig {
  /** Total context window of the model in tokens. Default: 128000 */
  maxTokens: number;
  /** Tokens reserved for prompt overhead (system prompt, business context,
   *  blueprint, workspace context, instruction, formatting). Default: 6000 */
  reservedPromptTokens: number;
  /** Tokens reserved for model output (max_tokens parameter). Default: 16000 */
  reservedOutputTokens: number;
}

export const DEFAULT_BUDGET_CONFIG: ContextBudgetConfig = {
  maxTokens: 128_000,
  reservedPromptTokens: 6_000,
  reservedOutputTokens: 16_000,
};

// ─── Importance score (lower = more important) ────────────────────────────────

const PRIORITY_TIER: Record<string, number> = {
  selected:   1,
  related:    2,
  entryPoint: 3,
  layout:     4,
  other:      5,
};

/** Layout file patterns — same as in website-v2-editor.ts */
const LAYOUT_PATTERNS = [
  /\/layout\.(tsx|ts|js|jsx)$/,
  /\/layouts\//,
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RankedFile {
  file: ProjectFile;
  priority: number;     // 1 = highest (selected), 5 = lowest
  tierLabel: string;    // human-readable: "selected", "related", etc.
}

export interface SummarizedFile {
  originalPath: string;
  originalLineCount: number;
  summary: string;
  isSummarized: boolean;
}

export interface BudgetSelectionResult {
  /** Files selected to fit within the token budget (full content or summarized) */
  files: Array<{ file: ProjectFile; summarized?: SummarizedFile }>;
  /** Total estimated tokens consumed by the selected files */
  usedFileTokens: number;
  /** Total token budget available for files */
  availableFileTokens: number;
  /** Number of files that were summarized */
  summarizedCount: number;
  /** Number of files omitted due to budget */
  omittedCount: number;
  /** Whether the entire selection fit within budget without summarization */
  allFitUnsummarized: boolean;
}

// ─── Token estimation ─────────────────────────────────────────────────────────
// Rough heuristic: 4 characters ≈ 1 token. This is a pragmatic estimate that
// matches the approach used in workspace-context.ts estimateTokens().

/** Estimate token count from a string (4 chars ≈ 1 token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Estimate the total token cost of rendering a project file in the prompt.
 *  Format: "### FILE: path\n```lang\ncontent\n```" */
export function estimateFileTokens(file: ProjectFile): number {
  const overhead = `### FILE: ${file.path}\n\`\`\`${file.language ?? "typescript"}\n\`\`\``;
  return estimateTokens(overhead + file.content);
}

// ─── File ranking ─────────────────────────────────────────────────────────────

/**
 * Assign priority tiers to files based on workspace intelligence.
 * Within each tier, smaller files come first (more signal per token).
 */
export function rankFiles(
  allFiles: ProjectFile[],
  context?: WorkspaceContext,
  selectedFilePaths?: string[],
): RankedFile[] {
  const selectedSet = new Set(selectedFilePaths ?? []);
  const relatedSet  = new Set(context?.relatedFiles ?? []);
  const entryPoints = context?.entryPoints ?? [];
  const entrySet    = new Set(entryPoints);

  const ranked: RankedFile[] = [];

  for (const file of allFiles) {
    let tierLabel: string;
    let priority: number;

    if (selectedSet.has(file.path)) {
      tierLabel = "selected";
      priority = PRIORITY_TIER.selected;
    } else if (relatedSet.has(file.path)) {
      tierLabel = "related";
      priority = PRIORITY_TIER.related;
    } else if (entrySet.has(file.path)) {
      tierLabel = "entryPoint";
      priority = PRIORITY_TIER.entryPoint;
    } else if (LAYOUT_PATTERNS.some((re) => re.test(file.path))) {
      tierLabel = "layout";
      priority = PRIORITY_TIER.layout;
    } else {
      tierLabel = "other";
      priority = PRIORITY_TIER.other;
    }

    ranked.push({ file, priority, tierLabel });
  }

  // Sort by priority (ascending), then by content length (ascending) within same tier
  ranked.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.file.content.length - b.file.content.length;
  });

  return ranked;
}

// ─── File summarization ───────────────────────────────────────────────────────

/** Default max lines of content to keep when summarizing (before truncation). */
const SUMMARY_KEEP_TOP_LINES = 40;
const SUMMARY_KEEP_BOTTOM_LINES = 15;
/** Files smaller than this are never summarized. */
const SUMMARY_MIN_CHARS = 800;

/**
 * Summarize an oversized file — keep imports, first N meaningful lines, and
 * last N lines (usually closing braces / exports). Adds a summary marker.
 */
export function summarizeFileContent(file: ProjectFile): SummarizedFile {
  const lines = file.content.split("\n");
  const originalLineCount = lines.length;

  if (file.content.length <= SUMMARY_MIN_CHARS || lines.length <= SUMMARY_KEEP_TOP_LINES + SUMMARY_KEEP_BOTTOM_LINES + 5) {
    return {
      originalPath: file.path,
      originalLineCount,
      summary: file.content,
      isSummarized: false,
    };
  }

  const topLines = lines.slice(0, SUMMARY_KEEP_TOP_LINES);
  const bottomLines = lines.slice(-SUMMARY_KEEP_BOTTOM_LINES);
  const omittedCount = lines.length - SUMMARY_KEEP_TOP_LINES - SUMMARY_KEEP_BOTTOM_LINES;

  const summary = [
    ...topLines,
    `// ── [${omittedCount} lines omitted by ContextBudgetManager — file has ${lines.length} lines total] ──`,
    ...bottomLines,
  ].join("\n");

  return {
    originalPath: file.path,
    originalLineCount,
    summary,
    isSummarized: true,
  };
}

// ─── Budget-aware selection ───────────────────────────────────────────────────

/**
 * Select files within the available token budget, ranking by importance and
 * summarizing oversized files when needed.
 *
 * @param allFiles - All project files
 * @param context - WorkspaceContext with intelligence data
 * @param selectedFilePaths - User-selected file paths (focus)
 * @param config - Budget configuration (optional, uses defaults)
 * @returns BudgetSelectionResult with the selected files and usage stats
 */
export function selectFilesWithinBudget(
  allFiles: ProjectFile[],
  context?: WorkspaceContext,
  selectedFilePaths?: string[],
  config: ContextBudgetConfig = DEFAULT_BUDGET_CONFIG,
): BudgetSelectionResult {
  const availableFileTokens =
    config.maxTokens - config.reservedPromptTokens - config.reservedOutputTokens;

  const ranked = rankFiles(allFiles, context, selectedFilePaths);

  const result: Array<{ file: ProjectFile; summarized?: SummarizedFile }> = [];
  let usedFileTokens = 0;
  let summarizedCount = 0;
  let omittedCount = 0;
  let allFitUnsummarized = true;

  for (const { file } of ranked) {
    const fileTokens = estimateFileTokens(file);

    // Check if the file itself fits within remaining budget
    if (usedFileTokens + fileTokens <= availableFileTokens) {
      // File fits with full content
      result.push({ file });
      usedFileTokens += fileTokens;
      continue;
    }

    // File doesn't fit — try summarizing it
    const summarized = summarizeFileContent(file);
    if (summarized.isSummarized) {
      const summarizedTokens = estimateTokens(
        `### FILE: ${file.path}\n\`\`\`${file.language ?? "typescript"}\n${summarized.summary}\n\`\`\``,
      );

      if (usedFileTokens + summarizedTokens <= availableFileTokens) {
        // Summarized version fits
        result.push({ file, summarized });
        usedFileTokens += summarizedTokens;
        summarizedCount++;
        allFitUnsummarized = false;
        continue;
      }
    }

    // Even summarized version doesn't fit — omit
    omittedCount++;
    allFitUnsummarized = false;
  }

  return {
    files: result,
    usedFileTokens,
    availableFileTokens,
    summarizedCount,
    omittedCount,
    allFitUnsummarized,
  };
}

// ─── Convenience: build file section string from selection result ─────────────

/**
 * Convert a BudgetSelectionResult into the formatted file section string
 * ready to embed in the user prompt.
 */
export function formatFileSection(selection: BudgetSelectionResult): string {
  return selection.files
    .map((entry) => {
      const content = entry.summarized ? entry.summarized.summary : entry.file.content;
      return `### FILE: ${entry.file.path}\n\`\`\`${entry.file.language ?? "typescript"}\n${content}\n\`\`\``;
    })
    .join("\n\n");
}
