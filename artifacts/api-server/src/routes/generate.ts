import { Router } from "express";
import { db, aiMemoryTable, projectsTable, subscriptionsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream } from "../lib/nvidia";

const router = Router();

// ─── Industry-Specific Reasoning Stages ──────────────────────────────────────
const INDUSTRY_REASONING: Record<string, string[]> = {
  Fintech: [
    "Mapping regulatory compliance requirements...",
    "Profiling onboarding friction patterns...",
    "Evaluating enterprise credibility signals...",
    "Benchmarking fintech competitive landscape...",
    "Modeling ARR growth trajectory...",
    "Recommending banking-grade infrastructure...",
  ],
  Cybersecurity: [
    "Mapping threat intelligence requirements...",
    "Profiling enterprise trust architecture...",
    "Evaluating SOC2/ISO compliance posture...",
    "Analyzing security competitive positioning...",
    "Detecting operational scalability risks...",
    "Recommending security-first infrastructure...",
  ],
  SaaS: [
    "Analyzing product-led growth signals...",
    "Profiling ICP and market segmentation...",
    "Evaluating PLG vs. sales-led motion...",
    "Benchmarking SaaS competitive moats...",
    "Modeling ARR expansion trajectory...",
    "Recommending dev-grade infrastructure...",
  ],
  Healthcare: [
    "Evaluating HIPAA compliance requirements...",
    "Profiling clinical credibility signals...",
    "Analyzing patient acquisition channels...",
    "Benchmarking telehealth market position...",
    "Modeling patient growth trajectory...",
    "Recommending HIPAA-compliant infrastructure...",
  ],
  Education: [
    "Analyzing learning outcome metrics...",
    "Profiling student acquisition channels...",
    "Evaluating cohort conversion patterns...",
    "Benchmarking EdTech competitive landscape...",
    "Modeling enrollment growth trajectory...",
    "Recommending scalable learning infrastructure...",
  ],
  Marketplace: [
    "Analyzing dual-sided trust dynamics...",
    "Profiling buyer and seller acquisition...",
    "Evaluating supply-demand liquidity...",
    "Benchmarking marketplace competitive moats...",
    "Modeling GMV growth trajectory...",
    "Recommending marketplace infrastructure...",
  ],
  Agency: [
    "Evaluating portfolio positioning signals...",
    "Profiling enterprise client acquisition...",
    "Analyzing service differentiation vectors...",
    "Benchmarking agency market positioning...",
    "Modeling retainer growth trajectory...",
    "Recommending agency operations infrastructure...",
  ],
  "E-commerce": [
    "Analyzing DTC conversion signals...",
    "Profiling customer acquisition channels...",
    "Evaluating AOV and LTV patterns...",
    "Benchmarking e-commerce competitive landscape...",
    "Modeling revenue growth trajectory...",
    "Recommending e-commerce infrastructure...",
  ],
  default: [
    "Profiling industry landscape...",
    "Analyzing business model structure...",
    "Evaluating strategic opportunities...",
    "Benchmarking competitive position...",
    "Mapping growth trajectory...",
    "Recommending infrastructure stack...",
  ],
};

// ─── Cross-System Awareness Context Builder ───────────────────────────────────
async function buildCrossSystemContext(userId: string): Promise<string> {
  let context = "";

  try {
    const [memories, recentProjects] = await Promise.all([
      db.select().from(aiMemoryTable).where(eq(aiMemoryTable.userId, userId))
        .orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt)).limit(20),
      db.select({
        id: projectsTable.id,
        title: projectsTable.title,
        businessIdea: projectsTable.businessIdea,
        output: projectsTable.output,
        createdAt: projectsTable.createdAt,
      }).from(projectsTable).where(eq(projectsTable.userId, userId))
        .orderBy(desc(projectsTable.createdAt)).limit(3),
    ]);

    if (memories.length > 0) {
      const byImportance = memories.filter(m => m.importance >= 4);
      const rest = memories.filter(m => m.importance < 4);
      const sorted = [...byImportance, ...rest];
      const memoryLines = sorted.map(m => `- [${m.source}|importance:${m.importance}] ${m.key}: ${m.value}`).join("\n");
      context += `\n\nUSER INTELLIGENCE MEMORY (${memories.length} entries — apply all context):\n${memoryLines}`;
    }

    if (recentProjects.length > 0) {
      const projectLines = recentProjects.map(p => {
        const output = p.output as Record<string, unknown> | null;
        const industry = output?.industry ?? "Unknown";
        return `- "${p.title}" (${industry}): ${p.businessIdea?.slice(0, 120) ?? "N/A"}`;
      }).join("\n");
      context += `\n\nPREVIOUS BUSINESS ANALYSES (cross-system awareness):\n${projectLines}\nApply pattern recognition across these to inform current analysis. Identify if this new idea relates to, complements, or competes with prior work.`;
    }
  } catch {
    // Non-fatal — continue without cross-system context
  }

  return context;
}

