// ─── Website Studio Session — Single Event Contract ───────────────────────────
// Every action in Website Studio emits one of these events.
// The UI renders nothing but these events.

// ─── Activity Stream (Layer 2 — Live System Activity) ─────────────────────────
// Transient system activities that appear in a small animated area above the
// conversation. They never become chat history.

export type ActivityKind =
  | "thinking"
  | "reasoning"
  | "reading"
  | "searching"
  | "planning"
  | "working"
  | "writing"
  | "testing"
  | "preview"
  | "complete"

export interface WSActivityEvent {
  kind: ActivityKind
  file?: string
  detail?: string
  status: "started" | "updated" | "completed" | "failed"
  timestamp: number
  id: string
}

// ─── Confidence ───────────────────────────────────────────────────────────────
export type WSConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

// ─── Wire events (from backend SSE) ───────────────────────────────────────────
export type WSSessionEvent =
  // Lifecycle
  | { type: "session.reset" }
  | { type: "session.started"; sessionId: string; projectId: string }
  | {
      type: "session.completed"
      projectId: string
      fileCount: number
      summary?: string
      decision?: string
      filesCreated?: string[]
      confidence?: WSConfidenceLevel
    }
  | { type: "session.failed"; message: string }

  // Loop phases (generation)
  | {
      type: "phase.changed"
      phase: string
      message: string
      summary?: string
      decision?: string
      reason?: string
      filesCreated?: string[]
      confidence?: WSConfidenceLevel
    }

  // Thinking stream
  | { type: "thinking.token"; token: string }

  // Tool execution (generation + editing share the same events)
  | { type: "tool.started"; tool: string; path?: string }
  | { type: "tool.completed"; tool: string; path?: string; detail?: string }
  | { type: "tool.failed"; tool: string; error: string }

  // File streaming
  | { type: "file.opened"; path: string; language: string }
  | { type: "file.token"; path: string; token: string }
  | { type: "file.completed"; path: string; language: string; content: string }
  | { type: "file.changed"; path: string; operation: "create" | "update" | "delete" }

  // Structural validation
  | { type: "validation.result"; success: boolean; errors: string[]; fixed: boolean }

  // Conversation (editing phase)
  | { type: "user.message"; text: string; id: string }
  | { type: "agent.streaming"; delta: string }
  | { type: "agent.message"; text: string; id: string }
  | { type: "plan.created"; text: string; id: string }
  | { type: "scan.started" }
  | { type: "scan.completed"; summary: string }
  | { type: "scan.failed"; error: string }

  // Activity Stream (Layer 2 — Live System Activity)
  | { type: "activity.started"; kind: ActivityKind; file?: string; detail?: string }
  | { type: "activity.updated"; kind: ActivityKind; file?: string; detail?: string }
  | { type: "activity.completed"; kind: ActivityKind; file?: string; detail?: string }
  | { type: "activity.failed"; kind: ActivityKind; error: string }

// ─── Unified conversation entry (for both generation and editing) ─────────────
export type WSConversationEntry =
  | { kind: "thinking"; text: string; id: string; ts: number; phase?: string }
  | { kind: "user"; text: string; id: string; ts: number }
  | { kind: "agent"; text: string; complete: boolean; id: string; ts: number }
  | { kind: "tool"; tool: string; status: "running" | "done" | "failed"; path?: string; detail?: string; id: string; ts: number }
  | { kind: "file-change"; path: string; operation: "create" | "update" | "delete"; id: string; ts: number }
  | { kind: "plan"; text: string; id: string; ts: number }
  | { kind: "scan"; status: "running" | "done" | "failed"; summary?: string; id: string; ts: number }
  | { kind: "validation"; success: boolean; errors: string[]; fixed: boolean; id: string; ts: number }

// ─── Timeline Entry (for rendering in the chat timeline) ──────────────────────
export type TimelineEntry =
  | { kind: "thinking"; text: string; id: string; time: string }
  | { kind: "user-msg"; text: string; id: string; time: string }
  | { kind: "agent-msg"; text: string; phase?: string; id: string; time: string }
  | { kind: "tool-call"; name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string; id: string; time: string }
  | { kind: "file-change"; change: { path: string; operation: "create" | "update" | "delete" }; id: string; time: string }
  | { kind: "scan"; status: "running" | "done" | "error"; summary?: string; id: string; time: string }
  | { kind: "plan"; text: string; id: string; time: string }
  | { kind: "validation"; success: boolean; errors: string[]; fixed: boolean; id: string; time: string }

// ─── File state ────────────────────────────────────────────────────────────────
export interface WSFileState {
  language: string
  content: string
  complete: boolean
}

// ─── Session status ────────────────────────────────────────────────────────────
export type WSSessionStatus =
  | "idle"
  | "generating"
  | "editing"
  | "completed"
  | "failed"

// ─── Session state (the single source of truth the UI renders from) ───────────
export interface WSSessionState {
  sessionId: string | null
  projectId: string | null
  status: WSSessionStatus
  error: string | null

  // Active loop phase (generation)
  currentPhase: string | null
  phaseMessage: string
  fixIteration: number

  // Live file being streamed
  activeFilePath: string | null
  activeFileLanguage: string

  // All files written in this session
  files: Record<string, WSFileState>
  fileCount: number

  // Live agent text being streamed (for ThinkingPanel / response display)
  streamingText: string

  // Unified timeline: thinking, user messages, agent messages, tools, file changes
  conversation: WSConversationEntry[]

  // Last structural validation result
  lastValidation: { success: boolean; errors: string[]; fixed: boolean } | null

  // ── Narration metadata (Phase 10.3 bridge) ──────────────────────────────────
  // Real backend-derived signals only — never fabricated on the frontend.
  // Populated from `phase.changed` / `session.completed` events and persisted
  // across phase transitions (not reset) so the most recent known value of
  // each field is always available to consumers, until session.reset.
  narrationSummary: string | null
  narrationDecision: string | null
  narrationReason: string | null
  filesCreated: string[] | null
  confidence: WSConfidenceLevel | null

  // Activity Stream (Layer 2 — Live System Activity)
  currentActivity: WSActivityEvent | null
}

export const INITIAL_WS_SESSION_STATE: WSSessionState = {
  sessionId: null,
  projectId: null,
  status: "idle",
  error: null,
  currentPhase: null,
  phaseMessage: "",
  fixIteration: 0,
  activeFilePath: null,
  activeFileLanguage: "typescript",
  files: {},
  fileCount: 0,
  streamingText: "",
  conversation: [],
  lastValidation: null,
  narrationSummary: null,
  narrationDecision: null,
  narrationReason: null,
  filesCreated: null,
  confidence: null,
  currentActivity: null,
}