import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain, ArrowRight, Play, RefreshCw, AlertCircle, CheckCircle,
  Clock, Cpu, GitBranch, Database, Globe, Zap, Activity,
  ChevronDown, ChevronUp, Copy, Check, Network, Radio, Lock, Rocket,
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"
import { useAuth } from "@/lib/auth-context"
import { useLocation } from "wouter"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import { useLang } from "@/lib/i18n"
import { ensureProject } from "@/lib/ensure-project"
import { loadProjectContext, clearProjectContext, loadOrchestratorContext, clearOrchestratorContext, consumePendingIntent, cacheConsumedIdea, dequeueWorkspaceSignals } from "@/lib/generation-context"
import { useWorkspaceController } from "@/lib/workspace-controller-context"
import { orchestratorController } from "@/lib/module-architecture/controllers/orchestrator-controller"
import { registerController, unregisterController } from "@/lib/module-architecture/registry"
import { registerBridge, unregisterBridge } from "@/lib/module-architecture/orchestrator-bridge"
import { tracer } from "@/lib/execution-tracer"

interface Agent {
  id: string; name: string; role: string; model: string
  input: string; output: string; tools: string[]; objective: string
}
interface ChainStep {
  step: number; agentId: string; action: string
  handoff?: string; condition?: string; parallel?: boolean
}
interface DataFlow { from: string; to: string; data: string }
interface Trigger { event: string; source: string; description: string }
interface LogEntry { timestamp: string; agent: string; action: string; status: "running" | "success" | "error" | "waiting" }
interface OrchestratorData {
  overview: { goal: string; agentCount: number; executionMode: string; estimatedRuntime: string }
  agents: Agent[]
  chain: ChainStep[]
  dataFlow: DataFlow[]
  triggers: Trigger[]
  monitoring: { successMetric: string; failureHandling: string; loggingPlatform: string; alertChannel: string }
  executionLog: LogEntry[]
}

