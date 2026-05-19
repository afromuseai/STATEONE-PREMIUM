import { Router } from "express";
import { db, projectsTable } from "@workspace/db";
import { eq, and, desc, isNotNull } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { randomBytes } from "crypto";

const router = Router();

router.post("/projects/:id/share", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = req.params.id as string;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let shareToken = project.shareToken;
  if (!shareToken) {
    shareToken = randomBytes(16).toString("hex");
  }

  const [updated] = await db
    .update(projectsTable)
    .set({ shareToken, isPublic: true })
    .where(eq(projectsTable.id, id))
    .returning();

  res.json({ shareToken: updated.shareToken, shareUrl: `/p/${updated.shareToken}` });
});

router.post("/projects/:id/unshare", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = req.params.id as string;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.id, id), eq(projectsTable.userId, userId)));

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await db
    .update(projectsTable)
    .set({ isPublic: false })
    .where(eq(projectsTable.id, id));

  res.json({ success: true });
});

router.get("/share/:token", async (req, res): Promise<void> => {
  const token = req.params.token as string;

  const [project] = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.shareToken, token), eq(projectsTable.isPublic, true)));

  if (!project) {
    res.status(404).json({ error: "Project not found or not public" });
    return;
  }

  res.json({
    project: {
      id: project.id,
      title: project.title,
      businessIdea: project.businessIdea,
      output: project.output,
      websiteOutput: project.websiteOutput,
      isFeatured: project.isFeatured,
      createdAt: project.createdAt,
    },
  });
});

router.get("/showcase", async (_req, res): Promise<void> => {
  const projects = await db
    .select()
    .from(projectsTable)
    .where(and(eq(projectsTable.isPublic, true), isNotNull(projectsTable.shareToken)))
    .orderBy(desc(projectsTable.updatedAt))
    .limit(50);

  res.json({
    projects: projects.map((p) => ({
      id: p.id,
      title: p.title,
      businessIdea: p.businessIdea,
      shareToken: p.shareToken,
      isFeatured: p.isFeatured,
      hasWebsite: !!p.websiteOutput,
      createdAt: p.createdAt,
    })),
  });
});

export default router;
