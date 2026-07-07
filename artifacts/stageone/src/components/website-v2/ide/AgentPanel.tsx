import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send, Loader, CheckCircle, AlertCircle, RefreshCw,
  FileCode, ChevronDown, ChevronUp, Search, FileEdit,
  Play, Save, Zap, User, Cpu,
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
  analyzing:       { icon: Search,    label: "Analyzing project",   color: "#818cf8" },
  editing:         { icon: FileEdit,  label: "Generating edits",    color: "#f59e0b" },
  changes:         { icon: Zap,       label: "Applying changes",    color: "#f59e0b" },
  saved:           { icon: Save,      label: "Saving to database",  color: "#3b82f6" },
  regenerating:    { icon: RefreshCw, label: "Rebuilding preview",  color: "#8b5cf6" },
  "preview-ready": { icon: Play,      label: "Preview ready",       color: "#10b981" },
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface FileChange {
  path:      string
  operation: "update" | "create" | "delete"
  reason:    string
}

type TimelinePayload =
  | { kind: "user-msg";    text: string }
  | { kind: "agent-msg";   text: string; changes?: FileChange[]; phase?: string }
  | { kind: "tool";        phase: string; status: "running" | "done" }
  | { kind: "file-change"; change: FileChange }

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
  const abortRef  = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  const isRunning = phase !== null && phase !== "preview-ready" && phase !== "error"

  const addEntry = useCallback((payload: TimelinePayload): string => {
    const id   = `e-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const time = nowTime()
    setTimeline((prev) => [...prev, { ...payload, id, time } as TimelineEntry])
    return id
  }, [])

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
    let agentMsgId    = ""

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

      let firstEvent = true
      for await (const event of readSseStream(response)) {
        const p = event.phase as string
        setPhase(p)

        if (firstEvent) {
          firstEvent = false
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.phase === "analyzing" && e.status === "running"
                ? { ...e, status: "done" }
                : e
            )
          )
        }

        if (["editing", "changes", "saved", "regenerating", "preview-ready"].includes(p)) {
          addEntry({ kind: "tool", phase: p, status: p === "preview-ready" ? "done" : "running" })
        }

        if (p === "changes" && event.data) {
          const data    = event.data as { changes?: FileChange[]; summary?: string }
          const changes = data.changes ?? []
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.phase === "changes" && e.status === "running"
                ? { ...e, status: "done" } : e
            )
          )
          for (const c of changes) addEntry({ kind: "file-change", change: c })
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
                ? { ...e, status: "done" } : e
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
                ? { ...e, phase: "preview-ready" } : e
            )
          )
        }

        if (p === "error") {
          setTimeline((prev) =>
            prev.map((e) =>
              e.kind === "tool" && e.status === "running" ? { ...e, status: "done" } : e
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
        prev.map((e) => e.kind === "tool" && e.status === "running" ? { ...e, status: "done" } : e)
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
    <div className="relative flex w-[268px] flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#0b0b0b]">

      {/* ── Running glow: animated left edge ─────────────────────────── */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[2px]"
            style={{
              background: "linear-gradient(to bottom, transparent 0%, #f59e0b 30%, #fbbf24 50%, #f59e0b 70%, transparent 100%)",
            }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{
                background: "inherit",
                filter: "blur(4px)",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Agent header ─────────────────────────────────────────────── */}
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        {/* Subtle gradient wash when running */}
        <AnimatePresence>
          {isRunning && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{
                background: "linear-gradient(135deg, #f59e0b08 0%, transparent 60%)",
              }}
            />
          )}
        </AnimatePresence>

        {/* Avatar */}
        <div className="relative z-[1] flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/25 to-amber-700/15 ring-1 ring-amber-400/25">
            <Cpu className="h-3.5 w-3.5 text-amber-400" />
          </div>
          {/* Status dot */}
          <div
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0b] transition-colors duration-500
              ${isRunning ? "bg-amber-400" : "bg-emerald-400"}`}
          >
            {isRunning && (
              <div className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75" />
            )}
          </div>
        </div>

        {/* Name + status */}
        <div className="relative z-[1] min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-white/85">Marcus</span>
            <span className="rounded bg-white/[0.05] px-1 py-px text-[9px] font-medium text-white/25">AI Engineer</span>
          </div>
          <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium transition-colors duration-300
            ${isRunning ? "text-amber-400/80" : "text-emerald-400/60"}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${isRunning ? "bg-amber-400" : "bg-emerald-400"}`} />
            {isRunning
              ? (TOOL_PHASES[phase ?? ""]?.label ?? "Working…")
              : "Ready"
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

          {/* Live dots between messages */}
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
                      className="h-[5px] w-[5px] rounded-full bg-amber-400/50"
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/25">
                  {TOOL_PHASES[phase]?.label ?? "Working…"}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={bottomRef} className="h-2" />
      </div>

      {/* ── File context selector ─────────────────────────────────────── */}
      <div className="border-t border-white/[0.05]">
        <button
          onClick={() => setShowFileSelect((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-2 text-[10px] text-white/22 transition-colors hover:text-white/45"
        >
          <div className="flex items-center gap-1.5">
            <FileCode className="h-3 w-3" />
            <span>
              {selectedFiles.size > 0
                ? `${selectedFiles.size} file${selectedFiles.size !== 1 ? "s" : ""} in context`
                : "Add context (optional)"}
            </span>
          </div>
          {showFileSelect
            ? <ChevronUp   className="h-3 w-3" />
            : <ChevronDown className="h-3 w-3" />
          }
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
                    <span className="truncate font-mono text-[10px] text-white/38">{f.path}</span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Prompt input ─────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] transition-all duration-150 focus-within:border-amber-400/20 focus-within:bg-white/[0.04]">
          <textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask Marcus to change anything…"
            disabled={isRunning}
            rows={3}
            className="w-full resize-none bg-transparent px-3 py-2.5 pr-9 text-[12px] leading-[1.5] text-white/72 placeholder-white/18 outline-none disabled:opacity-40"
          />
          <button
            onClick={submit}
            disabled={!instruction.trim() || isRunning}
            className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/12 text-amber-400 transition-all hover:bg-amber-400/22 disabled:cursor-not-allowed disabled:opacity-25"
          >
            {isRunning
              ? <Loader className="h-3 w-3 animate-spin" />
              : <Send   className="h-3 w-3" />
            }
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/15">⌘↵ to send</p>
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
        <div className="max-w-[190px] rounded-2xl rounded-tr-sm bg-white/[0.06] px-3 py-2">
          <p className="text-[12px] leading-[1.5] text-white/65">{entry.text}</p>
          <p className="mt-1 text-right font-mono text-[9px] text-white/18">{entry.time}</p>
        </div>
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
          <User className="h-3 w-3 text-white/30" />
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
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/12">
          <Cpu className="h-2.5 w-2.5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl rounded-tl-sm bg-white/[0.035] px-3 py-2">
            <p className="text-[12px] leading-[1.5] text-white/60">{entry.text}</p>
            {entry.changes && entry.changes.length > 0 && (
              <div className="mt-2 flex items-center gap-1 border-t border-white/[0.05] pt-1.5">
                <FileCode className="h-3 w-3 text-white/22" />
                <span className="text-[10px] text-white/28">
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
          <p className="mt-0.5 pl-1 font-mono text-[9px] text-white/16">{entry.time}</p>
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "tool") {
    const cfg  = TOOL_PHASES[entry.phase]
    if (!cfg) return null
    const Icon = cfg.icon
    const done = entry.status === "done"
    return (
      <motion.div
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
      >
        <div
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
          style={{ background: `${cfg.color}1a` }}
        >
          {done
            ? <CheckCircle className="h-3 w-3" style={{ color: cfg.color }} />
            : <Icon className={`h-3 w-3 ${entry.phase === "analyzing" || entry.phase === "regenerating" ? "animate-spin" : ""}`} style={{ color: cfg.color }} />
          }
        </div>
        <span className="flex-1 text-[11px] text-white/48">{cfg.label}</span>
        <span className="font-mono text-[9px] text-white/18">{entry.time}</span>
      </motion.div>
    )
  }

  if (entry.kind === "file-change") {
    const { change } = entry
    const color  = OP_COLORS[change.operation] ?? "#9ca3af"
    const label  = OP_LABELS[change.operation] ?? change.operation
    const fileName = change.path.split("/").pop() ?? change.path
    return (
      <motion.div
        initial={{ opacity: 0, x: -4 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 pl-8"
      >
        <FileCode className="h-3 w-3 flex-shrink-0 text-white/22" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/45">{fileName}</span>
        <span
          className="flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: `${color}15`, color }}
        >
          {label}
        </span>
      </motion.div>
    )
  }

  return null
}
