// ─── Website Studio Runtime Events ────────────────────────────────────────────
// Single event pipeline for WebsiteStudioRuntime.
// The runtime emits facts; the UI decides how to render them.

export type WSRuntimeEventType =
  // Project analysis
  | "ProjectScanStarted"
  | "ProjectScanCompleted"
  | "ProjectAnalysisReady"
  | "ProjectMemoryUpdated"
  // Tool execution
  | "ToolStarted"
  | "ToolCompleted"
  | "ToolFailed"
  | "FileWritten"
  | "FileRead"
  | "DirectoryListed"
  | "CodeSearched"
  | "CommandExecuted"
  // Streaming
  | "ThinkingDelta"
  | "ThinkingEnd"
  | "TextDelta"
  | "ToolCallDelta"
  | "ToolResultDelta"
  | "DiffDelta"
  | "StreamDone"
  | "StreamError"
  // Agent loop
  | "PhaseChanged"
  | "PlanCreated"
  | "ValidationResult"
  | "AssistantMessage"
  // Session
  | "SessionStarted"
  | "SessionCompleted"
  | "SessionFailed"
  | "SessionReset"
  // Activity Stream (Layer 2 — Live System Activity)
  | "ActivityStarted"
  | "ActivityUpdated"
  | "ActivityCompleted"
  | "ActivityFailed"

export interface WSRuntimeEvent {
  type: WSRuntimeEventType
  timestamp: number
  payload: Record<string, unknown>
}

export type WSRuntimeEventListener = (event: WSRuntimeEvent) => void

export class WSRuntimeEventBus {
  private listeners: Set<WSRuntimeEventListener> = new Set()

  emit(event: WSRuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  subscribe(listener: WSRuntimeEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  unsubscribe(listener: WSRuntimeEventListener): void {
    this.listeners.delete(listener)
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}

export const wsRuntimeEventBus = new WSRuntimeEventBus()

// ─── Event factory helpers ────────────────────────────────────────────────────

export function createRuntimeEvent<T extends Record<string, unknown>>(
  type: WSRuntimeEventType,
  payload: T
): WSRuntimeEvent {
  return { type, timestamp: Date.now(), payload }
}

// Project analysis events
export const projectScanStarted = () => createRuntimeEvent("ProjectScanStarted", {})
export const projectScanCompleted = (summary: string) => createRuntimeEvent("ProjectScanCompleted", { summary })
export const projectAnalysisReady = (analysis: Record<string, unknown>) => createRuntimeEvent("ProjectAnalysisReady", { analysis })
export const projectMemoryUpdated = (memory: Record<string, unknown>) => createRuntimeEvent("ProjectMemoryUpdated", { memory })

// Tool events
export const toolStarted = (tool: string, path?: string) => createRuntimeEvent("ToolStarted", { tool, path })
export const toolCompleted = (tool: string, path?: string, detail?: string) => createRuntimeEvent("ToolCompleted", { tool, path, detail })
export const toolFailed = (tool: string, error: string) => createRuntimeEvent("ToolFailed", { tool, error })
export const fileWritten = (path: string, operation: "create" | "update" | "delete") => createRuntimeEvent("FileWritten", { path, operation })
export const fileRead = (path: string) => createRuntimeEvent("FileRead", { path })
export const directoryListed = (path: string, entries: string[]) => createRuntimeEvent("DirectoryListed", { path, entries })
export const codeSearched = (query: string, results: string[]) => createRuntimeEvent("CodeSearched", { query, results })
export const commandExecuted = (cmd: string, exitCode: number, output: string) => createRuntimeEvent("CommandExecuted", { cmd, exitCode, output })

// Streaming events
export const thinkingDelta = (content: string) => createRuntimeEvent("ThinkingDelta", { content })
export const thinkingEnd = () => createRuntimeEvent("ThinkingEnd", {})
export const textDelta = (content: string) => createRuntimeEvent("TextDelta", { content })
export const toolCallDelta = (id: string, name: string, params: Record<string, unknown>) => createRuntimeEvent("ToolCallDelta", { id, name, params })
export const toolResultDelta = (id: string, ok: boolean, result?: string) => createRuntimeEvent("ToolResultDelta", { id, ok, result })
export const diffDelta = (id: string, path: string, oldContent: string, newContent: string) => createRuntimeEvent("DiffDelta", { id, path, oldContent, newContent })
export const streamDone = () => createRuntimeEvent("StreamDone", {})
export const streamError = (error: string) => createRuntimeEvent("StreamError", { error })

// Agent loop events
export const phaseChanged = (phase: string): WSRuntimeEvent => createRuntimeEvent("PhaseChanged", { phase } as Record<string, unknown>)
export const planCreated = (text: string) => createRuntimeEvent("PlanCreated", { text })
export const validationResult = (success: boolean, errors: string[], fixed: boolean) => createRuntimeEvent("ValidationResult", { success, errors, fixed })
export const assistantMessage = (content: string, role: "user" | "assistant") => createRuntimeEvent("AssistantMessage", { content, role })

// Session events
export const sessionStarted = (sessionId: string, projectId: string) => createRuntimeEvent("SessionStarted", { sessionId, projectId })
export const sessionCompleted = (projectId: string, fileCount: number) => createRuntimeEvent("SessionCompleted", { projectId, fileCount })
export const sessionFailed = (message: string) => createRuntimeEvent("SessionFailed", { message })
export const sessionReset = () => createRuntimeEvent("SessionReset", {})

// ─── Activity Stream Events (Layer 2 — Live System Activity) ──────────────────
// These are NOT chat messages. They are transient system activity indicators
// that appear in a small animated area above the conversation.
// They never become chat history.

export type ActivityKind =
  | "thinking"
  | "reasoning"
  | "reading"
  | "searching"
  | "planning"
  | "working"
  | "writing"
  | "running-command"
  | "testing"
  | "preview"
  | "complete"
  | "warning"
  | "error"

export interface ActivityPayload {
  kind: ActivityKind
  /** Optional file path for file-specific activities (reading, writing, etc.) */
  file?: string
  /** Optional detail message for context */
  detail?: string
  /** Optional progress 0-100 */
  progress?: number
  /** Optional progress detail (e.g. "3 / 16 files") */
  progressDetail?: string
}

export const activityStarted = (kind: ActivityKind, file?: string, detail?: string) =>
  createRuntimeEvent("ActivityStarted", { kind, file, detail })

export const activityUpdated = (kind: ActivityKind, file?: string, detail?: string) =>
  createRuntimeEvent("ActivityUpdated", { kind, file, detail })

export const activityCompleted = (kind: ActivityKind, file?: string, detail?: string) =>
  createRuntimeEvent("ActivityCompleted", { kind, file, detail })

export const activityFailed = (kind: ActivityKind, error: string) =>
  createRuntimeEvent("ActivityFailed", { kind, error })