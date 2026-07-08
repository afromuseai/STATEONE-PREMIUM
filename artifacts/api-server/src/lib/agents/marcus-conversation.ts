// ─── Marcus Conversation Engine ───────────────────────────────────────────────
//
// Phase 1 — Commit 3: Conversation + File Activity Event System
//
// Translates controller lifecycle signals into rich, user-facing ConversationEvents.
// This layer is:
//   • 100 % deterministic — no LLM calls, no async I/O
//   • Agent-independent — no direct dependency on Website Studio runtime
//   • Reusable — designed to be the shared event backbone for every future
//     autonomous agent: Automation Studio, Chatbot Studio, Agent Builder, etc.
//
// What this file does:
//   1. Defines a self-contained ConversationEvent type hierarchy (superset of
//      AgentEvent from types.ts, intentionally kept separate to stay reusable).
//   2. Provides per-phase conversation template banks with randomised selection
//      so repeated generations feel natural rather than scripted.
//   3. Implements MarcusConversationEngine — a pure class with emit helpers
//      keyed to every lifecycle event the controller can produce.
//
// What this file does NOT do:
//   • Call any LLM
//   • Fabricate completed operations
//   • Modify generate-website-v2.ts, SSE routes, or MarcusController
//   • Touch any frontend file
//
// Connection point: call `engine.collect()` after a generation run to drain all
// accumulated events for SSE forwarding, persistence, or replay.

import crypto from "crypto";

// ─── Phase identifier ─────────────────────────────────────────────────────────
// Mirrors MarcusAgentPhase from marcus-website-agent.ts.
// Redefined here so this module has no hard dependency on the website agent,
// ensuring portability to other studio modules.

export type MarcusPhase =
  | "UNDERSTAND"
  | "PLAN"
  | "DESIGN"
  | "BUILD"
  | "TEST"
  | "IMPROVE"
  | "REPORT";

// ─── Event types ──────────────────────────────────────────────────────────────
//
// Superset of AgentEventType from types.ts.
//
//   message  — a general human-readable update from the agent
//   action   — a discrete unit of work being performed
//   step     — a sub-step within a phase (more granular than action)
//   file     — a filesystem activity event (see FileActivityEvent)
//   warning  — a non-fatal issue the user should be aware of
//   error    — a failure; should always be accompanied by context
//   complete — a phase or the entire task has finished
//   progress — a phase lifecycle status change (waiting/running/completed)

export type ConversationEventType =
  | "message"
  | "action"
  | "step"
  | "file"
  | "warning"
  | "error"
  | "complete"
  | "progress";

// ─── File operation types ─────────────────────────────────────────────────────
// Describes what the agent did to a file.
// Will later drive the frontend file-explorer highlights and diff viewer.

export type FileOperation =
  | "create"  // File is being written for the first time
  | "update"  // Existing file content is being changed
  | "delete"  // File is being removed
  | "rename"  // File path is changing
  | "read"    // File content is being inspected by the agent
  | "open";   // File is being opened for user review / preview

// ─── Phase status ─────────────────────────────────────────────────────────────
// Used by progress events to drive the sidebar phase timeline.

export type PhaseStatus =
  | "waiting"    // Phase queued but not yet started
  | "running"    // Phase is currently executing
  | "completed"  // Phase succeeded
  | "failed"     // Phase encountered an unrecoverable error
  | "skipped";   // Phase was bypassed due to a prior failure

// ─── Event metadata ───────────────────────────────────────────────────────────
// Additive bag — only include fields relevant to the event type.

export interface ConversationEventMetadata {
  // ── File activity ──────────────────────────────────────────────────────────
  /** Filesystem path involved in a "file" event. */
  path?:      string;
  /** What the agent did to the file. */
  operation?: FileOperation;

  // ── Progress / phase tracking ──────────────────────────────────────────────
  /** Current phase status for "progress" events. */
  status?: PhaseStatus;
  /** Duration of a completed phase in milliseconds. */
  duration?: number;

