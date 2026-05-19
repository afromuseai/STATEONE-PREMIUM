import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  TrendingUp, TrendingDown, Zap, Target, Brain, Star,
  CheckCircle2, BarChart3, Activity, RefreshCw, ChevronRight,
  ThumbsUp, ArrowUpRight, Gauge,
} from "lucide-react"
import { getImpactSummary, type ImpactSummary } from "@/lib/impact-api"

const MODULE_LABELS: Record<string, string> = {
  business_intelligence: "Business Intelligence",
  website: "Website Generation",
  automation: "Automation Builder",
  chatbot: "Chatbot Generation",
  orchestration: "Orchestration",
}

function StatCard({ label, value, sub, color = "primary", icon: Icon, trend }: {
  label: string
  value: string | number
  sub?: string
  color?: "primary" | "green" | "blue" | "orange"
  icon: React.ElementType
  trend?: "up" | "down" | "neutral"
}) {
  const colors = {
    primary: { border: "border-primary/20", bg: "bg-primary/5", text: "text-primary", icon: "bg-primary/10 border-primary/20" },
    green: { border: "border-green-500/20", bg: "bg-green-500/5", text: "text-green-400", icon: "bg-green-500/10 border-green-500/20" },
    blue: { border: "border-blue-500/20", bg: "bg-blue-500/5", text: "text-blue-400", icon: "bg-blue-500/10 border-blue-500/20" },
    orange: { border: "border-orange-500/20", bg: "bg-orange-500/5", text: "text-orange-400", icon: "bg-orange-500/10 border-orange-500/20" },
  }
  const c = colors[color]

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-xl border ${c.border} ${c.bg} p-4`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${c.icon}`}>
          <Icon className={`h-3.5 w-3.5 ${c.text}`} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[9px] font-bold ${trend === "up" ? "text-green-400" : trend === "down" ? "text-red-400" : "text-muted-foreground/40"}`}>
            {trend === "up" ? <ArrowUpRight className="h-2.5 w-2.5" /> : trend === "down" ? <TrendingDown className="h-2.5 w-2.5" /> : null}
          </div>
        )}
      </div>
      <p className={`text-2xl font-black ${c.text}`}>{value}</p>
      <p className="text-[10px] font-semibold text-foreground/70 mt-0.5">{label}</p>
      {sub && <p className="text-[9px] text-muted-foreground/40 mt-0.5">{sub}</p>}
    </motion.div>
  )
}

function MiniBar({ value, max = 100, color = "primary" }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  const bgMap: Record<string, string> = {
    primary: "bg-primary/70",
    green: "bg-green-400/70",
    blue: "bg-blue-400/70",
    orange: "bg-orange-400/70",
  }
  return (
    <div className="h-1.5 w-full rounded-full bg-white/5 overflow-hidden">
      <motion.div
        className={`h-full rounded-full ${bgMap[color] ?? bgMap.primary}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 1, ease: "easeOut" }}
      />
    </div>
  )
}

function VelocityRing({ value }: { value: number }) {
  const r = 32
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  const color = value >= 60 ? "#4ade80" : value >= 30 ? "#d4af37" : "#6b7280"

  return (
    <div className="relative flex items-center justify-center">
      <svg width="80" height="80" className="-rotate-90">
        <circle cx="40" cy="40" r={r} stroke="rgba(255,255,255,0.04)" strokeWidth="7" fill="none" />
        <motion.circle
          cx="40" cy="40" r={r}
          stroke={color}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.6, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black" style={{ color }}>{value}</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground/40">VEL</span>
      </div>
    </div>
  )
}

