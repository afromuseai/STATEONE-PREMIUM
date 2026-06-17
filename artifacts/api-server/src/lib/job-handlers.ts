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

import type { Execution } from "@workspace/db";
import { logger } from "./logger";

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

// ─── Built-in: agent_task ─────────────────────────────────────────────────────
// Processes an agent task. Expects payload.taskId.
// Phase 1: infrastructure stub — future phases will invoke AI models.

registerHandler("agent_task", async ({ execution, log, signal }) => {
  log("agent_task: starting");
  const taskId = payloadField<string>(execution, "taskId");
  const agentKey = payloadField<string>(execution, "agentKey");

  if (!taskId) {
    log("agent_task: no taskId in payload — treating as no-op", "warn");
    return { message: "no taskId provided" };
  }

  if (signal.aborted) throw new Error("Aborted before processing");

  log(`agent_task: processing task ${taskId}${agentKey ? ` (agent: ${agentKey})` : ""}`);

  await new Promise<void>((res, rej) => {
    const t = setTimeout(res, 500);
    signal.addEventListener("abort", () => { clearTimeout(t); rej(new Error("Aborted")); }, { once: true });
  });

  log("agent_task: complete");
  return { taskId, agentKey: agentKey ?? null, processed: true };
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
