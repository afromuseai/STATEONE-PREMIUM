import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import {
  Brain, Globe, Zap, Bot, Database, BarChart3, Workflow, Rocket,
  Network, Cpu, Sparkles, ArrowRight, CheckCircle2, AlertTriangle,
  RefreshCw, Play, Square, Activity, TrendingUp, Shield, Target,
  ChevronRight, Circle, Layers, FlaskConical, Server,
} from "lucide-react"
import { useOS, type OSModule, type PriorityTask, type OptimizationOpportunity, type ActivityItem } from "@/lib/os-context"
import { ImpactDashboard } from "@/components/dashboard/impact-dashboard"
import { RevenueIntelligencePanel } from "@/components/dashboard/revenue-panel"
import { AutonomousLoopPanel } from "@/components/dashboard/autonomous-panel"
// ─── Simple markdown renderer ─────────────────────────────────────────────────
function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n")
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) return <h2 key={i} className="text-sm font-black text-foreground mt-4 mb-1">{line.slice(3)}</h2>
        if (line.startsWith("### ")) return <h3 key={i} className="text-xs font-bold text-primary mt-3 mb-1">{line.slice(4)}</h3>
        if (line.startsWith("- ") || line.startsWith("• ")) {
          const content = line.slice(2).replace(/\*\*([^*]+)\*\*/g, "$1")
          return <p key={i} className="text-[10px] text-foreground/75 flex gap-2 leading-relaxed"><span className="text-primary/60 shrink-0">·</span>{content}</p>
        }
        if (line.trim() === "") return <div key={i} className="h-1" />
        const rendered = line.replace(/\*\*([^*]+)\*\*/g, "$1")
        return <p key={i} className="text-[10px] text-foreground/70 leading-relaxed">{rendered}</p>
      })}
    </div>
  )
}

// ─── Module icon map ───────────────────────────────────────────────────────────
const MODULE_ICONS: Record<string, React.ElementType> = {
  bi: BarChart3,
  website: Globe,
  agents: Bot,
  memory: Database,
  execution: Zap,
  deployments: Rocket,
}

const CATEGORY_COLORS: Record<string, string> = {
  execution: "text-red-400 bg-red-500/10 border-red-500/20",
  revenue: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  conversion: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  automation: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  cosmetic: "text-purple-400 bg-purple-500/10 border-purple-500/20",
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "CRITICAL",
  2: "HIGH",
  3: "MEDIUM",
  4: "LOW",
  5: "INFO",
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "text-red-400 bg-red-500/10 border-red-500/25",
  2: "text-orange-400 bg-orange-500/10 border-orange-500/25",
  3: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25",
  4: "text-blue-400 bg-blue-500/10 border-blue-500/25",
  5: "text-muted-foreground bg-secondary/20 border-border/25",
}

const IMPACT_COLORS: Record<string, string> = {
  high: "text-green-400",
  medium: "text-yellow-400",
  low: "text-muted-foreground/50",
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  BarChart3, Bot, Zap, Database, Globe, Rocket, Brain,
}

// ─── Coordination Ring ────────────────────────────────────────────────────────
function CoordinationRing({ score, health }: { score: number; health: number }) {
  const r = 52
  const circ = 2 * Math.PI * r
  const scoreOffset = circ - (score / 100) * circ
  const healthOffset = circ - (health / 100) * circ

  return (
    <div className="relative flex items-center justify-center">
      <svg width="140" height="140" className="-rotate-90">
        {/* Background track */}
        <circle cx="70" cy="70" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="10" fill="none" />
        {/* Health ring (outer) */}
        <circle cx="70" cy="70" r={r} stroke="rgba(74,222,128,0.15)" strokeWidth="10" fill="none" />
        <motion.circle
          cx="70" cy="70" r={r}
          stroke="#4ade80"
          strokeWidth="10"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: healthOffset }}
          transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
        />
        {/* Coordination ring (inner) */}
        <circle cx="70" cy="70" r="38" stroke="rgba(212,175,55,0.1)" strokeWidth="8" fill="none" />
        <motion.circle
          cx="70" cy="70" r="38"
          stroke="#d4af37"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 38}
          initial={{ strokeDashoffset: 2 * Math.PI * 38 }}
          animate={{ strokeDashoffset: (2 * Math.PI * 38) - (score / 100) * (2 * Math.PI * 38) }}
          transition={{ duration: 1.6, ease: "easeOut", delay: 0.5 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-black text-foreground leading-none"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.8 }}
        >
          {score}%
        </motion.span>
        <span className="text-[9px] font-bold uppercase tracking-widest text-primary mt-0.5">Coordinated</span>
        <div className="flex items-center gap-1 mt-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-green-400" />
          <span className="text-[8px] text-green-400 font-semibold">{health}% Health</span>
        </div>
      </div>
    </div>
  )
}

