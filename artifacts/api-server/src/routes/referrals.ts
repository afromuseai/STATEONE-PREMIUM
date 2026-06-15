import { Router } from "express";
import { db, usersTable, referralsTable, subscriptionsTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

// ── GET /referrals/me ──────────────────────────────────────────────────────────
// Returns the calling user's referral code, shareable link, and referral stats.
router.get("/referrals/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const [user] = await db
    .select({ referralCode: usersTable.referralCode })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const [{ value: referralCount }] = await db
    .select({ value: count() })
    .from(referralsTable)
    .where(eq(referralsTable.referrerId, userId));

  const totalBonus = (referralCount ?? 0) * 5;
  const origin = process.env.APP_URL ?? `https://${process.env.REPLIT_DEV_DOMAIN ?? "app.stageone.ai"}`;
  const referralLink = `${origin}/signup?ref=${user.referralCode}`;

  res.json({
    referralCode: user.referralCode,
    referralLink,
    referralCount: referralCount ?? 0,
    totalBonusGenerations: totalBonus,
  });
});

// ── GET /referrals/leaderboard ─────────────────────────────────────────────────
// Top 10 referrers (public, unauthenticated)
router.get("/referrals/leaderboard", async (req, res): Promise<void> => {
  const rows = await db
    .select({
      referrerId: referralsTable.referrerId,
      referralCount: count(),
    })
    .from(referralsTable)
    .groupBy(referralsTable.referrerId)
    .orderBy(count())
    .limit(10);

  res.json({ leaderboard: rows });
});

export default router;
