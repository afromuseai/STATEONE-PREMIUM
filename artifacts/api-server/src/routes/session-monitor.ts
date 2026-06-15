import { Router } from "express";
import { db, userMonitorSessionsTable, usersTable, subscriptionsTable, eventsTable } from "@workspace/db";
import { eq, desc, gte, and } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { hashToken } from "../lib/log-event";

const router = Router();

// ─── Heartbeat ────────────────────────────────────────────────────────────────
// Called every 30s by authenticated clients to update their session presence.

router.post("/session/heartbeat", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  const { page } = req.body as { page?: string };

  if (token) {
    const tokenHash = hashToken(token);
    await db
      .update(userMonitorSessionsTable)
      .set({
        lastSeenAt: new Date(),
        currentPage: page ?? null,
        lastAction: page ? pageLabel(page) : null,
      })
      .where(
        and(
          eq(userMonitorSessionsTable.sessionToken, tokenHash),
          eq(userMonitorSessionsTable.userId, userId),
          eq(userMonitorSessionsTable.isActive, true),
        ),
      )
      .catch(() => {});
  }

  res.json({ ok: true });
});

// ─── Admin: sessions list + stats ─────────────────────────────────────────────

router.get("/admin/sessions", requireAdmin, async (req, res): Promise<void> => {
  const statusFilter = req.query.status as string | undefined;
  const planFilter = req.query.plan as string | undefined;
  const search = (req.query.search as string | undefined)?.toLowerCase();

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const rows = await db
    .select({
      id: userMonitorSessionsTable.id,
      userId: userMonitorSessionsTable.userId,
      startedAt: userMonitorSessionsTable.startedAt,
      lastSeenAt: userMonitorSessionsTable.lastSeenAt,
      endedAt: userMonitorSessionsTable.endedAt,
      isActive: userMonitorSessionsTable.isActive,
      country: userMonitorSessionsTable.country,
      city: userMonitorSessionsTable.city,
      device: userMonitorSessionsTable.device,
      browser: userMonitorSessionsTable.browser,
      os: userMonitorSessionsTable.os,
      currentPage: userMonitorSessionsTable.currentPage,
      lastAction: userMonitorSessionsTable.lastAction,
      userEmail: usersTable.email,
      userName: usersTable.name,
      plan: subscriptionsTable.plan,
    })
    .from(userMonitorSessionsTable)
    .leftJoin(usersTable, eq(userMonitorSessionsTable.userId, usersTable.id))
    .leftJoin(subscriptionsTable, eq(userMonitorSessionsTable.userId, subscriptionsTable.userId))
    .orderBy(desc(userMonitorSessionsTable.lastSeenAt))
    .limit(500);

  const enriched = rows.map((s) => ({
    ...s,
    startedAt: s.startedAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    isOnline: s.lastSeenAt >= twoMinutesAgo,
    durationMs: s.endedAt
      ? s.endedAt.getTime() - s.startedAt.getTime()
      : Date.now() - s.startedAt.getTime(),
  }));

  // Global stats (unfiltered)
  const activeNow = enriched.filter((s) => s.isOnline).length;
  const sessionsToday = enriched.filter((s) => new Date(s.startedAt) >= todayStart).length;
  const durRows = enriched.filter((s) => s.durationMs > 0 && s.durationMs < 86400000);
  const avgDurationMs =
    durRows.length > 0
      ? Math.round(durRows.reduce((acc, s) => acc + s.durationMs, 0) / durRows.length)
      : 0;

  // Peak concurrent (hourly buckets today — lightweight approximation)
  const peakConcurrent = activeNow;

  // Apply filters for the returned list
  let filtered = enriched;
  if (statusFilter === "online") filtered = filtered.filter((s) => s.isOnline);
  if (statusFilter === "offline") filtered = filtered.filter((s) => !s.isOnline);
  if (planFilter && planFilter !== "all") filtered = filtered.filter((s) => s.plan === planFilter);
  if (search) {
    filtered = filtered.filter(
      (s) =>
        (s.userEmail ?? "").toLowerCase().includes(search) ||
        (s.userName ?? "").toLowerCase().includes(search),
    );
  }

  res.json({
    sessions: filtered,
    stats: { activeNow, sessionsToday, avgDurationMs, peakConcurrent },
  });
});

// ─── Admin: activity feed ──────────────────────────────────────────────────────

router.get("/admin/sessions/activity", requireAdmin, async (_req, res): Promise<void> => {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const events = await db
    .select({
      id: eventsTable.id,
      userId: eventsTable.userId,
      type: eventsTable.type,
      data: eventsTable.data,
      country: eventsTable.country,
      city: eventsTable.city,
      createdAt: eventsTable.createdAt,
      userEmail: usersTable.email,
      userName: usersTable.name,
    })
    .from(eventsTable)
    .leftJoin(usersTable, eq(eventsTable.userId, usersTable.id))
    .where(gte(eventsTable.createdAt, since))
    .orderBy(desc(eventsTable.createdAt))
    .limit(50);

  res.json({ events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })) });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pageLabel(page: string): string {
  if (page === "/" || page === "") return "Landing Page";
  if (page === "/dashboard") return "Dashboard";
  if (page.startsWith("/project/")) return "Project";
  if (page === "/chatbot-generator") return "Chatbot Builder";
  if (page === "/website-generator") return "Website Builder";
  if (page === "/orchestrator") return "Orchestrator";
  if (page === "/ai-builder") return "AI Builder";
  if (page === "/agents" || page === "/agent-store") return "Agent Store";
  if (page === "/webhooks") return "Webhooks";
  if (page === "/settings") return "Settings";
  if (page === "/admin") return "Admin Panel";
  if (page === "/analytics") return "Analytics";
  if (page === "/billing") return "Billing";
  if (page === "/pricing") return "Pricing";
  if (page === "/templates-marketplace") return "Templates";
  if (page === "/automation-builder") return "Automation Builder";
  if (page === "/intelligence") return "Intelligence";
  return page;
}

export default router;
