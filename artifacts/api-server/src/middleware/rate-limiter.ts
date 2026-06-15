// ─── STAGEONE Centralized Rate Limiter ────────────────────────────────────────
// In-memory sliding-window rate limiter. Tier-aware. Logs violations to DB
// fire-and-forget. Does NOT gate admin routes. Provider-agnostic.

import type { Request, Response, NextFunction } from "express";
import { db, rateLimitViolationsTable } from "@workspace/db";
import { logger } from "../lib/logger";

// ─── Tier limits ──────────────────────────────────────────────────────────────
const TIER_LIMITS: Record<string, { minute: number; hour: number; day: number }> = {
  free:       { minute: 10,  hour: 50,   day: 200   },
  pro:        { minute: 30,  hour: 200,  day: 1000  },
  startup:    { minute: 100, hour: 1000, day: 5000  },
  enterprise: { minute: 500, hour: 5000, day: 50000 },
  admin:      { minute: 9999, hour: 99999, day: 999999 },
};

const MS_MINUTE = 60_000;
const MS_HOUR   = 3_600_000;
const MS_DAY    = 86_400_000;

// ─── In-memory sliding window store ──────────────────────────────────────────
// key → sorted array of request timestamps (epoch ms)
const store = new Map<string, number[]>();

// Prune entries older than 24h every 10 minutes to prevent memory bloat
setInterval(() => {
  const cutoff = Date.now() - MS_DAY;
  for (const [key, ts] of store.entries()) {
    const trimmed = ts.filter(t => t > cutoff);
    if (trimmed.length === 0) store.delete(key);
    else store.set(key, trimmed);
  }
}, 10 * 60_000);

function windowCount(timestamps: number[], windowMs: number): number {
  const cutoff = Date.now() - windowMs;
  return timestamps.filter(t => t > cutoff).length;
}

function logViolation(params: {
  userId?: string; ip: string; endpoint: string; tier: string
  limitType: string; requestCount: number; limit: number; userAgent?: string
}): void {
  Promise.resolve().then(async () => {
    try {
      await db.insert(rateLimitViolationsTable).values({
        userId:       params.userId ?? null,
        ip:           params.ip,
        endpoint:     params.endpoint,
        tier:         params.tier,
        limitType:    params.limitType,
        requestCount: params.requestCount,
        limit:        params.limit,
        blocked:      true,
        userAgent:    params.userAgent?.slice(0, 512) ?? null,
      });
    } catch (err) {
      logger.warn({ err }, "[rate-limiter] Failed to log violation");
    }
  });
}

// ─── Build rate limit middleware for specific endpoints ───────────────────────
export function rateLimit(options?: {
  skipAdmin?: boolean;      // default true
  tierOverride?: string;    // force a specific tier (for testing)
}) {
  const skipAdmin = options?.skipAdmin ?? true;

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    // Extract identity from JWT user (attached by requireAuth before this)
    const userId  = req.user?.userId;
    const isAdmin = req.user?.isAdmin === true;
    const ip      = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    const endpoint = req.path.split("?")[0];
    const userAgent = req.headers["user-agent"];

    // Admins bypass rate limits
    if (skipAdmin && isAdmin) { next(); return; }

    // Determine tier (default free; real plan lookup would require async)
    const tier = options?.tierOverride ?? (isAdmin ? "admin" : "free");
    const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

    const key = `${tier}:${userId ?? ip}:${endpoint}`;
    const now = Date.now();

    const timestamps = store.get(key) ?? [];
    timestamps.push(now);
    store.set(key, timestamps);

    const perMin  = windowCount(timestamps, MS_MINUTE);
    const perHour = windowCount(timestamps, MS_HOUR);
    const perDay  = windowCount(timestamps, MS_DAY);

    let violated = false;
    let limitType = "";
    let count = 0;
    let limit = 0;

    if (perMin > limits.minute) {
      violated = true; limitType = "minute"; count = perMin; limit = limits.minute;
    } else if (perHour > limits.hour) {
      violated = true; limitType = "hour"; count = perHour; limit = limits.hour;
    } else if (perDay > limits.day) {
      violated = true; limitType = "day"; count = perDay; limit = limits.day;
    }

    // Set informational headers
    res.setHeader("X-RateLimit-Tier", tier);
    res.setHeader("X-RateLimit-Limit-Minute", limits.minute);
    res.setHeader("X-RateLimit-Remaining-Minute", Math.max(0, limits.minute - perMin));

    if (violated) {
      logger.warn({ userId, ip, tier, endpoint, limitType, count, limit }, "[rate-limiter] Request blocked");
      logViolation({ userId, ip, endpoint, tier, limitType, requestCount: count, limit, userAgent });
      res.status(429).json({
        error: `Rate limit exceeded — ${count}/${limit} requests in the last ${limitType}. Try again later.`,
        limitType,
        retryAfter: limitType === "minute" ? 60 : limitType === "hour" ? 3600 : 86400,
      });
      return;
    }

    next();
  };
}

// ─── Global light IP-based limiter (anti-DDoS, applied to entire /api) ────────
export function globalRateLimit() {
  return function globalRateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    const key = `global:ip:${ip}`;
    const now = Date.now();

    const timestamps = store.get(key) ?? [];
    timestamps.push(now);
    store.set(key, timestamps);

    const perMin = windowCount(timestamps, MS_MINUTE);

    // Hard IP limit: 300/min (anti-DDoS baseline)
    if (perMin > 300) {
      res.status(429).json({ error: "Too many requests from this IP. Try again later.", retryAfter: 60 });
      return;
    }

    next();
  };
}
