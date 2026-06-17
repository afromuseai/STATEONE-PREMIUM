// ─── STAGEONE Agent Runtime ───────────────────────────────────────────────────
//
// Central service for turning an installed, active agent into real executing
// work. Consumers call runAgent(); the agent_task handler in job-handlers.ts
// does the actual AI invocation and persistence inside the worker.
//
// Circular-dependency note: this file imports enqueueJob from ./worker.
// job-handlers.ts must NOT import from this file to avoid a cycle.
// job-handlers ← worker ← index      (safe direction)
// agent-runtime → worker              (also safe — different leaf)

import { db, agentTasksTable, agentsTable, projectsTable } from "@workspace/db";
import type { AgentTask, Agent, Execution } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { enqueueJob } from "./worker";
import { logger } from "./logger";

// ─── Agent definitions ────────────────────────────────────────────────────────
// Maps catalog agentKey → runtime metadata (category, task templates, memory key).
// Covers all 12 catalog agents across Research, Marketing, Operations, Growth.

export type AgentDefinition = {
  category: string;
  /** Broad 4-group classification used in the spec */
  runtimeGroup: "research" | "marketing" | "operations" | "growth";
  taskTitleFn: (businessIdea: string) => string;
  /** In-app notification copy shown when the job completes */
  completionMessage: (businessIdea: string) => string;
  /** Key used when writing to agent_memory */
  memoryKey: string;
};

export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  "market-researcher": {
    category: "Research",
    runtimeGroup: "research",
    taskTitleFn: (b) => `Industry & competitor analysis: ${b}`,
    completionMessage: (b) => `Research Agent finished industry scan for "${b}".`,
    memoryKey: "market_research_output",
  },
  "knowledge-curator": {
    category: "Research",
    runtimeGroup: "research",
    taskTitleFn: (b) => `Knowledge base curation: ${b}`,
    completionMessage: (b) => `Research Agent completed knowledge curation for "${b}".`,
    memoryKey: "knowledge_curation_output",
  },
  "content-generator": {
    category: "Marketing",
    runtimeGroup: "marketing",
    taskTitleFn: (b) => `Content strategy & campaign planning: ${b}`,
    completionMessage: (b) => `Marketing Agent generated campaign recommendations for "${b}".`,
    memoryKey: "content_strategy_output",
  },
  "social-listener": {
    category: "Marketing",
    runtimeGroup: "marketing",
    taskTitleFn: (b) => `Social media & brand monitoring: ${b}`,
    completionMessage: (b) => `Marketing Agent completed social media analysis for "${b}".`,
    memoryKey: "social_intelligence_output",
  },
  "ops-automator": {
    category: "Operations",
    runtimeGroup: "operations",
    taskTitleFn: (b) => `Operations workflow optimization: ${b}`,
    completionMessage: (b) => `Operations Agent completed workflow analysis for "${b}".`,
    memoryKey: "ops_automation_output",
  },
  "invoice-collector": {
    category: "Operations",
    runtimeGroup: "operations",
    taskTitleFn: (b) => `Invoice & billing automation plan: ${b}`,
    completionMessage: (b) => `Operations Agent completed billing workflow plan for "${b}".`,
    memoryKey: "billing_automation_output",
  },
  "hiring-screener": {
    category: "Operations",
    runtimeGroup: "operations",
    taskTitleFn: (b) => `Hiring pipeline automation: ${b}`,
    completionMessage: (b) => `Operations Agent completed hiring pipeline plan for "${b}".`,
    memoryKey: "hiring_pipeline_output",
  },
  "support-resolver": {
    category: "Support",
    runtimeGroup: "operations",
    taskTitleFn: (b) => `Support workflow & escalation setup: ${b}`,
    completionMessage: (b) => `Operations Agent completed support workflow setup for "${b}".`,
    memoryKey: "support_workflow_output",
  },
  "security-watcher": {
    category: "Cybersecurity",
    runtimeGroup: "operations",
    taskTitleFn: (b) => `Security posture & vulnerability review: ${b}`,
    completionMessage: (b) => `Operations Agent completed security review for "${b}".`,
    memoryKey: "security_review_output",
  },
  "revenue-analyst": {
    category: "Analytics",
    runtimeGroup: "growth",
    taskTitleFn: (b) => `Revenue analysis & growth opportunities: ${b}`,
    completionMessage: (b) => `Growth Agent completed revenue analysis for "${b}".`,
    memoryKey: "revenue_analysis_output",
  },
  "sales-prospector": {
    category: "Sales",
    runtimeGroup: "growth",
    taskTitleFn: (b) => `Lead enrichment & prospect scoring: ${b}`,
    completionMessage: (b) => `Growth Agent completed market opportunity analysis for "${b}".`,
    memoryKey: "sales_intelligence_output",
  },
  "email-outreach": {
    category: "Sales",
    runtimeGroup: "growth",
    taskTitleFn: (b) => `Email outreach sequence design: ${b}`,
    completionMessage: (b) => `Growth Agent generated email campaign strategy for "${b}".`,
    memoryKey: "email_outreach_output",
  },
};

