// ─── Website Architect V2 — AI Editing Route ──────────────────────────────────
// POST /api/website-v2/projects/:id/edit
//
// Flow:
//   Request (instruction + optional selectedFiles)
//     ↓
//   Load project (ownership-checked)
//     ↓
//   SSE: analyzing → editing → changes → saved
//
// V1 is completely untouched. website-html-generator.ts is NOT used here.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { runEditingAgent } from "../lib/website-v2-editor";
import { getV2Project, updateProjectFiles } from "../lib/website-v2-projects";
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
  const userId: string = anyReq.user?.id as string ?? "";

  const body = req.body as { instruction?: unknown; selectedFiles?: unknown };
  const instruction   = typeof body.instruction   === "string"   ? body.instruction   : "";
  const selectedFiles = Array.isArray(body.selectedFiles)
    ? (body.selectedFiles as unknown[]).filter((x): x is string => typeof x === "string")
    : undefined;

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

  try {
    // ── Load project ──────────────────────────────────────────────────────────
    const project = await getV2Project(id, userId);
    if (!project) {
      emit({ phase: "error", message: "Project not found or access denied" });
      res.end();
      return;
    }

    const context   = project.businessContext as unknown as BusinessContext;
    const blueprint = project.blueprint as unknown as WebsiteBlueprint | null;
    const files     = (project.files as unknown as ProjectFile[]) ?? [];

    if (files.length === 0) {
      emit({ phase: "error", message: "Project has no files to edit" });
      res.end();
      return;
    }

    logger.info(
      { projectId: id, userId, instruction: instruction.slice(0, 80) },
      "[v2:edit] Starting edit request"
    );

    // ── analyzing ─────────────────────────────────────────────────────────────
    emit({ phase: "analyzing" });

    // ── editing (LLM call) ────────────────────────────────────────────────────
    emit({ phase: "editing" });

    const result = await runEditingAgent(
      context,
      blueprint,
      files,
      instruction.trim(),
      selectedFiles,
      { userId, projectId: id }
    );

    // ── send changes to client ────────────────────────────────────────────────
    emit({ phase: "changes", data: result });

    // ── persist to DB ─────────────────────────────────────────────────────────
    const { ok } = await updateProjectFiles(id, result.changes);
    if (!ok) {
      emit({ phase: "error", message: "Failed to save changes to database" });
      res.end();
      return;
    }

    // ── done ──────────────────────────────────────────────────────────────────
    emit({ phase: "saved", fileCount: result.changes.length });
    res.end();

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Edit failed";
    logger.error({ err: String(err), projectId: id }, "[v2:edit] Error");
    emit({ phase: "error", message });
    res.end();
  }
});

export default router;
