// ─── RelatedFilesEngine — Intelligent File Relationship Resolver ────────────
//
// Phase 13.2.2 — Takes selectedFiles + importGraph → relatedFiles + relationReasons.
//
// Algorithm:
//   1. BFS traversal from selected files, following import edges both ways
//   2. Configurable depth limit (default 2) — never returns the entire project
//   3. Relevance scoring to rank related files
//   4. Deduplication + sorted output
//
// Scores:
//   100 — directly imported file (selected file → dependency)
//    90 — file importing selected file (dependency → selected file)
//    50 — second-degree relationship (shared component neighbourhood)
//    10 — same directory heuristic
//
// Integration: called from WorkspaceContextBuilder.build() after import graph
// is assembled. Results stored in WorkspaceContext.relatedFiles and .relationReasons.

import type { ImportEntry } from "./workspace-context";

// ─── Relation types ──────────────────────────────────────────────────────────

export type RelationType =
  | "imports"            // selected file directly imports this
  | "imported-by"        // this file directly imports the selected file
  | "transitive"         // reached via BFS beyond direct links
  | "same-directory";    // heuristic: same parent folder

// ─── A single related file entry with scoring metadata ───────────────────────

export interface RelatedFileEntry {
  /** Normalized file path */
  file: string;
  /** Human-readable explanation of why this file is related */
  reason: string;
  /** Numeric score for ranking (higher = more relevant) */
  score: number;
  /** Classification of the relationship */
  relationType: RelationType;
  /** Which selected file this relationship originates from */
  originFile: string;
  /** BFS depth at which this file was discovered (0 = selected file itself) */
  depth: number;
}

// ─── Result of the related files computation ─────────────────────────────────

export interface RelatedFilesResult {
  /** Ordered list of related file paths (highest score first) */
  relatedFiles: string[];
  /** Map of file path → human-readable reason */
  relationReasons: Record<string, string>;
  /** Full entries with metadata (for telemetry / debugging) */
  entries: RelatedFileEntry[];
  /** Actual BFS depth used (may be less than requested if graph is small) */
  traversalDepth: number;
  /** Number of selected files provided as input */
  selectedFileCount: number;
  /** Number of unique related files discovered */
  relatedFileCount: number;
  /** How many relation types were found */
  typeBreakdown: Record<RelationType, number>;
}

// ─── Scoring constants ───────────────────────────────────────────────────────

const SCORE_IMPORTS        = 100;
const SCORE_IMPORTED_BY    = 90;
const SCORE_TRANSITIVE     = 50;
const SCORE_SAME_DIRECTORY = 10;

const DEFAULT_MAX_DEPTH = 2;

// ─── RelatedFilesEngine ──────────────────────────────────────────────────────

