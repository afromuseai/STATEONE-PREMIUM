import { Router } from "express";
import { db, usersTable, subscriptionsTable, sessionsTable, waitlistTable, acquisitionProfilesTable, acquisitionEventsTable, billingSubscriptionsTable } from "@workspace/db";
import { eq, desc, count, sql, and, gte, isNotNull } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(v: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(v)));
}

function computeConversionScore(p: {
  status: string;
  referralCode: string | null;
  referredBy: string | null;
  createdAt: Date;
  invitedAt: Date | null;
  signedUpAt: Date | null;
  convertedAt: Date | null;
  sessionCount?: number;
  referralCount?: number;
}): number {
  let score = 0;
  const now = Date.now();
  const ageDays = (now - p.createdAt.getTime()) / 86400000;

  // Conversion funnel progress
  if (p.status === "converted") return 100;
  if (p.status === "signed_up") score += 60;
  else if (p.status === "invited") score += 30;
  else score += 10;

  // Referral boost
  if (p.referralCode) score += 10;
  if (p.referredBy) score += 15;
  if ((p.referralCount ?? 0) > 0) score += Math.min((p.referralCount ?? 0) * 5, 20);

  // Engagement
  if ((p.sessionCount ?? 0) > 0) score += Math.min((p.sessionCount ?? 0) * 3, 15);

  // Recency (newer = more likely to convert)
  if (ageDays <= 7) score += 10;
  else if (ageDays <= 30) score += 5;
  else if (ageDays > 90) score -= 10;

  return clamp(score);
}

// ─── Sync helper: build acquisition profiles from existing users + waitlist ───

async function syncProfiles() {
  // Sync from waitlist
  const waitlistEntries = await db.select().from(waitlistTable);
  for (const w of waitlistEntries) {
    const existing = await db.select({ id: acquisitionProfilesTable.id })
      .from(acquisitionProfilesTable).where(eq(acquisitionProfilesTable.email, w.email)).limit(1);
    if (existing.length === 0) {
      // Check if signed up as user
      const [user] = await db.select({ id: usersTable.id, createdAt: usersTable.createdAt })
        .from(usersTable).where(eq(usersTable.email, w.email)).limit(1);
      await db.insert(acquisitionProfilesTable).values({
        email: w.email,
        name: w.name,
        source: (w as any).source ?? "direct",
        status: user ? "signed_up" : "waitlisted",
        waitlistEntryId: w.id,
        userId: user?.id ?? null,
        signedUpAt: user?.createdAt ?? null,
        conversionScore: 0,
      });
    }
  }

  // Sync signed-up users who aren't in acquisition yet
  const users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, createdAt: usersTable.createdAt }).from(usersTable);
  for (const u of users) {
    const existing = await db.select({ id: acquisitionProfilesTable.id })
      .from(acquisitionProfilesTable).where(eq(acquisitionProfilesTable.email, u.email)).limit(1);
    if (existing.length === 0) {
      // Check paid
      const [billing] = await db.select({ id: billingSubscriptionsTable.id })
        .from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, u.id)).limit(1);
      await db.insert(acquisitionProfilesTable).values({
        email: u.email,
        name: u.name,
        source: "direct",
        status: billing ? "converted" : "signed_up",
        userId: u.id,
        signedUpAt: u.createdAt,
        convertedAt: billing ? u.createdAt : null,
        conversionScore: billing ? 100 : 60,
      });
    } else {
      // Update status to at least signed_up
      const prof = existing[0];
      const [billing] = await db.select({ id: billingSubscriptionsTable.id })
        .from(billingSubscriptionsTable).where(eq(billingSubscriptionsTable.userId, u.id)).limit(1);
      await db.update(acquisitionProfilesTable).set({
        userId: u.id,
        status: billing ? "converted" : "signed_up",
        signedUpAt: u.createdAt,
        convertedAt: billing ? u.createdAt : null,
      }).where(eq(acquisitionProfilesTable.id, prof.id));
    }
  }
}

