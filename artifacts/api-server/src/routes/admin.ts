import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, subscriptionsTable, eventsTable, broadcastsTable, notificationsTable, sessionsTable, projectsTable, userUsageTable, adminAuditLogsTable, messageCenterSendsTable, notificationSchedulesTable } from "@workspace/db";
import { eq, desc, gte, lt, lte, and, count, sql, isNotNull, ne, inArray, ilike, or } from "drizzle-orm";
import { logAuditFireForget } from "../lib/audit";
import { logAdminAuditFireForget } from "../lib/admin-audit";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { PLAN_LIMITS, getOrCreateSubscription } from "./subscriptions";
import { setAdminBroadcast } from "../lib/log-event";
import { isEmailConfigured, sendBulkEmails, buildEmailHtml } from "../lib/email";
import { pushNotificationToUser } from "./notifications";
import type { Response } from "express";

const router = Router();

// ─── SSE live event stream ───────────────────────────────────────────────────
type AdminSseClient = { res: Response };
const adminSseClients: AdminSseClient[] = [];

function broadcastToAdmins(data: Record<string, unknown>) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (let i = adminSseClients.length - 1; i >= 0; i--) {
    try {
      adminSseClients[i].res.write(payload);
    } catch {
      adminSseClients.splice(i, 1);
    }
  }
}

export function emitAdminEvent(event: Record<string, unknown>) {
  broadcastToAdmins({ event });
}

// Register as the admin broadcast target so every logEvent call is pushed
// to the live SSE stream without a circular import.
setAdminBroadcast((data) => broadcastToAdmins({ event: data }));

// ─── Existing: Users ─────────────────────────────────────────────────────────

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isAdmin: usersTable.isAdmin,
      country: usersTable.country,
      city: usersTable.city,
      lastSeenAt: usersTable.lastSeenAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  const subs = await db.select().from(subscriptionsTable);
  const subMap = Object.fromEntries(subs.map(s => [s.userId, s]));

  const result = users.map(u => ({
    ...u,
    subscription: subMap[u.id] ?? null,
  }));

  res.json({ users: result, total: result.length });
});

router.patch("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const { isAdmin, name } = req.body as { isAdmin?: boolean; name?: string };

  const updates: Partial<{ isAdmin: boolean; name: string }> = {};
  if (typeof isAdmin === "boolean") updates.isAdmin = isAdmin;
  if (typeof name === "string" && name.trim()) updates.name = name.trim();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (typeof isAdmin === "boolean") {
    const [admin] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
    logAdminAuditFireForget({
      adminId:        req.user!.userId,
      adminEmail:     admin?.email ?? "unknown",
      action:         isAdmin ? "promote_admin" : "demote_admin",
      targetUserId:   user.id,
      targetUserEmail: user.email,
      details:        { previousIsAdmin: !isAdmin },
      req,
    });
  }

  res.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, createdAt: user.createdAt } });
});

router.patch("/admin/users/:id/subscription", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const { plan } = req.body as { plan?: string };
  if (!plan || !["free", "pro", "startup", "enterprise"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);

  const existing = await getOrCreateSubscription(id);
  const [sub] = await db
    .update(subscriptionsTable)
    .set({ plan, ...limits, currentPeriodStart: new Date(), currentPeriodEnd: periodEnd })
    .where(eq(subscriptionsTable.userId, id))
    .returning();

  const [admin] = await db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, req.user!.userId));
  logAdminAuditFireForget({
    adminId:         req.user!.userId,
    adminEmail:      admin?.email ?? "unknown",
    action:          "change_plan",
    targetUserId:    user.id,
    targetUserEmail: user.email,
    details:         { previousPlan: existing.plan, newPlan: plan },
    req,
  });

  res.json({ subscription: sub ?? existing });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const requestingUserId = req.user!.userId;
  if (id === requestingUserId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const [[target], [admin]] = await Promise.all([
    db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, id)),
    db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, requestingUserId)),
  ]);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  logAdminAuditFireForget({
    adminId:         requestingUserId,
    adminEmail:      admin?.email ?? "unknown",
    action:          "delete_user",
    targetUserId:    id,
    targetUserEmail: target?.email ?? null,
    details:         {},
    req,
  });
  res.json({ ok: true });
});

// ─── Existing: Basic Stats ────────────────────────────────────────────────────

