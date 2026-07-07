// ─── Website Architect V2 — Preview Regeneration Route ───────────────────────
// POST /api/website-v2/projects/:id/preview
//
// Standalone endpoint for manually regenerating the preview HTML from the
// current project files. Also called internally after AI edits.
//
// SSE events: analyzing → rendering → preview → saved
//
// V1 is completely untouched.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { logger } from "../lib/logger";
import { runPreviewGenerator } from "../lib/website-v2-preview-generator";
import { getV2Project, updateProjectPreview } from "../lib/website-v2-projects";
import type {
  BusinessContext,
  WebsiteBlueprint,
  ProjectFile,
  V2PreviewSseEvent,
} from "../lib/website-v2-types";

const router = Router();

// eslint-disable-next-line @typescript-eslint/no-misused-promises
router.post("/website-v2/projects/:id/preview", requireAuth, async (req, res) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyReq   = req as any;
  const id       = anyReq.params.id as string;
  const userId   = (anyReq.user?.id ?? anyReq.user?.userId ?? "") as string;

  // ── SSE setup ───────────────────────────────────────────────────────────────
  res.setHeader("Content-Type",      "text/event-stream");
  res.setHeader("Cache-Control",     "no-cache");
  res.setHeader("Connection",        "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const emit = (event: V2PreviewSseEvent) => {
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
    const blueprint = project.blueprint      as unknown as WebsiteBlueprint | null;
    const files     = (project.files         as unknown as ProjectFile[]) ?? [];

    if (files.length === 0) {
      emit({ phase: "error", message: "Project has no files to render" });
      res.end();
      return;
    }

    logger.info({ projectId: id, userId, fileCount: files.length }, "[v2:preview-route] Starting regeneration");

    emit({ phase: "analyzing" });
    emit({ phase: "rendering" });

    // ── Run preview generator ─────────────────────────────────────────────────
    const preview = await runPreviewGenerator(context, blueprint, files, { userId, projectId: id });

    emit({ phase: "preview", data: { preview } });

    // ── Persist ───────────────────────────────────────────────────────────────
    await updateProjectPreview(id, preview);

    emit({ phase: "saved" });
    res.end();

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Preview generation failed";
    logger.error({ err: String(err), projectId: id }, "[v2:preview-route] Error");
    emit({ phase: "error", message });
    res.end();
  }
});

export default router;
