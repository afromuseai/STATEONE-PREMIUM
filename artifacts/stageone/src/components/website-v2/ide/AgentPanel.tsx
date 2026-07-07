import { useState, useRef, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles, Send, Loader, CheckCircle, AlertCircle, RefreshCw,
  FileCode, ChevronDown, ChevronUp, Bot, User,
} from "lucide-react"
import { AgentActivity } from "./AgentActivity"
import type { ActivityItem } from "./AgentActivity"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── SSE helper ───────────────────────────────────────────────────────────────
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
      try { yield JSON.parse(line.slice(6)) as Record<string, unknown> } catch { /* skip */ }
    }
  }
}

// ─── Phase labels ─────────────────────────────────────────────────────────────
const PHASE_LABELS: Record<string, string> = {
  analyzing:       "Analyzing project…",
  editing:         "Generating changes…",
  changes:         "Applying changes…",
  saved:           "Saving files…",
  regenerating:    "Regenerating preview…",
  "preview-ready": "Done! Preview updated.",
  error:           "Edit failed",
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FileChange {
  path:      string
  operation: "update" | "create" | "delete"
  reason:    string
}

interface ConversationMessage {
  id:      string
  role:    "user" | "agent"
  text:    string
  phase?:  string
  changes?: FileChange[]
}

interface AgentPanelProps {
  project:        V2Project
  onEditComplete: () => void
  onFileChange:   (file: V2ProjectFile) => void
}

export function AgentPanel({ project, onEditComplete, onFileChange }: AgentPanelProps) {
  const [instruction, setInstruction] = useState("")
  const [phase, setPhase]             = useState<string | null>(null)
  const [messages, setMessages]       = useState<ConversationMessage[]>([
    {
      id:   "welcome",
      role: "agent",
      text: `I'm working on **${project.projectName}**. Ask me to make changes — redesign sections, update content, add features — and I'll edit your files and refresh the preview.`,
    },
  ])
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([])
  const [showActivity, setShowActivity]   = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showFileSelect, setShowFileSelect] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const isRunning = phase !== null && phase !== "preview-ready" && phase !== "error"

  const addActivity = useCallback((item: Omit<ActivityItem, "id" | "timestamp">) => {
    setActivityItems((prev) => [
      ...prev,
      { ...item, id: `${Date.now()}-${Math.random()}`, timestamp: Date.now() },
    ])
  }, [])

  const submit = async () => {
    if (!instruction.trim() || isRunning) return

    const userText = instruction.trim()
    setInstruction("")
    setActivityItems([])

    // Add user message
    const userId = `u-${Date.now()}`
    setMessages((prev) => [...prev, { id: userId, role: "user", text: userText }])

    abortRef.current?.abort()
    const controller  = new AbortController()
    abortRef.current  = controller

    setPhase("analyzing")
    addActivity({ type: "phase", phase: "Analyzing project…" })

    let agentMsgId = `a-${Date.now()}`

    try {
      const response = await fetch(`/api/website-v2/projects/${project.id}/edit`, {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body: JSON.stringify({
          instruction:   userText,
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
          const changes = data.changes ?? []

          addActivity({ type: "phase", phase: "Applying file changes…" })
          for (const c of changes) {
            addActivity({ type: "file_change", path: c.path, operation: c.operation, reason: c.reason })
          }

          // Start or update the agent reply message
          setMessages((prev) => {
            const exists = prev.find((m) => m.id === agentMsgId)
            const agentMsg: ConversationMessage = {
              id:      agentMsgId,
              role:    "agent",
              text:    data.summary ?? `Made ${changes.length} file change${changes.length !== 1 ? "s" : ""}.`,
              changes,
            }
            return exists ? prev.map((m) => (m.id === agentMsgId ? agentMsg : m)) : [...prev, agentMsg]
          })
          setShowActivity(true)
        }

        if (p === "saved") {
          addActivity({ type: "phase", phase: "Saving to database…" })
          onEditComplete()
        }

        if (p === "preview-ready") {
          addActivity({ type: "phase", phase: "Preview updated ✓" })
          setSelectedFiles(new Set())
          onEditComplete()
          setMessages((prev) =>
            prev.map((m) =>
              m.id === agentMsgId ? { ...m, phase: "preview-ready" } : m
            )
          )
        }

        if (p === "error") {
          setMessages((prev) => [
            ...prev,
            {
              id:   `err-${Date.now()}`,
              role: "agent",
              text: (event.message as string) ?? "Something went wrong. Please try again.",
              phase: "error",
            },
          ])
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setPhase("error")
      setMessages((prev) => [
        ...prev,
        {
          id:   `err-${Date.now()}`,
          role: "agent",
          text: err instanceof Error ? err.message : "Edit failed. Please try again.",
          phase: "error",
        },
      ])
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex w-[280px] flex-shrink-0 flex-col border-r border-white/[0.07] bg-[#0a0a0a]">
      {/* Panel header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/[0.07] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div>
            <span className="text-[12px] font-bold text-white/85">Agent Marcus</span>
          </div>
        </div>
        {phase && phase !== "preview-ready" && phase !== "error" && (
          <div className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2 py-0.5">
            <Loader className="h-2.5 w-2.5 animate-spin text-amber-400" />
            <span className="text-[10px] font-semibold text-amber-400">Working</span>
          </div>
        )}
        {phase === "preview-ready" && (
          <div className="flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5">
            <CheckCircle className="h-2.5 w-2.5 text-emerald-400" />
            <span className="text-[10px] font-semibold text-emerald-400">Done</span>
          </div>
        )}
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            {/* Avatar */}
            <div className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md
              ${msg.role === "agent" ? "bg-amber-400/15" : "bg-white/[0.05]"}`}>
              {msg.role === "agent"
                ? <Bot  className="h-3.5 w-3.5 text-amber-400" />
                : <User className="h-3.5 w-3.5 text-white/40" />}
            </div>

            {/* Bubble */}
            <div className={`max-w-[200px] rounded-xl px-3 py-2 text-[12px] leading-[1.55]
              ${msg.role === "agent"
                ? "rounded-tl-sm bg-white/[0.04] text-white/75"
                : "rounded-tr-sm bg-amber-400/10 text-amber-200/90 text-right"
              }`}
            >
              <p>{msg.text}</p>

              {/* Success/error badge */}
              {msg.phase === "preview-ready" && (
                <div className="mt-1.5 flex items-center gap-1 text-emerald-400">
                  <CheckCircle className="h-3 w-3" />
                  <span className="text-[10px]">Preview updated</span>
                </div>
              )}
              {msg.phase === "error" && (
                <div className="mt-1.5 flex items-center gap-1 text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  <span className="text-[10px]">Failed</span>
                </div>
              )}

              {/* Changed files count */}
              {msg.changes && msg.changes.length > 0 && (
                <div className="mt-1.5 flex items-center gap-1 text-white/35">
                  <FileCode className="h-2.5 w-2.5" />
                  <span className="text-[10px]">{msg.changes.length} file{msg.changes.length !== 1 ? "s" : ""} changed</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator while running */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-amber-400/15">
                <Bot className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <div className="rounded-xl rounded-tl-sm bg-white/[0.04] px-3 py-2">
                <div className="flex items-center gap-1.5">
                  {phase === "regenerating" || phase === "saved" ? (
                    <RefreshCw className="h-3 w-3 animate-spin text-blue-400" />
                  ) : (
                    <Loader className="h-3 w-3 animate-spin text-amber-400" />
                  )}
                  <span className="text-[11px] text-white/50">
                    {PHASE_LABELS[phase ?? ""] ?? phase}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* Activity stream toggle */}
      {activityItems.length > 0 && (
        <div className="border-t border-white/[0.06]">
          <button
            onClick={() => setShowActivity((v) => !v)}
            className="flex w-full items-center justify-between px-3 py-2 text-[11px] text-white/35 hover:text-white/60 transition-colors"
          >
            <span className="font-semibold uppercase tracking-wider">Activity</span>
            <div className="flex items-center gap-1">
              <span className="text-white/25">{activityItems.length} events</span>
              {showActivity ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </button>
          <AnimatePresence>
            {showActivity && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="max-h-52 overflow-y-auto px-3 pb-2">
                  <AgentActivity items={activityItems} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* File focus selector */}
      <div className="border-t border-white/[0.06]">
        <button
          onClick={() => setShowFileSelect((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-[10px] text-white/30 hover:text-white/55 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <FileCode className="h-3 w-3" />
            <span>{selectedFiles.size > 0 ? `${selectedFiles.size} file${selectedFiles.size !== 1 ? "s" : ""} focused` : "Focus files (optional)"}</span>
          </div>
          {showFileSelect ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        <AnimatePresence>
          {showFileSelect && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="overflow-hidden"
            >
              <div className="max-h-36 overflow-y-auto px-3 pb-2">
                {project.files.map((f) => (
                  <label key={f.path} className="flex cursor-pointer items-center gap-2 rounded py-0.5 hover:bg-white/[0.03]">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(f.path)}
                      onChange={() => {
                        setSelectedFiles((prev) => {
                          const next = new Set(prev)
                          next.has(f.path) ? next.delete(f.path) : next.add(f.path)
                          return next
                        })
                      }}
                      className="h-3 w-3 accent-amber-400"
                    />
                    <span className="truncate font-mono text-[10px] text-white/45">{f.path}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Prompt input */}
      <div className="flex-shrink-0 border-t border-white/[0.07] p-3">
        <div className="relative">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Marcus to change anything… (⌘↵ to send)"
            disabled={isRunning}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 pr-10 text-[12px] text-white/80 placeholder-white/20 outline-none transition-all focus:border-amber-400/30 focus:bg-white/[0.06] disabled:opacity-40"
          />
          <button
            onClick={submit}
            disabled={!instruction.trim() || isRunning}
            className="absolute bottom-2.5 right-2.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/15 text-amber-400 transition-all hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isRunning
              ? <Loader className="h-3.5 w-3.5 animate-spin" />
              : <Send   className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/20">⌘↵ to send</p>
      </div>
    </div>
  )
}
