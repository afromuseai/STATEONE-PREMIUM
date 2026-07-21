// ─── WorkspaceContext — Project Intelligence for the Editing Agent ────────────
//
// Phase 13.1 — Foundation. Only Phase A fields are populated initially.
// Phase B (importGraph, componentIndex, routeTree) and Phase C (designTokens,
// stateManagement, dataFetching) will be added in later phases.
//
// This model is the single source of truth for what the editing engine knows
// about the project it is editing. It is assembled by WorkspaceContextBuilder
// and injected into the LLM prompt alongside BusinessContext and Blueprint.

// ─── Route tree (Phase B) ─────────────────────────────────────────────────────
// Stubbed for forward compatibility. Will be built by recursive App Router
// directory scanning in Phase 13.2+.

export interface RouteNode {
  path: string
  segment: string
  pageFile: string | null
  layoutFile: string | null
  loadingFile: string | null
  errorFile: string | null
  routeHandlerFile: string | null
  children: RouteNode[]
}

// ─── Import graph (Phase B) ──────────────────────────────────────────────────
// Stubbed for forward compatibility.

export interface ImportEntry {
  source: string
  resolvedPath: string | null
  isExternal: boolean
  specifiers: string[]
  isTypeOnly: boolean
}

// ─── Design tokens (Phase C) ─────────────────────────────────────────────────
// Stubbed for forward compatibility.

export interface DesignTokens {
  colors?: string[]
  fonts?: string[]
  spacingScale?: string[]
  breakpoints?: string[]
  borderRadius?: string
  motion?: "none" | "subtle" | "expressive"
  style?: string
}

// ─── WorkspaceContext ─────────────────────────────────────────────────────────
//
// Every field is optional — the builder fills what it can, the prompt formatter
// omits sections with no data. This ensures the editing engine never receives
// empty or misleading context.

export interface WorkspaceContext {
  // ── Project Identity (Phase A) ──────────────────────────────────────────
  /** Detected web framework: "Next.js (App Router)", "React + Vite", "Remix", "Node.js" */
  framework?: string
  /** Detected package manager: "pnpm", "npm", "yarn", "bun" */
  packageManager?: string
  /** Business type from blueprint, or inferred */
  projectType?: string

  // ── Dependencies (Phase A) ──────────────────────────────────────────────
  /** Full dependency list with version + dev flag */
  dependencies?: Array<{ name: string; version: string; isDev: boolean }>
  /** Dev/build tooling detected */
  tooling?: string[]

  // ── File System Structure (Phase A) ─────────────────────────────────────
  totalFileCount?: number
  /** Known entry points: ["app/layout.tsx", "app/page.tsx", ...] */
  entryPoints?: string[]
  /** Path aliases: { "@": "./src/*", "~": "./src/app/*" } */
  pathAliases?: Record<string, string>

  // ── Routing (Phase B — stub) ────────────────────────────────────────────
  routeTree?: RouteNode[]
  layoutHierarchy?: Array<{ segment: string; layoutFile: string }>

  // ── Component Graph (Phase B — stub) ────────────────────────────────────
  componentIndex?: Array<{ name: string; filePath: string; exportType: "default" | "named"; componentType: "react" | "function" | "unknown" }>
  componentUsage?: Record<string, string[]>

  // ── Import Graph (Phase B — stub) ───────────────────────────────────────
  importGraph?: Record<string, ImportEntry[]>
  danglingImports?: Array<{ file: string; importSource: string }>

  // ── Design System (Phase C — stub) ──────────────────────────────────────
  designTokens?: DesignTokens
  stylingApproach?: string

  // ── State & Data (Phase C — stub) ───────────────────────────────────────
  stateManagement?: string[]
  dataFetching?: string[]

  // ── Adjacency — Files Related to Current Edit (Phase B — stub) ─────────
  selectedFiles?: string[]
  relatedFiles?: string[]
  relationReasons?: Record<string, string>

  // ── Previous Context (Phase A) ──────────────────────────────────────────
  recentChanges?: string[]
  acceptedPatterns?: string[]
  rejectedPatterns?: string[]

