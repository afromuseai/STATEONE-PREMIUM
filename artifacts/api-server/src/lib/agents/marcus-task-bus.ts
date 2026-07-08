// ─── Marcus Task Bus — Internal Execution Events ──────────────────────────────
//
// A lightweight event bus that is the single source of truth for all execution
// activity during a generation pipeline run.
//
// The bus knows nothing about SSE, UI, React, Website Studio, or LLM prompts.
// It only represents execution. Consumers (Marcus Conversation, WebContainer
// integration, Website Studio Timeline) attach as subscribers.
//
// Usage:
//   const bus = new MarcusTaskBus();
//   const unsub = bus.subscribe(event => console.log(event));
//   bus.emit("filesystem", "create_file", "completed", { path: "Hero.tsx" }, "build");
//   unsub();

import crypto from "crypto";
import { logger } from "../logger.js";

// ─── Event categories ─────────────────────────────────────────────────────────

export type TaskEventCategory =
  | "filesystem"
  | "terminal"
  | "llm"
  | "validation"
  | "database"
  | "webcontainer"
  | "browser"
  | "pipeline"
  | "tool";

// ─── Status ───────────────────────────────────────────────────────────────────

export type TaskEventStatus = "queued" | "running" | "completed" | "failed";

// ─── Actions per category ─────────────────────────────────────────────────────

export type FilesystemAction =
  | "read_file"
  | "open_file"
  | "create_file"
  | "update_file"
  | "delete_file"
  | "rename_file";

export type TerminalAction = "run_command" | "stdout" | "stderr";

export type LlmAction =
  | "architect_start"
  | "architect_complete"
  | "codegen_start"
  | "codegen_complete";

export type ValidationAction =
  | "typescript"
  | "eslint"
  | "next_build"
  | "preview"
  | "blueprint"   // Architect JSON parse + schema check
  | "schema";     // Runtime blueprint schema validation

export type DatabaseAction = "save_project" | "save_blueprint" | "save_files";

export type WebcontainerAction = string; // extensible for future integration
export type BrowserAction = string;      // extensible for future integration

export type PipelineAction = "start" | "finish" | "error";

export type ToolAction = string; // tool names are dynamic

// ─── Category → action mapping ────────────────────────────────────────────────
// Enforces that callers pair a category only with its valid actions.
// webcontainer, browser, and tool allow any string for extensibility.

export interface CategoryActionMap {
  filesystem:   FilesystemAction;
  terminal:     TerminalAction;
  llm:          LlmAction;
  validation:   ValidationAction;
  database:     DatabaseAction;
  webcontainer: WebcontainerAction;
  browser:      BrowserAction;
  pipeline:     PipelineAction;
  tool:         ToolAction;
}

export type TaskEventAction = CategoryActionMap[TaskEventCategory];

// ─── Event metadata ───────────────────────────────────────────────────────────

export interface TaskEventMetadata {
  /** File path involved in the operation. */
  path?: string;

  /** Shell or build command being executed. */
  command?: string;

  /** stdout/stderr content from a terminal action. */
  output?: string;

  /** Duration of the operation in milliseconds. */
  duration?: number;

  /** Model name for LLM events. */
  model?: string;

  /** Token counts for LLM events. */
  tokens?: { input?: number; output?: number };

  /** Error message for failed events. */
  error?: string;

  /** Tool name for tool events. */
  tool?: string;

  /** Project or blueprint ID for database events. */
  projectId?: number | string;

  /** Any additional context, kept open for future expansion. */
  [key: string]: unknown;
}

// ─── Task Event ───────────────────────────────────────────────────────────────

export interface TaskEvent {
  /** Unique event ID. */
  id: string;

  /** ISO timestamp of emission. */
  timestamp: string;

  /** Execution category. */
  category: TaskEventCategory;

  /** Specific action within the category. */
  action: TaskEventAction;

  /** Lifecycle status of this action. */
  status: TaskEventStatus;

  /**
   * Structured metadata — always present (defaults to {} when not supplied).
   * Fields are additive; include only what is relevant for the event type.
   */
  metadata: TaskEventMetadata;

  /**
   * Pipeline phase this event belongs to (e.g. "planning", "build", "validation").
   * Defaults to "unknown" when not supplied by the caller.
   */
  phase: string;
}

// ─── Subscriber ───────────────────────────────────────────────────────────────

export type TaskEventSubscriber = (event: TaskEvent) => void;

/** Returned by subscribe(); call to remove the listener. */
export type Unsubscribe = () => void;

// ─── Marcus Task Bus ─────────────────────────────────────────────────────────

export class MarcusTaskBus {
  private readonly _history: TaskEvent[] = [];
  private readonly _subscribers = new Set<TaskEventSubscriber>();

  // ─── emit ──────────────────────────────────────────────────────────────────
  //
  // Broadcast a new execution event to all subscribers and append it to
  // in-memory history.  Each call produces a structured log entry.

