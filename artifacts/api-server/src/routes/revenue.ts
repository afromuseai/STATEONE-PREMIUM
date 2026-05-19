import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import { revenueSignalsTable } from "@workspace/db/schema";
import { eq, desc, avg, sum, count } from "drizzle-orm";

const router = Router();

function computeRevenueScore(metrics: {
  marketDifficulty?: number;
  automationPotential?: number;
  revenueScalability?: number;
  operationalComplexity?: number;
  aiAdoptionOpportunity?: number;
}): {
  overallRevenueScore: number;
  tier: string;
  priority: number;
  decisionType: string;
  estimatedArrUplift: number;
  conversionImpact: number;
  automationSavings: number;
  leadGenImprovement: number;
  engagementIncrease: number;
  confidenceScore: number;
} {
  const scalability = metrics.revenueScalability ?? 5;
  const automation = metrics.automationPotential ?? 50;
  const aiOpportunity = metrics.aiAdoptionOpportunity ?? 50;
  const difficulty = metrics.marketDifficulty ?? 5;

  const overallRevenueScore = Math.round(
    (scalability * 10 * 0.35) +
    (automation * 0.25) +
    (aiOpportunity * 0.25) +
    ((10 - difficulty) * 10 * 0.15)
  );

  const tier = overallRevenueScore >= 75 ? "high"
    : overallRevenueScore >= 50 ? "medium"
    : "low";

  const priority = overallRevenueScore >= 75 ? 1
    : overallRevenueScore >= 55 ? 2
    : overallRevenueScore >= 35 ? 3
    : 4;

  const decisionType = overallRevenueScore >= 80 ? "EXECUTE"
    : overallRevenueScore >= 55 ? "SUGGEST"
    : overallRevenueScore >= 30 ? "QUEUE"
    : "IGNORE";

  const estimatedArrUplift = Math.round(scalability * 125000 * (automation / 100));
  const conversionImpact = Math.round(aiOpportunity * 0.3);
  const automationSavings = Math.round(automation * 1200);
  const leadGenImprovement = Math.round(aiOpportunity * 0.4);
  const engagementIncrease = Math.round((aiOpportunity + automation) / 2 * 0.5);
  const confidenceScore = Math.min(95, Math.round(60 + scalability * 3 + (automation / 10)));

  return {
    overallRevenueScore,
    tier,
    priority,
    decisionType,
    estimatedArrUplift,
    conversionImpact,
    automationSavings,
    leadGenImprovement,
    engagementIncrease,
    confidenceScore,
  };
}

router.post("/revenue/signals", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId, industry, businessSnapshot, sourceMetrics } = req.body;

    const scores = computeRevenueScore(sourceMetrics ?? {});

    const [entry] = await db.insert(revenueSignalsTable).values({
      userId,
      projectId: projectId ?? null,
      industry: industry ?? "General",
      businessSnapshot: businessSnapshot ?? null,
      ...scores,
      sourceMetrics: sourceMetrics ?? {},
      signals: {
        scored_at: new Date().toISOString(),
        model: "revenue-intelligence-v2",
      },
    }).returning();

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "Failed to record revenue signal" });
  }
});

router.get("/revenue/signals", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const signals = await db
      .select()
      .from(revenueSignalsTable)
      .where(eq(revenueSignalsTable.userId, userId))
      .orderBy(desc(revenueSignalsTable.createdAt))
      .limit(50);
    res.json({ signals });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch revenue signals" });
  }
});

router.get("/revenue/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const signals = await db
      .select()
      .from(revenueSignalsTable)
      .where(eq(revenueSignalsTable.userId, userId))
      .orderBy(desc(revenueSignalsTable.createdAt));

    if (signals.length === 0) {
      return res.json({
        totalSignals: 0,
        avgRevenueScore: 0,
        totalEstimatedArrUplift: 0,
        avgConversionImpact: 0,
        avgAutomationSavings: 0,
        highTierCount: 0,
        mediumTierCount: 0,
        lowTierCount: 0,
        executeCount: 0,
        suggestCount: 0,
        topIndustry: null,
        recentSignals: [],
        priorityBreakdown: { critical: 0, high: 0, medium: 0, low: 0 },
      });
    }

    const avgRevenueScore = Math.round(
      signals.reduce((s, r) => s + (r.overallRevenueScore ?? 0), 0) / signals.length
    );
    const totalEstimatedArrUplift = signals.reduce((s, r) => s + (r.estimatedArrUplift ?? 0), 0);
    const avgConversionImpact = Math.round(
      signals.reduce((s, r) => s + (r.conversionImpact ?? 0), 0) / signals.length
    );
    const avgAutomationSavings = Math.round(
      signals.reduce((s, r) => s + (r.automationSavings ?? 0), 0) / signals.length
    );

    const highTierCount = signals.filter(r => r.tier === "high").length;
    const mediumTierCount = signals.filter(r => r.tier === "medium").length;
    const lowTierCount = signals.filter(r => r.tier === "low").length;
    const executeCount = signals.filter(r => r.decisionType === "EXECUTE").length;
    const suggestCount = signals.filter(r => r.decisionType === "SUGGEST").length;

    const industryCounts: Record<string, number> = {};
    for (const s of signals) {
      industryCounts[s.industry] = (industryCounts[s.industry] ?? 0) + 1;
    }
    const topIndustry = Object.entries(industryCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    const priorityBreakdown = {
      critical: signals.filter(r => r.priority === 1).length,
      high: signals.filter(r => r.priority === 2).length,
      medium: signals.filter(r => r.priority === 3).length,
      low: signals.filter(r => r.priority === 4).length,
    };

    res.json({
      totalSignals: signals.length,
      avgRevenueScore,
      totalEstimatedArrUplift,
      avgConversionImpact,
      avgAutomationSavings,
      highTierCount,
      mediumTierCount,
      lowTierCount,
      executeCount,
      suggestCount,
      topIndustry,
      recentSignals: signals.slice(0, 10),
      priorityBreakdown,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch revenue summary" });
  }
});

router.post("/revenue/score", requireAuth, async (req, res) => {
  try {
    const { sourceMetrics } = req.body;
    const scores = computeRevenueScore(sourceMetrics ?? {});
    res.json(scores);
  } catch (err) {
    res.status(500).json({ error: "Failed to compute revenue score" });
  }
});

export default router;
