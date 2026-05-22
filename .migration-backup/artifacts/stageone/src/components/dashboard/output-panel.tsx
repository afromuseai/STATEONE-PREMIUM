
import { motion, AnimatePresence } from "framer-motion"
import {
  BarChart3,
  Bot,
  Globe,
  Rocket,
  Workflow,
  FileText,
  Target,
  TrendingUp,
  Zap,
  Gauge,
  Layers,
  Shield,
  Lightbulb,
  Code,
  AlertTriangle,
  Crosshair,
  Sparkles,
} from "lucide-react"

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
  isLoading: boolean
  streamingText?: string
}

function MetricGauge({
  label,
  value,
  max,
  icon: Icon,
  index,
}: {
  label: string
  value: number
  max: number
  icon: typeof TrendingUp
  index: number
}) {
  const percentage = (value / max) * 100
  const color =
    percentage >= 70 ? "bg-green-500" : percentage >= 40 ? "bg-yellow-500" : "bg-red-500"

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="glass-card rounded-lg p-3"
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        <span className="text-sm font-bold text-foreground">
          {value}
          {max === 100 ? "%" : `/${max}`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: index * 0.1 }}
        />
      </div>
    </motion.div>
  )
}

function SectionCard({
  icon: Icon,
  title,
  children,
  index,
  fullWidth = false,
  highlight = false,
}: {
  icon: typeof BarChart3
  title: string
  children: React.ReactNode
  index: number
  fullWidth?: boolean
  highlight?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 + index * 0.08 }}
      className={`glass-card rounded-xl p-5 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.08)] ${fullWidth ? "lg:col-span-2" : ""} ${highlight ? "border-primary/20 bg-primary/5" : ""}`}
    >
      <div className="mb-4 flex items-center gap-3 border-b border-border/50 pb-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${highlight ? "bg-primary/20" : "bg-primary/10"}`}>
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-foreground">
          {title}
        </h3>
      </div>
      {children}
    </motion.div>
  )
}

function InsightItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Lightbulb
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border/30 bg-secondary/20 p-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-primary/10">
        <Icon className="h-3 w-3 text-primary" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </div>
  )
}