// ─── Module Card ──────────────────────────────────────────────────────────────
function ModuleCard({ module, onClick }: { module: OSModule; onClick: () => void }) {
  const Icon = MODULE_ICONS[module.id] ?? Brain
  const statusColors = {
    active: { dot: "bg-green-400", ring: "border-green-500/25 bg-green-500/5", text: "text-green-400", glow: "shadow-[0_0_12px_rgba(74,222,128,0.12)]" },
    ready: { dot: "bg-primary", ring: "border-primary/25 bg-primary/5", text: "text-primary", glow: "shadow-[0_0_10px_rgba(212,175,55,0.1)]" },
    idle: { dot: "bg-border", ring: "border-border/15 bg-secondary/5", text: "text-muted-foreground/40", glow: "" },
  }
  const colors = statusColors[module.status]

  return (
    <motion.div
      whileHover={module.status !== "idle" ? { scale: 1.02, y: -2 } : {}}
      onClick={onClick}
      className={`rounded-xl border p-4 cursor-pointer transition-all duration-300 ${colors.ring} ${colors.glow}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${colors.ring}`}>
          <Icon className={`h-4 w-4 ${colors.text}`} />
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div
            className={`h-2 w-2 rounded-full ${colors.dot}`}
            animate={module.status !== "idle" ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${colors.text}`}>
            {module.status}
          </span>
        </div>
      </div>

      <p className="text-xs font-bold text-foreground mb-1">{module.name}</p>
      <p className="text-[10px] text-muted-foreground/60 mb-3 leading-tight">{module.detail}</p>

      {/* Health bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Health</span>
          <span className={`text-[9px] font-bold ${module.health >= 70 ? "text-green-400" : module.health >= 40 ? "text-yellow-400" : "text-muted-foreground/40"}`}>
            {module.health}%
          </span>
        </div>
        <div className="h-1 w-full rounded-full bg-white/5 overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${module.health >= 70 ? "bg-green-400" : module.health >= 40 ? "bg-primary" : "bg-border"}`}
            initial={{ width: 0 }}
            animate={{ width: `${module.health}%` }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
          />
        </div>
      </div>
    </motion.div>
  )
}

// ─── Priority Task Card ────────────────────────────────────────────────────────
function PriorityCard({ task, onClick }: { task: PriorityTask; onClick: () => void }) {
  const priorityStyle = PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[5]
  const categoryStyle = CATEGORY_COLORS[task.category] ?? ""

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="flex items-center gap-3 rounded-lg border border-border/20 bg-secondary/10 p-3 cursor-pointer hover:border-border/40 hover:bg-secondary/20 transition-all"
    >
      <div className="flex flex-col items-center gap-1 shrink-0">
        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${priorityStyle}`}>
          {PRIORITY_LABELS[task.priority]}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-foreground truncate">{task.title}</p>
        <p className="text-[10px] text-muted-foreground/60 mt-0.5 leading-tight truncate">{task.description}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${categoryStyle}`}>
          {task.category}
        </span>
        <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      </div>
    </motion.div>
  )
}

// ─── Optimization Card ────────────────────────────────────────────────────────
function OptimizationCard({ opt, onClick }: { opt: OptimizationOpportunity; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className="rounded-lg border border-primary/15 bg-primary/5 p-3 cursor-pointer hover:border-primary/30 hover:bg-primary/10 transition-all"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-[9px] font-bold uppercase tracking-wider text-primary">{opt.targetModule}</span>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-2.5 w-2.5 text-green-400" />
          <span className="text-[9px] font-bold text-green-400">{opt.impactScore}% impact</span>
        </div>
      </div>
      <p className="text-[10px] text-orange-400/80 mb-1.5 leading-tight">⚠ {opt.inefficiency}</p>
      <p className="text-xs text-foreground/80 leading-snug">→ {opt.suggestion}</p>
    </motion.div>
  )
}