router.get("/admin/stats", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db.select({ id: usersTable.id, isAdmin: usersTable.isAdmin }).from(usersTable);
  const subs = await db.select({ plan: subscriptionsTable.plan, aiGenerationsUsed: subscriptionsTable.aiGenerationsUsed }).from(subscriptionsTable);

  const planCounts = { free: 0, pro: 0, enterprise: 0 };
  for (const s of subs) {
    if (s.plan in planCounts) planCounts[s.plan as keyof typeof planCounts]++;
  }

  const totalGenerations = subs.reduce((sum, s) => sum + (s.aiGenerationsUsed ?? 0), 0);

  res.json({
    totalUsers: users.length,
    admins: users.filter(u => u.isAdmin).length,
    planCounts,
    totalGenerations,
  });
});

router.post("/admin/seed-admin", async (req, res): Promise<void> => {
  const { email, password, name, seedKey } = req.body as {
    email?: string; password?: string; name?: string; seedKey?: string;
  };

  if (seedKey !== "stageone-admin-seed-2026") {
    res.status(403).json({ error: "Invalid seed key" });
    return;
  }

  if (!email || !password || !name) {
    res.status(400).json({ error: "email, password, and name are required" });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  if (existing) {
    const [updated] = await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.email, email.toLowerCase())).returning();
    res.json({ user: { id: updated.id, email: updated.email, isAdmin: updated.isAdmin }, seeded: false, promoted: true });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(usersTable).values({
    email: email.toLowerCase(),
    passwordHash,
    name,
    isAdmin: true,
  }).returning();

  await db.insert(subscriptionsTable).values({
    userId: user.id,
    plan: "enterprise",
    aiGenerationsLimit: 9999,
    deploymentsLimit: 9999,
    workspacesLimit: 9999,
  });

  res.status(201).json({ user: { id: user.id, email: user.email, isAdmin: user.isAdmin }, seeded: true });
});

// ─── NEW: Event Stream SSE ────────────────────────────────────────────────────

router.get("/admin/events/stream", requireAdmin, (req, res): void => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": connected\n\n");

  const client: AdminSseClient = { res };
  adminSseClients.push(client);

  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* ignore */ }
  }, 25000);

  req.on("close", () => {
    clearInterval(keepAlive);
    const idx = adminSseClients.indexOf(client);
    if (idx !== -1) adminSseClients.splice(idx, 1);
  });
});

// ─── Module Pipeline Dashboard ───────────────────────────────────────────────
router.get("/admin/pipeline", requireAdmin, async (_req, res): Promise<void> => {
  const MODULE_TYPES = [
    "bi_generated",
    "website_generated",
    "chatbot_generated",
    "automation_created",
    "orchestrator_generated",
  ];

  const [statsRows, recentEvents, trendRows] = await Promise.all([
    db.execute(sql`
      SELECT
        type,
        COUNT(*)::int                                                             AS total,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours')::int   AS last24h,
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int     AS last7d,
        MAX(created_at)                                                            AS last_at
      FROM events
      WHERE type IN ('bi_generated','website_generated','chatbot_generated','automation_created','orchestrator_generated')
      GROUP BY type
    `),
    db
      .select({
        id: eventsTable.id,
        type: eventsTable.type,
        userId: eventsTable.userId,
        projectId: eventsTable.projectId,
        country: eventsTable.country,
        city: eventsTable.city,
        data: eventsTable.data,
        createdAt: eventsTable.createdAt,
        userEmail: usersTable.email,
        userName: usersTable.name,
      })
      .from(eventsTable)
      .leftJoin(usersTable, eq(eventsTable.userId, usersTable.id))
      .where(inArray(eventsTable.type, MODULE_TYPES))
      .orderBy(desc(eventsTable.createdAt))
      .limit(60),
    db.execute(sql`
      SELECT
        TO_CHAR(DATE_TRUNC('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS date,
        type,
        COUNT(*)::int AS count
      FROM events
      WHERE type IN ('bi_generated','website_generated','chatbot_generated','automation_created','orchestrator_generated')
        AND created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1, 2
      ORDER BY 1 ASC
    `),
  ]);

  res.json({
    moduleStats: statsRows.rows,
    recentEvents,
    trend: trendRows.rows,
  });
});

// ─── NEW: Events CRUD ─────────────────────────────────────────────────────────

router.get("/admin/events", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const type = req.query.type as string | undefined;

  const where = type ? eq(eventsTable.type, type) : undefined;

  const events = await db
    .select({
      id: eventsTable.id,
      userId: eventsTable.userId,
      projectId: eventsTable.projectId,
      type: eventsTable.type,
      data: eventsTable.data,
      country: eventsTable.country,
      city: eventsTable.city,
      ip: eventsTable.ip,
      userAgent: eventsTable.userAgent,
      createdAt: eventsTable.createdAt,
      userEmail: usersTable.email,
      userName: usersTable.name,
    })
    .from(eventsTable)
    .leftJoin(usersTable, eq(eventsTable.userId, usersTable.id))
    .where(where)
    .orderBy(desc(eventsTable.createdAt))
    .limit(limit)
    .offset(offset);

  const [{ total }] = await db
    .select({ total: count() })
    .from(eventsTable)
    .where(where);

  res.json({ events, total, limit, offset });
});