async function recalculateScores() {
  const profiles = await db.select().from(acquisitionProfilesTable);
  const referralCounts = new Map<string, number>();
  for (const p of profiles) {
    if (p.referralCode) {
      // Count how many others were referred by this code
      const [{ cnt }] = await db.select({ cnt: count() }).from(acquisitionProfilesTable)
        .where(eq(acquisitionProfilesTable.referredBy, p.email));
      referralCounts.set(p.id, Number(cnt));
    }
  }
  for (const p of profiles) {
    let sessionCount = 0;
    if (p.userId) {
      const [r] = await db.select({ cnt: count() }).from(sessionsTable).where(eq(sessionsTable.userId, p.userId));
      sessionCount = Number(r?.cnt ?? 0);
    }
    const score = computeConversionScore({
      status: p.status,
      referralCode: p.referralCode,
      referredBy: p.referredBy,
      createdAt: p.createdAt,
      invitedAt: p.invitedAt,
      signedUpAt: p.signedUpAt,
      convertedAt: p.convertedAt,
      sessionCount,
      referralCount: referralCounts.get(p.id) ?? 0,
    });
    await db.update(acquisitionProfilesTable).set({ conversionScore: score }).where(eq(acquisitionProfilesTable.id, p.id));
  }
}

// ─── GET /api/admin/acquisition/overview ─────────────────────────────────────

router.get("/admin/acquisition/overview", requireAdmin, async (_req, res): Promise<void> => {
  try {
    await syncProfiles();
    const stageCounts = await db.select({ status: acquisitionProfilesTable.status, cnt: count() })
      .from(acquisitionProfilesTable).groupBy(acquisitionProfilesTable.status);
    const map: Record<string, number> = {};
    for (const r of stageCounts) map[r.status] = Number(r.cnt);

    const [totalRow] = await db.select({ cnt: count() }).from(acquisitionProfilesTable);
    const total = Number(totalRow?.cnt ?? 0);
    const waitlisted = map["waitlisted"] ?? 0;
    const invited = map["invited"] ?? 0;
    const signedUp = map["signed_up"] ?? 0;
    const converted = map["converted"] ?? 0;

    const conversionRate = total > 0 ? Math.round((converted / total) * 100) : 0;
    const signupRate = waitlisted + invited > 0 ? Math.round((signedUp + converted) / (waitlisted + invited + signedUp + converted) * 100) : 0;

    res.json({ total, waitlisted, invited, signedUp, converted, conversionRate, signupRate });
  } catch {
    res.status(500).json({ error: "Failed to load overview" });
  }
});

// ─── GET /api/admin/acquisition/sources ───────────────────────────────────────

router.get("/admin/acquisition/sources", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const rows = await db.select({
      source: acquisitionProfilesTable.source,
      cnt: count(),
    }).from(acquisitionProfilesTable).groupBy(acquisitionProfilesTable.source).orderBy(desc(count()));

    const converted = await db.select({
      source: acquisitionProfilesTable.source,
      cnt: count(),
    }).from(acquisitionProfilesTable)
      .where(eq(acquisitionProfilesTable.status, "converted"))
      .groupBy(acquisitionProfilesTable.source);
    const convMap = new Map(converted.map(r => [r.source, Number(r.cnt)]));

    const signedUp = await db.select({
      source: acquisitionProfilesTable.source,
      cnt: count(),
    }).from(acquisitionProfilesTable)
      .where(sql`${acquisitionProfilesTable.status} in ('signed_up', 'converted')`)
      .groupBy(acquisitionProfilesTable.source);
    const signupMap = new Map(signedUp.map(r => [r.source, Number(r.cnt)]));

    const sources = rows.map(r => ({
      source: r.source ?? "direct",
      total: Number(r.cnt),
      signedUp: signupMap.get(r.source ?? "direct") ?? 0,
      converted: convMap.get(r.source ?? "direct") ?? 0,
    }));

    res.json({ sources });
  } catch {
    res.status(500).json({ error: "Failed to load sources" });
  }
});

