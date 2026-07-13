import { useState } from "react"
import { motion } from "framer-motion"
import { ArrowLeft, CheckCircle, Clock, Layers, Loader, AlertCircle, Package } from "lucide-react"
import { useLocation } from "wouter"
import { ProjectExplorer } from "./ProjectExplorer"
import { CodeViewer } from "./CodeViewer"
import { PreviewPanel } from "./PreviewPanel"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"

type ActivePanel = "code" | "preview"

const STATUS_CFG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  planning:    { color: "#A0A0A0", icon: Clock,         label: "Planning" },
  architecting:{ color: "#A0A0A0", icon: Layers,        label: "Architecting" },
  building:    { color: "#A0A0A0", icon: Loader,        label: "Building" },
  ready:       { color: "#10B981", icon: CheckCircle,   label: "Ready" },
  failed:      { color: "#EF4444", icon: AlertCircle,   label: "Failed" },
}

interface StudioLayoutProps {
  project: V2Project
  onRefresh: () => void
}

export function StudioLayout({ project, onRefresh }: StudioLayoutProps) {
  const [, navigate] = useLocation()
  const [selectedFile, setSelectedFile] = useState<V2ProjectFile | null>(
    project.files.find((f) => f.path === "app/page.tsx") ?? project.files[0] ?? null
  )
  const [activePanel, setActivePanel] = useState<ActivePanel>("preview")

  const status = STATUS_CFG[project.status] ?? STATUS_CFG.planning
  const StatusIcon = status.icon

  // When a file is selected in the explorer, also switch to code view on mobile
  const handleSelectFile = (f: V2ProjectFile) => {
    setSelectedFile(f)
    setActivePanel("code")
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="flex h-full flex-col overflow-hidden"
    >
      {/* Top bar */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-[rgba(255,255,255,0.08)] bg-[#202020] px-4 py-2.5">
        <button
          onClick={() => navigate("/website-studio")}
          className="flex h-7 w-7 items-center justify-center rounded-md border border-[rgba(255,255,255,0.08)] text-[#ECECEC]/40 transition-colors hover:border-[rgba(255,255,255,0.08)] hover:text-[#ECECEC]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>

        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <span className="truncate text-sm font-semibold text-[#ECECEC]">{project.projectName}</span>
          <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5"
            style={{ background: `${status.color}18` }}>
            <StatusIcon className="h-3 w-3" style={{ color: status.color }} />
            <span className="text-[11px] font-semibold" style={{ color: status.color }}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Deps badge */}
        {project.dependencies.length > 0 && (
          <div className="flex items-center gap-1.5 rounded-full border border-[rgba(255,255,255,0.08)] bg-[#252525] px-2.5 py-1">
            <Package className="h-3 w-3 text-[#ECECEC]/30" />
            <span className="text-[11px] text-[#ECECEC]/40">
              {project.dependencies.length} dep{project.dependencies.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Panel toggle (mobile) */}
        <div className="flex rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#202020] p-0.5 lg:hidden">
          {(["code", "preview"] as ActivePanel[]).map((p) => (
            <button key={p} onClick={() => setActivePanel(p)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors
                ${activePanel === p ? "bg-white/10 text-[#ECECEC]" : "text-[#ECECEC]/30 hover:text-[#ECECEC]/60"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Studio body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: File Explorer */}
        <div className="hidden w-52 flex-shrink-0 overflow-hidden border-r border-[rgba(255,255,255,0.08)] bg-[#202020] lg:flex lg:flex-col">
          <ProjectExplorer
            files={project.files}
            selectedFile={selectedFile}
            onSelectFile={handleSelectFile}
          />
        </div>

        {/* Middle: Code Viewer */}
        <div className={`flex-1 overflow-hidden border-r border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]/80
          ${activePanel === "preview" ? "hidden lg:flex lg:flex-col" : "flex flex-col"}`}>
          <CodeViewer file={selectedFile} />
        </div>

        {/* Right: Preview + AI Edit Panel stacked */}
        <div className={`flex-shrink-0 overflow-hidden bg-[#1A1A1A]
          ${activePanel === "code" ? "hidden lg:flex lg:flex-col" : "flex flex-col"}
          lg:w-[42%]`}
          style={{ width: activePanel === "preview" ? "100%" : undefined }}
        >
          {/* Preview takes remaining height */}
          <div className="min-h-0 flex-1 overflow-hidden">
            <PreviewPanel preview={project.preview} projectName={project.projectName} />
          </div>

          {/* AI Edit Panel anchored at bottom — now handled by StudioShell */}
        </div>
      </div>
    </motion.div>
  )
}