// ─── Auto-Memory Extraction ────────────────────────────────────────────────────
async function autoSaveMemories(userId: string, data: Record<string, unknown>, idea: string): Promise<void> {
  try {
    const entries: Array<{ key: string; value: string; importance: number }> = [];

    if (data.industry && typeof data.industry === "string") {
      entries.push({ key: "last_industry", value: data.industry, importance: 4 });
      entries.push({ key: `industry_experience_${data.industry.toLowerCase().replace(/\s+/g, "_")}`, value: `Analyzed ${data.industry} business: ${idea.slice(0, 100)}`, importance: 3 });
    }

    const output = data as {
      businessSnapshot?: string;
      strategicInsights?: { growthBottleneck?: string; fastestChannel?: string };
      recommendedStack?: { crm?: string; payments?: string; automation?: string[] };
      metrics?: { automationPotential?: number; revenueScalability?: number };
    };

    if (output.businessSnapshot) {
      entries.push({ key: "last_business_model", value: output.businessSnapshot.slice(0, 200), importance: 5 });
    }
    if (output.strategicInsights?.growthBottleneck) {
      entries.push({ key: "recurring_growth_bottleneck", value: output.strategicInsights.growthBottleneck.slice(0, 200), importance: 4 });
    }
    if (output.strategicInsights?.fastestChannel) {
      entries.push({ key: "proven_growth_channel", value: output.strategicInsights.fastestChannel.slice(0, 200), importance: 3 });
    }
    if (output.recommendedStack?.crm) {
      entries.push({ key: "preferred_crm", value: output.recommendedStack.crm, importance: 3 });
    }
    if (output.recommendedStack?.automation && Array.isArray(output.recommendedStack.automation)) {
      entries.push({ key: "preferred_automation_stack", value: output.recommendedStack.automation.join(", "), importance: 3 });
    }
    if (output.metrics?.automationPotential !== undefined) {
      const level = output.metrics.automationPotential >= 70 ? "high" : output.metrics.automationPotential >= 40 ? "medium" : "low";
      entries.push({ key: "automation_maturity_target", value: `${level} (${output.metrics.automationPotential}% potential)`, importance: 3 });
    }

    for (const entry of entries) {
      await db.insert(aiMemoryTable).values({
        userId,
        key: entry.key,
        value: entry.value,
        importance: entry.importance,
        source: "ai",
        context: { idea: idea.slice(0, 200), auto_extracted: true },
      }).onConflictDoNothing();
    }
  } catch {
    // Non-fatal — memory save failure doesn't affect generation
  }
}

