import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "wouter"
import { 
  PlusCircle, 
  Clock, 
  Settings, 
  ChevronLeft,
  ChevronRight,
  Trash2,
  Sparkles
} from "lucide-react"

export interface Project {
  id: string
  title: string
  businessIdea: string
  createdAt: string
  metrics?: {
    businessType: string
    scalabilityScore: number
  }
}

interface SidebarProps {
  projects: Project[]
  activeProjectId: string | null
  onSelectProject: (project: Project) => void
  onNewProject: () => void
  onDeleteProject: (id: string) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({
  projects,
  activeProjectId,
  onSelectProject,
  onNewProject,
  onDeleteProject,
  collapsed,
  onToggleCollapse
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return "Just now"
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 280 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="h-full border-r border-white/5 bg-[#0a0a0a] flex flex-col relative"
    >
      <div className="p-4 border-b border-white/5 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-black" />
              </div>
              <span className="font-semibold text-white">Projects</span>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={onToggleCollapse}
          className="p-2 rounded-lg hover:bg-white/5 text-neutral-400 hover:text-white transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="p-3">
        <button
          onClick={onNewProject}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-amber-600/10 border border-amber-500/20 text-amber-400 hover:border-amber-500/40 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <PlusCircle className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm font-medium">New Analysis</span>}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-2">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {projects.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-8 h-8 text-neutral-600 mx-auto mb-2" />
                  <p className="text-sm text-neutral-500">No projects yet</p>
                  <p className="text-xs text-neutral-600 mt-1">Start your first analysis</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {projects.map((project) => (
                    <motion.div
                      key={project.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      onMouseEnter={() => setHoveredId(project.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onClick={() => onSelectProject(project)}
                      className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                        activeProjectId === project.id
                          ? "bg-white/10 border border-amber-500/30"
                          : "hover:bg-white/5 border border-transparent"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">
                            {project.title}
                          </p>
                          <p className="text-xs text-neutral-500 mt-0.5 truncate">
                            {project.businessIdea.slice(0, 40)}...
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            {project.metrics && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {project.metrics.businessType}
                              </span>
                            )}
                            <span className="text-[10px] text-neutral-600">
                              {formatDate(project.createdAt)}
                            </span>
                          </div>
                        </div>
                        <AnimatePresence>
                          {hoveredId === project.id && (
                            <motion.button
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                onDeleteProject(project.id)
                              }}
                              className="p-1.5 rounded hover:bg-red-500/20 text-neutral-500 hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </motion.button>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="p-3 border-t border-white/5">
        <Link
          href="/settings"
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-all ${collapsed ? "justify-center" : ""}`}
        >
          <Settings className="w-4 h-4 flex-shrink-0" />
          {!collapsed && <span className="text-sm">Settings</span>}
        </Link>
      </div>
    </motion.aside>
  )
}
