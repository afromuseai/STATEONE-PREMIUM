import { Router } from "express";
import { db, usersTable, subscriptionsTable, projectsTable, couponsTable, auditLogsTable, waitlistTable } from "@workspace/db";
import { eq, desc, gte, count, sql, and, isNotNull, inArray } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logAuditFireForget } from "../lib/audit";
import { PLAN_LIMITS, getOrCreateSubscription } from "./subscriptions";
import { z } from "zod";

const router = Router();

// ─── Billing Dashboard ────────────────────────────────────────────────────────

router.get("/admin/billing", requireAdmin, async (_req, res): Promise<void> => {
  const [allSubs, allUsers] = await Promise.all([
    db.select().from(subscriptionsTable),
    db.select({ id: usersTable.id, createdAt: usersTable.createdAt }).from(usersTable),
  ]);

  const planCounts: Record<string, number> = { free: 0, pro: 0, startup: 0, enterprise: 0 };
  const activeSubs = allSubs.filter(s => s.status === "active");

  for (const s of activeSubs) {
    const p = s.plan ?? "free";
    planCounts[p] = (planCounts[p] ?? 0) + 1;
  }

  const PLAN_MRR: Record<string, number> = { free: 0, pro: 29, startup: 99, enterprise: 299 };
  const mrr = Object.entries(planCounts).reduce((sum, [plan, cnt]) => sum + (PLAN_MRR[plan] ?? 0) * cnt, 0);

  const paidUsers = (planCounts.pro ?? 0) + (planCounts.startup ?? 0) + (planCounts.enterprise ?? 0);
  const totalWithSub = allSubs.length;
  const conversionRate = totalWithSub > 0 ? Math.round((paidUsers / totalWithSub) * 100 * 10) / 10 : 0;

  // Upgrade/downgrade rates from audit logs
  const now = new Date();
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const recentPlanChanges = await db
    .select()
    .from(auditLogsTable)
    .where(and(eq(auditLogsTable.action, "plan_change"), gte(auditLogsTable.createdAt, ago30d)));

  const upgrades = recentPlanChanges.filter(r => {
    const changes = r.changes as Record<string, unknown>;
    const planOrder = ["free", "pro", "startup", "enterprise"];
    const from = planOrder.indexOf(String(changes?.from ?? "free"));
    const to = planOrder.indexOf(String(changes?.to ?? "free"));
    return to > from;
  }).length;

  const downgrades = recentPlanChanges.filter(r => {
    const changes = r.changes as Record<string, unknown>;
    const planOrder = ["free", "pro", "startup", "enterprise"];
    const from = planOrder.indexOf(String(changes?.from ?? "free"));
    const to = planOrder.indexOf(String(changes?.to ?? "free"));
    return to < from;
  }).length;

  res.json({
    mrr,
    arr: mrr * 12,
    totalUsers: allUsers.length,
    activeSubs: activeSubs.length,
    planCounts,
    paidUsers,
    freeUsers: planCounts.free ?? 0,
    conversionRate,
    upgradeRate30d: upgrades,
    downgradeRate30d: downgrades,
  });
});

// ─── Billing Charts ───────────────────────────────────────────────────────────

router.get("/admin/billing/charts", requireAdmin, async (req, res): Promise<void> => {
  const range = (req.query.range as string) ?? "30d";
  const now = new Date();
  let since: Date;
  let groupFormat: string;

  if (range === "7d") {
    since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    groupFormat = "YYYY-MM-DD";
  } else if (range === "90d") {
    since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    groupFormat = "YYYY-MM-DD";
  } else if (range === "all") {
    since = new Date("2020-01-01");
    groupFormat = "YYYY-MM";
  } else {
    since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    groupFormat = "YYYY-MM-DD";
  }

  const [dailySignups, planHistory] = await Promise.all([
    db
      .select({
        date: sql<string>`TO_CHAR(${usersTable.createdAt}, ${groupFormat})`,
        count: count(),
      })
      .from(usersTable)
      .where(gte(usersTable.createdAt, since))
      .groupBy(sql`TO_CHAR(${usersTable.createdAt}, ${groupFormat})`)
      .orderBy(sql`TO_CHAR(${usersTable.createdAt}, ${groupFormat})`),

    db
      .select({
        date: sql<string>`TO_CHAR(${auditLogsTable.createdAt}, ${groupFormat})`,
        action: auditLogsTable.action,
        count: count(),
      })
      .from(auditLogsTable)
      .where(and(
        eq(auditLogsTable.action, "plan_change"),
        gte(auditLogsTable.createdAt, since),
      ))
      .groupBy(sql`TO_CHAR(${auditLogsTable.createdAt}, ${groupFormat})`, auditLogsTable.action)
      .orderBy(sql`TO_CHAR(${auditLogsTable.createdAt}, ${groupFormat})`),
  ]);

  // Current plan distribution snapshot
  const allSubs = await db.select({ plan: subscriptionsTable.plan }).from(subscriptionsTable);
  const planDist: Record<string, number> = { free: 0, pro: 0, startup: 0, enterprise: 0 };
  for (const s of allSubs) planDist[s.plan ?? "free"] = (planDist[s.plan ?? "free"] ?? 0) + 1;

  res.json({
    dailySignups: dailySignups.map(r => ({ date: r.date, count: Number(r.count) })),
    planHistory: planHistory.map(r => ({ date: r.date, action: r.action, count: Number(r.count) })),
    planDistribution: planDist,
  });
});

