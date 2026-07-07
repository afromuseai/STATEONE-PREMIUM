import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TopCommandBar }      from "./TopCommandBar"
import { ActivityBar }        from "./ActivityBar"
import { AgentPanel }         from "./AgentPanel"
import { FileExplorerDrawer } from "./FileExplorerDrawer"
import { EditorWorkspace }    from "./EditorWorkspace"
import { TerminalDrawer }     from "./TerminalDrawer"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { Terminal, GitBranch, Circle, FileCode, Code2 } from "lucide-react"

// ─── Public types ──────────────────────────────────────────────────────────────
/** The four first-class workspace modes. Terminal is a full-pane mode, not a drawer. */
export type WorkspaceMode = "code" | "preview" | "split" | "terminal"

/** Which left-side panel is visible (null = collapsed). */
export type SideView = "marcus" | "explorer" | null

export interface OpenTab {
  id:    string   // file path, "preview", or "terminal"
  label: string
  pinned?: boolean
}

interface StudioShellProps {
  project:    V2Project
  onRefresh:  () => void
  /** Optional live WebContainer URL — passed through to PreviewWorkspace */
  wcUrl?:     string | null
}

export function StudioShell({ project, onRefresh, wcUrl }: StudioShellProps) {
  // ── Tab state ────────────────────────────────────────────────────────────────
  const [openTabs,    setOpenTabs]    = useState<OpenTab[]>([
    { id: "preview",  label: "Preview",  pinned: true },
  ])
  const [activeTabId, setActiveTabId] = useState<string>("preview")

  // ── Workspace mode ───────────────────────────────────────────────────────────
  // Default: code — Monaco is the primary workspace
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("code")

  // ── Left side panel ──────────────────────────────────────────────────────────
  // "marcus" shows the AI agent; "explorer" shows the file tree; null = collapsed
  const [sideView, setSideView] = useState<SideView>("marcus")

  // ── Terminal drawer (⌃`) ─────────────────────────────────────────────────────
  // Separate from the "terminal" workspace mode: this is the slide-up overlay
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────────
  const activeFile =
    activeTabId === "preview" || activeTabId === "terminal"
      ? null
      : (project.files.find((f) => f.path === activeTabId) ?? null)

  const isReady = project.status === "ready"

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const openFile = useCallback((file: V2ProjectFile) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === file.path)) return prev
      const label = file.path.split("/").pop() ?? file.path
      return [...prev, { id: file.path, label }]
    })
    setActiveTabId(file.path)
    // Switch to code mode when a file is opened (unless already in split)
    setWorkspaceMode((prev) => prev === "split" ? "split" : "code")
  }, [])

  const closeTab = useCallback((tabId: string) => {
    setOpenTabs((prev) => {
      const tab  = prev.find((t) => t.id === tabId)
      if (tab?.pinned) return prev                       // can't close pinned tabs
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
    if (tabId === "preview")  setWorkspaceMode("preview")
    else if (tabId === "terminal") setWorkspaceMode("terminal")
    else setWorkspaceMode((prev) => prev === "split" ? "split" : "code")
  }, [])

  /** Called when the mode strip in TopCommandBar changes mode directly. */
  const handleModeChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode)
    // When switching to terminal mode, ensure terminal tab exists
    if (mode === "terminal") {
      setOpenTabs((prev) => {
        if (prev.find((t) => t.id === "terminal")) return prev
        return [...prev, { id: "terminal", label: "Terminal", pinned: true }]
      })
      setActiveTabId("terminal")
    }
    // When switching to preview mode, activate the preview tab
    if (mode === "preview") setActiveTabId("preview")
    // When switching to code mode, activate the most recent code file tab (if any)
    if (mode === "code") {
      setOpenTabs((prev) => {
        const codeTab = [...prev].reverse().find((t) => t.id !== "preview" && t.id !== "terminal")
        if (codeTab) setActiveTabId(codeTab.id)
        return prev
      })
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex h-full flex-col overflow-hidden bg-[#0c0c0c]"
    >
      {/* ── Top command bar ────────────────────────────────────────────────── */}
      <TopCommandBar
        project={project}
        workspaceMode={workspaceMode}
        onModeChange={handleModeChange}
        terminalDrawerOpen={terminalDrawerOpen}
        onToggleTerminalDrawer={() => setTerminalDrawerOpen((v) => !v)}
        activeFile={activeFile}
      />

      {/* ── Main workspace row ────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* Activity bar — far left 40px strip */}
          <ActivityBar activeSideView={sideView} onSetSideView={setSideView} />

          {/* Side panel — Marcus or Explorer.
              Stable key so the container never remounts when switching views;
              only the width animates and the inner content swaps in place. */}
          <AnimatePresence initial={false}>
            {sideView !== null && (
              <motion.div
                key="side-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: sideView === "marcus" ? 268 : 220, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="flex flex-shrink-0 flex-col overflow-hidden border-r border-white/[0.06]"
              >
                {/* AgentPanel stays mounted but hidden when explorer is active,
                    so its timeline / SSE state is preserved across view switches. */}
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
          <div className="flex h-[22px] flex-shrink-0 items-center border-t border-white/[0.05] bg-[#090909]">

            {/* Terminal toggle */}
            <button
              onClick={() => setTerminalDrawerOpen(true)}
              title="Open terminal overlay (⌃`)"
              aria-label="Open terminal overlay"
              className="group flex h-full items-center gap-1.5 border-r border-white/[0.05] px-3 text-white/22 transition-colors hover:bg-white/[0.03] hover:text-white/55"
            >
              <Terminal className="h-3 w-3" />
              <span className="font-mono text-[10px]">Terminal</span>
            </button>

            {/* Git branch */}
            <div className="flex h-full items-center gap-1.5 border-r border-white/[0.05] px-3 text-white/18">
              <GitBranch className="h-3 w-3" />
              <span className="font-mono text-[10px]">main</span>
            </div>

            {/* Active file */}
            {activeFile && (
              <div className="flex h-full items-center gap-1.5 border-r border-white/[0.05] px-3 text-white/15">
                <Code2 className="h-3 w-3" />
                <span className="max-w-[200px] truncate font-mono text-[10px]">
                  {activeFile.path.split("/").pop()}
                </span>
              </div>
            )}

            {/* File count */}
            <div className="flex h-full items-center gap-1.5 px-3 text-white/12">
              <FileCode className="h-3 w-3" />
              <span className="font-mono text-[10px]">{project.files.length} files</span>
            </div>

            <div className="flex-1" />

            {/* WebContainer URL indicator */}
            {wcUrl && (
              <div className="flex h-full items-center gap-1.5 border-l border-white/[0.05] px-3 text-emerald-400/55">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_4px_theme(colors.emerald.400)]" />
                <span className="font-mono text-[10px]">WC live</span>
              </div>
            )}

            {/* Runtime status */}
            <div className={`flex h-full items-center gap-1.5 border-l border-white/[0.05] px-3 transition-colors
              ${isReady ? "text-emerald-400/60" : "text-amber-400/60"}`}
            >
              <Circle className={`h-1.5 w-1.5 ${isReady ? "fill-emerald-400" : "fill-amber-400 animate-pulse"}`} />
              <span className="font-mono text-[10px]">
                {isReady ? "Ready" : project.status}
              </span>
            </div>

            {/* Keyboard hint */}
            <div className="flex h-full items-center border-l border-white/[0.05] px-3 text-white/10">
              <span className="font-mono text-[10px]">⌃`</span>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}