// ─── GET /api/admin/acquisition/funnel ────────────────────────────────────────

router.get("/admin/acquisition/funnel", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const [totalUsersRow] = await db.select({ cnt: count() }).from(usersTable);
    const totalUsers = Number(totalUsersRow?.cnt ?? 0);

    const stageCounts = await db.select({ status: acquisitionProfilesTable.status, cnt: count() })
      .from(acquisitionProfilesTable).groupBy(acquisitionProfilesTable.status);
    const map: Record<string, number> = {};
    for (const r of stageCounts) map[r.status] = Number(r.cnt);

    const [totalWaitlistRow] = await db.select({ cnt: count() }).from(waitlistTable);
    const totalWaitlist = Number(totalWaitlistRow?.cnt ?? 0);

    const [totalBillingRow] = await db.select({ cnt: count() }).from(billingSubscriptionsTable);
    const totalPaid = Number(totalBillingRow?.cnt ?? 0);

    // Funnel stages
    const landing = Math.max(totalUsers + totalWaitlist, totalUsers);
    const waitlisted = totalWaitlist;
    const signedUp = totalUsers;
    const paid = totalPaid;

    const pct = (n: number, of: number) => of > 0 ? Math.round((n / of) * 100) : 0;

    res.json({
      stages: [
        { stage: "Landing / Awareness", count: landing, pct: 100, dropOff: 0 },
        { stage: "Waitlist Join", count: waitlisted, pct: pct(waitlisted, landing), dropOff: 100 - pct(waitlisted, landing) },
        { stage: "Signed Up", count: signedUp, pct: pct(signedUp, landing), dropOff: pct(waitlisted, landing) - pct(signedUp, landing) },
        { stage: "Paid / Converted", count: paid, pct: pct(paid, landing), dropOff: pct(signedUp, landing) - pct(paid, landing) },
      ],
    });
  } catch {
    res.status(500).json({ error: "Failed to load funnel" });
  }
});

// ─── GET /api/admin/acquisition/referrals ────────────────────────────────────

router.get("/admin/acquisition/referrals", requireAdmin, async (_req, res): Promise<void> => {
  try {
    // Group by referredBy field to find top referrers
    const rows = await db.select({
      referredBy: acquisitionProfilesTable.referredBy,
      total: count(),
    }).from(acquisitionProfilesTable)
      .where(isNotNull(acquisitionProfilesTable.referredBy))
      .groupBy(acquisitionProfilesTable.referredBy)
      .orderBy(desc(count()))
      .limit(20);

    const referrers = await Promise.all(rows.map(async r => {
      const [signedUpRow] = await db.select({ cnt: count() }).from(acquisitionProfilesTable).where(
        and(eq(acquisitionProfilesTable.referredBy, r.referredBy!),
          sql`${acquisitionProfilesTable.status} in ('signed_up', 'converted')`)
      );
      const [convertedRow] = await db.select({ cnt: count() }).from(acquisitionProfilesTable).where(
        and(eq(acquisitionProfilesTable.referredBy, r.referredBy!), eq(acquisitionProfilesTable.status, "converted"))
      );
      return {
        email: r.referredBy,
        referralCount: Number(r.total),
        signupCount: Number(signedUpRow?.cnt ?? 0),
        conversionCount: Number(convertedRow?.cnt ?? 0),
      };
    }));

    res.json({ referrers });
  } catch {
    res.status(500).json({ error: "Failed to load referrals" });
  }
});

// ─── GET /api/admin/acquisition/users ────────────────────────────────────────

