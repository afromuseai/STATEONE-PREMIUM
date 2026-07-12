import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, ArrowUp, CheckCircle, AlertCircle, Loader,
  ChevronDown, ChevronUp, FileCode, RefreshCw, Plus, X,
  ImageIcon, FileText, Layers,
} from "lucide-react"
import type { V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Orbit animation styles ───────────────────────────────────────────────────
const ORBIT_STYLE = `
@keyframes orbit-spin {
  0%   { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.orbit-wrapper {
  position: relative;
}
.orbit-wrapper::before {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 10px;
  background: conic-gradient(
    from var(--orbit-angle, 0deg),
    transparent 0%,
    transparent 30%,
    #D4A72C 50%,
    #ffffff 65%,
    transparent 80%,
    transparent 100%
  );
  animation: orbit-spin 2.4s linear infinite;
  z-index: 0;
}
.orbit-wrapper::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 9px;
  background: #202020;
  z-index: 1;
}
.orbit-inner {
  position: relative;
  z-index: 2;
}
`

// ─── Types ─────────────────────────────────────────────────────────────────────
type MarcusPhase = "UNDERSTAND" | "PLAN" | "DESIGN" | "BUILD" | "TEST" | "IMPROVE" | "REPORT"
type ConversationEventType = "message" | "action" | "step" | "file" | "warning" | "error" | "complete" | "progress"
type FileOperation = "create" | "update" | "delete" | "rename" | "read" | "open"

interface ConversationEvent {
  id: string
  type: ConversationEventType
  phase: MarcusPhase | null
  timestamp: string
  message: string
  metadata?: {
    path?: string
    operation?: FileOperation
    status?: string
    [key: string]: unknown
  }
}

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
      try { yield JSON.parse(line.slice(6)) as Record<string, unknown> }
      catch { /* skip malformed */ }
    }
  }
}

const PHASE_LABELS: Record<string, string> = {
  analyzing:       "Analyzing project…",
  editing:         "Generating changes…",
  changes:         "Applying changes…",
  saved:           "Files saved — regenerating preview…",
  regenerating:    "Regenerating preview…",
  "preview-ready": "Done — preview updated",
  error:           "Error",
}

interface FileChange {
  path:      string
  operation: "update" | "create" | "delete"
  reason:    string
}

interface AttachedFile {
  id:   string
  name: string
  type: "image" | "file" | "asset"
}

interface EditorChatPanelProps {
  projectId:      string
  files:          V2ProjectFile[]
  onEditComplete: () => void
  onOpenFile?:    (path: string) => void
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
  const [attachedFiles, setAttachedFiles]   = useState<AttachedFile[]>([])
  const [showAttachMenu, setShowAttachMenu] = useState(false)

  const abortRef       = useRef<AbortController | null>(null)
  const textareaRef    = useRef<HTMLTextAreaElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const attachMenuRef  = useRef<HTMLDivElement>(null)

  const isRunning        = phase !== null && phase !== "preview-ready" && phase !== "error"
  const isTerminalSuccess = phase === "preview-ready"
  const isTerminalError   = phase === "error"
  const canSend          = instruction.trim().length > 0 && !isRunning

