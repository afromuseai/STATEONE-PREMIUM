/**
 * STAGEONE V5 — Business Graph Memory API
 *
 * GET  /api/business-graph/:projectId          → getBusinessGraph
 * GET  /api/business-graph/:projectId/timeline → getBusinessTimeline
 * POST /api/business-graph/:projectId/snapshot → createMemorySnapshot (manual)
 */

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getBusinessGraph,
  getBusinessTimeline,
  createMemorySnapshot,
} from "../lib/business-graph";
import { db, projectsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router = Router();

// Verify the caller owns the project
async function ownsProject(projectId: string, userId: string): Promise<boolean> {
  const [p] = await db
    .select({ id: projectsTable.id })
    .from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
    .limit(1);
  return !!p;
}

// GET /api/business-graph/:projectId
router.get("/business-graph/:projectId", requireAuth, async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;

    if (!await ownsProject(projectId, userId)) {
      res.status(403).json({ error: "Access denied" }); return;
    }

    const graph = await getBusinessGraph(projectId);
    if (!graph) {
      res.json({ graph: null, message: "No business graph yet — generate a business plan to create one" });
      return;
    }

    res.json({ graph });
  } catch (err) {
    req.log.error({ err }, "Get business graph error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/business-graph/:projectId/timeline
router.get("/business-graph/:projectId/timeline", requireAuth, async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const limit = Math.min(Number(req.query.limit ?? 50), 100);

    if (!await ownsProject(projectId, userId)) {
      res.status(403).json({ error: "Access denied" }); return;
    }

    const timeline = await getBusinessTimeline(projectId, limit);
    res.json({ timeline, count: timeline.length });
  } catch (err) {
    req.log.error({ err }, "Get timeline error");
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/business-graph/:projectId/snapshot
router.post("/business-graph/:projectId/snapshot", requireAuth, async (req, res): Promise<void> => {
  try {
    const { projectId } = req.params;
    const userId = req.user!.userId;
    const { changeSummary } = req.body;

    if (!await ownsProject(projectId, userId)) {
      res.status(403).json({ error: "Access denied" }); return;
    }

    await createMemorySnapshot(projectId, userId, "manual", changeSummary);
    res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Create snapshot error");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
