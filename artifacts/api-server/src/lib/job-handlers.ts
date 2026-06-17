// ─── STAGEONE Job Handler Registry ───────────────────────────────────────────
//
// All execution logic lives in handlers registered here.
// The worker calls getHandler(jobType) at runtime — no hardcoded switch cases.
//
// Handler contract:
//   - Receives a JobContext with the execution record, a structured logger, and
//     an AbortSignal the worker uses for timeout enforcement.
//   - Returns a plain object stored as the execution's `result` JSONB column.
//   - Throws on unrecoverable failure (triggers retry / final-failed path).
//
// Built-in job types:
//   noop            — smoke-test the worker lifecycle (no side effects)
//   agent_task      — processes an agent task record
//   automation_run  — placeholder for automation step execution
//   workspace_task  — placeholder for workspace task execution
//   scheduled_task  — placeholder for cron / time-triggered work

import { db, agentTasksTable, agentsTable, agentMemoryTable, projectsTable } from "@workspace/db";
import type { Execution } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import { callNvidia, extractJson } from "./nvidia";
import { MODELS } from "./models";
import { emitNotification } from "../routes/notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

export type LogEntry = { timestamp: string; level: "info" | "warn" | "error"; message: string };

export type JobContext = {
  execution: Execution;
  /** Append a structured log entry (timestamped automatically). */
  log: (message: string, level?: "info" | "warn" | "error") => void;
  /** Abort signal — handlers must check this on long-running work. */
  signal: AbortSignal;
};

export type JobHandler = (ctx: JobContext) => Promise<Record<string, unknown>>;

// ─── Registry ─────────────────────────────────────────────────────────────────

const registry = new Map<string, JobHandler>();

export function registerHandler(jobType: string, handler: JobHandler): void {
  registry.set(jobType, handler);
  logger.debug({ jobType }, "HANDLER_REGISTERED");
}

export function getHandler(jobType: string): JobHandler | undefined {
  return registry.get(jobType);
}

export function listHandlers(): string[] {
  return [...registry.keys()];
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function payloadField<T>(execution: Execution, key: string): T | undefined {
  if (!execution.payload || typeof execution.payload !== "object") return undefined;
  return (execution.payload as Record<string, unknown>)[key] as T | undefined;
}

// ─── Built-in: noop ───────────────────────────────────────────────────────────
// No-op handler used to verify the worker lifecycle end-to-end.

registerHandler("noop", async ({ log, signal }) => {
  log("noop: starting");
  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, 200);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("Aborted")); }, { once: true });
  });
  log("noop: done");
  return { message: "noop completed" };
});

// ─── Agent-specific AI prompts ────────────────────────────────────────────────
// Returns a focused prompt for each supported agentKey.
// Designed to produce a small, structured JSON output (~400-600 tokens max).

