import { Router } from "express";
import { db, subscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

export const PLAN_LIMITS = {
  free:       { aiGenerationsLimit: 5,    deploymentsLimit: 2,    workspacesLimit: 1 },
  pro:        { aiGenerationsLimit: 100,  deploymentsLimit: 20,   workspacesLimit: 5 },
  startup:    { aiGenerationsLimit: 500,  deploymentsLimit: 100,  workspacesLimit: 20 },
  enterprise: { aiGenerationsLimit: 9999, deploymentsLimit: 9999, workspacesLimit: 9999 },
};

export async function getOrCreateSubscription(userId: string) {
  const [existing] = await db.select().from(subscriptionsTable).where(eq(subscriptionsTable.userId, userId));
  if (existing) return existing;
  const [created] = await db.insert(subscriptionsTable).values({ userId }).returning();
  return created;
}

router.get("/subscriptions/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const sub = await getOrCreateSubscription(userId);
  res.json({ subscription: sub });
});

router.patch("/subscriptions/me", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { plan } = req.body as { plan?: string };
  if (!plan || !["free", "pro", "startup", "enterprise"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS];
  const periodEnd = new Date();
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  const [sub] = await db
    .update(subscriptionsTable)
    .set({ plan, ...limits, currentPeriodStart: new Date(), currentPeriodEnd: periodEnd, aiGenerationsUsed: 0, deploymentsUsed: 0 })
    .where(eq(subscriptionsTable.userId, userId))
    .returning();
  if (!sub) {
    res.status(404).json({ error: "Subscription not found" });
    return;
  }
  res.json({ subscription: sub });
});

router.post("/subscriptions/increment-usage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.isAdmin ?? false;
  const { field } = req.body as { field?: string };
  if (!field || !["aiGenerationsUsed", "deploymentsUsed", "workspacesUsed"].includes(field)) {
    res.status(400).json({ error: "Invalid field" });
    return;
  }
  const sub = await getOrCreateSubscription(userId);

  if (!isAdmin) {
    const limitMap: Record<string, { used: number; limit: number }> = {
      aiGenerationsUsed: { used: sub.aiGenerationsUsed, limit: sub.aiGenerationsLimit },
      deploymentsUsed:   { used: sub.deploymentsUsed,   limit: sub.deploymentsLimit },
      workspacesUsed:    { used: sub.workspacesUsed,    limit: sub.workspacesLimit },
    };
    const { used, limit } = limitMap[field];
    if (used >= limit) {
      res.status(429).json({
        error: "Usage limit reached",
        field,
        used,
        limit,
        plan: sub.plan,
      });
      return;
    }
  }

  const colMap: Record<string, keyof typeof sub> = {
    aiGenerationsUsed: "aiGenerationsUsed",
    deploymentsUsed: "deploymentsUsed",
    workspacesUsed: "workspacesUsed",
  };
  const col = colMap[field];
  const [updated] = await db
    .update(subscriptionsTable)
    .set({ [col]: (sub[col] as number) + 1 })
    .where(eq(subscriptionsTable.userId, userId))
    .returning();
  res.json({ subscription: updated });
});

router.get("/subscriptions/check-limit", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const isAdmin = req.user!.isAdmin ?? false;

  if (isAdmin) {
    res.json({ allowed: true, isAdmin: true });
    return;
  }

  const sub = await getOrCreateSubscription(userId);
  const allowed = sub.aiGenerationsUsed < sub.aiGenerationsLimit;
  res.json({
    allowed,
    used: sub.aiGenerationsUsed,
    limit: sub.aiGenerationsLimit,
    plan: sub.plan,
  });
});

export default router;
