// ─── Marcus Session — Single Event Contract ───────────────────────────────────
// Every action Marcus takes, from initial generation through live editing,
// emits one of these events. The UI renders nothing but these events.

// How sure the backend is in a completion/validation report. Mirrors
// `ConfidenceLevel` on the backend's `marcus-stream-agent.ts` — never
// guessed on the frontend, only ever forwarded from the wire event.
export type MarcusConfidenceLevel = "HIGH" | "MEDIUM" | "LOW"

// ─── Wire events ──────────────────────────────────────────────────────────────
export type MarcusSessionEvent =
  // Lifecycle
  | { type: "session.reset" }
  | { type: "session.started";   sessionId: string; projectId: string }
  | {
      type: "session.completed"
      projectId: string
      fileCount: number
      // Narration metadata carried by the backend's `done` SSE event — all
      // optional/additive, forwarded only when the backend actually sent them.
      summary?: string
      decision?: string
      filesCreated?: string[]
      confidence?: MarcusConfidenceLevel
    }
  | { type: "session.failed";    message: string }

  // Loop phases (generation)
  | {
      type: "phase.changed"
      phase: string
      message: string
      // Narration metadata carried by the backend's `loop-phase` SSE event —
      // all optional/additive, forwarded only when the backend actually sent
      // them (e.g. a design decision extracted from the model's own planning
      // text, or a derived confidence level on VALIDATE). Never fabricated.
      summary?: string
      decision?: string
      reason?: string
      filesCreated?: string[]
      confidence?: MarcusConfidenceLevel
    }

  // Thinking stream
  | { type: "thinking.token"; token: string }

  // Tool execution (generation + editing share the same events)
  | { type: "tool.started";   tool: string; path?: string }
  | { type: "tool.completed"; tool: string; path?: string; detail?: string }
  | { type: "tool.failed";    tool: string; error: string }

  // File streaming
  | { type: "file.opened";    path: string; language: string }
  | { type: "file.token";     path: string; token: string }
  | { type: "file.completed"; path: string; language: string; content: string }
  | { type: "file.changed";   path: string; operation: "create" | "update" | "delete" }

  // Structural validation
  | { type: "validation.result"; success: boolean; errors: string[]; fixed: boolean }

  // Conversation (editing phase)
  | { type: "user.message";    text: string; id: string }
  | { type: "agent.streaming"; delta: string }
  | { type: "agent.message";   text: string; id: string }
  | { type: "plan.created";    text: string; id: string }
  | { type: "scan.started" }
  | { type: "scan.completed";  summary: string }
  | { type: "scan.failed";     error: string }

// ─── Conversation entry (unified timeline for both generation and editing) ─────
export type ConversationEntry =
  | { kind: "thinking";     text: string;              id: string; ts: number; phase?: string }
  | { kind: "user";         text: string;              id: string; ts: number }
  | { kind: "agent";        text: string; complete: boolean; id: string; ts: number }
  | { kind: "tool";         tool: string; status: "running"|"done"|"failed"; path?: string; detail?: string; id: string; ts: number }
  | { kind: "file-change";  path: string; operation: "create"|"update"|"delete"; id: string; ts: number }
  | { kind: "plan";         text: string;              id: string; ts: number }
  | { kind: "scan";         status: "running"|"done"|"failed"; summary?: string; id: string; ts: number }
  | { kind: "validation";   success: boolean; errors: string[]; fixed: boolean; id: string; ts: number }

// ─── File state ────────────────────────────────────────────────────────────────
export interface MarcusFileState {
  language: string
  content:  string
  complete: boolean
}

// ─── Session status ────────────────────────────────────────────────────────────
export type MarcusSessionStatus =
  | "idle"
  | "generating"
  | "editing"
  | "completed"
  | "failed"

// ─── Session state (the single source of truth the UI renders from) ───────────
export interface MarcusSessionState {
  sessionId:   string | null
  projectId:   string | null
  status:      MarcusSessionStatus
  error:       string | null

  // Active loop phase (generation)
  currentPhase:  string | null
  phaseMessage:  string
  fixIteration:  number

  // Live file being streamed
  activeFilePath:     string | null
  activeFileLanguage: string

  // All files Marcus has written in this session
  files:     Record<string, MarcusFileState>
  fileCount: number

  // Live agent text being streamed (for ThinkingPanel / response display)
  streamingText: string

  // Unified timeline: thinking, user messages, agent messages, tools, file changes
  conversation: ConversationEntry[]

  // Last structural validation result
  lastValidation: { success: boolean; errors: string[]; fixed: boolean } | null

  // ── Narration metadata (Phase 10.3 bridge) ──────────────────────────────────
  // Real backend-derived signals only — never fabricated on the frontend.
  // Populated from `phase.changed` / `session.completed` events and persisted
  // across phase transitions (not reset) so the most recent known value of
  // each field is always available to consumers, until session.reset.
  narrationSummary:  string | null
  narrationDecision: string | null
  narrationReason:   string | null
  filesCreated:      string[] | null
  confidence:        MarcusConfidenceLevel | null
}

export const INITIAL_SESSION_STATE: MarcusSessionState = {
  sessionId:          null,
  projectId:          null,
  status:             "idle",
  error:              null,
  currentPhase:       null,
  phaseMessage:       "",
  fixIteration:       0,
  activeFilePath:     null,
  activeFileLanguage: "typescript",
  files:              {},
  fileCount:          0,
  streamingText:      "",
  conversation:       [],
  lastValidation:     null,
  narrationSummary:   null,
  narrationDecision:  null,
  narrationReason:    null,
  filesCreated:       null,
  confidence:         null,
}
