// ─── Marcus Stream Generation Screen ──────────────────────────────────────────
// Replit-style generation UI: autonomous loop phases on the left, Monaco
// code streaming on the right. Files appear token-by-token as Marcus writes them.
// Pure renderer — reads MarcusSessionState, owns no agent state.

import { useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  FileCode, CheckCircle2, Loader2, AlertCircle,
  Sparkles, Terminal, X, FileEdit, FolderOpen,
  Search, Brain, Zap, ShieldCheck, Flag, ChevronRight,
} from "lucide-react"
import Editor from "@monaco-editor/react"
import type { MarcusSessionState } from "@/lib/marcus-session/types"
import { AgentActivity, type ActivityItem } from "@/components/website-v2/ide/AgentActivity"

// ─── Language → Monaco language id ────────────────────────────────────────────
function toMonacoLang(lang: string): string {
  switch (lang) {
    case "typescript": return "typescript"
    case "css":        return "css"
    case "json":       return "json"
    case "markdown":   return "markdown"
    default:           return "typescript"
  }
}

// ─── File extension → icon color ──────────────────────────────────────────────
function fileColor(path: string): string {
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "#7dd3fc"
  if (path.endsWith(".css"))  return "#818cf8"
  if (path.endsWith(".json")) return "#fbbf24"
  return "#9ca3af"
}

// ─── Loop phase metadata ───────────────────────────────────────────────────────
const LOOP_PHASE_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  UNDERSTAND: { icon: Brain,       label: "Understanding",  color: "#a78bfa" },
  PLAN:       { icon: Zap,         label: "Planning",       color: "#fbbf24" },
  EXECUTE:    { icon: FileEdit,    label: "Writing files",  color: "#60a5fa" },
  OBSERVE:    { icon: Search,      label: "Inspecting",     color: "#34d399" },
  FIX:        { icon: AlertCircle, label: "Fixing",         color: "#f97316" },
  VALIDATE:   { icon: ShieldCheck, label: "Validating",     color: "#10b981" },
  REPORT:     { icon: Flag,        label: "Completing",     color: "#6ee7b7" },
}

const LOOP_PHASE_ORDER: string[] = [
  "UNDERSTAND", "PLAN", "EXECUTE", "OBSERVE", "FIX", "VALIDATE", "REPORT",
]

// ─── Tool meta ────────────────────────────────────────────────────────────────
const TOOL_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  write_file:          { icon: FileEdit,   label: "write_file",          color: "#f59e0b" },
  read_file:           { icon: FileCode,   label: "read_file",           color: "#818cf8" },
  list_files:          { icon: FolderOpen, label: "list_files",          color: "#6ee7b7" },
  update_file:         { icon: FileEdit,   label: "update_file",         color: "#60a5fa" },
  inspect_build_error: { icon: Search,     label: "inspect_build_error", color: "#f97316" },
  run_command:         { icon: Terminal,   label: "run_command",         color: "#38bdf8" },
}

// ─── Derived helpers (pure renderer — no state ownership) ─────────────────────

interface ToolEventDisplay {
  id:        string
  tool:      string
  status:    "start" | "done" | "failed"
  path?:     string
  detail?:   string
  timestamp: number
}

function deriveToolEvents(state: MarcusSessionState): ToolEventDisplay[] {
  return state.conversation
    .filter(e => e.kind === "tool")
    .slice(-50)
    .map(e => {
      if (e.kind !== "tool") return null as never
      return {
        id: e.id,
        tool: e.tool,
        status: e.status === "running" ? "start" : e.status,
        path: e.path,
        detail: e.detail,
        timestamp: e.ts,
      }
    })
}

function deriveThinkingText(state: MarcusSessionState): string {
  const entry = [...state.conversation].reverse().find(e => e.kind === "thinking")
  return entry?.kind === "thinking" ? entry.text : ""
}

function deriveCompletedFiles(state: MarcusSessionState) {
  return Object.entries(state.files)
    .filter(([, f]) => f.complete)
    .map(([path, f]) => ({ path, language: f.language, content: f.content }))
}

