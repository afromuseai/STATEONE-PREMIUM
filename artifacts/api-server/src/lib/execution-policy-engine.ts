// ─── Execution Policy Engine — Self-Evolving Execution Policies ────────────
// Phase 13.9
//
// Maintains execution policies that automatically evolve based on analytics.
// Policies control: max retries, preferred strategy, preferred specialist,
// validation threshold, confidence threshold, and parallelism limit.
//
// The engine learns from historical execution data and adjusts policies
// without manual intervention.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExecutionPolicies {
  /** Current version of the policy set. */
  version: number;
  /** Last time policies were updated. */
  lastUpdated: string;
  /** Number of times policies have been revised. */
  revisionCount: number;
  /** Maximum retries per task (0-5). */
  maxRetries: number;
  /** Preferred execution strategy (or "auto" for learned behavior). */
  preferredStrategy: string;
  /** Preferred specialist agent (or "auto" for learned behavior). */
  preferredSpecialist: string;
  /** Minimum validation success rate to consider a strategy reliable. */
  validationThreshold: number;
  /** Minimum confidence score to skip extra repair pass. */
  confidenceThreshold: number;
  /** Maximum number of tasks to execute in parallel (1 = sequential only). */
  parallelismLimit: number;
  /** Whether architecture edits should be forced sequential. */
  forceSequentialArchitecture: boolean;
  /** Whether high-impact changes should be forced sequential. */
  forceSequentialHighImpact: boolean;
  /** Historical learning metadata. */
  learningMetadata: {
    totalPolicyRevisions: number;
    lastRevisionReason: string;
    strategyRankings: Array<{ strategy: string; score: number }>;
    specialistRankings: Array<{ specialist: string; score: number }>;
  };
}

// ─── Default Policies ────────────────────────────────────────────────────────

const DEFAULT_POLICIES: ExecutionPolicies = {
  version: 1,
  lastUpdated: new Date().toISOString(),
  revisionCount: 0,
  maxRetries: 2,
  preferredStrategy: "auto",
  preferredSpecialist: "auto",
  validationThreshold: 0.7,
  confidenceThreshold: 70,
  parallelismLimit: 4,
  forceSequentialArchitecture: true,
  forceSequentialHighImpact: true,
  learningMetadata: {
    totalPolicyRevisions: 0,
    lastRevisionReason: "initial",
    strategyRankings: [],
    specialistRankings: [],
  },
};

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "analytics")
  : path.resolve(process.cwd(), "data", "analytics");

const STORE_PATH = path.join(DATA_DIR, "execution-policies.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadPolicies(): ExecutionPolicies {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(raw) as ExecutionPolicies;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[policy] Failed to load policies, using defaults");
  }
  return { ...DEFAULT_POLICIES, lastUpdated: new Date().toISOString() };
}

function savePolicies(policies: ExecutionPolicies): void {
  try {
    ensureDataDir();
    policies.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(policies, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err: String(err) }, "[policy] Failed to persist policies");
  }
}

let cachedPolicies: ExecutionPolicies | null = null;