const AGENT_COLORS = [
  { bg: "bg-violet-500/10", border: "border-violet-500/30", text: "text-violet-400", hex: "#8B5CF6", glow: "rgba(139,92,246,0.3)" },
  { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", hex: "#3B82F6", glow: "rgba(59,130,246,0.3)" },
  { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", hex: "#10B981", glow: "rgba(16,185,129,0.3)" },
  { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", hex: "#F59E0B", glow: "rgba(245,158,11,0.3)" },
  { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400", hex: "#F43F5E", glow: "rgba(244,63,94,0.3)" },
  { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", hex: "#06B2D8", glow: "rgba(6,182,212,0.3)" },
]

const statusColor = (s: string) =>
  s === "success" ? "text-emerald-400" : s === "error" ? "text-rose-400" : s === "running" ? "text-amber-400" : "text-muted-foreground"
const statusDot = (s: string) =>
  s === "success" ? "bg-emerald-400" : s === "error" ? "bg-rose-400" : s === "running" ? "bg-amber-400 animate-pulse" : "bg-muted-foreground/30"

function AgentCard({ agent, index, isActive }: { agent: Agent; index: number; isActive: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const c = AGENT_COLORS[index % AGENT_COLORS.length]
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.08 }}
      className={`rounded-2xl border ${c.border} ${c.bg} overflow-hidden transition-all`}
      style={{ boxShadow: isActive ? `0 0 20px ${c.glow}` : undefined }}>
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div className={`p-2 rounded-xl ${c.bg} border ${c.border}`}>
              <Brain className={`h-4 w-4 ${c.text}`} />
            </div>
            <div>
              <div className="text-xs font-black text-foreground">{agent.name}</div>
              <div className={`text-[9px] font-semibold ${c.text}`}>{agent.role}</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-semibold text-muted-foreground/60 border border-white/10 rounded px-1.5 py-0.5">{agent.model}</span>
            <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">{agent.objective}</p>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="mt-3 space-y-2 border-t border-white/5 pt-3 overflow-hidden">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">Input</div>
                  <p className="text-[10px] text-foreground/70">{agent.input}</p>
                </div>
                <div>
                  <div className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">Output</div>
                  <p className="text-[10px] text-foreground/70">{agent.output}</p>
                </div>
              </div>
              <div>
                <div className="text-[8px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-1">Tools</div>
                <div className="flex flex-wrap gap-1">
                  {agent.tools.map(t => (
                    <span key={t} className="text-[9px] border border-white/10 rounded px-1.5 py-0.5 text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

/* Live Network Graph */
function AgentGraph({ agents, dataFlow, replayStep, executionLog, isReplaying }: {
  agents: Agent[]; dataFlow: DataFlow[]; replayStep: number; executionLog: LogEntry[]; isReplaying: boolean
}) {
  const WIDTH = 600
  const HEIGHT = 360
  const N = agents.length

  const nodePositions = agents.map((_, i) => {
    if (N === 1) return { x: WIDTH / 2, y: HEIGHT / 2 }
    if (N <= 4) {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2
      return { x: WIDTH / 2 + Math.cos(angle) * 140, y: HEIGHT / 2 + Math.sin(angle) * 120 }
    }
    const angle = (i / N) * Math.PI * 2 - Math.PI / 2
    return { x: WIDTH / 2 + Math.cos(angle) * 200, y: HEIGHT / 2 + Math.sin(angle) * 140 }
  })

  const activeAgentId = isReplaying && replayStep >= 0 ? executionLog[replayStep]?.agent : null

  return (
    <div className="rounded-2xl border border-white/8 bg-[#060606] overflow-hidden">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        <Network className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Live Agent Network</span>
        {isReplaying && (
          <div className="flex items-center gap-1.5 ml-auto text-[10px] text-violet-400">
            <Radio className="h-3 w-3 animate-pulse" />Simulation running...
          </div>
        )}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ height: HEIGHT }}>
        <defs>
          <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="rgba(212,175,55,0.5)" />
          </marker>
          {agents.map((_, i) => {
            const c = AGENT_COLORS[i % AGENT_COLORS.length]
            return (
              <radialGradient key={i} id={`grad${i}`}>
                <stop offset="0%" stopColor={c.hex} stopOpacity="0.3" />
                <stop offset="100%" stopColor={c.hex} stopOpacity="0.05" />
              </radialGradient>
            )
          })}
        </defs>

        {/* Grid lines */}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * HEIGHT / 7} x2={WIDTH} y2={i * HEIGHT / 7} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`v${i}`} x1={i * WIDTH / 9} y1={0} x2={i * WIDTH / 9} y2={HEIGHT} stroke="rgba(255,255,255,0.03)" strokeWidth={1} />
        ))}

        {/* Edges */}
        {dataFlow.map((flow, fi) => {
          const fromIdx = agents.findIndex(a => a.id === flow.from)
          const toIdx = agents.findIndex(a => a.id === flow.to)
          if (fromIdx === -1 || toIdx === -1) return null
          const from = nodePositions[fromIdx]
          const to = nodePositions[toIdx]
          const mx = (from.x + to.x) / 2
          const my = (from.y + to.y) / 2 - 30
          const isActive = isReplaying && (executionLog[replayStep]?.agent === flow.from || executionLog[replayStep]?.agent === flow.to)
          return (
            <g key={fi}>
              <path
                d={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`}
                fill="none"
                stroke={isActive ? "rgba(212,175,55,0.6)" : "rgba(255,255,255,0.1)"}
                strokeWidth={isActive ? 2 : 1}
                strokeDasharray={isActive ? "none" : "4 4"}
                markerEnd="url(#arrow)"
              />
              {isActive && (
                <motion.circle r={4} fill="#D4AF37" opacity={0.8}
                  style={{ offsetPath: `path("M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}")` }}>
                  <animateMotion dur="1.5s" repeatCount="indefinite"
                    path={`M ${from.x} ${from.y} Q ${mx} ${my} ${to.x} ${to.y}`} />
                </motion.circle>
              )}
              <text x={mx} y={my - 8} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.25)" fontFamily="monospace">
                {flow.data.slice(0, 20)}{flow.data.length > 20 ? "…" : ""}
              </text>
            </g>
          )
        })}

        {/* Nodes */}
        {agents.map((agent, i) => {
          const pos = nodePositions[i]
          const c = AGENT_COLORS[i % AGENT_COLORS.length]
          const isActive = agent.name === activeAgentId || agent.id === activeAgentId
          const R = 36
          return (
            <g key={agent.id} style={{ cursor: "pointer" }}>
              {isActive && (
                <>
                  <circle cx={pos.x} cy={pos.y} r={R + 12} fill={`url(#grad${i})`}>
                    <animate attributeName="r" values={`${R + 8};${R + 18};${R + 8}`} dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                  <circle cx={pos.x} cy={pos.y} r={R + 4} fill="none" stroke={c.hex} strokeWidth={1.5} opacity={0.4}>
                    <animate attributeName="r" values={`${R + 2};${R + 10};${R + 2}`} dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0;0.4" dur="1s" repeatCount="indefinite" />
                  </circle>
                </>
              )}
              <circle cx={pos.x} cy={pos.y} r={R} fill={`${c.hex}18`} stroke={c.hex} strokeWidth={isActive ? 2 : 1} strokeOpacity={isActive ? 0.9 : 0.4} />
              <text x={pos.x} y={pos.y - 10} textAnchor="middle" fontSize={9} fontWeight="900" fill={c.hex} fontFamily="system-ui">
                Agent {i + 1}
              </text>
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.8)" fontFamily="system-ui" fontWeight="600">
                {agent.name.length > 14 ? agent.name.slice(0, 13) + "…" : agent.name}
              </text>
              <text x={pos.x} y={pos.y + 16} textAnchor="middle" fontSize={7} fill={c.hex} fontFamily="system-ui" opacity={0.7}>
                {agent.role.slice(0, 16)}
              </text>
              {isActive && (
                <text x={pos.x} y={pos.y + 28} textAnchor="middle" fontSize={7} fill="#10B981" fontFamily="system-ui">
                  ● Active
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/5 flex-wrap">
        {agents.map((agent, i) => {
          const c = AGENT_COLORS[i % AGENT_COLORS.length]
          return (
            <div key={agent.id} className="flex items-center gap-1.5">
              <div className="h-2 w-2 rounded-full" style={{ background: c.hex }} />
              <span className="text-[9px] text-muted-foreground/60">{agent.name}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function OrchestratorPage() {
  const [goal, setGoal] = useState("")
  const [businessContext, setBusinessContext] = useState("")
  const [step, setStep] = useState<"idle" | "generating" | "done">("idle")
  const [data, setData] = useState<OrchestratorData | null>(null)
  const [genError, setGenError] = useState("")
  const [streamText, setStreamText] = useState("")
  const [activeTab, setActiveTab] = useState<"graph" | "chain" | "agents" | "dataflow" | "monitor">("graph")
  const [activeAgent, setActiveAgent] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isReplaying, setIsReplaying] = useState(false)
  const [replayStep, setReplayStep] = useState(-1)
  const abortRef = useRef<AbortController | null>(null)
  // Bridge refs — kept in sync each render so the OrchestratorBridge can always
  // call the latest version of generate() and read the current goal value.
  const generateCompleteCallbackRef = useRef<(() => void) | null>(null)
  const goalRef = useRef(goal)
  const generateRef = useRef<((ideaOverride?: string) => Promise<void>) | null>(null)
  const [userPlan, setUserPlan] = useState<string | null>(null)
  // Marcus workspace signal typewriter — same ref+tick pattern as website-generator.
  const [marcusPopulateTick, setMarcusPopulateTick] = useState(0)
  const marcusPopulateRef = useRef<string>("")
  const marcusTypewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const { user } = useAuth()
  const { lang } = useLang()
  const [, navigate] = useLocation()
  const { openUpgradeModal } = useUpgradeModal()
  const { emit, subscribeWorkspaceSignal } = useWorkspaceController()

  useEffect(() => {
    const _mountCtx = loadProjectContext()
    console.log(`GENERATOR_MOUNT | page=orchestrator | projectId=${_mountCtx?.projectId ?? "(none)"} | continuityMode=${_mountCtx?.continuityMode ?? "(none)"} | source=${_mountCtx?.source ?? "(none)"}`)

    const isContinuation = _mountCtx?.continuityMode === "continuation" && !!_mountCtx?.projectId
    if (!isContinuation) {
      console.log("ORCHESTRATOR_TRACE: no continuation context — clearing stale project context")
      clearProjectContext()
    } else {
      console.log(`ORCHESTRATOR_TRACE: continuation mode — preserving projectId=${_mountCtx!.projectId}`)
    }

    // Marcus Copilot: consume pendingIntent written by orchestrator_idea command
    const intent = consumePendingIntent("orchestrator")
    if (intent?.idea) {
      goalRef.current = intent.idea
      cacheConsumedIdea("orchestrator", intent.idea)
      console.log("ORCHESTRATOR_TRACE: consumed pendingIntent | idea:", intent.idea.slice(0, 60))
      // Always use typewriter animation — generation is triggered exclusively by ExecutionBus
      marcusPopulateRef.current = intent.idea
      setMarcusPopulateTick(t => t + 1)
      return
    }

    // Deep-link from Project Detail page: pre-fill goal + business context
    // if the user clicked "Continue in Orchestrator" / "Regenerate".
    const ctx = loadOrchestratorContext()
    if (ctx?.goal) {
      setGoal(ctx.goal)
      if (ctx.businessContext) setBusinessContext(ctx.businessContext)
      console.log("ORCHESTRATOR_TRACE: pre-filled from project context | goal:", ctx.goal.slice(0, 60))
    }
    clearOrchestratorContext()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setUserPlan(d.subscription?.plan ?? "free"))
      .catch(() => setUserPlan("free"))
  }, [user])

  const isFreePlan = user !== null && userPlan === "free"

  // Marcus typewriter populate effect — same ref+tick pattern as website-generator.
  useEffect(() => {
    const text = marcusPopulateRef.current
    if (!text) return
    marcusPopulateRef.current = ""
    console.log("ORCHESTRATOR_POPULATE_4 | typewriter started | length:", text.length, "| first 80:", text.slice(0, 80))
    setGoal("")
    let i = 0
    if (marcusTypewriterRef.current) clearInterval(marcusTypewriterRef.current)
    marcusTypewriterRef.current = setInterval(() => {
      i++
      setGoal(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(marcusTypewriterRef.current!)
        marcusTypewriterRef.current = null
        console.log("ORCHESTRATOR_POPULATE_5 | textarea fully populated | length:", text.length)
        cacheConsumedIdea("orchestrator", text)
      }
    }, 18)
    return () => {
      if (marcusTypewriterRef.current) clearInterval(marcusTypewriterRef.current)
    }
  }, [marcusPopulateTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live signal subscription — handles orchestrator_idea when page is already mounted.
  // Drains queued signals first (race window between navigation and effect registration),
  // then subscribes for live delivery. Both paths use typewriter via ref+tick.
  useEffect(() => {
    const queued = dequeueWorkspaceSignals("orchestrator")
    for (const qs of queued) {
      if (qs.type === "populate" && qs.payload?.trim()) {
        console.log("ORCHESTRATOR_POPULATE_3 | queued signal drained | payload length:", qs.payload.length)
        goalRef.current = qs.payload
        marcusPopulateRef.current = qs.payload
        setMarcusPopulateTick(t => t + 1)
      }
    }
    return subscribeWorkspaceSignal((signal) => {
      if (signal.target !== "orchestrator") return
      if (signal.type === "populate" && signal.payload) {
        console.log("ORCHESTRATOR_POPULATE_3 | live signal received | payload length:", signal.payload.length)
        goalRef.current = signal.payload
        cacheConsumedIdea("orchestrator", signal.payload)
        marcusPopulateRef.current = signal.payload
        setMarcusPopulateTick(t => t + 1)
      }
    }, "orchestrator")
  }, [subscribeWorkspaceSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register orchestrator controller and bridge so the ExecutionBus can drive this page.
  useEffect(() => {
    const ctrlRegId = registerController("orchestrator", orchestratorController)
    const bridgeRegId = registerBridge({
      navigate: () => navigate("/orchestrator"),
      populate: (idea, onComplete) => {
        setGoal(idea)
        goalRef.current = idea
        // Defer onComplete so React has time to commit the state update.
        setTimeout(onComplete, 0)
      },
      triggerGenerate: (idea) => new Promise<void>((resolve) => {
        // Resolve any in-flight promise before replacing — prevents orphaned Promises
        // if two triggerGenerate() calls overlap (e.g. rapid bus.execute() calls).
        const prior = generateCompleteCallbackRef.current
        if (prior) { generateCompleteCallbackRef.current = null; prior() }
        generateCompleteCallbackRef.current = resolve
        // Guard: if generate ref is not set, resolve immediately rather than
        // leaving the bus Promise hanging. Matches chatbot's guaranteed-call contract.
        const gen = generateRef.current
        if (!gen) { generateCompleteCallbackRef.current = null; resolve(); return }
        gen(idea)
      }),
      save: () => Promise.resolve(),
      getCurrentIdea: () => goalRef.current,
    })
    return () => {
      unregisterController("orchestrator", ctrlRegId)
      unregisterBridge(bridgeRegId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (ideaOverride?: string) => {
    const goalText = (ideaOverride ?? goal).trim()
    // Early exit: resolve any pending bridge promise so triggerGenerate() doesn't hang.
    if (!goalText) {
      const cb = generateCompleteCallbackRef.current; generateCompleteCallbackRef.current = null; cb?.()
      return
    }
    // If the bridge supplied an idea override, commit it to state for UI consistency.
    if (ideaOverride && ideaOverride !== goal) setGoal(ideaOverride)

    setGenError(""); setStep("generating"); setStreamText(""); setData(null); setReplayStep(-1)
    abortRef.current = new AbortController()
    let buffer = ""
    const traceId = tracer.getActiveExecutionId("orchestrator")
    let traceOutcome: { success: boolean; reason?: string } | null = null
    try {
      if (traceId) {
        tracer.logStage(traceId, 9, "HTTP request", {
          functionName: "generate",
          success: true,
          data: { method: "POST", endpoint: "/api/generate/orchestrator" },
        })
      }
      const res = await fetch("/api/generate/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ goal: goalText, businessContext, language: lang }),
        signal: abortRef.current.signal,
      })
      if (traceId) {
        tracer.logStage(traceId, 10, "HTTP response", {
          functionName: "generate",
          success: res.ok,
          reason: res.ok ? undefined : `HTTP ${res.status}`,
          data: { status: res.status, endpoint: "/api/generate/orchestrator" },
        })
      }
      if (!res.ok || !res.body) {
        traceOutcome = { success: false, reason: `HTTP ${res.status}` }
        throw new Error("Request failed")
      }
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.error) { setGenError(msg.error); setStep("idle"); traceOutcome = { success: false, reason: msg.error }; return }
            if (msg.content) { buffer += msg.content; setStreamText(buffer) }
            if (msg.done && msg.data) {
              setData(msg.data); setStep("done"); setActiveTab("graph")
              const _orchResult = await ensureProject({
                type: "orchestration",
                idea: goalText,
                outputField: "orchestratorOutput",
                output: msg.data as Record<string, unknown>,
              }).catch(() => ({ projectId: "", created: false, saved: false }))
              if (traceId) {
                tracer.logStage(traceId, 11, "Persistence", {
                  functionName: "generate",
                  success: !!_orchResult.saved,
                  reason: _orchResult.saved ? undefined : "ensureProject did not report saved=true",
                  data: { projectId: _orchResult.projectId, created: _orchResult.created },
                })
              }
              emit({ type: "orchestrator.generated", data: { saved: _orchResult.saved } })
              if (traceId) {
                tracer.logStage(traceId, 12, "Completion event", {
                  functionName: "generate",
                  success: true,
                  data: { event: "orchestrator.generated" },
                })
              }
              traceOutcome = { success: true }
              // return immediately — matches Website's pattern of exiting as soon as
              // the done block completes. The finally block fires next and resolves
              // the bridge's triggerGenerate() Promise via generateCompleteCallbackRef.
              return
            }
          } catch { /* fragment */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setGenError("Generation failed — please try again"); setStep("idle")
        traceOutcome = { success: false, reason: e.message }
      } else if (e instanceof Error) {
        traceOutcome = { success: false, reason: "aborted" }
      }
    } finally {
      if (traceId) {
        tracer.endExecution(traceId, traceOutcome?.success ?? false, traceOutcome?.reason ?? "execution ended without explicit completion")
      }
      // Always resolve the bridge's triggerGenerate() promise (no-op when called directly).
      // try/finally ensures this runs on every exit path including msg.error early returns.
      const cb = generateCompleteCallbackRef.current
      generateCompleteCallbackRef.current = null
      cb?.()
    }
  }

  // Latest-ref pattern: keep both refs in sync on every render so the OrchestratorBridge
  // always has the current goal string and generate function before mount effects run.
  goalRef.current = goal
  generateRef.current = generate

  const replayExecution = useCallback(async () => {
    if (!data) return
    setIsReplaying(true); setReplayStep(0)
    for (let i = 0; i < data.executionLog.length; i++) {
      await new Promise(r => setTimeout(r, 600))
      setReplayStep(i)
    }
    await new Promise(r => setTimeout(r, 800))
    setIsReplaying(false)
  }, [data])

  const copyJson = () => {
    if (!data) return
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const EXAMPLE_GOALS = [
    "Lead captured → AI qualifies → CRM updated → sales notified → follow-up email sent",
    "Support ticket created → AI classifies priority → route to agent → generate response draft",
    "User signs up → AI personalizes onboarding → send sequence → score engagement",
  ]

  return (
    isFreePlan ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-md w-full text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/8 mx-auto mb-5">
              <Lock className="h-7 w-7 text-primary/60" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">AI Orchestrator</h2>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              Multi-agent orchestration is available on the <strong className="text-primary/80">Pro plan</strong> and above. Design, coordinate, and replay complex AI agent pipelines with full execution visibility.
            </p>
            <div className="flex flex-col gap-3 items-center">
              <button
                onClick={() => openUpgradeModal()}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow"
              >
                <Rocket className="h-4 w-4" /> Upgrade Plan
              </button>
              <button
                onClick={() => navigate("/dashboard")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        </div>
      ) : (
      <div className="flex-1 flex overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-72 shrink-0 border-r border-white/5 bg-[#070707] flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <img src={stageoneIcon} alt="STAGEONE" className="h-7 w-7 object-contain" />
              <div>
                <h1 className="text-sm font-black text-foreground tracking-tight">AI Orchestrator</h1>
                <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Multi-Agent Coordination</p>
              </div>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Orchestration Goal</label>
              <textarea value={goal} onChange={e => setGoal(e.target.value)}
                placeholder="Describe the end-to-end outcome you want AI agents to achieve together..."
                rows={4}
                className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all" />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Business Context (optional)</label>
              <textarea value={businessContext} onChange={e => setBusinessContext(e.target.value)}
                placeholder="Industry, existing tools, data sources..."
                rows={2}
                className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/40 transition-all" />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Example Goals</label>
              {EXAMPLE_GOALS.map(eg => (
                <button key={eg} onClick={() => setGoal(eg)}
                  className="w-full text-left rounded-lg border border-white/5 bg-white/2 p-2.5 text-[9px] text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all leading-relaxed">
                  {eg}
                </button>
              ))}
            </div>

            {genError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/8 p-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-xs text-rose-300">{genError}</p>
              </div>
            )}

            <button onClick={() => generate()}
              disabled={!goal.trim() || step === "generating"}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-black uppercase tracking-wider hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_28px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2">
              {step === "generating"
                ? <><RefreshCw className="h-4 w-4 animate-spin" />Orchestrating...</>
                : <><Brain className="h-4 w-4" />Design Orchestration</>}
            </button>

            {data && (
              <div className="space-y-2.5 rounded-xl border border-white/8 bg-white/2 p-3">
                <div className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-widest">Summary</div>
                {[
                  { label: "Agents", value: data.overview.agentCount },
                  { label: "Mode", value: data.overview.executionMode },
                  { label: "Runtime", value: data.overview.estimatedRuntime },
                ].map(s => (
                  <div key={s.label} className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    <span className="text-[10px] font-bold text-primary capitalize">{s.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-4 border-b border-white/5 px-5 h-14 shrink-0">
            {data ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-violet-400 shadow-[0_0_6px_rgba(139,92,246,0.7)] animate-pulse" />
                  <span className="text-xs font-semibold text-foreground">{data.agents.length} Agents Active</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1">
                  <Clock className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary">{data.overview.estimatedRuntime}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/8 px-3 py-1 capitalize">
                  <GitBranch className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{data.overview.executionMode}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Brain className="h-4 w-4" />
                <span className="text-xs">Define a goal and orchestrate your AI agents</span>
              </div>
            )}

            {data && (
              <div className="ml-auto flex items-center gap-2">
                <button onClick={copyJson}
                  className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  Export JSON
                </button>
                <button onClick={replayExecution} disabled={isReplaying}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/8 px-3 py-1.5 text-xs text-primary hover:bg-primary/15 transition-colors disabled:opacity-50">
                  <Play className="h-3.5 w-3.5" />
                  {isReplaying ? "Running..." : "Replay Execution"}
                </button>
                <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
                  {(["graph", "chain", "agents", "dataflow", "monitor"] as const).map(tab => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                        activeTab === tab
                          ? "bg-primary/15 text-primary border border-primary/25"
                          : "text-muted-foreground hover:text-foreground"
                      }`}>
                      {tab === "dataflow" ? "Data Flow" : tab === "graph" ? "Network" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-auto">
            {step === "idle" && !data && (
              <div className="flex items-center justify-center h-full">
                <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-5 max-w-md px-8">
                  <div className="mx-auto w-20 h-20 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center shadow-[0_0_40px_rgba(212,175,55,0.15)]">
                    <img src={stageoneIcon} alt="" className="h-11 w-11 object-contain" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-foreground mb-2">AI Orchestration Engine</h2>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Define a business goal and STAGEONE will design a complete multi-agent AI system — coordinating specialized agents, managing data handoffs, and orchestrating intelligent automation.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {[
                      { icon: Network, label: "Live Agent Graph", desc: "Visual network topology" },
                      { icon: Brain, label: "Multi-Agent Design", desc: "Coordinated AI specialists" },
                      { icon: Activity, label: "Execution Monitoring", desc: "Real-time status logs" },
                      { icon: GitBranch, label: "Conditional Logic", desc: "Smart routing & fallbacks" },
                    ].map(({ icon: Icon, label, desc }) => (
                      <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-3 text-left">
                        <Icon className="h-4 w-4 text-primary mb-1.5" />
                        <p className="text-xs font-bold text-foreground">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>
            )}

            {step === "generating" && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center space-y-5 max-w-xs px-6">
                  <div className="relative mx-auto w-20 h-20">
                    <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
                    <div className="absolute inset-1 rounded-full border border-violet-400/30 animate-spin" style={{ animationDuration: "2s" }} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Brain className="h-8 w-8 text-violet-400" />
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">Designing Agent Chain...</p>
                    <p className="text-xs text-muted-foreground mt-1">Coordinating AI specialists</p>
                  </div>
                  {streamText && (
                    <div className="rounded-xl border border-white/8 bg-white/2 p-3 text-left max-h-24 overflow-hidden">
                      <p className="text-[10px] font-mono text-muted-foreground/60 line-clamp-4">{streamText.slice(-200)}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {step === "done" && data && (
              <AnimatePresence mode="wait">
                {activeTab === "graph" && (
                  <motion.div key="graph" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-[9px] font-semibold text-primary/60 uppercase tracking-widest mb-1">Orchestration Goal</p>
                      <p className="text-sm font-bold text-foreground">{data.overview.goal}</p>
                    </div>
                    <AgentGraph
                      agents={data.agents}
                      dataFlow={data.dataFlow}
                      replayStep={replayStep}
                      executionLog={data.executionLog}
                      isReplaying={isReplaying}
                    />
                    {/* Mini execution log */}
                    <div className="rounded-xl border border-white/8 bg-[#060606] p-3 font-mono space-y-1.5 max-h-40 overflow-y-auto">
                      <p className="text-[9px] font-bold text-muted-foreground/50 uppercase tracking-widest mb-2">Execution Log</p>
                      {data.executionLog.map((entry, i) => {
                        const visible = !isReplaying || i <= replayStep
                        return (
                          <AnimatePresence key={i}>
                            {visible && (
                              <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                className="flex items-center gap-3 text-[10px]">
                                <span className="text-muted-foreground/40 w-12 shrink-0">{entry.timestamp}</span>
                                <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(entry.status)}`} />
                                <span className="text-primary/70 shrink-0">[{entry.agent}]</span>
                                <span className={`${statusColor(entry.status)} flex-1`}>{entry.action}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {activeTab === "chain" && (
                  <motion.div key="chain" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-5">
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                      <p className="text-[9px] font-semibold text-primary/60 uppercase tracking-widest mb-1">Orchestration Goal</p>
                      <p className="text-sm font-bold text-foreground">{data.overview.goal}</p>
                    </div>
                    <div className="flex items-start gap-3 overflow-x-auto pb-2">
                      {data.agents.map((agent, i) => {
                        const c = AGENT_COLORS[i % AGENT_COLORS.length]
                        const flow = data.dataFlow.find(f => f.from === agent.id)
                        const isActive = replayStep >= 0 && data.executionLog[replayStep]?.agent === agent.id
                        return (
                          <div key={agent.id} className="flex items-center gap-2 shrink-0">
                            <motion.div
                              className={`w-48 rounded-2xl border ${c.border} ${c.bg} p-4 cursor-pointer transition-all
                                ${activeAgent === agent.id ? "ring-2 ring-primary ring-offset-1 ring-offset-transparent" : ""}
                                ${isActive ? `shadow-[0_0_20px_${c.glow}]` : ""}`}
                              onClick={() => setActiveAgent(a => a === agent.id ? null : agent.id)}
                              animate={isActive ? { scale: [1, 1.03, 1] } : {}}
                              transition={{ duration: 0.4, repeat: isActive ? Infinity : 0 }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Brain className={`h-4 w-4 ${c.text}`} />
                                <span className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">Agent {i + 1}</span>
                              </div>
                              <p className="text-xs font-black text-foreground mb-1">{agent.name}</p>
                              <p className={`text-[9px] ${c.text} font-semibold mb-2`}>{agent.role}</p>
                              <p className="text-[9px] text-muted-foreground line-clamp-2">{agent.objective}</p>
                            </motion.div>
                            {i < data.agents.length - 1 && (
                              <div className="flex flex-col items-center gap-1 shrink-0">
                                <div className="h-px w-8 bg-primary/30 relative overflow-hidden">
                                  <motion.div className="absolute inset-y-0 w-4 bg-primary/60"
                                    animate={{ x: [-16, 32] }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }} />
                                </div>
                                {flow && (
                                  <div className="w-20 text-center text-[8px] text-muted-foreground/50 leading-tight line-clamp-2">
                                    {flow.data}
                                  </div>
                                )}
                                <ArrowRight className="h-3 w-3 text-primary/50" />
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#060606] overflow-hidden">
                      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs font-semibold text-foreground">Execution Log</span>
                        </div>
                        {isReplaying && (
                          <div className="flex items-center gap-1.5 text-[10px] text-amber-400">
                            <div className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                            Running simulation...
                          </div>
                        )}
                      </div>
                      <div className="p-3 space-y-1.5 font-mono">
                        {data.executionLog.map((entry, i) => {
                          const visible = !isReplaying || i <= replayStep
                          return (
                            <AnimatePresence key={i}>
                              {visible && (
                                <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                  className="flex items-center gap-3 text-[10px]">
                                  <span className="text-muted-foreground/40 w-12 shrink-0">{entry.timestamp}</span>
                                  <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(entry.status)}`} />
                                  <span className="text-primary/70 shrink-0">[{entry.agent}]</span>
                                  <span className={`${statusColor(entry.status)} flex-1`}>{entry.action}</span>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          )
                        })}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {data.triggers.map((t, i) => (
                        <div key={i} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Zap className="h-3 w-3 text-amber-400" />
                            <span className="text-[9px] font-mono text-amber-400/70">{t.event}</span>
                          </div>
                          <p className="text-[10px] font-bold text-foreground">{t.source}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">{t.description}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "agents" && (
                  <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5">
                    <div className="grid grid-cols-2 gap-4">
                      {data.agents.map((agent, i) => (
                        <AgentCard key={agent.id} agent={agent} index={i}
                          isActive={isReplaying && data.executionLog[replayStep]?.agent === agent.id} />
                      ))}
                    </div>
                  </motion.div>
                )}

                {activeTab === "dataflow" && (
                  <motion.div key="dataflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-3">Agent Data Handoffs</div>
                    {data.dataFlow.map((flow, i) => {
                      const fromAgent = data.agents.find(a => a.id === flow.from)
                      const toAgent = data.agents.find(a => a.id === flow.to)
                      const fromIdx = data.agents.findIndex(a => a.id === flow.from)
                      const toIdx = data.agents.findIndex(a => a.id === flow.to)
                      const fc = AGENT_COLORS[fromIdx % AGENT_COLORS.length]
                      const tc = AGENT_COLORS[toIdx % AGENT_COLORS.length]
                      return (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                          className="rounded-xl border border-white/8 bg-white/2 p-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex-1 rounded-lg border ${fc.border} ${fc.bg} p-2.5 text-center`}>
                              <p className={`text-[10px] font-black ${fc.text}`}>{fromAgent?.name ?? flow.from}</p>
                            </div>
                            <div className="flex flex-col items-center gap-1">
                              <ArrowRight className="h-4 w-4 text-primary/50" />
                              <Database className="h-3 w-3 text-muted-foreground/30" />
                            </div>
                            <div className={`flex-1 rounded-lg border ${tc.border} ${tc.bg} p-2.5 text-center`}>
                              <p className={`text-[10px] font-black ${tc.text}`}>{toAgent?.name ?? flow.to}</p>
                            </div>
                          </div>
                          <div className="mt-3 text-center">
                            <p className="text-[10px] text-muted-foreground">{flow.data}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                    <div className="mt-4 space-y-2">
                      <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Execution Chain</div>
                      {data.chain.map((s) => {
                        const agent = data.agents.find(a => a.id === s.agentId)
                        const idx = data.agents.findIndex(a => a.id === s.agentId)
                        const c = AGENT_COLORS[idx % AGENT_COLORS.length]
                        return (
                          <div key={s.step} className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/2 p-3">
                            <div className={`flex items-center justify-center h-6 w-6 rounded-full text-[10px] font-black ${c.bg} ${c.text} border ${c.border} shrink-0`}>
                              {s.step}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className={`text-[9px] font-black ${c.text}`}>{agent?.name}</span>
                                {s.parallel && <span className="text-[8px] text-blue-400 border border-blue-400/20 rounded px-1">PARALLEL</span>}
                              </div>
                              <p className="text-xs text-foreground/80">{s.action}</p>
                              {s.condition && <div className="flex items-center gap-1.5 text-[9px] text-amber-400/70 mt-1"><GitBranch className="h-2.5 w-2.5" />If: {s.condition}</div>}
                              {s.handoff && <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60 mt-0.5"><ArrowRight className="h-2.5 w-2.5" />Hands off: {s.handoff}</div>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </motion.div>
                )}

                {activeTab === "monitor" && (
                  <motion.div key="monitor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { icon: CheckCircle, label: "Success Metric", value: data.monitoring.successMetric, color: "text-emerald-400" },
                        { icon: AlertCircle, label: "Failure Handling", value: data.monitoring.failureHandling, color: "text-rose-400" },
                        { icon: Globe, label: "Logging Platform", value: data.monitoring.loggingPlatform, color: "text-blue-400" },
                        { icon: Cpu, label: "Alert Channel", value: data.monitoring.alertChannel, color: "text-amber-400" },
                      ].map(({ icon: Icon, label, value, color }) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <Icon className={`h-4 w-4 ${color}`} />
                            <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
                          </div>
                          <p className="text-xs text-foreground/80 leading-relaxed">{value}</p>
                        </div>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-white/8 bg-[#060606] p-5">
                      <h3 className="text-sm font-black text-foreground mb-3">Full Execution Log</h3>
                      <div className="space-y-2 font-mono">
                        {data.executionLog.map((entry, i) => (
                          <div key={i} className="flex items-center gap-3 text-[10px]">
                            <span className="text-muted-foreground/40 w-14 shrink-0">{entry.timestamp}</span>
                            <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${statusDot(entry.status)}`} />
                            <span className="text-primary/70 shrink-0">[{entry.agent}]</span>
                            <span className={statusColor(entry.status)}>{entry.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
      )
  )
}
