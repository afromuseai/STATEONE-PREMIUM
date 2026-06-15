import { Router } from "express";
import { db, usersTable, abuseAlertsTable, rateLimitViolationsTable, eventsTable, adminAuditLogsTable } from "@workspace/db";
import { eq, desc, gte, count, and, sql, lt } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { z } from "zod";

const router = Router();

const HR24  = 24 * 60 * 60 * 1000;
const HR72  = 72 * 60 * 60 * 1000;
const DAY30 = 30 * 24 * 60 * 60 * 1000;
function ago(ms: number) { return new Date(Date.now() - ms); }

// ─── GET /api/admin/security ─────────────────────────────────────────────────
router.get("/admin/security", requireAdmin, async (req, res) => {
  try {
    // Failed logins (24h)
    const [failedLogins] = await db
      .select({ n: count() })
      .from(eventsTable)
      .where(and(sql`event_type = 'login_failed'`, gte(eventsTable.createdAt, ago(HR24))));

    // Suspended users
    const [suspendedCount] = await db
      .select({ n: count() })
      .from(usersTable)
      .where(eq(usersTable.isSuspended, true));

    // Open abuse alerts
    const [openAbuseCount] = await db
      .select({ n: count() })
      .from(abuseAlertsTable)
      .where(eq(abuseAlertsTable.status, "open"));

    // Rate-limit violations (24h)
    const [rlvCount] = await db
      .select({ n: count() })
      .from(rateLimitViolationsTable)
      .where(gte(rateLimitViolationsTable.createdAt, ago(HR24)));

    // Top requesters today (by violation IP)
    const topViolators = await db
      .select({ ip: rateLimitViolationsTable.ip, violations: count() })
      .from(rateLimitViolationsTable)
      .where(gte(rateLimitViolationsTable.createdAt, ago(HR24)))
      .groupBy(rateLimitViolationsTable.ip)
      .orderBy(desc(count()))
      .limit(5);

    // Recent abuse alerts
    const recentAlerts = await db
      .select()
      .from(abuseAlertsTable)
      .where(eq(abuseAlertsTable.status, "open"))
      .orderBy(desc(abuseAlertsTable.createdAt))
      .limit(5);

    // Recent suspensions
    const recentSuspensions = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, suspendedReason: usersTable.suspendedReason, suspendedAt: usersTable.suspendedAt })
      .from(usersTable)
      .where(and(eq(usersTable.isSuspended, true), gte(usersTable.suspendedAt, ago(DAY30))))
      .orderBy(desc(usersTable.suspendedAt))
      .limit(5);

    // Recent admin actions
    const recentAdminActions = await db
      .select()
      .from(adminAuditLogsTable)
      .where(and(
        sql`action in ('suspend_user','reactivate_user','dismiss_abuse','action_abuse')`,
        gte(adminAuditLogsTable.createdAt, ago(HR72)),
      ))
      .orderBy(desc(adminAuditLogsTable.createdAt))
      .limit(10);

    // Violations by endpoint (24h)
    const violationsByEndpoint = await db
      .select({ endpoint: rateLimitViolationsTable.endpoint, count: count() })
      .from(rateLimitViolationsTable)
      .where(gte(rateLimitViolationsTable.createdAt, ago(HR24)))
      .groupBy(rateLimitViolationsTable.endpoint)
      .orderBy(desc(count()))
      .limit(10);

    res.json({
      overview: {
        failedLogins24h:       Number(failedLogins?.n ?? 0),
        suspendedUsers:        Number(suspendedCount?.n ?? 0),
        openAbuseAlerts:       Number(openAbuseCount?.n ?? 0),
        rateLimitViolations24h:Number(rlvCount?.n ?? 0),
      },
      topViolators:       topViolators.map(v => ({ ip: v.ip, violations: Number(v.violations) })),
      recentAlerts,
      recentSuspensions,
      recentAdminActions,
      violationsByEndpoint: violationsByEndpoint.map(v => ({ endpoint: v.endpoint, count: Number(v.count) })),
      meta: { computedAt: new Date().toISOString() },
    });
  } catch (err) {
    logger.error({ err }, "[admin-security] overview failed");
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /api/admin/security/abuse-alerts ────────────────────────────────────
router.get("/admin/security/abuse-alerts", requireAdmin, async (req, res) => {
  try {
    const status = (req.query.status as string) || "open";
    const alerts = await db
      .select()
      .from(abuseAlertsTable)
      .where(status === "all" ? undefined : eq(abuseAlertsTable.status, status))
      .orderBy(desc(abuseAlertsTable.createdAt))
      .limit(100);
    res.json({ alerts });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── PATCH /api/admin/security/abuse-alerts/:id ───────────────────────────────
const AbuseActionBody = z.object({ action: z.enum(["dismiss", "action"]) });
router.patch("/admin/security/abuse-alerts/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;
  const parsed = AbuseActionBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid action" }); return; }

  try {
    const [updated] = await db
      .update(abuseAlertsTable)
      .set({ status: parsed.data.action === "dismiss" ? "dismissed" : "actioned", reviewedBy: req.user!.userId, reviewedAt: new Date() })
      .where(eq(abuseAlertsTable.id, id))
      .returning();

    if (!updated) { res.status(404).json({ error: "Alert not found" }); return; }

    Promise.resolve().then(() => db.insert(adminAuditLogsTable).values({
      adminId: req.user!.userId, action: `${parsed.data.action}_abuse`,
      targetType: "abuse_alert", targetId: id,
      metadata: { alertType: updated.alertType, userId: updated.userId },
    }));

    res.json({ ok: true, alert: updated });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /api/admin/security/suspended ───────────────────────────────────────
router.get("/admin/security/suspended", requireAdmin, async (_req, res) => {
  try {
    const users = await db
      .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, suspendedReason: usersTable.suspendedReason, suspendedAt: usersTable.suspendedAt, suspendedBy: usersTable.suspendedBy, createdAt: usersTable.createdAt })
      .from(usersTable)
      .where(eq(usersTable.isSuspended, true))
      .orderBy(desc(usersTable.suspendedAt));
    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/admin/security/suspend/:userId ─────────────────────────────────
const SuspendBody = z.object({ reason: z.string().min(3).max(500) });
router.post("/admin/security/suspend/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  const parsed = SuspendBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Reason required (3-500 chars)" }); return; }

  try {
    const [user] = await db
      .update(usersTable)
      .set({ isSuspended: true, suspendedReason: parsed.data.reason, suspendedAt: new Date(), suspendedBy: req.user!.userId })
      .where(and(eq(usersTable.id, userId), eq(usersTable.isAdmin, false)))
      .returning({ id: usersTable.id, email: usersTable.email });

    if (!user) { res.status(404).json({ error: "User not found or cannot suspend admin" }); return; }

    Promise.resolve().then(() => db.insert(adminAuditLogsTable).values({
      adminId: req.user!.userId, action: "suspend_user",
      targetType: "user", targetId: userId,
      metadata: { reason: parsed.data.reason, email: user.email },
    }));

    logger.info({ adminId: req.user!.userId, userId, reason: parsed.data.reason }, "[admin-security] User suspended");
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── POST /api/admin/security/reactivate/:userId ──────────────────────────────
router.post("/admin/security/reactivate/:userId", requireAdmin, async (req, res) => {
  const { userId } = req.params;
  try {
    const [user] = await db
      .update(usersTable)
      .set({ isSuspended: false, suspendedReason: null, suspendedAt: null, suspendedBy: null })
      .where(eq(usersTable.id, userId))
      .returning({ id: usersTable.id, email: usersTable.email });

    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    Promise.resolve().then(() => db.insert(adminAuditLogsTable).values({
      adminId: req.user!.userId, action: "reactivate_user",
      targetType: "user", targetId: userId,
      metadata: { email: user.email },
    }));

    logger.info({ adminId: req.user!.userId, userId }, "[admin-security] User reactivated");
    res.json({ ok: true, user });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── GET /api/admin/security/rate-violations ─────────────────────────────────
router.get("/admin/security/rate-violations", requireAdmin, async (req, res) => {
  try {
    const since = req.query.hours ? ago(Number(req.query.hours) * 3_600_000) : ago(HR24);
    const violations = await db
      .select()
      .from(rateLimitViolationsTable)
      .where(gte(rateLimitViolationsTable.createdAt, since))
      .orderBy(desc(rateLimitViolationsTable.createdAt))
      .limit(200);
    res.json({ violations });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
