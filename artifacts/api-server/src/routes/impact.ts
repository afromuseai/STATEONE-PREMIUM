import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import { impactTrackingTable, recommendationOutcomesTable } from "@workspace/db/schema";
import { eq, and, avg, count, sql } from "drizzle-orm";

const router = Router();

router.post("/impact/track", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { projectId, outputType, expectedImpact, confidenceScore, optimizationGoal } = req.body;

    const [entry] = await db
      .insert(impactTrackingTable)
      .values({
        userId,
        projectId: projectId ?? null,
        outputType: outputType ?? "business_intelligence",
        expectedImpact: expectedImpact ?? "medium",
        confidenceScore: confidenceScore ?? 70,
        optimizationGoal: optimizationGoal ?? "growth",
        implementationStatus: "pending",
        signals: {},
      })
      .returning();

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "Failed to track impact" });
  }
});

router.post("/impact/feedback", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { impactTrackingId, feedbackRating, usefulnessScore, feedbackNote, implementationStatus } = req.body;

    const [existing] = await db
      .select()
      .from(impactTrackingTable)
      .where(and(eq(impactTrackingTable.id, impactTrackingId), eq(impactTrackingTable.userId, userId)))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Impact entry not found" });
      return;
    }

    const [updated] = await db
      .update(impactTrackingTable)
      .set({
        feedbackRating: feedbackRating ?? existing.feedbackRating,
        usefulnessScore: usefulnessScore ?? existing.usefulnessScore,
        feedbackNote: feedbackNote ?? existing.feedbackNote,
        implementationStatus: implementationStatus ?? existing.implementationStatus,
      })
      .where(eq(impactTrackingTable.id, impactTrackingId))
      .returning();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

router.post("/impact/recommendation", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { impactTrackingId, projectId, recommendationType, recommendationText, outcome } = req.body;

    const [entry] = await db
      .insert(recommendationOutcomesTable)
      .values({
        userId,
        projectId: projectId ?? null,
        impactTrackingId: impactTrackingId ?? null,
        recommendationType: recommendationType ?? "general",
        recommendationText: recommendationText ?? "",
        outcome: outcome ?? "pending",
      })
      .returning();

    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: "Failed to track recommendation outcome" });
  }
});

router.get("/impact/summary", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const allEntries = await db
      .select()
      .from(impactTrackingTable)
      .where(eq(impactTrackingTable.userId, userId))
      .orderBy(sql`${impactTrackingTable.createdAt} desc`);

    const withFeedback = allEntries.filter(e => e.feedbackRating !== null);
    const implemented = allEntries.filter(e =>
      e.implementationStatus === "implemented" || e.implementationStatus === "accepted"
    );

    const avgRating = withFeedback.length > 0
      ? withFeedback.reduce((s, e) => s + (e.feedbackRating ?? 0), 0) / withFeedback.length
      : 0;

    const avgUsefulness = withFeedback.length > 0
      ? withFeedback.reduce((s, e) => s + (e.usefulnessScore ?? 0), 0) / withFeedback.length
      : 0;

    const implementationRate = allEntries.length > 0
      ? (implemented.length / allEntries.length) * 100
      : 0;

    const byOutputType: Record<string, { count: number; avgRating: number; avgUsefulness: number }> = {};
    for (const entry of allEntries) {
      const t = entry.outputType;
      if (!byOutputType[t]) byOutputType[t] = { count: 0, avgRating: 0, avgUsefulness: 0 };
      byOutputType[t].count++;
    }
    for (const type of Object.keys(byOutputType)) {
      const group = allEntries.filter(e => e.outputType === type && e.feedbackRating !== null);
      byOutputType[type].avgRating = group.length > 0
        ? group.reduce((s, e) => s + (e.feedbackRating ?? 0), 0) / group.length
        : 0;
      byOutputType[type].avgUsefulness = group.length > 0
        ? group.reduce((s, e) => s + (e.usefulnessScore ?? 0), 0) / group.length
        : 0;
    }

    const allRecs = await db
      .select()
      .from(recommendationOutcomesTable)
      .where(eq(recommendationOutcomesTable.userId, userId));

    const acceptedRecs = allRecs.filter(r => r.outcome === "accepted" || r.outcome === "implemented");
    const recSuccessRate = allRecs.length > 0
      ? (acceptedRecs.length / allRecs.length) * 100
      : 0;

    const recentEntries = allEntries.slice(0, 20);

    const velocityBase = withFeedback.length * 4 + implemented.length * 6 + acceptedRecs.length * 3;
    const systemLearningVelocity = Math.min(100, velocityBase);

    const topEntry = Object.entries(byOutputType).sort(
      ([, a], [, b]) => b.avgRating - a.avgRating
    )[0];
    const topPerformingModule = topEntry ? topEntry[0] : "business_intelligence";

    res.json({
      totalOutputs: allEntries.length,
      avgFeedbackRating: Math.round(avgRating * 10) / 10,
      avgUsefulnessScore: Math.round(avgUsefulness * 10) / 10,
      implementationRate: Math.round(implementationRate),
      feedbackCount: withFeedback.length,
      byOutputType,
      recommendationSuccessRate: Math.round(recSuccessRate),
      totalRecommendations: allRecs.length,
      acceptedRecommendations: acceptedRecs.length,
      systemLearningVelocity,
      topPerformingModule,
      recentEntries,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch impact summary" });
  }
});

export default router;