// ─── NEW: Analytics ──────────────────────────────────────────────────────────

router.get("/admin/analytics", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const ago24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const ago7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ago30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [
    totalUsersRow,
    activeUsers24hRow,
    activeUsers7dRow,
    activeUsers30dRow,
    totalEventsRow,
    totalProjectsRow,
    biGeneratedRow,
    websiteGeneratedRow,
    chatbotGeneratedRow,
    automationCreatedRow,
    orchestratorGeneratedRow,
    marcusMessagesRow,
    recentEvents,
    geoRows,
    topCitiesRows,
    eventTypeRows,
    dailySignupsRows,
    topUsersRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(usersTable),

    db.select({ total: sql<number>`count(distinct ${eventsTable.userId})` })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, ago24h), isNotNull(eventsTable.userId))),

    db.select({ total: sql<number>`count(distinct ${eventsTable.userId})` })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, ago7d), isNotNull(eventsTable.userId))),

    db.select({ total: sql<number>`count(distinct ${eventsTable.userId})` })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, ago30d), isNotNull(eventsTable.userId))),

    db.select({ total: count() }).from(eventsTable),

    db.select({ total: count() }).from(projectsTable),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "bi_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "website_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "chatbot_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "automation_created")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "orchestrator_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "marcus_message")),

    db.select({
      id: eventsTable.id,
      type: eventsTable.type,
      userId: eventsTable.userId,
      country: eventsTable.country,
      city: eventsTable.city,
      createdAt: eventsTable.createdAt,
      userEmail: usersTable.email,
    })
      .from(eventsTable)
      .leftJoin(usersTable, eq(eventsTable.userId, usersTable.id))
      .orderBy(desc(eventsTable.createdAt))
      .limit(20),

    db.select({
      country: eventsTable.country,
      total: sql<number>`count(distinct ${eventsTable.userId})`,
    })
      .from(eventsTable)
      .where(isNotNull(eventsTable.country))
      .groupBy(eventsTable.country)
      .orderBy(desc(sql`count(distinct ${eventsTable.userId})`))
      .limit(15),

    db.select({
      city: eventsTable.city,
      total: sql<number>`count(distinct ${eventsTable.userId})`,
    })
      .from(eventsTable)
      .where(isNotNull(eventsTable.city))
      .groupBy(eventsTable.city)
      .orderBy(desc(sql`count(distinct ${eventsTable.userId})`))
      .limit(10),

    db.select({
      type: eventsTable.type,
      total: count(),
    })
      .from(eventsTable)
      .groupBy(eventsTable.type)
      .orderBy(desc(count())),

    db.select({
      date: sql<string>`DATE(${usersTable.createdAt})`,
      signups: count(),
    })
      .from(usersTable)
      .where(gte(usersTable.createdAt, ago30d))
      .groupBy(sql`DATE(${usersTable.createdAt})`)
      .orderBy(sql`DATE(${usersTable.createdAt})`),

    db.select({
      userId: eventsTable.userId,
      userEmail: usersTable.email,
      userName: usersTable.name,
      total: count(),
    })
      .from(eventsTable)
      .leftJoin(usersTable, eq(eventsTable.userId, usersTable.id))
      .where(isNotNull(eventsTable.userId))
      .groupBy(eventsTable.userId, usersTable.email, usersTable.name)
      .orderBy(desc(count()))
      .limit(10),
  ]);

  const totalBi = biGeneratedRow[0]?.total ?? 0;
  const totalWebsite = websiteGeneratedRow[0]?.total ?? 0;
  const totalChatbot = chatbotGeneratedRow[0]?.total ?? 0;
  const totalAutomation = automationCreatedRow[0]?.total ?? 0;
  const totalOrchestrator = orchestratorGeneratedRow[0]?.total ?? 0;
  const totalMarcusMessages = Number(marcusMessagesRow[0]?.total ?? 0);
  const totalGenerations = totalBi + totalWebsite + totalChatbot + totalAutomation + totalOrchestrator;

  res.json({
    overview: {
      totalUsers: totalUsersRow[0]?.total ?? 0,
      activeUsers24h: Number(activeUsers24hRow[0]?.total ?? 0),
      activeUsers7d: Number(activeUsers7dRow[0]?.total ?? 0),
      activeUsers30d: Number(activeUsers30dRow[0]?.total ?? 0),
      totalEvents: totalEventsRow[0]?.total ?? 0,
      totalProjects: totalProjectsRow[0]?.total ?? 0,
      totalGenerations,
      totalMarcusMessages,
    },
    funnel: [
      { stage: "BI Generated",          count: totalBi,           pct: 100 },
      { stage: "Website Generated",     count: totalWebsite,      pct: totalBi > 0 ? Math.round((totalWebsite       / totalBi) * 100) : 0 },
      { stage: "Chatbot Generated",     count: totalChatbot,      pct: totalBi > 0 ? Math.round((totalChatbot       / totalBi) * 100) : 0 },
      { stage: "Automation Created",    count: totalAutomation,   pct: totalBi > 0 ? Math.round((totalAutomation    / totalBi) * 100) : 0 },
      { stage: "Orchestrator",          count: totalOrchestrator, pct: totalBi > 0 ? Math.round((totalOrchestrator  / totalBi) * 100) : 0 },
    ],
    geo: geoRows.map(r => ({ country: r.country, users: Number(r.total) })),
    topCities: topCitiesRows.map(r => ({ city: r.city, users: Number(r.total) })),
    eventTypes: eventTypeRows,
    recentEvents,
    dailySignups: dailySignupsRows.map(r => ({ date: r.date, signups: Number(r.signups) })),
    topUsers: topUsersRows.map(r => ({ userId: r.userId, email: r.userEmail, name: r.userName, total: Number(r.total) })),
  });
});

