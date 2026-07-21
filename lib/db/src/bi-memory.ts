/**
 * STAGEONE BI Memory Service
 *
 * Stores and retrieves business intelligence learnings across generations.
 * Enables pattern recognition and historical context for new BI generations.
 */

import {
  db,
  biMemoryTable,
  usersTable,
  projectsTable,
} from "@workspace/db";
import { eq, desc, and, ilike, or, sql, inArray } from "drizzle-orm";

// Local type definition to avoid circular dependency with api-server
// This mirrors the structure of BIValidatedOutput from api-server/routes/generate.ts
export interface BIConfidence {
  overall: "HIGH" | "MEDIUM" | "LOW";
  reason: string;
}

export interface BIModuleContext {
  website?: {
    positioning: string;
    conversionGoal: string;
  };
  chatbot?: {
    primaryRole: string;
    requiredCapabilities: string;
  };
  automation?: {
    highestValueWorkflow: string;
    recommendedIntegrations: string[];
  };
  execution?: {
    recommendedAgents: string[];
    prioritySequence: string[];
  };
}

export interface BIQualityScore {
  overall: number;
  completeness: number;
  evidenceStrength: number;
  actionability: number;
}

export interface BIValidationMeta {
  validatedAt: string;
  validationLevel: "IDEA" | "SIGNAL" | "MVP" | "TRACTION" | "SCALE";
  requiresHumanValidation: string[];
}

export interface BIEvidence {
  facts: string[];
  inferences: string[];
  hypotheses: string[];
  unknowns: string[];
}

export interface BIValidatedOutput {
  industry: string;
  metrics: {
    marketDifficulty: number;
    automationPotential: number;
    revenueScalability: number;
    operationalComplexity: number;
    aiAdoptionOpportunity: number;
  };
  businessSnapshot: string;
  targetMarket: string;
  strategicInsights: {
    growthBottleneck: string;
    fastestChannel: string;
    highestLeverageAutomation: string;
    operationalRisk: string;
  };
  competitiveAdvantage: {
    differentiation: string;
    defensibility: string;
    scalabilityEdge: string;
  };
  growthPlan: string[];
  websitePages: string[];
  chatbotRole: string;
  automations: string[];
  recommendedStack: {
    frontend: string[];
    backend: string[];
    automation: string[];
    crm: string;
    payments: string;
  };
  confidence: BIConfidence;
  criticalUnknowns: string[];
  decisionPriorities: string[];
  moduleContext: BIModuleContext;
  evidence: BIEvidence;
  qualityScore: BIQualityScore;
  validation: BIValidationMeta;
}

export interface BiMemoryInput {
  userId: string;
  projectId?: string;
  biOutput: BIValidatedOutput;
  idea: string;
}

export interface BiMemorySearchParams {
  userId: string;
  industry?: string;
  limit?: number;
  minQualityScore?: number;
}

