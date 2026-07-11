// ─── AgentRuntime — Core agent logic extracted from AgentPanel ─────────────────
// Handles: tool execution, streaming, conversation management, project memory

import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { FileDiff } from "./DiffReviewPanel"
import { useWebContainer } from "@/components/website-v2/runtime/useWebContainer"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ProjectMemory {
  framework?:       string
  style?:           string
  colors?:          string[]
  dependencies?:    string[]
  routeCount?:      number
  componentCount?:  number
  fileTree?:        string
  previousChanges?: string[]
  userPreferences?: string[]

  // Phase 4: Persisted across sessions
  commonCommands?:  string[]
  acceptedPatterns?: string[]
  rejectedPatterns?: string[]
}

// Phase 5: Custom tool registry
export interface CustomTool {
  name: string
  description: string
  params: Record<string, { type: string; description: string; required?: boolean }>
  handler: (params: Record<string, unknown>) => Promise<{ result: string; ok: boolean }>
}

export interface AgentMessage {
  role:    "user" | "assistant"
  content: string
}

export interface ToolCall {
  name:   string
  params: Record<string, unknown>
}

export interface ToolResult {
  name:   string
  params: Record<string, unknown>
  result: string
  ok:     boolean
}

export type FileChangeOp = "update" | "create" | "delete"
export interface FileChange {
  path:      string
  operation: FileChangeOp
}

export type TimelineEntry =
  | { kind: "user-msg";    text: string; id: string; time: string }
  | { kind: "agent-msg";   text: string; phase?: string; id: string; time: string }
  | { kind: "thinking";    text: string; id: string; time: string }
  | { kind: "tool-call";   name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string; id: string; time: string }
  | { kind: "file-change"; change: FileChange; id: string; time: string }
  | { kind: "scan";        status: "running" | "done" | "error"; summary?: string; id: string; time: string }
  | { kind: "plan";        text: string; id: string; time: string }

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

