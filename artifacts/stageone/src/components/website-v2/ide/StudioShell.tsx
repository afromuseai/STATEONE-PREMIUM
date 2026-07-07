import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TopCommandBar } from "./TopCommandBar"
import { AgentPanel } from "./AgentPanel"
import { EditorWorkspace } from "./EditorWorkspace"
import { FileExplorerDrawer } from "./FileExplorerDrawer"
import { TerminalDrawer } from "./TerminalDrawer"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"

export type WorkspaceMode = "preview" | "code" | "split"

export interface OpenTab {
  id: string        // file path or 'preview'
  label: string
  // NOTE: no file stored here — always derive content from project.files at render time
}

interface StudioShellProps {
  project: V2Project
  onRefresh: () => void
}

export function StudioShell({ project, onRefresh }: StudioShellProps) {
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([{ id: "preview", label: "Preview" }])
  const [activeTabId, setActiveTabId] = useState<string>("preview")
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("preview")
  const [fileExplorerOpen, setFileExplorerOpen] = useState(false)
  const [terminalOpen, setTerminalOpen] = useState(false)

  // Always derive file content from the live project.files so edits are never stale
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
      const idx = prev.findIndex((t) => t.id === tabId)
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

      {/* Main workspace row */}
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

        {/* Bottom: Terminal Drawer */}
        <AnimatePresence>
          {terminalOpen && (
            <TerminalDrawer onClose={() => setTerminalOpen(false)} />
          )}
        </AnimatePresence>

        {/* Collapsed terminal toggle bar */}
        {!terminalOpen && (
          <div
            onClick={() => setTerminalOpen(true)}
            className="flex h-6 flex-shrink-0 cursor-pointer items-center gap-2 border-t border-white/[0.06] bg-[#0a0a0a] px-4 text-[10px] text-white/25 transition-colors hover:bg-white/[0.02] hover:text-white/45"
          >
            <span className="font-mono">$</span>
            <span>Terminal</span>
            <span className="ml-auto text-white/15">click to open</span>
          </div>
        )}
      </div>
    </motion.div>
  )
}
