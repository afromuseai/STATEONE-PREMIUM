import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send, Loader, CheckCircle, AlertCircle, RefreshCw,
  FileCode, ChevronDown, ChevronUp, Search, FileEdit,
  Play, Save, Zap, User,
} from "lucide-react"
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

// ─── Tool card config ─────────────────────────────────────────────────────────
const TOOL_PHASES: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  analyzing:    { icon: Search,    label: "Analyzing project",    color: "#6366f1" },
  editing:      { icon: FileEdit,  label: "Generating edits",     color: "#f59e0b" },
  changes:      { icon: Zap,       label: "Applying changes",     color: "#f59e0b" },
  saved:        { icon: Save,      label: "Saving to database",   color: "#3b82f6" },
  regenerating: { icon: RefreshCw, label: "Rebuilding preview",   color: "#8b5cf6" },
  "preview-ready": { icon: Play,   label: "Preview ready",        color: "#10b981" },
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FileChange {
  path:      string
  operation: "update" | "create" | "delete"
  reason:    string
}

// Payload is the discriminated union WITHOUT id/time — those are always generated
type TimelinePayload =
  | { kind: "user-msg";    text: string }
  | { kind: "agent-msg";   text: string; changes?: FileChange[]; phase?: string }
  | { kind: "tool";        phase: string; status: "running" | "done" }
  | { kind: "file-change"; change: FileChange }

// Entry = payload + id + time
type TimelineEntry = TimelinePayload & { id: string; time: string }

function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

const OP_COLORS: Record<string, string> = {
  update: "#60a5fa",
  create: "#34d399",
  delete: "#f87171",
}
const OP_LABELS: Record<string, string> = {
  update: "edited",
  create: "created",
  delete: "deleted",
}

interface AgentPanelProps {
  project:        V2Project
  onEditComplete: () => void
  onFileOpen:     (file: V2ProjectFile) => void
}

