// ─── Execution Planning Engine — Pre-Edit Planning ──────────────────────────
// Phase 13.4
//
// Before the AI edits code, this engine constructs an explicit execution plan
// describing what needs to change, why, and what the risks are. The plan is
// injected into the editor prompt so the model has a structured understanding
// of the task before generating code.
//
// After the edit, actual results are compared against the plan to compute
// planning accuracy metrics.

import type { WorkspaceContext, RouteNode } from "./workspace-context";
import type { ProjectMemory } from "./project-memory-engine";
import { logger } from "./logger";

// ─── Plan Schema ──────────────────────────────────────────────────────────────

export type Complexity = "low" | "medium" | "high";
export type Strategy = "single-file" | "multi-file" | "refactor" | "architecture";

export interface ExecutionPlan {
  /** One-sentence summary of what the edit intends to achieve. */
  objective: string;

  /** Estimated complexity of the change. */
  complexity: Complexity;

  /** The edit strategy chosen based on the scope of the change. */
  strategy: Strategy;

  /** Files the plan expects to modify. */
  filesToModify: string[];

  /** Files the plan expects to read for context (may overlap with modify). */
  filesToRead: string[];

  /** Dependencies that may be affected by the change. */
  dependenciesAffected: string[];

  /** Potential risks identified before editing. */
  risks: string[];

  /** Validation steps to run after the edit. */
  validationSteps: string[];

  /** Reasoning trace explaining how the plan was formed. */
  reasoning: string[];
}

// ─── Strategy Selection ──────────────────────────────────────────────────────
// Determines the appropriate edit strategy based on instruction + context.

const SINGLE_FILE_PATTERNS = [
  /change (color|font|size|padding|margin)/i,
  /update (text|label|copy|content)/i,
  /fix (typo|spelling|wording)/i,
  /(bump|increase|decrease) (size|padding|margin|gap)/i,
  /change (background|bg|border)/i,
  /update (style|class|className)/i,
];

const REFACTOR_PATTERNS = [
  /rename (component|file|function|variable)/i,
  /extract (component|hook|function|utility)/i,
  /refactor/i,
  /split (component|file|function)/i,
  /reorganize/i,
  /move (component|file|function)/i,
];

const ARCHITECTURE_PATTERNS = [
  /add (auth|authentication|authorization)/i,
  /migrate (to|from)/i,
  /change (data.fetch|state management|routing)/i,
  /restructure/i,
  /redesign (architecture|data flow)/i,
  /replace (state management|data fetching|routing)/i,
  /add (middleware|interceptor|provider|context)/i,
];

const MULTI_FILE_INDICATORS = [
  /add (page|route|section|feature)/i,
  /create (component|section|page|layout)/i,
  /redesign (page|section|component|hero|header|footer|layout)/i,
  /implement (feature|section|page)/i,
  /update (layout|navigation|header|footer|sidebar)/i,
  /add (sidebar|navbar|footer|header|modal|dialog|form)/i,
  /responsive/i,
];

function selectStrategy(instruction: string, filesToModify: string[]): Strategy {
  // Architecture patterns take highest precedence
  for (const re of ARCHITECTURE_PATTERNS) {
    if (re.test(instruction)) return "architecture";
  }

  // Refactor patterns
  for (const re of REFACTOR_PATTERNS) {
    if (re.test(instruction)) return "refactor";
  }

  // If multiple files will be modified, it's multi-file
  if (filesToModify.length > 1) return "multi-file";

  // Single-file patterns
  for (const re of SINGLE_FILE_PATTERNS) {
    if (re.test(instruction)) return "single-file";
  }

  // Multi-file indicators
  for (const re of MULTI_FILE_INDICATORS) {
    if (re.test(instruction)) return "multi-file";
  }

  // Default: if only one file, single-file; otherwise multi-file
  return filesToModify.length <= 1 ? "single-file" : "multi-file";
}

// ─── Complexity Estimation ───────────────────────────────────────────────────

function estimateComplexity(
  strategy: Strategy,
  filesToModify: string[],
  risks: string[],
): Complexity {
  if (strategy === "architecture") return "high";

  if (strategy === "refactor") {
    return filesToModify.length > 3 ? "high" : "medium";
  }

  if (strategy === "multi-file") {
    if (filesToModify.length > 5) return "high";
    if (filesToModify.length > 2) return "medium";
    return "low";
  }

  // single-file
  if (risks.length > 2) return "medium";
  return "low";
}

// ─── Risk Detection ──────────────────────────────────────────────────────────

