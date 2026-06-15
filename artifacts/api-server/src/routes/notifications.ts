import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import type { Response } from "express";

const router = Router();

type SseClient = { userId: string; res: Response };
const sseClients: SseClient[] = [];

export function addSseClient(userId: string, res: Response) {
  sseClients.push({ userId, res });
}

export function removeSseClient(res: Response) {
  const idx = sseClients.findIndex((c) => c.res === res);
  if (idx !== -1) sseClients.splice(idx, 1);
}

// Push an already-persisted notification object to an active SSE connection.
// Call this after a bulk DB insert to avoid double-writing the row.
export function pushNotificationToUser(userId: string, notification: Record<string, unknown>) {
  const payload = JSON.stringify({ notification });
  for (const client of sseClients) {
    if (client.userId === userId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        removeSseClient(client.res);
      }
    }
  }
}

export async function emitNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  severity: "info" | "success" | "warning" | "error" = "info",
  metadata: Record<string, unknown> = {},
) {
  const [notification] = await db
    .insert(notificationsTable)
    .values({ userId, type, title, message, severity, metadata })
    .returning();

  const payload = JSON.stringify({ notification });
  for (const client of sseClients) {
    if (client.userId === userId) {
      try {
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        removeSseClient(client.res);
      }
    }
  }

  return notification;
}

router.get("/notifications/stream", requireAuth, (req, res): void => {
  const userId = req.user!.userId;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(`data: ${JSON.stringify({ connected: true })}\n\n`);

  addSseClient(userId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(res);
  });
});

router.get("/notifications", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { unreadOnly, limit } = req.query as Record<string, string>;

  const all = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(Number(limit ?? 50));

  const notifications = unreadOnly === "true" ? all.filter((n) => !n.read) : all;
  const unreadCount = all.filter((n) => !n.read).length;

  res.json({ notifications, unreadCount });
});

const CreateNotificationBody = z.object({
  type: z.string().min(1),
  title: z.string().min(1),
  message: z.string().min(1),
  severity: z.enum(["info", "success", "warning", "error"]).optional().default("info"),
  metadata: z.record(z.unknown()).optional().default({}),
});

router.post("/notifications", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateNotificationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const notification = await emitNotification(
    userId,
    parsed.data.type,
    parsed.data.title,
    parsed.data.message,
    parsed.data.severity,
    parsed.data.metadata,
  );
  res.status(201).json({ notification });
});

router.patch("/notifications/:id/read", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [notification] = await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();
  if (!notification) { res.status(404).json({ error: "Notification not found" }); return; }
  res.json({ notification });
});

router.post("/notifications/read-all", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
  res.json({ ok: true });
});

router.delete("/notifications/:id", requireAuth, async (req, res): Promise<void> => {
  const id = req.params.id as string;
  const userId = req.user!.userId;
  const [deleted] = await db
    .delete(notificationsTable)
    .where(and(eq(notificationsTable.id, id), eq(notificationsTable.userId, userId)))
    .returning();
  if (!deleted) { res.status(404).json({ error: "Notification not found" }); return; }
  res.sendStatus(204);
});

export default router;
