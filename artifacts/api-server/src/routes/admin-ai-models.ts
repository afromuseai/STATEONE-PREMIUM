import { Router } from "express";
import { db, aiModelRequestsTable } from "@workspace/db";
import { eq, desc, gte, count, sum, avg, sql, and } from "drizzle-orm";
import { requireAdmin } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { logger } from "../lib/logger";

const router = Router();

const HR24 = 24 * 60 * 60 * 1000;
const DAY7 =  7 * 24 * 60 * 60 * 1000;
const DAY30 = 30 * 24 * 60 * 60 * 1000;

function nowMinus(ms: number) { return new Date(Date.now() - ms); }

// ─── Cost per 1K tokens — mirrors model-monitor.ts ───────────────────────────
const COST_PER_1K: Record<string, [number, number]> = {
  "nvidia/nemotron-3-ultra-550b-a55b":      [0.00050, 0.00150],
  "nvidia/llama-3.3-nemotron-super-49b-v1":[0.00010, 0.00040],
  "meta/llama-4-maverick-17b-128e-instruct":[0.00005, 0.00015],
  "deepseek-ai/deepseek-v4-flash":          [0.00003, 0.00010],
};

// ─── Static routing map from MODELS registry ─────────────────────────────────
const ROUTING_MAP = [
  { feature: "Business Intelligence", model: MODELS.BUSINESS_INTELLIGENCE, key: "BUSINESS_INTELLIGENCE" },
  { feature: "Orchestration",         model: MODELS.ORCHESTRATION,         key: "ORCHESTRATION" },
  { feature: "Marcus (Copilot)",      model: MODELS.COPILOT,               key: "COPILOT" },
  { feature: "Website Planning",      model: MODELS.WEBSITE_PLANNING,      key: "WEBSITE_PLANNING" },
  { feature: "Component Generation",  model: MODELS.COMPONENT_GENERATION,  key: "COMPONENT_GENERATION" },
  { feature: "Chatbot Generator",     model: MODELS.CHATBOT,               key: "CHATBOT" },
  { feature: "Automation Builder",    model: MODELS.AUTOMATION,            key: "AUTOMATION" },
  { feature: "Idea Enhancer",         model: MODELS.ENHANCE,               key: "ENHANCE" },
  { feature: "AI Memory",             model: MODELS.MEMORY,                key: "MEMORY" },
  { feature: "Recommendations",       model: MODELS.RECOMMENDATIONS,       key: "RECOMMENDATIONS" },
];

// ─── Alert thresholds ─────────────────────────────────────────────────────────
const ALERT_THRESHOLDS = {
  failureRateWarning:  0.10,
  failureRateCritical: 0.25,
  avgLatencyWarning:   8000,
  avgLatencyCritical:  20000,
  tokensPerDayWarning: 500_000,
  dailyCostWarning:    5.0,
};

