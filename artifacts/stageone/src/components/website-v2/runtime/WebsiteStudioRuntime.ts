// ─── WebsiteStudioRuntime — Pure Execution Engine ─────────────────────────────
// Handles: tool execution, streaming, project memory
// Emits events only — owns NO conversation state, NO timeline, NO streaming text buffers.

import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { wsNowTime, wsBuildFileTree } from "./WebsiteStudioRuntimeHelpers"
import { api } from "@/lib/api"
import type { V2EditSseEvent, ConversationEvent } from "@/lib/api"
import { wsRuntimeEmitter } from "./WebsiteStudioRuntimeEmitter"
import type { WSRuntimeEvent } from "./WebsiteStudioRuntimeEvents"
import {
  projectScanStarted,
  projectScanCompleted,
  projectAnalysisReady,
  projectMemoryUpdated,
  fileWritten,
  thinkingDelta,
  textDelta,
  streamDone,
  streamError,
  phaseChanged,
  assistantMessage,
  sessionCompleted,
  timelineUpdate,
  confidenceUpdate,
  previewUpdate,
  visualUpdate,
  recoveryUpdate,
  decisionUpdate,
  auditUpdate, productUpdate, advisorUpdate, roadmapUpdate,
} from "./WebsiteStudioRuntimeEvents"
import type { ActivityKind } from "./WebsiteStudioRuntimeEvents"
import { activityEngine, type Activity } from "./ActivityEngine"

// ─── Types ────────────────────────────────────────────────────────────────────
export interface WSProjectMemory {
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

  // Phase 13.1: WorkspaceContext foundation
  /** Detected package manager: pnpm, npm, yarn, bun */
  packageManager?: string
  /** Known entry points: app/layout.tsx, app/page.tsx, ... */
  entryPoints?: string[]
  /** Path aliases from tsconfig: { "@": "./src/*" } */
  pathAliases?: Record<string, string>
  /** Enriched dependency list with version and dev flag */
  enrichedDependencies?: Array<{ name: string; version: string; isDev: boolean }>

  [key: string]: unknown
}

// Phase 5: Custom tool registry
export interface WSCustomTool {
  name: string
  description: string
  params: Record<string, { type: string; description: string; required?: boolean }>
  handler: (params: Record<string, unknown>) => Promise<{ result: string; ok: boolean }>
}

export interface WSAgentMessage {
  role:    "user" | "assistant"
  content: string
}

export interface WSToolCall {
  name:   string
  params: Record<string, unknown>
}

export interface WSToolResult {
  name:   string
  params: Record<string, unknown>
  result: string
  ok:     boolean
}

export type WSFileChangeOp = "update" | "create" | "delete"
export interface WSFileChange {
  path:      string
  operation: WSFileChangeOp
}

// ─── WebsiteStudioRuntime class ───────────────────────────────────────────────
export class WebsiteStudioRuntime {
  private project: V2Project
  private onEditComplete: () => void
  private onFileOpen: (file: V2ProjectFile) => void
  private externalInput?: string | null
  private onExternalInputConsumed?: () => void

  // Project tools — writeFile persists directly (applied immediately, no
  // separate confirmation/review step, matching how Replit's own agent works)
  private readFile: (path: string) => Promise<string>
  private writeFile: (path: string, content: string) => Promise<void>
  private listDir: (path: string) => Promise<string[]>
  private runCommand: (cmd: string, args: string[]) => Promise<{ output: string; exitCode: number }>
  private wcStatus: string

  // State
  private projectMemory: WSProjectMemory | null = null
  private scanStatus: "idle" | "scanning" | "done" | "error" = "idle"
  private phase: string | null = null
  private abortRef: AbortController | null = null
  private isRunning = false

  // Phase 5: Checkpoints & Custom tools
  private checkpoints: Map<string, { id: string; label: string; files: Map<string, string>; timestamp: string }> = new Map()
  private customTools: Map<string, { description: string; script: string }> = new Map()

  // Phase 6: Background tasks & Git
  private backgroundTasks: Map<string, { id: string; cmd: string; args: string[]; webhook?: string; startTime: number; output: string; exitCode: number; status: string }> = new Map()

