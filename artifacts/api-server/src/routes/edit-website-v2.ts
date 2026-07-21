// ─── Website Architect V2 — AI Editing Route ──────────────────────────────────
// POST /api/website-v2/projects/:id/edit
//
// Commit 4: MarcusController now owns the edit pipeline (Editing Agent →
// file persistence → preview regeneration/validation), narrated through the
// same MarcusTaskBus / MarcusConversationEngine backbone used by website
// generation. This route is the thin request-lifecycle shell:
//
//   Auth + load project
//     ↓
//   Build the Marcus runtime (task bus + conversation engine), per request
//     ↓
//   MarcusController.runEditFlow(runtime) — owns UNDERSTAND → PLAN → BUILD → TEST → REPORT
//     ↓
//   Stream the SSE frames the controller forwards via onSse
//     ↓
//   Write the final `saved` / `preview-ready` / `error` frame
//
// The legacy phase frames (analyzing/editing/changes/saved/regenerating/
// preview-ready) are preserved unchanged so the existing file-explorer and
// preview-refresh triggers keep working. The new `agent` frames carry real
// ConversationEvents for chat narration (Step 6/7 of the spec).
//
// V1 is completely untouched. website-html-generator.ts is NOT used here.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { getV2Project } from "../lib/website-v2-projects";
import { MarcusConversationEngine } from "../lib/agents/marcus-conversation";
import { MarcusTaskBus } from "../lib/agents/marcus-task-bus";
import { MarcusController } from "../lib/agents/marcus-controller";
import { WorkspaceContextBuilder } from "../lib/workspace-context-builder";
import { ImportGraphBuilder } from "../lib/import-graph-builder";
import { ComponentIndexBuilder } from "../lib/component-index-builder";
import { RouteTreeBuilder } from "../lib/route-tree-builder";
import type { RawWorkspaceScan } from "../lib/workspace-context-builder";
import { flattenRouteTree } from "../lib/workspace-context";
import type {
  BusinessContext,
  WebsiteBlueprint,
  ProjectFile,
  V2EditSseEvent,
} from "../lib/website-v2-types";

const router = Router();

