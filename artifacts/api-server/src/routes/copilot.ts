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

  // ─── Fetch all cross-system context in parallel ──────────────────────────────
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
      .orderBy(desc(aiMemoryTable.importance), desc(aiMemoryTable.updatedAt)).limit(20),
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

  // ─── Compute operational health flags ───────────────────────────────────────
  const healthFlags: string[] = [];
  if (bi?.metrics) {
    const m = bi.metrics;
    if ((m.automationPotential ?? 0) < 50) healthFlags.push(`LOW AUTOMATION MATURITY (${m.automationPotential}%) — high priority to implement automation workflows`);
    if ((m.aiAdoptionOpportunity ?? 0) > 70) healthFlags.push(`HIGH AI OPPORTUNITY (${m.aiAdoptionOpportunity}%) — significant untapped AI leverage`);
    if ((m.marketDifficulty ?? 0) >= 7) healthFlags.push(`HIGH MARKET DIFFICULTY (${m.marketDifficulty}/10) — differentiation and defensibility are critical`);
    if ((m.revenueScalability ?? 0) < 6) healthFlags.push(`LOW SCALABILITY (${m.revenueScalability}/10) — business model has growth ceiling`);
    if ((m.operationalComplexity ?? 0) >= 7) healthFlags.push(`HIGH OPERATIONAL COMPLEXITY (${m.operationalComplexity}/10) — automation is critical leverage`);
  }

  // ─── Cross-system coordination flags ────────────────────────────────────────
  const coordinationFlags: string[] = [];
  const activeAgents = agents.filter(a => a.isActive);
  if (bi && activeAgents.length === 0) coordinationFlags.push("NO AI AGENTS INSTALLED — automation potential is fully untapped");
  if (bi && projects.length === 1) coordinationFlags.push("FIRST ANALYSIS — AI memory is building; more analyses improve cross-system intelligence");
  if (bi && !bi.automations?.length) coordinationFlags.push("NO AUTOMATIONS DEFINED — operational efficiency is below baseline");
  if (memories.length > 5) coordinationFlags.push(`STRONG MEMORY CONTEXT (${memories.length} entries) — reference patterns from previous analyses`);
  if (activeAgents.length > 0) coordinationFlags.push(`AGENTS ACTIVE: ${activeAgents.map(a => `${a.name} (${a.category})`).join(", ")} — cross-reference their data`);

  // ─── Build rich AI memory context ───────────────────────────────────────────
  let memoryBlock = "";
  if (memories.length > 0) {
    const priorityMem = memories.filter(m => m.importance >= 4);
    const regularMem = memories.filter(m => m.importance < 4);
    const sorted = [...priorityMem, ...regularMem];
    memoryBlock = `
═══ PERSISTENT AI MEMORY (${memories.length} entries — use this context proactively) ═══
${sorted.map(m => `[${m.source}|importance:${m.importance}] ${m.key}: ${m.value}`).join("\n")}
═══════════════════════════════════════════════════════════════════════`;
  }

  // ─── Active business analysis block ─────────────────────────────────────────
  const businessBlock = bi ? `
═══ ACTIVE BUSINESS ANALYSIS (LIVE CROSS-SYSTEM CONTEXT) ═══
Industry: ${bi.industry ?? "Unknown"}
Business Model: ${bi.businessSnapshot ?? "N/A"}
Target Market/ICP: ${bi.targetMarket ?? "N/A"}

OPERATIONAL METRICS:
• Market Difficulty: ${bi.metrics?.marketDifficulty ?? "?"}/10
• Automation Potential: ${bi.metrics?.automationPotential ?? "?"}%
• Revenue Scalability: ${bi.metrics?.revenueScalability ?? "?"}/10
• Operational Complexity: ${bi.metrics?.operationalComplexity ?? "?"}/10
• AI Opportunity: ${bi.metrics?.aiAdoptionOpportunity ?? "?"}%

STRATEGIC INTELLIGENCE:
• Growth Bottleneck: ${bi.strategicInsights?.growthBottleneck ?? "N/A"}
• Fastest Channel: ${bi.strategicInsights?.fastestChannel ?? "N/A"}
• Highest Leverage Automation: ${bi.strategicInsights?.highestLeverageAutomation ?? "N/A"}
• Operational Risk: ${bi.strategicInsights?.operationalRisk ?? "N/A"}

COMPETITIVE POSITION:
• Differentiation: ${bi.competitiveAdvantage?.differentiation ?? "N/A"}
• Defensibility: ${bi.competitiveAdvantage?.defensibility ?? "N/A"}
• Scalability Edge: ${bi.competitiveAdvantage?.scalabilityEdge ?? "N/A"}

GROWTH PLAN:
${bi.growthPlan?.slice(0, 3).map((p, i) => `Phase ${i + 1}: ${p}`).join("\n") ?? "N/A"}

AUTOMATION WORKFLOWS IDENTIFIED:
${bi.automations?.map((a, i) => `${i + 1}. ${a}`).join("\n") ?? "None defined"}

WEBSITE PAGES PLANNED:
${bi.websitePages?.slice(0, 4).map((p, i) => `${i + 1}. ${p}`).join("\n") ?? "Not generated"}

RECOMMENDED STACK: CRM: ${bi.recommendedStack?.crm ?? "N/A"} · Payments: ${bi.recommendedStack?.payments ?? "N/A"} · Automation: ${bi.recommendedStack?.automation?.join(", ") ?? "N/A"}
${healthFlags.length > 0 ? `\n⚠ OPERATIONAL FLAGS:\n${healthFlags.map(f => `• ${f}`).join("\n")}` : ""}
═══════════════════════════════════════════════` : "";

  // ─── Workspace context block ─────────────────────────────────────────────────
  const ws = workspaceContext;
  const wsModules = ws?.modules;
  const wsProject = ws?.currentProject;

  const workspaceBlock = ws ? `
[CONTEXT — use silently, never quote back to the user]
The user is currently on the ${ws.activePage ?? "dashboard"} section of the app.
${wsProject ? `They are working on a project called "${wsProject.title}". The core idea: ${wsProject.businessIdea}` : "They haven't created a project yet."}
What they've built so far: ${[
    wsModules?.businessIntelligence ? "business intelligence analysis" : null,
    wsModules?.website ? "website" : null,
    wsModules?.chatbot ? "chatbot" : null,
    wsModules?.automation ? "automation workflows" : null,
  ].filter(Boolean).join(", ") || "nothing yet"}
What they haven't built yet: ${[
    !wsModules?.businessIntelligence ? "business intelligence" : null,
    !wsModules?.website ? "website" : null,
    !wsModules?.chatbot ? "chatbot" : null,
    !wsModules?.automation ? "automation" : null,
  ].filter(Boolean).join(", ") || "they've built everything"}
Total projects: ${ws.projectCount ?? projects.length}. Active AI agents: ${ws.activeAgents ?? activeAgents.length}.
[END CONTEXT]` : "";

  const systemPrompt = [
    `You are a co-founder, operator, and strategist who has been working alongside this person for months. You know their business deeply — their goals, constraints, current stage, and what they've already built. You think like a technical founder who has also run GTM, hired teams, and scaled revenue.`,
    ``,
    `You have full context on their workspace below. Use it silently. Never reference it explicitly — no field names, route paths, IDs, or system labels. Just speak from knowing.`,
    ``,
    `HOW YOU COMMUNICATE:`,
    `- Default to short, direct responses. One or two paragraphs. Expand only when asked.`,
    `- Write like a person, not a system. No bullet-point dumps unless the user is asking for a list.`,
    `- End with one thoughtful question that moves the conversation forward — never a menu of options.`,
    `- Never use phrases like: "cross-system insight", "recommended next steps", "immediate action", "module completion", "observation", "based on your data".`,
    `- Don't repeat what the user just said back to them. Don't affirm before answering. Just answer.`,
    `- If something is unclear, ask directly. Don't guess and produce a long hedge.`,
    `- When you know their business has a gap or risk, say it plainly — the way a trusted co-founder would over coffee, not as a consultant delivering a slide.`,
    `- Quantify when it makes the point sharper. Skip it when it doesn't add anything.`,
    `- If they haven't built something yet, don't announce that as a "pending module" — just factor it into your thinking naturally.`,
    `- Never expose technical metadata, database terms, or internal system names to the user.`,
    ``,
    workspaceBlock,
    businessBlock,
    memoryBlock,
    projects.length
      ? `[Their projects: ${projects.map(p => `"${p.title}" — analysis ${p.hasOutput ? "done" : "not done"}, website ${p.hasWebsite ? "built" : "not built"}`).join("; ")}]`
      : `[They have no projects yet.]`,
    activeAgents.length > 0
      ? `[AI agents they've installed: ${activeAgents.map(a => `${a.name} (${a.category})`).join(", ")}]`
      : `[No AI agents installed yet.]`,
    coordinationFlags.filter(f => !f.includes("at /")).length > 0
      ? `[Additional context: ${coordinationFlags.filter(f => !f.includes("at /")).join(" | ")}]` : "",
    ``,
    `[Platform capabilities available if relevant to the conversation: business analysis, website builder, AI agents, automation builder, deployments, templates, developer API, webhooks]`,
  ].filter(Boolean).join("\n");

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let streamBody: ReadableStream<Uint8Array>;
  try {
    streamBody = await streamNvidia({
      model: MODELS.COPILOT,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.6,
      maxTokens: 900,
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