function buildAgentPrompt(agentKey: string, businessIdea: string, bi: Record<string, unknown> | null): string {
  const ctx = bi ? [
    (bi as Record<string, string>).targetMarket    ? `Target market: ${(bi as Record<string, string>).targetMarket}` : "",
    (bi as Record<string, string>).businessSnapshot ? `Snapshot: ${String((bi as Record<string, string>).businessSnapshot).slice(0, 200)}` : "",
  ].filter(Boolean).join("\n") : "";

  const base = `Business: "${businessIdea}"${ctx ? `\n${ctx}` : ""}`;

  const prompts: Record<string, string> = {
    "market-researcher": `You are a market research analyst. Return ONLY valid JSON:
${base}
{"topCompetitors":["name1","name2","name3"],"marketSize":"estimated market size","keyTrends":["trend1","trend2"],"competitiveGaps":["gap1","gap2"],"recommendation":"one strategic recommendation"}`,

    "knowledge-curator": `You are a knowledge strategist. Return ONLY valid JSON:
${base}
{"knowledgeGaps":["gap1","gap2"],"curatedSources":["source1","source2"],"topicsToMonitor":["topic1","topic2"],"weeklyDigestFocus":"what to summarize weekly","recommendation":"one action to take"}`,

    "content-generator": `You are a content strategist. Return ONLY valid JSON:
${base}
{"contentPillars":["pillar1","pillar2","pillar3"],"campaignIdeas":["campaign1","campaign2"],"bestChannels":["channel1","channel2"],"keyMessage":"core message","quarterlyTheme":"overarching theme"}`,

    "social-listener": `You are a social media analyst. Return ONLY valid JSON:
${base}
{"brandSentiment":"positive/neutral/negative","topMentionTopics":["topic1","topic2"],"competitorActivity":["observation1","observation2"],"engagementOpportunities":["opp1","opp2"],"recommendation":"one action"}`,

    "ops-automator": `You are an operations automation expert. Return ONLY valid JSON:
${base}
{"topAutomations":[{"name":"...","tool":"...","timeSavedPerWeek":"..."}],"quickWins":["win1","win2"],"bottlenecks":["b1","b2"],"priorityWorkflow":"highest-impact workflow to automate first"}`,

    "invoice-collector": `You are a billing automation expert. Return ONLY valid JSON:
${base}
{"billingGaps":["gap1","gap2"],"automationOpportunities":["opp1","opp2"],"recommendedTools":["tool1","tool2"],"cashFlowInsight":"one key insight","nextStep":"immediate action"}`,

    "hiring-screener": `You are a hiring automation expert. Return ONLY valid JSON:
${base}
{"rolesPriority":["role1","role2"],"screeningCriteria":["crit1","crit2"],"automationOpportunities":["opp1","opp2"],"interviewWorkflow":"recommended flow","toolRecommendation":"best ATS tool"}`,

    "support-resolver": `You are a support automation expert. Return ONLY valid JSON:
${base}
{"topSupportCategories":["cat1","cat2"],"automationOpportunities":["opp1","opp2"],"escalationRules":["rule1","rule2"],"kbTopics":["topic1","topic2"],"recommendation":"one action"}`,

    "security-watcher": `You are a cybersecurity analyst. Return ONLY valid JSON:
${base}
{"topRisks":["risk1","risk2"],"complianceGaps":["gap1","gap2"],"monitoringPriorities":["p1","p2"],"quickFixes":["fix1","fix2"],"recommendation":"highest-priority action"}`,

    "revenue-analyst": `You are a revenue analyst. Return ONLY valid JSON:
${base}
{"revenueStreams":["stream1","stream2"],"growthLevers":["lever1","lever2"],"pricingInsight":"one pricing insight","retentionStrategies":["s1","s2"],"forecastSignal":"key metric to track"}`,

    "sales-prospector": `You are a sales intelligence expert. Return ONLY valid JSON:
${base}
{"idealCustomerProfile":"description","prospectingChannels":["ch1","ch2"],"qualificationCriteria":["c1","c2"],"outreachAngle":"compelling pitch angle","leadSources":["src1","src2"]}`,

    "email-outreach": `You are an email strategy expert. Return ONLY valid JSON:
${base}
{"sequenceSteps":[{"day":1,"subject":"...","hook":"..."}],"abTestIdeas":["idea1","idea2"],"bestSendTimes":["time1","time2"],"personalizationAngles":["angle1","angle2"],"expectedOpenRate":"estimate"}`,
  };

  return prompts[agentKey] ?? `You are an AI business agent. Return ONLY valid JSON:
${base}
{"summary":"what you analyzed","insights":["insight1","insight2"],"recommendations":["rec1","rec2"],"nextSteps":["step1","step2"]}`;
}

// ─── Built-in: agent_task ─────────────────────────────────────────────────────
// Full agent execution lifecycle:
//   pending → running → AI generation → outcome persisted → completed
// All DB/notification operations are best-effort and never fail the job.

