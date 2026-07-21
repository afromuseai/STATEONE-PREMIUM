// ─── Learning Loop — Post-Execution Self-Optimization Orchestrator ─────────
// Phase 13.9
//
// After every completed execution, the learning loop orchestrates:
//   1. Record execution analytics
//   2. Update agent performance profiler
//   3. Update repair strategy optimizer
//   4. Update validation pattern learner
//   5. Update merge conflict analytics
//   6. Update adaptive confidence
//   7. Evolve execution policies
//   8. Persist all state
//
// No manual intervention required — the loop runs automatically after each
// execution completes. All state survives server restarts.

import { logger } from "./logger";
import { recordExecution, getExecutionHistory, getTotalExecutionCount, getStrategyStats, getAgentStatsFromHistory, pruneHistory } from "./execution-analytics-engine";
import { updateAgentPerformance, getRankingRevisionCount } from "./agent-performance-profiler";
import { recordRepairAttempt, getTotalRepairs, getAverageRepairSuccessRate } from "./repair-strategy-optimizer";
import { recordValidationErrors, getTopValidationFailures, getTotalErrorsLogged } from "./validation-pattern-learner";
import { recordMergeConflict, getTotalMergeConflicts } from "./merge-conflict-analytics";
import { learnFromOutcome, getLearningIterations } from "./adaptive-confidence";
import { evolvePolicies, getExecutionPolicies, getPolicyRevisionCount } from "./execution-policy-engine";

// ─── Learning Loop Result ────────────────────────────────────────────────────

export interface LearningLoopResult {
  /** Number of learning steps executed. */
  stepsExecuted: number;
  /** Execution analytics ID. */
  executionId: string;
  /** Whether policies were updated. */
  policyUpdated: boolean;
  /** Number of agent ranking revisions. */
  agentRankChanges: number;
  /** Whether strategy rankings changed. */
  strategyRankChanges: number;
  /** Total learning iterations. */
  learningIterations: number;
  /** Performance improvement score (0-100). */
  improvementScore: number;
  /** Duration of the learning loop in ms. */
  durationMs: number;
}

// ─── Learning Loop Execution ─────────────────────────────────────────────────

export interface LearningInput {
  projectId: string | undefined;
  instruction: string;
  strategy: string;
  complexity: string;
  selectedAgent: string;
  taskCount: number;
  repairAttempts: number;
  validationPassed: boolean;
  planningPrecision: number;
  planningRecall: number;
  planningF1: number;
  confidenceScore: number;
  impactScore: number;
  durationMs: number;
  mergeConflicts: number;
  validationErrors: Array<{ file: string; message: string }>;
  agentSelections?: Array<{
    agentId: string;
    success: boolean;
    durationMs: number;
    repairAttempts: number;
    taskCount: number;
    confidenceScore: number;
    impactScore: number;
    planningAccuracy: number;
  }>;
  repairPrompt?: string;
  previousErrorCount?: number;
  repairErrorCount?: number;
  repairSuccess?: boolean;
  repairRetryCount?: number;
  mergeConflictRecords?: Array<{
    file: string;
    taskIdA: string;
    specialistA: string;
    taskIdB: string;
    specialistB: string;
    resolution: string;
  }>;
  hasArchitectureEdits?: boolean;
  hasHighImpactChanges?: boolean;
  fallbackCount?: number;
}

/**
 * Execute the full learning loop after an execution.
 * This is called once per execution from the editor pipeline.
 */
