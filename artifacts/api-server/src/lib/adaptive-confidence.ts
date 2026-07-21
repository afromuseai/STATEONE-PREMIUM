// ─── Adaptive Confidence — Learning-Enhanced Confidence Scoring ────────────
// Phase 13.9
//
// Wraps the existing ConfidenceEngine with historical learning.
// Adjusts confidence signal weights based on historical outcomes.
// More weight is given to signals that have historically correlated with
// successful outcomes.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";
import { computeConfidence } from "./confidence-engine";
import type { ConfidenceReport, ConfidenceLevel } from "./confidence-engine";
import type { ValidationReport } from "./workspace-validator";
import type { WorkspaceContext } from "./workspace-context";
import type { WorkspaceSnapshot } from "./workspace-observer";
import { getAverageRepairSuccessRate, getTotalRepairs } from "./repair-strategy-optimizer";
import { getMergeConflictRate } from "./merge-conflict-analytics";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SignalAdjustment {
  /** Base weight for the signal. */
  baseWeight: number;
  /** Current adjustment factor (1.0 = no adjustment). */
  adjustmentFactor: number;
  /** Number of observations. */
  observations: number;
  /** Correlation with success (0-1) — higher means signal is more predictive. */
  correlation: number;
}

export interface AdaptiveConfidenceStore {
  /** Per-signal adjustment data. */
  signalAdjustments: Record<string, SignalAdjustment>;
  /** Overall confidence bias adjustment (shift). */
  biasAdjustment: number;
  /** Number of learning iterations. */
  learningIterations: number;
  /** Last updated timestamp. */
  lastUpdated: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "analytics")
  : path.resolve(process.cwd(), "data", "analytics");

const STORE_PATH = path.join(DATA_DIR, "adaptive-confidence.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): AdaptiveConfidenceStore {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(raw) as AdaptiveConfidenceStore;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[adaptive-conf] Failed to load adaptive confidence, starting fresh");
  }
  return {
    signalAdjustments: {},
    biasAdjustment: 0,
    learningIterations: 0,
    lastUpdated: new Date().toISOString(),
  };
}

function saveStore(store: AdaptiveConfidenceStore): void {
  try {
    ensureDataDir();
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err: String(err) }, "[adaptive-conf] Failed to persist adaptive confidence");
  }
}

let cachedStore: AdaptiveConfidenceStore | null = null;

function getStore(): AdaptiveConfidenceStore {
  if (!cachedStore) cachedStore = loadStore();
  return cachedStore;
}

// ─── Signal Definitions ──────────────────────────────────────────────────────

const SIGNAL_NAMES = [
  "validation_passed",
  "validation_failed",
  "imports_resolved",
  "unresolved",
  "routes_valid",
  "components_exist",
  "duplicates",
  "repair",
  "high_impact",
];

const DEFAULT_BASE_WEIGHTS: Record<string, number> = {
  validation_passed: 30,
  validation_failed: -40,
  imports_resolved: 15,
  unresolved: -20,
  routes_valid: 10,
  components_exist: 10,
  duplicates: -15,
  repair: -10,
  high_impact: -10,
};

// ─── Learn from Outcome ──────────────────────────────────────────────────────

/**
 * Update signal adjustments based on the outcome of an execution.
 * Called by the learning loop after each execution completes.
 */
export function learnFromOutcome(params: {
  signalContributions: Array<{ name: string; weight: number; contributed: number }>;
  validationPassed: boolean;
  confidenceScore: number;
}): void {
  const store = getStore();

  for (const signal of params.signalContributions) {
    if (!store.signalAdjustments[signal.name]) {
      store.signalAdjustments[signal.name] = {
        baseWeight: DEFAULT_BASE_WEIGHTS[signal.name] ?? 0,
        adjustmentFactor: 1.0,
        observations: 0,
        correlation: 0.5,
      };
    }

    const sa = store.signalAdjustments[signal.name];
    sa.observations++;

    // Update correlation: how often this signal's presence correlates with success
    const signalPresent = Math.abs(signal.contributed) > 0;
    if (signalPresent) {
      const currentCorrelation = sa.correlation;
      const newObs = params.validationPassed ? 1 : 0;
      // Exponential moving average
      sa.correlation = currentCorrelation + 0.1 * (newObs - currentCorrelation);
    }

    // Adjust factor based on correlation
    // Signals with high correlation → slightly increase weight
    // Signals with low correlation → slightly decrease weight
    if (sa.observations >= 5) {
      const targetFactor = 0.5 + sa.correlation;
      sa.adjustmentFactor += 0.05 * (targetFactor - sa.adjustmentFactor);
      sa.adjustmentFactor = Math.max(0.5, Math.min(1.5, sa.adjustmentFactor));
    }
  }

  store.learningIterations++;
  saveStore(store);
  cachedStore = store;
}

// ─── Adaptive Confidence Computation ─────────────────────────────────────────

/**
 * Compute confidence with adaptive signal weighting.
 * Wraps computeConfidence() and applies learned adjustments.
 */
export function computeAdaptiveConfidence(
  validationReport: ValidationReport | null,
  workspaceContext: WorkspaceContext,
  snapshot: WorkspaceSnapshot,
  repairAttempts: number,
  impactScore?: number,
): ConfidenceReport {
  const base = computeConfidence(validationReport, workspaceContext, snapshot, repairAttempts, impactScore);
  const store = getStore();

  // Apply bias adjustment if learned enough
  if (store.learningIterations >= 3) {
    const adjustedScore = Math.max(0, Math.min(100, base.score + store.biasAdjustment));
    return {
      ...base,
      score: adjustedScore,
      reasons: [
        ...base.reasons,
        ...(store.biasAdjustment !== 0
          ? [`Adaptive bias: ${store.biasAdjustment > 0 ? "+" : ""}${store.biasAdjustment.toFixed(1)} (${store.learningIterations} learning iterations)`]
          : []),
      ],
    };
  }

  return base;
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getAdaptiveConfidenceStore(): AdaptiveConfidenceStore {
  return { ...getStore() };
}

export function getLearningIterations(): number {
  return getStore().learningIterations;
}

export function getSignalAdjustments(): Record<string, SignalAdjustment> {
  return { ...getStore().signalAdjustments };
}

export function getConfidenceBiasAdjustment(): number {
  return getStore().biasAdjustment;
}

// ─── Reset ───────────────────────────────────────────────────────────────────

export function resetAdaptiveConfidence(): void {
  cachedStore = null;
  saveStore({
    signalAdjustments: {},
    biasAdjustment: 0,
    learningIterations: 0,
    lastUpdated: new Date().toISOString(),
  });
}
