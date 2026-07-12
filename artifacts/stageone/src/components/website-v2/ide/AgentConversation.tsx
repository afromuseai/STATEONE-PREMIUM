// ─── AgentConversation — Streaming conversation UI (replaces AgentPanel) ───────

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send, Loader2, CheckCircle, AlertCircle, RefreshCw,
  FileCode, FileEdit, Play, Cpu, User, Search, Terminal,
  FolderOpen, Brain, Zap, ChevronRight, Check, X, Copy, ChevronUp, ChevronDown,
} from "lucide-react"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { TimelineEntry as TimelineEntryType } from "./AgentRuntime"
import { useWebContainer } from "@/components/website-v2/runtime/useWebContainer"
import type { FileDiff } from "./DiffReviewPanel"
import { AgentRuntime, type ProjectMemory, type AgentMessage, type TimelineEntry, type AgentStreamEvent, stripToolCalls } from "./AgentRuntime"
import { ToolCallCard } from "./ToolCallCard"
import { ThinkingBlock } from "./ThinkingBlock"
import { useOptionalMarcusSession } from "@/lib/marcus-session/context"

// ─── Markdown renderer (safe, no dangerouslySetInnerHTML) ─────────────────────
function InlineBold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**")
          ? <strong key={i} className="font-semibold text-white/75">{p.slice(2, -2)}</strong>
          : <span key={i}>{p}</span>
      )}
    </>
  )
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false)
  const onCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }
  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-white/[0.07] bg-black/40">
      <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
        <span className="font-mono text-[9.5px] font-medium uppercase tracking-wide text-white/30">{lang || "code"}</span>
        <button
          onClick={onCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[9.5px] text-white/25 transition-colors hover:bg-white/[0.06] hover:text-white/60"
        >
          {copied ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto p-2.5 text-[11.5px] leading-relaxed text-emerald-100/80">
        <code className="font-mono">{code}</code>
      </pre>
    </div>
  )
}

