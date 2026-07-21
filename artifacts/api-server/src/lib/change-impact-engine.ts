// ─── Change Impact Engine — Analyze File Change Impact ──────────────────────
// Phase 13.8
//
// Given a set of changed files and the live workspace context, determines the
// blast radius of changes: which routes, layouts, components, imports, and
// pending tasks are affected. Produces a validation priority and impact score.

import type { WorkspaceContext } from "./workspace-context";
import type { WorkspaceSnapshot } from "./workspace-observer";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ValidationPriority = "low" | "medium" | "high";

export interface ChangeImpact {
  /** Routes affected by the change. */
  affectedRoutes: string[];
  /** Layouts affected by the change. */
  affectedLayouts: string[];
  /** Components affected by the change. */
  affectedComponents: string[];
  /** Import relationships affected by the change. */
  affectedImports: string[];
  /** Pending task IDs that may need reprioritization. */
  affectedTasks: string[];
  /** Recommended validation priority. */
  validationPriority: ValidationPriority;
  /** Overall impact score (0-100). */
  impactScore: number;
  /** Human-readable summary of the impact. */
  summary: string;
}

// ─── Impact Analysis ─────────────────────────────────────────────────────────

/**
 * Analyze the impact of file changes on the workspace.
 *
 * Uses the live workspace context to trace:
 * - Which routes own or reference the changed files
 * - Which layouts include or import the changed files
 * - Which components consume or are consumed by the changed files
 * - Which import relationships are affected
 * - Which pending tasks touch the changed files
 */
export function analyzeChangeImpact(
  changedFiles: string[],
  workspaceContext: WorkspaceContext,
  snapshot: WorkspaceSnapshot,
  pendingTaskFiles?: string[][],
): ChangeImpact {
  const start = Date.now();

  const affectedRoutes = findAffectedRoutes(changedFiles, workspaceContext);
  const affectedLayouts = findAffectedLayouts(changedFiles, workspaceContext);
  const affectedComponents = findAffectedComponents(changedFiles, workspaceContext);
  const affectedImports = findAffectedImports(changedFiles, workspaceContext);
  const affectedTasks = findAffectedTasks(changedFiles, pendingTaskFiles);

  const impactScore = computeImpactScore(
    affectedRoutes.length,
    affectedLayouts.length,
    affectedComponents.length,
    affectedImports.length,
  );

  const validationPriority = determineValidationPriority(
    impactScore,
    affectedLayouts.length,
    affectedRoutes.length,
  );

  const summary = buildImpactSummary(
    changedFiles,
    affectedRoutes,
    affectedLayouts,
    affectedComponents,
    validationPriority,
  );

  logger.info(
    {
      changedFiles: changedFiles.length,
      affectedRoutes: affectedRoutes.length,
      affectedLayouts: affectedLayouts.length,
      affectedComponents: affectedComponents.length,
      impactScore,
      validationPriority,
      analysisTimeMs: Date.now() - start,
    },
    `[change-impact] ${summary}`,
  );

  return {
    affectedRoutes,
    affectedLayouts,
    affectedComponents,
    affectedImports,
    affectedTasks,
    validationPriority,
    impactScore,
    summary,
  };
}

// ─── Route Impact ────────────────────────────────────────────────────────────

function findAffectedRoutes(
  changedFiles: string[],
  ctx: WorkspaceContext,
): string[] {
  const affected = new Set<string>();

  if (!ctx.routeTree) return [];

  // Walk the route tree to find routes that reference changed files
  function walkRoutes(nodes: import("./workspace-context").RouteNode[]): void {
    for (const node of nodes) {
      const nodeFiles = [
        node.pageFile,
        node.layoutFile,
        node.loadingFile,
        node.errorFile,
        node.routeHandlerFile,
      ].filter(Boolean) as string[];

      const matches = nodeFiles.some((f) =>
        changedFiles.some((cf) => f.includes(cf) || cf.includes(f)),
      );

      if (matches) {
        affected.add(node.path);
      }

      if (node.children) {
        walkRoutes(node.children);
      }
    }
  }

  walkRoutes(ctx.routeTree);

  // Also check layout hierarchy
  if (ctx.layoutHierarchy) {
    for (const layout of ctx.layoutHierarchy) {
      const matches = changedFiles.some((cf) => layout.layoutFile.includes(cf));
      if (matches) {
        affected.add(layout.segment);
      }
    }
  }

  return Array.from(affected);
}

// ─── Layout Impact ───────────────────────────────────────────────────────────