  // ── General context ────────────────────────────────────────────────────────
  /** Phase this event was produced in — always set by the engine helpers. */
  phase?: MarcusPhase;
  /** Free-form contextual detail, e.g. a file line count or error reason. */
  detail?: string;

  // Allow future extensions without breaking the contract.
  [key: string]: unknown;
}

// ─── ConversationEvent ────────────────────────────────────────────────────────
// The canonical event shape produced by this engine.
// Every event emitted by MarcusConversationEngine is this type.

export interface ConversationEvent {
  /** Collision-resistant unique ID for ordering, deduplication, and replay. */
  id: string;

  /** Semantic type — drives UI rendering and event routing. */
  type: ConversationEventType;

  /**
   * Which pipeline phase this event belongs to.
   * Null only for lifecycle events that span phases (e.g. "complete" for the
   * full task) or events emitted before the first phase starts.
   */
  phase: MarcusPhase | null;

  /** ISO 8601 timestamp — set at emission time. */
  timestamp: string;

  /** Human-readable message following Marcus communication contracts.
   *  Never contains raw JSON, prompt text, or model output. */
  message: string;

  /** Optional structured metadata for richer rendering or tooling. */
  metadata?: ConversationEventMetadata;
}

// ─── File activity event ──────────────────────────────────────────────────────
// Narrowed subtype of ConversationEvent for filesystem operations.
// `path` and `operation` are always present on these events.

export interface FileActivityEvent extends ConversationEvent {
  type: "file";
  metadata: ConversationEventMetadata & {
    path:      string;
    operation: FileOperation;
  };
}

// ─── Progress event ───────────────────────────────────────────────────────────
// Narrowed subtype for phase lifecycle updates.
// `status` is always present on these events.

export interface ProgressEvent extends ConversationEvent {
  type: "progress";
  phase: MarcusPhase;
  metadata: ConversationEventMetadata & {
    status: PhaseStatus;
  };
}

// ─── Template bank ────────────────────────────────────────────────────────────
//
// Per-phase collections of natural-language messages.
// The engine selects randomly from these banks so repeated generations feel
// conversational rather than scripted.
//
// Rule: every string must be a truthful description of what the agent is doing.
// Never add strings that describe work not yet confirmed to have happened.

const PHASE_START_TEMPLATES: Record<MarcusPhase, readonly string[]> = {
  UNDERSTAND: [
    "Learning about your business...",
    "Understanding your requirements...",
    "Analyzing your product idea...",
    "Reviewing your business objectives...",
    "Interpreting your vision...",
  ],
  PLAN: [
    "Planning project architecture...",
    "Organizing the implementation...",
    "Defining the application structure...",
    "Mapping out the build strategy...",
    "Outlining the technical approach...",
  ],
  DESIGN: [
    "Designing the user experience...",
    "Creating the visual hierarchy...",
    "Preparing the design system...",
    "Shaping the interface layout...",
    "Crafting the component blueprint...",
  ],
  BUILD: [
    "Building production-ready components...",
    "Generating application files...",
    "Implementing the project...",
    "Writing component code...",
    "Assembling the application...",
  ],
  TEST: [
    "Validating generated files...",
    "Checking project integrity...",
    "Running structural verification...",
    "Inspecting the output...",
    "Confirming all components are present...",
  ],
  IMPROVE: [
    "Applying improvements...",
    "Refining the implementation...",
    "Addressing identified issues...",
    "Polishing the project...",
    "Finalizing component details...",
  ],
  REPORT: [
    "Finalizing the project...",
    "Preparing Website Studio...",
    "Everything looks good.",
    "Wrapping up generation...",
    "Your website is ready.",
  ],
};

