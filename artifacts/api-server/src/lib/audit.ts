import { db, auditLogsTable } from "@workspace/db";
import type { Request } from "express";

export interface AuditOptions {
  userId?: string | null;
  action: string;
  resource: string;
  resourceId?: string | null;
  changes?: Record<string, unknown>;
  severity?: "low" | "medium" | "high" | "critical";
  outcome?: "success" | "failure";
  metadata?: Record<string, unknown>;
  req?: Request | null;
}

export async function logAudit(opts: AuditOptions): Promise<void> {
  try {
    const {
      userId,
      action,
      resource,
      resourceId,
      changes = {},
      severity = "low",
      outcome = "success",
      metadata = {},
      req,
    } = opts;

    const ipAddress = req
      ? ((req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? null)
      : null;
    const userAgent = req ? ((req.headers["user-agent"] as string | undefined) ?? null) : null;

    await db.insert(auditLogsTable).values({
      userId: userId ?? null,
      action,
      resource,
      resourceId: resourceId ?? null,
      changes,
      ipAddress,
      userAgent,
      severity,
      outcome,
      metadata,
    });
  } catch (err) {
    console.error("[logAudit] failed:", (err as Error).message);
  }
}

export function logAuditFireForget(opts: AuditOptions): void {
  logAudit(opts).catch(() => {});
}
