import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, subscriptionsTable, eventsTable, broadcastsTable, notificationsTable, sessionsTable, projectsTable } from "@workspace/db";
import { eq, desc, gte, lt, and, count, sql, isNotNull, ne } from "drizzle-orm";
import { requireAdmin, requireAuth } from "../middleware/auth";
import { PLAN_LIMITS, getOrCreateSubscription } from "./subscriptions";
import { setAdminBroadcast } from "../lib/log-event";
import { isEmailConfigured, sendBulkEmails, buildEmailHtml } from "../lib/email";
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
  const { id } = req.params;
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
  res.json({ user: { id: user.id, email: user.email, name: user.name, isAdmin: user.isAdmin, createdAt: user.createdAt } });
});

router.patch("/admin/users/:id/subscription", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
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

  res.json({ subscription: sub ?? existing });
});

router.delete("/admin/users/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  const requestingUserId = req.user!.userId;
  if (id === requestingUserId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
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
    totalEventsRow,
    totalProjectsRow,
    biGeneratedRow,
    websiteGeneratedRow,
    chatbotGeneratedRow,
    automationCreatedRow,
    recentEvents,
    geoRows,
    eventTypeRows,
    dailySignupsRows,
  ] = await Promise.all([
    db.select({ total: count() }).from(usersTable),

    db.select({ total: sql<number>`count(distinct ${eventsTable.userId})` })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, ago24h), isNotNull(eventsTable.userId))),

    db.select({ total: sql<number>`count(distinct ${eventsTable.userId})` })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, ago7d), isNotNull(eventsTable.userId))),

    db.select({ total: count() }).from(eventsTable),

    db.select({ total: count() }).from(projectsTable),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "bi_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "website_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "chatbot_generated")),

    db.select({ total: count() }).from(eventsTable).where(eq(eventsTable.type, "automation_created")),

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
  ]);

  const totalBi = biGeneratedRow[0]?.total ?? 0;
  const totalWebsite = websiteGeneratedRow[0]?.total ?? 0;
  const totalChatbot = chatbotGeneratedRow[0]?.total ?? 0;
  const totalAutomation = automationCreatedRow[0]?.total ?? 0;

  res.json({
    overview: {
      totalUsers: totalUsersRow[0]?.total ?? 0,
      activeUsers24h: Number(activeUsers24hRow[0]?.total ?? 0),
      activeUsers7d: Number(activeUsers7dRow[0]?.total ?? 0),
      totalEvents: totalEventsRow[0]?.total ?? 0,
      totalProjects: totalProjectsRow[0]?.total ?? 0,
    },
    funnel: [
      { stage: "BI Generated",       count: totalBi,        pct: 100 },
      { stage: "Website Generated",  count: totalWebsite,   pct: totalBi > 0 ? Math.round((totalWebsite  / totalBi) * 100) : 0 },
      { stage: "Chatbot Generated",  count: totalChatbot,   pct: totalBi > 0 ? Math.round((totalChatbot  / totalBi) * 100) : 0 },
      { stage: "Automation Created", count: totalAutomation,pct: totalBi > 0 ? Math.round((totalAutomation / totalBi) * 100) : 0 },
    ],
    geo: geoRows.map(r => ({ country: r.country, users: Number(r.total) })),
    eventTypes: eventTypeRows,
    recentEvents,
    dailySignups: dailySignupsRows.map(r => ({ date: r.date, signups: Number(r.signups) })),
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

  res.status(201).json({ broadcast: { ...broadcast, deliveredCount: recipients.length } });
});

router.delete("/admin/broadcasts/:id", requireAdmin, async (req, res): Promise<void> => {
  const { id } = req.params;
  await db.delete(broadcastsTable).where(eq(broadcastsTable.id, id));
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

  if (rows.length > 0) {
    for (let i = 0; i < rows.length; i += 100) {
      await db.insert(notificationsTable).values(rows.slice(i, i + 100));
    }
  }
}

export default router;
