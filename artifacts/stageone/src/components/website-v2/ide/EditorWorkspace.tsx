import { EditorTabs } from "./EditorTabs"
import { CodeEditor } from "./CodeEditor"
import { PreviewWorkspace } from "./PreviewWorkspace"
import { TerminalPanel } from "./TerminalPanel"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { OpenTab, WorkspaceMode } from "./StudioShell"

interface EditorWorkspaceProps {
  project:      V2Project
  openTabs:     OpenTab[]
  activeTabId:  string
  activeFile:   V2ProjectFile | null
  workspaceMode: WorkspaceMode
  onTabClick:   (id: string) => void
  onTabClose:   (id: string) => void
  onModeChange: (mode: WorkspaceMode) => void
}

export function EditorWorkspace({
  project,
  openTabs,
  activeTabId,
  activeFile,
  workspaceMode,
  onTabClick,
  onTabClose,
}: EditorWorkspaceProps) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0e0e0e]">
      {/* Browser-style editor tabs */}
      <EditorTabs
        tabs={openTabs}
        activeTabId={activeTabId}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
      />

      {/* Workspace content area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {workspaceMode === "preview" && (
          <PreviewWorkspace
            preview={project.preview}
            projectName={project.projectName}
          />
        )}

        {workspaceMode === "code" && (
          <div className="flex-1 overflow-hidden">
            <CodeEditor file={activeFile} />
          </div>
        )}

        {workspaceMode === "split" && (
          <>
            {/* Code — left half */}
            <div className="flex-1 overflow-hidden border-r border-white/[0.07]">
              <CodeEditor file={activeFile} />
            </div>
            {/* Preview — right half */}
            <div className="flex-1 overflow-hidden">
              <PreviewWorkspace
                preview={project.preview}
                projectName={project.projectName}
              />
            </div>
          </>
        )}

        {workspaceMode === "terminal" && (
          <div className="flex-1 overflow-hidden">
            <TerminalPanel />
          </div>
        )}
      </div>
    </div>
  )
}
