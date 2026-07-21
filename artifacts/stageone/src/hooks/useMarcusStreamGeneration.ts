// ─── Marcus Stream Generation Hook ────────────────────────────────────────────
// Connects to POST /api/generate/website-v2/stream and processes SSE events.
// Provides real-time file tokens, agent thinking, loop phases, and tool events.

import { useState, useRef, useCallback } from "react"

export interface StreamFile {
  path:     string
  language: string
  content:  string
}

export type GenerationStatus =
  | "idle"
  | "connecting"
  | "thinking"
  | "writing"
  | "saving"
  | "done"
  | "error"

export type LoopPhase =
  | "UNDERSTAND"
  | "PLAN"
  | "EXECUTE"
  | "OBSERVE"
  | "FIX"
  | "VALIDATE"
  | "REPORT"

export type ToolStatus = "start" | "done" | "failed"

export interface ToolEvent {
  id:        string
  tool:      string
  status:    ToolStatus
  path?:     string
  detail?:   string
  timestamp: number
}

export interface ValidationEvent {
  success: boolean
  errors:  string[]
  fixed:   boolean
}

export interface GenerationState {
  status:             GenerationStatus
  projectId:          string | null
  thinkingText:       string
  files:              StreamFile[]
  activeFilePath:     string | null
  activeFileContent:  string
  activeFileLanguage: string
  error:              string | null
  fileCount:          number
  // Autonomous loop additions:
  loopPhase:          LoopPhase | null
  loopPhaseMessage:   string
  toolEvents:         ToolEvent[]
  lastValidation:     ValidationEvent | null
  fixIteration:       number
}

export interface UseMarcusStreamGenerationReturn {
  state:    GenerationState
  generate: (idea: string, businessIntelligence?: Record<string, unknown>) => Promise<string | null>
  cancel:   () => void
}

const INITIAL_STATE: GenerationState = {
  status:             "idle",
  projectId:          null,
  thinkingText:       "",
  files:              [],
  activeFilePath:     null,
  activeFileContent:  "",
  activeFileLanguage: "typescript",
  error:              null,
  fileCount:          0,
  loopPhase:          null,
  loopPhaseMessage:   "",
  toolEvents:         [],
  lastValidation:     null,
  fixIteration:       0,
}

let _toolEventCounter = 0
function toolEventId() {
  return `tool-${Date.now()}-${++_toolEventCounter}`
}

