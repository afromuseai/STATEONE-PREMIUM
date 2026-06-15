import { db, adminAuditLogsTable } from "@workspace/db";
import crypto from "crypto";
import type { Request } from "express";

function extractIp(req: Request): string | null {
  const fwd = req.headers["x-forwarded-for"];
  if (fwd) return (Array.isArray(fwd) ? fwd[0] : fwd).split(",")[0]?.trim() || null;
  return req.ip ?? null;
}

function hashIp(ip: string): string {
  return crypto.createHash("sha256").update(`stageone-audit:${ip}`).digest("hex").slice(0, 16);
}

export interface AdminAuditOptions {
  adminId: string;
  adminEmail: string;
  action: string;
  targetUserId?: string | null;
  targetUserEmail?: string | null;
  details?: Record<string, unknown>;
  req?: Request | null;
}

export async function logAdminAudit(opts: AdminAuditOptions): Promise<void> {
  try {
    const { adminId, adminEmail, action, targetUserId, targetUserEmail, details = {}, req } = opts;
    const ip = req ? extractIp(req) : null;
    const ipHash = ip ? hashIp(ip) : null;

    await db.insert(adminAuditLogsTable).values({
      adminId,
      adminEmail,
      action,
      targetUserId: targetUserId ?? null,
      targetUserEmail: targetUserEmail ?? null,
      details,
      ipHash,
    });
  } catch (err) {
    console.error("[logAdminAudit] failed:", (err as Error).message);
  }
}

export function logAdminAuditFireForget(opts: AdminAuditOptions): void {
  logAdminAudit(opts).catch(() => {});
}
