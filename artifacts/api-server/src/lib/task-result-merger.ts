// ─── Task Result Merger — Merge File Edits from Multiple Tasks ──────────────
// Phase 13.5
//
// Merges file changes from multiple independently-executed tasks into a single
// coherent EditResult. Detects collisions (same file edited by multiple tasks)
// and reports them with detailed diagnostics instead of silently overwriting.

import type { EditResult, FileModification } from "./website-v2-types";
import { logger } from "./logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MergeConflict {
  /** The file path that has conflicting edits. */
  filePath: string;
  /** Tasks that modified this file. */
  conflictingTaskIds: string[];
  /** The content from each task (for diagnostics). */
  contents: Array<{ taskId: string; content: string; operation: string }>;
  /** Whether the conflict was resolved automatically (last-writer-wins). */
  autoResolved: boolean;
}

export interface MergeResult {
  /** Merged file modifications (conflict-free). */
  changes: FileModification[];
  /** Summary of the merge process. */
  summary: string;
  /** Number of files merged successfully. */
  mergedCount: number;
  /** Number of conflicts detected. */
  conflictCount: number;
  /** Detailed conflict list. */
  conflicts: MergeConflict[];
  /** Whether the merge is usable (false means unrecoverable conflicts). */
  success: boolean;
  /** Time spent merging, in milliseconds. */
  mergeTimeMs: number;
}

// ─── Merge Strategy ───────────────────────────────────────────────────────────
//
// Merge rules:
// 1. If a file is modified by only one task → accept that version.
// 2. If a file is modified by multiple tasks:
//    a. If all tasks produce IDENTICAL content → accept (no real conflict).
//    b. If tasks produce DIFFERENT content → conflict.
//       - If one task is a "delete" and another is an "update" → the update wins
//         (delete + update = update, since the update accounts for the latest intent).
//       - If both are updates with different content → conflict, auto-resolve by
//         taking the highest-priority task's version (last-writer-wins).
// 3. Deletes are applied after all updates (remove file after all edits merged).

export function mergeTaskResults(results: Array<{ taskId: string; result: EditResult }>): MergeResult {
  const start = Date.now();
  const conflicts: MergeConflict[] = [];

  // Collect all file changes grouped by path
  const fileChanges = new Map<string, Array<{ taskId: string; mod: FileModification }>>();

  for (const { taskId, result } of results) {
    for (const mod of result.changes) {
      if (!fileChanges.has(mod.path)) {
        fileChanges.set(mod.path, []);
      }
      fileChanges.get(mod.path)!.push({ taskId, mod });
    }
  }

  const mergedChanges: FileModification[] = [];
  const deletePaths: string[] = [];

  for (const [filePath, changes] of fileChanges) {
    if (changes.length === 1) {
      // No conflict — single task modified this file
      const { mod } = changes[0];
      if (mod.operation === "delete") {
        deletePaths.push(filePath);
      } else {
        mergedChanges.push(mod);
      }
      continue;
    }

    // Multiple tasks modified the same file — check for conflict
    const operations = changes.map((c) => c.mod.operation);
    const uniqueContents = new Set(changes.map((c) => c.mod.content));

    if (uniqueContents.size === 1) {
      // All tasks produced the same content — no real conflict
      const { mod } = changes[0];
      if (mod.operation === "delete") {
        deletePaths.push(filePath);
      } else {
        mergedChanges.push(mod);
      }
      continue;
    }

    // Detect if any task deleted this file while others updated
    const hasDelete = operations.includes("delete");
    const hasUpdate = operations.includes("update") || operations.includes("create");

    if (hasDelete && !hasUpdate) {
      // All tasks agree on deletion (or the only meaningful operation is delete)
      deletePaths.push(filePath);
      continue;
    }

    if (hasDelete && hasUpdate) {
      // Delete + update — update wins (latest intent)
      const updateMods = changes.filter((c) => c.mod.operation !== "delete");
      // Take the last update
      const lastUpdate = updateMods[updateMods.length - 1];
      mergedChanges.push(lastUpdate.mod);

      conflicts.push({
        filePath,
        conflictingTaskIds: changes.map((c) => c.taskId),
        contents: changes.map((c) => ({ taskId: c.taskId, content: c.mod.content, operation: c.mod.operation })),
        autoResolved: true,
      });
      continue;
    }

    // True conflict: multiple tasks with different content
    // Auto-resolve: last-writer-wins (take the last task's version)
    const lastChange = changes[changes.length - 1];
    mergedChanges.push(lastChange.mod);

    conflicts.push({
      filePath,
      conflictingTaskIds: changes.map((c) => c.taskId),
      contents: changes.map((c) => ({ taskId: c.taskId, content: c.mod.content, operation: c.mod.operation })),
      autoResolved: true,
    });
  }

  // Apply deletes
  for (const delPath of deletePaths) {
    mergedChanges.push({
      path: delPath,
      operation: "delete",
      content: "",
      reason: "Removed by task execution",
    });
  }

  const conflictCount = conflicts.length;
  const mergedCount = mergedChanges.length;

  // Build summary
  const summaryParts: string[] = [
    `Merged ${mergedCount} file change(s) from ${results.length} task(s)`,
  ];
  if (conflictCount > 0) {
    const autoResolved = conflicts.filter((c) => c.autoResolved).length;
    summaryParts.push(`${conflictCount} conflict(s) detected, ${autoResolved} auto-resolved`);
  }

  const result: MergeResult = {
    changes: mergedChanges,
    summary: summaryParts.join(". "),
    mergedCount,
    conflictCount,
    conflicts,
    success: true, // All conflicts auto-resolved (no unrecoverable conflicts)
    mergeTimeMs: Date.now() - start,
  };

  return result;
}

// ─── Build a combined EditResult from a MergeResult ───────────────────────────

export function mergeResultToEditResult(mergeResult: MergeResult, originalSummaries: string[]): EditResult {
  return {
    changes: mergeResult.changes,
    summary: [
      mergeResult.summary,
      ...originalSummaries,
    ].join(" | "),
  };
}