// ─── NEW: Sessions ────────────────────────────────────────────────────────────

router.get("/admin/sessions", requireAdmin, async (req, res): Promise<void> => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const sessions = await db
    .select({
      id: sessionsTable.id,
      userId: sessionsTable.userId,
      ipAddress: sessionsTable.ipAddress,
      userAgent: sessionsTable.userAgent,
      country: sessionsTable.country,
      city: sessionsTable.city,
      isValid: sessionsTable.isValid,
      createdAt: sessionsTable.createdAt,
      lastActive: sessionsTable.lastActive,
      userEmail: usersTable.email,
      userName: usersTable.name,
    })
    .from(sessionsTable)
    .leftJoin(usersTable, eq(sessionsTable.userId, usersTable.id))
    .orderBy(desc(sessionsTable.createdAt))
    .limit(limit);

  res.json({ sessions });
});

// ─── Broadcasts ──────────────────────────────────────────────────────────────

router.get("/admin/broadcasts", requireAdmin, async (_req, res): Promise<void> => {
  const broadcasts = await db
    .select()
    .from(broadcastsTable)
    .orderBy(desc(broadcastsTable.createdAt))
    .limit(50);

  res.json({ broadcasts });
});

// Segment counts — how many users each target would reach
router.get("/admin/segment-counts", requireAdmin, async (_req, res): Promise<void> => {
  const [total, freeSubs, proSubs, startupSubs, enterpriseSubs] = await Promise.all([
    db.select({ c: count() }).from(usersTable),
    db.select({ c: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.plan, "free")),
    db.select({ c: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.plan, "pro")),
    db.select({ c: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.plan, "startup")),
    db.select({ c: count() }).from(subscriptionsTable).where(eq(subscriptionsTable.plan, "enterprise")),
  ]);
  res.json({
    all:        total[0]?.c ?? 0,
    free:       freeSubs[0]?.c ?? 0,
    pro:        proSubs[0]?.c ?? 0,
    startup:    startupSubs[0]?.c ?? 0,
    enterprise: enterpriseSubs[0]?.c ?? 0,
    emailEnabled: isEmailConfigured(),
  });
});

// Email preview — returns HTML for the iframe
router.get("/admin/broadcasts/preview-email", requireAdmin, (req, res): void => {
  const { title = "Broadcast Title", message = "Your message here.", type = "info" } = req.query as Record<string, string>;
  const html = buildEmailHtml({ title, message, type });
  res.setHeader("Content-Type", "text/html");
  res.send(html);
});