function findAffectedLayouts(
  changedFiles: string[],
  ctx: WorkspaceContext,
): string[] {
  const affected = new Set<string>();

  if (ctx.layoutHierarchy) {
    for (const layout of ctx.layoutHierarchy) {
      const matches = changedFiles.some((cf) => layout.layoutFile.includes(cf));
      if (matches) {
        affected.add(layout.layoutFile);
      }
    }
  }

  // Check entry points
  if (ctx.entryPoints) {
    for (const ep of ctx.entryPoints) {
      const matches = changedFiles.some((cf) => ep.includes(cf));
      if (matches) {
        affected.add(ep);
      }
    }
  }

  return Array.from(affected);
}

// ─── Component Impact ────────────────────────────────────────────────────────

function findAffectedComponents(
  changedFiles: string[],
  ctx: WorkspaceContext,
): string[] {
  const affected = new Set<string>();

  // Check component index
  if (ctx.componentIndex) {
    for (const comp of ctx.componentIndex) {
      const fileMatches = changedFiles.some((cf) => comp.filePath.includes(cf));
      if (fileMatches) {
        affected.add(comp.name);
      }
    }
  }

  // Check component usage (consumers of changed components)
  if (ctx.componentUsage) {
    for (const [component, consumers] of Object.entries(ctx.componentUsage)) {
      const componentFileMatches = changedFiles.some((cf) =>
        consumers.some((c) => c.includes(cf)),
      );
      if (componentFileMatches) {
        affected.add(component);
      }
    }
  }

  return Array.from(affected);
}

// ─── Import Impact ───────────────────────────────────────────────────────────

function findAffectedImports(
  changedFiles: string[],
  ctx: WorkspaceContext,
): string[] {
  const affected = new Set<string>();

  if (!ctx.importGraph) return [];

  for (const [filePath, imports] of Object.entries(ctx.importGraph)) {
    for (const imp of imports) {
      const resolvedPath = imp.resolvedPath;
      if (resolvedPath) {
        const matches = changedFiles.some((cf) => resolvedPath.includes(cf));
        if (matches) {
          affected.add(`${filePath} → ${imp.source}`);
        }
      }
    }
  }

  return Array.from(affected);
}

// ─── Task Impact ─────────────────────────────────────────────────────────────

function findAffectedTasks(
  changedFiles: string[],
  pendingTaskFiles?: string[][],
): string[] {
  if (!pendingTaskFiles) return [];

  const affected: string[] = [];

  for (let i = 0; i < pendingTaskFiles.length; i++) {
    const taskFiles = pendingTaskFiles[i];
    const overlaps = taskFiles.some((tf) =>
      changedFiles.some((cf) => tf.includes(cf) || cf.includes(tf)),
    );
    if (overlaps) {
      affected.push(`task_${i}`);
    }
  }

  return affected;
}

// ─── Scoring ─────────────────────────────────────────────────────────────────

function computeImpactScore(
  routeCount: number,
  layoutCount: number,
  componentCount: number,
  importCount: number,
): number {
  let score = 0;

  // Routes: each affected route adds significant weight
  score += routeCount * 15;

  // Layouts: layouts affect many pages
  score += layoutCount * 20;

  // Components: each affected component adds moderate weight
  score += componentCount * 5;

  // Imports: each broken import adds weight
  score += importCount * 3;

  // Cap at 100
  return Math.min(100, score);
}

function determineValidationPriority(
  impactScore: number,
  layoutCount: number,
  routeCount: number,
): ValidationPriority {
  if (impactScore >= 60 || layoutCount > 0 || routeCount > 3) {
    return "high";
  }
  if (impactScore >= 30 || routeCount > 0) {
    return "medium";
  }
  return "low";
}

// ─── Summary ─────────────────────────────────────────────────────────────────

function buildImpactSummary(
  changedFiles: string[],
  affectedRoutes: string[],
  affectedLayouts: string[],
  affectedComponents: string[],
  priority: ValidationPriority,
): string {
  const parts: string[] = [];

  if (affectedRoutes.length > 0) {
    parts.push(`${affectedRoutes.length} route(s)`);
  }
  if (affectedLayouts.length > 0) {
    parts.push(`${affectedLayouts.length} layout(s)`);
  }
  if (affectedComponents.length > 0) {
    parts.push(`${affectedComponents.length} component(s)`);
  }

  const detail = parts.length > 0 ? ` affecting ${parts.join(", ")}` : "";
  return `Changed ${changedFiles.length} file(s)${detail} — ${priority} priority validation`;
}
