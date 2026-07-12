import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TopCommandBar }       from "./TopCommandBar"
import { ActivityBar }         from "./ActivityBar"
import { AgentConversation }   from "./AgentConversation"
import { FileExplorerDrawer }  from "./FileExplorerDrawer"
import { EditorWorkspace }     from "./EditorWorkspace"
import { TerminalDrawer }      from "./TerminalDrawer"
import { CommandPalette }      from "./CommandPalette"   // P1
import { AgentRuntime } from "./AgentRuntime"  // P3
import type { FileDiff } from "./DiffReviewPanel"
import { CodeReviewPanel }     from "./CodeReviewPanel"  // P4
import { DeploymentPipeline }  from "./DeploymentPipeline" // P5
import { CollaborationPanel }  from "./CollaborationPanel" // P6
import { useWebContainer }     from "@/components/website-v2/runtime/useWebContainer"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { MarcusSessionState } from "@/lib/marcus-session/types"
import { Terminal, GitBranch, Circle, FileCode, Code2, Cpu, Check, X, Loader2, Brain, Zap, Search, FileText, Terminal as TerminalIcon } from "lucide-react"
import type { ConversationEntry } from "@/lib/marcus-session/types"
import { useRuntime } from "@/components/website-v2/runtime/react/useRuntime"

// ─── Public types ──────────────────────────────────────────────────────────────
/** The four first-class workspace modes. Terminal is a full-pane mode, not a drawer. */
export type WorkspaceMode = "code" | "preview" | "split" | "terminal"

/** Which left-side panel is visible (null = collapsed). */
export type SideView = "marcus" | "explorer" | "collaboration" | null

export interface OpenTab {
  id:    string   // file path, "preview", or "terminal"
  label: string
  pinned?: boolean
}

interface StudioShellProps {
  project:    V2Project
  onRefresh:  () => void
  /** Optional Marcus session — when provided (during generation), the side panel
   *  shows the live streaming activity instead of the editing chat. */
  session?:   MarcusSessionState | null
  /** True while the preview HTML is being (re)generated in the background. */
  previewGenerating?: boolean
}

