import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  TrendingUp, DollarSign, Zap, Target, BarChart3,
  RefreshCw, ArrowUp, Award, ChevronRight, Sparkles,
} from "lucide-react"
import { getRevenueSummary, type RevenueSummary, type RevenueSignal } from "@/lib/intelligence-state"
import { useLocation } from "wouter"

const TIER_COLORS = {
  high: { badge: "border-green-500/30 bg-green-500/10 text-green-400", bar: "bg-green-400", dot: "bg-green-400" },
  medium: { badge: "border-primary/30 bg-primary/10 text-primary", bar: "bg-primary", dot: "bg-primary" },
  low: { badge: "border-border/30 bg-secondary/20 text-muted-foreground/60", bar: "bg-border", dot: "bg-border/60" },
}

const DECISION_COLORS: Record<string, string> = {
  EXECUTE: "border-red-500/30 bg-red-500/10 text-red-400",
  SUGGEST: "border-primary/30 bg-primary/10 text-primary",
  QUEUE: "border-blue-500/30 bg-blue-500/10 text-blue-400",
  IGNORE: "border-border/20 bg-secondary/10 text-muted-foreground/40",
}

const PRIORITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "CRITICAL", color: "text-red-400 border-red-500/25 bg-red-500/10" },
  2: { label: "HIGH", color: "text-orange-400 border-orange-500/25 bg-orange-500/10" },
  3: { label: "MEDIUM", color: "text-yellow-400 border-yellow-500/25 bg-yellow-500/10" },
  4: { label: "LOW", color: "text-blue-400 border-blue-500/25 bg-blue-500/10" },
}

function formatCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n}`
}

function ScoreRing({ score, size = 80 }: { score: number; size?: number }) {
  const r = size * 0.38
  const circ = 2 * Math.PI * r
  const color = score >= 70 ? "#4ade80" : score >= 45 ? "#d4af37" : "#6b7280"
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.04)" strokeWidth={size * 0.1} fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={color}
          strokeWidth={size * 0.1}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ duration: 1.6, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-black text-foreground leading-none">{score}</span>
        <span className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground/40">score</span>
      </div>
    </div>
  )
}

function SignalCard({ signal }: { signal: RevenueSignal }) {
  const [, navigate] = useLocation()
  const tier = TIER_COLORS[signal.tier as keyof typeof TIER_COLORS] ?? TIER_COLORS.low
  const priority = PRIORITY_LABELS[signal.priority] ?? PRIORITY_LABELS[4]
  const decision = DECISION_COLORS[signal.decisionType] ?? DECISION_COLORS.QUEUE

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/20 bg-secondary/10 p-4 hover:border-border/40 hover:bg-secondary/15 transition-all cursor-pointer group"
      onClick={() => navigate("/dashboard")}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{signal.industry}</p>
          {signal.businessSnapshot && (
            <p className="text-[9px] text-muted-foreground/50 mt-0.5 line-clamp-2 leading-relaxed">{signal.businessSnapshot}</p>
          )}
        </div>
        <div className="ml-3 shrink-0">
          <ScoreRing score={signal.overallRevenueScore ?? 0} size={52} />
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap mb-3">
        <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${priority.color}`}>
          {priority.label}
        </span>
        <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${decision}`}>
          {signal.decisionType}
        </span>
        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border ${tier.badge}`}>
          {signal.tier} tier
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "ARR Uplift", value: formatCurrency(signal.estimatedArrUplift ?? 0), icon: DollarSign },
          { label: "Conversion+", value: `+${signal.conversionImpact ?? 0}%`, icon: Target },
          { label: "Auto Savings", value: formatCurrency(signal.automationSavings ?? 0), icon: Zap },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-lg border border-border/15 bg-secondary/20 p-2 text-center">
            <Icon className="h-2.5 w-2.5 text-primary/60 mx-auto mb-1" />
            <p className="text-[10px] font-bold text-foreground">{value}</p>
            <p className="text-[8px] text-muted-foreground/40">{label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

export function RevenueIntelligencePanel() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [, navigate] = useLocation()

  async function load() {
    setIsLoading(true)
    try {
      const data = await getRevenueSummary()
      setSummary(data)
    } catch { }
    setIsLoading(false)
  }

  useEffect(() => { load() }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
          <BarChart3 className="h-6 w-6 text-primary/50" />
        </motion.div>
      </div>
    )
  }

  if (!summary || summary.totalSignals === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 gap-4 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/20 bg-primary/5">
          <TrendingUp className="h-6 w-6 text-primary/50" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">No revenue signals yet</p>
          <p className="text-[10px] text-muted-foreground/50 mt-1 max-w-[240px]">
            Run a business intelligence analysis to automatically score your revenue potential
          </p>
        </div>
        <button
          onClick={() => navigate("/dashboard")}
          className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-4 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          Start Analysis
        </button>
      </div>
    )
  }

  const s = summary

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Revenue Intelligence</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">AI-scored business outcome tracking</p>
        </div>
        <button onClick={load} className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-white/5 transition-colors">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: "Avg Revenue Score", value: `${s.avgRevenueScore}`, sub: "/ 100", icon: BarChart3, color: s.avgRevenueScore >= 70 ? "text-green-400" : "text-primary" },
          { label: "Est. ARR Uplift", value: formatCurrency(s.totalEstimatedArrUplift), sub: "cumulative", icon: DollarSign, color: "text-green-400" },
          { label: "Avg Conversion+", value: `${s.avgConversionImpact}%`, sub: "per project", icon: Target, color: "text-primary" },
          { label: "Auto Savings", value: formatCurrency(s.avgAutomationSavings), sub: "per project", icon: Zap, color: "text-blue-400" },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border/20 bg-secondary/10 p-3"
          >
            <Icon className={`h-3.5 w-3.5 mb-2 ${color}`} />
            <p className={`text-xl font-black leading-none ${color}`}>{value}</p>
            <p className="text-[8px] text-muted-foreground/40 mt-0.5">{sub}</p>
            <p className="text-[9px] font-semibold text-foreground/60 mt-1.5">{label}</p>
          </motion.div>
        ))}
      </div>

      {/* Priority + Decision breakdown */}
      <div className="grid grid-cols-2 gap-4">
        {/* Priority breakdown */}
        <div className="rounded-xl border border-border/20 bg-secondary/10 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Priority Breakdown</p>
          <div className="space-y-2">
            {[
              { label: "Critical", count: s.priorityBreakdown.critical, color: "bg-red-400", textColor: "text-red-400" },
              { label: "High", count: s.priorityBreakdown.high, color: "bg-orange-400", textColor: "text-orange-400" },
              { label: "Medium", count: s.priorityBreakdown.medium, color: "bg-primary", textColor: "text-primary" },
              { label: "Low", count: s.priorityBreakdown.low, color: "bg-blue-400", textColor: "text-blue-400" },
            ].map(({ label, count, color, textColor }) => {
              const pct = s.totalSignals > 0 ? (count / s.totalSignals) * 100 : 0
              return (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between">
                    <span className={`text-[9px] font-semibold ${textColor}`}>{label}</span>
                    <span className="text-[9px] text-muted-foreground/50">{count}</span>
                  </div>
                  <div className="h-1 rounded-full bg-white/5">
                    <motion.div
                      className={`h-full rounded-full ${color}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Decision Engine stats */}
        <div className="rounded-xl border border-border/20 bg-secondary/10 p-4">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Decision Engine</p>
          <div className="space-y-2">
            {[
              { type: "EXECUTE", count: s.executeCount, color: "text-red-400 border-red-500/25 bg-red-500/8" },
              { type: "SUGGEST", count: s.suggestCount, color: "text-primary border-primary/25 bg-primary/8" },
              { type: "QUEUE", count: s.totalSignals - s.executeCount - s.suggestCount > 0 ? s.totalSignals - s.executeCount - s.suggestCount : 0, color: "text-blue-400 border-blue-500/25 bg-blue-500/8" },
            ].map(({ type, count, color }) => (
              <div key={type} className={`flex items-center justify-between rounded-lg border px-3 py-2 ${color}`}>
                <span className="text-[9px] font-black uppercase tracking-wider">{type}</span>
                <span className="text-sm font-black">{count}</span>
              </div>
            ))}
            {s.topIndustry && (
              <div className="mt-2 rounded-lg border border-border/15 bg-secondary/20 px-3 py-2">
                <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider">Top Industry</p>
                <p className="text-xs font-bold text-foreground mt-0.5">{s.topIndustry}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tier distribution */}
      <div className="rounded-xl border border-border/20 bg-secondary/10 p-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Revenue Tier Distribution</p>
        <div className="flex items-center gap-2">
          {[
            { label: "High", count: s.highTierCount, color: "bg-green-400/80" },
            { label: "Medium", count: s.mediumTierCount, color: "bg-primary/80" },
            { label: "Low", count: s.lowTierCount, color: "bg-border/40" },
          ].map(({ label, count, color }) => {
            const pct = s.totalSignals > 0 ? (count / s.totalSignals) * 100 : 0
            return (
              <div key={label} className="flex-1 space-y-1.5">
                <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${color}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-[8px] text-muted-foreground/50">{label}</span>
                  <span className="text-[8px] font-semibold text-foreground/60">{count}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Recent signals */}
      {s.recentSignals.length > 0 && (
        <div className="space-y-2">
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Recent Project Scores</p>
          {s.recentSignals.slice(0, 4).map((signal, i) => (
            <motion.div key={signal.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
              <SignalCard signal={signal} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
