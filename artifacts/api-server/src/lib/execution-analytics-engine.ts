// ─── Execution Analytics Engine — Structured Execution History ──────────────
// Phase 13.9
//
// Collects every execution into a structured, persistent history.
// Provides query methods for extracting performance metrics per agent,
// strategy, and overall trends. All data survives server restarts.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecutionAnalytics {
  executionId: string;
  timestamp: string;
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
  validationErrors: string[];
  /** Additional per-task agent selections (for multi-task executions). */
  agentSelections?: Array<{ taskId: string; agentId: string; success: boolean }>;
  /** Number of times a fallback agent was used. */
  fallbackCount?: number;
}

export interface ExecutionAnalyticsStore {
  executions: ExecutionAnalytics[];
  totalExecutions: number;
  lastUpdated: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "execution-history")
  : path.resolve(process.cwd(), "data", "execution-history");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

function getStorePath(projectId: string): string {
  ensureDataDir();
  return path.join(DATA_DIR, `${projectId}.json`);
}

function loadStore(projectId: string): ExecutionAnalyticsStore {
  const storePath = getStorePath(projectId);
  try {
    if (fs.existsSync(storePath)) {
      const raw = fs.readFileSync(storePath, "utf-8");
      return JSON.parse(raw) as ExecutionAnalyticsStore;
    }
  } catch (err) {
    logger.warn({ projectId, err: String(err) }, "[analytics] Failed to load execution history, starting fresh");
  }
  return { executions: [], totalExecutions: 0, lastUpdated: new Date().toISOString() };
}

function saveStore(projectId: string, store: ExecutionAnalyticsStore): void {
  try {
    ensureDataDir();
    store.lastUpdated = new Date().toISOString();
    store.totalExecutions = store.executions.length;
    fs.writeFileSync(getStorePath(projectId), JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ projectId, err: String(err) }, "[analytics] Failed to persist execution history");
  }
}

// ─── Record Execution ────────────────────────────────────────────────────────

let executionCounter = 0;

