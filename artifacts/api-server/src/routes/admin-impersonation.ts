import { Router } from "express";
import jwt from "jsonwebtoken";
import { db, userImpersonationLogsTable, usersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { logAdminAuditFireForget } from "../lib/admin-audit";
import crypto from "crypto";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "stageone-dev-secret-change-in-production";
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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: IMPERSONATION_TTL_SECONDS });
}

export function verifyImpersonationToken(token: string): (ImpersonationPayload & { exp: number }) | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ImpersonationPayload & { exp: number };
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

  // Don't allow admins to impersonate themselves
  if (adminId === targetUserId) {
    res.status(400).json({ error: "Cannot impersonate yourself" });
    return;
  }

  // Load target user
  const [target] = await db
    .select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, targetUserId));

  if (!target) {
    res.status(404).json({ error: "Target user not found" });
    return;
  }

  // Issue short-lived impersonation token
  const impersonationToken = signImpersonationToken({
    adminId,
    adminEmail,
    targetUserId: target.id,
    targetEmail: target.email,
    targetName: target.name ?? target.email,
    isImpersonation: true,
  });

  // Log to DB
  const ip = req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? "";
  await db.insert(userImpersonationLogsTable).values({
    adminId,
    targetUserId: target.id,
    action: "start",
    reason: reason?.trim() || null,
    ipHash: hashIp(ip),
  });

  // Audit log
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
    // Mark the most recent open session as ended
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

// ── GET /api/admin/impersonate/logs ───────────────────────────────────────────
router.get("/admin/impersonate/logs", requireAdmin, async (req, res): Promise<void> => {
  const logs = await db
    .select({
      id: userImpersonationLogsTable.id,
      adminId: userImpersonationLogsTable.adminId,
      targetUserId: userImpersonationLogsTable.targetUserId,
      action: userImpersonationLogsTable.action,
      reason: userImpersonationLogsTable.reason,
      startedAt: userImpersonationLogsTable.startedAt,
      endedAt: userImpersonationLogsTable.endedAt,
      adminEmail: usersTable.email,
    })
    .from(userImpersonationLogsTable)
    .leftJoin(usersTable, eq(userImpersonationLogsTable.adminId, usersTable.id))
    .orderBy(desc(userImpersonationLogsTable.startedAt))
    .limit(100);

  res.json({ logs });
});

export default router;
