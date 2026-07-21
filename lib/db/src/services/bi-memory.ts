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
import { eq, desc, and, ilike, or, sql } from "drizzle-orm";
import { BIValidatedOutput } from "../bi-memory";
import type { BiMemory } from "@workspace/db";

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
  avgMetrics: {
    marketDifficulty: number;
    automationPotential: number;
    revenueScalability: number;
  };
}

export interface BiMemoryContext {
  patterns: BiMemoryPattern[];
  recentMemories: BiMemory[];
  totalAnalyses: number;
  industryExperience: string[];
}

/**
 * Store BI learnings after a generation completes
 */
export async function storeBiMemory(input: BiMemoryInput): Promise<void> {
  try {
    const { userId, projectId, biOutput, idea } = input;

    // Extract learnings from BI output
    const memoryData = {
      userId,
      projectId,
      industry: biOutput.industry,
      industryPattern: extractIndustryPattern(biOutput),
      businessModel: biOutput.businessSnapshot,
      marketDifficulty: biOutput.metrics.marketDifficulty,
      automationPotential: biOutput.metrics.automationPotential,
      revenueScalability: biOutput.metrics.revenueScalability,
      operationalComplexity: biOutput.metrics.operationalComplexity,
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
      automationRecommendedIntegrations: biOutput.moduleContext?.automation?.recommendedIntegrations ?? [],
      executionRecommendedAgents: biOutput.moduleContext?.execution?.recommendedAgents ?? [],
      executionPrioritySequence: biOutput.moduleContext?.execution?.prioritySequence ?? [],
      evidenceFacts: biOutput.evidence?.facts ?? [],
      evidenceInferences: biOutput.evidence?.inferences ?? [],
      evidenceHypotheses: biOutput.evidence?.hypotheses ?? [],
      evidenceUnknowns: biOutput.evidence?.unknowns ?? [],
      qualityScore: biOutput.qualityScore?.overall,
      completeness: biOutput.qualityScore?.completeness,
      evidenceStrength: biOutput.qualityScore?.evidenceStrength,
      actionability: biOutput.qualityScore?.actionability,
      validationLevel: biOutput.validation?.validationLevel ?? "IDEA",
      requiresHumanValidation: biOutput.validation?.requiresHumanValidation ?? [],
    };

    await db.insert(biMemoryTable).values(memoryData as any);
  } catch (error) {
    console.error("[BI Memory] Failed to store memory:", error);
    // Non-fatal - don't block generation
  }
}

/**
 * Search for relevant BI memories
 */
export async function searchBiMemories(params: BiMemorySearchParams): Promise<any[]> {
  const { userId, industry, limit = 10, minQualityScore = 0 } = params;

  try {
    const conditions = [
      eq(biMemoryTable.userId, userId),
    ];

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

    // Update retrieval tracking
    if (memories.length > 0) {
      const ids = memories.map(m => m.id);
      await db
        .update(biMemoryTable)
        .set({
          timesRetrieved: sql`${biMemoryTable.timesRetrieved} + 1`,
          lastRetrievedAt: new Date(),
        })
        .where(sql`${biMemoryTable.id} IN (${ids.join(",")})`);
    }

    return memories;
  } catch (error) {
    console.error("[BI Memory] Search failed:", error);
    return [];
  }
}

/**
 * Get pattern recognition across all user's BI analyses
 */