const PHASE_COMPLETE_TEMPLATES: Record<MarcusPhase, readonly string[]> = {
  UNDERSTAND: [
    "Business requirements understood.",
    "Requirements captured.",
    "Vision analysis complete.",
    "Business brief processed.",
  ],
  PLAN: [
    "Architecture defined.",
    "Implementation plan ready.",
    "Project structure mapped.",
    "Build strategy confirmed.",
  ],
  DESIGN: [
    "Design blueprint prepared.",
    "Visual hierarchy established.",
    "Component layout finalized.",
    "Design system ready.",
  ],
  BUILD: [
    "All files generated.",
    "Application components built.",
    "Code generation complete.",
    "Project files assembled.",
  ],
  TEST: [
    "Validation passed.",
    "Project integrity confirmed.",
    "All files verified.",
    "Structural check complete.",
  ],
  IMPROVE: [
    "Improvements applied.",
    "Refinements complete.",
    "Issues resolved.",
    "Project polished.",
  ],
  REPORT: [
    "Project ready for preview.",
    "Website Studio is ready.",
    "Generation complete.",
    "Your website is live in the studio.",
  ],
};

// File operation → human-readable verb
const FILE_OPERATION_LABELS: Record<FileOperation, string> = {
  create: "Creating",
  update: "Updating",
  delete: "Deleting",
  rename: "Renaming",
  read:   "Reading",
  open:   "Opening",
};

// ─── Internal factory ─────────────────────────────────────────────────────────

function makeEvent(
  type:      ConversationEventType,
  phase:     MarcusPhase | null,
  message:   string,
  metadata?: ConversationEventMetadata,
): ConversationEvent {
  return {
    id:        crypto.randomUUID(),
    type,
    phase,
    timestamp: new Date().toISOString(),
    message,
    metadata:  metadata ? { phase: phase ?? undefined, ...metadata } : { phase: phase ?? undefined },
  };
}

/** Uniform random integer in [0, len). */
function randIdx(len: number): number {
  return Math.floor(Math.random() * len);
}

/** Pick one entry at random from a readonly array. */
function pick<T>(arr: readonly T[]): T {
  return arr[randIdx(arr.length)];
}

// ─── MarcusConversationEngine ─────────────────────────────────────────────────
//
// Primary class. Instantiate once per controller run and call the emit helpers
// as lifecycle events occur. Call `collect()` at the end to drain all events.
//
// Design principles:
//   • Every method is synchronous and pure-ish (only randomness + time).
//   • No method initiates I/O, network calls, or LLM requests.
//   • Events accumulate internally; the caller decides when to forward them.
//   • The same instance can safely be shared across the full pipeline run.
//
// Usage:
//   const engine = new MarcusConversationEngine();
//   engine.emitPhaseStart("UNDERSTAND");
//   engine.emitMessage("UNDERSTAND", "Reviewing your idea in detail...");
//   engine.emitFileOperation("app/page.tsx", "read", "UNDERSTAND");
//   engine.emitPhaseComplete("UNDERSTAND", 1234);
//   const events = engine.collect(); // drain and return

export class MarcusConversationEngine {
  private _events: ConversationEvent[] = [];

  // ─── Core accumulator ─────────────────────────────────────────────────────

  private _emit(event: ConversationEvent): void {
    this._events.push(event);
  }

  // ─── Phase lifecycle helpers ───────────────────────────────────────────────

  /**
   * Emit a progress event marking a phase as RUNNING and a natural-language
   * "thinking" message selected from the phase's template bank.
   * Call this immediately when the controller begins executing a phase.
   */
  emitPhaseStart(phase: MarcusPhase): void {
    // Progress: status change to running
    this._emit(
      makeEvent("progress", phase, `${phase} started`, {
        status: "running",
      }) as ProgressEvent,
    );

    // Human-readable thought drawn from the template bank
    this._emit(
      makeEvent("message", phase, pick(PHASE_START_TEMPLATES[phase])),
    );
  }

