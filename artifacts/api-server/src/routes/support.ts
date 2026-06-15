import { Router } from "express";
import { db, supportTicketsTable, supportMessagesTable, usersTable } from "@workspace/db";
import { eq, desc, and, or, ilike, count, sql, gte } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middleware/auth";
import { logAdminAuditFireForget } from "../lib/admin-audit";
import { emitNotification } from "./notifications";
import { z } from "zod";

const router = Router();

// ── Validation schemas ────────────────────────────────────────────────────────
const CreateTicketBody = z.object({
  subject: z.string().min(3).max(200),
  category: z.enum(["billing", "account", "bug", "feature_request", "technical", "other"]).default("other"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  message: z.string().min(10).max(5000),
});

const CreateMessageBody = z.object({
  message: z.string().min(1).max(5000),
});

const UpdateTicketBody = z.object({
  status: z.enum(["open", "in_progress", "waiting_user", "resolved", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  assignedAdminId: z.string().uuid().nullable().optional(),
});

// ── User: List own tickets ────────────────────────────────────────────────────
router.get("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const tickets = await db
    .select({
      id: supportTicketsTable.id,
      subject: supportTicketsTable.subject,
      category: supportTicketsTable.category,
      priority: supportTicketsTable.priority,
      status: supportTicketsTable.status,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      assignedAdminId: supportTicketsTable.assignedAdminId,
    })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, userId))
    .orderBy(desc(supportTicketsTable.updatedAt));

  res.json({ tickets });
});

// ── User: Create ticket ───────────────────────────────────────────────────────
router.post("/support/tickets", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const { subject, category, priority, message } = parsed.data;

  const [ticket] = await db
    .insert(supportTicketsTable)
    .values({ userId, subject, category, priority, status: "open" })
    .returning();

  await db.insert(supportMessagesTable).values({
    ticketId: ticket.id,
    senderId: userId,
    senderType: "user",
    message,
  });

  // Notify user
  emitNotification(
    userId,
    "support_ticket_created",
    "Support Ticket Created",
    `Your ticket "${subject}" has been submitted. We'll get back to you soon.`,
    "success",
    { ticketId: ticket.id },
  ).catch(() => {});

  res.status(201).json({ ticket });
});

// ── User: Get single ticket with messages ─────────────────────────────────────
router.get("/support/tickets/:id", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const ticketId = req.params.id as string;
  const isAdmin = req.user!.isAdmin;

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(
      isAdmin
        ? eq(supportTicketsTable.id, ticketId)
        : and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, userId)),
    );

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const rawMessages = await db
    .select({
      id: supportMessagesTable.id,
      ticketId: supportMessagesTable.ticketId,
      senderId: supportMessagesTable.senderId,
      senderType: supportMessagesTable.senderType,
      message: supportMessagesTable.message,
      createdAt: supportMessagesTable.createdAt,
      senderName: usersTable.name,
      senderEmail: usersTable.email,
    })
    .from(supportMessagesTable)
    .leftJoin(usersTable, eq(supportMessagesTable.senderId, usersTable.id))
    .where(eq(supportMessagesTable.ticketId, ticketId))
    .orderBy(supportMessagesTable.createdAt);

  // Load ticket owner info
  const [owner] = await db
    .select({ name: usersTable.name, email: usersTable.email })
    .from(usersTable)
    .where(eq(usersTable.id, ticket.userId));

  // Load assigned admin info if any
  let assignedAdmin: { name: string; email: string } | null = null;
  if (ticket.assignedAdminId) {
    const [admin] = await db
      .select({ name: usersTable.name, email: usersTable.email })
      .from(usersTable)
      .where(eq(usersTable.id, ticket.assignedAdminId));
    assignedAdmin = admin ?? null;
  }

  res.json({ ticket, messages: rawMessages, owner, assignedAdmin });
});