// ─── System Prompt ─────────────────────────────────────────────────────────────
const baseSystemPrompt = `You are STAGEONE, an elite AI Business Operating System staffed by ex-McKinsey, ex-a16z, and ex-YC operators. You maintain deep cross-system awareness — understanding how business models, website structures, automation workflows, AI agents, and monetization systems interconnect.

INDUSTRIES:
SaaS | E-commerce | Healthcare | Cybersecurity | Education | Marketplace | Agency | Fintech | Creator Economy

INTELLIGENCE STANDARDS:
- Reference real named tools, platforms, and companies (e.g. "HubSpot", "Stripe", "Retool", "Segment", "PostHog")
- Include specific metrics, percentages, and timeframes (e.g. "CAC < $120", "60-day payback", "3x NRR")
- Use precise industry terminology (CAC, LTV, NDR, GMV, ARR, churn, payback period)
- Identify non-obvious growth channels and automation opportunities
- Competitive analysis must name real incumbent competitors
- Apply cross-system reasoning: how does the business model affect the website structure? How do automations reduce operational risk?

Return ONLY valid JSON matching this exact schema:
{
  "industry": "SaaS|E-commerce|Healthcare|Cybersecurity|Education|Marketplace|Agency|Fintech|Creator Economy",
  "metrics": {
    "marketDifficulty": 1-10,
    "automationPotential": 1-100,
    "revenueScalability": 1-10,
    "operationalComplexity": 1-10,
    "aiAdoptionOpportunity": 1-100
  },
  "businessSnapshot": "One sentence: specific business model, pricing structure, and primary revenue mechanism with realistic ARR potential",
  "targetMarket": "One sentence: precise ICP with company size, job title, industry vertical, and specific pain point driving purchase",
  "strategicInsights": {
    "growthBottleneck": "Specific constraint with root cause — e.g. 'Long sales cycles (90+ days) driven by multi-stakeholder procurement'",
    "fastestChannel": "Named channel with specific tactic — e.g. 'LinkedIn outbound to VP Ops at 200-2000 person SaaS: 18% reply rate via case study hooks'",
    "highestLeverageAutomation": "Named tool + specific workflow — e.g. 'Clay + Apollo: auto-enrich leads, trigger personalized Outreach sequences on intent signals'",
    "operationalRisk": "Specific vulnerability with probability — e.g. 'Key-person dependency: 70% of revenue from top 3 accounts managed by 1 AE'"
  },
  "competitiveAdvantage": {
    "differentiation": "Specific, measurable differentiator vs named competitors — e.g. '40% faster onboarding than Salesforce with no-code config vs Hubspot's 3-week setup'",
    "defensibility": "Named moat type with specific mechanism — e.g. 'Data network effect: proprietary benchmark dataset grows with each customer; 18-month head start'",
    "scalabilityEdge": "Specific leverage point — e.g. 'Usage-based pricing captures value proportional to customer growth; no renegotiation ceiling'"
  },
  "growthPlan": [
    "Phase 1 (0-3mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 2 (3-6mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 3 (6-12mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 4 (12-18mo): [Specific action] via [Named channel/tool] → [Specific metric target]",
    "Phase 5 (18-24mo): [Specific action] via [Named channel/tool] → [Specific metric target]"
  ],
  "websitePages": [
    "Homepage → [specific conversion goal with CTA]",
    "Product/Features → [specific demo or trial trigger]",
    "Pricing → [specific model: per-seat/usage/tier with anchoring]",
    "Case Studies → [specific ROI proof point for ICP]",
    "Blog/SEO → [specific keyword cluster and content angle]"
  ],
  "chatbotRole": "Specific function (e.g. 'Qualify inbound leads using BANT framework') + named integration (e.g. 'Intercom → HubSpot CRM sync') + escalation rule",
  "automations": [
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]",
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]",
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]",
    "[Specific trigger] → [Specific action] via [Named tool] — saves [time/cost estimate]"
  ],
  "recommendedStack": {
    "frontend": ["Named framework", "Named UI lib", "Named hosting platform"],
    "backend": ["Named runtime", "Named database", "Named auth provider"],
    "automation": ["Named tool 1", "Named tool 2", "Named tool 3"],
    "crm": "Named CRM with specific reason",
    "payments": "Named payment platform with specific reason"
  }
}

HARD RULES:
- Every field must contain specific, named tools/metrics/companies — NEVER generic advice
- growthPlan must include timeframes and specific numeric targets
- automations must name the exact tool and quantify the benefit
- competitiveAdvantage must reference real named competitors
- NO filler phrases, NO motivational language, NO vague adjectives`;