export const TOOL_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  read_file:    { icon: () => null, label: "Reading file",       color: "#818cf8" },
  write_file:   { icon: () => null, label: "Writing file",       color: "#f59e0b" },
  list_dir:     { icon: () => null, label: "Listing directory",  color: "#6ee7b7" },
  search_code:  { icon: () => null, label: "Searching code",     color: "#a78bfa" },
  run_command:  { icon: () => null, label: "Running command",    color: "#38bdf8" },
  done:         { icon: () => null, label: "Done",               color: "#10b981" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function nowTime() {
  const d = new Date()
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

export function uid() {
  return `e-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function parseToolCalls(text: string): ToolCall[] {
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

export function stripToolCalls(text: string): string {
  return text.replace(/<tool_call>[\s\S]*?<\/tool_call>/g, "").trim()
}

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
export interface AgentStreamEvent {
  type: "thinking" | "thinking_end" | "text" | "tool_call" | "tool_result" | "tool_diff" | "done" | "error";
  content?: string;
  id?: string;
  name?: string;
  params?: Record<string, unknown>;
  status?: "running" | "done" | "error";
  result?: string;
  ok?: boolean;
  path?: string;
  oldContent?: string;
  newContent?: string;
  error?: string;
}

export async function streamAgent(
  payload: { projectMemory?: ProjectMemory; messages: AgentMessage[]; mode: "plan" | "execute" },
  signal: AbortSignal,
  onEvent: (event: AgentStreamEvent) => void,
): Promise<string> {
  const res = await fetch("/api/copilot/agent", {
    method:      "POST",
    credentials: "include",
    headers:     { "Content-Type": "application/json" },
    body:        JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let carry = ""
  let finalText = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = carry + decoder.decode(value, { stream: true })
    const lines = chunk.split("\n")
    carry = lines.pop() ?? ""

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue
      const data = line.slice(6).trim()
      if (data === "[DONE]") continue

      try {
        const event = JSON.parse(data) as AgentStreamEvent

        // Forward all events to handler
        onEvent(event)

        // Track final text content
        if (event.type === "text") {
          finalText += event.content ?? ""
        }

        if (event.type === "done") {
          return finalText
        }
        if (event.type === "error") {
          throw new Error(event.error ?? "Agent stream error")
        }
      } catch (e) {
        if (e instanceof Error && e.message !== "Agent stream error") {
          console.warn("[streamAgent] Failed to parse SSE event:", data.slice(0, 200))
        }
        throw e
      }
    }
  }

  // Flush carry
  if (carry.startsWith("data: ")) {
    const data = carry.slice(6).trim()
    if (data && data !== "[DONE]") {
      try {
        const event = JSON.parse(data) as AgentStreamEvent
        onEvent(event)
        if (event.type === "text") finalText += event.content ?? ""
      } catch { /* ignore */ }
    }
  }

  return finalText
}

// ─── AgentRuntime class ───────────────────────────────────────────────────────
export class AgentRuntime {
  private project: V2Project
  private onEditComplete: () => void
  private onFileOpen: (file: V2ProjectFile) => void
  private onFileDiff?: (diff: FileDiff) => void
  private externalInput?: string | null
  private onExternalInputConsumed?: () => void

  // WebContainer tools
  private readFile: (path: string) => Promise<string>
  private writeFile: (path: string, content: string) => Promise<void>
  private writeFileForReview: (path: string, content: string) => Promise<{ oldContent: string; newContent: string; path: string }>
  private listDir: (path: string) => Promise<string[]>
  private runCommand: (cmd: string, args: string[]) => Promise<{ output: string; exitCode: number }>
  private wcStatus: string

// State
  private projectMemory: ProjectMemory | null = null
  private scanStatus: "idle" | "scanning" | "done" | "error" = "idle"
  private conversation: AgentMessage[] = []
  private timeline: TimelineEntry[] = []
  private phase: string | null = null
  private pendingPlan: string | null = null
  private streamText = ""
  private abortRef: AbortController | null = null
  private isRunning = false

  // Phase 5: Checkpoints & Custom tools
  private checkpoints: Map<string, { id: string; label: string; files: Map<string, string>; timestamp: string }> = new Map()
  private customTools: Map<string, { description: string; script: string }> = new Map()

  // Phase 6: Background tasks & Git
  private backgroundTasks: Map<string, { id: string; cmd: string; args: string[]; webhook?: string; startTime: number; output: string; exitCode: number; status: string }> = new Map()

  // Callbacks for UI updates
  private onTimelineChange: (entries: TimelineEntry[]) => void
  private onPhaseChange: (phase: string | null) => void
  private onStreamTextChange: (text: string) => void
  private onEvent: (event: AgentStreamEvent) => void
  private onPendingPlanChange: (plan: string | null) => void
  private onProjectMemoryChange: (memory: ProjectMemory | null) => void
  private onScanStatusChange: (status: "idle" | "scanning" | "done" | "error") => void
  private onConversationChange: (messages: AgentMessage[]) => void
  private onIsRunningChange: (running: boolean) => void

  constructor(params: {
    project: V2Project
    onEditComplete: () => void
    onFileOpen: (file: V2ProjectFile) => void
    onFileDiff?: (diff: FileDiff) => void
    externalInput?: string | null
    onExternalInputConsumed?: () => void
    // WebContainer tools
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    writeFileForReview: (path: string, content: string) => Promise<{ oldContent: string; newContent: string; path: string }>
    listDir: (path: string) => Promise<string[]>
    runCommand: (cmd: string, args: string[]) => Promise<{ output: string; exitCode: number }>
    wcStatus: string
    // UI callbacks
    onTimelineChange: (entries: TimelineEntry[]) => void
    onPhaseChange: (phase: string | null) => void
    onStreamTextChange: (text: string) => void
    onEvent: (event: AgentStreamEvent) => void
    onPendingPlanChange: (plan: string | null) => void
    onProjectMemoryChange: (memory: ProjectMemory | null) => void
    onScanStatusChange: (status: "idle" | "scanning" | "done" | "error") => void
    onConversationChange: (messages: AgentMessage[]) => void
    onIsRunningChange: (running: boolean) => void
  }) {
    this.project = params.project
    this.onEditComplete = params.onEditComplete
    this.onFileOpen = params.onFileOpen
    this.onFileDiff = params.onFileDiff
    this.externalInput = params.externalInput
    this.onExternalInputConsumed = params.onExternalInputConsumed
    this.readFile = params.readFile
    this.writeFile = params.writeFile
    this.writeFileForReview = params.writeFileForReview
    this.listDir = params.listDir
    this.runCommand = params.runCommand
    this.wcStatus = params.wcStatus
    this.onTimelineChange = params.onTimelineChange
    this.onPhaseChange = params.onPhaseChange
    this.onStreamTextChange = params.onStreamTextChange
    this.onEvent = params.onEvent
    this.onPendingPlanChange = params.onPendingPlanChange
    this.onProjectMemoryChange = params.onProjectMemoryChange
    this.onScanStatusChange = params.onScanStatusChange
    this.onConversationChange = params.onConversationChange
    this.onIsRunningChange = params.onIsRunningChange
  }

  // ── Timeline helpers ────────────────────────────────────────────────────────
  private addEntry(entry: TimelineEntry): string {
    const fullEntry = { ...entry, id: uid(), time: nowTime() }
    this.timeline = [...this.timeline, fullEntry]
    this.onTimelineChange(this.timeline)
    return fullEntry.id
  }

  private updateEntry(id: string, patch: Partial<TimelineEntry>) {
    this.timeline = this.timeline.map(e => {
      if (e.id !== id) return e
      // Type-safe merge for discriminated union
      const updated = { ...e, ...patch }
      return updated as TimelineEntry
    })
    this.onTimelineChange(this.timeline)
  }

  // ── O1: Auto-scan project when WC becomes ready ─────────────────────────────
  async scanProject() {
    if (this.wcStatus !== "ready" || this.scanStatus !== "idle") return
    this.scanStatus = "scanning"
    this.onScanStatusChange(this.scanStatus)

    const scanId = this.addEntry({ kind: "scan", status: "running", id: "", time: "" })

    try {
      const mem: ProjectMemory = { previousChanges: [], userPreferences: [] }

      // Read package.json for framework + deps
      try {
        const pkg = JSON.parse(await this.readFile("/package.json")) as {
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
        const appEntries = await this.listDir("/src/app").catch(() => this.listDir("/src/pages").catch(() => []))
        mem.routeCount = appEntries.filter(e => !e.endsWith("/")).length
      } catch { /* non-critical */ }

      // Count components
      try {
        const comps = await this.listDir("/src/components").catch(() => [])
        mem.componentCount = comps.length
      } catch { /* non-critical */ }

      // Try to detect color scheme from globals.css or tailwind.config
      try {
        const globals = await this.readFile("/src/app/globals.css").catch(() => this.readFile("/src/styles/globals.css").catch(() => ""))
        const colorMatches = globals.match(/#[0-9a-f]{3,6}/gi) ?? []
        if (colorMatches.length > 0) mem.colors = [...new Set(colorMatches)].slice(0, 5)
      } catch { /* non-critical */ }

      // Build file tree (2 levels deep)
      try {
        mem.fileTree = await buildFileTree(this.listDir, "/src")
      } catch { /* non-critical */ }

      this.projectMemory = mem
      this.onProjectMemoryChange(mem)
      this.scanStatus = "done"
      this.onScanStatusChange(this.scanStatus)

      // Restore persisted memory patterns
      this.restorePersistedMemory()

      const summary = [
        mem.framework ?? "Unknown framework",
        mem.style,
        mem.routeCount ? `${mem.routeCount} routes` : null,
        mem.componentCount ? `${mem.componentCount} components` : null,
        mem.dependencies?.length ? `${mem.dependencies.length} deps` : null,
      ].filter(Boolean).join(" · ")

      this.updateEntry(scanId, { status: "done", summary } as Partial<TimelineEntry>)

      // Welcome message now that we know the project
      this.addEntry({
        kind: "agent-msg",
        text: `I analyzed **${this.project.projectName}**.

**Framework:** ${mem.framework ?? "Unknown"}
${mem.style ? `**UI:** ${mem.style}` : ""}
${mem.routeCount ? `**Routes:** ${mem.routeCount}` : ""}
${mem.componentCount ? `**Components:** ${mem.componentCount}` : ""}

Tell me what to change and I'll plan it first, then execute it.`,
        id: "",
        time: "",
      })
    } catch (err) {
      this.scanStatus = "error"
      this.onScanStatusChange(this.scanStatus)
      this.updateEntry(scanId, { status: "error" } as Partial<TimelineEntry>)
      this.addEntry({ kind: "agent-msg", text: "Could not scan project — the WebContainer may still be starting.", phase: "error", id: "", time: "" })
      console.error("[AgentRuntime:scan]", err)
    }
  }

  // ── Phase 4: ProjectMemory persistence (localStorage) ────────────────────────
  private static readonly STORAGE_KEY = "marcus:projectMemory"

  private static loadPersistedMemory(): { previousChanges: string[]; userPreferences: string[]; acceptedPatterns: string[]; rejectedPatterns: string[] } | null {
    try {
      const raw = localStorage.getItem(AgentRuntime.STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  }

  private static savePersistedMemory(data: { previousChanges: string[]; userPreferences: string[]; acceptedPatterns: string[]; rejectedPatterns: string[] }) {
    try {
      localStorage.setItem(AgentRuntime.STORAGE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private static mergeMemory(current: ProjectMemory, persisted: { previousChanges: string[]; userPreferences: string[]; acceptedPatterns: string[]; rejectedPatterns: string[] }): ProjectMemory {
    return {
      ...current,
      previousChanges: [...new Set([...(persisted.previousChanges || []), ...(current.previousChanges || [])])].slice(-20),
      userPreferences: [...new Set([...(persisted.userPreferences || []), ...(current.userPreferences || [])])],
      acceptedPatterns: persisted.acceptedPatterns || [],
      rejectedPatterns: persisted.rejectedPatterns || [],
    }
  }

  private static recordPattern(accepted: boolean, pattern: string) {
    const persisted = AgentRuntime.loadPersistedMemory() || { previousChanges: [], userPreferences: [], acceptedPatterns: [], rejectedPatterns: [] }
    if (accepted) {
      persisted.acceptedPatterns = [...new Set([...persisted.acceptedPatterns, pattern])].slice(-20)
    } else {
      persisted.rejectedPatterns = [...new Set([...persisted.rejectedPatterns, pattern])].slice(-20)
    }
    AgentRuntime.savePersistedMemory(persisted)
  }

  // Call after user accepts/rejects a diff
  static recordDiffOutcome(accepted: boolean, filePath: string, changeType: string) {
    const pattern = `${changeType}:${filePath.split("/").pop()}`
    AgentRuntime.recordPattern(accepted, pattern)
  }

  // Restore persisted memory into current projectMemory
  private restorePersistedMemory() {
    const persisted = AgentRuntime.loadPersistedMemory()
    if (persisted && this.projectMemory) {
      this.projectMemory = AgentRuntime.mergeMemory(this.projectMemory, persisted)
      this.onProjectMemoryChange(this.projectMemory)
    }
  }

  // ── Phase 5: Checkpoint/Rollback ─────────────────────────────────────────────
  private async createCheckpoint(label: string): Promise<string> {
    const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const timestamp = nowTime()
    
    // Snapshot all tracked files
    const files = new Map<string, string>()
    for (const file of this.project.files) {
      try {
        const content = await this.readFile(file.path)
        files.set(file.path, content)
      } catch { /* ignore unreadable */ }
    }

    const checkpoint = { id, label, timestamp, files }
    this.checkpoints.set(id, checkpoint)
    
    // Keep last 10 checkpoints
    if (this.checkpoints.size > 10) {
      const firstKey = this.checkpoints.keys().next().value
      if (firstKey) this.checkpoints.delete(firstKey)
    }

    this.addEntry({
      kind: "agent-msg",
      text: `📸 Checkpoint created: **${label}** (${id})`,
      id: "",
      time: "",
    })

    return id
  }

  async restoreCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return false

    for (const [path, content] of checkpoint.files) {
      await this.writeFile(path, content)
    }

    this.addEntry({
      kind: "agent-msg",
      text: `⏪ Restored checkpoint: **${checkpoint.label}** (${checkpoint.id})`,
      id: "",
      time: "",
    })

    return true
  }

  listCheckpoints(): Array<{ id: string; label: string; timestamp: string }> {
    return Array.from(this.checkpoints.entries()).map(([id, c]) => ({ id, label: c.label, timestamp: c.timestamp }))
  }

  // Execute a tool that requires checkpoint creation
  async executeWithCheckpoint(tc: ToolCall, checkpointLabel: string): Promise<ToolResult> {
    await this.createCheckpoint(checkpointLabel)
    return this.executeTool(tc)
  }

  // ── O2: Execute a single tool against WebContainer ──────────────────────────
  private async executeTool(tc: ToolCall): Promise<ToolResult> {
    const { name, params } = tc

    try {
      if (name === "read_file") {
        const path = params.path as string
        const content = await this.readFile(path)
        return { name, params, result: content, ok: true }
      }

      if (name === "write_file") {
        const path    = params.path    as string
        const content = params.content as string
        // Return diff for review — caller decides whether to apply
        const diff = await this.writeFileForReview(path, content)
        if (this.onFileDiff) {
          this.onFileDiff({
            id:         `diff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            path: diff.path,
            oldContent: diff.oldContent,
            newContent: diff.newContent,
            isNew:      diff.oldContent === "",
          })
        }
        return { name, params, result: `⏳ Diff ready for review: ${path}`, ok: true }
      }

      if (name === "write_files") {
        const files = params.files as Array<{ path: string; content: string }>
        const results: string[] = []
        for (const file of files) {
          const diff = await this.writeFileForReview(file.path, file.content)
          if (this.onFileDiff) {
            this.onFileDiff({
              id:         `diff-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              path: diff.path,
              oldContent: diff.oldContent,
              newContent: diff.newContent,
              isNew:      diff.oldContent === "",
            })
          }
          results.push(`⏳ Diff ready for review: ${file.path}`)
        }
        return { name, params, result: results.join("\n"), ok: true }
      }

      if (name === "list_dir") {
        const path = (params.path as string) || "/"
        const entries = await this.listDir(path)
        return { name, params, result: entries.join("\n"), ok: true }
      }

      if (name === "search_code") {
        const query = params.query as string
        const searchPath = (params.path as string) || "/src"
        const results = await this.searchCodeRecursive(searchPath, query)
        return { name, params, result: results || "(no matches)", ok: true }
      }

      if (name === "run_command") {
        const cmd  = params.cmd  as string
        const args = (params.args as string[]) ?? []
        const { output, exitCode } = await this.runCommand(cmd, args)
        return {
          name, params,
          result: `Exit code: ${exitCode}\n${output.slice(0, 2000)}`,
          ok: exitCode === 0,
        }
      }

      // Phase 5: Checkpoint/Rollback
      if (name === "checkpoint") {
        const label = (params.label as string) || `checkpoint-${Date.now()}`
        try {
          // Capture all tracked files
          const files = await this.listDir("/")
          const snapshot: Record<string, string> = {}
          for (const f of files) {
            if (!f.endsWith("/")) {
              try {
                snapshot[f] = await this.readFile(f)
              } catch { /* ignore */ }
            }
          }
          this.checkpoints = this.checkpoints || new Map()
          this.checkpoints.set(label, { id: label, label, files: new Map(Object.entries(snapshot)), timestamp: nowTime() })
          return { name, params, result: `✓ Checkpoint "${label}" created (${Object.keys(snapshot).length} files)`, ok: true }
        } catch (err) {
          return { name, params, result: `Error creating checkpoint: ${err}`, ok: false }
        }
      }

      if (name === "rollback") {
        const label = (params.label as string) || ""
        if (!label || !this.checkpoints?.has(label)) {
          const available = this.checkpoints ? Array.from(this.checkpoints.keys()).join(", ") : "none"
          return { name, params, result: `Checkpoint "${label}" not found. Available: ${available}`, ok: false }
        }
        try {
          const snapshot = this.checkpoints!.get(label)!
          for (const [path, content] of Object.entries(snapshot.files)) {
            await this.writeFile(path, content)
          }
          return { name, params, result: `✓ Rolled back to "${label}" (${Object.keys(snapshot.files).length} files restored)`, ok: true }
        } catch (err) {
          return { name, params, result: `Error rolling back: ${err}`, ok: false }
        }
      }

      if (name === "list_checkpoints") {
        const labels = this.checkpoints ? Array.from(this.checkpoints.entries()).map(([label, snap]) => 
          `${label} (${Object.keys(snap.files).length} files, ${new Date(snap.timestamp).toLocaleTimeString()})`
        ).join("\n") : "No checkpoints available"
        return { name, params, result: labels, ok: true }
      }

      // Phase 5: Custom tool registry
      if (name === "register_tool") {
        const toolName = params.name as string
        const description = params.description as string
        const script = params.script as string
        if (!toolName || !script) {
          return { name, params, result: "Missing tool name or script", ok: false }
        }
        this.customTools = this.customTools || new Map()
        this.customTools.set(toolName, { description, script })
        return { name, params, result: `✓ Custom tool "${toolName}" registered`, ok: true }
      }

      if (name === "list_custom_tools") {
        const tools = this.customTools ? Array.from(this.customTools.entries()).map(([name, t]) => 
          `${name}: ${t.description}`
        ).join("\n") : "No custom tools registered"
        return { name, params, result: tools, ok: true }
      }

      if (name === "run_custom_tool") {
        const toolName = params.name as string
        const args = params.args as Record<string, unknown> || {}
        if (!toolName || !this.customTools?.has(toolName)) {
          return { name, params, result: `Custom tool "${toolName}" not found`, ok: false }
        }
        try {
          const tool = this.customTools.get(toolName)!
          // Execute the custom tool script (simplified - in production use a sandbox)
          const result = await this.executeCustomTool(tool.script, args)
          return { name, params, result, ok: true }
        } catch (err) {
          return { name, params, result: `Error running custom tool: ${err}`, ok: false }
        }
      }

      // Phase 6: Background Tasks
      if (name === "background_task") {
        const cmd = params.cmd as string
        const args = (params.args as string[]) ?? []
        const webhook = params.webhook as string | undefined

        if (!cmd) {
          return { name, params, result: "Missing cmd parameter", ok: false }
        }

        try {
          const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
          this.backgroundTasks = this.backgroundTasks || new Map()

          // Start the command in background
          const proc = await this.runCommand(cmd, args)
          
          const task = {
            id: taskId,
            cmd,
            args,
            webhook,
            startTime: Date.now(),
            output: proc.output,
            exitCode: proc.exitCode,
            status: proc.exitCode === 0 ? "completed" : "failed",
          }

          this.backgroundTasks.set(taskId, task)

          // If webhook provided, send completion notification
          if (webhook) {
            try {
              await fetch(webhook, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ taskId, ...task }),
              })
            } catch { /* ignore webhook errors */ }
          }

          return { name, params, result: `Background task started: ${taskId}\n${proc.output.slice(0, 500)}`, ok: true }
        } catch (err) {
          return { name, params, result: `Error starting background task: ${err}`, ok: false }
        }
      }

      if (name === "list_background_tasks") {
        const tasks = this.backgroundTasks ? Array.from(this.backgroundTasks.entries()).map(([id, t]) =>
          `${id}: ${t.cmd} ${t.args.join(" ")} — ${t.status} (exit ${t.exitCode})`
        ).join("\n") : "No background tasks"
        return { name, params, result: tasks, ok: true }
      }

      // Phase 6: Git Integration
      if (name === "git_status") {
        try {
          const { output, exitCode } = await this.runCommand("git", ["status", "--porcelain"])
          return { name, params, result: output || "(clean)", ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "git_diff") {
        const staged = params.staged as boolean | undefined
        try {
          const args = staged ? ["diff", "--staged"] : ["diff"]
          const { output, exitCode } = await this.runCommand("git", args)
          return { name, params, result: output || "(no changes)", ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "git_commit") {
        const message = params.message as string
        if (!message) {
          return { name, params, result: "Missing commit message", ok: false }
        }
        try {
          const { output, exitCode } = await this.runCommand("git", ["commit", "-m", message])
          return { name, params, result: output || "Committed", ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "git_add") {
        const files = params.files as string[] | undefined
        if (!files || files.length === 0) {
          return { name, params, result: "Missing files to add", ok: false }
        }
        try {
          const { output, exitCode } = await this.runCommand("git", ["add", ...files])
          return { name, params, result: output || `Added ${files.length} file(s)`, ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "git_branch") {
        const name_ = params.name as string
        const create = params.create as boolean | undefined
        try {
          const args = create ? ["checkout", "-b", name_] : ["branch"]
          if (!create) args.push(name_ || "")
          const { output, exitCode } = await this.runCommand("git", args.filter(Boolean))
          return { name, params, result: output || (create ? `Created branch ${name_}` : "Branch listed"), ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "git_push") {
        const remote = params.remote as string | undefined
        const branch = params.branch as string | undefined
        try {
          const args = ["push"]
          if (remote) args.push(remote)
          if (branch) args.push(branch)
          const { output, exitCode } = await this.runCommand("git", args)
          return { name, params, result: output || "Pushed", ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "git_log") {
        const limit = (params.limit as number) || 20
        try {
          const { output, exitCode } = await this.runCommand("git", ["log", `--oneline`, `-${limit}`])
          return { name, params, result: output || "(no commits)", ok: exitCode === 0 }
        } catch (err) {
          return { name, params, result: `Git error: ${err}`, ok: false }
        }
      }

      if (name === "done") {
        return { name, params, result: (params.summary as string) ?? "Done.", ok: true }
      }

      return { name, params, result: `Unknown tool: ${name}`, ok: false }
    }
    catch { /* ignore */ }
    return { name: name || "", params: params || {}, result: "Tool execution error", ok: false }
  }

  // Recursive search helper
  private async searchCodeRecursive(dir: string, query: string): Promise<string> {
    const results: string[] = []
    const lowerQuery = query.toLowerCase()

    const walk = async (currentDir: string) => {
      try {
        const entries = await this.listDir(currentDir)
        for (const entry of entries) {
          const fullPath = currentDir.endsWith("/") ? `${currentDir}${entry}` : `${currentDir}/${entry}`
          if (entry.endsWith("/")) {
            await walk(fullPath)
          } else if (/\.(tsx?|jsx?|css|scss|json|md|html)$/i.test(entry)) {
            try {
              const content = await this.readFile(fullPath)
              if (content.toLowerCase().includes(lowerQuery)) {
                const lines = content.split("\n")
                const matches = lines
                  .map((l: string, i: number) => l.toLowerCase().includes(lowerQuery) ? `${i + 1}:${l.trim()}` : null)
                  .filter(Boolean)
                  .slice(0, 5)
                if (matches.length > 0) {
                  results.push(`${fullPath}:\n${matches.join("\n")}`)
                }
              }
            } catch { /* skip unreadable */ }
          }
        }
      } catch { /* skip unreadable dir */ }
    }

    await walk(dir)
    return results.slice(0, 20).join("\n\n")
  }

  // Execute custom tool script (simplified - in production use a proper sandbox)
  private async executeCustomTool(script: string, args: Record<string, unknown>): Promise<string> {
    try {
      // Create a safe execution context with limited globals
      const context = {
        args,
        readFile: this.readFile.bind(this),
        writeFile: this.writeFile.bind(this),
        listDir: this.listDir.bind(this),
        runCommand: this.runCommand.bind(this),
        console: {
          log: (...args: unknown[]) => console.log("[custom-tool]", ...args),
          error: (...args: unknown[]) => console.error("[custom-tool]", ...args),
        },
      }
      // Use Function constructor for isolated execution (safer than eval)
      const fn = new Function(...Object.keys(context), `return (async () => { ${script} })()`)
      const result = await fn(...Object.values(context))
      return result ?? "Tool completed (no return value)"
    } catch (err) {
      throw new Error(`Custom tool execution failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Main agent loop ─────────────────────────────────────────────────────────
  async runAgentLoop(initialConversation: AgentMessage[], mode: "plan" | "execute") {
    if (this.abortRef) this.abortRef.abort()
    const ctrl = new AbortController()
    this.abortRef = ctrl

    this.isRunning = true
    this.onIsRunningChange(true)

    let conv = [...initialConversation]

    for (let i = 0; i < MAX_LOOP_ITERATIONS; i++) {
      this.streamText = ""
      this.onStreamTextChange("")
      this.phase = mode === "plan" ? "planning" : `executing-${i + 1}`
      this.onPhaseChange(this.phase)

      // Collect tool calls from streaming events
      const collectedToolCalls: Array<{ id: string; name: string; params: Record<string, unknown> }> = []

      let fullText = ""
      try {
        fullText = await streamAgent(
          { projectMemory: this.projectMemory ?? undefined, messages: conv, mode },
          ctrl.signal,
          (event) => {
            switch (event.type) {
              case "thinking":
                this.streamText += `💭 ${event.content}\n`
                this.onStreamTextChange(this.streamText)
                break
              case "thinking_end":
                // thinking phase ended
                break
              case "text":
                if (event.content) {
                  this.streamText += event.content
                  this.onStreamTextChange(this.streamText)
                }
                break
              case "tool_call":
                if (event.id && event.name) {
                  collectedToolCalls.push({ id: event.id, name: event.name, params: event.params ?? {} })
                  // Add tool call entry to timeline
                  this.addEntry({
                    kind: "tool-call",
                    name: event.name,
                    params: event.params ?? {},
                    status: "running",
                    id: "",
                    time: "",
                  })
                }
                break
              case "tool_diff":
                // Diff preview for write_file - handled by UI
                break
              case "error":
                throw new Error(event.error ?? "Agent stream error")
            }
          },
        )
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          this.isRunning = false
          this.onIsRunningChange(false)
          this.phase = null
          this.onPhaseChange(null)
          return
        }
        this.addEntry({
          kind: "agent-msg",
          text: `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
          phase: "error",
          id: "",
          time: "",
        })
        break
      }

      this.streamText = ""
      this.onStreamTextChange("")

      // O3: Plan mode — show plan and wait for user confirmation
      if (mode === "plan") {
        const displayText = stripToolCalls(fullText)
        this.addEntry({ kind: "plan", text: displayText, id: "", time: "" })
        this.pendingPlan = fullText
        this.onPendingPlanChange(fullText)
        this.conversation = [
          ...conv,
          { role: "assistant", content: fullText },
        ]
        this.onConversationChange(this.conversation)
        this.phase = null
        this.onPhaseChange(null)
        this.isRunning = false
        this.onIsRunningChange(false)
        return
      }

      // Execute mode: use collected tool calls from streaming
      const toolCalls = collectedToolCalls
      const displayText = stripToolCalls(fullText)

      if (displayText) {
        this.addEntry({ kind: "agent-msg", text: displayText, id: "", time: "" })
      }

      if (toolCalls.length === 0) {
        // LLM gave a text response with no tool calls — treat as done
        break
      }

      // Check if done
      const doneCall = toolCalls.find(tc => tc.name === "done")
      if (doneCall) {
        const summary = (doneCall.params.summary as string) ?? "All changes applied."
        this.addEntry({ kind: "agent-msg", text: `✓ ${summary}`, phase: "preview-ready", id: "", time: "" })

        // Track in memory
        if (this.projectMemory) {
          this.projectMemory = {
            ...this.projectMemory,
            previousChanges: [...(this.projectMemory.previousChanges ?? []), summary].slice(-10),
          }
          this.onProjectMemoryChange(this.projectMemory)
        }
        this.onEditComplete()
        break
      }

      // O4: Execute all tool calls (multi-file) — run independent read-only tools in parallel
      const nonDoneCalls = toolCalls.filter(tc => tc.name !== "done")
      const toolResultMessages: string[] = []

      // Split into parallelizable (read-only) and sequential (write) tools
      const readOnlyTools = new Set(["read_file", "list_dir", "search_code"])
      const parallelCalls = nonDoneCalls.filter(tc => readOnlyTools.has(tc.name))
      const sequentialCalls = nonDoneCalls.filter(tc => !readOnlyTools.has(tc.name))

      // Execute parallel read-only tools concurrently
      if (parallelCalls.length > 0) {
        const parallelResults = await Promise.all(
          parallelCalls.map(async (tc) => {
            const meta = TOOL_META[tc.name]
            const entryId = this.addEntry({ kind: "tool-call", name: tc.name, params: tc.params, status: "running", id: "", time: "" })
            const toolResult = await this.executeTool(tc)
            this.updateEntry(entryId, { status: toolResult.ok ? "done" : "error", result: toolResult.result } as Partial<TimelineEntry>)
            return { tc, toolResult, meta }
          })
        )

        for (const { tc, toolResult, meta } of parallelResults) {
          const resultStr = toolResult.result.length > 1500
            ? toolResult.result.slice(0, 1500) + "\n...[truncated]"
            : toolResult.result
          toolResultMessages.push(`<tool_result name="${tc.name}">${resultStr}</tool_result>`)
          if (!meta) console.warn("[AgentRuntime] Unknown tool:", tc.name)
        }
      }

      // Execute sequential tools (writes, commands) one by one
      for (const tc of sequentialCalls) {
        const meta = TOOL_META[tc.name]
        const entryId = this.addEntry({ kind: "tool-call", name: tc.name, params: tc.params, status: "running", id: "", time: "" })

        const toolResult = await this.executeTool(tc)

        this.updateEntry(entryId, { status: toolResult.ok ? "done" : "error", result: toolResult.result } as Partial<TimelineEntry>)

        if (tc.name === "write_file") {
          const path = tc.params.path as string
          this.addEntry({
            kind: "file-change",
            change: { path, operation: "update" },
            id: "",
            time: "",
          })
        }

        const resultStr = toolResult.result.length > 1500
          ? toolResult.result.slice(0, 1500) + "\n...[truncated]"
          : toolResult.result

        toolResultMessages.push(
          `<tool_result name="${tc.name}">${resultStr}</tool_result>`
        )

        if (!meta) console.warn("[AgentRuntime] Unknown tool:", tc.name)
      }

      // Add LLM's response + tool results to conversation for next iteration
      conv = [
        ...conv,
        { role: "assistant", content: fullText },
        { role: "user",      content: `Tool results:\n${toolResultMessages.join("\n\n")}` },
      ]
    }

    this.phase = null
    this.onPhaseChange(null)
    this.isRunning = false
    this.onIsRunningChange(false)
  }

  // ── O3: Handle plan confirmation ────────────────────────────────────────────
  async confirmPlan() {
    if (!this.pendingPlan) return
    this.pendingPlan = null
    this.onPendingPlanChange(null)

    const confirmConv: AgentMessage[] = [
      ...this.conversation,
      { role: "user", content: "Continue." },
    ]
    this.conversation = confirmConv
    this.onConversationChange(this.conversation)

    await this.runAgentLoop(confirmConv, "execute")
  }

  rejectPlan() {
    this.pendingPlan = null
    this.onPendingPlanChange(null)
    this.phase = null
    this.onPhaseChange(null)
    this.addEntry({ kind: "agent-msg", text: "Plan cancelled. What would you like to do instead?", id: "", time: "" })
  }

  // ── Submit handler ──────────────────────────────────────────────────────────
  async submit(input: string, editorContext?: {
    activeFilePath: string | null
    activeFileContent: string | null
    selection: string | null
    terminalOutput: string
    fileTree: string
  }) {
    const text = input.trim()
    if (!text || this.isRunning) return

    // Phase 4: Parse @mentions (@file:path, @terminal)
    const mentionRegex = /@(file|terminal):?([^\s]+)?/g
    const mentions: Array<{ type: "file" | "terminal"; path?: string }> = []
    let match: RegExpExecArray | null
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push({ type: match[1] as "file" | "terminal", path: match[2] })
    }
    // Remove mentions from the user-facing text (but keep them for context)
    const cleanText = text.replace(mentionRegex, "").trim()

    // Build context block (auto-attached + mentions)
    let contextBlock = ""
    if (editorContext || mentions.length > 0) {
      const parts: string[] = []

      // Auto-attached workspace context
      if (editorContext) {
        if (editorContext.activeFilePath) {
          parts.push(`## Current File: ${editorContext.activeFilePath}`)
          if (editorContext.activeFileContent) {
            parts.push(`\`\`\`\n${editorContext.activeFileContent}\n\`\`\``)
          }
        }
        if (editorContext.selection) {
          parts.push(`## Selected Text\n\`\`\`\n${editorContext.selection}\n\`\`\``)
        }
        if (editorContext.terminalOutput) {
          parts.push(`## Recent Terminal Output (last 50 lines)\n\`\`\`\n${editorContext.terminalOutput}\n\`\`\``)
        }
        if (editorContext.fileTree) {
          parts.push(`## Project File Tree\n\`\`\`\n${editorContext.fileTree}\n\`\`\``)
        }
      }

      // Phase 4: @mentions
      for (const mention of mentions) {
        if (mention.type === "file" && mention.path) {
          try {
            const content = await this.readFile(mention.path)
            parts.push(`## @file:${mention.path}\n\`\`\`\n${content}\n\`\`\``)
          } catch {
            parts.push(`## @file:${mention.path}\n(File not found or unreadable)`)
          }
        } else if (mention.type === "terminal" && editorContext?.terminalOutput) {
          parts.push(`## @terminal\n\`\`\`\n${editorContext.terminalOutput}\n\`\`\``)
        }
      }

      if (parts.length > 0) {
        contextBlock = `\n\n---\n### Workspace Context (auto-attached + @mentions)\n${parts.join("\n\n")}\n---\n`
      }
    }

    this.addEntry({ kind: "user-msg", text: cleanText || text, id: "", time: "" })

    const newConv: AgentMessage[] = [
      ...this.conversation,
      { role: "user", content: (cleanText || text) + contextBlock },
    ]
    this.conversation = newConv
    this.onConversationChange(newConv)

    await this.runAgentLoop(newConv, "plan")
  }

  cancel() {
    this.abortRef?.abort()
    this.phase = null
    this.onPhaseChange(null)
    this.streamText = ""
    this.onStreamTextChange("")
  }

  // ── Getters for UI ──────────────────────────────────────────────────────────
  getTimeline() { return this.timeline }
  getPhase() { return this.phase }
  getStreamText() { return this.streamText }
  getPendingPlan() { return this.pendingPlan }
  getProjectMemory() { return this.projectMemory }
  getScanStatus() { return this.scanStatus }
  getConversation() { return this.conversation }
  getIsRunning() { return this.isRunning }
  getWcStatus() { return this.wcStatus }
}