export function AgentPanel({ project, onEditComplete }: AgentPanelProps) {
  const [instruction, setInstruction] = useState("")
  const [phase, setPhase]             = useState<string | null>(null)
  const [timeline, setTimeline]       = useState<TimelineEntry[]>([
    {
      kind: "agent-msg",
      id:   "welcome",
      text: `I'm your AI engineer working on **${project.projectName}**. Tell me what to change and I'll edit the files and rebuild the preview.`,
      time: nowTime(),
    },
  ])
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set())
  const [showFileSelect, setShowFileSelect] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const isRunning = phase !== null && phase !== "preview-ready" && phase !== "error"

  // Returns the generated id so callers can reference the entry for later updates
  const addEntry = useCallback((payload: TimelinePayload): string => {
    const id   = `e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const time = nowTime()
    setTimeline((prev) => [...prev, { ...payload, id, time } as TimelineEntry])
    return id
  }, [])

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [timeline])

  const submit = async () => {
    if (!instruction.trim() || isRunning) return

    const userText = instruction.trim()
    setInstruction("")

    addEntry({ kind: "user-msg", text: userText })

    abortRef.current?.abort()
    const controller  = new AbortController()
    abortRef.current  = controller

    setPhase("analyzing")
    addEntry({ kind: "tool", phase: "analyzing", status: "running" })

    let agentMsgAdded = false
    let agentMsgId    = ""   // filled when addEntry returns for the agent reply

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

      // Mark the analyzing tool as done once we get the first event
      let firstEvent = true

      for await (const event of readSseStream(response)) {
        const p = event.phase as string
        setPhase(p)

        if (firstEvent) {
          firstEvent = false
          // Mark previous tool done
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.phase === "analyzing" && e.status === "running"
                ? { ...e, status: "done" }
                : e
            )
          )
        }

        // Add tool card for meaningful phases
        if (["editing", "changes", "saved", "regenerating", "preview-ready"].includes(p)) {
          addEntry({ kind: "tool", phase: p, status: p === "preview-ready" ? "done" : "running" })
        }

        if (p === "changes" && event.data) {
          const data = event.data as { changes?: FileChange[]; summary?: string }
          const changes = data.changes ?? []

          // Mark changes tool done
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.phase === "changes" && e.status === "running"
                ? { ...e, status: "done" }
                : e
            )
          )

          // File change entries
          for (const c of changes) {
            addEntry({ kind: "file-change", change: c })
          }

          // Agent message
          if (!agentMsgAdded) {
            agentMsgAdded = true
            agentMsgId = addEntry({
              kind:    "agent-msg",
              text:    data.summary ?? `Made ${changes.length} file change${changes.length !== 1 ? "s" : ""}.`,
              changes,
            })
          }
        }

        if (p === "saved") {
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.phase === "saved" && e.status === "running"
                ? { ...e, status: "done" }
                : e
            )
          )
          onEditComplete()
        }

        if (p === "preview-ready") {
          setSelectedFiles(new Set())
          onEditComplete()
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "agent-msg" && e.id === agentMsgId
                ? { ...e, phase: "preview-ready" }
                : e
            )
          )
        }

        if (p === "error") {
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.status === "running"
                ? { ...e, status: "done" }
                : e
            )
          )
          addEntry({
            kind:  "agent-msg",
            text:  (event.message as string) ?? "Something went wrong. Please try again.",
            phase: "error",
          })
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return
      setPhase("error")
      setTimeline((prev) =>
        prev.map((e) =>
          e.kind === "tool" && e.status === "running" ? { ...e, status: "done" } : e
        )
      )
      addEntry({
        kind:  "agent-msg",
        text:  err instanceof Error ? err.message : "Edit failed. Please try again.",
        phase: "error",
      })
    } finally {
      setPhase(null)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="flex w-[268px] flex-shrink-0 flex-col border-r border-white/[0.06] bg-[#0b0b0b]">

      {/* ── Agent header ─────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-400/30 to-amber-600/20 ring-1 ring-amber-400/20">
            <span className="text-[13px] font-bold text-amber-400">M</span>
          </div>
          {/* Status dot */}
          <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0b]
            ${isRunning ? "bg-amber-400" : "bg-emerald-400"}`}>
            {isRunning && (
              <div className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-60" />
            )}
          </div>
        </div>
        {/* Name + status */}
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white/85">Marcus</div>
          <div className={`text-[10px] font-medium ${isRunning ? "text-amber-400/80" : "text-white/30"}`}>
            {isRunning
              ? (TOOL_PHASES[phase ?? ""]?.label ?? "Working…")
              : "AI Engineer · Ready"
            }
          </div>
        </div>
      </div>

      {/* ── Timeline ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-2">
          {timeline.map((entry) => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}

          {/* Live typing indicator when running between messages */}
          <AnimatePresence>
            {isRunning && phase && !["changes", "preview-ready", "error"].includes(phase) && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 py-1"
              >
                <div className="flex gap-[3px]">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="h-1 w-1 rounded-full bg-amber-400/60"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-white/30">
                  {TOOL_PHASES[phase]?.label ?? "Working…"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ── File focus selector ───────────────────────────────────────── */}
      <div className="border-t border-white/[0.05]">
        <button
          onClick={() => setShowFileSelect((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 text-[10px] text-white/25 hover:text-white/50 transition-colors"
        >
          <div className="flex items-center gap-1.5">
            <FileCode className="h-3 w-3" />
            <span>
              {selectedFiles.size > 0
                ? `${selectedFiles.size} file${selectedFiles.size !== 1 ? "s" : ""} in context`
                : "Add context (optional)"}
            </span>
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
              <div className="max-h-32 overflow-y-auto px-3 pb-2">
                {project.files.map((f) => (
                  <label key={f.path} className="flex cursor-pointer items-center gap-2 rounded py-[3px] hover:bg-white/[0.03]">
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
                    <span className="truncate font-mono text-[10px] text-white/40">{f.path}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Prompt input ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.03] focus-within:border-amber-400/20 focus-within:bg-white/[0.04] transition-all">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Marcus to change anything…"
            disabled={isRunning}
            rows={3}
            className="w-full resize-none bg-transparent px-3 py-2.5 pr-9 text-[12px] text-white/75 placeholder-white/20 outline-none disabled:opacity-40"
          />
          <button
            onClick={submit}
            disabled={!instruction.trim() || isRunning}
            className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-amber-400/15 text-amber-400 transition-all hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isRunning
              ? <Loader className="h-3 w-3 animate-spin" />
              : <Send   className="h-3 w-3" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/18">⌘↵ to send</p>
      </div>
    </div>
  )
}

// ─── Timeline item renderer ────────────────────────────────────────────────────
function TimelineItem({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "user-msg") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex justify-end gap-2"
      >
        <div className="max-w-[190px] rounded-2xl rounded-tr-sm bg-white/[0.07] px-3 py-2">
          <p className="text-[12px] leading-[1.5] text-white/70">{entry.text}</p>
          <p className="mt-1 text-right text-[9px] text-white/20">{entry.time}</p>
        </div>
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.07]">
          <User className="h-3 w-3 text-white/35" />
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "agent-msg") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex gap-2"
      >
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/15">
          <span className="text-[9px] font-bold text-amber-400">M</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl rounded-tl-sm bg-white/[0.04] px-3 py-2">
            <p className="text-[12px] leading-[1.5] text-white/65">{entry.text}</p>
            {entry.changes && entry.changes.length > 0 && (
              <div className="mt-2 flex items-center gap-1 border-t border-white/[0.06] pt-1.5">
                <FileCode className="h-3 w-3 text-white/25" />
                <span className="text-[10px] text-white/30">
                  {entry.changes.length} file{entry.changes.length !== 1 ? "s" : ""} changed
                </span>
                {entry.phase === "preview-ready" && (
                  <div className="ml-auto flex items-center gap-1 text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    <span className="text-[10px]">Live</span>
                  </div>
                )}
                {entry.phase === "error" && (
                  <div className="ml-auto flex items-center gap-1 text-red-400">
                    <AlertCircle className="h-3 w-3" />
                    <span className="text-[10px]">Failed</span>
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="mt-0.5 pl-1 text-[9px] text-white/18">{entry.time}</p>
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "tool") {
    const cfg = TOOL_PHASES[entry.phase]
    if (!cfg) return null
    const Icon = cfg.icon
    const done = entry.status === "done"
    return (
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
      >
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
          style={{ background: `${cfg.color}1a` }}
        >
          {done
            ? <CheckCircle className="h-3 w-3" style={{ color: cfg.color }} />
            : <Icon className={`h-3 w-3 ${entry.phase !== "preview-ready" ? "animate-spin" : ""}`} style={{ color: cfg.color }} />
          }
        </div>
        <span className="text-[11px] text-white/50">{cfg.label}</span>
        <span className="ml-auto text-[9px] text-white/20">{entry.time}</span>
      </motion.div>
    )
  }

  if (entry.kind === "file-change") {
    const { change } = entry
    const color = OP_COLORS[change.operation] ?? "#9ca3af"
    const label = OP_LABELS[change.operation] ?? change.operation
    const fileName = change.path.split("/").pop() ?? change.path

    return (
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.015] px-2.5 py-1.5 pl-7"
      >
        <FileCode className="h-3 w-3 flex-shrink-0 text-white/25" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/50">{fileName}</span>
        <span
          className="flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: `${color}18`, color }}
        >
          {label}
        </span>
      </motion.div>
    )
  }

  return null
}
