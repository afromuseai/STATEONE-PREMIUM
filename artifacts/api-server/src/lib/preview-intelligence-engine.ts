// ─── Preview Intelligence Engine — Visual/Runtime Feedback for Edits ────────
// Phase 14.3
//
// After file changes are validated, the preview intelligence engine inspects the
// runtime preview state, detects visual and runtime issues, and feeds findings
// into the confidence engine, learning loop, and specialist memories.
//
// The editing agent uses this feedback to self-correct before the user sees
// a broken preview.

import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VisualIssue {
  type:
    | "overflow"
    | "missing-content"
    | "spacing"
    | "alignment"
    | "responsive"
    | "asset";
  severity: "low" | "medium" | "high";
  description: string;
  affectedFiles: string[];
}

export type PreviewStatus = "healthy" | "warning" | "failed";

export interface PreviewState {
  /** Overall preview health status. */
  status: PreviewStatus;
  /** URL of the preview if available. */
  url?: string;
  /** Runtime JavaScript errors detected in the preview. */
  runtimeErrors: string[];
  /** Console errors (warnings, assertions, logs) from the preview. */
  consoleErrors: string[];
  /** Assets referenced but not found in the project files. */
  missingAssets: string[];
  /** Routes that failed to render. */
  brokenRoutes: string[];
  /** Visual layout/design issues detected. */
  visualIssues: VisualIssue[];
  /** When the preview was last checked (ISO string). */
  lastChecked: string;
}