function StackSection({
  title,
  items,
}: {
  title: string
  items: string[] | string
}) {
  const itemArray = Array.isArray(items) ? items : [items]
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {itemArray.map((item, i) => (
          <span
            key={i}
            className="rounded-md border border-border/50 bg-secondary/40 px-2 py-1 text-xs text-foreground"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  )
}

function LoadingState({ streamingText }: { streamingText?: string }) {
  const modules = [
    { name: "Analyzing industry patterns", icon: Layers },
    { name: "Mapping target market", icon: Target },
    { name: "Generating strategic insights", icon: Lightbulb },
    { name: "Calculating competitive advantage", icon: Shield },
    { name: "Building growth strategy", icon: Rocket },
    { name: "Designing tech stack", icon: Code },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full flex-col"
    >
      <div className="flex-1">
        <div className="mb-6 text-center">
          <motion.div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10"
            animate={{
              boxShadow: [
                "0 0 20px rgba(212,175,55,0.2)",
                "0 0 40px rgba(212,175,55,0.4)",
                "0 0 20px rgba(212,175,55,0.2)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Sparkles className="h-7 w-7 text-primary" />
          </motion.div>
          <h3 className="text-lg font-semibold text-foreground">
            STAGEONE Intelligence
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Generating industry-specific analysis
          </p>
        </div>

        <div className="space-y-2.5">
          {modules.map((module, i) => (
            <motion.div
              key={module.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/20 px-4 py-3"
            >
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
              >
                <module.icon className="h-4 w-4 text-primary" />
              </motion.div>
              <span className="flex-1 text-sm text-muted-foreground">{module.name}</span>
              <motion.div className="h-1 w-20 overflow-hidden rounded-full bg-secondary">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: "0%" }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 2.5, delay: i * 0.4, ease: "easeInOut" }}
                />
              </motion.div>
            </motion.div>
          ))}
        </div>

        {streamingText && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 rounded-lg border border-border/50 bg-secondary/10 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              Live Analysis
            </p>
            <p className="mt-2 max-h-32 overflow-y-auto font-mono text-xs text-muted-foreground">
              {streamingText.slice(-500)}
              <motion.span
                animate={{ opacity: [1, 0] }}
                transition={{ duration: 0.5, repeat: Infinity }}
                className="inline-block h-3 w-1.5 bg-primary"
              />
            </p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex h-full items-center justify-center"
    >
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border/50 bg-secondary/20">
          <FileText className="h-10 w-10 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">Ready to Analyze</h3>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Enter your business idea to generate AI-powered intelligence with
          industry-specific insights, competitive analysis, and tech recommendations.
        </p>
      </div>
    </motion.div>
  )
}

export function OutputPanel({ data, isLoading, streamingText }: OutputPanelProps) {
  if (isLoading) {
    return <LoadingState streamingText={streamingText} />
  }

  if (!data) {
    return <EmptyState />
  }

  return (
    <div className="h-full overflow-y-auto pr-2">
      <AnimatePresence mode="wait">
        <motion.div
          key="results"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 flex items-center justify-between"
          >
            <div>
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.6)]" />
                <span className="text-xs font-medium uppercase tracking-wider text-green-400">
                  Analysis Complete
                </span>
              </div>
              <h2 className="mt-1 text-xl font-bold text-foreground">
                {data.industry} Intelligence
              </h2>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">
                {data.industry}
              </span>
            </div>
          </motion.div>

          {/* AI Metrics Grid */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-5 grid grid-cols-2 gap-2 lg:grid-cols-5"
          >
            <MetricGauge
              icon={Gauge}
              label="Market Difficulty"
              value={data.metrics.marketDifficulty}
              max={10}
              index={0}
            />
            <MetricGauge
              icon={Zap}
              label="Automation"
              value={data.metrics.automationPotential}
              max={100}
              index={1}
            />
            <MetricGauge
              icon={TrendingUp}
              label="Scalability"
              value={data.metrics.revenueScalability}
              max={10}
              index={2}
            />
            <MetricGauge
              icon={Layers}
              label="Complexity"
              value={data.metrics.operationalComplexity}
              max={10}
              index={3}
            />
            <MetricGauge
              icon={Sparkles}
              label="AI Opportunity"
              value={data.metrics.aiAdoptionOpportunity}
              max={100}
              index={4}
            />
          </motion.div>

          {/* Content Grid */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Business Snapshot */}
            <SectionCard icon={BarChart3} title="Business Snapshot" index={0}>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data.businessSnapshot}
              </p>
            </SectionCard>

            {/* Target Market */}
            <SectionCard icon={Target} title="Target Market" index={1}>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data.targetMarket}
              </p>
            </SectionCard>

            {/* Strategic Insights */}
            <SectionCard
              icon={Lightbulb}
              title="Strategic Insights"
              index={2}
              fullWidth
              highlight
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <InsightItem
                  icon={AlertTriangle}
                  label="Growth Bottleneck"
                  value={data.strategicInsights.growthBottleneck}
                />
                <InsightItem
                  icon={Rocket}
                  label="Fastest Channel"
                  value={data.strategicInsights.fastestChannel}
                />
                <InsightItem
                  icon={Zap}
                  label="Highest Leverage Automation"
                  value={data.strategicInsights.highestLeverageAutomation}
                />
                <InsightItem
                  icon={Shield}
                  label="Operational Risk"
                  value={data.strategicInsights.operationalRisk}
                />
              </div>
            </SectionCard>

            {/* Competitive Advantage */}
            <SectionCard icon={Shield} title="Competitive Advantage" index={3} fullWidth>
              <div className="grid gap-3 sm:grid-cols-3">
                <InsightItem
                  icon={Crosshair}
                  label="Differentiation"
                  value={data.competitiveAdvantage.differentiation}
                />
                <InsightItem
                  icon={Shield}
                  label="Defensibility"
                  value={data.competitiveAdvantage.defensibility}
                />
                <InsightItem
                  icon={TrendingUp}
                  label="Scalability Edge"
                  value={data.competitiveAdvantage.scalabilityEdge}
                />
              </div>
            </SectionCard>

            {/* Growth Plan */}
            <SectionCard icon={Rocket} title="Growth Plan" index={4}>
              <ul className="space-y-2">
                {data.growthPlan.map((item, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className="flex items-start gap-3 text-sm text-muted-foreground"
                  >
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                      {i + 1}
                    </span>
                    <span>{item}</span>
                  </motion.li>
                ))}
              </ul>
            </SectionCard>

            {/* Website Pages */}
            <SectionCard icon={Globe} title="Website Pages" index={5}>
              <ul className="space-y-2">
                {data.websitePages.map((page, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.45 + i * 0.05 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{page}</span>
                  </motion.li>
                ))}
              </ul>
            </SectionCard>

            {/* AI Chatbot Role */}
            <SectionCard icon={Bot} title="AI Chatbot Role" index={6}>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {data.chatbotRole}
              </p>
            </SectionCard>

            {/* Automations */}
            <SectionCard icon={Workflow} title="Automations" index={7}>
              <ul className="space-y-2">
                {data.automations.map((auto, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.55 + i * 0.05 }}
                    className="flex items-center gap-2 rounded-lg border border-border/30 bg-secondary/20 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <Zap className="h-3 w-3 flex-shrink-0 text-primary" />
                    <span>{auto}</span>
                  </motion.li>
                ))}
              </ul>
            </SectionCard>

            {/* Recommended Stack */}
            <SectionCard icon={Code} title="Recommended Stack" index={8} fullWidth>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <StackSection title="Frontend" items={data.recommendedStack.frontend} />
                <StackSection title="Backend" items={data.recommendedStack.backend} />
                <StackSection title="Automation" items={data.recommendedStack.automation} />
                <StackSection title="CRM" items={data.recommendedStack.crm} />
                <StackSection title="Payments" items={data.recommendedStack.payments} />
              </div>
            </SectionCard>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
