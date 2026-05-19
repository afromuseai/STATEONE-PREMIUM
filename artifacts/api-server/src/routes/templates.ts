import { Router } from "express";
import { db, templatesTable } from "@workspace/db";
import { eq, and, desc, or } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";

const router = Router();

const CreateTemplateBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["startup_website", "ai_chatbot", "automation_workflow", "onboarding_system", "crm_pipeline"]),
  category: z.string().min(1),
  content: z.record(z.unknown()),
  isPublic: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  previewUrl: z.string().optional(),
});

router.get("/templates", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const mine = await db.select().from(templatesTable).where(eq(templatesTable.authorId, userId)).orderBy(desc(templatesTable.updatedAt));
  res.json({ templates: mine });
});

router.get("/templates/marketplace", requireAuth, async (_req, res): Promise<void> => {
  const templates = await db.select().from(templatesTable).where(eq(templatesTable.isPublic, true)).orderBy(desc(templatesTable.usageCount));
  res.json({ templates });
});

router.post("/templates", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTemplateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [template] = await db.insert(templatesTable).values({
    authorId: userId,
    name: parsed.data.name,
    description: parsed.data.description,
    type: parsed.data.type,
    category: parsed.data.category,
    content: parsed.data.content,
    isPublic: parsed.data.isPublic,
    tags: parsed.data.tags,
    previewUrl: parsed.data.previewUrl,
  }).returning();
  res.status(201).json({ template });
});

router.get("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [template] = await db.select().from(templatesTable).where(
    or(and(eq(templatesTable.id, id), eq(templatesTable.authorId, userId)), and(eq(templatesTable.id, id), eq(templatesTable.isPublic, true)))
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  res.json({ template });
});

router.patch("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const { name, description, isPublic, tags } = req.body as { name?: string; description?: string; isPublic?: boolean; tags?: string[] };
  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (isPublic !== undefined) updates.isPublic = isPublic;
  if (tags !== undefined) updates.tags = tags;
  const [template] = await db.update(templatesTable).set(updates).where(and(eq(templatesTable.id, id), eq(templatesTable.authorId, userId))).returning();
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  res.json({ template });
});

router.delete("/templates/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db.delete(templatesTable).where(and(eq(templatesTable.id, id), eq(templatesTable.authorId, userId))).returning();
  if (!deleted) { res.status(404).json({ error: "Template not found" }); return; }
  res.sendStatus(204);
});

router.post("/templates/:id/install", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const [template] = await db.select().from(templatesTable).where(and(eq(templatesTable.id, id), eq(templatesTable.isPublic, true)));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  await db.update(templatesTable).set({ usageCount: template.usageCount + 1 }).where(eq(templatesTable.id, id));
  res.json({ template, installed: true });
});

router.post("/templates/:id/rate", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const { rating } = req.body as { rating?: number };
  if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: "Rating must be 1-5" }); return; }
  const [template] = await db.select().from(templatesTable).where(eq(templatesTable.id, id));
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }
  const newCount = template.ratingCount + 1;
  const newRating = (template.rating * template.ratingCount + rating) / newCount;
  const [updated] = await db.update(templatesTable).set({ rating: newRating, ratingCount: newCount }).where(eq(templatesTable.id, id)).returning();
  res.json({ template: updated });
});

// Clone a template — creates a new private copy for the current user
router.post("/templates/:id/clone", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [template] = await db.select().from(templatesTable).where(
    or(
      and(eq(templatesTable.id, id), eq(templatesTable.authorId, userId)),
      and(eq(templatesTable.id, id), eq(templatesTable.isPublic, true))
    )
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  const [cloned] = await db.insert(templatesTable).values({
    authorId: userId,
    name: `${template.name} (Clone)`,
    description: template.description,
    type: template.type,
    category: template.category,
    content: template.content as Record<string, unknown>,
    isPublic: false,
    tags: template.tags ?? [],
    previewUrl: template.previewUrl ?? undefined,
  }).returning();

  res.status(201).json({ template: cloned });
});

// Share a template — returns a shareable link token (just returns the public URL if isPublic)
router.post("/templates/:id/share", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [template] = await db.select().from(templatesTable).where(
    and(eq(templatesTable.id, id), eq(templatesTable.authorId, userId))
  );
  if (!template) { res.status(404).json({ error: "Template not found" }); return; }

  if (!template.isPublic) {
    const [updated] = await db.update(templatesTable).set({ isPublic: true }).where(eq(templatesTable.id, id)).returning();
    res.json({ template: updated, shareUrl: `/templates?shared=${id}` });
    return;
  }

  res.json({ template, shareUrl: `/templates?shared=${id}` });
});

export default router;
