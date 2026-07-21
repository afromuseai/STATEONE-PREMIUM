// ─── ImportGraphBuilder — Project-level import relationship scanner ──────────
//
// Phase 13.2.1 — Builds the import graph from ProjectFile[] data.
//
// Scans every file in the project, extracts import/require statements,
// classifies them as local or external, resolves local paths against
// the project file set (supporting extension resolution, index files,
// and TypeScript path aliases), and identifies dangling/unresolvable imports.
//
// The result is cached per projectId and invalidated when files change.

import path from "node:path";
import type { ImportEntry } from "./workspace-context";
import type { ProjectFile } from "./website-v2-types";

// ─── Resolvable file extensions (in priority order) ──────────────────────────
const RESOLVABLE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

// ─── Regex to extract import/require sources from file content ───────────────
//
// Matches:
//   import ... from "module"
//   import("module")
//   require("module")
//   export ... from "module"
//
// Captures the module source string in capture group 1.
const IMPORT_RE =
  /(?:import|export)\s*(?:(?:type\s+)?(?:\{[^}]*\}|[^;"'`]+)\s+from\s+|\(\s*)|require\s*\(\s*/;

// ─── Regex to extract the source string from a matched import statement ───────
// After IMPORT_RE matches, this extracts the "module" part from `from "module"`.
const SOURCE_RE = /["'`]([^"'`]+)["'`]/;

// ─── Regex to extract imported specifiers ─────────────────────────────────────
//
// Extracts the list of imported symbols from an import statement like:
//   import { Foo, type Bar, Baz } from "./module"
// Returns: ["Foo", "Bar", "Baz"]
const SPECIFIER_RE = /import\s+(?:type\s+)?(?:\{\s*([^}]+)\s*\}|(\w+))\s+from/g;

// ─── Regex to detect type-only imports ───────────────────────────────────────
// Matches `import type { ... }` or `import { type ... }` patterns.
const TYPE_ONLY_RE = /import\s+type\s+{|import\s+\{[^}]*\btype\s+/g;

// ─── Regex to detect external (non-relative, non-alias) imports ──────────────
// External imports start with a letter, @scope, or node: prefix.
const EXTERNAL_RE = /^(?:@[^/]+\/|[a-zA-Z_][a-zA-Z0-9_]*|node:)/;

// ─── ImportGraph result — the full graph and any unresolved imports ──────────

export interface ImportGraphResult {
  /** Map of file path → list of imports found in that file */
  graph: Record<string, ImportEntry[]>;
  /** Import statements that couldn't be resolved to a project file */
  dangling: Array<{ file: string; importSource: string }>;
  /** Total number of import statements found across all files */
  totalImports: number;
  /** Number of files scanned */
  filesScanned: number;
  /** Build time in milliseconds */
  buildTimeMs: number;
}

// ─── Cache entry ─────────────────────────────────────────────────────────────

interface CacheEntry {
  result: ImportGraphResult;
  /** Timestamp when the cache entry was created */
  createdAt: number;
  /** Hash of file paths + lengths for invalidation */
  fileSignature: string;
}

// ─── ImportGraphBuilder ──────────────────────────────────────────────────────

export class ImportGraphBuilder {
  /** Per-project cache: projectId → CacheEntry */
  private static cache = new Map<string, CacheEntry>();

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Build (or retrieve from cache) the import graph for a set of project files.
   *
   * @param projectId - Unique project identifier for cache scoping
   * @param files - Full set of project files
   * @param pathAliases - TypeScript path aliases (e.g. { "@": "./src/*" })
   * @param forceRebuild - Skip cache and rebuild from scratch
   * @returns The import graph result
   */
  static build(
    projectId: string,
    files: ProjectFile[],
    pathAliases?: Record<string, string>,
    forceRebuild = false,
  ): ImportGraphResult {
    const start = Date.now();

    // ── Cache check ──────────────────────────────────────────────────────────
    const signature = computeFileSignature(files);
    if (!forceRebuild) {
      const cached = ImportGraphBuilder.cache.get(projectId);
      if (cached && cached.fileSignature === signature) {
        return {
          ...cached.result,
          buildTimeMs: Date.now() - start, // cache lookup is near-instant
        };
      }
    }

    // ── Build file lookup ───────────────────────────────────────────────────
    // Map of normalized file path → content for quick resolution
    const fileMap = new Map<string, string>();
    for (const f of files) {
      fileMap.set(normalizePath(f.path), f.content);
    }

    // ── Scan each file for imports ──────────────────────────────────────────
    const graph: Record<string, ImportEntry[]> = {};
    const dangling: Array<{ file: string; importSource: string }> = [];
    let totalImports = 0;
    let filesScanned = 0;

    // Pre-compute alias patterns for resolution
    const aliasPatterns = buildAliasPatterns(pathAliases);

    for (const f of files) {
      const filePath = normalizePath(f.path);
      const content = f.content;
      if (!content || content.trim().length === 0) continue;

      const imports = extractImports(content, filePath, fileMap, aliasPatterns);
      if (imports.length > 0) {
        graph[filePath] = imports;
        totalImports += imports.length;

        // Collect dangling imports
        for (const imp of imports) {
          if (!imp.isExternal && imp.resolvedPath === null) {
            dangling.push({ file: filePath, importSource: imp.source });
          }
        }
      }
      filesScanned++;
    }

    const buildTimeMs = Date.now() - start;
    const result: ImportGraphResult = {
      graph,
      dangling,
      totalImports,
      filesScanned,
      buildTimeMs,
    };

    // ── Cache ────────────────────────────────────────────────────────────────
    ImportGraphBuilder.cache.set(projectId, {
      result,
      createdAt: Date.now(),
      fileSignature: signature,
    });

    return result;
  }

  /**
   * Invalidate the cache for a specific project.
   * Call this after the edit/generation pipeline writes files.
   */
  static invalidate(projectId: string): void {
    ImportGraphBuilder.cache.delete(projectId);
  }

  /**
   * Clear all cached import graphs (e.g. on server restart hooks).
   */
  static clearAll(): void {
    ImportGraphBuilder.cache.clear();
  }

  /**
   * Get cache stats for telemetry.
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: ImportGraphBuilder.cache.size,
      keys: [...ImportGraphBuilder.cache.keys()],
    };
  }
}

// ─── Internal: path helpers ───────────────────────────────────────────────────

/** Normalize a file path to use forward slashes and remove leading slash. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\//, "");
}

/** Compute a quick signature for cache invalidation based on file paths + lengths. */
function computeFileSignature(files: ProjectFile[]): string {
  // Sort by path for stable ordering, then join path+length
  const parts = files
    .map(f => `${normalizePath(f.path)}:${f.content.length}`)
    .sort();
  return parts.join("|");
}

/** Build regex patterns from path aliases for resolution. */
function buildAliasPatterns(
  aliases?: Record<string, string>,
): Array<{ prefix: string; target: string }> {
  if (!aliases) return [];
  return Object.entries(aliases).map(([key, value]) => {
    // Normalize: "@/*" → "@", "./src/*" → "src"
    const prefix = key.replace(/\/\*$/, "");
    const target = value.replace(/\/\*$/, "").replace(/^\.\//, "");
    return { prefix, target };
  });
}

// ─── Internal: import extraction ─────────────────────────────────────────────

/** Check if an import source is an external package. */
function isExternalSource(source: string): boolean {
  return EXTERNAL_RE.test(source);
}

/** Resolve a local import path against the project file map. */
function resolveLocalPath(
  source: string,
  importingFile: string,
  fileMap: Map<string, string>,
  aliasPatterns: Array<{ prefix: string; target: string }>,
): string | null {
  let resolved: string;

  // ── Try alias resolution first ────────────────────────────────────────────
  const aliasMatch = tryAliasResolution(source, aliasPatterns);
  if (aliasMatch !== null) {
    resolved = aliasMatch;
  } else {
    // ── Relative import ────────────────────────────────────────────────────
    const dir = path.dirname(importingFile);
    const abs = path.posix.join(dir, source);
    resolved = normalizePath(abs);
  }

  // ── Try exact match ───────────────────────────────────────────────────────
  if (fileMap.has(resolved)) return resolved;

  // ── Try with resolvable extensions ────────────────────────────────────────
  for (const ext of RESOLVABLE_EXTENSIONS) {
    const withExt = resolved + ext;
    if (fileMap.has(withExt)) return withExt;
  }

  // ── Try as index file ─────────────────────────────────────────────────────
  for (const ext of RESOLVABLE_EXTENSIONS) {
    const index = path.posix.join(resolved, "index" + ext);
    if (fileMap.has(index)) return index;
  }

  return null;
}

/** Try to resolve a source string using TypeScript path aliases. */
function tryAliasResolution(
  source: string,
  patterns: Array<{ prefix: string; target: string }>,
): string | null {
  for (const { prefix, target } of patterns) {
    if (source.startsWith(prefix)) {
      const rest = source.slice(prefix.length).replace(/^\//, "");
      const resolved = target ? path.posix.join(target, rest) : rest;
      return normalizePath(resolved);
    }
  }
  return null;
}

/** Extract all import entries from a file's content. */
function extractImports(
  content: string,
  filePath: string,
  fileMap: Map<string, string>,
  aliasPatterns: Array<{ prefix: string; target: string }>,
): ImportEntry[] {
  const entries: ImportEntry[] = [];
  const seen = new Set<string>();

  // ── Pass 1: Find all import sources ───────────────────────────────────────
  // Strategy: find import/export/require statements, then extract the source string
  const lines = content.split("\n");
  for (const line of lines) {
    // Skip comments and string literals that aren't imports
    const trimmed = line.trim();
    if (!trimmed.startsWith("import") && !trimmed.startsWith("export") && !trimmed.startsWith("require")) continue;

    // Match import/export/require patterns
    if (!IMPORT_RE.test(trimmed)) continue;

    // Extract the source string (the "module" or "./path" part)
    SOURCE_RE.lastIndex = 0;
    const srcMatch = SOURCE_RE.exec(trimmed);
    if (!srcMatch) continue;

    const source = srcMatch[1].trim();
    if (!source || seen.has(source)) continue;
    seen.add(source);

    const isExternal = isExternalSource(source);
    const resolvedPath = isExternal
      ? null
      : resolveLocalPath(source, filePath, fileMap, aliasPatterns);

    // ── Extract specifiers ────────────────────────────────────────────────
    const specifiers = extractSpecifiers(content, source);

    // ── Detect type-only import ───────────────────────────────────────────
    const isTypeOnly = detectTypeOnly(content, source);

    entries.push({
      source,
      resolvedPath,
      isExternal,
      specifiers,
      isTypeOnly,
    });
  }

  return entries;
}

/** Extract imported symbol names from import statements for a specific source. */
function extractSpecifiers(content: string, targetSource: string): string[] {
  // Find the import statement that references targetSource
  const lines = content.split("\n");
  for (const line of lines) {
    if (!line.includes(targetSource)) continue;

    // Try default import: `import Foo from "..."`
    const defaultMatch = line.match(
      new RegExp(`import\\s+(?:type\\s+)?(\\w+)\\s+from\\s+["'\`]${escapeRegex(targetSource)}["'\`]`),
    );
    if (defaultMatch) return [defaultMatch[1]];

    // Try named import: `import { Foo, Bar } from "..."`
    const namedMatch = line.match(
      new RegExp(`import\\s+(?:type\\s+)?\\{\\s*([^}]+)\\s*\\}\\s+from\\s+["'\`]${escapeRegex(targetSource)}["'\`]`),
    );
    if (namedMatch) {
      return namedMatch[1]
        .split(",")
        .map(s => s.trim().replace(/\btype\s+/g, "").split(/\s+as\s+/)[0])
        .filter(Boolean);
    }

    // Try namespace import: `import * as Foo from "..."`
    const nsMatch = line.match(
      new RegExp(`import\\s+(?:type\\s+)?\\*\\s+as\\s+(\\w+)\\s+from\\s+["'\`]${escapeRegex(targetSource)}["'\`]`),
    );
    if (nsMatch) return [`* as ${nsMatch[1]}`];

    // Try side-effect import: `import "..."`
    const sideEffect = line.match(
      new RegExp(`import\\s+["'\`]${escapeRegex(targetSource)}["'\`]`),
    );
    if (sideEffect) return [];
  }

  return [];
}

/** Detect if an import is type-only for a specific source. */
function detectTypeOnly(content: string, targetSource: string): boolean {
  const escaped = escapeRegex(targetSource);
  // Check for `import type { ... } from "target"`
  const typeOnlyImport = new RegExp(
    `import\\s+type\\s+(?:\\{|\\*|\\w+)\\s+from\\s+["'\`]${escaped}["'\`]`,
  );
  if (typeOnlyImport.test(content)) return true;

  // Check for `import { type Foo } from "target"` — inline type modifier
  // This is harder to detect reliably without a full parser,
  // so we check for `type ` prefix inside the braces
  const inlineType = new RegExp(
    `import\\s+\\{[^}]*\\btype\\b[^}]*\\}\\s+from\\s+["'\`]${escaped}["'\`]`,
  );
  if (inlineType.test(content)) return true;

  return false;
}

/** Escape special regex characters in a string. */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