function detectRisks(
  filesToModify: string[],
  selectedFiles: string[],
  workspaceContext: WorkspaceContext | undefined,
): string[] {
  const risks: string[] = [];

  for (const file of filesToModify) {
    const lower = file.toLowerCase();

    // Shared/layout files affect many pages
    if (lower.includes("layout") || lower.includes("app/layout")) {
      risks.push("Global UI impact: editing a layout file affects all pages");
    }

    // Shared components
    if (lower.includes("components/ui/") || lower.includes("shared/")) {
      risks.push("Affects multiple consumers: editing a shared UI component");
    }

    // Navigation
    if (lower.includes("nav") || lower.includes("header") || lower.includes("sidebar")) {
      risks.push("Navigation regression: editing navigation affects user flow");
    }

    // Imports / config
    if (lower.includes(".json") || lower.includes("config")) {
      risks.push("Configuration change: may affect build or runtime behavior");
    }

    // Routing
    if (lower.includes("router") || lower.includes("route") || lower.includes("page.tsx")) {
      risks.push("Navigation regression: editing a route or page file");
    }

    // Global styles
    if (lower.includes("globals.css") || lower.includes("global")) {
      risks.push("Global style impact: changes may cascade to all pages");
    }

    // Type definitions
    if (lower.includes(".d.ts") || lower.includes("types")) {
      risks.push("Type definition change: may cause type errors in consumers");
    }
  }

  // Cross-cutting risks based on workspace context
  if (workspaceContext?.componentIndex) {
    // Check if any modified file is a component used by many others
    for (const file of filesToModify) {
      const consumers = workspaceContext.componentUsage?.[file];
      if (consumers && consumers.length > 2) {
        risks.push(`Component used by ${consumers.length} other files: ${file}`);
      }
    }
  }

  // Runtime dependency risks
  if (workspaceContext?.dependencies?.length) {
    for (const file of filesToModify) {
      if (file.includes("package.json")) {
        risks.push("Dependency change: may require install step");
      }
    }
  }

  // Deduplicate
  return [...new Set(risks)];
}

// ─── Validation Planning ─────────────────────────────────────────────────────

function planValidation(
  filesToModify: string[],
  workspaceContext: WorkspaceContext | undefined,
): string[] {
  const steps: string[] = [];

  // TypeScript validation
  if (workspaceContext?.availableValidators?.typescript) {
    steps.push("Run TypeScript compiler to check for type errors");
  }

  // ESLint
  if (workspaceContext?.availableValidators?.eslint) {
    steps.push("Run ESLint to check for code quality issues");
  }

  // Build validation
  if (workspaceContext?.availableValidators?.build) {
    steps.push("Run build to verify compilation");
  }

  // Preview verification (always available in the pipeline)
  steps.push("Verify preview renders correctly");

  // Specific checks based on files modified
  for (const file of filesToModify) {
    const lower = file.toLowerCase();

    if (lower.includes("layout") || lower.includes("app/layout")) {
      steps.push("Verify all routes inherit the updated layout");
    }

    if (lower.includes("page.tsx")) {
      steps.push("Verify the page renders with correct data");
    }

    if (lower.includes("api") || lower.includes("route.ts")) {
      steps.push("Verify API endpoints return correct responses");
    }

    if (lower.includes(".css") || lower.includes("style")) {
      steps.push("Verify styles apply correctly across breakpoints");
    }

    if (lower.includes("nav") || lower.includes("header")) {
      steps.push("Verify navigation links still work");
    }
  }

  // Import graph validation
  if (workspaceContext?.danglingImports?.length) {
    steps.push("Check import graph for unresolved imports in modified files");
  }

  return [...new Set(steps)];
}

// ─── Determine files to modify ───────────────────────────────────────────────
// Uses workspace intelligence to predict which files will need changes.

function determineFilesToModify(
  instruction: string,
  selectedFiles: string[],
  workspaceContext: WorkspaceContext | undefined,
): string[] {
  const predicted = new Set<string>();

  // Selected files are always candidates
  for (const f of selectedFiles) {
    predicted.add(f);
  }

  // Related files that match the instruction context
  if (workspaceContext?.relatedFiles) {
    const instr = instruction.toLowerCase();
    for (const relFile of workspaceContext.relatedFiles) {
      const lower = relFile.toLowerCase();
      // If instruction mentions a concept that matches the file name
      if (instr.includes(lower.replace(/\.(tsx|ts|js|jsx)$/, "").split("/").pop() ?? "")) {
        predicted.add(relFile);
      }
    }
  }

  // Component matching: if instruction mentions a component name
  if (workspaceContext?.componentIndex) {
    const instr = instruction.toLowerCase();
    for (const comp of workspaceContext.componentIndex) {
      if (instr.includes(comp.name.toLowerCase())) {
        predicted.add(comp.filePath);
      }
    }
  }

  // Route matching: if instruction mentions a route
  if (workspaceContext?.routeTree) {
    const instr = instruction.toLowerCase();
    const flatRoutes = flattenRoutes(workspaceContext.routeTree);
    for (const route of flatRoutes) {
      const routeName = route.path.split("/").filter(Boolean).pop() ?? "";
      if (instr.includes(routeName.toLowerCase()) && route.pageFile) {
        predicted.add(route.pageFile);
      }
    }
  }

  return [...predicted];
}