export function ImpactDashboard() {
  const [summary, setSummary] = useState<ImpactSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  async function load() {
    setIsLoading(true)
    try {
      const data = await getImpactSummary()
      setSummary(data)
    } catch {
      setSummary(null)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Real Impact Feedback Loop</p>
        </div>
        {[...Array(3)].map((_, i) => (
          <motion.div key={i} animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
            className="h-16 rounded-xl border border-border/15 bg-secondary/10" />
        ))}
      </div>
    )
  }

  if (!summary || summary.totalOutputs === 0) {
    return (
      <div className="rounded-xl border border-border/20 bg-secondary/5 p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Real Impact Feedback Loop</p>
          <button onClick={load} className="text-muted-foreground/40 hover:text-foreground transition-colors">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/20 bg-secondary/20">
            <Brain className="h-5 w-5 text-muted-foreground/30" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold text-foreground/60">No impact data yet</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">Generate a business analysis and rate the output to start the adaptive learning loop</p>
          </div>
        </div>
      </div>
    )
  }

  const effectivenessScore = summary.feedbackCount > 0
    ? Math.round((summary.avgFeedbackRating / 5) * 100)
    : 0

  const topModules = Object.entries(summary.byOutputType)
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => b.avgRating - a.avgRating)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Real Impact Feedback Loop</p>
        <button onClick={load} className="text-muted-foreground/30 hover:text-foreground transition-colors p-1 rounded">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Recommendation Success"
          value={`${summary.recommendationSuccessRate}%`}
          sub={`${summary.acceptedRecommendations}/${summary.totalRecommendations} accepted`}
          color="green"
          icon={CheckCircle2}
          trend={summary.recommendationSuccessRate >= 50 ? "up" : "neutral"}
        />
        <StatCard
          label="Avg Intelligence Rating"
          value={summary.avgFeedbackRating > 0 ? `${summary.avgFeedbackRating}/5` : "—"}
          sub={`${summary.feedbackCount} ratings collected`}
          color="primary"
          icon={Star}
        />
        <StatCard
          label="Implementation Rate"
          value={`${summary.implementationRate}%`}
          sub={`of outputs acted on`}
          color="blue"
          icon={Target}
          trend={summary.implementationRate >= 40 ? "up" : "neutral"}
        />
        <StatCard
          label="Outputs Tracked"
          value={summary.totalOutputs}
          sub="across all modules"
          color="orange"
          icon={BarChart3}
        />
      </div>

      {/* Effective vs Ineffective Intelligence */}
      <div className="rounded-xl border border-border/20 bg-secondary/5 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Effective vs Ineffective Intelligence</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-green-400" />
                <span className="text-[10px] text-foreground/70">Effective</span>
              </div>
              <span className="text-[10px] font-bold text-green-400">{effectivenessScore}%</span>
            </div>
            <MiniBar value={effectivenessScore} color="green" />

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-red-400/60" />
                <span className="text-[10px] text-foreground/70">Needs Improvement</span>
              </div>
              <span className="text-[10px] font-bold text-red-400/70">{100 - effectivenessScore}%</span>
            </div>
            <MiniBar value={100 - effectivenessScore} color="orange" />

            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-blue-400/60" />
                <span className="text-[10px] text-foreground/70">Usefulness Score</span>
              </div>
              <span className="text-[10px] font-bold text-blue-400">{summary.avgUsefulnessScore}/100</span>
            </div>
            <MiniBar value={summary.avgUsefulnessScore} color="blue" />
          </div>
        </div>
      </div>

      {/* System Learning Velocity + High Impact Modules */}
      <div className="grid grid-cols-[auto_1fr] gap-3">
        {/* Learning Velocity */}
        <div className="rounded-xl border border-border/20 bg-secondary/5 p-3 flex flex-col items-center gap-2">
          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 text-center">Learning Velocity</p>
          <VelocityRing value={summary.systemLearningVelocity} />
          <p className="text-[9px] text-muted-foreground/50 text-center leading-tight">
            {summary.systemLearningVelocity >= 60 ? "Adapting fast" : summary.systemLearningVelocity >= 30 ? "Learning" : "Needs data"}
          </p>
        </div>

        {/* High Impact Modules */}
        <div className="rounded-xl border border-border/20 bg-secondary/5 p-3">
          <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 mb-2">High Impact Modules</p>
          {topModules.length === 0 ? (
            <p className="text-[10px] text-muted-foreground/40 mt-2">Rate outputs to surface top modules</p>
          ) : (
            <div className="space-y-2">
              {topModules.slice(0, 4).map(({ type, count, avgRating }, i) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-[9px] font-bold text-muted-foreground/40 w-3">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-semibold text-foreground/80 truncate">{MODULE_LABELS[type] ?? type}</span>
                      <span className="text-[9px] font-bold text-primary ml-1">{avgRating > 0 ? `${avgRating.toFixed(1)}★` : `${count}x`}</span>
                    </div>
                    <MiniBar value={avgRating > 0 ? (avgRating / 5) * 100 : (count / Math.max(...topModules.map(m => m.count))) * 100} color={i === 0 ? "green" : "primary"} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Adaptive Intelligence Status */}
      <div className="rounded-xl border border-primary/15 bg-primary/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain className="h-3.5 w-3.5 text-primary" />
          </motion.div>
          <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Adaptive Intelligence Status</p>
        </div>
        <div className="space-y-1.5">
          {[
            {
              label: "Recommendation Weighting",
              status: summary.feedbackCount >= 5 ? "active" : "learning",
              detail: summary.feedbackCount >= 5 ? "Adjusted from user feedback" : `${summary.feedbackCount}/5 ratings to activate`,
            },
            {
              label: "Implementation Signal Processing",
              status: summary.implementationRate >= 30 ? "active" : "pending",
              detail: summary.implementationRate >= 30 ? "High-action outputs prioritized" : "Needs more implementation data",
            },
            {
              label: "Success Pattern Recognition",
              status: summary.recommendationSuccessRate >= 50 ? "active" : "building",
              detail: summary.recommendationSuccessRate >= 50 ? "Patterns identified and applied" : "Building pattern library",
            },
          ].map(({ label, status, detail }) => (
            <div key={label} className="flex items-start gap-2">
              <div className={`mt-0.5 h-1.5 w-1.5 rounded-full shrink-0 ${status === "active" ? "bg-green-400" : status === "learning" ? "bg-primary" : "bg-muted-foreground/30"}`} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-semibold text-foreground/70">{label}</p>
                <p className="text-[9px] text-muted-foreground/40">{detail}</p>
              </div>
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                status === "active" ? "text-green-400 border-green-500/25 bg-green-500/10"
                : status === "learning" ? "text-primary border-primary/25 bg-primary/10"
                : "text-muted-foreground/40 border-border/20 bg-secondary/10"
              }`}>
                {status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
