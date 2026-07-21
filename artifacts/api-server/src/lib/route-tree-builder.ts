// ─── RouteTreeBuilder — Next.js App Router Intelligence Scanner ────────────
//
// Phase 13.2.4 — Scans project files to build a route tree with layout hierarchy.
//
// Detects:
//   - page.tsx, layout.tsx, loading.tsx, error.tsx, route.ts
//   - Static routes: /about
//   - Dynamic routes: /blog/[slug]
//   - Catch-all routes: /docs/[...slug]
//   - Route groups: (marketing)
//   - Parallel routes: @dashboard
//
// The result is cached per projectId and invalidated when files change,
// matching the same strategy as ImportGraphBuilder and ComponentIndexBuilder.
//
// Integration: called from WorkspaceContextBuilder.build() after component index
// is built. Results stored in WorkspaceContext.routeTree and .layoutHierarchy.

import path from "node:path";
import type { RouteNode } from "./workspace-context";
import type { ProjectFile } from "./website-v2-types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RouteTreeResult {
  /** Root-level route nodes */
  tree: RouteNode[];
  /** Flat list of all routes with their layouts */
  layoutHierarchy: Array<{ segment: string; layoutFile: string }>;
  /** Total routes (pages) discovered */
  routeCount: number;
  /** Total layouts discovered */
  layoutCount: number;
  /** Number of dynamic routes (contain [param]) */
  dynamicRouteCount: number;
  /** Number of catch-all routes (contain [...param]) */
  catchAllRouteCount: number;
  /** Build time in milliseconds */
  buildTimeMs: number;
}

// ─── App Router special files ────────────────────────────────────────────────

const ROUTE_FILES = new Set(["page", "layout", "loading", "error", "route"]);
const ROUTE_EXTENSIONS = new Set([".tsx", ".jsx", ".ts", ".js"]);

// ─── Cache entry ─────────────────────────────────────────────────────────────

interface CacheEntry {
  result: RouteTreeResult;
  createdAt: number;
  fileSignature: string;
}

// ─── RouteTreeBuilder ────────────────────────────────────────────────────────

export class RouteTreeBuilder {
  /** Per-project cache: projectId → CacheEntry */
  private static cache = new Map<string, CacheEntry>();

  /**
   * Build (or retrieve from cache) the route tree for a set of project files.
   *
   * @param projectId - Unique project identifier for cache scoping
   * @param files - Full set of project files
   * @param forceRebuild - Skip cache and rebuild from scratch
   * @returns The route tree result
   */
  static build(
    projectId: string,
    files: ProjectFile[],
    forceRebuild = false,
  ): RouteTreeResult {
    const start = Date.now();

    // ── Cache check ──────────────────────────────────────────────────────────
    const signature = computeFileSignature(files);
    if (!forceRebuild) {
      const cached = RouteTreeBuilder.cache.get(projectId);
      if (cached && cached.fileSignature === signature) {
        return {
          ...cached.result,
          buildTimeMs: Date.now() - start,
        };
      }
    }

    // ── Detect app directory ─────────────────────────────────────────────────
    // Look for the root of the app router (usually "app/" or "src/app/")
    const appDir = detectAppDirectory(files);
    if (!appDir) {
      const result: RouteTreeResult = {
        tree: [],
        layoutHierarchy: [],
        routeCount: 0,
        layoutCount: 0,
        dynamicRouteCount: 0,
        catchAllRouteCount: 0,
        buildTimeMs: Date.now() - start,
      };
      return result;
    }

    // ── Discover route files ─────────────────────────────────────────────────
    // Map of directory → set of route file types found
    const dirMap = discoverDirectories(files, appDir);

    // ── Build tree nodes ────────────────────────────────────────────────────
    const tree = buildTree(appDir, dirMap);
    const flat = flattenTree(tree);

    // ── Build layout hierarchy ──────────────────────────────────────────────
    const layoutHierarchy = buildLayoutHierarchy(tree, appDir);

    // ── Count metrics ───────────────────────────────────────────────────────
    let routeCount = 0;
    let layoutCount = 0;
    let dynamicRouteCount = 0;
    let catchAllRouteCount = 0;

    for (const node of flat) {
      if (node.pageFile) {
        routeCount++;
        if (isDynamicSegment(node.segment)) dynamicRouteCount++;
        if (isCatchAllSegment(node.segment)) catchAllRouteCount++;
      }
      if (node.layoutFile) layoutCount++;
    }

    const result: RouteTreeResult = {
      tree,
      layoutHierarchy,
      routeCount,
      layoutCount,
      dynamicRouteCount,
      catchAllRouteCount,
      buildTimeMs: Date.now() - start,
    };

    // ── Cache ────────────────────────────────────────────────────────────────
    RouteTreeBuilder.cache.set(projectId, {
      result,
      createdAt: Date.now(),
      fileSignature: signature,
    });

    return result;
  }

