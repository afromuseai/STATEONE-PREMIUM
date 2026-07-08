import { useState, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TopCommandBar }       from "./TopCommandBar"
import { ActivityBar }         from "./ActivityBar"
import { AgentPanel }          from "./AgentPanel"
import { FileExplorerDrawer }  from "./FileExplorerDrawer"
import { EditorWorkspace }     from "./EditorWorkspace"
import { TerminalDrawer }      from "./TerminalDrawer"
import { CommandPalette }      from "./CommandPalette"   // P1
import { DiffReviewPanel, type FileDiff } from "./DiffReviewPanel"  // P3
import { CodeReviewPanel }     from "./CodeReviewPanel"  // P4
import { DeploymentPipeline }  from "./DeploymentPipeline" // P5
import { CollaborationPanel }  from "./CollaborationPanel" // P6
import { useWebContainer }     from "@/components/website-v2/runtime/useWebContainer"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { Terminal, GitBranch, Circle, FileCode, Code2, Cpu } from "lucide-react"

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

export function StudioShell({ project, onRefresh }: StudioShellProps) {
  // ── Tab state ────────────────────────────────────────────────────────────────
  const [openTabs,    setOpenTabs]    = useState<OpenTab[]>([
    { id: "preview",  label: "Preview",  pinned: true },
  ])
  const [activeTabId, setActiveTabId] = useState<string>("preview")

  // ── Workspace mode ───────────────────────────────────────────────────────────
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("preview")

  // ── Left side panel ──────────────────────────────────────────────────────────
  const [sideView, setSideView] = useState<SideView>("marcus")

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

  const handleDiffAccept = useCallback((id: string) => {
    setPendingDiffs(prev => prev.filter(d => d.id !== id))
  }, [])

  const handleDiffReject = useCallback(async (id: string) => {
    const diff = pendingDiffs.find(d => d.id === id)
    if (diff) {
      try { await wcWriteFile(diff.path, diff.oldContent) } catch { /* ignore */ }
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeFile =
    activeTabId === "preview" || activeTabId === "terminal"
      ? null
      : (project.files.find((f) => f.path === activeTabId) ?? null)

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
                <div className={sideView === "marcus" ? "contents" : "hidden"}>
                  <AgentPanel
                    project={project}
                    onEditComplete={onRefresh}
                    onFileOpen={openFile}
                  />
                </div>
                {sideView === "explorer" && (
                  <FileExplorerDrawer
                    open={true}
                    files={project.files}
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
            <TerminalDrawer onClose={() => setTerminalDrawerOpen(false)} />
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
