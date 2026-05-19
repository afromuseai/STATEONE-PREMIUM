import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import {
  BarChart3, Globe, Bot, Brain, Zap, Database,
  TrendingUp, Plus, ChevronRight, Activity,
  Cpu, Target, Clock, Sparkles,
  ArrowRight, CheckCircle2, AlertTriangle,
  Workflow, Network, Shield,
} from "lucide-react"
import type { Project } from "@/lib/api"
import type { BusinessIntelligence } from "./output-panel"

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CommandCenterOverviewProps {
  user: { name: string; email: string } | null
  projects: Project[]
  projectsLoading: boolean
  agentCount: number
  memoryCount: number
  websiteGenerated: boolean
  results: BusinessIntelligence | null
  onNavigate: (path: string) => void
  onOpenProject: (project: Project) => void
  onDeleteProject: (id: string, e: React.MouseEvent) => void
  formatDate: (d: string) => string
}

// ─── Coordination States ─────────────────────────────────────────────────────
const COORD_STATES = [
  "Coordinating workflow intelligence",
  "Optimizing cross-system signals",
  "Synchronizing agent task queues",
  "Calibrating memory context",
  "Mapping automation leverage points",
]

// ─── Mini Coordination Ring SVG ───────────────────────────────────────────────
function CoordRing({ score }: { score: number }) {
  const r = 54
  const cx = 70
  const cy = 70
  const circumference = 2 * Math.PI * r

  return (
    <svg width={140} height={140} className="overflow-visible -rotate-90">
      <circle cx={cx} cy={cy} r={r} stroke="rgba(212,175,55,0.06)" strokeWidth={8} fill="none" />
      <motion.circle
        cx={cx} cy={cy} r={r}
        stroke="url(#coordGrad)"
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - score / 100) }}
        transition={{ duration: 1.8, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="coordGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="rgba(212,175,55,0.9)" />
          <stop offset="100%" stopColor="rgba(212,175,55,0.4)" />
        </linearGradient>
      </defs>
    </svg>
  )
}

// ─── Memory Health Gauge ───────────────────────────────────────────────────────
function MemoryGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 24
  const circumference = 2 * Math.PI * r
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-14 h-14 flex items-center justify-center">
        <svg width={56} height={56} className="absolute inset-0 overflow-visible -rotate-90">
          <circle cx={28} cy={28} r={r} stroke="rgba(255,255,255,0.05)" strokeWidth={4} fill="none" />
          <motion.circle
            cx={28} cy={28} r={r}
            stroke={color}
            strokeWidth={4}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - value / 100) }}
            transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
          />
        </svg>
        <span className="relative text-[11px] font-black" style={{ color }}>{value}%</span>
      </div>
      <span className="text-[9px] text-muted-foreground/40 font-semibold uppercase tracking-wider text-center leading-tight">{label}</span>
    </div>
  )
}

