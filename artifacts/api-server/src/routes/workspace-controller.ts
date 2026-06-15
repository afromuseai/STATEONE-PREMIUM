import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, workspaceTasksTable, projectsTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { z } from "zod";
import { appendProjectEvent } from "../lib/project-events";
import { logEventFireForget } from "../lib/log-event";

const router = Router();

// ─── Create tasks ────────────────────────────────────────────────────────────
router.post("/workspace/tasks", requireAuth, async (req, res): Promise<void> => {
  const Body = z.object({
    tasks: z.array(z.object({
      title: z.string().min(1).max(500),
      category: z.string().optional(),
    })).min(1).max(30),
    projectId: z.string().uuid().optional().nullable(),
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const userId = req.user!.userId;
  const { tasks, projectId } = parsed.data;

  const rows = await db.insert(workspaceTasksTable).values(
    tasks.map((t, i) => ({
      userId,
      projectId: projectId ?? undefined,
      title: t.title,
      category: t.category ?? "general",
      sortOrder: i,
    }))
  ).returning();

  res.status(201).json({ tasks: rows });
  logEventFireForget({ userId, projectId: projectId ?? undefined, type: "marcus_task_created", data: { count: rows.length }, req });
});

// ─── Get tasks ───────────────────────────────────────────────────────────────
router.get("/workspace/tasks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const projectId = req.query.projectId as string | undefined;

  const conditions = [eq(workspaceTasksTable.userId, userId)];
  if (projectId) conditions.push(eq(workspaceTasksTable.projectId, projectId));

  const tasks = await db.select()
    .from(workspaceTasksTable)
    .where(and(...conditions))
    .orderBy(asc(workspaceTasksTable.sortOrder), asc(workspaceTasksTable.createdAt));

  res.json({ tasks });
});

// ─── Update task ─────────────────────────────────────────────────────────────
router.patch("/workspace/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = req.params["id"] as string;

  const Body = z.object({
    status: z.enum(["pending", "done"]).optional(),
    title: z.string().min(1).max(500).optional(),
  });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid input" });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    updates.completedAt = parsed.data.status === "done" ? new Date() : null;
  }
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;

  const [task] = await db.update(workspaceTasksTable)
    .set(updates)
    .where(and(eq(workspaceTasksTable.id, id), eq(workspaceTasksTable.userId, userId)))
    .returning();

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Record task completion in project history (best-effort)
  if (parsed.data.status === "done" && task.projectId) {
    appendProjectEvent(task.projectId, userId, {
      type: "task.completed",
      label: `Task completed: "${task.title.slice(0, 80)}"`,
    }).catch(() => {});
  }

  res.json({ task });
});

// ─── Delete task ─────────────────────────────────────────────────────────────
router.delete("/workspace/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = req.params["id"] as string;

  const [deleted] = await db.delete(workspaceTasksTable)
    .where(and(eq(workspaceTasksTable.id, id), eq(workspaceTasksTable.userId, userId)))
    .returning({ id: workspaceTasksTable.id });

  if (!deleted) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  res.json({ ok: true });
});

// ─── Full project structure ───────────────────────────────────────────────────
router.get("/workspace/project-structure/:projectId", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const projectId = req.params["projectId"] as string;

  const [project] = await db.select().from(projectsTable)
    .where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, userId)))
    .limit(1);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = await db.select().from(workspaceTasksTable)
    .where(and(
      eq(workspaceTasksTable.userId, userId),
      eq(workspaceTasksTable.projectId, projectId)
    ))
    .orderBy(asc(workspaceTasksTable.sortOrder), asc(workspaceTasksTable.createdAt));

  res.json({
    project: {
      id: project.id,
      title: project.title,
      businessIdea: project.businessIdea,
      hasBi: !!project.output,
      hasWebsite: !!project.websiteOutput,
      createdAt: project.createdAt,
    },
    structure: {
      businessIntelligence: !!project.output,
      website: !!project.websiteOutput,
      tasks,
      taskSummary: {
        total: tasks.length,
        done: tasks.filter(t => t.status === "done").length,
        pending: tasks.filter(t => t.status === "pending").length,
      },
    },
  });
});

export default router;