// ─── GET /api/admin/ai-models ─────────────────────────────────────────────────
router.get("/admin/ai-models", requireAdmin, async (_req, res) => {
  try {
    const since24h  = nowMinus(HR24);
    const since7d   = nowMinus(DAY7);
    const since30d  = nowMinus(DAY30);

    // ── Overview totals ───────────────────────────────────────────────────────
    const [overview24h] = await db
      .select({
        totalRequests: count(),
        totalTokens:   sum(aiModelRequestsTable.totalTokens),
        totalCost:     sum(aiModelRequestsTable.estimatedCost),
        successCount:  sql<number>`sum(case when success then 1 else 0 end)`,
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since24h));

    const [overview30d] = await db
      .select({
        totalRequests: count(),
        totalTokens:   sum(aiModelRequestsTable.totalTokens),
        totalCost:     sum(aiModelRequestsTable.estimatedCost),
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since30d));

    // Distinct models active in last 24h
    const activeModels = await db
      .selectDistinct({ model: aiModelRequestsTable.model })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since24h));

    // ── Per-model performance ─────────────────────────────────────────────────
    const modelPerf = await db
      .select({
        model:       aiModelRequestsTable.model,
        provider:    aiModelRequestsTable.provider,
        requests:    count(),
        success:     sql<number>`sum(case when success then 1 else 0 end)`,
        failures:    sql<number>`sum(case when not success then 1 else 0 end)`,
        totalTokens: sum(aiModelRequestsTable.totalTokens),
        avgLatency:  avg(aiModelRequestsTable.latencyMs),
        totalCost:   sum(aiModelRequestsTable.estimatedCost),
        p95Latency:  sql<number>`percentile_cont(0.95) within group (order by latency_ms)`,
        p99Latency:  sql<number>`percentile_cont(0.99) within group (order by latency_ms)`,
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since30d))
      .groupBy(aiModelRequestsTable.model, aiModelRequestsTable.provider)
      .orderBy(desc(count()));

    // ── Daily token volume (last 30d) ─────────────────────────────────────────
    const dailyTokens = await db
      .select({
        day:         sql<string>`date_trunc('day', created_at)`,
        totalTokens: sum(aiModelRequestsTable.totalTokens),
        totalCost:   sum(aiModelRequestsTable.estimatedCost),
        requests:    count(),
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since30d))
      .groupBy(sql`date_trunc('day', created_at)`)
      .orderBy(sql`date_trunc('day', created_at)`);

    // ── Tokens by feature ─────────────────────────────────────────────────────
    const tokensByFeature = await db
      .select({
        feature:     aiModelRequestsTable.feature,
        totalTokens: sum(aiModelRequestsTable.totalTokens),
        requests:    count(),
        totalCost:   sum(aiModelRequestsTable.estimatedCost),
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since30d))
      .groupBy(aiModelRequestsTable.feature)
      .orderBy(desc(sum(aiModelRequestsTable.totalTokens)));

    // ── Tokens by model ───────────────────────────────────────────────────────
    const tokensByModel = await db
      .select({
        model:       aiModelRequestsTable.model,
        totalTokens: sum(aiModelRequestsTable.totalTokens),
        requests:    count(),
        totalCost:   sum(aiModelRequestsTable.estimatedCost),
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since30d))
      .groupBy(aiModelRequestsTable.model)
      .orderBy(desc(sum(aiModelRequestsTable.totalTokens)));

    // ── Most expensive users ──────────────────────────────────────────────────
    const expensiveUsers = await db
      .select({
        userId:    aiModelRequestsTable.userId,
        totalCost: sum(aiModelRequestsTable.estimatedCost),
        requests:  count(),
        tokens:    sum(aiModelRequestsTable.totalTokens),
      })
      .from(aiModelRequestsTable)
      .where(and(
        gte(aiModelRequestsTable.createdAt, since30d),
        sql`user_id is not null`,
      ))
      .groupBy(aiModelRequestsTable.userId)
      .orderBy(desc(sum(aiModelRequestsTable.estimatedCost)))
      .limit(10);

    // ── Most expensive projects ───────────────────────────────────────────────
    const expensiveProjects = await db
      .select({
        projectId: aiModelRequestsTable.projectId,
        totalCost: sum(aiModelRequestsTable.estimatedCost),
        requests:  count(),
        tokens:    sum(aiModelRequestsTable.totalTokens),
      })
      .from(aiModelRequestsTable)
      .where(and(
        gte(aiModelRequestsTable.createdAt, since30d),
        sql`project_id is not null`,
      ))
      .groupBy(aiModelRequestsTable.projectId)
      .orderBy(desc(sum(aiModelRequestsTable.estimatedCost)))
      .limit(10);

    // ── Routing map: enrich with live stats ───────────────────────────────────
    const routingStats = await db
      .select({
        model:      aiModelRequestsTable.model,
        requests:   count(),
        failures:   sql<number>`sum(case when not success then 1 else 0 end)`,
        avgLatency: avg(aiModelRequestsTable.latencyMs),
      })
      .from(aiModelRequestsTable)
      .where(gte(aiModelRequestsTable.createdAt, since24h))
      .groupBy(aiModelRequestsTable.model);

    const routingStatsMap: Record<string, { requests: number; failures: number; avgLatency: number }> = {};
    for (const row of routingStats) {
      routingStatsMap[row.model] = {
        requests:   Number(row.requests),
        failures:   Number(row.failures),
        avgLatency: Math.round(Number(row.avgLatency) || 0),
      };
    }

    const routingMapWithStats = ROUTING_MAP.map(entry => ({
      ...entry,
      ...(routingStatsMap[entry.model] ?? { requests: 0, failures: 0, avgLatency: 0 }),
    }));

    // ── Auto-alerts ───────────────────────────────────────────────────────────
    const autoAlerts: Array<{ type: string; severity: string; title: string; message: string }> = [];

    for (const row of modelPerf) {
      const total    = Number(row.requests);
      const failures = Number(row.failures);
      const avgLat   = Math.round(Number(row.avgLatency) || 0);
      const failRate = total > 0 ? failures / total : 0;
      const shortModel = row.model.split("/").pop() ?? row.model;

      if (failRate >= ALERT_THRESHOLDS.failureRateCritical) {
        autoAlerts.push({ type: "failure_rate_critical", severity: "critical", title: `Critical Failure Rate: ${shortModel}`, message: `${Math.round(failRate * 100)}% failure rate on ${shortModel} (${failures}/${total} requests failed in 30d).` });
      } else if (failRate >= ALERT_THRESHOLDS.failureRateWarning) {
        autoAlerts.push({ type: "failure_rate_warning", severity: "warning", title: `Elevated Failure Rate: ${shortModel}`, message: `${Math.round(failRate * 100)}% failure rate on ${shortModel}.` });
      }

      if (avgLat >= ALERT_THRESHOLDS.avgLatencyCritical) {
        autoAlerts.push({ type: "latency_critical", severity: "critical", title: `Critical Latency: ${shortModel}`, message: `Average latency of ${(avgLat / 1000).toFixed(1)}s on ${shortModel} (threshold: ${ALERT_THRESHOLDS.avgLatencyCritical / 1000}s).` });
      } else if (avgLat >= ALERT_THRESHOLDS.avgLatencyWarning) {
        autoAlerts.push({ type: "latency_warning", severity: "warning", title: `High Latency: ${shortModel}`, message: `Average latency of ${(avgLat / 1000).toFixed(1)}s on ${shortModel}.` });
      }
    }

    const tokensToday = Number(overview24h.totalTokens ?? 0);
    if (tokensToday >= ALERT_THRESHOLDS.tokensPerDayWarning) {
      autoAlerts.push({ type: "token_spike", severity: "warning", title: "Token Usage Spike", message: `${tokensToday.toLocaleString()} tokens consumed today (threshold: ${ALERT_THRESHOLDS.tokensPerDayWarning.toLocaleString()}).` });
    }

    const costToday = Number(overview24h.totalCost ?? 0);
    if (costToday >= ALERT_THRESHOLDS.dailyCostWarning) {
      autoAlerts.push({ type: "cost_spike", severity: "warning", title: "Daily Cost Alert", message: `Estimated cost today is $${costToday.toFixed(4)} (threshold: $${ALERT_THRESHOLDS.dailyCostWarning}).` });
    }

    const monthlyEstimate = Number(overview30d.totalCost ?? 0);

    res.json({
      overview: {
        totalRequests24h:  Number(overview24h.totalRequests ?? 0),
        totalTokensToday:  tokensToday,
        estimatedCostToday: costToday,
        activeModels24h:   activeModels.length,
        successRate24h:    Number(overview24h.totalRequests ?? 0) > 0
          ? Math.round((Number(overview24h.successCount ?? 0) / Number(overview24h.totalRequests)) * 100)
          : 100,
        totalRequests30d:  Number(overview30d.totalRequests ?? 0),
        totalTokens30d:    Number(overview30d.totalTokens ?? 0),
        estimatedCost30d:  Number(overview30d.totalCost ?? 0),
      },
      modelPerformance: modelPerf.map(r => ({
        model:       r.model,
        provider:    r.provider,
        requests:    Number(r.requests),
        success:     Number(r.success),
        failures:    Number(r.failures),
        successPct:  Number(r.requests) > 0 ? Math.round((Number(r.success) / Number(r.requests)) * 100) : 100,
        avgLatencyMs: Math.round(Number(r.avgLatency) || 0),
        p95LatencyMs: Math.round(Number(r.p95Latency) || 0),
        p99LatencyMs: Math.round(Number(r.p99Latency) || 0),
        totalTokens: Number(r.totalTokens ?? 0),
        estimatedCost: Number(r.totalCost ?? 0),
      })),
      dailyTokens: dailyTokens.map(r => ({
        day:         r.day,
        totalTokens: Number(r.totalTokens ?? 0),
        totalCost:   Number(r.totalCost ?? 0),
        requests:    Number(r.requests),
      })),
      tokensByFeature: tokensByFeature.map(r => ({
        feature:     r.feature,
        totalTokens: Number(r.totalTokens ?? 0),
        requests:    Number(r.requests),
        totalCost:   Number(r.totalCost ?? 0),
      })),
      tokensByModel: tokensByModel.map(r => ({
        model:       r.model,
        totalTokens: Number(r.totalTokens ?? 0),
        requests:    Number(r.requests),
        totalCost:   Number(r.totalCost ?? 0),
      })),
      costIntelligence: {
        estimatedMonthlySpend: monthlyEstimate,
        estimatedAnnualSpend:  monthlyEstimate * 12,
        mostExpensiveUsers:    expensiveUsers.map(r => ({ userId: r.userId, totalCost: Number(r.totalCost ?? 0), requests: Number(r.requests), tokens: Number(r.tokens ?? 0) })),
        mostExpensiveProjects: expensiveProjects.map(r => ({ projectId: r.projectId, totalCost: Number(r.totalCost ?? 0), requests: Number(r.requests), tokens: Number(r.tokens ?? 0) })),
      },
      routingMap: routingMapWithStats,
      alerts: autoAlerts,
      meta: { computedAt: new Date().toISOString() },
    });
  } catch (err) {
    logger.error({ err }, "[admin-ai-models] Failed to compute AI model stats");
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
