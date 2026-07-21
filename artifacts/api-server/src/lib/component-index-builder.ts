// ─── ComponentIndexBuilder — React Component Intelligence Scanner ──────────
//
// Phase 13.2.3 — Scans project files to build a component index and usage map.
//
// Detection:
//   - Default exports: `export default function Foo`, `export default () =>`
//   - Named exports: `export function Foo`, `export const Foo =`
//   - Arrow components: `export const Foo = () =>`, `export const Foo = (props)`
//   - JSX usage: `<Foo`, `<Foo `, `</Foo>`
//
// The result is cached per projectId and invalidated when files change,
// matching the same strategy as ImportGraphBuilder.
//
// Integration: called from WorkspaceContextBuilder.build() after import graph
// is assembled. Results stored in WorkspaceContext.componentIndex and
// WorkspaceContext.componentUsage.

import path from "node:path";
import type { ImportEntry } from "./workspace-context";
import type { ProjectFile } from "./website-v2-types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ComponentType = "react" | "function" | "unknown";

export interface ComponentEntry {
  /** Display name of the component (e.g. "HeroSection") */
  name: string;
  /** Path to the file where the component is defined */
  filePath: string;
  /** Whether it's a default or named export */
  exportType: "default" | "named";
  /** Classification hint for the LLM */
  componentType: ComponentType;
}

export interface ComponentIndexResult {
  /** All discovered components */
  index: ComponentEntry[];
  /** Map of file path → component names used as JSX in that file */
  usage: Record<string, string[]>;
  /** Number of files scanned */
  filesScanned: number;
  /** Total components found */
  componentsFound: number;
  /** Files that failed to parse */
  parseFailures: number;
  /** Build time in milliseconds */
  buildTimeMs: number;
}

// ─── Regex patterns ─────────────────────────────────────────────────────────

/** Match `export default function ComponentName` */
const DEFAULT_FUNCTION_RE = /export\s+default\s+function\s+(\w+)/g;

/** Match `export default () =>` or `export default (props) =>` (anonymous default arrow) */
const DEFAULT_ARROW_RE = /export\s+default\s*(?:\([^)]*\)\s*)?=>/g;

/** Match `export default class ComponentName` */
const DEFAULT_CLASS_RE = /export\s+default\s+class\s+(\w+)/g;

/** Match `export default <identifier>` (variable reference as default) */
const DEFAULT_VAR_RE = /export\s+default\s+(\w+);?$/gm;

/** Match `export function ComponentName` */
const NAMED_FUNCTION_RE = /export\s+function\s+(\w+)/g;

