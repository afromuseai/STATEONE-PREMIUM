import { Router } from "express";
import { db, usersTable, subscriptionsTable, projectsTable, couponsTable, auditLogsTable, waitlistTable, userUsageTable, billingCustomersTable, billingSubscriptionsTable, billingEventsTable } from "@workspace/db";
import { eq, desc, gte, count, sql, and, isNotNull, inArray, sum, avg } from "drizzle-orm";
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

// ─── Billing Intelligence: Revenue Breakdown ──────────────────────────────────

router.get("/admin/billing/revenue", requireAdmin, async (_req, res): Promise<void> => {
  const PLAN_MRR: Record<string, number> = { free: 0, pro: 29, startup: 99, enterprise: 299 };
  const allSubs = await db
    .select({ plan: subscriptionsTable.plan, status: subscriptionsTable.status })
    .from(subscriptionsTable);

  const counts: Record<string, number> = { free: 0, pro: 0, startup: 0, enterprise: 0 };
  for (const s of allSubs) {
    if (s.status === "active") counts[s.plan ?? "free"] = (counts[s.plan ?? "free"] ?? 0) + 1;
  }

  const total = Object.entries(counts).filter(([p]) => p !== "free").reduce((acc, [p, n]) => acc + (PLAN_MRR[p] ?? 0) * n, 0);

  const breakdown = (["free", "pro", "startup", "enterprise"] as const).map(plan => {
    const users = counts[plan] ?? 0;
    const revenue = (PLAN_MRR[plan] ?? 0) * users;
    const share = total > 0 ? Math.round((revenue / total) * 100 * 10) / 10 : 0;
    return { plan, users, revenuePerUser: PLAN_MRR[plan] ?? 0, totalRevenue: revenue, share };
  });

  const mrr = breakdown.reduce((s, r) => s + r.totalRevenue, 0);
  res.json({ breakdown, mrr, arr: mrr * 12 });
});

// ─── Billing Intelligence: Upgrade Funnel ─────────────────────────────────────

router.get("/admin/billing/upgrade-funnel", requireAdmin, async (_req, res): Promise<void> => {
  const PLAN_ORDER = ["free", "pro", "startup", "enterprise"];

  const [allSubs, planChanges] = await Promise.all([
    db.select({ plan: subscriptionsTable.plan, status: subscriptionsTable.status }).from(subscriptionsTable),
    db.select({ changes: auditLogsTable.changes, createdAt: auditLogsTable.createdAt })
      .from(auditLogsTable)
      .where(eq(auditLogsTable.action, "plan_change"))
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(1000),
  ]);

  const activeSubs = allSubs.filter(s => s.status === "active");
  const freeCnt = activeSubs.filter(s => (s.plan ?? "free") === "free").length;
  const proCnt = activeSubs.filter(s => s.plan === "pro").length;
  const startupCnt = activeSubs.filter(s => s.plan === "startup").length;
  const enterpriseCnt = activeSubs.filter(s => s.plan === "enterprise").length;
  const total = activeSubs.length || 1;

  let freeToPro = 0;
  let proToStartup = 0;
  let startupToEnterprise = 0;

  for (const r of planChanges) {
    const c = r.changes as Record<string, string> | null;
    if (!c) continue;
    const from = PLAN_ORDER.indexOf(c.from ?? "free");
    const to = PLAN_ORDER.indexOf(c.to ?? "free");
    if (from === 0 && to === 1) freeToPro++;
    else if (from === 1 && to === 2) proToStartup++;
    else if (from === 2 && to === 3) startupToEnterprise++;
  }

  res.json({
    stages: [
      { stage: "Free", count: freeCnt, pct: Math.round((freeCnt / total) * 100) },
      { stage: "Pro", count: proCnt, pct: Math.round((proCnt / total) * 100) },
      { stage: "Startup", count: startupCnt, pct: Math.round((startupCnt / total) * 100) },
      { stage: "Enterprise", count: enterpriseCnt, pct: Math.round((enterpriseCnt / total) * 100) },
    ],
    conversions: [
      { from: "Free", to: "Pro", count: freeToPro, rate: freeCnt > 0 ? Math.round((freeToPro / freeCnt) * 100 * 10) / 10 : 0 },
      { from: "Pro", to: "Startup", count: proToStartup, rate: proCnt > 0 ? Math.round((proToStartup / proCnt) * 100 * 10) / 10 : 0 },
      { from: "Startup", to: "Enterprise", count: startupToEnterprise, rate: startupCnt > 0 ? Math.round((startupToEnterprise / startupCnt) * 100 * 10) / 10 : 0 },
    ],
  });
});

