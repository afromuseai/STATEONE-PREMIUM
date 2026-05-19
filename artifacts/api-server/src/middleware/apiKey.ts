import type { Request, Response, NextFunction } from "express";
import { createHash } from "crypto";
import { db, apiKeysTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

export interface ApiKeyPayload {
  apiKeyId: string;
  userId: string;
  plan: string;
  requestsPerMonth: number;
  requestsUsed: number;
  requestsPerMinute: number;
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyPayload;
    }
  }
}

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(apiKeyId: string, perMinute: number): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(apiKeyId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(apiKeyId, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= perMinute) return false;
  entry.count++;
  return true;
}

export async function requireApiKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const raw = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!raw || !raw.startsWith("sk-stg-")) {
    res.status(401).json({
      error: "Missing or invalid API key",
      hint: "Set Authorization: Bearer sk-stg-<your-key>",
    });
    return;
  }

  const hash = createHash("sha256").update(raw).digest("hex");
  const [key] = await db
    .select()
    .from(apiKeysTable)
    .where(and(eq(apiKeysTable.keyHash, hash), eq(apiKeysTable.isActive, true)));

  if (!key) {
    res.status(401).json({ error: "Invalid or revoked API key" });
    return;
  }

  if (key.requestsUsed >= key.requestsPerMonth) {
    res.status(429).json({
      error: "Monthly request limit exceeded",
      limit: key.requestsPerMonth,
      used: key.requestsUsed,
      plan: key.plan,
    });
    return;
  }

  if (!checkRateLimit(key.id, key.requestsPerMinute)) {
    res.status(429).json({
      error: `Rate limit exceeded: ${key.requestsPerMinute} requests/minute`,
      retryAfter: 60,
    });
    return;
  }

  req.apiKey = {
    apiKeyId: key.id,
    userId: key.userId,
    plan: key.plan,
    requestsPerMonth: key.requestsPerMonth,
    requestsUsed: key.requestsUsed,
    requestsPerMinute: key.requestsPerMinute,
  };

  next();
}
