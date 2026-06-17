import { Router } from "express";
import { db, executionsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { emitNotification } from "./notifications";
import { logger } from "../lib/logger";

// Maps the broad execution type to the registered worker handler key.
// payload.jobType always takes precedence (callers can override).
const JOB_TYPE_MAP: Record<string, string> = {
  agent:      "agent_task",
  automation: "automation_run",
  scheduled:  "scheduled_task",
  event:      "noop",
  // "workflow" intentionally omitted — no handler yet; worker will fail→retry→fail gracefully
};

const router = Router();

const CreateExecutionBody = z.object({
  name: z.string().min(1),
  type: z.enum(["workflow", "agent", "automation", "scheduled", "event"]).optional().default("workflow"),
  trigger: z.enum(["manual", "schedule", "event", "api", "agent"]).optional().default("manual"),
  priority: z.number().int().min(1).max(5).optional().default(3),
  payload: z.record(z.unknown()).optional().default({}),
  maxRetries: z.number().int().min(0).max(5).optional().default(3),
  scheduledAt: z.string().datetime().optional(),
});

const UpdateExecutionBody = z.object({
  status: z.enum(["queued", "running", "success", "failed", "cancelled", "retrying"]).optional(),
  result: z.record(z.unknown()).optional(),
  errorMessage: z.string().optional(),
  durationMs: z.number().int().optional(),
  logs: z.array(z.object({
    timestamp: z.string(),
    level: z.string(),
    message: z.string(),
  })).optional(),
});

router.get("/executions", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { type, status, limit } = req.query as Record<string, string>;
  const executions = await db
    .select()
    .from(executionsTable)
    .where(eq(executionsTable.userId, userId))
    .orderBy(desc(executionsTable.createdAt))
    .limit(Number(limit ?? 100));

  const filtered = executions.filter(e => {
    if (type && e.type !== type) return false;
    if (status && e.status !== status) return false;
    return true;
  });

  const stats = {
    total: filtered.length,
    queued: filtered.filter(e => e.status === "queued").length,
    running: filtered.filter(e => e.status === "running").length,
    success: filtered.filter(e => e.status === "success").length,
    failed: filtered.filter(e => e.status === "failed").length,
    avgDurationMs: filtered
      .filter(e => e.durationMs != null)
      .reduce((sum, e, _, arr) => sum + (e.durationMs ?? 0) / arr.length, 0),
  };

  res.json({ executions: filtered, stats });
});

router.get("/executions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [execution] = await db
    .select()
    .from(executionsTable)
    .where(and(eq(executionsTable.id, id), eq(executionsTable.userId, userId)));
  if (!execution) { res.status(404).json({ error: "Execution not found" }); return; }
  res.json({ execution });
});

router.post("/executions", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateExecutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;

  // Enrich payload: inject jobType so the worker resolves the correct handler.
  // Callers may override by supplying payload.jobType themselves.
  const mappedJobType = JOB_TYPE_MAP[parsed.data.type];
  const enrichedPayload: Record<string, unknown> = { ...parsed.data.payload };
  if (mappedJobType && !enrichedPayload.jobType) {
    enrichedPayload.jobType = mappedJobType;
  }
  if (!enrichedPayload.userId) enrichedPayload.userId = userId;

  const [execution] = await db
    .insert(executionsTable)
    .values({
      userId,
      name: parsed.data.name,
      type: parsed.data.type,
      trigger: parsed.data.trigger,
      priority: parsed.data.priority,
      payload: enrichedPayload,
      maxRetries: parsed.data.maxRetries,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null,
      status: "queued",
      logs: [],
    })
    .returning();

  logger.info(
    {
      executionId: execution.id,
      jobType: enrichedPayload.jobType ?? parsed.data.type,
      userId,
      projectId: enrichedPayload.projectId ?? null,
    },
    "EXECUTION_CREATED",
  );

  res.status(201).json({ execution });
});