// ─── Marcus Generation Stream View (during generation) ─────────────────────────
function GenerationStream({ session }: { session: MarcusSessionState }) {
  const entries = session.conversation ?? []

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950/50">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/[0.08]">
          <Zap className="h-3 w-3 text-amber-400" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white/90 truncate">Marcus is building…</p>
          <p className="text-[10px] text-white/30 truncate">
            {session.currentPhase ? `${session.phaseMessage || session.currentPhase}` : "Thinking…"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {session.activeFilePath && (
            <span className="flex items-center gap-1 text-[10px] text-amber-400/80 px-2 py-0.5 rounded bg-amber-400/[0.06]">
              <FileText className="h-2.5 w-2.5" />
              {session.activeFilePath.split("/").pop()}
            </span>
          )}
          <div className="flex h-5 w-5 items-center justify-center">
            <Loader2 className="h-4 w-4 text-amber-400 animate-spin" />
          </div>
        </div>
      </div>

      {/* Conversation stream */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {entries.length === 0 ? (
          <div className="flex h-full items-center justify-center text-white/20">
            <p className="text-xs">Marcus is starting up…</p>
          </div>
        ) : (
          <>
            {entries.map((entry, i) => (
              <StreamEntry key={`${entry.id}-${i}`} entry={entry} />
            ))}
            {/* Live thinking stream */}
            {session.streamingText && (
              <StreamEntry
                entry={{
                  kind: "thinking",
                  text: session.streamingText!,
                  id: "live-thinking",
                  ts: Date.now(),
                  phase: session.currentPhase ?? undefined
                }}
                isLive
              />
            )}
          </>
        )}
      </div>

      {/* Status bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-white/[0.06] px-3 py-2 text-[10px] text-white/30">
        <span>Files: {session.fileCount || 0}</span>
        <span>Phase {session.fixIteration || 0}</span>
      </div>
    </div>
  )
}

// ─── Individual stream entry ───────────────────────────────────────────────────
function StreamEntry({ entry, isLive }: { entry: ConversationEntry; isLive?: boolean }) {
  const isThinking = entry.kind === "thinking"
  const isTool = entry.kind === "tool"
  const isAgent = entry.kind === "agent"
  const isPlan = entry.kind === "plan"
  const isScan = entry.kind === "scan"
  const isValidation = entry.kind === "validation"
  const isFileChange = entry.kind === "file-change"

  if (isThinking) {
    return (
      <div className="flex items-start gap-2 text-[11px] text-white/40 animate-in fade-in slide-in-from-left-1 duration-200">
        <Brain className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400/70" />
        <div className="flex-1 min-w-0">
          {entry.phase && (
            <p className="text-[9px] font-medium text-amber-400/60 mb-0.5 uppercase tracking-wider">
              {entry.phase}
            </p>
          )}
          <p className="font-mono leading-relaxed">{entry.text}</p>
        </div>
      </div>
    )
  }

  if (isTool) {
    const statusColor = entry.status === "running" ? "text-amber-400" :
                        entry.status === "done" ? "text-emerald-400" :
                        "text-red-400"
    const icon = entry.status === "running" ? <Loader2 className="h-3 w-3 animate-spin" /> :
                 entry.status === "done" ? <Check className="h-3 w-3" /> :
                 <X className="h-3 w-3" />
    return (
      <div className="flex items-start gap-2 text-[11px]">
        <TerminalIcon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${statusColor}`} />
        <div className="flex-1 min-w-0">
          <p className="flex items-center gap-1.5 font-mono">
            <span className={statusColor}>{entry.tool}</span>
            {entry.path && <span className="text-white/30">{entry.path}</span>}
            {entry.detail && <span className="text-white/20">— {entry.detail}</span>}
          </p>
        </div>
        <div className={statusColor}>{icon}</div>
      </div>
    )
  }

  if (isAgent) {
    return (
      <div className="flex items-start gap-2 text-[11px]">
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/[0.1] border border-emerald-400/20">
          <Cpu className="h-3 w-3 text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-mono text-white/70 leading-relaxed">{entry.text}</p>
        </div>
      </div>
    )
  }

  if (isPlan) {
    return (
      <div className="flex items-start gap-2 text-[11px] border-l border-amber-400/30 pl-3">
        <Search className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400/70" />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-medium text-amber-400/60 mb-0.5 uppercase tracking-wider">Plan</p>
          <p className="font-mono text-white/50 leading-relaxed">{entry.text}</p>
        </div>
      </div>
    )
  }

  if (isScan) {
    return (
      <div className="flex items-start gap-2 text-[11px] border-l border-emerald-400/30 pl-3">
        <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400/70" />
        <div className="flex-1 min-w-0">
          <p className="text-[9px] font-medium text-emerald-400/60 mb-0.5 uppercase tracking-wider">
            {entry.status === "running" ? "Scanning…" : entry.status === "done" ? "Scan complete" : "Scan failed"}
          </p>
          {entry.summary && <p className="font-mono text-white/50">{entry.summary}</p>}
        </div>
      </div>
    )
  }

  if (isValidation) {
    const isOk = entry.success
    return (
      <div className={`flex items-start gap-2 text-[11px] border-l pl-3 ${isOk ? "border-emerald-400/30" : "border-red-400/30"}`}>
        {isOk ? <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-400" /> : <X className="h-3.5 w-3.5 shrink-0 mt-0.5 text-red-400" />}
        <div className="flex-1 min-w-0">
          <p className={`text-[9px] font-medium mb-0.5 uppercase tracking-wider ${isOk ? "text-emerald-400/60" : "text-red-400/60"}`}>
            {isOk ? "Validation passed" : "Validation failed"}
          </p>
          {!isOk && entry.errors && entry.errors.map((e, i) => (
            <p key={i} className="font-mono text-red-400/70 text-[10px]">• {e}</p>
          ))}
          {isOk && entry.fixed && <p className="font-mono text-emerald-400/70 text-[10px]">Auto-fixed</p>}
        </div>
      </div>
    )
  }

  if (isFileChange) {
    return (
      <div className="flex items-center gap-2 text-[11px] text-white/50">
        <FileCode className="h-3.5 w-3.5 shrink-0" />
        <span className="font-mono">{entry.path}</span>
        <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.05] capitalize">{entry.operation}</span>
      </div>
    )
  }

  return null
}

// ─── Runtime status label helpers ─────────────────────────────────────────────
const STATUS_LABELS: Record<string, string> = {
  idle:       "WC Idle",
  booting:    "Booting…",
  mounting:   "Mounting…",
  installing: "Installing…",
  starting:   "Starting…",
  ready:      "WC Ready",
  error:      "WC Error",
}

const STATUS_COLORS: Record<string, { text: string; dot: string }> = {
  idle:       { text: "text-white/30",       dot: "fill-white/30" },
  booting:    { text: "text-amber-400/60",   dot: "fill-amber-400 animate-pulse" },
  mounting:   { text: "text-amber-400/60",   dot: "fill-amber-400 animate-pulse" },
  installing: { text: "text-amber-400/60",   dot: "fill-amber-400 animate-pulse" },
  starting:   { text: "text-amber-400/60",   dot: "fill-amber-400 animate-pulse" },
  ready:      { text: "text-emerald-400/60", dot: "fill-emerald-400" },
  error:      { text: "text-red-400/60",     dot: "fill-red-400" },
}

export function StudioShell({ project, onRefresh, session, previewGenerating }: StudioShellProps) {
  // ── Tab state ────────────────────────────────────────────────────────────────
  const [openTabs,    setOpenTabs]    = useState<OpenTab[]>([
    { id: "preview",  label: "Preview",  pinned: true },
  ])
  const [activeTabId, setActiveTabId] = useState<string>("preview")

  // ── Workspace mode ───────────────────────────────────────────────────────────
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("preview")

  // ── Left side panel ──────────────────────────────────────────────────────────
  const [sideView, setSideView] = useState<SideView>("marcus")

  // Auto-open marcus panel when generation is in progress
  useEffect(() => {
    if (session?.status === "generating") {
      setSideView("marcus")
    }
  }, [session?.status])

  // ── Terminal drawer (⌃`) ─────────────────────────────────────────────────────
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false)

  // ── Phase P: new panel states ─────────────────────────────────────────────────
  const [paletteOpen,    setPaletteOpen]    = useState(false)   // P1
  const [codeReviewOpen, setCodeReviewOpen] = useState(false)   // P4
  const [deployOpen,     setDeployOpen]     = useState(false)   // P5
  const [pendingDiffs,   setPendingDiffs]   = useState<FileDiff[]>([])  // P3
  const [marcusInput,    setMarcusInput]    = useState<string | null>(null) // P2

  // ── WebContainer runtime ─────────────────────────────────────────────────────
  const {
    status:        wcStatus,
    wcUrl,
    terminalLines,
    nodeVersion,
    depCount,
    writeFile:     wcWriteFile,
    writeFileForReview: wcWriteFileForReview,
  } = useWebContainer()

  // ── P1: Ctrl+K global shortcut ───────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault()
        setPaletteOpen(v => !v)
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  // ── P3: Diff handling ─────────────────────────────────────────────────────────
  const handleFileDiff = useCallback((diff: FileDiff) => {
    setPendingDiffs(prev => [...prev, diff])
  }, [])

  const handleDiffAccept = useCallback(async (id: string) => {
    const diff = pendingDiffs.find(d => d.id === id)
    if (diff) {
      try { await wcWriteFile(diff.path, diff.newContent) } catch { /* ignore */ }
      // Record accepted pattern
      AgentRuntime.recordDiffOutcome(true, diff.path, diff.oldContent ? "update" : "create")
    }
    setPendingDiffs(prev => prev.filter(d => d.id !== id))
  }, [pendingDiffs, wcWriteFile])

  const handleDiffReject = useCallback(async (id: string) => {
    const diff = pendingDiffs.find(d => d.id === id)
    if (diff) {
      try { await wcWriteFile(diff.path, diff.oldContent) } catch { /* ignore */ }
      // Record rejected pattern
      AgentRuntime.recordDiffOutcome(false, diff.path, diff.oldContent ? "update" : "create")
    }
    setPendingDiffs(prev => prev.filter(d => d.id !== id))
  }, [pendingDiffs, wcWriteFile])

  const handleDiffModify = useCallback((diff: FileDiff) => {
    // Open the file in the editor so user can hand-edit
    const file = project.files.find(f => f.path === diff.path)
    if (file) openFile(file)
    setPendingDiffs(prev => prev.filter(d => d.id !== diff.id))
  }, [pendingDiffs, project.files]) // openFile added below

  // ── P2: Route inline AI commands to Marcus ────────────────────────────────────
  const handleInlineCommand = useCallback((prompt: string) => {
    setSideView("marcus")
    setMarcusInput(prompt)
  }, [])

  // ── P1: Ask Marcus via command palette ────────────────────────────────────────
  const handleAskMarcus = useCallback((prompt: string) => {
    setSideView("marcus")
    if (prompt) setMarcusInput(prompt)
  }, [])

  const wcBooting = wcStatus !== "idle" && wcStatus !== "ready" && wcStatus !== "error"

  // ── Context snapshot for Marcus (Phase 4) ────────────────────────────────
  const [editorContext, setEditorContext] = useState<{
    activeFilePath: string | null
    activeFileContent: string | null
    selection: string | null
    terminalOutput: string
    fileTree: string
  }>({
    activeFilePath: null,
    activeFileContent: null,
    selection: null,
    terminalOutput: "",
    fileTree: "",
  })

  // Update terminal output (last 50 lines)
  useEffect(() => {
    if (terminalLines.length > 0) {
      const output = terminalLines.slice(-50).map(l => `${l.time} ${l.text}`).join("\n")
      setEditorContext(prev => ({ ...prev, terminalOutput: output }))
    }
  }, [terminalLines])

  // ── Derived (stable references via useMemo) ─────────────────────────────────
  // Compare files by path+content so a new API response does not produce a new
  // reference unless the file actually changed.
  const filesKey = useMemo(
    () => project.files.map(f => `${f.path}:${f.content}`).join("||"),
    [project.files],
  )
  const filesRef = useRef(project.files)
  // Keep ref in sync with key only — avoids materialising a new array on every render
  useEffect(() => {
    filesRef.current = project.files
  }, [filesKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const stableFiles: V2ProjectFile[] = filesRef.current

  // Update file tree (condensed) — driven by stableFiles so we don't rebuild on
  // every API poll that returns structurally identical data.
  useEffect(() => {
    const buildTree = (files: V2ProjectFile[]): string => {
      const dirs = new Set<string>()
      files.forEach(f => {
        const parts = f.path.split("/")
        for (let i = 0; i < parts.length - 1; i++) {
          dirs.add(parts.slice(0, i + 1).join("/"))
        }
      })
      const allPaths = [...dirs, ...files.map(f => f.path)].sort()
      return allPaths.map(p => (dirs.has(p) ? `${p}/` : p)).join("\n")
    }
    setEditorContext(prev => ({ ...prev, fileTree: buildTree(stableFiles) }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesKey])

  const activeFile = useMemo(() => {
    if (activeTabId === "preview" || activeTabId === "terminal") return null
    return stableFiles.find((f) => f.path === activeTabId) ?? null
  }, [activeTabId, stableFiles])

  // Update editor context when active file/tab changes (stable reference check)
  useEffect(() => {
    if (activeFile) {
      setEditorContext(prev => ({
        ...prev,
        activeFilePath: activeFile.path,
        activeFileContent: activeFile.content,
      }))
    } else {
      setEditorContext(prev => ({
        ...prev,
        activeFilePath: null,
        activeFileContent: null,
      }))
    }
  }, [activeFile])

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openFile = useCallback((file: V2ProjectFile) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === file.path)) return prev
      const label = file.path.split("/").pop() ?? file.path
      return [...prev, { id: file.path, label }]
    })
    setActiveTabId(file.path)
    setWorkspaceMode((prev) => prev === "split" ? "split" : "code")
  }, [])

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs((prev) => {
      const tab  = prev.find((t) => t.id === tabId)
      if (tab?.pinned) return prev
      const idx  = prev.findIndex((t) => t.id === tabId)
      const next = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && next.length > 0) {
        const newActive = next[Math.max(0, idx - 1)]
        setActiveTabId(newActive.id)
        if (newActive.id === "preview") setWorkspaceMode("preview")
        else if (newActive.id === "terminal") setWorkspaceMode("terminal")
        else setWorkspaceMode("code")
      }
      return next
    })
  }, [activeTabId])

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    if (tabId === "preview")       setWorkspaceMode("preview")
    else if (tabId === "terminal") setWorkspaceMode("terminal")
    else setWorkspaceMode((prev) => prev === "split" ? "split" : "code")
  }, [])

  const handleModeChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode)
    if (mode === "terminal") {
      setOpenTabs((prev) => {
        if (prev.find((t) => t.id === "terminal")) return prev
        return [...prev, { id: "terminal", label: "Terminal", pinned: true }]
      })
      setActiveTabId("terminal")
    }
    if (mode === "preview") setActiveTabId("preview")
    if (mode === "code") {
      setOpenTabs((prev) => {
        const codeTab = [...prev].reverse().find((t) => t.id !== "preview" && t.id !== "terminal")
        if (codeTab) setActiveTabId(codeTab.id)
        return prev
      })
    }
  }, [])

  // ── Status bar display ───────────────────────────────────────────────────────
  const statusLabel  = STATUS_LABELS[wcStatus] ?? wcStatus
  const statusColors = STATUS_COLORS[wcStatus] ?? STATUS_COLORS.idle

  const runtime = useRuntime()

  const buildRuntimeTree = (files: V2ProjectFile[]): any => {
  const tree: any = {}

  files.forEach((file) => {
    const parts = file.path.split("/")
    let current = tree

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1

      if (isLast) {
        current[part] = {
          file: {
            contents: file.content,
          },
        }
      } else {
        if (!current[part]) {
          current[part] = {
            directory: {},
          }
        }

        current = current[part].directory!
      }
    })
  })

  return tree
}

