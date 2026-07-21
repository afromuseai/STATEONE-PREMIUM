import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireFeature } from "../middleware/planGuard";
import { db, projectsTable, agentsTable, aiMemoryTable, workspaceTasksTable, subscriptionsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { PendingIntentSchema } from "@workspace/api-zod";

import { MODELS } from "../lib/models";
import { streamNvidia, forwardStream, callNvidia, extractJson, isModelDegradedError } from "../lib/nvidia";
import { shouldBlock, recordSuccess, recordTimeout, recordDegraded, recordNetworkError, getCircuitHealth } from "../lib/copilot-circuit";
import { getLanguageInstruction } from "../lib/language";
import { getBusinessContext, getBusinessMemorySummary, type BusinessContextResult } from "../lib/business-graph";
import { logEventFireForget } from "../lib/log-event";
import { trackUsageFireForget } from "../lib/usage";
import { runAgent, discoverActiveAgents, AGENT_NAME_TO_KEY } from "../lib/agent-runtime";
import { runMarcusController, buildSimplifiedSystemPrompt, isIdentityQuery, type MarcusControllerInput } from "../lib/marcus-prompt-controller";


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

// ─── ROUTING_TRACE helper (log-only, diagnostic) ──────────────────────────────
// Extracts every {{WORKSPACE|command|payload}} tag emitted by the LLM in its
// raw response, in emission order. Used purely for tracing the routing
// decision end-to-end — does not affect parsing/dispatch behavior, which is
// handled independently by the frontend's own WORKSPACE_CMD_RE.
const NAVIGATE_COMMANDS = new Set(["chatbot", "website", "automation", "open_orchestrator", "intelligence"]);
const POPULATE_COMMANDS = new Set(["idea", "bi_idea"]);
const GENERATE_COMMANDS = new Set(["generate_chatbot", "generate_website", "generate_automation", "generate_intelligence", "generate_orchestrator"]);

interface ExtractedWorkspaceTag { tag: string; command: string; payload: string }

function extractWorkspaceTags(raw: string): ExtractedWorkspaceTag[] {
  const tags: ExtractedWorkspaceTag[] = [];
  const re = /\{\{WORKSPACE\|([^|}\n]+?)(?:\|([^}]*))?\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    tags.push({ tag: m[0], command: m[1].trim(), payload: (m[2] ?? "").trim() });
  }
  return tags;
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
  pendingIntent: PendingIntentSchema.nullable().optional(),
}).optional();

const CopilotBody = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() })),
  businessContext: z.unknown().optional(),
  workspaceContext: WorkspaceContextSchema,
  language: z.string().optional(),
});

