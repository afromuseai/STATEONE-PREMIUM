import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import {
  autonomousSignalsTable,
  projectsTable,
  aiMemoryTable,
  impactTrackingTable,
  recommendationOutcomesTable,
  revenueSignalsTable,
} from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

interface DetectedIssue {
  issueType: string;
  title: string;
  description: string;
  detectedIn: string;
  priority: number;
  decisionType: "EXECUTE" | "SUGGEST" | "QUEUE" | "IGNORE";
  revenueImpact: "high" | "medium" | "low";
  actionPath: string;
  metadata: Record<string, unknown>;
}

async function scanUserSystems(userId: string): Promise<DetectedIssue[]> {
  const issues: DetectedIssue[] = [];

  const [projects, memories, impactEntries, recommendations, revenueSignals] = await Promise.all([
    db.select().from(projectsTable).where(eq(projectsTable.userId, userId)).orderBy(desc(projectsTable.updatedAt)),
    db.select().from(aiMemoryTable).where(eq(aiMemoryTable.userId, userId)).orderBy(desc(aiMemoryTable.updatedAt)),
    db.select().from(impactTrackingTable).where(eq(impactTrackingTable.userId, userId)).orderBy(desc(impactTrackingTable.createdAt)),
    db.select().from(recommendationOutcomesTable).where(eq(recommendationOutcomesTable.userId, userId)),
    db.select().from(revenueSignalsTable).where(eq(revenueSignalsTable.userId, userId)).orderBy(desc(revenueSignalsTable.createdAt)).limit(20),
  ]);

  // ── Detection Rule 1: No website generated for projects with BI ──────────────
  for (const project of projects) {
    if (project.output && !project.websiteOutput) {
      issues.push({
        issueType: "missing_website",
        title: "Business analysis without website",
        description: `Project "${project.title}" has a complete business intelligence report but no website has been generated. Generating a website could increase conversion by up to 40%.`,
        detectedIn: `project:${project.id}`,
        priority: 2,
        decisionType: "SUGGEST",
        revenueImpact: "high",
        actionPath: "/dashboard",
        metadata: { projectId: project.id, projectTitle: project.title },
      });
    }
  }

  // ── Detection Rule 2: No projects at all ─────────────────────────────────────
  if (projects.length === 0) {
    issues.push({
      issueType: "no_projects",
      title: "No business analysis performed yet",
      description: "You haven't run any business intelligence analysis. Start with your core business idea to unlock the full STAGEONE intelligence loop.",
      detectedIn: "system:projects",
      priority: 1,
      decisionType: "EXECUTE",
      revenueImpact: "high",
      actionPath: "/dashboard",
      metadata: {},
    });
  }

  // ── Detection Rule 3: Ignored recommendations ────────────────────────────────
  const ignoredRecs = recommendations.filter(r => r.outcome === "rejected");
  const pendingRecs = recommendations.filter(r => r.outcome === "pending");

  if (ignoredRecs.length >= 2) {
    issues.push({
      issueType: "ignored_recommendations",
      title: "Repeated recommendation rejection detected",
      description: `${ignoredRecs.length} recommendations have been rejected. This signals a mismatch between AI suggestions and your goals. STAGEONE will recalibrate its recommendation weights.`,
      detectedIn: "system:recommendations",
      priority: 2,
      decisionType: "SUGGEST",
      revenueImpact: "medium",
      actionPath: "/os",
      metadata: { ignoredCount: ignoredRecs.length },
    });
  }

  if (pendingRecs.length >= 3) {
    issues.push({
      issueType: "stale_recommendations",
      title: "Unreviewed recommendations accumulating",
      description: `${pendingRecs.length} recommendations are pending review. Acting on high-impact suggestions could unlock significant efficiency gains.`,
      detectedIn: "system:recommendations",
      priority: 3,
      decisionType: "SUGGEST",
      revenueImpact: "medium",
      actionPath: "/os",
      metadata: { pendingCount: pendingRecs.length },
    });
  }

  // ── Detection Rule 4: Low memory coverage ────────────────────────────────────
  if (memories.length < 3 && projects.length > 0) {
    issues.push({
      issueType: "low_memory_coverage",
      title: "AI memory bank is sparse",
      description: "Your AI memory has fewer than 3 entries. Richer memory dramatically improves future generation quality. Run more analyses to build context.",
      detectedIn: "system:memory",
      priority: 3,
      decisionType: "QUEUE",
      revenueImpact: "medium",
      actionPath: "/memory",
      metadata: { memoryCount: memories.length },
    });
  }

  // ── Detection Rule 5: No feedback provided after analysis ────────────────────
  const withoutFeedback = impactEntries.filter(e => e.feedbackRating === null);
  if (withoutFeedback.length >= 2) {
    issues.push({
      issueType: "missing_feedback",
      title: "Feedback loop not engaged",
      description: `${withoutFeedback.length} outputs have no feedback rating. Feedback is how STAGEONE learns to prioritize revenue-impact actions for your specific business.`,
      detectedIn: "system:impact",
      priority: 3,
      decisionType: "SUGGEST",
      revenueImpact: "medium",
      actionPath: "/dashboard",
      metadata: { unfeedbackedCount: withoutFeedback.length },
    });
  }

  // ── Detection Rule 6: Low revenue score signals ───────────────────────────────
  const lowScoreSignals = revenueSignals.filter(r => (r.overallRevenueScore ?? 0) < 40);
  if (lowScoreSignals.length > 0) {
    issues.push({
      issueType: "low_revenue_score",
      title: "Revenue optimization opportunity detected",
      description: `${lowScoreSignals.length} project(s) have a low Revenue Intelligence score (< 40). Consider running the self-optimization loop to improve monetization strategy.`,
      detectedIn: "system:revenue",
      priority: 2,
      decisionType: "SUGGEST",
      revenueImpact: "high",
      actionPath: "/os",
      metadata: { lowScoreCount: lowScoreSignals.length },
    });
  }

  // ── Detection Rule 7: Stale projects (no update in > 7 days) ─────────────────
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const staleProjects = projects.filter(p => new Date(p.updatedAt) < sevenDaysAgo);
  if (staleProjects.length > 0) {
    issues.push({
      issueType: "stale_projects",
      title: "Projects haven't been updated recently",
      description: `${staleProjects.length} project(s) haven't been updated in over 7 days. Markets evolve — refreshing your analysis ensures your strategy stays competitive.`,
      detectedIn: "system:projects",
      priority: 4,
      decisionType: "QUEUE",
      revenueImpact: "low",
      actionPath: "/dashboard",
      metadata: { staleCount: staleProjects.length },
    });
  }

  // ── Detection Rule 8: High revenue potential not actioned ─────────────────────
  const highRevenueSignals = revenueSignals.filter(r => (r.overallRevenueScore ?? 0) >= 75 && r.decisionType === "EXECUTE");
  if (highRevenueSignals.length > 0) {
    issues.push({
      issueType: "high_value_unactioned",
      title: "Critical revenue opportunity not actioned",
      description: `${highRevenueSignals.length} project(s) scored EXECUTE-tier revenue potential (≥75). These are your highest-value opportunities — prioritize them immediately.`,
      detectedIn: "system:revenue",
      priority: 1,
      decisionType: "EXECUTE",
      revenueImpact: "high",
      actionPath: "/dashboard",
      metadata: { executeCount: highRevenueSignals.length },
    });
  }

  return issues.sort((a, b) => a.priority - b.priority);
}

