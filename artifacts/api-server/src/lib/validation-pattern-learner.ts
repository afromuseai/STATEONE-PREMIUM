// ─── Validation Pattern Learner — Track Common Validation Failures ─────────
// Phase 13.9
//
// Tracks recurring validation failure patterns (missing imports, wrong types,
// broken routes, duplicate exports, unused variables, etc.).
// Provides data used to enhance future repair prompts and prioritize
// validation checks.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ValidationFailurePattern {
  /** Pattern category (e.g., "missing-import", "wrong-type", "broken-route"). */
  category: string;
  /** Example error message. */
  exampleError: string;
  /** Total count of this failure. */
  count: number;
  /** Number of times repair succeeded for this pattern. */
  repairSuccessCount: number;
  /** Success rate of repairs for this pattern (0-1). */
  repairSuccessRate: number;
  /** When this pattern was last seen. */
  lastSeen: string;
  /** File patterns where this failure commonly occurs. */
  commonFiles: string[];
  /** Suggested fix keywords derived from successful repairs. */
  suggestedFixKeywords: string[];
}

export interface ValidationPatternStore {
  patterns: Record<string, ValidationFailurePattern>;
  totalErrorsLogged: number;
  totalRepairSuccesses: number;
  lastUpdated: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "analytics")
  : path.resolve(process.cwd(), "data", "analytics");

const STORE_PATH = path.join(DATA_DIR, "validation-patterns.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): ValidationPatternStore {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(raw) as ValidationPatternStore;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[vpattern] Failed to load patterns, starting fresh");
  }
  return { patterns: {}, totalErrorsLogged: 0, totalRepairSuccesses: 0, lastUpdated: new Date().toISOString() };
}

function saveStore(store: ValidationPatternStore): void {
  try {
    ensureDataDir();
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err: String(err) }, "[vpattern] Failed to persist patterns");
  }
}

let cachedStore: ValidationPatternStore | null = null;

function getStore(): ValidationPatternStore {
  if (!cachedStore) cachedStore = loadStore();
  return cachedStore;
}

// ─── Pattern Categorization ──────────────────────────────────────────────────

const VALIDATION_PATTERNS: Array<{ pattern: RegExp; category: string; fixKeywords: string[] }> = [
  { pattern: /cannot find module|missing import|module not found|no such file/i, category: "missing-import", fixKeywords: ["import", "require", "module"] },
  { pattern: /is not assignable to type|type.*not assignable|type mismatch|type '.*' is not/i, category: "wrong-type", fixKeywords: ["type", "interface", "as", "annotation"] },
  { pattern: /cannot find name|is not defined|undeclared variable/i, category: "undefined-variable", fixKeywords: ["declare", "import", "define", "const"] },
  { pattern: /property.*does not exist|has no property/i, category: "missing-property", fixKeywords: ["property", "interface", "extend", "add"] },
  { pattern: /syntax error|unexpected token|unterminated string|unterminated template/i, category: "syntax-error", fixKeywords: ["syntax", "bracket", "brace", "quote", "template"] },
  { pattern: /duplicate identifier|already declared|already defined|conflict/i, category: "duplicate", fixKeywords: ["unique", "rename", "remove duplicate"] },
  { pattern: /is declared but never used|unused variable|unused import/i, category: "unused", fixKeywords: ["remove", "delete unused"] },
  { pattern: /not a component|cannot be used as a component|jsx element/i, category: "jsx-error", fixKeywords: ["component", "jsx", "return", "render"] },
  { pattern: /argument.*not assignable|parameter.*incompatible/i, category: "argument-type", fixKeywords: ["parameter", "argument", "signature", "call"] },
  { pattern: /route|path.*not found|404/i, category: "broken-route", fixKeywords: ["route", "path", "navigation", "link"] },
  { pattern: /build|compile|emit|webpack|vite/i, category: "build-error", fixKeywords: ["config", "build", "plugin", "loader"] },
  { pattern: /eslint|prettier|lint/i, category: "lint-error", fixKeywords: ["eslint", "prettier", "config", "rule"] },
];