// ─── Billing Intelligence: Usage Economics ────────────────────────────────────

router.get("/admin/billing/usage-economics", requireAdmin, async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      plan: subscriptionsTable.plan,
      totalBi: sql<number>`COALESCE(SUM(${userUsageTable.biGenerations}), 0)`,
      totalWebsite: sql<number>`COALESCE(SUM(${userUsageTable.websiteGenerations}), 0)`,
      totalChatbot: sql<number>`COALESCE(SUM(${userUsageTable.chatbotGenerations}), 0)`,
      totalAutomation: sql<number>`COALESCE(SUM(${userUsageTable.automationGenerations}), 0)`,
      totalMarcus: sql<number>`COALESCE(SUM(${userUsageTable.marcusMessages}), 0)`,
      totalAll: sql<number>`COALESCE(SUM(${userUsageTable.totalGenerations}), 0)`,
      userCount: count(userUsageTable.userId),
    })
    .from(userUsageTable)
    .leftJoin(subscriptionsTable, eq(userUsageTable.userId, subscriptionsTable.userId))
    .groupBy(subscriptionsTable.plan);

  const economics = rows.map(r => {
    const cnt = Number(r.userCount) || 1;
    return {
      plan: r.plan ?? "free",
      userCount: Number(r.userCount),
      totalBiGenerations: Number(r.totalBi),
      totalWebsiteGenerations: Number(r.totalWebsite),
      totalChatbotGenerations: Number(r.totalChatbot),
      totalAutomationGenerations: Number(r.totalAutomation),
      totalMarcusMessages: Number(r.totalMarcus),
      totalGenerations: Number(r.totalAll),
      avgBiPerUser: Math.round(Number(r.totalBi) / cnt * 10) / 10,
      avgWebsitePerUser: Math.round(Number(r.totalWebsite) / cnt * 10) / 10,
      avgGenerationsPerUser: Math.round(Number(r.totalAll) / cnt * 10) / 10,
    };
  });

  res.json({ economics });
});

// ─── Billing Intelligence: Power Users ────────────────────────────────────────

router.get("/admin/billing/power-users", requireAdmin, async (_req, res): Promise<void> => {
  const PLAN_MRR: Record<string, number> = { free: 0, pro: 29, startup: 99, enterprise: 299 };

  const rows = await db
    .select({
      userId: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      plan: subscriptionsTable.plan,
      aiUsed: subscriptionsTable.aiGenerationsUsed,
      aiLimit: subscriptionsTable.aiGenerationsLimit,
      createdAt: usersTable.createdAt,
      lastSeen: usersTable.lastSeenAt,
      totalGenerations: sql<number>`COALESCE(SUM(${userUsageTable.totalGenerations}), 0)`,
      biGenerations: sql<number>`COALESCE(SUM(${userUsageTable.biGenerations}), 0)`,
      websiteGenerations: sql<number>`COALESCE(SUM(${userUsageTable.websiteGenerations}), 0)`,
      marcusMessages: sql<number>`COALESCE(SUM(${userUsageTable.marcusMessages}), 0)`,
    })
    .from(usersTable)
    .leftJoin(subscriptionsTable, eq(usersTable.id, subscriptionsTable.userId))
    .leftJoin(userUsageTable, eq(usersTable.id, userUsageTable.userId))
    .groupBy(usersTable.id, subscriptionsTable.plan, subscriptionsTable.aiGenerationsUsed, subscriptionsTable.aiGenerationsLimit)
    .orderBy(desc(sql`COALESCE(SUM(${userUsageTable.totalGenerations}), 0)`))
    .limit(30);

  const [{ projectCounts }] = await db
    .select({ projectCounts: sql<string>`json_object_agg(user_id, cnt)` })
    .from(
      db.select({ userId: projectsTable.userId, cnt: count().as("cnt") })
        .from(projectsTable)
        .groupBy(projectsTable.userId)
        .as("pc")
    );

  const pcMap: Record<string, number> = (projectCounts as unknown as Record<string, number>) ?? {};

  const scored = rows.map(r => {
    const plan = r.plan ?? "free";
    const totalGen = Number(r.totalGenerations);
    const aiLimit = r.aiLimit ?? 0;
    const aiUsed = r.aiUsed ?? 0;
    const usagePct = aiLimit > 0 ? (aiUsed / aiLimit) : 0;
    const projects = pcMap[r.userId] ?? 0;
    const daysSinceActive = r.lastSeen
      ? Math.floor((Date.now() - new Date(r.lastSeen).getTime()) / (1000 * 60 * 60 * 24))
      : 999;
    const activityScore = Math.max(0, 100 - daysSinceActive * 2);

    const upgradeLikelihood = Math.min(100, Math.round(
      (usagePct * 40) +
      (Math.min(totalGen, 50) / 50 * 25) +
      (Math.min(projects, 10) / 10 * 20) +
      (activityScore * 0.15)
    ));

    return {
      userId: r.userId,
      email: r.email,
      name: r.name,
      plan,
      currentMrr: PLAN_MRR[plan] ?? 0,
      totalGenerations: totalGen,
      biGenerations: Number(r.biGenerations),
      websiteGenerations: Number(r.websiteGenerations),
      marcusMessages: Number(r.marcusMessages),
      projectCount: projects,
      aiUsedPct: Math.round(usagePct * 100),
      activityScore,
      upgradeLikelihood,
      lastSeen: r.lastSeen,
    };
  });

  const sorted = scored.sort((a, b) => b.upgradeLikelihood - a.upgradeLikelihood).slice(0, 20);
  res.json({ users: sorted });
});

