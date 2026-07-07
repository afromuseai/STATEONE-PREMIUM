import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Sparkles, Send, CheckCircle, AlertCircle, Loader, ChevronDown, ChevronUp, FileCode, RefreshCw } from "lucide-react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── SSE reader helper ────────────────────────────────────────────────────────
// POST + read text/event-stream without EventSource (which only supports GET).
async function* readSseStream(response: Response): AsyncGenerator<Record<string, unknown>> {
  const reader  = response.body!.getReader()
  const decoder = new TextDecoder()
  let buffer    = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split("\n\n")
    buffer = parts.pop() ?? ""

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith("data: ")) continue
      try {
        yield JSON.parse(line.slice(6)) as Record<string, unknown>
      } catch { /* skip malformed line */ }
    }
  }
}

// ─── Phase display config ─────────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  analyzing:       "Analyzing project…",
  editing:         "Generating changes…",
  changes:         "Applying changes…",
  saved:           "Files saved — regenerating preview…",
  regenerating:    "Regenerating preview…",
  "preview-ready": "Done — preview updated",
  error:           "Error",
}

// ─── Types ─────────────────────────────────────────────────────────────────────
interface FileChange {
  path:      string
  operation: "update" | "create" | "delete"
  reason:    string
}

interface EditorChatPanelProps {
  projectId:      string
  files:          V2ProjectFile[]
  onEditComplete: () => void
}

