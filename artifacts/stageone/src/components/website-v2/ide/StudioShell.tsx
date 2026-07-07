import { useState, useCallback } from "react"
import { motion } from "framer-motion"
import { TopCommandBar } from "./TopCommandBar"
import { AgentPanel } from "./AgentPanel"
import { EditorWorkspace } from "./EditorWorkspace"
import { FileExplorerDrawer } from "./FileExplorerDrawer"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"

export type WorkspaceMode = "preview" | "code" | "split" | "terminal"

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
  // Default tab: preview
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([{ id: "preview", label: "Preview" }])
  const [activeTabId, setActiveTabId] = useState<string>("preview")
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("preview")
  const [fileExplorerOpen, setFileExplorerOpen] = useState(true)

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
    if (tabId === "preview") return // preview tab is permanent
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId)
      const next = prev.filter((t) => t.id !== tabId)
      // If closing the active tab, go to the adjacent tab
      if (activeTabId === tabId && next.length > 0) {
        const newActive = next[Math.max(0, idx - 1)]
        setActiveTabId(newActive.id)
        if (newActive.id === "preview") setWorkspaceMode("preview")
        else setWorkspaceMode("code")
      }
      return next
    })
  }, [activeTabId])

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    if (tabId === "preview") setWorkspaceMode("preview")
    else setWorkspaceMode("code")
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col overflow-hidden bg-[#080808]"
    >
      <TopCommandBar
        project={project}
        workspaceMode={workspaceMode}
        onModeChange={setWorkspaceMode}
        fileExplorerOpen={fileExplorerOpen}
        onToggleFileExplorer={() => setFileExplorerOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Left: AI Agent Panel */}
        <AgentPanel
          project={project}
          onEditComplete={onRefresh}
          onFileChange={openFile}
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
    </motion.div>
  )
}