function deriveStatusLabel(status: MarcusSessionState["status"], activeFilePath: string | null): string {
  if (status === "generating" && !activeFilePath) return "thinking"
  if (status === "generating") return "writing"
  if (status === "completed") return "done"
  if (status === "failed") return "error"
  return status
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface StreamGenerationScreenProps {
  state:     MarcusSessionState
  onCancel?: () => void
}

// ─── Thinking text display (auto-scroll) ──────────────────────────────────────
function ThinkingPanel({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [text])

  const paragraphs = text.split("\n\n").filter(p => p.trim())

  return (
    <div ref={ref} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
      {paragraphs.map((p, i) => (
        <motion.p
          key={i}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="text-xs leading-relaxed text-white/55 whitespace-pre-wrap"
        >
          {p}
        </motion.p>
      ))}
      <span className="inline-block h-3 w-0.5 animate-pulse bg-amber-400/70 rounded-sm" />
    </div>
  )
}

// ─── Phase tracker ────────────────────────────────────────────────────────────
function PhaseTracker({
  currentPhase,
  fixIteration,
}: {
  currentPhase: string | null
  fixIteration: number
}) {
  const currentIdx = currentPhase ? LOOP_PHASE_ORDER.indexOf(currentPhase) : -1
  // Skip FIX if fixIteration is 0 (no fix needed)
  const phases = fixIteration === 0
    ? LOOP_PHASE_ORDER.filter(p => p !== "FIX")
    : LOOP_PHASE_ORDER

  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
      {phases.map((phase, i) => {
        const meta    = LOOP_PHASE_META[phase]
        const phaseIdx = LOOP_PHASE_ORDER.indexOf(phase)
        const isDone    = currentIdx > phaseIdx
        const isActive  = currentPhase === phase
        const isPending = currentIdx < phaseIdx

        return (
          <div key={phase} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium transition-all ${
                isActive
                  ? "bg-white/[0.08] text-white/80"
                  : isDone
                  ? "text-white/35"
                  : "text-white/20"
              }`}
            >
              {isActive ? (
                <Loader2 className="h-2.5 w-2.5 animate-spin shrink-0" style={{ color: meta.color }} />
              ) : isDone ? (
                <CheckCircle2 className="h-2.5 w-2.5 shrink-0 text-emerald-400/70" />
              ) : (
                <meta.icon className="h-2.5 w-2.5 shrink-0" style={{ color: isPending ? "#ffffff22" : meta.color }} />
              )}
              <span style={{ color: isActive ? meta.color : undefined }}>{meta.label}</span>
            </div>
            {i < phases.length - 1 && (
              <div className={`h-px w-2 shrink-0 ${isDone ? "bg-white/20" : "bg-white/[0.06]"}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tool event row ───────────────────────────────────────────────────────────
function ToolEventDisplayRow({ event }: { event: ToolEventDisplay }) {
  const meta = TOOL_META[event.tool] ?? { icon: Terminal, label: event.tool, color: "#9ca3af" }
  const Icon = meta.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.15 }}
      className="flex items-start gap-2 px-3 py-1.5 border-b border-white/[0.04] last:border-0"
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center mt-0.5">
        {event.status === "start" ? (
          <Loader2 className="h-3 w-3 animate-spin" style={{ color: meta.color }} />
        ) : event.status === "done" ? (
          <CheckCircle2 className="h-3 w-3 text-emerald-400/80" />
        ) : (
          <AlertCircle className="h-3 w-3 text-red-400/80" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {event.path && event.tool !== "list_files" && (
            <span className="text-[10px] text-white/40 truncate max-w-[120px]" title={event.path}>
              {event.path.split("/").pop()}
            </span>
          )}
        </div>
        {event.detail && event.status !== "start" && (
          <p className="text-[9px] text-white/25 mt-0.5 truncate">{event.detail}</p>
        )}
      </div>

      <span className={`text-[9px] shrink-0 mt-0.5 ${
        event.status === "done"   ? "text-emerald-400/60" :
        event.status === "failed" ? "text-red-400/60"     :
        "text-white/20"
      }`}>
        {event.status === "done" ? "done" : event.status === "failed" ? "failed" : "…"}
      </span>
    </motion.div>
  )
}

// ─── File list item ────────────────────────────────────────────────────────────
function FileItem({
  path,
  done,
  active,
}: { path: string; done: boolean; active: boolean }) {
  const name  = path.split("/").pop() ?? path
  const dir   = path.includes("/") ? path.slice(0, path.lastIndexOf("/") + 1) : ""
  const color = fileColor(path)

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex items-center gap-2.5 px-4 py-1.5 text-xs transition-colors ${
        active ? "bg-white/[0.04] border-l-2 border-amber-400/70" : "border-l-2 border-transparent"
      }`}
    >
      {done ? (
        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-400/80" />
      ) : active ? (
        <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-400" />
      ) : (
        <FileCode className="h-3 w-3 shrink-0" style={{ color }} />
      )}
      <span className="truncate">
        {dir && <span className="text-white/25">{dir}</span>}
        <span style={{ color: done ? "#6ee7b7" : active ? "#fbbf24" : color }}>{name}</span>
      </span>
    </motion.div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
export function StreamGenerationScreen({ state, onCancel }: StreamGenerationScreenProps) {
  const {
    status, activeFilePath, activeFileLanguage, files,
    fileCount, currentPhase, phaseMessage, fixIteration,
    lastValidation, error, conversation,
  } = state

  const thinkingText = useMemo(() => deriveThinkingText(state), [conversation])
  const completedFiles = useMemo(() => deriveCompletedFiles(state), [files])
  const recentToolEvents = useMemo(() => deriveToolEvents(state).slice(-12), [conversation])

  const statusLabel = deriveStatusLabel(status, activeFilePath)

  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [toolsExpanded, setToolsExpanded] = useState(false)
  const toolListRef = useRef<HTMLDivElement>(null)

  // Auto-select the active file when it changes
  useEffect(() => {
    if (activeFilePath) setSelectedPath(activeFilePath)
  }, [activeFilePath])

  // Auto-scroll tool list to bottom
  useEffect(() => {
    if (toolListRef.current) {
      toolListRef.current.scrollTop = toolListRef.current.scrollHeight
    }
  }, [recentToolEvents.length])

  const activeFile = activeFilePath ? files[activeFilePath] : null
  const displayPath    = selectedPath ?? activeFilePath
  const selectedFile   = displayPath ? files[displayPath] : null
  const isActiveFile   = displayPath === activeFilePath
  const displayContent = isActiveFile ? (activeFile?.content ?? "") : (selectedFile?.content ?? "")
  const displayLang    = isActiveFile ? activeFileLanguage : (selectedFile?.language ?? "typescript")

  const allFilePaths = useMemo(() => {
    const paths = Object.keys(files)
    if (activeFilePath && !paths.includes(activeFilePath)) {
      return [...paths, activeFilePath]
    }
    return paths
  }, [files, activeFilePath])

  const activityItems: ActivityItem[] = useMemo(() => (
    completedFiles.map((f, i) => ({
      id:        `file-${f.path}-${i}`,
      type:      "file_change",
      path:      f.path,
      operation: "create",
      timestamp: i,
    }))
  ), [completedFiles])

  // Derive the current phase label from loop phase or status
  const currentPhaseLabel = (() => {
    if (currentPhase && LOOP_PHASE_META[currentPhase]) {
      return `${LOOP_PHASE_META[currentPhase].label}…`
    }
    if (statusLabel === "thinking")  return "Marcus is thinking…"
    if (statusLabel === "writing")   return activeFilePath ? `Writing ${activeFilePath.split("/").pop()}…` : "Writing…"
    if (statusLabel === "completed") return "Generation complete"
    if (statusLabel === "error")     return "Generation failed"
    return "Working…"
  })()

  // Whether to show the thinking panel
  const showThinking = (
    (currentPhase === "PLAN" || currentPhase === "UNDERSTAND" || statusLabel === "thinking") &&
    thinkingText.length > 0
  )

  // Whether we're in FIX phase
  const isFixing = currentPhase === "FIX"

  return (
    <div className="flex h-full w-full overflow-hidden bg-[#080808]">

      {/* ── Left panel ───────────────────────────────────────────────────── */}
      <div className="flex w-80 shrink-0 flex-col border-r border-white/[0.06]">

        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-white/[0.06] px-4 py-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/10">
            <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-white/80">Marcus</p>
            <p className="truncate text-[10px] text-white/35">{currentPhaseLabel}</p>
          </div>
          {onCancel && status !== "completed" && status !== "failed" && (
            <button
              onClick={onCancel}
              className="flex h-6 w-6 items-center justify-center rounded text-white/25 transition-colors hover:text-white/60"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Phase tracker */}
        <PhaseTracker currentPhase={currentPhase} fixIteration={fixIteration} />

        {/* Fix iteration badge */}
        <AnimatePresence>
          {isFixing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-b border-orange-500/20 bg-orange-500/5 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-3 w-3 text-orange-400 shrink-0" />
                <p className="text-[10px] text-orange-300/80">
                  {phaseMessage || `Fixing issues — iteration ${fixIteration}`}
                </p>
              </div>
              {lastValidation && !lastValidation.fixed && lastValidation.errors.length > 0 && (
                <div className="mt-1.5 space-y-0.5">
                  {lastValidation.errors.slice(0, 3).map((e, i) => (
                    <p key={i} className="text-[9px] text-orange-400/50 truncate">· {e}</p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Thinking panel (PLAN phase) */}
        <AnimatePresence>
          {showThinking && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex max-h-44 min-h-0 shrink-0 flex-col border-b border-white/[0.06]"
            >
              <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/[0.04]">
                <Brain className="h-3 w-3 text-violet-400/60" />
                <span className="text-[9px] uppercase tracking-wider text-white/20">Planning</span>
              </div>
              <ThinkingPanel text={thinkingText} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tool events — collapsed by default, matches Replit's "N actions" row */}
        {recentToolEvents.length > 0 && (
          <div className="flex min-h-0 shrink-0 flex-col border-b border-white/[0.06]">
            <button
              onClick={() => setToolsExpanded(v => !v)}
              className="flex w-full items-center gap-2 px-4 py-1.5 transition-colors hover:bg-white/[0.02]"
            >
              {recentToolEvents[recentToolEvents.length - 1]?.status === "start" ? (
                <Loader2 className="h-3 w-3 animate-spin text-amber-400/70" />
              ) : (
                <Terminal className="h-3 w-3 text-white/20" />
              )}
              <span className="text-[9px] uppercase tracking-wider text-white/20">
                {recentToolEvents.length} action{recentToolEvents.length === 1 ? "" : "s"}
              </span>
              <ChevronRight className={`ml-auto h-3 w-3 text-white/20 transition-transform ${toolsExpanded ? "rotate-90" : ""}`} />
            </button>
            {toolsExpanded && (
              <div ref={toolListRef} className="overflow-y-auto" style={{ maxHeight: "180px" }}>
                {recentToolEvents.map(event => (
                  <ToolEventDisplayRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* File list */}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {allFilePaths.length > 0 && (
            <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-1.5 shrink-0">
              <FileCode className="h-3 w-3 text-white/20" />
              <span className="text-[9px] uppercase tracking-wider text-white/20">
                Files {fileCount > 0 ? `(${fileCount} done)` : ""}
              </span>
            </div>
          )}
          <div className="flex-1 overflow-y-auto py-1">
            {allFilePaths.map(path => (
              <button
                key={path}
                onClick={() => setSelectedPath(path)}
                className="w-full text-left"
              >
                <FileItem
                  path={path}
                  done={!!files[path]?.complete}
                  active={path === activeFilePath}
                />
              </button>
            ))}
            {allFilePaths.length === 0 && status !== "failed" && (
              <div className="flex h-24 items-center justify-center">
                <div className="flex items-center gap-2 text-white/20">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span className="text-xs">Waiting for Marcus…</span>
                </div>
              </div>
            )}
          </div>
          {activityItems.length > 0 && (
            <div className="max-h-32 shrink-0 overflow-y-auto border-t border-white/[0.06] px-3 py-2">
              <AgentActivity items={activityItems} />
            </div>
          )}
        </div>

        {/* Validation success banner */}
        <AnimatePresence>
          {lastValidation?.success && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-2"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-3 w-3 text-emerald-400 shrink-0" />
                <p className="text-[10px] text-emerald-400/80">
                  {lastValidation.fixed ? "Issues fixed — validation passed" : "All files validated"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {status === "failed" && error && (
          <div className="border-t border-red-500/20 bg-red-500/5 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
              <p className="text-xs text-red-400/80">{error}</p>
            </div>
          </div>
        )}

        {/* Done banner */}
        {status === "completed" && (
          <div className="border-t border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <p className="text-xs font-medium text-emerald-400">
                {fileCount} file{fileCount !== 1 ? "s" : ""} generated
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Right panel: Monaco code streaming ───────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">

        {/* File tab bar */}
        <div className="flex min-h-0 shrink-0 items-center gap-0 border-b border-white/[0.06] overflow-x-auto">
          {allFilePaths.length === 0 ? (
            <div className="flex h-9 items-center px-4">
              <span className="text-xs text-white/20">No files yet</span>
            </div>
          ) : (
            allFilePaths.map(path => {
              const name    = path.split("/").pop() ?? path
              const color   = fileColor(path)
              const isActive = path === displayPath
              const isDone   = !!files[path]?.complete
              return (
                <button
                  key={path}
                  onClick={() => setSelectedPath(path)}
                  className={`flex items-center gap-1.5 shrink-0 border-r border-white/[0.06] px-3 py-2 text-xs transition-colors ${
                    isActive
                      ? "bg-white/[0.04] text-white/80"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {path === activeFilePath ? (
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-amber-400" />
                  ) : isDone ? (
                    <div className="h-2 w-2 rounded-full bg-emerald-400/60" />
                  ) : (
                    <div className="h-2 w-2 rounded-full" style={{ background: color + "60" }} />
                  )}
                  {name}
                </button>
              )
            })
          )}
        </div>

        {/* Monaco editor — streams tokens */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {displayContent || displayPath ? (
            <Editor
              key={displayPath ?? "empty"}
              language={toMonacoLang(displayLang)}
              value={displayContent}
              theme="vs-dark"
              options={{
                readOnly:             true,
                minimap:              { enabled: false },
                scrollBeyondLastLine: false,
                fontSize:             12,
                lineNumbers:          "on",
                wordWrap:             "on",
                folding:              false,
                renderLineHighlight:  "none",
                scrollbar:            { vertical: "auto", horizontal: "auto" },
                padding:              { top: 16, bottom: 16 },
                fontFamily:           "JetBrains Mono, Fira Code, monospace",
                contextmenu:          false,
                quickSuggestions:     false,
                parameterHints:       { enabled: false },
                suggestOnTriggerCharacters: false,
              }}
              onMount={(editor) => {
                const model = editor.getModel()
                if (!model) return undefined
                const disposable = model.onDidChangeContent(() => {
                  const lineCount = model.getLineCount()
                  editor.revealLine(lineCount, 1)
                })
                return () => disposable.dispose()
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                  <Sparkles className="h-5 w-5 text-amber-400/40" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white/40">Marcus is generating your website</p>
                  <p className="mt-1 text-xs text-white/20">Files will appear here as they're written</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: "0ms" }} />
                  <div className="h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: "150ms" }} />
                  <div className="h-1 w-1 animate-bounce rounded-full bg-amber-400/60" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