registerHandler("agent_task", async ({ execution, log, signal }) => {
  log("agent_task: starting");

  const taskId    = payloadField<string>(execution, "taskId");
  const agentKey  = payloadField<string>(execution, "agentKey");
  const agentId   = payloadField<string>(execution, "agentId");
  const projectId = payloadField<string>(execution, "projectId");

  if (!taskId) {
    log("agent_task: no taskId in payload — treating as no-op", "warn");
    return { message: "no taskId provided" };
  }

  if (signal.aborted) throw new Error("Aborted before processing");

  // ── 1. Mark agent task as running ──────────────────────────────────────────
  await db.update(agentTasksTable)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(agentTasksTable.id, taskId))
    .catch(() => {});

  log(`agent_task: running task ${taskId} (agent: ${agentKey ?? "unknown"})`);

  // ── 2. Load project context for AI prompt ──────────────────────────────────
  let businessIdea = "your business";
  let biOutput: Record<string, unknown> | null = null;
  if (projectId) {
    try {
      const [project] = await db.select({
        businessIdea: projectsTable.businessIdea,
        output: projectsTable.output,
      }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      if (project) {
        businessIdea = project.businessIdea?.slice(0, 70) ?? businessIdea;
        biOutput = project.output as Record<string, unknown> | null;
      }
    } catch { /* non-fatal */ }
  }

  // ── 3. AI generation ───────────────────────────────────────────────────────
  // Optional: skipped if NVIDIA_API_KEY is absent; job still succeeds.
  let outcome: Record<string, unknown> = {
    agentKey:    agentKey   ?? null,
    taskId,
    processed:   true,
    generatedAt: new Date().toISOString(),
  };

  if (process.env.NVIDIA_API_KEY && agentKey) {
    try {
      if (signal.aborted) throw new Error("Aborted before AI call");

      const prompt = buildAgentPrompt(agentKey, businessIdea, biOutput);

      // Give the AI call its own 60-second budget separate from the job abort signal.
      const aiController = new AbortController();
      const aiTimeout = setTimeout(() => aiController.abort(), 60_000);
      signal.addEventListener("abort", () => aiController.abort(), { once: true });

      let raw = "";
      try {
        raw = await callNvidia({
          model:       MODELS.AGENT_PLANNING,
          messages:    [{ role: "user" as const, content: prompt }],
          temperature: 0.6,
          maxTokens:   800,
          signal:      aiController.signal,
        });
      } finally {
        clearTimeout(aiTimeout);
      }

      try {
        const parsed = extractJson(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          outcome = { ...outcome, ...(parsed as Record<string, unknown>) };
        } else {
          outcome.summary = raw.slice(0, 600);
        }
      } catch {
        outcome.summary = raw.slice(0, 600);
      }

      log("agent_task: AI generation complete");
    } catch (aiErr) {
      // Non-fatal — job still completes; just without AI output
      log(`agent_task: AI skipped — ${aiErr instanceof Error ? aiErr.message : String(aiErr)}`, "warn");
    }
  }

  if (signal.aborted) throw new Error("Aborted after AI generation");

  // ── 4. Persist outcome to agent_tasks ─────────────────────────────────────
  await db.update(agentTasksTable)
    .set({ status: "completed", outcome, completedAt: new Date() })
    .where(eq(agentTasksTable.id, taskId))
    .catch(() => {});

  // ── 5. Persist to agent_memory ────────────────────────────────────────────
  if (agentKey) {
    const memKey = `${agentKey}_${new Date().toISOString().slice(0, 10)}`;
    await db.insert(agentMemoryTable).values({
      userId:     execution.userId,
      agentKey,
      memoryType: "output",
      key:        memKey,
      value:      JSON.stringify(outcome).slice(0, 2000),
      importance: 6,
      metadata:   { taskId, projectId: projectId ?? null, executionId: execution.id },
    }).onConflictDoNothing().catch(() => {});
  }

  // ── 6. Increment agent tasksCompleted counter ──────────────────────────────
  if (agentId) {
    await db.update(agentsTable)
      .set({ tasksCompleted: sql`tasks_completed + 1` })
      .where(eq(agentsTable.id, agentId))
      .catch(() => {});
  }

  // ── 7. Agent-specific completion notification ──────────────────────────────
  const COMPLETION_MESSAGES: Record<string, (b: string) => string> = {
    "market-researcher": (b) => `Research Agent finished industry scan for "${b}".`,
    "knowledge-curator": (b) => `Research Agent completed knowledge curation for "${b}".`,
    "content-generator": (b) => `Marketing Agent generated campaign recommendations for "${b}".`,
    "social-listener":   (b) => `Marketing Agent completed social media analysis for "${b}".`,
    "ops-automator":     (b) => `Operations Agent completed workflow analysis for "${b}".`,
    "invoice-collector": (b) => `Operations Agent completed billing workflow plan for "${b}".`,
    "hiring-screener":   (b) => `Operations Agent completed hiring pipeline plan for "${b}".`,
    "support-resolver":  (b) => `Operations Agent completed support workflow setup for "${b}".`,
    "security-watcher":  (b) => `Operations Agent completed security review for "${b}".`,
    "revenue-analyst":   (b) => `Growth Agent completed revenue analysis for "${b}".`,
    "sales-prospector":  (b) => `Growth Agent completed market opportunity analysis for "${b}".`,
    "email-outreach":    (b) => `Growth Agent generated email campaign strategy for "${b}".`,
  };

  const msgFn = agentKey ? COMPLETION_MESSAGES[agentKey] : null;
  const notifMessage = msgFn
    ? msgFn(businessIdea)
    : `Agent task "${taskId}" completed successfully.`;

  await emitNotification(
    execution.userId,
    "agent.execution.completed",
    "Agent Task Completed",
    notifMessage,
    "success",
    { taskId, agentKey: agentKey ?? null, executionId: execution.id },
  ).catch(() => {});

  logger.info(
    { executionId: execution.id, taskId, agentKey, agentType: agentKey ?? "unknown" },
    "AGENT_EXECUTION_COMPLETED",
  );

  log("agent_task: complete");
  return { taskId, agentKey: agentKey ?? null, outcome, processed: true };
});