const handleRun = async () => {
  try {
    console.log('StudioShell.handleRun invoked', project?.id)
    console.log('StudioShell.runtime', runtime)
    console.log('StudioShell.runtime.start', typeof runtime.start)
    try { console.log('StudioShell.runtime.start.source', runtime.start.toString?.()) } catch(e) { console.log('source-read-error', e) }
    const tree = buildRuntimeTree(stableFiles)

    await runtime.start(tree, project.id)

  } catch (error) {
    console.error("Runtime start failed:", error)
  }
}

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#080808]"
      style={{ flex: "1 1 0%", minWidth: 0 }}
    >
      {/* ── Top command bar ────────────────────────────────────────────────── */}
      <TopCommandBar
        project={project}
        workspaceMode={workspaceMode}
        onModeChange={handleModeChange}
        onRun={handleRun}
        terminalDrawerOpen={terminalDrawerOpen}
        onToggleTerminalDrawer={() => setTerminalDrawerOpen((v) => !v)}
        activeFile={activeFile}
        onCodeReview={() => setCodeReviewOpen(true)}
        onDeploy={() => setDeployOpen(true)}
        onOpenPalette={() => setPaletteOpen(true)}
      />

      {/* ── Main workspace row ────────────────────────────────────────────── */}
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 w-full flex-1 overflow-hidden">

          {/* Activity bar — far left 40px strip */}
          <ActivityBar activeSideView={sideView} onSetSideView={setSideView} />

          {/* Side panel — Marcus, Explorer, or Collaboration */}
          <AnimatePresence initial={false}>
            {sideView !== null && (
              <motion.div
                key="side-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: sideView === "marcus" ? 340
                       : sideView === "collaboration" ? 280
                       : 240,
                  opacity: 1,
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="flex flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06]"
              >
                {sideView === "marcus" && session?.status === "generating" ? (
                  <GenerationStream session={session} />
                ) : sideView === "marcus" ? (
                  <AgentConversation
                    project={project}
                    onEditComplete={onRefresh}
                    onFileOpen={openFile}
                    onFileDiff={handleFileDiff}
                    writeFileForReview={wcWriteFileForReview}
                    editorContext={editorContext}
                  />
                ) : null}
                {sideView === "explorer" && (
                  <FileExplorerDrawer
                    open={true}
                    files={stableFiles}
                    activeFilePath={activeTabId === "preview" || activeTabId === "terminal" ? null : activeTabId}
                    onSelectFile={openFile}
                    onClose={() => setSideView(null)}
                    embedded
                  />
                )}
                {sideView === "collaboration" && (
                  <CollaborationPanel project={project} />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Center: primary editor workspace */}
          <EditorWorkspace
            project={project}
            openTabs={openTabs}
            activeTabId={activeTabId}
            activeFile={activeFile}
            workspaceMode={workspaceMode}
            wcUrl={wcUrl}
            wcStatus={wcStatus}
            terminalLines={terminalLines}
            wcBooting={wcBooting}
            onFileWrite={wcWriteFile}
            onTabClick={handleTabClick}
            onTabClose={closeTab}
            onModeChange={handleModeChange}
          />
        </div>

        {/* ── Terminal overlay drawer (⌃`) — slides up from status bar ──── */}
        <AnimatePresence>
          {terminalDrawerOpen && (
            <TerminalDrawer onClose={() => setTerminalDrawerOpen(false)} terminalLines={terminalLines} />
          )}
        </AnimatePresence>

        {/* ── Status bar ────────────────────────────────────────────────── */}
        {!terminalDrawerOpen && (
          <div className="flex h-[22px] flex-shrink-0 items-center border-t border-white/[0.04] bg-[#070707]">

            {/* Terminal toggle */}
            <button
              onClick={() => setTerminalDrawerOpen(true)}
              title="Open terminal overlay (⌃`)"
              aria-label="Open terminal overlay"
              className="group flex h-full items-center gap-1.5 border-r border-white/[0.04] px-3 text-white/25 transition-colors hover:bg-white/[0.04] hover:text-white/60"
            >
              <Terminal className="h-3 w-3" />
              <span className="font-mono text-[10px]">Terminal</span>
            </button>

            {/* Git branch */}
            <div className="flex h-full items-center gap-1.5 border-r border-white/[0.04] px-3 text-white/22">
              <GitBranch className="h-3 w-3" />
              <span className="font-mono text-[10px]">main</span>
            </div>

            {/* Active file */}
            {activeFile && (
              <div className="flex h-full items-center gap-1.5 border-r border-white/[0.04] px-3 text-white/20">
                <Code2 className="h-3 w-3" />
                <span className="max-w-[200px] truncate font-mono text-[10px]">
                  {activeFile.path.split("/").pop()}
                </span>
              </div>
            )}

            {/* File count */}
            <div className="flex h-full items-center gap-1.5 border-r border-white/[0.04] px-3 text-white/16">
              <FileCode className="h-3 w-3" />
              <span className="font-mono text-[10px]">{project.files.length} files</span>
            </div>

            {/* Dep count (when installed) */}
            {depCount > 0 && (
              <div className="flex h-full items-center gap-1.5 border-r border-white/[0.04] px-3 text-white/16">
                <span className="font-mono text-[10px]">{depCount} deps</span>
              </div>
            )}

            <div className="flex-1" />

            {/* Node version (when known) */}
            {nodeVersion && wcStatus === "ready" && (
              <div className="flex h-full items-center gap-1.5 border-l border-white/[0.04] px-3 text-white/22">
                <span className="font-mono text-[10px]">Node {nodeVersion}</span>
              </div>
            )}

            {/* WC live URL chip */}
            {wcUrl && wcStatus === "ready" && (
              <div className="flex h-full items-center gap-1.5 border-l border-white/[0.04] px-3 text-emerald-400/65">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_#34d399]" />
                <span className="font-mono text-[10px]">live</span>
              </div>
            )}

            {/* Pending changes indicator */}
            {pendingDiffs.length > 0 && (
              <div className="flex h-full items-center gap-1.5 border-l border-white/[0.04] px-3 text-amber-400/80">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="font-mono text-[10px]">{pendingDiffs.length} pending</span>
                <button
                  onClick={() => pendingDiffs.forEach(d => handleDiffAccept(d.id))}
                  className="flex items-center gap-1 rounded-md bg-emerald-500/12 px-2 py-0.5 text-[9px] font-semibold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                  title="Accept all"
                >
                  <Check className="h-2.5 w-2.5" /> All
                </button>
                <button
                  onClick={() => pendingDiffs.forEach(d => handleDiffReject(d.id))}
                  className="flex items-center gap-1 rounded-md bg-red-500/10 px-2 py-0.5 text-[9px] font-semibold text-red-300 hover:bg-red-500/18 transition-colors"
                  title="Reject all"
                >
                  <X className="h-2.5 w-2.5" /> All
                </button>
              </div>
            )}

            {/* Runtime status */}
            <div className={`flex h-full items-center gap-1.5 border-l border-white/[0.04] px-3 transition-colors ${statusColors.text}`}>
              <Circle className={`h-1.5 w-1.5 ${statusColors.dot}`} />
              <Cpu className="h-2.5 w-2.5 opacity-40" />
              <span className="font-mono text-[10px]">{statusLabel}</span>
            </div>

            {/* Keyboard hint */}
            <div className="flex h-full items-center border-l border-white/[0.04] px-3 text-white/12">
              <span className="font-mono text-[10px]">⌃`</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
