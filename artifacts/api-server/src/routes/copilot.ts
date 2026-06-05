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
  // AI-generated hypotheses. NOT validated. NOT real-world evidence.
  // Must NEVER be blended with Workspace Reality above.
  let businessBlock = "";
  if (bi) {
    const hypotheses: string[] = [];

    if (bi.businessSnapshot && bi.industry) {
      hypotheses.push(`- Industry: ${bi.industry}. Target: ${bi.targetMarket ?? "unspecified"}. Snapshot: ${bi.businessSnapshot}`);
    }

    const si = bi.strategicInsights;
    if (si?.growthBottleneck) hypotheses.push(`- Growth constraint may be: ${si.growthBottleneck}`);
    if (si?.fastestChannel) hypotheses.push(`- Fastest channel may be: ${si.fastestChannel}`);
    if (si?.operationalRisk) hypotheses.push(`- Operational risk may be: ${si.operationalRisk}`);
    if (si?.highestLeverageAutomation) hypotheses.push(`- Highest-leverage automation may be: ${si.highestLeverageAutomation}`);

    const ca = bi.competitiveAdvantage;
    if (ca?.differentiation) hypotheses.push(`- Differentiation may be: ${ca.differentiation}`);
    if (ca?.scalabilityEdge) hypotheses.push(`- Scalability edge may be: ${ca.scalabilityEdge}`);

    const m = bi.metrics;
    if (m) {
      if ((m.automationPotential ?? 100) < 50) hypotheses.push(`- Automation maturity may be low (scored ${m.automationPotential}%)`);
      if ((m.revenueScalability ?? 10) < 6) hypotheses.push(`- Revenue scalability may be limited (scored ${m.revenueScalability}/10)`);
      if ((m.marketDifficulty ?? 0) >= 7) hypotheses.push(`- Market may be highly competitive (scored ${m.marketDifficulty}/10)`);
      if ((m.aiAdoptionOpportunity ?? 0) > 70) hypotheses.push(`- AI adoption opportunity may be high (scored ${m.aiAdoptionOpportunity}%)`);
    }

    if (bi.growthPlan?.length) {
      hypotheses.push(`- Suggested growth path may be: ${bi.growthPlan.slice(0, 3).join(" → ")}`);
    }

    if (bi.recommendedStack?.crm || bi.recommendedStack?.payments) {
      hypotheses.push(`- Suggested stack may include: ${[bi.recommendedStack.crm, bi.recommendedStack.payments, ...(bi.recommendedStack.automation ?? [])].filter(Boolean).join(", ")}`);
    }

    if (hypotheses.length > 0) {
      businessBlock = `

=== BUSINESS ANALYSIS (UNVALIDATED HYPOTHESES) ===
CRITICAL: These are AI-generated hypotheses. They have NOT been validated in the real world.
They are NOT facts. They are NOT things that happened.
When referencing these, ALWAYS use: "the analysis suggests...", "may be...", "could be...", "appears to..."
Do NOT mix these with Workspace Reality above. These two sections must stay separate.
${hypotheses.join("\n")}
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
- WORKSPACE REALITY block → state confidently. These are facts.
- WORKSPACE MEMORY block → reference confidently. These happened.
- BUSINESS ANALYSIS block → always signal with "the analysis suggests...", "may be...", "could be...". Never state as fact.
- Your own reasoning → signal with "I suspect...", "My concern is...", "My guess is...".
- Pure speculation → signal with "I don't know yet", "We'd need to test that", "That's only a hypothesis."

EVIDENCE CHECK — when the user asks "Why?", "How do you know?", "What evidence do you have?", "How confident are you?", or anything asking you to justify a claim:

Step 1: Search WORKSPACE REALITY block for hard facts.
Step 2: Search WORKSPACE MEMORY block for recorded events.
Step 3: Search BUSINESS ANALYSIS block for AI-generated hypotheses.

If Step 1 or Step 2 finds something: state it clearly and stop.
If only Step 3 finds something: say "I don't have evidence for that — that's a hypothesis from the business analysis." Then stop. No further reasoning. No storytelling. No speculation added after.
If nothing is found anywhere: say "I don't have evidence for that." Then stop. Do not continue the response.

The hard stop is mandatory. When evidence mode triggers and no real evidence exists, the response ends after the admission. Never fill the silence with inference or narrative.

You have no personal memories. You only know what is in the three blocks above and what the user has said in this conversation. Never claim you attended meetings, ran pilots, interviewed customers, saw experiments, or witnessed events.

FORBIDDEN — never invent or imply the existence of:
customers · interviews · pilots · experiments · meetings · partnerships · revenue figures · user counts · conversion rates · historical events · previous conversations
...unless they exist in WORKSPACE MEMORY.
[end]
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
