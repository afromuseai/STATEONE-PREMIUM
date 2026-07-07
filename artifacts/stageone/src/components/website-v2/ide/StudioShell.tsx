import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TopCommandBar } from "./TopCommandBar"
import { AgentPanel } from "./AgentPanel"
import { EditorWorkspace } from "./EditorWorkspace"
import { FileExplorerDrawer } from "./FileExplorerDrawer"
import { TerminalDrawer } from "./TerminalDrawer"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { Terminal, GitBranch, Circle, FileCode } from "lucide-react"

export type WorkspaceMode = "preview" | "code" | "split"

export interface OpenTab {
  id:    string  // file path or 'preview'
  label: string
}

interface StudioShellProps {
  project:   V2Project
  onRefresh: () => void
}

export function StudioShell({ project, onRefresh }: StudioShellProps) {
  const [openTabs,        setOpenTabs]        = useState<OpenTab[]>([{ id: "preview", label: "Preview" }])
  const [activeTabId,     setActiveTabId]     = useState<string>("preview")
  const [workspaceMode,   setWorkspaceMode]   = useState<WorkspaceMode>("preview")
  const [fileExplorerOpen,setFileExplorerOpen]= useState(false)
  const [terminalOpen,    setTerminalOpen]    = useState(false)

  const activeFile =
    activeTabId === "preview"
      ? null
      : (project.files.find((f) => f.path === activeTabId) ?? null)

  const openFile = useCallback((file: V2ProjectFile) => {
    setOpenTabs((prev) => {
      if (prev.find((t) => t.id === file.path)) return prev
      return [...prev, { id: file.path, label: file.path.split("/").pop() ?? file.path }]
    })
    setActiveTabId(file.path)
    setWorkspaceMode("code")
  }, [])

  const closeTab = useCallback((tabId: string) => {
    if (tabId === "preview") return
    setOpenTabs((prev) => {
      const idx  = prev.findIndex((t) => t.id === tabId)
      const next = prev.filter((t) => t.id !== tabId)
      if (activeTabId === tabId && next.length > 0) {
        const newActive = next[Math.max(0, idx - 1)]
        setActiveTabId(newActive.id)
        setWorkspaceMode(newActive.id === "preview" ? "preview" : "code")
      }
      return next
    })
  }, [activeTabId])

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    setWorkspaceMode(tabId === "preview" ? "preview" : "code")
  }, [])

  const isReady = project.status === "ready"

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="flex h-full flex-col overflow-hidden bg-[#0c0c0c]"
    >
      <TopCommandBar
        project={project}
        workspaceMode={workspaceMode}
        onModeChange={setWorkspaceMode}
        fileExplorerOpen={fileExplorerOpen}
        onToggleFileExplorer={() => setFileExplorerOpen((v) => !v)}
        terminalOpen={terminalOpen}
        onToggleTerminal={() => setTerminalOpen((v) => !v)}
      />

      {/* ── Main workspace row ──────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* Left: AI Agent Panel */}
          <AgentPanel
            project={project}
            onEditComplete={onRefresh}
            onFileOpen={openFile}
          />

          {/* Center: Editor Workspace */}
          <EditorWorkspace
            project={project}
            openTabs={openTabs}
            activeTabId={activeTabId}
            activeFile={activeFile}
            workspaceMode={workspaceMode}
            onTabClick={handleTabClick}
            onTabClose={closeTab}
            onModeChange={setWorkspaceMode}
          />

          {/* Right: File Explorer Drawer */}
          <FileExplorerDrawer
            open={fileExplorerOpen}
            files={project.files}
            activeFilePath={activeTabId === "preview" ? null : activeTabId}
            onSelectFile={openFile}
            onClose={() => setFileExplorerOpen(false)}
          />
        </div>

        {/* ── Terminal drawer (expanded) ─────────────────────────────────── */}
        <AnimatePresence>
          {terminalOpen && (
            <TerminalDrawer onClose={() => setTerminalOpen(false)} />
          )}
        </AnimatePresence>

        {/* ── IDE status bar (collapsed terminal trigger) ────────────────── */}
        {!terminalOpen && (
          <div className="flex h-[22px] flex-shrink-0 items-center border-t border-white/[0.05] bg-[#090909]">

            {/* Left section: terminal toggle */}
            <button
              onClick={() => setTerminalOpen(true)}
              className="group flex h-full items-center gap-1.5 border-r border-white/[0.05] px-3 text-white/22 transition-colors hover:bg-white/[0.03] hover:text-white/55"
            >
              <Terminal className="h-3 w-3" />
              <span className="font-mono text-[10px]">Terminal</span>
            </button>

            {/* Middle: git branch */}
            <div className="flex h-full items-center gap-1.5 border-r border-white/[0.05] px-3 text-white/18">
              <GitBranch className="h-3 w-3" />
              <span className="font-mono text-[10px]">main</span>
            </div>

            {/* File count */}
            <div className="flex h-full items-center gap-1.5 px-3 text-white/15">
              <FileCode className="h-3 w-3" />
              <span className="font-mono text-[10px]">{project.files.length} files</span>
            </div>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Right section: runtime status */}
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
