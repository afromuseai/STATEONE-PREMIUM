import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, userImpersonationLogsTable, usersTable } from "@workspace/db";
import { eq, desc, and, gte, lte, sql, count, isNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { requireAdmin } from "../middleware/auth";
import { logAdminAuditFireForget } from "../lib/admin-audit";
import crypto from "crypto";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is required but not set");
}
const IMPERSONATION_TTL_SECONDS = 30 * 60; // 30 minutes

export interface ImpersonationPayload {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  targetName: string;
  isImpersonation: true;
}

export function signImpersonationToken(payload: ImpersonationPayload): string {
  return jwt.sign(payload, JWT_SECRET!, { expiresIn: IMPERSONATION_TTL_SECONDS });
}

export function verifyImpersonationToken(token: string): (ImpersonationPayload & { exp: number }) | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!) as unknown as ImpersonationPayload & { exp: number };
    if (!decoded.isImpersonation) return null;
    return decoded;
  } catch {
    return null;
  }
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

// ── POST /api/admin/impersonate/start ─────────────────────────────────────────
router.post("/admin/impersonate/start", requireAdmin, async (req, res): Promise<void> => {
  const { targetUserId, reason } = req.body as { targetUserId?: string; reason?: string };

  if (!targetUserId) {
    res.status(400).json({ error: "targetUserId is required" });
    return;
  }

  const adminId = req.user!.userId;
  const adminEmail = req.user!.email;

  if (adminId === targetUserId) {
    res.status(400).json({ error: "Cannot impersonate yourself" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId));

  if (!target) {
    res.status(404).json({ error: "Target user not found" });
    return;
  }

  const impersonationToken = signImpersonationToken({
    adminId,
    adminEmail,
    targetUserId: target.id,
    targetEmail: target.email,
    targetName: target.name ?? target.email,
    isImpersonation: true,
  });

  const ip = req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? "";
  await db.insert(userImpersonationLogsTable).values({
    adminId,
    targetUserId: target.id,
    action: "start",
    reason: reason?.trim() || null,
    ipHash: hashIp(ip),
  });

  logAdminAuditFireForget({
    adminId,
    adminEmail,
    action: "impersonation_start",
    targetUserId: target.id,
    details: { targetEmail: target.email, reason: reason ?? null },
  });

  res.json({
    token: impersonationToken,
    expiresAt: Date.now() + IMPERSONATION_TTL_SECONDS * 1000,
    targetUser: {
      id: target.id,
      email: target.email,
      name: target.name ?? target.email,
      isAdmin: target.isAdmin,
    },
  });
});

// ── POST /api/admin/impersonate/stop ──────────────────────────────────────────
router.post("/admin/impersonate/stop", requireAdmin, async (req, res): Promise<void> => {
  const { targetUserId } = req.body as { targetUserId?: string };
  const adminId = req.user!.userId;
  const adminEmail = req.user!.email;

  if (targetUserId) {
    const [log] = await db
      .select()
      .from(userImpersonationLogsTable)
      .where(eq(userImpersonationLogsTable.adminId, adminId))
      .orderBy(desc(userImpersonationLogsTable.startedAt))
      .limit(1);

    if (log && !log.endedAt) {
      await db
        .update(userImpersonationLogsTable)
        .set({ endedAt: new Date(), action: "stop" })
        .where(eq(userImpersonationLogsTable.id, log.id));
    }

    logAdminAuditFireForget({
      adminId,
      adminEmail,
      action: "impersonation_stop",
      targetUserId,
      details: {},
    });
  }

  res.json({ stopped: true });
});

// ── GET /api/admin/impersonate/session ────────────────────────────────────────
router.get("/admin/impersonate/session", requireAdmin, async (req, res): Promise<void> => {
  const impersonationToken = req.headers["x-impersonation-token"] as string | undefined;

  if (!impersonationToken) {
    res.json({ active: false });
    return;
  }

  const payload = verifyImpersonationToken(impersonationToken);
  if (!payload || payload.adminId !== req.user!.userId) {
    res.json({ active: false, expired: true });
    return;
  }

  res.json({
    active: true,
    targetUserId: payload.targetUserId,
    targetEmail: payload.targetEmail,
    targetName: payload.targetName,
    expiresAt: payload.exp * 1000,
  });
});

// ── GET /api/admin/impersonation/logs  (paginated, filtered, joined) ──────────
router.get("/admin/impersonation/logs", requireAdmin, async (req, res): Promise<void> => {
  const adminUsers  = alias(usersTable, "admin_users");
  const targetUsers = alias(usersTable, "target_users");

  const {
    adminId: adminIdFilter,
    targetUserId: targetUserIdFilter,
    action: actionFilter,
    dateFrom,
    dateTo,
    page = "1",
  } = req.query as Record<string, string | undefined>;

  const PAGE_SIZE = 50;
  const pageNum   = Math.max(1, parseInt(page ?? "1", 10));
  const offset    = (pageNum - 1) * PAGE_SIZE;

  const conditions = [];
  if (adminIdFilter)      conditions.push(eq(userImpersonationLogsTable.adminId, adminIdFilter));
  if (targetUserIdFilter) conditions.push(eq(userImpersonationLogsTable.targetUserId, targetUserIdFilter));
  if (actionFilter && actionFilter !== "all") conditions.push(eq(userImpersonationLogsTable.action, actionFilter));
  if (dateFrom)           conditions.push(gte(userImpersonationLogsTable.startedAt, new Date(dateFrom)));
  if (dateTo)             conditions.push(lte(userImpersonationLogsTable.startedAt, new Date(dateTo)));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [logs, [{ total }], stats] = await Promise.all([
    db
      .select({
        id:            userImpersonationLogsTable.id,
        adminId:       userImpersonationLogsTable.adminId,
        adminEmail:    adminUsers.email,
        adminName:     adminUsers.name,
        targetUserId:  userImpersonationLogsTable.targetUserId,
        targetEmail:   targetUsers.email,
        targetName:    targetUsers.name,
        action:        userImpersonationLogsTable.action,
        reason:        userImpersonationLogsTable.reason,
        ipHash:        userImpersonationLogsTable.ipHash,
        startedAt:     userImpersonationLogsTable.startedAt,
        endedAt:       userImpersonationLogsTable.endedAt,
      })
      .from(userImpersonationLogsTable)
      .leftJoin(adminUsers,  eq(userImpersonationLogsTable.adminId,       adminUsers.id))
      .leftJoin(targetUsers, eq(userImpersonationLogsTable.targetUserId,  targetUsers.id))
      .where(where)
      .orderBy(desc(userImpersonationLogsTable.startedAt))
      .limit(PAGE_SIZE)
      .offset(offset),

    db
      .select({ total: count() })
      .from(userImpersonationLogsTable)
      .where(where),

    // Overview stats (unfiltered)
    db
      .select({
        totalSessions:    sql<number>`cast(count(*) as int)`,
        activeSessions:   sql<number>`cast(count(*) filter (where ${userImpersonationLogsTable.endedAt} is null and ${userImpersonationLogsTable.action} = 'start') as int)`,
        uniqueAdmins:     sql<number>`cast(count(distinct ${userImpersonationLogsTable.adminId}) as int)`,
        uniqueTargets:    sql<number>`cast(count(distinct ${userImpersonationLogsTable.targetUserId}) as int)`,
        avgDurationMs:    sql<number>`cast(avg(extract(epoch from (${userImpersonationLogsTable.endedAt} - ${userImpersonationLogsTable.startedAt})) * 1000) filter (where ${userImpersonationLogsTable.endedAt} is not null) as bigint)`,
      })
      .from(userImpersonationLogsTable),
  ]);

  const enriched = logs.map(l => ({
    ...l,
    durationMs: l.endedAt ? (new Date(l.endedAt).getTime() - new Date(l.startedAt).getTime()) : null,
    isActive:   !l.endedAt && l.action === "start",
    ipHashMasked: l.ipHash ? l.ipHash.slice(0, 8) + "…" : null,
  }));

  res.json({
    logs: enriched,
    pagination: { page: pageNum, pageSize: PAGE_SIZE, total: Number(total), pages: Math.ceil(Number(total) / PAGE_SIZE) },
    stats: stats[0] ?? null,
  });
});

// ── GET /api/admin/impersonate/logs (legacy — keep for backward compat) ────────
router.get("/admin/impersonate/logs", requireAdmin, async (req, res): Promise<void> => {
  const adminUsers  = alias(usersTable, "admin_users");
  const logs = await db
    .select({
      id: userImpersonationLogsTable.id,
      adminId: userImpersonationLogsTable.adminId,
      targetUserId: userImpersonationLogsTable.targetUserId,
      action: userImpersonationLogsTable.action,
      reason: userImpersonationLogsTable.reason,
      startedAt: userImpersonationLogsTable.startedAt,
      endedAt: userImpersonationLogsTable.endedAt,
      adminEmail: adminUsers.email,
    })
    .from(userImpersonationLogsTable)
    .leftJoin(adminUsers, eq(userImpersonationLogsTable.adminId, adminUsers.id))
    .orderBy(desc(userImpersonationLogsTable.startedAt))
    .limit(100);

  res.json({ logs });
});

export default router;
