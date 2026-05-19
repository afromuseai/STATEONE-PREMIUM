import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, subscriptionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { PLAN_LIMITS, getOrCreateSubscription } from "./subscriptions";

const router = Router();

router.get("/admin/users", requireAdmin, async (_req, res): Promise<void> => {
  const users = await db
    .select({
      id: usersTable.id,
      email: usersTable.email,
      name: usersTable.name,
      isAdmin: usersTable.isAdmin,
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

export default router;
