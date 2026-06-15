import { Router } from "express";
import { db, usersTable, subscriptionsTable, sessionsTable, projectsTable, userUsageTable, supportTicketsTable, crmProfilesTable, eventsTable } from "@workspace/db";
import { eq, desc, gte, and, count, sql, lte, or } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// ─── Score Engine ─────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

interface ScoreInputs {
  userId: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  sessionCount: number;
  eventCount: number;
  supportTicketCount: number;
  totalGenerations: number;
  biGenerations: number;
  websiteGenerations: number;
  chatbotGenerations: number;
  automationGenerations: number;
  marcusMessages: number;
  projectCount: number;
}

function computeEngagementScore(inputs: ScoreInputs): number {
  const now = Date.now();
  const daysSinceCreated = (now - inputs.createdAt.getTime()) / 86400000;

  // Session frequency (weekly avg over last 30 days)
  const sessionFrequency = Math.min(inputs.sessionCount / Math.max(daysSinceCreated / 7, 1), 7);
  const sessionScore = (sessionFrequency / 7) * 40;

  // Event activity
  const eventScore = Math.min((inputs.eventCount / 50) * 30, 30);

  // Support engagement (shows active usage)
  const supportScore = Math.min(inputs.supportTicketCount * 5, 15);

  // Recency bonus
  const daysSinceSeen = inputs.lastSeenAt
    ? (now - inputs.lastSeenAt.getTime()) / 86400000
    : daysSinceCreated;
  const recencyScore = daysSinceSeen <= 1 ? 15 : daysSinceSeen <= 7 ? 10 : daysSinceSeen <= 14 ? 5 : 0;

  return clamp(sessionScore + eventScore + supportScore + recencyScore);
}

function computeActivityScore(inputs: ScoreInputs): number {
  // Generations
  const genScore = Math.min((inputs.totalGenerations / 20) * 50, 50);
  // Project creation
  const projectScore = Math.min((inputs.projectCount / 5) * 30, 30);
  // Marcus engagement
  const marcusScore = Math.min((inputs.marcusMessages / 20) * 20, 20);
  return clamp(genScore + projectScore + marcusScore);
}

function computeValueScore(inputs: ScoreInputs): number {
  // Weighted: BI×3, Website×3, Chatbot×2, Automation×2, Marcus×1
  const weighted =
    inputs.biGenerations * 3 +
    inputs.websiteGenerations * 3 +
    inputs.chatbotGenerations * 2 +
    inputs.automationGenerations * 2 +
    inputs.marcusMessages * 1;
  // Normalize: 50 weighted points → score of 100
  return clamp((weighted / 50) * 100);
}

function computeChurnRiskScore(inputs: ScoreInputs): number {
  const now = Date.now();
  let risk = 0;

  const daysSinceSeen = inputs.lastSeenAt
    ? (now - inputs.lastSeenAt.getTime()) / 86400000
    : (now - inputs.createdAt.getTime()) / 86400000;

  // Inactivity penalty
  if (daysSinceSeen >= 30) risk += 60;
  else if (daysSinceSeen >= 14) risk += 40;
  else if (daysSinceSeen >= 7) risk += 25;
  else if (daysSinceSeen >= 3) risk += 10;

  // Zero generations is a strong churn signal
  if (inputs.totalGenerations === 0) risk += 30;
  else if (inputs.totalGenerations < 3) risk += 15;

  // No projects
  if (inputs.projectCount === 0) risk += 10;

  return clamp(risk);
}

function computeLifecycle(
  inputs: ScoreInputs,
  engagementScore: number,
  valueScore: number,
  churnRiskScore: number
): string {
  const now = Date.now();
  const daysSinceSeen = inputs.lastSeenAt
    ? (now - inputs.lastSeenAt.getTime()) / 86400000
    : (now - inputs.createdAt.getTime()) / 86400000;
  const daysSinceCreated = (now - inputs.createdAt.getTime()) / 86400000;

  if (daysSinceSeen >= 30) return "churned";
  if (daysSinceSeen >= 7 || churnRiskScore >= 40) return "at_risk";
  if (engagementScore >= 65 && valueScore >= 65) return "power_user";
  if (inputs.totalGenerations >= 1 && (engagementScore >= 30 || daysSinceCreated >= 7)) return "engaged";
  if (inputs.totalGenerations >= 1) return "activated";
  return "new";
}

// ─── Build scores for all users ───────────────────────────────────────────────

