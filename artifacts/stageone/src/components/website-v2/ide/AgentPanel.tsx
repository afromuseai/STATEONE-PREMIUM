// ─── Phase O — Marcus Autonomous Coding Agent Panel ───────────────────────────
// Implements:
//   O1 — Project Understanding Engine (auto-scan on WC ready)
//   O2 — Agent Tool System (read, write, list, search, run)
//   O3 — Planning Mode (plan → confirm → execute)
//   O4 — Multi-file Editing (multiple write_file calls per loop)
//   O5 — Self-Correction Loop (run_command → check errors → fix → retry)
//   O7 — Agent Memory (projectMemory carried across every request)

import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send, Loader2, CheckCircle, AlertCircle, RefreshCw,
  FileCode, FileEdit, Play, Cpu, User, Search, Terminal,
  FolderOpen, Brain, Zap, ChevronRight, Check, X,
} from "lucide-react"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { useWebContainer } from "@/components/website-v2/runtime/useWebContainer"

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProjectMemory {
  framework?:       string
  style?:           string
  colors?:          string[]
  dependencies?:    string[]
  routeCount?:      number
  componentCount?:  number
  fileTree?:        string
  previousChanges?: string[]
  userPreferences?: string[]
}

interface AgentMessage {
  role:    "user" | "assistant"
  content: string
}

interface ToolCall {
  name:   string
  params: Record<string, unknown>
}

interface ToolResult {
  name:   string
  params: Record<string, unknown>
  result: string
  ok:     boolean
}

type FileChangeOp = "update" | "create" | "delete"
interface FileChange {
  path:      string
  operation: FileChangeOp
}

type TimelinePayload =
  | { kind: "user-msg";    text: string }
  | { kind: "agent-msg";   text: string; phase?: string }
  | { kind: "tool-call";   name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string }
  | { kind: "file-change"; change: FileChange }
  | { kind: "scan";        status: "running" | "done" | "error"; summary?: string }
  | { kind: "plan";        text: string }

type TimelineEntry = TimelinePayload & { id: string; time: string }

// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_LOOP_ITERATIONS = 8
const TOOL_RE = /<tool_call>([\s\S]*?)<\/tool_call>/g

const OP_COLORS: Record<FileChangeOp, string> = {
  update: "#60a5fa",
  create: "#34d399",
  delete: "#f87171",
}
const OP_LABELS: Record<FileChangeOp, string> = {
  update: "edited",
  create: "created",
  delete: "deleted",
}

const TOOL_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  read_file:    { icon: FileCode,  label: "Reading file",       color: "#818cf8" },
  write_file:   { icon: FileEdit,  label: "Writing file",       color: "#f59e0b" },
  list_dir:     { icon: FolderOpen,label: "Listing directory",  color: "#6ee7b7" },
  search_code:  { icon: Search,    label: "Searching code",     color: "#a78bfa" },
  run_command:  { icon: Terminal,  label: "Running command",    color: "#38bdf8" },
  done:         { icon: CheckCircle,label:"Done",               color: "#10b981" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

function uid() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function parseToolCalls(text: string): ToolCall[] {
  const calls: ToolCall[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(TOOL_RE.source, "g")
  while ((m = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim()) as { name?: string; params?: Record<string, unknown> }
      if (parsed.name) calls.push({ name: parsed.name, params: parsed.params ?? {} })
    } catch { /* malformed — skip */ }
  }
  return calls
}

function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim()
}

// Naive recursive file tree builder (2 levels)
function joinPath(base: string, name: string): string {
  return base.endsWith("/") ? `${base}${name}` : `${base}/${name}`
}

async function buildFileTree(
  listDir: (p: string) => Promise<string[]>,
  path = "/",
  depth = 0,
): Promise<string> {
  if (depth > 2) return ""
  const lines: string[] = []
  try {
    const entries = await listDir(path)
    for (const e of entries.slice(0, 40)) {
      const indent = "  ".repeat(depth)
      lines.push(`${indent}${e}`)
      if (e.endsWith("/") && depth < 1) {
        const sub = await buildFileTree(listDir, joinPath(path, e.slice(0, -1)), depth + 1)
        if (sub) lines.push(sub)
      }
    }
  } catch { /* non-critical */ }
  return lines.join("\n")
}

