import { Router } from "express";
import { db, agentObjectivesTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const CreateObjectiveBody = z.object({
  agentKey: z.string().min(1),
  agentId: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  goals: z.array(z.object({ text: z.string(), weight: z.number().optional() })).optional().default([]),
  constraints: z.array(z.string()).optional().default([]),
  executionRules: z.array(z.string()).optional().default([]),
  escalationThreshold: z.number().int().min(0).max(100).optional().default(80),
});

const UpdateObjectiveBody = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  goals: z.array(z.object({ text: z.string(), weight: z.number().optional() })).optional(),
  constraints: z.array(z.string()).optional(),
  executionRules: z.array(z.string()).optional(),
  escalationThreshold: z.number().int().min(0).max(100).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  isActive: z.boolean().optional(),
});

router.get("/agents/objectives", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { agentKey } = req.query as Record<string, string>;
  const objectives = await db
    .select()
    .from(agentObjectivesTable)
    .where(eq(agentObjectivesTable.userId, userId))
    .orderBy(desc(agentObjectivesTable.createdAt));

  const filtered = agentKey
    ? objectives.filter(o => o.agentKey === agentKey)
    : objectives;

  res.json({ objectives: filtered });
});

router.post("/agents/objectives", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateObjectiveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [objective] = await db
    .insert(agentObjectivesTable)
    .values({
      userId,
      agentKey: parsed.data.agentKey,
      agentId: parsed.data.agentId,
      title: parsed.data.title,
      description: parsed.data.description,
      goals: parsed.data.goals,
      constraints: parsed.data.constraints,
      executionRules: parsed.data.executionRules,
      escalationThreshold: parsed.data.escalationThreshold,
    })
    .returning();
  res.status(201).json({ objective });
});

router.patch("/agents/objectives/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateObjectiveBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;
  if (parsed.data.goals !== undefined) updates.goals = parsed.data.goals;
  if (parsed.data.constraints !== undefined) updates.constraints = parsed.data.constraints;
  if (parsed.data.executionRules !== undefined) updates.executionRules = parsed.data.executionRules;
  if (parsed.data.escalationThreshold !== undefined) updates.escalationThreshold = parsed.data.escalationThreshold;
  if (parsed.data.progress !== undefined) updates.progress = parsed.data.progress;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

  const [objective] = await db
    .update(agentObjectivesTable)
    .set(updates)
    .where(and(eq(agentObjectivesTable.id, id), eq(agentObjectivesTable.userId, userId)))
    .returning();
  if (!objective) { res.status(404).json({ error: "Objective not found" }); return; }
  res.json({ objective });
});

router.delete("/agents/objectives/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(agentObjectivesTable)
    .where(and(eq(agentObjectivesTable.id, id), eq(agentObjectivesTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Objective not found" }); return; }
  res.sendStatus(204);
});

export default router;