router.post("/autonomous/scan", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const issues = await scanUserSystems(userId);

    await db.delete(autonomousSignalsTable).where(
      and(eq(autonomousSignalsTable.userId, userId), eq(autonomousSignalsTable.isResolved, false))
    );

    if (issues.length > 0) {
      await db.insert(autonomousSignalsTable).values(
        issues.map(issue => ({
          userId,
          ...issue,
          metadata: issue.metadata as Record<string, unknown>,
        }))
      );
    }

    const savedSignals = await db
      .select()
      .from(autonomousSignalsTable)
      .where(eq(autonomousSignalsTable.userId, userId))
      .orderBy(desc(autonomousSignalsTable.createdAt));

    res.json({
      scannedAt: new Date().toISOString(),
      issuesFound: issues.length,
      signals: savedSignals,
      summary: {
        critical: issues.filter(i => i.priority === 1).length,
        high: issues.filter(i => i.priority === 2).length,
        medium: issues.filter(i => i.priority === 3).length,
        low: issues.filter(i => i.priority === 4).length,
        executeActions: issues.filter(i => i.decisionType === "EXECUTE").length,
        suggestActions: issues.filter(i => i.decisionType === "SUGGEST").length,
        queueActions: issues.filter(i => i.decisionType === "QUEUE").length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: "Autonomous scan failed" });
  }
});

router.get("/autonomous/signals", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const signals = await db
      .select()
      .from(autonomousSignalsTable)
      .where(eq(autonomousSignalsTable.userId, userId))
      .orderBy(desc(autonomousSignalsTable.createdAt))
      .limit(50);

    const summary = {
      total: signals.length,
      unresolved: signals.filter(s => !s.isResolved).length,
      critical: signals.filter(s => s.priority === 1 && !s.isResolved).length,
      high: signals.filter(s => s.priority === 2 && !s.isResolved).length,
      executeActions: signals.filter(s => s.decisionType === "EXECUTE" && !s.isResolved).length,
    };

    res.json({ signals, summary });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch autonomous signals" });
  }
});

router.patch("/autonomous/signals/:id/resolve", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const id = req.params["id"] as string;
    const { wasActedOn } = req.body;

    const [updated] = await db
      .update(autonomousSignalsTable)
      .set({
        isResolved: true,
        wasActedOn: wasActedOn ?? false,
        resolvedAt: new Date(),
      })
      .where(and(eq(autonomousSignalsTable.id, id), eq(autonomousSignalsTable.userId, userId)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Signal not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to resolve signal" });
  }
});

export default router;