  /**
   * Emit a progress event marking a phase as COMPLETED and a natural-language
   * confirmation message.
   * Call this immediately after the controller confirms phase success.
   *
   * @param durationMs Optional wall-clock duration of the phase for metadata.
   */
  emitPhaseComplete(phase: MarcusPhase, durationMs?: number): void {
    this._emit(
      makeEvent("progress", phase, `${phase} completed`, {
        status:   "completed",
        duration: durationMs,
      }) as ProgressEvent,
    );

    this._emit(
      makeEvent("complete", phase, pick(PHASE_COMPLETE_TEMPLATES[phase]), {
        duration: durationMs,
      }),
    );
  }

  /**
   * Emit a progress event marking a phase as FAILED.
   * Call this when the controller reports a phase failure.
   *
   * @param reason Short human-readable reason for the failure.
   * @param durationMs Optional wall-clock duration.
   */
  emitPhaseFailed(phase: MarcusPhase, reason: string, durationMs?: number): void {
    this._emit(
      makeEvent("progress", phase, `${phase} failed`, {
        status:   "failed",
        duration: durationMs,
      }) as ProgressEvent,
    );

    this._emit(
      makeEvent("error", phase, reason, { duration: durationMs }),
    );
  }

  /**
   * Emit a progress event marking a phase as SKIPPED (e.g. due to prior failure).
   */
  emitPhaseSkipped(phase: MarcusPhase): void {
    this._emit(
      makeEvent("progress", phase, `${phase} skipped — prior phase failed`, {
        status: "skipped",
      }) as ProgressEvent,
    );
  }

  /**
   * Emit a progress event marking a phase as WAITING (queued but not yet started).
   * Useful for pre-announcing the full pipeline before execution begins.
   */
  emitPhaseWaiting(phase: MarcusPhase): void {
    this._emit(
      makeEvent("progress", phase, `${phase} queued`, {
        status: "waiting",
      }) as ProgressEvent,
    );
  }

  // ─── Message helpers ───────────────────────────────────────────────────────

  /**
   * Emit a general human-readable message during a phase.
   * Use for mid-phase updates that don't map to a specific action or file event.
   *
   * @param message Must be truthful — only emit for work that is actually happening.
   */
  emitMessage(phase: MarcusPhase | null, message: string, detail?: string): void {
    this._emit(
      makeEvent("message", phase, message, detail ? { detail } : undefined),
    );
  }

  /**
   * Emit an action event for a discrete unit of work.
   * Use when the controller is about to do something concrete (not just thinking).
   *
   * Examples: "Evaluating brand positioning", "Selecting component layout"
   */
  emitAction(phase: MarcusPhase | null, message: string, detail?: string): void {
    this._emit(
      makeEvent("action", phase, message, detail ? { detail } : undefined),
    );
  }

  /**
   * Emit a step event for a sub-step within a phase.
   * Use for granular progress within a single phase action.
   *
   * Examples: "Step 1 of 3: analyzing industry", "Reviewing conversion goal"
   */
  emitStep(phase: MarcusPhase | null, message: string, detail?: string): void {
    this._emit(
      makeEvent("step", phase, message, detail ? { detail } : undefined),
    );
  }

  // ─── File activity helpers ─────────────────────────────────────────────────

  /**
   * Emit a file activity event describing an operation the agent performed
   * on a filesystem path.
   *
   * These events will later drive the frontend to:
   *   • Open files automatically in the editor
   *   • Highlight edits and show diffs
   *   • Build an activity timeline and replay log
   *
   * @param path      The file path (relative to the project root).
   * @param operation The type of filesystem activity.
   * @param phase     Phase context — null for cross-phase operations.
   * @param detail    Optional extra context (e.g. "added 42 lines").
   */
  emitFileOperation(
    path:      string,
    operation: FileOperation,
    phase:     MarcusPhase | null,
    detail?:   string,
  ): void {
    const label   = FILE_OPERATION_LABELS[operation];
    const message = `${label} ${path}`;

    this._emit(
      makeEvent("file", phase, message, {
        path,
        operation,
        detail,
      }) as FileActivityEvent,
    );
  }

  // ─── Warning + error helpers ───────────────────────────────────────────────