export interface BiMemoryPattern {
  industry: string;
  count: number;
  avgQualityScore: number;
  commonBottlenecks: string[];
  commonChannels: string[];
  commonAutomations: string[];
  commonRisks: string[];
  successfulStrategies: string[];
  confidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface BiMemoryContext {
  patterns: BiMemoryPattern[];
  similarProjects: Array<{
    id: string;
    industry: string;
    businessModel: string;
    qualityScore: number;
    keyLearnings: string[];
  }>;
  totalAnalyses: number;
  industryCoverage: string[];
}

/**
 * Store BI learnings after successful generation
 */
export async function storeBiMemory(input: BiMemoryInput): Promise<void> {
  const { userId, projectId, biOutput, idea } = input;

  try {
    // Extract learnings from BI output
    const learnings = extractLearnings(biOutput, idea);

    await db.insert(biMemoryTable).values({
      userId,
      projectId,
      industry: biOutput.industry,
      industryPattern: learnings.industryPattern,
      businessModel: learnings.businessModel,
      marketDifficulty: biOutput.metrics.marketDifficulty,
      automationPotential: biOutput.metrics.automationPotential,
      revenueScalability: biOutput.metrics.revenueScalability,
      growthBottleneck: biOutput.strategicInsights.growthBottleneck,
      fastestChannel: biOutput.strategicInsights.fastestChannel,
      highestLeverageAutomation: biOutput.strategicInsights.highestLeverageAutomation,
      operationalRisk: biOutput.strategicInsights.operationalRisk,
      competitiveDifferentiation: biOutput.competitiveAdvantage.differentiation,
      competitiveDefensibility: biOutput.competitiveAdvantage.defensibility,
      competitiveScalabilityEdge: biOutput.competitiveAdvantage.scalabilityEdge,
      websitePositioning: biOutput.moduleContext?.website?.positioning,
      websiteConversionGoal: biOutput.moduleContext?.website?.conversionGoal,
      chatbotPrimaryRole: biOutput.moduleContext?.chatbot?.primaryRole,
      chatbotRequiredCapabilities: biOutput.moduleContext?.chatbot?.requiredCapabilities,
      automationHighestValueWorkflow: biOutput.moduleContext?.automation?.highestValueWorkflow,
      automationRecommendedIntegrations: biOutput.moduleContext?.automation?.recommendedIntegrations || [],
      executionRecommendedAgents: biOutput.moduleContext?.execution?.recommendedAgents || [],
      executionPrioritySequence: biOutput.moduleContext?.execution?.prioritySequence || [],
      evidenceFacts: biOutput.evidence?.facts || [],
      evidenceInferences: biOutput.evidence?.inferences || [],
      evidenceHypotheses: biOutput.evidence?.hypotheses || [],
      evidenceUnknowns: biOutput.evidence?.unknowns || [],
      qualityScore: biOutput.qualityScore?.overall,
      completeness: biOutput.qualityScore?.completeness,
      evidenceStrength: biOutput.qualityScore?.evidenceStrength,
      actionability: biOutput.qualityScore?.actionability,
      validationLevel: biOutput.validation?.validationLevel || "IDEA",
      requiresHumanValidation: biOutput.validation?.requiresHumanValidation || [],
    }).onConflictDoNothing();

    console.log(`[BI Memory] Stored learnings for ${biOutput.industry} project`);
  } catch (error) {
    console.error("[BI Memory] Failed to store learnings:", error);
    // Non-fatal - don't block generation
  }
}

/**
 * Extract structured learnings from BI output
 */
export function extractLearnings(output: BIValidatedOutput, idea: string): {
  industryPattern: string;
  businessModel: string;
} {
  const industry = output.industry || "general";
  const model = output.businessSnapshot;
  const bottleneck = output.strategicInsights?.growthBottleneck;
  const channel = output.strategicInsights?.fastestChannel;

  return {
    industryPattern: `${industry}: ${bottleneck?.slice(0, 100) || "no bottleneck identified"} | Primary channel: ${channel?.slice(0, 80) || "no channel identified"}`,
    businessModel: model?.slice(0, 200) || "Unknown",
  };
}

/**
 * Retrieve historical BI context for a new generation
 */
export async function getBiMemoryContext(params: BiMemorySearchParams): Promise<BiMemoryContext> {
  const { userId, industry, limit = 10, minQualityScore = 0 } = params;

  try {
    // Get similar historical analyses
    const conditions = [eq(biMemoryTable.userId, userId)];

    if (industry) {
      conditions.push(eq(biMemoryTable.industry, industry));
    }

    if (minQualityScore > 0) {
      conditions.push(sql`${biMemoryTable.qualityScore} >= ${minQualityScore}`);
    }

    const memories = await db
      .select()
      .from(biMemoryTable)
      .where(and(...conditions))
      .orderBy(desc(biMemoryTable.qualityScore), desc(biMemoryTable.createdAt))
      .limit(limit);

    // Get pattern recognition
    const patterns = await recognizePatterns(userId, industry);

    // Get similar projects
    const similarProjects = memories.map(m => ({
      id: m.id,
      industry: m.industry,
      businessModel: m.businessModel || "Unknown",
      qualityScore: m.qualityScore || 0,
      keyLearnings: [
        m.growthBottleneck,
        m.fastestChannel,
        m.highestLeverageAutomation,
        m.operationalRisk,
      ].filter((v): v is string => Boolean(v)).slice(0, 3),
    }));

    // Get industry coverage
    const industryCoverage = await getIndustryCoverage(userId);

    return {
      patterns,
      similarProjects,
      totalAnalyses: memories.length,
      industryCoverage,
    };
  } catch (error) {
    console.error("[BI Memory] Failed to retrieve context:", error);
    return {
      patterns: [],
      similarProjects: [],
      totalAnalyses: 0,
      industryCoverage: [],
    };
  }
}

/**
 * Recognize patterns across historical BI analyses
 */
async function recognizePatterns(userId: string, industry?: string): Promise<BiMemoryPattern[]> {
  try {
    const conditions = [eq(biMemoryTable.userId, userId)];
    if (industry) {
      conditions.push(eq(biMemoryTable.industry, industry));
    }

    const memories = await db
      .select()
      .from(biMemoryTable)
      .where(and(...conditions))
      .orderBy(desc(biMemoryTable.createdAt));

    if (memories.length === 0) return [];

    // Group by industry
    const byIndustry = memories.reduce((acc, m) => {
      const ind = m.industry;
      if (!acc[ind]) acc[ind] = [];
      acc[ind].push(m);
      return acc;
    }, {} as Record<string, typeof memories>);

    return Object.entries(byIndustry).map(([ind, items]) => {
      const count = items.length;
      const avgQuality = items.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / count;

      // Extract common patterns
      const bottlenecks = items.map(m => m.growthBottleneck).filter((v): v is string => Boolean(v));
      const channels = items.map(m => m.fastestChannel).filter((v): v is string => Boolean(v));
      const automations = items.map(m => m.highestLeverageAutomation).filter((v): v is string => Boolean(v));
      const risks = items.map(m => m.operationalRisk).filter((v): v is string => Boolean(v));

      // Find most common (simple frequency)
      const getMostCommon = (arr: string[]) => {
        const freq = arr.reduce((acc, v) => { acc[v] = (acc[v] || 0) + 1; return acc; }, {} as Record<string, number>);
        return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([v]) => v);
      };

      const commonBottlenecks = getMostCommon(bottlenecks);
      const commonChannels = getMostCommon(channels);
      const commonAutomations = getMostCommon(automations);
      const commonRisks = getMostCommon(risks);

      // Extract successful strategies
      const strategies = items
        .filter(m => (m.qualityScore || 0) >= 70)
        .flatMap(m => [
          m.fastestChannel,
          m.highestLeverageAutomation,
          m.competitiveDifferentiation,
        ])
        .filter((s): s is string => Boolean(s));

      const uniqueStrategies = [...new Set(strategies)].slice(0, 5);

      let confidence: "HIGH" | "MEDIUM" | "LOW" = "LOW";
      if (count >= 10 && avgQuality >= 70) confidence = "HIGH";
      else if (count >= 5 && avgQuality >= 50) confidence = "MEDIUM";

      return {
        industry: ind,
        count,
        avgQualityScore: Math.round(avgQuality),
        commonBottlenecks,
        commonChannels,
        commonAutomations,
        commonRisks,
        successfulStrategies: uniqueStrategies,
        confidence,
      };
    });
  } catch (error) {
    console.error("[BI Memory] Pattern recognition failed:", error);
    return [];
  }
}