// ─── Edit route ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post("/website-v2/projects/:id/edit", requireAuth, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq = req as any;
  const id: string     = anyReq.params.id as string;
  const userId: string = (anyReq.user?.id ?? anyReq.user?.userId ?? "") as string;

  const body = req.body as { instruction?: unknown; selectedFiles?: unknown; workspaceContext?: unknown };
  const instruction   = typeof body.instruction   === "string" ? body.instruction   : "";
  const selectedFiles = Array.isArray(body.selectedFiles)
    ? (body.selectedFiles as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;
  const rawScan       = body.workspaceContext as RawWorkspaceScan | undefined;

  if (!instruction.trim()) {
    res.status(400).json({ error: "instruction is required" });
    return;
  }

  // ── SSE setup ───────────────────────────────────────────────────────────────
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (event: V2EditSseEvent) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  // Marcus runtime for this edit request — one bus + one engine, per request,
  // discarded when the request ends. No global instances.
  const bus    = new MarcusTaskBus();
  const engine = new MarcusConversationEngine();
  const pipelineStart = Date.now();

  try {
    // ── Load project ──────────────────────────────────────────────────────────
    const project = await getV2Project(id, userId);
    if (!project) {
      emit({ phase: "error", message: "Project not found or access denied" });
      res.end();
      return;
    }

    const context   = project.businessContext as unknown as BusinessContext;
    const blueprint = project.blueprint      as unknown as WebsiteBlueprint | null;
    const files     = (project.files         as unknown as ProjectFile[]) ?? [];

    if (files.length === 0) {
      emit({ phase: "error", message: "Project has no files to edit" });
      res.end();
      return;
    }

    // ── Phase 13.1: Build WorkspaceContext from frontend scan + DB data ───
    const ctxBuilder = new WorkspaceContextBuilder({
      scan:             rawScan ?? {},
      businessContext:  context,
      blueprint,
      fileCount:        files.length,
      files,                         // Phase 13.2.1: for import graph
      projectId:        id,          // Phase 13.2.1: for import graph caching
      selectedFiles,                 // Phase 13.2.2: for related files
    });
    const workspaceContext = ctxBuilder.build();
    logger.info(
      { projectId: id, buildTimeMs: ctxBuilder.getBuildTimeMs(), populatedFields: Object.keys(workspaceContext).length, importGraphCached: ctxBuilder.wasImportGraphCached() },
      "[v2:edit] WorkspaceContext built"
    );

    logger.info(
      { projectId: id, userId, instruction: instruction.slice(0, 80) },
      "[v2:edit] Starting edit request"
    );

    // ── analyzing / editing — legacy lifecycle frames, kept for the existing
    //    status-strip UI while the richer `agent` narration streams alongside ──
    emit({ phase: "analyzing" });
    emit({ phase: "editing" });

    // ── Phase 13.1: Telemetry — capture WorkspaceContext metrics ──────────
    const importGraphKeys = workspaceContext.importGraph ? Object.keys(workspaceContext.importGraph) : []
    const telemetryCtx = {
      buildTimeMs: ctxBuilder.getBuildTimeMs(),
      populatedFields: Object.keys(workspaceContext).filter(k => workspaceContext[k as keyof typeof workspaceContext] !== undefined).length,
      hasFramework: !!workspaceContext.framework,
      hasPackageManager: !!workspaceContext.packageManager,
      hasEntryPoints: !!(workspaceContext.entryPoints?.length),
      hasPathAliases: !!(workspaceContext.pathAliases && Object.keys(workspaceContext.pathAliases).length > 0),
      hasEnrichedDeps: !!(workspaceContext.dependencies?.length),
      hasRecentChanges: !!(workspaceContext.recentChanges?.length),
      hasPatterns: !!(workspaceContext.acceptedPatterns?.length || workspaceContext.rejectedPatterns?.length),
      selectedFileCount: selectedFiles?.length ?? 0,
      totalFileCount: files.length,
      // Phase 13.2.1: Import graph telemetry
      importGraphCached: ctxBuilder.wasImportGraphCached(),
      importGraphFiles: importGraphKeys.length,
      danglingImportCount: workspaceContext.danglingImports?.length ?? 0,
      // Phase 13.2.2: Related files telemetry
      relatedFilesComputed: ctxBuilder.wasRelatedFilesComputed(),
      relatedFileCount: workspaceContext.relatedFiles?.length ?? 0,
      // Phase 13.2.3: Component intelligence telemetry
      componentIndexCached: ctxBuilder.wasComponentIndexCached(),
      componentCount: workspaceContext.componentIndex?.length ?? 0,
      componentUsageFiles: workspaceContext.componentUsage ? Object.keys(workspaceContext.componentUsage).length : 0,
      // Phase 13.2.4: Route intelligence telemetry
      routeCount: workspaceContext.routeTree
        ? flattenRouteTree(workspaceContext.routeTree).filter((r) => r.pageFile).length
        : 0,
      layoutCount: workspaceContext.layoutHierarchy?.length ?? 0,
      hasRouteTree: !!workspaceContext.routeTree,
      // Phase 13.3.2: Project memory telemetry
      memoryRetrievalTimeMs: ctxBuilder.getMemoryRetrievalTimeMs(),
      memoryCount: ctxBuilder.getMemoryCount(),
      hasProjectMemory: !!workspaceContext.projectMemory,
    };
    logger.info(telemetryCtx, "[v2:edit] WorkspaceContext telemetry");

    const result = await MarcusController.runEditFlow({
      taskBus:            bus,
      conversationEngine: engine,
      projectId:          id,
      userId,
      businessContext:    context,
      blueprint,
      files,
      instruction:        instruction.trim(),
      selectedFiles,
      workspaceContext,
      pipelineStart,
      onSse: emit,
    });

    if (!result.ok) {
      emit({ phase: "error", message: result.message });
      res.end();
      return;
    }

    // ── Phase 13.2.1: Invalidate import graph cache after file changes ───
    ImportGraphBuilder.invalidate(id);
    // ── Phase 13.2.3: Invalidate component index cache after file changes ──
    ComponentIndexBuilder.invalidate(id);
    // ── Phase 13.2.4: Invalidate route tree cache after file changes ──────
    RouteTreeBuilder.invalidate(id);

    // ── send changes to client (unchanged contract: FileModification[] + summary)
    emit({ phase: "changes", data: { changes: result.changes, summary: result.summary } });

    // ── files saved — client can immediately refresh the code explorer ────────
    emit({ phase: "saved", fileCount: result.fileCount });

    // ── preview regenerated (or non-fatally skipped) — client refreshes iframe ─
    emit({ phase: "regenerating" });
    emit({ phase: "preview-ready" });
    res.end();

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Edit failed";
    logger.error({ err: String(err), projectId: id }, "[v2:edit] Error");
    emit({ phase: "error", message });
    res.end();
  }
});

export default router;
