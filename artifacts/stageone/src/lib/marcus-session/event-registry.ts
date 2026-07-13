// ─── Marcus Event Registry ──────────────────────────────────────────────────────
// One place where backend phase names map to MarcusSessionEvents.
// No component should translate backend events. No React dependency.

import type { MarcusConfidenceLevel, MarcusSessionEvent } from "./types"

const CONFIDENCE_LEVELS = new Set(["HIGH", "MEDIUM", "LOW"])

/** Narrows an unknown SSE value to a known confidence level, or undefined —
 *  never invents a value when the backend didn't send a recognized one. */
function asConfidence(value: unknown): MarcusConfidenceLevel | undefined {
  return typeof value === "string" && CONFIDENCE_LEVELS.has(value)
    ? (value as MarcusConfidenceLevel)
    : undefined
}

/** Narrows an unknown SSE value to a string, or undefined when absent/empty —
 *  used for optional narration fields so we never forward "" or "undefined". */
function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined
}

/** Narrows an unknown SSE value to a string array, or undefined when absent. */
function asOptionalStringArray(value: unknown): string[] | undefined {
  return Array.isArray(value) ? (value as string[]) : undefined
}

export interface BackendEventBuildResult {
  events: MarcusSessionEvent[]
  /** Captured when the backend provides a project/session ID */
  capturedProjectId?: string
  /** Set when the stream should terminate (done / error) */
  terminal?: "completed" | "failed"
  /** Error message when terminal === "failed" */
  errorMessage?: string
}

type EventBuilder = (
  data: Record<string, unknown>,
  capturedProjectId: string | null,
) => BackendEventBuildResult

const REGISTRY: Record<string, EventBuilder> = {
  "project-created": (data) => {
    const projectId = String(data.projectId ?? "")
    const sessionId = String(data.sessionId ?? projectId)
    return {
      events: [{ type: "session.started", sessionId, projectId }],
      capturedProjectId: projectId,
    }
  },

  "agent-thinking": (data) => ({
    events: [{ type: "thinking.token", token: String(data.token ?? "") }],
  }),

  "file-start": (data) => ({
    events: [{
      type: "file.opened",
      path: String(data.path ?? ""),
      language: String(data.language ?? "typescript"),
    }],
  }),

  "file-token": (data) => ({
    events: [{
      type: "file.token",
      path: String(data.path ?? ""),
      token: String(data.token ?? ""),
    }],
  }),

  "file-done": (data) => ({
    events: [{
      type: "file.completed",
      path: String(data.path ?? ""),
      language: String(data.language ?? "typescript"),
      content: String(data.content ?? ""),
    }],
  }),

  "loop-phase": (data) => ({
    events: [{
      type: "phase.changed",
      phase: String(data.loopPhase ?? ""),
      message: String(data.message ?? ""),
      // Narration metadata — forwarded only when the backend actually sent
      // it (e.g. a design decision extracted from the model's own planning
      // text, or a derived confidence level on VALIDATE). Never fabricated.
      summary:      asOptionalString(data.summary),
      decision:     asOptionalString(data.decision),
      reason:       asOptionalString(data.reason),
      filesCreated: asOptionalStringArray(data.filesCreated),
      confidence:   asConfidence(data.confidence),
    }],
  }),

  "tool-call": (data) => {
    const tool = String(data.tool ?? "")
    const status = String(data.status ?? "start")
    const path = data.path ? String(data.path) : undefined
    const detail = data.detail ? String(data.detail) : undefined

    if (status === "start") {
      return { events: [{ type: "tool.started", tool, path }] }
    }
    if (status === "done") {
      return { events: [{ type: "tool.completed", tool, path, detail }] }
    }
    return { events: [{ type: "tool.failed", tool, error: detail ?? "unknown" }] }
  },

  validation: (data) => ({
    events: [{
      type: "validation.result",
      success: Boolean(data.success),
      errors: Array.isArray(data.errors) ? (data.errors as string[]) : [],
      fixed: Boolean(data.fixed),
    }],
  }),

  done: (data, capturedProjectId) => {
    const projectId = String(data.projectId ?? capturedProjectId ?? "")
    const fileCount = typeof data.fileCount === "number" ? data.fileCount : 0
    return {
      events: [{
        type: "session.completed",
        projectId,
        fileCount,
        // Narration metadata from the backend's completion report — real
        // data only, forwarded only when present.
        summary:      asOptionalString(data.summary),
        decision:     asOptionalString(data.decision),
        filesCreated: asOptionalStringArray(data.filesCreated),
        confidence:   asConfidence(data.confidence),
      }],
      capturedProjectId: projectId,
      terminal: "completed",
    }
  },

  error: (data) => ({
    events: [],
    terminal: "failed",
    errorMessage: String(data.message ?? "Generation failed"),
  }),
}

export function buildEvents(
  phase: string,
  data: Record<string, unknown>,
  capturedProjectId: string | null,
): BackendEventBuildResult {
  const builder = REGISTRY[phase]
  if (!builder) {
    return { events: [] }
  }
  return builder(data, capturedProjectId)
}