  constructor(params: {
    project: V2Project
    onEditComplete: () => void
    onFileOpen: (file: V2ProjectFile) => void
    externalInput?: string | null
    onExternalInputConsumed?: () => void
    // Project tools — writeFile persists directly and immediately
    readFile: (path: string) => Promise<string>
    writeFile: (path: string, content: string) => Promise<void>
    listDir: (path: string) => Promise<string[]>
    runCommand: (cmd: string, args: string[]) => Promise<{ output: string; exitCode: number }>
    wcStatus: string
  }) {
    this.project = params.project
    this.onEditComplete = params.onEditComplete
    this.onFileOpen = params.onFileOpen
    this.externalInput = params.externalInput
    this.onExternalInputConsumed = params.onExternalInputConsumed
    this.readFile = params.readFile
    this.writeFile = params.writeFile
    this.listDir = params.listDir
    this.runCommand = params.runCommand
    this.wcStatus = params.wcStatus
  }

  // ── Event emission ──────────────────────────────────────────────────────────
  private emit(event: WSRuntimeEvent): void {
    wsRuntimeEmitter.emit(event)
  }

  // ── Activity Engine helpers ─────────────────────────────────────────────────
  /** Start a new activity. Returns the activity ID. */
  private startActivity(
    type: ActivityKind,
    title: string,
    description?: string,
    affectedFiles?: string[],
  ): string {
    return activityEngine.start(type, title, description, affectedFiles)
  }

  /** Complete the most recent running activity. */
  private finishActivity(affectedFiles?: string[]): void {
    const running = activityEngine.getRunning()
    if (running.length > 0) {
      // Complete the most recent one
      activityEngine.complete(running[running.length - 1].id, affectedFiles)
    }
  }

  /** Fail the most recent running activity with an error. */
  private failActivity(error: string): void {
    const running = activityEngine.getRunning()
    if (running.length > 0) {
      activityEngine.fail(running[running.length - 1].id, error)
    }
  }

  /** Update the most recent running activity with progress/description. */
  private updateActivity(updates: { description?: string; progress?: number; progressDetail?: string; affectedFiles?: string[] }): void {
    const running = activityEngine.getRunning()
    if (running.length > 0) {
      activityEngine.update(running[running.length - 1].id, updates)
    }
  }