  // ─── Auto-resize textarea ─────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    const next = Math.min(el.scrollHeight, 180)
    el.style.height = `${Math.max(next, 48)}px`
  }, [instruction])

  // ─── Close attach menu on outside click ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setShowAttachMenu(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev)
      next.has(path) ? next.delete(path) : next.add(path)
      return next
    })
  }

  const removeAttached = (id: string) => {
    setAttachedFiles(prev => prev.filter(f => f.id !== id))
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files
    if (!picked) return
    const newFiles: AttachedFile[] = Array.from(picked).map(f => ({
      id:   `${f.name}-${Date.now()}`,
      name: f.name,
      type: f.type.startsWith("image/") ? "image" : "file",
    }))
    setAttachedFiles(prev => [...prev, ...newFiles])
    setShowAttachMenu(false)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  // ─── Submit ───────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
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
        if (p === "saved")         { onEditComplete() }
        if (p === "preview-ready") {
          setInstruction("")
          setSelectedFiles(new Set())
          setAttachedFiles([])
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
  }, [instruction, isRunning, projectId, selectedFiles, onEditComplete])

  // ─── Key handler — Enter sends, Shift+Enter new line ─────────────────────
  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void submit()
    }
  }

  const reset = () => {
    setPhase(null)
    setSummary(null)
    setChanges([])
    setError(null)
  }

  // ─── AI status label ──────────────────────────────────────────────────────
  const aiStatusLabel = isRunning
    ? "Generating…"
    : isTerminalSuccess
    ? "Done"
    : isTerminalError
    ? "Error"
    : "Ready"

  const aiStatusColor = isRunning
    ? "text-amber-400"
    : isTerminalSuccess
    ? "text-emerald-400"
    : isTerminalError
    ? "text-red-400"
    : "text-white/30"

  return (
    <>
      <style>{ORBIT_STYLE}</style>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileInput}
      />

      <div className="flex flex-col border-t border-white/[0.06] bg-[#141414]">

        {/* File focus toggle */}
        <div className="flex items-center justify-between px-3 pt-2 pb-1">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3 text-amber-400/60" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25">
              AI Edit
            </span>
          </div>
          <button
            onClick={() => setShowFileSelect(!showFileSelect)}
            className="flex items-center gap-1 text-[10px] text-white/25 transition-colors hover:text-white/50"
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
              className="overflow-hidden border-t border-white/[0.05]"
            >
              <div className="max-h-28 overflow-y-auto px-3 py-1.5">
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
              className="mx-3 mt-1 mb-2 flex items-center justify-between rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-1.5"
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
                  isTerminalSuccess                                  ? "text-emerald-400"  :
                  isTerminalError                                    ? "text-red-400"      :
                  (phase === "regenerating" || phase === "saved")    ? "text-blue-400/80"  :
                  "text-white/55"
                }`}>
                  {isTerminalError                       ? (error ?? "Edit failed")       :
                   isTerminalSuccess && summary          ? summary                        :
                   PHASE_LABELS[phase]                  ?? phase}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {isTerminalSuccess && changes.length > 0 && (
                  <button
                    onClick={() => setShowChanges(!showChanges)}
                    className="text-[10px] text-white/30 hover:text-white/55"
                  >
                    {changes.length} file{changes.length !== 1 ? "s" : ""} changed
                    {showChanges
                      ? <ChevronUp   className="ml-1 inline h-2.5 w-2.5" />
                      : <ChevronDown className="ml-1 inline h-2.5 w-2.5" />}
                  </button>
                )}
                {(isTerminalSuccess || isTerminalError) && (
                  <button onClick={reset} className="text-[10px] text-white/25 hover:text-white/50">✕</button>
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
              <div className="mx-3 mb-2 rounded-lg border border-white/[0.07] bg-white/[0.02] p-2">
                {changes.map((c) => (
                  <div key={c.path} className="flex items-start gap-2 py-1">
                    <span className={`mt-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase
                      ${c.operation === "create" ? "bg-emerald-400/10 text-emerald-400" :
                        c.operation === "delete" ? "bg-red-400/10 text-red-400"         :
                        "bg-blue-400/10 text-blue-400"}`}>
                      {c.operation}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-[11px] text-white/65">{c.path}</p>
                      <p className="text-[10px] text-white/30">{c.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attached file chips */}
        <AnimatePresence>
          {attachedFiles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-1.5 px-3 pb-2 overflow-hidden"
            >
              {attachedFiles.map(f => (
                <div
                  key={f.id}
                  className="flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.05] px-2 py-1"
                >
                  {f.type === "image"
                    ? <ImageIcon className="h-3 w-3 text-white/40" />
                    : <FileText  className="h-3 w-3 text-white/40" />}
                  <span className="max-w-[120px] truncate text-[11px] text-white/60">{f.name}</span>
                  <button
                    onClick={() => removeAttached(f.id)}
                    className="ml-0.5 text-white/25 hover:text-white/60 transition-colors"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main composer */}
        <div className="px-3 pb-1">
          {/* Textarea with orbit border when running */}
          <div className={isRunning ? "orbit-wrapper" : ""}>
            <div className={`${isRunning ? "orbit-inner" : ""} flex items-end gap-2 rounded-[9px] border border-white/[0.08] bg-[#202020] px-3 py-2.5`}>

              {/* Attach button */}
              <div className="relative flex-shrink-0" ref={attachMenuRef}>
                <button
                  onClick={() => setShowAttachMenu(v => !v)}
                  disabled={isRunning}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/[0.07] hover:text-white/60 disabled:opacity-30"
                  title="Attach"
                >
                  <Plus className="h-4 w-4" />
                </button>

                <AnimatePresence>
                  {showAttachMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: 4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-2 w-44 rounded-xl border border-white/[0.1] bg-[#1a1a1a] shadow-2xl overflow-hidden z-50"
                    >
                      {[
                        { label: "Upload image",   icon: <ImageIcon className="h-3.5 w-3.5" />, action: () => { if (fileInputRef.current) { fileInputRef.current.accept = "image/*"; fileInputRef.current.click() } } },
                        { label: "Upload file",    icon: <FileText  className="h-3.5 w-3.5" />, action: () => { if (fileInputRef.current) { fileInputRef.current.accept = "*/*";     fileInputRef.current.click() } } },
                        { label: "Project assets", icon: <Layers    className="h-3.5 w-3.5" />, action: () => setShowAttachMenu(false) },
                      ].map(item => (
                        <button
                          key={item.label}
                          onClick={item.action}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-[12px] text-white/50 transition-colors hover:bg-white/[0.06] hover:text-white/80"
                        >
                          <span className="text-white/30">{item.icon}</span>
                          {item.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKey}
                placeholder={isRunning ? "AI is building your website…" : "Describe what you want to build…"}
                disabled={isRunning}
                rows={1}
                style={{ minHeight: "28px", maxHeight: "180px" }}
                className="flex-1 resize-none bg-transparent py-0.5 text-[13px] text-white/80 placeholder-white/20 outline-none disabled:cursor-not-allowed overflow-y-auto leading-relaxed"
              />

              {/* Send button */}
              <button
                onClick={() => void submit()}
                disabled={!canSend}
                className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md transition-all disabled:cursor-not-allowed disabled:opacity-25"
                style={canSend ? { backgroundColor: "#D4A72C" } : { backgroundColor: "rgba(255,255,255,0.07)" }}
                title="Send (Enter)"
              >
                {isRunning
                  ? <Loader  className="h-3.5 w-3.5 animate-spin text-black" />
                  : <ArrowUp className="h-3.5 w-3.5" style={{ color: canSend ? "#000" : "rgba(255,255,255,0.5)" }} />}
              </button>
            </div>
          </div>
        </div>

        {/* Composer footer */}
        <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
          {/* Left: attach label */}
          <button
            onClick={() => setShowAttachMenu(v => !v)}
            disabled={isRunning}
            className="flex items-center gap-1 text-[10px] text-white/25 transition-colors hover:text-white/50 disabled:opacity-30"
          >
            <Plus className="h-3 w-3" />
            Attach
          </button>

          {/* Center: hint */}
          <span className="text-[10px] text-white/20">
            Shift + Enter for new line
          </span>

          {/* Right: AI status */}
          <div className="flex items-center gap-1">
            {isRunning && (
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            )}
            <span className={`text-[10px] font-medium ${aiStatusColor}`}>
              {aiStatusLabel}
            </span>
          </div>
        </div>

      </div>
    </>
  )
}
