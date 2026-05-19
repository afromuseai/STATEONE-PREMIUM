import { Router } from "express";
import { db, aiMemoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const CreateMemoryBody = z.object({
  key: z.string().min(1),
  value: z.string().min(1),
  context: z.record(z.unknown()).optional().default({}),
  importance: z.number().int().min(1).max(5).optional().default(1),
  source: z.enum(["manual", "ai", "project", "workflow"]).optional().default("manual"),
});

router.get("/memory", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const memories = await db.select().from(aiMemoryTable).where(eq(aiMemoryTable.userId, userId)).orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt));
  res.json({ memories });
});

router.post("/memory", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [memory] = await db.insert(aiMemoryTable).values({
    userId,
    key: parsed.data.key,
    value: parsed.data.value,
    context: parsed.data.context,
    importance: parsed.data.importance,
    source: parsed.data.source,
  }).returning();
  res.status(201).json({ memory });
});

router.patch("/memory/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const { key, value, context, importance } = req.body as { key?: string; value?: string; context?: Record<string, unknown>; importance?: number };
  const updates: Record<string, unknown> = {};
  if (key !== undefined) updates.key = key;
  if (value !== undefined) updates.value = value;
  if (context !== undefined) updates.context = context;
  if (importance !== undefined) updates.importance = importance;
  const [memory] = await db.update(aiMemoryTable).set(updates).where(and(eq(aiMemoryTable.id, id), eq(aiMemoryTable.userId, userId))).returning();
  if (!memory) { res.status(404).json({ error: "Memory not found" }); return; }
  res.json({ memory });
});

router.delete("/memory/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db.delete(aiMemoryTable).where(and(eq(aiMemoryTable.id, id), eq(aiMemoryTable.userId, userId))).returning();
  if (!deleted) { res.status(404).json({ error: "Memory not found" }); return; }
  res.sendStatus(204);
});

router.delete("/memory", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  await db.delete(aiMemoryTable).where(eq(aiMemoryTable.userId, userId));
  res.json({ cleared: true });
});

export default router;
