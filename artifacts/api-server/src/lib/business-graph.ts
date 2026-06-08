/**
 * STAGEONE V5 — Business Graph Memory Service
 *
 * Central intelligence layer: every project maintains a living business graph
 * that is automatically updated whenever a generation completes.
 *
 * Public API:
 *   getBusinessGraph(projectId)
 *   upsertBusinessGraph(projectId, userId, fields)
 *   createBusinessEvent(projectId, userId, eventType, label, metadata?)
 *   getBusinessTimeline(projectId, limit?)
 *   createMemorySnapshot(projectId, userId, trigger)
 *
 * Update pipelines (called by generation routes — fire-and-forget, never throws):
 *   onBusinessIntelligenceComplete(projectId, userId, idea, aiOutput)
 *   onWebsiteGenerationComplete(projectId, userId, idea, websiteData)
 *   onChatbotGenerationComplete(projectId, userId, idea, chatbotData)
 *   onAutomationGenerationComplete(projectId, userId, idea, automationData)
 */

import {
  db,
  businessGraphsTable,
  graphNodesTable,
  graphRelationshipsTable,
  businessEventsTable,
  memorySnapshotsTable,
  type BusinessGraph,
  type InsertBusinessGraph,
  type InsertGraphNode,
  type InsertBusinessEvent,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";

// ─── Types ────────────────────────────────────────────────────────────────────

export type BusinessEventType =
  | "business.generated"
  | "website.generated"
  | "website.regenerated"
  | "chatbot.generated"
  | "automation.generated"
  | "pricing.updated"
  | "workflow.created"
  | "goal.added"
  | "risk.detected"
  | "graph.updated";

export interface GraphFields {
  identity?: Record<string, unknown>;
  audience?: Record<string, unknown>;
  positioning?: Record<string, unknown>;
  revenue?: Record<string, unknown>;
  assets?: Record<string, unknown>;
  operations?: Record<string, unknown>;
  risks?: Record<string, unknown>;
  goals?: Record<string, unknown>;
  rawIntelligence?: unknown;
  rawWebsite?: unknown;
}

// ─── Core Graph CRUD ──────────────────────────────────────────────────────────

export async function getBusinessGraph(projectId: string): Promise<BusinessGraph | null> {
  const [graph] = await db
    .select()
    .from(businessGraphsTable)
    .where(eq(businessGraphsTable.projectId, projectId))
    .limit(1);
  return graph ?? null;
}

export async function upsertBusinessGraph(
  projectId: string,
  userId: string,
  fields: GraphFields,
): Promise<BusinessGraph> {
  const existing = await getBusinessGraph(projectId);

  if (existing) {
    const [updated] = await db
      .update(businessGraphsTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(businessGraphsTable.id, existing.id))
      .returning();
    return updated;
  }

  const [created] = await db
    .insert(businessGraphsTable)
    .values({ projectId, userId, ...fields } as InsertBusinessGraph)
    .returning();
  return created;
}

// ─── Graph Nodes ──────────────────────────────────────────────────────────────

export async function addGraphNodes(
  graphId: string,
  nodes: Omit<InsertGraphNode, "graphId">[],
): Promise<void> {
  if (nodes.length === 0) return;
  await db.insert(graphNodesTable).values(nodes.map(n => ({ ...n, graphId })));
}

export async function getGraphNodes(graphId: string) {
  return db
    .select()
    .from(graphNodesTable)
    .where(eq(graphNodesTable.graphId, graphId))
    .orderBy(desc(graphNodesTable.importance));
}

// ─── Business Events ──────────────────────────────────────────────────────────

export async function createBusinessEvent(
  projectId: string,
  userId: string,
  eventType: BusinessEventType,
  label: string,
  metadata: Record<string, unknown> = {},
  description?: string,
): Promise<void> {
  await db.insert(businessEventsTable).values({
    projectId,
    userId,
    eventType,
    label,
    description,
    metadata,
    occurredAt: new Date(),
  } as InsertBusinessEvent);
}

// ─── Timeline ─────────────────────────────────────────────────────────────────

export async function getBusinessTimeline(
  projectId: string,
  limit = 50,
) {
  return db
    .select()
    .from(businessEventsTable)
    .where(eq(businessEventsTable.projectId, projectId))
    .orderBy(desc(businessEventsTable.occurredAt))
    .limit(limit);
}

// ─── Memory Snapshots ─────────────────────────────────────────────────────────

export async function createMemorySnapshot(
  projectId: string,
  userId: string,
  trigger: string,
  changeSummary?: string,
): Promise<void> {
  const graph = await getBusinessGraph(projectId);
  if (!graph) return; // Nothing to snapshot yet

  const nodes = await getGraphNodes(graph.id);
  const relationships = await db
    .select()
    .from(graphRelationshipsTable)
    .where(eq(graphRelationshipsTable.graphId, graph.id));

  const snapshot = {
    graph,
    nodes,
    relationships,
    capturedAt: new Date().toISOString(),
  };

  await db.insert(memorySnapshotsTable).values({
    projectId,
    userId,
    graphId: graph.id,
    trigger,
    graphSnapshot: snapshot,
    changeSummary,
    schemaVersion: 1,
  });
}

// ─── Intelligence Extractors ───────────────────────────────────────────────────
// Parse structured AI output → graph fields. Defensive — never throws.

function extractFromBusinessIntelligence(
  idea: string,
  ai: Record<string, unknown>,
): GraphFields {
  const metrics = (ai.metrics ?? {}) as Record<string, unknown>;
  const strategicInsights = (ai.strategicInsights ?? {}) as Record<string, unknown>;
  const competitiveAdvantage = (ai.competitiveAdvantage ?? {}) as Record<string, unknown>;
  const recommendedStack = (ai.recommendedStack ?? {}) as Record<string, unknown>;

  return {
    identity: {
      name: (ai.businessName as string | undefined) ?? idea.slice(0, 80),
      summary: ai.businessSnapshot,
      industry: ai.industry,
      category: ai.industry,
      stage: "idea",
      metrics,
    },
    audience: {
      targetAudience: ai.targetMarket,
      customerProblems: [strategicInsights.growthBottleneck].filter(Boolean),
    },
    positioning: {
      valueProposition: ai.businessSnapshot,
      differentiation: competitiveAdvantage.differentiation,
      competitiveAdvantages: Object.values(competitiveAdvantage).filter(Boolean),
    },
    revenue: {
      monetizationStrategy: (recommendedStack.payments as string | undefined),
      pricingModel: null,
    },
    operations: {
      onboarding: strategicInsights.highestLeverageAutomation,
      leadGeneration: strategicInsights.fastestChannel,
    },
    risks: {
      knownRisks: [strategicInsights.operationalRisk].filter(Boolean),
      assumptions: [],
      gaps: [],
    },
    goals: {
      shortTerm: ((ai.growthPlan as string[] | undefined) ?? []).slice(0, 2),
      longTerm: ((ai.growthPlan as string[] | undefined) ?? []).slice(2),
    },
    rawIntelligence: ai,
  };
}

function extractFromWebsite(
  websiteData: Record<string, unknown>,
): Partial<GraphFields> {
  const brand = (websiteData.brand ?? {}) as Record<string, unknown>;
  const sections = (websiteData.sections ?? {}) as Record<string, unknown>;
  const hero = (sections.hero ?? {}) as Record<string, unknown>;
  const pricing = (sections.pricing ?? {}) as Record<string, unknown>;

  return {
    assets: {
      websites: [
        {
          generatedAt: new Date().toISOString(),
          brandName: brand.name,
          tagline: brand.tagline,
          designVariant: websiteData.designVariant,
          designSpace: websiteData._designSpace,
          heroHeadline: hero.headline,
          primaryCta: hero.ctaPrimary,
        },
      ],
    },
    revenue: {
      pricingModel: pricing.tiers ? JSON.stringify(pricing.tiers) : undefined,
    },
    rawWebsite: websiteData,
  };
}

// ─── Update Pipelines (fire-and-forget) ───────────────────────────────────────
// These are safe to call without await in generation routes.

export async function onBusinessIntelligenceComplete(
  projectId: string | undefined,
  userId: string,
  idea: string,
  aiOutput: Record<string, unknown>,
): Promise<void> {
  if (!projectId) return;
  try {
    const fields = extractFromBusinessIntelligence(idea, aiOutput);
    const graph = await upsertBusinessGraph(projectId, userId, fields);

    // Seed core nodes
    const nodes: Omit<InsertGraphNode, "graphId">[] = [
      { nodeType: "identity", label: (fields.identity?.name as string) ?? idea.slice(0, 80), description: fields.identity?.summary as string, importance: 10, source: "business_intelligence", data: fields.identity ?? {} },
      { nodeType: "audience", label: "Target Audience", description: fields.audience?.targetAudience as string, importance: 8, source: "business_intelligence", data: fields.audience ?? {} },
      { nodeType: "positioning", label: "Value Proposition", description: fields.positioning?.valueProposition as string, importance: 9, source: "business_intelligence", data: fields.positioning ?? {} },
      { nodeType: "risk", label: "Operational Risk", description: ((fields.risks?.knownRisks as string[]) ?? [])[0], importance: 7, source: "business_intelligence", data: fields.risks ?? {} },
    ];
    await addGraphNodes(graph.id, nodes);

    const isFirst = !(await db
      .select({ id: businessEventsTable.id })
      .from(businessEventsTable)
      .where(and(
        eq(businessEventsTable.projectId, projectId),
        eq(businessEventsTable.eventType, "business.generated"),
      ))
      .limit(1)
      .then(r => r[0]));

    await createBusinessEvent(
      projectId,
      userId,
      isFirst ? "business.generated" : "business.generated",
      isFirst ? "Business intelligence generated" : "Business intelligence regenerated",
      { industry: aiOutput.industry, idea: idea.slice(0, 100) },
      fields.identity?.summary as string | undefined,
    );

    await createMemorySnapshot(projectId, userId, "business_intelligence", "Business intelligence analysis completed");
  } catch {
    // Non-fatal — graph updates are best-effort
  }
}

export async function onWebsiteGenerationComplete(
  projectId: string | undefined,
  userId: string,
  idea: string,
  websiteData: Record<string, unknown>,
): Promise<void> {
  if (!projectId) return;
  try {
    const fields = extractFromWebsite(websiteData);
    const graph = await upsertBusinessGraph(projectId, userId, fields);

    // Add website asset node
    const brand = (websiteData.brand ?? {}) as Record<string, unknown>;
    await addGraphNodes(graph.id, [{
      nodeType: "asset",
      label: `Website — ${brand.name ?? "Unnamed"}`,
      description: `Generated website with ${websiteData.designVariant ?? "default"} design`,
      importance: 8,
      source: "website_generation",
      data: {
        designVariant: websiteData.designVariant,
        designSpace: websiteData._designSpace,
        brandName: brand.name,
        generatedAt: new Date().toISOString(),
      },
    }]);

    // Count prior website events to distinguish generated vs regenerated
    const priorWebsiteEvents = await db
      .select({ id: businessEventsTable.id })
      .from(businessEventsTable)
      .where(and(
        eq(businessEventsTable.projectId, projectId),
        eq(businessEventsTable.eventType, "website.generated"),
      ))
      .limit(1);

    const isRegen = priorWebsiteEvents.length > 0;

    await createBusinessEvent(
      projectId,
      userId,
      isRegen ? "website.regenerated" : "website.generated",
      isRegen ? "Website regenerated" : "Website generated",
      {
        designVariant: websiteData.designVariant,
        designSpace: websiteData._designSpace,
        industry: websiteData._industry,
        idea: idea.slice(0, 100),
      },
      `${websiteData.designVariant ?? "Website"} design generated for "${idea.slice(0, 60)}"`,
    );

    await createMemorySnapshot(projectId, userId, "website_generation", `Website generation completed — ${websiteData.designVariant ?? "default"} variant`);
  } catch {
    // Non-fatal
  }
}

export async function onChatbotGenerationComplete(
  projectId: string | undefined,
  userId: string,
  idea: string,
  chatbotData: Record<string, unknown>,
): Promise<void> {
  if (!projectId) return;
  try {
    const graph = await upsertBusinessGraph(projectId, userId, {
      assets: {
        chatbots: [{
          generatedAt: new Date().toISOString(),
          name: chatbotData.name ?? "Chatbot",
          purpose: chatbotData.purpose,
        }],
      },
    });

    await addGraphNodes(graph.id, [{
      nodeType: "asset",
      label: `Chatbot — ${chatbotData.name ?? "Unnamed"}`,
      description: chatbotData.purpose as string | undefined,
      importance: 7,
      source: "chatbot_generation",
      data: chatbotData,
    }]);

    await createBusinessEvent(projectId, userId, "chatbot.generated", "Chatbot generated",
      { idea: idea.slice(0, 100) });

    await createMemorySnapshot(projectId, userId, "chatbot_generation", "Chatbot generation completed");
  } catch {
    // Non-fatal
  }
}

// ─── Marcus Memory Helpers ─────────────────────────────────────────────────────
// These four functions are called by the copilot route before every response
// to load the project's persistent intelligence graph into Marcus's context.

export async function getRelevantGraphNodes(graphId: string, limit = 12) {
  return db
    .select()
    .from(graphNodesTable)
    .where(eq(graphNodesTable.graphId, graphId))
    .orderBy(desc(graphNodesTable.importance))
    .limit(limit);
}

export async function getRecentBusinessEvents(projectId: string, limit = 15) {
  return getBusinessTimeline(projectId, limit);
}

export interface BusinessContextResult {
  graph: BusinessGraph | null;
  nodes: Awaited<ReturnType<typeof getGraphNodes>>;
  recentEvents: Awaited<ReturnType<typeof getBusinessTimeline>>;
  latestSnapshot: { trigger: string; createdAt: Date } | null;
}

export async function getBusinessContext(projectId: string): Promise<BusinessContextResult> {
  const graph = await getBusinessGraph(projectId);
  if (!graph) {
    return { graph: null, nodes: [], recentEvents: [], latestSnapshot: null };
  }

  const [nodes, recentEvents, snapshots] = await Promise.all([
    getGraphNodes(graph.id),
    getBusinessTimeline(projectId, 15),
    db
      .select({
        trigger: memorySnapshotsTable.trigger,
        createdAt: memorySnapshotsTable.createdAt,
      })
      .from(memorySnapshotsTable)
      .where(eq(memorySnapshotsTable.projectId, projectId))
      .orderBy(desc(memorySnapshotsTable.createdAt))
      .limit(1),
  ]);

  return {
    graph,
    nodes,
    recentEvents,
    latestSnapshot: snapshots[0] ?? null,
  };
}

export function getBusinessMemorySummary(ctx: BusinessContextResult): string {
  const { graph, nodes, recentEvents, latestSnapshot } = ctx;
  if (!graph) return "";

  const sections: string[] = [];

  // Identity
  const identity = graph.identity as Record<string, unknown> | null;
  if (identity) {
    const lines: string[] = [];
    if (identity.name) lines.push(`  Name: ${identity.name}`);
    if (identity.industry) lines.push(`  Industry: ${identity.industry}`);
    if (identity.stage) lines.push(`  Stage: ${identity.stage}`);
    if (identity.summary) lines.push(`  Summary: ${String(identity.summary).slice(0, 200)}`);
    const metrics = identity.metrics as Record<string, unknown> | null;
    if (metrics) {
      const mp: string[] = [];
      if (metrics.marketDifficulty != null) mp.push(`market difficulty ${metrics.marketDifficulty}/10`);
      if (metrics.revenueScalability != null) mp.push(`scalability ${metrics.revenueScalability}/10`);
      if (metrics.automationPotential != null) mp.push(`automation potential ${metrics.automationPotential}%`);
      if (mp.length) lines.push(`  Metrics (INFERENCE): ${mp.join(", ")}`);
    }
    if (lines.length) sections.push(`[IDENTITY]\n${lines.join("\n")}`);
  }

  // Audience
  const audience = graph.audience as Record<string, unknown> | null;
  if (audience) {
    const lines: string[] = [];
    if (audience.targetAudience) lines.push(`  Target: ${audience.targetAudience}`);
    const problems = audience.customerProblems as string[] | null;
    if (problems?.length) lines.push(`  Problems: ${(problems as string[]).filter(Boolean).join(", ")}`);
    if (lines.length) sections.push(`[AUDIENCE]\n${lines.join("\n")}`);
  }

  // Positioning
  const positioning = graph.positioning as Record<string, unknown> | null;
  if (positioning) {
    const lines: string[] = [];
    if (positioning.differentiation) lines.push(`  Differentiation: ${positioning.differentiation}`);
    if (positioning.valueProposition) lines.push(`  Value Prop: ${String(positioning.valueProposition).slice(0, 150)}`);
    if (lines.length) sections.push(`[POSITIONING]\n${lines.join("\n")}`);
  }

  // Revenue model
  const revenue = graph.revenue as Record<string, unknown> | null;
  if (revenue) {
    const lines: string[] = [];
    if (revenue.monetizationStrategy) lines.push(`  Model: ${revenue.monetizationStrategy}`);
    if (revenue.pricingModel) lines.push(`  Pricing: ${String(revenue.pricingModel).slice(0, 100)}`);
    if (lines.length) sections.push(`[REVENUE MODEL]\n${lines.join("\n")}`);
  }

  // Assets — these are FACTS (things that were actually generated)
  const assets = graph.assets as Record<string, unknown> | null;
  if (assets) {
    const lines: string[] = [];
    const websites = assets.websites as unknown[] | null;
    const chatbots = assets.chatbots as unknown[] | null;
    const automations = assets.automations as unknown[] | null;
    if (websites?.length) {
      const site = (websites[websites.length - 1]) as Record<string, unknown>;
      lines.push(`  Websites: ${websites.length} generated${site?.brandName ? ` (brand: ${site.brandName})` : ""}${site?.designVariant ? `, variant: ${site.designVariant}` : ""}`);
    }
    if (chatbots?.length) {
      const bot = (chatbots[chatbots.length - 1]) as Record<string, unknown>;
      lines.push(`  Chatbots: ${chatbots.length} generated${bot?.name ? ` (${bot.name})` : ""}`);
    }
    if (automations?.length) {
      const auto = (automations[automations.length - 1]) as Record<string, unknown>;
      lines.push(`  Automations: ${automations.length} generated${auto?.name ? ` (${auto.name})` : ""}`);
    }
    if (lines.length) sections.push(`[ASSETS (FACT)]\n${lines.join("\n")}`);
  }

  // Operations
  const operations = graph.operations as Record<string, unknown> | null;
  if (operations) {
    const lines: string[] = [];
    if (operations.leadGeneration) lines.push(`  Lead Gen: ${operations.leadGeneration}`);
    if (operations.onboarding) lines.push(`  Onboarding: ${operations.onboarding}`);
    if (lines.length) sections.push(`[OPERATIONS]\n${lines.join("\n")}`);
  }

  // Risks — INFERENCE level (derived from BI)
  const risks = graph.risks as Record<string, unknown> | null;
  if (risks?.knownRisks && Array.isArray(risks.knownRisks)) {
    const known = (risks.knownRisks as string[]).filter(Boolean);
    if (known.length) sections.push(`[RISKS (INFERENCE)]\n  ${known.join("\n  ")}`);
  }

  // Goals
  const goals = graph.goals as Record<string, unknown> | null;
  if (goals) {
    const lines: string[] = [];
    const shortTerm = goals.shortTerm as string[] | null;
    const longTerm = goals.longTerm as string[] | null;
    if (shortTerm?.length) lines.push(`  Short-term: ${(shortTerm as string[]).slice(0, 2).join(" → ")}`);
    if (longTerm?.length) lines.push(`  Long-term: ${(longTerm as string[]).slice(0, 2).join(" → ")}`);
    if (lines.length) sections.push(`[GOALS]\n${lines.join("\n")}`);
  }

  // Key graph nodes (importance-ranked)
  if (nodes.length > 0) {
    const nodeLines = nodes.slice(0, 8).map((n: { nodeType: string; label: string; description?: string | null }) =>
      `  [${n.nodeType.toUpperCase()}] ${n.label}${n.description ? `: ${n.description.slice(0, 100)}` : ""}`
    );
    sections.push(`[KEY GRAPH NODES]\n${nodeLines.join("\n")}`);
  }

  // Recent timeline — FACTS (what actually happened)
  if (recentEvents.length > 0) {
    const eventLines = recentEvents.slice(0, 10).map((ev: { occurredAt: Date; label: string; description?: string | null }) => {
      const date = new Date(ev.occurredAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return `  [${date}] ${ev.label}${ev.description ? ` — ${ev.description.slice(0, 80)}` : ""}`;
    });
    sections.push(`[RECENT TIMELINE (FACT)]\n${eventLines.join("\n")}`);
  }

  // Latest snapshot info
  if (latestSnapshot) {
    const snapDate = new Date(latestSnapshot.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    sections.push(`[LAST MEMORY SNAPSHOT]\n  Captured: ${snapDate} — trigger: ${latestSnapshot.trigger}`);
  }

  return sections.join("\n\n");
}

export async function onAutomationGenerationComplete(
  projectId: string | undefined,
  userId: string,
  idea: string,
  automationData: Record<string, unknown>,
): Promise<void> {
  if (!projectId) return;
  try {
    const graph = await upsertBusinessGraph(projectId, userId, {
      assets: {
        automations: [{
          generatedAt: new Date().toISOString(),
          name: automationData.name ?? "Automation",
          trigger: automationData.trigger,
        }],
      },
    });

    await addGraphNodes(graph.id, [{
      nodeType: "asset",
      label: `Automation — ${automationData.name ?? "Workflow"}`,
      description: automationData.description as string | undefined,
      importance: 7,
      source: "automation_generation",
      data: automationData,
    }]);

    await createBusinessEvent(projectId, userId, "automation.generated", "Automation generated",
      { idea: idea.slice(0, 100) });

    await createMemorySnapshot(projectId, userId, "automation_generation", "Automation generation completed");
  } catch {
    // Non-fatal
  }
}