async function buildAllScores() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

  const [users, allUsage, sessionCounts, eventCounts, supportCounts, projectCounts] = await Promise.all([
    db.select({ id: usersTable.id, createdAt: usersTable.createdAt, lastSeenAt: usersTable.lastSeenAt }).from(usersTable),
    db.select().from(userUsageTable),
    db.select({ userId: sessionsTable.userId, cnt: count() })
      .from(sessionsTable)
      .where(gte(sessionsTable.createdAt, thirtyDaysAgo))
      .groupBy(sessionsTable.userId),
    db.select({ userId: eventsTable.userId, cnt: count() })
      .from(eventsTable)
      .where(and(gte(eventsTable.createdAt, thirtyDaysAgo), sql`${eventsTable.userId} is not null`))
      .groupBy(eventsTable.userId),
    db.select({ userId: supportTicketsTable.userId, cnt: count() })
      .from(supportTicketsTable)
      .groupBy(supportTicketsTable.userId),
    db.select({ userId: projectsTable.userId, cnt: count() })
      .from(projectsTable)
      .groupBy(projectsTable.userId),
  ]);

  const usageByUser = new Map<string, typeof allUsage[0][]>();
  for (const u of allUsage) {
    if (!usageByUser.has(u.userId)) usageByUser.set(u.userId, []);
    usageByUser.get(u.userId)!.push(u);
  }

  const sessionMap = new Map(sessionCounts.map(r => [r.userId, Number(r.cnt)]));
  const eventMap = new Map(eventCounts.map(r => [r.userId ?? "", Number(r.cnt)]));
  const supportMap = new Map(supportCounts.map(r => [r.userId, Number(r.cnt)]));
  const projectMap = new Map(projectCounts.map(r => [r.userId, Number(r.cnt)]));

  const profiles: Array<{
    userId: string;
    lifecycleStage: string;
    engagementScore: number;
    activityScore: number;
    valueScore: number;
    churnRiskScore: number;
    firstSeenAt: Date;
    lastSeenAt: Date | null;
    lastGenerationAt: Date | null;
  }> = [];

  for (const user of users) {
    const usage = usageByUser.get(user.id) ?? [];
    const totalBI = usage.reduce((s, u) => s + u.biGenerations, 0);
    const totalWebsite = usage.reduce((s, u) => s + u.websiteGenerations, 0);
    const totalChatbot = usage.reduce((s, u) => s + u.chatbotGenerations, 0);
    const totalAutomation = usage.reduce((s, u) => s + u.automationGenerations, 0);
    const totalMarcus = usage.reduce((s, u) => s + u.marcusMessages, 0);
    const totalGen = usage.reduce((s, u) => s + u.totalGenerations, 0);

    const inputs: ScoreInputs = {
      userId: user.id,
      createdAt: user.createdAt,
      lastSeenAt: user.lastSeenAt ?? null,
      sessionCount: sessionMap.get(user.id) ?? 0,
      eventCount: eventMap.get(user.id) ?? 0,
      supportTicketCount: supportMap.get(user.id) ?? 0,
      totalGenerations: totalGen,
      biGenerations: totalBI,
      websiteGenerations: totalWebsite,
      chatbotGenerations: totalChatbot,
      automationGenerations: totalAutomation,
      marcusMessages: totalMarcus,
      projectCount: projectMap.get(user.id) ?? 0,
    };

    const engagementScore = computeEngagementScore(inputs);
    const activityScore = computeActivityScore(inputs);
    const valueScore = computeValueScore(inputs);
    const churnRiskScore = computeChurnRiskScore(inputs);
    const lifecycleStage = computeLifecycle(inputs, engagementScore, valueScore, churnRiskScore);

    profiles.push({
      userId: user.id,
      lifecycleStage,
      engagementScore,
      activityScore,
      valueScore,
      churnRiskScore,
      firstSeenAt: user.createdAt,
      lastSeenAt: user.lastSeenAt ?? null,
      lastGenerationAt: totalGen > 0 ? user.lastSeenAt ?? null : null,
    });
  }

  return profiles;
}