// ─── Dependencies affected ───────────────────────────────────────────────────

function determineDependenciesAffected(
  filesToModify: string[],
  workspaceContext: WorkspaceContext | undefined,
): string[] {
  const affected = new Set<string>();

  if (!workspaceContext?.importGraph) return [];

  for (const file of filesToModify) {
    const imports = workspaceContext.importGraph[file];
    if (imports) {
      for (const imp of imports) {
        if (imp.isExternal) {
          affected.add(imp.source);
        }
      }
    }
  }

  return [...affected];
}

// ─── Main planning function ──────────────────────────────────────────────────

export interface PlanningResult {
  plan: ExecutionPlan;
  planningTimeMs: number;
}

/**
 * Construct an execution plan for a given edit instruction.
 *
 * Uses workspace intelligence (selected files, import graph, component index,
 * route tree, project memory) to predict the scope of the change and identify
 * risks and required validation steps.
 */
export function planExecution(
  instruction: string,
  selectedFiles: string[],
  workspaceContext?: WorkspaceContext,
  projectMemories?: ProjectMemory[],
): PlanningResult {
  const start = Date.now();

  // ── Determine files to modify ──────────────────────────────────────────
  const filesToModify = determineFilesToModify(instruction, selectedFiles, workspaceContext);

  // ── Determine files to read ────────────────────────────────────────────
  // Includes selected files, related files, and any files mentioned in instruction
  const filesToRead = new Set<string>();
  for (const f of selectedFiles) filesToRead.add(f);
  for (const f of workspaceContext?.relatedFiles ?? []) filesToRead.add(f);

  // If no files were identified, fall back to selected files + entry points
  if (filesToModify.length === 0) {
    filesToModify.push(...selectedFiles);
    if (filesToModify.length === 0 && workspaceContext?.entryPoints?.length) {
      filesToModify.push(workspaceContext.entryPoints[0]);
    }
  }

  // ── Strategy selection ─────────────────────────────────────────────────
  const strategy = selectStrategy(instruction, filesToModify);

  // ── Risk detection ─────────────────────────────────────────────────────
  const risks = detectRisks(filesToModify, selectedFiles, workspaceContext);

  // ── Complexity estimation ──────────────────────────────────────────────
  const complexity = estimateComplexity(strategy, filesToModify, risks);

  // ── Dependencies affected ──────────────────────────────────────────────
  const dependenciesAffected = determineDependenciesAffected(filesToModify, workspaceContext);

  // ── Validation planning ────────────────────────────────────────────────
  const validationSteps = planValidation(filesToModify, workspaceContext);

  // ── Reasoning trace ────────────────────────────────────────────────────
  const reasoning: string[] = [];

  if (selectedFiles.length > 0) {
    reasoning.push(`User selected ${selectedFiles.length} file(s): ${selectedFiles.join(", ")}`);
  }

  if (workspaceContext?.relatedFiles?.length) {
    const overlap = filesToModify.filter((f) => workspaceContext.relatedFiles!.includes(f));
    if (overlap.length > 0) {
      reasoning.push(`${overlap.length} related file(s) match the instruction scope`);
    }
  }

  if (workspaceContext?.componentIndex) {
    const matchedComponents = workspaceContext.componentIndex.filter((c) =>
      filesToModify.includes(c.filePath),
    );
    if (matchedComponents.length > 0) {
      reasoning.push(`Detected ${matchedComponents.length} relevant component(s): ${matchedComponents.map((c) => c.name).join(", ")}`);
    }
  }

  if (projectMemories && projectMemories.length > 0) {
    const relevantMemories = projectMemories.filter((m) =>
      filesToModify.some((f) => f.toLowerCase().includes(m.title.toLowerCase())),
    );
    if (relevantMemories.length > 0) {
      reasoning.push(`${relevantMemories.length} project memory/memories are relevant to this edit`);
    }
  }

  if (risks.length > 0) {
    reasoning.push(`Identified ${risks.length} risk(s) to monitor`);
  }

  reasoning.push(`Selected ${strategy} strategy based on scope and instruction patterns`);

  // ── Objective ──────────────────────────────────────────────────────────
  const objective = buildObjective(instruction, filesToModify, strategy);

  const plan: ExecutionPlan = {
    objective,
    complexity,
    strategy,
    filesToModify,
    filesToRead: [...filesToRead],
    dependenciesAffected,
    risks,
    validationSteps,
    reasoning,
  };

  return {
    plan,
    planningTimeMs: Date.now() - start,
  };
}

