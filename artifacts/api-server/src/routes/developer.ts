import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { db, apiKeysTable, apiUsageLogsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";

const router = Router();

const PLAN_LIMITS: Record<string, { requestsPerMonth: number; requestsPerMinute: number }> = {
  free:       { requestsPerMonth: 100,   requestsPerMinute: 10  },
  pro:        { requestsPerMonth: 2000,  requestsPerMinute: 60  },
  enterprise: { requestsPerMonth: 50000, requestsPerMinute: 200 },
};

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const rawSuffix = randomBytes(24).toString("hex");
  const raw = `sk-stg-${rawSuffix}`;
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 14);
  return { raw, hash, prefix };
}

router.get("/developer/keys", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const keys = await db
    .select({
      id: apiKeysTable.id,
      name: apiKeysTable.name,
      keyPrefix: apiKeysTable.keyPrefix,
      plan: apiKeysTable.plan,
      requestsPerMonth: apiKeysTable.requestsPerMonth,
      requestsUsed: apiKeysTable.requestsUsed,
      requestsPerMinute: apiKeysTable.requestsPerMinute,
      isActive: apiKeysTable.isActive,
      lastUsedAt: apiKeysTable.lastUsedAt,
      createdAt: apiKeysTable.createdAt,
    })
    .from(apiKeysTable)
    .where(eq(apiKeysTable.userId, userId))
    .orderBy(desc(apiKeysTable.createdAt));
  res.json({ keys });
});

router.post("/developer/keys", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { name, plan = "free" } = req.body as { name?: string; plan?: string };

  if (!name?.trim()) {
    res.status(400).json({ error: "Key name is required" });
    return;
  }
  if (!["free", "pro", "enterprise"].includes(plan)) {
    res.status(400).json({ error: "Invalid plan" });
    return;
  }

  const existingKeys = await db
    .select({ id: apiKeysTable.id })
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.userId, userId), eq(apiKeysTable.isActive, true)));

  if (existingKeys.length >= 10) {
    res.status(400).json({ error: "Maximum of 10 active API keys allowed" });
    return;
  }

  const { raw, hash, prefix } = generateApiKey();
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

  const [key] = await db
    .insert(apiKeysTable)
    .values({
      userId,
      name: name.trim(),
      keyHash: hash,
      keyPrefix: prefix,
      plan,
      requestsPerMonth: limits.requestsPerMonth,
      requestsPerMinute: limits.requestsPerMinute,
    })
    .returning();

  res.status(201).json({
    key: {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      plan: key.plan,
      requestsPerMonth: key.requestsPerMonth,
      requestsUsed: key.requestsUsed,
      requestsPerMinute: key.requestsPerMinute,
      isActive: key.isActive,
      createdAt: key.createdAt,
    },
    rawKey: raw,
    warning: "Store this key securely — it will not be shown again.",
  });
});

router.delete("/developer/keys/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const id = req.params.id as string;

  const [revoked] = await db
    .update(apiKeysTable)
    .set({ isActive: false })
    .where(and(eq(apiKeysTable.id, id), eq(apiKeysTable.userId, userId)))
    .returning();

  if (!revoked) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  res.json({ success: true, message: "API key revoked" });
});

router.get("/developer/usage", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const logs = await db
    .select()
    .from(apiUsageLogsTable)
    .where(eq(apiUsageLogsTable.userId, userId))
    .orderBy(desc(apiUsageLogsTable.createdAt))
    .limit(100);

  const byEndpoint = await db
    .select({
      endpoint: apiUsageLogsTable.endpoint,
      count: sql<number>`count(*)::int`,
    })
    .from(apiUsageLogsTable)
    .where(eq(apiUsageLogsTable.userId, userId))
    .groupBy(apiUsageLogsTable.endpoint);

  res.json({ logs, byEndpoint });
});

export default router;
