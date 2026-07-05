import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ExecutionPanel } from "@/components/dashboard/execution-panel"
import {
  Zap, Play, CheckCircle2, XCircle, Clock, RefreshCw, Plus, Trash2,
  RotateCcw, AlertTriangle, Activity, Timer, Cpu, Filter, ArrowRight,
  Brain, Sparkles, Globe, Target, BarChart3, TrendingUp, Layers,
  ChevronRight, Terminal,
} from "lucide-react"

interface Execution {
  id: string
  name: string
  type: string
  status: string
  trigger: string
  priority: number
  durationMs?: number
  errorMessage?: string
  retryCount: number
  maxRetries: number
  logs: { timestamp: string; level: string; message: string }[]
  startedAt?: string
  completedAt?: string
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  queued:    { label: "Queued",    color: "text-yellow-400",   bg: "bg-yellow-500/10 border-yellow-500/20",   dot: "bg-yellow-400" },
  running:   { label: "Running",   color: "text-blue-400",     bg: "bg-blue-500/10 border-blue-500/20",       dot: "bg-blue-400 animate-pulse" },
  success:   { label: "Success",   color: "text-emerald-400",  bg: "bg-emerald-500/10 border-emerald-500/20", dot: "bg-emerald-400" },
  failed:    { label: "Failed",    color: "text-red-400",      bg: "bg-red-500/10 border-red-500/20",         dot: "bg-red-400" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-white/5 border-white/10",         dot: "bg-white/30" },
  retrying:  { label: "Retrying",  color: "text-orange-400",   bg: "bg-orange-500/10 border-orange-500/20",  dot: "bg-orange-400 animate-pulse" },
}

const TYPE_ICONS: Record<string, typeof Zap> = {
  workflow: Zap, agent: Cpu, automation: RefreshCw, scheduled: Timer, event: Activity,
}

const TRIGGER_LABELS: Record<string, string> = {
  manual: "Manual", schedule: "Scheduled", event: "Event", api: "API", agent: "Agent",
}

function formatDuration(ms?: number) {
  if (!ms) return "—"
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}m`
}

// ─── System nodes for impact display ─────────────────────────────────────────

const SYSTEM_NODES = [
  { id: "website", label: "Website Architect", icon: Globe, color: "text-violet-400", bg: "bg-violet-500/10" },
  { id: "bi", label: "Business Intelligence", icon: BarChart3, color: "text-amber-400", bg: "bg-amber-500/10" },
  { id: "agents", label: "AI Agents", icon: Brain, color: "text-blue-400", bg: "bg-blue-500/10" },
  { id: "workflows", label: "Workflows", icon: Layers, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  { id: "analytics", label: "Analytics", icon: TrendingUp, color: "text-pink-400", bg: "bg-pink-500/10" },
  { id: "strategy", label: "Strategy", icon: Target, color: "text-orange-400", bg: "bg-orange-500/10" },
]

function SystemImpactGrid({ activeSystem }: { activeSystem: string | null }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {SYSTEM_NODES.map(node => {
        const Icon = node.icon
        const isActive = activeSystem === node.id || activeSystem === "all"
        return (
          <motion.div
            key={node.id}
            animate={{
              borderColor: isActive ? "rgba(212,175,55,0.3)" : "rgba(255,255,255,0.06)",
              backgroundColor: isActive ? "rgba(212,175,55,0.05)" : "rgba(255,255,255,0.02)",
            }}
            transition={{ duration: 0.4 }}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border"
          >
            <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${isActive ? "bg-primary/15 border border-primary/25" : `${node.bg} border border-white/8`}`}>
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-primary" : node.color}`} />
            </div>
            <p className={`text-[9px] font-semibold text-center leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
              {node.label}
            </p>
            {isActive && (
              <motion.div
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                className="h-1 w-1 rounded-full bg-primary"
              />
            )}
          </motion.div>
        )
      })}
  )
}

// ─── AI Thinking State Banner ─────────────────────────────────────────────────

const AI_STATES = [
  "Executing system optimization...",
  "Updating website architecture...",
  "Synchronizing workflow dependencies...",
  "Applying cross-system changes...",
  "Running conversion analysis...",
  "Generating strategic recommendations...",
]

function AiThinkingBanner({ isActive }: { isActive: boolean }) {
  const [msgIdx, setMsgIdx] = useState(0)

  return (
    <AnimatePresence>
      {isActive && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="overflow-hidden"
          onAnimationComplete={() => {
            if (isActive) {
              setInterval(() => {
                setMsgIdx(i => (i + 1) % AI_STATES.length)
              }, 1800)
            }
          }}
        >
          <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/8 border-b border-primary/15">
            <motion.div
              className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/20 border border-primary/30 shrink-0"
              animate={{ boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 10px rgba(212,175,55,0.5)", "0 0 0px rgba(212,175,55,0)"] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              <Brain className="h-3 w-3 text-primary" />
            </motion.div>
            <motion.p
              key={msgIdx}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-xs font-medium text-primary flex-1"
            >
              {AI_STATES[msgIdx]}
            </motion.p>
            <div className="flex gap-1 shrink-0">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="h-1 w-1 rounded-full bg-primary"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ExecutionEnginePage() {
  const [activeView, setActiveView] = useState<"ai" | "queue">("ai")
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)
  const [filterStatus, setFilterStatus] = useState("all")
  const [showCreate, setShowCreate] = useState(false)
  const [newExec, setNewExec] = useState({ name: "", type: "workflow", trigger: "manual", priority: 3 })
  const [isAiExecuting, setIsAiExecuting] = useState(false)
  const [activeSystem, setActiveSystem] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery<{ executions: Execution[]; stats: Record<string, number> }>({
    queryKey: ["executions"],
    queryFn: () => fetch("/api/executions", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 4000,
  })

  const simulateMutation = useMutation({
    mutationFn: () => fetch("/api/executions/simulate", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["executions"] }),
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof newExec) => fetch("/api/executions", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["executions"] })
      setShowCreate(false)
      setNewExec({ name: "", type: "workflow", trigger: "manual", priority: 3 })
    },
  })

  const retryMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/executions/${id}/retry`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["executions"] }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/executions/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["executions"] }); setSelectedExecution(null) },
  })

  const executions = data?.executions ?? []
  const stats = data?.stats ?? {}
  const filtered = filterStatus === "all" ? executions : executions.filter(e => e.status === filterStatus)

  const TYPES = ["workflow", "agent", "automation", "scheduled", "event"]
  const TRIGGERS = ["manual", "schedule", "event", "api", "agent"]

  return (
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="border-b border-white/5 bg-[#0a0a0a] shrink-0">
          <AiThinkingBanner isActive={isAiExecuting} />
          <div className="px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2.5 mb-1">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                    <Zap className="h-4 w-4 text-primary" />
                  </div>
                  <h1 className="text-lg font-bold text-foreground">AI Execution Engine</h1>
                  <span className="text-[9px] font-black uppercase tracking-widest bg-primary/15 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">LIVE</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Real AI execution across all modules — not just recommendations
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle */}
                <div className="flex bg-secondary/30 rounded-xl p-1 gap-1">
                  <button onClick={() => setActiveView("ai")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeView === "ai" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Brain className="h-3.5 w-3.5" />AI Command
                  </button>
                  <button onClick={() => setActiveView("queue")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeView === "queue" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    <Terminal className="h-3.5 w-3.5" />Queue
                  </button>
                </div>
                <button onClick={() => simulateMutation.mutate()} disabled={simulateMutation.isPending}
                  className="flex items-center gap-2 text-xs font-semibold bg-white/4 border border-white/8 text-muted-foreground rounded-xl px-3 py-1.5 hover:text-foreground hover:border-white/15 transition-colors"
                >
                  <Play className="h-3.5 w-3.5" />
                  {simulateMutation.isPending ? "Simulating…" : "Simulate"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">

            {/* ── AI Command View ── */}
            {activeView === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.2 }}
                className="h-full flex overflow-hidden"
              >
                {/* Left: AI Execution Panel */}
                <div className="flex-1 overflow-y-auto p-6">
                  <ExecutionPanel
                    businessIntelligence={null}
                    websiteData={null}
                    onSectionUpdate={(section, sectionData) => {
                      console.log("Section update:", section, sectionData)
                    }}
                  />
                </div>

                {/* Right: Cross-System Impact Panel */}
                <div className="w-72 shrink-0 border-l border-white/5 flex flex-col overflow-hidden">
                  <div className="px-4 py-3 border-b border-white/5 bg-black/20">
                    <div className="flex items-center gap-2">
                      <Activity className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-foreground">Cross-System Impact</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Real-time system coordination</p>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* System nodes */}
                    <SystemImpactGrid activeSystem={isAiExecuting ? "all" : activeSystem} />

                    {/* Action type legend */}
                    <div className="border border-border/40 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Action Types</p>
                      </div>
                      <div className="p-3 space-y-2">
                        {[
                          { type: "GenerateAction", desc: "Create new content or systems", color: "text-violet-400", dot: "bg-violet-400" },
                          { type: "ModifyAction", desc: "Update and improve existing", color: "text-blue-400", dot: "bg-blue-400" },
                          { type: "AnalyzeAction", desc: "Audit and evaluate performance", color: "text-amber-400", dot: "bg-amber-400" },
                          { type: "RecommendAction", desc: "Strategic advice and planning", color: "text-emerald-400", dot: "bg-emerald-400" },
                        ].map(({ type, desc, color, dot }) => (
                          <div key={type} className="flex items-start gap-2">
                            <div className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0 mt-1.5`} />
                            <div>
                              <p className={`text-[10px] font-semibold ${color}`}>{type}</p>
                              <p className="text-[9px] text-muted-foreground">{desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="border border-border/40 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Queue Stats</p>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2">
                        {[
                          { label: "Running", value: (stats.running as number) ?? 0, color: "text-blue-400" },
                          { label: "Queued", value: (stats.queued as number) ?? 0, color: "text-yellow-400" },
                          { label: "Success", value: (stats.success as number) ?? 0, color: "text-emerald-400" },
                          { label: "Failed", value: (stats.failed as number) ?? 0, color: "text-red-400" },
                        ].map(({ label, value, color }) => (
                          <div key={label} className="text-center p-2 rounded-lg bg-secondary/20">
                            <p className={`text-lg font-bold ${color}`}>{value}</p>
                            <p className="text-[9px] text-muted-foreground">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Example intents */}
                    <div className="border border-border/40 rounded-xl overflow-hidden">
                      <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Example Commands</p>
                      </div>
                      <div className="p-3 space-y-1.5">
                        {[
                          "Optimize my hero section copy",
                          "Analyze our conversion bottlenecks",
                          "Generate new pricing tiers",
                          "Review business strategy gaps",
                          "Improve testimonials section",
                          "Identify growth opportunities",
                        ].map(ex => (
                          <div key={ex} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <ChevronRight className="h-3 w-3 text-primary/50 shrink-0" />
                            <span className="leading-relaxed">{ex}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── Queue View ── */}
            {activeView === "queue" && (
              <motion.div
                key="queue"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
                className={`h-full flex overflow-hidden ${selectedExecution ? "" : ""}`}
              >
                <div className={`flex-1 flex flex-col overflow-hidden ${selectedExecution ? "border-r border-white/5" : ""}`}>
                  {/* Controls */}
                  <div className="shrink-0 px-6 pt-5 pb-3">
                    <div className="grid grid-cols-5 gap-3 mb-4">
                      {[
                        { label: "Total",   value: executions.length,           color: "text-foreground" },
                        { label: "Queued",  value: (stats.queued as number) ?? 0,   color: "text-yellow-400" },
                        { label: "Running", value: (stats.running as number) ?? 0,  color: "text-blue-400" },
                        { label: "Success", value: (stats.success as number) ?? 0,  color: "text-emerald-400" },
                        { label: "Failed",  value: (stats.failed as number) ?? 0,   color: "text-red-400" },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-white/2 border border-white/6 rounded-xl p-3 text-center">
                          <p className={`text-xl font-bold ${color}`}>{value}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                        <div className="flex gap-1">
                          {["all", "queued", "running", "success", "failed"].map(s => (
                            <button key={s} onClick={() => setFilterStatus(s)}
                              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${filterStatus === s ? "bg-primary/15 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => setShowCreate(true)}
                        className="flex items-center gap-2 text-xs font-semibold bg-primary/10 border border-primary/25 text-primary rounded-xl px-3 py-1.5 hover:bg-primary/20 transition-colors">
                        <Plus className="h-3.5 w-3.5" /> New
                      </button>
                    </div>
                  </div>

                  {/* Create form */}
                  <AnimatePresence>
                    {showCreate && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="mx-6 mb-4 bg-white/3 border border-white/10 rounded-2xl p-5 space-y-4 overflow-hidden">
                        <p className="text-sm font-bold text-foreground">New Execution</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <input value={newExec.name} onChange={e => setNewExec(n => ({ ...n, name: e.target.value }))}
                              placeholder="Execution name…"
                              className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40" />
                          </div>
                          <select value={newExec.type} onChange={e => setNewExec(n => ({ ...n, type: e.target.value }))}
                            className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40">
                            {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                          <select value={newExec.trigger} onChange={e => setNewExec(n => ({ ...n, trigger: e.target.value }))}
                            className="bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40">
                            {TRIGGERS.map(t => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => createMutation.mutate(newExec)} disabled={!newExec.name || createMutation.isPending}
                            className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50">
                            {createMutation.isPending ? "Creating…" : "Create"}
                          </button>
                          <button onClick={() => setShowCreate(false)}
                            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Execution list */}
                  <div className="flex-1 overflow-y-auto px-6 pb-6">
                    {isLoading ? (
                      <div className="flex items-center justify-center h-40">
                        <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                      </div>
                    ) : filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                        <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
                        <p className="text-sm font-semibold text-muted-foreground mb-1">No executions yet</p>
                        <p className="text-xs text-muted-foreground/60">Switch to AI Command to execute via AI, or click Simulate</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filtered.map((exec, i) => {
                          const cfg = STATUS_CONFIG[exec.status] ?? STATUS_CONFIG.queued!
                          const TypeIcon = TYPE_ICONS[exec.type] ?? Zap
                          const isSelected = selectedExecution?.id === exec.id
                          return (
                            <motion.div key={exec.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                              onClick={() => setSelectedExecution(isSelected ? null : exec)}
                              className={`flex items-center gap-4 border rounded-xl px-4 py-3 cursor-pointer transition-all ${isSelected ? "bg-white/5 border-white/15" : "bg-white/2 border-white/6 hover:border-white/10 hover:bg-white/3"}`}
                            >
                              <div className={`h-2 w-2 rounded-full shrink-0 ${cfg.dot}`} />
                              <TypeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{exec.name}</p>
                                <p className="text-xs text-muted-foreground">{exec.type} · {TRIGGER_LABELS[exec.trigger] ?? exec.trigger}</p>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <span className={`text-[10px] font-black uppercase tracking-wider border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                                <span className="text-xs text-muted-foreground">{formatDuration(exec.durationMs ?? undefined)}</span>
                                {exec.status === "failed" && exec.retryCount < exec.maxRetries && (
                                  <button onClick={e => { e.stopPropagation(); retryMutation.mutate(exec.id) }}
                                    className="p-1.5 rounded-lg text-orange-400 hover:bg-orange-500/10 transition-colors">
                                    <RotateCcw className="h-3.5 w-3.5" />
                                  </button>
                                )}
                                <button onClick={e => { e.stopPropagation(); deleteMutation.mutate(exec.id) }}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                                <ArrowRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isSelected ? "rotate-90" : ""}`} />
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detail panel */}
                <AnimatePresence>
                  {selectedExecution && (
                    <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                      className="overflow-hidden shrink-0 flex flex-col">
                      <div className="h-full overflow-y-auto p-5">
                        <div className="flex items-center justify-between mb-5">
                          <p className="text-sm font-bold text-foreground truncate pr-2">{selectedExecution.name}</p>
                          <button onClick={() => setSelectedExecution(null)} className="text-muted-foreground hover:text-foreground text-xs shrink-0">✕</button>
                        </div>
                        <div className="space-y-3 mb-5">
                          {[
                            { label: "Status",   value: selectedExecution.status },
                            { label: "Type",     value: selectedExecution.type },
                            { label: "Trigger",  value: TRIGGER_LABELS[selectedExecution.trigger] ?? selectedExecution.trigger },
                            { label: "Priority", value: `P${selectedExecution.priority}` },
                            { label: "Duration", value: formatDuration(selectedExecution.durationMs ?? undefined) },
                            { label: "Retries",  value: `${selectedExecution.retryCount} / ${selectedExecution.maxRetries}` },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{label}</span>
                              <span className="text-xs font-semibold text-foreground capitalize">{value}</span>
                            </div>
                          ))}
                        </div>
                        {selectedExecution.errorMessage && (
                          <div className="flex items-start gap-2 p-3 bg-red-500/8 border border-red-500/20 rounded-xl mb-4">
                            <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-red-400">{selectedExecution.errorMessage}</p>
                          </div>
                        )}
                        {selectedExecution.logs.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-foreground mb-2">Execution Logs</p>
                            <div className="bg-black/40 border border-white/6 rounded-xl p-3 space-y-1.5 font-mono max-h-60 overflow-y-auto">
                              {selectedExecution.logs.map((log, i) => (
                                <div key={i} className="flex gap-2 text-[10px]">
                                  <span className="text-muted-foreground/50 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                  <span className={log.level === "error" ? "text-red-400" : "text-emerald-400/70"}>{log.message}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
