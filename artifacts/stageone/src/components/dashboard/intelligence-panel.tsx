import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain, AlertTriangle, TrendingUp, Globe, Zap, Shield, Target,
  ArrowRight, Cpu, Sparkles, CheckCircle2, BarChart3, RefreshCw,
  MessageSquare, Rocket, Activity,
} from "lucide-react"
import type { BusinessIntelligence } from "./output-panel"

function LockIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

// ─── Types ─────────────────────────────────────────────────────────────────────
export interface ProactiveRecommendation {
  system: "Website" | "Automation" | "Growth" | "Risk" | "Operations" | "Monetization" | "AI Agents"
  priority: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  action: string
}

interface IntelligencePanelProps {
  businessIntelligence: BusinessIntelligence
  userPlan?: string
  autoRun?: boolean
}

// ─── Reasoning States ─────────────────────────────────────────────────────────
const REASONING_SEQUENCE = [
  "Evaluating operational bottlenecks...",
  "Analyzing enterprise conversion patterns...",
  "Optimizing automation structure...",
  "Detecting scalability risks...",
  "Cross-referencing industry trust signals...",
  "Calibrating monetization strategy...",
  "Mapping cross-system dependencies...",
]

const INDUSTRY_REASONING: Record<string, string[]> = {
  Fintech: [
    "Evaluating regulatory compliance gaps...",
    "Analyzing onboarding friction points...",
    "Detecting trust signal deficiencies...",
    "Optimizing enterprise conversion funnel...",
    "Mapping payment infrastructure risks...",
  ],
  Cybersecurity: [
    "Evaluating trust architecture weaknesses...",
    "Analyzing enterprise credibility signals...",
    "Detecting compliance certification gaps...",
    "Optimizing security demo conversion flow...",
    "Mapping threat intelligence positioning...",
  ],
  SaaS: [
    "Evaluating product-led growth bottlenecks...",
    "Analyzing trial-to-paid conversion friction...",
    "Detecting churn risk patterns...",
    "Optimizing pricing anchoring strategy...",
    "Mapping integration ecosystem leverage...",
  ],
  Healthcare: [
    "Evaluating HIPAA compliance coverage...",
    "Analyzing patient acquisition channels...",
    "Detecting clinical credibility gaps...",
    "Optimizing provider onboarding flow...",
    "Mapping regulatory risk exposure...",
  ],
  Education: [
    "Evaluating cohort enrollment friction...",
    "Analyzing student outcome metrics...",
    "Detecting content monetization gaps...",
    "Optimizing learning path conversion...",
    "Mapping alumni network leverage...",
  ],
}

