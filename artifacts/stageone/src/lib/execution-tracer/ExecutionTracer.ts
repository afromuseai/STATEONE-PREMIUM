/**
 * STAGEONE Execution Tracer
 *
 * Instruments the full Marcus generation pipeline without touching routing,
 * controllers, bridges, or generation logic. Add trace calls at the seven
 * observable boundary points; the tracer prints a complete stage-by-stage
 * report after every execution.
 *
 * Usage (read-only side):
 *   import { tracer } from '@/lib/execution-tracer'
 *
 *   // In copilot-panel, before bus.execute():
 *   const traceId = tracer.startExecution("website")
 *   tracer.logStage(traceId, 1, "Intent parsed", { functionName: "handleWorkspaceCmdAction", success: true })
 *
 *   // In a generator page, inside the generation function:
 *   const traceId = tracer.getActiveExecutionId("website")   // null if not Marcus-triggered
 *   if (traceId) tracer.logStage(traceId, 6, "Page generate invoked", { functionName: "generateWithIdea", success: true })
 *
 * Module IDs must match the ExecutionModuleId values used by the bus:
 *   "chatbot" | "website" | "intelligence" | "automation" | "orchestrator"
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TraceStageEntry {
  stage: number;
  name: string;
  timestamp: number;
  isoTime: string;
  module: string;
  executionId: string;
  functionName: string;
  success?: boolean;
  reason?: string;
  data?: Record<string, unknown>;
}

interface ExecutionTrace {
  executionId: string;
  module: string;
  startTime: number;
  stages: TraceStageEntry[];
  complete: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortId(): string {
  // 8 hex chars — readable in logs, collision-safe for a session
  return Math.random().toString(16).slice(2, 10);
}

function elapsed(start: number, now: number): string {
  return `+${now - start}ms`;
}

// ── ExecutionTracer ───────────────────────────────────────────────────────────

class ExecutionTracer {
  /** All traces, keyed by traceId. Kept in memory for the session. */
  private readonly traces = new Map<string, ExecutionTrace>();

  /**
   * Most-recent active traceId per module.
   * Cleared when endExecution() is called.
   */
  private readonly activeByModule = new Map<string, string>();

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Begin a new execution trace for a module. Returns the traceId that must be
   * threaded through every subsequent logStage() call. Call this in copilot-panel
   * before bus.execute(), then pass the traceId in the command payload as `_traceId`.
   */
  startExecution(module: string): string {
    const traceId = shortId();
    this.traces.set(traceId, {
      executionId: traceId,
      module,
      startTime: Date.now(),
      stages: [],
      complete: false,
    });
    this.activeByModule.set(module, traceId);
    console.log(`[Tracer] ▶ START | id=${traceId} | module=${module}`);
    return traceId;
  }

  /**
   * Return the traceId for the most recent active execution of a module, or null
   * if no Marcus-triggered execution is in progress. Use this in generator pages:
   *
   *   const traceId = tracer.getActiveExecutionId("website")
   *   if (traceId) tracer.logStage(traceId, 6, ...)
   */
  getActiveExecutionId(module: string): string | null {
    return this.activeByModule.get(module) ?? null;
  }

  /**
   * Log a pipeline stage. All fields are required except `success`, `reason`, and `data`.
   *
   * @param traceId     - From startExecution() or getActiveExecutionId()
   * @param stage       - Stage number (1–12)
   * @param name        - Human-readable stage name
   * @param opts.functionName - The function/method where this is called
   * @param opts.success      - true = ✓, false = ✗, undefined = in-progress
   * @param opts.reason       - Why it failed (only on failure)
   * @param opts.data         - Extra key-value context (HTTP status, payload keys, etc.)
   */
  logStage(
    traceId: string,
    stage: number,
    name: string,
    opts: {
      functionName: string;
      success?: boolean;
      reason?: string;
      data?: Record<string, unknown>;
    },
  ): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const now = Date.now();
    const entry: TraceStageEntry = {
      stage,
      name,
      timestamp: now,
      isoTime: new Date(now).toISOString(),
      module: trace.module,
      executionId: traceId,
      functionName: opts.functionName,
      success: opts.success,
      reason: opts.reason,
      data: opts.data,
    };
    trace.stages.push(entry);

    const tick = elapsed(trace.startTime, now);
    const icon = opts.success === false ? '✗' : opts.success === true ? '✓' : '…';
    console.log(
      `[Tracer] Stage ${stage} ${icon} | ${name} | fn=${opts.functionName} | id=${traceId} | ${tick}` +
      (opts.reason ? ` | ${opts.reason}` : ''),
    );
  }

  /**
   * Mark an execution complete and print the full trace.
   * Call this once per execution — at the completion callback on success,
   * or in the catch/finally block on failure.
   */
  endExecution(traceId: string, success: boolean, reason?: string): void {
    const trace = this.traces.get(traceId);
    if (!trace || trace.complete) return;

    trace.complete = true;
    this.activeByModule.delete(trace.module);

    const icon = success ? '✓' : '✗';
    console.log(`[Tracer] ${icon} END | id=${traceId} | module=${trace.module}` + (reason ? ` | ${reason}` : ''));

    this.printTrace(traceId);
  }

  /**
   * Print the complete formatted trace for an execution to the browser console.
   * Called automatically by endExecution(); also callable manually for debugging.
   */
  printTrace(traceId: string): void {
    const trace = this.traces.get(traceId);
    if (!trace) {
      console.warn(`[Tracer] printTrace: no trace found for id=${traceId}`);
      return;
    }

    const lines: string[] = [];
    lines.push('');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('  EXECUTION TRACE');
    lines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push(`  Execution ID : ${trace.executionId}`);
    lines.push(`  Module       : ${trace.module}`);
    lines.push(`  Started      : ${new Date(trace.startTime).toISOString()}`);
    lines.push(`  Stages       : ${trace.stages.length}`);
    lines.push('');

    for (const s of trace.stages) {
      const tick  = elapsed(trace.startTime, s.timestamp);
      const icon  = s.success === false ? '✗' : s.success === true ? '✓' : '';
      const label = icon ? ` ${icon}` : '';

      lines.push(`  ──────────────────────────────────────────────────`);
      lines.push(`  Stage ${s.stage}   ${s.name}${label}`);
      lines.push(`    fn        : ${s.functionName}`);
      lines.push(`    time      : ${s.isoTime} (${tick})`);
      if (s.reason)  lines.push(`    reason    : ${s.reason}`);
      if (s.data) {
        for (const [k, v] of Object.entries(s.data)) {
          const val = typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v ?? '');
          lines.push(`    ${k.padEnd(10)}: ${val}`);
        }
      }
    }

    lines.push('  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    lines.push('');

    console.log(lines.join('\n'));
  }
}

// ── Singleton export ───────────────────────────────────────────────────────────

export const tracer = new ExecutionTracer();
export { ExecutionTracer };
