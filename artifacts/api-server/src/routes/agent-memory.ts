import { Router } from "express";
import { db, agentMemoryTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const CreateMemoryBody = z.object({
  agentKey: z.string().min(1),
  memoryType: z.enum(["context", "long-term", "shared"]).optional().default("context"),
  key: z.string().min(1),
  value: z.string().min(1),
  metadata: z.record(z.unknown()).optional().default({}),
  importance: z.number().int().min(1).max(10).optional().default(5),
  isShared: z.boolean().optional().default(false),
  sharedWithAgents: z.array(z.string()).optional().default([]),
});

const UpdateMemoryBody = z.object({
  value: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  importance: z.number().int().min(1).max(10).optional(),
  isShared: z.boolean().optional(),
  sharedWithAgents: z.array(z.string()).optional(),
});

router.get("/agents/memory", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { agentKey, memoryType } = req.query as Record<string, string>;
  const memories = await db
    .select()
    .from(agentMemoryTable)
    .where(eq(agentMemoryTable.userId, userId))
    .orderBy(desc(agentMemoryTable.importance), desc(agentMemoryTable.createdAt));

  const filtered = memories.filter(m => {
    if (agentKey && m.agentKey !== agentKey && !m.sharedWithAgents?.includes(agentKey)) return false;
    if (memoryType && m.memoryType !== memoryType) return false;
    return true;
  });

  res.json({ memories: filtered });
});

router.post("/agents/memory", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [memory] = await db
    .insert(agentMemoryTable)
    .values({ userId, ...parsed.data })
    .returning();
  res.status(201).json({ memory });
});

router.patch("/agents/memory/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateMemoryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.value !== undefined) updates.value = parsed.data.value;
  if (parsed.data.metadata !== undefined) updates.metadata = parsed.data.metadata;
  if (parsed.data.importance !== undefined) updates.importance = parsed.data.importance;
  if (parsed.data.isShared !== undefined) updates.isShared = parsed.data.isShared;
  if (parsed.data.sharedWithAgents !== undefined) updates.sharedWithAgents = parsed.data.sharedWithAgents;

  const [memory] = await db
    .update(agentMemoryTable)
    .set(updates)
    .where(and(eq(agentMemoryTable.id, id), eq(agentMemoryTable.userId, userId)))
    .returning();
  if (!memory) { res.status(404).json({ error: "Memory not found" }); return; }
  res.json({ memory });
});

router.delete("/agents/memory/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(agentMemoryTable)
    .where(and(eq(agentMemoryTable.id, id), eq(agentMemoryTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Memory not found" }); return; }
  res.sendStatus(204);
});

export default router;
