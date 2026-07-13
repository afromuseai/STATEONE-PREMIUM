import { useRef, useState } from "react"
import { EditorTabs }        from "./EditorTabs"
import { CodeEditor }        from "./CodeEditor"
import { PreviewWorkspace }  from "./PreviewWorkspace"
import { TerminalPanel }     from "./TerminalPanel"
import { ResizableHandle }   from "./ResizableHandle"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { OpenTab, WorkspaceMode }   from "./StudioShell"
import type { TerminalLine, RuntimeStatus } from "@/components/website-v2/runtime/runtime-types"

interface EditorWorkspaceProps {
  project:        V2Project
  openTabs:       OpenTab[]
  activeTabId:    string
  activeFile:     V2ProjectFile | null
  workspaceMode:  WorkspaceMode
  wcUrl?:         string | null
  /** Full WC lifecycle status — passed to TerminalPanel for RuntimeAgentObserver */
  wcStatus?:      RuntimeStatus
  /** Streamed WC terminal output — passed through to TerminalPanel */
  terminalLines?: TerminalLine[]
  /** Whether the WC boot sequence is in progress */
  wcBooting?:     boolean
  /**
   * Write a file to the WC filesystem.
   * EditorWorkspace calls this with (activeFile.path, newContent) on Monaco onChange.
   */
  onFileWrite?:   (path: string, content: string) => Promise<void>
  /** P2 — Inline AI command from selected text inside Monaco */
  onInlineCommand?: (prompt: string) => void
  onTabClick:     (id: string) => void
  onTabClose:     (id: string) => void
  onModeChange:   (mode: WorkspaceMode) => void
}

export function EditorWorkspace({
  project,
  openTabs,
  activeTabId,
  activeFile,
  workspaceMode,
  wcUrl,
  wcStatus,
  terminalLines,
  wcBooting,
  onFileWrite,
  onInlineCommand,
  onTabClick,
  onTabClose,
}: EditorWorkspaceProps) {
  // Percentage width of the left (code) pane in split mode — default 50%
  const [splitPct,   setSplitPct]   = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)

  // Wrap onFileWrite so CodeEditor only needs to supply the content
  const makeFileWriter = (path: string | undefined) => {
    if (!onFileWrite || !path) return undefined
    return (content: string) => onFileWrite(path, content)
  }

  const fileWriter = makeFileWriter(activeFile?.path)

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#1A1A1A]">

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
            <CodeEditor file={activeFile} onFileWrite={fileWriter} onInlineCommand={onInlineCommand} />
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
              <CodeEditor file={activeFile} onFileWrite={fileWriter} onInlineCommand={onInlineCommand} />
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
            <TerminalPanel
              lines={terminalLines}
              isBooting={wcBooting}
              wcStatus={wcStatus}
              wcUrl={wcUrl}
            />
          </div>
        )}
      </div>
    </div>
  )
}
