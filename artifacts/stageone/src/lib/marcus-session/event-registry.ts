// ─── Marcus Event Registry ──────────────────────────────────────────────────────
// One place where backend phase names map to MarcusSessionEvents.
// No component should translate backend events. No React dependency.

import type { MarcusSessionEvent } from "./types"

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
      events: [{ type: "session.completed", projectId, fileCount }],
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
