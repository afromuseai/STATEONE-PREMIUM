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
  planning:     { color: "#F59E0B", icon: Clock,       label: "Planning"     },
  architecting: { color: "#6366F1", icon: Layers,      label: "Architecting" },
  building:     { color: "#8B5CF6", icon: Loader,      label: "Building"     },
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
}: TopCommandBarProps) {
  const [, navigate] = useLocation()
  const status       = STATUS_CFG[project.status] ?? STATUS_CFG.planning
  const StatusIcon   = status.icon
  const isAnimating  =
    project.status === "building" ||
    project.status === "architecting" ||
    project.status === "planning"

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0d0d0d] px-3">

      {/* ── Back ──────────────────────────────────────────────────────────── */}
      <button
        onClick={() => navigate("/website-studio")}
        title="Back to projects"
        aria-label="Back to projects"
        className="flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/65"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      <div className="h-3.5 w-px bg-white/[0.08]" />

      {/* ── Project name + build status ───────────────────────────────────── */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-[160px] truncate text-[13px] font-semibold text-white/80">
          {project.projectName}
        </span>
        <div
          className="flex items-center gap-1 rounded px-1.5 py-0.5"
          style={{ background: `${status.color}18` }}
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
      <div className="flex items-center rounded-md border border-white/[0.06] bg-white/[0.025] p-[3px] gap-px">
        {MODES.map(({ id, icon: Icon, label, shortcut }) => {
          const active = workspaceMode === id
          return (
            <button
              key={id}
              onClick={() => onModeChange(id)}
              title={shortcut ? `${label} (${shortcut})` : label}
              aria-label={label}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] font-medium transition-all duration-100
                ${active
                  ? "bg-white/[0.08] text-white/85"
                  : "text-white/30 hover:text-white/60"
                }`}
            >
              <Icon className="h-3 w-3" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          )
        })}
      </div>

      <div className="h-3.5 w-px bg-white/[0.08]" />

      {/* ── Right actions ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* P1 — Command Palette hint */}
        <button
          onClick={onOpenPalette}
          title="Command Palette (Ctrl+K)"
          aria-label="Command Palette"
          className="hidden items-center gap-1.5 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-[11px] text-white/28 transition-colors hover:border-white/12 hover:text-white/55 md:flex"
        >
          <Search className="h-3 w-3" />
          <span>⌃K</span>
        </button>

        {/* P4 — AI Code Review */}
        <button
          onClick={onCodeReview}
          title="AI Code Review"
          aria-label="AI Code Review"
          className="flex items-center gap-1 rounded border border-pink-400/20 bg-pink-400/6 px-2 py-1 text-[11px] text-pink-400/70 transition-colors hover:bg-pink-400/14 hover:text-pink-400"
        >
          <Shield className="h-3 w-3" />
          <span className="hidden md:inline">Review</span>
        </button>

        <button
          title="Run project"
          aria-label="Run project"
          className="flex items-center gap-1 rounded border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-white/50 transition-colors hover:border-white/15 hover:text-white/80"
        >
          <Play className="h-3 w-3" />
          <span className="hidden md:inline">Run</span>
        </button>

        {/* P5 — Deploy button wired */}
        <button
          onClick={onDeploy}
          title="Deploy project (P5)"
          aria-label="Deploy project"
          className="flex items-center gap-1 rounded border border-amber-400/25 bg-amber-400/8 px-2 py-1 text-[11px] font-medium text-amber-400/80 transition-colors hover:bg-amber-400/15 hover:text-amber-400"
        >
          <Upload className="h-3 w-3" />
          <span className="hidden md:inline">Deploy</span>
        </button>

        <button
          title="Project settings"
          aria-label="Project settings"
          className="flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/65"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-px bg-white/[0.08]" />

        {/* Terminal overlay toggle (⌃`) */}
        <button
          onClick={onToggleTerminalDrawer}
          title={terminalDrawerOpen ? "Close terminal overlay (⌃`)" : "Open terminal overlay (⌃`)"}
          aria-label="Toggle terminal overlay"
          aria-pressed={terminalDrawerOpen}
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors
            ${terminalDrawerOpen
              ? "bg-amber-400/12 text-amber-400"
              : "text-white/30 hover:bg-white/[0.06] hover:text-white/65"
            }`}
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
