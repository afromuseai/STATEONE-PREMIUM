// ─── Marcus Session Reducer ────────────────────────────────────────────────────
// Pure function: (state, event) → next state.
// No side effects. No async. No refs.

import type { MarcusSessionEvent, MarcusSessionState, ConversationEntry } from "./types"
import { INITIAL_SESSION_STATE } from "./types"

let _idSeq = 0
function uid() { return `ms-${Date.now()}-${++_idSeq}` }

export function marcusSessionReducer(
  state: MarcusSessionState,
  event: MarcusSessionEvent,
): MarcusSessionState {
  switch (event.type) {

    // ── Lifecycle ──────────────────────────────────────────────────────────────
    case "session.reset":
      return { ...INITIAL_SESSION_STATE }

    case "session.started":
      return {
        ...state,
        sessionId: event.sessionId,
        projectId: event.projectId,
        status:    "generating",
        error:     null,
      }

    case "session.completed":
      return {
        ...state,
        status:        "editing",      // seamlessly enter editing mode
        projectId:     event.projectId,
        fileCount:     event.fileCount,
        activeFilePath: null,
        streamingText:  "",
        // Narration metadata: the completion event is the authoritative,
        // final report — overwrite whatever earlier loop-phase events set,
        // but only for fields the backend actually sent this time.
        narrationSummary:  event.summary  ?? state.narrationSummary,
        narrationDecision: event.decision ?? state.narrationDecision,
        filesCreated:      event.filesCreated ?? state.filesCreated,
        confidence:        event.confidence ?? state.confidence,
      }

    case "session.failed":
      return {
        ...state,
        status: "failed",
        error:  event.message,
      }

    // ── Phase ──────────────────────────────────────────────────────────────────
    case "phase.changed": {
      const isFix = event.phase === "FIX"
      return {
        ...state,
        currentPhase:  event.phase,
        phaseMessage:  event.message,
        fixIteration:  isFix ? state.fixIteration + 1 : state.fixIteration,
        // Narration metadata: only overwrite a field when this specific
        // loop-phase event actually carried it — otherwise keep whatever the
        // most recent phase set, so e.g. a design decision captured on PLAN
        // survives into later phases instead of being cleared.
        narrationSummary:  event.summary  ?? state.narrationSummary,
        narrationDecision: event.decision ?? state.narrationDecision,
        narrationReason:   event.reason   ?? state.narrationReason,
        filesCreated:      event.filesCreated ?? state.filesCreated,
        confidence:        event.confidence   ?? state.confidence,
      }
    }

    // ── Thinking ───────────────────────────────────────────────────────────────
    case "thinking.token": {
      // Accumulate into streamingText AND update/append to the last thinking entry
      const lastIdx = state.conversation.length - 1
      const last    = state.conversation[lastIdx]
      let conversation: ConversationEntry[]

      if (last?.kind === "thinking") {
        conversation = [
          ...state.conversation.slice(0, lastIdx),
          { ...last, text: last.text + event.token },
        ]
      } else {
        conversation = [
          ...state.conversation,
          { kind: "thinking", text: event.token, id: uid(), ts: Date.now() },
        ]
      }

      return { ...state, streamingText: state.streamingText + event.token, conversation }
    }

    // ── Tools ──────────────────────────────────────────────────────────────────
    case "tool.started": {
      const entry: ConversationEntry = {
        kind: "tool", status: "running",
        tool: event.tool, path: event.path,
        id: uid(), ts: Date.now(),
      }
      return { ...state, conversation: [...state.conversation, entry] }
    }

    case "tool.completed": {
      // Find the last matching running tool entry and mark it done
      const idx = [...state.conversation].reverse().findIndex(
        e => e.kind === "tool" && e.tool === event.tool && e.status === "running",
      )
      if (idx === -1) return state
      const realIdx = state.conversation.length - 1 - idx
      const updated = state.conversation.map((e, i) => {
        if (i !== realIdx || e.kind !== "tool") return e
        return { ...e, status: "done" as const, detail: event.detail, path: event.path ?? e.path }
      })
      return { ...state, conversation: updated }
    }

    case "tool.failed": {
      const idx = [...state.conversation].reverse().findIndex(
        e => e.kind === "tool" && e.tool === event.tool && e.status === "running",
      )
      if (idx === -1) return state
      const realIdx = state.conversation.length - 1 - idx
      const updated = state.conversation.map((e, i) => {
        if (i !== realIdx || e.kind !== "tool") return e
        return { ...e, status: "failed" as const, detail: event.error }
      })
      return { ...state, conversation: updated }
    }

    // ── Files ──────────────────────────────────────────────────────────────────
    case "file.opened":
      return {
        ...state,
        activeFilePath:     event.path,
        activeFileLanguage: event.language,
        files: {
          ...state.files,
          [event.path]: { language: event.language, content: "", complete: false },
        },
      }

    case "file.token": {
      const existing = state.files[event.path]
      if (!existing) return state
      return {
        ...state,
        files: {
          ...state.files,
          [event.path]: { ...existing, content: existing.content + event.token },
        },
      }
    }

    case "file.completed": {
      const conversationEntry: ConversationEntry = {
        kind: "file-change", path: event.path, operation: "create",
        id: uid(), ts: Date.now(),
      }
      return {
        ...state,
        fileCount:  state.fileCount + 1,
        activeFilePath: null,
        files: {
          ...state.files,
          [event.path]: { language: event.language, content: event.content, complete: true },
        },
        conversation: [...state.conversation, conversationEntry],
      }
    }

    case "file.changed": {
      const entry: ConversationEntry = {
        kind: "file-change", path: event.path, operation: event.operation,
        id: uid(), ts: Date.now(),
      }
      return {
        ...state,
        conversation: [...state.conversation, entry],
      }
    }

    // ── Validation ─────────────────────────────────────────────────────────────
    case "validation.result": {
      const entry: ConversationEntry = {
        kind: "validation",
        success: event.success,
        errors:  event.errors,
        fixed:   event.fixed,
        id:      uid(),
        ts:      Date.now(),
      }
      return {
        ...state,
        lastValidation: { success: event.success, errors: event.errors, fixed: event.fixed },
        conversation: [...state.conversation, entry],
      }
    }

    // ── Editing conversation ───────────────────────────────────────────────────
    case "user.message": {
      const entry: ConversationEntry = {
        kind: "user", text: event.text, id: event.id, ts: Date.now(),
      }
      return {
        ...state,
        status:       "editing",
        streamingText: "",
        conversation: [...state.conversation, entry],
      }
    }

    case "agent.streaming": {
      // Update the last agent entry if incomplete, else create a new one
      const lastIdx = state.conversation.length - 1
      const last    = state.conversation[lastIdx]
      let conversation: ConversationEntry[]

      if (last?.kind === "agent" && !last.complete) {
        conversation = [
          ...state.conversation.slice(0, lastIdx),
          { ...last, text: last.text + event.delta },
        ]
      } else {
        conversation = [
          ...state.conversation,
          { kind: "agent", text: event.delta, complete: false, id: uid(), ts: Date.now() },
        ]
      }

      return { ...state, streamingText: state.streamingText + event.delta, conversation }
    }

    case "agent.message": {
      // Seal the last agent entry (streaming complete) or add a new one
      const lastIdx = state.conversation.length - 1
      const last    = state.conversation[lastIdx]
      let conversation: ConversationEntry[]

      if (last?.kind === "agent" && !last.complete) {
        conversation = [
          ...state.conversation.slice(0, lastIdx),
          { ...last, text: event.text, complete: true },
        ]
      } else {
        conversation = [
          ...state.conversation,
          { kind: "agent", text: event.text, complete: true, id: event.id, ts: Date.now() },
        ]
      }

      return { ...state, streamingText: "", conversation }
    }

    case "plan.created": {
      const entry: ConversationEntry = {
        kind: "plan", text: event.text, id: event.id, ts: Date.now(),
      }
      return { ...state, conversation: [...state.conversation, entry] }
    }

    case "scan.started": {
      const entry: ConversationEntry = {
        kind: "scan", status: "running", id: uid(), ts: Date.now(),
      }
      return { ...state, conversation: [...state.conversation, entry] }
    }

    case "scan.completed": {
      const idx = [...state.conversation].reverse().findIndex(
        e => e.kind === "scan" && e.status === "running",
      )
      if (idx === -1) return state
      const realIdx = state.conversation.length - 1 - idx
      const updated = state.conversation.map((e, i) => {
        if (i !== realIdx || e.kind !== "scan") return e
        return { ...e, status: "done" as const, summary: event.summary }
      })
      return { ...state, conversation: updated }
    }

    case "scan.failed": {
      const idx = [...state.conversation].reverse().findIndex(
        e => e.kind === "scan" && e.status === "running",
      )
      if (idx === -1) return state
      const realIdx = state.conversation.length - 1 - idx
      const updated = state.conversation.map((e, i) => {
        if (i !== realIdx || e.kind !== "scan") return e
        return { ...e, status: "failed" as const }
      })
      return { ...state, conversation: updated }
    }

    default:
      return state
  }
}
