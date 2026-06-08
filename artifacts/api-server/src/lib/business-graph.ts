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
