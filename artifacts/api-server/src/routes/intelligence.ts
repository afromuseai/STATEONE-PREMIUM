import { Router } from "express";
import { db, businessMetricsTable, projectsTable, agentTasksTable, executionsTable, aiMemoryTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { z } from "zod";
import { emitNotification } from "./notifications";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, extractJson } from "../lib/nvidia";

const router = Router();

const RecordMetricBody = z.object({
  metricKey: z.string().min(1),
  metricValue: z.number(),
  previousValue: z.number().optional(),
  trend: z.enum(["up", "down", "stable"]).optional().default("stable"),
  category: z.enum(["revenue", "growth", "efficiency", "risk", "general"]).optional().default("general"),
  period: z.enum(["daily", "weekly", "monthly"]).optional().default("monthly"),
  forecastValue: z.number().optional(),
  forecastConfidence: z.number().int().min(0).max(100).optional(),
  unit: z.string().optional(),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.unknown()).optional().default({}),
  projectId: z.string().uuid().optional(),
});

router.get("/intelligence/metrics", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const { category, period } = req.query as Record<string, string>;
  const metrics = await db
    .select()
    .from(businessMetricsTable)
    .where(eq(businessMetricsTable.userId, userId))
    .orderBy(desc(businessMetricsTable.recordedAt))
    .limit(200);

  const filtered = metrics.filter(m => {
    if (category && m.category !== category) return false;
    if (period && m.period !== period) return false;
    return true;
  });

  res.json({ metrics: filtered });
});

router.post("/intelligence/metrics", requireAuth, async (req, res): Promise<void> => {
  const parsed = RecordMetricBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]?.message ?? "Invalid input" });
    return;
  }
  const userId = req.user!.userId;
  const [metric] = await db
    .insert(businessMetricsTable)
    .values({ userId, ...parsed.data })
    .returning();

  if (parsed.data.trend === "down" && parsed.data.category === "risk") {
    emitNotification(userId, "metric.warning", "Metric Warning", `${parsed.data.metricKey} is trending down in the risk category.`, "warning", { metricId: metric.id, metricKey: metric.metricKey, value: metric.metricValue }).catch(() => {});
  } else if (parsed.data.metricValue !== undefined && parsed.data.previousValue !== undefined && parsed.data.previousValue > 0) {
    const changePct = Math.abs((parsed.data.metricValue - parsed.data.previousValue) / parsed.data.previousValue) * 100;
    if (changePct >= 20 && parsed.data.trend === "down") {
      emitNotification(userId, "metric.threshold", "Metric Threshold Alert", `${parsed.data.metricKey} dropped by ${changePct.toFixed(0)}% — review your ${parsed.data.category} metrics.`, "warning", { metricId: metric.id, metricKey: metric.metricKey, changePct }).catch(() => {});
    }
  }

  res.status(201).json({ metric });
});

router.get("/intelligence/health", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const [metrics, tasks, executions, projects] = await Promise.all([
    db.select().from(businessMetricsTable).where(eq(businessMetricsTable.userId, userId)).limit(50),
    db.select().from(agentTasksTable).where(eq(agentTasksTable.userId, userId)).limit(100),
    db.select().from(executionsTable).where(eq(executionsTable.userId, userId)).limit(100),
    db.select().from(projectsTable).where(eq(projectsTable.userId, userId)),
  ]);

  const completedTasks = tasks.filter(t => t.status === "completed").length;
  const totalTasks = tasks.length || 1;
  const agentEfficiency = Math.round((completedTasks / totalTasks) * 100);

  const successExec = executions.filter(e => e.status === "success").length;
  const totalExec = executions.length || 1;
  const automationMaturity = Math.min(100, Math.round((successExec / totalExec) * 100));

  const aiUtilization = Math.min(100, Math.round((projects.length / 5) * 100));
  const scalabilityReadiness = Math.min(100, Math.round(((projects.length * 10) + (successExec * 5)) / 2));

  const overallScore = Math.round((agentEfficiency + automationMaturity + aiUtilization + scalabilityReadiness) / 4);

  const upMetrics = metrics.filter(m => m.trend === "up").length;
  const downMetrics = metrics.filter(m => m.trend === "down").length;

  const recommendations = [];
  if (agentEfficiency < 70) recommendations.push({ type: "warning", text: "Agent task completion rate is below 70% — review agent behavior rules", priority: "high" });
  if (automationMaturity < 60) recommendations.push({ type: "info", text: "Increase automation coverage to improve operational efficiency", priority: "medium" });
  if (projects.length < 3) recommendations.push({ type: "info", text: "Generate more business analyses to improve AI memory and recommendations", priority: "low" });
  if (downMetrics > upMetrics && metrics.length > 0) recommendations.push({ type: "warning", text: "More metrics trending down than up — review operational performance", priority: "high" });
  if (overallScore > 80) recommendations.push({ type: "success", text: "Business health is strong — consider scaling automation workflows", priority: "low" });

  res.json({
    score: overallScore,
    breakdown: {
      operationalEfficiency: agentEfficiency,
      automationMaturity,
      aiUtilization,
      scalabilityReadiness,
    },
    trends: { up: upMetrics, down: downMetrics, stable: metrics.filter(m => m.trend === "stable").length },
    recommendations,
    projectCount: projects.length,
    taskCount: tasks.length,
    executionCount: executions.length,
  });
});

