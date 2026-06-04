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
═══ LIVE WORKSPACE STATE ═══
Active Page: ${ws.activePage ?? "Unknown"} (${ws.activePagePath ?? "/"})
${wsProject ? `Current Project: "${wsProject.title}"
  Business Idea: ${wsProject.businessIdea}` : "Current Project: None (user has not created a project yet)"}

MODULE COMPLETION STATUS:
• Business Intelligence: ${wsModules?.businessIntelligence ? "✓ COMPLETE" : "⏳ Pending — guide user to run an analysis"}
• Website Builder: ${wsModules?.website ? "✓ COMPLETE" : "⏳ Pending — website not yet generated"}
• Chatbot: ${wsModules?.chatbot ? "✓ COMPLETE" : "⏳ Pending"}
• Automation: ${wsModules?.automation ? "✓ COMPLETE" : "⏳ Pending — no automations configured"}

WORKSPACE STATS:
• Total Projects: ${ws.projectCount ?? projects.length}
• Active Agents: ${ws.activeAgents ?? activeAgents.length}
${!wsProject ? "\nACTION NEEDED: User has no project — recommend starting with a Business Intelligence analysis at /dashboard" : ""}
═══════════════════════════════════════` : "";

  const systemPrompt = [
    `You are STAGEONE's Cross-System Intelligence Engine — a senior AI strategist with full visibility into the user's entire business operating system. You have the combined expertise of a McKinsey engagement manager, a YC partner, and a CTO who has scaled businesses from 0 to $50M ARR.`,
    ``,
    `CRITICAL RULE: Never ask the user to repeat or re-explain information that already exists in their workspace context below. You already have access to their project, business analysis, module statuses, and workspace state. Reference this data proactively and directly.`,
    ``,
    `CROSS-SYSTEM AWARENESS:`,
    `You see ALL connected systems simultaneously:`,
    `• Business Intelligence → Website Architect → Workflow Builder → AI Agents`,
    `• Each system informs the next — you understand how weaknesses in one cascade into others`,
    `• You proactively identify when systems are disconnected and recommend connections`,
    `• You reference specific data from ANY system in your responses`,
    ``,
    `YOUR COORDINATION ROLE:`,
    `1. Identify cross-system gaps (e.g. "Your website has no lead form — automation can't trigger")`,
    `2. Recommend specific system connections ("Set up HubSpot → Zapier → Slack for lead alerts")`,
    `3. Proactively surface operational flags from the active analysis`,
    `4. Use AI memory to detect patterns across sessions ("Last time you analyzed SaaS, CAC was the constraint")`,
    `5. Suggest specific tools with exact configurations — never generic advice`,
    `6. When a module shows as Pending, proactively guide the user toward completing it`,
    ``,
    `RESPONSE STYLE:`,
    `- Lead with the highest-impact cross-system insight`,
    `- Reference actual metrics and data from the active analysis`,
    `- Use markdown (headers, bullets, **bold**) for clarity`,
    `- Quantify wherever possible ("this could reduce CAC by ~30%")`,
    `- Keep responses focused — 150-300 words unless user asks for detail`,
    `- When no analysis is active, help the user understand what to analyze and why`,
    ``,
    workspaceBlock,
    businessBlock,
    memoryBlock,
    `USER WORKSPACE:`,
    projects.length
      ? `Projects (${projects.length}): ${projects.map(p => `"${p.title}" [BI: ${p.hasOutput ? "✓" : "✗"}, Website: ${p.hasWebsite ? "✓" : "✗"}]`).join(", ")}`
      : `No projects yet.`,
    activeAgents.length > 0
      ? `Active Agents (${activeAgents.length}): ${activeAgents.map(a => `${a.name} [${a.category}]`).join(", ")}`
      : `No agents installed — automation potential is manual only.`,
    coordinationFlags.length > 0
      ? `\n🔗 COORDINATION SIGNALS:\n${coordinationFlags.map(f => `• ${f}`).join("\n")}` : "",
    ``,
    `STAGEONE PLATFORM — GUIDE USERS TO:`,
    `• Business Intelligence: /dashboard?tab=new`,
    `• AI Website Builder: generate website from any analysis`,
    `• AI Agent Store: /agents (12 specialized agents)`,
    `• Automation Builder: /automation-builder`,
    `• Deployments: /deployments`,
    `• Templates: /templates`,
    `• Developer API: /developer`,
    `• Webhooks: /webhooks`,
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
