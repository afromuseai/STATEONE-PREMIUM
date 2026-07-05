import { Router } from "express";
import { db, incidentsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, desc, ne } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const AFFECTED_SYSTEMS = ["API Server", "Database", "AI Pipeline", "Frontend", "Auth", "Webhooks", "Email", "Payments", "Notifications"] as const;

const CreateIncidentBody = z.object({
  title:           z.string().min(3).max(200),
  description:     z.string().min(10).max(2000),
  severity:        z.enum(["info", "warning", "critical"]),
  affectedSystems: z.array(z.string()).min(1),
  status:          z.enum(["investigating", "identified", "monitoring"]).optional().default("investigating"),
});

const UpdateIncidentBody = z.object({
  title:           z.string().min(3).max(200).optional(),
  description:     z.string().min(10).max(2000).optional(),
  severity:        z.enum(["info", "warning", "critical"]).optional(),
  affectedSystems: z.array(z.string()).optional(),
  status:          z.enum(["investigating", "identified", "monitoring", "resolved"]).optional(),
});

// ─── GET /api/admin/incidents ─────────────────────────────────────────────────
router.get("/admin/incidents", requireAdmin, async (req, res) => {
  try {
    const status = req.query.status as string | undefined;
    const all = await db
      .select()
      .from(incidentsTable)
      .where(
        status === "active"   ? ne(incidentsTable.status, "resolved") :
        status === "resolved" ? eq(incidentsTable.status, "resolved") :
        undefined
      )
      .orderBy(desc(incidentsTable.createdAt))
      .limit(100);
    res.json({ incidents: all, meta: { availableSystems: AFFECTED_SYSTEMS } });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/admin/incidents ────────────────────────────────────────────────
router.post("/admin/incidents", requireAdmin, async (req, res) => {
  const parsed = CreateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  try {
    const [incident] = await db
      .insert(incidentsTable)
      .values({
        title:           parsed.data.title,
        description:     parsed.data.description,
        severity:        parsed.data.severity,
        affectedSystems: parsed.data.affectedSystems,
        status:          parsed.data.status,
        createdBy:       req.user!.userId,
      })
      .returning();

    Promise.resolve().then(() => db.insert(adminAuditLogsTable).values({
      adminId: req.user!.userId, adminEmail: req.user!.email, action: "create_incident",
      details: { targetType: "incident", targetId: incident.id, title: incident.title, severity: incident.severity },
    }));

    logger.info({ adminId: req.user!.userId, incidentId: incident.id, severity: parsed.data.severity }, "[incidents] Created");
    res.status(201).json({ ok: true, incident });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── PATCH /api/admin/incidents/:id ──────────────────────────────────────────
router.patch("/admin/incidents/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  const parsed = UpdateIncidentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const updates: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "resolved") {
    updates.resolvedAt = new Date();
  }

  try {
    const [incident] = await db
      .update(incidentsTable)
      .set(updates as any)
      .where(eq(incidentsTable.id, id as string))
      .returning();

    if (!incident) { res.status(404).json({ error: "Incident not found" }); return; }

    Promise.resolve().then(() => db.insert(adminAuditLogsTable).values({
      adminId: req.user!.userId, adminEmail: req.user!.email, action: "update_incident",
      details: { targetType: "incident", targetId: id, changes: parsed.data },
    }));

    res.json({ ok: true, incident });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── DELETE /api/admin/incidents/:id ─────────────────────────────────────────
router.delete("/admin/incidents/:id", requireAdmin, async (req, res) => {
  const id = req.params.id as string;
  try {
    const [deleted] = await db
      .delete(incidentsTable)
      .where(eq(incidentsTable.id, id))
      .returning({ id: incidentsTable.id });

    if (!deleted) { res.status(404).json({ error: "Incident not found" }); return; }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
