import { Router } from "express";
import { db, webhooksTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { createHmac } from "crypto";

const router = Router();

const SUPPORTED_EVENTS = [
  "deployment.created",
  "deployment.active",
  "deployment.failed",
  "deployment.stopped",
  "deployment.rollback",
  "generation.completed",
  "generation.failed",
  "template.published",
  "agent.installed",
  "agent.error",
] as const;

const CreateWebhookBody = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().optional(),
  events: z.array(z.string()).min(1),
});

const UpdateWebhookBody = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().optional(),
  events: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

router.get("/webhooks/events", requireAuth, (_req, res) => {
  res.json({ events: SUPPORTED_EVENTS });
});

router.get("/webhooks", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const hooks = await db
    .select()
    .from(webhooksTable)
    .where(eq(webhooksTable.userId, userId))
    .orderBy(desc(webhooksTable.createdAt));
  res.json({ webhooks: hooks });
});

router.post("/webhooks", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [webhook] = await db
    .insert(webhooksTable)
    .values({
      userId,
      name: parsed.data.name,
      url: parsed.data.url,
      secret: parsed.data.secret ?? null,
      events: parsed.data.events,
    })
    .returning();
  res.status(201).json({ webhook });
});

router.get("/webhooks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [webhook] = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)));
  if (!webhook) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({ webhook });
});

router.patch("/webhooks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const parsed = UpdateWebhookBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.url !== undefined) updates.url = parsed.data.url;
  if (parsed.data.secret !== undefined) updates.secret = parsed.data.secret;
  if (parsed.data.events !== undefined) updates.events = parsed.data.events;
  if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
  const [webhook] = await db
    .update(webhooksTable)
    .set(updates)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)))
    .returning();
  if (!webhook) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.json({ webhook });
});

router.delete("/webhooks/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Webhook not found" }); return; }
  res.sendStatus(204);
});

// Ping/test endpoint — sends a test payload to the webhook URL
router.post("/webhooks/:id/ping", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [webhook] = await db
    .select()
    .from(webhooksTable)
    .where(and(eq(webhooksTable.id, id), eq(webhooksTable.userId, userId)));
  if (!webhook) { res.status(404).json({ error: "Webhook not found" }); return; }

  const payload = JSON.stringify({
    event: "ping",
    webhookId: webhook.id,
    timestamp: new Date().toISOString(),
    data: { message: "STAGEONE webhook test — everything is working!" },
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-STAGEONE-Event": "ping",
    "X-STAGEONE-Webhook-ID": webhook.id,
    "X-STAGEONE-Timestamp": new Date().toISOString(),
  };

  if (webhook.secret) {
    const sig = createHmac("sha256", webhook.secret).update(payload).digest("hex");
    headers["X-STAGEONE-Signature"] = `sha256=${sig}`;
  }

  let success = false;
  let statusCode = 0;
  let error: string | null = null;

  try {
    const resp = await fetch(webhook.url, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    statusCode = resp.status;
    success = resp.ok;
  } catch (err) {
    error = err instanceof Error ? err.message : "Unknown error";
  }

  const logEntry = {
    timestamp: new Date().toISOString(),
    event: "ping",
    success,
    statusCode,
    error,
  };

  const currentLogs = (webhook.deliveryLogs as unknown[]) ?? [];
  await db
    .update(webhooksTable)
    .set({
      lastTriggeredAt: new Date(),
      successCount: success ? webhook.successCount + 1 : webhook.successCount,
      failureCount: !success ? webhook.failureCount + 1 : webhook.failureCount,
      deliveryLogs: [...currentLogs.slice(-49), logEntry],
    })
    .where(eq(webhooksTable.id, id));

  res.json({ success, statusCode, error });
});

// Internal function — fire webhooks for an event (used by other routes)
export async function fireWebhooks(
  userId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    const hooks = await db
      .select()
      .from(webhooksTable)
      .where(and(eq(webhooksTable.userId, userId), eq(webhooksTable.isActive, true)));

    const matching = hooks.filter((h) =>
      (h.events as string[]).includes(event) || (h.events as string[]).includes("*")
    );

    for (const hook of matching) {
      const payload = JSON.stringify({
        event,
        webhookId: hook.id,
        timestamp: new Date().toISOString(),
        data,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-STAGEONE-Event": event,
        "X-STAGEONE-Webhook-ID": hook.id,
        "X-STAGEONE-Timestamp": new Date().toISOString(),
      };

      if (hook.secret) {
        const sig = createHmac("sha256", hook.secret).update(payload).digest("hex");
        headers["X-STAGEONE-Signature"] = `sha256=${sig}`;
      }

      let success = false;
      let statusCode = 0;
      let error: string | null = null;

      try {
        const resp = await fetch(hook.url, {
          method: "POST",
          headers,
          body: payload,
          signal: AbortSignal.timeout(5000),
        });
        statusCode = resp.status;
        success = resp.ok;
      } catch (err) {
        error = err instanceof Error ? err.message : "Unknown error";
      }

      const logEntry = {
        timestamp: new Date().toISOString(),
        event,
        success,
        statusCode,
        error,
      };

      const currentLogs = (hook.deliveryLogs as unknown[]) ?? [];
      await db
        .update(webhooksTable)
        .set({
          lastTriggeredAt: new Date(),
          successCount: success ? hook.successCount + 1 : hook.successCount,
          failureCount: !success ? hook.failureCount + 1 : hook.failureCount,
          deliveryLogs: [...currentLogs.slice(-49), logEntry],
        })
        .where(eq(webhooksTable.id, hook.id));
    }
  } catch (_) {
    // Webhook delivery errors are non-fatal
  }
}

export default router;
