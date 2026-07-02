import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import {
  Brain, Globe, Zap, Bot, MessageSquare, Database,
  ArrowRight, CheckCircle2, Circle, AlertTriangle,
  TrendingUp, Cpu, Sparkles, Network, Link2, ChevronDown, ChevronUp,
  BarChart3, Workflow, Shield, Target,
} from "lucide-react"
import type { BusinessIntelligence } from "./output-panel"

// ─── Types ────────────────────────────────────────────────────────────────────
type SystemId = "bi" | "website" | "workflows" | "agents" | "copilot" | "memory"
type SystemStatus = "active" | "ready" | "idle"

interface SystemState {
  id: SystemId
  name: string
  shortName: string
  description: string
  status: SystemStatus
  data?: string
  path?: string
}

interface CrossSystemHubProps {
  businessIntelligence: BusinessIntelligence | null
  websiteGenerated?: boolean
  agentCount?: number
  memoryCount?: number
  projectCount?: number
  onNavigate?: (path: string) => void
}

// ─── Live Coordination Reasoning States ───────────────────────────────────────
const COORDINATION_STATES = [
  "Coordinating workflow intelligence...",
  "Evaluating operational dependencies...",
  "Optimizing conversion systems...",
  "Detecting infrastructure bottlenecks...",
  "Synchronizing agent task queues...",
  "Cross-referencing business model signals...",
  "Mapping automation leverage points...",
  "Calibrating cross-system context...",
  "Analyzing strategic dependency graph...",
  "Identifying system activation gaps...",
]

const INDUSTRY_COORDINATION: Record<string, string[]> = {
  Fintech: [
    "Coordinating compliance signals across systems...",
    "Aligning trust architecture with website structure...",
    "Synchronizing onboarding flow with automation triggers...",
    "Mapping regulatory checkpoints to agent workflows...",
  ],
  SaaS: [
    "Coordinating PLG signals across activation systems...",
    "Aligning trial-to-paid flow with copilot nudges...",
    "Synchronizing churn signals with agent monitors...",
    "Mapping product usage to automation triggers...",
  ],
  Cybersecurity: [
    "Coordinating threat intelligence across modules...",
    "Aligning enterprise trust signals with site architecture...",
    "Synchronizing compliance workflows with agent tasks...",
    "Mapping security posture to automation coverage...",
  ],
  Healthcare: [
    "Coordinating HIPAA compliance across all systems...",
    "Aligning patient journey with workflow triggers...",
    "Synchronizing clinical credibility with site structure...",
    "Mapping patient acquisition to agent automation...",
  ],
}

// ─── System Definitions ────────────────────────────────────────────────────────
const ICON_MAP: Record<SystemId, typeof Brain> = {
  bi: BarChart3,
  website: Globe,
  workflows: Workflow,
  agents: Bot,
  copilot: MessageSquare,
  memory: Database,
}

const COLOR_MAP: Record<SystemStatus, { dot: string; bg: string; border: string; text: string }> = {
  active:  { dot: "bg-green-400",  bg: "bg-green-500/10",  border: "border-green-500/30",  text: "text-green-400" },
  ready:   { dot: "bg-primary",    bg: "bg-primary/10",    border: "border-primary/30",    text: "text-primary" },
  idle:    { dot: "bg-border",     bg: "bg-secondary/20",  border: "border-border/30",     text: "text-muted-foreground/50" },
}

// ─── Intelligence Flow Edge ────────────────────────────────────────────────────
function FlowEdge({ from, to, label, active }: { from: string; to: string; label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-1 min-w-0">
      <motion.div
        className={`h-px flex-1 transition-all duration-700 ${active ? "bg-primary/60" : "bg-border/30"}`}
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        animate={active ? { x: [0, 4, 0], opacity: [0.4, 1, 0.4] } : {}}
        transition={{ duration: 1.5, repeat: Infinity }}
      >
        <ArrowRight className={`h-3 w-3 shrink-0 transition-colors duration-500 ${active ? "text-primary" : "text-border/30"}`} />
      </motion.div>
    </div>
  )
}

