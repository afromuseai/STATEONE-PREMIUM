// ─── WorkspaceContextBuilder — Centralized WorkspaceContext Assembler ────────
//
// Responsibilities:
//   1. Receive raw frontend scan data (WSProjectMemory-shaped object)
//   2. Merge DB information (BusinessContext, Blueprint, files)
//   3. Normalize values (framework names, styling approaches, etc.)
//   4. Build import graph from project files (Phase 13.2.1)
//   5. Apply heuristics where data is missing
//   6. Produce a complete WorkspaceContext for the editing agent
//
// MarcusController and edit-website-v2.ts should never assemble WorkspaceContext
// manually — this builder is the single entry point.

import type { BusinessContext, WebsiteBlueprint } from "./website-v2-types";
import type { WorkspaceContext, RouteNode } from "./workspace-context";
import { ImportGraphBuilder } from "./import-graph-builder";
import { RelatedFilesEngine } from "./related-files-engine";
import { ComponentIndexBuilder } from "./component-index-builder";
import { RouteTreeBuilder } from "./route-tree-builder";
import { detectValidators } from "./workspace-validator";
import { retrieveMemories, formatProjectMemories } from "./project-memory-engine";
import type { ProjectFile } from "./website-v2-types";

// ─── Raw frontend scan data (subset of frontend WSProjectMemory) ─────────────
// This is the shape of the data the frontend sends in the edit POST body.

export interface RawWorkspaceScan {
  framework?: string
  packageManager?: string
  style?: string
  colors?: string[]
  dependencies?: string[]
  // Enriched dependencies from package.json (name@version strings)
  enrichedDependencies?: Array<{ name: string; version: string; isDev: boolean }>
  routeCount?: number
  componentCount?: number
  fileTree?: string
  entryPoints?: string[]
  pathAliases?: Record<string, string>
  previousChanges?: string[]
  userPreferences?: string[]
  acceptedPatterns?: string[]
  rejectedPatterns?: string[]
}

// ─── Detection helpers ───────────────────────────────────────────────────────

/** Infer package manager from lockfile hint or dependency names. */
function detectPackageManager(scan: RawWorkspaceScan): string | undefined {
  if (scan.packageManager) return scan.packageManager
  // Fallback: infer from dependencies
  const deps = scan.dependencies ?? []
  if (deps.some(d => d.startsWith("pnpm"))) return "pnpm"
  if (deps.some(d => d.startsWith("yarn"))) return "yarn"
  if (deps.some(d => d.startsWith("bun")))  return "bun"
  return "npm"
}

/** Normalize framework name to a canonical form. */
function normalizeFramework(raw?: string): string | undefined {
  if (!raw) return undefined
  const lc = raw.toLowerCase()
  if (lc.includes("next"))   return "Next.js (App Router)"
  if (lc.includes("remix"))  return "Remix"
  if (lc.includes("vite") || lc.includes("react")) return "React + Vite"
  if (lc.includes("node"))   return "Node.js"
  return raw
}

/** Normalize styling approach to a canonical label. */
function normalizeStyle(raw?: string): string | undefined {
  if (!raw) return undefined
  const lc = raw.toLowerCase()
  if (lc.includes("tailwind"))       return "Tailwind CSS"
  if (lc.includes("styled"))         return "Styled Components"
  if (lc.includes("framer"))         return "Framer Motion"
  if (lc.includes("css-modules") || lc.includes("css modules")) return "CSS Modules"
  return raw
}

/** Detect tooling from dependency list. */
function detectTooling(deps: string[]): string[] {
  const tooling: string[] = []
  if (deps.includes("typescript") || deps.includes("tsc")) tooling.push("TypeScript")
  if (deps.includes("eslint") || deps.includes("@eslint/js")) tooling.push("ESLint")
  if (deps.includes("prettier")) tooling.push("Prettier")
  if (deps.includes("vite")) tooling.push("Vite")
  if (deps.includes("turbo")) tooling.push("Turborepo")
  if (deps.includes("nx")) tooling.push("Nx")
  if (deps.includes("next")) tooling.push("Next.js")
  return tooling
}

