// ─── Engineering Decision Engine — Execution Strategy Intelligence ──────────
// Phase 14.6
//
// Evaluates multiple execution strategies before the Task Planner runs.
// Determines safest approach, reuse opportunities, refactor needs, and risk.
//
// Architecture:
//   Workspace Context + Execution Plan + Intelligence Layers
//       ↓
//   Engineering Decision Engine
//       ↓
//   Recommendation + Strategy + Risk + Confidence
//       ↓
//   Execution Planner → Task Planner → Specialist Router

import { logger } from "./logger";
import type { WorkspaceContext } from "./workspace-context";
import type { ExecutionPlan } from "./execution-planner";
import type { ConfidenceReport } from "./confidence-engine";
import type { PreviewReport } from "./preview-intelligence-engine";
import type { VisualReport } from "./visual-verification-engine";
import type { RecoveryTelemetry } from "./recovery-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecisionRecommendation =
  | "proceed"
  | "repair-first"
  | "ask-user"
  | "rollback"
  | "defer";

export type ExecutionStrategy =
  | "patch"
  | "refactor"
  | "replace"
  | "extend"
  | "rebuild";

export type TradeoffCategory =
  | "performance"
  | "maintainability"
  | "complexity"
  | "risk"
  | "design"
  | "developer-experience";

export interface DecisionTradeoff {
  category: TradeoffCategory;
  benefit: string;
  drawback: string;
}

export interface DecisionOption {
  id: string;
  title: string;
  strategy: ExecutionStrategy;
  confidence: number;
  risk: number;
  estimatedFiles: number;
  rationale: string[];
}

export interface EngineeringDecision {
  recommendation: DecisionRecommendation;
  confidence: number;
  rationale: string[];
  estimatedRisk: number;
  executionStrategy: ExecutionStrategy;
  chosenOption: string;
  alternatives: DecisionOption[];
  tradeoffs: DecisionTradeoff[];
}

// ─── SSE Payload ──────────────────────────────────────────────────────────────

