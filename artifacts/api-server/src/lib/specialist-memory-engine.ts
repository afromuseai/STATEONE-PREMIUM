// ─── Specialist Memory Engine — Persistent Specialist Memory ─────────────────
// Phase 13.7
//
// Each specialist owns an independent, isolated memory collection persisted to
// its own JSON file. Memories are extracted after successful edits, retrieved
// before task execution, and reinforced or weakened based on validation results.
//
// Storage: data/project-memory/${projectId}/specialists/${specialistId}.json
// Max memories per specialist: 12
//
// This engine is fully generic — new specialists are automatically supported
// via their specialist.id. No hardcoded file paths or agent names.

import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SpecialistMemoryType =
  | "rule"
  | "pattern"
  | "constraint"
  | "decision"
  | "warning";

export interface SpecialistMemory {
  id: string;
  /** The specialist this memory belongs to (e.g. "styling", "routing"). */
  specialistId: string;
  type: SpecialistMemoryType;
  title: string;
  value: string;
  /** Confidence score 0–100. Starts at 50. */
  confidence: number;
  /** Number of times this memory has been retrieved. */
  hitCount: number;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** The user instruction that led to this memory (for traceability). */
  sourceInstruction: string;
  /** Keywords for relevance matching. */
  keywords: string[];
}

export interface SpecialistMemoryStore {
  memories: SpecialistMemory[];
  /** Last extraction timestamp — for batching/recently check. */
  lastExtractedAt: string | null;
}

// ─── Default constants ────────────────────────────────────────────────────────

const MAX_INJECTED_MEMORIES = 12;
const DEFAULT_CONFIDENCE = 50;
const CONFIDENCE_INCREASE = 10;
const CONFIDENCE_DECREASE = 10;
const CONFIDENCE_MAX = 100;
const CONFIDENCE_MIN = 0;
const ARCHIVE_CONFIDENCE_THRESHOLD = 5;

const STORAGE_BASE = path.resolve(__dirname, "..", "..", "data", "project-memory");

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getStorageDir(projectId: string): string {
  return path.join(STORAGE_BASE, projectId, "specialists");
}

function getStoragePath(projectId: string, specialistId: string): string {
  return path.join(getStorageDir(projectId), `${specialistId}.json`);
}

