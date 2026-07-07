import {
  ArrowLeft, Play, Upload, Settings, Monitor, Code2,
  Columns2, PanelRight, CheckCircle, Clock, Layers,
  Loader, AlertCircle, Terminal,
} from "lucide-react"
import { useLocation } from "wouter"
import type { V2Project } from "@/hooks/useWebsiteV2Project"
import type { WorkspaceMode } from "./StudioShell"

const STATUS_CFG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  planning:     { color: "#F59E0B", icon: Clock,       label: "Planning" },
  architecting: { color: "#6366F1", icon: Layers,      label: "Architecting" },
  building:     { color: "#8B5CF6", icon: Loader,      label: "Building" },
  ready:        { color: "#10B981", icon: CheckCircle, label: "Ready" },
  failed:       { color: "#EF4444", icon: AlertCircle, label: "Failed" },
}

const MODES: { id: WorkspaceMode; icon: React.ElementType; label: string }[] = [
  { id: "preview", icon: Monitor,  label: "Preview" },
  { id: "code",    icon: Code2,    label: "Code" },
  { id: "split",   icon: Columns2, label: "Split" },
]

interface TopCommandBarProps {
  project:            V2Project
  workspaceMode:      WorkspaceMode
  onModeChange:       (mode: WorkspaceMode) => void
  fileExplorerOpen:   boolean
  onToggleFileExplorer: () => void
  terminalOpen:       boolean
  onToggleTerminal:   () => void
}

export function TopCommandBar({
  project,
  workspaceMode,
  onModeChange,
  fileExplorerOpen,
  onToggleFileExplorer,
  terminalOpen,
  onToggleTerminal,
}: TopCommandBarProps) {
  const [, navigate] = useLocation()
  const status = STATUS_CFG[project.status] ?? STATUS_CFG.planning
  const StatusIcon = status.icon
  const isAnimating =
    project.status === "building" || project.status === "architecting" || project.status === "planning"

  return (
    <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-white/[0.06] bg-[#0d0d0d] px-3">
      {/* Back */}
      <button
        onClick={() => navigate("/website-studio")}
        className="flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/65"
        title="Back to projects"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      <div className="h-3.5 w-px bg-white/[0.08]" />

      {/* Project name + status */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="max-w-[180px] truncate text-[13px] font-semibold text-white/80">
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

      {/* Mode switcher */}
      <div className="flex items-center rounded-md border border-white/[0.06] bg-white/[0.025] p-[3px] gap-px">
        {MODES.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            title={label}
            className={`flex items-center gap-1.5 rounded px-2 py-[3px] text-[11px] font-medium transition-all duration-100
              ${workspaceMode === id
                ? "bg-white/[0.08] text-white/85"
                : "text-white/30 hover:text-white/60"
              }`}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="h-3.5 w-px bg-white/[0.08]" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button className="flex items-center gap-1 rounded border border-white/[0.07] bg-white/[0.03] px-2 py-1 text-[11px] text-white/50 transition-colors hover:border-white/15 hover:text-white/80">
          <Play className="h-3 w-3" />
          <span className="hidden md:inline">Run</span>
        </button>
        <button className="flex items-center gap-1 rounded border border-amber-400/25 bg-amber-400/8 px-2 py-1 text-[11px] font-medium text-amber-400/80 transition-colors hover:bg-amber-400/15 hover:text-amber-400">
          <Upload className="h-3 w-3" />
          <span className="hidden md:inline">Deploy</span>
        </button>
        <button
          title="Settings"
          className="flex h-6 w-6 items-center justify-center rounded text-white/30 transition-colors hover:bg-white/[0.06] hover:text-white/65"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>

        <div className="h-3.5 w-px bg-white/[0.08]" />

        <button
          onClick={onToggleTerminal}
          title="Toggle terminal"
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors
            ${terminalOpen
              ? "bg-amber-400/12 text-amber-400"
              : "text-white/30 hover:bg-white/[0.06] hover:text-white/65"
            }`}
        >
          <Terminal className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onToggleFileExplorer}
          title="Toggle file explorer"
          className={`flex h-6 w-6 items-center justify-center rounded transition-colors
            ${fileExplorerOpen
              ? "bg-amber-400/12 text-amber-400"
              : "text-white/30 hover:bg-white/[0.06] hover:text-white/65"
            }`}
        >
          <PanelRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
