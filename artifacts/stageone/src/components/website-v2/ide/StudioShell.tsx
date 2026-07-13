import { useState, useCallback, useEffect, useMemo, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { TopCommandBar }       from "./TopCommandBar"
import { ActivityBar }         from "./ActivityBar"
import { AgentConversation }   from "./AgentConversation"
// GenerationTimeline (permanent side panel) is no longer used — the generation
// activity now lives inline inside AgentConversation's chat. Kept unused per
// instructions, not deleted.
import { FileExplorerDrawer }  from "./FileExplorerDrawer"
import { EditorWorkspace }     from "./EditorWorkspace"
import { TerminalDrawer }      from "./TerminalDrawer"
import { CommandPalette }      from "./CommandPalette"   // P1
import { CodeReviewPanel }     from "./CodeReviewPanel"  // P4
import { DeploymentPipeline }  from "./DeploymentPipeline" // P5
import { CollaborationPanel }  from "./CollaborationPanel" // P6
import { StudioHeader }        from "./StudioHeader"
import { StudioSidebar }       from "./StudioSidebar"
import { StudioWorkspace }     from "./StudioWorkspace"
import { useWebContainer }     from "@/components/website-v2/runtime/useWebContainer"
import { api } from "@/lib/api"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { MarcusSessionState } from "@/lib/marcus-session/types"
import { Terminal, GitBranch, Circle, FileCode, Code2, Cpu } from "lucide-react"
import { useRuntime } from "@/components/website-v2/runtime/react/useRuntime"
// Bridges the existing Marcus generation stream onto the new generation event
// bus, so `GenerationActivity` (rendered inside AgentConversation) reflects
// real builds. The adapter itself has no Marcus imports — this is the one
// place that extracts a plain snapshot from `session` and feeds it in.
import { useWebsiteGenerationAdapter } from "@/lib/website-generation/generation-adapter"

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
  idle:       { text: "text-[#ECECEC]/30",       dot: "fill-white/30" },
  booting:    { text: "text-[#ECECEC]",   dot: "fill-[#ECECEC] animate-pulse" },
  mounting:   { text: "text-[#ECECEC]",   dot: "fill-[#ECECEC] animate-pulse" },
  installing: { text: "text-[#ECECEC]",   dot: "fill-[#ECECEC] animate-pulse" },
  starting:   { text: "text-[#ECECEC]",   dot: "fill-[#ECECEC] animate-pulse" },
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

  // Total width of the left rail (40px activity bar + current side panel), used
  // so the top bar's centered mode strip can be centered over the actual
  // preview/workspace area below it, not the full-width bar itself.
  const sidePanelWidth =
    sideView === "marcus"        ? 320
    : sideView === "collaboration" ? 280
    : sideView === "explorer"      ? 240
    : 0
  const leftRailWidth = 40 + sidePanelWidth

  // Feed the live Marcus session into the generation event bus so the new
  // inline `GenerationActivity` (inside AgentConversation) reflects the real
  // build instead of only reacting to the dev test helper. Safe to call with
  // session === null — the adapter treats that as an idle snapshot.
  useWebsiteGenerationAdapter({
    status:       session?.status ?? "idle",
    phase:        session?.currentPhase ?? null,
    phaseMessage: session?.phaseMessage ?? null,
    error:        session?.error ?? null,
    files:        session ? Object.keys(session.files) : undefined,
  })


  // ── Terminal drawer (⌃`) ─────────────────────────────────────────────────────
  const [terminalDrawerOpen, setTerminalDrawerOpen] = useState(false)

  // ── Phase P: new panel states ─────────────────────────────────────────────────
  const [paletteOpen,    setPaletteOpen]    = useState(false)   // P1
  const [codeReviewOpen, setCodeReviewOpen] = useState(false)   // P4
  const [deployOpen,     setDeployOpen]     = useState(false)   // P5
  const [marcusInput,    setMarcusInput]    = useState<string | null>(null) // P2

  // ── WebContainer runtime ─────────────────────────────────────────────────────
  const {
    status:        wcStatus,
    wcUrl,
    terminalLines,
    nodeVersion,
    depCount,
  } = useWebContainer()

  // ── Direct persistence — every file change (from Marcus or manual editing)
  // is written straight to the project, applied immediately with no separate
  // confirmation/accept step. Preview is regenerated once Marcus finishes.
  const persistFile = useCallback(async (path: string, content: string) => {
    const existing  = project.files.find(f => f.path === path)
    const operation = existing ? "update" as const : "create" as const
    await api.websiteV2.updateFiles(project.id, [{ path, operation, content }])
  }, [project.files, project.id])

  const handleEditComplete = useCallback(async () => {
    try { await api.websiteV2.regeneratePreview(project.id) } catch { /* preview regen is best-effort */ }
    onRefresh()
  }, [project.id, onRefresh])

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
        else setWorkspaceMode("code")
      }
      return next
    })
  }, [activeTabId])

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId)
    if (tabId === "preview") setWorkspaceMode("preview")
    else setWorkspaceMode((prev) => prev === "split" ? "split" : "code")
  }, [])

  // Terminal already has its own dedicated card above the editor (top command
  // bar / status bar) — switching to it is a pure workspace-mode change, it
  // never grows a tab in the editor tab strip.
  const handleModeChange = useCallback((mode: WorkspaceMode) => {
    setWorkspaceMode(mode)
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
      className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-[#1A1A1A]"
      style={{ flex: "1 1 0%", minWidth: 0 }}
    >
      {/* ── Top command bar ────────────────────────────────────────────────── */}
      <StudioHeader>
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
          leftRailWidth={leftRailWidth}
        />
      </StudioHeader>

      {/* ── Main workspace row ────────────────────────────────────────────── */}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        <StudioSidebar>
          {/* Activity bar — far left 40px strip */}
          <ActivityBar activeSideView={sideView} onSetSideView={setSideView} />

          {/* Side panel — Marcus, Explorer, or Collaboration */}
          <AnimatePresence initial={false}>
            {sideView !== null && (
              <motion.div
                key="side-panel"
                initial={{ width: 0, opacity: 0 }}
                animate={{
                  width: sideView === "marcus" ? 320
                       : sideView === "collaboration" ? 280
                       : 240,
                  opacity: 1,
                }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 420, damping: 40 }}
                className="flex flex-shrink-0 flex-col overflow-hidden border-r border-[rgba(255,255,255,0.08)] bg-[#202020]"
              >
                {sideView === "marcus" && (
                  <AgentConversation
                    project={project}
                    onEditComplete={handleEditComplete}
                    onFileOpen={openFile}
                    persistFile={persistFile}
                    editorContext={editorContext}
                    generationSession={session}
                  />
                )}
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
        </StudioSidebar>

        <StudioWorkspace>
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
            onFileWrite={persistFile}
            onTabClick={handleTabClick}
            onTabClose={closeTab}
            onModeChange={handleModeChange}
          />

          {/* ── Terminal overlay drawer (⌃`) — slides up from status bar ──── */}
          <AnimatePresence>
            {terminalDrawerOpen && (
              <TerminalDrawer onClose={() => setTerminalDrawerOpen(false)} terminalLines={terminalLines} />
            )}
          </AnimatePresence>

          {/* ── Status bar ────────────────────────────────────────────────── */}
          {!terminalDrawerOpen && (
            <div className="flex h-[22px] flex-shrink-0 items-center border-t border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]">

              {/* Terminal toggle */}
              <button
                onClick={() => setTerminalDrawerOpen(true)}
                title="Open terminal overlay (⌃`)"
                aria-label="Open terminal overlay"
                className="group flex h-full items-center gap-1.5 border-r border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/25 transition-colors hover:bg-[#252525] hover:text-[#ECECEC]/60"
              >
                <Terminal className="h-3 w-3" />
                <span className="font-mono text-[10px]">Terminal</span>
              </button>

              {/* Git branch */}
              <div className="flex h-full items-center gap-1.5 border-r border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/22">
                <GitBranch className="h-3 w-3" />
                <span className="font-mono text-[10px]">main</span>
              </div>

              {/* Active file */}
              {activeFile && (
                <div className="flex h-full items-center gap-1.5 border-r border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/20">
                  <Code2 className="h-3 w-3" />
                  <span className="max-w-[200px] truncate font-mono text-[10px]">
                    {activeFile.path.split("/").pop()}
                  </span>
                </div>
              )}

              {/* File count */}
              <div className="flex h-full items-center gap-1.5 border-r border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/16">
                <FileCode className="h-3 w-3" />
                <span className="font-mono text-[10px]">{project.files.length} files</span>
              </div>

              {/* Dep count (when installed) */}
              {depCount > 0 && (
                <div className="flex h-full items-center gap-1.5 border-r border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/16">
                  <span className="font-mono text-[10px]">{depCount} deps</span>
                </div>
              )}

              <div className="flex-1" />

              {/* Node version (when known) */}
              {nodeVersion && wcStatus === "ready" && (
                <div className="flex h-full items-center gap-1.5 border-l border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/22">
                  <span className="font-mono text-[10px]">Node {nodeVersion}</span>
                </div>
              )}

              {/* WC live URL chip */}
              {wcUrl && wcStatus === "ready" && (
                <div className="flex h-full items-center gap-1.5 border-l border-[rgba(255,255,255,0.08)] px-3 text-emerald-400/65">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-none" />
                  <span className="font-mono text-[10px]">live</span>
                </div>
              )}

              {/* Runtime status */}
              <div className={`flex h-full items-center gap-1.5 border-l border-[rgba(255,255,255,0.08)] px-3 transition-colors ${statusColors.text}`}>
                <Circle className={`h-1.5 w-1.5 ${statusColors.dot}`} />
                <Cpu className="h-2.5 w-2.5 opacity-40" />
                <span className="font-mono text-[10px]">{statusLabel}</span>
              </div>

              {/* Keyboard hint */}
              <div className="flex h-full items-center border-l border-[rgba(255,255,255,0.08)] px-3 text-[#ECECEC]/12">
                <span className="font-mono text-[10px]">⌃`</span>
              </div>
            </div>
          )}
        </StudioWorkspace>
      </div>
    </motion.div>
  )
}