// ── User: Reply to ticket ─────────────────────────────────────────────────────
router.post("/support/tickets/:id/messages", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const ticketId = req.params.id as string;
  const isAdmin = req.user!.isAdmin;

  const parsed = CreateMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Message is required" });
    return;
  }

  const [ticket] = await db
    .select()
    .from(supportTicketsTable)
    .where(
      isAdmin
        ? eq(supportTicketsTable.id, ticketId)
        : and(eq(supportTicketsTable.id, ticketId), eq(supportTicketsTable.userId, userId)),
    );

  if (!ticket) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  if (ticket.status === "closed") {
    res.status(400).json({ error: "Cannot reply to a closed ticket" });
    return;
  }

  const senderType = isAdmin ? "admin" : "user";

  const [msg] = await db
    .insert(supportMessagesTable)
    .values({ ticketId, senderId: userId, senderType, message: parsed.data.message })
    .returning();

  // Auto-update ticket status on reply
  const newStatus = isAdmin ? "waiting_user" : "in_progress";
  await db
    .update(supportTicketsTable)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, ticketId));

  // Notify the other party
  if (isAdmin) {
    // Notify the user
    emitNotification(
      ticket.userId,
      "support_message_sent",
      "New Reply on Your Support Ticket",
      `An admin replied to your ticket: "${ticket.subject}"`,
      "info",
      { ticketId: ticket.id },
    ).catch(() => {});

    logAdminAuditFireForget({
      adminId: userId,
      adminEmail: req.user!.email,
      action: "support_message_sent",
      targetUserId: ticket.userId,
      details: { ticketId, subject: ticket.subject },
    });
  } else {
    // Notify assigned admin if any
    if (ticket.assignedAdminId) {
      emitNotification(
        ticket.assignedAdminId,
        "support_message_sent",
        "User Replied to Support Ticket",
        `User replied on ticket: "${ticket.subject}"`,
        "info",
        { ticketId: ticket.id },
      ).catch(() => {});
    }
  }

  res.status(201).json({ message: msg });
});

// ── Admin: List all tickets ───────────────────────────────────────────────────
router.get("/admin/support/tickets", requireAdmin, async (req, res): Promise<void> => {
  const { status, priority, category, search, limit, offset } = req.query as Record<string, string>;

  const conditions = [];
  if (status && status !== "all") conditions.push(eq(supportTicketsTable.status, status));
  if (priority && priority !== "all") conditions.push(eq(supportTicketsTable.priority, priority));
  if (category && category !== "all") conditions.push(eq(supportTicketsTable.category, category));

  const baseWhere = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: supportTicketsTable.id,
      subject: supportTicketsTable.subject,
      category: supportTicketsTable.category,
      priority: supportTicketsTable.priority,
      status: supportTicketsTable.status,
      userId: supportTicketsTable.userId,
      assignedAdminId: supportTicketsTable.assignedAdminId,
      createdAt: supportTicketsTable.createdAt,
      updatedAt: supportTicketsTable.updatedAt,
      userEmail: usersTable.email,
      userName: usersTable.name,
    })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(baseWhere)
    .orderBy(desc(supportTicketsTable.updatedAt))
    .limit(Number(limit ?? 100))
    .offset(Number(offset ?? 0));

  // Apply search filter in JS (email/subject)
  const filtered = search?.trim()
    ? rows.filter(r =>
        r.subject.toLowerCase().includes(search.toLowerCase()) ||
        (r.userEmail ?? "").toLowerCase().includes(search.toLowerCase()),
      )
    : rows;

  res.json({ tickets: filtered, total: filtered.length });
});

