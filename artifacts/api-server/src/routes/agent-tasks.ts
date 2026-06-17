import { Router } from "express";
import { db, agentTasksTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { emitNotification } from "./notifications";
import { enqueueJob } from "../lib/worker";
import { logger } from "../lib/logger";

const router = Router();

const SIMULATED_TASKS = [
  { title: "Lead enrichment scan", category: "Sales", confidence: 92, agentKey: "sales-prospector" },
  { title: "Support ticket triage", category: "Support", confidence: 87, agentKey: "support-resolver" },
  { title: "Content calendar generation", category: "Marketing", confidence: 78, agentKey: "content-generator" },
  { title: "Competitive landscape analysis", category: "Research", confidence: 95, agentKey: "market-researcher" },
  { title: "Invoice reconciliation", category: "Operations", confidence: 90, agentKey: "invoice-collector" },
  { title: "Revenue anomaly detection", category: "Analytics", confidence: 84, agentKey: "revenue-analyst" },
  { title: "Vulnerability scan", category: "Cybersecurity", confidence: 96, agentKey: "security-watcher" },
  { title: "Email sequence optimization", category: "Sales", confidence: 81, agentKey: "email-outreach" },
];

const CreateTaskBody = z.object({
  agentKey: z.string().min(1),
  agentId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().min(1).max(5).optional().default(3),
  category: z.string().optional().default("general"),
  scheduledAt: z.string().datetime().optional(),
});

const UpdateTaskBody = z.object({
  status: z.enum(["pending", "running", "completed", "failed", "cancelled"]).optional(),
  outcome: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  confidence: z.number().int().min(0).max(100).optional(),
});

router.get("/agents/tasks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { agentKey, status, limit } = req.query as Record<string, string>;

  let query = db
    .select()
    .from(agentTasksTable)
    .where(eq(agentTasksTable.userId, userId))
    .orderBy(desc(agentTasksTable.createdAt))
    .limit(Number(limit ?? 50));

  const tasks = await query;

  const filtered = tasks.filter(t => {
    if (agentKey && t.agentKey !== agentKey) return false;
    if (status && t.status !== status) return false;
    return true;
  });

  const stats = {
    total: filtered.length,
    pending: filtered.filter(t => t.status === "pending").length,
    running: filtered.filter(t => t.status === "running").length,
    completed: filtered.filter(t => t.status === "completed").length,
    failed: filtered.filter(t => t.status === "failed").length,
  };

  res.json({ tasks: filtered, stats });
});

router.post("/agents/tasks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [task] = await db
    .insert(agentTasksTable)
    .values({
      userId,
      agentKey: parsed.data.agentKey,
      agentId: parsed.data.agentId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      category: parsed.data.category,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
    })
    .returning();

  // Fire-and-forget: enqueue a worker job for this agent task.
  // Never blocks the HTTP response.
  logger.info({ taskId: task.id, agentKey: task.agentKey, userId }, "EXECUTION_CREATED");
  enqueueJob({
    userId,
    name: task.title,
    type: "agent",
    payload: {
      jobType:  "agent_task",
      taskId:   task.id,
      agentKey: task.agentKey,
      userId,
    },
    priority:    task.priority,
    scheduledAt: task.scheduledAt ?? null,
  }).then(execution => {
    logger.info(
      { executionId: execution.id, taskId: task.id, jobType: "agent_task", userId },
      "JOB_ENQUEUED",
    );
  }).catch(() => {/* never surface to caller */});

  res.status(201).json({ task });
});

router.patch("/agents/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateTaskBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "running") updates.startedAt = new Date();
    if (parsed.data.status === "completed" || parsed.data.status === "failed") updates.completedAt = new Date();
  }
  if (parsed.data.outcome !== undefined) updates.outcome = parsed.data.outcome;
  if (parsed.data.errorMessage !== undefined) updates.errorMessage = parsed.data.errorMessage;
  if (parsed.data.confidence !== undefined) updates.confidence = parsed.data.confidence;

  const [task] = await db
    .update(agentTasksTable)
    .set(updates)
    .where(and(eq(agentTasksTable.id, id), eq(agentTasksTable.userId, userId)))
    .returning();
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  if (parsed.data.status === "completed") {
    emitNotification(userId, "agent.task.completed", "Agent Task Completed", `"${task.title}" finished successfully.`, "success", { taskId: task.id, agentKey: task.agentKey }).catch(() => {});
  } else if (parsed.data.status === "failed") {
    emitNotification(userId, "agent.task.failed", "Agent Task Failed", `"${task.title}" encountered an error.${task.errorMessage ? ` ${task.errorMessage}` : ""}`, "error", { taskId: task.id, agentKey: task.agentKey }).catch(() => {});
  }

  res.json({ task });
});

router.delete("/agents/tasks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(agentTasksTable)
    .where(and(eq(agentTasksTable.id, id), eq(agentTasksTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Task not found" }); return; }
  res.sendStatus(204);
});

router.post("/agents/tasks/simulate", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const pick = SIMULATED_TASKS[Math.floor(Math.random() * SIMULATED_TASKS.length)]!;
  const statuses = ["pending", "running", "completed", "completed", "completed"] as const;
  const status = statuses[Math.floor(Math.random() * statuses.length)]!;
  const [task] = await db
    .insert(agentTasksTable)
    .values({
      userId,
      agentKey: pick.agentKey,
      title: pick.title,
      category: pick.category,
      confidence: pick.confidence,
      status,
      startedAt: status !== "pending" ? new Date(Date.now() - Math.random() * 60000) : null,
      completedAt: status === "completed" ? new Date() : null,
      outcome: status === "completed" ? { summary: `${pick.title} completed successfully`, itemsProcessed: Math.floor(Math.random() * 100 + 10) } : null,
    })
    .returning();
  res.status(201).json({ task });
});

export default router;
