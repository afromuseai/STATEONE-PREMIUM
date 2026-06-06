import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart3, Bot, Globe, Rocket, Workflow, FileText, Target, TrendingUp,
  Zap, Gauge, Layers, Shield, Lightbulb, Code, AlertTriangle, Crosshair,
  Sparkles, Brain, CheckCircle2, Circle, Activity, Cpu, BarChart2,
} from "lucide-react"

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect width={18} height={11} x={3} y={11} rx={2} ry={2} />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}
import { IntelligencePanel } from "./intelligence-panel"
import { FeedbackWidget } from "./feedback-widget"
import { useLang } from "@/lib/i18n"

export interface BusinessIntelligence {
  industry: string
  metrics: {
    marketDifficulty: number
    automationPotential: number
    revenueScalability: number
    operationalComplexity: number
    aiAdoptionOpportunity: number
  }
  businessSnapshot: string
  targetMarket: string
  strategicInsights: {
    growthBottleneck: string
    fastestChannel: string
    highestLeverageAutomation: string
    operationalRisk: string
  }
  competitiveAdvantage: {
    differentiation: string
    defensibility: string
    scalabilityEdge: string
  }
  growthPlan: string[]
  websitePages: string[]
  chatbotRole: string
  automations: string[]
  recommendedStack: {
    frontend: string[]
    backend: string[]
    automation: string[]
    crm: string
    payments: string
  }
}

interface OutputPanelProps {
  data: BusinessIntelligence | null
  partialData: Partial<BusinessIntelligence>
  isLoading: boolean
  streamingText?: string
  generationStage: number
  reasoningStages?: string[]
  detectedIndustry?: string
  onGenerateWebsite?: () => void
  onGenerateChatbot?: () => void
  onBuildAutomation?: () => void
  projectId?: string
  userPlan?: string
}

// ─── Industry-Specific Reasoning Messages ─────────────────────────────────────
const INDUSTRY_REASONING: Record<string, string[]> = {
  Fintech: [
    "Mapping regulatory compliance requirements...",
    "Profiling onboarding friction patterns...",
    "Evaluating enterprise credibility signals...",
    "Benchmarking fintech competitive landscape...",
    "Modeling ARR growth trajectory...",
    "Recommending banking-grade infrastructure...",
  ],
  Cybersecurity: [
    "Mapping threat intelligence requirements...",
    "Profiling enterprise trust architecture...",
    "Evaluating SOC2/ISO compliance posture...",
    "Analyzing security competitive positioning...",
    "Detecting operational scalability risks...",
    "Recommending security-first infrastructure...",
  ],
  SaaS: [
    "Analyzing product-led growth signals...",
    "Profiling ICP and market segmentation...",
    "Evaluating PLG vs. sales-led motion...",
    "Benchmarking SaaS competitive moats...",
    "Modeling ARR expansion trajectory...",
    "Recommending dev-grade infrastructure...",
  ],
  Healthcare: [
    "Evaluating HIPAA compliance requirements...",
    "Profiling clinical credibility signals...",
    "Analyzing patient acquisition channels...",
    "Benchmarking telehealth market position...",
    "Modeling patient growth trajectory...",
    "Recommending HIPAA-compliant infrastructure...",
  ],
  Education: [
    "Analyzing learning outcome metrics...",
    "Profiling student acquisition channels...",
    "Evaluating cohort conversion patterns...",
    "Benchmarking EdTech competitive landscape...",
    "Modeling enrollment growth trajectory...",
    "Recommending scalable learning infrastructure...",
  ],
  Marketplace: [
    "Analyzing dual-sided trust dynamics...",
    "Profiling buyer and seller acquisition...",
    "Evaluating supply-demand liquidity...",
    "Benchmarking marketplace competitive moats...",
    "Modeling GMV growth trajectory...",
    "Recommending marketplace infrastructure...",
  ],
  Agency: [
    "Evaluating portfolio positioning signals...",
    "Profiling enterprise client acquisition...",
    "Analyzing service differentiation vectors...",
    "Benchmarking agency market positioning...",
    "Modeling retainer growth trajectory...",
    "Recommending agency operations infrastructure...",
  ],
  "E-commerce": [
    "Analyzing DTC conversion signals...",
    "Profiling customer acquisition channels...",
    "Evaluating AOV and LTV patterns...",
    "Benchmarking e-commerce competitive landscape...",
    "Modeling revenue growth trajectory...",
    "Recommending e-commerce infrastructure...",
  ],
  default: [
    "Profiling industry landscape...",
    "Analyzing business model structure...",
    "Evaluating strategic opportunities...",
    "Benchmarking competitive position...",
    "Mapping growth trajectory...",
    "Recommending infrastructure stack...",
  ],
}