  // ── Validation Capabilities (Phase C — stub) ────────────────────────────
  availableValidators?: {
    typescript: boolean
    eslint: boolean
    build: boolean
    buildCommand?: "next build" | "vite build"
  }

  // ── Project Memory (Phase 13.3.2) ──────────────────────────────────────
  /** Semantic project memories — architecture decisions, design choices, conventions, etc. */
  projectMemory?: string
}

// ─── Serialization ────────────────────────────────────────────────────────────
// Helpers for prompt formatting and telemetry.

/** Serialize WorkspaceContext to a concise, LLM-friendly text block. */
export function formatWorkspaceContext(ctx: WorkspaceContext): string {
  const lines: string[] = []

  // ── Identity block ──────────────────────────────────────────────────────
  if (ctx.framework)         lines.push(`Framework: ${ctx.framework}`)
  if (ctx.packageManager)    lines.push(`Package manager: ${ctx.packageManager}`)
  if (ctx.projectType)       lines.push(`Project type: ${ctx.projectType}`)
  if (ctx.stylingApproach)   lines.push(`Styling: ${ctx.stylingApproach}`)
  if (ctx.pathAliases && Object.keys(ctx.pathAliases).length > 0) {
    const aliasStr = Object.entries(ctx.pathAliases)
      .map(([k, v]) => `${k} → ${v}`)
      .join(", ")
    lines.push(`Path aliases: ${aliasStr}`)
  }
  if (ctx.entryPoints?.length) {
    lines.push(`Entry points: ${ctx.entryPoints.join(", ")}`)
  }
  if (ctx.dependencies?.length) {
    const depStr = ctx.dependencies
      .slice(0, 12)
      .map(d => `${d.name}@${d.version}`)
      .join(", ")
    lines.push(`Dependencies (${ctx.dependencies.length}): ${depStr}`)
  }
  if (ctx.tooling?.length) {
    lines.push(`Tooling: ${ctx.tooling.join(", ")}`)
  }

  // ── Structure block ─────────────────────────────────────────────────────
  if (ctx.totalFileCount !== undefined) {
    lines.push(`Total files: ${ctx.totalFileCount}`)
  }

  // ── Import Graph (Phase 13.2.1) ────────────────────────────────────────
  // For selected/related files, show full import lists. For dangling imports,
  // always show — they indicate potential broken references.
  if (ctx.importGraph && Object.keys(ctx.importGraph).length > 0) {
    // Determine which files to show full details for
    const focusFiles = new Set([
      ...(ctx.selectedFiles ?? []),
      ...(ctx.relatedFiles ?? []),
    ])

    lines.push(`\nImport graph:`)
    for (const [filePath, imports] of Object.entries(ctx.importGraph)) {
      if (imports.length === 0) continue

      if (focusFiles.size === 0 || focusFiles.has(filePath)) {
        // Full details for focused files
        const importLines = imports.map(imp => {
          const ext = imp.isExternal ? " (external)" : ""
          const resolved = imp.resolvedPath ? ` → ${imp.resolvedPath}` : ""
          const typeOnly = imp.isTypeOnly ? " [type]" : ""
          return `    ${imp.source}${resolved}${ext}${typeOnly}`
        })
        lines.push(`  ${filePath}:`)
        lines.push(...importLines)
      } else {
        // Summary for non-focused files
        const localCount = imports.filter(i => !i.isExternal).length
        const externalCount = imports.filter(i => i.isExternal).length
        const parts: string[] = []
        if (localCount > 0) parts.push(`${localCount} local`)
        if (externalCount > 0) parts.push(`${externalCount} external`)
        lines.push(`  ${filePath}: ${parts.join(", ")}`)
      }
    }
  }

  if (ctx.danglingImports?.length) {
    lines.push(`\n⚠️ Unresolved imports:`)
    for (const d of ctx.danglingImports) {
      lines.push(`  ${d.file} → "${d.importSource}" (not found)`)
    }
  }

  // ── Related files (when selectedFiles + import graph available) ─────────
  if (ctx.selectedFiles?.length) {
    lines.push(`\nSelected files: ${ctx.selectedFiles.join(", ")}`)
  }
  if (ctx.relatedFiles?.length) {
    lines.push(`Related files: ${ctx.relatedFiles.join(", ")}`)
    if (ctx.relationReasons) {
      for (const rel of ctx.relatedFiles) {
        const reason = ctx.relationReasons[rel]
        if (reason) lines.push(`  ${rel} — ${reason}`)
      }
    }
  }

  // ── Component Intelligence (Phase 13.2.3) ─────────────────────────────
  // Show relevant component definitions and usage for selected/related files.
  if (ctx.componentIndex?.length) {
    const focusFiles = new Set([
      ...(ctx.selectedFiles ?? []),
      ...(ctx.relatedFiles ?? []),
    ]);

    // Determine which components are relevant to the current edit
    const relevantComponents = ctx.componentIndex.filter(
      (c) => focusFiles.size === 0 || focusFiles.has(c.filePath),
    );

    const totalComponents = ctx.componentIndex.length;
    const showingCount = relevantComponents.length;

    lines.push(`\nComponent Intelligence (${totalComponents} total${showingCount < totalComponents ? `, showing ${showingCount} relevant` : ""}):`)

    // Show definitions for relevant files
    if (relevantComponents.length > 0) {
      lines.push(`  Definitions:`)
      for (const comp of relevantComponents) {
        lines.push(`    ${comp.name} (${comp.exportType}, ${comp.componentType}) → ${comp.filePath}`)
      }
    }

    // Show usage for focus files
    if (ctx.componentUsage && focusFiles.size > 0) {
      for (const filePath of focusFiles) {
        const used = ctx.componentUsage[filePath]
        if (used?.length) {
          lines.push(`  ${filePath} uses: ${used.join(", ")}`)
        }
      }
    }

    // Summary line when there are many components
    if (relevantComponents.length < totalComponents) {
      const defaultCount = ctx.componentIndex.filter((c) => c.exportType === "default").length
      const namedCount = totalComponents - defaultCount
      const reactCount = ctx.componentIndex.filter((c) => c.componentType === "react").length
      lines.push(`  Summary: ${defaultCount} default exports, ${namedCount} named, ${reactCount} React components`)
    }
  }

  // ── Route tree (Phase B) ────────────────────────────────────────────────
  if (ctx.routeTree?.length) {
    const focusFiles = new Set([
      ...(ctx.selectedFiles ?? []),
      ...(ctx.relatedFiles ?? []),
    ]);

    // Determine which routes are relevant (focus files or their layout/page matches)
    const allRoutes = flattenRouteTree(ctx.routeTree);
    const relevantRoutes = allRoutes.filter(
      (r) =>
        focusFiles.size === 0 ||
        (r.pageFile && focusFiles.has(r.pageFile)) ||
        (r.layoutFile && focusFiles.has(r.layoutFile)),
    );

    // Metrics summary
    const totalRoutes = allRoutes.filter((r) => r.pageFile).length;
    const totalLayouts = allRoutes.filter((r) => r.layoutFile).length;
    const dynamicRoutes = allRoutes.filter((r) => r.segment && isDynamicSegment(r.segment)).length;

    lines.push(`\nRoute Intelligence:`);
    lines.push(`  Routes: ${totalRoutes}, Layouts: ${totalLayouts}, Dynamic: ${dynamicRoutes}`);

    // Show relevant subtree or full tree if small
    const routesToShow = relevantRoutes.length > 0 && focusFiles.size > 0
      ? relevantRoutes
      : allRoutes;

    for (const route of routesToShow) {
      const parts: string[] = [];
      if (route.pageFile) parts.push(`page: ${route.pageFile}`);
      if (route.layoutFile) parts.push(`layout: ${route.layoutFile}`);
      if (route.routeHandlerFile) parts.push(`api: ${route.routeHandlerFile}`);
      const details = parts.length > 0 ? ` [${parts.join(", ")}]` : "";
      const dynamic = route.segment && isDynamicSegment(route.segment) ? " ⚡dynamic" : "";
      lines.push(`  ${route.path}${dynamic}${details}`);
    }

    // Show layout hierarchy as a separate block when relevant
    if (ctx.layoutHierarchy?.length) {
      const relevantLayouts = ctx.layoutHierarchy.filter(
        (lh) => focusFiles.size === 0 || focusFiles.has(lh.layoutFile),
      );
      if (relevantLayouts.length > 0) {
        lines.push(`  Layout hierarchy:`);
        for (const lh of relevantLayouts) {
          lines.push(`    ${lh.segment} ← ${lh.layoutFile}`);
        }
      }
    }
  }

  // ── Recent changes ──────────────────────────────────────────────────────
  if (ctx.recentChanges?.length) {
    lines.push(`\nRecent changes:`)
    for (const change of ctx.recentChanges.slice(-5)) {
      lines.push(`  - ${change}`)
    }
  }

  // ── User preferences ────────────────────────────────────────────────────
  if (ctx.acceptedPatterns?.length) {
    lines.push(`\nUser-preferred patterns: ${ctx.acceptedPatterns.join(", ")}`)
  }
  if (ctx.rejectedPatterns?.length) {
    lines.push(`User-rejected patterns: ${ctx.rejectedPatterns.join(", ")}`)
  }

  // ── Project Memory (Phase 13.3.2) ──────────────────────────────────────
  if (ctx.projectMemory) {
    lines.push(`\n${ctx.projectMemory}`)
  }

  // ── Validation ──────────────────────────────────────────────────────────
  if (ctx.availableValidators) {
    const active = Object.entries(ctx.availableValidators)
      .filter(([k, v]) => k !== "buildCommand" && v)
      .map(([k]) => k);
    if (active.length > 0) {
      lines.push(`\nAvailable validators: ${active.join(", ")}`)
    }
  }

  return lines.length > 0
    ? `## Workspace Context\n${lines.join("\n")}`
    : ""
}

