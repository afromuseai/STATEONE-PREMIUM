import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db, projectsTable, agentsTable, aiMemoryTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";

import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, callNvidia, extractJson } from "../lib/nvidia";

// ─── Memory category types ─────────────────────────────────────────────────
type MemoryCategory = "Decision" | "Goal" | "Assumption" | "Experiment" | "Milestone" | "Learning" | "Risk" | "Preference";

interface ExtractedMemory {
  category: MemoryCategory;
  key: string;
  value: string;
  importance: number;
}

// ─── Background memory extraction ─────────────────────────────────────────
// Fires after every copilot response. Detects strategic statements in the
// user's latest message and persists them to aiMemoryTable so they survive
// across sessions and are injected into all future requests.
async function extractProjectMemories(
  userId: string,
  userMessage: string,
  projectTitle: string | null | undefined,
  logger: { error: (obj: object, msg: string) => void },
): Promise<void> {
  const extractionPrompt = `You are a strategic memory extractor. Given a user message from a business planning conversation, extract any strategic statements worth remembering long-term.

Categories to detect:
- Decision: an explicit strategic choice (who to target, what to build, what to prioritize, what to reject)
- Goal: a stated objective or target outcome
- Assumption: a belief the user is operating on that hasn't been validated
- Experiment: a test or validation activity the user plans or has done
- Milestone: a completed or planned achievement
- Learning: an insight or lesson from experience
- Risk: a stated concern or threat
- Preference: how the user prefers to work or make decisions

Rules:
- Only extract if the statement would matter weeks or months from now
- Do not extract casual conversation, questions, greetings, or requests for help
- Use short, clear keys like "target_market", "pricing_model", "first_goal"
- Use concise values that capture the exact strategic content
- Importance: Decision=5, Goal=4, Learning=4, Risk=3, Assumption=3, Experiment=3, Milestone=2, Preference=2

Respond with ONLY a JSON array. If nothing strategic is found, respond with [].

Example:
User: "We're targeting mining companies first because they have the highest procurement budgets."
Output: [{"category":"Decision","key":"target_market","value":"Mining companies chosen as initial market — highest procurement budgets","importance":5}]

User message to analyze:
"${userMessage.replace(/"/g, '\\"').slice(0, 800)}"

Respond with JSON array only. No explanation.`;

  try {
    const raw = await callNvidia({
      model: MODELS.MEMORY,
      messages: [{ role: "user", content: extractionPrompt }],
      temperature: 0.1,
      maxTokens: 400,
      signal: AbortSignal.timeout(15_000),
    });

    const parsed = extractJson(raw);
    const entries = (Array.isArray(parsed) ? parsed : []) as ExtractedMemory[];
    if (entries.length === 0) return;

    for (const entry of entries) {
      if (!entry.category || !entry.key || !entry.value) continue;

      // Upsert by userId + key: update if exists, insert if not
      const [existing] = await db.select({ id: aiMemoryTable.id })
        .from(aiMemoryTable)
        .where(and(eq(aiMemoryTable.userId, userId), eq(aiMemoryTable.key, entry.key)))
        .limit(1);

      const contextPayload = { category: entry.category, project: projectTitle ?? undefined };

      if (existing) {
        await db.update(aiMemoryTable)
          .set({ value: entry.value, importance: entry.importance, context: contextPayload })
          .where(eq(aiMemoryTable.id, existing.id));
      } else {
        await db.insert(aiMemoryTable).values({
          userId,
          key: entry.key,
          value: entry.value,
          importance: entry.importance,
          source: "copilot",
          context: contextPayload,
        });
      }
    }
  } catch (err) {
    // Fire-and-forget: never block the response, never surface errors to user
    logger.error({ err }, "[memory-extraction] Failed to extract or store memories");
  }
}

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
  // Typed by category so the Memory Retrieval Gate can detect conflicts.
  let memoryBlock = "";
  if (memories.length > 0) {
    const formatEntry = (m: typeof memories[0]) => {
      const ctx = m.context as Record<string, unknown> | null;
      const category = (ctx?.category as string) ?? "Note";
      return `[${category}] ${m.key}: ${m.value}`;
    };
    const decisions = memories.filter(m => (m.context as Record<string,unknown> | null)?.category === "Decision").map(formatEntry);
    const goals     = memories.filter(m => (m.context as Record<string,unknown> | null)?.category === "Goal").map(formatEntry);
    const rest      = memories.filter(m => !["Decision","Goal"].includes(String((m.context as Record<string,unknown> | null)?.category ?? ""))).map(formatEntry);
    const ordered   = [...decisions, ...goals, ...rest];
    memoryBlock = `

=== WORKSPACE MEMORY (ACTIVE PROJECT HISTORY) ===
CRITICAL: These are real recorded decisions and history. They MUST be checked before every response.
The Memory Retrieval Gate REQUIRES you to compare the current message against these entries.
If the user says something that contradicts a [Decision] or [Goal] entry below — acknowledge the conflict. Do not proceed without flagging it.

${ordered.join("\n")}

Decisions and Goals have the highest priority. They override BI output and analysis.
=== END WORKSPACE MEMORY ===`;
  } else {
    memoryBlock = `

=== WORKSPACE MEMORY ===
No project decisions or history recorded yet.
If the user states a target market, goal, strategy, or assumption — treat it as new information only, with no prior context to compare against.
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

  // ─── Compute CopilotState fields from real workspace data ─────────────────────
  const hasProject = !!wsProject;
  const hasBi = !!bi && Object.keys(bi as object).length > 0;
  const hasMemories = memories.length > 0;

  const memoryConfidence: "LOW" | "PARTIAL" | "HIGH" =
    (hasProject && hasBi && memories.length >= 5) ? "HIGH"
    : (hasProject || hasMemories || hasBi) ? "PARTIAL"
    : "LOW";

  const executionReadiness: "NOT_READY" | "READY" | "EXECUTING" =
    (activeAgents.length > 0 && memoryConfidence !== "LOW") ? "EXECUTING"
    : (hasProject && (hasBi || wsModules?.businessIntelligence)) ? "READY"
    : "NOT_READY";

  // ─── System prompt ────────────────────────────────────────────────────────────
  const systemPrompt = `You are STAGEONE Copilot.

Your only goal is to ensure the system is stable, consistent, and shippable as an MVP.
You must NOT introduce new systems, frameworks, or abstraction layers.
You must operate using ONLY the following components.

---

COPILOT CORE
- Respond to user queries clearly and directly
- Use existing intelligence only
- Do not invent new architectures or systems
- Keep outputs consistent and deterministic

---

MEMORY SYSTEM
- Always read stored memory first before responding
- Memory types: Decision · Goal · Assumption · Risk
- If memory conflicts with current input, prioritize stored memory

Rules:
- Do not hallucinate past events
- Do not create fake history
- Only use database-backed memory

---

REALITY GATE (HARD RULE)

Before suggesting any build, scaling, or execution action — check:
Is there real-world evidence? (interviews, users, LOIs, pilots)

IF NO EVIDENCE EXISTS:
- You MUST NOT suggest building or scaling
- You MUST redirect to validation actions only:
  - talk to users
  - get LOI
  - manual workflow test

IF EVIDENCE EXISTS:
- Allow execution recommendations

---

ACTION SYSTEM

You may output structured actions ONLY in this format:
{{ACTION:id|label|detail}}

Rules:
- Always use this exact format
- Do not create alternative formats
- Frontend depends on this structure

Detectable action IDs:
- generate_website → user wants to generate or build a website
- generate_intelligence → user wants to run business intelligence / analysis
- open_agents → user wants to install, browse, or manage agents
- open_automation → user wants to build automations or workflows
- open_chatbot → user wants to build or configure a chatbot
- open_deployments → user wants to deploy something or review deployments
- open_templates → user wants to browse or use templates
- open_memory → user wants to see workspace memory or history

Only emit an action tag when intent is unambiguous. Emit at most ONE per response, at the very end.

---

RESPONSE RULES
- Do NOT over-explain
- Do NOT add extra systems
- Do NOT simulate fake history
- Do NOT assume missing data
- Keep responses short, grounded, and actionable
- No headers, bullets, or formatting unless explicitly asked
- No performance openers ("Great question", "Absolutely", etc.)

---

SHIP MODE BEHAVIOR

When uncertain:
- default to validation, not building
- prioritize real-world proof over logic
- avoid complexity unless required for MVP

This is a production stabilization mode. Make STAGEONE shippable, not perfect.

---

Workspace state (pre-computed — treat as facts):
  memoryConfidence: ${memoryConfidence}
  executionReadiness: ${executionReadiness}

---
${workspaceBlock}${businessBlock}${memoryBlock}`;

  // ─── (unused vars kept to avoid TS errors) ─────────────────────────────────
  void memoryConfidence; void executionReadiness;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const trimmedMessages = messages.slice(-10);

  const copilotPayload = {
    messages: [{ role: "system" as const, content: systemPrompt }, ...trimmedMessages],
    temperature: 0.72,
    maxTokens: 300,
  };

  let streamBody: ReadableStream<Uint8Array>;

  try {
    streamBody = await streamNvidia({ ...copilotPayload, model: MODELS.COPILOT, signal: AbortSignal.timeout(90_000) });
  } catch (err) {
    req.log.error({ err, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Stream failed`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
    res.end();
    return;
  }

  try {
    const result = await forwardStream(streamBody, res, MODELS.COPILOT);
    if (!result) {
      res.write(`data: ${JSON.stringify({ content: "Something went wrong on my end. Try asking again." })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Copilot stream error`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.end();

  const latestUserMessage = trimmedMessages.filter(m => m.role === "user").at(-1)?.content;
  if (latestUserMessage) {
    extractProjectMemories(userId, latestUserMessage, wsProject?.title, req.log).catch(() => {});
  }
});


export default router;
