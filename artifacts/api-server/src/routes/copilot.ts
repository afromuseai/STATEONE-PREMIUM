import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, projectsTable, agentsTable, aiMemoryTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";

import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream } from "../lib/nvidia";

const router = Router();

const WorkspaceContextSchema = z.object({
  activePage: z.string().optional(),
  activePagePath: z.string().optional(),
  currentProject: z.object({
    id: z.string(),
    title: z.string(),
    businessIdea: z.string(),
    hasBi: z.boolean(),
    hasWebsite: z.boolean(),
  }).nullable().optional(),
  modules: z.object({
    businessIntelligence: z.boolean(),
    website: z.boolean(),
    chatbot: z.boolean(),
    automation: z.boolean(),
  }).optional(),
  projectCount: z.number().optional(),
  activeAgents: z.number().optional(),
}).optional();

const CopilotBody = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  businessContext: z.unknown().optional(),
  workspaceContext: WorkspaceContextSchema,
});

router.post("/copilot", requireAuth, async (req, res): Promise<void> => {
  const parsed = CopilotBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
    return;
  }

  const userId = req.user!.userId;
  const { messages, businessContext, workspaceContext } = parsed.data;

  const [projects, agents, memories] = await Promise.all([
    db.select({
      id: projectsTable.id,
      title: projectsTable.title,
      businessIdea: projectsTable.businessIdea,
      createdAt: projectsTable.createdAt,
      hasOutput: projectsTable.output,
      hasWebsite: projectsTable.websiteOutput,
    }).from(projectsTable).where(eq(projectsTable.userId, userId)).orderBy(desc(projectsTable.createdAt)).limit(5),
    db.select({
      id: agentsTable.id,
      name: agentsTable.name,
      category: agentsTable.category,
      isActive: agentsTable.isActive,
    }).from(agentsTable).where(eq(agentsTable.userId, userId)).limit(10),
    db.select().from(aiMemoryTable).where(eq(aiMemoryTable.userId, userId))
      .orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt)).limit(15),
  ]);

  const bi = businessContext as {
    industry?: string;
    metrics?: {
      marketDifficulty?: number;
      automationPotential?: number;
      revenueScalability?: number;
      operationalComplexity?: number;
      aiAdoptionOpportunity?: number;
    };
    businessSnapshot?: string;
    targetMarket?: string;
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
    recommendedStack?: { crm?: string; payments?: string; automation?: string[] };
  } | null | undefined;

  const activeAgents = agents.filter(a => a.isActive);
  const ws = workspaceContext;
  const wsProject = ws?.currentProject;
  const wsModules = ws?.modules;

  // ─── Business context as natural prose (not structured labels) ───────────────
  let businessBlock = "";
  if (bi) {
    const parts: string[] = [];

    if (bi.businessSnapshot && bi.industry) {
      parts.push(`They're building ${bi.businessSnapshot} in the ${bi.industry} space, targeting ${bi.targetMarket ?? "their target market"}.`);
    }

    const si = bi.strategicInsights;
    if (si?.growthBottleneck) parts.push(`The main growth constraint right now is ${si.growthBottleneck.toLowerCase()}.`);
    if (si?.fastestChannel) parts.push(`The fastest channel available to them is ${si.fastestChannel.toLowerCase()}.`);
    if (si?.operationalRisk) parts.push(`Biggest operational risk: ${si.operationalRisk.toLowerCase()}.`);
    if (si?.highestLeverageAutomation) parts.push(`Highest-leverage automation they could run: ${si.highestLeverageAutomation.toLowerCase()}.`);

    const ca = bi.competitiveAdvantage;
    if (ca?.differentiation) parts.push(`Their differentiation is ${ca.differentiation.toLowerCase()}.`);
    if (ca?.scalabilityEdge) parts.push(`${ca.scalabilityEdge}.`);

    const m = bi.metrics;
    if (m) {
      const flags: string[] = [];
      if ((m.automationPotential ?? 100) < 50) flags.push(`automation maturity is low (${m.automationPotential}%)`);
      if ((m.revenueScalability ?? 10) < 6) flags.push(`revenue scalability has a ceiling (${m.revenueScalability}/10)`);
      if ((m.marketDifficulty ?? 0) >= 7) flags.push(`the market is very competitive (difficulty ${m.marketDifficulty}/10) — differentiation matters a lot`);
      if ((m.aiAdoptionOpportunity ?? 0) > 70) flags.push(`there's significant untapped AI leverage (${m.aiAdoptionOpportunity}%)`);
      if (flags.length > 0) parts.push(`Worth knowing: ${flags.join("; ")}.`);
    }

    if (bi.growthPlan?.length) {
      parts.push(`Growth plan phases: ${bi.growthPlan.slice(0, 3).join(" → ")}.`);
    }

    if (bi.recommendedStack?.crm || bi.recommendedStack?.payments) {
      parts.push(`Recommended stack: ${[bi.recommendedStack.crm, bi.recommendedStack.payments, ...(bi.recommendedStack.automation ?? [])].filter(Boolean).join(", ")}.`);
    }

    if (parts.length > 0) {
      businessBlock = `\n[What I know about their business — use this silently, never quote it back or label it]\n${parts.join(" ")}\n[end]`;
    }
  }

  // ─── Memory as natural prose ─────────────────────────────────────────────────
  let memoryBlock = "";
  if (memories.length > 0) {
    const high = memories.filter(m => m.importance >= 4).map(m => `${m.key}: ${m.value}`);
    const normal = memories.filter(m => m.importance < 4).map(m => `${m.key}: ${m.value}`);
    const all = [...high, ...normal];
    memoryBlock = `\n[Previous context I remember about them — use naturally, never list or quote these back]\n${all.join(". ")}\n[end]`;
  }

  // ─── Workspace as natural prose ──────────────────────────────────────────────
  let workspaceBlock = "";
  if (ws) {
    const built: string[] = [];
    const notBuilt: string[] = [];
    if (wsModules?.businessIntelligence) built.push("business analysis"); else notBuilt.push("business analysis");
    if (wsModules?.website) built.push("website"); else notBuilt.push("website");
    if (wsModules?.chatbot) built.push("chatbot"); else notBuilt.push("chatbot");
    if (wsModules?.automation) built.push("automation workflows"); else notBuilt.push("automation workflows");

    const projectLine = wsProject
      ? `They're working on "${wsProject.title}" — the core idea: ${wsProject.businessIdea.slice(0, 200)}`
      : "They haven't created a project yet.";

    const progressLine = built.length > 0
      ? `So far they've built: ${built.join(", ")}. Still to do: ${notBuilt.join(", ")}.`
      : `They haven't built anything yet.`;

    const agentLine = activeAgents.length > 0
      ? `Active AI agents: ${activeAgents.map(a => `${a.name}`).join(", ")}.`
      : "";

    const projectsLine = projects.length > 1
      ? `They have ${projects.length} projects total.`
      : "";

    workspaceBlock = `\n[Current state — use silently]\n${projectLine} ${progressLine} ${agentLine} ${projectsLine}\n[end]`;
  }

  // ─── System prompt ────────────────────────────────────────────────────────────
  const hasHistory = projects.length > 0 || memories.length > 0 || !!bi;

  const personaIntro = hasHistory
    ? `You are a co-founder who has been in this with the user for months. You already know the idea, the stage, what's working, what isn't. You react. You don't explain your thinking — you just think.`
    : `You're a sharp, direct co-founder meeting this person for the first time. You know nothing about their business yet. Ask one question — the single sharpest question that would tell you the most about what they're building. No intro, no greeting, no explanation, no name. Just the question.`;

  const systemPrompt = `${personaIntro}

One idea per response. One opinion. Say it and stop. If you have a reaction, give the reaction — not the reasoning behind it. If you'd push back, push back in one sentence. If something excites you, say so directly. Don't cover multiple angles. Don't summarize. Don't justify at length.

Responses should feel like someone said something across a desk and you immediately said what came to mind. Not a considered analysis — an instinct. 1–3 sentences by default. Expand only if directly asked.

Never explain why you think something. Never list supporting points. Never structure an argument. Never cover all sides. Never use headers, bullets, labels, or any formatting. No affirmation openers. Never repeat back what the user said. "It depends" is not an answer — say what you'd actually do.

Opinions stand alone — no justification unless explicitly asked. Don't say "I'd do X because Y" — just say "I'd do X." If context is needed, imply it, don't explain it. Never defend reasoning, break down tradeoffs, or simulate consulting logic.

When asked open-ended questions like "what am I missing?", "what should I focus on?", or "what's the risk?" — do NOT list options or map the domain. Identify the single most important constraint right now and say only that. A real co-founder says "this is the one thing I'm most worried about" — not "here are several things to consider."
${workspaceBlock}${businessBlock}${memoryBlock}
[Reference platform capabilities — business analysis, website builder, AI agents, automation, deployments — naturally when relevant, never as a list]`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const copilotPayload = {
    messages: [{ role: "system" as const, content: systemPrompt }, ...messages],
    temperature: 0.72,
    maxTokens: 450,
  };

  const tryStreamModel = (model: string) =>
    streamNvidia({ ...copilotPayload, model, signal: AbortSignal.timeout(30_000) });

  // ── Primary: Qwen — Fallback: Nemotron Ultra ──────────────────────────────────
  let streamBody: ReadableStream<Uint8Array>;
  let activeModel: string = MODELS.COPILOT;

  try {
    streamBody = await tryStreamModel(MODELS.COPILOT);
  } catch (primaryErr) {
    req.log.warn({ err: primaryErr, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Primary failed — trying fallback`);
    try {
      activeModel = MODELS.COPILOT_FALLBACK;
      streamBody = await tryStreamModel(MODELS.COPILOT_FALLBACK);
    } catch (fallbackErr) {
      req.log.error({ err: fallbackErr, model: MODELS.COPILOT_FALLBACK }, `[AI:${MODELS.COPILOT_FALLBACK}] Fallback also failed`);
      res.write(`data: ${JSON.stringify({ error: String(fallbackErr) })}\n\n`);
      res.end();
      return;
    }
  }

  try {
    const result = await forwardStream(streamBody, res, activeModel);
    if (!result && activeModel === MODELS.COPILOT) {
      // Primary returned empty — try fallback
      req.log.warn({ model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Empty stream — trying fallback`);
      try {
        const fallbackBody = await tryStreamModel(MODELS.COPILOT_FALLBACK);
        await forwardStream(fallbackBody, res, MODELS.COPILOT_FALLBACK);
      } catch (fallbackErr) {
        req.log.error({ err: fallbackErr }, "Fallback stream also failed");
        res.write(`data: ${JSON.stringify({ content: "Something went wrong on my end. Try asking again." })}\n\n`);
      }
    } else if (!result) {
      res.write(`data: ${JSON.stringify({ content: "Something went wrong on my end. Try asking again." })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err, model: activeModel }, `[AI:${activeModel}] Copilot stream error`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.end();
});

export default router;
