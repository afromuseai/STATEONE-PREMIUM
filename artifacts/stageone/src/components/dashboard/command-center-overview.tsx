import { motion } from "framer-motion"
import { useLocation } from "wouter"
import {
  BarChart3, Globe, Bot, Workflow,
  Plus, ChevronRight, Clock,
  Sparkles, Lock, Crown, Trash2,
  TrendingUp, ArrowRight, ListChecks, CheckCircle2, Circle,
} from "lucide-react"
import type { Project } from "@/lib/api"
import type { BusinessIntelligence } from "./output-panel"
import { useLang, useFormatters } from "@/lib/i18n"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import { useWorkspaceController } from "@/lib/workspace-controller-context"

interface CommandCenterOverviewProps {
  user: { name: string; email: string } | null
  projects: Project[]
  projectsLoading: boolean
  agentCount: number
  memoryCount: number
  websiteGenerated: boolean
  results: BusinessIntelligence | null
  plan?: string
  onNavigate: (path: string) => void
  onOpenProject: (project: Project) => void
  onDeleteProject: (id: string, e: React.MouseEvent) => void
  formatDate: (d: string) => string
}

export function CommandCenterOverview({
  user,
  projects,
  projectsLoading,
  websiteGenerated,
  plan = "free",
  onNavigate,
  onOpenProject,
  onDeleteProject,
  formatDate,
}: CommandCenterOverviewProps) {
  const [, navigate] = useLocation()
  const { t } = useLang()
  const { formatNumber } = useFormatters()
  const wo = t.workspace.overview
  const { openUpgradeModal } = useUpgradeModal()

  const go = (path: string) => { onNavigate(path); navigate(path) }

  const { tasks, toggleTask, deleteTask } = useWorkspaceController()

  const firstName = user?.name?.split(" ")[0] ?? "there"
  const isPro = plan === "pro" || plan === "startup" || plan === "enterprise"

  const websiteCount = projects.filter(p => p.websiteOutput).length
  const weeklyProjects = projects.filter(p =>
    Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000
  ).length

  const recentProjects = projects.slice(0, 4)

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary"
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* ── Welcome ────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-black text-foreground tracking-tight">
          {wo.welcomeBack}, <span className="text-gold-gradient">{firstName}</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {projects.length === 0
            ? wo.readyToStart
            : `${formatNumber(projects.length)} ${t.dashboard.nav.projects.toLowerCase()}${weeklyProjects > 0 ? ` · ${formatNumber(weeklyProjects)} ${wo.newAnalyses}` : ""}.`
          }
        </p>
      </motion.div>

      {/* ── Primary CTA ────────────────────────────────────────────── */}
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={() => go("/business-intelligence?_r=" + Date.now())}
        className="w-full flex items-center gap-4 glass-card rounded-2xl p-5 border-primary/30 hover:border-primary/50 hover:bg-primary/5 transition-all text-left"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0 shadow-[0_0_20px_rgba(212,175,55,0.15)]">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-foreground text-base">{wo.newBusinessAnalysis}</p>
          <p className="text-sm text-muted-foreground/60 mt-0.5">{wo.analyzeSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold shrink-0 shadow-[0_4px_16px_rgba(212,175,55,0.25)]">
          <Plus className="h-4 w-4" />
          {wo.analyze}
        </div>
      </motion.button>

      {/* ── Action Cards ───────────────────────────────────────────── */}
      <div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="text-[10px] font-black text-muted-foreground/35 uppercase tracking-[0.15em] mb-3"
        >
          {wo.buildYourBusiness}
        </motion.p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

          {/* Website — always accessible */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => go("/website-generator")}
            className="glass-card rounded-xl p-4 flex flex-col gap-3 border border-blue-500/20 bg-blue-500/5 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 border border-blue-500/20">
                <Globe className="h-4.5 w-4.5 text-blue-400" />
              </div>
              {websiteGenerated || websiteCount > 0 ? (
                <span className="text-[9px] font-black uppercase tracking-wider text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
                  {websiteCount} {wo.built}
                </span>
              ) : null}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{wo.generateWebsite}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-tight">{wo.websiteSubtitle}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-blue-400/70 font-semibold">
              <span>{wo.startBuilding}</span>
              <ArrowRight className="h-3 w-3" />
            </div>
          </motion.button>

          {/* Chatbot — Pro locked */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.13 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => isPro ? go("/chatbot-generator") : openUpgradeModal()}
            className={`glass-card rounded-xl p-4 flex flex-col gap-3 border transition-all text-left relative overflow-hidden ${
              isPro
                ? "border-purple-500/20 bg-purple-500/5 hover:border-purple-500/40 hover:bg-purple-500/10"
                : "border-white/8 bg-white/2 hover:border-white/15"
            }`}
          >
            {!isPro && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-black text-amber-400">{wo.proRequired}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 text-center px-3">{wo.upgradeForChatbot}</p>
              </div>
            )}
            <div className={`flex items-center justify-between ${!isPro ? "opacity-30" : ""}`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 border border-purple-500/20">
                {isPro ? <Bot className="h-4.5 w-4.5 text-purple-400" /> : <Lock className="h-4.5 w-4.5 text-muted-foreground" />}
              </div>
            </div>
            <div className={!isPro ? "opacity-30" : ""}>
              <p className="text-sm font-bold text-foreground">{wo.generateChatbot}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-tight">{wo.chatbotSubtitle}</p>
            </div>
            {isPro && (
              <div className="flex items-center gap-1 text-[10px] text-purple-400/70 font-semibold">
                <span>{wo.buildNow}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            )}
          </motion.button>

          {/* Automation — Pro locked */}
          <motion.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.16 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => isPro ? go("/automation-builder") : openUpgradeModal()}
            className={`glass-card rounded-xl p-4 flex flex-col gap-3 border transition-all text-left relative overflow-hidden ${
              isPro
                ? "border-green-500/20 bg-green-500/5 hover:border-green-500/40 hover:bg-green-500/10"
                : "border-white/8 bg-white/2 hover:border-white/15"
            }`}
          >
            {!isPro && (
              <div className="absolute inset-0 bg-background/40 backdrop-blur-[1px] z-10 flex flex-col items-center justify-center gap-2 rounded-xl">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25">
                  <Crown className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-[11px] font-black text-amber-400">{wo.proRequired}</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60 text-center px-3">{wo.upgradeForAutomation}</p>
              </div>
            )}
            <div className={`flex items-center justify-between ${!isPro ? "opacity-30" : ""}`}>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/20">
                {isPro ? <Workflow className="h-4.5 w-4.5 text-green-400" /> : <Lock className="h-4.5 w-4.5 text-muted-foreground" />}
              </div>
            </div>
            <div className={!isPro ? "opacity-30" : ""}>
              <p className="text-sm font-bold text-foreground">{wo.buildAutomation}</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5 leading-tight">{wo.automationSubtitle}</p>
            </div>
            {isPro && (
              <div className="flex items-center gap-1 text-[10px] text-green-400/70 font-semibold">
                <span>{wo.automateNow}</span>
                <ArrowRight className="h-3 w-3" />
              </div>
            )}
          </motion.button>

        </div>

        {/* Upgrade nudge for free users */}
        {!isPro && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mt-3 flex items-center justify-between rounded-xl border border-amber-500/15 bg-amber-500/5 px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <Crown className="h-4 w-4 text-amber-400 shrink-0" />
              <p className="text-xs text-muted-foreground/80">
                <span className="text-foreground font-semibold">{wo.upgradePro}</span> {wo.upgradeProDesc}
              </p>
            </div>
            <button
              onClick={() => openUpgradeModal()}
              className="ml-4 shrink-0 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
            >
              {wo.upgrade} <ChevronRight className="h-3 w-3" />
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Recent Projects ─────────────────────────────────────────── */}
      {projects.length > 0 && (
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="flex items-center justify-between mb-3"
          >
            <p className="text-[10px] font-black text-muted-foreground/35 uppercase tracking-[0.15em]">
              {wo.recentProjects}
            </p>
            <button
              onClick={() => go("/dashboard?tab=projects")}
              className="text-[10px] font-semibold text-primary/60 hover:text-primary transition-colors flex items-center gap-1"
            >
              {wo.viewAll} <ChevronRight className="h-3 w-3" />
            </button>
          </motion.div>

          <div className="space-y-2">
            {recentProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + i * 0.05 }}
                onClick={() => onOpenProject(project)}
                className="glass-card rounded-xl p-4 hover:border-primary/30 cursor-pointer transition-all group flex items-center gap-3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/8 border border-primary/15 shrink-0">
                  <BarChart3 className="h-4 w-4 text-primary/70" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{project.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {project.websiteOutput && (
                      <span className="flex items-center gap-1 text-[9px] text-blue-400 font-semibold">
                        <Globe className="h-2.5 w-2.5" /> {wo.website}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
                      <Clock className="h-2.5 w-2.5" /> {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => onDeleteProject(project.id, e)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground/30 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/30" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Active Tasks ────────────────────────────────────────────── */}
      {tasks.length > 0 && (() => {
        const pending = tasks.filter(t => t.status === "pending")
        const done = tasks.filter(t => t.status === "done")
        const progress = tasks.length > 0 ? Math.round((done.length / tasks.length) * 100) : 0
        return (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5 text-primary/60" />
                <p className="text-[10px] font-black text-muted-foreground/35 uppercase tracking-[0.15em]">
                  Active Tasks
                </p>
              </div>
              <span className="text-[10px] text-muted-foreground/40 font-semibold">
                {done.length}/{tasks.length} done
              </span>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full bg-white/5 rounded-full mb-3 overflow-hidden">
              <motion.div
                className="h-full bg-primary/60 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>

            <div className="space-y-1.5">
              {/* Pending first */}
              {pending.slice(0, 5).map(task => (
                <div
                  key={task.id}
                  className="glass-card rounded-xl px-4 py-3 flex items-center gap-3 group hover:border-primary/20 transition-all"
                >
                  <button
                    onClick={() => toggleTask(task.id, "done")}
                    className="shrink-0 text-muted-foreground/30 hover:text-primary transition-colors"
                  >
                    <Circle className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-sm text-foreground/80 leading-snug">{task.title}</span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/20 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {/* Completed (collapsed, max 2) */}
              {done.slice(0, 2).map(task => (
                <div
                  key={task.id}
                  className="px-4 py-2.5 flex items-center gap-3 group opacity-50 hover:opacity-70 transition-opacity"
                >
                  <button
                    onClick={() => toggleTask(task.id, "pending")}
                    className="shrink-0 text-emerald-400"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </button>
                  <span className="flex-1 text-sm text-muted-foreground/60 line-through leading-snug">{task.title}</span>
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/20 hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}

              {(pending.length > 5 || done.length > 2) && (
                <p className="text-[10px] text-muted-foreground/30 text-center pt-1">
                  {pending.length > 5 ? `+${pending.length - 5} more pending` : ``}
                  {pending.length > 5 && done.length > 2 ? " · " : ""}
                  {done.length > 2 ? `${done.length - 2} more completed` : ""}
                </p>
              )}
            </div>
          </motion.div>
        )
      })()}

      {/* ── Simple Stats ────────────────────────────────────────────── */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-3 gap-3"
        >
          {[
            { label: wo.analyses, value: projects.length, icon: BarChart3, color: "text-primary", sub: weeklyProjects > 0 ? `+${weeklyProjects} ${wo.newAnalyses}` : wo.total },
            { label: wo.websitesBuilt, value: websiteCount, icon: Globe, color: "text-blue-400", sub: websiteCount > 0 ? wo.aiGenerated : wo.noneYet },
            { label: wo.thisWeek, value: weeklyProjects, icon: TrendingUp, color: "text-green-400", sub: wo.newAnalyses },
          ].map(({ label, value, icon: Icon, color, sub }) => (
            <div key={label} className="glass-card rounded-xl p-4 text-center">
              <Icon className={`h-4 w-4 ${color} mx-auto mb-2 opacity-70`} />
              <p className={`text-2xl font-black ${color}`}>{value}</p>
              <p className="text-[10px] font-semibold text-foreground/60 mt-0.5">{label}</p>
              <p className="text-[9px] text-muted-foreground/30 mt-0.5">{sub}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Empty state extra nudge ─────────────────────────────────── */}
      {projects.length === 0 && !projectsLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-center py-8 text-muted-foreground/40"
        >
          <Sparkles className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{wo.noProjects}</p>
        </motion.div>
      )}

    </div>
  )
}
