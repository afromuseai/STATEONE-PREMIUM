// ─── Website Architect V2 — AI Editing Agent ──────────────────────────────────
// Receives the current project state and a user instruction.
// Returns a set of file modifications (FileModification[]) — never a full
// regeneration. Only files that need to change are returned.
//
// V1 is completely untouched. website-html-generator.ts is NOT used here.

import { streamNvidia, extractJson } from "./nvidia";
import { jsonrepair } from "jsonrepair";
import { MODELS } from "./models";
import { logger } from "./logger";
import type { WorkspaceContext } from "./workspace-context";
import { formatWorkspaceContext } from "./workspace-context";
import { validateChanges, buildRepairPrompt, detectValidators } from "./workspace-validator";
import type { ValidationReport } from "./workspace-validator";
import type {
  BusinessContext,
  WebsiteBlueprint,
  ProjectFile,
  EditResult,
} from "./website-v2-types";
// Phase 13.3.1: Token-aware context management
import {
  selectFilesWithinBudget,
  formatFileSection,
  estimateTokens,
  DEFAULT_BUDGET_CONFIG,
} from "./context-budget-manager";
import type { BudgetSelectionResult } from "./context-budget-manager";
// Phase 13.3.2: Project memory extraction
import { extractMemories } from "./project-memory-engine";
// Phase 13.4: Execution planning
import { planExecution, formatExecutionPlan, computePlanningAccuracy } from "./execution-planner";
import type { ExecutionPlan, PlanningAccuracy } from "./execution-planner";
// Phase 13.5: Multi-step task orchestration
import { planTasks, formatTaskList } from "./task-planner";
import type { ExecutionTask } from "./task-planner";
import { mergeTaskResults, mergeResultToEditResult } from "./task-result-merger";
import type { MergeResult } from "./task-result-merger";
// Phase 13.6: Specialist agent orchestration
import { getAgentPrompt, filterContextForAgent } from "./agent-registry";
import { routeTask } from "./agent-router";
import type { RoutingResult } from "./agent-router";
// Phase 13.7: Persistent specialist memory
import {
  retrieveSpecialistMemories,
  formatSpecialistMemories,
  extractSpecialistMemories,
  reinforceSpecialistMemories,
  getSpecialistMemoryCount,
  getAverageConfidence,
  getAverageHitCount,
} from "./specialist-memory-engine";
// Phase 13.8: Live workspace intelligence
import { workspaceEventBus } from "./workspace-event-bus";
import { createWorkspaceObserver } from "./workspace-observer";
import type { WorkspaceSnapshot, LiveWorkspaceContext } from "./workspace-observer";
import { analyzeChangeImpact } from "./change-impact-engine";
import type { ChangeImpact } from "./change-impact-engine";
import { computeConfidence } from "./confidence-engine";
import type { ConfidenceReport } from "./confidence-engine";
// Phase 13.9: Adaptive execution & self-optimization
import { executeLearningLoop, type LearningInput } from "./learning-loop";
import { getExecutionPolicies, getPolicyRevisionCount } from "./execution-policy-engine";
import { getRankingRevisionCount } from "./agent-performance-profiler";
import { getLearningIterations } from "./adaptive-confidence";
import { getTotalMergeConflicts } from "./merge-conflict-analytics";
import { getTotalRepairs } from "./repair-strategy-optimizer";
import { getTotalErrorsLogged } from "./validation-pattern-learner";
import { getTotalExecutionCount } from "./execution-analytics-engine";
// Phase 14.1: Unified Engineering Activity Timeline
import { TimelineEngine } from "./timeline-engine";
import type { TimelineUpdate } from "./timeline-engine";
// Phase 14.3: Preview Intelligence Engine
import { analyzePreviewState, buildPreviewRepairPrompt, getPreviewTelemetry } from "./preview-intelligence-engine";
import type { PreviewReport } from "./preview-intelligence-engine";
// Phase 14.4: Visual Verification Engine
import { analyzeVisualState, buildVisualRepairPrompt, getVisualTelemetry } from "./visual-verification-engine";
import type { VisualReport } from "./visual-verification-engine";
// Phase 14.5: Recovery & Rollback Engine
import { RecoveryEngine, type RecoveryAction } from "./recovery-engine";
// Phase 14.6: Engineering Decision Engine
import { evaluateEngineeringDecision, formatEngineeringDecision, getDecisionTelemetry } from "./engineering-decision-engine";
import type { EngineeringDecision } from "./engineering-decision-engine";
// Phase 15.1: Continuous Engineering Engine
import { runEngineeringAudit, formatEngineeringAudit, getAuditTelemetry } from "./continuous-engineering-engine";
import type { EngineeringAudit } from "./continuous-engineering-engine";
// Phase 16.1: Product Intelligence Engine
import { evaluateProductIntelligence, formatProductAssessment, getProductTelemetry } from "./product-intelligence-engine";
import type { ProductAssessment } from "./product-intelligence-engine";
// Phase 16.2: Engineering Advisor
import { runEngineeringAdvisor, formatEngineeringAdvisor, getAdvisorTelemetry } from "./engineering-advisor";
import type { EngineeringAdvisorResult } from "./engineering-advisor";
// Phase 16.3: Engineering Roadmap Engine
import { generateEngineeringRoadmap, formatEngineeringRoadmap, getRoadmapTelemetry } from "./engineering-roadmap-engine";
import type { RoadmapPayload } from "./engineering-roadmap-engine";

// ─── Model ────────────────────────────────────────────────────────────────────
// Same model as the code generator — strongest TypeScript/TSX output.
export const EDITOR_MODEL = MODELS.COMPONENT_GENERATION;

// ─── Context budget ──────────────────────────────────────────────────────────
// Phase 13.3.1: Token-aware context management replaces the old file-count-based
// MAX_CONTEXT_FILES approach. Budget is computed from model context window,
// with reserved space for prompt overhead and output tokens.

/** Shared budget selection result for telemetry. */
let lastBudgetResult: BudgetSelectionResult | null = null;

// ─── Select context files with token-budget-aware ordering ───────────────────
// Phase 13.3.1: Uses ContextBudgetManager to rank files by importance, fit
// them into the available token budget, and summarize oversized files when
// needed.
//
// Priority order (within token budget):
//   1. selectedFiles (user's explicit focus)
//   2. directly related files (from import graph traversal)
//   3. entryPoints (from WorkspaceContext)
//   4. layout files (by naming convention)
//   5. remaining files (smallest first)
//
function selectContextFiles(
  allFiles: ProjectFile[],
  workspaceContext?: WorkspaceContext,
  selectedFilePaths?: string[],
): ProjectFile[] {
  const budgetResult = selectFilesWithinBudget(
    allFiles,
    workspaceContext,
    selectedFilePaths,
    DEFAULT_BUDGET_CONFIG,
  );

  lastBudgetResult = budgetResult;

  // Return the selected files (original ProjectFile objects — summarization
  // is applied at render time in buildUserPrompt).
  return budgetResult.files.map((entry) => entry.file);
}

// ─── Build system prompt with dynamic framework info ─────────────────────────
// Phase 13.1: Framework is injected from WorkspaceContext instead of hardcoding
// "Next.js 14 App Router". Falls back to a generic default when unknown.
function buildEditorSystemPrompt(framework?: string): string {
  const frameworkLine = framework
    ? `specialising in ${framework}`
    : "experienced with modern frontend frameworks";

  return `You are a senior frontend engineer at a world-class product studio, ${frameworkLine} and TypeScript.

You receive:
1. BusinessContext — the company name, industry, target audience, goals
2. WorkspaceContext — framework, dependencies, file structure, path aliases
3. WebsiteBlueprint — the architecture and design system specification
4. Existing project files — the actual TypeScript/TSX source code
5. User instruction — exactly what the user wants to change

Your job:
- Understand the intent of the instruction precisely
- Identify which files need to change to satisfy the request
- Return ONLY those files — never return files that do not change
- Write complete, valid file content (not diffs or partial snippets)
- Maintain TypeScript correctness, existing import paths, and component interfaces
- Preserve the overall architecture, naming conventions, and file structure
- Derive all copy (headlines, labels) from BusinessContext — never use placeholder text
- Respect the project's path aliases (e.g. @/ → ./src/) when writing import statements

Return ONLY this JSON object (no markdown, no code fences, no explanation outside the JSON):
{
  "changes": [
    {
      "path": "components/HeroSection.tsx",
      "operation": "update",
      "content": "...complete file content...",
      "reason": "One-sentence description of what changed and why"
    }
  ],
  "summary": "Human-readable summary of all changes made"
}

STRICT RULES:
- Every "content" field must be the COMPLETE file (no partial code, no ellipsis)
- operation is exactly one of: "update", "create", "delete"
- For "delete", content should be an empty string
- Never include files that are unchanged
- No TypeScript errors, no missing imports, no undefined components
- If you need a new sub-component, create it as a separate file with operation "create"
- Keep Tailwind classes — do not switch to inline styles unless the value is dynamic`;
}

// ─── Build user prompt ────────────────────────────────────────────────────────
// Phase 13.3.1: Uses token-budget-aware file selection and can summarize
// oversized files. The budget result is cached for telemetry.
function buildUserPrompt(
  context: BusinessContext,
  workspaceContext: WorkspaceContext | undefined,
  blueprint: WebsiteBlueprint | null,
  files: ProjectFile[],
  instruction: string,
  selectedFilePaths?: string[],
  executionPlan?: ExecutionPlan,
  lastDecision?: EngineeringDecision,
  lastAudit?: EngineeringAudit,
  lastProduct?: ProductAssessment,
  lastAdvisor?: EngineeringAdvisorResult,
  lastRoadmap?: RoadmapPayload,
): string {
  // Phase 13.2.2 → Phase 13.3.1: Token-budget-aware context selection
  const contextFiles = selectContextFiles(files, workspaceContext, selectedFilePaths);

  // Phase 13.3.1: Re-render the file section using the budget result so that
  // summarized content is used for oversized files.
  const budgetResult = lastBudgetResult;
  const fileSection = budgetResult
    ? formatFileSection(budgetResult)
    : contextFiles
        .map((f) => `### FILE: ${f.path}\n\`\`\`${f.language ?? "typescript"}\n${f.content}\n\`\`\``)
        .join("\n\n");

  // Phase 13.1: Inject WorkspaceContext between Business Context and Blueprint
  const wsBlock = workspaceContext ? `\n${formatWorkspaceContext(workspaceContext)}` : "";

  // Phase 14.6: Inject engineering decision before execution plan
  const decisionBlock = lastDecision ? `\n${formatEngineeringDecision(lastDecision)}` : "";
  // Phase 15.1: Inject engineering audit before execution plan
  const auditBlock = lastAudit ? `\n${formatEngineeringAudit(lastAudit)}` : "";
  // Phase 16.1: Inject product assessment before execution plan
  const productBlock = lastProduct ? `\n${formatProductAssessment(lastProduct)}` : "";
  // Phase 16.2: Inject engineering advisor block before execution plan
  const advisorBlock = lastAdvisor ? `\n${formatEngineeringAdvisor(lastAdvisor)}` : "";
  // Phase 16.3: Inject engineering roadmap before execution plan
  const roadmapBlock = lastRoadmap ? `\n${formatEngineeringRoadmap(lastRoadmap)}` : "";

  // Phase 13.4: Inject execution plan between WorkspaceContext and files
  const planBlock = executionPlan ? `\n${formatExecutionPlan(executionPlan)}` : "";

  const blueprintStr = blueprint ? `\n\nWEBSITE BLUEPRINT:\n${JSON.stringify(blueprint, null, 2)}` : "";

  // Phase 13.3.1: Include a budget summary line so the model understands context limits
  const budgetNote = budgetResult
    ? `\n[Context budget: ${budgetResult.files.length} files, ~${budgetResult.usedFileTokens} tokens` +
      (budgetResult.summarizedCount > 0
        ? `, ${budgetResult.summarizedCount} summarized`
        : "") +
      (budgetResult.omittedCount > 0
        ? `, ${budgetResult.omittedCount} omitted due to budget`
        : "") +
      "]"
    : "";

  return `BUSINESS CONTEXT:
Company: ${context.companyName}
Industry: ${context.industry}
Target Audience: ${context.targetAudience}
Business Goal: ${context.businessGoal}
Brand Positioning: ${context.brandPositioning}${blueprintStr}${wsBlock}${decisionBlock}${auditBlock}${productBlock}${advisorBlock}${roadmapBlock}${planBlock}

ALL PROJECT FILES (${files.length} total; showing ${contextFiles.length} in context)${budgetNote}:
${fileSection}

USER INSTRUCTION:
${instruction}
${selectedFilePaths?.length ? `\nUSER FOCUSED ON: ${selectedFilePaths.join(", ")}` : ""}

Apply the instruction. Return only the JSON with "changes" and "summary".`;
}