export class RelatedFilesEngine {
  /**
   * Compute related files from a set of selected files and an import graph.
   *
   * @param selectedFiles - Files the user explicitly selected for editing
   * @param importGraph   - Import graph from ImportGraphBuilder (file → imports[])
   * @param allFiles      - Optional list of all project files (for same-directory heuristic)
   * @param maxDepth      - BFS traversal depth limit (default 2)
   * @param maxResults    - Maximum number of related files to return (default 30)
   * @returns A structured RelatedFilesResult
   */
  static compute(
    selectedFiles: string[],
    importGraph: Record<string, ImportEntry[]>,
    allFiles?: string[],
    maxDepth = DEFAULT_MAX_DEPTH,
    maxResults = 30,
  ): RelatedFilesResult {
    const start = Date.now();

    // ── Build reverse index: file → list of files that import it ──────────
    // "importedBy[file]" = all files whose imports include a resolvedPath matching `file`
    const importedBy = buildReverseIndex(importGraph);

    // ── Normalise selected file paths ─────────────────────────────────────
    const normalisedSelected = selectedFiles.map(normalizePath);
    const selectedSet = new Set(normalisedSelected);

    // ── BFS traversal ─────────────────────────────────────────────────────
    const visited = new Set<string>();
    const queue: Array<{ file: string; depth: number; origin: string }> = [];

    // Seed the queue with selected files
    for (const sf of normalisedSelected) {
      visited.add(sf);
      queue.push({ file: sf, depth: 0, origin: sf });
    }

    const entryMap = new Map<string, RelatedFileEntry>();

    while (queue.length > 0) {
      const { file, depth, origin } = queue.shift()!;

      // Skip selected files themselves — they are not "related"
      if (depth > 0 && !selectedSet.has(file)) {
        if (!entryMap.has(file) || entryMap.get(file)!.score < computeBaseScore(depth)) {
          const relationType = classifyRelation(depth, origin, file, importGraph, importedBy);
          const reason = buildReason(relationType, origin, file, importGraph, importedBy);
          const score = computeScore(relationType, depth);

          entryMap.set(file, {
            file,
            reason,
            score,
            relationType,
            originFile: origin,
            depth,
          });
        }
      }

      // Stop traversing beyond max depth
      if (depth >= maxDepth) continue;

      // ── Forward direction: files imported by this file ──────────────────
      const fwdImports = importGraph[file] ?? [];
      for (const imp of fwdImports) {
        if (imp.isExternal || !imp.resolvedPath) continue;
        const resolved = normalizePath(imp.resolvedPath);
        if (visited.has(resolved)) continue;
        visited.add(resolved);
        queue.push({ file: resolved, depth: depth + 1, origin });
      }

      // ── Reverse direction: files that import this file ──────────────────
      const revImports = importedBy.get(file) ?? [];
      for (const revFile of revImports) {
        if (visited.has(revFile)) continue;
        visited.add(revFile);
        queue.push({ file: revFile, depth: depth + 1, origin });
      }
    }

    // ── Same-directory heuristic ──────────────────────────────────────────
    // If a selected file has neighbours in the same directory, add them as
    // low-score related files (unless already discovered).
    if (allFiles) {
      for (const sf of normalisedSelected) {
        const dir = getDir(sf);
        for (const candidate of allFiles) {
          const norm = normalizePath(candidate);
          if (visited.has(norm) || selectedSet.has(norm)) continue;
          if (getDir(norm) === dir) {
            visited.add(norm);
            entryMap.set(norm, {
              file: norm,
              reason: `Shares directory with ${sf}`,
              score: SCORE_SAME_DIRECTORY,
              relationType: "same-directory",
              originFile: sf,
              depth: 0,
            });
          }
        }
      }
    }

    // ── Sort and limit ────────────────────────────────────────────────────
    const sorted = [...entryMap.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults);

    const relatedFiles = sorted.map((e) => e.file);
    const relationReasons: Record<string, string> = {};
    for (const e of sorted) {
      relationReasons[e.file] = e.reason;
    }

    // ── Type breakdown for telemetry ──────────────────────────────────────
    const typeBreakdown: Record<RelationType, number> = {
      "imports": 0,
      "imported-by": 0,
      "transitive": 0,
      "same-directory": 0,
    };
    for (const e of sorted) {
      typeBreakdown[e.relationType]++;
    }

    const result: RelatedFilesResult = {
      relatedFiles,
      relationReasons,
      entries: sorted,
      traversalDepth: maxDepth,
      selectedFileCount: normalisedSelected.length,
      relatedFileCount: sorted.length,
      typeBreakdown,
    };

    return result;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Build a reverse index: for every file, which other files import it. */
function buildReverseIndex(
  graph: Record<string, ImportEntry[]>,
): Map<string, string[]> {
  const importedBy = new Map<string, string[]>();

  for (const [importer, imports] of Object.entries(graph)) {
    for (const imp of imports) {
      if (imp.isExternal || !imp.resolvedPath) continue;
      const resolved = normalizePath(imp.resolvedPath);
      if (!importedBy.has(resolved)) {
        importedBy.set(resolved, []);
      }
      importedBy.get(resolved)!.push(importer);
    }
  }

  return importedBy;
}

/** Normalise a file path to forward slashes. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Extract the directory portion of a file path. */
function getDir(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(0, idx) : "";
}

/** Compute a base score solely from traversal depth. */
function computeBaseScore(depth: number): number {
  if (depth === 1) return 50;
  return 10;
}

/** Classify the relation type for a discovered file. */
function classifyRelation(
  depth: number,
  origin: string,
  file: string,
  graph: Record<string, ImportEntry[]>,
  importedBy: Map<string, string[]>,
): RelationType {
  if (depth === 1) {
    // Direct relationship: check which direction
    const originImports = graph[origin] ?? [];
    const directlyImported = originImports.some(
      (imp) => !imp.isExternal && imp.resolvedPath && normalizePath(imp.resolvedPath) === file,
    );
    if (directlyImported) return "imports";

    const importers = importedBy.get(file) ?? [];
    if (importers.includes(origin)) return "imported-by";
  }

  if (depth >= 2) return "transitive";
  return "transitive";
}

/** Build a human-readable reason string for a relation. */
function buildReason(
  type: RelationType,
  origin: string,
  file: string,
  graph: Record<string, ImportEntry[]>,
  importedBy: Map<string, string[]>,
): string {
  switch (type) {
    case "imports": {
      const originImports = graph[origin] ?? [];
      const imp = originImports.find(
        (i) => !i.isExternal && i.resolvedPath && normalizePath(i.resolvedPath) === file,
      );
      const specifiers = imp?.specifiers?.length ? ` (${imp.specifiers.join(", ")})` : "";
      return `imported by ${origin}${specifiers}`;
    }
    case "imported-by": {
      const importers = importedBy.get(file) ?? [];
      const importer = importers.find((i) => i === origin) ?? origin;
      return `imports ${origin}`;
    }
    case "transitive":
      return `related via ${origin}`;
    case "same-directory":
      return `shares directory with ${origin}`;
  }
}

/** Compute a numeric score for ranking. */
function computeScore(type: RelationType, depth: number): number {
  switch (type) {
    case "imports":        return SCORE_IMPORTS - depth;
    case "imported-by":    return SCORE_IMPORTED_BY - depth;
    case "transitive":     return Math.max(SCORE_TRANSITIVE - depth * 10, 5);
    case "same-directory": return SCORE_SAME_DIRECTORY;
  }
}