function getPolicies(): ExecutionPolicies {
  if (!cachedPolicies) cachedPolicies = loadPolicies();
  return cachedPolicies;
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getExecutionPolicies(): ExecutionPolicies {
  return { ...getPolicies() };
}

export function getMaxRetries(): number {
  return getPolicies().maxRetries;
}

export function getPreferredStrategy(): string {
  return getPolicies().preferredStrategy;
}

export function getPreferredSpecialist(): string {
  return getPolicies().preferredSpecialist;
}

export function getValidationThreshold(): number {
  return getPolicies().validationThreshold;
}

export function getConfidenceThreshold(): number {
  return getPolicies().confidenceThreshold;
}

export function getParallelismLimit(): number {
  return getPolicies().parallelismLimit;
}

export function shouldForceSequentialArchitecture(): boolean {
  return getPolicies().forceSequentialArchitecture;
}

export function shouldForceSequentialHighImpact(): boolean {
  return getPolicies().forceSequentialHighImpact;
}

export function getPolicyRevisionCount(): number {
  return getPolicies().revisionCount;
}

// ─── Policy Evolution ────────────────────────────────────────────────────────

/**
 * Evolve policies based on execution analytics.
 * Called after each execution by the learning loop.
 */
export function evolvePolicies(params: {
  strategyStats: Record<string, { count: number; successRate: number; avgDuration: number; avgConfidence: number; repairRate: number }>;
  agentStats: Record<string, { count: number; successRate: number; validationRate: number; repairRate: number; averageConfidence: number; averagePlanningAccuracy: number }>;
  totalExecutions: number;
  recentValidationRate: number;
  recentRepairRate: number;
  recentMergeConflictRate: number;
  hasArchitectureEdits: boolean;
  hasHighImpactChanges: boolean;
}): ExecutionPolicies {
  const policies = getPolicies();
  const revisions: string[] = [];

  // ── Strategy ranking ────────────────────────────────────────────────────
  const strategyScores = Object.entries(params.strategyStats)
    .map(([strategy, stats]) => ({
      strategy,
      score:
        stats.successRate * 0.40 +
        (1 - stats.repairRate) * 0.20 +
        (stats.avgConfidence / 100) * 0.25 +
        (stats.count > 0 ? Math.min(1, stats.count / 20) * 0.15 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  // Update preferred strategy if enough data
  if (strategyScores.length > 0 && params.totalExecutions >= 5) {
    const best = strategyScores[0];
    if (best.score > 0.6 && policies.preferredStrategy !== best.strategy) {
      revisions.push(`Strategy preference changed to "${best.strategy}" (score: ${best.score.toFixed(2)})`);
      policies.preferredStrategy = best.strategy;
    }
  }

  policies.learningMetadata.strategyRankings = strategyScores;

  // ── Specialist ranking ──────────────────────────────────────────────────
  const specialistScores = Object.entries(params.agentStats)
    .map(([id, stats]) => ({
      specialist: id,
      score:
        stats.successRate * 0.35 +
        stats.validationRate * 0.20 +
        (1 - stats.repairRate) * 0.15 +
        (stats.averageConfidence / 100) * 0.15 +
        stats.averagePlanningAccuracy * 0.15,
    }))
    .sort((a, b) => b.score - a.score);

  if (specialistScores.length > 0 && params.totalExecutions >= 5) {
    const best = specialistScores[0];
    if (best.score > 0.7 && policies.preferredSpecialist !== best.specialist) {
      revisions.push(`Specialist preference changed to "${best.specialist}" (score: ${best.score.toFixed(2)})`);
      policies.preferredSpecialist = best.specialist;
    }
  }

  policies.learningMetadata.specialistRankings = specialistScores;

  // ── Retry limits ────────────────────────────────────────────────────────
  if (params.totalExecutions >= 3) {
    if (params.recentValidationRate < 0.5 && policies.maxRetries < 4) {
      policies.maxRetries = Math.min(4, policies.maxRetries + 1);
      revisions.push(`Increased max retries to ${policies.maxRetries} (low validation rate: ${(params.recentValidationRate * 100).toFixed(0)}%)`);
    } else if (params.recentValidationRate > 0.9 && policies.maxRetries > 1) {
      policies.maxRetries = Math.max(1, policies.maxRetries - 1);
      revisions.push(`Decreased max retries to ${policies.maxRetries} (high validation rate: ${(params.recentValidationRate * 100).toFixed(0)}%)`);
    }
  }

  // ── Confidence threshold ────────────────────────────────────────────────
  if (params.totalExecutions >= 3) {
    if (params.recentRepairRate > 0.4 && policies.confidenceThreshold < 85) {
      policies.confidenceThreshold = Math.min(85, policies.confidenceThreshold + 5);
      revisions.push(`Increased confidence threshold to ${policies.confidenceThreshold} (high repair rate)`);
    } else if (params.recentRepairRate < 0.15 && policies.confidenceThreshold > 55) {
      policies.confidenceThreshold = Math.max(55, policies.confidenceThreshold - 5);
      revisions.push(`Decreased confidence threshold to ${policies.confidenceThreshold} (low repair rate)`);
    }
  }

  // ── Parallelism limits ──────────────────────────────────────────────────
  if (params.totalExecutions >= 3) {
    if (params.recentMergeConflictRate > 0.3 && policies.parallelismLimit > 1) {
      policies.parallelismLimit = Math.max(1, policies.parallelismLimit - 1);
      revisions.push(`Reduced parallelism to ${policies.parallelismLimit} (high merge conflict rate: ${(params.recentMergeConflictRate * 100).toFixed(0)}%)`);
    } else if (params.recentMergeConflictRate < 0.1 && policies.parallelismLimit < 6) {
      policies.parallelismLimit = Math.min(6, policies.parallelismLimit + 1);
      revisions.push(`Increased parallelism to ${policies.parallelismLimit} (low merge conflict rate: ${(params.recentMergeConflictRate * 100).toFixed(0)}%)`);
    }
  }

  // ── Architecture sequential enforcement ─────────────────────────────────
  if (params.hasArchitectureEdits && params.recentMergeConflictRate > 0.2) {
    if (!policies.forceSequentialArchitecture) {
      policies.forceSequentialArchitecture = true;
      revisions.push("Enabled forced sequential for architecture edits (high conflict rate)");
    }
  }

  // ── High impact sequential enforcement ──────────────────────────────────
  if (params.hasHighImpactChanges && params.recentRepairRate > 0.3) {
    if (!policies.forceSequentialHighImpact) {
      policies.forceSequentialHighImpact = true;
      revisions.push("Enabled forced sequential for high-impact changes (high repair rate)");
    }
  }

  // ── Version and save ────────────────────────────────────────────────────
  if (revisions.length > 0) {
    policies.version += 1;
    policies.revisionCount += revisions.length;
    policies.learningMetadata.totalPolicyRevisions += revisions.length;
    policies.learningMetadata.lastRevisionReason = revisions.join("; ");
    savePolicies(policies);
    cachedPolicies = policies;

    logger.info(
      { revisionCount: revisions.length, version: policies.version, reasons: revisions.join(", ") },
      "[policy] Policies evolved",
    );
  }

  return policies;
}

// ─── Reset Policies ──────────────────────────────────────────────────────────

export function resetPolicies(): ExecutionPolicies {
  const defaults = { ...DEFAULT_POLICIES, lastUpdated: new Date().toISOString() };
  savePolicies(defaults);
  cachedPolicies = defaults;
  logger.info("[policy] Policies reset to defaults");
  return defaults;
}