export function useMarcusStreamGeneration(): UseMarcusStreamGenerationReturn {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE)
  const abortRef = useRef<AbortController | null>(null)

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState(prev => ({ ...prev, status: "idle" }))
  }, [])

  const generate = useCallback(async (
    idea: string,
    businessIntelligence?: Record<string, unknown>,
  ): Promise<string | null> => {
    abortRef.current?.abort()
    const abort = new AbortController()
    abortRef.current = abort

    setState({ ...INITIAL_STATE, status: "connecting" })

    let capturedProjectId: string | null = null

    try {
      const res = await fetch("/api/generate/website-v2/stream", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({ idea, businessIntelligence }),
        signal:      abort.signal,
      })

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({})) as Record<string, unknown>
        const message = errData.error === "UPGRADE_REQUIRED"
          ? "Upgrade required to use Website Studio"
          : `Access denied (${res.status})`
        setState(prev => ({ ...prev, status: "error", error: message }))
        return null
      }

      if (!res.ok || !res.body) {
        setState(prev => ({ ...prev, status: "error", error: `HTTP ${res.status}` }))
        return null
      }

      setState(prev => ({ ...prev, status: "thinking" }))

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let carry = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = carry + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          let msg: Record<string, unknown>
          try {
            msg = JSON.parse(line.slice(6)) as Record<string, unknown>
          } catch { continue }

          const phase = msg.phase as string | undefined

          // ── project-created ──────────────────────────────────────────────
          if (phase === "project-created") {
            capturedProjectId = String(msg.projectId ?? "")
            setState(prev => ({ ...prev, projectId: capturedProjectId }))
          }

          // ── agent-thinking ───────────────────────────────────────────────
          if (phase === "agent-thinking") {
            const token = String(msg.token ?? "")
            setState(prev => ({
              ...prev,
              status:       "thinking",
              thinkingText: prev.thinkingText + token,
            }))
          }

          // ── file-start ───────────────────────────────────────────────────
          if (phase === "file-start") {
            const path     = String(msg.path ?? "")
            const language = String(msg.language ?? "typescript")
            setState(prev => ({
              ...prev,
              status:             "writing",
              activeFilePath:     path,
              activeFileContent:  "",
              activeFileLanguage: language,
            }))
          }

          // ── file-token ───────────────────────────────────────────────────
          if (phase === "file-token") {
            const token = String(msg.token ?? "")
            setState(prev => ({
              ...prev,
              activeFileContent: prev.activeFileContent + token,
            }))
          }

          // ── file-done ────────────────────────────────────────────────────
          if (phase === "file-done") {
            const path    = String(msg.path ?? "")
            const content = String(msg.content ?? "")
            setState(prev => ({
              ...prev,
              fileCount:         prev.fileCount + 1,
              activeFilePath:    null,
              activeFileContent: "",
              files: [
                ...prev.files.filter(f => f.path !== path),
                { path, language: prev.activeFileLanguage, content },
              ],
            }))
          }

          // ── loop-phase (autonomous loop) ─────────────────────────────────
          if (phase === "loop-phase") {
            const loopPhase = msg.loopPhase as LoopPhase
            const message   = String(msg.message ?? "")
            // FIX phase increments the fix iteration counter
            setState(prev => ({
              ...prev,
              loopPhase,
              loopPhaseMessage: message,
              fixIteration: loopPhase === "FIX" ? prev.fixIteration + 1 : prev.fixIteration,
            }))
          }

          // ── tool-call (autonomous loop) ──────────────────────────────────
          if (phase === "tool-call") {
            const tool   = String(msg.tool ?? "")
            const status = msg.status as ToolStatus
            const path   = msg.path   ? String(msg.path)   : undefined
            const detail = msg.detail ? String(msg.detail) : undefined

            const event: ToolEvent = {
              id:        toolEventId(),
              tool,
              status,
              path,
              detail,
              timestamp: Date.now(),
            }

            setState(prev => ({
              ...prev,
              // Keep last 50 tool events to avoid unbounded growth
              toolEvents: [...prev.toolEvents.slice(-49), event],
            }))
          }

          // ── validation (autonomous loop) ─────────────────────────────────
          if (phase === "validation") {
            const validationEvent: ValidationEvent = {
              success: Boolean(msg.success),
              errors:  Array.isArray(msg.errors) ? (msg.errors as string[]) : [],
              fixed:   Boolean(msg.fixed),
            }
            setState(prev => ({ ...prev, lastValidation: validationEvent }))
          }

          // ── done ─────────────────────────────────────────────────────────
          if (phase === "done") {
            const pid = String(msg.projectId ?? capturedProjectId ?? "")
            capturedProjectId = pid
            setState(prev => ({
              ...prev,
              status:    "done",
              projectId: pid,
              loopPhase: "REPORT",
            }))
            return pid
          }

          // ── error ────────────────────────────────────────────────────────
          if (phase === "error") {
            const message = String(msg.message ?? "Generation failed")
            setState(prev => ({ ...prev, status: "error", error: message }))
            return null
          }
        }
      }

      // EOF without done frame — treat as success if we have a projectId
      if (capturedProjectId) {
        setState(prev => ({ ...prev, status: "done", projectId: capturedProjectId }))
        return capturedProjectId
      }

      setState(prev => ({ ...prev, status: "error", error: "Stream ended without completing" }))
      return null

    } catch (err) {
      if ((err as Error).name === "AbortError") {
        setState(prev => ({ ...prev, status: "idle" }))
        return null
      }
      const message = err instanceof Error ? err.message : "Connection error"
      setState(prev => ({ ...prev, status: "error", error: message }))
      return null
    }
  }, [])

  return { state, generate, cancel }
}