async function upsertProfiles(profiles: Awaited<ReturnType<typeof buildAllScores>>) {
  for (const p of profiles) {
    const existing = await db.select({ id: crmProfilesTable.id, tags: crmProfilesTable.tags, notes: crmProfilesTable.notes })
      .from(crmProfilesTable).where(eq(crmProfilesTable.userId, p.userId)).limit(1);

    if (existing.length === 0) {
      await db.insert(crmProfilesTable).values({
        userId: p.userId,
        lifecycleStage: p.lifecycleStage,
        engagementScore: p.engagementScore,
        activityScore: p.activityScore,
        valueScore: p.valueScore,
        churnRiskScore: p.churnRiskScore,
        firstSeenAt: p.firstSeenAt,
        lastSeenAt: p.lastSeenAt,
        lastGenerationAt: p.lastGenerationAt,
        tags: [],
        notes: null,
      });
    } else {
      await db.update(crmProfilesTable).set({
        lifecycleStage: p.lifecycleStage,
        engagementScore: p.engagementScore,
        activityScore: p.activityScore,
        valueScore: p.valueScore,
        churnRiskScore: p.churnRiskScore,
        firstSeenAt: p.firstSeenAt,
        lastSeenAt: p.lastSeenAt,
        lastGenerationAt: p.lastGenerationAt,
      }).where(eq(crmProfilesTable.userId, p.userId));
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/admin/crm/overview
router.get("/admin/crm/overview", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const profiles = await db.select({
      lifecycleStage: crmProfilesTable.lifecycleStage,
      cnt: count(),
    }).from(crmProfilesTable).groupBy(crmProfilesTable.lifecycleStage);

    const [totalRow] = await db.select({ cnt: count() }).from(usersTable);
    const total = Number(totalRow?.cnt ?? 0);

    const stageCounts: Record<string, number> = {};
    for (const r of profiles) stageCounts[r.lifecycleStage] = Number(r.cnt);

    res.json({
      totalUsers: total,
      newUsers: stageCounts["new"] ?? 0,
      activatedUsers: stageCounts["activated"] ?? 0,
      engagedUsers: stageCounts["engaged"] ?? 0,
      powerUsers: stageCounts["power_user"] ?? 0,
      atRiskUsers: stageCounts["at_risk"] ?? 0,
      churnedUsers: stageCounts["churned"] ?? 0,
      profiledUsers: profiles.reduce((s, r) => s + Number(r.cnt), 0),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load CRM overview" });
  }
});

// GET /api/admin/crm/users
router.get("/admin/crm/users", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { lifecycle, plan, minChurn, maxChurn, minEngagement, search } = req.query as Record<string, string>;

    const users = await db
      .select({
        id: usersTable.id,
        email: usersTable.email,
        name: usersTable.name,
        country: usersTable.country,
        createdAt: usersTable.createdAt,
        lastSeenAt: usersTable.lastSeenAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    const subs = await db.select({ userId: subscriptionsTable.userId, plan: subscriptionsTable.plan })
      .from(subscriptionsTable);
    const subMap = new Map(subs.map(s => [s.userId, s.plan]));

    const profiles = await db.select().from(crmProfilesTable);
    const profileMap = new Map(profiles.map(p => [p.userId, p]));

    let results = users.map(u => ({
      ...u,
      plan: subMap.get(u.id) ?? "free",
      crm: profileMap.get(u.id) ?? null,
    }));

    if (lifecycle && lifecycle !== "all") {
      results = results.filter(u => u.crm?.lifecycleStage === lifecycle);
    }
    if (plan && plan !== "all") {
      results = results.filter(u => u.plan === plan);
    }
    if (minChurn) {
      results = results.filter(u => (u.crm?.churnRiskScore ?? 0) >= Number(minChurn));
    }
    if (maxChurn) {
      results = results.filter(u => (u.crm?.churnRiskScore ?? 0) <= Number(maxChurn));
    }
    if (minEngagement) {
      results = results.filter(u => (u.crm?.engagementScore ?? 0) >= Number(minEngagement));
    }
    if (search) {
      const q = search.toLowerCase();
      results = results.filter(u =>
        u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)
      );
    }

    res.json({ users: results, total: results.length });
  } catch {
    res.status(500).json({ error: "Failed to load CRM users" });
  }
});

// GET /api/admin/crm/users/:id
router.get("/admin/crm/users/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const userId = req.params["id"] as string;

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const [sub] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId)).limit(1);
    const [profile] = await db.select().from(crmProfilesTable).where(eq(crmProfilesTable.userId, userId)).limit(1);
    const [ticket] = await db.select({ cnt: count() }).from(supportTicketsTable).where(eq(supportTicketsTable.userId, userId));
    const [projectCount] = await db.select({ cnt: count() }).from(projectsTable).where(eq(projectsTable.userId, userId));
    const [sessionCount] = await db.select({ cnt: count() }).from(sessionsTable).where(eq(sessionsTable.userId, userId));
    const usage = await db.select().from(userUsageTable).where(eq(userUsageTable.userId, userId)).orderBy(desc(userUsageTable.year), desc(userUsageTable.month));

    const recentEvents = await db.select()
      .from(eventsTable)
      .where(eq(eventsTable.userId, userId))
      .orderBy(desc(eventsTable.createdAt))
      .limit(20);

    const totalGen = usage.reduce((s, u) => s + u.totalGenerations, 0);
    const totalBI = usage.reduce((s, u) => s + u.biGenerations, 0);
    const totalWebsite = usage.reduce((s, u) => s + u.websiteGenerations, 0);
    const totalChatbot = usage.reduce((s, u) => s + u.chatbotGenerations, 0);
    const totalAutomation = usage.reduce((s, u) => s + u.automationGenerations, 0);
    const totalMarcus = usage.reduce((s, u) => s + u.marcusMessages, 0);

    // Generate rule-based AI insights
    const now = Date.now();
    const daysSinceSeen = user.lastSeenAt
      ? Math.floor((now - new Date(user.lastSeenAt).getTime()) / 86400000)
      : null;

    const insights: string[] = [];
    if (daysSinceSeen !== null && daysSinceSeen >= 7) {
      insights.push(`Inactive for ${daysSinceSeen} days — churn risk elevated.`);
    }
    if (totalBI > 5 && totalWebsite === 0) {
      insights.push("High BI usage but no Website generation — cross-sell opportunity.");
    }
    if (totalBI === 0 && totalWebsite === 0 && totalGen === 0) {
      insights.push("No AI usage recorded — user may need onboarding nudge.");
    }
    if (profile?.engagementScore !== undefined && profile.engagementScore >= 70 && sub?.plan === "free") {
      insights.push("Highly engaged free user — strong upgrade candidate.");
    }
    if (profile?.churnRiskScore !== undefined && profile.churnRiskScore >= 60) {
      insights.push("Churn risk is high — consider a proactive outreach or coupon.");
    }
    if (totalGen >= 10 && sub?.plan === "free") {
      insights.push("Heavy free-tier usage — conversion conversation warranted.");
    }
    if (totalMarcus >= 10) {
      insights.push("Frequent Marcus user — high product engagement signal.");
    }
    if (totalWebsite >= 3 && sub?.plan === "free") {
      insights.push("Multiple website generations on free plan — conversion signal.");
    }
    if (insights.length === 0) {
      insights.push("No significant signals detected — user is within normal usage patterns.");
    }

    res.json({
      user: {
        id: user.id, email: user.email, name: user.name,
        country: user.country, city: user.city,
        createdAt: user.createdAt, lastSeenAt: user.lastSeenAt,
      },
      subscription: sub ?? null,
      crm: profile ?? null,
      stats: {
        totalGenerations: totalGen,
        biGenerations: totalBI,
        websiteGenerations: totalWebsite,
        chatbotGenerations: totalChatbot,
        automationGenerations: totalAutomation,
        marcusMessages: totalMarcus,
        projectCount: Number(projectCount?.cnt ?? 0),
        sessionCount: Number(sessionCount?.cnt ?? 0),
        supportTickets: Number(ticket?.cnt ?? 0),
      },
      usage,
      timeline: recentEvents,
      insights,
    });
  } catch {
    res.status(500).json({ error: "Failed to load CRM user profile" });
  }
});