router.post("/admin/broadcasts", requireAdmin, async (req, res): Promise<void> => {
  const { title, message, type, target, expiresAt, sendEmail } = req.body as {
    title?: string;
    message?: string;
    type?: string;
    target?: string;
    expiresAt?: string;
    sendEmail?: boolean;
  };

  if (!title?.trim() || !message?.trim()) {
    res.status(400).json({ error: "title and message are required" });
    return;
  }

  const validTypes = ["info", "warning", "update", "feature"];
  const validTargets = ["all", "free", "pro", "startup", "enterprise"];

  const broadcastType = validTypes.includes(type ?? "") ? type! : "info";
  const broadcastTarget = validTargets.includes(target ?? "") ? target! : "all";
  const adminId = req.user!.userId;

  // Resolve target users synchronously so we can store the count
  const recipients = await getTargetRecipients(broadcastTarget);

  const [broadcast] = await db.insert(broadcastsTable).values({
    title: title.trim(),
    message: message.trim(),
    type: broadcastType,
    target: broadcastTarget,
    createdBy: adminId,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
    deliveredCount: recipients.length,
    emailDelivered: false,
  }).returning();

  // Fan-out notifications + optional email (fire-and-forget)
  fanOutBroadcast(broadcast.id, title.trim(), message.trim(), broadcastType, recipients)
    .then(async () => {
      if (sendEmail && isEmailConfigured()) {
        const emailRecipients = recipients.filter(r => r.email);
        await sendBulkEmails(emailRecipients.map(r => ({ email: r.email!, name: r.name ?? r.email! })), title.trim(), message.trim(), broadcastType);
        await db.update(broadcastsTable).set({ emailDelivered: true }).where(eq(broadcastsTable.id, broadcast.id));
      }
    })
    .catch(() => {});

  db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, adminId)).then(([admin]) => {
    logAdminAuditFireForget({
      adminId,
      adminEmail:  admin?.email ?? "unknown",
      action:      "send_broadcast",
      details:     { title: title.trim(), type: broadcastType, target: broadcastTarget, recipientCount: recipients.length },
      req,
    });
  }).catch(() => {});

  res.status(201).json({ broadcast: { ...broadcast, deliveredCount: recipients.length } });
});

router.delete("/admin/broadcasts/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const adminId = req.user!.userId;
  const [[bc], [admin]] = await Promise.all([
    db.select({ title: broadcastsTable.title }).from(broadcastsTable).where(eq(broadcastsTable.id, id)),
    db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, adminId)),
  ]);
  await db.delete(broadcastsTable).where(eq(broadcastsTable.id, id));
  logAdminAuditFireForget({
    adminId,
    adminEmail: admin?.email ?? "unknown",
    action:     "delete_broadcast",
    details:    { broadcastId: id, title: bc?.title ?? null },
    req,
  });
  res.json({ ok: true });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getTargetRecipients(target: string): Promise<Array<{ id: string; email?: string; name?: string }>> {
  if (target === "all") {
    return db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable);
  }
  const subs = await db
    .select({ userId: subscriptionsTable.userId })
    .from(subscriptionsTable)
    .where(eq(subscriptionsTable.plan, target));
  if (subs.length === 0) return [];
  const userIds = subs.map(s => s.userId);
  const users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name }).from(usersTable);
  return users.filter(u => userIds.includes(u.id));
}

// ─── User Intelligence ────────────────────────────────────────────────────────

