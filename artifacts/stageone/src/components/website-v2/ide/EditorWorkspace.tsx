import { useRef, useState } from "react"
import { EditorTabs }        from "./EditorTabs"
import { CodeEditor }        from "./CodeEditor"
import { PreviewWorkspace }  from "./PreviewWorkspace"
import { TerminalPanel }     from "./TerminalPanel"
import { ResizableHandle }   from "./ResizableHandle"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { OpenTab, WorkspaceMode }   from "./StudioShell"

interface EditorWorkspaceProps {
  project:       V2Project
  openTabs:      OpenTab[]
  activeTabId:   string
  activeFile:    V2ProjectFile | null
  workspaceMode: WorkspaceMode
  wcUrl?:        string | null
  onTabClick:    (id: string) => void
  onTabClose:    (id: string) => void
  onModeChange:  (mode: WorkspaceMode) => void
}

export function EditorWorkspace({
  project,
  openTabs,
  activeTabId,
  activeFile,
  workspaceMode,
  wcUrl,
  onTabClick,
  onTabClose,
}: EditorWorkspaceProps) {
  // Percentage width of the left (code) pane in split mode — default 50%
  const [splitPct,   setSplitPct]   = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0e0e0e]">

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <EditorTabs
        tabs={openTabs}
        activeTabId={activeTabId}
        workspaceMode={workspaceMode}
        onTabClick={onTabClick}
        onTabClose={onTabClose}
      />

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 overflow-hidden"
      >
        {/* ── CODE mode: Monaco full width ──────────────────────────────── */}
        {workspaceMode === "code" && (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <CodeEditor file={activeFile} />
          </div>
        )}

        {/* ── PREVIEW mode: preview full width ──────────────────────────── */}
        {workspaceMode === "preview" && (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <PreviewWorkspace
              preview={project.preview}
              projectName={project.projectName}
              wcUrl={wcUrl}
            />
          </div>
        )}

        {/* ── SPLIT mode: code left | preview right with drag handle ────── */}
        {workspaceMode === "split" && (
          <>
            {/* Left: Monaco */}
            <div
              className="flex flex-col overflow-hidden"
              style={{ width: `${splitPct}%`, flexShrink: 0 }}
            >
              <CodeEditor file={activeFile} />
            </div>

            {/* Drag handle */}
            <ResizableHandle
              onResize={setSplitPct}
              containerRef={containerRef}
            />

            {/* Right: Preview */}
            <div className="flex min-w-0 flex-1 overflow-hidden">
              <PreviewWorkspace
                preview={project.preview}
                projectName={project.projectName}
                wcUrl={wcUrl}
              />
            </div>
          </>
        )}

        {/* ── TERMINAL mode: full-pane terminal ─────────────────────────── */}
        {workspaceMode === "terminal" && (
          <div className="flex min-w-0 flex-1 overflow-hidden">
            <TerminalPanel />
          </div>
        )}
      </div>
    </div>
  )
}
