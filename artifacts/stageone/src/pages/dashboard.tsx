import { useState, useCallback, useRef, useEffect } from "react"
import { useLocation, useSearch } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { useDashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/header"
import { CommandCenterOverview } from "@/components/dashboard/command-center-overview"
import { useAuth } from "@/lib/auth-context"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import { api, type Project } from "@/lib/api"
import { useLang, useFormatters } from "@/lib/i18n"
import {
  FolderOpen,
  Plus,
  Clock,
  Search,
  BarChart3,
  Globe,
  ChevronRight,
  Trash2,
  Crown,
  AlertTriangle,
} from "lucide-react"

type Tab = "overview" | "projects"

function getTab(search: string): Tab {
  const p = new URLSearchParams(search.replace("?", ""))
  const t = p.get("tab")
  if (t === "projects") return t
  return "overview"
}

export default function DashboardPage() {
  const { t } = useLang()
  const wp = t.workspace.projects
  const wm = t.workspace.modals
  const { user } = useAuth()
  const { openUpgradeModal } = useUpgradeModal()
  const search = useSearch()
  const { mobileOpen: mobileSidebarOpen, setMobileOpen } = useDashboardShell()
  const activeTab = getTab(search)

  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const projectsRef = useRef<Project[]>([])
  const [memoryCount, setMemoryCount] = useState(0)
  const [agentCount, setAgentCount] = useState(0)
  const [websiteGenerated, setWebsiteGenerated] = useState(false)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)

  const [, setLocation] = useLocation()
  const [projectSearch, setProjectSearch] = useState("")
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | "active" | "draft" | "completed" | "archived">("all")

  // Subscription state for usage warning
  const [subscription, setSubscription] = useState<{ aiGenerationsUsed: number; aiGenerationsLimit: number; plan: string } | null>(null)

  useEffect(() => {
    api.projects.list().then(({ projects }) => {
      setProjects(projects)
      projectsRef.current = projects
      const hasWebsite = projects.some(p => p.websiteOutput)
      if (hasWebsite) setWebsiteGenerated(true)
    }).catch(() => {}).finally(() => setProjectsLoading(false))

    fetch("/api/memory", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.memories)) setMemoryCount(d.memories.length) })
      .catch(() => {})

    fetch("/api/agents?installed=true", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.agents)) setAgentCount(d.agents.filter((a: { isActive: boolean }) => a.isActive).length) })
      .catch(() => {})

    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription) setSubscription(d.subscription) })
      .catch(() => {})
  }, [])

  const handleDeleteProject = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.projects.delete(id)
    const updated = projectsRef.current.filter(p => p.id !== id)
    projectsRef.current = updated
    setProjects(updated)
    if (activeProjectId === id) setActiveProjectId(null)
  }, [activeProjectId])

  const handleOpenProject = useCallback((project: Project) => {
    setLocation(`/projects/${project.id}`)
  }, [setLocation])

  const { formatDate } = useFormatters()

  const renderOverview = () => (
    <CommandCenterOverview
      user={user}
      projects={projects}
      projectsLoading={projectsLoading}
      agentCount={agentCount}
      memoryCount={memoryCount}
      websiteGenerated={websiteGenerated}
      results={null}
      plan={subscription?.plan ?? "free"}
      onNavigate={setLocation}
      onOpenProject={handleOpenProject}
      onDeleteProject={handleDeleteProject}
      formatDate={formatDate}
    />
  )

  const filteredProjects = projects.filter(p => {
    const matchSearch = !projectSearch ||
      p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.businessIdea.toLowerCase().includes(projectSearch.toLowerCase())
    const matchStatus = projectStatusFilter === "all" || (p.status ?? "active") === projectStatusFilter
    return matchSearch && matchStatus
  })

  const STATUS_LABELS: Record<string, string> = {
    all: wp.statusAll,
    active: wp.statusActive,
    draft: wp.statusDraft,
    completed: wp.statusCompleted,
    archived: wp.statusArchived,
  }

  const STATUS_COLORS_I18N: Record<string, { label: string; color: string; bg: string; border: string }> = {
    active:    { label: wp.statusActive,    color: "text-emerald-400",      bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
    draft:     { label: wp.statusDraft,     color: "text-muted-foreground", bg: "bg-white/5",        border: "border-white/10" },
    completed: { label: wp.statusCompleted, color: "text-blue-400",         bg: "bg-blue-500/10",    border: "border-blue-500/25" },
    archived:  { label: wp.statusArchived,  color: "text-amber-400",        bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  }

  const renderProjects = () => (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{wp.allProjects}</h2>
        <button
          onClick={() => setLocation("/business-intelligence?_r=" + Date.now())}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />{wp.new}
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
            placeholder={wp.searchProjects}
            className="w-full rounded-lg border border-white/8 bg-white/3 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "draft", "completed", "archived"] as const).map(s => (
            <button key={s} onClick={() => setProjectStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all border ${
                projectStatusFilter === s
                  ? "bg-primary/12 border-primary/30 text-primary"
                  : "border-white/8 text-muted-foreground hover:text-foreground"
              }`}>
              {s === "all" ? `${STATUS_LABELS.all} (${projects.length})` : `${STATUS_LABELS[s]} (${projects.filter(p => (p.status ?? "active") === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {projectsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!projectsLoading && projects.length === 0 && (
        <div className="text-center py-16 glass-card rounded-xl">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">{wp.noProjectsYet}</p>
          <p className="text-sm text-muted-foreground mt-1">{wp.noProjectsDesc}</p>
        </div>
      )}

      {!projectsLoading && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{wp.noMatchFilter}</p>
        </div>
      )}

      <div className="grid gap-3">
        {filteredProjects.map((project, i) => {
          const statusConf = STATUS_COLORS_I18N[project.status ?? "active"] ?? STATUS_COLORS_I18N.active
          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleOpenProject(project)}
              className="glass-card rounded-xl p-4 hover:border-primary/30 cursor-pointer transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{project.title}</p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${statusConf.color} ${statusConf.bg} ${statusConf.border}`}>
                      {statusConf.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{project.businessIdea}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {project.websiteOutput && (
                      <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                        <Globe className="h-2.5 w-2.5" /> {wp.website}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" /> {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )

  // Compute usage warning
  const usagePct = subscription && subscription.aiGenerationsLimit > 0
    ? subscription.aiGenerationsUsed / subscription.aiGenerationsLimit
    : 0
  const showUsageWarning = usagePct >= 0.8 && subscription !== null && subscription.aiGenerationsLimit > 0

  return (
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuToggle={() => setMobileOpen(p => !p)} />

        {/* 80% usage warning banner */}
        <AnimatePresence>
          {showUsageWarning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-amber-500/8 border-b border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">
                    <span className="font-bold">
                      {Math.round(usagePct * 100)}{wm.ofAiOpsUsed}
                    </span>
                    {" "}— {subscription!.aiGenerationsLimit - subscription!.aiGenerationsUsed} {wm.remaining}
                  </p>
                </div>
                <button
                  onClick={() => openUpgradeModal()}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 rounded-full px-3 py-1 bg-amber-500/6 hover:bg-amber-500/12 shrink-0"
                >
                  <Crown className="h-2.5 w-2.5" />
                  {t.workspace.overview.upgrade}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <AnimatePresence mode="wait">
            {activeTab === "projects" ? (
              <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {renderProjects()}
              </motion.div>
            ) : (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {renderOverview()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