router.get("/admin/user-intelligence", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      country: usersTable.country,
      city: usersTable.city,
      lastSeenAt: usersTable.lastSeenAt,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt));

  if (users.length === 0) { res.json({ users: [] }); return; }

  const userIds = users.map(u => u.id);

  const [subs, projectCounts, eventCounts, usageRows] = await Promise.all([
    db.select().from(subscriptionsTable).where(inArray(subscriptionsTable.userId, userIds)),

    db.select({
      userId: projectsTable.userId,
      count: count(),
    })
      .from(projectsTable)
      .where(inArray(projectsTable.userId, userIds))
      .groupBy(projectsTable.userId),

    db.select({
      userId: eventsTable.userId,
      type: eventsTable.type,
      total: count(),
    })
      .from(eventsTable)
      .where(and(isNotNull(eventsTable.userId), inArray(eventsTable.userId, userIds)))
      .groupBy(eventsTable.userId, eventsTable.type),

    db.select()
      .from(userUsageTable)
      .where(inArray(userUsageTable.userId, userIds)),
  ]);

  const subMap = Object.fromEntries(subs.map(s => [s.userId, s]));
  const projectMap: Record<string, number> = {};
  for (const r of projectCounts) projectMap[r.userId!] = Number(r.count);

  const eventMap: Record<string, Record<string, number>> = {};
  for (const r of eventCounts) {
    if (!r.userId) continue;
    if (!eventMap[r.userId]) eventMap[r.userId] = {};
    eventMap[r.userId][r.type] = Number(r.total);
  }

  const usageMap: Record<string, typeof usageRows[0]> = {};
  for (const r of usageRows) {
    const key = r.userId;
    if (!usageMap[key]) {
      usageMap[key] = { ...r };
    } else {
      usageMap[key].biGenerations += r.biGenerations;
      usageMap[key].websiteGenerations += r.websiteGenerations;
      usageMap[key].chatbotGenerations += r.chatbotGenerations;
      usageMap[key].automationGenerations += r.automationGenerations;
      usageMap[key].orchestratorGenerations += r.orchestratorGenerations;
      usageMap[key].marcusMessages += r.marcusMessages;
      usageMap[key].totalGenerations += r.totalGenerations;
    }
  }

  const result = users.map(u => {
    const ev = eventMap[u.id] ?? {};
    const bi = ev["bi_generated"] ?? 0;
    const website = ev["website_generated"] ?? 0;
    const chatbot = ev["chatbot_generated"] ?? 0;
    const automation = ev["automation_created"] ?? 0;
    const orchestrator = ev["orchestrator_generated"] ?? 0;
    const marcus = ev["marcus_message"] ?? 0;
    const totalActivity = bi * 3 + website * 3 + chatbot * 2 + automation * 2 + orchestrator * 4 + marcus * 1 + (projectMap[u.id] ?? 0) * 2;

    return {
      id: u.id,
      email: u.email,
      name: u.name,
      country: u.country,
      city: u.city,
      lastSeenAt: u.lastSeenAt,
      createdAt: u.createdAt,
      plan: subMap[u.id]?.plan ?? "free",
      projectCount: projectMap[u.id] ?? 0,
      biGenerations: bi,
      websiteGenerations: website,
      chatbotGenerations: chatbot,
      automationGenerations: automation,
      orchestratorGenerations: orchestrator,
      marcusMessages: marcus,
      activityScore: totalActivity,
      usage: usageMap[u.id] ?? null,
    };
  });

  res.json({ users: result });
});

// ─── Message Center ───────────────────────────────────────────────────────────