function ensureStorageDir(projectId: string): void {
  const dir = getStorageDir(projectId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function loadStore(projectId: string, specialistId: string): SpecialistMemoryStore {
  try {
    const filePath = getStoragePath(projectId, specialistId);
    if (!fs.existsSync(filePath)) {
      return { memories: [], lastExtractedAt: null };
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as SpecialistMemoryStore;
  } catch (err) {
    logger.warn(
      { projectId, specialistId, err: String(err) },
      "[specialist-memory] Failed to load store, returning empty",
    );
    return { memories: [], lastExtractedAt: null };
  }
}

function saveStore(projectId: string, specialistId: string, store: SpecialistMemoryStore): void {
  try {
    ensureStorageDir(projectId);
    const filePath = getStoragePath(projectId, specialistId);
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error(
      { projectId, specialistId, err: String(err) },
      "[specialist-memory] Failed to save store",
    );
  }
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _idCounter = 0;

function generateId(): string {
  _idCounter++;
  return `spmem_${Date.now()}_${_idCounter}`;
}

// ─── Extraction rules per specialist ──────────────────────────────────────────
// Each specialist has its own set of extraction rules. Rules detect patterns
// in the user instruction, execution plan, and edit result.

interface ExtractionRule {
  type: SpecialistMemoryType;
  keywords: RegExp[];
  /** Title template — $0 is the matched keyword. */
  titleTemplate: string;
}

const SPECIALIST_EXTRACTION_RULES: Record<string, ExtractionRule[]> = {
  styling: [
    { type: "rule", keywords: [/tailwind only/i, /tailwind css only/i, /no inline styles/i], titleTemplate: "Styling Approach" },
    { type: "rule", keywords: [/use tailwind/i, /tailwind class/i, /tailwind utility/i], titleTemplate: "Tailwind Usage" },
    { type: "constraint", keywords: [/no inline styles/i, /avoid inline styles/i, /never inline style/i], titleTemplate: "Inline Styles" },
    { type: "pattern", keywords: [/border radius/i, /rounded/i, /border-radius/i], titleTemplate: "Border Radius" },
    { type: "pattern", keywords: [/subtle motion/i, /subtle animation/i, /minimal animation/i, /motion preference/i], titleTemplate: "Motion" },
    { type: "pattern", keywords: [/color scheme/i, /color palette/i, /theme color/i, /primary color/i], titleTemplate: "Color Scheme" },
    { type: "pattern", keywords: [/spacing/i, /gap/i, /padding/i, /margin/i], titleTemplate: "Spacing" },
    { type: "rule", keywords: [/responsive design/i, /responsive/i, /mobile.friendly/i, /mobile.first/i], titleTemplate: "Responsive Design" },
    { type: "decision", keywords: [/use (button|component|shared) component/i, /reuse (button|component)/i], titleTemplate: "Component Reuse" },
    { type: "warning", keywords: [/layout shift/i, /layout break/i, /overflow/i], titleTemplate: "Layout Warning" },
  ],
  routing: [
    { type: "rule", keywords: [/dashboard route/i, /dashboard layout/i, /app\/dashboard/i], titleTemplate: "Dashboard Routes" },
    { type: "pattern", keywords: [/marketing (page|layout|route)/i, /app\/marketing/i], titleTemplate: "Marketing Pages" },
    { type: "constraint", keywords: [/auth (layout|route|guard)/i, /require auth/i, /protected route/i], titleTemplate: "Auth Layout" },
    { type: "pattern", keywords: [/route group/i, /\(.*\)\/.*route/i], titleTemplate: "Route Groups" },
    { type: "decision", keywords: [/redirect/i, /navigation/i, /navigate/i, /router.push/i], titleTemplate: "Navigation Pattern" },
    { type: "warning", keywords: [/broken link/i, /404/i, /not found/i, /missing route/i], titleTemplate: "Route Warning" },
  ],
  component: [
    { type: "rule", keywords: [/shared component/i, /components\/ui/i, /common component/i], titleTemplate: "Shared Components" },
    { type: "pattern", keywords: [/hero section/i, /hero component/i, /landing page/i], titleTemplate: "Hero Section" },
    { type: "constraint", keywords: [/duplicate component/i, /duplicate button/i, /duplicate/i], titleTemplate: "No Duplicates" },
    { type: "decision", keywords: [/reuse component/i, /extract component/i, /refactor component/i], titleTemplate: "Component Extraction" },
    { type: "pattern", keywords: [/component interface/i, /component props/i, /props type/i], titleTemplate: "Component Interface" },
    { type: "warning", keywords: [/missing props/i, /undefined component/i, /component error/i], titleTemplate: "Component Warning" },
  ],
  state: [
    { type: "rule", keywords: [/use zustand/i, /zustand store/i, /zustand preferred/i], titleTemplate: "Zustand Usage" },
    { type: "constraint", keywords: [/avoid react context/i, /no react context/i, /avoid context api/i], titleTemplate: "Avoid Context" },
    { type: "constraint", keywords: [/no redux/i, /avoid redux/i, /never redux/i], titleTemplate: "No Redux" },
    { type: "pattern", keywords: [/store file/i, /lib\/store/i, /store pattern/i], titleTemplate: "Store Location" },
    { type: "decision", keywords: [/state management/i, /global state/i, /shared state/i], titleTemplate: "State Pattern" },
    { type: "warning", keywords: [/state bug/i, /state leak/i, /stale state/i], titleTemplate: "State Warning" },
  ],
  data: [
    { type: "rule", keywords: [/server action/i, /use server action/i, /server action preferred/i], titleTemplate: "Server Actions" },
    { type: "constraint", keywords: [/no rest client/i, /avoid rest client/i, /no axios/i], titleTemplate: "No REST Client" },
    { type: "constraint", keywords: [/no react query/i, /avoid react query/i, /no tanstack query/i], titleTemplate: "No React Query" },
    { type: "pattern", keywords: [/api route/i, /api endpoint/i, /api handler/i], titleTemplate: "API Routes" },
    { type: "decision", keywords: [/data fetching/i, /fetch data/i, /data loading/i], titleTemplate: "Data Fetching Pattern" },
    { type: "warning", keywords: [/api error/i, /fetch error/i, /network error/i], titleTemplate: "Data Warning" },
  ],
  performance: [
    { type: "rule", keywords: [/lazy load/i, /dynamic import/i, /code split/i], titleTemplate: "Lazy Loading" },
    { type: "pattern", keywords: [/memoize/i, /use memo/i, /use callback/i, /react memo/i], titleTemplate: "Memoization" },
    { type: "constraint", keywords: [/avoid client component/i, /no client component/i, /server component preferred/i], titleTemplate: "Client Components" },
    { type: "pattern", keywords: [/suspense/i, /suspense boundary/i, /fallback/i], titleTemplate: "Suspense" },
    { type: "decision", keywords: [/bundle size/i, /bundle optimization/i, /reduce bundle/i], titleTemplate: "Bundle Optimization" },
    { type: "warning", keywords: [/slow render/i, /performance issue/i, /re-render/i], titleTemplate: "Performance Warning" },
  ],
  accessibility: [
    { type: "rule", keywords: [/form label/i, /label required/i, /every form needs label/i], titleTemplate: "Form Labels" },
    { type: "rule", keywords: [/aria-label/i, /aria label/i, /icon.only button/i], titleTemplate: "Icon Buttons" },
    { type: "rule", keywords: [/focus ring/i, /focus visible/i, /focus style/i], titleTemplate: "Focus Rings" },
    { type: "pattern", keywords: [/keyboard navigation/i, /keyboard accessible/i, /tabindex/i], titleTemplate: "Keyboard Navigation" },
    { type: "pattern", keywords: [/screen reader/i, /aria/i, /role attribute/i], titleTemplate: "Screen Reader Support" },
    { type: "constraint", keywords: [/color contrast/i, /contrast ratio/i, /accessible color/i], titleTemplate: "Color Contrast" },
    { type: "warning", keywords: [/a11y issue/i, /accessibility issue/i, /missing alt/i], titleTemplate: "Accessibility Warning" },
  ],
  validation: [
    { type: "rule", keywords: [/use zod/i, /zod schema/i, /zod validation/i], titleTemplate: "Zod Usage" },
    { type: "rule", keywords: [/strict typescript/i, /strict type/i, /no any/i], titleTemplate: "TypeScript Strictness" },
    { type: "constraint", keywords: [/never use any/i, /no any type/i, /avoid any/i], titleTemplate: "No Any" },
    { type: "pattern", keywords: [/form validation/i, /input validation/i, /validate input/i], titleTemplate: "Form Validation" },
    { type: "decision", keywords: [/type safety/i, /type guard/i, /type assertion/i], titleTemplate: "Type Safety" },
    { type: "warning", keywords: [/type error/i, /compilation error/i, /type mismatch/i], titleTemplate: "Type Error Warning" },
  ],
  general: [
    { type: "pattern", keywords: [/configuration/i, /config file/i, /setting/i], titleTemplate: "Configuration" },
    { type: "decision", keywords: [/refactor/i, /restructure/i, /reorganize/i], titleTemplate: "Code Organization" },
    { type: "warning", keywords: [/error/i, /bug/i, /issue/i, /problem/i], titleTemplate: "General Warning" },
  ],
};

// ─── Extraction ───────────────────────────────────────────────────────────────

export interface SpecialistExtractionResult {
  extracted: SpecialistMemory[];
  extractionTimeMs: number;
}

/**
 * Extract specialist memories from a successful edit.
 *
 * Scans the user instruction, execution plan, and edit result for patterns
 * relevant to each specialist. Deduplicates against existing memories.
 */
export function extractSpecialistMemories(
  projectId: string,
  specialistId: string,
  instruction: string,
  executionPlanObjective: string,
  editSummary: string,
): SpecialistExtractionResult {
  const start = Date.now();
  const store = loadStore(projectId, specialistId);
  const extracted: SpecialistMemory[] = [];

  const rules = SPECIALIST_EXTRACTION_RULES[specialistId];
  if (!rules) {
    return { extracted: [], extractionTimeMs: Date.now() - start };
  }

  const textsToScan = [instruction, executionPlanObjective, editSummary];

  for (const text of textsToScan) {
    for (const rule of rules) {
      for (const re of rule.keywords) {
        const match = text.match(re);
        if (match) {
          // Extract a meaningful value — use the full sentence containing the match
          const sentenceEnd = text.indexOf(".", match.index!);
          const valueText = sentenceEnd >= 0
            ? text.slice(0, sentenceEnd + 1).trim()
            : text.trim();
          const value = valueText.length > 200
            ? valueText.slice(0, 200) + "..."
            : valueText;

          const memory: SpecialistMemory = {
            id: generateId(),
            specialistId,
            type: rule.type,
            title: rule.titleTemplate,
            value,
            confidence: DEFAULT_CONFIDENCE,
            hitCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            sourceInstruction: instruction,
            keywords: [rule.titleTemplate.toLowerCase(), ...match[0].toLowerCase().split(" ")],
          };

          // Deduplicate: skip if an existing memory has the same title + similar value
          const isDuplicate = store.memories.some(
            (m) =>
              m.title === memory.title &&
              (levenshteinSimilarity(m.value, memory.value) > 0.7 ||
               m.value.includes(memory.value) ||
               memory.value.includes(m.value)),
          );

          if (!isDuplicate) {
            store.memories.push(memory);
            extracted.push(memory);
          }

          // Only one match per rule per text
          break;
        }
      }
    }
  }

  if (extracted.length > 0) {
    store.lastExtractedAt = new Date().toISOString();
    saveStore(projectId, specialistId, store);
  }

  return {
    extracted,
    extractionTimeMs: Date.now() - start,
  };
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

export interface SpecialistRetrievalResult {
  memories: SpecialistMemory[];
  retrievalTimeMs: number;
}

/**
 * Retrieve the most relevant memories for a specialist.
 *
 * Only returns memories belonging to the requesting specialist.
 * Ranking considers:
 * - Keyword relevance (overlap between memory keywords and task context)
 * - Confidence (higher confidence = higher rank)
 * - Recency (newer memories score higher, decays over 30 days)
 * - Hit count (frequently retrieved memories get a boost, capped at +5)
 *
 * Returns up to MAX_INJECTED_MEMORIES (12) memories sorted by score descending.
 */
export function retrieveSpecialistMemories(
  projectId: string,
  specialistId: string,
  taskTitle: string,
  taskObjective: string,
  taskFiles: string[],
  maxResults: number = MAX_INJECTED_MEMORIES,
): SpecialistRetrievalResult {
  const start = Date.now();
  const store = loadStore(projectId, specialistId);

  if (store.memories.length === 0) {
    return { memories: [], retrievalTimeMs: Date.now() - start };
  }

  // Build query text from task context
  const queryText = [
    taskTitle,
    taskObjective,
    ...taskFiles.map((f) => path.basename(f).replace(/\.(tsx|ts|js|jsx)$/, "")),
    ...taskFiles,
  ].join(" ").toLowerCase();

  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Score each memory
  const scored = store.memories.map((memory) => {
    let score = 0;

    // Keyword relevance
    for (const kw of memory.keywords) {
      if (queryText.includes(kw.toLowerCase())) {
        score += 15;
      }
    }

    // Confidence boost (0-100 → 0-20 points)
    score += (memory.confidence / 100) * 20;

    // Recency boost (max +10, decays over 30 days)
    const age = now - new Date(memory.createdAt).getTime();
    const recencyBoost = Math.max(0, 10 - (age / thirtyDaysMs) * 10);
    score += recencyBoost;

    // Hit count boost (capped at +5)
    score += Math.min(memory.hitCount, 5);

    return { memory, score };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Return top N
  const topMemories = scored.slice(0, maxResults).map((s) => s.memory);

  // Increment hitCount for retrieved memories
  for (const mem of topMemories) {
    mem.hitCount++;
  }
  saveStore(projectId, specialistId, store);

  return {
    memories: topMemories,
    retrievalTimeMs: Date.now() - start,
  };
}

// ─── Reinforcement ────────────────────────────────────────────────────────────

export interface ReinforcementResult {
  reinforced: number;
  weakened: number;
  archived: number;
  reinforcementTimeMs: number;
}

/**
 * Reinforce or weaken specialist memories based on validation results.
 *
 * - Validation success: increase confidence by CONFIDENCE_INCREASE (10)
 * - Validation failure: decrease confidence by CONFIDENCE_DECREASE (10)
 * - Confidence capped at 0–100
 * - Memories with confidence <= ARCHIVE_CONFIDENCE_THRESHOLD (5) are archived
 *   (marked with type "warning" and kept searchable)
 */
export function reinforceSpecialistMemories(
  projectId: string,
  specialistId: string,
  validationSuccess: boolean,
  taskKeywords: string[],
): ReinforcementResult {
  const start = Date.now();
  const store = loadStore(projectId, specialistId);

  let reinforced = 0;
  let weakened = 0;
  let archived = 0;

  for (const memory of store.memories) {
    // Only reinforce/weaken memories whose keywords overlap with the task
    const hasOverlap = taskKeywords.some((kw) =>
      memory.keywords.some((mk) => mk.includes(kw) || kw.includes(mk)),
    );

    if (!hasOverlap) continue;

    if (validationSuccess) {
      // Increase confidence
      const oldConfidence = memory.confidence;
      memory.confidence = Math.min(CONFIDENCE_MAX, memory.confidence + CONFIDENCE_INCREASE);
      if (memory.confidence !== oldConfidence) reinforced++;
    } else {
      // Decrease confidence
      const oldConfidence = memory.confidence;
      memory.confidence = Math.max(CONFIDENCE_MIN, memory.confidence - CONFIDENCE_DECREASE);
      if (memory.confidence !== oldConfidence) weakened++;

      // Archive if confidence drops to threshold
      if (memory.confidence <= ARCHIVE_CONFIDENCE_THRESHOLD && memory.type !== "warning") {
        memory.type = "warning";
        archived++;
      }
    }

    memory.updatedAt = new Date().toISOString();
  }

  saveStore(projectId, specialistId, store);

  return {
    reinforced,
    weakened,
    archived,
    reinforcementTimeMs: Date.now() - start,
  };
}

// ─── Format for prompt injection ─────────────────────────────────────────────

/**
 * Format specialist memories for injection into the agent prompt.
 * Returns a markdown block like:
 *
 * ## Specialist Memory
 * • Tailwind only (confidence: 90)
 * • Border radius lg (confidence: 75)
 * • Never use inline styles (confidence: 60)
 */
export function formatSpecialistMemories(memories: SpecialistMemory[]): string {
  if (memories.length === 0) return "";

  const lines = memories.map((m) => {
    const confidenceLabel = m.confidence >= 80 ? "high" : m.confidence >= 50 ? "medium" : "low";
    return `• ${m.value} (${confidenceLabel} confidence)`;
  });

  return `## Specialist Memory\n${lines.join("\n")}`;
}

// ─── Levenshtein similarity (copied from project-memory-engine) ──────────────

function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  const distance = matrix[a.length][b.length];
  return 1 - distance / maxLen;
}

// ─── Get memory count for telemetry ──────────────────────────────────────────

export function getSpecialistMemoryCount(projectId: string, specialistId: string): number {
  const store = loadStore(projectId, specialistId);
  return store.memories.length;
}

export function getAverageConfidence(projectId: string, specialistId: string): number {
  const store = loadStore(projectId, specialistId);
  if (store.memories.length === 0) return 0;
  const total = store.memories.reduce((sum, m) => sum + m.confidence, 0);
  return Math.round(total / store.memories.length);
}

export function getAverageHitCount(projectId: string, specialistId: string): number {
  const store = loadStore(projectId, specialistId);
  if (store.memories.length === 0) return 0;
  const total = store.memories.reduce((sum, m) => sum + m.hitCount, 0);
  return Math.round(total / store.memories.length);
}