router.post("/generate", requireAuth, async (req, res) => {
  try {
    const { idea } = req.body;
    const userId = req.user!.userId;
    const isAdmin = req.user!.isAdmin ?? false;

    if (!idea || typeof idea !== "string" || idea.trim().length === 0) {
      res.status(400).json({ error: "Business idea is required" });
      return;
    }

    if (!process.env.NVIDIA_API_KEY) {
      res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
      return;
    }

    if (!isAdmin) {
      const { getOrCreateSubscription } = await import("./subscriptions");
      const sub = await getOrCreateSubscription(userId);
      if (sub.aiGenerationsUsed >= sub.aiGenerationsLimit) {
        res.status(429).json({
          error: `AI generation limit reached (${sub.aiGenerationsUsed}/${sub.aiGenerationsLimit}). Upgrade your plan to continue.`,
          plan: sub.plan,
          used: sub.aiGenerationsUsed,
          limit: sub.aiGenerationsLimit,
        });
        return;
      }
      await db.update(subscriptionsTable).set({ aiGenerationsUsed: sub.aiGenerationsUsed + 1 }).where(eq(subscriptionsTable.userId, userId));
    }

    // Set SSE headers early so we can stream reasoning events
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    // Emit initial reasoning state
    res.write(`data: ${JSON.stringify({ reasoning: "Initializing industry profiler...", phase: "init" })}\n\n`);

    // Fetch cross-system context (memories + recent projects)
    const crossSystemContext = await buildCrossSystemContext(userId);

    res.write(`data: ${JSON.stringify({ reasoning: "Loading intelligence memory & cross-system context...", phase: "memory" })}\n\n`);

    const systemPrompt = baseSystemPrompt + crossSystemContext;

    let streamBody: ReadableStream<Uint8Array>;
    try {
      streamBody = await streamNvidia({
        model: MODELS.BUSINESS_INTELLIGENCE,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Apply deep cross-system intelligence to analyze this business idea. Consider how every output (website, automations, agents, monetization) interconnects: "${idea}"`,
          },
        ],
        temperature: 0.7,
        maxTokens: 3500,
      });
    } catch (streamErr) {
      req.log.error({ streamErr, model: MODELS.BUSINESS_INTELLIGENCE }, `[AI:${MODELS.BUSINESS_INTELLIGENCE}] Failed to open stream`);
      res.write(`data: ${JSON.stringify({ error: String(streamErr) })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    const reader = streamBody.getReader();

    let contentBuffer = "";
    let lineCarryover = "";
    let industryDetected = false;
    let detectedIndustry = "default";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = lineCarryover + decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        lineCarryover = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;

          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              contentBuffer += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);

              if (!industryDetected && contentBuffer.length > 30) {
                const industryMatch = /"industry"\s*:\s*"([^"]+)"/.exec(contentBuffer);
                if (industryMatch) {
                  detectedIndustry = industryMatch[1];
                  industryDetected = true;
                  const reasoning = INDUSTRY_REASONING[detectedIndustry] ?? INDUSTRY_REASONING.default;
                  res.write(`data: ${JSON.stringify({ reasoningStages: reasoning, industry: detectedIndustry, phase: "industry_detected" })}\n\n`);
                }
              }
            }
          } catch {
            // Incomplete JSON fragment — skip
          }
        }
      }

      if (lineCarryover.startsWith("data: ")) {
        const data = lineCarryover.slice(6).trim();
        if (data && data !== "[DONE]") {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) contentBuffer += content;
          } catch { /* ignore */ }
        }
      }

      let cleanContent = contentBuffer.trim();
      if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
      else if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();

      try {
        const finalData = JSON.parse(cleanContent);

        res.write(`data: ${JSON.stringify({ done: true, data: finalData })}\n\n`);
      } catch (parseErr) {
        req.log.error({ parseErr, contentBuffer: contentBuffer.slice(0, 200) }, "Final JSON parse failed");
        res.write(`data: ${JSON.stringify({ error: "Failed to parse AI response — please try again" })}\n\n`);
      }

      res.end();
    } catch (streamErr) {
      req.log.error({ streamErr }, "Stream read error");
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: "Stream interrupted — please try again" })}\n\n`);
        res.end();
      }
    }
  } catch (error) {
    req.log.error({ error }, "Generate API error");
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: "Internal server error" })}\n\n`);
      res.end();
    }
  }
});

export default router;