/** Extract tooling from enriched dependencies. */
function detectToolingFromEnriched(deps: Array<{ name: string; version: string; isDev: boolean }>): string[] {
  return detectTooling(deps.map(d => d.name))
}

// ─── Builder ─────────────────────────────────────────────────────────────────

export class WorkspaceContextBuilder {
  private scan: RawWorkspaceScan
  private businessContext?: BusinessContext
  private blueprint?: WebsiteBlueprint | null
  private fileCount: number
  private buildStart: number
  private files?: ProjectFile[]
  private projectId?: string
  private selectedFiles?: string[]
  /** Track whether import graph was built from cache */
  private importGraphCacheHit = false
  /** Track whether related files was computed */
  private relatedFilesComputed = false
  /** Track whether component index was built from cache */
  private componentIndexCacheHit = false
  /** Track project memory retrieval time (Phase 13.3.2) */
  private _memoryRetrievalTimeMs = 0
  /** Track number of memories retrieved (Phase 13.3.2) */
  private _memoryCount = 0

  constructor(params: {
    scan: RawWorkspaceScan
    businessContext?: BusinessContext
    blueprint?: WebsiteBlueprint | null
    fileCount?: number
    files?: ProjectFile[]
    projectId?: string
    selectedFiles?: string[]
  }) {
    this.scan = params.scan
    this.businessContext = params.businessContext
    this.blueprint = params.blueprint
    this.fileCount = params.fileCount ?? 0
    this.buildStart = Date.now()
    this.files = params.files
    this.projectId = params.projectId
    this.selectedFiles = params.selectedFiles
  }

