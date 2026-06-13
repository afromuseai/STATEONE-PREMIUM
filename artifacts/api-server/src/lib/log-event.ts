import type { Request } from "express";
import { db, eventsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const geoCache = new Map<string, { country: string | null; city: string | null; cachedAt: number }>();
const GEO_TTL = 60 * 60 * 1000;

function extractIP(req: Request): string | null {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(",")[0];
    return first?.trim() || null;
  }
  return (req.ip ?? null);
}

function isPrivateIP(ip: string): boolean {
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip.startsWith("172.16.") ||
    ip.startsWith("::ffff:127.")
  );
}

async function lookupGeo(ip: string): Promise<{ country: string | null; city: string | null }> {
  if (!ip || isPrivateIP(ip)) return { country: null, city: null };
  const cached = geoCache.get(ip);
  if (cached && Date.now() - cached.cachedAt < GEO_TTL) {
    return { country: cached.country, city: cached.city };
  }
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: AbortSignal.timeout(2000),
      headers: { "User-Agent": "stageone-server/1.0" },
    });
    if (!res.ok) throw new Error(`ipapi ${res.status}`);
    const json = await res.json() as { country_name?: string; city?: string };
    const result = { country: json.country_name ?? null, city: json.city ?? null };
    geoCache.set(ip, { ...result, cachedAt: Date.now() });
    return result;
  } catch {
    return { country: null, city: null };
  }
}

export interface LogEventOptions {
  userId?: string | null;
  projectId?: string | null;
  type: string;
  data?: Record<string, unknown>;
  req?: Request | null;
}

export async function logEvent(opts: LogEventOptions): Promise<void> {
  try {
    const { userId, projectId, type, data = {}, req } = opts;

    let ip: string | null = null;
    let userAgent: string | null = null;
    let country: string | null = null;
    let city: string | null = null;

    if (req) {
      country = (req.headers["cf-ipcountry"] as string | undefined) ?? null;
      city = (req.headers["cf-ipcity"] as string | undefined) ?? null;
      ip = extractIP(req);
      userAgent = (req.headers["user-agent"] as string | undefined) ?? null;

      if (!country && ip) {
        const geo = await lookupGeo(ip);
        country = geo.country;
        city = geo.city;
      }

      if (userId && (country || ip)) {
        db.update(usersTable)
          .set({
            ...(country ? { country } : {}),
            ...(city ? { city } : {}),
            lastSeenAt: new Date(),
          })
          .where(eq(usersTable.id, userId))
          .catch(() => {});
      }
    }

    await db.insert(eventsTable).values({
      userId: userId ?? null,
      projectId: projectId ?? null,
      type,
      data,
      country,
      city,
      ip,
      userAgent,
    });
  } catch (err) {
    console.error("[logEvent] failed:", (err as Error).message);
  }
}

export function logEventFireForget(opts: LogEventOptions): void {
  logEvent(opts).catch(() => {});
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