/** Match `export const ComponentName =` (arrow or function expression) */
const NAMED_CONST_RE = /export\s+(?:const|let|var)\s+(\w+)\s*=[^;]*?(?:=>|function\s*\()/g;

/** Match JSX usage: `<ComponentName` but not `<div`, `<span`, etc. */
const JSX_TAG_RE = /<([A-Z]\w*)(?:\s|>|\/)/g;

/** Check if a file contains JSX by looking for HTML-like tags */
const JSX_CHECK_RE = /<[A-Za-z][A-Za-z0-9]*[\s>\/]/;

/** Check if a file imports React */
const REACT_IMPORT_RE = /import\s+React\s+from\s+["']react["']/;

// ─── File extension filters ─────────────────────────────────────────────────

const SCANNABLE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);

// ─── Cache entry ─────────────────────────────────────────────────────────────

interface CacheEntry {
  result: ComponentIndexResult;
  createdAt: number;
  fileSignature: string;
}

// ─── ComponentIndexBuilder ───────────────────────────────────────────────────

export class ComponentIndexBuilder {
  /** Per-project cache: projectId → CacheEntry */
  private static cache = new Map<string, CacheEntry>();

  /**
   * Build (or retrieve from cache) the component index for a set of project files.
   *
   * @param projectId - Unique project identifier for cache scoping
   * @param files - Full set of project files
   * @param importGraph - Optional import graph for cross-referencing usage
   * @param forceRebuild - Skip cache and rebuild from scratch
   * @returns The component index result
   */
  static build(
    projectId: string,
    files: ProjectFile[],
    importGraph?: Record<string, ImportEntry[]>,
    forceRebuild = false,
  ): ComponentIndexResult {
    const start = Date.now();

    // ── Cache check ──────────────────────────────────────────────────────────
    const signature = computeFileSignature(files);
    if (!forceRebuild) {
      const cached = ComponentIndexBuilder.cache.get(projectId);
      if (cached && cached.fileSignature === signature) {
        return {
          ...cached.result,
          buildTimeMs: Date.now() - start,
        };
      }
    }

    // ── Scan files ───────────────────────────────────────────────────────────
    const index: ComponentEntry[] = [];
    const usage: Record<string, string[]> = {};
    let filesScanned = 0;
    let parseFailures = 0;

    for (const f of files) {
      const ext = path.extname(f.path).toLowerCase();
      if (!SCANNABLE_EXTENSIONS.has(ext)) continue;

      const content = f.content;
      if (!content || content.trim().length === 0) continue;

      filesScanned++;

      try {
        // ── Detect component definitions ─────────────────────────────────
        const components = extractComponents(f.path, content);
        index.push(...components);

        // ── Detect JSX usage ────────────────────────────────────────────
        const usedComponents = extractJSXUsage(content);
        if (usedComponents.length > 0) {
          // Merge with existing
          const existing = usage[f.path] ?? [];
          const merged = [...new Set([...existing, ...usedComponents])];
          usage[f.path] = merged;
        }
      } catch {
        parseFailures++;
      }
    }

    // ── Cross-reference with import graph ────────────────────────────────────
    // If we have an import graph, add usage entries for files that import
    // component-defining files. This catches cases where a component is used
    // via import and the JSX tag might not be detected.
    if (importGraph) {
      for (const comp of index) {
        // Find files that import the component's file
        for (const [importer, imports] of Object.entries(importGraph)) {
          const matchingImport = imports.find(
            (imp) =>
              !imp.isExternal &&
              imp.resolvedPath &&
              normalizePath(imp.resolvedPath) === normalizePath(comp.filePath),
          );
          if (matchingImport) {
            // Add the component as used in the importer (if not already present)
            const existing = usage[importer] ?? [];
            if (!existing.includes(comp.name)) {
              usage[importer] = [...existing, comp.name];
            }
          }
        }
      }
    }

    const result: ComponentIndexResult = {
      index,
      usage,
      filesScanned,
      componentsFound: index.length,
      parseFailures,
      buildTimeMs: Date.now() - start,
    };

    // ── Cache ────────────────────────────────────────────────────────────────
    ComponentIndexBuilder.cache.set(projectId, {
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
    ComponentIndexBuilder.cache.delete(projectId);
  }

  /**
   * Clear all cached component indexes (e.g. on server restart hooks).
   */
  static clearAll(): void {
    ComponentIndexBuilder.cache.clear();
  }

  /**
   * Get cache stats for telemetry.
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: ComponentIndexBuilder.cache.size,
      keys: [...ComponentIndexBuilder.cache.keys()],
    };
  }

  /**
   * Find similar component names for duplicate prevention.
   * Returns entries whose name contains the query or vice versa (case-insensitive).
   *
   * @param index - The component index to search
   * @param query - The component name or concept to match against
   * @param maxResults - Maximum results to return (default 5)
   */
  static findSimilar(
    index: ComponentEntry[],
    query: string,
    maxResults = 5,
  ): ComponentEntry[] {
    const lower = query.toLowerCase();
    const words = lower.split(/[\s_-]+/).filter(Boolean);

    const scored = index
      .map((entry) => {
        const nameLower = entry.name.toLowerCase();
        let score = 0;

        // Exact match
        if (nameLower === lower) score += 100;
        // Name contains query
        if (nameLower.includes(lower)) score += 80;
        // Query contains name
        if (lower.includes(nameLower)) score += 70;
        // Word-level matching
        for (const word of words) {
          if (nameLower.includes(word)) score += 30;
        }

        return { entry, score };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxResults)
      .map(({ entry }) => entry);

    return scored;
  }
}

// ─── Internal helpers ────────────────────────────────────────────────────────

/** Normalise a file path to forward slashes. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/");
}

/** Compute a quick file signature for cache invalidation. */
function computeFileSignature(files: ProjectFile[]): string {
  const parts = files
    .map((f) => `${normalizePath(f.path)}:${f.content.length}`)
    .sort();
  return parts.join("|");
}

/** Detect whether a file is a React component based on content and extension. */
function detectComponentType(ext: string, content: string): ComponentType {
  if (ext === ".tsx" || ext === ".jsx") return "react";
  if (REACT_IMPORT_RE.test(content)) return "react";
  if (JSX_CHECK_RE.test(content)) return "react";
  return "function";
}

/** Extract all component definitions from a file's content. */
function extractComponents(filePath: string, content: string): ComponentEntry[] {
  const components: ComponentEntry[] = [];
  const ext = path.extname(filePath).toLowerCase();
  const baseType = detectComponentType(ext, content);

  // ── Default exports ────────────────────────────────────────────────────
  // export default function ComponentName
  let match: RegExpExecArray | null;
  DEFAULT_FUNCTION_RE.lastIndex = 0;
  while ((match = DEFAULT_FUNCTION_RE.exec(content)) !== null) {
    components.push({
      name: match[1],
      filePath,
      exportType: "default",
      componentType: baseType,
    });
  }

  // export default class ComponentName
  DEFAULT_CLASS_RE.lastIndex = 0;
  while ((match = DEFAULT_CLASS_RE.exec(content)) !== null) {
    components.push({
      name: match[1],
      filePath,
      exportType: "default",
      componentType: baseType,
    });
  }

  // export default <identifier> (variable reference)
  // Only if no other default export was found
  if (!components.some((c) => c.exportType === "default")) {
    DEFAULT_VAR_RE.lastIndex = 0;
    while ((match = DEFAULT_VAR_RE.exec(content)) !== null) {
      // Skip keywords that aren't component references
      const name = match[1];
      if (name === "function" || name === "class" || name === "const" || name === "let" || name === "var") continue;
      components.push({
        name,
        filePath,
        exportType: "default",
        componentType: baseType,
      });
    }
  }

  // export default () => ... or export default (props) => ...
  // Since we can't extract a name from anonymous arrows, use the filename as name
  DEFAULT_ARROW_RE.lastIndex = 0;
  if (DEFAULT_ARROW_RE.test(content)) {
    // Check if we already captured a named default export
    if (!components.some((c) => c.exportType === "default")) {
      const name = path.basename(filePath, ext).replace(/[.-].*$/, "");
      components.push({
        name: name || "Unknown",
        filePath,
        exportType: "default",
        componentType: baseType,
      });
    }
  }

  // ── Named exports ──────────────────────────────────────────────────────
  // export function ComponentName
  NAMED_FUNCTION_RE.lastIndex = 0;
  while ((match = NAMED_FUNCTION_RE.exec(content)) !== null) {
    components.push({
      name: match[1],
      filePath,
      exportType: "named",
      componentType: baseType,
    });
  }

  // export const ComponentName = () => ... or function() ...
  NAMED_CONST_RE.lastIndex = 0;
  while ((match = NAMED_CONST_RE.exec(content)) !== null) {
    components.push({
      name: match[1],
      filePath,
      exportType: "named",
      componentType: baseType,
    });
  }

  return components;
}

/** Extract JSX component usage from file content. */
function extractJSXUsage(content: string): string[] {
  const names = new Set<string>();
  let match: RegExpExecArray | null;

  JSX_TAG_RE.lastIndex = 0;
  while ((match = JSX_TAG_RE.exec(content)) !== null) {
    const name = match[1];
    // Filter out known HTML elements and common non-component capitalized names
    if (!isKnownNonComponent(name)) {
      names.add(name);
    }
  }

  return [...names];
}

/** List of capitalized names that are NOT React components. */
const KNOWN_NON_COMPONENTS = new Set([
  "Array", "Object", "String", "Number", "Boolean", "Symbol", "Function",
  "Promise", "Error", "Map", "Set", "WeakMap", "WeakSet",
  "Date", "RegExp", "Math", "JSON", "NaN", "Infinity",
  "Buffer", "URL", "URLSearchParams", "AbortController", "AbortSignal",
  "IntersectionObserver", "ResizeObserver", "MutationObserver",
  "Headers", "Request", "Response", "FormData", "Blob", "File",
  "React", "Suspense", "Fragment", "StrictMode",
  "Children", "Component", "PureComponent",
  "User", "Props", "State", "Theme",
]);

function isKnownNonComponent(name: string): boolean {
  return KNOWN_NON_COMPONENTS.has(name);
}