// ─── SSE streaming helper ─────────────────────────────────────────────────────
async function streamAgent(
  payload: { projectMemory?: ProjectMemory; messages: AgentMessage[]; mode: "plan" | "execute" },
  signal: AbortSignal,
  onChunk: (text: string) => void,
): Promise<string> {
  const res = await fetch("/api/copilot/agent", {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify(payload),
    signal,
  })

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let carry  = ""
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = carry + decoder.decode(value, { stream: true })
    const lines = chunk.split("\n")
    carry = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      try {
        const msg = JSON.parse(line.slice(6)) as { content?: string; done?: boolean }
        if (msg.content) {
          buffer += msg.content
          onChunk(buffer)
        }
      } catch { /* fragment */ }
    }
  }

  return buffer
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AgentPanelProps {
  project:        V2Project
  onEditComplete: () => void
  onFileOpen:     (file: V2ProjectFile) => void
}

export function AgentPanel({ project, onEditComplete }: AgentPanelProps) {
  const { status: wcStatus, readFile, listDir, runCommand, writeFile } = useWebContainer()

  // ── State ──────────────────────────────────────────────────────────────────
  const [input,          setInput]          = useState("")
  const [timeline,       setTimeline]       = useState<TimelineEntry[]>([])
  const [phase,          setPhase]          = useState<string | null>(null)
  const [projectMemory,  setProjectMemory]  = useState<ProjectMemory | null>(null)   // O7
  const [scanStatus,     setScanStatus]     = useState<"idle"|"scanning"|"done"|"error">("idle")
  const [pendingPlan,    setPendingPlan]    = useState<string | null>(null)           // O3
  const [conversation,   setConversation]   = useState<AgentMessage[]>([])
  const [streamText,     setStreamText]     = useState<string>("")                    // live stream display

  const abortRef   = useRef<AbortController | null>(null)
  const bottomRef  = useRef<HTMLDivElement | null>(null)
  const isRunning  = phase !== null

  // ── Add entry helper ────────────────────────────────────────────────────────
  const addEntry = useCallback((payload: TimelinePayload): string => {
    const entry = { ...payload, id: uid(), time: nowTime() } as TimelineEntry
    setTimeline(prev => [...prev, entry])
    return entry.id
  }, [])

  const updateEntry = useCallback((id: string, patch: Partial<TimelineEntry>) => {
    setTimeline(prev => prev.map(e => e.id === id ? { ...e, ...patch } as TimelineEntry : e))
  }, [])

  // ── Scroll to bottom ────────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [timeline, streamText])

  // ── O1: Auto-scan project when WC becomes ready ─────────────────────────────
  useEffect(() => {
    if (wcStatus !== "ready" || scanStatus !== "idle") return
    void scanProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcStatus])

  const scanProject = async () => {
    setScanStatus("scanning")
    const scanId = addEntry({ kind: "scan", status: "running" })

    try {
      const mem: ProjectMemory = { previousChanges: [], userPreferences: [] }

      // Read package.json for framework + deps
      try {
        const pkg = JSON.parse(await readFile("/package.json")) as {
          dependencies?: Record<string, string>
          devDependencies?: Record<string, string>
        }
        const allDeps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
        mem.dependencies = allDeps.slice(0, 20)

        if (allDeps.includes("next"))    mem.framework = "Next.js"
        else if (allDeps.includes("vite") || allDeps.includes("react")) mem.framework = "React + Vite"
        else if (allDeps.includes("remix")) mem.framework = "Remix"
        else                             mem.framework = "Node.js"

        if (allDeps.includes("tailwindcss")) mem.style = (mem.style ? mem.style + ", " : "") + "Tailwind CSS"
        if (allDeps.includes("styled-components")) mem.style = (mem.style ?? "") + "Styled Components"
        if (allDeps.includes("framer-motion")) mem.style = (mem.style ? mem.style + ", " : "") + "Framer Motion"
      } catch { /* non-critical */ }

      // Count routes (src/app or src/pages)
      try {
        const appEntries = await listDir("/src/app").catch(() => listDir("/src/pages").catch(() => []))
        mem.routeCount = appEntries.filter(e => !e.endsWith("/")).length
      } catch { /* non-critical */ }

      // Count components
      try {
        const comps = await listDir("/src/components").catch(() => [])
        mem.componentCount = comps.length
      } catch { /* non-critical */ }

      // Try to detect color scheme from globals.css or tailwind.config
      try {
        const globals = await readFile("/src/app/globals.css").catch(() => readFile("/src/styles/globals.css").catch(() => ""))
        const colorMatches = globals.match(/#[0-9a-f]{3,6}/gi) ?? []
        if (colorMatches.length > 0) mem.colors = [...new Set(colorMatches)].slice(0, 5)
      } catch { /* non-critical */ }

      // Build file tree (2 levels deep)
      try {
        mem.fileTree = await buildFileTree(listDir, "/src")
      } catch { /* non-critical */ }

      setProjectMemory(mem)
      setScanStatus("done")

      const summary = [
        mem.framework ?? "Unknown framework",
        mem.style,
        mem.routeCount ? `${mem.routeCount} routes` : null,
        mem.componentCount ? `${mem.componentCount} components` : null,
        mem.dependencies?.length ? `${mem.dependencies.length} deps` : null,
      ].filter(Boolean).join(" · ")

      updateEntry(scanId, { status: "done", summary } as Partial<TimelineEntry>)

      // Welcome message now that we know the project
      addEntry({
        kind: "agent-msg",
        text: `I analyzed **${project.projectName}**.

**Framework:** ${mem.framework ?? "Unknown"}
${mem.style ? `**UI:** ${mem.style}` : ""}
${mem.routeCount ? `**Routes:** ${mem.routeCount}` : ""}
${mem.componentCount ? `**Components:** ${mem.componentCount}` : ""}

Tell me what to change and I'll plan it first, then execute it.`,
      })
    } catch (err) {
      setScanStatus("error")
      updateEntry(scanId, { status: "error" } as Partial<TimelineEntry>)
      addEntry({ kind: "agent-msg", text: "Could not scan project — the WebContainer may still be starting.", phase: "error" })
      console.error("[AgentPanel:scan]", err)
    }
  }

  // ── O2: Execute a single tool against WebContainer ──────────────────────────
  const executeTool = useCallback(async (tc: ToolCall): Promise<ToolResult> => {
    const { name, params } = tc

    try {
      if (name === "read_file") {
        const path = params.path as string
        const content = await readFile(path)
        return { name, params, result: content, ok: true }
      }

      if (name === "write_file") {
        const path    = params.path    as string
        const content = params.content as string
        await writeFile(path, content)
        return { name, params, result: `✓ Wrote ${path}`, ok: true }
      }

      if (name === "list_dir") {
        const path = (params.path as string) || "/"
        const entries = await listDir(path)
        return { name, params, result: entries.join("\n"), ok: true }
      }

      if (name === "search_code") {
        // Frontend-executed search: read files in path and grep for query
        const query = params.query as string
        const searchPath = (params.path as string) || "/src"
        const results = await searchCodeRecursive(readFile, listDir, searchPath, query)
        return { name, params, result: results || "(no matches)", ok: true }
      }

      if (name === "run_command") {
        const cmd  = params.cmd  as string
        const args = (params.args as string[]) ?? []
        const { output, exitCode } = await runCommand(cmd, args)
        return {
          name, params,
          result: `Exit code: ${exitCode}\n${output.slice(0, 2000)}`,
          ok: exitCode === 0,
        }
      }

      if (name === "done") {
        return { name, params, result: (params.summary as string) ?? "Done.", ok: true }
      }

      return { name, params, result: `Unknown tool: ${name}`, ok: false }
    } catch (err) {
      return {
        name, params,
        result: `Error: ${err instanceof Error ? err.message : String(err)}`,
        ok: false,
      }
    }
  }, [readFile, writeFile, listDir, runCommand])

  // ── Main agent loop ─────────────────────────────────────────────────────────
  const runAgentLoop = useCallback(async (
    initialConversation: AgentMessage[],
    mode: "plan" | "execute",
  ) => {
    if (abortRef.current) abortRef.current.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl

    let conv = [...initialConversation]

    for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
      setStreamText("")
      setPhase(mode === "plan" ? "planning" : `executing-${i + 1}`)

      let fullText = ""
      try {
        fullText = await streamAgent(
          { projectMemory: projectMemory ?? undefined, messages: conv, mode },
          ctrl.signal,
          (live) => setStreamText(live),
        )
      } catch (err) {
        if ((err as Error).name === "AbortError") return
        addEntry({
          kind: "agent-msg",
          text: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          phase: "error",
        })
        break
      }

      setStreamText("")

      // O3: Plan mode — show plan and wait for user confirmation
      if (mode === "plan") {
        const displayText = stripToolCalls(fullText)
        addEntry({ kind: "plan", text: displayText })
        setPendingPlan(fullText)
        setConversation([
          ...conv,
          { role: "assistant", content: fullText },
        ])
        setPhase(null)
        return
      }

      // Execute mode: parse and run tool calls
      const toolCalls = parseToolCalls(fullText)
      const displayText = stripToolCalls(fullText)

      if (displayText) {
        addEntry({ kind: "agent-msg", text: displayText })
      }

      if (toolCalls.length === 0) {
        // LLM gave a text response with no tool calls — treat as done
        break
      }

      // Check if done
      const doneCall = toolCalls.find(tc => tc.name === "done")
      if (doneCall) {
        const summary = (doneCall.params.summary as string) ?? "All changes applied."
        addEntry({ kind: "agent-msg", text: `✓ ${summary}`, phase: "preview-ready" })

        // Track in memory
        if (projectMemory) {
          setProjectMemory(prev => ({
            ...prev!,
            previousChanges: [...(prev?.previousChanges ?? []), summary].slice(-10),
          }))
        }
        onEditComplete()
        break
      }

      // O4: Execute all tool calls (multi-file).
      // Always run non-done tools first, then honour "done" if present.
      // This prevents a mixed response from silently dropping edits.
      const nonDoneCalls = toolCalls.filter(tc => tc.name !== "done")
      const toolResultMessages: string[] = []
      for (const tc of nonDoneCalls) {

        const meta = TOOL_META[tc.name]
        const entryId = addEntry({ kind: "tool-call", name: tc.name, params: tc.params, status: "running" })

        const toolResult = await executeTool(tc)

        updateEntry(entryId, { status: toolResult.ok ? "done" : "error", result: toolResult.result } as Partial<TimelineEntry>)

        // If it's a file write, also add a file-change entry
        if (tc.name === "write_file") {
          const path = tc.params.path as string
          addEntry({
            kind: "file-change",
            change: { path, operation: "update" },
          })
        }

        // Format result for next LLM call
        const resultStr = toolResult.result.length > 1500
          ? toolResult.result.slice(0, 1500) + "\n...[truncated]"
          : toolResult.result

        toolResultMessages.push(
          `<tool_result name="${tc.name}">${resultStr}</tool_result>`
        )

        // Log for debugging
        if (!meta) console.warn("[AgentPanel] Unknown tool:", tc.name)
      }

      // Add LLM's response + tool results to conversation for next iteration
      conv = [
        ...conv,
        { role: "assistant", content: fullText },
        { role: "user",      content: `Tool results:\n${toolResultMessages.join("\n\n")}` },
      ]
    }

    setPhase(null)
  }, [projectMemory, executeTool, addEntry, updateEntry, onEditComplete])

  // ── O3: Handle plan confirmation ────────────────────────────────────────────
  const confirmPlan = useCallback(async () => {
    if (!pendingPlan) return
    setPendingPlan(null)

    const confirmConv: AgentMessage[] = [
      ...conversation,
      { role: "user", content: "Continue." },
    ]
    setConversation(confirmConv)

    await runAgentLoop(confirmConv, "execute")
  }, [pendingPlan, conversation, runAgentLoop])

  const rejectPlan = useCallback(() => {
    setPendingPlan(null)
    setPhase(null)
    addEntry({ kind: "agent-msg", text: "Plan cancelled. What would you like to do instead?" })
  }, [addEntry])

  // ── Submit handler ──────────────────────────────────────────────────────────
  const submit = useCallback(async () => {
    const text = input.trim()
    if (!text || isRunning) return
    setInput("")
    setPendingPlan(null)

    addEntry({ kind: "user-msg", text })

    const newConv: AgentMessage[] = [
      ...conversation,
      { role: "user", content: text },
    ]
    setConversation(newConv)

    await runAgentLoop(newConv, "plan")
  }, [input, isRunning, conversation, addEntry, runAgentLoop])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void submit()
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setPhase(null)
    setStreamText("")
  }

  // ── Status label ─────────────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (wcStatus !== "ready")  return `WC ${wcStatus}…`
    if (scanStatus === "scanning") return "Scanning project…"
    if (phase === "planning")  return "Planning…"
    if (phase?.startsWith("executing")) return `Executing (iter ${phase.split("-")[1]})…`
    if (isRunning)             return "Working…"
    if (pendingPlan)           return "Awaiting confirmation"
    return "Ready"
  })()

  const statusColor = (() => {
    if (wcStatus !== "ready")  return "text-amber-400/80"
    if (isRunning)             return "text-amber-400/80"
    if (pendingPlan)           return "text-indigo-400/80"
    return "text-emerald-400/60"
  })()

  const dotColor = (() => {
    if (isRunning || wcStatus !== "ready") return "bg-amber-400"
    if (pendingPlan)                       return "bg-indigo-400"
    return "bg-emerald-400"
  })()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex w-[280px] flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06] bg-[#0b0b0b]">

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
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-white/[0.06] px-4 py-3">
        <AnimatePresence>
          {isRunning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(135deg, #f59e0b08 0%, transparent 60%)" }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-[1] flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-amber-500/25 to-amber-700/15 ring-1 ring-amber-400/25">
            <Cpu className="h-3.5 w-3.5 text-amber-400" />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#0b0b0b] transition-colors duration-500 ${dotColor}`}>
            {isRunning && <div className="absolute inset-0 animate-ping rounded-full bg-amber-400 opacity-75" />}
          </div>
        </div>

        <div className="relative z-[1] min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-semibold text-white/85">Marcus</span>
            <span className="rounded bg-white/[0.05] px-1 py-px text-[9px] font-medium text-white/25">Phase O</span>
          </div>
          <div className={`mt-0.5 flex items-center gap-1 text-[10px] font-medium transition-colors duration-300 ${statusColor}`}>
            <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotColor}`} />
            {statusLabel}
          </div>
        </div>

        {isRunning && (
          <button onClick={cancel} className="relative z-[1] flex-shrink-0 rounded p-1 text-white/20 hover:text-red-400/70 transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto px-3 py-3" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-2">
          {timeline.map(entry => (
            <TimelineItem key={entry.id} entry={entry} />
          ))}

          {/* Live stream display */}
          <AnimatePresence>
            {streamText && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex gap-2"
              >
                <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/12">
                  <Brain className="h-2.5 w-2.5 text-amber-400 animate-pulse" />
                </div>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-sm bg-white/[0.025] px-3 py-2">
                  <p className="text-[11px] leading-relaxed text-white/40 whitespace-pre-wrap break-words">
                    {stripToolCalls(streamText).slice(0, 600) || "…"}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Thinking dots */}
          <AnimatePresence>
            {isRunning && !streamText && (
              <motion.div
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex items-center gap-2 py-1"
              >
                <div className="flex gap-[3px]">
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="h-[5px] w-[5px] rounded-full bg-amber-400/50"
                      animate={{ opacity: [0.2, 1, 0.2], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
                    />
                  ))}
                </div>
                <span className="text-[10px] text-white/25">{statusLabel}</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div ref={bottomRef} className="h-2" />
      </div>

      {/* O3: Plan confirmation bar */}
      <AnimatePresence>
        {pendingPlan && !isRunning && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-indigo-500/20 bg-indigo-500/5"
          >
            <div className="flex items-center gap-2 px-3 py-2">
              <Zap className="h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
              <span className="flex-1 text-[11px] text-indigo-300/80">Execute this plan?</span>
              <button
                onClick={() => void confirmPlan()}
                className="flex items-center gap-1 rounded-md bg-indigo-500/20 px-2.5 py-1 text-[10px] font-semibold text-indigo-300 hover:bg-indigo-500/30 transition-colors"
              >
                <Check className="h-3 w-3" /> Yes
              </button>
              <button
                onClick={rejectPlan}
                className="flex items-center gap-1 rounded-md bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/35 hover:bg-white/[0.08] transition-colors"
              >
                <X className="h-3 w-3" /> No
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="flex-shrink-0 border-t border-white/[0.06] p-3">
        <div className="relative overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.025] transition-all duration-150 focus-within:border-amber-400/20 focus-within:bg-white/[0.04]">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={pendingPlan ? "Or type a new request to cancel the plan…" : "Ask Marcus to change anything…"}
            disabled={isRunning}
            rows={3}
            className="w-full resize-none bg-transparent px-3 py-2.5 pr-9 text-[12px] leading-[1.5] text-white/72 placeholder-white/18 outline-none disabled:opacity-40"
          />
          <button
            onClick={() => void submit()}
            disabled={!input.trim() || isRunning}
            className="absolute bottom-2 right-2 flex h-6 w-6 items-center justify-center rounded-lg bg-amber-400/12 text-amber-400 transition-all hover:bg-amber-400/22 disabled:cursor-not-allowed disabled:opacity-25"
          >
            {isRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </button>
        </div>
        <p className="mt-1.5 text-center text-[10px] text-white/15">⌘↵ to send</p>
      </div>
    </div>
  )
}

// ─── searchCode (frontend, no backend needed) ──────────────────────────────────
async function searchCodeRecursive(
  readFile: (p: string) => Promise<string>,
  listDir:  (p: string) => Promise<string[]>,
  path: string,
  query: string,
  depth = 0,
): Promise<string> {
  if (depth > 2) return ""
  const results: string[] = []
  try {
    const entries = await listDir(path)
    for (const e of entries.slice(0, 30)) {
      const full = joinPath(path, e.endsWith("/") ? e.slice(0, -1) : e)
      if (e.endsWith("/")) {
        const sub = await searchCodeRecursive(readFile, listDir, full, query, depth + 1)
        if (sub) results.push(sub)
      } else if (/\.(tsx?|jsx?|css|html|json)$/.test(e)) {
        try {
          const content = await readFile(full)
          const lines = content.split("\n")
          const matches = lines
            .map((l, i) => ({ n: i + 1, t: l }))
            .filter(({ t }) => t.includes(query))
            .slice(0, 4)
          if (matches.length) {
            results.push(`${full}:\n${matches.map(({ n, t }) => `  ${n}: ${t.trim()}`).join("\n")}`)
          }
        } catch { /* skip unreadable */ }
      }
      if (results.length >= 10) break
    }
  } catch { /* non-critical */ }
  return results.slice(0, 8).join("\n\n")
}

// ─── Timeline item renderer ────────────────────────────────────────────────────
function TimelineItem({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "user-msg") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="flex justify-end gap-2"
      >
        <div className="max-w-[195px] rounded-2xl rounded-tr-sm bg-white/[0.06] px-3 py-2">
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
    const isError = entry.phase === "error"
    const isDone  = entry.phase === "preview-ready"
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="flex gap-2"
      >
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-amber-400/12">
          <Cpu className="h-2.5 w-2.5 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`rounded-2xl rounded-tl-sm px-3 py-2 ${isError ? "bg-red-500/8 border border-red-500/15" : "bg-white/[0.035]"}`}>
            <MarkdownText text={entry.text} />
            {isDone && (
              <div className="mt-2 flex items-center gap-1 border-t border-white/[0.05] pt-1.5 text-emerald-400">
                <CheckCircle className="h-3 w-3" />
                <span className="text-[10px] font-medium">Changes live</span>
              </div>
            )}
            {isError && (
              <div className="mt-2 flex items-center gap-1 border-t border-red-500/10 pt-1.5 text-red-400">
                <AlertCircle className="h-3 w-3" />
                <span className="text-[10px]">Error</span>
              </div>
            )}
          </div>
          <p className="mt-0.5 pl-1 font-mono text-[9px] text-white/16">{entry.time}</p>
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "plan") {
    return (
      <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="flex gap-2"
      >
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-indigo-500/15">
          <Brain className="h-2.5 w-2.5 text-indigo-400" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="rounded-2xl rounded-tl-sm border border-indigo-500/15 bg-indigo-500/5 px-3 py-2">
            <MarkdownText text={entry.text} />
          </div>
          <p className="mt-0.5 pl-1 font-mono text-[9px] text-white/16">{entry.time}</p>
        </div>
      </motion.div>
    )
  }

  if (entry.kind === "tool-call") {
    const meta = TOOL_META[entry.name] ?? { icon: Zap, label: entry.name, color: "#9ca3af" }
    const Icon = meta.icon
    const done  = entry.status === "done"
    const error = entry.status === "error"
    return (
      <motion.div initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}
        className="flex items-start gap-2.5 rounded-lg border border-white/[0.05] bg-white/[0.02] px-2.5 py-1.5"
      >
        <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded"
          style={{ background: `${meta.color}1a` }}
        >
          {error
            ? <AlertCircle className="h-3 w-3 text-red-400" />
            : done
            ? <CheckCircle className="h-3 w-3" style={{ color: meta.color }} />
            : <Icon className="h-3 w-3 animate-spin" style={{ color: meta.color }} />
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-white/48">{meta.label}</span>
            {typeof entry.params.path === "string" && (
              <span className="truncate font-mono text-[9px] text-white/22">
                {entry.params.path.split("/").pop()}
              </span>
            )}
          </div>
          {error && entry.result && (
            <p className="mt-0.5 text-[10px] text-red-400/70 truncate">{entry.result.slice(0, 80)}</p>
          )}
        </div>
        <span className="flex-shrink-0 font-mono text-[9px] text-white/18">{entry.time}</span>
      </motion.div>
    )
  }

  if (entry.kind === "file-change") {
    const { change } = entry
    const color = OP_COLORS[change.operation] ?? "#9ca3af"
    const label = OP_LABELS[change.operation] ?? change.operation
    const file  = change.path.split("/").pop() ?? change.path
    return (
      <motion.div initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.18 }}
        className="flex items-center gap-2 rounded-lg border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5 pl-8"
      >
        <FileCode className="h-3 w-3 flex-shrink-0 text-white/22" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-white/45">{file}</span>
        <span className="flex-shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
          style={{ background: `${color}15`, color }}
        >
          {label}
        </span>
      </motion.div>
    )
  }

  if (entry.kind === "scan") {
    const done  = entry.status === "done"
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
            : <RefreshCw  className="h-3 w-3 animate-spin text-indigo-400" />
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

// ─── Safe inline bold renderer — no dangerouslySetInnerHTML ───────────────────
function InlineBold({ text }: { text: string }) {
  // Split on **...** and alternate between plain and bold spans
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

// ─── Simple markdown renderer — safe, no HTML injection ───────────────────────
function MarkdownText({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        if (line.startsWith("### "))
          return <p key={i} className="text-[10px] font-black uppercase tracking-widest text-amber-400/70 mt-2 mb-0.5">{line.slice(4)}</p>
        if (line.startsWith("## "))
          return <p key={i} className="text-[11px] font-bold text-white/75 mt-1.5 mb-0.5">{line.slice(3)}</p>
        if (line.startsWith("**") && line.endsWith("**") && line.length > 4)
          return <p key={i} className="text-[12px] font-semibold text-white/75">{line.slice(2, -2)}</p>
        if (line.startsWith("- ") || line.startsWith("• "))
          return (
            <div key={i} className="flex items-start gap-1.5 my-0.5">
              <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400/50 shrink-0" />
              <span className="text-[12px] leading-relaxed text-white/55"><InlineBold text={line.slice(2)} /></span>
            </div>
          )
        if (/^\d+\./.test(line)) {
          const num  = line.match(/^(\d+)\./)?.[1]
          const rest = line.replace(/^\d+\.\s*/, "")
          return (
            <div key={i} className="flex items-start gap-2 my-0.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-amber-400/10 text-[9px] font-bold text-amber-400 mt-0.5">{num}</span>
              <span className="text-[12px] leading-relaxed text-white/55"><InlineBold text={rest} /></span>
            </div>
          )
        }
        return <p key={i} className="text-[12px] leading-relaxed text-white/55"><InlineBold text={line} /></p>
      })}
    </div>
  )
}
