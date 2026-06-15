// ─── STAGEONE RBAC Middleware ──────────────────────────────────────────────────
// Enforces permission checks on top of requireAuth.
// Falls back to ALLOW when the user has no roles configured (backward-compatible).
// Admins always bypass.
//
// Usage:
//   router.get("/enterprise/audit", requireAuth, requirePermission("enterprise:read"), handler)

import type { Request, Response, NextFunction } from "express";
import { db, rolesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Admins bypass all permission checks
    if (req.user?.isAdmin) {
      next();
      return;
    }

    try {
      const roles = await db
        .select({ permissions: rolesTable.permissions })
        .from(rolesTable)
        .where(eq(rolesTable.userId, userId));

      // No roles configured → backward-compatible: allow access
      if (roles.length === 0) {
        next();
        return;
      }

      // Check if any role grants the required permission
      const hasPermission = roles.some(r =>
        Array.isArray(r.permissions) && r.permissions.includes(permission),
      );

      if (!hasPermission) {
        res.status(403).json({
          error: "PERMISSION_DENIED",
          required: permission,
          message: `This action requires the '${permission}' permission.`,
        });
        return;
      }

      next();
    } catch {
      // DB unavailable → allow (fail-open for availability)
      next();
    }
  };
}
