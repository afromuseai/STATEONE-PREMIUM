// ─── Marcus Website Studio — Agent Event System ───────────────────────────────
//
// Replaces the flat `{ phase: "building", content: "..." }` SSE shape with a
// structured AgentEvent that carries agent identity, semantic type, a human
// message, and optional metadata.
//
// Stream shape (before → after):
//
//   Before:  data: { "phase": "building", "content": "export default function..." }
//   After:   data: { "event": { "id": "...", "agent": "developer",
//                               "type": "action", "message": "Creating Hero component",
//                               "metadata": { "file": "components/Hero.tsx" } } }
//
// Consumers:
//   • generate-website-v2.ts (server) — emits AgentEvent via sseWriteAgentEvent()
//   • website-generator.tsx  (client) — renders AgentEvent in the progress UI
//
// Every type in this file is a pure data contract — no runtime logic here.
// Factory helpers and SSE utilities live in agent-event-helpers.ts.

import crypto from "crypto";

// ─── Agent identifiers ────────────────────────────────────────────────────────
// Each value maps to a named agent in the Marcus pipeline.
//   marcus    — top-level controller; emits plan and report events
//   architect — blueprint/design phase (Phase 1 LLM)
//   designer  — design system and layout decisions
//   developer — code generation phase (Phase 2 LLM)
//   runtime   — WebContainer execution and build validation
//   qa        — output validation and issue detection

export type AgentId =
  | "marcus"
  | "architect"
  | "designer"
  | "developer"
  | "runtime"
  | "qa";

// ─── Event types ──────────────────────────────────────────────────────────────
// Semantic classification of what an agent is communicating.
//
//   thought  — internal reasoning visible to the user ("Analyzing business model...")
//   plan     — structured execution plan before action starts
//   action   — a discrete unit of work being performed ("Creating Hero.tsx")
//   tool     — a tool call (file write, shell command, fetch, etc.)
//   success  — a step or the full task completed successfully
//   error    — a failure was detected; always paired with a recovery action

export type AgentEventType =
  | "thought"
  | "plan"
  | "action"
  | "tool"
  | "success"
  | "error";

// ─── Event metadata ───────────────────────────────────────────────────────────
// Optional structured context attached to an event.
// Fields are additive — include only what is relevant for the event type.

export interface AgentEventMetadata {
  /** File path being created, modified, or validated. */
  file?: string;

  /** Shell or build command being executed. */
  command?: string;

  /** Duration of the operation in milliseconds. */
  duration?: number;

  /** For "tool" events: the name of the tool being invoked. */
  tool?: string;

  /** For "error" events: machine-readable error code. */
  errorCode?: string;

  /** For "plan" events: ordered steps in the execution plan. */
  steps?: string[];

  /** For "success" events: list of items verified. */
  verified?: string[];

  /** For "action" events scoped to a pipeline phase. */
  phase?: string;

  /** Number of lines written (code generation context). */
  lineCount?: number;
}

// ─── AgentEvent ───────────────────────────────────────────────────────────────
// The canonical event shape for the Marcus agent pipeline stream.
// Every message emitted to the SSE stream during agent execution uses this shape.

export interface AgentEvent {
  /** Unique event ID — use createAgentEventId() to generate. */
  id: string;

  /** Which agent produced this event. */
  agent: AgentId;

  /**
   * Semantic type of the event.
   * Drives UI rendering: thought = italic reasoning, action = file chip,
   * tool = command badge, success = checkmark, error = red alert.
   */
  type: AgentEventType;

  /** Human-readable message following the Marcus communication contracts. */
  message: string;

  /** Optional structured metadata for richer UI rendering or tooling. */
  metadata?: AgentEventMetadata;

  /** ISO timestamp — set automatically by createAgentEvent(). */
  timestamp?: string;
}

// ─── SSE envelope ─────────────────────────────────────────────────────────────
// The top-level shape written to the SSE stream.
// The `event` field wraps AgentEvent; the `phase` field is the pipeline
// lifecycle anchor consumed by the frontend state machine.
//
// Both fields are always present so consumers can inspect `phase` for routing
// and `event` for rich rendering — no conditional field checks needed.

export interface AgentSseFrame {
  /** Pipeline phase this event belongs to.
   *  Replaces the flat `phase` field on the old V2SseEvent building variants. */
  phase:
    | "agent:thought"
    | "agent:plan"
    | "agent:action"
    | "agent:tool"
    | "agent:success"
    | "agent:error";

  /** The structured agent event. */
  event: AgentEvent;
}

// ─── Literal sets for runtime validation ─────────────────────────────────────
// Derived from the union types above — kept in sync by construction.
// Used by type guards to validate exact membership, not just string-ness.

const VALID_AGENT_IDS = new Set<string>([
  "marcus", "architect", "designer", "developer", "runtime", "qa",
] satisfies AgentId[]);

