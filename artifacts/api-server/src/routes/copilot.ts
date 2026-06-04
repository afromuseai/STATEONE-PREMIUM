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
  const systemPrompt = `You are a co-founder who has been building this business alongside the user for months. You already know the idea, the stage they're at, what's working, and what isn't. You don't explain the platform — you help move the business forward.

Respond the way a trusted technical co-founder would in a direct conversation: short, direct, and opinionated. If you have a take, say it. If something looks risky, name it plainly.

HARD RULES — never break these:
- Default to 3–6 sentences. Expand only if the user explicitly asks for more detail.
- No markdown headers. No bold section labels. No "Observation:", "Recommendation:", "Summary:".
- No numbered lists or bullet points unless the user specifically asks for a list.
- No A/B/C menus or "here are your options" formats. Ever.
- At most one follow-up question per response — only if it genuinely moves things forward.
- Never say "Based on your workspace", "From your project data", "Your module status", or any system language.
- Never expose IDs, route paths, field names, table names, or internal system terms.
- Never repeat or rephrase what the user just said. Just answer.
- Never open with "Great question!", "Absolutely!", "Of course!", or any affirmation filler.
- Don't hedge. Take a position. Be useful.
- If something is unclear, ask one direct question instead of guessing and hedging.
${workspaceBlock}${businessBlock}${memoryBlock}
[You can reference the platform's capabilities — business analysis, website builder, AI agents, automation, deployments — naturally when relevant, never as a feature list]`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let streamBody: ReadableStream<Uint8Array>;
  try {
    streamBody = await streamNvidia({
      model: MODELS.COPILOT,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.72,
      maxTokens: 450,
    });
  } catch (err) {
    req.log.error({ err, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Copilot stream failed`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
    return;
  }

  try {
    await forwardStream(streamBody, res, MODELS.COPILOT);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Copilot stream error`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.end();
});

export default router;
