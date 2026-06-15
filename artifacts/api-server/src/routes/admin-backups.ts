import { Router } from "express";
import { db, backupsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, desc, gte, count, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const DAY7  = 7  * 24 * 60 * 60 * 1000;
const DAY30 = 30 * 24 * 60 * 60 * 1000;
function ago(ms: number) { return new Date(Date.now() - ms); }

const CreateBackupBody = z.object({
  backupType: z.enum(["database", "project_export", "config_snapshot"]),
  label:      z.string().min(1).max(200),
  status:     z.enum(["pending", "running", "success", "failed"]).optional().default("pending"),
  sizeBytes:  z.number().int().min(0).optional(),
  metadata:   z.record(z.unknown()).optional(),
});

const UpdateBackupBody = z.object({
  status:       z.enum(["pending", "running", "success", "failed"]),
  sizeBytes:    z.number().int().min(0).optional(),
  errorMessage: z.string().optional(),
  completedAt:  z.string().datetime().optional(),
});

// ─── GET /api/admin/backups ───────────────────────────────────────────────────
router.get("/admin/backups", requireAdmin, async (_req, res) => {
  try {
    const all = await db
      .select()
      .from(backupsTable)
      .orderBy(desc(backupsTable.createdAt))
      .limit(100);

    // Readiness metrics
    const latest = {
      database:        all.find(b => b.backupType === "database"        && b.status === "success"),
      projectExport:   all.find(b => b.backupType === "project_export"  && b.status === "success"),
      configSnapshot:  all.find(b => b.backupType === "config_snapshot" && b.status === "success"),
    };

    const successfulInWeek = all.filter(b => b.status === "success" && b.createdAt && b.createdAt > ago(DAY7)).length;
    const totalInWeek      = all.filter(b => b.createdAt && b.createdAt > ago(DAY7)).length;

    // Readiness score (0–100)
    let score = 0;
    if (latest.database)       score += 40;
    if (latest.projectExport)  score += 30;
    if (latest.configSnapshot) score += 20;
    if (successfulInWeek >= 3) score += 10;

    const dbAge = latest.database ? Date.now() - new Date(latest.database.createdAt).getTime() : null;
    const dbHoursAgo = dbAge ? Math.round(dbAge / 3_600_000) : null;

    const [stats30d] = await db
      .select({
        total:   count(),
        success: sql<number>`sum(case when status = 'success' then 1 else 0 end)`,
        failed:  sql<number>`sum(case when status = 'failed' then 1 else 0 end)`,
      })
      .from(backupsTable)
      .where(gte(backupsTable.createdAt, ago(DAY30)));

    res.json({
      backups: all,
      readiness: {
        score,
        latestDatabase:       latest.database       ? { id: latest.database.id,       createdAt: latest.database.createdAt,       sizeBytes: latest.database.sizeBytes }       : null,
        latestProjectExport:  latest.projectExport  ? { id: latest.projectExport.id,  createdAt: latest.projectExport.createdAt,  sizeBytes: latest.projectExport.sizeBytes }  : null,
        latestConfigSnapshot: latest.configSnapshot ? { id: latest.configSnapshot.id, createdAt: latest.configSnapshot.createdAt, sizeBytes: latest.configSnapshot.sizeBytes } : null,
        databaseBackupAgeHours: dbHoursAgo,
      },
      stats30d: {
        total:   Number(stats30d?.total   ?? 0),
        success: Number(stats30d?.success ?? 0),
        failed:  Number(stats30d?.failed  ?? 0),
      },
      meta: { computedAt: new Date().toISOString() },
    });
  } catch (err) {
    logger.error({ err }, "[admin-backups] list failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/admin/backups ──────────────────────────────────────────────────
router.post("/admin/backups", requireAdmin, async (req, res) => {
  const parsed = CreateBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const [backup] = await db
      .insert(backupsTable)
      .values({
        backupType: parsed.data.backupType,
        label:      parsed.data.label,
        status:     parsed.data.status,
        sizeBytes:  parsed.data.sizeBytes ?? null,
        metadata:   parsed.data.metadata  ?? null,
        createdBy:  req.user!.userId,
        completedAt: parsed.data.status === "success" ? new Date() : null,
      })
      .returning();

    Promise.resolve().then(() => db.insert(adminAuditLogsTable).values({
      adminId: req.user!.userId, action: "create_backup",
      targetType: "backup", targetId: backup.id,
      metadata: { backupType: backup.backupType, label: backup.label },
    }));

    res.status(201).json({ ok: true, backup });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── PATCH /api/admin/backups/:id ─────────────────────────────────────────────
router.patch("/admin/backups/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const parsed = UpdateBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updates: Record<string, unknown> = {
    status:       parsed.data.status,
    errorMessage: parsed.data.errorMessage ?? null,
  };
  if (parsed.data.sizeBytes !== undefined) updates.sizeBytes = parsed.data.sizeBytes;
  if (parsed.data.status === "success" || parsed.data.status === "failed") {
    updates.completedAt = parsed.data.completedAt ? new Date(parsed.data.completedAt) : new Date();
  }

  try {
    const [backup] = await db
      .update(backupsTable)
      .set(updates as Parameters<typeof backupsTable.$inferInsert>[0])
      .where(eq(backupsTable.id, id))
      .returning();

    if (!backup) { res.status(404).json({ error: "Backup not found" }); return; }
    res.json({ ok: true, backup });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── DELETE /api/admin/backups/:id ────────────────────────────────────────────
router.delete("/admin/backups/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const [deleted] = await db.delete(backupsTable).where(eq(backupsTable.id, id)).returning({ id: backupsTable.id });
    if (!deleted) { res.status(404).json({ error: "Backup not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