// ─── Suspend / Reactivate Plan ────────────────────────────────────────────────

router.patch("/admin/users/:id/subscription/status", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const { status } = req.body as { status?: string };
  const adminId = req.user!.userId;

  if (!status || !["active", "cancelled"].includes(status)) {
    res.status(400).json({ error: "status must be 'active' or 'cancelled'" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const existing = await getOrCreateSubscription(id);
  const [sub] = await db
    .update(subscriptionsTable)
    .set({ status })
    .where(eq(subscriptionsTable.userId, id))
    .returning();

  logAuditFireForget({
    userId: adminId,
    action: status === "active" ? "plan_reactivate" : "plan_suspend",
    resource: "subscriptions",
    resourceId: id,
    changes: { userId: id, previousStatus: existing.status, newStatus: status, plan: existing.plan },
    severity: "medium",
  });

  res.json({ subscription: sub ?? existing });
});

// ─── Admin Plan Change (with audit logging) ───────────────────────────────────

router.patch("/admin/users/:id/plan", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const { plan } = req.body as { plan?: string };
  const adminId = req.user!.userId;

  if (!plan || !["free", "pro", "startup", "enterprise"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const existing = await getOrCreateSubscription(id);
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const [sub] = await db
    .update(subscriptionsTable)
    .set({ plan, ...limits, currentPeriodStart: new Date(), currentPeriodEnd: periodEnd })
    .where(eq(subscriptionsTable.userId, id))
    .returning();

  logAuditFireForget({
    userId: adminId,
    action: "plan_change",
    resource: "subscriptions",
    resourceId: id,
    changes: { userId: id, from: existing.plan, to: plan },
    severity: "medium",
  });

  res.json({ subscription: sub ?? existing });
});

// ─── Audit Log ────────────────────────────────────────────────────────────────

router.get("/admin/audit", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);
  const action = req.query.action as string | undefined;
  const severity = req.query.severity as string | undefined;

  const conditions = [];
  if (action && action !== "all") conditions.push(eq(auditLogsTable.action, action));
  if (severity && severity !== "all") conditions.push(eq(auditLogsTable.severity, severity));

  const [logs, [{ total }]] = await Promise.all([
    db
      .select({
        id: auditLogsTable.id,
        userId: auditLogsTable.userId,
        action: auditLogsTable.action,
        resource: auditLogsTable.resource,
        resourceId: auditLogsTable.resourceId,
        changes: auditLogsTable.changes,
        severity: auditLogsTable.severity,
        outcome: auditLogsTable.outcome,
        ipAddress: auditLogsTable.ipAddress,
        createdAt: auditLogsTable.createdAt,
        userEmail: usersTable.email,
        userName: usersTable.name,
      })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ total: count() })
      .from(auditLogsTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined),
  ]);

  res.json({ logs, total, limit, offset });
});

// ─── Waitlist Admin ───────────────────────────────────────────────────────────

router.get("/admin/waitlist", requireAdmin, async (req, res): Promise<void> => {
  const plan = req.query.plan as string | undefined;
  const entries = await db
    .select()
    .from(waitlistTable)
    .where(plan && plan !== "all" ? eq(waitlistTable.plan, plan) : undefined)
    .orderBy(desc(waitlistTable.createdAt));
  res.json({ entries });
});