// ─── System Config ─────────────────────────────────────────────────────────────
const SYSTEM_CONFIG: Record<string, { color: string; bg: string; border: string; icon: typeof Globe }> = {
  Website:      { color: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: Globe },
  Automation:   { color: "text-primary",    bg: "bg-primary/10",    border: "border-primary/20",    icon: Zap },
  Growth:       { color: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20",  icon: TrendingUp },
  Risk:         { color: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    icon: AlertTriangle },
  Operations:   { color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", icon: BarChart3 },
  Monetization: { color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/20", icon: Target },
  "AI Agents":  { color: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: MessageSquare },
}

const PRIORITY_CONFIG = {
  critical: { label: "Critical",  color: "text-red-400",    bg: "bg-red-500/15",    border: "border-red-500/30" },
  high:     { label: "High",      color: "text-orange-400", bg: "bg-orange-500/15", border: "border-orange-500/30" },
  medium:   { label: "Medium",    color: "text-yellow-400", bg: "bg-yellow-500/15", border: "border-yellow-500/30" },
  low:      { label: "Low",       color: "text-blue-400",   bg: "bg-blue-500/15",   border: "border-blue-500/30" },
}

// ─── Reasoning State Bar ──────────────────────────────────────────────────────
function ReasoningStateBar({ industry, state }: { industry: string; state: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 mb-4"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <Cpu className="h-3.5 w-3.5 text-primary shrink-0" />
      </motion.div>
      <div className="flex-1 min-w-0">
        <motion.p
          key={state}
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-xs text-primary font-medium truncate"
        >
          {state}
        </motion.p>
      </div>
      <div className="flex gap-1 shrink-0">
        {[0, 1, 2].map(i => (
          <motion.div
            key={i}
            className="h-1 w-1 rounded-full bg-primary"
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
          />
        ))}
      </div>
    </motion.div>
  )
}

// ─── Recommendation Card ───────────────────────────────────────────────────────
function RecommendationCard({ rec, index }: { rec: ProactiveRecommendation; index: number }) {
  const sys = SYSTEM_CONFIG[rec.system] ?? SYSTEM_CONFIG["Operations"]
  const pri = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.medium
  const SysIcon = sys.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      className={`rounded-xl border p-4 transition-all duration-300 hover:shadow-[0_0_20px_rgba(212,175,55,0.06)] ${
        rec.priority === "critical"
          ? "border-red-500/25 bg-red-500/5 hover:border-red-500/40"
          : "border-border/40 bg-secondary/20 hover:border-primary/20"
      }`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${sys.bg} border ${sys.border}`}>
          <SysIcon className={`h-4 w-4 ${sys.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${pri.color} ${pri.bg} ${pri.border}`}>
              {pri.label}
            </span>
            <span className={`text-[9px] font-semibold uppercase tracking-wider ${sys.color}`}>
              {rec.system}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-tight">{rec.title}</p>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground leading-relaxed mb-3">{rec.description}</p>

      {/* Action */}
      <div className="flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
        <ArrowRight className="h-3 w-3 text-primary shrink-0" />
        <p className="text-[11px] font-medium text-primary">{rec.action}</p>
      </div>
    </motion.div>
  )
}

// ─── Main Panel ───────────────────────────────────────────────────────────────
export function IntelligencePanel({ businessIntelligence, userPlan, autoRun }: IntelligencePanelProps) {
  const [recommendations, setRecommendations] = useState<ProactiveRecommendation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [reasoningState, setReasoningState] = useState(REASONING_SEQUENCE[0])
  const [error, setError] = useState<string | null>(null)
  const reasoningInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasFetched = useRef(false)
  const isFree = !userPlan || userPlan === "free"

  const fetchRecommendations = async () => {
    setIsLoading(true)
    setHasLoaded(true)
    setRecommendations([])
    setError(null)

    const industrySequence = INDUSTRY_REASONING[businessIntelligence.industry] ?? REASONING_SEQUENCE
    let reasoningIdx = 0
    setReasoningState(industrySequence[0])

    reasoningInterval.current = setInterval(() => {
      reasoningIdx = (reasoningIdx + 1) % industrySequence.length
      setReasoningState(industrySequence[reasoningIdx])
    }, 1400)

    try {
      const res = await fetch("/api/intelligence/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ businessIntelligence }),
      })

      if (!res.ok) throw new Error("Failed to fetch recommendations")

      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let carry = ""
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = carry + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          if (!data) continue

          try {
            const parsed = JSON.parse(data)
            if (parsed.content) {
              buffer += parsed.content
            }
            if (parsed.done && parsed.recommendations) {
              setRecommendations(parsed.recommendations)
            }
          } catch { /* fragment */ }
        }
      }

      // Try parse buffer if done event wasn't caught
      if (recommendations.length === 0 && buffer) {
        try {
          let clean = buffer.trim()
          if (clean.startsWith("```json")) clean = clean.slice(7)
          else if (clean.startsWith("```")) clean = clean.slice(3)
          if (clean.endsWith("```")) clean = clean.slice(0, -3)
          const parsed = JSON.parse(clean.trim())
          if (Array.isArray(parsed.recommendations)) {
            setRecommendations(parsed.recommendations)
          }
        } catch { /* ignore */ }
      }
    } catch (err) {
      setError("Could not load recommendations. Try refreshing.")
    } finally {
      if (reasoningInterval.current) clearInterval(reasoningInterval.current)
      setIsLoading(false)
    }
  }

  // Auto-run for paid users immediately after mount
  useEffect(() => {
    if (autoRun && !hasFetched.current && !isFree) {
      hasFetched.current = true
      fetchRecommendations()
    }
  }, [autoRun, isFree])

  useEffect(() => {
    return () => {
      if (reasoningInterval.current) clearInterval(reasoningInterval.current)
    }
  }, [])

  const criticalCount = recommendations.filter(r => r.priority === "critical").length
  const highCount = recommendations.filter(r => r.priority === "high").length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="mt-6"
    >
      {/* Panel Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10"
            animate={{ boxShadow: ["0 0 8px rgba(212,175,55,0.1)", "0 0 20px rgba(212,175,55,0.3)", "0 0 8px rgba(212,175,55,0.1)"] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Brain className="h-4.5 w-4.5 text-primary" />
          </motion.div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Proactive Intelligence</h3>
            <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">AI Operational Strategist</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isLoading && recommendations.length > 0 && (
            <div className="flex items-center gap-1.5">
              {criticalCount > 0 && (
                <span className="flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[9px] font-bold text-red-400 uppercase tracking-wider">
                  <AlertTriangle className="h-2.5 w-2.5" />{criticalCount} Critical
                </span>
              )}
              {highCount > 0 && (
                <span className="flex items-center gap-1 rounded-md border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[9px] font-bold text-orange-400 uppercase tracking-wider">
                  {highCount} High
                </span>
              )}
            </div>
          )}
          {!isLoading && hasLoaded && (
            <button
              onClick={() => {
                hasFetched.current = false
                fetchRecommendations()
              }}
              className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/30 px-2.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          )}
          {!isLoading && !hasLoaded && !isFree && (
            <button
              onClick={() => fetchRecommendations()}
              className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary/20 transition-all"
            >
              <Sparkles className="h-3 w-3" /> Generate Insights
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ReasoningStateBar industry={businessIntelligence.industry} state={reasoningState} />
            <div className="space-y-3">
              {[1, 2, 3, 4].map(i => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="h-24 rounded-xl border border-border/30 bg-secondary/10 overflow-hidden"
                >
                  <motion.div
                    className="h-full w-full"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.04), transparent)" }}
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: i * 0.1 }}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {!isLoading && error && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mx-auto mb-2" />
            <p className="text-sm text-red-400">{error}</p>
          </motion.div>
        )}

        {!isLoading && !hasLoaded && isFree && (
          <motion.div key="locked" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-xl border border-border/30 bg-secondary/10 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 mx-auto mb-3">
              <LockIcon className="h-5 w-5 text-primary/60" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">Proactive Intelligence</p>
            <p className="text-xs text-muted-foreground mb-4 max-w-xs mx-auto">
              Auto-generated strategic recommendations are available on the <strong className="text-primary/80">Startup</strong> plan and above.
            </p>
            <a href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
            >
              <Rocket className="h-3.5 w-3.5" /> Upgrade to Startup
            </a>
          </motion.div>
        )}
        {!isLoading && !hasLoaded && !isFree && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/30 bg-secondary/10 p-8 text-center">
            <Brain className="h-7 w-7 text-primary/40 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">AI Operational Insights</p>
            <p className="text-xs text-muted-foreground mb-4">Generate strategic recommendations tailored to your business analysis</p>
            <button
              onClick={() => fetchRecommendations()}
              className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/20 transition-all"
            >
              <Sparkles className="h-3.5 w-3.5" /> Generate Insights
            </button>
          </motion.div>
        )}

        {!isLoading && hasLoaded && !error && recommendations.length === 0 && (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-border/30 bg-secondary/10 p-6 text-center">
            <Sparkles className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No recommendations generated</p>
          </motion.div>
        )}

        {!isLoading && recommendations.length > 0 && (
          <motion.div key="recs" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* Summary bar */}
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/5 px-4 py-2.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
              <p className="text-xs text-green-400 font-medium">
                {recommendations.length} strategic recommendations generated for {businessIntelligence.industry}
              </p>
              <motion.div
                className="ml-auto h-1.5 w-1.5 rounded-full bg-green-400"
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>

            {/* Recommendation cards */}
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <RecommendationCard key={i} rec={rec} index={i} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
