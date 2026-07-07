import { ArrowLeft, Play, Upload, Settings, Monitor, Code2, Columns2, Terminal, PanelRight, CheckCircle, Clock, Layers, Loader, AlertCircle } from "lucide-react"
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
  { id: "preview", icon: Monitor,   label: "Preview" },
  { id: "code",    icon: Code2,     label: "Code" },
  { id: "split",   icon: Columns2,  label: "Split" },
  { id: "terminal",icon: Terminal,  label: "Terminal" },
]

interface TopCommandBarProps {
  project: V2Project
  workspaceMode: WorkspaceMode
  onModeChange: (mode: WorkspaceMode) => void
  fileExplorerOpen: boolean
  onToggleFileExplorer: () => void
}

export function TopCommandBar({
  project,
  workspaceMode,
  onModeChange,
  fileExplorerOpen,
  onToggleFileExplorer,
}: TopCommandBarProps) {
  const [, navigate] = useLocation()
  const status = STATUS_CFG[project.status] ?? STATUS_CFG.planning
  const StatusIcon = status.icon
  const isAnimating = project.status === "building" || project.status === "architecting" || project.status === "planning"

  return (
    <div className="flex h-11 flex-shrink-0 items-center gap-3 border-b border-white/[0.07] bg-[#0d0d0d] px-3">
      {/* Back */}
      <button
        onClick={() => navigate("/website-studio")}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
        title="Back to projects"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
      </button>

      <div className="h-4 w-px bg-white/10" />

      {/* Project name + status */}
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-sm font-semibold text-white/85 max-w-[160px]">
          {project.projectName}
        </span>
        <div
          className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
          style={{ background: `${status.color}18` }}
        >
          <StatusIcon
            className={`h-3 w-3 ${isAnimating ? "animate-spin" : ""}`}
            style={{ color: status.color }}
          />
          <span className="text-[11px] font-semibold" style={{ color: status.color }}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Mode switcher */}
      <div className="flex items-center rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5 gap-0.5">
        {MODES.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => onModeChange(id)}
            title={label}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all duration-150
              ${workspaceMode === id
                ? "bg-amber-400/15 text-amber-400"
                : "text-white/35 hover:bg-white/5 hover:text-white/65"
              }`}
          >
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-white/10" />

      {/* Actions */}
      <div className="flex items-center gap-1.5">
        <button className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/60 transition-colors hover:border-white/20 hover:text-white/85">
          <Play className="h-3 w-3" />
          <span className="hidden md:inline">Run</span>
        </button>
        <button className="flex items-center gap-1.5 rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-400 transition-colors hover:bg-amber-400/20">
          <Upload className="h-3 w-3" />
          <span className="hidden md:inline">Deploy</span>
        </button>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-md border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
          title="Settings"
        >
          <Settings className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onToggleFileExplorer}
          title="Toggle file explorer"
          className={`flex h-7 w-7 items-center justify-center rounded-md border transition-colors
            ${fileExplorerOpen
              ? "border-amber-400/30 bg-amber-400/10 text-amber-400"
              : "border-white/10 text-white/40 hover:border-white/20 hover:text-white/70"
            }`}
        >
          <PanelRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