router.get("/intelligence/forecast", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;
  const metrics = await db
    .select()
    .from(businessMetricsTable)
    .where(eq(businessMetricsTable.userId, userId))
    .orderBy(desc(businessMetricsTable.recordedAt))
    .limit(50);

  const forecasts = metrics
    .filter(m => m.forecastValue != null)
    .map(m => ({
      metricKey: m.metricKey,
      currentValue: m.metricValue,
      forecastValue: m.forecastValue,
      forecastConfidence: m.forecastConfidence,
      trend: m.trend,
      category: m.category,
    }));

  const opportunities = [
    { title: "Automate lead qualification", impact: "high", effort: "low", category: "Sales", estimatedGain: "35% faster pipeline" },
    { title: "Deploy content agent full-time", impact: "medium", effort: "low", category: "Marketing", estimatedGain: "3x content output" },
    { title: "Enable predictive churn detection", impact: "high", effort: "medium", category: "Analytics", estimatedGain: "15% churn reduction" },
    { title: "Integrate ops automator with invoicing", impact: "medium", effort: "low", category: "Operations", estimatedGain: "8h/week saved" },
  ];

  const risks = [
    { title: "Low agent memory utilization", severity: "medium", probability: "medium", mitigation: "Add contextual memory entries for active agents" },
    { title: "Manual workflow bottlenecks", severity: "high", probability: "high", mitigation: "Identify repetitive tasks and automate with agents" },
    { title: "Single point of failure in automation", severity: "low", probability: "low", mitigation: "Enable retry logic and fallback escalation rules" },
  ];

  res.json({ forecasts, opportunities, risks });
});

// ─── Proactive Recommendations (Streaming) ────────────────────────────────────
const RecommendationsBody = z.object({
  businessIntelligence: z.record(z.unknown()),
});