// ── Admin: Support metrics ─────────────────────────────────────────────────────
router.get("/admin/support/metrics", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalOpen] = await db
    .select({ count: count() })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.status, "open"));

  const [totalUrgent] = await db
    .select({ count: count() })
    .from(supportTicketsTable)
    .where(and(eq(supportTicketsTable.priority, "urgent"), eq(supportTicketsTable.status, "open")));

  const [totalResolved] = await db
    .select({ count: count() })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.status, "resolved"));

  const [totalClosed] = await db
    .select({ count: count() })
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.status, "closed"));

  const [totalAll] = await db
    .select({ count: count() })
    .from(supportTicketsTable);

  const [recentOpen] = await db
    .select({ count: count() })
    .from(supportTicketsTable)
    .where(and(
      eq(supportTicketsTable.status, "open"),
      gte(supportTicketsTable.createdAt, thirtyDaysAgo),
    ));

  // By category
  const byCategory = await db
    .select({ category: supportTicketsTable.category, count: count() })
    .from(supportTicketsTable)
    .groupBy(supportTicketsTable.category);

  // By priority
  const byPriority = await db
    .select({ priority: supportTicketsTable.priority, count: count() })
    .from(supportTicketsTable)
    .groupBy(supportTicketsTable.priority);

  res.json({
    open: totalOpen?.count ?? 0,
    urgent: totalUrgent?.count ?? 0,
    resolved: totalResolved?.count ?? 0,
    closed: totalClosed?.count ?? 0,
    total: totalAll?.count ?? 0,
    recentOpen30d: recentOpen?.count ?? 0,
    byCategory,
    byPriority,
  });
});

// ── Admin: Update ticket ──────────────────────────────────────────────────────
router.patch("/admin/support/tickets/:id", requireAdmin, async (req, res): Promise<void> => {
  const adminId = req.user!.userId;
  const ticketId = req.params.id as string;

  const parsed = UpdateTicketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }

  const [existing] = await db
    .select()
    .from(supportTicketsTable)
    .where(eq(supportTicketsTable.id, ticketId));

  if (!existing) {
    res.status(404).json({ error: "Ticket not found" });
    return;
  }

  const updates: Partial<typeof supportTicketsTable.$inferInsert> & { updatedAt?: Date } = {
    updatedAt: new Date(),
  };
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
  if (parsed.data.assignedAdminId !== undefined) updates.assignedAdminId = parsed.data.assignedAdminId;

  const [ticket] = await db
    .update(supportTicketsTable)
    .set(updates)
    .where(eq(supportTicketsTable.id, ticketId))
    .returning();

  // Determine audit action
  let auditAction = "support_ticket_status_changed";
  if (parsed.data.assignedAdminId !== undefined && parsed.data.status === undefined) {
    auditAction = "support_ticket_assigned";
  }
  if (parsed.data.status === "resolved") auditAction = "support_ticket_resolved";

  logAdminAuditFireForget({
    adminId,
    adminEmail: req.user!.email,
    action: auditAction,
    targetUserId: existing.userId,
    details: {
      ticketId,
      subject: existing.subject,
      oldStatus: existing.status,
      newStatus: parsed.data.status,
      priority: parsed.data.priority,
      assignedAdminId: parsed.data.assignedAdminId,
    },
  });

  // Notify user on status change
  if (parsed.data.status && parsed.data.status !== existing.status) {
    const statusLabel: Record<string, string> = {
      in_progress: "In Progress",
      waiting_user: "Waiting for Your Reply",
      resolved: "Resolved",
      closed: "Closed",
    };
    const label = statusLabel[parsed.data.status] ?? parsed.data.status;
    emitNotification(
      existing.userId,
      "support_ticket_status_changed",
      "Support Ticket Updated",
      `Your ticket "${existing.subject}" is now: ${label}`,
      parsed.data.status === "resolved" ? "success" : "info",
      { ticketId, status: parsed.data.status },
    ).catch(() => {});
  }

  // Notify assigned admin
  if (
    parsed.data.assignedAdminId &&
    parsed.data.assignedAdminId !== existing.assignedAdminId
  ) {
    emitNotification(
      parsed.data.assignedAdminId,
      "support_ticket_assigned",
      "Support Ticket Assigned to You",
      `You have been assigned ticket: "${existing.subject}"`,
      "info",
      { ticketId },
    ).catch(() => {});
    logAdminAuditFireForget({
      adminId,
      adminEmail: req.user!.email,
      action: "support_ticket_assigned",
      targetUserId: existing.userId,
      details: { ticketId, subject: existing.subject, assignedTo: parsed.data.assignedAdminId },
    });
  }

  res.json({ ticket });
});

export default router;