export async function executeLearningLoop(input: LearningInput): Promise<LearningLoopResult> {
  const start = Date.now();
  let steps = 0;

  // ── Step 1: Record execution analytics ──────────────────────────────────
  const executionId = recordExecution(input.projectId, {
    instruction: input.instruction.slice(0, 500),
    strategy: input.strategy,
    complexity: input.complexity,
    selectedAgent: input.selectedAgent,
    taskCount: input.taskCount,
    repairAttempts: input.repairAttempts,
    validationPassed: input.validationPassed,
    planningPrecision: input.planningPrecision,
    planningRecall: input.planningRecall,
    planningF1: input.planningF1,
    confidenceScore: input.confidenceScore,
    impactScore: input.impactScore,
    durationMs: input.durationMs,
    mergeConflicts: input.mergeConflicts,
    validationErrors: input.validationErrors.map((e) => e.message),
    agentSelections: input.agentSelections?.map((s) => ({
      taskId: `task-${s.agentId}`,
      agentId: s.agentId,
      success: s.success,
    })),
    fallbackCount: input.fallbackCount,
  });
  steps++;

  // ── Step 2: Update agent performance profiler ───────────────────────────
  if (input.agentSelections && input.agentSelections.length > 0) {
    updateAgentPerformance(input.projectId, input.agentSelections);
    steps++;
  }

  // ── Step 3: Record repair strategy ──────────────────────────────────────
  if (input.repairPrompt && input.repairAttempts > 0) {
    recordRepairAttempt({
      prompt: input.repairPrompt,
      errorCount: input.repairErrorCount ?? 0,
      success: input.repairSuccess ?? input.validationPassed,
      retryCount: input.repairRetryCount ?? input.repairAttempts,
      confidenceScore: input.confidenceScore,
      previousErrorCount: input.previousErrorCount ?? 0,
    });
    steps++;
  }

  // ── Step 4: Record validation patterns ──────────────────────────────────
  if (input.validationErrors.length > 0) {
    recordValidationErrors({
      errors: input.validationErrors,
      repairSuccess: input.validationPassed,
    });
    steps++;
  }

  // ── Step 5: Record merge conflicts ──────────────────────────────────────
  if (input.mergeConflictRecords && input.mergeConflictRecords.length > 0) {
    for (const conflict of input.mergeConflictRecords) {
      recordMergeConflict(conflict);
    }
    steps++;
  }

  // ── Step 6: Update adaptive confidence ──────────────────────────────────
  const recentHistory = input.projectId ? getExecutionHistory(input.projectId, 5) : [];
  const recentValidationRate = recentHistory.length > 0
    ? recentHistory.filter((e) => e.validationPassed).length / recentHistory.length
    : 0.5;

  learnFromOutcome({
    signalContributions: [
      { name: "validation_passed", weight: input.validationPassed ? 30 : 0, contributed: input.validationPassed ? 30 : 0 },
      { name: "validation_failed", weight: !input.validationPassed ? -40 : 0, contributed: !input.validationPassed ? -40 : 0 },
      { name: "repair", weight: input.repairAttempts > 0 ? -10 : 0, contributed: input.repairAttempts > 0 ? -10 * input.repairAttempts : 0 },
      { name: "high_impact", weight: input.impactScore >= 60 ? -10 : 0, contributed: input.impactScore >= 60 ? -10 : 0 },
    ],
    validationPassed: input.validationPassed,
    confidenceScore: input.confidenceScore,
  });
  steps++;

  // ── Step 7: Evolve execution policies ───────────────────────────────────
  const strategyStats = input.projectId ? getStrategyStats(input.projectId) : {};
  const agentStats = input.projectId ? getAgentStatsFromHistory(input.projectId) : {};
  const totalExecutions = input.projectId ? getTotalExecutionCount(input.projectId) : 0;
  const totalRepairs = getTotalRepairs();
  const totalConflicts = getTotalMergeConflicts();

  const recentRepairRate = totalRepairs > 0
    ? getAverageRepairSuccessRate()
    : 0.5;
  const recentMergeConflictRate = recentHistory.length > 0 && totalConflicts > 0
    ? Math.min(1, totalConflicts / recentHistory.length)
    : 0;

  const policies = evolvePolicies({
    strategyStats,
    agentStats: mapAgentStats(agentStats),
    totalExecutions,
    recentValidationRate,
    recentRepairRate: 1 - recentRepairRate,
    recentMergeConflictRate,
    hasArchitectureEdits: input.hasArchitectureEdits ?? false,
    hasHighImpactChanges: input.hasHighImpactChanges ?? false,
  });
  steps++;

  // ── Prune history if needed (keep last 1000) ────────────────────────────
  if (input.projectId) {
    pruneHistory(input.projectId, 1000);
  }

  // ── Compute improvement score ───────────────────────────────────────────
  const improvementScore = computeImprovementScore({
    currentValidationRate: recentValidationRate,
    currentRepairRate: 1 - recentRepairRate,
    currentMergeConflictRate: recentMergeConflictRate,
    totalExecutions,
    learningIterations: getLearningIterations(),
    policyRevisions: getPolicyRevisionCount(),
  });

  const durationMs = Date.now() - start;

  logger.info(
    {
      executionId,
      stepsExecuted: steps,
      policyUpdated: policies.revisionCount > 0,
      improvementScore,
      durationMs,
      agentRankChanges: getRankingRevisionCount(),
    },
    "[learning] Learning loop complete",
  );

  return {
    stepsExecuted: steps,
    executionId,
    policyUpdated: policies.revisionCount > 0,
    agentRankChanges: getRankingRevisionCount(),
    strategyRankChanges: policies.learningMetadata.strategyRankings.length,
    learningIterations: getLearningIterations(),
    improvementScore,
    durationMs,
  };
}

