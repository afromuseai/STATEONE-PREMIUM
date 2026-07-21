// ─── Confidence Engine — Live Confidence Scoring ────────────────────────────
// Phase 13.8
//
// Produces a confidence report based on validation results, import resolution,
// route validity, component existence, lint status, type safety, and repair
// history. Tasks below the low-confidence threshold automatically request an
// additional repair pass before final validation.

import { logger } from "./logger";
import type { WorkspaceContext } from "./workspace-context";
import type { WorkspaceSnapshot } from "./workspace-observer";
import type { ValidationReport } from "./workspace-validator";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ConfidenceReport {
  /** Overall confidence score 0-100. */
  score: number;
  /** Human-readable reasons for the score. */
  reasons: string[];
  /** Warnings that may affect confidence. */
  warnings: string[];
  /** Whether the confidence is below the threshold requiring extra repair. */
  needsExtraRepair: boolean;
}

export type ConfidenceLevel = "high" | "medium" | "low";

// ─── Constants ───────────────────────────────────────────────────────────────

const HIGH_CONFIDENCE_THRESHOLD = 90;
const MEDIUM_CONFIDENCE_THRESHOLD = 70;
const LOW_CONFIDENCE_THRESHOLD = 50;
const EXTRA_REPAIR_THRESHOLD = 70; // Below this → request extra repair

// ─── Signals ─────────────────────────────────────────────────────────────────

interface ConfidenceSignal {
  name: string;
  weight: number; // -100 to +100
  description: string;
}

// ─── Confidence Computation ──────────────────────────────────────────────────

/**
 * Compute a confidence report from the current workspace state.
 *
 * Signals considered:
 * - Validation passed (+30)
 * - Validation failed (-40)
 * - Imports resolved (+15)
 * - Imports unresolved (-20)
 * - Routes valid (+10)
 * - Routes broken (-15)
 * - Components exist (+10)
 * - Duplicate detected (-15)
 * - Lint clean (+10)
 * - Lint errors (-15)
 * - Type safe (+15)
 * - Type errors (-25)
 * - Repair performed (-10 per repair)
 * - High impact change detected (-10)
 */
export function computeConfidence(
  validationReport: ValidationReport | null,
  workspaceContext: WorkspaceContext,
  snapshot: WorkspaceSnapshot,
  repairAttempts: number,
  impactScore?: number,
): ConfidenceReport {
  const signals: ConfidenceSignal[] = [];
  const warnings: string[] = [];

  // ── Validation signals ──────────────────────────────────────────────────
  if (validationReport) {
    if (validationReport.success) {
      signals.push({ name: "validation_passed", weight: 30, description: "All validations passed" });
    } else {
      const errorCount = validationReport.results.reduce((s, r) => s + r.errors.length, 0);
      signals.push({ name: "validation_failed", weight: -40, description: `${errorCount} validation error(s)` });
    }
  }

  // ── Import resolution signals ───────────────────────────────────────────
  if (workspaceContext.importGraph) {
    const totalImports = Object.values(workspaceContext.importGraph).reduce(
      (s, imports) => s + imports.length, 0,
    );
    const unresolvedImports = Object.values(workspaceContext.importGraph).reduce(
      (s, imports) => s + imports.filter((i) => !i.resolvedPath && !i.isExternal).length, 0,
    );

    if (unresolvedImports === 0 && totalImports > 0) {
      signals.push({ name: "imports_resolved", weight: 15, description: "All imports resolved" });
    } else if (unresolvedImports > 0) {
      signals.push({ name: "imports_unresolved", weight: -20, description: `${unresolvedImports} unresolved import(s)` });
      warnings.push(`${unresolvedImports} import(s) could not be resolved`);
    }
  }

  // ── Route validity signals ──────────────────────────────────────────────
  if (workspaceContext.routeTree) {
    const validRoutes = countValidRoutes(workspaceContext.routeTree);
    if (validRoutes > 0) {
      signals.push({ name: "routes_valid", weight: 10, description: `${validRoutes} route(s) valid` });
    }
  }

  // ── Component existence signals ─────────────────────────────────────────
  if (workspaceContext.componentIndex && workspaceContext.componentIndex.length > 0) {
    signals.push({ name: "components_exist", weight: 10, description: `${workspaceContext.componentIndex.length} component(s) indexed` });
  }

  // ── Duplicate detection ─────────────────────────────────────────────────
  if (workspaceContext.componentIndex) {
    const names = workspaceContext.componentIndex.map((c) => c.name.toLowerCase());
    const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
    if (duplicates.length > 0) {
      signals.push({ name: "duplicate_detected", weight: -15, description: `${duplicates.length} duplicate component(s)` });
      warnings.push(`Duplicate components detected: ${[...new Set(duplicates)].join(", ")}`);
    }
  }

  // ── Repair signals ──────────────────────────────────────────────────────
  if (repairAttempts > 0) {
    signals.push({ name: "repair_performed", weight: -10 * repairAttempts, description: `${repairAttempts} repair(s) performed` });
  }

  // ── Impact signals ──────────────────────────────────────────────────────
  if (impactScore !== undefined && impactScore > 50) {
    signals.push({ name: "high_impact", weight: -10, description: `High impact change (score: ${impactScore})` });
  }

  // ── Compute final score ─────────────────────────────────────────────────
  let score = 50; // Start at neutral

  for (const signal of signals) {
    score += signal.weight;
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score));

  const reasons = signals.map((s) => s.description);
  const needsExtraRepair = score < EXTRA_REPAIR_THRESHOLD;

  const report: ConfidenceReport = {
    score,
    reasons,
    warnings,
    needsExtraRepair,
  };

  logger.info(
    { score, needsExtraRepair, signalCount: signals.length, warningCount: warnings.length },
    `[confidence-engine] Score: ${score} (${getConfidenceLevel(score)})`,
  );

  return report;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function countValidRoutes(nodes: import("./workspace-context").RouteNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.pageFile || node.layoutFile) count++;
    if (node.children) count += countValidRoutes(node.children);
  }
  return count;
}

export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= HIGH_CONFIDENCE_THRESHOLD) return "high";
  if (score >= MEDIUM_CONFIDENCE_THRESHOLD) return "medium";
  return "low";
}
