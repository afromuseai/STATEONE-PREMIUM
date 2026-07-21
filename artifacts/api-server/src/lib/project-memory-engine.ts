// ─── Project Memory Engine — Semantic Project Memory ─────────────────────────
// Phase 13.3.2
//
// Records, retrieves, and ranks architectural decisions, design decisions,
// conventions, preferences, and constraints per project. Memories are persisted
// as JSON files scoped to projectId and injected into WorkspaceContext so the
// editing agent is aware of past decisions.
//
// Storage: data/project-memory/${projectId}.json
// Max memories: 15 injected into context

import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProjectMemoryType =
  | "architecture"
  | "design"
  | "convention"
  | "preference"
  | "constraint";

export interface ProjectMemory {
  id: string;
  type: ProjectMemoryType;
  title: string;
  value: string;
  /** The user instruction or pattern that led to this memory (for traceability). */
  source: string;
  /** ISO timestamp of creation. */
  createdAt: string;
  /** Number of times this memory has been retrieved (for frequency ranking). */
  hitCount: number;
  /** Optional list of keywords for relevance matching. */
  keywords?: string[];
}

export interface ProjectMemoryStore {
  memories: ProjectMemory[];
  /** Last extraction timestamp — for batching/recently check. */
  lastExtractedAt: string | null;
}

// ─── Default constants ────────────────────────────────────────────────────────

const MAX_INJECTED_MEMORIES = 15;
const STORAGE_DIR = path.resolve(__dirname, "..", "..", "data", "project-memory");

// ─── Storage helpers ──────────────────────────────────────────────────────────

function getStoragePath(projectId: string): string {
  return path.join(STORAGE_DIR, `${projectId}.json`);
}

function ensureStorageDir(): void {
  if (!fs.existsSync(STORAGE_DIR)) {
    fs.mkdirSync(STORAGE_DIR, { recursive: true });
  }
}

function loadStore(projectId: string): ProjectMemoryStore {
  try {
    const filePath = getStoragePath(projectId);
    if (!fs.existsSync(filePath)) {
      return { memories: [], lastExtractedAt: null };
    }
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ProjectMemoryStore;
  } catch (err) {
    logger.warn({ projectId, err: String(err) }, "[project-memory] Failed to load store, returning empty");
    return { memories: [], lastExtractedAt: null };
  }
}

function saveStore(projectId: string, store: ProjectMemoryStore): void {
  try {
    ensureStorageDir();
    const filePath = getStoragePath(projectId);
    fs.writeFileSync(filePath, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ projectId, err: String(err) }, "[project-memory] Failed to save store");
  }
}

// ─── ID generation ────────────────────────────────────────────────────────────

let _idCounter = 0;

function generateId(): string {
  _idCounter++;
  return `mem_${Date.now()}_${_idCounter}`;
}

// ─── Extraction patterns ─────────────────────────────────────────────────────
// Keyword-based detection of candidate memories from user instructions and
// accepted/rejected patterns.

interface ExtractionRule {
  type: ProjectMemoryType;
  keywords: RegExp[];
  /** Title template — $0 is the matched keyword. */
  titleTemplate: string;
}