router.get("/admin/acquisition/users", requireAdmin, async (req, res): Promise<void> => {
  try {
    const { status, source, search } = req.query as Record<string, string>;
    let profiles = await db.select().from(acquisitionProfilesTable).orderBy(desc(acquisitionProfilesTable.createdAt));

    if (status && status !== "all") profiles = profiles.filter(p => p.status === status);
    if (source && source !== "all") profiles = profiles.filter(p => p.source === source);
    if (search) {
      const q = search.toLowerCase();
      profiles = profiles.filter(p => p.email.toLowerCase().includes(q) || (p.name ?? "").toLowerCase().includes(q));
    }

    res.json({ users: profiles, total: profiles.length });
  } catch {
    res.status(500).json({ error: "Failed to load users" });
  }
});

// ─── PATCH /api/admin/acquisition/users/:id ──────────────────────────────────

router.patch("/admin/acquisition/users/:id", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = req.params["id"] as string;
    const { status, notes, source, name, company } = req.body as Record<string, string>;
    const updates: Record<string, unknown> = {};
    const allowed = ["waitlisted", "invited", "signed_up", "converted"];
    if (status && allowed.includes(status)) {
      updates.status = status;
      if (status === "invited") updates.invitedAt = new Date();
      if (status === "converted") updates.convertedAt = new Date();
    }
    if (typeof notes === "string") updates.notes = notes;
    if (typeof source === "string") updates.source = source;
    if (typeof name === "string") updates.name = name;
    if (typeof company === "string") updates.company = company;

    if (Object.keys(updates).length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }
    const [updated] = await db.update(acquisitionProfilesTable).set(updates).where(eq(acquisitionProfilesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Profile not found" }); return; }
    res.json({ profile: updated });
  } catch {
    res.status(500).json({ error: "Failed to update" });
  }
});

// ─── POST /api/admin/acquisition/users/:id/invite ────────────────────────────

router.post("/admin/acquisition/users/:id/invite", requireAdmin, async (req, res): Promise<void> => {
  try {
    const id = req.params["id"] as string;
    const [updated] = await db.update(acquisitionProfilesTable)
      .set({ status: "invited", invitedAt: new Date() })
      .where(eq(acquisitionProfilesTable.id, id))
      .returning();
    if (!updated) { res.status(404).json({ error: "Profile not found" }); return; }
    // Log acquisition event
    await db.insert(acquisitionEventsTable).values({
      acquisitionProfileId: id,
      userId: updated.userId ?? undefined,
      eventType: "invite_sent",
      source: updated.source ?? "admin",
    });
    res.json({ profile: updated });
  } catch {
    res.status(500).json({ error: "Failed to invite" });
  }
});

// ─── POST /api/admin/acquisition/sync ────────────────────────────────────────

router.post("/admin/acquisition/sync", requireAdmin, async (_req, res): Promise<void> => {
  try {
    await syncProfiles();
    await recalculateScores();
    const [{ cnt }] = await db.select({ cnt: count() }).from(acquisitionProfilesTable);
    res.json({ synced: Number(cnt), ok: true });
  } catch {
    res.status(500).json({ error: "Sync failed" });
  }
});

// ─── GET /api/admin/acquisition/export ───────────────────────────────────────

router.get("/admin/acquisition/export", requireAdmin, async (_req, res): Promise<void> => {
  try {
    const profiles = await db.select().from(acquisitionProfilesTable).orderBy(desc(acquisitionProfilesTable.createdAt));
    const headers = ["Email", "Name", "Company", "Source", "Status", "Conversion Score", "Referred By", "Referral Code", "Invited At", "Signed Up At", "Converted At", "Created At"];
    const rows = profiles.map(p => [
      p.email, p.name ?? "", p.company ?? "", p.source, p.status,
      String(p.conversionScore), p.referredBy ?? "", p.referralCode ?? "",
      p.invitedAt?.toISOString() ?? "", p.signedUpAt?.toISOString() ?? "",
      p.convertedAt?.toISOString() ?? "", p.createdAt.toISOString(),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="acquisition-${Date.now()}.csv"`);
    res.send(csv);
  } catch {
    res.status(500).json({ error: "Export failed" });
  }
});

export default router;
