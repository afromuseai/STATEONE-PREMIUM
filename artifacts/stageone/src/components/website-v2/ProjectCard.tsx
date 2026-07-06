import { motion } from "framer-motion"
import { Globe, Clock, CheckCircle, AlertCircle, Loader, Layers, ArrowRight } from "lucide-react"
import type { V2ProjectSummary } from "@/hooks/useWebsiteV2Projects"

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  planning:    { label: "Planning",    color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  icon: Clock },
  architecting:{ label: "Architecting",color: "#6366F1", bg: "rgba(99,102,241,0.12)",  icon: Layers },
  building:    { label: "Building",    color: "#8B5CF6", bg: "rgba(139,92,246,0.12)",  icon: Loader },
  ready:       { label: "Ready",       color: "#10B981", bg: "rgba(16,185,129,0.12)",  icon: CheckCircle },
  failed:      { label: "Failed",      color: "#EF4444", bg: "rgba(239,68,68,0.12)",   icon: AlertCircle },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

interface ProjectCardProps {
  project: V2ProjectSummary
  index: number
  onClick: () => void
}

export function ProjectCard({ project, index, onClick }: ProjectCardProps) {
  const cfg = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planning
  const Icon = cfg.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3, ease: "easeOut" }}
      onClick={onClick}
      className="group relative cursor-pointer rounded-xl border border-white/8 bg-white/[0.03] p-5 transition-all duration-200 hover:border-amber-400/30 hover:bg-white/[0.06]"
    >
      {/* Glow on hover */}
      <div className="pointer-events-none absolute inset-0 rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "radial-gradient(circle at 50% 0%, rgba(212,175,55,0.06) 0%, transparent 60%)" }} />

      <div className="flex items-start justify-between gap-3">
        {/* Icon */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
          style={{ background: cfg.bg }}>
          <Globe className="h-5 w-5" style={{ color: cfg.color }} />
        </div>

        {/* Arrow */}
        <ArrowRight className="h-4 w-4 flex-shrink-0 text-white/20 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-amber-400/60" />
      </div>

      <div className="mt-3">
        <p className="truncate text-sm font-semibold text-white/90 group-hover:text-white">
          {project.projectName}
        </p>
        <p className="mt-0.5 text-xs text-white/40">
          Updated {formatDate(project.updatedAt)}
        </p>
      </div>

      {/* Status badge */}
      <div className="mt-3 flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{ background: cfg.bg }}>
          <Icon className="h-3 w-3" style={{ color: cfg.color }} />
          <span className="text-[11px] font-semibold" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <span className="text-[11px] text-white/25">
          {formatDate(project.createdAt)}
        </span>
      </div>
    </motion.div>
  )
}