export interface PreviewReport {
  /** Full preview state snapshot. */
  state: PreviewState;
  /** Synthesized health score 0–100. */
  healthScore: number;
  /** Whether the preview has blocking issues requiring a repair pass. */
  needsRepair: boolean;
  /** Human-readable summary of findings. */
  summary: string;
  /** Suggested repair instruction for the editing agent. */
  repairInstruction?: string;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface PreviewTelemetry {
  previewChecks: number;
  previewFailures: number;
  runtimeErrorCount: number;
  visualIssueCount: number;
  previewRepairAttempts: number;
  previewHealthScore: number;
}

let telemetry: PreviewTelemetry = {
  previewChecks: 0,
  previewFailures: 0,
  runtimeErrorCount: 0,
  visualIssueCount: 0,
  previewRepairAttempts: 0,
  previewHealthScore: 100,
};

export function getPreviewTelemetry(): PreviewTelemetry {
  return { ...telemetry };
}

export function resetPreviewTelemetry(): void {
  telemetry = {
    previewChecks: 0,
    previewFailures: 0,
    runtimeErrorCount: 0,
    visualIssueCount: 0,
    previewRepairAttempts: 0,
    previewHealthScore: 100,
  };
}

// ─── Analysis Functions ──────────────────────────────────────────────────────

/**
 * Analyze the project files for potential preview/runtime issues.
 *
 * Since we don't have a live browser runtime server-side, we perform static
 * analysis on the changed files to detect common preview failure patterns:
 *
 *   - Missing asset references (images, fonts, icons)
 *   - Broken import paths
 *   - Hydration-incompatible patterns (window usage, browser-only APIs)
 *   - Layout overflow patterns (fixed dimensions without overflow handling)
 *   - Console.warn/console.error calls left in code
 *   - Route file structure inconsistencies
 *   - Missing or broken CSS class references
 */
export function analyzePreviewState(
  changedFiles: Array<{ path: string; content: string; operation: string }>,
  allFiles: Array<{ path: string; content?: string }>,
  projectFramework?: string,
): PreviewReport {
  telemetry.previewChecks++;
  const start = Date.now();

  const runtimeErrors: string[] = [];
  const consoleErrors: string[] = [];
  const missingAssets: string[] = [];
  const brokenRoutes: string[] = [];
  const visualIssues: VisualIssue[] = [];

  // ── 1. Detect runtime error patterns ─────────────────────────────────────
  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;

    // Detect browser-only API usage that will crash at build time
    if (/\bwindow\b/.test(content) && !/\bif\s*\(\s*typeof\s+window\s*[!=]==?\s*['"]undefined['"]\s*\)/.test(content)) {
      runtimeErrors.push(`Unsafe \`window\` reference in ${file.path} — will crash during SSR/hydration`);
    }
    if (/\bdocument\b/.test(content) && !/\bif\s*\(\s*typeof\s+document\s*[!=]==?\s*['"]undefined['"]\s*\)/.test(content)) {
      runtimeErrors.push(`Unsafe \`document\` reference in ${file.path} — will crash during SSR/hydration`);
    }
    if (/localStorage/.test(content) && !/\bif\s*\(\s*typeof\s+(localStorage|window)\s*[!=]==?\s*['"]undefined['"]\s*\)/.test(content)) {
      runtimeErrors.push(`Unsafe \`localStorage\` reference in ${file.path} — will crash during SSR`);
    }

    // Detect missing React key props in mapped elements (hydration warnings)
    const mapPattern = /\.map\(/g;
    let mapMatch;
    while ((mapMatch = mapPattern.exec(content)) !== null) {
      const snippet = content.slice(mapMatch.index, mapMatch.index + 200);
      // If map returns JSX but has no "key=" in the next 200 chars, flag it
      if (/return\s*\(?\s*</.test(snippet) && !/key=/.test(snippet.slice(0, 100))) {
        consoleErrors.push(`Missing \`key\` prop in .map() in ${file.path} — will cause hydration warnings`);
        break;
      }
    }

    // Detect console.(error|warn) calls left in code
    const consoleCallPattern = /console\.(error|warn)\s*\(/g;
    let consoleMatch;
    while ((consoleMatch = consoleCallPattern.exec(content)) !== null) {
      // Skip if it's inside a commented line
      const lineStart = content.lastIndexOf("\n", consoleMatch.index) + 1;
      const line = content.slice(lineStart, content.indexOf("\n", consoleMatch.index)).trim();
      if (!line.startsWith("//") && !line.startsWith("*")) {
        consoleErrors.push(`\`console.${consoleMatch[1]}\` call in ${file.path}:${content.slice(0, consoleMatch.index).split("\n").length}`);
      }
    }
  }

  // ── 2. Detect missing assets ─────────────────────────────────────────────
  const allFilePaths = new Set(allFiles.map((f) => f.path));
  const assetExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm", ".pdf"]);

  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;

    // Detect asset imports/references that don't resolve to any project file
    const assetRefPattern = /(?:import\s+(?:[\w*{}\s,]+\s+from\s+)?['"])([^'"]+\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf|eot|mp4|webm|pdf))['"]/g;
    let assetMatch;
    while ((assetMatch = assetRefPattern.exec(content)) !== null) {
      const assetPath = assetMatch[1];
      // Resolve relative to file's directory
      const resolved = resolveAssetPath(file.path, assetPath);
      if (resolved && !allFilePaths.has(resolved)) {
        missingAssets.push(resolved);
      }
    }

    // Detect src/href pointing to non-existent files
    const urlPattern = /(?:src|href)\s*=\s*["']([^"']+)["']/g;
    let urlMatch;
    while ((urlMatch = urlPattern.exec(content)) !== null) {
      const url = urlMatch[1];
      if (url.startsWith("./") || url.startsWith("../")) {
        const resolved = resolveAssetPath(file.path, url);
        if (resolved && !allFilePaths.has(resolved) && !resolved.startsWith("http")) {
          // It's a local reference that doesn't exist
          const ext = url.split(".").pop()?.toLowerCase();
          if (ext && assetExtensions.has(`.${ext}`)) {
            if (!missingAssets.includes(resolved)) {
              missingAssets.push(resolved);
            }
          }
        }
      }
    }
  }

  // ── 3. Detect broken routes ──────────────────────────────────────────────
  // Check if page/layout files referenced in route structure exist
  const routePatterns = [/app\/.*\/page\.(tsx|jsx|js|ts)/, /pages\/.*\.(tsx|jsx|js|ts)/];
  const existingRoutes = allFiles.filter((f) => routePatterns.some((p) => p.test(f.path))).map((f) => f.path);

  for (const file of changedFiles) {
    if (file.operation === "delete") {
      // If a page file was deleted, mark its route as broken
      if (routePatterns.some((p) => p.test(file.path))) {
        brokenRoutes.push(file.path);
      }
      continue;
    }

    const content = file.content;

    // Detect Link/Link href pointing to non-existent routes
    const linkPattern = /(?:Link|href)\s*=\s*["'](\/[^"']+)["']/g;
    let linkMatch;
    while ((linkMatch = linkPattern.exec(content)) !== null) {
      const href = linkMatch[1];
      // Check if the route exists
      const routeFile = findRouteFile(href, existingRoutes);
      if (!routeFile && !href.startsWith("http") && !href.startsWith("#") && !href.startsWith("mailto:")) {
        brokenRoutes.push(href);
      }
    }

    // Detect dynamic import() with potentially broken paths
    const dynamicImportPattern = /import\(['"]([^'"]+)['"]\)/g;
    let importMatch;
    while ((importMatch = dynamicImportPattern.exec(content)) !== null) {
      const importPath = importMatch[1];
      if (importPath.startsWith("./") || importPath.startsWith("../")) {
        const resolved = resolveAssetPath(file.path, importPath);
        if (resolved && !allFilePaths.has(resolved)) {
          runtimeErrors.push(`Broken dynamic import: \`${importPath}\` in ${file.path} — file not found`);
        }
      }
    }
  }

  // ── 4. Detect visual/layout issues ───────────────────────────────────────
  for (const file of changedFiles) {
    if (file.operation === "delete") continue;
    const content = file.content;
    const path = file.path;

    // Detect fixed-width containers without overflow handling (overflow risk)
    if (/\bwidth\s*:\s*\d+px\b/.test(content) && !/overflow/.test(content)) {
      visualIssues.push({
        type: "overflow",
        severity: "medium",
        description: `Fixed-width container in ${path} without overflow handling — may break on smaller screens`,
        affectedFiles: [path],
      });
    }

    // Detect inline styles with hardcoded dimensions
    if (/style\s*=\s*\{\s*\{[^}]*width\s*:\s*\d+[^}]*\}/.test(content) && !/maxWidth|minWidth|overflow/.test(content)) {
      visualIssues.push({
        type: "responsive",
        severity: "medium",
        description: `Inline style with hardcoded width in ${path} — may not be responsive`,
        affectedFiles: [path],
      });
    }

    // Detect empty sections or components that might indicate missing content
    if (/<div\s*>\s*<\/div>/.test(content) || /<section\s*>\s*<\/section>/.test(content)) {
      visualIssues.push({
        type: "missing-content",
        severity: "low",
        description: `Empty container element in ${path} — may indicate missing content`,
        affectedFiles: [path],
      });
    }

    // Detect excessive margin/padding values that could cause spacing issues
    const spacingMatch = content.match(/(margin|padding)\s*:\s*\d{3,}px/g);
    if (spacingMatch) {
      visualIssues.push({
        type: "spacing",
        severity: "low",
        description: `Large ${spacingMatch[0]} in ${path} — may cause unexpected spacing`,
        affectedFiles: [path],
      });
    }

    // Detect text in elements without a container width (alignment risk)
    if (/<p[^>]*>|<\/?h[1-6][^>]*>/.test(content)) {
      const textContent = content.replace(/<[^>]*>/g, "").trim();
      if (textContent.length > 200 && !/className.*max-w/.test(content)) {
        visualIssues.push({
          type: "alignment",
          severity: "low",
          description: `Long text content in ${path} without width constraint — may cause alignment issues`,
          affectedFiles: [path],
        });
      }
    }
  }

  // ── Deduplicate ──────────────────────────────────────────────────────────
  const uniqueRuntimeErrors = [...new Set(runtimeErrors)];
  const uniqueConsoleErrors = [...new Set(consoleErrors)];
  const uniqueMissingAssets = [...new Set(missingAssets)];
  const uniqueBrokenRoutes = [...new Set(brokenRoutes)];
  const uniqueVisualIssues = visualIssues.filter(
    (v, i, arr) => arr.findIndex((x) => x.description === v.description) === i,
  );

  // ── Compute health score ─────────────────────────────────────────────────
  const healthScore = computePreviewHealthScore({
    runtimeErrorCount: uniqueRuntimeErrors.length,
    consoleErrorCount: uniqueConsoleErrors.length,
    missingAssetCount: uniqueMissingAssets.length,
    brokenRouteCount: uniqueBrokenRoutes.length,
    visualIssueCount: uniqueVisualIssues.length,
  });

  // ── Determine status ─────────────────────────────────────────────────────
  let status: PreviewStatus = "healthy";
  if (uniqueRuntimeErrors.length > 0 || uniqueBrokenRoutes.length > 0) {
    status = "failed";
  } else if (uniqueConsoleErrors.length > 0 || uniqueMissingAssets.length > 0 || uniqueVisualIssues.length > 0) {
    status = "warning";
  }

  // ── Build summary ────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (uniqueRuntimeErrors.length > 0) parts.push(`${uniqueRuntimeErrors.length} runtime error(s)`);
  if (uniqueConsoleErrors.length > 0) parts.push(`${uniqueConsoleErrors.length} console warning(s)`);
  if (uniqueMissingAssets.length > 0) parts.push(`${uniqueMissingAssets.length} missing asset(s)`);
  if (uniqueBrokenRoutes.length > 0) parts.push(`${uniqueBrokenRoutes.length} broken route(s)`);
  if (uniqueVisualIssues.length > 0) parts.push(`${uniqueVisualIssues.length} visual issue(s)`);

  const summary = parts.length > 0
    ? `Preview issues detected: ${parts.join(", ")}`
    : "Preview looks healthy";

  // ── Build repair instruction if needed ───────────────────────────────────
  const needsRepair = status === "failed" || (status === "warning" && uniqueMissingAssets.length > 0);
  let repairInstruction: string | undefined;

  if (needsRepair) {
    const steps: string[] = [];
    if (uniqueRuntimeErrors.length > 0) {
      steps.push(`Fix runtime errors: ${uniqueRuntimeErrors.map((e) => `• ${e}`).join("\n")}`);
    }
    if (uniqueConsoleErrors.length > 0) {
      steps.push(`Remove console calls: ${uniqueConsoleErrors.map((e) => `• ${e}`).join("\n")}`);
    }
    if (uniqueMissingAssets.length > 0) {
      steps.push(`Add missing assets or fix references: ${uniqueMissingAssets.join(", ")}`);
    }
    if (uniqueBrokenRoutes.length > 0) {
      steps.push(`Fix broken routes: ${uniqueBrokenRoutes.join(", ")}`);
    }
    if (uniqueVisualIssues.length > 0) {
      const high = uniqueVisualIssues.filter((v) => v.severity === "high");
      if (high.length > 0) {
        steps.push(`Fix visual issues: ${high.map((v) => `• ${v.description}`).join("\n")}`);
      }
    }
    repairInstruction = `Fix preview issues:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }

  // ── Update telemetry ─────────────────────────────────────────────────────
  telemetry.runtimeErrorCount += uniqueRuntimeErrors.length;
  telemetry.visualIssueCount += uniqueVisualIssues.length;
  if (status !== "healthy") telemetry.previewFailures++;
  telemetry.previewHealthScore = healthScore;

  const durationMs = Date.now() - start;
  logger.info(
    { status, healthScore, runtimeErrors: uniqueRuntimeErrors.length, visualIssues: uniqueVisualIssues.length, durationMs },
    "[preview-intel] Preview analysis complete",
  );

  return {
    state: {
      status,
      runtimeErrors: uniqueRuntimeErrors,
      consoleErrors: uniqueConsoleErrors,
      missingAssets: uniqueMissingAssets,
      brokenRoutes: uniqueBrokenRoutes,
      visualIssues: uniqueVisualIssues,
      lastChecked: new Date().toISOString(),
    },
    healthScore,
    needsRepair,
    summary,
    repairInstruction,
  };
}

// ─── Health Score Computation ────────────────────────────────────────────────

export function computePreviewHealthScore(params: {
  runtimeErrorCount: number;
  consoleErrorCount: number;
  missingAssetCount: number;
  brokenRouteCount: number;
  visualIssueCount: number;
}): number {
  // Start at 100, deduct for each issue category
  let score = 100;

  // Runtime errors are most severe
  score -= params.runtimeErrorCount * 25;
  // Broken routes are very severe
  score -= params.brokenRouteCount * 20;
  // Missing assets
  score -= params.missingAssetCount * 10;
  // Console errors
  score -= params.consoleErrorCount * 5;
  // Visual issues
  score -= Math.min(params.visualIssueCount * 5, 20);

  return Math.max(0, Math.min(100, score));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a relative asset path against the file's own directory.
 */
function resolveAssetPath(filePath: string, assetPath: string): string | null {
  if (!assetPath.startsWith(".")) {
    // Absolute path within the project
    return assetPath.startsWith("/") ? assetPath.slice(1) : assetPath;
  }

  const parts = filePath.split("/");
  const dir = parts.slice(0, -1);
  const assetParts = assetPath.split("/");

  for (const part of assetParts) {
    if (part === ".") continue;
    if (part === "..") {
      if (dir.length > 0) dir.pop();
    } else {
      dir.push(part);
    }
  }

  return dir.join("/");
}

/**
 * Find a route file matching a given href path.
 */
function findRouteFile(href: string, existingRoutes: string[]): string | undefined {
  // Normalize the href
  const normalized = href.replace(/\/$/, "") || "/";

  // Exact match
  const exact = existingRoutes.find((r) => {
    const routePath = r
      .replace(/^app\//, "/")
      .replace(/^pages\//, "/")
      .replace(/\/page\.(tsx|jsx|js|ts)$/, "")
      .replace(/\.(tsx|jsx|js|ts)$/, "");
    return (routePath || "/") === normalized;
  });
  if (exact) return exact;

  // Index route match
  const indexMatch = existingRoutes.find((r) => {
    const routePath = r
      .replace(/^app\//, "/")
      .replace(/\/page\.(tsx|jsx|js|ts)$/, "/");
    return routePath === normalized + "/";
  });
  if (indexMatch) return indexMatch;

  return undefined;
}

/**
 * Generate a suggested repair prompt for the editing agent.
 */
export function buildPreviewRepairPrompt(report: PreviewReport): string {
  if (!report.needsRepair || !report.repairInstruction) return "";

  return `## Preview Intelligence

Status: ${report.state.status.toUpperCase()}
Runtime Errors: ${report.state.runtimeErrors.length}
Visual Issues: ${report.state.visualIssues.length}
Health Score: ${report.healthScore}/100

${report.repairInstruction}`;
}
