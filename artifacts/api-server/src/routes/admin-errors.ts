import { Router } from "express";
import { db, errorEventsTable } from "@workspace/db";
import { desc, eq, and, gte } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const ReportErrorBody = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(5000).optional(),
  path: z.string().max(500).optional(),
  type: z.enum(["server", "client"]).default("client"),
  metadata: z.record(z.unknown()).optional().default({}),
});

// ── Public: client-side error reporting ────────────────────────────────────────
router.post("/errors/report", async (req, res): Promise<void> => {
  const parsed = ReportErrorBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid error report" });
    return;
  }
  const userId = (req as { user?: { userId: string } }).user?.userId ?? null;
  try {
    await db.insert(errorEventsTable).values({
      userId,
      type: parsed.data.type,
      message: parsed.data.message.slice(0, 2000),
      stack: parsed.data.stack?.slice(0, 5000),
      path: parsed.data.path,
      method: req.method,
      metadata: parsed.data.metadata,
    });
  } catch {
    // Silently ignore insert failures — don't break the client
  }
  res.json({ ok: true });
});

// ── Admin: list error events ───────────────────────────────────────────────────
router.get("/admin/errors", requireAdmin, async (req, res): Promise<void> => {
  const { type, since, limit } = req.query as Record<string, string>;
  const maxLimit = Math.min(Number(limit ?? 100), 500);

  const conditions = [];
  if (type && (type === "server" || type === "client")) {
    conditions.push(eq(errorEventsTable.type, type));
  }
  if (since) {
    const d = new Date(since);
    if (!isNaN(d.getTime())) {
      conditions.push(gte(errorEventsTable.createdAt, d));
    }
  }

  const errors = await db
    .select()
    .from(errorEventsTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(errorEventsTable.createdAt))
    .limit(maxLimit);

  const totalToday = await db
    .select({ id: errorEventsTable.id })
    .from(errorEventsTable)
    .where(gte(errorEventsTable.createdAt, new Date(Date.now() - 86400000)));

  const clientErrors = errors.filter(e => e.type === "client").length;
  const serverErrors = errors.filter(e => e.type === "server").length;

  res.json({
    errors,
    stats: {
      total: errors.length,
      todayTotal: totalToday.length,
      client: clientErrors,
      server: serverErrors,
    },
  });
});

// ── Admin: delete old errors ──────────────────────────────────────────────────
router.delete("/admin/errors", requireAdmin, async (req, res): Promise<void> => {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  await db
    .delete(errorEventsTable)
    .where(gte(errorEventsTable.createdAt, cutoff));
  res.json({ ok: true });
});

export default router;