/**
 * Get industry coverage for user
 */
async function getIndustryCoverage(userId: string): Promise<string[]> {
  try {
    const result = await db
      .selectDistinct({ industry: biMemoryTable.industry })
      .from(biMemoryTable)
      .where(eq(biMemoryTable.userId, userId));
    return result.map(r => r.industry);
  } catch {
    return [];
  }
}

/**
 * Store user feedback on BI output
 */
export async function storeBiFeedback(
  userId: string,
  projectId: string,
  insightId: string,
  feedback: "correct" | "incorrect" | "useful" | "not_useful",
  notes?: string
): Promise<void> {
  try {
    // Find the memory entry for this project
    const [memory] = await db
      .select()
      .from(biMemoryTable)
      .where(and(
        eq(biMemoryTable.userId, userId),
        eq(biMemoryTable.projectId, projectId)
      ))
      .orderBy(desc(biMemoryTable.createdAt))
      .limit(1);

    if (memory) {
      await db
        .update(biMemoryTable)
        .set({
          feedbackCorrect: feedback === "correct" || feedback === "useful",
          feedbackNotes: notes,
          updatedAt: new Date(),
        })
        .where(eq(biMemoryTable.id, memory.id));

      console.log(`[BI Memory] Stored feedback: ${feedback} for project ${projectId}`);
    }
  } catch (error) {
    console.error("[BI Memory] Failed to store feedback:", error);
  }
}

/**
 * Increment retrieval count for a memory entry
 */
export async function incrementRetrievalCount(memoryId: string): Promise<void> {
  try {
    await db
      .update(biMemoryTable)
      .set({
        timesRetrieved: sql`${biMemoryTable.timesRetrieved} + 1`,
        lastRetrievedAt: new Date(),
      })
      .where(eq(biMemoryTable.id, memoryId));
  } catch (error) {
    console.error("[BI Memory] Failed to increment retrieval count:", error);
  }
}

/**
 * Get BI memory statistics for user
 */
export async function getBiMemoryStats(userId: string): Promise<{
  totalAnalyses: number;
  industriesCovered: number;
  avgQualityScore: number;
  topIndustries: Array<{ industry: string; count: number }>;
}> {
  try {
    const memories = await db
      .select()
      .from(biMemoryTable)
      .where(eq(biMemoryTable.userId, userId));

    const totalAnalyses = memories.length;
    const industriesCovered = new Set(memories.map(m => m.industry)).size;
    const avgQualityScore = memories.length > 0
      ? Math.round(memories.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / memories.length)
      : 0;

    const industryCounts = memories.reduce((acc, m) => {
      acc[m.industry] = (acc[m.industry] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topIndustries = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([industry, count]) => ({ industry, count }));

    return {
      totalAnalyses,
      industriesCovered,
      avgQualityScore,
      topIndustries,
    };
  } catch (error) {
    console.error("[BI Memory] Failed to get stats:", error);
    return {
      totalAnalyses: 0,
      industriesCovered: 0,
      avgQualityScore: 0,
      topIndustries: [],
    };
  }
}