function categorizeError(message: string): { category: string; fixKeywords: string[] } {
  for (const { pattern, category, fixKeywords } of VALIDATION_PATTERNS) {
    if (pattern.test(message)) return { category, fixKeywords };
  }
  return { category: "other", fixKeywords: [] };
}

// ─── Record Validation Errors ────────────────────────────────────────────────

export function recordValidationErrors(params: {
  errors: Array<{ file: string; message: string }>;
  repairSuccess: boolean;
}): void {
  if (params.errors.length === 0) return;

  const store = getStore();

  for (const err of params.errors) {
    const { category, fixKeywords } = categorizeError(err.message);

    if (!store.patterns[category]) {
      store.patterns[category] = {
        category,
        exampleError: err.message.slice(0, 200),
        count: 0,
        repairSuccessCount: 0,
        repairSuccessRate: 0,
        lastSeen: new Date().toISOString(),
        commonFiles: [],
        suggestedFixKeywords: fixKeywords,
      };
    }

    const p = store.patterns[category];
    p.count++;
    p.lastSeen = new Date().toISOString();

    // Update example error (keep the latest)
    if (p.count <= 3) {
      p.exampleError = err.message.slice(0, 200);
    }

    // Track common files (keep top 10)
    const filePath = err.file;
    if (!p.commonFiles.includes(filePath)) {
      p.commonFiles.push(filePath);
      if (p.commonFiles.length > 10) p.commonFiles.shift();
    }

    // Update fix keywords
    for (const kw of fixKeywords) {
      if (!p.suggestedFixKeywords.includes(kw)) {
        p.suggestedFixKeywords.push(kw);
      }
    }
  }

  // Repair success tracking
  if (params.repairSuccess) {
    store.totalRepairSuccesses++;
    // Increment repair success count for patterns seen in this batch
    const seenCategories = new Set(params.errors.map((e) => categorizeError(e.message).category));
    for (const cat of seenCategories) {
      if (store.patterns[cat]) {
        store.patterns[cat].repairSuccessCount++;
      }
    }
  }

  store.totalErrorsLogged += params.errors.length;

  // Recompute repair success rates
  for (const p of Object.values(store.patterns)) {
    p.repairSuccessRate = p.count > 0 ? p.repairSuccessCount / p.count : 0;
  }

  saveStore(store);
  cachedStore = store;
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getValidationPatterns(): ValidationFailurePattern[] {
  return Object.values(getStore().patterns).sort((a, b) => b.count - a.count);
}

export function getTopValidationFailures(limit = 10): ValidationFailurePattern[] {
  return Object.values(getStore().patterns)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getValidationPatternByCategory(category: string): ValidationFailurePattern | null {
  return getStore().patterns[category] ?? null;
}

export function getTotalErrorsLogged(): number {
  return getStore().totalErrorsLogged;
}

export function getTotalRepairSuccesses(): number {
  return getStore().totalRepairSuccesses;
}

export function getAverageRepairSuccessRate(): number {
  const store = getStore();
  return store.totalErrorsLogged > 0 ? store.totalRepairSuccesses / store.totalErrorsLogged : 0;
}

export function getMostCommonFailureCategory(): string {
  const patterns = getValidationPatterns();
  return patterns.length > 0 ? patterns[0].category : "none";
}

/**
 * Build a contextual hint string summarizing top validation failures.
 * Used to enhance repair prompts with data-driven context.
 */
export function buildValidationFailureHint(): string {
  const top = getTopValidationFailures(5);
  if (top.length === 0) return "";

  const lines = top.map(
    (p, i) =>
      `${i + 1}. "${p.category}" — ${p.count} occurrence(s), ` +
      `repair success rate: ${(p.repairSuccessRate * 100).toFixed(0)}%` +
      (p.suggestedFixKeywords.length > 0 ? ` (fix keywords: ${p.suggestedFixKeywords.slice(0, 3).join(", ")})` : ""),
  );

  return `\nCommon validation failures (from historical data):\n${lines.join("\n")}`;
}