router.post("/admin/message-center", requireAdmin, async (req, res): Promise<void> => {
  const { target, targetUserId, type, title, body } = req.body as {
    target?: string;
    targetUserId?: string;
    type?: string;
    title?: string;
    body?: string;
  };

  if (!title?.trim() || !body?.trim()) {
    res.status(400).json({ error: "title and body are required" });
    return;
  }

  const validTargets = ["all", "free", "pro", "startup", "enterprise", "individual"];
  const msgTarget = validTargets.includes(target ?? "") ? target! : "all";
  const adminId = req.user!.userId;

  let recipients: Array<{ id: string }>;
  if (msgTarget === "individual") {
    if (!targetUserId) { res.status(400).json({ error: "targetUserId required for individual target" }); return; }
    recipients = [{ id: targetUserId }];
  } else {
    recipients = await getTargetRecipients(msgTarget);
  }

  const severityMap: Record<string, "info" | "success" | "warning" | "error"> = {
    announcement: "info",
    feature: "success",
    warning: "warning",
    maintenance: "warning",
    tip: "info",
  };
  const severity = severityMap[type ?? ""] ?? "info";

  const rows = recipients.map(u => ({
    userId: u.id,
    type: type ?? "announcement",
    title: title.trim(),
    message: body.trim(),
    severity,
    metadata: { sentBy: adminId, target: msgTarget } as Record<string, unknown>,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const inserted = await db.insert(notificationsTable).values(rows.slice(i, i + 100)).returning();
    // Push to active SSE connections so the bell lights up immediately
    for (const n of inserted) {
      pushNotificationToUser(n.userId, n);
    }
  }

  logAuditFireForget({
    userId: adminId,
    action: "message_center_send",
    resource: "notifications",
    changes: { target: msgTarget, type, title, recipientCount: rows.length },
    severity: "medium",
  });

  db.select({ email: usersTable.email }).from(usersTable).where(eq(usersTable.id, adminId)).then(([admin]) => {
    let tUserId: string | null = null;
    let tUserEmail: string | null = null;
    if (msgTarget === "individual" && targetUserId) {
      tUserId = targetUserId;
    }
    logAdminAuditFireForget({
      adminId,
      adminEmail:      admin?.email ?? "unknown",
      action:          "send_notification",
      targetUserId:    tUserId,
      targetUserEmail: tUserEmail,
      details:         { target: msgTarget, type, title, recipientCount: rows.length },
      req,
    });
  }).catch(() => {});

  // Record to message_center_sends for history
  db.select({ email: usersTable.email, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, adminId))
    .then(([admin]) => {
      db.insert(messageCenterSendsTable).values({
        adminId,
        adminEmail: admin?.email ?? "unknown",
        title: title.trim(),
        message: body.trim(),
        type: type ?? "announcement",
        segment: msgTarget,
        targetUserId: msgTarget === "individual" && targetUserId ? targetUserId : null,
        recipientCount: rows.length,
      }).catch(() => {});
    }).catch(() => {});

  res.status(201).json({ ok: true, sent: rows.length });
});

// ─── Message Center History ────────────────────────────────────────────────────

router.get("/admin/message-center", requireAdmin, async (req, res): Promise<void> => {
  const limit  = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset = Math.max(0, Number(req.query.page ?? 0)) * limit;

  const [sends, [{ total }]] = await Promise.all([
    db.select().from(messageCenterSendsTable)
      .orderBy(desc(messageCenterSendsTable.createdAt))
      .limit(limit).offset(offset),
    db.select({ total: count() }).from(messageCenterSendsTable),
  ]);

  res.json({ sends, total });
});

router.delete("/admin/message-center/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  await db.delete(messageCenterSendsTable).where(eq(messageCenterSendsTable.id, id));
  res.json({ ok: true });
});

// ─── Notification Analytics ───────────────────────────────────────────────────

router.get("/admin/notification-analytics", requireAdmin, async (_req, res): Promise<void> => {
  const [
    [{ totalSent }],
    [{ totalRead }],
    topRows,
  ] = await Promise.all([
    db.select({ totalSent: count() }).from(notificationsTable),
    db.select({ totalRead: count() }).from(notificationsTable).where(eq(notificationsTable.read, true)),
    db.select({
      title:      notificationsTable.title,
      type:       notificationsTable.type,
      recipients: count(),
      reads:      sql<number>`COUNT(CASE WHEN ${notificationsTable.read} THEN 1 END)::int`,
    })
      .from(notificationsTable)
      .groupBy(notificationsTable.title, notificationsTable.type)
      .orderBy(desc(sql`COUNT(CASE WHEN ${notificationsTable.read} THEN 1 END)`))
      .limit(10),
  ]);

  const sent    = Number(totalSent);
  const read    = Number(totalRead);
  const unread  = sent - read;
  const readRate = sent > 0 ? Math.round((read / sent) * 100 * 10) / 10 : 0;

  const topNotifications = topRows.map(r => ({
    title:      r.title,
    type:       r.type,
    recipients: Number(r.recipients),
    reads:      Number(r.reads),
    readRate:   Number(r.recipients) > 0
      ? Math.round((Number(r.reads) / Number(r.recipients)) * 100 * 10) / 10
      : 0,
  }));

  res.json({ totalSent: sent, totalRead: read, unreadCount: unread, readRate, topNotifications });
});

// ─── Notification Schedules ───────────────────────────────────────────────────

router.get("/admin/notification-schedules", requireAdmin, async (_req, res): Promise<void> => {
  const schedules = await db
    .select()
    .from(notificationSchedulesTable)
    .orderBy(desc(notificationSchedulesTable.scheduledFor));
  res.json({ schedules });
});

router.post("/admin/notification-schedules", requireAdmin, async (req, res): Promise<void> => {
  const { title, message, type, segment, targetUserId, scheduledFor } = req.body as {
    title?: string;
    message?: string;
    type?: string;
    segment?: string;
    targetUserId?: string;
    scheduledFor?: string;
  };

  if (!title?.trim() || !message?.trim() || !scheduledFor) {
    res.status(400).json({ error: "title, message, and scheduledFor are required" });
    return;
  }

  const schedDate = new Date(scheduledFor);
  if (isNaN(schedDate.getTime()) || schedDate <= new Date()) {
    res.status(400).json({ error: "scheduledFor must be a future date" });
    return;
  }

  const validSegments = ["all", "free", "pro", "startup", "enterprise", "individual"];
  const seg = validSegments.includes(segment ?? "") ? segment! : "all";
  const adminId = req.user!.userId;

  const [schedule] = await db.insert(notificationSchedulesTable).values({
    title:        title.trim(),
    message:      message.trim(),
    type:         type ?? "announcement",
    segment:      seg,
    targetUserId: seg === "individual" && targetUserId ? targetUserId : null,
    scheduledFor: schedDate,
    status:       "pending",
    createdBy:    adminId,
  }).returning();

  res.status(201).json({ schedule });
});

router.patch("/admin/notification-schedules/:id/cancel", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  const [updated] = await db.update(notificationSchedulesTable)
    .set({ status: "cancelled" })
    .where(and(eq(notificationSchedulesTable.id, id), eq(notificationSchedulesTable.status, "pending")))
    .returning();

  if (!updated) { res.status(404).json({ error: "Schedule not found or already processed" }); return; }
  res.json({ schedule: updated });
});

