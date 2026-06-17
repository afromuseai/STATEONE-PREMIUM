// ─── STAGEONE ExecutionWorker ─────────────────────────────────────────────────
//
// Central background job processor. Polls the executions table on a fixed
// interval, locks queued jobs with a CAS-style atomic UPDATE, dispatches them
// to the registered handler, and persists the final state.
//
// Lifecycle:
//   queued → running → completed | failed (retries re-queue with incremented retryCount)
//
// Concurrency model:
//   Single-process Node.js. MAX_CONCURRENT limits how many jobs run in parallel
//   within the process. The atomic WHERE status='queued' UPDATE ensures safety
//   even if multiple processes are deployed in future.

import { db, executionsTable } from "@workspace/db";
import { eq, and, or, isNull, lte, asc } from "drizzle-orm";
import type { Execution } from "@workspace/db";
import { logger } from "./logger";
import { getHandler, type JobContext, type LogEntry } from "./job-handlers";
import { emitNotification } from "../routes/notifications";

// ─── Config ───────────────────────────────────────────────────────────────────

const POLL_INTERVAL_MS = 7_000;   // poll every 7 seconds
const BATCH_SIZE       = 5;       // max jobs fetched per tick
const MAX_CONCURRENT   = 3;       // max jobs running at once in this process
const JOB_TIMEOUT_MS   = 5 * 60 * 1000; // 5 min per job before abort

// ─── Worker ───────────────────────────────────────────────────────────────────

class ExecutionWorker {
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeJobs = new Set<string>();
  private totalProcessed = 0;
  private totalFailed    = 0;
  private startedAt: Date | null = null;

  // ── Public API ──────────────────────────────────────────────────────────────