  // ── O1: Auto-scan project when WC becomes ready ─────────────────────────────
  async scanProject() {
    if (this.wcStatus !== "ready" || this.scanStatus !== "idle") return
    this.scanStatus = "scanning"
    this.emit(projectScanStarted())

    try {
      const mem: WSProjectMemory = { previousChanges: [], userPreferences: [] }

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

        // ── Phase 13.1: Enriched dependencies with version + dev flag ─────
        const enriched: Array<{ name: string; version: string; isDev: boolean }> = []
        if (pkg.dependencies) {
          for (const [name, version] of Object.entries(pkg.dependencies)) {
            enriched.push({ name, version: version.replace(/^[\^~]/, ""), isDev: false })
          }
        }
        if (pkg.devDependencies) {
          for (const [name, version] of Object.entries(pkg.devDependencies)) {
            enriched.push({ name, version: version.replace(/^[\^~]/, ""), isDev: true })
          }
        }
        mem.enrichedDependencies = enriched
      } catch { /* non-critical */ }

      // ── Phase 13.1: Detect package manager from lockfile ─────────────────
      try {
        await this.readFile("/pnpm-lock.yaml")
        mem.packageManager = "pnpm"
      } catch {
        try {
          await this.readFile("/yarn.lock")
          mem.packageManager = "yarn"
        } catch {
          try {
            await this.readFile("/package-lock.json")
            mem.packageManager = "npm"
          } catch {
            try {
              await this.readFile("/bun.lock")
              mem.packageManager = "bun"
            } catch { /* no lockfile detected */ }
          }
        }
      }

      // ── Phase 13.1: Detect entry points ─────────────────────────────────
      const entryPoints: string[] = []
      // Next.js App Router
      for (const candidate of ["/src/app/layout.tsx", "/src/app/page.tsx", "/app/layout.tsx", "/app/page.tsx"]) {
        try { await this.readFile(candidate); entryPoints.push(candidate.replace(/^\//, "")) } catch { /* not found */ }
      }
      // Next.js Pages Router
      for (const candidate of ["/src/pages/_app.tsx", "/pages/_app.tsx"]) {
        try { await this.readFile(candidate); entryPoints.push(candidate.replace(/^\//, "")) } catch { /* not found */ }
      }
      // Vite / generic
      for (const candidate of ["/src/main.tsx", "/src/main.ts", "/src/index.tsx", "/src/index.ts"]) {
        try { await this.readFile(candidate); entryPoints.push(candidate.replace(/^\//, "")) } catch { /* not found */ }
      }
      if (entryPoints.length > 0) mem.entryPoints = [...new Set(entryPoints)]

      // ── Phase 13.1: Detect path aliases from tsconfig ───────────────────
      try {
        const tsconfigRaw = await this.readFile("/tsconfig.json")
        const tsconfig = JSON.parse(tsconfigRaw) as {
          compilerOptions?: { paths?: Record<string, string[]>; baseUrl?: string }
        }
        const paths = tsconfig.compilerOptions?.paths
        if (paths) {
          const aliases: Record<string, string> = {}
          for (const [key, values] of Object.entries(paths)) {
            const alias = key.replace(/\/\*$/, "")
            const target = (values[0] ?? "").replace(/\/\*$/, "")
            if (alias && target) aliases[alias] = target
          }
          if (Object.keys(aliases).length > 0) mem.pathAliases = aliases
        }
      } catch { /* no tsconfig or unparseable */ }

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
        mem.fileTree = await wsBuildFileTree(this.listDir, "/src")
      } catch { /* non-critical */ }

      this.projectMemory = mem
      this.emit(projectMemoryUpdated(mem))
      this.scanStatus = "done"

      // Emit analysis facts — no narration
      const analysis = {
        framework: mem.framework ?? "Unknown",
        style: mem.style,
        routeCount: mem.routeCount,
        componentCount: mem.componentCount,
        dependencies: mem.dependencies?.length ?? 0,
      }
      this.emit(projectAnalysisReady(analysis))
      this.emit(projectScanCompleted("Project analysis complete"))

      // Restore persisted memory patterns
      this.restorePersistedMemory()

    } catch (err) {
      this.scanStatus = "error"
      this.emit(streamError("Project scan failed"))
      console.error("[WebsiteStudioRuntime:scan]", err)
    }
  }

  // ── Phase 4: ProjectMemory persistence (localStorage) ────────────────────────
  private static readonly STORAGE_KEY = "ws:projectMemory"

  private static loadPersistedMemory(): { previousChanges: string[]; userPreferences: string[]; acceptedPatterns: string[]; rejectedPatterns: string[] } | null {
    try {
      const raw = localStorage.getItem(WebsiteStudioRuntime.STORAGE_KEY)
      if (!raw) return null
      return JSON.parse(raw)
    } catch { return null }
  }

  private static savePersistedMemory(data: { previousChanges: string[]; userPreferences: string[]; acceptedPatterns: string[]; rejectedPatterns: string[] }) {
    try {
      localStorage.setItem(WebsiteStudioRuntime.STORAGE_KEY, JSON.stringify(data))
    } catch { /* ignore */ }
  }

  private static mergeMemory(current: WSProjectMemory, persisted: { previousChanges: string[]; userPreferences: string[]; acceptedPatterns: string[]; rejectedPatterns: string[] }): WSProjectMemory {
    return {
      ...current,
      previousChanges: [...new Set([...(persisted.previousChanges || []), ...(current.previousChanges || [])])].slice(-20),
      userPreferences: [...new Set([...(persisted.userPreferences || []), ...(current.userPreferences || [])])],
      acceptedPatterns: persisted.acceptedPatterns || [],
      rejectedPatterns: persisted.rejectedPatterns || [],
    }
  }

  private static recordPattern(accepted: boolean, pattern: string) {
    const persisted = WebsiteStudioRuntime.loadPersistedMemory() || { previousChanges: [], userPreferences: [], acceptedPatterns: [], rejectedPatterns: [] }
    if (accepted) {
      persisted.acceptedPatterns = [...new Set([...persisted.acceptedPatterns, pattern])].slice(-20)
    } else {
      persisted.rejectedPatterns = [...new Set([...persisted.rejectedPatterns, pattern])].slice(-20)
    }
    WebsiteStudioRuntime.savePersistedMemory(persisted)
  }

  // Call after user accepts/rejects a diff
  static recordDiffOutcome(accepted: boolean, filePath: string, changeType: string) {
    const pattern = `${changeType}:${filePath.split("/").pop()}`
    WebsiteStudioRuntime.recordPattern(accepted, pattern)
  }

  // Restore persisted memory into current projectMemory
  private restorePersistedMemory() {
    const persisted = WebsiteStudioRuntime.loadPersistedMemory()
    if (persisted && this.projectMemory) {
      this.projectMemory = WebsiteStudioRuntime.mergeMemory(this.projectMemory, persisted)
      this.emit(projectMemoryUpdated(this.projectMemory))
    }
  }

  // ── Phase 5: Checkpoint/Rollback ─────────────────────────────────────────────
  private async createCheckpoint(label: string): Promise<string> {
    const id = `cp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const timestamp = wsNowTime()
    
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
    
    return id
  }

  private async rollbackToCheckpoint(checkpointId: string): Promise<boolean> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return false

    for (const [path, content] of checkpoint.files) {
      await this.writeFile(path, content)
    }

    return true
  }

  // ── Submit handler ──────────────────────────────────────────────────────────
  // Routes to the correct pipeline based on intent:
  //   conversation / code-question → POST /api/copilot/agent (natural LLM response)
  //   edit-request / build-request → POST /api/website-v2/projects/:id/edit (autonomous edit)
  async submit(
    userInput: string,
    currentConversation: WSAgentMessage[],
    intent?: string,
    _editorContext?: unknown,
  ): Promise<WSAgentMessage[]> {
    const text = userInput.trim()
    console.log("[RUNTIME] WebsiteStudioRuntime.submit() called", { text, intent, isRunning: this.isRunning, projectId: this.project.id })
    if (!text || this.isRunning) return currentConversation

    this.isRunning = true
    if (this.abortRef) this.abortRef.abort()
    const ctrl = new AbortController()
    this.abortRef = ctrl

    const projectId = this.project.id

    // Start with user message appended
    const updatedConv: WSAgentMessage[] = [
      ...currentConversation,
      { role: "user", content: text },
    ]

    // Route by intent
    if (intent === "conversation" || intent === "code-question") {
      return this._submitConversation(text, updatedConv, ctrl)
    }

    // Edit / build request — use the autonomous edit pipeline
    return this._submitEdit(text, updatedConv, ctrl)
  }

  /** Handle conversation requests via POST /api/copilot/agent */
  private async _submitConversation(
    text: string,
    conversation: WSAgentMessage[],
    ctrl: AbortController,
  ): Promise<WSAgentMessage[]> {
    try {
      // Emit thinking activity
      this.startActivity("thinking", "Thinking…", "Processing your request…")

      // Build the request to the copilot agent endpoint
      const projectMemory = this.projectMemory ?? undefined
      const res = await fetch("/api/copilot/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectMemory,
          messages: conversation,
        }),
        signal: ctrl.signal,
      })

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? `HTTP ${res.status}`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let carry = ""
      let responseText = ""

      // Parse SSE stream
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
            const event = JSON.parse(data) as {
              type: string
              content?: string
              error?: string
              [key: string]: unknown
            }

            if (event.type === "text") {
              responseText += event.content ?? ""
              this.emit(textDelta(event.content ?? ""))
            } else if (event.type === "thinking") {
              this.emit(thinkingDelta(event.content ?? ""))
            } else if (event.type === "done") {
              // Finished — emit the final assistant message
              this.finishActivity()
              const finalText = responseText || (conversation[conversation.length - 1]?.content ?? "")
              this.emit(assistantMessage(finalText, "assistant"))
              this.emit(streamDone())

              return [
                ...conversation,
                { role: "assistant", content: finalText },
              ]
            } else if (event.type === "error") {
              throw new Error(event.error ?? "Conversation agent error")
            }
          } catch (e) {
            if (e instanceof Error && e.message !== "Conversation agent error") {
              console.warn("[RUNTIME] Failed to parse SSE event:", data.slice(0, 200))
            }
            throw e
          }
        }
      }

      // Stream ended without a "done" event
      this.finishActivity()
      if (!responseText) {
        this.emit(streamError("Stream ended without a response"))
        this.emit(streamDone())
        return conversation
      }
      this.emit(assistantMessage(responseText, "assistant"))
      this.emit(streamDone())

      return [
        ...conversation,
        { role: "assistant", content: responseText },
      ]
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.log("[RUNTIME] Conversation aborted by user")
      } else {
        const msg = err instanceof Error ? err.message : "Conversation failed"
        console.error("[RUNTIME] Conversation failed:", err)
        this.emit(streamError(msg))
      }
      this.failActivity("Failed to respond")
      return conversation
    } finally {
      this.phase = null
      this.isRunning = false
      this.emit(phaseChanged(""))
    }
  }

  /** Handle edit requests via POST /api/website-v2/projects/:id/edit */
  private async _submitEdit(
    text: string,
    conversation: WSAgentMessage[],
    ctrl: AbortController,
  ): Promise<WSAgentMessage[]> {
    const projectId = this.project.id
    if (!projectId) {
      console.error("[EDIT FLOW] Project ID is missing!")
      this.emit(streamError("Project ID is missing"))
      this.isRunning = false
      return conversation
    }

    // ── Phase 13.1: Extract workspace context from project memory ──────────
    const pm = this.projectMemory
    const workspaceScan = pm ? {
      framework: pm.framework,
      packageManager: pm.packageManager,
      style: pm.style,
      dependencies: pm.dependencies,
      enrichedDependencies: pm.enrichedDependencies,
      entryPoints: pm.entryPoints,
      pathAliases: pm.pathAliases,
      routeCount: pm.routeCount,
      componentCount: pm.componentCount,
      fileTree: pm.fileTree,
      previousChanges: pm.previousChanges,
      userPreferences: pm.userPreferences,
      acceptedPatterns: pm.acceptedPatterns,
      rejectedPatterns: pm.rejectedPatterns,
    } : undefined

    try {
      console.log("[EDIT FLOW] Calling api.websiteV2.editProject()", { projectId, text, hasWorkspaceScan: !!workspaceScan })
      await api.websiteV2.editProject(
        projectId,
        text,
        undefined,
        ctrl.signal,
        (event: V2EditSseEvent) => this.onEditSseEvent(event),
        workspaceScan,
      )

      console.log("[EDIT FLOW] api.websiteV2.editProject() completed successfully")
      this.emit(streamDone())
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        console.log("[EDIT FLOW] Request aborted by user")
        // User cancelled — do nothing
      } else {
        const msg = err instanceof Error ? err.message : "Edit request failed"
        console.error("[EDIT FLOW] api.websiteV2.editProject() failed:", err)
        this.emit(streamError(msg))
      }
    } finally {
      this.phase = null
      this.isRunning = false
      this.emit(phaseChanged(""))
    }

    return conversation
  }

  // ── Map backend SSE events to WSRuntimeEvents ──────────────────────────────
  private onEditSseEvent(event: V2EditSseEvent): void {
    switch (event.phase) {
      case "analyzing":
        this.emit(phaseChanged("analyzing"))
        // Finish any prior activity before starting new phase
        this.finishActivity()
        this.startActivity("reading", "Analyzing project structure…", "Reading project files…")
        break

      case "editing":
        this.emit(phaseChanged("editing"))
        // Finish "reading" before starting "planning"
        this.finishActivity()
        this.startActivity("planning", "Planning changes…", "Planning the necessary changes…")
        break

      case "agent":
        this.onAgentEvent(event.event)
        break

      case "changes":
        // Backend has already persisted the file changes.
        // Finish "planning" activity before writing changes
        this.finishActivity()
        // We emit file-written events so the UI can update file explorer.
        for (const change of event.data.changes) {
          this.emit(fileWritten(change.path, change.operation))
          // Fire-and-forget: each file write is a brief activity
          const fid = activityEngine.start("writing", `Writing ${change.path}`, `Writing ${change.path}`, [change.path])
          activityEngine.complete(fid, [change.path])
        }
        // Surface the summary as an activity update — never an assistant message
        if (event.data.summary) {
          this.updateActivity({ description: event.data.summary })
        }
        break

      case "saved":
        this.emit(sessionCompleted(this.project.id ?? "", event.fileCount))
        this.onEditComplete()
        break

      case "regenerating":
        this.emit(phaseChanged("regenerating"))
        this.finishActivity()
        this.startActivity("preview", "Regenerating preview…", "Building preview…")
        break

      case "preview-ready":
        // Preview refreshed — finish the "preview" activity
        this.finishActivity()
        break

      case "error":
        this.emit(streamError(event.message))
        this.failActivity(event.message)
        break

      // Phase 14.1A: Forward timeline updates to subscribers
      case "timeline":
        this.emit(timelineUpdate(event.data))
        break

      // Phase 14.2: Forward confidence intelligence to subscribers
      case "confidence":
        this.emit(confidenceUpdate(event.data))
        break

      // Phase 14.3: Forward preview intelligence to subscribers
      case "preview":
        this.emit(previewUpdate(event.data))
        break

      // Phase 14.4: Forward visual verification to subscribers
      case "visual":
        this.emit(visualUpdate(event.data))
        break
      case "recovery":
        this.emit(recoveryUpdate(event.data))
        break
      case "decision":
        this.emit(decisionUpdate(event.data))
        break
      case "audit":
        this.emit(auditUpdate(event.data))
        break
      case "product":
        this.emit(productUpdate(event.data))
        break
      case "advisor":
        this.emit(advisorUpdate(event.data))
        break
      case "roadmap":
        this.emit(roadmapUpdate(event.data))
        break
    }
  }

  // ── Map backend ConversationEvent to WSRuntimeEvents ────────────────────────
  private onAgentEvent(ev: ConversationEvent): void {
    switch (ev.type) {
      case "progress": {
        const status = (ev.metadata?.status as string | undefined) ?? "running"
        if (status === "running") {
          this.phase = ev.phase
          const phaseStr: string = String(ev.phase ?? "")
          this.emit(phaseChanged(phaseStr))
          // Map backend phases to activity kinds
          const activityKind = this.mapPhaseToActivity(phaseStr)
          if (activityKind) {
            const kind: ActivityKind = activityKind
            const phaseDesc: string = this.getPhaseDescription(phaseStr)
            this.startActivity(kind, phaseDesc, phaseDesc)
          }
        } else if (status === "completed" || status === "failed") {
          this.emit(phaseChanged(""))
          if (status === "failed") {
            this.failActivity(ev.message ?? "Phase failed")
          } else {
            this.finishActivity()
          }
        }
        break
      }
      case "file": {
        const path = (ev.metadata?.path as string | undefined) ?? ""
        const operation = (ev.metadata?.operation as "create" | "update" | "delete" | undefined) ?? "update"
        this.emit(fileWritten(path, operation))
        // Fire-and-forget file write activity
        const fid = activityEngine.start("writing", `${operation} ${path}`, `${operation} ${path}`, [path])
        activityEngine.complete(fid, [path])
        break
      }
      case "message":
      case "warning":
        // These are execution narration — do NOT emit as assistantMessage
        // They only update the activity stream
        this.updateActivity({ description: ev.message })
        break
      case "error":
        this.emit(streamError(ev.message))
        this.failActivity(ev.message)
        break
      case "complete":
        this.emit(streamDone())
        this.finishActivity()
        break
      // action/step: lightweight events — update activity only, never inject as thinking
      case "action":
      case "step":
        // Update current activity with the step description
        this.updateActivity({ description: ev.message })
        break
    }
  }

  // ── Phase to Activity Mapping ───────────────────────────────────────────────
  private mapPhaseToActivity(phase: string): ActivityKind | null {
    switch (phase) {
      case "UNDERSTAND":
      case "ANALYZE":
        return "reading"
      case "PLAN":
        return "planning"
      case "BUILD":
      case "EDIT":
        return "working"
      case "TEST":
        return "testing"
      case "REVIEW":
        return "testing"
      case "FIX":
        return "working"
      default:
        return null
    }
  }

  private getPhaseDescription(phase: string): string {
    switch (phase) {
      case "UNDERSTAND":
      case "ANALYZE":
        return "Reading project files…"
      case "PLAN":
        return "Planning changes…"
      case "BUILD":
      case "EDIT":
        return "Working on changes…"
      case "TEST":
        return "Running tests…"
      case "REVIEW":
        return "Reviewing changes…"
      case "FIX":
        return "Fixing issues…"
      default:
        return "Working…"
    }
  }

  cancel() {
    this.abortRef?.abort()
    this.phase = null
    this.isRunning = false
    this.emit(phaseChanged(""))
    this.failActivity("Cancelled by user")
  }

  // Getters for state
  getPhase() { return this.phase }
  getProjectMemory() { return this.projectMemory }
  getScanStatus() { return this.scanStatus }
  getIsRunning() { return this.isRunning }
}