router.delete("/admin/notification-schedules/:id", requireAdmin, async (req, res): Promise<void> => {
  const id = req.params["id"] as string;
  await db.delete(notificationSchedulesTable)
    .where(and(eq(notificationSchedulesTable.id, id), ne(notificationSchedulesTable.status, "sent")));
  res.json({ ok: true });
});

// ─── Notification Scheduler ───────────────────────────────────────────────────

async function runScheduledNotifications() {
  try {
    const due = await db
      .select()
      .from(notificationSchedulesTable)
      .where(and(
        eq(notificationSchedulesTable.status, "pending"),
        lte(notificationSchedulesTable.scheduledFor, new Date()),
      ));

    for (const schedule of due) {
      try {
        const recipients = schedule.segment === "individual" && schedule.targetUserId
          ? [{ id: schedule.targetUserId }]
          : await getTargetRecipients(schedule.segment);

        const severityMap: Record<string, "info" | "success" | "warning" | "error"> = {
          announcement: "info", feature: "success", warning: "warning", maintenance: "warning", tip: "info",
        };
        const severity = severityMap[schedule.type] ?? "info";

        const rows = recipients.map(u => ({
          userId:   u.id,
          type:     schedule.type,
          title:    schedule.title,
          message:  schedule.message,
          severity,
          metadata: { scheduledId: schedule.id, segment: schedule.segment } as Record<string, unknown>,
        }));

        if (rows.length > 0) {
          for (let i = 0; i < rows.length; i += 100) {
            await db.insert(notificationsTable).values(rows.slice(i, i + 100));
          }
        }

        await db.update(notificationSchedulesTable)
          .set({ status: "sent", sentAt: new Date() })
          .where(eq(notificationSchedulesTable.id, schedule.id));
      } catch {
        // individual schedule failure doesn't block others
      }
    }
  } catch {
    // scheduler is fire-and-forget
  }
}

setInterval(runScheduledNotifications, 60_000);

// ─── Admin Audit Logs ─────────────────────────────────────────────────────────

router.get("/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const page    = Math.max(0, Number(req.query.page   ?? 0));
  const limit   = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const offset  = page * limit;
  const action  = req.query.action  as string | undefined;
  const adminId = req.query.adminId as string | undefined;
  const search  = req.query.search  as string | undefined;  // email search (admin or target)
  const from    = req.query.from    as string | undefined;
  const to      = req.query.to      as string | undefined;

  const conditions = [];
  if (action)  conditions.push(eq(adminAuditLogsTable.action, action));
  if (adminId) conditions.push(eq(adminAuditLogsTable.adminId, adminId));
  if (from)    conditions.push(gte(adminAuditLogsTable.createdAt, new Date(from)));
  if (to)      conditions.push(lt(adminAuditLogsTable.createdAt, new Date(to)));
  if (search) {
    conditions.push(or(
      ilike(adminAuditLogsTable.adminEmail,       `%${search}%`),
      ilike(adminAuditLogsTable.targetUserEmail,  `%${search}%`),
      ilike(adminAuditLogsTable.action,           `%${search}%`),
    ));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ total }]] = await Promise.all([
    db.select().from(adminAuditLogsTable).where(where).orderBy(desc(adminAuditLogsTable.createdAt)).limit(limit).offset(offset),
    db.select({ total: count() }).from(adminAuditLogsTable).where(where),
  ]);

  res.json({ logs, total, page, limit });
});

async function fanOutBroadcast(
  broadcastId: string,
  title: string,
  message: string,
  type: string,
  users: Array<{ id: string }>,
) {
  const severityMap: Record<string, "info" | "success" | "warning" | "error"> = {
    info: "info",
    update: "success",
    feature: "success",
    warning: "warning",
  };
  const severity = severityMap[type] ?? "info";

  const rows = users.map(u => ({
    userId: u.id,
    type: "broadcast",
    title,
    message,
    severity,
    metadata: { broadcastId, broadcastType: type } as Record<string, unknown>,
  }));

  for (let i = 0; i < rows.length; i += 100) {
    const inserted = await db.insert(notificationsTable).values(rows.slice(i, i + 100)).returning();
    // Push to any active SSE connections so the bell lights up immediately
    for (const n of inserted) {
      pushNotificationToUser(n.userId, n);
    }
  }
}

export default router;