const EXTRACTION_RULES: ExtractionRule[] = [
  {
    type: "design",
    keywords: [/tailwind only/i, /tailwind css only/i, /no inline styles/i],
    titleTemplate: "Styling",
  },
  {
    type: "architecture",
    keywords: [/zustand/i, /use zustand/i, /zustand store/i],
    titleTemplate: "State Management",
  },
  {
    type: "architecture",
    keywords: [/use context/i, /react context/i, /context api/i],
    titleTemplate: "State Management",
  },
  {
    type: "architecture",
    keywords: [/redux/i, /use redux/i],
    titleTemplate: "State Management",
  },
  {
    type: "constraint",
    keywords: [/no (external|extra|new|additional) (ui|component) (library|libraries|kits?)/i,
               /do not add (new|extra) (dependencies|packages|libs)/i,
               /no additional (npm|package) (dependencies|install)/i],
    titleTemplate: "Dependencies",
  },
  {
    type: "preference",
    keywords: [/prefer subtle motion/i, /subtle animation/i, /minimal animation/i],
    titleTemplate: "Animations",
  },
  {
    type: "convention",
    keywords: [/components?\/(ui|shared|common)/i, /shared ui components/i],
    titleTemplate: "Components",
  },
  {
    type: "convention",
    keywords: [/file naming convention/i, /pascalcase file/i, /kebab-case file/i],
    titleTemplate: "File Naming",
  },
  {
    type: "preference",
    keywords: [/dark mode/i, /light mode/i, /dark theme/i],
    titleTemplate: "Theme",
  },
  {
    type: "architecture",
    keywords: [/server components/i, /client components/i, /use client/i, /use server/i],
    titleTemplate: "Component Architecture",
  },
  {
    type: "constraint",
    keywords: [/no (typescript|type) errors/i, /must compile/i, /zero errors/i],
    titleTemplate: "Type Safety",
  },
  {
    type: "design",
    keywords: [/responsive design/i, /mobile.friendly/i, /mobile.first/i],
    titleTemplate: "Responsive Design",
  },
];

// ─── Extraction ───────────────────────────────────────────────────────────────

export interface ExtractionResult {
  extracted: ProjectMemory[];
  extractionTimeMs: number;
}

/**
 * Inspect a user instruction and accepted/rejected patterns to detect
 * candidate project memories.
 *
 * This is called after a successful edit. Detected memories are deduplicated
 * against existing ones (by title + value similarity) before storing.
 */
