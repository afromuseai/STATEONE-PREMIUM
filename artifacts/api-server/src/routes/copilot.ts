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

  // ─── WORKSPACE REALITY block ──────────────────────────────────────────────────
  // Hard facts only: what exists in the workspace right now.
  // Nothing from this block can be confused with AI analysis.
  let workspaceBlock = "";
  if (ws) {
    const completed: string[] = [];
    const notCompleted: string[] = [];
    if (wsModules?.businessIntelligence) completed.push("Business Intelligence"); else notCompleted.push("Business Intelligence");
    if (wsModules?.website) completed.push("Website"); else notCompleted.push("Website");
    if (wsModules?.chatbot) completed.push("Chatbot"); else notCompleted.push("Chatbot");
    if (wsModules?.automation) completed.push("Automation"); else notCompleted.push("Automation");

    const lines: string[] = [];
    if (wsProject) {
      lines.push(`Project: "${wsProject.title}"`);
      lines.push(`User's idea (their exact words): "${wsProject.businessIdea.slice(0, 200)}"`);
    } else {
      lines.push("No project created yet.");
    }
    if (completed.length > 0) lines.push(`Completed: ${completed.join(", ")}`);
    if (notCompleted.length > 0) lines.push(`Not completed: ${notCompleted.join(", ")}`);
    if (activeAgents.length > 0) lines.push(`Active agents: ${activeAgents.map(a => a.name).join(", ")}`);
    if (projects.length > 1) lines.push(`Total projects: ${projects.length}`);

    workspaceBlock = `

=== WORKSPACE REALITY ===
These are verified facts. They exist in the workspace right now.
You may state these confidently as things that have happened or exist.
Do NOT mix these with hypotheses from the Business Analysis section below.
${lines.join("\n")}
=== END WORKSPACE REALITY ===`;
  }

  // ─── MEMORY block ─────────────────────────────────────────────────────────────
  // Recorded past events explicitly saved to workspace memory.
  // These are real — reference confidently.
  let memoryBlock = "";
  if (memories.length > 0) {
    const high = memories.filter(m => m.importance >= 4).map(m => `- ${m.key}: ${m.value}`);
    const normal = memories.filter(m => m.importance < 4).map(m => `- ${m.key}: ${m.value}`);
    const all = [...high, ...normal];
    memoryBlock = `

=== WORKSPACE MEMORY ===
These are things that were explicitly recorded. They happened or were stated.
Reference naturally. Never list them back to the user.
${all.join("\n")}
=== END WORKSPACE MEMORY ===`;
  }

  // ─── BUSINESS ANALYSIS block ──────────────────────────────────────────────────
  // AI-generated analysis and projections. NOT validated. NOT real-world evidence.
  // Analysis = strategic intelligence (insights, risks, opportunities).
  // Projections = modeled future estimates (metrics, rates, forecasts).
  // Must NEVER be blended with Workspace Reality above.
  let businessBlock = "";
  if (bi) {
    const analysis: string[] = [];
    const projections: string[] = [];

    if (bi.businessSnapshot && bi.industry) {
      analysis.push(`- Industry: ${bi.industry}. Target: ${bi.targetMarket ?? "unspecified"}. Snapshot: ${bi.businessSnapshot}`);
    }

    const si = bi.strategicInsights;
    if (si?.growthBottleneck) analysis.push(`- The analysis suggests the growth constraint may be: ${si.growthBottleneck}`);
    if (si?.fastestChannel) analysis.push(`- The analysis suggests the fastest channel may be: ${si.fastestChannel}`);
    if (si?.operationalRisk) analysis.push(`- The analysis suggests an operational risk may be: ${si.operationalRisk}`);
    if (si?.highestLeverageAutomation) analysis.push(`- The analysis suggests the highest-leverage automation may be: ${si.highestLeverageAutomation}`);

    const ca = bi.competitiveAdvantage;
    if (ca?.differentiation) analysis.push(`- The analysis suggests differentiation may be: ${ca.differentiation}`);
    if (ca?.scalabilityEdge) analysis.push(`- The analysis suggests a scalability edge may be: ${ca.scalabilityEdge}`);

    if (bi.growthPlan?.length) {
      analysis.push(`- The analysis suggests a growth path of: ${bi.growthPlan.slice(0, 3).join(" → ")}`);
    }

    if (bi.recommendedStack?.crm || bi.recommendedStack?.payments) {
      analysis.push(`- The analysis suggests a stack that may include: ${[bi.recommendedStack.crm, bi.recommendedStack.payments, ...(bi.recommendedStack.automation ?? [])].filter(Boolean).join(", ")}`);
    }

    // Metrics are model projections — NOT validated outcomes
    const m = bi.metrics;
    if (m) {
      if ((m.automationPotential ?? 100) < 50) projections.push(`- The model projects low automation maturity (scored ${m.automationPotential}% — unvalidated)`);
      if ((m.revenueScalability ?? 10) < 6) projections.push(`- The model projects limited revenue scalability (scored ${m.revenueScalability}/10 — unvalidated)`);
      if ((m.marketDifficulty ?? 0) >= 7) projections.push(`- The model projects a highly competitive market (scored ${m.marketDifficulty}/10 — unvalidated)`);
      if ((m.aiAdoptionOpportunity ?? 0) > 70) projections.push(`- The model projects a high AI adoption opportunity (scored ${m.aiAdoptionOpportunity}% — unvalidated)`);
    }

    const parts: string[] = [];

    if (analysis.length > 0) {
      parts.push(`ANALYSIS (strategic intelligence — not validated, not historical):
${analysis.join("\n")}`);
    }

    if (projections.length > 0) {
      parts.push(`PROJECTIONS (modeled future estimates — not validated, not real outcomes):
${projections.join("\n")}`);
    }

    if (parts.length > 0) {
      businessBlock = `

=== BUSINESS ANALYSIS (UNVALIDATED) ===
CRITICAL: These are AI-generated analysis and projections. They have NOT been validated in the real world.
They are NOT facts. They are NOT things that happened.
ANALYSIS → always signal with: "the analysis suggests...", "may be...", "could be..."
PROJECTIONS → always signal with: "the model projects...", "the projection estimates...", "if the assumptions hold..."
NEVER convert analysis or projections into facts. NEVER present a projection as a real outcome.
NEVER convert a roadmap item or growth plan into a historical event.
Do NOT mix these with Workspace Reality above. These two sections must stay completely separate.

${parts.join("\n\n")}
=== END BUSINESS ANALYSIS ===`;
    }
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

[Epistemic grounding — non-negotiable]
Before every response, internally identify the source of what you're about to say:
- WORKSPACE REALITY block → state confidently. These are verified facts.
- WORKSPACE MEMORY block → reference confidently. These happened and were recorded.
- BUSINESS ANALYSIS block (ANALYSIS entries) → always signal with "the analysis suggests...", "may be...", "could be...", "appears to...". Never state as fact.
- BUSINESS ANALYSIS block (PROJECTION entries) → always signal with "the projection estimates...", "the model assumes...", "if the assumptions hold...". Never present as a real outcome or validated result.
- Your own reasoning → signal with "I suspect...", "My concern is...", "My guess is...".
- Pure speculation → signal with "I don't know yet", "We'd need to test that", "That's only a hypothesis."

CRITICAL RULE — never convert:
- ANALYSIS into FACT
- PROJECTION into FACT
- A roadmap or growth plan item into historical history ("we ran a pilot" when only a plan exists)
- A hypothesis into evidence

IDENTITY RULE — you are a strategic partner with access to workspace information.
You are NOT a witness. You are NOT a participant. You are NOT a historical actor.
Never claim: "we ran", "we tested", "we interviewed", "we discovered" — unless those exact events exist in WORKSPACE MEMORY.

TRUST RULE — when uncertain, choose honesty over certainty.
It is better to say "I don't know" than to create information that does not exist.

EVIDENCE CHECK — when the user asks "Why?", "How do you know?", "What evidence do you have?", "Are you sure?", "How confident are you?", or anything asking you to justify a claim:

Step 1: Search WORKSPACE REALITY block for hard facts.
Step 2: Search WORKSPACE MEMORY block for recorded events.
Step 3: Search BUSINESS ANALYSIS block for AI-generated analysis or projections.

If Step 1 or Step 2 finds something: state it clearly and stop.
If only Step 3 finds something: say "I don't have evidence for that — that's an inference from the business analysis." Then stop. No further reasoning. No storytelling. No speculation added after.
If nothing is found anywhere: say "I don't have evidence for that." Then stop. Do not continue the response.

The hard stop is mandatory. When evidence mode triggers and no real evidence exists, the response ends after the admission. Never fill the silence with inference or narrative.

FORBIDDEN — never invent or imply the existence of:
customers · interviews · pilots · experiments · meetings · partnerships · revenue figures · user counts · conversion rates · historical events · previous conversations · deployments
...unless they exist in WORKSPACE MEMORY. Never claim personal memory of any event.
[end]
${workspaceBlock}${businessBlock}${memoryBlock}
[Reference platform capabilities — business analysis, website builder, AI agents, automation, deployments — naturally when relevant, never as a list]`;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // Cap history to last 10 exchanges to prevent prompt bloat on long conversations
  const trimmedMessages = messages.slice(-10);

  const copilotPayload = {
    messages: [{ role: "system" as const, content: systemPrompt }, ...trimmedMessages],
    temperature: 0.72,
    maxTokens: 300,
  };

  let streamBody: ReadableStream<Uint8Array>;
  let activeModel: string = MODELS.COPILOT;

  try {
    streamBody = await streamNvidia({ ...copilotPayload, model: MODELS.COPILOT, signal: AbortSignal.timeout(90_000) });
  } catch (primaryErr) {
    req.log.warn({ err: primaryErr, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Primary failed — trying fallback`);
    try {
      activeModel = MODELS.COPILOT_FALLBACK;
      streamBody = await streamNvidia({ ...copilotPayload, model: MODELS.COPILOT_FALLBACK, signal: AbortSignal.timeout(30_000) });
    } catch (fallbackErr) {
      req.log.error({ err: fallbackErr, model: MODELS.COPILOT_FALLBACK }, `[AI:${MODELS.COPILOT_FALLBACK}] Fallback also failed`);
      res.write(`data: ${JSON.stringify({ error: String(fallbackErr) })}\n\n`);
      res.end();
      return;
    }
  }

  try {
    const result = await forwardStream(streamBody, res, activeModel);
    if (!result) {
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
