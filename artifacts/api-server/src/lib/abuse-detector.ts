// ─── STAGEONE Abuse Detector ───────────────────────────────────────────────────
// Fire-and-forget service that detects and records abuse patterns.
// All DB writes are non-blocking. Never throws to callers.

import { db, abuseAlertsTable, eventsTable, rateLimitViolationsTable } from "@workspace/db";
import { eq, gte, count, and, sql } from "drizzle-orm";
import { logger } from "./logger";

const HOUR = 3_600_000;
const DAY  = 86_400_000;

// ─── Thresholds ───────────────────────────────────────────────────────────────
const THRESHOLDS = {
  generationsPerHour:         20,    // flag if user generates >20/hour
  generationsPerDay:          80,    // flag if user generates >80/day
  rateLimitViolationsPerHour: 10,    // flag if >10 rate limit hits/hour
  loginFailuresPerHour:       8,     // flag if >8 failed logins/hour from same IP
  signupsPerIpPerHour:        5,     // flag if >5 signups from same IP/hour
};

async function upsertAlert(params: {
  userId?: string | null; ip?: string | null; alertType: string
  severity: string; title: string; description: string; metadata?: unknown
}): Promise<void> {
  try {
    // Only create if no open alert of same type+user already exists
    const existing = await db
      .select({ id: abuseAlertsTable.id })
      .from(abuseAlertsTable)
      .where(and(
        eq(abuseAlertsTable.alertType, params.alertType),
        eq(abuseAlertsTable.status, "open"),
        params.userId
          ? eq(abuseAlertsTable.userId, params.userId)
          : eq(abuseAlertsTable.ip, params.ip ?? ""),
      ))
      .limit(1);

    if (existing.length > 0) return; // Already alerted

    await db.insert(abuseAlertsTable).values({
      userId:      params.userId ?? null,
      ip:          params.ip ?? null,
      alertType:   params.alertType,
      severity:    params.severity,
      title:       params.title,
      description: params.description,
      metadata:    params.metadata ?? null,
      status:      "open",
    });

    logger.warn(
      { alertType: params.alertType, userId: params.userId, severity: params.severity },
      `[abuse-detector] Alert created: ${params.title}`
    );
  } catch (err) {
    logger.warn({ err }, "[abuse-detector] Failed to upsert alert");
  }
}

// ─── Check excessive generation ────────────────────────────────────────────────
export function checkExcessiveGeneration(userId: string, ip?: string): void {
  Promise.resolve().then(async () => {
    try {
      const [hourlyCount] = await db
        .select({ n: count() })
        .from(eventsTable)
        .where(and(
          eq(eventsTable.userId, userId),
          sql`event_type in ('bi_generated','website_generated')`,
          gte(eventsTable.createdAt, new Date(Date.now() - HOUR)),
        ));

      const [dailyCount] = await db
        .select({ n: count() })
        .from(eventsTable)
        .where(and(
          eq(eventsTable.userId, userId),
          sql`event_type in ('bi_generated','website_generated')`,
          gte(eventsTable.createdAt, new Date(Date.now() - DAY)),
        ));

      const hourly = Number(hourlyCount?.n ?? 0);
      const daily  = Number(dailyCount?.n  ?? 0);

      if (hourly >= THRESHOLDS.generationsPerHour) {
        await upsertAlert({
          userId, ip, alertType: "excessive_generation", severity: "warning",
          title:       `Excessive Generations: ${hourly}/hour`,
          description: `User triggered ${hourly} AI generations in the past hour (threshold: ${THRESHOLDS.generationsPerHour}).`,
          metadata:    { hourly, daily, userId },
        });
      } else if (daily >= THRESHOLDS.generationsPerDay) {
        await upsertAlert({
          userId, ip, alertType: "excessive_generation", severity: "warning",
          title:       `Excessive Daily Generations: ${daily}/day`,
          description: `User triggered ${daily} AI generations today (threshold: ${THRESHOLDS.generationsPerDay}).`,
          metadata:    { hourly, daily, userId },
        });
      }
    } catch (err) {
      logger.warn({ err }, "[abuse-detector] checkExcessiveGeneration error");
    }
  });
}

// ─── Check rate limit violation spikes ────────────────────────────────────────
export function checkRateLimitSpike(userId: string, ip: string): void {
  Promise.resolve().then(async () => {
    try {
      const [result] = await db
        .select({ n: count() })
        .from(rateLimitViolationsTable)
        .where(and(
          eq(rateLimitViolationsTable.ip, ip),
          gte(rateLimitViolationsTable.createdAt, new Date(Date.now() - HOUR)),
        ));

      const violationCount = Number(result?.n ?? 0);
      if (violationCount >= THRESHOLDS.rateLimitViolationsPerHour) {
        await upsertAlert({
          userId, ip, alertType: "suspicious_automation", severity: "critical",
          title:       `Automation Suspected: ${violationCount} rate-limit hits/hour`,
          description: `IP ${ip} hit rate limits ${violationCount} times in the past hour — possible bot or automated abuse.`,
          metadata:    { violationCount, ip, userId },
        });
      }
    } catch (err) {
      logger.warn({ err }, "[abuse-detector] checkRateLimitSpike error");
    }
  });
}

// ─── Record login failure ──────────────────────────────────────────────────────
export function checkLoginFailures(ip: string, email: string): void {
  Promise.resolve().then(async () => {
    try {
      const [result] = await db
        .select({ n: count() })
        .from(eventsTable)
        .where(and(
          sql`event_type = 'login_failed'`,
          sql`metadata->>'ip' = ${ip}`,
          gte(eventsTable.createdAt, new Date(Date.now() - HOUR)),
        ));

      const failures = Number(result?.n ?? 0);
      if (failures >= THRESHOLDS.loginFailuresPerHour) {
        await upsertAlert({
          ip, alertType: "excessive_logins", severity: "warning",
          title:       `Credential Stuffing Suspected: ${failures} failures/hour`,
          description: `IP ${ip} had ${failures} failed login attempts in the past hour targeting ${email}.`,
          metadata:    { failures, ip, email },
        });
      }
    } catch (err) {
      logger.warn({ err }, "[abuse-detector] checkLoginFailures error");
    }
  });
}

// ─── Record arbitrary abuse event ─────────────────────────────────────────────
export function recordAbuse(params: {
  userId?: string; ip?: string; alertType: string
  severity?: string; title: string; description: string; metadata?: unknown
}): void {
  Promise.resolve().then(async () => {
    await upsertAlert({
      userId:      params.userId,
      ip:          params.ip,
      alertType:   params.alertType,
      severity:    params.severity ?? "warning",
      title:       params.title,
      description: params.description,
      metadata:    params.metadata,
    });
  });
}