// ─── Objective builder ───────────────────────────────────────────────────────

function buildObjective(instruction: string, filesToModify: string[], strategy: Strategy): string {
  const trimmed = instruction.length > 80 ? instruction.slice(0, 77) + "..." : instruction;
  const fileCount = filesToModify.length;
  const fileHint = fileCount > 0
    ? ` across ${fileCount} file(s)`
    : "";
  return `${trimmed}${fileHint} [${strategy}]`;
}

// ─── Format for prompt injection ─────────────────────────────────────────────

/**
 * Format an execution plan into a concise text block for the editor prompt.
 */
export function formatExecutionPlan(plan: ExecutionPlan): string {
  const lines: string[] = [
    "## Execution Plan",
    "",
    `Objective: ${plan.objective}`,
    `Complexity: ${plan.complexity}`,
    `Strategy: ${plan.strategy}`,
    "",
  ];

  if (plan.filesToModify.length > 0) {
    lines.push(`Files to modify (${plan.filesToModify.length}):`);
    for (const f of plan.filesToModify) {
      lines.push(`  - ${f}`);
    }
    lines.push("");
  } else {
    lines.push("Files to modify: (auto-detect — model should determine)");
    lines.push("");
  }

  if (plan.filesToRead.length > 0) {
    lines.push(`Files to read for context (${plan.filesToRead.length}):`);
    for (const f of plan.filesToRead) {
      lines.push(`  - ${f}`);
    }
    lines.push("");
  }

  if (plan.dependenciesAffected.length > 0) {
    lines.push("Dependencies affected:");
    for (const d of plan.dependenciesAffected) {
      lines.push(`  - ${d}`);
    }
    lines.push("");
  }

  if (plan.risks.length > 0) {
    lines.push(`Risks (${plan.risks.length}):`);
    for (const risk of plan.risks) {
      lines.push(`  - ⚠️ ${risk}`);
    }
    lines.push("");
  }

  lines.push("Validation steps:");
  for (const step of plan.validationSteps) {
    lines.push(`  - ${step}`);
  }
  lines.push("");

  if (plan.reasoning.length > 0) {
    lines.push("Planning reasoning:");
    for (const r of plan.reasoning) {
      lines.push(`  - ${r}`);
    }
  }

  return lines.join("\n");
}

// ─── Accuracy tracking ───────────────────────────────────────────────────────

export interface PlanningAccuracy {
  plannedFiles: string[];
  actualFiles: string[];
  precision: number;  // fraction of planned files that were actually modified
  recall: number;     // fraction of actual files that were planned
  f1Score: number;    // harmonic mean of precision and recall
}

/**
 * Compare a plan against the actual edit result to compute planning accuracy.
 * Called after a successful edit to improve planning metrics.
 */
export function computePlanningAccuracy(
  plan: ExecutionPlan,
  actualModifiedFiles: string[],
): PlanningAccuracy {
  const planned = new Set(plan.filesToModify);
  const actual = new Set(actualModifiedFiles);

  const truePositives = [...planned].filter((f) => actual.has(f)).length;
  const falsePositives = [...planned].filter((f) => !actual.has(f)).length;
  const falseNegatives = [...actual].filter((f) => !planned.has(f)).length;

  const precision = truePositives / (truePositives + falsePositives) || 0;
  const recall = truePositives / (truePositives + falseNegatives) || 0;
  const f1Score = precision + recall > 0
    ? 2 * (precision * recall) / (precision + recall)
    : 0;

  return {
    plannedFiles: [...planned],
    actualFiles: [...actual],
    precision: Math.round(precision * 1000) / 1000,
    recall: Math.round(recall * 1000) / 1000,
    f1Score: Math.round(f1Score * 1000) / 1000,
  };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function flattenRoutes(nodes: RouteNode[], prefix = ""): Array<{ path: string; pageFile: string | null }> {
  const result: Array<{ path: string; pageFile: string | null }> = [];
  for (const node of nodes) {
    const fullPath = prefix + node.path;
    result.push({ path: fullPath, pageFile: node.pageFile });
    if (node.children.length > 0) {
      result.push(...flattenRoutes(node.children, fullPath));
    }
  }
  return result;
}