// ─── Stream reader — accumulates all content tokens from NVIDIA SSE ───────────
async function accumulateStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const decoder = new TextDecoder();
  const reader  = stream.getReader();
  let carry  = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text  = carry + decoder.decode(value, { stream: true });
      const lines = text.split("\n");
      carry = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;

        try {
          const parsed  = JSON.parse(data) as Record<string, unknown>;
          const choices = parsed.choices as Array<{ delta?: { content?: string; reasoning_content?: string } }>;
          const content = choices?.[0]?.delta?.content;
          if (content) buffer += content;
        } catch {
          // skip malformed SSE fragment
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return buffer;
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function runEditingAgent(
  context: BusinessContext,
  blueprint: WebsiteBlueprint | null,
  files: ProjectFile[],
  instruction: string,
  selectedFilePaths?: string[],
  options: { userId?: string; projectId?: string; workspaceContext?: WorkspaceContext; onTimelineUpdate?: (update: TimelineUpdate) => void; onConfidenceUpdate?: (data: import("./website-v2-types").ConfidencePayload) => void; onPreviewUpdate?: (data: import("./website-v2-types").PreviewPayload) => void; onVisualUpdate?: (data: import("./website-v2-types").VisualPayload) => void; onRecoveryUpdate?: (data: import("./website-v2-types").RecoveryPayload) => void; onDecisionUpdate?: (data: import("./website-v2-types").DecisionPayload) => void; onAuditUpdate?: (data: import("./website-v2-types").AuditPayload) => void; onProductUpdate?: (data: import("./website-v2-types").ProductPayload) => void; onAdvisorUpdate?: (data: import("./website-v2-types").AdvisorPayload) => void; onRoadmapUpdate?: (data: import("./website-v2-types").RoadmapPayload) => void } = {}
): Promise<EditResult> {
  const wsCtx = options.workspaceContext;
  const onTimeline = options.onTimelineUpdate;
  const onConfidence = options.onConfidenceUpdate;
  const onPreview = options.onPreviewUpdate;
  const onVisual = options.onVisualUpdate;
  const onRecovery = options.onRecoveryUpdate;
  const onDecision = options.onDecisionUpdate;
  const onAudit = options.onAuditUpdate;
  const onProduct = options.onProductUpdate;
  const onAdvisor = options.onAdvisorUpdate;
  const onRoadmap = options.onRoadmapUpdate;

  // ── Phase 14.1: Create execution timeline ────────────────────────────────
  const timeline = new TimelineEngine({
    executionId: `exec-${Date.now()}`,
    onUpdate: onTimeline,
  });
  const tl = timeline; // shorthand

  // ── Phase 14.5: Initialize recovery engine ──────────────────────────────
  const recovery = new RecoveryEngine({
    projectId: options.projectId ?? "unknown",
    executionId: tl.getSnapshot().id,
    onRecoveryAction: (action: RecoveryAction) => {
      if (onRecovery) {
        onRecovery({
          eventType: action.eventType,
          snapshotId: action.snapshotId,
          trigger: action.trigger,
          description: action.description,
          rolledBackFiles: action.metadata?.rolledBackFiles as string[] | undefined,
          snapshotCount: recovery.snapshotCount,
          currentVersion: recovery.getAllSnapshots().length,
          totalVersions: Math.max(1, recovery.getAllSnapshots().length),
          metadata: action.metadata,
          timestamp: action.timestamp,
        });
      }
    },
  });

  // Take a "before_edit" snapshot as the recovery point
  recovery.snapshot(files, "before_edit", "Pre-edit workspace state");

  logger.info(
    { projectId: options.projectId, instruction: instruction.slice(0, 100), hasWorkspaceContext: !!wsCtx },
    "[v2:editor] Starting edit"
  );

  // Phase 13.1: Dynamic system prompt based on detected framework
  const systemPrompt = buildEditorSystemPrompt(wsCtx?.framework);

  // Phase 13.2.5: Repair loop state
  const MAX_REPAIR_ATTEMPTS = 2;
  let repairAttempts = 0;
  let validationReport: ValidationReport | null = null;
  let validatorConfig: ReturnType<typeof detectValidators> | null = null;

  // Phase 13.4: Execution plan + accuracy
  let executionPlan: ExecutionPlan | undefined;
  let planningTimeMs = 0;
  let planningAccuracy: PlanningAccuracy | undefined;

  // ── Phase 14.6/15.1/16.1/16.2/16.3: State variables for cross-phase data ────
  // These must be declared at function scope (not block scope) because they're
  // referenced across multiple phases before their initializing blocks execute.
  let lastAudit: EngineeringAudit | null = null;
  let lastAssessment: ProductAssessment | null = null;
  let lastAdvisor: EngineeringAdvisorResult | null = null;
  let lastDecision: EngineeringDecision | null = null;
  let overallStart = Date.now();

  // ── Generate execution plan ────────────────────────────────────────────────
  // Phase 13.4: Before any edit, construct an explicit plan describing scope,
  // strategy, risks, and validation steps.
  {
    const projectMemories: import("./project-memory-engine").ProjectMemory[] = [];
    // If projectMemory string is present, we can't easily parse it back —
    // the planner works with the memory data indirectly through WorkspaceContext.
    const result = planExecution(
      instruction,
      selectedFilePaths ?? [],
      wsCtx,
      projectMemories,
    );
    executionPlan = result.plan;
    planningTimeMs = result.planningTimeMs;
  }

  // ── Phase 15.1: Run engineering audit ─────────────────────────────────────
  // Proactively scan the workspace for improvement opportunities, forward as
  // SSE event, and make available for prompt injection.
  {
    const filePaths = files.map((f) => f.path);
    const audit = runEngineeringAudit({
      wsCtx,
      files: filePaths,
      projectId: options.projectId,
    });
    lastAudit = audit;

    // Forward audit as SSE event
    if (onAudit) {
      onAudit({
        score: audit.score,
        opportunityCount: audit.opportunities.length,
        topOpportunities: audit.opportunities.slice(0, 20).map((opp) => ({
          id: opp.id,
          category: opp.category,
          severity: opp.severity,
          title: opp.title,
          description: opp.description,
          affectedFiles: opp.affectedFiles,
          estimatedBenefit: opp.estimatedBenefit,
          estimatedRisk: opp.estimatedRisk,
          estimatedEffort: opp.estimatedEffort,
          recommendation: opp.recommendation,
          priorityScore: opp.priorityScore,
        })),
        criticalCount: audit.opportunities.filter((o) => o.severity === "critical").length,
        highPriorityCount: audit.opportunities.filter((o) => o.severity === "high").length,
        strengths: audit.strengths,
        weaknesses: audit.weaknesses,
        summary: audit.summary,
        durationMs: audit.durationMs,
        timestamp: audit.timestamp,
      });
    }
  }

  // ── Phase 16.1: Evaluate product intelligence ──────────────────────────
  // After the audit but before the decision, run the product intelligence
  // engine to assess the business, UX, conversion, branding, accessibility,
  // and SEO implications of the upcoming edit.
  {
    const assessment = evaluateProductIntelligence({
      businessContext: context,
      blueprint,
      wsCtx,
      executionPlan: executionPlan ? {
        strategy: executionPlan.strategy,
        complexity: executionPlan.complexity,
        description: executionPlan.objective,
        filesToModify: executionPlan.filesToModify.map(path => ({ path })),
      } : undefined,
      engineeringDecision: lastDecision,
      engineeringAudit: lastAudit,
      confidenceScore: 100,
      visualScore: 100,
      instruction,
      projectId: options.projectId,
    });
    lastAssessment = assessment;

    // Forward product assessment as SSE event
    if (onProduct) {
      onProduct({
        overallScore: assessment.overallScore,
        recommendation: assessment.recommendation,
        businessAlignment: assessment.businessAlignment,
        uxImpact: assessment.uxImpact,
        conversionImpact: assessment.conversionImpact,
        brandingConsistency: assessment.brandingConsistency,
        accessibilityImpact: assessment.accessibilityImpact,
        seoImpact: assessment.seoImpact,
        maintainabilityImpact: assessment.maintainabilityImpact,
        userRisk: assessment.userRisk,
        reasoning: assessment.reasoning,
        recommendations: assessment.recommendations,
        warnings: assessment.warnings,
        assessmentTimeMs: assessment.assessmentTimeMs,
        timestamp: assessment.timestamp,
      });
    }
  }

  // ── Phase 16.2: Run engineering advisor ─────────────────────────────────
  // After the product assessment, run the advisor to synthesize all
  // intelligence inputs into prioritized recommendations.
  {
    const advisorResult = runEngineeringAdvisor({
      workspaceContext: wsCtx,
      engineeringAudit: lastAudit,
      productAssessment: lastAssessment,
      engineeringDecision: lastDecision,
      confidenceScore: 100,
      visualScore: 100,
      validationSuccess: true,
      repairAttempts: 0,
      recoveryCount: 0,
      rollbackCount: 0,
      learningImprovementScore: 0,
      projectId: options.projectId,
      businessContext: context,
      blueprint,
      instruction,
      files: files.map((f) => f.path),
    });
    lastAdvisor = advisorResult;

    // Forward advisor result as SSE event
    if (onAdvisor) {
      onAdvisor({
        overallHealth: advisorResult.overallHealth,
        recommendations: advisorResult.recommendations.map((r) => ({
          id: r.id,
          title: r.title,
          description: r.description,
          category: r.category,
          priority: r.priority,
          impact: r.impact,
          effort: r.effort,
          confidence: r.confidence,
          urgency: r.urgency,
          score: r.score,
          affectedFiles: r.affectedFiles,
          reasoning: r.reasoning,
          suggestedActions: r.suggestedActions,
        })),
        strengths: advisorResult.strengths,
        risks: advisorResult.risks,
        trends: advisorResult.trends,
        nextBestAction: advisorResult.nextBestAction,
      });
    }
  }

  // ── Phase 16.3: Generate engineering roadmap ───────────────────────────
  // After the advisor, generate the persistent roadmap. Merge new items,
  // auto-complete resolved items, re-prioritize, and persist.
  let lastRoadmap: RoadmapPayload | null = null;
  {
    const roadmapPayload = generateEngineeringRoadmap({
      projectId: options.projectId,
      workspaceContext: wsCtx,
      engineeringAudit: lastAudit,
      productAssessment: lastAssessment,
      engineeringAdvisor: lastAdvisor,
      engineeringDecision: lastDecision,
      confidenceScore: 100,
      visualScore: 100,
      validationSuccess: true,
      repairAttempts: 0,
      recoveryCount: 0,
      rollbackCount: 0,
      businessContext: context,
      blueprint,
      instruction,
      files: files.map((f) => f.path),
    });
    lastRoadmap = roadmapPayload;

    // Forward roadmap as SSE event
    if (onRoadmap) {
      onRoadmap({
        items: roadmapPayload.items.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          effort: item.effort,
          impact: item.impact,
          confidence: item.confidence,
          status: item.status,
          dependencies: item.dependencies,
          source: item.source,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          completedAt: item.completedAt,
        })),
        summary: roadmapPayload.summary,
        completionPercentage: roadmapPayload.completionPercentage,
        currentFocus: roadmapPayload.currentFocus.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          effort: item.effort,
          impact: item.impact,
          confidence: item.confidence,
          status: item.status,
          dependencies: item.dependencies,
          source: item.source,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          completedAt: item.completedAt,
        })),
        recentlyCompleted: roadmapPayload.recentlyCompleted.map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          priority: item.priority,
          effort: item.effort,
          impact: item.impact,
          confidence: item.confidence,
          status: item.status,
          dependencies: item.dependencies,
          source: item.source,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          completedAt: item.completedAt,
        })),
        roadmapHealth: roadmapPayload.roadmapHealth,
      });
    }
  }

  // ── Phase 14.6: Evaluate engineering decision ──────────────────────────
  {
    const decision = evaluateEngineeringDecision({
      instruction,
      wsCtx,
      executionPlan,
      confidenceScore: 100,
      validationPassed: true,
      repairAttempts: 0,
      maxRepairsReached: false,
      previewReport: null,
      visualReport: null,
      recoveryTelemetry: null,
      projectId: options.projectId,
      hasArchitectureEdits: executionPlan?.strategy === "architecture",
    });
    lastDecision = decision;

    // Forward decision as SSE event
    if (onDecision) {
      onDecision({
        recommendation: decision.recommendation,
        confidence: decision.confidence,
        estimatedRisk: decision.estimatedRisk,
        executionStrategy: decision.executionStrategy,
        chosenOption: decision.chosenOption,
        alternativeOptions: decision.alternatives.map((alt) => ({
          id: alt.id,
          title: alt.title,
          strategy: alt.strategy,
          confidence: alt.confidence,
          risk: alt.risk,
          estimatedFiles: alt.estimatedFiles,
        })),
        tradeoffs: decision.tradeoffs,
        rationale: decision.rationale,
        decisionTimeMs: Date.now() - overallStart,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Phase 13.8: Initialize live workspace intelligence ──────────────────
  const workspaceObserver = wsCtx ? createWorkspaceObserver(wsCtx) : null;
  let liveWsCtx = wsCtx;
  let lastSnapshot: WorkspaceSnapshot | null = null;
  let lastImpact: ChangeImpact | null = null;
  let lastConfidence: ConfidenceReport | null = null;
  let workspaceUpdates = 0;
  let incrementalGraphUpdates = 0;
  let fullGraphRebuilds = 0;
  let contextRefreshTimeMs = 0;
  let observerLatencyMs = 0;
  let plannerRevisions = 0;
  let taskReprioritizations = 0;
  let lastLearningResult: import("./learning-loop").LearningLoopResult | null = null;

  // Publish initial workspace event
  if (workspaceObserver) {
    workspaceEventBus.publish("WORKSPACE_UPDATED", {
      version: workspaceObserver.getSnapshot().version,
      files: files.length,
    });
  }

  // ── Phase 14.1: Timeline — workspace analysis step ───────────────────────
  const tlWsStep = tl.beginStep({
    type: "workspace",
    title: "Analyzing workspace",
    description: `Scanning ${files.length} files, building context (${wsCtx?.framework ?? "unknown"} framework)`,
    metadata: {
      fileCount: files.length,
      framework: wsCtx?.framework ?? "unknown",
      strategy: executionPlan?.strategy ?? "unknown",
      complexity: executionPlan?.complexity ?? "unknown",
      predictedFiles: executionPlan?.filesToModify?.length ?? 0,
    },
  });

  // ── Phase 13.5: Task orchestration pipeline ──────────────────────────────
  // Replace the single attemptEdit() with a multi-step task execution that
  // decomposes the plan into independent tasks, executes them (parallel where
  // possible), merges results, and validates the merged output.

  // ── Plan tasks from execution plan ────────────────────────────────────────
  logger.info(
    { projectId: options.projectId, strategy: executionPlan?.strategy },
    "[v2:editor] Planning tasks...",
  );

  const taskPlan = planTasks(executionPlan!, wsCtx);
  const tasks = taskPlan.tasks;

  // ── Phase 14.1: Timeline — execution planning step ───────────────────────
  tl.completeStep(tlWsStep, {
    metadata: {
      taskCount: tasks.length,
      parallelCount: taskPlan.parallelCount,
      sequentialChains: taskPlan.sequentialChains,
    },
  });

  const tlPlanStep = tl.beginStep({
    type: "planning",
    title: "Planning execution",
    description: `Decomposed into ${tasks.length} task(s) — ${taskPlan.parallelCount} parallel, ${taskPlan.sequentialChains} sequential chain(s)`,
    metadata: {
      taskCount: tasks.length,
      parallelCount: taskPlan.parallelCount,
      sequentialChains: taskPlan.sequentialChains,
    },
  });

  logger.info(
    {
      projectId: options.projectId,
      taskCount: tasks.length,
      parallelCount: taskPlan.parallelCount,
      sequentialChains: taskPlan.sequentialChains,
      planningTimeMs: taskPlan.planningTimeMs,
    },
    `[v2:editor] ${formatTaskList(tasks)}`,
  );

  // ── Build a task-specific user prompt ─────────────────────────────────────
  // Each task receives only the files it needs (filesToRead + filesToModify).
  function buildTaskPrompt(task: ExecutionTask, agentWsCtx?: import("./workspace-context").WorkspaceContext): string {
    // Filter files to only those relevant to this task
    const taskFilePaths = new Set([
      ...task.filesToRead,
      ...task.filesToModify,
    ]);
    const taskFiles = files.filter((f) => taskFilePaths.has(f.path));

    // Use the budget-aware context selection, scoped to task files
    const ctxForSelection = agentWsCtx ?? wsCtx;
    const taskContextFiles = selectContextFiles(taskFiles, ctxForSelection, task.filesToModify);

    const budgetResult = lastBudgetResult;
    const fileSection = budgetResult
      ? formatFileSection(budgetResult)
      : taskContextFiles
          .map((f) => `### FILE: ${f.path}\n\`\`\`${f.language ?? "typescript"}\n${f.content}\n\`\`\``)
          .join("\n\n");

    // Use filtered context if provided (Phase 13.6), otherwise full context
    const ctxForPrompt = agentWsCtx ?? wsCtx;
    const wsBlock = ctxForPrompt ? `\n${formatWorkspaceContext(ctxForPrompt)}` : "";
    // Phase 14.6: Inject engineering decision before execution plan
    const decisionBlock = lastDecision ? `\n${formatEngineeringDecision(lastDecision)}` : "";
    // Phase 15.1: Inject engineering audit before execution plan
    const auditBlock = lastAudit ? `\n${formatEngineeringAudit(lastAudit)}` : "";
    const planBlock = executionPlan ? `\n${formatExecutionPlan(executionPlan)}` : "";
    const blueprintStr = blueprint ? `\n\nWEBSITE BLUEPRINT:\n${JSON.stringify(blueprint, null, 2)}` : "";

    return `BUSINESS CONTEXT:
Company: ${context.companyName}
Industry: ${context.industry}
Target Audience: ${context.targetAudience}
Business Goal: ${context.businessGoal}
Brand Positioning: ${context.brandPositioning}${blueprintStr}${wsBlock}${decisionBlock}${auditBlock}${planBlock}

TASK: ${task.title}
OBJECTIVE: ${task.objective}

RELEVANT PROJECT FILES (${taskFiles.length} total):
${taskFiles
  .map((f) => `### FILE: ${f.path}\n\`\`\`${f.language ?? "typescript"}\n${f.content}\n\`\`\``)
  .join("\n\n")}

USER INSTRUCTION:
${instruction}

Focus on the files assigned to this task. Return only the JSON with "changes" and "summary".`;
  }

  // ── Phase 13.5: Task orchestration pipeline ──────────────────────────────
  // Execute tasks respecting dependencies, merge results, then validate.

  // ── Phase 13.6: Specialist Agent routing state ──────────────────────────
  const agentRoutingResults: RoutingResult[] = [];
  const agentExecutionTimes: Record<string, number[]> = {};
  const agentFailures: Record<string, number> = {};
  const agentRetries: Record<string, number> = {};
  const agentTaskCount: Record<string, number> = {};
  let fallbackAgentCount = 0;

  // ── Phase 13.7: Specialist memory tracking ─────────────────────────────
  const specialistMemoryCounts: Record<string, number> = {};
  const specialistMemoryRetrievalTimes: Record<string, number> = {};
  const specialistNewMemoriesExtracted: Record<string, number> = {};
  const specialistReinforced: Record<string, number> = {};
  const specialistWeakened: Record<string, number> = {};
  const specialistArchived: Record<string, number> = {};

  // ── Execute a single task with a specialist agent ───────────────────────
  async function executeTask(task: ExecutionTask, agent: RoutingResult): Promise<EditResult> {
    // Get the specialist system prompt
    const agentSystemPrompt = getAgentPrompt(agent.agent.id);

    // Phase 13.7: Retrieve specialist memories
    const memoryStart = Date.now();
    const specialistMemories = options.projectId
      ? retrieveSpecialistMemories(
          options.projectId,
          agent.agent.id,
          task.title,
          task.objective,
          [...task.filesToModify, ...task.filesToRead],
        )
      : { memories: [], retrievalTimeMs: 0 };
    specialistMemoryRetrievalTimes[agent.agent.id] = specialistMemories.retrievalTimeMs;
    specialistMemoryCounts[agent.agent.id] = specialistMemories.memories.length;

    const memoryBlock = formatSpecialistMemories(specialistMemories.memories);

    // Combine base system prompt with agent-specific prompt and specialist memory
    const combinedSystemPrompt = memoryBlock
      ? `${systemPrompt}\n\n${agentSystemPrompt}\n\n${memoryBlock}`
      : `${systemPrompt}\n\n${agentSystemPrompt}`;

    // Filter WorkspaceContext for this agent (use live context if available)
    const ctxForFilter = workspaceObserver?.getContext() ?? wsCtx;
    const filteredWsCtx = filterContextForAgent(agent.agent.id, ctxForFilter);

    // Build a task-specific prompt with filtered context
    const taskPrompt = buildTaskPrompt(task, filteredWsCtx);

    const stream = await streamNvidia({
      model:       EDITOR_MODEL,
      temperature: 0.35,
      maxTokens:   16000,
      messages: [
        { role: "system", content: combinedSystemPrompt },
        { role: "user",   content: taskPrompt },
      ],
      _feature:   "website-v2-edit",
      _userId:    options.userId,
      _projectId: options.projectId,
    });

    const rawOutput = await accumulateStream(stream);

    logger.info(
      { projectId: options.projectId, taskId: task.id, agent: agent.agent.id, rawLen: rawOutput.length, memoriesLoaded: specialistMemories.memories.length },
      `[v2:editor] Task ${task.id} (${agent.agent.name}) stream complete`,
    );

    let result: EditResult;
    try {
      const repaired = jsonrepair(rawOutput);
      result = extractJson(repaired) as EditResult;
    } catch (err) {
      logger.error({ err: String(err), rawLen: rawOutput.length, taskId: task.id, agent: agent.agent.id }, "[v2:editor] Task JSON parse failed");
      throw new Error(`Task ${task.id} (${agent.agent.name}) returned malformed JSON`);
    }

    if (!Array.isArray(result?.changes)) {
      throw new Error(`Task ${task.id} (${agent.agent.name}) response missing 'changes' array`);
    }

    // Phase 13.7: Extract specialist memories from this successful edit
    if (options.projectId) {
      try {
        const extractionResult = extractSpecialistMemories(
          options.projectId,
          agent.agent.id,
          instruction,
          executionPlan?.objective ?? "",
          result.summary,
        );
        if (extractionResult.extracted.length > 0) {
          specialistNewMemoriesExtracted[agent.agent.id] =
            (specialistNewMemoriesExtracted[agent.agent.id] || 0) + extractionResult.extracted.length;
          logger.info(
            { projectId: options.projectId, specialistId: agent.agent.id, extracted: extractionResult.extracted.length },
            `[v2:editor] Extracted ${extractionResult.extracted.length} specialist memories for ${agent.agent.name}`,
          );
        }
      } catch (err) {
        logger.warn({ projectId: options.projectId, specialistId: agent.agent.id, err: String(err) }, "[v2:editor] Specialist memory extraction failed");
      }
    }

    return result;
  }

  // ── Phase 14.1: Timeline — complete planning step ────────────────────────
  tl.completeStep(tlPlanStep);

  // ── Execute tasks with dependency resolution ──────────────────────────────
  // Phase 13.5: Orchestrate multi-step execution. Independent tasks run in
  // parallel (Promise.all). Dependent tasks run sequentially after their
  // prerequisites complete. Failed tasks are retried individually (max 2).
  // Results are merged before validation.

  const taskMap = new Map<string, ExecutionTask>();
  for (const t of tasks) taskMap.set(t.id, t);

  const taskErrors = new Map<string, string>();
  const taskRetries = new Map<string, number>();
  const executionTimePerTask: Record<string, number> = {};

  // Activity stream logging
  logger.info({ projectId: options.projectId, taskCount: tasks.length }, "[v2:editor] Executing tasks...");

  // Execute tasks in dependency order
  async function executeTaskWithRetry(task: ExecutionTask): Promise<EditResult | null> {
    const taskStart = Date.now();

    // Phase 13.6: Route the task to a specialist (use live context if available)
    const ctxForRoute = workspaceObserver?.getContext() ?? wsCtx;
    logger.info({ projectId: options.projectId, taskId: task.id, title: task.title }, `[v2:editor] Selecting specialist for ${task.title}...`);
    const routing = routeTask(task, ctxForRoute, executionPlan);
    agentRoutingResults.push(routing);
    agentTaskCount[routing.agent.id] = (agentTaskCount[routing.agent.id] || 0) + 1;

    if (routing.agent.id === "general") {
      fallbackAgentCount++;
    }

    logger.info(
      { projectId: options.projectId, taskId: task.id, agent: routing.agent.name, reason: routing.reason },
      `[v2:editor] ${routing.agent.name} selected for ${task.title}`
    );

    // Activity stream: show the selected agent
    logger.info({ projectId: options.projectId, taskId: task.id, agent: routing.agent.name }, `[v2:editor] ${routing.agent.name} Running...`);

    // Phase 14.1: Timeline — specialist assignment step
    const tlRouteStep = tl.beginStep({
      type: "routing",
      title: `${routing.agent.name} assigned`,
      description: routing.reason,
      specialist: routing.agent.id,
      affectedFiles: [...task.filesToModify, ...task.filesToRead],
      metadata: {
        taskId: task.id,
        taskTitle: task.title,
        routingReason: routing.reason,
        routingConfidence: routing.confidence,
      },
    });
    tl.completeStep(tlRouteStep);

    // Phase 14.1: Timeline — task execution step
    const tlExecStep = tl.beginStep({
      type: "execution",
      title: `Executing: ${task.title}`,
      description: `Agent: ${routing.agent.name} — ${task.objective}`,
      specialist: routing.agent.id,
      affectedFiles: [...task.filesToModify, ...task.filesToRead],
      metadata: {
        taskId: task.id,
        strategy: task.strategy,
        complexity: task.complexity,
      },
    });

    for (let attempt = 0; attempt <= MAX_REPAIR_ATTEMPTS; attempt++) {
      try {
        task.status = "running";
        const taskResult = await executeTask(task, routing);
        task.status = "completed";
        executionTimePerTask[task.id] = Date.now() - taskStart;

        // Track agent execution time
        if (!agentExecutionTimes[routing.agent.id]) {
          agentExecutionTimes[routing.agent.id] = [];
        }
        agentExecutionTimes[routing.agent.id].push(Date.now() - taskStart);

        // Phase 13.8: Publish task completed event
        const changedFiles = taskResult.changes.map((c) => c.path);
        workspaceEventBus.publish("TASK_COMPLETED", {
          taskId: task.id,
          agentId: routing.agent.id,
          changedFiles,
          durationMs: executionTimePerTask[task.id],
        });

        // Phase 13.8: Analyze change impact
        if (workspaceObserver) {
          const snapshot = workspaceObserver.getSnapshot();
          const impact = analyzeChangeImpact(
            changedFiles,
            workspaceObserver.getContext(),
            snapshot,
            tasks
              .filter((t) => t.status === "pending")
              .map((t) => [...t.filesToModify, ...t.filesToRead]),
          );
          lastImpact = impact;
          workspaceEventBus.publish("IMPACT_DETECTED", {
            impactScore: impact.impactScore,
            validationPriority: impact.validationPriority,
            affectedRoutes: impact.affectedRoutes,
            affectedComponents: impact.affectedComponents,
          });
        }

        // Phase 14.1: Timeline — complete execution step
        tl.completeStep(tlExecStep, {
          metadata: {
            changedFiles: changedFiles.length,
            durationMs: executionTimePerTask[task.id],
            attempt,
          },
        });

        logger.info(
          { projectId: options.projectId, taskId: task.id, agent: routing.agent.name, durationMs: executionTimePerTask[task.id], attempt },
          `[v2:editor] ${routing.agent.name} Completed`
        );

        return taskResult;
      } catch (err) {
        const errMsg = String(err);
        taskRetries.set(task.id, (taskRetries.get(task.id) ?? 0) + 1);
        agentRetries[routing.agent.id] = (agentRetries[routing.agent.id] || 0) + 1;
        logger.warn(
          { projectId: options.projectId, taskId: task.id, agent: routing.agent.name, attempt, err: errMsg },
          `[v2:editor] ${routing.agent.name} failed, retrying...`
        );

        if (attempt < MAX_REPAIR_ATTEMPTS) {
          // Phase 14.1: Timeline — repair step
          const tlRepairStep = tl.beginStep({
            type: "repair",
            title: `Repairing: ${task.title} (attempt ${attempt + 1})`,
            description: `Error: ${errMsg.slice(0, 200)}`,
            specialist: routing.agent.id,
            affectedFiles: [...task.filesToModify, ...task.filesToRead],
            metadata: {
              taskId: task.id,
              retryNumber: attempt + 1,
              error: errMsg.slice(0, 500),
            },
          });
          await new Promise((r) => setTimeout(r, 500));
          tl.completeStep(tlRepairStep, {
            metadata: { repairDurationMs: 500 },
          });
        } else {
          // Phase 14.1: Timeline — fail execution step
          tl.failStep(tlExecStep, `Task failed after ${attempt + 1} attempt(s): ${errMsg.slice(0, 300)}`);

          task.status = "failed";
          taskErrors.set(task.id, errMsg);
          agentFailures[routing.agent.id] = (agentFailures[routing.agent.id] || 0) + 1;
          // Phase 13.8: Publish task failed event
          workspaceEventBus.publish("TASK_FAILED", {
            taskId: task.id,
            agentId: routing.agent.id,
            error: errMsg,
          });
          logger.error(
            { projectId: options.projectId, taskId: task.id, agent: routing.agent.name, err: errMsg },
            `[v2:editor] ${routing.agent.name} failed after ${MAX_REPAIR_ATTEMPTS + 1} attempts`
          );
          return null;
        }
      }
    }

    return null; // Should not reach here
  }

  // ── Execute tasks in dependency order ────────────────────────────────────
  const executedTasks = new Set<string>();
  const taskResults = new Map<string, EditResult>();
  const taskExecutionTimes: Record<string, number> = {};

  async function executeReadyTasks(): Promise<void> {
    // Find tasks whose dependencies are all satisfied
    const ready = tasks.filter((t) => {
      if (executedTasks.has(t.id)) return false;
      return t.dependsOn.every((depId) => executedTasks.has(depId));
    });

    if (ready.length === 0) return;

    // Log activity
    for (const t of ready) {
      logger.info({ projectId: options.projectId, taskId: t.id, title: t.title }, `[v2:editor] Executing ${t.title}...`);
    }

    // Execute ready tasks in parallel (they are independent of each other)
    const results = await Promise.all(
      ready.map(async (task) => {
        const taskStart = Date.now();
        const result = await executeTaskWithRetry(task);
        executionTimePerTask[task.id] = Date.now() - taskStart;
        return { task, result };
      }),
    );

    // Collect results
    for (const { task, result } of results) {
      if (result) {
        taskResults.set(task.id, result);
        executedTasks.add(task.id);
      } else {
        taskErrors.set(task.id, `Task ${task.id} failed after retries`);
      }
    }

    // If there are more tasks with satisfied dependencies, continue
    const remaining = tasks.filter((t) => !executedTasks.has(t.id));
    if (remaining.length > 0) {
      await executeReadyTasks();
    }
  }

  // Start execution
  await executeReadyTasks();

  // ── Merge task results ────────────────────────────────────────────────────
  logger.info(
    { projectId: options.projectId, completedTasks: executedTasks.size, failedTasks: taskErrors.size },
    "[v2:editor] Merging task results...",
  );

  const mergeStart = Date.now();
  const taskResultEntries: Array<{ taskId: string; result: EditResult }> = [];
  for (const [taskId, result] of taskResults) {
    taskResultEntries.push({ taskId, result });
  }

  const mergeResult: MergeResult = mergeTaskResults(taskResultEntries);
  const mergeTimeMs = Date.now() - mergeStart;

  logger.info(
    {
      projectId: options.projectId,
      mergedCount: mergeResult.mergedCount,
      conflictCount: mergeResult.conflictCount,
      mergeTimeMs,
    },
    `[v2:editor] ${mergeResult.summary}`,
  );

  // Build the final EditResult from the merge
  const taskSummaries = taskResultEntries.map(({ taskId, result }) => `[${taskId}] ${result.summary}`);
  let result = mergeResultToEditResult(mergeResult, taskSummaries);

  // ── Phase 13.2.5: Validate and repair loop on merged result ──────────────
  if (wsCtx?.availableValidators && result.changes.length > 0) {
    const depNames = [
      ...(wsCtx.dependencies?.map((d) => d.name) ?? []),
    ];
    validatorConfig = detectValidators(depNames, wsCtx.framework);

    if (validatorConfig.typescript || validatorConfig.eslint || validatorConfig.build) {
      // Phase 14.1: Timeline — validation step
      const tlValStep = tl.beginStep({
        type: "validation",
        title: "Validating changes",
        description: `Running ${["typescript","eslint","build"].filter(k => (validatorConfig as any)[k]).join(", ")} validators`,
        metadata: {
          validators: ["typescript","eslint","build"].filter(k => (validatorConfig as any)[k]),
          changeCount: result.changes.length,
        },
      });

      validationReport = await validateChanges(
        files,
        result.changes,
        validatorConfig,
        options.projectId,
      );

      while (!validationReport.success && repairAttempts < MAX_REPAIR_ATTEMPTS) {
        repairAttempts++;

        const allErrors: Array<{ file: string; line: number; column: number; message: string }> = [];
        for (const vr of validationReport.results) {
          allErrors.push(...vr.errors);
        }

        // Phase 14.1: Timeline — repair step
        const tlFixStep = tl.beginStep({
          type: "repair",
          title: `Fixing validation errors (attempt ${repairAttempts})`,
          description: `Repairing ${allErrors.length} error(s) from validation`,
          metadata: {
            retryNumber: repairAttempts,
            repairedErrors: allErrors.length,
            validators: ["typescript","eslint","build"].filter(k => (validatorConfig as any)[k]),
          },
        });

        logger.info(
          {
            projectId: options.projectId,
            repairAttempt: repairAttempts,
            errorCount: allErrors.length,
          },
          "[v2:editor] Starting repair attempt on merged result",
        );

        const repairPrompt = buildRepairPrompt(instruction, allErrors);
        const repairUserPrompt = buildUserPrompt(
          context,
          wsCtx,
          blueprint,
          files,
          repairPrompt,
          selectedFilePaths,
          executionPlan,
          lastDecision,
          lastAudit,
          lastAssessment,
          lastAdvisor,
          lastRoadmap,
        );

        // Re-run the full pipeline with repair prompt
        const repairStream = await streamNvidia({
          model:       EDITOR_MODEL,
          temperature: 0.35,
          maxTokens:   16000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: repairUserPrompt },
          ],
          _feature:   "website-v2-edit",
          _userId:    options.userId,
          _projectId: options.projectId,
        });

        const repairRaw = await accumulateStream(repairStream);

        let repairResult: EditResult;
        try {
          const repaired = jsonrepair(repairRaw);
          repairResult = extractJson(repaired) as EditResult;
        } catch (err) {
          logger.error({ err: String(err), rawLen: repairRaw.length }, "[v2:editor] Repair JSON parse failed");
          // Phase 14.1: Timeline — fail repair step
          tl.failStep(tlFixStep, `Repair JSON parse failed: ${String(err).slice(0, 200)}`);
          break;
        }

        if (!Array.isArray(repairResult?.changes)) {
          // Phase 14.1: Timeline — fail repair step
          tl.failStep(tlFixStep, "Repair result had no changes array");
          break;
        }

        result = repairResult;

        // Phase 14.1: Timeline — complete repair step
        tl.completeStep(tlFixStep, {
          metadata: {
            repairedErrors: allErrors.length,
            repairDurationMs: Date.now() - (validationReport ? Date.now() - 1 : Date.now()),
          },
        });

        validationReport = await validateChanges(
          files,
          result.changes,
          validatorConfig,
          options.projectId,
        );
      }

      // ── Phase 14.1: Timeline — complete validation step ────────────────────
      const totalErrorsVal = validationReport && !validationReport.success
        ? validationReport.results.reduce((sum, r) => sum + r.errors.length, 0)
        : 0;
      tl.completeStep(tlValStep, {
        metadata: {
          success: validationReport?.success ?? true,
          errorCount: totalErrorsVal,
          repairAttempts,
          validationPassed: validationReport?.success ?? true,
        },
      });
    }
  }

  // ── Phase 14.3: Preview Intelligence — analyze preview for visual/runtime issues ──
  //
  // Runs static analysis on changed files to detect common preview failure
  // patterns. If blocking issues are found, performs up to MAX_PREVIEW_REPAIR
  // autonomous repair passes before proceeding to confidence analysis.
  //
  // Flow:
  //   Validation → Preview Intelligence → (repair loop → re-validate) → Confidence
  //
  let previewReport: PreviewReport | null = null;
  const MAX_PREVIEW_REPAIR = 2;
  let previewRepairAttempts = 0;

  {
    // Phase 14.1: Timeline — preview analysis step
    const tlPreviewStep = tl.beginStep({
      type: "analysis",
      title: "Preview intelligence",
      description: "Analyzing changes for runtime and visual issues…",
      metadata: {
        fileCount: result.changes.length,
      },
    });

    // Run static preview analysis on the changed files
    const changedFilesForPreview = result.changes.map((c) => ({
      path: c.path,
      content: c.content,
      operation: c.operation,
    }));

    previewReport = analyzePreviewState(
      changedFilesForPreview,
      files.map((f) => ({ path: f.path, content: f.content })),
      wsCtx?.framework,
    );

    // Autonomous repair loop for preview issues
    while (previewReport.needsRepair && previewRepairAttempts < MAX_PREVIEW_REPAIR) {
      previewRepairAttempts++;

      logger.info(
        {
          projectId: options.projectId,
          previewRepairAttempt: previewRepairAttempts,
          healthScore: previewReport.healthScore,
          issues: previewReport.summary,
        },
        `[v2:editor] Preview repair attempt ${previewRepairAttempts}`,
      );

      // Build a focused repair prompt for the editing agent
      const repairPrompt = buildPreviewRepairPrompt(previewReport);
      const repairUserPrompt = buildUserPrompt(
        context,
        wsCtx,
        blueprint,
        files,
        `The preview has issues that must be fixed:\n\n${repairPrompt}\n\nImportant: fix these issues by modifying the affected files. Output the complete corrected files.`,
        selectedFilePaths,
        executionPlan,
        lastDecision,
        lastAudit,
        lastAssessment,
        lastAdvisor,
        lastRoadmap,
      );

      try {
        const repairStream = await streamNvidia({
          model:       EDITOR_MODEL,
          temperature: 0.3,
          maxTokens:   16000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: repairUserPrompt },
          ],
          _feature:   "website-v2-edit",
          _userId:    options.userId,
          _projectId: options.projectId,
        });

        let repairRaw = "";
        for await (const chunk of repairStream) {
          repairRaw += chunk;
        }

        const repaired = jsonrepair(repairRaw);
        const repairResult = extractJson(repaired) as EditResult;

        if (Array.isArray(repairResult?.changes)) {
          // Apply the repair changes
          result = repairResult;

          // Re-run preview analysis on the repaired files
          const repairedFilesForPreview = result.changes.map((c) => ({
            path: c.path,
            content: c.content,
            operation: c.operation,
          }));

          previewReport = analyzePreviewState(
            repairedFilesForPreview,
            files.map((f) => ({ path: f.path, content: f.content })),
            wsCtx?.framework,
          );

          logger.info(
            {
              projectId: options.projectId,
              healthScore: previewReport.healthScore,
              status: previewReport.state.status,
            },
            `[v2:editor] Preview repair attempt ${previewRepairAttempts} complete`,
          );
        } else {
          logger.warn(
            { projectId: options.projectId },
            "[v2:editor] Preview repair returned no valid changes — skipping",
          );
          break;
        }
      } catch (err) {
        logger.warn(
          { projectId: options.projectId, err: String(err) },
          "[v2:editor] Preview repair failed",
        );
        break;
      }
    }

    tl.completeStep(tlPreviewStep, {
      metadata: {
        healthScore: previewReport.healthScore,
        status: previewReport.state.status,
        runtimeErrors: previewReport.state.runtimeErrors.length,
        visualIssues: previewReport.state.visualIssues.length,
        repairAttempts: previewRepairAttempts,
      },
    });

    // Phase 14.3: Forward preview intelligence as SSE event
    if (onPreview) {
      onPreview({
        status: previewReport.state.status,
        healthScore: previewReport.healthScore,
        runtimeErrors: previewReport.state.runtimeErrors,
        consoleErrors: previewReport.state.consoleErrors,
        missingAssets: previewReport.state.missingAssets,
        brokenRoutes: previewReport.state.brokenRoutes,
        visualIssues: previewReport.state.visualIssues.map((v) => ({
          type: v.type,
          severity: v.severity,
          description: v.description,
          affectedFiles: v.affectedFiles,
        })),
        needsRepair: previewReport.needsRepair,
        repairAttempts: previewRepairAttempts,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Phase 14.4: Visual Verification — analyze visual/layout/design regressions ──
  //
  // Runs static analysis on changed files to detect visual regressions including
  // broken layouts, overlapping elements, missing sections, spacing issues,
  // responsive problems, typography inconsistencies, and design token violations.
  //
  // Flow:
  //   Preview Intelligence → Visual Verification → (repair loop → re-verify) → Confidence
  //
  let visualReport: VisualReport | null = null;
  const MAX_VISUAL_REPAIR = 2;
  let visualRepairAttempts = 0;

  {
    // Phase 14.1: Timeline — visual verification step
    const tlVisualStep = tl.beginStep({
      type: "analysis",
      title: "Visual verification",
      description: "Checking for layout, responsive, and design regressions…",
      metadata: {
        fileCount: result.changes.length,
      },
    });

    // Run static visual analysis on the changed files
    const changedFilesForVisual = result.changes.map((c) => ({
      path: c.path,
      content: c.content,
      operation: c.operation,
    }));

    // Build original file map for before/after comparison
    const originalFilesForVisual = result.changes
      .filter((c) => c.operation === "update")
      .map((c) => ({
        path: c.path,
        content: files.find((f) => f.path === c.path)?.content ?? "",
      }));

    visualReport = analyzeVisualState(
      changedFilesForVisual,
      files.map((f) => ({ path: f.path, content: f.content })),
      originalFilesForVisual.length > 0 ? originalFilesForVisual : undefined,
      wsCtx?.designTokens ?? undefined,
    );

    // Autonomous repair loop for visual issues
    while (visualReport.needsRepair && visualRepairAttempts < MAX_VISUAL_REPAIR) {
      visualRepairAttempts++;

      logger.info(
        {
          projectId: options.projectId,
          visualRepairAttempt: visualRepairAttempts,
          score: visualReport.score,
          issues: visualReport.issues.length,
        },
        `[v2:editor] Visual repair attempt ${visualRepairAttempts}`,
      );

      // Build a focused repair prompt for the editing agent
      const repairPrompt = buildVisualRepairPrompt(visualReport);
      const repairUserPrompt = buildUserPrompt(
        context,
        wsCtx,
        blueprint,
        files,
        `The visual verification has detected regressions that must be fixed:\n\n${repairPrompt}\n\nImportant: fix these visual issues by modifying the affected files. Output the complete corrected files.`,
        selectedFilePaths,
        executionPlan,
        lastDecision,
        lastAudit,
        lastAssessment,
        lastAdvisor,
        lastRoadmap,
      );

      try {
        const repairStream = await streamNvidia({
          model:       EDITOR_MODEL,
          temperature: 0.3,
          maxTokens:   16000,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user",   content: repairUserPrompt },
          ],
          _feature:   "website-v2-edit",
          _userId:    options.userId,
          _projectId: options.projectId,
        });

        let repairRaw = "";
        for await (const chunk of repairStream) {
          repairRaw += chunk;
        }

        const repaired = jsonrepair(repairRaw);
        const repairResult = extractJson(repaired) as EditResult;

        if (Array.isArray(repairResult?.changes)) {
          // Apply the repair changes
          result = repairResult;

          // Re-run visual analysis on the repaired files
          const repairedFilesForVisual = result.changes.map((c) => ({
            path: c.path,
            content: c.content,
            operation: c.operation,
          }));

          const repairedOriginals = result.changes
            .filter((c) => c.operation === "update")
            .map((c) => ({
              path: c.path,
              content: files.find((f) => f.path === c.path)?.content ?? "",
            }));

          visualReport = analyzeVisualState(
            repairedFilesForVisual,
            files.map((f) => ({ path: f.path, content: f.content })),
            repairedOriginals.length > 0 ? repairedOriginals : undefined,
            wsCtx?.designTokens ?? undefined,
          );

          logger.info(
            {
              projectId: options.projectId,
              score: visualReport.score,
              status: visualReport.status,
            },
            `[v2:editor] Visual repair attempt ${visualRepairAttempts} complete`,
          );
        } else {
          logger.warn(
            { projectId: options.projectId },
            "[v2:editor] Visual repair returned no valid changes — skipping",
          );
          break;
        }
      } catch (err) {
        logger.warn(
          { projectId: options.projectId, err: String(err) },
          "[v2:editor] Visual repair failed",
        );
        break;
      }
    }

    tl.completeStep(tlVisualStep, {
      metadata: {
        score: visualReport.score,
        status: visualReport.status,
        issues: visualReport.issues.length,
        repairAttempts: visualRepairAttempts,
        layoutBreaks: visualReport.issues.filter((i) => i.category === "layout-break").length,
        responsiveIssues: visualReport.issues.filter((i) => i.category === "responsive").length,
        designTokenViolations: visualReport.issues.filter((i) => i.category === "design-token").length,
      },
    });

    // Phase 14.4: Forward visual verification as SSE event
    if (onVisual) {
      onVisual({
        score: visualReport.score,
        status: visualReport.status,
        issues: visualReport.issues.map((i) => ({
          category: i.category,
          severity: i.severity,
          description: i.description,
          suggestion: i.suggestion,
          affectedFiles: i.affectedFiles,
        })),
        comparison: {
          modifiedVisuals: visualReport.comparison.modifiedVisuals,
          removedFiles: visualReport.comparison.removedFiles,
          addedFiles: visualReport.comparison.addedFiles,
          sectionDelta: visualReport.comparison.sectionDelta,
        },
        breakdown: {
          layoutScore: visualReport.breakdown.layoutScore,
          overlapScore: visualReport.breakdown.overlapScore,
          spacingScore: visualReport.breakdown.spacingScore,
          responsiveScore: visualReport.breakdown.responsiveScore,
          typographyScore: visualReport.breakdown.typographyScore,
          designTokenScore: visualReport.breakdown.designTokenScore,
          regressionScore: visualReport.breakdown.regressionScore,
        },
        needsRepair: visualReport.needsRepair,
        repairAttempts: visualRepairAttempts,
        summary: visualReport.summary,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Phase 13.8: Compute confidence and publish validation event ─────────
  {
    const ctxForConfidence: WorkspaceContext = (workspaceObserver?.getContext() ?? wsCtx) as WorkspaceContext || {};
    const lastImpactVal = lastImpact as ChangeImpact | null;
    lastConfidence = computeConfidence(
      validationReport,
      ctxForConfidence,
      workspaceObserver?.getSnapshot() ?? { version: 0, timestamp: "", changedFiles: [], importGraphVersion: 0, componentGraphVersion: 0, routeTreeVersion: 0, validationVersion: 0, confidence: 100 },
      repairAttempts,
      lastImpactVal?.impactScore,
    );

    // Phase 14.3: Adjust confidence based on preview health
    if (previewReport) {
      // Preview health score influences the final confidence — a failed preview
      // reduces confidence similarly to a failed validation.
      const previewPenalty = Math.max(0, 30 - previewReport.healthScore * 0.3);
      lastConfidence.score = Math.max(0, lastConfidence.score - previewPenalty);
      if (previewReport.state.runtimeErrors.length > 0) {
        lastConfidence.score = Math.max(0, lastConfidence.score - 15);
        lastConfidence.reasons.push("preview: runtime errors detected");
      }
      if (previewReport.state.brokenRoutes.length > 0) {
        lastConfidence.score = Math.max(0, lastConfidence.score - 10);
        lastConfidence.reasons.push("preview: broken routes");
      }
      if (previewReport.state.visualIssues.length > 0) {
        lastConfidence.reasons.push(`preview: ${previewReport.state.visualIssues.length} visual issue(s)`);
      }
    }

    // Phase 14.4: Adjust confidence based on visual verification score
    if (visualReport) {
      // Visual score influences confidence — layout breaks and responsive issues
      // are highly visible to the user and erode trust.
      const visualPenalty = Math.max(0, 40 - visualReport.score * 0.4);
      lastConfidence.score = Math.max(0, lastConfidence.score - visualPenalty);
      const highSeverityIssues = visualReport.issues.filter((i) => i.severity === "critical" || i.severity === "high");
      if (highSeverityIssues.length > 0) {
        lastConfidence.score = Math.max(0, lastConfidence.score - 15);
        lastConfidence.reasons.push(`visual: ${highSeverityIssues.length} high-severity issue(s)`);
      }
      if (visualReport.issues.filter((i) => i.category === "responsive").length > 0) {
        lastConfidence.score = Math.max(0, lastConfidence.score - 5);
        lastConfidence.reasons.push("visual: responsive issues detected");
      }
      if (visualReport.issues.filter((i) => i.category === "design-token").length > 0) {
        lastConfidence.reasons.push("visual: design token violations");
      }
      if (visualReport.issues.length > 0) {
        lastConfidence.reasons.push(`visual: ${visualReport.issues.length} total issue(s)`);
      }
    }

    // Publish validation completed event
    workspaceEventBus.publish("VALIDATION_COMPLETED", {
      success: validationReport?.success ?? true,
      errorCount: validationReport && !validationReport.success
        ? validationReport.results.reduce((sum, r) => sum + r.errors.length, 0)
        : 0,
      confidence: lastConfidence.score,
      needsExtraRepair: lastConfidence.needsExtraRepair,
    });

    // Publish confidence changed event
    workspaceEventBus.publish("CONFIDENCE_CHANGED", {
      score: lastConfidence.score,
      level: lastConfidence.score >= 90 ? "high" : lastConfidence.score >= 70 ? "medium" : "low",
      reasons: lastConfidence.reasons,
    });

    // Update workspace observer with new confidence
    if (workspaceObserver) {
      workspaceObserver.updateContext(ctxForConfidence);
      workspaceObserver.setConsistent(validationReport?.success ?? true);
      lastSnapshot = workspaceObserver.getSnapshot();
      workspaceUpdates = lastSnapshot.version;
    }

    // Phase 14.1: Timeline — confidence analysis step
    const tlConfStep = tl.beginStep({
      type: "analysis",
      title: "Confidence analysis",
      description: `Score: ${lastConfidence.score} — ${lastConfidence.reasons.join(", ")}`,
      metadata: {
        confidenceScore: lastConfidence.score,
        impactScore: lastImpactVal?.impactScore ?? 0,
        needsExtraRepair: lastConfidence.needsExtraRepair,
        level: lastConfidence.score >= 90 ? "high" : lastConfidence.score >= 70 ? "medium" : "low",
      },
    });
    tl.completeStep(tlConfStep);

    // ── Phase 14.2: Forward confidence payload via callback ──────────────────
    if (onConfidence) {
      // Build risks from impact analysis
      const risks: import("./website-v2-types").ConfidenceRisk[] = [];
      if (lastImpactVal) {
        if (lastImpactVal.impactScore > 50) {
          risks.push({ severity: "high", reason: "High-impact changes detected", affectedScope: `${lastImpactVal.affectedComponents.length} components, ${lastImpactVal.affectedRoutes.length} routes` });
        }
        if (lastImpactVal.affectedRoutes.length > 0) {
          risks.push({ severity: "medium", reason: "Route changes may affect navigation", affectedScope: lastImpactVal.affectedRoutes.join(", ") });
        }
        if (lastImpactVal.affectedComponents.length > 5) {
          risks.push({ severity: "medium", reason: `Layout affects ${lastImpactVal.affectedComponents.length} pages`, affectedScope: lastImpactVal.affectedComponents.join(", ") });
        }
        if (lastImpactVal.affectedImports.some(i => i.includes("types") || i.includes("type"))) {
          risks.push({ severity: "medium", reason: "Type definitions modified", affectedScope: "Shared types" });
        }
        if (lastImpactVal.affectedImports.some(i => i.includes("global") || i.includes("style") || i.includes("css"))) {
          risks.push({ severity: "medium", reason: "Global styles modified", affectedScope: "Theme / global CSS" });
        }
        if (lastImpactVal.affectedImports.some(i => i.includes("store") || i.includes("state") || i.includes("reducer"))) {
          risks.push({ severity: "high", reason: "State store modified", affectedScope: "Application state" });
        }
      }
      // Shared/modified Button component risk
      const hasSharedComponent = lastImpactVal?.affectedComponents.some(c =>
        ["button", "modal", "input", "card", "dropdown", "nav", "header", "footer"].includes(c.toLowerCase())
      );
      if (hasSharedComponent) {
        risks.push({ severity: "high", reason: "Editing shared component", affectedScope: "Used across multiple pages" });
      }

      // Build validation status from validation report
      const valTypescript: "passed" | "failed" = validationReport?.results.some(r => r.validator === "typescript" && r.errors.length > 0) ? "failed" : "passed";
      const valEslint: "passed" | "failed" = validationReport?.results.some(r => r.validator === "eslint" && r.errors.length > 0) ? "failed" : "passed";
      const valBuild: "passed" | "failed" = validationReport?.results.some(r => r.validator === "build" && r.errors.length > 0) ? "failed" : "passed";

      // Build breakdown signals
      const planningQuality = executionPlan?.complexity === "low" ? 95 : executionPlan?.complexity === "medium" ? 80 : 65;
      const validationScore = validationReport?.success ? (lastConfidence.score >= 90 ? 100 : 80) : 40;
      const workspaceConsistency = 90; // derived from workspace observer consistency
      const historicalSuccess = 85; // placeholder — would come from execution-analytics-engine
      const specialistConfidence = lastConfidence.score;
      const repairStability = repairAttempts === 0 ? 100 : Math.max(0, 100 - repairAttempts * 15);

      // Build repair history
      const repairs: import("./website-v2-types").ConfidenceRepair[] = [];
      if (repairAttempts > 0 && validationReport) {
        for (let i = 0; i < repairAttempts; i++) {
          const validatorsRun = validatorConfig
            ? ["typescript","eslint","build"].filter(k => (validatorConfig as any)[k])
            : ["typescript","eslint","build"];
          for (const v of validatorsRun) {
            repairs.push({
              attempt: i + 1,
              validator: v.charAt(0).toUpperCase() + v.slice(1),
              status: "fixed" as const,
            });
          }
        }
      }

      onConfidence({
        score: lastConfidence.score,
        level: lastConfidence.score >= 90 ? "high" : lastConfidence.score >= 70 ? "medium" : "low",
        risks,
        impact: {
          score: lastImpactVal?.impactScore ?? 0,
          affectedFiles: result.changes.length,
          affectedComponents: lastImpactVal?.affectedComponents.length ?? 0,
          affectedRoutes: lastImpactVal?.affectedRoutes.length ?? 0,
          dependenciesTouched: lastImpactVal?.affectedImports.length ?? 0,
        },
        validation: {
          typescript: valTypescript,
          eslint: valEslint,
          build: valBuild,
          preview: "pending",
        },
        breakdown: {
          planningQuality,
          validationScore,
          workspaceConsistency,
          historicalSuccess,
          specialistConfidence,
          repairStability,
        },
        repairs,
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ── Phase 14.5: Take after-edit snapshot and check auto-rollback ─────────
  {
    // Take snapshot of the final state after all edits, repairs, and verification
    const beforeEditSnapshot = recovery.getFirstSnapshot();
    recovery.snapshot(
      result.changes.map((c) => ({
        path: c.path,
        content: c.content,
        language: "",
        size: c.content.length,
        operation: "update" as const,
      })),
      "after_edit",
      "Post-edit workspace state after all repairs and verification",
    );

    // Check if rollback is needed based on quality gate signals
    const hasRuntimeErrors = (previewReport?.state.runtimeErrors.length ?? 0) > 0;
    const autoRollbackDecision = recovery.checkAutoRollback({
      validationPassed: validationReport?.success ?? true,
      maxRepairsReached: repairAttempts >= MAX_REPAIR_ATTEMPTS,
      confidenceScore: lastConfidence?.score ?? 100,
      visualScore: visualReport?.score ?? 100,
      hasRuntimeErrors,
    });

    if (autoRollbackDecision.shouldRollback && beforeEditSnapshot) {
      logger.warn(
        {
          projectId: options.projectId,
          trigger: autoRollbackDecision.trigger,
          reason: autoRollbackDecision.reason,
          confidenceScore: lastConfidence?.score,
          visualScore: visualReport?.score,
          validationPassed: validationReport?.success,
        },
        "[v2:editor] Auto-rollback triggered",
      );

      // Perform rollback to the "before_edit" snapshot
      const currentFiles: ProjectFile[] = result.changes.map((c) => ({
        path: c.path,
        content: c.content,
        language: "",
        size: c.content.length,
        operation: "update" as const,
      }));

      const report = recovery.rollback(
        beforeEditSnapshot,
        currentFiles,
        autoRollbackDecision.trigger!,
      );

      if (report.success) {
        // Replace the edit result with the rollback changes from the recovery report
        result = {
          changes: report.changes.map((c) => ({
            ...c,
            reason: `Auto-rollback: ${autoRollbackDecision.reason}`,
          })),
          summary: `Auto-rollback performed — ${autoRollbackDecision.reason}`,
        };
      } else {
        logger.error(
          { projectId: options.projectId, snapshotId: beforeEditSnapshot.id, failureReason: report.failureReason },
          "[v2:editor] Rollback execution failed — returning last stable result",
        );
      }
    } else if (autoRollbackDecision.shouldRollback && !beforeEditSnapshot) {
      logger.warn(
        { projectId: options.projectId },
        "[v2:editor] Auto-rollback requested but no before_edit snapshot available",
      );
    }
  }

  // ── Phase 13.7: Reinforce specialist memories based on validation ──────
  if (options.projectId) {
    for (const routing of agentRoutingResults) {
      try {
        const taskKeywords = [
          routing.agent.id,
          ...routing.agent.capabilities,
          ...(executionPlan?.strategy ? [executionPlan.strategy] : []),
        ];
        const reinforcementResult = reinforceSpecialistMemories(
          options.projectId,
          routing.agent.id,
          validationReport?.success ?? true,
          taskKeywords,
        );
        if (reinforcementResult.reinforced > 0) {
          specialistReinforced[routing.agent.id] = (specialistReinforced[routing.agent.id] || 0) + reinforcementResult.reinforced;
        }
        if (reinforcementResult.weakened > 0) {
          specialistWeakened[routing.agent.id] = (specialistWeakened[routing.agent.id] || 0) + reinforcementResult.weakened;
        }
        if (reinforcementResult.archived > 0) {
          specialistArchived[routing.agent.id] = (specialistArchived[routing.agent.id] || 0) + reinforcementResult.archived;
        }
      } catch (err) {
        logger.warn({ projectId: options.projectId, specialistId: routing.agent.id, err: String(err) }, "[v2:editor] Memory reinforcement failed");
      }
    }
  }

  // Phase 13.4: Compute planning accuracy
  if (executionPlan) {
    try {
      const actualFiles = result.changes.map((c) => c.path);
      planningAccuracy = computePlanningAccuracy(executionPlan, actualFiles);
    } catch (err) {
      logger.warn({ projectId: options.projectId, err: String(err) }, "[v2:editor] Accuracy computation failed");
    }
  }

  // ── Telemetry ─────────────────────────────────────────────────────────────
  const systemTokens = Math.ceil(systemPrompt.length / 4);

  const contextFiles = selectContextFiles(files, wsCtx, selectedFilePaths);
  const selectedInContext = contextFiles.filter(f => selectedFilePaths?.includes(f.path)).length;
  const relatedInContext  = contextFiles.filter(f => wsCtx?.relatedFiles?.includes(f.path) && !selectedFilePaths?.includes(f.path)).length;
  const otherInContext    = contextFiles.length - selectedInContext - relatedInContext;

  // Phase 13.3.1: Budget usage telemetry
  const budgetResult = lastBudgetResult;

  // Phase 13.3.2: Extract project memories from this successful edit
  // (only when we have a projectId — memory is per-project)
  if (options.projectId) {
    try {
      const extractionResult = extractMemories(
        options.projectId,
        instruction,
        wsCtx?.acceptedPatterns ?? [],
        wsCtx?.rejectedPatterns ?? [],
      );
      if (extractionResult.extracted.length > 0) {
        logger.info(
          { projectId: options.projectId, extracted: extractionResult.extracted.length, extractionTimeMs: extractionResult.extractionTimeMs },
          "[v2:editor] Extracted project memories",
        );
      }
    } catch (err) {
      // Non-fatal — extraction failure should not break the edit
      logger.warn({ projectId: options.projectId, err: String(err) }, "[v2:editor] Memory extraction failed");
    }
  }

  // ── Phase 14.1: Complete timeline BEFORE telemetry ──────────────────────
  const timingStats = tl.getTimingStats();
  const timelineStepCount = timingStats.totalSteps;
  const timelineSlowestStep = timingStats.slowestStep?.id ?? "unknown";
  const timelineFastestStep = timingStats.fastestStep?.id ?? "unknown";
  const timelineAvgDuration = timingStats.averageStepDuration;

  tl.complete();

  // Total duration after completion
  const timelineDuration = tl.getSnapshot().totalDurationMs ?? 0;

  logger.info(
    {
      projectId: options.projectId,
      systemTokens,
      contextFileCount: contextFiles.length,
      totalProjectFiles: files.length,
      // Phase 13.2.2: Context selection breakdown
      contextSelectedFiles: selectedInContext,
      contextRelatedFiles: relatedInContext,
      contextOtherFiles: otherInContext,
      // Phase 13.3.1: Token budget telemetry
      contextUsedTokens: budgetResult?.usedFileTokens ?? 0,
      contextAvailableTokens: budgetResult?.availableFileTokens ?? 0,
      contextSummarizedCount: budgetResult?.summarizedCount ?? 0,
      contextOmittedCount: budgetResult?.omittedCount ?? 0,
      contextAllFitUnsummarized: budgetResult?.allFitUnsummarized ?? true,
      // Phase 13.2.5: Validation telemetry
      validationSuccess: validationReport?.success ?? true,
      validationDurationMs: validationReport?.totalDurationMs ?? 0,
      repairAttempts,
      finalErrorCount: validationReport && !validationReport.success
        ? validationReport.results.reduce((sum, r) => sum + r.errors.length, 0)
        : 0,
      // Phase 13.4: Execution planning telemetry
      planningTimeMs,
      strategy: executionPlan?.strategy ?? "unknown",
      complexity: executionPlan?.complexity ?? "unknown",
      riskCount: executionPlan?.risks.length ?? 0,
      plannedFiles: executionPlan?.filesToModify.length ?? 0,
      actualFilesModified: result.changes.length,
      planningPrecision: planningAccuracy?.precision ?? 0,
      planningRecall: planningAccuracy?.recall ?? 0,
      planningF1: planningAccuracy?.f1Score ?? 0,
      // Phase 13.5: Task orchestration telemetry
      taskCount: tasks.length,
      parallelTasks: taskPlan.parallelCount,
      sequentialTasks: taskPlan.sequentialChains,
      mergeConflicts: mergeResult.conflictCount,
      taskRetries: Array.from(taskRetries.values()).reduce((sum, v) => sum + v, 0),
      failedTasks: taskErrors.size,
      completedTasks: executedTasks.size,
      mergeTimeMs,
      overallExecutionTimeMs: Date.now() - overallStart,
      // Phase 13.6: Specialist agent telemetry
      selectedAgent: agentRoutingResults[0]?.agent.id ?? "unknown",
      routingReason: agentRoutingResults[0]?.reason ?? "",
      fallbackAgentCount,
      tasksPerAgent: Object.entries(agentTaskCount).map(([k, v]) => `${k}:${v}`).join(","),
      agentFailures: Object.entries(agentFailures).map(([k, v]) => `${k}:${v}`).join(","),
      agentRetries: Object.entries(agentRetries).map(([k, v]) => `${k}:${v}`).join(","),
      agentSuccessRate: agentRoutingResults.length > 0
        ? (agentRoutingResults.length - Object.values(agentFailures).reduce((a, b) => a + b, 0)) / agentRoutingResults.length
        : 1,
      averageTaskDurationPerAgent: Object.entries(agentExecutionTimes).map(([k, v]) =>
        `${k}:${Math.round(v.reduce((a, b) => a + b, 0) / v.length)}ms`
      ).join(","),
      // Phase 13.7: Specialist memory telemetry
      specialistMemoryCount: Object.values(specialistMemoryCounts).reduce((a, b) => a + b, 0),
      retrievalTimeMs: Object.values(specialistMemoryRetrievalTimes).reduce((a, b) => a + b, 0),
      newMemoriesExtracted: Object.values(specialistNewMemoriesExtracted).reduce((a, b) => a + b, 0),
      reinforcedMemories: Object.values(specialistReinforced).reduce((a, b) => a + b, 0),
      weakenedMemories: Object.values(specialistWeakened).reduce((a, b) => a + b, 0),
      archivedMemories: Object.values(specialistArchived).reduce((a, b) => a + b, 0),
      averageConfidence: options.projectId && agentRoutingResults.length > 0
        ? getAverageConfidence(options.projectId, agentRoutingResults[0].agent.id)
        : 0,
      averageHitCount: options.projectId && agentRoutingResults.length > 0
        ? getAverageHitCount(options.projectId, agentRoutingResults[0].agent.id)
        : 0,
      // Phase 13.8: Live workspace intelligence telemetry
      workspaceVersion: lastSnapshot?.version ?? 0,
      workspaceUpdates,
      incrementalGraphUpdates,
      fullGraphRebuilds,
      affectedFiles: (lastImpact as ChangeImpact | null)?.affectedComponents?.length ?? 0,
      affectedRoutes: (lastImpact as ChangeImpact | null)?.affectedRoutes?.length ?? 0,
      affectedComponents: (lastImpact as ChangeImpact | null)?.affectedComponents?.length ?? 0,
      impactScore: (lastImpact as ChangeImpact | null)?.impactScore ?? 0,
      confidenceScore: lastConfidence?.score ?? 100,
      plannerRevisions,
      taskReprioritizations,
      contextRefreshTimeMs,
      observerLatencyMs,
      // Phase 13.9: Adaptive execution telemetry
      executionHistorySize: options.projectId ? getTotalExecutionCount(options.projectId) : 0,
      policyRevisions: getPolicyRevisionCount(),
      routingOptimizations: getRankingRevisionCount(),
      plannerOptimizations: 0,
      repairOptimizations: getTotalRepairs(),
      validationPatterns: getTotalErrorsLogged(),
      mergePredictions: getTotalMergeConflicts(),
      learningIterations: getLearningIterations(),
      agentRankChanges: getRankingRevisionCount(),
      strategyRankChanges: 0,
      executionImprovementScore: (lastLearningResult as import("./learning-loop").LearningLoopResult | null)?.improvementScore ?? 0,
      // Phase 14.6: Engineering decision telemetry
      decisionTimeMs: lastDecision?.estimatedRisk ? Date.now() - overallStart : 0,
      decisionConfidence: lastDecision?.confidence ?? 0,
      decisionRisk: lastDecision?.estimatedRisk ?? 0,
      decisionRecommendation: lastDecision?.recommendation ?? "proceed",
      decisionStrategy: lastDecision?.executionStrategy ?? "patch",
      decisionAlternatives: lastDecision?.alternatives.length ?? 0,
      decisionTradeoffCount: lastDecision?.tradeoffs.length ?? 0,
      // Phase 15.1: Engineering audit telemetry
      auditDurationMs: lastAudit?.durationMs ?? 0,
      auditScore: lastAudit?.score ?? 0,
      auditOpportunityCount: lastAudit?.opportunities.length ?? 0,
      auditCriticalCount: lastAudit?.opportunities.filter((o) => o.severity === "critical").length ?? 0,
      auditHighCount: lastAudit?.opportunities.filter((o) => o.severity === "high").length ?? 0,
      // Phase 16.2: Engineering advisor telemetry
      advisorHealth: lastAdvisor?.overallHealth ?? 0,
      advisorRecommendationCount: lastAdvisor?.recommendations.length ?? 0,
      advisorCriticalCount: lastAdvisor?.recommendations.filter((r) => r.priority === "critical").length ?? 0,
      advisorHighCount: lastAdvisor?.recommendations.filter((r) => r.priority === "high").length ?? 0,
      advisorTrendCount: lastAdvisor?.trends.length ?? 0,
      advisorNextBestAction: lastAdvisor?.nextBestAction ?? "",
      // Phase 16.1: Product intelligence telemetry
      productOverallScore: lastAssessment?.overallScore ?? 0,
      productRecommendation: lastAssessment?.recommendation ?? "approve",
      productBusinessAlignment: lastAssessment?.businessAlignment ?? 0,
      productUxImpact: lastAssessment?.uxImpact ?? 0,
      productConversionImpact: lastAssessment?.conversionImpact ?? 0,
      productBrandingConsistency: lastAssessment?.brandingConsistency ?? 0,
      productAccessibilityImpact: lastAssessment?.accessibilityImpact ?? 0,
      productSeoImpact: lastAssessment?.seoImpact ?? 0,
      productMaintainabilityImpact: lastAssessment?.maintainabilityImpact ?? 0,
      productUserRisk: lastAssessment?.userRisk ?? 0,
      productAssessmentTimeMs: lastAssessment?.assessmentTimeMs ?? 0,
      // Phase 16.3: Engineering roadmap telemetry
      roadmapCompletionPercentage: lastRoadmap?.completionPercentage ?? 0,
      roadmapItemCount: lastRoadmap?.items.length ?? 0,
      roadmapCriticalCount: lastRoadmap?.items.filter((i) => i.priority === "critical").length ?? 0,
      roadmapHighCount: lastRoadmap?.items.filter((i) => i.priority === "high").length ?? 0,
      roadmapMediumCount: lastRoadmap?.items.filter((i) => i.priority === "medium").length ?? 0,
      roadmapLowCount: lastRoadmap?.items.filter((i) => i.priority === "low").length ?? 0,
      roadmapCompletedCount: lastRoadmap?.items.filter((i) => i.status === "completed").length ?? 0,
      roadmapInProgressCount: lastRoadmap?.items.filter((i) => i.status === "in-progress").length ?? 0,
      roadmapPendingCount: lastRoadmap?.items.filter((i) => i.status === "todo").length ?? 0,
      roadmapFocusCount: lastRoadmap?.currentFocus.length ?? 0,
      roadmapRecentlyCompletedCount: lastRoadmap?.recentlyCompleted.length ?? 0,
      roadmapHealth: lastRoadmap?.roadmapHealth ?? "unknown",
      // Phase 14.1: Unified timeline telemetry
      timelineStepCount,
      timelineDuration,
      timelineAverageStepDuration: timelineAvgDuration,
      timelineSlowestStep,
      timelineFastestStep,
      timelineUpdateCount: Date.now() - overallStart, // approximate — updates fire synchronously
    },
    "[v2:editor] Edit complete telemetry",
  );

  // ── Phase 13.9: Execute learning loop ─────────────────────────────────────
  // After every completed execution, feed telemetry into the learning system.
  // This runs in the background — the edit result is returned immediately.
  if (options.projectId) {
    // Phase 14.1: Timeline — learning step (post-telemetry, fires after return)
    const tlLearnStep = tl.beginStep({
      type: "learning",
      title: "Optimizing execution policies",
      description: "Running adaptive learning loop — recording analytics, updating profiles, evolving policies",
      metadata: {
        taskCount: tasks.length,
        repairAttempts,
        validationPassed: validationReport?.success ?? true,
        confidenceScore: lastConfidence?.score ?? 100,
      },
    });

    // Collect validation errors for learning
    const validationErrorsForLearning: Array<{ file: string; message: string }> = [];
    if (validationReport && !validationReport.success) {
      for (const vr of validationReport.results) {
        for (const err of vr.errors) {
          validationErrorsForLearning.push({ file: err.file, message: err.message });
        }
      }
    }

    // Build agent selections from routing results
    // We approximate per-agent success from the overall outcome
    const agentSelectionsForLearning = agentRoutingResults.map((r) => ({
      agentId: r.agent.id,
      success: (taskErrors.size === 0),
      durationMs: executionTimePerTask[r.agent.id] || (Date.now() - overallStart),
      repairAttempts,
      taskCount: tasks.length,
      confidenceScore: lastConfidence?.score ?? 100,
      impactScore: lastImpact?.impactScore ?? 0,
      planningAccuracy: planningAccuracy?.f1Score ?? 0,
    }));

    const learningInput: LearningInput = {
      projectId: options.projectId,
      instruction,
      strategy: executionPlan?.strategy ?? "unknown",
      complexity: executionPlan?.complexity ?? "unknown",
      selectedAgent: agentRoutingResults[0]?.agent.id ?? "general",
      taskCount: tasks.length,
      repairAttempts,
      validationPassed: validationReport?.success ?? true,
      planningPrecision: planningAccuracy?.precision ?? 0,
      planningRecall: planningAccuracy?.recall ?? 0,
      planningF1: planningAccuracy?.f1Score ?? 0,
      confidenceScore: lastConfidence?.score ?? 100,
      impactScore: (lastImpact as ChangeImpact | null)?.impactScore ?? 0,
      durationMs: Date.now() - overallStart,
      mergeConflicts: mergeResult.conflictCount,
      validationErrors: validationErrorsForLearning,
      agentSelections: agentSelectionsForLearning,
      hasArchitectureEdits: executionPlan?.strategy === "architecture",
      hasHighImpactChanges: (lastImpact as ChangeImpact | null)?.impactScore != null
        ? (lastImpact as ChangeImpact | null)!.impactScore >= 60
        : false,
      fallbackCount: fallbackAgentCount,
    };

    // Fire learning loop (non-blocking — don't await, let it run in background)
    executeLearningLoop(learningInput).then((lr) => {
      lastLearningResult = lr;
      logger.info(
        { executionId: lr.executionId, improvementScore: lr.improvementScore, durationMs: lr.durationMs },
        "[v2:editor] Learning loop completed",
      );
    }).catch((err) => {
      logger.warn({ err: String(err) }, "[v2:editor] Learning loop failed (non-fatal)");
    });

    // Phase 14.1: Timeline — complete learning step
    tl.completeStep(tlLearnStep, {
      metadata: {
        learningTriggered: true,
        policyRevisions: getPolicyRevisionCount(),
        routingImprovements: getRankingRevisionCount(),
      },
    });
  }

  logger.info(
    { projectId: options.projectId, changeCount: result.changes.length, repairAttempts, contextTokens: budgetResult?.usedFileTokens ?? 0, strategy: executionPlan?.strategy, planningF1: planningAccuracy?.f1Score ?? 0 },
    "[v2:editor] Edit complete",
  );

  return result;
}