  /**
   * Build a complete WorkspaceContext from all available data sources.
   * Order of precedence: frontend scan data > DB data > heuristics.
   */
  build(): WorkspaceContext {
    const ctx: WorkspaceContext = {}

    // ── Project Identity ──────────────────────────────────────────────────
    ctx.framework = normalizeFramework(this.scan.framework)
    ctx.packageManager = detectPackageManager(this.scan)
    ctx.stylingApproach = normalizeStyle(this.scan.style)

    // Project type from blueprint or inference
    if (this.blueprint?.projectType) {
      ctx.projectType = this.blueprint.projectType
    }

    // ── Dependencies ──────────────────────────────────────────────────────
    if (this.scan.enrichedDependencies?.length) {
      ctx.dependencies = this.scan.enrichedDependencies
    } else if (this.scan.dependencies?.length) {
      // Convert simple string array to minimal objects
      ctx.dependencies = this.scan.dependencies.map(name => ({ name, version: "", isDev: false }))
    }

    // Tooling detection
    if (this.scan.enrichedDependencies?.length) {
      ctx.tooling = detectToolingFromEnriched(this.scan.enrichedDependencies)
    } else if (this.scan.dependencies?.length) {
      ctx.tooling = detectTooling(this.scan.dependencies)
    }

    // ── File System Structure ─────────────────────────────────────────────
    ctx.totalFileCount = this.fileCount
    if (this.scan.entryPoints?.length) {
      ctx.entryPoints = this.scan.entryPoints
    }
    if (this.scan.pathAliases && Object.keys(this.scan.pathAliases).length > 0) {
      ctx.pathAliases = this.scan.pathAliases
    }

    // ── Import Graph (Phase 13.2.1) ──────────────────────────────────────
    if (this.projectId && this.files && this.files.length > 0) {
      const aliasCtx = ctx.pathAliases ?? this.scan.pathAliases
      const igResult = ImportGraphBuilder.build(
        this.projectId,
        this.files,
        aliasCtx,
      )
      // Detect cache hit: build time near-zero indicates cache
      this.importGraphCacheHit = igResult.buildTimeMs < 5
      ctx.importGraph = igResult.graph
      ctx.danglingImports = igResult.dangling

      // ── Related Files (Phase 13.2.2) ──────────────────────────────────
      if (this.selectedFiles?.length && Object.keys(igResult.graph).length > 0) {
        const allFilePaths = this.files.map((f) => f.path);
        const relatedResult = RelatedFilesEngine.compute(
          this.selectedFiles,
          igResult.graph,
          allFilePaths,
        );
        ctx.selectedFiles = this.selectedFiles;
        ctx.relatedFiles = relatedResult.relatedFiles;
        ctx.relationReasons = relatedResult.relationReasons;
        this.relatedFilesComputed = true;
      }

      // ── Component Intelligence (Phase 13.2.3) ─────────────────────────
      const ciResult = ComponentIndexBuilder.build(
        this.projectId,
        this.files,
        igResult.graph,
      );
      this.componentIndexCacheHit = ciResult.buildTimeMs < 5;
      ctx.componentIndex = ciResult.index;
      ctx.componentUsage = ciResult.usage;

      // ── Route Intelligence (Phase 13.2.4) ─────────────────────────────
      const rtResult = RouteTreeBuilder.build(this.projectId, this.files);
      ctx.routeTree = rtResult.tree.length > 0 ? rtResult.tree : undefined;
      ctx.layoutHierarchy = rtResult.layoutHierarchy.length > 0 ? rtResult.layoutHierarchy : undefined;

      // ── Route-aware related files ─────────────────────────────────────
      // If selected files include route pages/layouts, add their layout
      // and sibling routes to the related files list.
      if (this.selectedFiles?.length && rtResult.tree.length > 0) {
        const routeRelated = getRouteRelatedFiles(
          this.selectedFiles,
          rtResult.tree,
        );
        if (routeRelated.length > 0) {
          const existingRelated = new Set(ctx.relatedFiles ?? []);
          const existingReasons = ctx.relationReasons ?? {};
          for (const rr of routeRelated) {
            if (!existingRelated.has(rr.file)) {
              existingRelated.add(rr.file);
              existingReasons[rr.file] = rr.reason;
            }
          }
          ctx.relatedFiles = [...existingRelated];
          ctx.relationReasons = existingReasons;
        }
      }

      // ── Validation Intelligence (Phase 13.2.5) ────────────────────────
      const depNames = extractDependencyNames(this.scan);
      ctx.availableValidators = detectValidators(depNames, ctx.framework);

      // ── Project Memory (Phase 13.3.2) ────────────────────────────────
      // Retrieve relevant memories for the current edit context. The
      // instruction for retrieval is derived from selected files + scan data.
      const retrievalQuery = [
        ...(this.selectedFiles ?? []),
        ...(this.scan.acceptedPatterns ?? []),
        ...(this.scan.rejectedPatterns ?? []),
      ].join(" ");
      const retrievalResult = retrieveMemories(
        this.projectId,
        retrievalQuery || this.scan.framework || "",
        this.selectedFiles,
      );
      if (retrievalResult.memories.length > 0) {
        ctx.projectMemory = formatProjectMemories(retrievalResult.memories);
      }
      this._memoryRetrievalTimeMs = retrievalResult.retrievalTimeMs;
      this._memoryCount = retrievalResult.memories.length;
    }

    // ── Previous Context ──────────────────────────────────────────────────
    if (this.scan.previousChanges?.length) {
      ctx.recentChanges = this.scan.previousChanges
    }
    if (this.scan.acceptedPatterns?.length) {
      ctx.acceptedPatterns = this.scan.acceptedPatterns
    }
    if (this.scan.rejectedPatterns?.length) {
      ctx.rejectedPatterns = this.scan.rejectedPatterns
    }

    return ctx
  }

  /** Time spent building the context, in milliseconds. */
  getBuildTimeMs(): number {
    return Date.now() - this.buildStart
  }

