import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET ?? "stageone-dev-secret-change-in-production";

export interface JwtPayload {
  userId: string;
  email: string;
  isAdmin?: boolean;
}

export interface ImpersonationPayload {
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetEmail: string;
  targetName: string;
  isImpersonation: true;
  exp: number;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

function verifyImpersonationToken(token: string): ImpersonationPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as ImpersonationPayload;
    if (!decoded.isImpersonation) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  // Impersonation overlay: admin may pass X-Impersonation-Token to act as another user
  const impersonationToken = req.headers["x-impersonation-token"] as string | undefined;
  if (impersonationToken && payload.isAdmin) {
    const imp = verifyImpersonationToken(impersonationToken);
    if (imp && imp.adminId === payload.userId) {
      req.adminIdentity = payload;
      req.user = { userId: imp.targetUserId, email: imp.targetEmail, isAdmin: false };
      next();
      return;
    }
  }

  req.user = payload;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.token ?? req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  if (!payload.isAdmin) {
    res.status(403).json({ error: "Forbidden: admin access required" });
    return;
  }
  req.user = payload;
  next();
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      adminIdentity?: JwtPayload;
    }
  }
}