export function recordExecution(
  projectId: string | undefined,
  analytics: Omit<ExecutionAnalytics, "executionId" | "timestamp">,
): string {
  if (!projectId) return "";

  executionCounter++;
  const executionId = `exec-${Date.now()}-${executionCounter}`;
  const record: ExecutionAnalytics = {
    ...analytics,
    executionId,
    timestamp: new Date().toISOString(),
  };

  const store = loadStore(projectId);
  store.executions.push(record);
  saveStore(projectId, store);

  logger.info(
    { projectId, executionId, strategy: analytics.strategy, durationMs: analytics.durationMs, validationPassed: analytics.validationPassed },
    "[analytics] Execution recorded",
  );

  return executionId;
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getExecutionHistory(
  projectId: string,
  limit = 50,
): ExecutionAnalytics[] {
  const store = loadStore(projectId);
  return store.executions.slice(-limit).reverse();
}

export function getTotalExecutionCount(projectId: string): number {
  const store = loadStore(projectId);
  return store.executions.length;
}

export function getRecentExecutions(
  projectId: string,
  count = 10,
): ExecutionAnalytics[] {
  const store = loadStore(projectId);
  return store.executions.slice(-count).reverse();
}

// ─── Aggregation Queries ─────────────────────────────────────────────────────

export function getStrategyStats(projectId: string): Record<string, {
  count: number;
  successRate: number;
  avgDuration: number;
  avgConfidence: number;
  repairRate: number;
}> {
  const store = loadStore(projectId);
  const byStrategy = new Map<string, ExecutionAnalytics[]>();

  for (const exec of store.executions) {
    const s = exec.strategy || "unknown";
    if (!byStrategy.has(s)) byStrategy.set(s, []);
    byStrategy.get(s)!.push(exec);
  }

  const result: Record<string, any> = {};
  for (const [strategy, execs] of byStrategy) {
    const total = execs.length;
    const successes = execs.filter((e) => e.validationPassed).length;
    const durations = execs.map((e) => e.durationMs);
    const repairs = execs.filter((e) => e.repairAttempts > 0).length;
    result[strategy] = {
      count: total,
      successRate: total > 0 ? successes / total : 0,
      avgDuration: total > 0 ? durations.reduce((a, b) => a + b, 0) / total : 0,
      avgConfidence: total > 0 ? execs.reduce((a, e) => a + e.confidenceScore, 0) / total : 0,
      repairRate: total > 0 ? repairs / total : 0,
    };
  }

  return result;
}

export function getAgentStatsFromHistory(projectId: string): Record<string, {
  count: number;
  successRate: number;
  avgDuration: number;
  avgConfidence: number;
  avgImpact: number;
  repairRate: number;
  validationPassRate: number;
  avgRetries: number;
  avgTaskSize: number;
  avgPlanningAccuracy: number;
}> {
  const store = loadStore(projectId);
  const byAgent = new Map<string, ExecutionAnalytics[]>();

  // Collect by primary selectedAgent
  for (const exec of store.executions) {
    const agentId = exec.selectedAgent || "general";
    if (!byAgent.has(agentId)) byAgent.set(agentId, []);
    byAgent.get(agentId)!.push(exec);
  }

  // Also collect from agentSelections if available
  for (const exec of store.executions) {
    if (exec.agentSelections) {
      for (const sel of exec.agentSelections) {
        if (!byAgent.has(sel.agentId)) byAgent.set(sel.agentId, []);
        // We create a pseudo-execution entry for per-task stats
        byAgent.get(sel.agentId)!.push({
          ...exec,
          selectedAgent: sel.agentId,
          validationPassed: sel.success,
        });
      }
    }
  }

  const result: Record<string, any> = {};
  for (const [agentId, execs] of byAgent) {
    const total = execs.length;
    const successes = execs.filter((e) => e.validationPassed).length;
    const durations = execs.map((e) => e.durationMs);
    const repairs = execs.filter((e) => e.repairAttempts > 0).length;
    const validationsPassed = execs.filter((e) => e.validationPassed).length;
    const retries = execs.reduce((a, e) => a + (e.repairAttempts > 1 ? e.repairAttempts - 1 : 0), 0);
    const taskSizes = execs.map((e) => e.taskCount);
    const precisions = execs.filter((e) => e.planningPrecision > 0).map((e) => e.planningPrecision);
    const impacts = execs.filter((e) => e.impactScore > 0).map((e) => e.impactScore);
    const confidences = execs.map((e) => e.confidenceScore);

    if (total === 0) continue;

    result[agentId] = {
      count: total,
      successRate: total > 0 ? successes / total : 0,
      avgDuration: total > 0 ? durations.reduce((a, b) => a + b, 0) / total : 0,
      avgConfidence: total > 0 ? confidences.reduce((a, b) => a + b, 0) / total : 0,
      avgImpact: impacts.length > 0 ? impacts.reduce((a, b) => a + b, 0) / impacts.length : 0,
      repairRate: total > 0 ? repairs / total : 0,
      validationPassRate: total > 0 ? validationsPassed / total : 0,
      avgRetries: total > 0 ? retries / total : 0,
      avgTaskSize: total > 0 ? taskSizes.reduce((a, b) => a + b, 0) / total : 0,
      avgPlanningAccuracy: precisions.length > 0 ? precisions.reduce((a, b) => a + b, 0) / precisions.length : 0,
    };
  }

  return result;
}

// ─── Prune old records (keep last 1000 per project) ─────────────────────────

export function pruneHistory(projectId: string, maxRecords = 1000): number {
  const store = loadStore(projectId);
  if (store.executions.length <= maxRecords) return 0;

  const removed = store.executions.length - maxRecords;
  store.executions = store.executions.slice(-maxRecords);
  saveStore(projectId, store);

  logger.info({ projectId, removed, remaining: store.executions.length }, "[analytics] Pruned execution history");
  return removed;
}
