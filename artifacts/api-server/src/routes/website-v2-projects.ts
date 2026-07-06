// ─── Website Architect V2 — Project Retrieval Routes ─────────────────────────
// GET /api/website-v2/projects       — list user's projects (summary only)
// GET /api/website-v2/projects/:id   — full project for Website Studio workspace
//
// Security: requireAuth enforced on every route. Users can only read their own
// projects — getProject returns null for any foreign userId, which surfaces as 404.

import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { listProjects, getProject } from "../lib/website-v2-projects";
import type {
  WebsiteProjectSummary,
  WebsiteProjectResponse,
  ProjectFile,
  WebsiteBlueprint,
  BusinessContext,
} from "../lib/website-v2-types";

const router = Router();

// ─── GET /api/website-v2/projects ─────────────────────────────────────────────
// Returns all V2 projects belonging to the authenticated user.
// Only summary fields — heavy JSONB (files, blueprint, preview) are excluded.
router.get(
  "/website-v2/projects",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = req.user?.userId ?? "";

    const rows = await listProjects(userId);

    const projects: WebsiteProjectSummary[] = rows.map((r) => ({
      id:          r.id,
      projectName: r.projectName,
      status:      r.status,
      createdAt:   r.createdAt.toISOString(),
      updatedAt:   r.updatedAt.toISOString(),
    }));

    res.json({ projects });
  }
);

// ─── GET /api/website-v2/projects/:id ─────────────────────────────────────────
// Returns the complete project record for the Website Studio workspace.
// 404 if the project doesn't exist or belongs to a different user.
router.get(
  "/website-v2/projects/:id",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId    = (req.user?.userId ?? "") as string;
    const projectId = req.params.id as string;

    if (!projectId) {
      res.status(400).json({ error: "Missing project id" });
      return;
    }

    const row = await getProject(projectId, userId);

    if (!row) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const response: WebsiteProjectResponse = {
      id:              row.id,
      projectName:     row.projectName,
      status:          row.status,
      businessContext: row.businessContext as unknown as BusinessContext,
      blueprint:       (row.blueprint as unknown as WebsiteBlueprint) ?? null,
      files:           Array.isArray(row.files)
                         ? (row.files as unknown as ProjectFile[])
                         : [],
      dependencies:    Array.isArray(row.dependencies)
                         ? (row.dependencies as unknown as string[])
                         : [],
      preview:         row.preview ?? null,
      createdAt:       row.createdAt.toISOString(),
      updatedAt:       row.updatedAt.toISOString(),
    };

    res.json(response);
  }
);

export default router;