const STAGES = [
  { id: 1, label: "Metrics",    icon: Gauge,    field: "metrics" },
  { id: 2, label: "Snapshot",   icon: BarChart3, field: "businessSnapshot" },
  { id: 3, label: "Strategic",  icon: Lightbulb, field: "strategicInsights" },
  { id: 4, label: "Competitive",icon: Shield,    field: "competitiveAdvantage" },
  { id: 5, label: "Growth",     icon: Rocket,    field: "growthPlan" },
  { id: 6, label: "Infra",      icon: Code,      field: "recommendedStack" },
]

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonLine({ width = "full", height = "3" }: { width?: string; height?: string }) {
  return (
    <motion.div
      className={`h-${height} w-${width} rounded-md bg-secondary/50`}
      animate={{ opacity: [0.4, 0.8, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="glass-card rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3 border-b border-border/50 pb-3">
        <div className="h-8 w-8 rounded-lg bg-secondary/50 animate-pulse" />
        <SkeletonLine width="32" height="3" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonLine key={i} width={i % 2 === 0 ? "full" : "4/5"} height="3" />
        ))}
      </div>
    </div>
  )
}

// ─── Radial Progress ──────────────────────────────────────────────────────────
function RadialProgress({ value, label, index }: { value: number; label: string; index: number }) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const dashoffset = circumference * (1 - value / 100)
  const colorClass = value >= 70 ? "text-green-400" : value >= 45 ? "text-yellow-400" : "text-red-400"

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.09, duration: 0.4, ease: "easeOut" }}
      className="flex flex-col items-center gap-2"
    >
      <div className="relative">
        <svg width="68" height="68" viewBox="0 0 68 68">
          <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="3.5" className="text-secondary/40" />
          <motion.circle
            cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="3.5"
            className={colorClass} strokeDasharray={circumference} strokeLinecap="round"
            transform="rotate(-90 34 34)"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashoffset }}
            transition={{ duration: 1.3, delay: index * 0.09 + 0.2, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={`text-sm font-black ${colorClass}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: index * 0.09 + 0.6 }}
          >{value}</motion.span>
        </div>
      </div>
      <span className="text-[10px] font-semibold text-center text-muted-foreground/70 leading-tight max-w-[64px]">
        {label}
      </span>
    </motion.div>
  )
}

// ─── Business Health Score ─────────────────────────────────────────────────────
function BusinessHealthScore({ metrics }: { metrics: BusinessIntelligence["metrics"] }) {
  const { t } = useLang()
  const ot = t.workspace.output
  const scores = [
    { label: ot.healthMetrics.automationMaturity,  value: metrics.automationPotential,                       index: 0 },
    { label: ot.healthMetrics.aiOpportunity,       value: metrics.aiAdoptionOpportunity,                     index: 1 },
    { label: ot.healthMetrics.scalabilityReadiness,value: Math.round(metrics.revenueScalability * 10),       index: 2 },
    { label: ot.healthMetrics.marketPosition,      value: Math.round((10 - metrics.marketDifficulty) * 10),  index: 3 },
  ]
  const avg = Math.round(scores.reduce((s, x) => s + x.value, 0) / scores.length)
  const healthLabel = avg >= 70 ? ot.strong : avg >= 50 ? ot.moderate : ot.developing
  const healthColor = avg >= 70 ? "text-green-400" : avg >= 50 ? "text-yellow-400" : "text-red-400"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.4 }}
      className="mb-5 glass-card rounded-xl p-5"
    >
      <div className="mb-4 flex items-center justify-between border-b border-border/50 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{ot.businessHealthScore}</h3>
        </div>
        <div className="flex items-center gap-2">
          <div className={`text-2xl font-black ${healthColor}`}>{avg}</div>
          <div>
            <div className={`text-xs font-bold ${healthColor}`}>{healthLabel}</div>
            <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider">{ot.overall}</div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-around">
        {scores.map(s => <RadialProgress key={s.label} value={s.value} label={s.label} index={s.index} />)}
      </div>
    </motion.div>
  )
}

// ─── Growth Trajectory ─────────────────────────────────────────────────────────
function GrowthTrajectory({ phases }: { phases: string[] }) {
  const { t } = useLang()
  const ot = t.workspace.output
  const heights = [14, 26, 42, 62, 84]
  const labels = ["Q1", "Q2", "Q3–4", "Y2", "Y2+"]

  return (
    <div className="mt-4 rounded-lg border border-border/30 bg-secondary/10 p-3">
      <div className="flex items-center gap-2 mb-3">
        <TrendingUp className="h-3 w-3 text-primary" />
        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">{ot.growthTrajectory}</p>
      </div>
      <div className="flex items-end gap-2 h-14">
        {heights.map((h, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1">
            <motion.div
              className="w-full rounded-t"
              style={{ background: `linear-gradient(to top, rgba(212,175,55,0.7), rgba(212,175,55,0.2))`, height: `${h}%` }}
              initial={{ height: 0 }} animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.1 + 0.3, duration: 0.7, ease: "easeOut" }}
            />
            <span className="text-[8px] text-muted-foreground/40 font-medium">{labels[i]}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 text-[9px] text-muted-foreground/40 text-center">
        {phases.length} {ot.growthPhases} · {ot.projectedTrajectory}
      </div>
    </div>
  )
}

// ─── Metric Gauge ──────────────────────────────────────────────────────────────
function MetricGauge({ label, value, max, icon: Icon, index }: {
  label: string; value: number; max: number; icon: typeof TrendingUp; index: number
}) {
  const percentage = (value / max) * 100
  const color = percentage >= 70 ? "bg-green-500" : percentage >= 40 ? "bg-yellow-500" : "bg-red-500"

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.08, duration: 0.4, ease: "easeOut" }}
      className="glass-card rounded-lg p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <motion.span className="text-sm font-bold text-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.08 + 0.3 }}>
          {value}{max === 100 ? "%" : `/${max}`}
        </motion.span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div className={`h-full ${color}`} initial={{ width: 0 }} animate={{ width: `${percentage}%` }}
          transition={{ duration: 1, delay: index * 0.08 + 0.1, ease: "easeOut" }} />
      </div>
    </motion.div>
  )
}

// ─── Section Card ──────────────────────────────────────────────────────────────
function SectionCard({ icon: Icon, title, children, index, fullWidth = false, highlight = false }: {
  icon: typeof BarChart3; title: string; children: React.ReactNode;
  index: number; fullWidth?: boolean; highlight?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: "easeOut" }}
      className={`glass-card rounded-xl p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.08)] ${fullWidth ? "lg:col-span-2" : ""} ${highlight ? "border-primary/20 bg-primary/5" : ""}`}
    >
      <div className="mb-4 flex items-center gap-3 border-b border-border/50 pb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${highlight ? "bg-primary/20" : "bg-primary/10"}`}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</h3>
      </div>
      {children}
    </motion.div>
  )
}