// ─── Activity Feed Item ────────────────────────────────────────────────────────
function ActivityFeedItem({ item }: { item: ActivityItem }) {
  const Icon = ACTIVITY_ICONS[item.icon] ?? Brain
  const impactStyle = IMPACT_COLORS[item.impact] ?? IMPACT_COLORS.low
  const timeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(mins / 60)
    const days = Math.floor(hrs / 24)
    if (days > 0) return `${days}d ago`
    if (hrs > 0) return `${hrs}h ago`
    if (mins > 0) return `${mins}m ago`
    return "just now"
  }

  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/10 last:border-0">
      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-secondary/30 shrink-0">
        <Icon className={`h-3 w-3 ${impactStyle}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-medium text-foreground/80 truncate">{item.action}</p>
        <p className="text-[9px] text-muted-foreground/40">{item.module}</p>
      </div>
      <span className="text-[9px] text-muted-foreground/40 shrink-0">{timeAgo(item.timestamp)}</span>
    </div>
  )
}

// ─── OS State Ticker ──────────────────────────────────────────────────────────
const TICKER_MESSAGES = [
  "Cross-system intelligence loop active",
  "Memory continuously updating from all modules",
  "Priority queue rebalancing in real-time",
  "Self-optimization engine monitoring system state",
  "Intelligence flowing: BI → Website → Agents → Memory",
  "All modules operating as unified OS",
]

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function OSHubPage() {
  const [, navigate] = useLocation()
  const { state, isLoading, isOptimizing, optimizationReport, refresh, triggerOptimization, stopOptimization } = useOS()
  const [tickerIdx, setTickerIdx] = useState(0)
  const [optimizeTab, setOptimizeTab] = useState<"queue" | "optimize" | "activity" | "impact" | "revenue" | "autonomous">("queue")
  const reportRef = useRef<HTMLDivElement>(null)

  // Ticker
  useEffect(() => {
    const id = setInterval(() => setTickerIdx(i => (i + 1) % TICKER_MESSAGES.length), 3000)
    return () => clearInterval(id)
  }, [])

  // Auto-scroll optimization report
  useEffect(() => {
    if (reportRef.current && isOptimizing) {
      reportRef.current.scrollTop = reportRef.current.scrollHeight
    }
  }, [optimizationReport, isOptimizing])

  const s = state

  return (
    <>
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-white/5 bg-[#080808] px-6 shrink-0">
          <div className="flex items-center gap-3">
            <motion.div
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-primary/30 bg-primary/10"
              animate={{ boxShadow: ["0 0 8px rgba(212,175,55,0.1)", "0 0 18px rgba(212,175,55,0.3)", "0 0 8px rgba(212,175,55,0.1)"] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <Layers className="h-4 w-4 text-primary" />
            </motion.div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">OS Command Center</h1>
              <p className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">Unified Intelligence Layer</p>
            </div>
            {s && (
              <div className="hidden md:flex items-center gap-2 ml-4 rounded-full border border-border/20 bg-secondary/20 px-3 py-1">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
                  <Cpu className="h-2.5 w-2.5 text-primary" />
                </motion.div>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={tickerIdx}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-[9px] text-primary/80 font-medium"
                  >
                    {TICKER_MESSAGES[tickerIdx]}
                  </motion.span>
                </AnimatePresence>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {s && (
              <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider ${
                s.coordinationScore >= 60 ? "border-green-500/20 bg-green-500/10 text-green-400"
                : s.coordinationScore >= 30 ? "border-primary/20 bg-primary/10 text-primary"
                : "border-border/20 bg-secondary/20 text-muted-foreground"
              }`}>
                <motion.div
                  className={`h-1.5 w-1.5 rounded-full ${s.coordinationScore >= 60 ? "bg-green-400" : s.coordinationScore >= 30 ? "bg-primary" : "bg-border"}`}
                  animate={{ scale: [1, 1.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {s.activeModules}/{s.totalModules} Modules Active
              </div>
            )}
            <button
              onClick={() => refresh()}
              className="p-2 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-white/5 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {!s && isLoading ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-3">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                  <Cpu className="h-8 w-8 text-primary mx-auto" />
                </motion.div>
                <p className="text-sm text-muted-foreground">Loading OS state...</p>
              </div>
            </div>
          ) : !s ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-4">
                <Network className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm text-muted-foreground">OS state unavailable</p>
                <button onClick={refresh} className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">
                  Retry
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-6 max-w-[1400px] mx-auto">

              {/* Top row: Coordination ring + Stats */}
              <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6">
                {/* Ring + identity */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-2xl border border-border/30 bg-secondary/10 p-6 flex flex-col items-center gap-4 min-w-[200px]"
                >
                  <CoordinationRing score={s.coordinationScore} health={s.systemHealth} />
                  <div className="text-center">
                    <p className="text-xs font-bold text-foreground">{s.industry ?? "No Analysis"}</p>
                    <p className="text-[9px] text-muted-foreground/50 mt-0.5 uppercase tracking-wider">Active Industry</p>
                  </div>
                  <div className="w-full grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-border/20 bg-secondary/20 p-2 text-center">
                      <p className="text-base font-black text-foreground">{s.stats.projects}</p>
                      <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">Projects</p>
                    </div>
                    <div className="rounded-lg border border-border/20 bg-secondary/20 p-2 text-center">
                      <p className="text-base font-black text-foreground">{s.stats.memoryEntries}</p>
                      <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">Memories</p>
                    </div>
                    <div className="rounded-lg border border-border/20 bg-secondary/20 p-2 text-center">
                      <p className="text-base font-black text-foreground">{s.stats.activeAgents}</p>
                      <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">Agents</p>
                    </div>
                    <div className="rounded-lg border border-border/20 bg-secondary/20 p-2 text-center">
                      <p className="text-base font-black text-foreground">{s.stats.executions}</p>
                      <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">Executions</p>
                    </div>
                  </div>
                </motion.div>

                {/* Module grid */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">System Modules</p>
                    <p className="text-[9px] text-muted-foreground/40">
                      {s.modules.filter(m => m.status === "active").length} active · {s.modules.filter(m => m.status === "ready").length} ready · {s.modules.filter(m => m.status === "idle").length} idle
                    </p>
                  </div>
                  <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                    {s.modules.map((mod, i) => (
                      <motion.div
                        key={mod.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                      >
                        <ModuleCard module={mod} onClick={() => navigate(mod.path)} />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Intelligence flow bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="rounded-xl border border-border/20 bg-secondary/5 p-4"
              >
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Intelligence Flow</p>
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {["Business Intelligence", "Website Architect", "Workflow Builder", "AI Agents", "Execution Engine", "Global Memory"].map((name, i, arr) => {
                    const mod = s.modules[i]
                    const isActive = mod?.status !== "idle"
                    return (
                      <div key={name} className="flex items-center gap-2 shrink-0">
                        <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-bold transition-all duration-500 ${
                          mod?.status === "active" ? "border-green-500/25 bg-green-500/8 text-green-400"
                          : mod?.status === "ready" ? "border-primary/25 bg-primary/8 text-primary"
                          : "border-border/15 bg-secondary/10 text-muted-foreground/30"
                        }`}>
                          <motion.div
                            className={`h-1.5 w-1.5 rounded-full ${
                              mod?.status === "active" ? "bg-green-400"
                              : mod?.status === "ready" ? "bg-primary"
                              : "bg-border/30"
                            }`}
                            animate={isActive ? { scale: [1, 1.4, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          {name}
                        </div>
                        {i < arr.length - 1 && (
                          <motion.div
                            animate={isActive ? { x: [0, 3, 0], opacity: [0.3, 1, 0.3] } : {}}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                          >
                            <ArrowRight className={`h-3 w-3 ${isActive ? "text-primary/50" : "text-border/20"}`} />
                          </motion.div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>

              {/* Bottom row: Priority Queue / Self-Optimize / Activity */}
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_320px] gap-6">

                {/* Tab panel */}
                <div className="xl:col-span-2 rounded-2xl border border-border/30 bg-secondary/10 overflow-hidden">
                  <div className="flex border-b border-border/20 overflow-x-auto">
                    {([
                      { id: "queue", label: "Priority Queue" },
                      { id: "revenue", label: "Revenue" },
                      { id: "autonomous", label: "Auto Loop" },
                      { id: "optimize", label: "Self-Optimize" },
                      { id: "activity", label: "Activity" },
                      { id: "impact", label: "Impact" },
                    ] as const).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setOptimizeTab(tab.id)}
                        className={`shrink-0 px-3 py-3 text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          optimizeTab === tab.id
                            ? "text-primary border-b-2 border-primary bg-primary/5"
                            : "text-muted-foreground/50 hover:text-foreground hover:bg-white/3"
                        }`}
                      >
                        {tab.label}
                        {tab.id === "queue" && s.priorityQueue.length > 0 && (
                          <span className="ml-1.5 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[8px]">{s.priorityQueue.length}</span>
                        )}
                        {tab.id === "revenue" && (
                          <span className="ml-1.5 rounded-full bg-green-500/20 text-green-400 px-1.5 py-0.5 text-[8px]">V2</span>
                        )}
                        {tab.id === "autonomous" && (
                          <span className="ml-1.5 rounded-full bg-orange-500/20 text-orange-400 px-1.5 py-0.5 text-[8px]">V2</span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="p-5">
                    {/* Priority Queue */}
                    {optimizeTab === "queue" && (
                      <div className="space-y-2">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">
                          Intelligence-ranked tasks · sorted by system impact
                        </p>
                        {s.priorityQueue.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <CheckCircle2 className="h-8 w-8 text-green-400/50" />
                            <p className="text-sm text-muted-foreground">All high-priority tasks are complete</p>
                          </div>
                        ) : (
                          s.priorityQueue.map((task, i) => (
                            <motion.div key={task.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                              <PriorityCard task={task} onClick={() => navigate(task.actionPath)} />
                            </motion.div>
                          ))
                        )}
                      </div>
                    )}

                    {/* Self-Optimize */}
                    {optimizeTab === "optimize" && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Self-Optimization Loop</p>
                            <p className="text-[10px] text-muted-foreground/50 mt-0.5">AI analyzes your entire OS state and surfaces improvement opportunities</p>
                          </div>
                          <div className="flex gap-2">
                            {isOptimizing ? (
                              <button
                                onClick={stopOptimization}
                                className="flex items-center gap-1.5 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
                              >
                                <Square className="h-3 w-3" />
                                Stop
                              </button>
                            ) : (
                              <button
                                onClick={triggerOptimization}
                                className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
                              >
                                <Play className="h-3 w-3" />
                                Run Optimization
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Auto-detected opportunities */}
                        {s.optimizations.length > 0 && !optimizationReport && !isOptimizing && (
                          <div className="space-y-2">
                            <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Auto-Detected Opportunities</p>
                            {s.optimizations.map((opt, i) => (
                              <motion.div key={opt.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                                <OptimizationCard opt={opt} onClick={() => navigate(opt.actionPath)} />
                              </motion.div>
                            ))}
                          </div>
                        )}

                        {/* Streaming optimization report */}
                        {(isOptimizing || optimizationReport) && (
                          <div className="rounded-xl border border-primary/15 bg-[#0a0a0a] p-4">
                            {isOptimizing && (
                              <div className="flex items-center gap-2 mb-4">
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
                                  <Cpu className="h-3.5 w-3.5 text-primary" />
                                </motion.div>
                                <span className="text-[10px] font-semibold text-primary">Optimization engine analyzing system state...</span>
                                <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }} className="text-primary text-xs">▊</motion.span>
                              </div>
                            )}
                            <div ref={reportRef} className="max-h-80 overflow-y-auto text-xs leading-relaxed">
                              <SimpleMarkdown text={optimizationReport || ""} />
                            </div>
                          </div>
                        )}

                        {!optimizationReport && !isOptimizing && s.optimizations.length === 0 && (
                          <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <FlaskConical className="h-8 w-8 text-primary/30" />
                            <p className="text-sm text-muted-foreground">Run the optimizer to get AI-powered improvement recommendations</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Activity Feed */}
                    {optimizeTab === "activity" && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Cross-System Activity Log</p>
                        {s.recentActivity.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-10 gap-3">
                            <Activity className="h-8 w-8 text-muted-foreground/20" />
                            <p className="text-sm text-muted-foreground">No activity yet — start by running a business analysis</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-border/10">
                            {s.recentActivity.map((item, i) => (
                              <motion.div key={item.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}>
                                <ActivityFeedItem item={item} />
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Impact Feedback Loop */}
                    {optimizeTab === "impact" && (
                      <div className="max-h-[480px] overflow-y-auto pr-1">
                        <ImpactDashboard />
                      </div>
                    )}

                    {/* Revenue Intelligence */}
                    {optimizeTab === "revenue" && (
                      <div className="max-h-[520px] overflow-y-auto pr-1">
                        <RevenueIntelligencePanel />
                      </div>
                    )}

                    {/* Autonomous Operating Loop */}
                    {optimizeTab === "autonomous" && (
                      <div className="max-h-[520px] overflow-y-auto pr-1">
                        <AutonomousLoopPanel />
                      </div>
                    )}
                  </div>
                </div>

                {/* System memory panel */}
                <motion.div
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-border/30 bg-secondary/10 overflow-hidden flex flex-col"
                >
                  <div className="flex items-center justify-between p-4 border-b border-border/20">
                    <div className="flex items-center gap-2">
                      <Database className="h-3.5 w-3.5 text-primary" />
                      <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">Global Memory</span>
                    </div>
                    <button onClick={() => navigate("/memory")} className="text-[9px] text-primary/60 hover:text-primary transition-colors flex items-center gap-0.5">
                      View all <ChevronRight className="h-2.5 w-2.5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {s.stats.memoryEntries === 0 ? (
                      <div className="flex flex-col items-center justify-center h-32 gap-2">
                        <Database className="h-6 w-6 text-muted-foreground/20" />
                        <p className="text-[10px] text-muted-foreground/50 text-center">Memory builds automatically as you use STAGEONE</p>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="rounded-lg border border-border/20 bg-secondary/20 p-2 text-center">
                            <p className="text-lg font-black text-foreground">{s.stats.memoryEntries}</p>
                            <p className="text-[8px] text-muted-foreground/50 uppercase tracking-wider">Total</p>
                          </div>
                          <div className="rounded-lg border border-green-500/15 bg-green-500/5 p-2 text-center">
                            <p className="text-lg font-black text-green-400">
                              {Math.min(s.stats.memoryEntries, Math.floor(s.stats.memoryEntries * 0.3))}
                            </p>
                            <p className="text-[8px] text-green-400/50 uppercase tracking-wider">High-Pri</p>
                          </div>
                        </div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-2">Memory Health</p>
                        {[
                          { label: "Coverage", value: Math.min(100, s.stats.memoryEntries * 5) },
                          { label: "Coherence", value: Math.min(100, 30 + s.stats.projects * 15) },
                          { label: "Richness", value: Math.min(100, s.stats.memoryEntries * 3) },
                        ].map(({ label, value }) => (
                          <div key={label} className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-[9px] text-muted-foreground/50">{label}</span>
                              <span className="text-[9px] font-semibold text-foreground/60">{value}%</span>
                            </div>
                            <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                              <motion.div
                                className="h-full rounded-full bg-primary/60"
                                initial={{ width: 0 }}
                                animate={{ width: `${value}%` }}
                                transition={{ duration: 1.2, ease: "easeOut", delay: 0.6 }}
                              />
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                  </div>

                  {/* Sync status */}
                  <div className="border-t border-border/20 p-3">
                    <div className="flex items-center gap-2">
                      <motion.div
                        className="h-2 w-2 rounded-full bg-green-400"
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      <span className="text-[9px] text-muted-foreground/50">
                        Synced {s.lastUpdated ? new Date(s.lastUpdated).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--"}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </div>

            </div>
          )}
        </div>
      </div>
    </>
  )
}