export function EditorChatPanel({ projectId, files, onEditComplete }: EditorChatPanelProps) {
  const [instruction, setInstruction]       = useState("")
  const [phase, setPhase]                   = useState<string | null>(null)
  const [summary, setSummary]               = useState<string | null>(null)
  const [changes, setChanges]               = useState<FileChange[]>([])
  const [error, setError]                   = useState<string | null>(null)
  const [showChanges, setShowChanges]       = useState(false)
  const [selectedFiles, setSelectedFiles]   = useState<Set<string>>(new Set())
  const [showFileSelect, setShowFileSelect] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Running = any phase before the two terminal phases (preview-ready / error)
  const isRunning = phase !== null && phase !== "preview-ready" && phase !== "error"

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const submit = async () => {
    if (!instruction.trim() || isRunning) return

    abortRef.current?.abort()
    const controller  = new AbortController()
    abortRef.current  = controller

    setPhase("analyzing")
    setSummary(null)
    setChanges([])
    setError(null)
    setShowChanges(false)

    try {
      const response = await fetch(`/api/website-v2/projects/${projectId}/edit`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          instruction:   instruction.trim(),
          selectedFiles: selectedFiles.size > 0 ? [...selectedFiles] : undefined,
        }),
        signal: controller.signal,
      })

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ message: "Request failed" }))
        throw new Error((body as { message?: string }).message ?? `HTTP ${response.status}`)
      }

      for await (const event of readSseStream(response)) {
        const p = event.phase as string
        setPhase(p)

        if (p === "changes" && event.data) {
          const data = event.data as { changes?: FileChange[]; summary?: string }
          setChanges(data.changes ?? [])
          setSummary(data.summary ?? null)
        }

        // Files are saved — immediately refresh the code explorer.
        if (p === "saved") {
          onEditComplete()
        }

        // Preview is saved — refresh again so the iframe gets the new HTML.
        if (p === "preview-ready") {
          setInstruction("")
          setSelectedFiles(new Set())
          onEditComplete()
        }

        if (p === "error") {
          setError((event.message as string) ?? "Unknown error")
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return
      setPhase("error")
      setError(err instanceof Error ? err.message : "Edit failed")
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const reset = () => {
    setPhase(null)
    setSummary(null)
    setChanges([])
    setError(null)
  }

  const isTerminalSuccess = phase === "preview-ready"
  const isTerminalError   = phase === "error"

  return (
    <div className="flex flex-col border-t border-white/8 bg-black/30">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-white/40">
            AI Edit
          </span>
        </div>

        {/* File focus toggle */}
        <button
          onClick={() => setShowFileSelect(!showFileSelect)}
          className="flex items-center gap-1 text-[10px] text-white/30 transition-colors hover:text-white/60"
        >
          <FileCode className="h-3 w-3" />
          {selectedFiles.size > 0 ? `${selectedFiles.size} focused` : "Focus files"}
          {showFileSelect ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* File selector */}
      <AnimatePresence>
        {showFileSelect && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden border-t border-white/5"
          >
            <div className="max-h-32 overflow-y-auto px-3 py-1.5">
              <p className="mb-1.5 text-[10px] text-white/25">
                Select files the AI should focus on (optional):
              </p>
              {files.map((f) => (
                <label
                  key={f.path}
                  className="flex cursor-pointer items-center gap-2 rounded py-0.5 hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={selectedFiles.has(f.path)}
                    onChange={() => toggleFile(f.path)}
                    className="h-3 w-3 accent-amber-400"
                  />
                  <span className="truncate font-mono text-[11px] text-white/50">{f.path}</span>
                </label>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status strip */}
      <AnimatePresence mode="popLayout">
        {phase && (
          <motion.div
            key={phase}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-3 mb-2 flex items-center justify-between rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {isTerminalSuccess ? (
                <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
              ) : isTerminalError ? (
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
              ) : phase === "regenerating" || phase === "saved" ? (
                <RefreshCw className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-blue-400" />
              ) : (
                <Loader className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-amber-400" />
              )}
              <span className={`text-xs ${
                isTerminalSuccess ? "text-emerald-400" :
                isTerminalError   ? "text-red-400"     :
                (phase === "regenerating" || phase === "saved") ? "text-blue-400/80" :
                "text-white/60"
              }`}>
                {isTerminalError   ? (error ?? "Edit failed")                          :
                 isTerminalSuccess && summary ? summary                                :
                 PHASE_LABELS[phase] ?? phase}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isTerminalSuccess && changes.length > 0 && (
                <button
                  onClick={() => setShowChanges(!showChanges)}
                  className="text-[10px] text-white/35 hover:text-white/60"
                >
                  {changes.length} file{changes.length !== 1 ? "s" : ""} changed
                  {showChanges
                    ? <ChevronUp   className="ml-1 inline h-2.5 w-2.5" />
                    : <ChevronDown className="ml-1 inline h-2.5 w-2.5" />}
                </button>
              )}
              {(isTerminalSuccess || isTerminalError) && (
                <button onClick={reset} className="text-[10px] text-white/25 hover:text-white/50">
                  ✕
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Changed files list */}
      <AnimatePresence>
        {showChanges && changes.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="mx-3 mb-2 rounded-lg border border-white/8 bg-white/[0.02] p-2">
              {changes.map((c) => (
                <div key={c.path} className="flex items-start gap-2 py-1">
                  <span className={`mt-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase
                    ${c.operation === "create" ? "bg-emerald-400/10 text-emerald-400" :
                      c.operation === "delete" ? "bg-red-400/10 text-red-400"         :
                      "bg-blue-400/10 text-blue-400"}`}>
                    {c.operation}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[11px] text-white/70">{c.path}</p>
                    <p className="text-[10px] text-white/30">{c.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex items-end gap-2 px-3 pb-3">
        <textarea
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Make the hero more premium… (⌘↵ to send)"
          disabled={isRunning}
          rows={2}
          className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[12px] text-white/80 placeholder-white/20 outline-none transition-colors focus:border-amber-400/30 focus:bg-white/[0.06] disabled:opacity-40"
        />
        <button
          onClick={submit}
          disabled={!instruction.trim() || isRunning}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400 transition-all hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isRunning
            ? <Loader className="h-3.5 w-3.5 animate-spin" />
            : <Send   className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  )
}