// ─── Built-in: automation_run ─────────────────────────────────────────────────
// Runs an automation workflow. Expects optional payload.workflowId.
// Phase 1: infrastructure stub.

registerHandler("automation_run", async ({ execution, log, signal }) => {
  log("automation_run: initializing");
  const workflowId = payloadField<string>(execution, "workflowId");
  const stepCount = payloadField<number>(execution, "stepCount") ?? 0;

  if (signal.aborted) throw new Error("Aborted before processing");

  log(`automation_run: executing${workflowId ? ` workflow ${workflowId}` : ""}`);

  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, 300);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("Aborted")); }, { once: true });
  });

  log("automation_run: complete");
  return { workflowId: workflowId ?? null, stepsCompleted: stepCount };
});

// ─── Built-in: workspace_task ─────────────────────────────────────────────────
// Processes a workspace task. Expects optional payload.workspaceTaskId.
// Phase 1: infrastructure stub.

registerHandler("workspace_task", async ({ execution, log, signal }) => {
  log("workspace_task: starting");
  const workspaceTaskId = payloadField<string>(execution, "workspaceTaskId");

  if (signal.aborted) throw new Error("Aborted before processing");

  log(`workspace_task: processing${workspaceTaskId ? ` task ${workspaceTaskId}` : ""}`);

  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, 250);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("Aborted")); }, { once: true });
  });

  log("workspace_task: done");
  return { workspaceTaskId: workspaceTaskId ?? null, processed: true };
});

// ─── Built-in: scheduled_task ─────────────────────────────────────────────────
// Runs a scheduled / cron-style task.
// Phase 1: infrastructure stub.

registerHandler("scheduled_task", async ({ execution, log, signal }) => {
  log("scheduled_task: executing");
  const taskName = payloadField<string>(execution, "taskName");

  if (signal.aborted) throw new Error("Aborted before processing");

  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, 150);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("Aborted")); }, { once: true });
  });

  log("scheduled_task: complete");
  return { taskName: taskName ?? null, executedAt: new Date().toISOString() };
});
