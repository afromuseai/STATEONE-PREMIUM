// ─── Marcus Stream Generation Hook ────────────────────────────────────────────
// Connects to POST /api/generate/website-v2/stream and processes SSE events.
// Provides real-time file tokens, agent thinking, and project completion.

import { useState, useRef, useCallback } from "react"

export interface StreamFile {
  path:     string
  language: string
  content:  string  // accumulated content
}

export type GenerationStatus =
  | "idle"
  | "connecting"
  | "thinking"
  | "writing"
  | "saving"
  | "done"
  | "error"

export interface GenerationState {
  status:        GenerationStatus
  projectId:     string | null
  thinkingText:  string              // Marcus's thinking output
  files:         StreamFile[]        // files completed so far
  activeFilePath: string | null      // file currently being written
  activeFileContent: string          // content accumulating for active file
  activeFileLanguage: string
  error:         string | null
  fileCount:     number              // how many files done
}

export interface UseMarcusStreamGenerationReturn {
  state:    GenerationState
  generate: (idea: string, businessIntelligence?: Record<string, unknown>) => Promise<string | null>
  cancel:   () => void
}

const INITIAL_STATE: GenerationState = {
  status:            "idle",
  projectId:         null,
  thinkingText:      "",
  files:             [],
  activeFilePath:    null,
  activeFileContent: "",
  activeFileLanguage: "typescript",
  error:             null,
  fileCount:         0,
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

    setState({
      ...INITIAL_STATE,
      status: "connecting",
    })

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

          if (phase === "project-created") {
            capturedProjectId = String(msg.projectId ?? "")
            setState(prev => ({ ...prev, projectId: capturedProjectId }))
          }

          if (phase === "agent-thinking") {
            const token = String(msg.token ?? "")
            setState(prev => ({
              ...prev,
              status:       "thinking",
              thinkingText: prev.thinkingText + token,
            }))
          }

          if (phase === "file-start") {
            const path     = String(msg.path ?? "")
            const language = String(msg.language ?? "typescript")
            setState(prev => ({
              ...prev,
              status:            "writing",
              activeFilePath:    path,
              activeFileContent: "",
              activeFileLanguage: language,
            }))
          }

          if (phase === "file-token") {
            const token = String(msg.token ?? "")
            setState(prev => ({
              ...prev,
              activeFileContent: prev.activeFileContent + token,
            }))
          }

          if (phase === "file-done") {
            const path    = String(msg.path ?? "")
            const content = String(msg.content ?? "")
            setState(prev => ({
              ...prev,
              fileCount:      prev.fileCount + 1,
              activeFilePath: null,
              activeFileContent: "",
              files: [
                ...prev.files.filter(f => f.path !== path),
                { path, language: prev.activeFileLanguage, content },
              ],
            }))
          }

          if (phase === "done") {
            const pid = String(msg.projectId ?? capturedProjectId ?? "")
            capturedProjectId = pid
            setState(prev => ({
              ...prev,
              status:    "done",
              projectId: pid,
            }))
            return pid
          }

          if (phase === "error") {
            const message = String(msg.message ?? "Generation failed")
            setState(prev => ({ ...prev, status: "error", error: message }))
            return null
          }
        }
      }

      // EOF without done — if we have a projectId, treat as success
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
