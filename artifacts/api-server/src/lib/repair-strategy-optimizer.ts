// ─── Repair Strategy Optimizer — Track & Optimize Repair Patterns ──────────
// Phase 13.9
//
// Tracks repair prompt patterns and their success rates.
// Archives ineffective repair patterns and promotes successful ones.
// Used by the learning loop to improve repair quality over time.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RepairRecord {
  /** Unique identifier for this repair pattern. */
  id: string;
  /** The repair prompt that was used. */
  promptPreview: string;
  /** Number of errors in the repair. */
  errorCount: number;
  /** Whether the repair succeeded (validation passed). */
  success: boolean;
  /** Number of retries used. */
  retryCount: number;
  /** Confidence score after repair. */
  confidenceScore: number;
  /** When this repair was attempted. */
  timestamp: string;
  /** Ratio of errors resolved (0-1). 1 = all resolved, 0 = none resolved). */
  resolutionRate: number;
}

export interface RepairPatternStats {
  /** Pattern category (e.g., "missing-import", "wrong-type", "syntax-error"). */
  category: string;
  /** Number of times this pattern was used. */
  count: number;
  /** Number of successful repairs using this pattern. */
  successCount: number;
  /** Success rate (0-1). */
  successRate: number;
  /** Average resolution rate (0-1). */
  averageResolutionRate: number;
  /** Average retries needed. */
  averageRetries: number;
  /** Last used timestamp. */
  lastUsed: string;
  /** Whether this pattern is archived (ineffective). */
  archived: boolean;
}

export interface RepairStrategyStore {
  records: RepairRecord[];
  patterns: RepairPatternStats[];
  totalRepairs: number;
  totalSuccessfulRepairs: number;
  lastUpdated: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "analytics")
  : path.resolve(process.cwd(), "data", "analytics");

const STORE_PATH = path.join(DATA_DIR, "repair-performance.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): RepairStrategyStore {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(raw) as RepairStrategyStore;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[repair] Failed to load repair data, starting fresh");
  }
  return { records: [], patterns: [], totalRepairs: 0, totalSuccessfulRepairs: 0, lastUpdated: new Date().toISOString() };
}

function saveStore(store: RepairStrategyStore): void {
  try {
    ensureDataDir();
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err: String(err) }, "[repair] Failed to persist repair data");
  }
}

let cachedStore: RepairStrategyStore | null = null;

function getStore(): RepairStrategyStore {
  if (!cachedStore) cachedStore = loadStore();
  return cachedStore;
}

// ─── Categorize Repair Prompt ────────────────────────────────────────────────

const REPAIR_CATEGORIES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /missing import|cannot find module|module not found/i, category: "missing-import" },
  { pattern: /is not assignable to type|type.*not assignable|type mismatch/i, category: "wrong-type" },
  { pattern: /cannot find name|is not defined|undeclared/i, category: "undefined-variable" },
  { pattern: /property.*does not exist|has no property/i, category: "missing-property" },
  { pattern: /syntax error|unexpected token|unterminated/i, category: "syntax-error" },
  { pattern: /duplicate|already defined|already declared/i, category: "duplicate" },
  { pattern: /is declared but never used|unused variable/i, category: "unused-variable" },
  { pattern: /cannot be used as a component|not a component|jsx element/i, category: "jsx-error" },
  { pattern: /argument.*not assignable|parameter.*incompatible/i, category: "argument-type" },
  { pattern: /build|compile|emit/i, category: "build-error" },
];

function categorizeRepair(prompt: string): string {
  for (const { pattern, category } of REPAIR_CATEGORIES) {
    if (pattern.test(prompt)) return category;
  }
  return "general";
}

// ─── Record a Repair Attempt ─────────────────────────────────────────────────

export function recordRepairAttempt(params: {
  prompt: string;
  errorCount: number;
  success: boolean;
  retryCount: number;
  confidenceScore: number;
  previousErrorCount: number;
}): void {
  const store = getStore();
  const category = categorizeRepair(params.prompt);
  const resolutionRate = params.previousErrorCount > 0
    ? Math.max(0, 1 - (params.errorCount / params.previousErrorCount))
    : params.success ? 1 : 0;

  const record: RepairRecord = {
    id: `repair-${Date.now()}-${store.totalRepairs + 1}`,
    promptPreview: params.prompt.slice(0, 200),
    errorCount: params.errorCount,
    success: params.success,
    retryCount: params.retryCount,
    confidenceScore: params.confidenceScore,
    timestamp: new Date().toISOString(),
    resolutionRate,
  };

  store.records.push(record);
  store.totalRepairs++;
  if (params.success) store.totalSuccessfulRepairs++;

  // Update pattern stats
  const existingPattern = store.patterns.find((p) => p.category === category);
  if (existingPattern) {
    existingPattern.count++;
    if (params.success) existingPattern.successCount++;
    existingPattern.successRate = existingPattern.count > 0
      ? existingPattern.successCount / existingPattern.count
      : 0;
    existingPattern.averageResolutionRate =
      (existingPattern.averageResolutionRate * (existingPattern.count - 1) + resolutionRate) / existingPattern.count;
    existingPattern.averageRetries =
      (existingPattern.averageRetries * (existingPattern.count - 1) + params.retryCount) / existingPattern.count;
    existingPattern.lastUsed = new Date().toISOString();
  } else {
    store.patterns.push({
      category,
      count: 1,
      successCount: params.success ? 1 : 0,
      successRate: params.success ? 1 : 0,
      averageResolutionRate: resolutionRate,
      averageRetries: params.retryCount,
      lastUsed: new Date().toISOString(),
      archived: false,
    });
  }

  // Archive ineffective patterns (count >= 5 and success rate < 0.3)
  for (const pattern of store.patterns) {
    if (pattern.count >= 5 && pattern.successRate < 0.3 && !pattern.archived) {
      pattern.archived = true;
      logger.info({ category: pattern.category, successRate: pattern.successRate }, "[repair] Archived ineffective repair pattern");
    }
  }

  // Prune old records (keep last 200)
  if (store.records.length > 200) {
    store.records = store.records.slice(-200);
  }

  saveStore(store);
  cachedStore = store;
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getRepairPatterns(): RepairPatternStats[] {
  return [...getStore().patterns];
}

export function getActiveRepairPatterns(): RepairPatternStats[] {
  return getStore().patterns.filter((p) => !p.archived);
}

export function getArchivedRepairPatterns(): RepairPatternStats[] {
  return getStore().patterns.filter((p) => p.archived);
}

export function getTotalRepairs(): number {
  return getStore().totalRepairs;
}

export function getTotalSuccessfulRepairs(): number {
  return getStore().totalSuccessfulRepairs;
}

export function getAverageRepairSuccessRate(): number {
  const store = getStore();
  return store.totalRepairs > 0 ? store.totalSuccessfulRepairs / store.totalRepairs : 0;
}

export function getMostCommonRepairPatterns(limit = 5): RepairPatternStats[] {
  return getStore().patterns
    .filter((p) => !p.archived)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getTopRepairCategories(): string[] {
  return getStore().patterns
    .filter((p) => !p.archived && p.successRate > 0.5)
    .sort((a, b) => b.successRate - a.successRate)
    .map((p) => p.category);
}
