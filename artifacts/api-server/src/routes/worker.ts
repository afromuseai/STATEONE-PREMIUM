// ─── Worker Status Route ─────────────────────────────────────────────────────
// GET  /api/worker/status  — current worker state (active jobs, counters)
// POST /api/worker/enqueue — enqueue a job directly (admin only)

import { Router } from "express";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { worker, enqueueJob } from "../lib/worker";
import { listHandlers } from "../lib/job-handlers";
import { db, executionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// GET /api/worker/status
router.get("/worker/status", requireAuth, requireAdmin, async (_req, res): Promise<void> => {
  const status = worker.status();

  const [queuedCount, runningCount] = await Promise.all([
    db
      .select()
      .from(executionsTable)
      .where(eq(executionsTable.status, "queued"))
      .then(r => r.length),
    db
      .select()
      .from(executionsTable)
      .where(eq(executionsTable.status, "running"))
      .then(r => r.length),
  ]);

  res.json({
    worker: status,
    queue: { queued: queuedCount, running: runningCount },
    handlers: listHandlers(),
  });
});

const EnqueueBody = z.object({
  name:       z.string().min(1),
  type:       z.enum(["workflow", "agent", "automation", "scheduled", "event"]),
  payload:    z.record(z.unknown()).optional().default({}),
  priority:   z.number().int().min(1).max(5).optional().default(3),
  maxRetries: z.number().int().min(0).max(5).optional().default(3),
  scheduledAt: z.string().datetime().optional(),
});

// POST /api/worker/enqueue — admin shortcut for direct job injection
router.post("/worker/enqueue", requireAuth, requireAdmin, async (req, res): Promise<void> => {
  const parsed = EnqueueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const { name, type, payload, priority, maxRetries, scheduledAt } = parsed.data;
  const execution = await enqueueJob({
    userId: req.user!.userId,
    name,
    type,
    payload,
    priority,
    maxRetries,
    scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
  });
  res.status(201).json({ execution });
});

export default router;
