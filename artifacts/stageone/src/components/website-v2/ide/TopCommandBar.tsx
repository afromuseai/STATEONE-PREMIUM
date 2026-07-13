import {
  ArrowLeft, Play, Upload, Settings, Monitor, Code2,
  Columns2, CheckCircle, Clock, Layers,
  Loader, AlertCircle, Terminal, TerminalSquare, Shield, Search,
} from "lucide-react"
import { useLocation } from "wouter"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type { WorkspaceMode } from "./StudioShell"

// ─── Project status config ─────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  planning:     { color: "#A0A0A0", icon: Clock,       label: "Planning"     },
  architecting: { color: "#A0A0A0", icon: Layers,      label: "Architecting" },
  building:     { color: "#A0A0A0", icon: Loader,      label: "Building"     },
  ready:        { color: "#10B981", icon: CheckCircle, label: "Ready"        },
  failed:       { color: "#EF4444", icon: AlertCircle, label: "Failed"       },
}

// ─── Workspace mode strip ──────────────────────────────────────────────────────
const MODES: { id: WorkspaceMode; icon: React.ElementType; label: string; shortcut?: string }[] = [
  { id: "code",     icon: Code2,          label: "Code",     shortcut: "⌘1" },
  { id: "preview",  icon: Monitor,        label: "Preview",  shortcut: "⌘2" },
  { id: "split",    icon: Columns2,       label: "Split",    shortcut: "⌘3" },
  { id: "terminal", icon: TerminalSquare, label: "Terminal", shortcut: "⌘`" },
]

interface TopCommandBarProps {
  project:               V2Project
  workspaceMode:         WorkspaceMode
  onModeChange:          (mode: WorkspaceMode) => void
  terminalDrawerOpen:    boolean
  onToggleTerminalDrawer: () => void
  activeFile?:           V2ProjectFile | null
  /** P4 — Trigger AI code review panel */
  onCodeReview:          () => void
  /** P5 — Open deployment pipeline modal */
  onDeploy:              () => void
  onRun:                 () => void
  /** P1 — Open command palette */
  onOpenPalette:         () => void

  
  
}

export function TopCommandBar({
  project,
  workspaceMode,
  onModeChange,
  terminalDrawerOpen,
  onToggleTerminalDrawer,
  onCodeReview,
  onDeploy,
  onOpenPalette,
  onRun,
}: TopCommandBarProps) {
  const [, navigate] = useLocation()
  const status       = STATUS_CFG[project.status] ?? STATUS_CFG.planning
  const StatusIcon   = status.icon
  const isAnimating  =
    project.status === "building" ||
    project.status === "architecting" ||
    project.status === "planning"

  return (
    <div className="flex h-11 flex-shrink-0 items-center gap-2 border-b border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-3">

      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/website-studio")}
        title="Back to projects"
        aria-label="Back to projects"
        className="flex h-6 w-6 items-center justify-center rounded-md text-[#ECECEC]/28 transition-all hover:bg-[#252525] hover:text-[#ECECEC]"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      <div className="h-3.5 w-px bg-[#252525]" />

      {/* ── Project name + build status ───────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-[160px] truncate text-[13px] font-semibold text-[#ECECEC]">
          {project.projectName}
        </span>
        <div
          className="flex items-center gap-1 rounded-md px-1.5 py-0.5"
          style={{ background: `${status.color}14`, border: `1px solid ${status.color}22` }}
        >
          <StatusIcon
            className={`h-2.5 w-2.5 ${isAnimating ? "animate-spin" : ""}`}
            style={{ color: status.color }}
          />
          <span className="text-[10px] font-semibold" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      <div className="flex-1" />

      {/* ── Workspace mode strip ──────────────────────────────────────────── */}
      <div className="flex items-center rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525] p-[3px] gap-px">
        {MODES.map(({ id, icon: Icon, label, shortcut }) => {
          const active = workspaceMode === id
          return (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              title={shortcut ? `${label} (${shortcut})` : label}
              aria-label={label}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-all duration-150
                ${active
                  ? "bg-[#252525] text-[#ECECEC] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  : "text-[#ECECEC]/28 hover:text-[#ECECEC]/60 hover:bg-[#252525]"
                }`}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="h-3.5 w-px bg-[#252525]" />

      {/* ── Right actions ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* P1 — Command Palette hint */}
        <button
          onClick={onOpenPalette}
          title="Command Palette (Ctrl+K)"
          aria-label="Command Palette"
          className="hidden items-center gap-1.5 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#252525] px-2 py-1 text-[11px] text-[#ECECEC]/26 transition-all hover:border-[rgba(255,255,255,0.08)] hover:bg-[#252525] hover:text-[#ECECEC]/55 md:flex"
        >
          <Search className="h-3 w-3" />
          <span>⌃K</span>
        </button>

        {/* P4 — AI Code Review */}
        <button
          onClick={onCodeReview}
          title="AI Code Review"
          aria-label="AI Code Review"
          className="flex items-center gap-1 rounded-md border border-pink-400/15 bg-pink-400/5 px-2 py-1 text-[11px] text-pink-400/65 transition-all hover:bg-pink-400/12 hover:text-pink-400/90"
        >
          <Shield className="h-3 w-3" />
          <span className="hidden md:inline">Review</span>
        </button>

        <button
            onClick={onRun}
            title="Run project"
            aria-label="Run project"
          className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.08)] bg-white/[0.025] px-2 py-1 text-[11px] text-[#ECECEC]/45 transition-all hover:border-[rgba(255,255,255,0.08)] hover:bg-[#252525] hover:text-[#ECECEC]"
        >
          <Play className="h-3 w-3" />
          <span className="hidden md:inline">Run</span>
        </button>

        {/* P5 — Deploy button wired */}
        <button
          onClick={onDeploy}
          title="Deploy project"
          aria-label="Deploy project"
          className="flex items-center gap-1 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#252525] px-2 py-1 text-[11px] font-semibold text-[#ECECEC] transition-all hover:border-[rgba(255,255,255,0.08)] hover:bg-[#252525] hover:text-[#ECECEC]"
        >
          <Upload className="h-3 w-3" />
          <span className="hidden md:inline">Deploy</span>
        </button>

        <button
          title="Project settings"
          aria-label="Project settings"
          className="flex h-6 w-6 items-center justify-center rounded-md text-[#ECECEC]/28 transition-all hover:bg-[#252525] hover:text-[#ECECEC]/65"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-px bg-[#252525]" />

        {/* Terminal overlay toggle (⌃`) */}
        <button
          onClick={onToggleTerminalDrawer}
          title={terminalDrawerOpen ? "Close terminal overlay (⌃`)" : "Open terminal overlay (⌃`)"}
          aria-label="Toggle terminal overlay"
          aria-pressed={terminalDrawerOpen}
          className={`flex h-6 w-6 items-center justify-center rounded-md transition-all
            ${terminalDrawerOpen
              ? "bg-[#252525] text-[#ECECEC] border border-[rgba(255,255,255,0.08)]"
              : "text-[#ECECEC]/28 hover:bg-[#252525] hover:text-[#ECECEC]/65"
            }`}
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