router.post("/copilot", requireAuth, requireFeature("marcus_copilot"), async (req, res): Promise<void> => {
  console.log(`[RUNTIME_TRACE] 01_REQUEST_RECEIVED | /api/copilot | ts=${Date.now()}`);
  const parsed = CopilotBody.safeParse(req.body);
  if (!parsed.success) {
    console.log(`[RUNTIME_TRACE] 01b_SCHEMA_VALIDATION_FAILED | issues=${JSON.stringify(parsed.error.issues)}`);
    console.log(`[RUNTIME_TRACE] 01c_RAW_BODY_RECEIVED | body=${JSON.stringify(req.body)}`);
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (!process.env.NVIDIA_API_KEY) {
    res.status(500).json({ error: "NVIDIA_API_KEY not configured" });
    return;
  }

  const userId = req.user!.userId;
  const { messages, businessContext, workspaceContext, language } = parsed.data;

  // ─── Plan enforcement: Marcus is Pro+ only ────────────────────────────────
  if (!req.user!.isAdmin) {
    const subs = await db.select({ plan: subscriptionsTable.plan })
      .from(subscriptionsTable)
      .where(eq(subscriptionsTable.userId, userId))
      .limit(1);
    const plan = subs[0]?.plan ?? "free";
    if (plan === "free") {
      res.status(403).json({ error: "Marcus requires a Pro plan or above.", upgrade: true });
      return;
    }
  }

  // ─── Identity query early-exit ────────────────────────────────────────────────
  // Detect questions about Marcus's identity, name, or capabilities.
  // These must NEVER receive project/workspace/memory context — they respond
  // purely from Marcus's system identity and STAGEONE platform description.
  // This runs before ANY database query so context cannot leak in.
  const latestMsg = (messages[messages.length - 1]?.content ?? "").toLowerCase().trim();
  const isIdentityQueryResult = isIdentityQuery(latestMsg);

  if (isIdentityQueryResult) {
    const langInstruction = getLanguageInstruction(language);
    const identitySystemPrompt = `Your name is Marcus. You are the STAGEONE Copilot — a co-founder, product strategist, and execution assistant built into the STAGEONE platform.

[IDENTITY — absolute]
Your name is Marcus. Always identify yourself as Marcus, not "Copilot", "Assistant", or "AI".

STAGEONE is an AI-powered operating system for building and managing digital business assets. As Marcus, you help users:
- Generate business intelligence and strategic analysis
- Build websites with AI-generated copy and structure
- Create AI chatbots for customer support, sales, and booking
- Design automation workflows for lead capture, onboarding, and operations
- Manage projects, tasks, and agents inside the workspace
- Think through strategy, validate ideas, and prioritize actions

When asked who you are, what you do, or how you can help: answer from this identity only.
Do NOT reference any project, memory, business context, or workspace data in your answer.
Keep the answer concise, direct, and grounded in the above platform description.

NEVER begin your response with "Marcus:" or your name as a prefix label. Start directly with the content.

${langInstruction ? langInstruction : ""}`;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const trimmed = messages.slice(-4);
    const identityPayload = {
      model: MODELS.COPILOT,
      messages: [{ role: "system" as const, content: identitySystemPrompt }, ...trimmed],
      temperature: 0.3,
      topP: 0.9,
      maxTokens: 512,
      signal: AbortSignal.timeout(30_000),
    };

    try {
      const streamBody = await streamNvidia(identityPayload);
      await forwardStream(streamBody, res, MODELS.COPILOT);
    } catch (err) {
      req.log.error({ err }, "[Marcus:identity] Stream failed");
      res.write(`data: ${JSON.stringify({ error: "Identity service unavailable" })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    return;
  }

  // Determine active project id from workspace context (sent by frontend).
  // NOTE: this value is client-supplied and must be validated against the
  // authenticated user's own projects before it touches any DB query that
  // doesn't already carry a userId WHERE clause (e.g. getBusinessContext).
  const clientActiveProjectId = (workspaceContext as { currentProject?: { id?: string } } | null | undefined)?.currentProject?.id ?? null;

  // First pass: fetch user-scoped data that doesn't require ownership validation.
  // The projects list (scoped to userId) is used below to verify clientActiveProjectId.
  const [projects, agents, memories, projectTasksRaw, activeProjectRaw] = await Promise.all([
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
    // Workspace tasks for active project (or all user tasks if no project)
    clientActiveProjectId
      ? db.select({
          id: workspaceTasksTable.id,
          title: workspaceTasksTable.title,
          status: workspaceTasksTable.status,
          completedAt: workspaceTasksTable.completedAt,
        }).from(workspaceTasksTable)
          .where(and(eq(workspaceTasksTable.userId, userId), eq(workspaceTasksTable.projectId, clientActiveProjectId)))
          .limit(30)
      : db.select({
          id: workspaceTasksTable.id,
          title: workspaceTasksTable.title,
          status: workspaceTasksTable.status,
          completedAt: workspaceTasksTable.completedAt,
        }).from(workspaceTasksTable)
          .where(eq(workspaceTasksTable.userId, userId))
          .limit(20),
    // Active project's full module outputs — already guarded by userId in WHERE clause
    clientActiveProjectId
      ? db.select({
          projectEvents: projectsTable.projectEvents,
          websiteOutput: projectsTable.websiteOutput,
          chatbotOutput: projectsTable.chatbotOutput,
          automationOutput: projectsTable.automationOutput,
        })
          .from(projectsTable)
          .where(and(eq(projectsTable.id, clientActiveProjectId), eq(projectsTable.userId, userId)))
          .limit(1)
      : Promise.resolve([]),
  ]);

  // TENANT ISOLATION: validate that the client-supplied projectId actually
  // belongs to this user. projects[] is already userId-scoped from above.
  // If the frontend sent a stale/wrong id (e.g. from a previous session's
  // React Query cache), we silently drop it rather than leak another user's
  // business graph into this response.
  const activeProjectId = clientActiveProjectId && projects.some(p => p.id === clientActiveProjectId)
    ? clientActiveProjectId
    : null;

  if (clientActiveProjectId && !activeProjectId) {
    req.log.warn(
      { userId, clientActiveProjectId },
      "[Marcus:isolation] WARN — client sent projectId that does not belong to this user; dropping",
    );
  }

  // Second pass: fetch business graph only for a verified project.
  const [graphContext] = await Promise.all([
    // Business graph memory for Marcus context — only called after ownership verified
    activeProjectId
      ? getBusinessContext(activeProjectId)
      : Promise.resolve({ graph: null, nodes: [], recentEvents: [], latestSnapshot: null } as BusinessContextResult),
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

  // ─── Parse project tasks + events for history block ───────────────────────────
  interface ProjectEventEntry { type: string; label: string; timestamp: string; }
  const projectEvents: ProjectEventEntry[] = (() => {
    const raw = (activeProjectRaw as { projectEvents?: unknown }[])[0]?.projectEvents;
    if (!raw || !Array.isArray(raw)) return [];
    return (raw as ProjectEventEntry[]).slice(0, 20);
  })();

  // ─── CROSS-MODULE INTELLIGENCE extraction ─────────────────────────────────────
  // Reads the JSONB output of every completed module and surfaces the assumptions
  // each one makes about the business. Marcus uses this to detect conflicts.
  const activeProjectData = (activeProjectRaw as {
    projectEvents?: unknown;
    websiteOutput?: unknown;
    chatbotOutput?: unknown;
    automationOutput?: unknown;
  }[])[0];

  const rawWebsiteOutput  = activeProjectData?.websiteOutput  as Record<string, unknown> | null | undefined;
  const rawChatbotOutput  = activeProjectData?.chatbotOutput  as Record<string, unknown> | null | undefined;
  const rawAutoOutput     = activeProjectData?.automationOutput as Record<string, unknown> | null | undefined;

  let crossModuleBlock = "";
  const hasModuleData = rawWebsiteOutput || rawChatbotOutput || rawAutoOutput || bi;
  if (hasModuleData && activeProjectId) {
    const moduleLines: string[] = [];

    // BI assumptions
    if (bi) {
      const lines: string[] = [];
      if (bi.targetMarket)                              lines.push(`Target market: "${bi.targetMarket}"`);
      if (bi.strategicInsights?.growthBottleneck)       lines.push(`Growth bottleneck: ${bi.strategicInsights.growthBottleneck}`);
      if (bi.strategicInsights?.fastestChannel)         lines.push(`Fastest channel: ${bi.strategicInsights.fastestChannel}`);
      if (bi.competitiveAdvantage?.differentiation)     lines.push(`Differentiation: ${bi.competitiveAdvantage.differentiation}`);
      if (bi.metrics?.marketDifficulty !== undefined)   lines.push(`Market difficulty score: ${bi.metrics.marketDifficulty}/10`);
      if (bi.metrics?.revenueScalability !== undefined) lines.push(`Revenue scalability score: ${bi.metrics.revenueScalability}/10`);
      if (lines.length > 0) moduleLines.push(`BUSINESS INTELLIGENCE assumes:\n${lines.map(l => `  • ${l}`).join("\n")}`);
    }

    // Website assumptions
    if (rawWebsiteOutput) {
      type WS = {
        brand?: { tagline?: string; voice?: string };
        websiteStrategy?: { icp?: string; mainValueProposition?: string; uniquePositioning?: string; primaryCTA?: string };
        sections?: { hero?: { headline?: string; subheadline?: string }; pricing?: { model?: string; tiers?: { name?: string; price?: string }[] } };
      };
      const ws = rawWebsiteOutput as WS;
      const lines: string[] = [];
      if (ws.websiteStrategy?.icp)                   lines.push(`ICP: "${ws.websiteStrategy.icp}"`);
      if (ws.websiteStrategy?.mainValueProposition)  lines.push(`Core promise: "${ws.websiteStrategy.mainValueProposition}"`);
      if (ws.websiteStrategy?.uniquePositioning)     lines.push(`Positioning: "${ws.websiteStrategy.uniquePositioning}"`);
      if (ws.sections?.hero?.headline)               lines.push(`Hero headline: "${ws.sections.hero.headline}"`);
      if (ws.sections?.pricing?.model)               lines.push(`Pricing model: ${ws.sections.pricing.model}`);
      if (ws.brand?.voice)                           lines.push(`Brand voice: ${ws.brand.voice}`);
      if (lines.length > 0) moduleLines.push(`WEBSITE assumes:\n${lines.map(l => `  • ${l}`).join("\n")}`);
    }

    // Chatbot assumptions
    if (rawChatbotOutput) {
      type CB = { description?: string; name?: string; persona?: string; targetAudience?: string; purpose?: string; config?: { description?: string; persona?: string; targetAudience?: string; name?: string; purpose?: string } };
      const cb = rawChatbotOutput as CB;
      const lines: string[] = [];
      const name     = cb.name     || cb.config?.name;
      const purpose  = cb.purpose  || cb.config?.purpose;
      const audience = cb.targetAudience || cb.config?.targetAudience;
      const persona  = cb.persona  || cb.config?.persona;
      const desc     = cb.description || cb.config?.description;
      if (name)    lines.push(`Name: "${name}"`);
      if (purpose) lines.push(`Purpose: "${purpose}"`);
      if (audience) lines.push(`Serves: "${audience}"`);
      if (persona) lines.push(`Persona: ${persona}`);
      if (desc && !purpose && !audience) lines.push(`Description: "${desc.slice(0, 120)}"`);
      if (lines.length > 0) moduleLines.push(`CHATBOT assumes:\n${lines.map(l => `  • ${l}`).join("\n")}`);
    }

    // Automation assumptions
    if (rawAutoOutput) {
      type AUTO = { title?: string; description?: string; config?: { title?: string; description?: string }; steps?: { name?: string }[] };
      const auto = rawAutoOutput as AUTO;
      const lines: string[] = [];
      const title = auto.title || auto.config?.title;
      const desc  = auto.description || auto.config?.description;
      if (title) lines.push(`Title: "${title}"`);
      if (desc)  lines.push(`Description: "${desc.slice(0, 120)}"`);
      if (auto.steps?.length) lines.push(`Steps: ${auto.steps.slice(0, 4).map(s => s.name).filter(Boolean).join(" → ")}`);
      if (lines.length > 0) moduleLines.push(`AUTOMATION assumes:\n${lines.map(l => `  • ${l}`).join("\n")}`);
    }

    if (moduleLines.length >= 2) {
      crossModuleBlock = `

=== CROSS-MODULE INTELLIGENCE ===
These are the assumptions each built module currently makes about this project.
Read all of them before responding. Look for assumptions that conflict with each other.

${moduleLines.join("\n\n")}

CONFLICT DETECTION — run this silently before every strategic response:
1. Does the BI's target market match who the website is aimed at?
2. Does the website's core promise align with the BI's differentiation thesis?
3. Does the chatbot serve the same audience the BI and website target?
4. Does the automation solve a problem the other modules actually identify?
If conflicts exist: name the single most important one and state which module to fix first, and why.
Use language like: "Your BI assumes X. Your website assumes Y. Those conflict — here's the one I'd fix first."
=== END CROSS-MODULE INTELLIGENCE ===`;
    }
  }

  const pendingTasks = (projectTasksRaw as { title: string; status: string; completedAt: string | null }[]).filter(t => t.status === "pending");
  const doneTasks = (projectTasksRaw as { title: string; status: string; completedAt: string | null }[]).filter(t => t.status === "done");

  // ─── PROJECT HISTORY block ────────────────────────────────────────────────────
  let historyBlock = "";
  if (projectEvents.length > 0 || projectTasksRaw.length > 0) {
    const lines: string[] = [];

    if (projectEvents.length > 0) {
      lines.push("Build history (chronological, most recent first):");
      for (const ev of projectEvents.slice(0, 10)) {
        const date = new Date(ev.timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        lines.push(`  ✓ ${ev.label} [${date}]`);
      }
    }

    if (projectTasksRaw.length > 0) {
      lines.push(`\nWorkspace tasks — ${doneTasks.length} completed, ${pendingTasks.length} pending:`);
      if (doneTasks.length > 0) {
        lines.push("  Completed:");
        doneTasks.slice(0, 5).forEach(t => lines.push(`    ✓ ${t.title}`));
      }
      if (pendingTasks.length > 0) {
        lines.push("  Pending (priority order):");
        pendingTasks.slice(0, 7).forEach(t => lines.push(`    • ${t.title}`));
      }
    }

    if (lines.length > 0) {
      historyBlock = `

=== PROJECT HISTORY ===
What has actually been built and committed to — not analysis, not projections. Real actions taken.
${lines.join("\n")}

Use this to avoid recommending things already done and to reference what's next in the user's own priority list.
=== END PROJECT HISTORY ===`;
    }
  }

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
    if (ws.activePage) lines.push(`Current page: ${ws.activePage} (path: ${ws.activePagePath ?? "unknown"})`);
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

  // ─── BUSINESS GRAPH MEMORY block ─────────────────────────────────────────────
  // Persistent structured intelligence from the project's living graph.
  // Loaded before every Marcus response so Marcus is project-aware without re-prompting.
  let businessGraphBlock = "";
  if (activeProjectId && (graphContext as BusinessContextResult).graph) {
    const summary = getBusinessMemorySummary(graphContext as BusinessContextResult);
    if (summary) {
      businessGraphBlock = `

=== BUSINESS GRAPH MEMORY ===
This is the persistent business intelligence graph for the active project.
It is automatically built and updated each time a generation completes — website, chatbot, automation, BI.
Use this to understand the project without asking the user to repeat themselves.

Truthfulness Layer — apply to every claim before responding:
  FACT      → source: [ASSETS (FACT)], [RECENT TIMELINE (FACT)], [LAST MEMORY SNAPSHOT], WORKSPACE REALITY.
              Something that was actually built or logged. State confidently: "Your website was generated." / "A chatbot was created."
  MEMORY    → source: [IDENTITY], [AUDIENCE], [POSITIONING], [REVENUE MODEL], [GOALS], [KEY GRAPH NODES], WORKSPACE MEMORY.
              Stored project knowledge extracted from prior generations. Reference naturally: "Based on your project context..." / "The graph shows your target audience is..."
  INFERENCE → source: [OPERATIONS], [RISKS (INFERENCE)], [Metrics (INFERENCE)].
              AI-derived from BI output but not real-world validated. Signal: "The analysis suggests..." / "This appears to be..." / "Based on the BI output..."
  HYPOTHESIS → no graph entry exists for this claim. Unknown territory. Signal: "I don't know yet." / "We haven't validated that." / "That's not in your project context."

When the user asks what they're building, who their audience is, what assets exist, or what risks they face:
→ Answer from this graph first. Do not claim ignorance about data that is present here.
→ When examining onboarding, website, chatbot, automations — check [ASSETS] before assuming nothing exists.
→ When asked about history or what was done before — check [RECENT TIMELINE] before claiming ignorance.
→ When asked about risks or operations — label them INFERENCE, not FACT.

${summary}
=== END BUSINESS GRAPH MEMORY ===`;
    }
  }

  // ─── Run Marcus Controller ──────────────────────────────────────────────────
  // All intent classification, state computation, module loading, and system
  // prompt assembly is now handled by the controller. The route handler only
  // passes in the data blocks and receives the assembled prompt + metadata.
  const latestUserMessage = (messages[messages.length - 1]?.content ?? "").toLowerCase();

  const controllerInput: MarcusControllerInput = {
    userId,
    isAdmin: req.user!.isAdmin ?? false,
    latestUserMessage,
    messages,
    workspaceContext: workspaceContext ?? null,
    businessContext: (businessContext as Record<string, unknown>) ?? null,
    projects: projects as Array<Record<string, unknown>>,
    memories: memories as Array<Record<string, unknown>>,
    agents: agents as Array<Record<string, unknown>>,
    projectTasksRaw: projectTasksRaw as Array<Record<string, unknown>>,
    activeProjectRaw: activeProjectRaw as Array<Record<string, unknown>>,
    graphContext: graphContext as BusinessContextResult,
    language: language ?? undefined,
  };

  const controllerOutput = runMarcusController(controllerInput);

  const {
    serverGateMode,
    serverIntentType,
    workspaceIntent,
    intentSource,
    isConfirmationResponse,
    isChatbotRequest,
    isAutomationRequest,
    isWebsiteRequest,
    isBiRequest,
    isOrchestratorRequest,
    intentIsFromConfirmation,
    confirmationResult,
    moduleConfidences,
    detectedBusinessContext,
    classifierIntent,
    pagePathEngine,
    pendingIntentSuperseded,
    loadedModules,
    skippedModules,
    requestType,
    shouldBypassLLM,
    memoryConfidence,
    executionReadiness,
    hasMemories,
    hasProject,
    clientPendingIntent,
  } = controllerOutput;

  console.log(`[MARCUS] intent_type = ${serverIntentType}`);
  console.log(`[MARCUS] gate_mode = ${serverGateMode}`);
  console.log(`[MARCUS] MODE_CLASSIFIED | gate_mode=${serverGateMode} | intent_type=${serverIntentType}`);
  if (serverGateMode === "GENERATIVE") {
    console.log(`[MARCUS] EXECUTION_LOCK_ACTIVE | all validation/pressure/interruption layers DISABLED`);
    console.log(`[MARCUS] PRESSURE_ENGINE_ACTIVE=false | INTERRUPTION_LAYER_ACTIVE=false`);
  } else {
    console.log(`[MARCUS] PRESSURE_ENGINE_ACTIVE=true | INTERRUPTION_LAYER_ACTIVE=true`);
  }

  // ─── Build simplified system prompt with data blocks ─────────────────────────
  const systemPrompt = buildSimplifiedSystemPrompt({
    serverGateMode,
    workspaceIntent,
    isConfirmationResponse,
    intentIsFromConfirmation,
    hasHistory: projects.length > 0 || memories.length > 0 || !!bi,
    hasProject,
    hasMemories,
    hasBi: !!bi && Object.keys(bi as object).length > 0,
    memoryConfidence,
    executionReadiness,
    isChatbotRequest,
    isAutomationRequest,
    isWebsiteRequest,
    isBiRequest,
    isOrchestratorRequest,
    workspaceBlock,
    historyBlock,
    businessGraphBlock,
    crossModuleBlock,
    businessBlock,
    memoryBlock,
    languageInstruction: getLanguageInstruction(language),
  });

  // ─── Logging ─────────────────────────────────────────────────────────────────
  req.log.info({
    event: "CONFIRM_INTENT_RESULT",
    message: latestUserMessage.slice(0, 300),
    intent: confirmationResult.intent,
    confidence: confirmationResult.confidence,
    matchedSignals: confirmationResult.matchedSignals,
  }, "[MARCUS] CONFIRM_INTENT_RESULT");
      // ─── Logging ─────────────────────────────────────────────────────────────────
  req.log.info({
    event: "CONFIRM_INTENT_DETECTED",
    message: latestUserMessage.slice(0, 200),
    intent: confirmationResult.intent,
    confidence: confirmationResult.confidence,
    matchedSignals: confirmationResult.matchedSignals,
    pendingIntent: workspaceContext?.pendingIntent?.type ?? null,
    activePagePath: workspaceContext?.activePagePath ?? "",
    pagePathEngine,
    pendingIntentSuperseded,
    classifierIntent,
    workspaceIntent,
    intentSource,
    detectedBusinessContext,
  }, "[MARCUS] CONFIRM_INTENT_DETECTED");
      
      
      
      

  // ─── Old inline code removed — controller handles all classification, state, module loading, and prompt assembly ───

  // ─── Old securityBlock and systemPrompt removed — buildSimplifiedSystemPrompt() handles prompt assembly ───

// ─── Old inline system prompt (~73KB) removed — buildSimplifiedSystemPrompt() handles all prompt assembly ───

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  // ── Server-direct confirmation bypass ─────────────────────────────────────
  // When the user confirms a pending intent, the server knows exactly what to do.
  // Bypassing the LLM here is more reliable than asking a 73KB system prompt to
  // override the model's hardwired "Understood." response to short conversational
  // confirmations like "sounds good" / "yes, go ahead" / "ok, do it".
  // workspaceIntent is the single canonical value — no other variable is read here.
  if (isConfirmationResponse && intentIsFromConfirmation) {
    // Map workspace names to their generate command — BI and orchestrator differ from the pattern
    const GENERATE_CMD_MAP: Record<string, string> = {
      chatbot:      "generate_chatbot",
      website:      "generate_website",
      automation:   "generate_automation",
      bi:           "generate_intelligence",
      orchestrator: "generate_orchestrator",
    };
    const generateCmd = `{{WORKSPACE|${GENERATE_CMD_MAP[workspaceIntent] ?? `generate_${workspaceIntent}`}}}`;

    // Build a short, readable idea label from the best available source.
    // Use the top-level project idea (concise, business-level) rather than the
    // module-specific description which can be several paragraphs long.
    const rawIdea = (wsProject?.businessIdea ?? clientPendingIntent?.idea ?? "").trim();
    const ideaLabel = rawIdea.length === 0
      ? null
      : rawIdea.length <= 80
        ? rawIdea
        : rawIdea.slice(0, 80).replace(/\s\S*$/, "").trimEnd() + "…";

    const hasBi = !!(wsModules?.businessIntelligence);

    const confirmText = (() => {
      switch (workspaceIntent) {
        case "bi":
          return ideaLabel
            ? `Everything is ready.\n\nI'm generating a business intelligence report for ${ideaLabel}.\n\nI'll attach the results to your current workspace once analysis completes.`
            : `Everything is ready.\n\nI'm generating a business intelligence report.\n\nI'll attach the results to your current workspace once analysis completes.`;
        case "website":
          return hasBi
            ? `Everything is ready.\n\nI'm generating your website using the business intelligence we created.\n\nI'll save it into the current project.`
            : ideaLabel
              ? `Everything is ready.\n\nI'm generating your website for ${ideaLabel}.\n\nI'll save it into the current project.`
              : `Everything is ready.\n\nI'm generating your website.\n\nI'll save it into the current project.`;
        case "chatbot":
          return `Everything is ready.\n\nI'm generating your chatbot using the current project context.\n\nI'll attach it to your current project once complete.`;
        case "automation":
          return `Everything is ready.\n\nI'm generating automation workflows based on your business strategy.\n\nI'll save the workflow to your current project.`;
        case "orchestrator":
          return `Everything is ready.\n\nI'm preparing the orchestration plan for this business.\n\nI'll attach it to your current workspace once ready.`;
        default:
          return `Everything is ready.\n\nGenerating now.`;
      }
    })();

    req.log.info({
      event: "CONFIRMATION_SERVER_BYPASS",
      workspaceIntent,
      intentSource,
      emittedCommand: generateCmd,
      confirmIntent: confirmationResult.intent,
      confidence: confirmationResult.confidence,
      matchedSignals: confirmationResult.matchedSignals,
    }, "[MARCUS] CONFIRMATION_SERVER_BYPASS — emitting generate command directly, bypassing LLM");
    console.log(`[RUNTIME_TRACE] 02_WORKSPACE_INTENT | workspaceIntent=${workspaceIntent} | intentSource=${intentSource}`);
    console.log(`[RUNTIME_TRACE] 03_COMMAND_GENERATED | ${generateCmd}`);

    res.write(`data: ${JSON.stringify({ content: confirmText })}\n\n`);
    res.write(`data: ${JSON.stringify({ content: `\n${generateCmd}` })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

    logEventFireForget({ userId, type: "marcus_message", data: { messageCount: 1 }, req });
    trackUsageFireForget(userId, "marcusMessages");
    return;
  }

  // Cap history to last 10 exchanges to prevent prompt bloat on long conversations
  const trimmedMessages = messages.slice(-10);

  req.log.info({
    event: "SYSTEM_PROMPT_FLAGS",
    chatbotEngine: isChatbotRequest,
    websiteEngine: isWebsiteRequest,
    automationEngine: isAutomationRequest,
    biEngine: isBiRequest,
    orchestratorEngine: isOrchestratorRequest,
    executionConfirmationMode: shouldBypassLLM,
    workspaceIntent,
    intentSource,
    intentIsFromConfirmation,
    isConfirmationResponse,
    confirmIntent: confirmationResult.intent,
    pendingIntent: clientPendingIntent?.type ?? null,
    systemPromptLength: systemPrompt.length,
    containsPendingConfirmationBlock: systemPrompt.includes("PENDING CONFIRMATION"),
  }, "[MARCUS] SYSTEM_PROMPT_FLAGS");

  // ── PROMPT_BLOCK_PROOF — verify each execution engine block is physically present ──
  // Checks whether the conditional template strings actually expanded into the
  // assembled systemPrompt. A flag=true with blockPresent=false means the template
  // expansion failed. A flag=false with blockPresent=true means a logic error.
  const BLOCK_MARKERS = {
    chatbot:      "[Workspace Execution Engine — direct workspace control for EXECUTION INTENTS]",
    automation:   "[Automation Execution Engine — direct workspace control for automation building]",
    website:      "[Website Execution Engine — direct workspace control for website generation]",
    bi:           "[Business Intelligence Execution Engine — direct workspace control for BI generation]",
    orchestrator: "[Execution Engine — direct workspace control for execution planning]",
  };
  const blockProof = {
    chatbot:      { flag: isChatbotRequest,      blockPresent: systemPrompt.includes(BLOCK_MARKERS.chatbot),      hasWorkspaceCmd: systemPrompt.includes("{{WORKSPACE|chatbot}}") },
    automation:   { flag: isAutomationRequest,   blockPresent: systemPrompt.includes(BLOCK_MARKERS.automation),   hasWorkspaceCmd: systemPrompt.includes("{{WORKSPACE|automation}}") },
    website:      { flag: isWebsiteRequest,       blockPresent: systemPrompt.includes(BLOCK_MARKERS.website),      hasWorkspaceCmd: systemPrompt.includes("{{WORKSPACE|website}}") },
    bi:           { flag: isBiRequest,            blockPresent: systemPrompt.includes(BLOCK_MARKERS.bi),           hasWorkspaceCmd: systemPrompt.includes("{{WORKSPACE|intelligence}}") },
    orchestrator: { flag: isOrchestratorRequest,  blockPresent: systemPrompt.includes(BLOCK_MARKERS.orchestrator), hasWorkspaceCmd: systemPrompt.includes("{{WORKSPACE|open_orchestrator}}") },
  };
  const blockMismatches = Object.entries(blockProof)
    .filter(([, v]) => v.flag !== v.blockPresent)
    .map(([k, v]) => `${k}: flag=${v.flag} blockPresent=${v.blockPresent}`);

  req.log.info({
    event: "PROMPT_BLOCK_PROOF",
    userMessage: latestUserMessage.slice(0, 200),
    workspaceIntent,
    blocks: blockProof,
    mismatches: blockMismatches,
    mismatchCount: blockMismatches.length,
    signalMatches: moduleConfidences.reduce((acc, m) => {
      acc[m.module] = m.matchedWorkspaceSignals;
      return acc;
    }, {} as Record<string, string[]>),
  }, "[MARCUS] PROMPT_BLOCK_PROOF — execution engine blocks present in assembled prompt");

  const copilotPayload = {
    messages: [{ role: "system" as const, content: systemPrompt }, ...trimmedMessages],
    temperature: 0.4,
    topP: 0.9,
    maxTokens: 8192,
  };

  // ── Model failover chain ────────────────────────────────────────────────────
  // Primary: MODELS.COPILOT (nvidia/nemotron-3-ultra-550b-a55b)
  // Fallback 1: MODELS.COPILOT_FALLBACK_1 (meta/llama-4-maverick-17b-128e-instruct)
  // Fallback 2: MODELS.COPILOT_FALLBACK_2 (nvidia/llama-3.3-nemotron-super-49b-v1)
  //
  // Circuit breaker state determines the starting index:
  //   CLOSED / HALF_OPEN → start at index 0 (try primary first)
  //   OPEN               → start at index 1 (skip primary, go straight to fallback)
  //
  // DEGRADED or timeout errors trigger retries down the chain.
  // Non-retryable errors (network) do NOT cascade to fallbacks.
  // The outage message is shown ONLY when every model in the chain has failed.
  const FAILOVER_CHAIN = [
    MODELS.COPILOT,
    MODELS.COPILOT_FALLBACK_1,
    MODELS.COPILOT_FALLBACK_2,
  ] as const;

  const circuitBlocked = shouldBlock();
  const startIdx = circuitBlocked ? 1 : 0;

  if (circuitBlocked) {
    req.log.warn(
      { event: "COPILOT_CIRCUIT_OPEN", model: MODELS.COPILOT, startingFallback: FAILOVER_CHAIN[1], ...getCircuitHealth() },
      "[CIRCUIT] Circuit OPEN — skipping primary, starting from fallback"
    );
  }

  let streamBody: ReadableStream<Uint8Array>;
  let activeModel: string = FAILOVER_CHAIN[startIdx];
  let failoverTriggeredAt: number | null = null;

  failoverLoop: for (let i = startIdx; i < FAILOVER_CHAIN.length; i++) {
    const model = FAILOVER_CHAIN[i];
    const t0 = Date.now();

    try {
      streamBody = await streamNvidia({ ...copilotPayload, model, signal: AbortSignal.timeout(90_000) });

      if (i === 0) {
        recordSuccess();
      } else {
        req.log.info(
          {
            event:            "MODEL_FAILOVER_SUCCESS",
            failedModel:      MODELS.COPILOT,
            replacementModel: model,
            fallbackIndex:    i,
            latencyMs:        Date.now() - (failoverTriggeredAt ?? t0),
          },
          "[FAILOVER] MODEL_FAILOVER_SUCCESS — Marcus operational on fallback model"
        );
      }

      activeModel = model;
      break failoverLoop;

    } catch (err) {
      const isDegraded  = isModelDegradedError(err);
      const isTimeout   = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
      const isRetryable = isDegraded || isTimeout;
      const errorMsg    = String(err);

      if (i === 0) {
        if (isDegraded)      recordDegraded(errorMsg);
        else if (isTimeout)  recordTimeout(errorMsg);
        else                 recordNetworkError(errorMsg);
      }

      const nextModel = FAILOVER_CHAIN[i + 1];

      if (isRetryable && nextModel) {
        if (failoverTriggeredAt === null) failoverTriggeredAt = t0;
        req.log.warn(
          {
            event:         "MODEL_FAILOVER_TRIGGERED",
            originalModel: model,
            fallbackModel: nextModel,
            reason:        isDegraded ? "DEGRADED" : "timeout",
            errorMsg:      errorMsg.slice(0, 300),
            attemptIndex:  i,
          },
          "[FAILOVER] MODEL_FAILOVER_TRIGGERED — retrying with next model"
        );
        continue failoverLoop;
      }

      req.log.error(
        {
          event:           "MODEL_FAILOVER_FAILED",
          attemptedModels: FAILOVER_CHAIN.slice(startIdx, i + 1),
          finalError:      errorMsg.slice(0, 300),
          isRetryable,
        },
        "[FAILOVER] MODEL_FAILOVER_FAILED — all models exhausted"
      );

      const userMessage = isRetryable
        ? "Marcus is temporarily unavailable because the underlying AI deployment is currently experiencing an outage.\n\nYour request was not lost.\n\nPlease try again shortly."
        : "Something went wrong reaching the AI. Please try again.";

      res.write(`data: ${JSON.stringify({ content: userMessage })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }
  }

  try {
    let result = await forwardStream(streamBody!, res, activeModel);

    req.log.info({
      event: "MODEL_RAW_RESPONSE",
      model: activeModel,
      isConfirmationResponse,
      confirmIntent: confirmationResult.intent,
      workspaceIntent,
      shouldBypassLLM,
      rawResponseLength: result?.length ?? 0,
      rawResponse: (result ?? "").slice(0, 1000),
      containsGenerateWebsite:    (result ?? "").includes("generate_website"),
      containsGenerateChatbot:    (result ?? "").includes("generate_chatbot"),
      containsGenerateAutomation: (result ?? "").includes("generate_automation"),
      containsWorkspaceTag:       (result ?? "").includes("{{WORKSPACE"),
    }, "[MARCUS] MODEL_RAW_RESPONSE");

    // ─── ROUTING_TRACE (log-only, diagnostic) ───────────────────────────────────
    // Complete end-to-end trace of the routing decision for this request:
    //   1. user message
    //   2. raw LLM response (full, untruncated)
    //   3. every {{WORKSPACE|...}} tag emitted, in order
    //   4. every parsed command + payload derived from those tags
    //   5. module selected by the signal-matching layer (see ROUTING_TRACE_SIGNAL_MATCH above)
    //   6/7/8. navigate / populate / generate targets found among the emitted tags
    // Compare workspaceIntent (step 5) against the module implied by the emitted
    // tags (steps 6-8) to see whether the mismatch originates in the signal-matching
    // layer (wrong engine block injected into the prompt) or in the LLM's own tag
    // emission (right engine injected, but LLM emitted the wrong tag).
    const emittedWorkspaceTags = extractWorkspaceTags(result ?? "");
    const parsedCommands = emittedWorkspaceTags.map(t => ({ command: t.command, payload: t.payload.slice(0, 200) }));
    const navigateTag = emittedWorkspaceTags.find(t => NAVIGATE_COMMANDS.has(t.command)) ?? null;
    const populateTag = emittedWorkspaceTags.find(t => POPULATE_COMMANDS.has(t.command)) ?? null;
    const generateTag = emittedWorkspaceTags.find(t => GENERATE_COMMANDS.has(t.command)) ?? null;

    req.log.info({
      event: "ROUTING_TRACE",
      userMessage: latestUserMessage.slice(0, 500),
      rawLLMResponse: result ?? "",
      emittedWorkspaceTags: emittedWorkspaceTags.map(t => t.tag),
      parsedCommands,
      workspaceIntent,
      navigateTarget: navigateTag ? { command: navigateTag.command, tag: navigateTag.tag } : null,
      populateTarget: populateTag ? { command: populateTag.command, payload: populateTag.payload.slice(0, 200), tag: populateTag.tag } : null,
      generateTarget: generateTag ? { command: generateTag.command, tag: generateTag.tag } : null,
      // Maps every LLM-emitted tag type to the module it implies, so the
      // mismatch check can compare against workspaceIntent regardless of
      // whether the LLM emitted a navigate, populate, or generate tag.
      // Previously only generate tags were checked — navigate tags were
      // structurally invisible to the mismatch flag even though they reveal
      // the same routing divergence one step earlier in the flow.
      moduleImpliedByGenerateTag: generateTag
        ? (generateTag.command === "generate_chatbot"      ? "chatbot"
          : generateTag.command === "generate_website"     ? "website"
          : generateTag.command === "generate_automation"  ? "automation"
          : generateTag.command === "generate_intelligence"? "bi"
          : generateTag.command === "generate_orchestrator"? "orchestrator"
          : "unknown")
        : null,
      moduleImpliedByNavigateTag: navigateTag
        ? (navigateTag.command === "chatbot"           ? "chatbot"
          : navigateTag.command === "website"          ? "website"
          : navigateTag.command === "automation"       ? "automation"
          : navigateTag.command === "intelligence"     ? "bi"
          : navigateTag.command === "open_orchestrator"? "orchestrator"
          : "unknown")
        : null,
      mismatchBetweenSignalMatchingAndLLMOutput: (() => {
        // Resolve the module the LLM implied, preferring generate > navigate.
        // A generate tag is definitive; a navigate tag is the "open workspace"
        // step that precedes generation and reveals the same intent.
        const impliedModule: string | null = generateTag
          ? (generateTag.command === "generate_chatbot"       ? "chatbot"
            : generateTag.command === "generate_website"      ? "website"
            : generateTag.command === "generate_automation"   ? "automation"
            : generateTag.command === "generate_intelligence" ? "bi"
            : generateTag.command === "generate_orchestrator" ? "orchestrator"
            : null)
          : navigateTag
            ? (navigateTag.command === "chatbot"            ? "chatbot"
              : navigateTag.command === "website"           ? "website"
              : navigateTag.command === "automation"        ? "automation"
              : navigateTag.command === "intelligence"      ? "bi"
              : navigateTag.command === "open_orchestrator" ? "orchestrator"
              : null)
            : null;
        return impliedModule !== null ? impliedModule !== workspaceIntent : false;
      })(),
    }, "[MARCUS][ROUTING_TRACE] Full routing trace — user message → LLM output → parsed commands → navigate/populate/generate targets");

    req.log.info(
      {
        event: "MARCUS_STAGE_1_RESPONSE_CREATED",
        model: activeModel,
        hasContent: !!result,
        userId,
        requestType,
        intentType: serverIntentType,
      },
      "[MARCUS] MARCUS_STAGE_1_RESPONSE_CREATED — Marcus response delivered to client",
    );
    if (!result) {
      // Empty response — retry once with a fresh NVIDIA call (model occasionally returns nothing)
      req.log.warn({ model: activeModel }, `[AI:${activeModel}] Empty response — retrying`);
      try {
        const retryBody = await streamNvidia({ ...copilotPayload, model: activeModel, signal: AbortSignal.timeout(90_000) });
        result = await forwardStream(retryBody, res, activeModel);
      } catch (retryErr) {
        req.log.error({ err: retryErr, model: activeModel }, `[AI:${activeModel}] Retry also failed`);
      }
    }
    if (!result) {
      res.write(`data: ${JSON.stringify({ error: "The AI service returned an empty response. Please try again." })}\n\n`);
    }

    // ── Navigate+populate fallback ──────────────────────────────────────────
    // When the server identified a workspace module intent but the LLM omitted
    // the navigate/populate workspace tags (a known model reliability issue),
    // inject them as additional SSE events before closing the stream. The client
    // receives and processes these exactly as if the LLM had emitted them —
    // fireAndStripTags fires handleWorkspaceCmdAction, which navigates, sets
    // pendingIntent, and emits the workspace signal to populate the page.
    //
    // Condition: workspaceIntent is set AND no navigate tag was in the response
    //            AND no generate tag (that would be the "yes" confirmation flow)
    //            AND not a confirmation bypass (that's handled above at line ~2879).
    {
      const _allTags = extractWorkspaceTags(result ?? "");
      const _hasNavigate = _allTags.some(t => NAVIGATE_COMMANDS.has(t.command));
      const _hasGenerate = _allTags.some(t => GENERATE_COMMANDS.has(t.command));

      const NAVIGATE_FALLBACK_MAP: Record<string, { nav: string; pop: (idea: string) => string }> = {
        chatbot:      { nav: "{{WORKSPACE|chatbot}}",           pop: (i) => `{{WORKSPACE|idea|${i}}}` },
        automation:   { nav: "{{WORKSPACE|automation}}",        pop: (i) => `{{WORKSPACE|idea|${i}}}` },
        bi:           { nav: "{{WORKSPACE|intelligence}}",      pop: (i) => `{{WORKSPACE|bi_idea|${i}}}` },
        orchestrator: { nav: "{{WORKSPACE|open_orchestrator}}", pop: (i) => `{{WORKSPACE|idea|${i}}}` },
        website:      { nav: "{{WORKSPACE|website}}",           pop: (i) => `{{WORKSPACE|idea|${i}}}` },
      };

      const fallbackEntry = NAVIGATE_FALLBACK_MAP[workspaceIntent];
      if (
        fallbackEntry &&
        !_hasNavigate &&
        !_hasGenerate &&
        !isConfirmationResponse &&
        result
      ) {
        // Sanitize: strip any `}}` sequences to prevent malformed tag nesting,
        // then trim to 500 chars so the tag payload stays parseable.
        const fallbackIdea = (
          wsProject?.businessIdea ||
          clientPendingIntent?.idea ||
          latestUserMessage
        ).trim().replace(/}}/g, "").slice(0, 500);

        const navCmd = fallbackEntry.nav;
        const popCmd = fallbackIdea ? fallbackEntry.pop(fallbackIdea) : null;

        res.write(`data: ${JSON.stringify({ content: `\n${navCmd}` })}\n\n`);
        if (popCmd) res.write(`data: ${JSON.stringify({ content: `\n${popCmd}` })}\n\n`);

        req.log.info(
          { event: "NAVIGATE_FALLBACK_INJECTED", workspaceIntent, navCmd, popCmdLength: popCmd?.length ?? 0, ideaSource: wsProject?.businessIdea ? "wsProject" : clientPendingIntent?.idea ? "clientPendingIntent" : "latestUserMessage" },
          "[MARCUS] NAVIGATE_FALLBACK_INJECTED — LLM omitted navigate tags, server injected"
        );
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    req.log.error({ err, model: MODELS.COPILOT }, `[AI:${MODELS.COPILOT}] Copilot stream error`);
    res.write(`data: ${JSON.stringify({ error: String(err) })}\n\n`);
  }

  res.end();

  // ─── Event tracking ────────────────────────────────────────────────────────
  logEventFireForget({ userId, type: "marcus_message", data: { messageCount: trimmedMessages.length }, req });
  trackUsageFireForget(userId, "marcusMessages");

  // ─── Background memory extraction ─────────────────────────────────────────
  // Fire-and-forget after response is sent. Never blocks the user.
  // Detects strategic statements in the latest user message and persists
  // them to aiMemoryTable so they are available in all future requests.
  const latestUserMessageForMemory = trimmedMessages.filter(m => m.role === "user").at(-1)?.content;
  if (latestUserMessageForMemory) {
    extractProjectMemories(userId, latestUserMessageForMemory, wsProject?.title, req.log).catch(() => {});
  }

  // ─── Agent run intent detection ────────────────────────────────────────────
  // When the user explicitly asks Marcus to run an agent, detect the intent
  // and dispatch through the worker. Fire-and-forget — never blocks response.
  // Only acts when a matching installed agent exists for this user.
  // Marcus should ONLY act when requested — never autonomously.
  ;(async () => {
    if (!latestUserMessageForMemory) return;
    const msg = latestUserMessageForMemory.toLowerCase();

    // Must contain a run verb
    if (!/\b(run|start|activate|trigger|execute|launch)\b/.test(msg)) return;

    // Map natural-language agent names to catalog keys
    let matchedKey: string | null = null;
    for (const [name, key] of Object.entries(AGENT_NAME_TO_KEY)) {
      if (msg.includes(name)) { matchedKey = key; break; }
    }
    if (!matchedKey) return;

    // Only trigger if the user actually has this agent installed and active
    const activeAgentsList = await discoverActiveAgents(userId).catch(
      (): Awaited<ReturnType<typeof discoverActiveAgents>> => []
    );
    const installedAgent = activeAgentsList.find(a => a.agentId === matchedKey);
    if (!installedAgent) return;

    await runAgent({
      userId,
      agentId:   installedAgent.id,
      agentKey:  matchedKey,
      projectId: activeProjectId ?? null,
    }).catch(err => req.log.error({ err, agentKey: matchedKey }, "[Marcus] agent run dispatch failed"));
  })();
});

export default router;