// PATCH /api/admin/crm/users/:id
router.patch("/admin/crm/users/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const userId = req.params["id"] as string;
    const { lifecycleStage, tags, notes } = req.body as {
      lifecycleStage?: string;
      tags?: string[];
      notes?: string;
    };

    const allowed = ["new", "activated", "engaged", "power_user", "at_risk", "churned"];
    const updates: Record<string, unknown> = {};
    if (lifecycleStage && allowed.includes(lifecycleStage)) updates.lifecycleStage = lifecycleStage;
    if (Array.isArray(tags)) updates.tags = tags;
    if (typeof notes === "string") updates.notes = notes;

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "Nothing to update" });
      return;
    }

    const existing = await db.select({ id: crmProfilesTable.id })
      .from(crmProfilesTable).where(eq(crmProfilesTable.userId, userId)).limit(1);

    if (existing.length === 0) {
      const [user] = await db.select({ id: usersTable.id, createdAt: usersTable.createdAt })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user) { res.status(404).json({ error: "User not found" }); return; }
      await db.insert(crmProfilesTable).values({
        userId,
        lifecycleStage: (updates.lifecycleStage as string) ?? "new",
        tags: (updates.tags as string[]) ?? [],
        notes: (updates.notes as string) ?? null,
        firstSeenAt: user.createdAt,
      });
    } else {
      await db.update(crmProfilesTable).set(updates).where(eq(crmProfilesTable.userId, userId));
    }

    const [profile] = await db.select().from(crmProfilesTable).where(eq(crmProfilesTable.userId, userId)).limit(1);
    res.json({ crm: profile });
  } catch {
    res.status(500).json({ error: "Failed to update CRM profile" });
  }
});

// POST /api/admin/crm/recalculate
router.post("/admin/crm/recalculate", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const profiles = await buildAllScores();
    await upsertProfiles(profiles);
    res.json({ recalculated: profiles.length, ok: true });
  } catch (err) {
    res.status(500).json({ error: "Recalculation failed" });
  }
});

export default router;