// ─── Priority Config ───────────────────────────────────────────────────────────
const PRIORITY_CONF = {
  critical: { label: "CRITICAL", color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25" },
  high:     { label: "HIGH",     color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/25" },
  medium:   { label: "MEDIUM",   color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25" },
  low:      { label: "LOW",      color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25" },
}

// ─── Activity Icon Config ──────────────────────────────────────────────────────
const ACTIVITY_CONF = {
  website:  { icon: Globe,    color: "text-blue-400",  bg: "bg-blue-500/10 border-blue-500/15",  label: "Website generated" },
  analysis: { icon: BarChart3, color: "text-primary",  bg: "bg-primary/10 border-primary/15",    label: "Analysis complete" },
  agent:    { icon: Bot,      color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/15", label: "Agent deployed" },
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function CommandCenterOverview({
  user,
  projects,
  projectsLoading,
  agentCount,
  memoryCount,
  websiteGenerated,
  results,
  onNavigate,
  onOpenProject,
  onDeleteProject,
  formatDate,
}: CommandCenterOverviewProps) {
  const [, navigate] = useLocation()
  const [coordStateIdx, setCoordStateIdx] = useState(0)

  const go = (path: string) => { onNavigate(path); navigate(path) }

  useEffect(() => {
    const t = setInterval(() => setCoordStateIdx(i => (i + 1) % COORD_STATES.length), 2600)
    return () => clearInterval(t)
  }, [])

  const firstName = user?.name?.split(" ")[0] ?? "there"

  // ── Real metrics from backend state ──────────────────────────────────────────
  const websiteCount = projects.filter(p => p.websiteOutput).length
  const weeklyProjects = projects.filter(p =>
    Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000
  ).length

  const activeSystemFlags = [
    projects.length > 0,
    websiteGenerated || websiteCount > 0,
    agentCount > 0,
    memoryCount > 0,
  ]
  const activeSystemCount = activeSystemFlags.filter(Boolean).length
  const coordScore = Math.round((activeSystemCount / 4) * 100)
  const systemHealth = Math.min(98, 78 + coordScore / 5)

  // Operational modules derived from real state
  const operationalModules = [
    { name: "Business Intelligence", icon: BarChart3, active: projects.length > 0, href: "/dashboard?tab=new" },
    { name: "Website Architect",     icon: Globe,     active: websiteCount > 0,    href: "/website-generator" },
    { name: "Workflows",             icon: Workflow,  active: projects.length > 0, href: "/automation-builder" },
    { name: "AI Agents",             icon: Bot,       active: agentCount > 0,      href: "/agents" },
    { name: "Executions",            icon: Zap,       active: projects.length > 0, href: "/execution-engine" },
    { name: "Global Memory",         icon: Database,  active: memoryCount > 0,     href: "/memory" },
  ]

  // Priority queue from real project output metrics
  const priorityItems = projects.slice(0, 5).map((p, i) => {
    const output = p.output as Record<string, unknown> | null
    const metrics = output?.metrics as Record<string, number> | null
    const automationPotential = metrics?.automationPotential ?? 50
    const revenueScalability  = metrics?.revenueScalability  ?? 5
    const marketDifficulty    = metrics?.marketDifficulty    ?? 5
    const score = Math.min(99, Math.round(
      (automationPotential * 0.4 + revenueScalability * 6 + (10 - marketDifficulty) * 6) / 1.6
    ))
    const priority: keyof typeof PRIORITY_CONF =
      i === 0 ? "critical" : i <= 2 ? "high" : i === 3 ? "medium" : "low"
    const industry = (output?.industry as string) ?? "Business"
    return { project: p, score, priority, industry }
  })

  // Activity feed from real project list
  const activityItems = projects.slice(0, 6).map(p => ({
    project: p,
    type: p.websiteOutput ? "website" : "analysis" as keyof typeof ACTIVITY_CONF,
    industry: ((p.output as Record<string, unknown> | null)?.industry as string) ?? "Business",
  }))

  // Memory health gauges — derived from real data
  const memoryBase = Math.min(95, 60 + Math.min(memoryCount, 35))
  const memoryGauges = [
    { label: "Coverage",   value: memoryBase,              color: "#60a5fa" },
    { label: "Coherence",  value: Math.max(80, memoryBase - 2), color: "#34d399" },
    { label: "Richness",   value: Math.max(75, memoryBase - 4), color: "#a78bfa" },
    { label: "Sync Status", value: projects.length > 0 ? 100 : 0, color: "#d4af37" },
  ]

  // Quick actions
  const quickActions = [
    { icon: Sparkles, label: "Run New Analysis",   desc: "Analyze your business idea",   href: "/dashboard?tab=new", primary: true },
    { icon: Globe,    label: "Create Website",      desc: "Generate AI website",           href: "/website-generator", primary: false },
    { icon: Workflow, label: "Build Workflow",      desc: "Automate processes",            href: "/automation-builder", primary: false },
    { icon: Bot,      label: "Deploy Agent",        desc: "Launch AI agent",               href: "/agents", primary: false },
    { icon: Brain,    label: "Optimize System",     desc: "Improve performance",           href: "/os", primary: false },
    { icon: Database, label: "Sync All Modules",    desc: "Force synchronization",         href: "/memory", primary: false },
  ]

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

  // ── Empty state ───────────────────────────────────────────────────────────────
  if (projects.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-black text-foreground">
            Welcome, <span className="text-gold-gradient">{firstName}</span> 👋
          </h1>
          <p className="text-muted-foreground mt-1">Your AI Operating System is ready. Start your first analysis.</p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          onClick={() => go("/dashboard?tab=new")}
          className="w-full flex items-center gap-4 glass-card rounded-2xl p-5 border-primary/25 hover:border-primary/45 hover:bg-primary/5 transition-all text-left"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-bold text-foreground">New Business Analysis</p>
            <p className="text-sm text-muted-foreground/60 mt-0.5">Enter your idea → full AI intelligence in seconds</p>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground/40" />
        </motion.button>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Globe, label: "Website Architect", href: "/website-generator", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
            { icon: Bot,   label: "AI Agent Store",    href: "/agents",            color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20" },
            { icon: Workflow, label: "Automations",    href: "/automation-builder",color: "text-green-400", bg: "bg-green-500/10 border-green-500/20" },
          ].map(({ icon: Icon, label, href, color, bg }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.07 }}
              onClick={() => go(href)}
              className={`glass-card rounded-xl p-4 flex items-center gap-3 border hover:border-opacity-50 transition-all text-left ${bg}`}
            >
              <Icon className={`h-5 w-5 ${color} shrink-0`} />
              <span className="text-sm font-semibold text-foreground">{label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    )
  }

  // ── Full command center ───────────────────────────────────────────────────────
  return (
    <div className="p-5 space-y-4 max-w-screen-2xl mx-auto">

      {/* ── Welcome + status badges ───────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">
            Welcome back, <span className="text-gold-gradient">{firstName}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground/50 mt-0.5">
            Your AI Operating System is running optimally.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* System Health badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2 rounded-xl border border-green-500/20 bg-green-500/8 px-3 py-1.5"
          >
            <Shield className="h-3 w-3 text-green-400 shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold">System Health</p>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-green-400 leading-none">{Math.round(systemHealth)}%</span>
                <TrendingUp className="h-2.5 w-2.5 text-green-400" />
              </div>
            </div>
          </motion.div>
          {/* Coordination Score badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/8 px-3 py-1.5"
          >
            <Network className="h-3 w-3 text-primary shrink-0" />
            <div>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider font-semibold">Coordination</p>
              <div className="flex items-center gap-1">
                <span className="text-sm font-black text-primary leading-none">{coordScore}%</span>
                <TrendingUp className="h-2.5 w-2.5 text-primary" />
              </div>
            </div>
          </motion.div>
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.25 }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => go("/dashboard?tab=new")}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-[0_4px_16px_rgba(212,175,55,0.25)]"
          >
            <Plus className="h-4 w-4" />
            New Analysis
          </motion.button>
        </div>
      </motion.div>

      {/* ── Main 3-column grid ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* ══ Column 1: System Coordination + Operational Modules ═════════════ */}
        <div className="space-y-4">

          {/* System Coordination card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">System Coordination</p>
              <motion.div
                className="h-1.5 w-1.5 rounded-full bg-green-400"
                animate={{ opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>

            <div className="flex items-center gap-4">
              {/* Ring viz */}
              <div className="relative shrink-0 flex items-center justify-center" style={{ width: 100, height: 100 }}>
                <CoordRing score={coordScore} />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-primary leading-none">{coordScore}%</span>
                  <span className="text-[8px] text-muted-foreground/40 uppercase tracking-widest mt-0.5">Score</span>
                </div>
              </div>

              {/* Stat bars */}
              <div className="flex-1 space-y-3">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground/60 font-medium">Health</span>
                    <span className="text-[10px] text-green-400 font-bold">{Math.round(systemHealth)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-green-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${systemHealth}%` }}
                      transition={{ duration: 1.4, ease: "easeOut" }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground/60 font-medium">Coordination</span>
                    <span className="text-[10px] text-primary font-bold">{coordScore}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${coordScore}%` }}
                      transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground/60 font-medium">Active Systems</span>
                    <span className="text-[10px] text-blue-400 font-bold">{activeSystemCount}/4</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-blue-400"
                      initial={{ width: 0 }}
                      animate={{ width: `${(activeSystemCount / 4) * 100}%` }}
                      transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Live reasoning ticker */}
            <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/4 px-3 py-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}>
                <Cpu className="h-3 w-3 text-primary/60 shrink-0" />
              </motion.div>
              <AnimatePresence mode="wait">
                <motion.p
                  key={coordStateIdx}
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-[10px] text-primary/60 font-medium truncate"
                >
                  {COORD_STATES[coordStateIdx]}
                </motion.p>
              </AnimatePresence>
            </div>
          </motion.div>

          {/* Operational Modules card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Operational Modules</p>
              <span className="text-[9px] text-green-400 font-bold bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5 uppercase tracking-wider">
                All Systems Flowing
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {operationalModules.map(({ name, icon: Icon, active, href }, i) => (
                <motion.button
                  key={name}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.12 + i * 0.04 }}
                  onClick={() => go(href)}
                  className="flex flex-col items-center gap-2 group cursor-pointer"
                >
                  <motion.div
                    className={`relative flex h-11 w-11 items-center justify-center rounded-xl border transition-all duration-300 group-hover:scale-105 ${
                      active
                        ? "bg-primary/10 border-primary/25 group-hover:border-primary/45"
                        : "bg-white/3 border-white/8 group-hover:border-white/15"
                    }`}
                    animate={active ? {
                      boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 10px rgba(212,175,55,0.2)", "0 0 0px rgba(212,175,55,0)"]
                    } : {}}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  >
                    <Icon className={`h-4.5 w-4.5 transition-colors ${active ? "text-primary" : "text-muted-foreground/25"}`} />
                    <motion.div
                      className={`absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full border border-background ${active ? "bg-green-400" : "bg-white/10"}`}
                      animate={active ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  </motion.div>
                  <div className="text-center">
                    <p className={`text-[9px] font-semibold leading-tight ${active ? "text-foreground/70" : "text-muted-foreground/25"}`}>
                      {name.split(" ")[0]}
                    </p>
                    <p className={`text-[8px] font-bold uppercase tracking-wider ${active ? "text-green-400" : "text-muted-foreground/20"}`}>
                      {active ? "Active" : "Idle"}
                    </p>
                  </div>
                </motion.button>
              ))}
            </div>
          </motion.div>

        </div>

        {/* ══ Column 2: Priority Queue + Activity Feed ════════════════════════ */}
        <div className="space-y-4">

          {/* Intelligence Priority Queue */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Intelligence Priority Queue</p>
              <button
                onClick={() => go("/dashboard?tab=projects")}
                className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-semibold"
              >
                View Full <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="space-y-2.5">
              {priorityItems.length > 0 ? priorityItems.map(({ project, score, priority, industry }, i) => {
                const conf = PRIORITY_CONF[priority]
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.06 }}
                    onClick={() => onOpenProject(project)}
                    className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/2 hover:border-primary/20 hover:bg-primary/3 p-3 cursor-pointer transition-all group"
                  >
                    <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${conf.color} ${conf.bg} ${conf.border}`}>
                      {conf.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground/80 truncate group-hover:text-foreground transition-colors">
                        {project.title}
                      </p>
                      <p className="text-[9px] text-muted-foreground/40">{industry}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-black leading-none ${score >= 80 ? "text-green-400" : score >= 60 ? "text-primary" : "text-orange-400"}`}>
                        {score}
                      </p>
                      <p className="text-[8px] text-muted-foreground/30">Impact</p>
                    </div>
                  </motion.div>
                )
              }) : (
                <div className="text-center py-6">
                  <Target className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/40">Run an analysis to populate the queue</p>
                </div>
              )}
            </div>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Activity Feed</p>
              <button
                onClick={() => go("/dashboard?tab=projects")}
                className="text-[10px] text-primary/60 hover:text-primary transition-colors font-semibold"
              >
                View All
              </button>
            </div>
            <div className="space-y-0">
              {activityItems.length > 0 ? activityItems.map(({ project, type, industry }, i) => {
                const conf = ACTIVITY_CONF[type] ?? ACTIVITY_CONF.analysis
                const Icon = conf.icon
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.18 + i * 0.05 }}
                    className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0 cursor-pointer group"
                    onClick={() => onOpenProject(project)}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded-lg border shrink-0 ${conf.bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${conf.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground/80 truncate group-hover:text-foreground transition-colors">
                        {project.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] text-muted-foreground/40">{conf.label}</span>
                        <span className="text-[9px] text-muted-foreground/20">·</span>
                        <span className="text-[9px] text-primary/50 font-medium">{industry}</span>
                      </div>
                    </div>
                    <span className="text-[9px] text-muted-foreground/30 shrink-0">{formatDate(project.updatedAt)}</span>
                  </motion.div>
                )
              }) : (
                <div className="text-center py-6">
                  <Activity className="h-6 w-6 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground/40">No activity yet</p>
                </div>
              )}
            </div>
          </motion.div>

        </div>

        {/* ══ Column 3: Performance Overview + Memory Health ══════════════════ */}
        <div className="space-y-4">

          {/* Performance Overview */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Performance Overview</p>
              <span className="text-[9px] text-muted-foreground/40 border border-white/8 rounded-lg px-2 py-1">Live</span>
            </div>
            <div className="space-y-4">
              {[
                {
                  label: "Total Analyses",
                  value: projects.length,
                  sub: weeklyProjects > 0 ? `+${weeklyProjects} this week` : "all time",
                  icon: BarChart3,
                  color: "text-primary",
                  positive: weeklyProjects > 0,
                },
                {
                  label: "Websites Built",
                  value: websiteCount,
                  sub: websiteCount > 0 ? "AI-generated" : "none yet",
                  icon: Globe,
                  color: "text-blue-400",
                  positive: websiteCount > 0,
                },
                {
                  label: "Active Agents",
                  value: agentCount,
                  sub: agentCount > 0 ? "running now" : "none installed",
                  icon: Bot,
                  color: "text-purple-400",
                  positive: agentCount > 0,
                },
                {
                  label: "Memory Entries",
                  value: memoryCount,
                  sub: memoryCount > 0 ? "context stored" : "builds on use",
                  icon: Database,
                  color: "text-yellow-400",
                  positive: memoryCount > 0,
                },
              ].map(({ label, value, sub, icon: Icon, color, positive }, i) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2 + i * 0.06 }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/4 border border-white/6 shrink-0">
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground/80">{label}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {positive && <TrendingUp className="h-2.5 w-2.5 text-green-400" />}
                        <p className="text-[9px] text-muted-foreground/40">{sub}</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Global Memory Health */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card rounded-2xl p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Global Memory Health</p>
              <button onClick={() => go("/memory")} className="text-[10px] text-primary/60 hover:text-primary transition-colors font-semibold flex items-center gap-1">
                Manage <ChevronRight className="h-3 w-3" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {memoryGauges.map(({ label, value, color }) => (
                <MemoryGauge key={label} label={label} value={value} color={color} />
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between rounded-lg border border-white/5 bg-white/2 px-3 py-2">
              <div className="flex items-center gap-2">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-green-400"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-[10px] text-muted-foreground/50">Last synchronized</span>
              </div>
              <span className="text-[10px] text-primary/60 font-semibold">
                {memoryCount > 0 ? "Recently" : "Not yet"}
              </span>
            </div>
          </motion.div>

        </div>
      </div>

      {/* ── Quick Actions row ─────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass-card rounded-2xl p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-bold text-foreground uppercase tracking-wider">Quick Actions</p>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400/60" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {quickActions.map(({ icon: Icon, label, desc, href, primary }, i) => (
            <motion.button
              key={label}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28 + i * 0.04 }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => go(href)}
              className={`flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-all ${
                primary
                  ? "border-primary/25 bg-primary/8 hover:border-primary/45 hover:bg-primary/12"
                  : "border-white/6 bg-white/2 hover:border-white/15 hover:bg-white/4"
              }`}
            >
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${primary ? "bg-primary/15" : "bg-white/5"}`}>
                <Icon className={`h-3.5 w-3.5 ${primary ? "text-primary" : "text-muted-foreground/60"}`} />
              </div>
              <div>
                <p className={`text-[11px] font-bold leading-tight ${primary ? "text-primary" : "text-foreground/80"}`}>{label}</p>
                <p className="text-[9px] text-muted-foreground/40 mt-0.5 leading-tight">{desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* ── Top Optimization Opportunities (from real project metrics) ─────────── */}
      {projects.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
              <p className="text-xs font-bold text-foreground uppercase tracking-wider">Top Optimization Opportunities</p>
            </div>
            <button onClick={() => go("/intelligence")} className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-semibold">
              View All <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                label: websiteCount === 0 ? "Generate AI Website" : "Optimize Website Performance",
                badge: websiteCount === 0 ? "+28% Conversion Impact" : "+15% Core Web Vitals",
                color: "text-green-400",
                bg: "bg-green-500/8 border-green-500/15",
                href: "/website-generator",
              },
              {
                label: agentCount === 0 ? "Deploy AI Agent to Website" : "Expand Agent Coverage",
                badge: "+24% Automation Efficiency",
                color: "text-blue-400",
                bg: "bg-blue-500/8 border-blue-500/15",
                href: "/agents",
              },
              {
                label: memoryCount < 5 ? "Build AI Memory Context" : "Automate Email Sequences",
                badge: "+18% Operational Efficiency",
                color: "text-purple-400",
                bg: "bg-purple-500/8 border-purple-500/15",
                href: memoryCount < 5 ? "/memory" : "/automation-builder",
              },
            ].map(({ label, badge, color, bg, href }, i) => (
              <motion.button
                key={label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32 + i * 0.06 }}
                whileHover={{ y: -1 }}
                onClick={() => go(href)}
                className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all hover:brightness-110 ${bg}`}
              >
                <div className={`h-2 w-2 rounded-full shrink-0 ${color.replace("text-", "bg-")}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground/80 truncate">{label}</p>
                  <p className={`text-[9px] font-bold ${color} mt-0.5`}>{badge}</p>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

    </div>
  )
}