// ─── Improvement Score ───────────────────────────────────────────────────────

function computeImprovementScore(params: {
  currentValidationRate: number;
  currentRepairRate: number;
  currentMergeConflictRate: number;
  totalExecutions: number;
  learningIterations: number;
  policyRevisions: number;
}): number {
  const validationScore = params.currentValidationRate * 40;
  const repairScore = (1 - params.currentRepairRate) * 25;
  const mergeScore = (1 - params.currentMergeConflictRate) * 15;
  const maturityScore = Math.min(20, params.totalExecutions) / 20 * 10;
  const learningScore = Math.min(10, params.learningIterations) / 10 * 10;

  return Math.round(validationScore + repairScore + mergeScore + maturityScore + learningScore);
}

// ─── Build Agent Selections from Task Results ────────────────────────────────

/**
 * Helper to build agentSelections from task execution results.
 * Call this in the editor pipeline to prepare the learning input.
 */
export function buildAgentSelections(
  agentRoutingResults: Array<{ agent: { id: string }; taskId?: string }>,
  taskResults: Map<string, { success: boolean; durationMs: number; repairAttempts: number; taskCount: number; confidenceScore: number; impactScore: number; planningAccuracy: number }>,
): Array<{
  agentId: string;
  success: boolean;
  durationMs: number;
  repairAttempts: number;
  taskCount: number;
  confidenceScore: number;
  impactScore: number;
  planningAccuracy: number;
}> {
  return agentRoutingResults.map((routing) => {
    const taskResult = taskResults.get(routing.agent.id);
    return {
      agentId: routing.agent.id,
      success: taskResult?.success ?? false,
      durationMs: taskResult?.durationMs ?? 0,
      repairAttempts: taskResult?.repairAttempts ?? 0,
      taskCount: taskResult?.taskCount ?? 1,
      confidenceScore: taskResult?.confidenceScore ?? 0,
      impactScore: taskResult?.impactScore ?? 0,
      planningAccuracy: taskResult?.planningAccuracy ?? 0,
    };
  });
}

// ─── Map agent stats from history format to policy format ────────────────────

function mapAgentStats(
  stats: Record<string, Record<string, number>>,
): Record<string, { count: number; successRate: number; validationRate: number; repairRate: number; averageConfidence: number; averagePlanningAccuracy: number }> {
  const result: Record<string, any> = {};
  for (const [id, s] of Object.entries(stats)) {
    result[id] = {
      count: s.count ?? 0,
      successRate: s.successRate ?? 0.5,
      validationRate: s.validationPassRate ?? s.validationRate ?? 0.5,
      repairRate: s.repairRate ?? 0.5,
      averageConfidence: s.avgConfidence ?? s.averageConfidence ?? 50,
      averagePlanningAccuracy: s.avgPlanningAccuracy ?? s.averagePlanningAccuracy ?? 0.5,
    };
  }
  return result;
}