  /**
   * Invalidate the cache for a specific project.
   */
  static invalidate(projectId: string): void {
    RouteTreeBuilder.cache.delete(projectId);
  }

  /**
   * Clear all cached route trees.
   */
  static clearAll(): void {
    RouteTreeBuilder.cache.clear();
  }

  /**
   * Get cache stats for telemetry.
   */
  static getCacheStats(): { size: number; keys: string[] } {
    return {
      size: RouteTreeBuilder.cache.size,
      keys: [...RouteTreeBuilder.cache.keys()],
    };
  }

  /**
   * Find the route node that matches a given file path.
   * Useful for determining the route segment for a selected file.
   */
  static findRouteForFile(
    tree: RouteNode[],
    filePath: string,
  ): { route: RouteNode; ancestors: RouteNode[] } | null {
    const flat = flattenTree(tree);
    for (const node of flat) {
      if (node.pageFile === filePath || node.layoutFile === filePath) {
        // Build ancestor chain
        const ancestors = buildAncestorChain(tree, node.path);
        return { route: node, ancestors };
      }
    }
    return null;
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

/** Detect the app router root directory. Returns the prefix path + trailing slash. */
function detectAppDirectory(files: ProjectFile[]): string | null {
  // Look for the first file with "app/" or "src/app/" in its path
  for (const f of files) {
    const norm = normalizePath(f.path);
    if (/^(?:src\/)?app\//.test(norm)) {
      // Found app directory — return the prefix
      const match = norm.match(/^((?:src\/)?app\/)/);
      return match ? match[1] : "app/";
    }
  }
  return null;
}

/** A discovered directory entry with its route-relevant files. */
interface DirEntry {
  /** Files found in this directory, keyed by type (page, layout, loading, error, route) */
  files: Record<string, string>;
  /** Child directory names */
  subdirs: string[];
}

/**
 * Scan all files and group them by directory within the app router.
 * Returns a map of relative directory path → DirEntry.
 */
function discoverDirectories(
  files: ProjectFile[],
  appDir: string,
): Map<string, DirEntry> {
  const dirMap = new Map<string, DirEntry>();

  for (const f of files) {
    const norm = normalizePath(f.path);
    if (!norm.startsWith(appDir)) continue;

    const relative = norm.slice(appDir.length);
    const parts = relative.split("/");
    const fileName = parts[parts.length - 1] ?? "";
    const dirPath = parts.slice(0, -1).join("/");

    // Parse the file name to see if it's a route file
    const routeFile = parseRouteFileName(fileName);
    if (!routeFile) continue;

    if (!dirMap.has(dirPath)) {
      dirMap.set(dirPath, { files: {}, subdirs: [] });
    }
    const entry = dirMap.get(dirPath)!;
    entry.files[routeFile.type] = norm;
  }

  // Build subdirectory lists
  for (const [dirPath, entry] of dirMap) {
    const subdirs = new Set<string>();
    for (const otherPath of dirMap.keys()) {
      if (otherPath.startsWith(dirPath + "/")) {
        const rest = otherPath.slice(dirPath.length + 1);
        const sub = rest.split("/")[0];
        if (sub) subdirs.add(sub);
      }
    }
    entry.subdirs = [...subdirs].sort();
  }

  return dirMap;
}

/** Parse a filename like "page.tsx" → { type: "page", ext: ".tsx" } or null. */
function parseRouteFileName(
  fileName: string,
): { type: string; ext: string } | null {
  const dotIdx = fileName.lastIndexOf(".");
  if (dotIdx < 0) return null;

  const base = fileName.slice(0, dotIdx);
  const ext = fileName.slice(dotIdx);

  if (!ROUTE_EXTENSIONS.has(ext)) return null;
  if (!ROUTE_FILES.has(base)) return null;

  return { type: base, ext };
}

/** Build a route tree from the directory map. */
function buildTree(
  appDir: string,
  dirMap: Map<string, DirEntry>,
): RouteNode[] {
  const root = buildNode("", "", dirMap);
  return root.children;
}

/** Recursively build a single tree node. */
function buildNode(
  dirPath: string,
  segment: string,
  dirMap: Map<string, DirEntry>,
): RouteNode {
  const entry = dirMap.get(dirPath);
  const node: RouteNode = {
    path: formatPath(segment),
    segment,
    pageFile: entry?.files.page ?? null,
    layoutFile: entry?.files.layout ?? null,
    loadingFile: entry?.files.loading ?? null,
    errorFile: entry?.files.error ?? null,
    routeHandlerFile: entry?.files.route ?? null,
    children: [],
  };

  // Build children from subdirectories
  if (entry) {
    for (const subdir of entry.subdirs) {
      const childDirPath = dirPath ? `${dirPath}/${subdir}` : subdir;
      const child = buildNode(childDirPath, subdir, dirMap);
      node.children.push(child);
    }
  }

  return node;
}

/** Format a segment into a display path. */
function formatPath(segment: string): string {
  if (!segment) return "/";
  return "/" + segment;
}

/** Check if a segment is a dynamic route (e.g. [slug]). */
function isDynamicSegment(segment: string): boolean {
  return /^\[.*\]$/.test(segment) && !segment.startsWith("[...");
}

/** Check if a segment is a catch-all route (e.g. [...slug]). */
function isCatchAllSegment(segment: string): boolean {
  return /^\[\.\.\..*\]$/.test(segment);
}

/** Flatten a route tree into a flat list of nodes. */
function flattenTree(tree: RouteNode[]): RouteNode[] {
  const result: RouteNode[] = [];
  function walk(nodes: RouteNode[]) {
    for (const node of nodes) {
      result.push(node);
      walk(node.children);
    }
  }
  walk(tree);
  return result;
}

/** Build layout hierarchy: for each route node, find which layout wraps it. */
function buildLayoutHierarchy(
  tree: RouteNode[],
  appDir: string,
): Array<{ segment: string; layoutFile: string }> {
  const result: Array<{ segment: string; layoutFile: string }> = [];

  function walk(nodes: RouteNode[], inheritedLayout: string | null) {
    for (const node of nodes) {
      // The effective layout for this node's page is either its own layout
      // or the inherited layout from the nearest parent
      const effectiveLayout = node.layoutFile ?? inheritedLayout;

      if (node.pageFile && effectiveLayout) {
        result.push({
          segment: node.path,
          layoutFile: effectiveLayout,
        });
      }

      // Children inherit this node's layout if it has one
      walk(node.children, effectiveLayout);
    }
  }

  walk(tree, null);
  return result;
}

/** Build the ancestor chain for a given route path. */
function buildAncestorChain(
  tree: RouteNode[],
  routePath: string,
): RouteNode[] {
  const chain: RouteNode[] = [];

  function walk(nodes: RouteNode[], ancestors: RouteNode[]): boolean {
    for (const node of nodes) {
      if (node.path === routePath) {
        chain.push(...ancestors, node);
        return true;
      }
      const found = walk(node.children, [...ancestors, node]);
      if (found) return true;
    }
    return false;
  }

  walk(tree, []);
  return chain;
}