function MarkdownText({ text }: { text: string }) {
  // Split on fenced code blocks first so ``` content is never mangled by line-based rules
  const segments = text.split(/(```[\s\S]*?```)/g)

  return (
    <div className="space-y-0.5">
      {segments.map((segment, si) => {
        const fence = segment.match(/^```(\w*)\n?([\s\S]*?)```$/)
        if (fence) {
          const [, lang, code] = fence
          return <CodeBlock key={si} lang={lang} code={code.replace(/\n$/, "")} />
        }

        const lines = segment.split("\n")
        return lines.map((line, i) => {
          const key = `${si}-${i}`
          if (!line.trim()) return <div key={key} className="h-1" />
          if (line.startsWith("### "))
            return <p key={key} className="text-[10px] font-black uppercase tracking-widest text-amber-400/70 mt-2 mb-0.5">{line.slice(4)}</p>
          if (line.startsWith("## "))
            return <p key={key} className="text-[11px] font-bold text-white/75 mt-1.5 mb-0.5">{line.slice(3)}</p>
          if (line.startsWith("**") && line.endsWith("**") && line.length > 4)
            return <p key={key} className="text-[12px] font-semibold text-white/75">{line.slice(2, -2)}</p>
          if (line.startsWith("- ") || line.startsWith("• "))
            return (
              <div key={key} className="flex items-start gap-1.5 my-0.5">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
                <span className="text-[12px] leading-relaxed text-white/55"><InlineBold text={line.slice(2)} /></span>
              </div>
            )
          if (/^\d+\./.test(line)) {
            const num = line.match(/^(\d+)\./)?.[1]
            const rest = line.replace(/^\d+\.\s*/, "")
            return (
              <div key={key} className="flex items-start gap-2 my-0.5">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-400/10 text-[9px] font-bold text-amber-400 mt-0.5">{num}</span>
                <span className="text-[12px] leading-relaxed text-white/55"><InlineBold text={rest} /></span>
              </div>
            )
          }
          // Inline code spans `like this`
          if (line.includes("`")) {
            const parts = line.split(/(`[^`]+`)/)
            return (
              <p key={key} className="text-[12px] leading-relaxed text-white/55">
                {parts.map((p, pi) =>
                  p.startsWith("`") && p.endsWith("`") && p.length > 1
                    ? <code key={pi} className="rounded bg-white/[0.08] px-1 py-0.5 font-mono text-[11px] text-amber-200/90">{p.slice(1, -1)}</code>
                    : <InlineBold key={pi} text={p} />
                )}
              </p>
            )
          }
          return <p key={key} className="text-[12px] leading-relaxed text-white/55"><InlineBold text={line} /></p>
        })
      })}
    </div>
  )
}

// ─── Timeline grouping — collapse work entries behind one row ─────────────────
// Narration (user/agent chat text) stays inline and plain. Everything else
// (thinking, tool calls, file edits, scans, plans) gets bundled into a single
// collapsible "N actions" row, matching Replit's own agent chat: only the
// short narration is visible by default, detailed steps sit behind a toggle.
type TimelineGroup =
  | { kind: "narration"; entry: TimelineEntryType }
  | { kind: "group"; entries: TimelineEntryType[]; id: string }

function groupTimeline(timeline: TimelineEntryType[]): TimelineGroup[] {
  const groups: TimelineGroup[] = []
  let buffer: TimelineEntryType[] = []
  const flush = () => {
    if (buffer.length) {
      groups.push({ kind: "group", entries: buffer, id: buffer[0].id })
      buffer = []
    }
  }
  for (const entry of timeline) {
    if (entry.kind === "user-msg" || entry.kind === "agent-msg") {
      flush()
      groups.push({ kind: "narration", entry })
    } else {
      buffer.push(entry)
    }
  }
  flush()
  return groups
}

function groupLabel(entries: TimelineEntryType[]): string {
  const scan = entries.find((e) => e.kind === "scan")
  if (scan && scan.kind === "scan") {
    if (scan.status === "running") return "Scanning project…"
    if (scan.status === "error") return "Scan failed"
  }
  if (entries.some((e) => e.kind === "plan")) return "Drafted a plan"
  const fileChanges = entries.filter((e) => e.kind === "file-change").length
  if (fileChanges > 0) return "Edited files"
  const toolCalls = entries.filter((e) => e.kind === "tool-call")
  if (toolCalls.length > 0) {
    const names = new Set(toolCalls.map((e) => (e.kind === "tool-call" ? e.name : "")))
    if (names.size === 1) {
      const label = TOOL_GROUP_LABELS[[...names][0]] || "Ran a tool"
      return label
    }
    return "Worked through a few steps"
  }
  return "Working"
}

const TOOL_GROUP_LABELS: Record<string, string> = {
  read_file: "Read some files",
  write_file: "Wrote to files",
  list_dir: "Explored the project",
  search_code: "Searched the codebase",
  run_command: "Ran a command",
}

function ActionGroup({
  entries,
  project,
  onFileOpen,
}: {
  entries: TimelineEntryType[]
  project: V2Project
  onFileOpen: (file: V2ProjectFile) => void
}) {
  const hasRunning = entries.some(
    (e) => (e.kind === "tool-call" || e.kind === "scan") && e.status === "running"
  )
  const hasError = entries.some(
    (e) => (e.kind === "tool-call" || e.kind === "scan") && e.status === "error"
  )
  const [expanded, setExpanded] = useState(hasRunning)

  useEffect(() => {
    if (hasRunning) setExpanded(true)
  }, [hasRunning])

  const count = entries.filter((e) => e.kind === "tool-call" || e.kind === "file-change").length || entries.length
  const label = groupLabel(entries)

  return (
    <div className="my-0.5 pl-9">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md py-1 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
          {hasRunning ? (
            <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400/80" />
          ) : hasError ? (
            <AlertCircle className="h-2.5 w-2.5 text-red-400/80" />
          ) : (
            <CheckCircle className="h-2.5 w-2.5 text-white/25" />
          )}
        </span>
        <span className="text-[12px] text-white/40">{label}</span>
        <span className="ml-auto flex items-center gap-1 text-[10px] font-mono text-white/20">
          {count} action{count === 1 ? "" : "s"}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-1.5 mt-1 mb-1.5 space-y-1.5 border-l border-white/[0.06] pl-3">
              {entries.map((entry) => (
                <TimelineEntryRenderer key={entry.id} entry={entry} project={project} onFileOpen={onFileOpen} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function CollapsibleDetail({ label, text, accent = "indigo" }: { label: string; text: string; accent?: "indigo" | "amber" }) {
  const [expanded, setExpanded] = useState(false)
  const color = accent === "amber" ? "#fbbf24" : "#818cf8"
  return (
    <div className="pl-9">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md py-1 text-left transition-colors hover:bg-white/[0.03]"
      >
        <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full" style={{ background: `${color}1a` }}>
          <FileCode className="h-2.5 w-2.5" style={{ color }} />
        </span>
        <span className="text-[12px] text-white/40">{label}</span>
        <span className="ml-auto text-white/20">
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="ml-1.5 mt-1 mb-1.5 border-l border-white/[0.06] pl-3">
              <MarkdownText text={text} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AgentConversationProps {
  project: V2Project
  onEditComplete: () => void
  onFileOpen: (file: V2ProjectFile) => void
  onFileDiff?: (diff: FileDiff) => void
  writeFileForReview?: (path: string, content: string) => Promise<{ oldContent: string; newContent: string; path: string }>
  externalInput?: string | null
  onExternalInputConsumed?: () => void
  editorContext?: {
    activeFilePath: string | null
    activeFileContent: string | null
    selection: string | null
    terminalOutput: string
    fileTree: string
  }
}

export function AgentConversation({
  project,
  onEditComplete,
  onFileOpen,
  onFileDiff,
  writeFileForReview,
  externalInput,
  onExternalInputConsumed,
  editorContext,
}: AgentConversationProps) {
  const { status: wcStatus, readFile, listDir, runCommand, writeFile, writeFileForReview: wcWriteFileForReview } = useWebContainer()

  // ── State ──────────────────────────────────────────────────────────────────
  const [input, setInput] = useState("")
  const [timeline, setTimeline] = useState<TimelineEntry[]>([])
  const [phase, setPhase] = useState<string | null>(null)
  const [projectMemory, setProjectMemory] = useState<ProjectMemory | null>(null)
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done" | "error">("idle")
  const [pendingPlan, setPendingPlan] = useState<string | null>(null)
  const [conversation, setConversation] = useState<AgentMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [showPlanDetails, setShowPlanDetails] = useState(false)
  
  // Streaming state - use a single message being built
  const [streamingMessage, setStreamingMessage] = useState<{
    text: string
    thinking: string
    toolCalls: Array<{ id: string; name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string }>
    diffs: Array<{ id: string; path: string; oldContent: string; newContent: string }>
  } | null>(null)
  
  // Track if streaming is done (for cursor cleanup)
  const isStreamingRef = useRef(false)

  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const runtimeRef = useRef<AgentRuntime | null>(null)

  // Marcus session context
  const sessionDispatch = useOptionalMarcusSession()?.dispatch ?? null

  // ── Initialize AgentRuntime ────────────────────────────────────────────────
  useEffect(() => {
    runtimeRef.current = new AgentRuntime({
      project,
      onEditComplete,
      onFileOpen,
      onFileDiff,
      externalInput,
      onExternalInputConsumed,
      readFile,
      writeFile,
      writeFileForReview: wcWriteFileForReview,
      listDir,
      runCommand,
      wcStatus,
      onTimelineChange: setTimeline,
      onPhaseChange: setPhase,
      onStreamTextChange: (text) => {
        isStreamingRef.current = !!text
        setStreamingMessage(prev => prev ? { ...prev, text } : { text, thinking: "", toolCalls: [], diffs: [] })
      },
      onEvent: (event) => {
        setStreamingMessage(prev => {
          const base = prev ?? { text: "", thinking: "", toolCalls: [], diffs: [] }
          switch (event.type) {
            case "thinking":
              return { ...base, thinking: (base.thinking || "") + (event.content || "") + "\n" }
            case "thinking_end":
              return base
            case "text":
              return { ...base, text: base.text + (event.content || "") }
            case "tool_call":
              if (event.id && event.name) {
                return { ...base, toolCalls: [...base.toolCalls, { id: event.id, name: event.name, params: event.params || {}, status: "running" as const }] }
              }
              return base
            case "tool_diff":
              if (event.id && event.path && event.newContent) {
                return { ...base, diffs: [...base.diffs, { id: event.id, path: event.path, oldContent: event.oldContent || "", newContent: event.newContent }] }
              }
              return base
            case "tool_result":
              return {
                ...base,
                toolCalls: base.toolCalls.map(tc => tc.id === event.id ? { ...tc, status: event.ok ? "done" : "error", result: event.result } : tc)
              }
            case "done":
              // Streaming complete — keep final state for display
              isStreamingRef.current = false
              return base
            default:
              return base
          }
        })
      },
      onPendingPlanChange: setPendingPlan,
      onProjectMemoryChange: setProjectMemory,
      onScanStatusChange: setScanStatus,
      onConversationChange: setConversation,
      onIsRunningChange: setIsRunning,
    })
  }, [project, onEditComplete, onFileOpen, onFileDiff, externalInput, onExternalInputConsumed, readFile, writeFile, wcWriteFileForReview, listDir, runCommand, wcStatus])

  // P2 — accept external prompt from inline AI commands
  useEffect(() => {
    if (externalInput) {
      setInput(externalInput)
      onExternalInputConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalInput])

  // ── Auto-scan project when WC becomes ready ────────────────────────────────
  useEffect(() => {
    if (wcStatus !== "ready" || scanStatus !== "idle") return
    runtimeRef.current?.scanProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcStatus])

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [timeline, streamingMessage])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    const text = input.trim()
    if (!text || isRunning) return
    setInput("")
    setPendingPlan(null)

    if (runtimeRef.current) {
      await runtimeRef.current.submit(text, editorContext)
    }
  }, [input, isRunning, editorContext])

  const confirmPlan = useCallback(async () => {
    setShowPlanDetails(false)
    if (runtimeRef.current) {
      await runtimeRef.current.confirmPlan()
    }
  }, [])

  const rejectPlan = useCallback(() => {
    setShowPlanDetails(false)
    if (runtimeRef.current) {
      runtimeRef.current.rejectPlan()
    }
  }, [])

  const cancel = useCallback(() => {
    if (runtimeRef.current) {
      runtimeRef.current.cancel()
    }
  }, [])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submit()
    }
  }

  // ── Status label ────────────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (wcStatus !== "ready") return `WC ${wcStatus}…`
    if (scanStatus === "scanning") return "Scanning project…"
    if (phase === "planning") return "Planning…"
    if (phase?.startsWith("executing")) return `Executing (iter ${phase.split("-")[1]})…`
    if (isRunning) return "Working…"
    if (pendingPlan) return "Awaiting confirmation"
    return "Ready"
  })()

  const statusColor = (() => {
    if (wcStatus !== "ready") return "text-amber-400/80"
    if (isRunning) return "text-amber-400/80"
    if (pendingPlan) return "text-indigo-400/80"
    return "text-emerald-400/60"
  })()

  const dotColor = (() => {
    if (isRunning || wcStatus !== "ready") return "bg-amber-400"
    if (pendingPlan) return "bg-indigo-400"
    return "bg-emerald-400"
  })()

  const showEmptyState = timeline.length === 0 && !isRunning && !streamingMessage

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#0b0b0b]">

      {/* Running glow */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[2px]"
            style={{ background: "linear-gradient(to bottom, transparent 0%, #f59e0b 30%, #fbbf24 50%, #f59e0b 70%, transparent 100%)" }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "inherit", filter: "blur(4px)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-white/[0.05] px-4 py-3">
        <AnimatePresence>
          {isRunning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(135deg, #f59e0b06 0%, transparent 60%)" }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-[1] flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/10 ring-1 ring-amber-400/20">
            <Cpu className="h-3.5 w-3.5 text-amber-400/90" />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0b] transition-colors duration-500 ${dotColor}`}>
            {isRunning && <div className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-60" />}
          </div>
        </div>

        <div className="relative z-[1] min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-white/90">Marcus AI</span>
            <span className={`text-[10px] font-mono ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Conversation area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">

          {/* Empty state */}
          {showEmptyState && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.05] bg-white/[0.02]">
                <Zap className="h-7 w-7 text-white/12" />
              </div>
              <h2 className="text-base font-semibold text-white/60">Start a conversation</h2>
              <p className="mt-1.5 max-w-[260px] text-sm text-white/25 leading-relaxed">
                Ask Marcus to build, edit, or explain anything in your project.
              </p>
            </motion.div>
          )}

          {/* Timeline entries — narration renders plainly; work (tool calls, file
              changes, plans, scans) is grouped into a single collapsible row so
              the chat reads as brief narration rather than a stack of cards. */}
          <AnimatePresence initial={false}>
            {groupTimeline(timeline).map((g) =>
              g.kind === "narration" ? (
                <TimelineEntryRenderer
                  key={g.entry.id}
                  entry={g.entry}
                  project={project}
                  onFileOpen={onFileOpen}
                />
              ) : (
                <ActionGroup
                  key={g.id}
                  entries={g.entries}
                  project={project}
                  onFileOpen={onFileOpen}
                />
              )
            )}
          </AnimatePresence>

          {/* Streaming message (assistant response being built) */}
          {streamingMessage && (
            <StreamingMessage message={streamingMessage} />
          )}

          {/* Bottom anchor for scroll */}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="flex flex-shrink-0 flex-col border-t border-white/[0.05] bg-[#0a0a0a] p-3">
          {/* Pending plan confirmation */}
          <AnimatePresence>
            {pendingPlan && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mb-3 rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5"
              >
                <button
                  onClick={() => setShowPlanDetails((v) => !v)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded" style={{ background: "#6366f11a" }}>
                    <FileCode className="h-2.5 w-2.5 text-indigo-400/80" />
                  </div>
                  <span className="text-[12px] font-medium text-white/55">Plan ready — review before running</span>
                  <span className="ml-auto flex-shrink-0 text-white/25">
                    {showPlanDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {showPlanDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 pl-7">
                        <MarkdownText text={stripToolCalls(pendingPlan)} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="mt-2.5 flex items-center gap-2 pl-7">
                  <button
                    onClick={confirmPlan}
                    className="flex items-center gap-1.5 rounded-md bg-indigo-500/20 px-3 py-1.5 text-sm font-semibold text-indigo-300 hover:bg-indigo-500/30 transition-colors"
                  >
                    <Play className="h-3.5 w-3.5" /> Continue
                  </button>
                  <button
                    onClick={rejectPlan}
                    className="flex items-center gap-1.5 rounded-md bg-white/[0.04] px-3 py-1.5 text-sm text-white/35 hover:bg-white/[0.08] transition-colors"
                  >
                    <X className="h-3.5 w-3.5" /> Cancel
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Text input */}
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder={isRunning ? "Working…" : pendingPlan ? "Confirm or cancel the plan above" : "Ask Marcus to build, edit, or explain…"}
              disabled={isRunning}
              rows={1}
              className="flex-1 min-h-[40px] max-h-32 resize-none rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-sm text-white/80 placeholder:text-white/20 focus:border-amber-400/40 focus:outline-none focus:ring-1 focus:ring-amber-400/20 transition-colors"
              style={{ lineHeight: "1.5" }}
            />
            <button
              onClick={submit}
              disabled={!input.trim() || isRunning}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 text-white/90 transition-all hover:from-amber-400 hover:to-amber-500 disabled:opacity-30 disabled:cursor-not-allowed"
              aria-label="Send"
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Cancel button when running */}
          {isRunning && (
            <button
              onClick={cancel}
              className="mt-2 w-full rounded-md bg-white/[0.04] px-3 py-1.5 text-sm text-white/35 hover:bg-white/[0.08] transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Streaming message component ───────────────────────────────────────────────
interface StreamingMessage {
  thinking?: string
  text?: string
  toolCalls: Array<{ id: string; name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string }>
  diffs: Array<{ id: string; path: string; oldContent: string; newContent: string }>
}

// Blinking cursor dot
function TypingCursor() {
  return (
    <motion.span
      className="inline-flex h-[1.1em] w-[2px] translate-y-[1px] rounded-full bg-amber-400/80"
      animate={{ opacity: [1, 0.15, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

function StreamingMessage({ message }: { message: StreamingMessage }) {
  const hasRunningTool = message.toolCalls.some(tc => tc.status === "running")
  const hasContent = !!message.text || !!message.thinking || message.toolCalls.length > 0 || message.diffs.length > 0
  const isStreamingText = !!message.text && (hasRunningTool || !!message.thinking)

  // Don't render if there's nothing to show
  if (!hasContent) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      {/* Agent avatar with pulse ring when active */}
      <div className="relative flex-shrink-0">
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/10 ring-1 ring-amber-400/20">
          <Cpu className="h-3 w-3 text-amber-400/90" />
        </div>
        {/* Pulse ring while streaming */}
        <motion.div
          className="absolute inset-0 rounded-full ring-2 ring-amber-400/0"
          animate={{ ring: isStreamingText ? ["0px", "3px", "0px"] : "0px" }}
          style={{ boxShadow: isStreamingText ? "0 0 6px rgba(251, 191, 36, 0.3)" : "none" }}
        />
      </div>
      <div className="flex-1 min-w-0 space-y-3">
        {/* Thinking block */}
        {message.thinking && (
          <ThinkingBlock text={message.thinking} isStreaming={!message.text} />
        )}

        {/* Streaming text with typing cursor */}
        {message.text && (
          <div className="prose prose-invert max-w-none">
            <MarkdownText text={message.text} />
            {isStreamingText && <TypingCursor />}
          </div>
        )}

        {/* Initial thinking indicator when no text yet but tool calls are running */}
        {!message.text && hasRunningTool && (
          <div className="flex items-center gap-2 text-[12px] text-white/35">
            <span className="flex gap-0.5">
              <motion.span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
              <motion.span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.15 }} />
              <motion.span className="h-1.5 w-1.5 rounded-full bg-amber-400/60" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.3 }} />
            </span>
            <span>Processing</span>
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls.map((tc) => (
          <ToolCallCard
            key={tc.id}
            call={{ name: tc.name, params: tc.params }}
            status={tc.status}
            result={tc.result ? { name: tc.name, params: tc.params, result: tc.result, ok: tc.status === "done" } : undefined}
          />
        ))}

        {/* Diff previews */}
        {message.diffs.map((diff) => (
          <motion.div
            key={diff.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-white/[0.06] bg-[#0f0f0f] p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <FileCode className="h-3.5 w-3.5 text-white/25" />
              <span className="truncate font-mono text-[11px] text-white/50">{diff.path}</span>
              <span className="ml-auto rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                style={{ background: diff.oldContent ? "#60a5fa15" : "#34d39915", color: diff.oldContent ? "#60a5fa" : "#34d399" }}>
                {diff.oldContent ? "update" : "create"}
              </span>
            </div>
            <div className="rounded bg-black/30 p-2 text-[9px] font-mono overflow-x-auto max-h-48">
              <pre>{diff.oldContent ? generateDiff(diff.oldContent, diff.newContent) : diff.newContent}</pre>
            </div>
          </motion.div>
        ))}

        {/* Continue/Cancel controls during execution */}
        {hasRunningTool && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 pt-2 border-t border-white/[0.05]"
          >
            <span className="text-[11px] text-white/30">Executing tools…</span>
            <div className="flex-1 h-1 bg-white/[0.05] rounded overflow-hidden">
              <motion.div
                className="h-full bg-amber-400"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// Simple diff generator
function generateDiff(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split("\n")
  const newLines = newStr.split("\n")
  const maxLines = Math.max(oldLines.length, newLines.length)
  let diff = ""
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]
    if (oldLine === newLine) {
      diff += `  ${oldLine ?? ""}\n`
    } else if (oldLine !== undefined && newLine === undefined) {
      diff += `- ${oldLine}\n`
    } else if (oldLine === undefined && newLine !== undefined) {
      diff += `+ ${newLine}\n`
    } else {
      diff += `- ${oldLine}\n+ ${newLine}\n`
    }
  }
  return diff
}

// ─── Timeline entry renderer ─────────────────────────────────────────────────
function TimelineEntryRenderer({
  entry,
  project,
  onFileOpen,
}: {
  entry: TimelineEntry
  project: V2Project
  onFileOpen: (file: V2ProjectFile) => void
}) {
  if (entry.kind === "user-msg") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/[0.05]">
          <User className="h-3 w-3 text-white/30" />
        </div>
        <div className="flex-1 min-w-0">
          <MarkdownText text={entry.text} />
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "agent-msg") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="flex items-start gap-3">
        <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/20 to-amber-700/10 ring-1 ring-amber-400/20">
          <Cpu className="h-3 w-3 text-amber-400/90" />
        </div>
        <div className="flex-1 min-w-0">
          {entry.phase && (
            <span className="mb-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{
                background: entry.phase === "error" ? "#ef444415" : "#10b98115",
                color: entry.phase === "error" ? "#ef4444" : "#10b981"
              }}
            >
              {entry.phase}
            </span>
          )}
          <MarkdownText text={entry.text} />
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "plan") {
    return <CollapsibleDetail label="Plan" text={entry.text} />
  }

  if (entry.kind === "tool-call") {
    return (
      <ToolCallCard
        call={{ name: entry.name, params: entry.params }}
        status={entry.status}
        result={entry.result ? { name: entry.name, params: entry.params, result: entry.result, ok: entry.status === "done" } : undefined}
      />
    )
  }

  if (entry.kind === "file-change") {
    const file = entry.change.path.split("/").pop() ?? entry.change.path
    const opColor = entry.change.operation === "update" ? "#60a5fa" : entry.change.operation === "create" ? "#34d399" : "#f87171"
    const opLabel = entry.change.operation === "update" ? "edited" : entry.change.operation === "create" ? "created" : "deleted"
    return (
      <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 pl-8"
      >
        <FileCode className="h-3 w-3 flex-shrink-0 text-white/22" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/45">{file}</span>
        <span className="flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: `${opColor}15`, color: opColor }}
        >
          {opLabel}
        </span>
      </motion.div>
    )
  }

  if (entry.kind === "scan") {
    const done = entry.status === "done"
    const error = entry.status === "error"
    return (
      <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}
        className="flex items-center gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
      >
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded" style={{ background: "#818cf81a" }}>
          {error
            ? <AlertCircle className="h-3 w-3 text-red-400" />
            : done
            ? <CheckCircle className="h-3 w-3 text-indigo-400" />
            : <RefreshCw className="h-3 w-3 animate-spin text-indigo-400" />
          }
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] text-white/48">
            {error ? "Scan failed" : done ? "Project analyzed" : "Scanning project…"}
          </span>
          {done && entry.summary && (
            <p className="mt-0.5 truncate text-[10px] text-white/28">{entry.summary}</p>
          )}
        </div>
        {done && <ChevronRight className="h-3 w-3 flex-shrink-0 text-white/15" />}
      </motion.div>
    )
  }

  return null
}