// ─── System Node ──────────────────────────────────────────────────────────────
function SystemNode({ system, onClick }: { system: SystemState; onClick?: () => void }) {
  const Icon = ICON_MAP[system.id]
  const colors = COLOR_MAP[system.status]

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`flex flex-col items-center gap-2 cursor-pointer group`}
      onClick={onClick}
    >
      <motion.div
        className={`relative flex h-10 w-10 items-center justify-center rounded-xl border transition-all duration-300 ${colors.bg} ${colors.border} group-hover:scale-105`}
        animate={system.status === "active" ? {
          boxShadow: ["0 0 0px rgba(74,222,128,0)", "0 0 12px rgba(74,222,128,0.3)", "0 0 0px rgba(74,222,128,0)"]
        } : system.status === "ready" ? {
          boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 10px rgba(212,175,55,0.25)", "0 0 0px rgba(212,175,55,0)"]
        } : {}}
        transition={{ duration: 2.5, repeat: Infinity }}
      >
        <Icon className={`h-4.5 w-4.5 transition-colors duration-300 ${system.status === "idle" ? "text-muted-foreground/30" : system.status === "active" ? "text-green-400" : "text-primary"}`} />
        <motion.div
          className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-background ${colors.dot}`}
          animate={system.status !== "idle" ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>
      <span className={`text-[9px] font-semibold text-center leading-tight max-w-[56px] transition-colors duration-300 ${system.status === "idle" ? "text-muted-foreground/30" : system.status === "active" ? "text-green-400" : "text-primary"}`}>
        {system.shortName}
      </span>
    </motion.div>
  )
}

// ─── Coordination Insight Item ────────────────────────────────────────────────
function CoordinationInsight({ icon: Icon, from, to, text, active }: {
  icon: typeof Brain; from: string; to: string; text: string; active: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className={`flex items-start gap-3 rounded-lg border p-3 transition-all duration-500 ${
        active
          ? "border-primary/20 bg-primary/5"
          : "border-border/20 bg-secondary/10 opacity-50"
      }`}
    >
      <div className={`flex h-6 w-6 items-center justify-center rounded shrink-0 ${active ? "bg-primary/15" : "bg-secondary/30"}`}>
        <Icon className={`h-3 w-3 ${active ? "text-primary" : "text-muted-foreground/30"}`} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-primary" : "text-muted-foreground/30"}`}>{from}</span>
          <ArrowRight className={`h-2.5 w-2.5 ${active ? "text-primary/50" : "text-muted-foreground/20"}`} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${active ? "text-muted-foreground/60" : "text-muted-foreground/20"}`}>{to}</span>
        </div>
        <p className={`text-xs leading-snug ${active ? "text-foreground/80" : "text-muted-foreground/30"}`}>{text}</p>
      </div>
      {active && (
        <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0" />
        </motion.div>
      )}
    </motion.div>
  )
}

// ─── Quick Action Button ──────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, description, available, onClick }: {
  icon: typeof Globe; label: string; description: string; available: boolean; onClick: () => void
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={available ? { scale: 1.01 } : {}}
      onClick={available ? onClick : undefined}
      className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all duration-200 ${
        available
          ? "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10 cursor-pointer"
          : "border-border/20 bg-secondary/10 cursor-not-allowed opacity-40"
      }`}
    >
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg shrink-0 ${available ? "bg-primary/15" : "bg-secondary/30"}`}>
        <Icon className={`h-4 w-4 ${available ? "text-primary" : "text-muted-foreground/30"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-xs font-semibold ${available ? "text-foreground" : "text-muted-foreground/40"}`}>{label}</p>
        <p className="text-[10px] text-muted-foreground/50 truncate">{description}</p>
      </div>
      {available && <ArrowRight className="h-3.5 w-3.5 text-primary/50 shrink-0" />}
    </motion.button>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function CrossSystemHub({
  businessIntelligence,
  websiteGenerated = false,
  agentCount = 0,
  memoryCount = 0,
  projectCount = 0,
  onNavigate,
}: CrossSystemHubProps) {
  const [, navigate] = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [coordinationState, setCoordinationState] = useState(COORDINATION_STATES[0])
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const goTo = (path: string) => {
    if (onNavigate) onNavigate(path)
    else navigate(path)
  }

  const industry = businessIntelligence?.industry ?? "default"
  const industryStates = INDUSTRY_COORDINATION[industry] ?? COORDINATION_STATES

  useEffect(() => {
    let idx = 0
    intervalRef.current = setInterval(() => {
      idx = (idx + 1) % industryStates.length
      setCoordinationState(industryStates[idx])
    }, 2200)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [industry])

  const hasBi = !!businessIntelligence
  const hasWebsite = websiteGenerated
  const hasAgents = agentCount > 0
  const hasMemory = memoryCount > 0 || hasBi

  // Build system states
  const systems: SystemState[] = [
    {
      id: "bi",
      name: "Business Intelligence",
      shortName: "Biz Intel",
      description: hasBi ? `${industry} analysis active` : "No analysis yet",
      status: hasBi ? "active" : "idle",
      path: "/business-intelligence",
    },
    {
      id: "website",
      name: "Website Architect",
      shortName: "Website",
      description: hasWebsite ? "Site generated" : hasBi ? "Ready to generate" : "Waiting on BI",
      status: hasWebsite ? "active" : hasBi ? "ready" : "idle",
      path: "/business-intelligence",
    },
    {
      id: "workflows",
      name: "Workflow Builder",
      shortName: "Workflows",
      description: hasBi ? `${businessIntelligence?.automations?.length ?? 0} automations mapped` : "Idle",
      status: hasBi ? "ready" : "idle",
      path: "/automation-builder",
    },
    {
      id: "agents",
      name: "AI Agents",
      shortName: "Agents",
      description: hasAgents ? `${agentCount} agent${agentCount !== 1 ? "s" : ""} active` : hasBi ? "Ready to configure" : "Idle",
      status: hasAgents ? "active" : hasBi ? "ready" : "idle",
      path: "/agents",
    },
    {
      id: "copilot",
      name: "AI Copilot",
      shortName: "Copilot",
      description: hasBi ? "Context-aware mode" : "Standby mode",
      status: hasBi ? "active" : "ready",
      path: "/dashboard",
    },
    {
      id: "memory",
      name: "Context Memory",
      shortName: "Memory",
      description: hasMemory ? `${memoryCount}+ entries stored` : "Empty",
      status: hasMemory ? "active" : "idle",
      path: "/dashboard",
    },
  ]

  // Intelligence flow edges
  const flowEdges = [
    { from: "bi", to: "website", active: hasBi, label: "Business model informs site structure, brand voice, and conversion architecture" },
    { from: "website", to: "workflows", active: hasWebsite, label: "Site events trigger automation workflows (form submit, checkout, signup)" },
    { from: "workflows", to: "agents", active: hasBi, label: "Workflow complexity recommends agent delegation patterns" },
    { from: "bi", to: "copilot", active: hasBi, label: "Analysis grounds Copilot advice in your actual metrics and strategy" },
    { from: "memory", to: "bi", active: hasMemory, label: "Stored context enriches every new generation with cross-session intelligence" },
    { from: "agents", to: "copilot", active: hasAgents, label: "Agent activity data informs Copilot's operational recommendations" },
  ]

  const activeSystemCount = systems.filter(s => s.status === "active").length
  const coordinationScore = Math.round((activeSystemCount / systems.length) * 100)

  if (!hasBi && projectCount === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.5 }}
      className="mt-6 rounded-2xl border border-border/50 bg-secondary/10 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setCollapsed(p => !p)}
        className="w-full flex items-center justify-between p-5 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 shrink-0"
            animate={{ boxShadow: ["0 0 8px rgba(212,175,55,0.1)", "0 0 20px rgba(212,175,55,0.3)", "0 0 8px rgba(212,175,55,0.1)"] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <Network className="h-4.5 w-4.5 text-primary" />
          </motion.div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-foreground">Cross-System Intelligence</h3>
              <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                coordinationScore >= 60 ? "text-green-400 bg-green-500/10 border-green-500/20" :
                coordinationScore >= 30 ? "text-primary bg-primary/10 border-primary/20" :
                "text-muted-foreground bg-secondary/20 border-border/30"
              }`}>
                {coordinationScore}% Coordinated
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground/60 mt-0.5 text-left">
              {activeSystemCount} of {systems.length} systems active · {hasBi ? industry : "No analysis"} mode
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Live reasoning indicator */}
          {hasBi && (
            <div className="hidden sm:flex items-center gap-2 rounded-lg border border-primary/15 bg-primary/5 px-3 py-1.5">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
                <Cpu className="h-2.5 w-2.5 text-primary shrink-0" />
              </motion.div>
              <motion.p key={coordinationState} initial={{ opacity: 0, x: 6 }} animate={{ opacity: 1, x: 0 }}
                className="text-[9px] font-medium text-primary max-w-[180px] truncate">
                {coordinationState}
              </motion.p>
            </div>
          )}
          <div className="text-muted-foreground/50">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </div>
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-5 border-t border-border/30">

              {/* Intelligence Flow — Linear */}
              <div className="pt-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Intelligence Flow</p>
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {[systems[0], null, systems[1], null, systems[2], null, systems[3]].map((sys, i) => {
                    if (sys === null) {
                      const from = [systems[0], systems[1], systems[2]][Math.floor(i / 2)]
                      const to = [systems[1], systems[2], systems[3]][Math.floor(i / 2)]
                      return (
                        <div key={`edge-${i}`} className="flex-1 flex items-center min-w-[24px]">
                          <FlowEdge
                            from={from?.id ?? ""}
                            to={to?.id ?? ""}
                            label=""
                            active={from?.status !== "idle" && to?.status !== "idle"}
                          />
                        </div>
                      )
                    }
                    return <SystemNode key={sys.id} system={sys} onClick={() => sys.path && goTo(sys.path)} />
                  })}
                </div>
                {/* Copilot + Memory row */}
                <div className="mt-3 flex items-center justify-center gap-4">
                  {[systems[4], systems[5]].map(sys => (
                    <SystemNode key={sys.id} system={sys} onClick={() => sys.path && goTo(sys.path)} />
                  ))}
                </div>
                <p className="text-center text-[9px] text-muted-foreground/30 mt-2">
                  Copilot and Memory operate across all systems simultaneously
                </p>
              </div>

              {/* Coordination Insights */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Coordination Insights</p>
                <div className="space-y-2">
                  {flowEdges.map((edge, i) => {
                    const fromSys = systems.find(s => s.id === edge.from)
                    const toSys = systems.find(s => s.id === edge.to)
                    const iconMap: Record<string, typeof Brain> = {
                      bi: BarChart3, website: Globe, workflows: Workflow,
                      agents: Bot, copilot: MessageSquare, memory: Database
                    }
                    const Icon = iconMap[edge.from] ?? Brain
                    return (
                      <CoordinationInsight
                        key={i}
                        icon={Icon}
                        from={fromSys?.shortName ?? edge.from}
                        to={toSys?.shortName ?? edge.to}
                        text={edge.label}
                        active={edge.active}
                      />
                    )
                  })}
                </div>
              </div>

              {/* System-Specific Insights */}
              {businessIntelligence && (
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">System Intelligence</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Globe className="h-3 w-3 text-blue-400" />
                        <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400">Website → Workflows</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {businessIntelligence.automations?.length > 0
                          ? `${businessIntelligence.automations.length} automation triggers mapped from your site structure`
                          : "Generate website to unlock automation trigger mapping"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Bot className="h-3 w-3 text-purple-400" />
                        <p className="text-[9px] font-bold uppercase tracking-wider text-purple-400">Agents → Copilot</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {hasAgents
                          ? `${agentCount} agent${agentCount !== 1 ? "s" : ""} providing operational signals to Copilot`
                          : `${industry} stack needs ${businessIntelligence.metrics.automationPotential >= 60 ? "3-5" : "1-2"} agents`}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Database className="h-3 w-3 text-yellow-400" />
                        <p className="text-[9px] font-bold uppercase tracking-wider text-yellow-400">Memory → BI</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {memoryCount > 0
                          ? `${memoryCount} memory entries enriching every new analysis`
                          : "Memories auto-saved after each generation — building context"}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Zap className="h-3 w-3 text-primary" />
                        <p className="text-[9px] font-bold uppercase tracking-wider text-primary">BI → All Systems</p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {`${industry} model active · ${businessIntelligence.metrics.aiAdoptionOpportunity}% AI opportunity shared across all modules`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 mb-3">Activate Next System</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <QuickAction
                    icon={Globe}
                    label="Generate Website"
                    description="Turn analysis into a live site preview"
                    available={hasBi && !hasWebsite}
                    onClick={() => goTo("/business-intelligence")}
                  />
                  <QuickAction
                    icon={Bot}
                    label="Install AI Agents"
                    description={hasBi ? `Recommended for ${industry}` : "Browse agent catalog"}
                    available={true}
                    onClick={() => goTo("/agents")}
                  />
                  <QuickAction
                    icon={Workflow}
                    label="Build Workflows"
                    description="Automate based on your stack recommendations"
                    available={hasBi}
                    onClick={() => goTo("/automation-builder")}
                  />
                  <QuickAction
                    icon={MessageSquare}
                    label="Open Copilot"
                    description={hasBi ? "Fully context-aware with your analysis" : "Get strategic advice"}
                    available={true}
                    onClick={() => {
                      // Scroll to copilot or trigger copilot open
                      const copilotEl = document.querySelector("[data-copilot]")
                      if (copilotEl) (copilotEl as HTMLElement).click()
                    }}
                  />
                </div>
              </div>

              {/* Coordination Health Bar */}
              <div className="rounded-lg border border-border/30 bg-secondary/10 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-primary" />
                    <p className="text-[9px] font-bold uppercase tracking-wider text-foreground">Coordination Health</p>
                  </div>
                  <span className={`text-[10px] font-bold ${coordinationScore >= 60 ? "text-green-400" : coordinationScore >= 30 ? "text-primary" : "text-muted-foreground"}`}>
                    {coordinationScore}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${coordinationScore >= 60 ? "bg-green-500" : coordinationScore >= 30 ? "bg-primary" : "bg-muted-foreground/30"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${coordinationScore}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-1.5">
                  {coordinationScore >= 60 ? "Systems are well-coordinated — Copilot has full context awareness" :
                   coordinationScore >= 30 ? "Activate website and agents to reach full coordination" :
                   "Generate a business analysis to begin system coordination"}
                </p>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