function InsightItem({ icon: Icon, label, value }: { icon: typeof Lightbulb; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/20 p-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary/10">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

function StackSection({ title, items }: { title: string; items: string[] | string }) {
  const itemArray = Array.isArray(items) ? items : [items]
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {itemArray.map((item, i) => (
          <motion.span key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-md border border-border/50 bg-secondary/40 px-2 py-1 text-xs text-foreground">
            {item}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

// ─── Stage Indicator (Industry-Aware) ─────────────────────────────────────────
function StageIndicator({ currentStage, industry, reasoningStages }: {
  currentStage: number; industry?: string; reasoningStages?: string[]
}) {
  const { t } = useLang()
  const ot = t.workspace.output
  const stages = reasoningStages ?? (
    industry
      ? (INDUSTRY_REASONING[industry] ?? INDUSTRY_REASONING.default)
      : INDUSTRY_REASONING.default
  )
  const stageLabels: Record<number, string> = {
    1: ot.stages.metrics,
    2: ot.stages.snapshot,
    3: ot.stages.strategic,
    4: ot.stages.competitive,
    5: ot.stages.growth,
    6: ot.stages.infra,
  }

  const currentReasoning = currentStage > 0 && currentStage <= stages.length
    ? stages[currentStage - 1]
    : stages[0]

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
      className="mb-5 rounded-xl border border-border/50 bg-secondary/10 p-4"
    >
      <div className="mb-3 flex items-center gap-2">
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }} transition={{ duration: 1.5, repeat: Infinity }}>
          <Brain className="h-4 w-4 text-primary" />
        </motion.div>
        <span className="text-xs font-semibold uppercase tracking-wider text-primary">
          STAGEONE Intelligence Engine
        </span>
        {industry && (
          <span className="ml-1 rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">
            {industry}
          </span>
        )}
        <motion.div className="ml-auto flex items-center gap-1">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="h-1.5 w-1.5 rounded-full bg-primary"
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }} />
          ))}
        </motion.div>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STAGES.map(stage => {
          const done = currentStage > stage.id
          const active = currentStage === stage.id
          return (
            <div key={stage.id} className="flex flex-col items-center gap-1.5">
              <motion.div
                className={`flex h-7 w-7 items-center justify-center rounded-full border transition-all duration-500 ${done ? "border-green-500/50 bg-green-500/10" : active ? "border-primary/60 bg-primary/15" : "border-border/30 bg-secondary/20"}`}
                animate={active ? { boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 12px rgba(212,175,55,0.4)", "0 0 0px rgba(212,175,55,0)"] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {done ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  : active ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <Activity className="h-3 w-3 text-primary" />
                    </motion.div>
                  : <Circle className="h-3 w-3 text-border" />}
              </motion.div>
              <span className={`text-center text-[9px] font-medium leading-tight transition-colors duration-300 ${done ? "text-green-400" : active ? "text-primary" : "text-muted-foreground/40"}`}>
                {stageLabels[stage.id] ?? stage.label}
              </span>
            </div>
          )
        })}
      </div>

      {currentStage > 0 && (
        <motion.p key={currentReasoning} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
          className="mt-3 text-xs text-muted-foreground border-t border-border/30 pt-3">
          <span className="text-primary font-medium">{currentReasoning}</span>
          {currentStage > 1 && (
            <span className="ml-2 text-green-400/70">
              · {currentStage - 1} {currentStage - 1 > 1 ? ot.stagesComplete : ot.stageComplete}
            </span>
          )}
        </motion.p>
      )}
    </motion.div>
  )
}

