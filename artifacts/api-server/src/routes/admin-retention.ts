import { Router } from "express";
import { db, usersTable, eventsTable, subscriptionsTable } from "@workspace/db";
import { desc, gte, sql } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// ── GET /admin/retention ───────────────────────────────────────────────────────
// Returns:
//   - Daily Active Users for the past 30 days
//   - D7 / D30 retention by signup week cohort (last 8 cohorts)
//   - Monthly signup counts
router.get("/admin/retention", requireAdmin, async (req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  // ── 1. Daily Active Users (last 30 days) ──────────────────────────────────
  const rawEvents = await db
    .select({
      userId: eventsTable.userId,
      createdAt: eventsTable.createdAt,
    })
    .from(eventsTable)
    .where(gte(eventsTable.createdAt, thirtyDaysAgo));

  const dauMap = new Map<string, Set<string>>(); // date → Set<userId>
  for (const e of rawEvents) {
    if (!e.userId || !e.createdAt) continue;
    const day = e.createdAt.toISOString().slice(0, 10);
    if (!dauMap.has(day)) dauMap.set(day, new Set());
    dauMap.get(day)!.add(e.userId);
  }

  const dailyActiveUsers = Array.from(dauMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, users]) => ({ date, count: users.size }));

  // ── 2. All users with signup date (for cohort analysis) ───────────────────
  const allUsers = await db
    .select({ id: usersTable.id, createdAt: usersTable.createdAt })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(5000);

  // ── 3. All events for retention checking ─────────────────────────────────
  const allEvents = await db
    .select({ userId: eventsTable.userId, createdAt: eventsTable.createdAt })
    .from(eventsTable)
    .where(gte(eventsTable.createdAt, sixtyDaysAgo));

  // Build userId → sorted event timestamps map
  const userEventDates = new Map<string, number[]>();
  for (const e of allEvents) {
    if (!e.userId || !e.createdAt) continue;
    const ts = e.createdAt.getTime();
    if (!userEventDates.has(e.userId)) userEventDates.set(e.userId, []);
    userEventDates.get(e.userId)!.push(ts);
  }

  // ── 4. Build weekly cohorts ───────────────────────────────────────────────
  function getWeekStart(d: Date): string {
    const day = d.getDay(); // 0 = Sun
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Mon
    const mon = new Date(d);
    mon.setDate(diff);
    return mon.toISOString().slice(0, 10);
  }

  const cohortMap = new Map<
    string,
    { total: number; retained7: number; retained30: number }
  >();

  for (const user of allUsers) {
    if (!user.createdAt) continue;
    const week = getWeekStart(user.createdAt);
    if (!cohortMap.has(week)) cohortMap.set(week, { total: 0, retained7: 0, retained30: 0 });
    const cohort = cohortMap.get(week)!;
    cohort.total++;

    const signupTs = user.createdAt.getTime();
    const userEvents = userEventDates.get(user.id) ?? [];

    const d7cutoff = signupTs + 7 * 24 * 60 * 60 * 1000;
    const d30cutoff = signupTs + 30 * 24 * 60 * 60 * 1000;

    if (userEvents.some(ts => ts > signupTs && ts <= d7cutoff)) {
      cohort.retained7++;
    }
    if (userEvents.some(ts => ts > signupTs && ts <= d30cutoff)) {
      cohort.retained30++;
    }
  }

  const weeklyCohorts = Array.from(cohortMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8)
    .map(([week, data]) => ({
      week,
      total: data.total,
      retained7: data.retained7,
      retained30: data.retained30,
      d7Rate: data.total > 0 ? Math.round((data.retained7 / data.total) * 100) : 0,
      d30Rate: data.total > 0 ? Math.round((data.retained30 / data.total) * 100) : 0,
    }));

  // ── 5. Monthly signups ────────────────────────────────────────────────────
  const monthlySignups: Record<string, number> = {};
  for (const user of allUsers) {
    if (!user.createdAt) continue;
    const month = user.createdAt.toISOString().slice(0, 7);
    monthlySignups[month] = (monthlySignups[month] ?? 0) + 1;
  }

  const monthlySignupsArr = Object.entries(monthlySignups)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => ({ month, count }));

  // ── 6. Plan distribution (for paid conversion insight) ───────────────────
  const subs = await db
    .select({ plan: subscriptionsTable.plan })
    .from(subscriptionsTable);

  const planCounts: Record<string, number> = {};
  for (const s of subs) {
    planCounts[s.plan] = (planCounts[s.plan] ?? 0) + 1;
  }
  const conversionRate =
    subs.length > 0
      ? Math.round(((subs.length - (planCounts["free"] ?? 0)) / subs.length) * 100)
      : 0;

  res.json({
    dailyActiveUsers,
    weeklyCohorts,
    monthlySignups: monthlySignupsArr,
    planCounts,
    conversionRate,
    totalUsers: allUsers.length,
  });
});

export default router;