  /**
   * Emit a non-fatal warning.
   * Use when the controller detects a concern that doesn't block progress.
   *
   * Examples: "Conversion goal not specified — using default CTA",
   *           "Industry field empty — proceeding without industry context"
   */
  emitWarning(phase: MarcusPhase | null, message: string, detail?: string): void {
    this._emit(
      makeEvent("warning", phase, message, detail ? { detail } : undefined),
    );
  }

  /**
   * Emit an error event.
   * Use for failures the user needs to know about.
   * Always include enough context for the user to understand what went wrong.
   *
   * @param message User-facing description of the failure.
   * @param detail  Optional technical detail (keep concise — not a stack trace).
   */
  emitError(phase: MarcusPhase | null, message: string, detail?: string): void {
    this._emit(
      makeEvent("error", phase, message, detail ? { detail } : undefined),
    );
  }

  // ─── Completion helpers ────────────────────────────────────────────────────

  /**
   * Emit the top-level "task complete" event after all phases have finished.
   * Call once — after the controller's `run()` resolves.
   *
   * @param message Optional override for the completion message.
   *                Defaults to a generic success confirmation.
   * @param durationMs Total wall-clock duration of the full run.
   */
  emitDone(durationMs?: number, message?: string): void {
    this._emit(
      makeEvent(
        "complete",
        null,
        message ?? "Generation complete. Your project is ready.",
        { duration: durationMs },
      ),
    );
  }

  // ─── Event access ──────────────────────────────────────────────────────────

  /**
   * Return a read-only snapshot of all accumulated events WITHOUT draining
   * the buffer. Safe to call multiple times.
   */
  peek(): readonly ConversationEvent[] {
    return this._events;
  }

  /**
   * Drain and return all accumulated events.
   * The internal buffer is cleared after calling this — subsequent calls return [].
   * Use this to hand events to an SSE writer or persistence layer.
   */
  collect(): ConversationEvent[] {
    const events   = this._events;
    this._events   = [];
    return events;
  }

  /**
   * Clear all buffered events without returning them.
   * Use when aborting a run and discarding partial output.
   */
  reset(): void {
    this._events = [];
  }
}

// ─── Standalone factory helpers ───────────────────────────────────────────────
//
// These mirror the class methods but are exported as free functions for callers
// that prefer not to instantiate the engine (e.g. one-off event creation in
// a route handler before the full engine is wired in).

/** Create a file activity event without an engine instance. */
export function createFileActivityEvent(
  path:      string,
  operation: FileOperation,
  phase:     MarcusPhase | null,
  detail?:   string,
): FileActivityEvent {
  const label = FILE_OPERATION_LABELS[operation];
  return makeEvent("file", phase, `${label} ${path}`, {
    path,
    operation,
    detail,
  }) as FileActivityEvent;
}

/** Create a progress event without an engine instance. */
export function createProgressEvent(
  phase:     MarcusPhase,
  status:    PhaseStatus,
  message?:  string,
  duration?: number,
): ProgressEvent {
  return makeEvent(
    "progress",
    phase,
    message ?? `${phase} ${status}`,
    { status, duration },
  ) as ProgressEvent;
}

/** Create a generic ConversationEvent without an engine instance. */
export function createConversationEvent(
  type:      ConversationEventType,
  phase:     MarcusPhase | null,
  message:   string,
  metadata?: ConversationEventMetadata,
): ConversationEvent {
  return makeEvent(type, phase, message, metadata);
}

// ─── Type narrowing helpers ───────────────────────────────────────────────────

export function isFileActivityEvent(e: ConversationEvent): e is FileActivityEvent {
  return (
    e.type === "file" &&
    typeof e.metadata?.path === "string" &&
    typeof e.metadata?.operation === "string"
  );
}

export function isProgressEvent(e: ConversationEvent): e is ProgressEvent {
  return (
    e.type === "progress" &&
    e.phase !== null &&
    typeof e.metadata?.status === "string"
  );
}