function ThinkingPulse({ text }: { text: string }) {
  const { t } = useLang()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 rounded-lg border border-primary/10 bg-primary/5 p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1, repeat: Infinity }}>
          <Cpu className="h-3 w-3 text-primary" />
        </motion.div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-primary">{t.workspace.output.liveProcessing}</p>
      </div>
      <p className="font-mono text-[10px] leading-relaxed text-muted-foreground max-h-16 overflow-hidden">
        {text.slice(-280)}
        <motion.span animate={{ opacity: [1, 0] }} transition={{ duration: 0.5, repeat: Infinity }}
          className="inline-block h-2.5 w-1 bg-primary ml-0.5 align-middle" />
      </p>
    </motion.div>
  )
}

// ─── Progressive Loading State ─────────────────────────────────────────────────
function ProgressiveLoadingState({ streamingText, generationStage, partialData, reasoningStages }: {
  streamingText?: string; generationStage: number;
  partialData: Partial<BusinessIntelligence>; reasoningStages?: string[]
}) {
  const { t } = useLang()
  const hasMetrics    = !!partialData.metrics
  const hasSnapshot   = !!partialData.businessSnapshot
  const hasInsights   = !!partialData.strategicInsights
  const hasCompetitive = !!partialData.competitiveAdvantage
  const hasGrowth     = Array.isArray(partialData.growthPlan) && partialData.growthPlan.length > 0
  const hasStack      = !!partialData.recommendedStack
  const industry      = partialData.industry

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full">
      <div className="mb-4 flex items-center gap-3">
        <motion.div
          className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/30 bg-primary/10 shrink-0"
          animate={{ boxShadow: ["0 0 15px rgba(212,175,55,0.15)", "0 0 30px rgba(212,175,55,0.35)", "0 0 15px rgba(212,175,55,0.15)"] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="h-5 w-5 text-primary" />
        </motion.div>
        <div>
          <h3 className="text-base font-semibold text-foreground">STAGEONE Intelligence</h3>
          <p className="text-xs text-muted-foreground">
            {industry ? `${t.workspace.output.generatingAnalysis.replace("...", "")} ${industry}...` : t.workspace.output.detectingIndustry}
          </p>
        </div>
      </div>

      <StageIndicator currentStage={generationStage} industry={industry} reasoningStages={reasoningStages} />

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <AnimatePresence>
          {hasMetrics ? (
            <motion.div key="metrics-live" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 mb-4">
                <MetricGauge icon={Gauge} label={t.workspace.output.metrics.marketDifficulty} value={partialData.metrics!.marketDifficulty} max={10} index={0} />
                <MetricGauge icon={Zap} label={t.workspace.output.metrics.automation} value={partialData.metrics!.automationPotential} max={100} index={1} />
                <MetricGauge icon={TrendingUp} label={t.workspace.output.metrics.scalability} value={partialData.metrics!.revenueScalability} max={10} index={2} />
                <MetricGauge icon={Layers} label={t.workspace.output.metrics.complexity} value={partialData.metrics!.operationalComplexity} max={10} index={3} />
                <MetricGauge icon={Sparkles} label={t.workspace.output.metrics.aiOpportunity} value={partialData.metrics!.aiAdoptionOpportunity} max={100} index={4} />
              </div>
              <BusinessHealthScore metrics={partialData.metrics!} />
            </motion.div>
          ) : generationStage >= 1 ? (
            <motion.div key="metrics-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="glass-card rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="h-3.5 w-3.5 rounded bg-secondary/60 animate-pulse" />
                      <SkeletonLine width="16" height="2" />
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div className="h-full bg-primary/30" animate={{ x: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} />
                    </div>
                  </div>
                ))}
              </div>
              <SkeletonCard rows={2} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {hasSnapshot ? (
            <motion.div key="snapshot-live" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 lg:grid-cols-2">
              <SectionCard icon={BarChart3} title={t.workspace.output.sections.businessSnapshot} index={0}>
                <p className="text-sm leading-relaxed text-muted-foreground">{partialData.businessSnapshot}</p>
              </SectionCard>
              {partialData.targetMarket ? (
                <SectionCard icon={Target} title={t.workspace.output.sections.targetMarket} index={1}>
                  <p className="text-sm leading-relaxed text-muted-foreground">{partialData.targetMarket}</p>
                </SectionCard>
              ) : <SkeletonCard rows={2} />}
            </motion.div>
          ) : generationStage >= 2 ? (
            <motion.div key="snapshot-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-4 lg:grid-cols-2">
              <SkeletonCard rows={3} /><SkeletonCard rows={2} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {hasInsights ? (
            <motion.div key="insights-live" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <SectionCard icon={Lightbulb} title={t.workspace.output.sections.strategicInsights} index={0} fullWidth highlight>
                <div className="grid gap-3 sm:grid-cols-2">
                  <InsightItem icon={AlertTriangle} label={t.workspace.output.insights.growthBottleneck} value={partialData.strategicInsights!.growthBottleneck} />
                  <InsightItem icon={Rocket} label={t.workspace.output.insights.fastestChannel} value={partialData.strategicInsights!.fastestChannel} />
                  <InsightItem icon={Zap} label={t.workspace.output.insights.highestLeverageAutomation} value={partialData.strategicInsights!.highestLeverageAutomation} />
                  <InsightItem icon={Shield} label={t.workspace.output.insights.operationalRisk} value={partialData.strategicInsights!.operationalRisk} />
                </div>
              </SectionCard>
            </motion.div>
          ) : generationStage >= 3 ? (
            <motion.div key="insights-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SkeletonCard rows={4} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {hasCompetitive ? (
            <motion.div key="competitive-live" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <SectionCard icon={Shield} title={t.workspace.output.sections.competitiveAdvantage} index={0} fullWidth>
                <div className="grid gap-3 sm:grid-cols-3">
                  <InsightItem icon={Crosshair} label={t.workspace.output.insights.differentiation} value={partialData.competitiveAdvantage!.differentiation} />
                  <InsightItem icon={Shield} label={t.workspace.output.insights.defensibility} value={partialData.competitiveAdvantage!.defensibility} />
                  <InsightItem icon={TrendingUp} label={t.workspace.output.insights.scalabilityEdge} value={partialData.competitiveAdvantage!.scalabilityEdge} />
                </div>
              </SectionCard>
            </motion.div>
          ) : generationStage >= 4 ? (
            <motion.div key="competitive-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SkeletonCard rows={3} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {hasGrowth ? (
            <motion.div key="growth-live" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <SectionCard icon={Rocket} title={t.workspace.output.sections.growthPlan} index={0}>
                <ul className="space-y-2">
                  {partialData.growthPlan!.map((item, i) => (
                    <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                      className="flex items-start gap-3 text-sm text-muted-foreground">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                      <span>{item}</span>
                    </motion.li>
                  ))}
                </ul>
                <GrowthTrajectory phases={partialData.growthPlan!} />
              </SectionCard>
            </motion.div>
          ) : generationStage >= 5 ? (
            <motion.div key="growth-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SkeletonCard rows={5} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {hasStack ? (
            <motion.div key="stack-live" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <SectionCard icon={Code} title={t.workspace.output.sections.infraRecommendations} index={0} fullWidth>
                <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                  <StackSection title={t.workspace.output.stack.frontend} items={partialData.recommendedStack!.frontend} />
                  <StackSection title={t.workspace.output.stack.backend} items={partialData.recommendedStack!.backend} />
                  <StackSection title={t.workspace.output.stack.automation} items={partialData.recommendedStack!.automation} />
                  <StackSection title={t.workspace.output.stack.crm} items={partialData.recommendedStack!.crm} />
                  <StackSection title={t.workspace.output.stack.payments} items={partialData.recommendedStack!.payments} />
                </div>
              </SectionCard>
            </motion.div>
          ) : generationStage >= 6 ? (
            <motion.div key="stack-skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <SkeletonCard rows={3} />
            </motion.div>
          ) : null}
        </AnimatePresence>

        {streamingText && <ThinkingPulse text={streamingText} />}
      </div>
    </motion.div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────
function EmptyState() {
  const { t } = useLang()
  const ot = t.workspace.output
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full items-center justify-center">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border/50 bg-secondary/20">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">{ot.readyToAnalyze ?? "Ready to Analyze"}</h3>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {ot.readyDesc}
        </p>
      </div>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export function OutputPanel({ data, partialData, isLoading, streamingText, generationStage, reasoningStages, detectedIndustry, onGenerateWebsite, onGenerateChatbot, onBuildAutomation, projectId, userPlan }: OutputPanelProps) {
  const { t } = useLang()
  const ot = t.workspace.output
  const isFree = !userPlan || userPlan === "free"
  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto pr-2">
        <ProgressiveLoadingState
          streamingText={streamingText}
          generationStage={generationStage}
          partialData={partialData}
          reasoningStages={reasoningStages}
        />
      </div>
    )
  }

  if (!data) return <EmptyState />

  return (
    <div className="h-full overflow-y-auto pr-2">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-5 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <motion.div
                  className="h-2 w-2 rounded-full bg-green-400"
                  animate={{ boxShadow: ["0 0 4px rgba(74,222,128,0.4)", "0 0 12px rgba(74,222,128,0.8)", "0 0 4px rgba(74,222,128,0.4)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className="text-xs font-medium uppercase tracking-wider text-green-400">{ot.analysisComplete}</span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-foreground">{data.industry} Intelligence</h2>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onGenerateWebsite && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
                  onClick={onGenerateWebsite}
                  className={`flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors ${isFree ? "opacity-70" : ""}`}
                >
                  <Globe className="h-3.5 w-3.5" />
                  {ot.generateWebsite}
                  {isFree && <LockIcon className="h-3 w-3 opacity-70" />}
                </motion.button>
              )}
              {onGenerateChatbot && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}
                  onClick={onGenerateChatbot}
                  className={`flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors ${isFree ? "opacity-70" : ""}`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  {ot.generateChatbot}
                  {isFree && <LockIcon className="h-3 w-3 opacity-70" />}
                </motion.button>
              )}
              {onBuildAutomation && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
                  onClick={onBuildAutomation}
                  className={`flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors ${isFree ? "opacity-70" : ""}`}
                >
                  <Workflow className="h-3.5 w-3.5" />
                  {ot.buildAutomation}
                  {isFree && <LockIcon className="h-3 w-3 opacity-70" />}
                </motion.button>
              )}
              <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-primary">{data.industry}</span>
              </div>
            </div>
          </motion.div>

          {/* Metrics */}
          {data.metrics && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-5">
            <MetricGauge icon={Gauge} label={ot.metrics.marketDifficulty} value={data.metrics.marketDifficulty} max={10} index={0} />
            <MetricGauge icon={Zap} label={ot.metrics.automation} value={data.metrics.automationPotential} max={100} index={1} />
            <MetricGauge icon={TrendingUp} label={ot.metrics.scalability} value={data.metrics.revenueScalability} max={10} index={2} />
            <MetricGauge icon={Layers} label={ot.metrics.complexity} value={data.metrics.operationalComplexity} max={10} index={3} />
            <MetricGauge icon={Sparkles} label={ot.metrics.aiOpportunity} value={data.metrics.aiAdoptionOpportunity} max={100} index={4} />
          </motion.div>
          )}

          {data.metrics && <BusinessHealthScore metrics={data.metrics} />}

          {/* Content Grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard icon={BarChart3} title={ot.sections.businessSnapshot} index={0}>
              <p className="text-sm leading-relaxed text-muted-foreground">{data.businessSnapshot}</p>
            </SectionCard>
            <SectionCard icon={Target} title={ot.sections.targetMarket} index={1}>
              <p className="text-sm leading-relaxed text-muted-foreground">{data.targetMarket}</p>
            </SectionCard>

            {data.strategicInsights && (
            <SectionCard icon={Lightbulb} title={ot.sections.strategicInsights} index={2} fullWidth highlight>
              <div className="grid gap-3 sm:grid-cols-2">
                <InsightItem icon={AlertTriangle} label={ot.insights.growthBottleneck} value={data.strategicInsights.growthBottleneck} />
                <InsightItem icon={Rocket} label={ot.insights.fastestChannel} value={data.strategicInsights.fastestChannel} />
                <InsightItem icon={Zap} label={ot.insights.highestLeverageAutomation} value={data.strategicInsights.highestLeverageAutomation} />
                <InsightItem icon={Shield} label={ot.insights.operationalRisk} value={data.strategicInsights.operationalRisk} />
              </div>
            </SectionCard>
            )}

            {data.competitiveAdvantage && (
            <SectionCard icon={Shield} title={ot.sections.competitiveAdvantage} index={3} fullWidth>
              <div className="grid gap-3 sm:grid-cols-3">
                <InsightItem icon={Crosshair} label={ot.insights.differentiation} value={data.competitiveAdvantage.differentiation} />
                <InsightItem icon={Shield} label={ot.insights.defensibility} value={data.competitiveAdvantage.defensibility} />
                <InsightItem icon={TrendingUp} label={ot.insights.scalabilityEdge} value={data.competitiveAdvantage.scalabilityEdge} />
              </div>
            </SectionCard>
            )}

            {data.growthPlan?.length > 0 && (
            <SectionCard icon={Rocket} title={ot.sections.growthPlan} index={4}>
              <ul className="space-y-2">
                {data.growthPlan.map((item, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.05 }}
                    className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
              <GrowthTrajectory phases={data.growthPlan} />
            </SectionCard>
            )}

            {data.websitePages?.length > 0 && (
            <SectionCard icon={Globe} title={ot.sections.websitePages} index={5}>
              <ul className="space-y-2">
                {data.websitePages.map((page, i) => (
                  <motion.li key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.05 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                    <span>{page}</span>
                  </motion.li>
                ))}
              </ul>
            </SectionCard>
            )}

            {data.chatbotRole && (
            <SectionCard icon={Bot} title={ot.sections.aiChatbotRole} index={6}>
              <p className="text-sm leading-relaxed text-muted-foreground">{data.chatbotRole}</p>
            </SectionCard>
            )}

            {data.automations?.length > 0 && (
            <SectionCard icon={Workflow} title={ot.sections.automations} index={7}>
              <ul className="space-y-2">
                {data.automations.map((auto, i) => (
                  <motion.li key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 + i * 0.05 }}
                    className="flex items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
                    <Zap className="h-3 w-3 flex-shrink-0 text-primary" />
                    <span>{auto}</span>
                  </motion.li>
                ))}
              </ul>
            </SectionCard>
            )}

            {data.recommendedStack && (
            <SectionCard icon={Code} title={ot.sections.infraRecommendations} index={8} fullWidth>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StackSection title={ot.stack.frontend} items={data.recommendedStack.frontend} />
                <StackSection title={ot.stack.backend} items={data.recommendedStack.backend} />
                <StackSection title={ot.stack.automation} items={data.recommendedStack.automation} />
                <StackSection title={ot.stack.crm} items={data.recommendedStack.crm} />
                <StackSection title={ot.stack.payments} items={data.recommendedStack.payments} />
              </div>
            </SectionCard>
            )}
          </div>

          {/* Proactive Intelligence Panel */}
          <IntelligencePanel businessIntelligence={data} userPlan={userPlan} autoRun={userPlan !== "free"} />

          {/* Impact Feedback Loop */}
          {data.metrics && (
          <FeedbackWidget
            outputType="business_intelligence"
            projectId={projectId}
            expectedImpact={data.metrics.aiAdoptionOpportunity >= 70 ? "high" : data.metrics.aiAdoptionOpportunity >= 40 ? "medium" : "low"}
            confidenceScore={Math.round((data.metrics.automationPotential + data.metrics.aiAdoptionOpportunity) / 2)}
            optimizationGoal={data.metrics.revenueScalability >= 7 ? "growth" : data.metrics.automationPotential >= 60 ? "efficiency" : "conversion"}
          />
          )}
        </motion.div>
    </div>
  )
}
