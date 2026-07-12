// ─── Marcus Session — Backward Compatibility Shim ────────────────────────────
// Derives the old GenerationState shape from MarcusSessionState so existing
// components that receive GenerationState as a prop continue to work unchanged.
// Nothing here imports React — this is pure TypeScript.

import type { GenerationState, LoopPhase } from "@/hooks/useMarcusStreamGeneration"
import type { MarcusSessionState } from "./types"

export function deriveGenerationState(s: MarcusSessionState): GenerationState {
  const statusMap: Record<string, GenerationState["status"]> = {
    idle:       "idle",
    generating: "writing",
    editing:    "done",
    completed:  "done",
    failed:     "error",
  }

  const completedFiles = Object.entries(s.files)
    .filter(([, f]) => f.complete)
    .map(([path, f]) => ({ path, language: f.language, content: f.content }))

  const activeFile = s.activeFilePath ? s.files[s.activeFilePath] : null

  const thinkingEntry = [...s.conversation].reverse().find(e => e.kind === "thinking")
  const thinkingText  = thinkingEntry?.kind === "thinking" ? thinkingEntry.text : ""

  const toolEvents = s.conversation
    .filter(e => e.kind === "tool")
    .slice(-50)
    .map(e => {
      if (e.kind !== "tool") return null as never
      return {
        id:        e.id,
        tool:      e.tool,
        status:    e.status as "start" | "done" | "failed",
        path:      e.path,
        detail:    e.detail,
        timestamp: e.ts,
      }
    })

  return {
    status:             s.status === "generating" && !s.activeFilePath ? "thinking" : (statusMap[s.status] ?? "idle"),
    projectId:          s.projectId,
    thinkingText,
    files:              completedFiles,
    activeFilePath:     s.activeFilePath,
    activeFileContent:  activeFile?.content ?? "",
    activeFileLanguage: s.activeFileLanguage,
    error:              s.error,
    fileCount:          s.fileCount,
    loopPhase:          s.currentPhase as LoopPhase | null,
    loopPhaseMessage:   s.phaseMessage,
    toolEvents,
    lastValidation:     s.lastValidation,
    fixIteration:       s.fixIteration,
  }
}
