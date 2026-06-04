import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import {
  BarChart3, Globe, Zap, Bot, Brain, TrendingUp, AlertCircle,
  Clock, ArrowRight, Sparkles, Plus, ChevronRight, Activity,
  CheckCircle2, Circle, Cpu, Target, DollarSign, Layers,
  RefreshCw, Trash2, Network,
} from "lucide-react"
import { api, type Project } from "@/lib/api"
import { useAuth } from "@/lib/auth-context"
import { getRevenueSummary } from "@/lib/intelligence-state"
import { useFormatters } from "@/lib/i18n"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface OSDashboardProps {
  onNavigate?: (path: string) => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

// ─── Animated Coordination Ring ────────────────────────────────────────────────

const RING_SYSTEMS = [
  { id: "bi", label: "Intelligence", angle: 270, color: "#d4af37" },
  { id: "website", label: "Website", angle: 330, color: "#60a5fa" },
  { id: "workflows", label: "Workflows", angle: 30, color: "#34d399" },
  { id: "agents", label: "Agents", angle: 90, color: "#a78bfa" },
  { id: "copilot", label: "Copilot", angle: 150, color: "#fb923c" },
  { id: "memory", label: "Memory", angle: 210, color: "#f472b6" },
]

const COORD_STATES = [
  "Coordinating workflow intelligence",
  "Optimizing conversion systems",
  "Synchronizing agent task queues",
  "Calibrating cross-system context",
  "Mapping automation leverage points",
]

function CoordinationRing({
  projectCount, agentCount, memoryCount, hasBI,
}: {
  projectCount: number; agentCount: number; memoryCount: number; hasBI: boolean
}) {
  const [coordState, setCoordState] = useState(0)
  const [pulse, setPulse] = useState(0)
  const cx = 90, cy = 90, r = 58, nodeR = 22

  useEffect(() => {
    const t = setInterval(() => setCoordState(s => (s + 1) % COORD_STATES.length), 2800)
    const p = setInterval(() => setPulse(s => s + 1), 1200)
    return () => { clearInterval(t); clearInterval(p) }
  }, [])

  const activeCount = [hasBI, projectCount > 0, agentCount > 0, memoryCount > 0].filter(Boolean).length
  const score = Math.round((activeCount / 4) * 100)

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <svg width={180} height={180} className="overflow-visible">
          {/* Outer ambient ring */}
          <circle cx={cx} cy={cy} r={r + 14} stroke="rgba(212,175,55,0.04)" strokeWidth={1} fill="none" />
          {/* Main ring */}
          <circle cx={cx} cy={cy} r={r} stroke="rgba(212,175,55,0.08)" strokeWidth={1.5} fill="none" />
          {/* Score arc */}
          <motion.circle
            cx={cx} cy={cy} r={r}
            stroke="rgba(212,175,55,0.5)"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * r}
            initial={{ strokeDashoffset: 2 * Math.PI * r }}
            animate={{ strokeDashoffset: 2 * Math.PI * r * (1 - score / 100) }}
            transition={{ duration: 2, ease: "easeOut" }}
            transform={`rotate(-90 ${cx} ${cy})`}
          />

          {/* Connection lines */}
          {RING_SYSTEMS.map((sys, i) => {
            const rad = (sys.angle * Math.PI) / 180
            const nx = cx + r * Math.cos(rad)
            const ny = cy + r * Math.sin(rad)
            const isActive = i < activeCount
            return (
              <motion.line
                key={sys.id}
                x1={cx} y1={cy} x2={nx} y2={ny}
                stroke={isActive ? sys.color : "rgba(255,255,255,0.04)"}
                strokeWidth={isActive ? 0.8 : 0.5}
                strokeDasharray="3 4"
                animate={{ opacity: isActive ? [0.3, 0.7, 0.3] : 0.15 }}
                transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.2 }}
              />
            )
          })}

          {/* System nodes */}
          {RING_SYSTEMS.map((sys, i) => {
            const rad = (sys.angle * Math.PI) / 180
            const nx = cx + r * Math.cos(rad)
            const ny = cy + r * Math.sin(rad)
            const isActive = i < activeCount
            return (
              <g key={sys.id}>
                <motion.circle
                  cx={nx} cy={ny} r={6}
                  fill={isActive ? `${sys.color}18` : "rgba(255,255,255,0.03)"}
                  stroke={isActive ? sys.color : "rgba(255,255,255,0.08)"}
                  strokeWidth={1}
                  animate={isActive ? {
                    filter: [`drop-shadow(0 0 0px ${sys.color})`, `drop-shadow(0 0 5px ${sys.color}80)`, `drop-shadow(0 0 0px ${sys.color})`]
                  } : {}}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                />
                <motion.circle
                  cx={nx} cy={ny} r={2.5}
                  fill={isActive ? sys.color : "rgba(255,255,255,0.1)"}
                  animate={isActive ? { opacity: [0.6, 1, 0.6] } : {}}
                  transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.2 }}
                />
              </g>
            )
          })}

          {/* Center core */}
          <motion.circle
            cx={cx} cy={cy} r={22}
            fill="rgba(212,175,55,0.04)"
            stroke="rgba(212,175,55,0.15)"
            strokeWidth={1}
            animate={{ r: [22, 24, 22] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.circle
            cx={cx} cy={cy} r={14}
            fill="rgba(212,175,55,0.08)"
            stroke="rgba(212,175,55,0.3)"
            strokeWidth={1}
            animate={{
              filter: ["drop-shadow(0 0 2px rgba(212,175,55,0.2))", "drop-shadow(0 0 10px rgba(212,175,55,0.5))", "drop-shadow(0 0 2px rgba(212,175,55,0.2))"]
            }}
            transition={{ duration: 2.5, repeat: Infinity }}
          />
          <text x={cx} y={cy - 3} textAnchor="middle" fill="rgba(212,175,55,0.9)" fontSize="13" fontWeight="900" fontFamily="system-ui">
            {score}
          </text>
          <text x={cx} y={cy + 9} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="6" fontWeight="600" fontFamily="system-ui" letterSpacing="2">
            SCORE
          </text>
        </svg>
      </div>

      <div className="text-center space-y-1">
        <motion.p
          key={coordState}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="text-[10px] text-primary/70 font-medium"
        >
          {COORD_STATES[coordState]}
        </motion.p>
        <p className="text-[9px] text-muted-foreground/30 uppercase tracking-widest">
          {activeCount} of 4 systems active
        </p>
      </div>

      {/* System legend */}
      <div className="grid grid-cols-3 gap-x-4 gap-y-1.5 w-full">
        {RING_SYSTEMS.map((sys, i) => {
          const isActive = i < activeCount
          return (
            <div key={sys.id} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: isActive ? sys.color : "rgba(255,255,255,0.1)" }} />
              <span className="text-[9px] truncate" style={{ color: isActive ? sys.color : "rgba(255,255,255,0.2)" }}>{sys.label}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Project Card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, onOpen, onDelete }: {
  project: Project
  onOpen: (p: Project) => void
  onDelete: (id: string, e: React.MouseEvent) => void
}) {
  const { formatDate } = useFormatters()
  const output = project.output as Record<string, unknown> | null
  const industry = (output?.industry as string) ?? "Business"
  const metrics = output?.metrics as Record<string, number> | null
  const score = metrics
    ? Math.round(((metrics.automationPotential ?? 50) + (metrics.revenueScalability ?? 5) * 10 + (10 - (metrics.marketDifficulty ?? 5)) * 10) / 3)
    : null

  const scoreColor = score === null ? "text-muted-foreground/40" : score >= 65 ? "text-green-400" : score >= 40 ? "text-primary" : "text-orange-400"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={() => onOpen(project)}
      className="group glass-card rounded-2xl p-4 cursor-pointer hover:border-primary/25 transition-all duration-300 hover:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_0_0_1px_rgba(212,175,55,0.08)]"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shrink-0">
          <BarChart3 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex items-center gap-2">
          {project.websiteOutput && (
            <div className="flex items-center gap-1 text-[9px] font-semibold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-full px-2 py-0.5">
              <Globe className="h-2.5 w-2.5" />
              Site
            </div>
          )}
          {score !== null && (
            <span className={`text-sm font-black ${scoreColor}`}>{score}</span>
          )}
          <button
            onClick={(e) => onDelete(project.id, e)}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/15 text-muted-foreground/30 hover:text-red-400 transition-all"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <p className="text-sm font-semibold text-foreground leading-snug truncate mb-1">{project.title}</p>
      <p className="text-[10px] text-muted-foreground/50 truncate mb-3">{project.businessIdea?.slice(0, 70)}</p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-primary/70 bg-primary/8 border border-primary/15 rounded-full px-2 py-0.5">
            {industry}
          </span>
        </div>
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground/30">
          <Clock className="h-2.5 w-2.5" />
          {formatDate(project.updatedAt)}
        </div>
      </div>

      {/* Score bar */}
      {score !== null && (
        <div className="mt-3 h-0.5 rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${score >= 65 ? "bg-green-400" : score >= 40 ? "bg-primary" : "bg-orange-400"}`}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          />
        </div>
      )}
    </motion.div>
  )
}

// ─── Activity Item ─────────────────────────────────────────────────────────────

function ActivityItem({ project, index }: { project: Project; index: number }) {
  const { formatDate } = useFormatters()
  const output = project.output as Record<string, unknown> | null
  const industry = (output?.industry as string) ?? "Business"
  const hasWebsite = !!project.websiteOutput

  const type = hasWebsite ? "website" : "analysis"
  const typeConfig = {
    website: { icon: Globe, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/15", label: "Website generated" },
    analysis: { icon: BarChart3, color: "text-primary", bg: "bg-primary/10 border-primary/15", label: "Analysis complete" },
  }[type]

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="flex items-center gap-3 py-2.5 border-b border-white/4 last:border-0 group cursor-default"
    >
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg border shrink-0 ${typeConfig.bg}`}>
        <typeConfig.icon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/80 font-medium truncate">{project.title}</p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-muted-foreground/40">{typeConfig.label}</span>
          <span className="text-[9px] text-muted-foreground/20">·</span>
          <span className="text-[9px] text-primary/50 font-medium">{industry}</span>
        </div>
      </div>
      <span className="text-[9px] text-muted-foreground/30 shrink-0">{formatDate(project.updatedAt)}</span>
    </motion.div>
  )
}

// ─── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, delay = 0 }: {
  label: string; value: string | number; sub?: string
  icon: typeof BarChart3; color: string; delay?: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass-card rounded-2xl p-4 flex flex-col gap-3"
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl border ${color.replace("text-", "bg-").replace(/text-\S+/, "")} bg-opacity-10`}
        style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.08)" }}>
        <Icon className={`h-4 w-4 ${color}`} />
      </div>
      <div>
        <p className={`text-2xl font-black leading-none ${color}`}>{value}</p>
        {sub && <p className="text-[9px] text-muted-foreground/30 mt-0.5">{sub}</p>}
        <p className="text-[10px] text-muted-foreground/50 font-medium mt-1.5">{label}</p>
      </div>
    </motion.div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [, navigate] = useLocation()
  const go = (path: string) => { onNavigate?.(path); navigate(path) }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center py-20 px-6 text-center"
    >
      {/* Animated glow orb */}
      <div className="relative mb-8">
        <motion.div
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(212,175,55,0.15) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8">
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-10 w-10 text-primary" />
          </motion.div>
        </div>
      </div>

      <h2 className="text-2xl font-black text-foreground mb-2">Your AI Operating System is Ready</h2>
      <p className="text-sm text-muted-foreground/60 max-w-sm mb-10 leading-relaxed">
        Describe your business idea and generate a complete strategic blueprint — industry analysis, growth plans, and a launch-ready website.
      </p>

      <div className="grid gap-3 w-full max-w-sm">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => go("/dashboard?tab=new&_r=" + Date.now())}
          className="flex items-center gap-4 glass-card rounded-2xl p-4 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 border border-primary/20 shrink-0">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Generate Business Intelligence</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Full AI analysis in 30 seconds</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary/50" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => go("/website-generator")}
          className="flex items-center gap-4 glass-card rounded-2xl p-4 hover:border-border/60 transition-all text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 border border-blue-500/15 shrink-0">
            <Globe className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Build AI Website</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">Generate your first intelligent website</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => go("/agents")}
          className="flex items-center gap-4 glass-card rounded-2xl p-4 hover:border-border/60 transition-all text-left"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/15 shrink-0">
            <Bot className="h-5 w-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">Deploy AI Agents</p>
            <p className="text-[11px] text-muted-foreground/50 mt-0.5">12 pre-built agents across 7 categories</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground/30" />
        </motion.button>
      </div>
    </motion.div>
  )
}

