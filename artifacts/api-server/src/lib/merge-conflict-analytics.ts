// ─── Merge Conflict Analytics — Track & Predict Merge Conflicts ────────────
// Phase 13.9
//
// Tracks merge conflict frequency, locations, and specialist involvement.
// Predicts high-risk merges so the planner can separate conflicting tasks.

import * as fs from "fs";
import * as path from "path";
import { logger } from "./logger";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface MergeConflictRecord {
  /** The file that had a conflict. */
  file: string;
  /** Task ID that produced the first version. */
  taskIdA: string;
  /** Specialist that produced the first version. */
  specialistA: string;
  /** Task ID that produced the second version. */
  taskIdB: string;
  /** Specialist that produced the second version. */
  specialistB: string;
  /** How the conflict was resolved ("last-writer-wins", "manual"). */
  resolution: string;
  /** Timestamp of the conflict. */
  timestamp: string;
}

export interface SpecialistConflictPair {
  specialistA: string;
  specialistB: string;
  conflictCount: number;
  sharedFiles: string[];
  lastConflict: string;
}

export interface MergeConflictStore {
  records: MergeConflictRecord[];
  totalConflicts: number;
  specialistPairs: SpecialistConflictPair[];
  highRiskFiles: Array<{ file: string; conflictCount: number; specialists: string[] }>;
  lastUpdated: string;
}

// ─── Data Directory ──────────────────────────────────────────────────────────

const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR, "analytics")
  : path.resolve(process.cwd(), "data", "analytics");

const STORE_PATH = path.join(DATA_DIR, "merge-conflicts.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadStore(): MergeConflictStore {
  try {
    ensureDataDir();
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, "utf-8");
      return JSON.parse(raw) as MergeConflictStore;
    }
  } catch (err) {
    logger.warn({ err: String(err) }, "[merge] Failed to load merge data, starting fresh");
  }
  return { records: [], totalConflicts: 0, specialistPairs: [], highRiskFiles: [], lastUpdated: new Date().toISOString() };
}

function saveStore(store: MergeConflictStore): void {
  try {
    ensureDataDir();
    store.lastUpdated = new Date().toISOString();
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), "utf-8");
  } catch (err) {
    logger.error({ err: String(err) }, "[merge] Failed to persist merge data");
  }
}

let cachedStore: MergeConflictStore | null = null;

function getStore(): MergeConflictStore {
  if (!cachedStore) cachedStore = loadStore();
  return cachedStore;
}

// ─── Record a Merge Conflict ─────────────────────────────────────────────────

export function recordMergeConflict(params: {
  file: string;
  taskIdA: string;
  specialistA: string;
  taskIdB: string;
  specialistB: string;
  resolution: string;
}): void {
  const store = getStore();

  const record: MergeConflictRecord = {
    ...params,
    timestamp: new Date().toISOString(),
  };

  store.records.push(record);
  store.totalConflicts++;

  // Update specialist pair tracking
  const pairKey = [params.specialistA, params.specialistB].sort().join("::");
  const existingPair = store.specialistPairs.find(
    (p) =>
      [p.specialistA, p.specialistB].sort().join("::") === pairKey,
  );

  if (existingPair) {
    existingPair.conflictCount++;
    if (!existingPair.sharedFiles.includes(params.file)) {
      existingPair.sharedFiles.push(params.file);
    }
    existingPair.lastConflict = new Date().toISOString();
  } else {
    store.specialistPairs.push({
      specialistA: params.specialistA < params.specialistB ? params.specialistA : params.specialistB,
      specialistB: params.specialistA < params.specialistB ? params.specialistB : params.specialistA,
      conflictCount: 1,
      sharedFiles: [params.file],
      lastConflict: new Date().toISOString(),
    });
  }

  // Update high-risk files tracking
  const existingFile = store.highRiskFiles.find((f) => f.file === params.file);
  if (existingFile) {
    existingFile.conflictCount++;
    if (!existingFile.specialists.includes(params.specialistA)) {
      existingFile.specialists.push(params.specialistA);
    }
    if (!existingFile.specialists.includes(params.specialistB)) {
      existingFile.specialists.push(params.specialistB);
    }
  } else {
    store.highRiskFiles.push({
      file: params.file,
      conflictCount: 1,
      specialists: [params.specialistA, params.specialistB],
    });
  }

  // Keep only last 500 records
  if (store.records.length > 500) {
    store.records = store.records.slice(-500);
  }

  // Keep top 50 high-risk files
  store.highRiskFiles.sort((a, b) => b.conflictCount - a.conflictCount);
  if (store.highRiskFiles.length > 50) {
    store.highRiskFiles = store.highRiskFiles.slice(0, 50);
  }

  saveStore(store);
  cachedStore = store;
}

// ─── Query Methods ───────────────────────────────────────────────────────────

export function getMergeConflictRecords(): MergeConflictRecord[] {
  return [...getStore().records];
}

export function getTotalMergeConflicts(): number {
  return getStore().totalConflicts;
}

export function getHighRiskFiles(threshold = 2): Array<{ file: string; conflictCount: number; specialists: string[] }> {
  return getStore().highRiskFiles.filter((f) => f.conflictCount >= threshold);
}

export function getConflictingSpecialistPairs(): SpecialistConflictPair[] {
  return [...getStore().specialistPairs];
}

/**
 * Predict if a merge between two specialists on a given file is high-risk.
 * Returns a risk score (0-1) based on historical data.
 */
export function predictMergeRisk(specialistA: string, specialistB: string, file: string): number {
  const store = getStore();
  let risk = 0;

  // Check specialist pair history
  const pairKey = [specialistA, specialistB].sort().join("::");
  const pair = store.specialistPairs.find(
    (p) => [p.specialistA, p.specialistB].sort().join("::") === pairKey,
  );
  if (pair) {
    risk += Math.min(0.5, pair.conflictCount * 0.1);
  }

  // Check file history
  const fileRecord = store.highRiskFiles.find((f) => f.file === file);
  if (fileRecord) {
    risk += Math.min(0.4, fileRecord.conflictCount * 0.15);
  }

  return Math.min(1, risk);
}

/**
 * Get files that should be owned by a single specialist to avoid conflicts.
 */
export function getRecommendedExclusiveFiles(): Array<{ file: string; recommendedSpecialist: string; reason: string }> {
  const store = getStore();
  const result: Array<{ file: string; recommendedSpecialist: string; reason: string }> = [];

  for (const file of store.highRiskFiles) {
    if (file.conflictCount >= 3 && file.specialists.length > 1) {
      // Recommend the specialist with fewer conflicts for this file
      // (they should stay away)
      const conflictSpecialists = store.records
        .filter((r) => r.file === file.file)
        .reduce<Record<string, number>>((acc, r) => {
          acc[r.specialistA] = (acc[r.specialistA] || 0) + 1;
          acc[r.specialistB] = (acc[r.specialistB] || 0) + 1;
          return acc;
        }, {});

      const sorted = Object.entries(conflictSpecialists).sort((a, b) => b[1] - a[1]);
      if (sorted.length >= 2) {
        // Recommend the less-frequent specialist stays away
        result.push({
          file: file.file,
          recommendedSpecialist: sorted[sorted.length - 1][0],
          reason: `File has ${file.conflictCount} conflicts — ${sorted[0][0]} has ${sorted[0][1]} conflicts, recommend exclusive use by ${sorted[0][0]}`,
        });
      }
    }
  }

  return result;
}

export function getMergeConflictRate(): number {
  const store = getStore();
  const total = store.totalConflicts;
  const records = store.records.length;
  return records > 0 ? total / records : 0;
}