export interface DecisionPayload {
  recommendation: DecisionRecommendation;
  confidence: number;
  estimatedRisk: number;
  executionStrategy: ExecutionStrategy;
  chosenOption: string;
  alternativeOptions: Array<{
    id: string;
    title: string;
    strategy: ExecutionStrategy;
    confidence: number;
    risk: number;
    estimatedFiles: number;
  }>;
  tradeoffs: DecisionTradeoff[];
  rationale: string[];
  decisionTimeMs: number;
  timestamp: string;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface DecisionTelemetry {
  decisionTimeMs: number;
  decisionConfidence: number;
  decisionRisk: number;
  decisionRecommendation: DecisionRecommendation;
  decisionStrategy: ExecutionStrategy;
  decisionAlternatives: number;
  decisionTradeoffCount: number;
  decisionChangedPlanner: boolean;
  decisionAccepted: boolean;
}

let telemetry: DecisionTelemetry = {
  decisionTimeMs: 0,
  decisionConfidence: 0,
  decisionRisk: 0,
  decisionRecommendation: "proceed",
  decisionStrategy: "patch",
  decisionAlternatives: 0,
  decisionTradeoffCount: 0,
  decisionChangedPlanner: false,
  decisionAccepted: true,
};

export function getDecisionTelemetry(): DecisionTelemetry {
  return { ...telemetry };
}

export function resetDecisionTelemetry(): void {
  telemetry = {
    decisionTimeMs: 0,
    decisionConfidence: 0,
    decisionRisk: 0,
    decisionRecommendation: "proceed",
    decisionStrategy: "patch",
    decisionAlternatives: 0,
    decisionTradeoffCount: 0,
    decisionChangedPlanner: false,
    decisionAccepted: true,
  };
}

// ─── Evaluation Inputs ────────────────────────────────────────────────────────

export interface DecisionInputs {
  instruction: string;
  wsCtx: WorkspaceContext | null | undefined;
  executionPlan: ExecutionPlan | null | undefined;
  confidenceScore: number;
  validationPassed: boolean;
  repairAttempts: number;
  maxRepairsReached: boolean;
  previewReport: PreviewReport | null | undefined;
  visualReport: VisualReport | null | undefined;
  recoveryTelemetry: RecoveryTelemetry | null | undefined;
  projectId?: string;
  hasArchitectureEdits?: boolean;
}

// ─── Scoring Helpers ──────────────────────────────────────────────────────────

/**
 * Estimate regression risk (0–100) based on intelligence inputs.
 */
function estimateRegressionRisk(inputs: DecisionInputs): number {
  let risk = 10; // baseline

  // Shared component edit increases risk
  if (inputs.wsCtx?.relatedFiles && inputs.wsCtx.relatedFiles.length > 5) {
    risk += 15;
  }

  // Architecture edits are high risk
  if (inputs.hasArchitectureEdits) {
    risk += 20;
  }

  // Previous repair attempts indicate instability
  if (inputs.repairAttempts > 0) {
    risk += inputs.repairAttempts * 8;
  }

  // Low confidence increases risk
  if (inputs.confidenceScore < 50) {
    risk += 20;
  } else if (inputs.confidenceScore < 70) {
    risk += 10;
  }

  // Failed validation increases risk
  if (!inputs.validationPassed) {
    risk += 15;
  }

  // Preview issues increase risk
  if (inputs.previewReport && inputs.previewReport.healthScore < 60) {
    risk += 10;
  }

  // Visual issues increase risk
  if (inputs.visualReport && inputs.visualReport.score < 50) {
    risk += 10;
  }

  // Recovery history — previous rollbacks indicate instability
  if (inputs.recoveryTelemetry && inputs.recoveryTelemetry.rollbackCount > 0) {
    risk += inputs.recoveryTelemetry.rollbackCount * 10;
  }

  return Math.min(100, Math.max(0, risk));
}

/**
 * Detect whether the instruction involves a shared component.
 */
function involvesSharedComponent(
  instruction: string,
  wsCtx: WorkspaceContext | null | undefined,
): boolean {
  const sharedKeywords = [
    "button", "modal", "input", "card", "dropdown",
    "nav", "header", "footer", "layout", "sidebar",
    "theme", "global", "provider", "context",
  ];
  const instructionLower = instruction.toLowerCase();
  const matched = sharedKeywords.some((kw) => instructionLower.includes(kw));
  if (matched) return true;
  if (wsCtx?.framework === "react" || wsCtx?.framework === "nextjs") {
    // Check for shared component patterns
    if (wsCtx?.relatedFiles?.some((f) => f.includes("components/"))) return true;
  }
  return false;
}

/**
 * Detect whether the instruction involves a route/page change.
 */
function involvesRoute(instruction: string): boolean {
  const routeKeywords = [
    "route", "page", "screen", "view", "navigation",
    "navigate", "redirect", "/", "url", "path",
  ];
  const instructionLower = instruction.toLowerCase();
  return routeKeywords.some((kw) => instructionLower.includes(kw));
}

/**
 * Detect whether the instruction is about refactoring.
 */
function isRefactoringRequest(instruction: string): boolean {
  const refactorKeywords = [
    "refactor", "clean up", "reorganize", "restructure",
    "simplify", "optimize", "improve", "rewrite",
    "extract", "split", "merge", "consolidate",
  ];
  const instructionLower = instruction.toLowerCase();
  return refactorKeywords.some((kw) => instructionLower.includes(kw));
}

/**
 * Detect if the instruction is a minor/trivial change.
 */
function isMinorChange(
  instruction: string,
  executionPlan: ExecutionPlan | null | undefined,
): boolean {
  if (executionPlan?.complexity === "low") return true;
  const minorKeywords = [
    "fix typo", "change color", "update text", "rename",
    "change font", "adjust padding", "add comment",
    "fix spelling",
  ];
  const instructionLower = instruction.toLowerCase();
  return minorKeywords.some((kw) => instructionLower.includes(kw));
}

// ─── Option Generation ────────────────────────────────────────────────────────

/**
 * Generate 2–5 candidate strategies for the given instruction.
 */
function generateOptions(inputs: DecisionInputs): DecisionOption[] {
  const options: DecisionOption[] = [];
  const risk = estimateRegressionRisk(inputs);

  // Option A: Patch — modify existing files minimally
  options.push({
    id: "A",
    title: `Modify existing ${inputs.executionPlan?.filesToModify?.length ?? 1} file(s)`,
    strategy: "patch",
    confidence: Math.max(30, 95 - risk * 0.5),
    risk: Math.max(5, risk * 0.6),
    estimatedFiles: inputs.executionPlan?.filesToModify?.length ?? 1,
    rationale: [
      "Minimal change surface — lowest regression risk",
      "Preserves existing architecture and conventions",
      "Fastest time-to-implementation",
    ],
  });

  // Option B: Extend — add new files/modules alongside existing
  const extendRisk = Math.min(100, risk + 10);
  options.push({
    id: "B",
    title: "Add new components alongside existing",
    strategy: "extend",
    confidence: Math.max(20, 90 - extendRisk * 0.45),
    risk: extendRisk,
    estimatedFiles: (inputs.executionPlan?.filesToModify?.length ?? 1) + 1,
    rationale: [
      "Preserves existing code unchanged",
      "Clear separation of new and old logic",
      "Easier to review and test incrementally",
    ],
  });

  // Option C: Refactor — restructure existing code
  if (isRefactoringRequest(inputs.instruction) || risk > 40) {
    const refactorRisk = Math.min(100, risk + 15);
    options.push({
      id: "C",
      title: `Refactor ${inputs.executionPlan?.filesToModify?.length ?? 1} file(s)`,
      strategy: "refactor",
      confidence: Math.max(15, 85 - refactorRisk * 0.4),
      risk: refactorRisk,
      estimatedFiles: (inputs.executionPlan?.filesToModify?.length ?? 1) + 2,
      rationale: [
        "Addresses underlying architecture concerns",
        "Improves long-term maintainability",
        "May reduce future regression risk",
      ],
    });
  }

  // Option D: Replace — completely rewrite targeted files
  if (risk > 50 || inputs.hasArchitectureEdits) {
    const replaceRisk = Math.min(100, risk + 25);
    options.push({
      id: "D",
      title: `Replace ${inputs.executionPlan?.filesToModify?.length ?? 1} file(s) entirely`,
      strategy: "replace",
      confidence: Math.max(10, 75 - replaceRisk * 0.35),
      risk: replaceRisk,
      estimatedFiles: inputs.executionPlan?.filesToModify?.length ?? 1,
      rationale: [
        "Clean slate — no legacy issues carried forward",
        "Best for fundamentally broken or outdated implementations",
        "Highest risk of introducing new issues",
      ],
    });
  }

  // Option E: Rebuild — create new architecture from scratch
  if (risk > 70 || (inputs.hasArchitectureEdits && risk > 50)) {
    const rebuildRisk = Math.min(100, risk + 30);
    options.push({
      id: "E",
      title: "Rebuild from scratch with new architecture",
      strategy: "rebuild",
      confidence: Math.max(5, 60 - rebuildRisk * 0.3),
      risk: rebuildRisk,
      estimatedFiles: (inputs.executionPlan?.filesToModify?.length ?? 1) + 3,
      rationale: [
        "Complete architectural freedom",
        "Best long-term outcome for fundamentally flawed systems",
        "Maximum risk — requires thorough validation",
      ],
    });
  }

  // Ensure at least 2 options
  if (options.length < 2) {
    options.push({
      id: "B",
      title: "Add new components alongside existing",
      strategy: "extend",
      confidence: 80,
      risk: Math.min(100, risk + 10),
      estimatedFiles: (inputs.executionPlan?.filesToModify?.length ?? 1) + 1,
      rationale: [
        "Preserves existing code unchanged",
        "Clear separation of new and old logic",
      ],
    });
  }

  return options;
}

// ─── Tradeoff Generation ──────────────────────────────────────────────────────

/**
 * Generate tradeoffs based on the chosen strategy.
 */
function generateTradeoffs(
  strategy: ExecutionStrategy,
  inputs: DecisionInputs,
): DecisionTradeoff[] {
  const tradeoffs: DecisionTradeoff[] = [];

  switch (strategy) {
    case "patch":
      tradeoffs.push(
        {
          category: "maintainability",
          benefit: "Low-risk, minimal changes",
          drawback: "May accumulate technical debt over time",
        },
        {
          category: "complexity",
          benefit: "Simple, fast implementation",
          drawback: "May not address root cause",
        },
        {
          category: "risk",
          benefit: "Lowest regression risk",
          drawback: "Limited scope for improvement",
        },
      );
      break;
    case "extend":
      tradeoffs.push(
        {
          category: "complexity",
          benefit: "New code is clean and isolated",
          drawback: "Increases total codebase size",
        },
        {
          category: "maintainability",
          benefit: "No risk of breaking existing code",
          drawback: "May create duplication with existing patterns",
        },
        {
          category: "developer-experience",
          benefit: "Easy to review and test",
          drawback: "Requires integration wiring",
        },
      );
      break;
    case "refactor":
      tradeoffs.push(
        {
          category: "maintainability",
          benefit: "Improved code structure and clarity",
          drawback: "Higher risk of introducing regressions",
        },
        {
          category: "complexity",
          benefit: "Reduces future complexity",
          drawback: "More complex implementation than patching",
        },
        {
          category: "risk",
          benefit: "Addresses root causes",
          drawback: "Requires thorough testing",
        },
      );
      break;
    case "replace":
      tradeoffs.push(
        {
          category: "design",
          benefit: "Clean implementation with modern patterns",
          drawback: "Loses existing battle-tested code",
        },
        {
          category: "risk",
          benefit: "Opportunity to fix all known issues",
          drawback: "Highest risk of new regressions",
        },
        {
          category: "performance",
          benefit: "Can optimize from ground up",
          drawback: "May introduce new performance characteristics",
        },
      );
      break;
    case "rebuild":
      tradeoffs.push(
        {
          category: "design",
          benefit: "Complete architectural freedom",
          drawback: "Throws away existing investment",
        },
        {
          category: "risk",
          benefit: "Can eliminate all legacy issues",
          drawback: "Maximum risk — validates like a new project",
        },
        {
          category: "developer-experience",
          benefit: "Clean slate — no constraints",
          drawback: "Requires full re-verification of all features",
        },
      );
      break;
  }

  return tradeoffs;
}

// ─── Recommendation ───────────────────────────────────────────────────────────

/**
 * Determine the recommendation based on risk and confidence.
 */
function determineRecommendation(
  chosen: DecisionOption,
  inputs: DecisionInputs,
  risk: number,
): {
  recommendation: DecisionRecommendation;
  rationale: string[];
} {
  const rationale: string[] = [];

  // Risk too high → defer or rollback
  if (risk >= 85) {
    rationale.push("Risk exceeds safe threshold — operation should be deferred");
    rationale.push("Consider breaking the change into smaller, safer steps");
    if (inputs.recoveryTelemetry && inputs.recoveryTelemetry.rollbackCount > 0) {
      rationale.push("Previous rollbacks indicate systemic instability");
    }
    return { recommendation: "defer", rationale };
  }

  if (risk >= 70) {
    rationale.push("Risk is elevated — user confirmation recommended");
    rationale.push("Prepare rollback snapshot before proceeding");
    if (inputs.recoveryTelemetry && inputs.recoveryTelemetry.rollbackCount > 0) {
      rationale.push("Recovery system is active and has handled rollbacks before");
    }
    return { recommendation: "ask-user", rationale };
  }

  // Repair needed first
  if (!inputs.validationPassed || inputs.maxRepairsReached) {
    rationale.push("Existing validation issues should be resolved first");
    rationale.push("Running repair cycle before main edit execution");
    return { recommendation: "repair-first", rationale };
  }

  // Rollback recommended when previous recovery failed
  if (
    inputs.recoveryTelemetry &&
    inputs.recoveryTelemetry.recoverySuccessRate < 50 &&
    inputs.recoveryTelemetry.rollbackCount > 0
  ) {
    rationale.push("Recovery success rate is low — consider rolling back previous changes");
    return { recommendation: "rollback", rationale };
  }

  // Proceed with caution
  if (risk >= 40) {
    rationale.push("Moderate risk — proceeding with monitoring");
    rationale.push("Recovery snapshots will be taken automatically");
    return { recommendation: "proceed", rationale };
  }

  // Safe to proceed
  rationale.push("Low risk — safe to proceed with standard execution");
  rationale.push("All quality gates are operational");
  return { recommendation: "proceed", rationale };
}

// ─── Main Engine ──────────────────────────────────────────────────────────────

/**
 * Evaluate the proposed edit and produce an EngineeringDecision.
 *
 * This is the primary entry point. It:
 *  1. Estimates regression risk from all intelligence layers
 *  2. Generates 2–5 candidate execution strategies
 *  3. Ranks options by confidence ÷ risk ratio
 *  4. Selects the best option and builds tradeoffs
 *  5. Determines the recommendation (proceed/repair-first/ask-user/rollback/defer)
 *  6. Records telemetry
 */
export function evaluateEngineeringDecision(inputs: DecisionInputs): EngineeringDecision {
  const startTime = Date.now();

  // 1. Estimate risk
  const risk = estimateRegressionRisk(inputs);

  // 2. Generate options
  const options = generateOptions(inputs);

  // 3. Rank by confidence / risk ratio (higher is better)
  const ranked = [...options].sort((a, b) => {
    const ratioA = a.confidence / Math.max(1, a.risk);
    const ratioB = b.confidence / Math.max(1, b.risk);
    return ratioB - ratioA;
  });

  // 4. Select the best option
  const chosen = ranked[0];
  const alternatives = ranked.slice(1);

  // 5. Generate tradeoffs for the chosen strategy
  const tradeoffs = generateTradeoffs(chosen.strategy, inputs);

  // 6. Determine recommendation
  const { recommendation, rationale } = determineRecommendation(chosen, inputs, risk);

  // 7. Build the decision
  const decision: EngineeringDecision = {
    recommendation,
    confidence: chosen.confidence,
    rationale,
    estimatedRisk: risk,
    executionStrategy: chosen.strategy,
    chosenOption: chosen.title,
    alternatives,
    tradeoffs,
  };

  // 8. Record telemetry
  const elapsed = Date.now() - startTime;
  telemetry = {
    decisionTimeMs: elapsed,
    decisionConfidence: chosen.confidence,
    decisionRisk: risk,
    decisionRecommendation: recommendation,
    decisionStrategy: chosen.strategy,
    decisionAlternatives: alternatives.length,
    decisionTradeoffCount: tradeoffs.length,
    decisionChangedPlanner: false,
    decisionAccepted: recommendation === "proceed" || recommendation === "repair-first",
  };

  logger.info(
    {
      decisionTimeMs: elapsed,
      recommendation,
      strategy: chosen.strategy,
      risk,
      confidence: chosen.confidence,
      alternatives: alternatives.length,
      optionsGenerated: options.length,
    },
    "[decision] Engineering decision evaluated",
  );

  return decision;
}

/**
 * Format the decision as a prompt injection block.
 */
export function formatEngineeringDecision(decision: EngineeringDecision): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("## Engineering Decision");
  lines.push("");
  lines.push(`Recommendation: **${decision.recommendation}**`);
  lines.push(`Execution Strategy: **${decision.executionStrategy}**`);
  lines.push(`Confidence: **${decision.confidence}%**`);
  lines.push(`Estimated Risk: **${decision.estimatedRisk}%**`);
  lines.push(`Chosen Option: **${decision.chosenOption}**`);
  lines.push("");

  if (decision.alternatives.length > 0) {
    lines.push("### Alternative Options Considered");
    for (const alt of decision.alternatives) {
      lines.push(`- **${alt.id}**: ${alt.title} (confidence: ${alt.confidence}%, risk: ${alt.risk}%)`);
    }
    lines.push("");
  }

  if (decision.tradeoffs.length > 0) {
    lines.push("### Tradeoffs");
    for (const t of decision.tradeoffs) {
      lines.push(`- **${t.category}**: ${t.benefit} | Drawback: ${t.drawback}`);
    }
    lines.push("");
  }

  lines.push("### Rationale");
  for (const r of decision.rationale) {
    lines.push(`- ${r}`);
  }
  lines.push("");

  return lines.join("\n");
}