export async function getBiMemoryPatterns(userId: string): Promise<BiMemoryPattern[]> {
  try {
    const memories = await db
      .select()
      .from(biMemoryTable)
      .where(eq(biMemoryTable.userId, userId))
      .orderBy(desc(biMemoryTable.createdAt));

    // Group by industry
    const byIndustry = new Map<string, typeof memories>();

    for (const memory of memories) {
      const existing = byIndustry.get(memory.industry) || [];
      existing.push(memory);
      byIndustry.set(memory.industry, existing);
    }

    const patterns: BiMemoryPattern[] = [];

    for (const [industry, industryMemories] of byIndustry) {
      const validMemories = industryMemories.filter(m => m.qualityScore && m.qualityScore > 0);

      if (validMemories.length === 0) continue;

      // Extract common patterns
      const bottlenecks = validMemories.map(m => m.growthBottleneck).filter(Boolean);
      const channels = validMemories.map(m => m.fastestChannel).filter(Boolean);
      const automations = validMemories.map(m => m.highestLeverageAutomation).filter(Boolean);
      const risks = validMemories.map(m => m.operationalRisk).filter(Boolean);

      patterns.push({
        industry,
        count: validMemories.length,
        avgQualityScore: Math.round(validMemories.reduce((sum, m) => sum + (m.qualityScore || 0), 0) / validMemories.length),
        commonBottlenecks: getMostCommonStrings(bottlenecks, 3),
        commonChannels: getMostCommonStrings(channels, 3),
        commonAutomations: getMostCommonStrings(automations, 3),
        commonRisks: getMostCommonStrings(risks, 3),
        avgMetrics: {
          marketDifficulty: Math.round(validMemories.reduce((sum, m) => sum + (m.marketDifficulty || 0), 0) / validMemories.length),
          automationPotential: Math.round(validMemories.reduce((sum, m) => sum + (m.automationPotential || 0), 0) / validMemories.length),
          revenueScalability: Math.round(validMemories.reduce((sum, m) => sum + (m.revenueScalability || 0), 0) / validMemories.length),
        },
      });
    }

    return patterns.sort((a, b) => b.count - a.count);
  } catch (error) {
    console.error("[BI Memory] Pattern recognition failed:", error);
    return [];
  }
}

/**
 * Get full BI memory context for a new generation
 */
export async function getBiMemoryContext(userId: string, industry?: string): Promise<BiMemoryContext> {
  try {
    const [patterns, recentMemories] = await Promise.all([
      getBiMemoryPatterns(userId),
      searchBiMemories({ userId, industry, limit: 5, minQualityScore: 50 }),
    ]);

    const totalAnalyses = await db
      .select({ count: sql<number>`count(*)` })
      .from(biMemoryTable)
      .where(eq(biMemoryTable.userId, userId));

    const industryExperience = Array.from(
      new Set(
        (await db
          .select({ industry: biMemoryTable.industry })
          .from(biMemoryTable)
          .where(eq(biMemoryTable.userId, userId))
        ).map(m => m.industry)
      )
    );

    return {
      patterns,
      recentMemories,
      totalAnalyses: totalAnalyses[0]?.count || 0,
      industryExperience,
    };
  } catch (error) {
    console.error("[BI Memory] Context retrieval failed:", error);
    return {
      patterns: [],
      recentMemories: [],
      totalAnalyses: 0,
      industryExperience: [],
    };
  }
}

/**
 * Record user feedback on BI quality
 */
export async function recordBiFeedback(
  memoryId: string,
  feedbackCorrect: boolean,
  feedbackNotes?: string
): Promise<void> {
  try {
    await db
      .update(biMemoryTable)
      .set({
        feedbackCorrect,
        feedbackNotes,
        updatedAt: new Date(),
      })
      .where(eq(biMemoryTable.id, memoryId));
  } catch (error) {
    console.error("[BI Memory] Feedback recording failed:", error);
  }
}

/**
 * Extract industry pattern from BI output
 */
function extractIndustryPattern(output: BIValidatedOutput): string {
  const parts: string[] = [];

  if (output.industry) parts.push(`${output.industry}`);
  if (output.metrics.automationPotential > 70) parts.push("high automation potential");
  if (output.metrics.revenueScalability > 7) parts.push("high scalability");
  if (output.strategicInsights.fastestChannel) parts.push(`channel: ${output.strategicInsights.fastestChannel.slice(0, 30)}`);

  return parts.join(" | ") || "general";
}

/**
 * Get most common items from array (filters out null/undefined)
 */
export function getMostCommon<T>(items: (T | null | undefined)[], limit: number): T[] {
  const counts = new Map<T, number>();
  for (const item of items) {
    if (item != null) {
      counts.set(item, (counts.get(item) || 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([item]) => item);
}

/**
 * Type-safe version for string arrays that may contain nulls
 */
export function getMostCommonStrings(items: (string | null | undefined)[], limit: number): string[] {
  return getMostCommon(items, limit) as string[];
}