// ─── Billing Intelligence: Readiness ─────────────────────────────────────────

router.get("/admin/billing/readiness", requireAdmin, async (_req, res): Promise<void> => {
  const PLAN_MRR: Record<string, number> = { free: 0, pro: 29, startup: 99, enterprise: 299 };

  const [
    [{ customerCount }],
    [{ subCount }],
    [{ eventCount }],
    allSubs,
    [{ userCount }],
  ] = await Promise.all([
    db.select({ customerCount: count() }).from(billingCustomersTable),
    db.select({ subCount: count() }).from(billingSubscriptionsTable),
    db.select({ eventCount: count() }).from(billingEventsTable),
    db.select({ plan: subscriptionsTable.plan, status: subscriptionsTable.status }).from(subscriptionsTable),
    db.select({ userCount: count() }).from(usersTable),
  ]);

  const activeSubs = allSubs.filter(s => s.status === "active");
  const planCounts: Record<string, number> = { free: 0, pro: 0, startup: 0, enterprise: 0 };
  for (const s of activeSubs) planCounts[s.plan ?? "free"] = (planCounts[s.plan ?? "free"] ?? 0) + 1;
  const mrr = Object.entries(planCounts).reduce((acc, [p, n]) => acc + (PLAN_MRR[p] ?? 0) * n, 0);
  const paidUsers = (planCounts.pro ?? 0) + (planCounts.startup ?? 0) + (planCounts.enterprise ?? 0);
  const total = Number(userCount);

  const checks = [
    { id: "schema_customers", label: "billing_customers table", status: "ready", detail: `${Number(customerCount)} records` },
    { id: "schema_subscriptions", label: "billing_subscriptions table", status: "ready", detail: `${Number(subCount)} records` },
    { id: "schema_events", label: "billing_events table", status: "ready", detail: `${Number(eventCount)} records` },
    { id: "plan_data", label: "Plan data populated", status: paidUsers > 0 ? "ready" : "pending", detail: `${paidUsers} paid users of ${total}` },
    { id: "mrr_baseline", label: "MRR baseline established", status: mrr > 0 ? "ready" : "pending", detail: `$${mrr}/mo simulated` },
    { id: "stripe_integration", label: "Stripe integration", status: "not_started", detail: "No Stripe keys configured" },
    { id: "webhook_endpoint", label: "Billing webhook endpoint", status: "not_started", detail: "Pending Stripe setup" },
  ];

  const readyCount = checks.filter(c => c.status === "ready").length;
  const readinessPct = Math.round((readyCount / checks.length) * 100);

  res.json({ checks, readinessPct, readyCount, totalChecks: checks.length, mrr, paidUsers, totalUsers: total });
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