  /** Whether the import graph was served from cache. */
  wasImportGraphCached(): boolean {
    return this.importGraphCacheHit
  }

  /** Whether related files were computed. */
  wasRelatedFilesComputed(): boolean {
    return this.relatedFilesComputed
  }

  /** Whether the component index was served from cache. */
  wasComponentIndexCached(): boolean {
    return this.componentIndexCacheHit
  }

  /** Get the selected files passed to the builder. */
  getSelectedFiles(): string[] | undefined {
    return this.selectedFiles
  }

  /** Time spent retrieving project memories (Phase 13.3.2), in milliseconds. */
  getMemoryRetrievalTimeMs(): number {
    return this._memoryRetrievalTimeMs
  }

  /** Number of project memories retrieved (Phase 13.3.2). */
  getMemoryCount(): number {
    return this._memoryCount
  }
}

// ─── Route-aware related files ───────────────────────────────────────────────
// When the user selects a route page or layout, include the route's layout
// and sibling routes in the related files set.

interface RouteRelatedEntry {
  file: string;
  reason: string;
}

function getRouteRelatedFiles(
  selectedFiles: string[],
  tree: RouteNode[],
): RouteRelatedEntry[] {
  const results: RouteRelatedEntry[] = [];
  const selectedSet = new Set(selectedFiles);
  const allRoutes = flattenRouteTreeInternal(tree);
  const added = new Set<string>();

  for (const selected of selectedFiles) {
    // Find the route that contains this file
    const matchedRoute = allRoutes.find(
      (r) => r.pageFile === selected || r.layoutFile === selected,
    );
    if (!matchedRoute) continue;

    // Add the route's layout (if selected file is a page, not the layout itself)
    if (matchedRoute.layoutFile && matchedRoute.pageFile === selected && !added.has(matchedRoute.layoutFile)) {
      added.add(matchedRoute.layoutFile);
      results.push({
        file: matchedRoute.layoutFile,
        reason: `layout for route ${matchedRoute.path}`,
      });
    }

    // Add sibling routes (same parent, different pages)
    for (const sibling of allRoutes) {
      if (sibling.path === matchedRoute.path) continue;
      if (!sibling.pageFile) continue;
      if (added.has(sibling.pageFile)) continue;

      // Same parent path (sibling routes share directory prefix)
      const parentPath = matchedRoute.path.split("/").slice(0, -1).join("/");
      const siblingParent = sibling.path.split("/").slice(0, -1).join("/");
      if (parentPath === siblingParent && siblingParent !== "") {
        added.add(sibling.pageFile);
        results.push({
          file: sibling.pageFile,
          reason: `sibling route of ${matchedRoute.path}`,
        });
      }
    }
  }

  return results;
}

/** Internal: flatten a RouteNode tree (works with workspace-context's RouteNode). */
function flattenRouteTreeInternal(nodes: RouteNode[], prefix = ""): Array<{
  path: string;
  segment: string;
  pageFile: string | null;
  layoutFile: string | null;
  routeHandlerFile: string | null;
}> {
  const result: Array<{
    path: string;
    segment: string;
    pageFile: string | null;
    layoutFile: string | null;
    routeHandlerFile: string | null;
  }> = [];
  for (const node of nodes) {
    const fullPath = prefix + node.path;
    result.push({
      path: fullPath,
      segment: node.segment,
      pageFile: node.pageFile,
      layoutFile: node.layoutFile,
      routeHandlerFile: node.routeHandlerFile,
    });
    if (node.children.length > 0) {
      result.push(...flattenRouteTreeInternal(node.children, fullPath));
    }
  }
  return result;
}

/** Extract dependency names from the workspace scan data. */
function extractDependencyNames(scan: RawWorkspaceScan): string[] {
  if (scan.enrichedDependencies?.length) {
    return scan.enrichedDependencies.map((d) => d.name);
  }
  return scan.dependencies ?? [];
}