  emit<C extends TaskEventCategory>(
    category: C,
    action: CategoryActionMap[C],
    status: TaskEventStatus,
    metadata?: TaskEventMetadata,
    phase?: string,
  ): TaskEvent {
    const event: TaskEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      category,
      action,
      status,
      metadata: metadata ?? {},
      phase: phase ?? "unknown",
    };

    this._history.push(event);
    this._log(event);

    for (const sub of this._subscribers) {
      try {
        sub(event);
      } catch (err) {
        logger.error({ err, eventId: event.id }, "[MARCUS][TASK] subscriber threw");
      }
    }

    return event;
  }

  // ─── subscribe ─────────────────────────────────────────────────────────────
  //
  // Register a listener that receives every future event.
  // Returns an unsubscribe function — call it to stop receiving events.

  subscribe(subscriber: TaskEventSubscriber): Unsubscribe {
    this._subscribers.add(subscriber);
    return () => this._subscribers.delete(subscriber);
  }

  // ─── unsubscribe ───────────────────────────────────────────────────────────
  //
  // Remove a previously registered subscriber by reference.

  unsubscribe(subscriber: TaskEventSubscriber): void {
    this._subscribers.delete(subscriber);
  }

  // ─── history ───────────────────────────────────────────────────────────────
  //
  // Return an ordered snapshot of all events emitted since the last clear().
  // The array is a shallow copy — mutating it has no effect on internal state.

  history(): ReadonlyArray<TaskEvent> {
    return this._history.slice();
  }

  // ─── clear ─────────────────────────────────────────────────────────────────
  //
  // Discard all stored history.  Subscribers are NOT removed.
  // Call between pipeline runs to prevent unbounded memory growth.

  clear(): void {
    this._history.length = 0;
  }

  // ─── subscriberCount ───────────────────────────────────────────────────────
  //
  // Diagnostic helper — returns the number of active subscribers.

  get subscriberCount(): number {
    return this._subscribers.size;
  }

  // ─── private: _log ─────────────────────────────────────────────────────────

  private _log(event: TaskEvent): void {
    const logObj: Record<string, unknown> = {
      category: event.category,
      action: event.action,
      status: event.status,
      phase: event.phase,
    };

    // Surface the most useful metadata fields at the top level for easy grep.
    if (event.metadata?.path)    logObj["path"]    = event.metadata.path;
    if (event.metadata?.command) logObj["command"] = event.metadata.command;
    if (event.metadata?.tool)    logObj["tool"]    = event.metadata.tool;
    if (event.metadata?.error)   logObj["error"]   = event.metadata.error;

    logger.info(logObj, "[MARCUS][TASK]");
  }
}

// ─── Convenience factory helpers ──────────────────────────────────────────────
//
// Named shortcuts for the most common emit patterns.  All return the TaskEvent
// so callers can chain or inspect the result.

/** Shorthand: emit a filesystem event. */
export function emitFilesystem(
  bus: MarcusTaskBus,
  action: FilesystemAction,
  status: TaskEventStatus,
  path: string,
  phase?: string,
  extra?: TaskEventMetadata,
): TaskEvent {
  return bus.emit("filesystem", action, status, { path, ...extra }, phase);
}

/** Shorthand: emit a terminal event. */
export function emitTerminal(
  bus: MarcusTaskBus,
  action: TerminalAction,
  status: TaskEventStatus,
  command: string,
  phase?: string,
  extra?: TaskEventMetadata,
): TaskEvent {
  return bus.emit("terminal", action, status, { command, ...extra }, phase);
}

/** Shorthand: emit an LLM event. */
export function emitLlm(
  bus: MarcusTaskBus,
  action: LlmAction,
  status: TaskEventStatus,
  model: string,
  phase?: string,
  extra?: TaskEventMetadata,
): TaskEvent {
  return bus.emit("llm", action, status, { model, ...extra }, phase);
}

/** Shorthand: emit a validation event. */
export function emitValidation(
  bus: MarcusTaskBus,
  action: ValidationAction,
  status: TaskEventStatus,
  phase?: string,
  extra?: TaskEventMetadata,
): TaskEvent {
  return bus.emit("validation", action, status, extra, phase);
}

/** Shorthand: emit a database event. */
export function emitDatabase(
  bus: MarcusTaskBus,
  action: DatabaseAction,
  status: TaskEventStatus,
  projectId?: number | string,
  phase?: string,
  extra?: TaskEventMetadata,
): TaskEvent {
  return bus.emit("database", action, status, { projectId, ...extra }, phase);
}

/** Shorthand: emit a pipeline lifecycle event. */
export function emitPipeline(
  bus: MarcusTaskBus,
  action: PipelineAction,
  status: TaskEventStatus,
  phase?: string,
  extra?: TaskEventMetadata,
): TaskEvent {
  return bus.emit("pipeline", action, status, extra, phase);
}