// ─── Name → agentKey lookup ───────────────────────────────────────────────────
// Used by Marcus to map natural language ("Research Agent") to an agentKey.

export const AGENT_NAME_TO_KEY: Record<string, string> = {
  "research agent":    "market-researcher",
  "marketing agent":  "content-generator",
  "operations agent": "ops-automator",
  "ops agent":        "ops-automator",
  "growth agent":     "revenue-analyst",
  "sales agent":      "sales-prospector",
  "content agent":    "content-generator",
  "social agent":     "social-listener",
  "security agent":   "security-watcher",
  "support agent":    "support-resolver",
};

// ─── discoverActiveAgents ─────────────────────────────────────────────────────
// Returns all installed + active agents for a user. Used by Marcus to present
// what's available before triggering work.

export async function discoverActiveAgents(userId: string): Promise<Agent[]> {
  return db.select().from(agentsTable)
    .where(and(eq(agentsTable.userId, userId), eq(agentsTable.isActive, true)));
}

// ─── runAgent ─────────────────────────────────────────────────────────────────
// Creates an agent_task record and enqueues it through the existing worker
// infrastructure. Returns immediately — the worker processes asynchronously.
//
// Callers: POST /agents/:id/run, Marcus copilot intent detection.

export async function runAgent(opts: {
  userId: string;
  /** UUID from agentsTable (optional — enriches the task record and outcome) */
  agentId?: string | null;
  /** Catalog key, e.g. "market-researcher" */
  agentKey: string;
  projectId?: string | null;
  /** Custom task title override */
  title?: string;
}): Promise<{ task: AgentTask; execution: Execution }> {
  const { userId, agentId, agentKey, projectId } = opts;
  const def = AGENT_DEFINITIONS[agentKey];

  logger.info({ agentKey, userId, projectId: projectId ?? null }, "AGENT_RUNTIME_STARTED");

  // Resolve business idea for meaningful task titles + AI context
  let businessIdea = "your business";
  if (projectId) {
    try {
      const [p] = await db.select({ businessIdea: projectsTable.businessIdea })
        .from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
      if (p?.businessIdea) businessIdea = p.businessIdea.slice(0, 70);
    } catch { /* non-fatal — continue with default */ }
  }

  const taskTitle = opts.title ?? def?.taskTitleFn(businessIdea) ?? `${agentKey} task`;

  const [task] = await db.insert(agentTasksTable).values({
    userId,
    agentId:  agentId  ?? undefined,
    agentKey,
    title:    taskTitle,
    category: def?.category ?? "general",
    priority: 2,
    status:   "pending",
  }).returning();

  logger.info({ taskId: task.id, agentKey, userId, projectId: projectId ?? null }, "AGENT_TASK_CREATED");

  const execution = await enqueueJob({
    userId,
    name:    taskTitle,
    type:    "agent",
    payload: {
      jobType:   "agent_task",
      taskId:    task.id,
      agentId:   agentId   ?? null,
      agentKey,
      projectId: projectId ?? null,
      userId,
    },
    priority: 2,
  });

  logger.info(
    { executionId: execution.id, taskId: task.id, agentKey, userId },
    "AGENT_EXECUTION_CREATED",
  );

  return { task, execution };
}