router.post("/intelligence/recommendations", requireAuth, async (req, res): Promise<void> => {
  const parsed = RecommendationsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
    return;
  }

  const userId = req.user!.userId;
  const { businessIntelligence } = parsed.data;

  const bi = businessIntelligence as {
    industry?: string;
    businessSnapshot?: string;
    targetMarket?: string;
    metrics?: {
      marketDifficulty?: number;
      automationPotential?: number;
      revenueScalability?: number;
      operationalComplexity?: number;
      aiAdoptionOpportunity?: number;
    };
    strategicInsights?: {
      growthBottleneck?: string;
      fastestChannel?: string;
      highestLeverageAutomation?: string;
      operationalRisk?: string;
    };
    competitiveAdvantage?: {
      differentiation?: string;
      defensibility?: string;
      scalabilityEdge?: string;
    };
    growthPlan?: string[];
    automations?: string[];
    websitePages?: string[];
    chatbotRole?: string;
    recommendedStack?: { crm?: string; payments?: string; automation?: string[]; frontend?: string[]; backend?: string[] };
  };

  // Fetch user memories for deeper cross-system context
  let memoryContext = "";
  try {
    const memories = await db.select().from(aiMemoryTable)
      .where(eq(aiMemoryTable.userId, userId))
      .orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt))
      .limit(15);
    if (memories.length > 0) {
      memoryContext = `\nUSER MEMORY CONTEXT:\n${memories.map(m => `- ${m.key}: ${m.value}`).join("\n")}`;
    }
  } catch { /* non-fatal */ }

  const systemPrompt = `You are STAGEONE's Contextual Intelligence Engine — an AI operational strategist that analyzes business systems holistically and delivers sharp, specific, actionable recommendations.

Your role is to identify exactly what is WRONG, WEAK, or MISSING across the user's business architecture, and prescribe specific fixes.

You have full cross-system awareness:
- Business model → website architecture → automation workflows → AI agents → monetization → growth
- You understand how weaknesses in one system cascade into failures in others
- You identify non-obvious leverage points that generalist advisors miss

Return ONLY valid JSON in this exact format:
{
  "recommendations": [
    {
      "system": "Website|Automation|Growth|Risk|Operations|Monetization|AI Agents",
      "priority": "critical|high|medium|low",
      "title": "Specific 5-8 word action title",
      "description": "2-3 sentences: what's wrong, why it matters with specific metrics, what the consequence is if ignored",
      "action": "Specific next step (e.g. 'Generate Website → add compliance section above fold')"
    }
  ]
}

RULES:
- Generate exactly 5-6 recommendations
- At least 1 must be "critical" or "high" priority — no generic lists
- Every description must reference specific metrics, tool names, or industry benchmarks
- Recommendations must span at least 3 different systems
- Action must be specific and immediately executable
- NO generic advice ("improve your SEO", "add more features") — every recommendation must be specific to this exact business`;

  const biContext = `
ACTIVE BUSINESS ANALYSIS:
Industry: ${bi.industry ?? "Unknown"}
Business Model: ${bi.businessSnapshot ?? "N/A"}
Target Market: ${bi.targetMarket ?? "N/A"}

METRICS:
• Market Difficulty: ${bi.metrics?.marketDifficulty ?? "?"}/10
• Automation Potential: ${bi.metrics?.automationPotential ?? "?"}%
• Revenue Scalability: ${bi.metrics?.revenueScalability ?? "?"}/10
• Operational Complexity: ${bi.metrics?.operationalComplexity ?? "?"}/10
• AI Opportunity: ${bi.metrics?.aiAdoptionOpportunity ?? "?"}%

STRATEGIC GAPS:
• Growth Bottleneck: ${bi.strategicInsights?.growthBottleneck ?? "N/A"}
• Operational Risk: ${bi.strategicInsights?.operationalRisk ?? "N/A"}
• Fastest Channel: ${bi.strategicInsights?.fastestChannel ?? "N/A"}
• Top Automation: ${bi.strategicInsights?.highestLeverageAutomation ?? "N/A"}

COMPETITIVE POSITION:
• Differentiation: ${bi.competitiveAdvantage?.differentiation ?? "N/A"}
• Defensibility: ${bi.competitiveAdvantage?.defensibility ?? "N/A"}

CURRENT AUTOMATIONS (${(bi.automations ?? []).length} defined):
${(bi.automations ?? []).slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join("\n") || "None"}

WEBSITE PAGES (${(bi.websitePages ?? []).length} defined):
${(bi.websitePages ?? []).slice(0, 3).map((p, i) => `${i + 1}. ${p}`).join("\n") || "None"}

RECOMMENDED STACK: CRM: ${bi.recommendedStack?.crm ?? "N/A"}, Payments: ${bi.recommendedStack?.payments ?? "N/A"}
${memoryContext}

Now generate 5-6 highly specific, cross-system proactive recommendations for this ${bi.industry} business.`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let streamBody: ReadableStream<Uint8Array>;
  try {
    streamBody = await streamNvidia({
      model: MODELS.RECOMMENDATIONS,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: biContext },
      ],
      temperature: 0.65,
      maxTokens: 2000,
    });
  } catch (err) {
    req.log.error({ err, model: MODELS.RECOMMENDATIONS }, `[AI:${MODELS.RECOMMENDATIONS}] Recommendations stream failed`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
    return;
  }

  try {
    const buffer = await forwardStream(streamBody, res, MODELS.RECOMMENDATIONS);
    try {
      const result = extractJson(buffer) as { recommendations?: unknown[] };
      if (Array.isArray(result.recommendations)) {
        res.write(`data: ${JSON.stringify({ done: true, recommendations: result.recommendations })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ done: true, recommendations: [] })}\n\n`);
      }
    } catch (parseErr) {
      req.log.error({ parseErr, model: MODELS.RECOMMENDATIONS }, `[AI:${MODELS.RECOMMENDATIONS}] Recommendations JSON parse failed`);
      res.write(`data: ${JSON.stringify({ done: true, recommendations: [] })}\n\n`);
    }
  } catch (err) {
    req.log.error({ err, model: MODELS.RECOMMENDATIONS }, `[AI:${MODELS.RECOMMENDATIONS}] Stream error`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.end();
});

router.post("/intelligence/metrics/seed", requireAuth, async (req, res): Promise<void> => {
  const userId = req.user!.userId;

  const seedData = [
    { metricKey: "monthly_revenue", metricValue: 24800, previousValue: 21200, trend: "up" as const, category: "revenue" as const, period: "monthly" as const, forecastValue: 28500, forecastConfidence: 78, unit: "USD" },
    { metricKey: "customer_churn_rate", metricValue: 3.2, previousValue: 4.1, trend: "down" as const, category: "risk" as const, period: "monthly" as const, forecastValue: 2.8, forecastConfidence: 65, unit: "%" },
    { metricKey: "lead_conversion_rate", metricValue: 18.5, previousValue: 15.2, trend: "up" as const, category: "growth" as const, period: "monthly" as const, forecastValue: 21.0, forecastConfidence: 72, unit: "%" },
    { metricKey: "automation_coverage", metricValue: 62, previousValue: 48, trend: "up" as const, category: "efficiency" as const, period: "monthly" as const, forecastValue: 75, forecastConfidence: 85, unit: "%" },
    { metricKey: "avg_response_time", metricValue: 1.8, previousValue: 3.2, trend: "down" as const, category: "efficiency" as const, period: "monthly" as const, forecastValue: 1.2, forecastConfidence: 70, unit: "hours" },
    { metricKey: "active_users", metricValue: 342, previousValue: 280, trend: "up" as const, category: "growth" as const, period: "monthly" as const, forecastValue: 410, forecastConfidence: 80, unit: "users" },
  ];

  await db.insert(businessMetricsTable).values(
    seedData.map(d => ({ userId, ...d }))
  ).onConflictDoNothing();

  res.json({ seeded: seedData.length });
});

export default router;