  start(): void {
    if (this.timer) return;
    this.startedAt = new Date();
    logger.info(
      { pollIntervalMs: POLL_INTERVAL_MS, maxConcurrent: MAX_CONCURRENT, batchSize: BATCH_SIZE },
      "WORKER_STARTED",
    );
    // Run immediately on start, then on interval
    this.tick().catch(err => logger.error({ err }, "WORKER_TICK_ERROR"));
    this.timer = setInterval(() => {
      this.tick().catch(err => logger.error({ err }, "WORKER_TICK_ERROR"));
    }, POLL_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = null;
    logger.info({ totalProcessed: this.totalProcessed, totalFailed: this.totalFailed }, "WORKER_STOPPED");
  }

  status() {
    return {
      running:        this.timer !== null,
      startedAt:      this.startedAt,
      activeJobs:     [...this.activeJobs],
      activeCount:    this.activeJobs.size,
      maxConcurrent:  MAX_CONCURRENT,
      pollIntervalMs: POLL_INTERVAL_MS,
      totalProcessed: this.totalProcessed,
      totalFailed:    this.totalFailed,
    };
  }

  // ── Tick ────────────────────────────────────────────────────────────────────

  private async tick(): Promise<void> {
    if (this.activeJobs.size >= MAX_CONCURRENT) return;

    const slots = MAX_CONCURRENT - this.activeJobs.size;
    const now   = new Date();

    let queued: Execution[];
    try {
      queued = await db
        .select()
        .from(executionsTable)
        .where(
          and(
            eq(executionsTable.status, "queued"),
            or(isNull(executionsTable.scheduledAt), lte(executionsTable.scheduledAt, now)),
          ),
        )
        .orderBy(asc(executionsTable.priority), asc(executionsTable.createdAt))
        .limit(slots);
    } catch (err) {
      logger.error({ err }, "WORKER_POLL_ERROR");
      return;
    }

    for (const job of queued) {
      if (this.activeJobs.has(job.id)) continue;
      if (this.activeJobs.size >= MAX_CONCURRENT) break;

      // Atomic lock: only succeeds if nobody else already grabbed the job
      let locked: Execution | undefined;
      try {
        const rows = await db
          .update(executionsTable)
          .set({ status: "running", startedAt: new Date() })
          .where(and(eq(executionsTable.id, job.id), eq(executionsTable.status, "queued")))
          .returning();
        locked = rows[0];
      } catch (err) {
        logger.error({ err, jobId: job.id }, "WORKER_LOCK_ERROR");
        continue;
      }

      if (!locked) continue; // another process grabbed it

      logger.info(
        { jobId: locked.id, jobType: locked.type, name: locked.name, retryCount: locked.retryCount },
        "JOB_RUNNING",
      );

      this.activeJobs.add(locked.id);
      this.processJob(locked).finally(() => this.activeJobs.delete(locked.id));
    }
  }

  // ── Process one job ─────────────────────────────────────────────────────────

  private async processJob(execution: Execution): Promise<void> {
    const startMs   = Date.now();
    const logs: LogEntry[] = [];
    const controller = new AbortController();
    const abortTimer = setTimeout(() => {
      controller.abort();
      logger.warn({ jobId: execution.id, jobType: execution.type }, "JOB_TIMEOUT_ABORT");
    }, JOB_TIMEOUT_MS);

    // Structured per-job logger that appends to the logs array AND emits a pino line
    const log = (message: string, level: "info" | "warn" | "error" = "info") => {
      logs.push({ timestamp: new Date().toISOString(), level, message });
      logger[level]({ jobId: execution.id, jobType: execution.type }, `JOB_LOG ${message}`);
    };

    // Resolve handler: payload.jobType overrides the broad type field
    const payloadJobType =
      execution.payload && typeof execution.payload === "object"
        ? (execution.payload as Record<string, unknown>).jobType as string | undefined
        : undefined;
    const handlerKey = payloadJobType ?? execution.type;
    const handler    = getHandler(handlerKey);

    try {
      if (!handler) {
        throw new Error(`No handler registered for job type "${handlerKey}"`);
      }

      const ctx: JobContext = { execution, log, signal: controller.signal };
      const result          = await handler(ctx);
      const durationMs      = Date.now() - startMs;

      await db
        .update(executionsTable)
        .set({ status: "success", result, logs, durationMs, completedAt: new Date() })
        .where(eq(executionsTable.id, execution.id));

      this.totalProcessed++;
      logger.info({ jobId: execution.id, jobType: execution.type, durationMs }, "JOB_COMPLETED");

      emitNotification(
        execution.userId,
        "execution.success",
        "Job Completed",
        `"${execution.name}" completed in ${(durationMs / 1000).toFixed(1)}s.`,
        "success",
        { executionId: execution.id, type: execution.type },
      ).catch(() => {});

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const durationMs   = Date.now() - startMs;
      log(`Job failed: ${errorMessage}`, "error");

      const willRetry = execution.retryCount < execution.maxRetries;

      if (willRetry) {
        await db
          .update(executionsTable)
          .set({
            status:      "queued",
            retryCount:  execution.retryCount + 1,
            errorMessage,
            logs,
            startedAt:   null,
          })
          .where(eq(executionsTable.id, execution.id));

        logger.warn(
          { jobId: execution.id, jobType: execution.type, attempt: execution.retryCount + 1, maxRetries: execution.maxRetries },
          "JOB_RETRY",
        );
      } else {
        await db
          .update(executionsTable)
          .set({ status: "failed", errorMessage, logs, durationMs, completedAt: new Date() })
          .where(eq(executionsTable.id, execution.id));

        this.totalFailed++;
        logger.error({ jobId: execution.id, jobType: execution.type, durationMs }, "JOB_FAILED");

        emitNotification(
          execution.userId,
          "execution.failed",
          "Job Failed",
          `"${execution.name}" failed after ${execution.retryCount + 1} attempt(s): ${errorMessage}`,
          "error",
          { executionId: execution.id, type: execution.type },
        ).catch(() => {});
      }
    } finally {
      clearTimeout(abortTimer);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const worker = new ExecutionWorker();

// ─── Queue helper ─────────────────────────────────────────────────────────────
// Convenience function for other parts of the codebase to enqueue a job without
// importing DB directly. Logs JOB_QUEUED and returns the persisted execution.

export async function enqueueJob(opts: {
  userId: string;
  name: string;
  /** Broad category (workflow | agent | automation | scheduled | event). */
  type: string;
  /** Optionally set payload.jobType to override handler resolution. */
  payload?: Record<string, unknown>;
  priority?: number;
  scheduledAt?: Date | null;
  maxRetries?: number;
}): Promise<Execution> {
  const rows = await db
    .insert(executionsTable)
    .values({
      userId:     opts.userId,
      name:       opts.name,
      type:       opts.type,
      payload:    opts.payload ?? {},
      priority:   opts.priority    ?? 3,
      scheduledAt: opts.scheduledAt ?? null,
      maxRetries: opts.maxRetries  ?? 3,
      status:     "queued",
      logs:       [],
    })
    .returning();

  const execution = rows[0]!;
  logger.info(
    { jobId: execution.id, jobType: execution.type, name: execution.name, priority: execution.priority },
    "JOB_QUEUED",
  );
  return execution;
}