const VALID_EVENT_TYPES = new Set<string>([
  "thought", "plan", "action", "tool", "success", "error",
] satisfies AgentEventType[]);

const VALID_SSE_PHASES = new Set<string>([
  "agent:thought", "agent:plan", "agent:action",
  "agent:tool", "agent:success", "agent:error",
] satisfies AgentSseFrame["phase"][]);

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isAgentId(value: unknown): value is AgentId {
  return typeof value === "string" && VALID_AGENT_IDS.has(value);
}

export function isAgentEventType(value: unknown): value is AgentEventType {
  return typeof value === "string" && VALID_EVENT_TYPES.has(value);
}

export function isAgentSsePhase(value: unknown): value is AgentSseFrame["phase"] {
  return typeof value === "string" && VALID_SSE_PHASES.has(value);
}

export function isAgentEvent(value: unknown): value is AgentEvent {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["id"]      === "string" &&
    isAgentId(v["agent"])            &&
    isAgentEventType(v["type"])      &&
    typeof v["message"] === "string"
  );
}

export function isAgentSseFrame(value: unknown): value is AgentSseFrame {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return isAgentSsePhase(v["phase"]) && isAgentEvent(v["event"]);
}

// ─── Factory helpers ──────────────────────────────────────────────────────────
// Lightweight creation utilities. Import these server-side wherever events
// are emitted; the client only consumes — never creates — AgentEvents.

/** Generate a collision-resistant event ID. */
export function createAgentEventId(): string {
  return crypto.randomUUID();
}

/**
 * Create a fully-formed AgentEvent with a generated ID and current timestamp.
 * The `id` and `timestamp` fields are always set here — callers never need to
 * provide them.
 *
 * @example
 * createAgentEvent("developer", "action", "Creating responsive hero section", {
 *   file: "components/Hero.tsx"
 * })
 */
export function createAgentEvent(
  agent:    AgentId,
  type:     AgentEventType,
  message:  string,
  metadata?: AgentEventMetadata,
): AgentEvent {
  return {
    id:        createAgentEventId(),
    agent,
    type,
    message,
    metadata,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Derive the AgentSseFrame `phase` string from an AgentEvent's type.
 * Used by the SSE writer to set the frame envelope automatically.
 */
export function agentEventToPhase(event: AgentEvent): AgentSseFrame["phase"] {
  return `agent:${event.type}` as AgentSseFrame["phase"];
}

/**
 * Wrap an AgentEvent in an AgentSseFrame ready for JSON serialisation.
 * Pass the result directly to sseWrite().
 *
 * @example
 * sseWrite(res, wrapAgentEvent(
 *   createAgentEvent("developer", "action", "Writing Hero component", { file: "components/Hero.tsx" })
 * ));
 */
export function wrapAgentEvent(event: AgentEvent): AgentSseFrame {
  return {
    phase: agentEventToPhase(event),
    event,
  };
}

// ─── Canonical event constructors ─────────────────────────────────────────────
// Named shortcuts for the most common event patterns in the pipeline.
// These enforce message shape consistency without requiring callers to
// hand-write message strings.

/** Marcus is explaining reasoning before acting. */
export const agentThought = (
  agent: AgentId,
  message: string,
  metadata?: AgentEventMetadata,
): AgentEvent => createAgentEvent(agent, "thought", message, metadata);

/** Agent is executing a discrete unit of work. */
export const agentAction = (
  agent: AgentId,
  message: string,
  metadata?: AgentEventMetadata,
): AgentEvent => createAgentEvent(agent, "action", message, metadata);

/** Agent is invoking a tool (file write, shell, fetch, etc.). */
export const agentTool = (
  agent: AgentId,
  toolName: string,
  message: string,
  metadata?: AgentEventMetadata,
): AgentEvent =>
  // Spread caller metadata first so canonical `tool` field is always authoritative.
  createAgentEvent(agent, "tool", message, { ...metadata, tool: toolName });

/** A step or the full task completed successfully. */
export const agentSuccess = (
  agent: AgentId,
  message: string,
  verified?: string[],
  metadata?: AgentEventMetadata,
): AgentEvent =>
  // `verified` is authoritative; caller metadata may add other fields but cannot override it.
  createAgentEvent(agent, "success", message, { ...metadata, verified });

/** A failure was detected. Always pair with a recovery action. */
export const agentError = (
  agent: AgentId,
  message: string,
  errorCode?: string,
  metadata?: AgentEventMetadata,
): AgentEvent =>
  // `errorCode` is authoritative over any caller-supplied errorCode in metadata.
  createAgentEvent(agent, "error", message, { ...metadata, errorCode });

/** Agent is presenting a structured execution plan. */
export const agentPlan = (
  agent: AgentId,
  message: string,
  steps: string[],
  metadata?: AgentEventMetadata,
): AgentEvent =>
  // `steps` is authoritative; determines the canonical plan ordering.
  createAgentEvent(agent, "plan", message, { ...metadata, steps });