export function extractMemories(
  projectId: string,
  instruction: string,
  acceptedPatterns: string[] = [],
  rejectedPatterns: string[] = [],
): ExtractionResult {
  const start = Date.now();
  const store = loadStore(projectId);
  const extracted: ProjectMemory[] = [];

  const textsToScan = [instruction, ...acceptedPatterns, ...rejectedPatterns];

  for (const text of textsToScan) {
    for (const rule of EXTRACTION_RULES) {
      for (const re of rule.keywords) {
        const match = text.match(re);
        if (match) {
          // Extract a meaningful value from context — use the full sentence
          // containing the match, capped at 200 chars.
          const sentenceEnd = text.indexOf(".", match.index!);
          const valueText = sentenceEnd >= 0
            ? text.slice(0, sentenceEnd + 1).trim()
            : text.trim();
          const value = valueText.length > 200
            ? valueText.slice(0, 200) + "..."
            : valueText;

          const memory: ProjectMemory = {
            id: generateId(),
            type: rule.type,
            title: rule.titleTemplate,
            value,
            source: instruction,
            createdAt: new Date().toISOString(),
            hitCount: 0,
            keywords: [rule.titleTemplate.toLowerCase()],
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
    saveStore(projectId, store);
  }

  return {
    extracted,
    extractionTimeMs: Date.now() - start,
  };
}

// ─── Manual memory addition ───────────────────────────────────────────────────

/**
 * Add a single memory directly (e.g., from user preference or explicit recording).
 */
export function addMemory(projectId: string, memory: Omit<ProjectMemory, "id" | "createdAt" | "hitCount">): ProjectMemory {
  const store = loadStore(projectId);
  const newMemory: ProjectMemory = {
    ...memory,
    id: generateId(),
    createdAt: new Date().toISOString(),
    hitCount: 0,
  };
  store.memories.push(newMemory);
  saveStore(projectId, store);
  return newMemory;
}

// ─── Retrieval ────────────────────────────────────────────────────────────────

export interface RetrievalResult {
  memories: ProjectMemory[];
  retrievalTimeMs: number;
}

/**
 * Retrieve the most relevant project memories for a given edit context.
 *
 * Relevance scoring considers:
 * - Keyword overlap between the instruction/selected files and memory keywords
 * - Recency (newer memories score higher)
 * - Frequency (memories retrieved more often get a boost)
 *
 * Returns up to MAX_INJECTED_MEMORIES (15) memories sorted by score descending.
 */
export function retrieveMemories(
  projectId: string,
  instruction: string,
  selectedFiles: string[] = [],
  maxResults: number = MAX_INJECTED_MEMORIES,
): RetrievalResult {
  const start = Date.now();
  const store = loadStore(projectId);

  if (store.memories.length === 0) {
    return { memories: [], retrievalTimeMs: Date.now() - start };
  }

  // Build a combined text for matching
  const queryText = [
    instruction,
    ...selectedFiles.map((f) => path.basename(f).replace(/\.(tsx|ts|js|jsx)$/, "")),
    ...selectedFiles,
  ].join(" ").toLowerCase();

  const scored = store.memories.map((mem) => {
    let score = 0;

    // ── Relevance: keyword overlap ──────────────────────────────────────
    const memKeywords = mem.keywords ?? [mem.title.toLowerCase(), ...mem.value.toLowerCase().split(/\s+/).slice(0, 10)];
    for (const kw of memKeywords) {
      if (queryText.includes(kw.toLowerCase())) {
        score += 10;
      }
    }

    // Check if instruction contains the memory title or type
    if (queryText.includes(mem.title.toLowerCase())) {
      score += 15;
    }
    if (queryText.includes(mem.type.toLowerCase())) {
      score += 5;
    }

    // ── Recency: newer memories get a boost (max +10) ───────────────────
    const ageMs = Date.now() - new Date(mem.createdAt).getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - ageDays); // 10 points for today, 0 after 10 days

    // ── Frequency: each past retrieval adds +2 (capped at +10) ──────────
    score += Math.min(10, mem.hitCount * 2);

    return { memory: mem, score };
  });

  // Sort by score descending, then by hitCount (tiebreaker)
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.memory.hitCount - a.memory.hitCount;
  });

  // Increment hitCount for the returned memories
  const selected = scored.slice(0, maxResults);
  for (const { memory } of selected) {
    memory.hitCount = (memory.hitCount ?? 0) + 1;
  }
  saveStore(projectId, store);

  return {
    memories: selected.map((s) => s.memory),
    retrievalTimeMs: Date.now() - start,
  };
}

// ─── Format for WorkspaceContext injection ────────────────────────────────────

/**
 * Format retrieved memories into a concise, LLM-friendly text block.
 */
export function formatProjectMemories(memories: ProjectMemory[]): string {
  if (memories.length === 0) return "";

  const byType = groupBy(memories, (m) => m.type);
  const lines: string[] = ["Project Memory:"];

  const typeOrder: ProjectMemoryType[] = ["architecture", "design", "convention", "preference", "constraint"];
  for (const t of typeOrder) {
    const group = byType.get(t);
    if (!group?.length) continue;
    const label = t.charAt(0).toUpperCase() + t.slice(1);
    lines.push(`  ${label}:`);
    for (const mem of group) {
      lines.push(`    - ${mem.title}: ${mem.value}`);
    }
  }

  return lines.join("\n");
}

// ─── Clear all memories for a project ────────────────────────────────────────

export function clearMemories(projectId: string): void {
  const store = loadStore(projectId);
  store.memories = [];
  store.lastExtractedAt = null;
  saveStore(projectId, store);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const group = map.get(key);
    if (group) {
      group.push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/**
 * Simple Levenshtein-based similarity (0–1). Used for duplicate detection.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const aLen = a.length;
  const bLen = b.length;
  const maxDist = Math.max(aLen, bLen);

  // Build distance matrix (single row optimization)
  let prev: number[] = [];
  for (let j = 0; j <= bLen; j++) prev[j] = j;

  for (let i = 1; i <= aLen; i++) {
    const curr: number[] = [i];
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost,
      );
    }
    prev = curr;
  }

  return 1 - prev[bLen] / maxDist;
}
