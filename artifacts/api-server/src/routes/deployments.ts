import { Router } from "express";
import { db, deploymentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { fireWebhooks } from "./webhooks";

const router = Router();

const CreateDeploymentBody = z.object({
  name: z.string().min(1),
  type: z.enum(["website", "chatbot", "workflow", "slack", "discord", "whatsapp"]),
  provider: z.string().optional().default("vercel"),
  projectId: z.string().uuid().optional(),
  domain: z.string().optional(),
  environment: z.enum(["production", "staging", "preview"]).optional().default("production"),
});

const UpdateDeploymentBody = z.object({
  status: z.enum(["active", "pending", "failed", "stopped", "deploying"]).optional(),
  url: z.string().optional(),
  domain: z.string().optional(),
  logs: z.array(z.record(z.unknown())).optional(),
});

router.get("/deployments", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const deployments = await db.select().from(deploymentsTable).where(eq(deploymentsTable.userId, userId)).orderBy(desc(deploymentsTable.updatedAt));
  res.json({ deployments });
});

router.post("/deployments", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateDeploymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;

  const historyEntry = { timestamp: new Date().toISOString(), action: "created", status: "pending" };
  const [deployment] = await db.insert(deploymentsTable).values({
    userId,
    name: parsed.data.name,
    type: parsed.data.type,
    provider: parsed.data.provider,
    projectId: parsed.data.projectId,
    domain: parsed.data.domain,
    environment: parsed.data.environment,
    status: "pending",
    logs: [{ timestamp: new Date().toISOString(), level: "info", message: "Deployment record created — export your project and deploy via Vercel, Netlify, or your preferred provider." }],
    history: [historyEntry],
  }).returning();

  // Fire webhook for deployment.created
  void fireWebhooks(userId, "deployment.created", {
    deploymentId: deployment.id,
    name: deployment.name,
    type: deployment.type,
    environment: deployment.environment,
    status: "pending",
  });

  res.status(201).json({ deployment });
});

router.get("/deployments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deployment] = await db.select().from(deploymentsTable).where(and(eq(deploymentsTable.id, id), eq(deploymentsTable.userId, userId)));
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.json({ deployment });
});

router.patch("/deployments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateDeploymentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.domain !== undefined) updates.domain = parsed.data.domain;
  if (parsed.data.logs !== undefined) updates.logs = parsed.data.logs;
  const [deployment] = await db.update(deploymentsTable).set(updates).where(and(eq(deploymentsTable.id, id), eq(deploymentsTable.userId, userId))).returning();
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }

  // Fire webhook on significant status changes
  if (parsed.data.status) {
    const eventMap: Record<string, string> = {
      active: "deployment.active",
      failed: "deployment.failed",
      stopped: "deployment.stopped",
    };
    const event = eventMap[parsed.data.status];
    if (event) {
      void fireWebhooks(userId, event, {
        deploymentId: deployment.id,
        name: deployment.name,
        status: deployment.status,
        url: deployment.url,
      });
    }
  }

  res.json({ deployment });
});

router.post("/deployments/:id/rollback", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deployment] = await db.select().from(deploymentsTable).where(and(eq(deploymentsTable.id, id), eq(deploymentsTable.userId, userId)));
  if (!deployment) { res.status(404).json({ error: "Deployment not found" }); return; }
  const history = (deployment.history as Array<Record<string, unknown>>) ?? [];
  const rollbackEntry = { timestamp: new Date().toISOString(), action: "rollback", status: "active" };
  const [updated] = await db.update(deploymentsTable).set({
    status: "active",
    history: [...history, rollbackEntry],
    logs: [...((deployment.logs as unknown[]) ?? []), { timestamp: new Date().toISOString(), level: "info", message: "Rollback completed" }],
  }).where(eq(deploymentsTable.id, id)).returning();

  void fireWebhooks(userId, "deployment.rollback", {
    deploymentId: deployment.id,
    name: deployment.name,
    status: "active",
  });

  res.json({ deployment: updated });
});

router.delete("/deployments/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db.delete(deploymentsTable).where(and(eq(deploymentsTable.id, id), eq(deploymentsTable.userId, userId))).returning();
  if (!deleted) { res.status(404).json({ error: "Deployment not found" }); return; }
  res.sendStatus(204);
});

export default router;
