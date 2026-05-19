import { useState, useCallback, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Zap, Brain, Loader2, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  Sparkles, ArrowRight, Clock, RotateCcw, Target, Wand2, BarChart3,
  Globe, TrendingUp, Layers, Play, X,
} from "lucide-react"
import { type BusinessIntelligence } from "./output-panel"
import { type WebsiteOutput } from "@/lib/website-html-generator"

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = "GenerateAction" | "ModifyAction" | "AnalyzeAction" | "RecommendAction"
type ExecStatus = "thinking" | "classifying" | "executing" | "completed" | "failed"

interface ExecutionPlan {
  actionType: ActionType
  targetSystem: string
  targetSection?: string | null
  reasoning: string
  confidence: number
  executionSteps: string[]
  estimatedImpact: string
  requiresConfirmation: boolean
}

type ResultData = { type: string; section?: string; data?: Record<string, unknown>; systemAnalyzed?: string; targetSystem?: string; raw?: string } | null

interface ExecutionRecord {
  id: string
  intent: string
  status: ExecStatus
  plan: ExecutionPlan | null
  content: string
  result: { data: ResultData; systemsUpdated: string[] } | null
  duration: number | null
  startedAt: Date
  thinkingStep: string
  executingStep: string
}

interface ExecutionPanelProps {
  businessIntelligence: BusinessIntelligence | null
  websiteData: WebsiteOutput | null
  onSectionUpdate?: (section: string, data: unknown) => void
  compact?: boolean
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<ActionType, { label: string; color: string; bg: string; border: string; icon: typeof Zap }> = {
  GenerateAction:  { label: "Generate",  color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20",  icon: Sparkles },
  ModifyAction:    { label: "Modify",    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    icon: Wand2 },
  AnalyzeAction:   { label: "Analyze",   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20",   icon: BarChart3 },
  RecommendAction: { label: "Recommend", color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", icon: TrendingUp },
}

const SYSTEM_ICONS: Record<string, typeof Zap> = {
  Website: Globe, BusinessIntelligence: BarChart3, Strategy: Brain,
  Pricing: Target, Copy: Wand2, Workflows: Layers, Agents: Zap,
}

const QUICK_ACTIONS = [
  { label: "Optimize hero copy", icon: Wand2 },
  { label: "Analyze conversion rate", icon: BarChart3 },
  { label: "Improve pricing tiers", icon: Target },
  { label: "Review website strategy", icon: Brain },
  { label: "Identify growth bottlenecks", icon: TrendingUp },
  { label: "Generate testimonials", icon: Sparkles },
]

const THINKING_MESSAGES = [
  "Understanding your intent...",
  "Analyzing system context...",
  "Mapping to execution taxonomy...",
  "Planning action sequence...",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ActionBadge({ type }: { type: ActionType }) {
  const cfg = ACTION_CONFIG[type]
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      <Icon className="h-2.5 w-2.5" />{cfg.label}
    </span>
  )
}

function SystemBadge({ system }: { system: string }) {
  const Icon = SYSTEM_ICONS[system] ?? Zap
  return (
    <span className="inline-flex items-center gap-1 text-[9px] text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">
      <Icon className="h-2 w-2" />{system}
    </span>
  )
}

function MarkdownContent({ content }: { content: string }) {
  const formatted = content
    .replace(/^## (.+)$/gm, '<p class="text-xs font-bold text-foreground mt-3 mb-1.5">$1</p>')
    .replace(/^### (.+)$/gm, '<p class="text-[11px] font-semibold text-foreground/90 mt-2 mb-1">$1</p>')
    .replace(/^\*\*(.+)\*\*$/gm, '<p class="text-xs font-semibold text-foreground">$1</p>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    .replace(/^- (.+)$/gm, '<div class="flex items-start gap-1.5 py-0.5"><div class="h-1 w-1 rounded-full bg-primary shrink-0 mt-1.5"></div><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="flex items-start gap-1.5 py-0.5"><div class="h-4 w-4 rounded bg-primary/10 text-primary text-[8px] flex items-center justify-center shrink-0 font-bold">•</div><span>$1</span></div>')
    .replace(/\n\n/g, '<div class="h-2"></div>')
    .replace(/\n/g, '<br/>')

  return (
    <div
      className="text-xs text-muted-foreground leading-relaxed space-y-0.5"
      dangerouslySetInnerHTML={{ __html: formatted }}
    />
  )
}

// ─── Execution Record Card ────────────────────────────────────────────────────

function ExecutionCard({
  exec, isActive, onSectionUpdate,
}: {
  exec: ExecutionRecord
  isActive: boolean
  onSectionUpdate?: (section: string, data: unknown) => void
}) {
  const [expanded, setExpanded] = useState(isActive)
  useEffect(() => { if (isActive) setExpanded(true) }, [isActive])

  const isCompleted = exec.status === "completed"
  const isFailed = exec.status === "failed"

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`border rounded-xl overflow-hidden transition-colors ${
        isActive ? "border-primary/30 bg-primary/3" :
        isCompleted ? "border-border/40 bg-white/[0.01]" :
        isFailed ? "border-red-500/20 bg-red-500/5" : "border-border/30"
      }`}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-white/3 transition-colors"
      >
        {/* Status indicator */}
        <div className="shrink-0">
          {isActive ? (
            <motion.div
              className="h-5 w-5 rounded-full border border-primary/40 bg-primary/10 flex items-center justify-center"
              animate={{ boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 8px rgba(212,175,55,0.4)", "0 0 0px rgba(212,175,55,0)"] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Loader2 className="h-3 w-3 text-primary animate-spin" />
            </motion.div>
          ) : isCompleted ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          ) : isFailed ? (
            <XCircle className="h-5 w-5 text-red-400" />
          ) : (
            <div className="h-5 w-5 rounded-full border border-border bg-secondary/20 flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{exec.intent}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            {exec.plan && <ActionBadge type={exec.plan.actionType} />}
            {exec.plan?.targetSystem && (
              <span className="text-[9px] text-muted-foreground">{exec.plan.targetSystem}</span>
            )}
            {exec.duration && (
              <span className="text-[9px] text-muted-foreground ml-auto">{(exec.duration / 1000).toFixed(1)}s</span>
            )}
          </div>
        </div>

        {expanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {/* Body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            transition={{ duration: 0.2 }} className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3 border-t border-border/30">

              {/* Active: thinking state */}
              {isActive && (exec.status === "thinking" || exec.status === "classifying") && (
                <div className="pt-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Brain className="h-3.5 w-3.5 text-primary animate-pulse" />
                    <motion.p
                      key={exec.thinkingStep}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-xs text-primary font-medium"
                    >
                      {exec.thinkingStep}
                    </motion.p>
                  </div>
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <motion.div key={i} className="h-1 flex-1 rounded-full bg-primary/20 overflow-hidden">
                        <motion.div className="h-full bg-primary/60 rounded-full"
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
                        />
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan card */}
              {exec.plan && (
                <div className="pt-2.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 space-y-1">
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{exec.plan.reasoning}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-[9px] font-semibold ${exec.plan.confidence >= 0.85 ? "text-emerald-400" : "text-amber-400"}`}>
                          {Math.round(exec.plan.confidence * 100)}% confidence
                        </span>
                        {exec.plan.targetSection && (
                          <span className="text-[9px] text-muted-foreground border border-border/40 rounded px-1.5 py-0.5">
                            section: {exec.plan.targetSection}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Execution steps */}
                  {isActive && exec.status === "executing" && (
                    <div className="space-y-1">
                      {exec.plan.executionSteps.map((step, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                          className="flex items-center gap-2 text-[10px]"
                        >
                          <div className={`h-3.5 w-3.5 rounded-full flex items-center justify-center shrink-0 ${
                            exec.executingStep === step
                              ? "bg-primary/20 border border-primary/40"
                              : exec.plan!.executionSteps.indexOf(exec.executingStep) > i
                              ? "bg-emerald-500/20" : "bg-secondary/20"
                          }`}>
                            {exec.plan!.executionSteps.indexOf(exec.executingStep) > i
                              ? <span className="text-emerald-400 text-[7px]">✓</span>
                              : exec.executingStep === step
                              ? <Loader2 className="h-2 w-2 text-primary animate-spin" />
                              : <div className="h-1 w-1 rounded-full bg-muted-foreground/30" />
                            }
                          </div>
                          <span className={exec.executingStep === step ? "text-foreground font-medium" : "text-muted-foreground/60"}>{step}</span>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Streaming content */}
              {exec.content && (
                <div className="bg-black/20 border border-border/30 rounded-lg p-3 max-h-72 overflow-y-auto">
                  <MarkdownContent content={exec.content} />
                  {isActive && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      className="inline-block h-3 w-0.5 bg-primary ml-0.5 align-middle"
                    />
                  )}
                </div>
              )}

              {/* Completed result */}
              {isCompleted && exec.result && (
                <div className="space-y-2">
                  {/* Systems updated */}
                  {exec.result.systemsUpdated.length > 0 && (
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-1">Systems Updated</p>
                      <div className="flex flex-wrap gap-1">
                        {exec.result.systemsUpdated.map(s => (
                          <span key={s} className="inline-flex items-center gap-1 text-[9px] text-emerald-400 border border-emerald-500/20 bg-emerald-500/8 rounded px-1.5 py-0.5">
                            <CheckCircle2 className="h-2.5 w-2.5" />{s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section update apply button */}
                  {exec.result.data?.type === "section_update" && onSectionUpdate && (
                    <button
                      onClick={() => {
                        const d = exec.result!.data!
                        if (d.section && d.data) onSectionUpdate(d.section, d.data)
                      }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors"
                    >
                      <Wand2 className="h-3.5 w-3.5" />Apply Changes to Website
                    </button>
                  )}

                  {/* Impact */}
                  {exec.plan?.estimatedImpact && (
                    <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                      <ArrowRight className="h-3 w-3 text-primary mt-0.5 shrink-0" />
                      <p className="text-[10px] text-muted-foreground leading-relaxed">{exec.plan.estimatedImpact}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Error state */}
              {isFailed && (
                <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-red-500/8 border border-red-500/20">
                  <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-400 leading-relaxed">{exec.content || "Execution failed — please try again"}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function ExecutionPanel({
  businessIntelligence, websiteData, onSectionUpdate, compact = false,
}: ExecutionPanelProps) {
  const [intent, setIntent] = useState("")
  const [executions, setExecutions] = useState<ExecutionRecord[]>([])
  const [isExecuting, setIsExecuting] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const thinkingIdx = useRef(0)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const updateExec = useCallback((id: string, patch: Partial<ExecutionRecord>) => {
    setExecutions(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e))
  }, [])

  const execute = useCallback(async (intentText: string) => {
    if (!intentText.trim() || isExecuting) return
    setIsExecuting(true)
    setIntent("")

    const id = `exec-${Date.now()}`
    const record: ExecutionRecord = {
      id, intent: intentText.trim(), status: "thinking",
      plan: null, content: "", result: null, duration: null,
      startedAt: new Date(), thinkingStep: THINKING_MESSAGES[0]!, executingStep: "",
    }
    setExecutions(prev => [record, ...prev])
    setActiveId(id)

    // Rotate thinking messages
    thinkingIdx.current = 0
    const thinkInterval = setInterval(() => {
      thinkingIdx.current = (thinkingIdx.current + 1) % THINKING_MESSAGES.length
      updateExec(id, { thinkingStep: THINKING_MESSAGES[thinkingIdx.current]! })
    }, 700)

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          intent: intentText.trim(),
          businessContext: businessIntelligence,
          websiteData,
        }),
      })

      if (!response.ok) throw new Error("Execution request failed")

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let carry = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const parsed = JSON.parse(line.slice(6).trim())
            if (parsed.phase === "thinking") {
              updateExec(id, { status: "thinking", thinkingStep: parsed.message })
            } else if (parsed.phase === "classifying") {
              clearInterval(thinkInterval)
              updateExec(id, { status: "classifying", thinkingStep: "Classifying action type..." })
            } else if (parsed.phase === "classified") {
              updateExec(id, { plan: parsed.plan, status: "executing", executingStep: parsed.plan?.executionSteps?.[0] ?? "" })
            } else if (parsed.phase === "executing") {
              updateExec(id, { status: "executing", executingStep: parsed.step ?? "" })
            } else if (parsed.phase === "content") {
              setExecutions(prev => prev.map(e => e.id === id ? { ...e, content: e.content + parsed.content } : e))
            } else if (parsed.phase === "completed") {
              updateExec(id, { status: "completed", result: parsed.result, duration: parsed.duration })
              setActiveId(null)
            } else if (parsed.phase === "error") {
              updateExec(id, { status: "failed", content: parsed.message })
              setActiveId(null)
            }
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch (err) {
      clearInterval(thinkInterval)
      updateExec(id, { status: "failed", content: String(err) })
      setActiveId(null)
    } finally {
      clearInterval(thinkInterval)
      setIsExecuting(false)
    }
  }, [businessIntelligence, websiteData, isExecuting, updateExec])

  const clearAll = useCallback(() => {
    if (isExecuting) return
    setExecutions([])
    setActiveId(null)
  }, [isExecuting])

  return (
    <div className={`flex flex-col gap-4 ${compact ? "" : ""}`}>
      {/* ── Header ── */}
      {!compact && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">AI Execution Engine</h3>
              <p className="text-[10px] text-muted-foreground">Execute real actions across all systems</p>
            </div>
          </div>
          {executions.length > 0 && !isExecuting && (
            <button onClick={clearAll} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <RotateCcw className="h-3 w-3" />Clear
            </button>
          )}
        </div>
      )}

      {/* ── Intent Input ── */}
      <div className={`border rounded-xl overflow-hidden transition-colors ${isExecuting ? "border-primary/30 bg-primary/3" : "border-border/50 hover:border-border bg-secondary/10"}`}>
        <textarea
          ref={inputRef}
          value={intent}
          onChange={e => setIntent(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && intent.trim()) { e.preventDefault(); execute(intent) } }}
          disabled={isExecuting}
          placeholder="What should I execute? (e.g. 'Optimize my hero section for higher conversion')"
          rows={compact ? 2 : 3}
          className="w-full bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none disabled:opacity-60"
        />
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-black/10">
          <span className="text-[10px] text-muted-foreground">↵ Enter to execute · Shift+↵ for newline</span>
          <button
            onClick={() => execute(intent)}
            disabled={!intent.trim() || isExecuting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            {isExecuting ? "Executing..." : "Execute"}
          </button>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      {!isExecuting && executions.length === 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Quick Actions</p>
          <div className="grid grid-cols-2 gap-1.5">
            {QUICK_ACTIONS.map(({ label, icon: Icon }) => (
              <button key={label} onClick={() => execute(label)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/40 hover:border-primary/30 hover:bg-primary/5 text-left transition-all group"
              >
                <Icon className="h-3 w-3 text-muted-foreground group-hover:text-primary shrink-0 transition-colors" />
                <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Action Type Legend (when idle with executions) ── */}
      {!isExecuting && executions.length > 0 && !compact && (
        <div className="flex items-center gap-2 flex-wrap">
          {(Object.entries(ACTION_CONFIG) as [ActionType, typeof ACTION_CONFIG[ActionType]][]).map(([type, cfg]) => {
            const Icon = cfg.icon
            return (
              <span key={type} className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                <Icon className="h-2.5 w-2.5" />{cfg.label}
              </span>
            )
          })}
          <span className="text-[9px] text-muted-foreground ml-auto">{executions.length} execution{executions.length !== 1 ? "s" : ""}</span>
        </div>
      )}

      {/* ── Execution Timeline ── */}
      <AnimatePresence>
        {executions.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {executions.map(exec => (
              <ExecutionCard
                key={exec.id}
                exec={exec}
                isActive={exec.id === activeId}
                onSectionUpdate={onSectionUpdate}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── System Impact Display (active execution) ── */}
      <AnimatePresence>
        {isExecuting && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/15"
          >
            <motion.div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0"
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1, repeat: Infinity }}
            />
            <p className="text-[10px] text-primary font-medium">AI Execution Engine active</p>
            <span className="text-[9px] text-muted-foreground ml-auto">Processing across all systems</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Compact widget for dashboard overview ────────────────────────────────────

export function ExecutionWidget({
  businessIntelligence, websiteData, onNavigate,
}: {
  businessIntelligence: BusinessIntelligence | null
  websiteData: WebsiteOutput | null
  onNavigate: (path: string) => void
}) {
  const [intent, setIntent] = useState("")
  const [lastResult, setLastResult] = useState<string | null>(null)
  const [isExecuting, setIsExecuting] = useState(false)
  const [phase, setPhase] = useState("")

  const quickExecute = useCallback(async (text: string) => {
    if (isExecuting) return
    setIsExecuting(true)
    setLastResult(null)
    setPhase("Thinking...")

    try {
      const response = await fetch("/api/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ intent: text, businessContext: businessIntelligence, websiteData }),
      })

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()
      let carry = "", content = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const p = JSON.parse(line.slice(6).trim())
            if (p.phase === "thinking") setPhase(p.message ?? "Thinking...")
            else if (p.phase === "classified") setPhase(`${p.plan?.actionType ?? "Executing"} → ${p.plan?.targetSystem ?? ""}`)
            else if (p.phase === "executing") setPhase(p.step ?? "Executing...")
            else if (p.phase === "content") content += p.content
            else if (p.phase === "completed") setLastResult(content.slice(0, 200))
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silently fail */ }
    finally { setIsExecuting(false); setPhase("") }
  }, [businessIntelligence, websiteData, isExecuting])

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
            <Zap className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Execution Engine</span>
        </div>
        <button onClick={() => onNavigate("/execution-engine")} className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-1 transition-colors">
          Full view <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="flex gap-2">
        <input
          value={intent}
          onChange={e => setIntent(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && intent.trim()) quickExecute(intent) }}
          disabled={isExecuting}
          placeholder="Execute any action..."
          className="flex-1 bg-secondary/20 border border-border/50 rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 disabled:opacity-60"
        />
        <button onClick={() => quickExecute(intent)} disabled={!intent.trim() || isExecuting}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-40 transition-all"
        >
          {isExecuting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        </button>
      </div>

      <AnimatePresence>
        {isExecuting && phase && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-[10px] text-primary"
          >
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            <span className="truncate">{phase}</span>
          </motion.div>
        )}
        {lastResult && !isExecuting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="px-2 py-1.5 rounded-lg bg-emerald-500/8 border border-emerald-500/20"
          >
            <p className="text-[10px] text-emerald-400 line-clamp-3 leading-relaxed">{lastResult}…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1.5 flex-wrap">
        {["Optimize hero", "Analyze conversion", "Review strategy"].map(q => (
          <button key={q} onClick={() => quickExecute(q)} disabled={isExecuting}
            className="text-[9px] text-muted-foreground border border-border/40 rounded px-2 py-0.5 hover:border-primary/30 hover:text-primary transition-colors disabled:opacity-40"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  )
}