router.delete("/admin/waitlist/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const adminId = req.user!.userId;
  await db.delete(waitlistTable).where(eq(waitlistTable.id, id));
  logAuditFireForget({ userId: adminId, action: "waitlist_remove", resource: "waitlist", resourceId: id, severity: "low" });
  res.json({ ok: true });
});

// ─── Coupons ──────────────────────────────────────────────────────────────────

const CouponCreateSchema = z.object({
  code: z.string().min(3).max(32).toUpperCase(),
  type: z.enum(["percentage", "fixed"]),
  value: z.number().positive(),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().optional(),
  description: z.string().optional(),
});

router.get("/admin/coupons", requireAdmin, async (_req, res): Promise<void> => {
  const coupons = await db
    .select({
      id: couponsTable.id,
      code: couponsTable.code,
      type: couponsTable.type,
      value: couponsTable.value,
      maxUses: couponsTable.maxUses,
      uses: couponsTable.uses,
      expiresAt: couponsTable.expiresAt,
      disabled: couponsTable.disabled,
      description: couponsTable.description,
      createdAt: couponsTable.createdAt,
      creatorName: usersTable.name,
    })
    .from(couponsTable)
    .leftJoin(usersTable, eq(couponsTable.createdBy, usersTable.id))
    .orderBy(desc(couponsTable.createdAt));
  res.json({ coupons });
});

router.post("/admin/coupons", requireAdmin, async (req, res): Promise<void> => {
  const parsed = CouponCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const adminId = req.user!.userId;
  const { code, type, value, maxUses, expiresAt, description } = parsed.data;

  const existing = await db.select({ id: couponsTable.id }).from(couponsTable).where(eq(couponsTable.code, code));
  if (existing.length > 0) {
    res.status(409).json({ error: "A coupon with this code already exists" });
    return;
  }

  const [coupon] = await db.insert(couponsTable).values({
    code,
    type,
    value,
    maxUses: maxUses ?? null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    description: description ?? null,
    createdBy: adminId,
  }).returning();

  logAuditFireForget({
    userId: adminId,
    action: "coupon_create",
    resource: "coupons",
    resourceId: coupon.id,
    changes: { code, type, value, maxUses },
    severity: "medium",
  });

  res.status(201).json({ coupon });
});

router.patch("/admin/coupons/:id/disable", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const adminId = req.user!.userId;
  const [coupon] = await db
    .update(couponsTable)
    .set({ disabled: true })
    .where(eq(couponsTable.id, id))
    .returning();
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  logAuditFireForget({ userId: adminId, action: "coupon_disable", resource: "coupons", resourceId: id, severity: "medium" });
  res.json({ coupon });
});

router.patch("/admin/coupons/:id/enable", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const adminId = req.user!.userId;
  const [coupon] = await db
    .update(couponsTable)
    .set({ disabled: false })
    .where(eq(couponsTable.id, id))
    .returning();
  if (!coupon) { res.status(404).json({ error: "Coupon not found" }); return; }
  logAuditFireForget({ userId: adminId, action: "coupon_enable", resource: "coupons", resourceId: id, severity: "medium" });
  res.json({ coupon });
});

router.delete("/admin/coupons/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const adminId = req.user!.userId;
  await db.delete(couponsTable).where(eq(couponsTable.id, id));
  logAuditFireForget({ userId: adminId, action: "coupon_delete", resource: "coupons", resourceId: id, severity: "high" });
  res.json({ ok: true });
});

// ─── User Billing Profile ─────────────────────────────────────────────────────

router.get("/admin/users/:id/billing-profile", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  const [sub, [{ projectCount }], auditRows] = await Promise.all([
    getOrCreateSubscription(id),
    db.select({ projectCount: count() }).from(projectsTable).where(eq(projectsTable.userId, id)),
    db
      .select()
      .from(auditLogsTable)
      .where(and(eq(auditLogsTable.resourceId, id), eq(auditLogsTable.resource, "subscriptions")))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(10),
  ]);

  const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));

  res.json({
    plan: sub.plan,
    status: sub.status,
    aiGenerationsUsed: sub.aiGenerationsUsed,
    aiGenerationsLimit: sub.aiGenerationsLimit,
    usagePct: sub.aiGenerationsLimit > 0 ? Math.round((sub.aiGenerationsUsed / sub.aiGenerationsLimit) * 100) : 0,
    accountAgeDays,
    projectCount: Number(projectCount),
    lastActivity: user.lastSeenAt,
    periodEnd: sub.currentPeriodEnd,
    history: auditRows,
  });
});

export default router;
