import { Router } from "express";
import { db, integrationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const ConnectBody = z.object({
  provider: z.string().min(1),
  displayName: z.string().min(1),
  config: z.record(z.unknown()).optional(),
});

router.get("/integrations", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const integrations = await db
    .select()
    .from(integrationsTable)
    .where(eq(integrationsTable.userId, userId));
  res.json({ integrations });
});

router.post("/integrations", requireAuth, async (req, res): Promise<void> => {
  const parsed = ConnectBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;

  const [existing] = await db
    .select()
    .from(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, parsed.data.provider)));

  if (existing) {
    const [updated] = await db
      .update(integrationsTable)
      .set({ status: "connected", updatedAt: new Date() })
      .where(eq(integrationsTable.id, existing.id))
      .returning();
    res.json({ integration: updated });
    return;
  }

  const [integration] = await db
    .insert(integrationsTable)
    .values({
      userId,
      provider: parsed.data.provider,
      displayName: parsed.data.displayName,
      status: "connected",
      config: parsed.data.config ?? {},
    })
    .returning();

  res.status(201).json({ integration });
});

router.delete("/integrations/:provider", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const provider = req.params.provider as string;
  await db
    .delete(integrationsTable)
    .where(and(eq(integrationsTable.userId, userId), eq(integrationsTable.provider, provider)));
  res.json({ ok: true });
});

export default router;