// ─── System Health Bar ──────────────────────────────────────────────────────────

function SystemHealth({ projects, agentCount, memoryCount }: {
  projects: Project[]; agentCount: number; memoryCount: number
}) {
  const withWebsite = projects.filter(p => p.websiteOutput).length
  const weeklyProjects = projects.filter(p => Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000).length

  const systems = [
    { label: "Business Intelligence", status: projects.length > 0 ? "active" : "idle", value: projects.length > 0 ? "Active" : "Standby" },
    { label: "Website Architect", status: withWebsite > 0 ? "active" : projects.length > 0 ? "ready" : "idle", value: withWebsite > 0 ? `${withWebsite} sites` : "Ready" },
    { label: "AI Agents", status: agentCount > 0 ? "active" : "idle", value: agentCount > 0 ? `${agentCount} running` : "Offline" },
    { label: "Context Memory", status: memoryCount > 0 ? "active" : "idle", value: memoryCount > 0 ? `${memoryCount} entries` : "Empty" },
    { label: "Copilot", status: "active", value: "Online" },
    { label: "Workflows", status: projects.length > 0 ? "ready" : "idle", value: projects.length > 0 ? "Mapped" : "Standby" },
  ]

  return (
    <div className="space-y-2">
      {systems.map((sys, i) => {
        const STATUS_MAP = {
          active: { dot: "bg-green-400", text: "text-green-400", shadow: "shadow-[0_0_6px_rgba(74,222,128,0.6)]" },
          ready: { dot: "bg-primary", text: "text-primary", shadow: "shadow-[0_0_6px_rgba(212,175,55,0.6)]" },
          idle: { dot: "bg-white/10", text: "text-muted-foreground/30", shadow: "" },
        } as const
        const statusConfig = STATUS_MAP[sys.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.idle

        return (
          <motion.div
            key={sys.label}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className="flex items-center justify-between py-1.5 border-b border-white/3 last:border-0"
          >
            <div className="flex items-center gap-2">
              <div className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot} ${statusConfig.shadow}`} />
              <span className="text-xs text-muted-foreground/60">{sys.label}</span>
            </div>
            <span className={`text-[10px] font-semibold ${statusConfig.text}`}>{sys.value}</span>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Main OS Dashboard ─────────────────────────────────────────────────────────

export function OSDashboard({ onNavigate }: OSDashboardProps) {
  const { user } = useAuth()
  const [, navigate] = useLocation()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [agentCount, setAgentCount] = useState(0)
  const [memoryCount, setMemoryCount] = useState(0)
  const [revenueData, setRevenueData] = useState<{ avgScore: number; totalARR: number } | null>(null)
  const { formatDate, formatNumber } = useFormatters()

  const go = (path: string) => { onNavigate?.(path); navigate(path) }

  useEffect(() => {
    Promise.all([
      api.projects.list().then(({ projects }) => { setProjects(projects) }),
      fetch("/api/agents?installed=true", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (Array.isArray(d.agents)) setAgentCount(d.agents.filter((a: { isActive: boolean }) => a.isActive).length) })
        .catch(() => {}),
      fetch("/api/memory", { credentials: "include" })
        .then(r => r.json())
        .then(d => { if (Array.isArray(d.memories)) setMemoryCount(d.memories.length) })
        .catch(() => {}),
      getRevenueSummary()
        .then(s => { if (s.totalSignals > 0) setRevenueData({ avgScore: s.avgRevenueScore, totalARR: s.totalEstimatedArrUplift }) })
        .catch(() => {}),
    ]).finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.projects.delete(id)
    setProjects(prev => prev.filter(p => p.id !== id))
  }

  const firstName = user?.name?.split(" ")[0] || "there"
  const weeklyCount = projects.filter(p => Date.now() - new Date(p.createdAt).getTime() < 7 * 86400000).length
  const withWebsite = projects.filter(p => p.websiteOutput).length

  if (loading) {
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

  if (projects.length === 0) {
    return <EmptyState onNavigate={go} />
  }

  return (
    <div className="p-6 space-y-6 max-w-screen-2xl mx-auto">

      {/* ── Welcome Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-4 flex-wrap"
      >
        <div>
          <h1 className="text-xl font-black text-foreground tracking-tight">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},{" "}
            <span className="text-gold-gradient">{firstName}</span>
          </h1>
          <p className="text-sm text-muted-foreground/50 mt-0.5">
            {weeklyCount > 0 ? `${weeklyCount} new project${weeklyCount > 1 ? "s" : ""} this week · ` : ""}
            Your AI Operating System is coordinating {projects.length} project{projects.length > 1 ? "s" : ""}
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => go("/dashboard?tab=new&_r=" + Date.now())}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-all shadow-[0_4px_16px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_24px_rgba(212,175,55,0.35)]"
        >
          <Plus className="h-4 w-4" />
          New Analysis
        </motion.button>
      </motion.div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Projects" value={projects.length} sub="all time" icon={BarChart3} color="text-primary" delay={0} />
        <StatCard label="Websites Built" value={withWebsite} sub="AI generated" icon={Globe} color="text-blue-400" delay={0.05} />
        <StatCard label="Active Agents" value={agentCount} sub="running now" icon={Bot} color="text-purple-400" delay={0.1} />
        <StatCard
          label={revenueData ? "Avg Revenue Score" : "Memory Entries"}
          value={revenueData ? `${revenueData.avgScore}` : memoryCount}
          sub={revenueData ? "/ 100" : "stored"}
          icon={revenueData ? TrendingUp : Brain}
          color={revenueData ? "text-green-400" : "text-yellow-400"}
          delay={0.15}
        />
      </div>

      {/* ── Main 3-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ─ Projects (span 2) ─ */}
        <div className="xl:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Active Projects</h2>
            <button
              onClick={() => go("/dashboard?tab=projects")}
              className="flex items-center gap-1 text-[10px] text-primary/60 hover:text-primary transition-colors font-semibold"
            >
              View all <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.slice(0, 4).map((project, i) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={(p) => go(`/projects/${p.id}`)}
                onDelete={handleDelete}
              />
            ))}
          </div>

          {/* Activity Timeline */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/4 border border-white/6">
                <Activity className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
              <h3 className="text-sm font-bold text-foreground">Activity Timeline</h3>
              <div className="ml-auto flex items-center gap-1.5">
                <motion.div
                  className="h-1.5 w-1.5 rounded-full bg-green-400"
                  animate={{ opacity: [0.4, 1, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-[9px] text-green-400/70 font-semibold uppercase tracking-wider">Live</span>
              </div>
            </div>
            <div>
              {projects.slice(0, 6).map((project, i) => (
                <ActivityItem key={project.id} project={project} index={i} />
              ))}
            </div>
          </div>
        </div>

        {/* ─ Right column ─ */}
        <div className="space-y-4">

          {/* Coordination Ring */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/15">
                <Network className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">OS Coordination</h3>
                <p className="text-[9px] text-muted-foreground/40 uppercase tracking-widest">Intelligence sync</p>
              </div>
            </div>
            <CoordinationRing
              projectCount={projects.length}
              agentCount={agentCount}
              memoryCount={memoryCount}
              hasBI={projects.length > 0}
            />
          </div>

          {/* System Health */}
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/4 border border-white/6">
                <Cpu className="h-3.5 w-3.5 text-muted-foreground/60" />
              </div>
              <h3 className="text-sm font-bold text-foreground">System Health</h3>
            </div>
            <SystemHealth projects={projects} agentCount={agentCount} memoryCount={memoryCount} />
          </div>

          {/* Revenue signals */}
          {revenueData && (
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-green-500/10 border border-green-500/15">
                  <DollarSign className="h-3.5 w-3.5 text-green-400" />
                </div>
                <h3 className="text-sm font-bold text-foreground">Revenue Signals</h3>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/60">Avg Revenue Score</span>
                  <span className="text-lg font-black text-green-400">{revenueData.avgScore}<span className="text-xs text-muted-foreground/30 font-normal">/100</span></span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-green-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${revenueData.avgScore}%` }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </div>
                {revenueData.totalARR > 0 && (
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-muted-foreground/60">Est. ARR Uplift</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(revenueData.totalARR)}</span>
                  </div>
                )}
                <button
                  onClick={() => go("/intelligence")}
                  className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl border border-primary/20 bg-primary/6 hover:bg-primary/12 text-xs font-semibold text-primary transition-all"
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  View Full Intelligence
                </button>
              </div>
            </div>
          )}

          {/* Quick actions */}
          <div className="glass-card rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Quick Actions</h3>
            <div className="space-y-2">
              {[
                { label: "Generate Website", icon: Globe, href: "/website-generator", color: "text-blue-400" },
                { label: "Browse AI Agents", icon: Bot, href: "/agents", color: "text-purple-400" },
                { label: "Build Automation", icon: Zap, href: "/automation-builder", color: "text-primary" },
                { label: "OS Command Center", icon: Layers, href: "/os", color: "text-orange-400" },
              ].map(({ label, icon: Icon, href, color }) => (
                <button
                  key={href}
                  onClick={() => go(href)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 hover:border-white/10 hover:bg-white/3 transition-all text-left group"
                >
                  <Icon className={`h-3.5 w-3.5 ${color} shrink-0`} />
                  <span className="text-xs text-muted-foreground/70 group-hover:text-foreground transition-colors">{label}</span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 ml-auto transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