/** Compute the total token-estimate for a WorkspaceContext (rough: 4 chars ≈ 1 token). */
export function estimateTokens(ctx: WorkspaceContext): number {
  return Math.ceil(formatWorkspaceContext(ctx).length / 4)
}

/** Count how many fields are populated (for telemetry). */
export function populatedFieldCount(ctx: WorkspaceContext): number {
  let count = 0
  if (ctx.framework)           count++
  if (ctx.packageManager)      count++
  if (ctx.projectType)         count++
  if (ctx.dependencies)        count++
  if (ctx.tooling)             count++
  if (ctx.totalFileCount !== undefined) count++
  if (ctx.entryPoints)         count++
  if (ctx.pathAliases)         count++
  if (ctx.routeTree)           count++
  if (ctx.layoutHierarchy)     count++
  if (ctx.componentIndex)      count++
  if (ctx.componentUsage)      count++
  if (ctx.importGraph)         count++
  if (ctx.danglingImports)     count++
  if (ctx.designTokens)        count++
  if (ctx.stylingApproach)     count++
  if (ctx.stateManagement)     count++
  if (ctx.dataFetching)        count++
  if (ctx.selectedFiles)       count++
  if (ctx.relatedFiles)        count++
  if (ctx.relationReasons)     count++
  if (ctx.recentChanges)       count++
  if (ctx.acceptedPatterns)    count++
  if (ctx.rejectedPatterns)    count++
  if (ctx.availableValidators) count++
  if (ctx.projectMemory)      count++
  return count
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

export interface FlattenedRoute {
  path: string
  segment: string
  pageFile: string | null
  layoutFile: string | null
  routeHandlerFile: string | null
}

export function flattenRouteTree(nodes: RouteNode[], prefix = ""): FlattenedRoute[] {
  const result: FlattenedRoute[] = []
  for (const node of nodes) {
    const fullPath = prefix + node.path
    result.push({
      path: fullPath,
      segment: node.segment,
      pageFile: node.pageFile,
      layoutFile: node.layoutFile,
      routeHandlerFile: node.routeHandlerFile,
    })
    if (node.children.length > 0) {
      result.push(...flattenRouteTree(node.children, fullPath))
    }
  }
  return result
}

function isDynamicSegment(segment: string): boolean {
  return /^\[.*\]$/.test(segment) && !segment.startsWith("[...")
}