router.patch("/executions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateExecutionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) {
    updates.status = parsed.data.status;
    if (parsed.data.status === "running") updates.startedAt = new Date();
    if (parsed.data.status === "success" || parsed.data.status === "failed") updates.completedAt = new Date();
  }
  if (parsed.data.result !== undefined) updates.result = parsed.data.result;
  if (parsed.data.errorMessage !== undefined) updates.errorMessage = parsed.data.errorMessage;
  if (parsed.data.durationMs !== undefined) updates.durationMs = parsed.data.durationMs;
  if (parsed.data.logs !== undefined) updates.logs = parsed.data.logs;

  const [execution] = await db
    .update(executionsTable)
    .set(updates)
    .where(and(eq(executionsTable.id, id), eq(executionsTable.userId, userId)))
    .returning();
  if (!execution) { res.status(404).json({ error: "Execution not found" }); return; }

  if (parsed.data.status === "success") {
    emitNotification(userId, "execution.success", "Execution Completed", `"${execution.name}" finished successfully.`, "success", { executionId: execution.id, type: execution.type }).catch(() => {});
  } else if (parsed.data.status === "failed") {
    emitNotification(userId, "execution.failed", "Execution Failed", `"${execution.name}" failed.${execution.errorMessage ? ` ${execution.errorMessage}` : ""}`, "error", { executionId: execution.id, type: execution.type }).catch(() => {});
  }

  res.json({ execution });
});

router.post("/executions/:id/retry", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [execution] = await db
    .select()
    .from(executionsTable)
    .where(and(eq(executionsTable.id, id), eq(executionsTable.userId, userId)));
  if (!execution) { res.status(404).json({ error: "Execution not found" }); return; }
  if (execution.retryCount >= execution.maxRetries) {
    res.status(400).json({ error: "Max retries reached" });
    return;
  }
  const [updated] = await db
    .update(executionsTable)
    .set({ status: "queued", retryCount: execution.retryCount + 1, errorMessage: null, completedAt: null })
    .where(and(eq(executionsTable.id, id), eq(executionsTable.userId, userId)))
    .returning();
  res.json({ execution: updated });
});

router.delete("/executions/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(executionsTable)
    .where(and(eq(executionsTable.id, id), eq(executionsTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Execution not found" }); return; }
  res.sendStatus(204);
});

router.post("/executions/simulate", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const types = ["workflow", "agent", "automation", "scheduled"] as const;
  const triggers = ["manual", "schedule", "event", "api", "agent"] as const;
  const statuses = ["queued", "running", "success", "success", "success", "failed"] as const;
  const names = [
    "Business Intelligence Analysis",
    "Website Generation Pipeline",
    "Lead Enrichment Workflow",
    "Daily Revenue Report",
    "Competitor Monitoring Scan",
    "Email Campaign Dispatch",
    "Security Audit Run",
    "Content Syndication Job",
  ];

  const status = statuses[Math.floor(Math.random() * statuses.length)]!;
  const started = status !== "queued" ? new Date(Date.now() - Math.random() * 120000) : null;
  const completed = (status === "success" || status === "failed") ? new Date() : null;
  const duration = started && completed ? completed.getTime() - started.getTime() : null;

  const [execution] = await db
    .insert(executionsTable)
    .values({
      userId,
      name: names[Math.floor(Math.random() * names.length)]!,
      type: types[Math.floor(Math.random() * types.length)]!,
      trigger: triggers[Math.floor(Math.random() * triggers.length)]!,
      priority: Math.floor(Math.random() * 5) + 1,
      payload: { source: "simulation" },
      status,
      startedAt: started,
      completedAt: completed,
      durationMs: duration,
      result: status === "success" ? { itemsProcessed: Math.floor(Math.random() * 200 + 10), success: true } : null,
      errorMessage: status === "failed" ? "Simulated execution failure — retrying" : null,
      logs: status !== "queued" ? [
        { timestamp: new Date().toISOString(), level: "info", message: "Execution started" },
        { timestamp: new Date().toISOString(), level: status === "failed" ? "error" : "info", message: status === "failed" ? "Execution failed" : "Execution completed" },
      ] : [],
    })
    .returning();
  res.status(201).json({ execution });
});

export default router;
