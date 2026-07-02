import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Workflow, Zap, Brain, Bell, Database, Globe, Webhook,
  Mail, MessageSquare, CreditCard, Ticket, Play, RefreshCw,
  ChevronRight, Copy, Check, AlertCircle, Layers, GitBranch,
  Cpu, BarChart3, Shield, ArrowRight, Sparkles, Settings2,
  Activity, Target, Clock, TrendingUp, Lock, Crown,
} from "lucide-react"
import { useLocation } from "wouter"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import stageoneIcon from "@/assets/stageone-icon.png"
import {
  loadGenerationContext, clearGenerationContext, clearProjectContext, loadProjectContext,
  loadAutomationRestoreContext, clearAutomationRestoreContext,
  deriveWorkflowType, buildAutomationDesc, consumePendingIntent, cacheConsumedIdea,
  dequeueWorkspaceSignals,
} from "@/lib/generation-context"
import { useLang } from "@/lib/i18n"
import { useWorkspaceController } from "@/lib/workspace-controller-context"
import { ensureProject } from "@/lib/ensure-project"
import { registerBridge, unregisterBridge } from "@/lib/module-architecture/automation-bridge"
import { automationController } from "@/lib/module-architecture/controllers/automation-controller"
import { registerController, unregisterController } from "@/lib/module-architecture/registry"

/* ── Types ─────────────────────────────────────────────── */
type NodeType = "trigger" | "action" | "ai_agent" | "notification" | "crm" | "database" | "webhook"

interface WorkflowNode {
  id: string
  type: NodeType
  label: string
  tool?: string
  description?: string
  config?: string
}
interface WorkflowEdge { from: string; to: string; label?: string }
interface Integration { name: string; category: string; role: string; tier: "required" | "recommended" | "optional" }
interface LogicStep { step: number; nodeId: string; action: string; condition?: string; fallback?: string }
interface AIOpportunity { type: string; description: string; impact: "high" | "medium" | "low"; nodeId?: string }
interface AgentConfig {
  objectives: string[]
  behaviors: string[]
  modelRecommendation: string
  inputSources: string[]
  outputActions: string[]
}
interface AutomationData {
  overview: { purpose: string; objective: string; expectedOutcome: string; complexityScore: number; executionEstimate: string }
  triggers: { id: string; label: string; event: string; description: string; tool: string }[]
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  integrations: Integration[]
  workflowLogic: LogicStep[]
  aiOpportunities: AIOpportunity[]
  agentConfig: AgentConfig
}

/* ── Constants ──────────────────────────────────────────── */
const WORKFLOW_TYPES = [
  "Lead Capture", "Customer Onboarding", "Sales Pipeline",
  "Support Automation", "Marketing Automation", "Internal Operations", "CRM Automation",
]
const COMPLEXITIES = ["Basic", "Intermediate", "Advanced"]

const NODE_STYLES: Record<NodeType, { bg: string; border: string; icon: React.ElementType; glow: string; badge: string }> = {
  trigger:      { bg: "bg-amber-500/10",   border: "border-amber-500/40",   icon: Zap,          glow: "rgba(245,158,11,0.3)",  badge: "bg-amber-500" },
  action:       { bg: "bg-blue-500/10",    border: "border-blue-500/40",    icon: Play,         glow: "rgba(59,130,246,0.3)",  badge: "bg-blue-500" },
  ai_agent:     { bg: "bg-violet-500/10",  border: "border-violet-500/40",  icon: Brain,        glow: "rgba(139,92,246,0.35)", badge: "bg-violet-500" },
  notification: { bg: "bg-orange-500/10",  border: "border-orange-500/40",  icon: Bell,         glow: "rgba(249,115,22,0.3)",  badge: "bg-orange-500" },
  crm:          { bg: "bg-emerald-500/10", border: "border-emerald-500/40", icon: Database,     glow: "rgba(16,185,129,0.3)",  badge: "bg-emerald-500" },
  database:     { bg: "bg-cyan-500/10",    border: "border-cyan-500/40",    icon: Database,     glow: "rgba(6,182,212,0.3)",   badge: "bg-cyan-500" },
  webhook:      { bg: "bg-rose-500/10",    border: "border-rose-500/40",    icon: Webhook,      glow: "rgba(244,63,94,0.3)",   badge: "bg-rose-500" },
}

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  trigger: "TRIGGER", action: "ACTION", ai_agent: "AI AGENT",
  notification: "NOTIFY", crm: "CRM", database: "DATABASE", webhook: "WEBHOOK",
}

const TOOL_ICONS: Record<string, React.ElementType> = {
  Email: Mail, Slack: MessageSquare, Stripe: CreditCard, Zendesk: Ticket,
  Intercom: Ticket, HubSpot: Database, Salesforce: Database, Notion: Layers,
  Zapier: Zap, Mailchimp: Mail, Webhook: Globe, default: Settings2,
}

/* ── Layout engine ──────────────────────────────────────── */
const NODE_W = 200
const NODE_H = 92
const COL_GAP = 80
const ROW_GAP = 20

function layoutNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  if (!nodes.length) return {}
  const inDegree: Record<string, number> = {}
  const outMap: Record<string, string[]> = {}
  nodes.forEach(n => { inDegree[n.id] = 0; outMap[n.id] = [] })
  edges.forEach(e => {
    inDegree[e.to] = (inDegree[e.to] || 0) + 1
    outMap[e.from] = [...(outMap[e.from] || []), e.to]
  })

  // BFS column assignment
  const col: Record<string, number> = {}
  const queue = nodes.filter(n => !inDegree[n.id] || inDegree[n.id] === 0).map(n => n.id)
  if (!queue.length) queue.push(nodes[0].id)
  queue.forEach(id => (col[id] = 0))
  const visited = new Set<string>(queue)
  let qi = 0
  while (qi < queue.length) {
    const cur = queue[qi++]
    for (const next of (outMap[cur] || [])) {
      col[next] = Math.max((col[next] ?? 0), (col[cur] ?? 0) + 1)
      if (!visited.has(next)) { visited.add(next); queue.push(next) }
    }
  }
  nodes.forEach(n => { if (col[n.id] === undefined) col[n.id] = 0 })

  const colNodes: Record<number, string[]> = {}
  nodes.forEach(n => { const c = col[n.id]; colNodes[c] = [...(colNodes[c] || []), n.id] })

  const pos: Record<string, { x: number; y: number }> = {}
  Object.entries(colNodes).forEach(([c, ids]) => {
    const totalH = ids.length * NODE_H + (ids.length - 1) * ROW_GAP
    ids.forEach((id, i) => {
      pos[id] = {
        x: Number(c) * (NODE_W + COL_GAP),
        y: i * (NODE_H + ROW_GAP) - totalH / 2 + NODE_H / 2,
      }
    })
  })
  return pos
}

/* ── Animated dot along SVG path ───────────────────────── */
function FlowDot({ d, delay }: { d: string; delay: number }) {
  return (
    <circle r={3} fill="#D4AF37" opacity={0.85}>
      <animateMotion path={d} dur="1.8s" repeatCount="indefinite" begin={`${delay}s`} />
    </circle>
  )
}

/* ── WorkflowCanvas ─────────────────────────────────────── */
function WorkflowCanvas({ nodes, edges, selectedNode, onSelectNode }: {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNode: string | null
  onSelectNode: (id: string) => void
}) {
  const pos = useMemo(() => layoutNodes(nodes, edges), [nodes, edges])

  const minX = Math.min(...Object.values(pos).map(p => p.x))
  const maxX = Math.max(...Object.values(pos).map(p => p.x)) + NODE_W
  const minY = Math.min(...Object.values(pos).map(p => p.y))
  const maxY = Math.max(...Object.values(pos).map(p => p.y)) + NODE_H
  const padX = 40
  const padY = 60
  const canvasW = maxX - minX + padX * 2
  const canvasH = Math.max(maxY - minY + padY * 2, 320)
  const ox = padX - minX
  const oy = padY - minY + (canvasH - (maxY - minY + padY * 2)) / 2

  const edgePaths = edges.map((e, i) => {
    const from = pos[e.from]
    const to = pos[e.to]
    if (!from || !to) return null
    const x1 = from.x + ox + NODE_W
    const y1 = from.y + oy + NODE_H / 2
    const x2 = to.x + ox
    const y2 = to.y + oy + NODE_H / 2
    const cx = (x1 + x2) / 2
    const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
    return { d, key: `${e.from}-${e.to}-${i}`, label: e.label, midX: cx, midY: (y1 + y2) / 2 }
  }).filter(Boolean)

  return (
    <div className="relative overflow-auto" style={{ minHeight: 320 }}>
      <svg
        width={canvasW} height={canvasH}
        className="absolute inset-0 pointer-events-none"
        style={{ minWidth: canvasW, minHeight: canvasH }}
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#D4AF37" opacity={0.6} />
          </marker>
        </defs>
        {edgePaths.map((ep) => ep && (
          <g key={ep.key}>
            <path d={ep.d} fill="none" stroke="#D4AF37" strokeWidth={1.5}
              strokeOpacity={0.25} markerEnd="url(#arrow)" />
            <path d={ep.d} fill="none" stroke="#D4AF37" strokeWidth={1}
              strokeOpacity={0.5} strokeDasharray="4 6">
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.2s" repeatCount="indefinite" />
            </path>
            <FlowDot d={ep.d} delay={Math.random() * 1.5} />
            {ep.label && (
              <text x={ep.midX} y={ep.midY - 6} textAnchor="middle"
                fill="#D4AF37" fontSize={9} opacity={0.7} fontFamily="monospace">
                {ep.label}
              </text>
            )}
          </g>
        ))}
      </svg>

      <div className="relative" style={{ width: canvasW, height: canvasH }}>
        {nodes.map((node, i) => {
          const p = pos[node.id]
          if (!p) return null
          const style = NODE_STYLES[node.type] || NODE_STYLES.action
          const Icon = style.icon
          const isSelected = selectedNode === node.id
          return (
            <motion.div
              key={node.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
              onClick={() => onSelectNode(node.id)}
              className={`absolute cursor-pointer rounded-xl border ${style.bg} ${style.border} p-3
                transition-all duration-200 hover:scale-105 select-none
                ${isSelected ? "ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-transparent" : ""}`}
              style={{
                left: p.x + ox,
                top: p.y + oy,
                width: NODE_W,
                height: NODE_H,
                boxShadow: isSelected ? `0 0 20px ${style.glow}` : `0 0 8px ${style.glow}50`,
              }}
            >
              <div className="flex items-start gap-2 h-full">
                <div className={`p-1.5 rounded-lg ${style.badge}/20 shrink-0 mt-0.5`}>
                  <Icon className="h-3.5 w-3.5" style={{ color: style.badge.replace("bg-", "").replace("-500", "") === "amber" ? "#F59E0B" : undefined }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-[8px] font-black tracking-widest uppercase mb-0.5 opacity-60`}>
                    {NODE_TYPE_LABELS[node.type]}
                  </div>
                  <div className="text-xs font-bold text-foreground leading-tight truncate">{node.label}</div>
                  {node.tool && (
                    <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{node.tool}</div>
                  )}
                  {node.description && (
                    <div className="text-[9px] text-muted-foreground/70 mt-1 line-clamp-2 leading-tight">{node.description}</div>
                  )}
                </div>
              </div>
              {isSelected && (
                <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.8)] animate-pulse" />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

/* ── NodeDetailPanel ─────────────────────────────────────── */
function NodeDetailPanel({ node, logic }: { node: WorkflowNode; logic: LogicStep[] }) {
  const style = NODE_STYLES[node.type] || NODE_STYLES.action
  const Icon = style.icon
  const steps = logic.filter(s => s.nodeId === node.id)
  return (
    <div className="p-4 space-y-3">
      <div className={`flex items-center gap-2.5 rounded-xl border ${style.border} ${style.bg} p-3`}
        style={{ boxShadow: `0 0 12px ${style.glow}40` }}>
        <div className={`p-2 rounded-lg ${style.badge}/20`}><Icon className="h-4 w-4" /></div>
        <div>
          <div className="text-xs font-black text-foreground">{node.label}</div>
          <div className="text-[9px] text-muted-foreground">{NODE_TYPE_LABELS[node.type]}{node.tool ? ` · ${node.tool}` : ""}</div>
        </div>
      </div>
      {node.description && (
        <div className="rounded-lg bg-white/3 border border-white/5 p-3">
          <p className="text-xs text-muted-foreground leading-relaxed">{node.description}</p>
        </div>
      )}
      {node.config && (
        <div className="rounded-lg bg-white/3 border border-white/5 p-3">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-1">Config</div>
          <p className="text-xs text-foreground/80">{node.config}</p>
        </div>
      )}
      {steps.map(s => (
        <div key={s.step} className="rounded-lg bg-white/3 border border-white/5 p-3 space-y-1.5">
          <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest">Step {s.step}</div>
          <p className="text-xs text-foreground/80">{s.action}</p>
          {s.condition && (
            <div className="flex items-start gap-1.5 text-[10px] text-amber-400/80">
              <GitBranch className="h-3 w-3 mt-0.5 shrink-0" /><span>{s.condition}</span>
            </div>
          )}
          {s.fallback && (
            <div className="flex items-start gap-1.5 text-[10px] text-rose-400/80">
              <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" /><span>Fallback: {s.fallback}</span>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Main Page ──────────────────────────────────────────── */
export default function AutomationBuilderPage() {
  const { lang } = useLang()
  const { emit, subscribeWorkspaceSignal } = useWorkspaceController()
  const [, setLocation] = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [businessDesc, setBusinessDesc] = useState("")
  const [workflowType, setWorkflowType] = useState("Lead Capture")
  const [complexity, setComplexity] = useState("Intermediate")
  const [step, setStep] = useState<"idle" | "generating" | "done">("idle")
  const [data, setData] = useState<AutomationData | null>(null)
  const [genError, setGenError] = useState("")
  const [streamText, setStreamText] = useState("")
  const [activeTab, setActiveTab] = useState<"workflow" | "integrations" | "agents" | "logic">("workflow")
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [copied, setCopied] = useState("")
  const [contextBanner, setContextBanner] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  // Phase 5: tick counter for bridge-driven populate — incremented by the bridge's
  // populate() to trigger the effect that commits state and fires the callback.
  const [populateTick, setPopulateTick] = useState(0)
  const { openUpgradeModal } = useUpgradeModal()
  const abortRef = useRef<AbortController | null>(null)
  // Holds the auto-generation payload until businessDesc state has propagated
  const autoGenPending = useRef<{ wt: string; cplx: string } | null>(null)
  const autoGenFired = useRef(false)
  // Always-current mirrors of mutable state — safe to read inside stable closures
  const businessDescRef = useRef(businessDesc)
  const workflowTypeRef = useRef(workflowType)
  const complexityRef = useRef(complexity)
  useEffect(() => { businessDescRef.current = businessDesc }, [businessDesc])
  useEffect(() => { workflowTypeRef.current = workflowType }, [workflowType])
  useEffect(() => { complexityRef.current = complexity }, [complexity])

  // Phase 5 — Bridge refs
  // populateIdeaRef: idea staged by the bridge before incrementing populateTick.
  // populateCompleteCallbackRef: onComplete stored by bridge's populate(); fired
  //   after React commits the setBusinessDesc state update.
  // generateCompleteCallbackRef: resolve stored by bridge's triggerGenerate();
  //   fired after SSE, save, and UI update are fully done.
  // latestDataRef: always-current mirror of data state for bridge-based save.
  const populateIdeaRef = useRef<string>("")
  const populateCompleteCallbackRef = useRef<(() => void) | null>(null)
  const generateCompleteCallbackRef = useRef<(() => void) | null>(null)
  const latestDataRef = useRef<AutomationData | null>(null)
  useEffect(() => { latestDataRef.current = data }, [data])

  // Phase 5 — Bridge populate effect
  // Runs after populateTick increments (staged by the bridge's populate() call).
  // Commits state from populateIdeaRef, then fires the onComplete callback after
  // React has rendered the new value — satisfying the populate.complete contract.
  useEffect(() => {
    const idea = populateIdeaRef.current
    if (!idea) return
    populateIdeaRef.current = ""
    setBusinessDesc(idea)
    setContextBanner(true)
    const cb = populateCompleteCallbackRef.current
    populateCompleteCallbackRef.current = null
    setTimeout(() => cb?.(), 50)
  }, [populateTick]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveToProject = useCallback(async (output: AutomationData): Promise<boolean> => {
    console.log("GENERATOR_AUDIT: generator=automation")
    const { saved } = await ensureProject({
      type: "automation",
      idea: businessDescRef.current || "Automation workflow",
      outputField: "automationOutput",
      output: output as unknown as Record<string, unknown>,
    })
    return saved
  }, [])

  // Check subscription tier
  useEffect(() => {
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription?.plan === "free") setIsLocked(true) })
      .catch(() => {})
  }, [])

  // Phase 0 — Restore previously-saved automation (no re-generation needed)
  // Must run before Phase 2 can fire; autoGenFired blocks any pending auto-gen.
  useEffect(() => {
    const saved = loadAutomationRestoreContext()
    if (!saved) return
    clearAutomationRestoreContext()
    clearGenerationContext()      // prevent Phase 1 from auto-generating
    autoGenFired.current = true  // block Phase 2 even if businessDesc state update fires
    const output = saved as AutomationData
    setData(output)
    setStep("done")
    setContextBanner(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Lifecycle sentinel — logs mount and unmount so we can confirm whether Phase 1 ever re-runs
  useEffect(() => {
    console.log("AUTOMATION_TRACE: [LIFECYCLE] AutomationBuilderPage MOUNTED | timestamp:", Date.now())
    return () => {
      console.log("AUTOMATION_TRACE: [LIFECYCLE] AutomationBuilderPage UNMOUNTED | timestamp:", Date.now())
    }
  }, [])

  // Phase 1 — Load context and hydrate state fields
  useEffect(() => {
    const _mountCtx = loadProjectContext()
    console.log(`GENERATOR_MOUNT | page=automation-builder | projectId=${_mountCtx?.projectId ?? "(none)"} | continuityMode=${_mountCtx?.continuityMode ?? "(none)"} | source=${_mountCtx?.source ?? "(none)"}`)
    console.log("AUTOMATION_TRACE: Page mounted | Phase 1 starting | checking consumePendingIntent('automation')")

    // Workspace signal queue: drain any signals that arrived before this page mounted.
    // These were stored by emitWorkspaceSignal when no automation subscriber was registered.
    // Must run BEFORE subscribeWorkspaceSignal (which is in the next effect).
    const queued = dequeueWorkspaceSignals("automation")
    for (const qs of queued) {
      if (qs.type === "populate" && qs.payload?.trim()) {
        console.log("AUTOMATION_TRACE: Draining queued populate signal | idea:", JSON.stringify(qs.payload.slice(0, 60)))
        cacheConsumedIdea("automation", qs.payload)
        setBusinessDesc(qs.payload)
        setContextBanner(true)
      }
    }

    // Primary: durable pending intent — written by Copilot before navigating.
    const intent = consumePendingIntent("automation")
    console.log("AUTOMATION_TRACE: Intent consumed | result:", JSON.stringify(intent))
    if (intent && intent.idea) {
      // Cache the idea so markPendingIntentAutoGenerate can recover it if generate_automation
      // fires after this intent has already been consumed (page already mounted).
      cacheConsumedIdea("automation", intent.idea)
      console.log("AUTOMATION_TRACE: Textarea populated | businessDesc set to:", JSON.stringify(intent.idea))
      setBusinessDesc(intent.idea)
      setContextBanner(true)
      if (intent.autoGenerate) {
        console.log("AUTOMATION_TRACE: autoGenerate=true | autoGenPending set | generation will fire in Phase 2")
        autoGenPending.current = { wt: "Lead Capture", cplx: "Intermediate" }
      } else {
        console.log("AUTOMATION_TRACE: autoGenerate=false | textarea populated | waiting for user to confirm generation")
      }
      return
    }
    // Fallback: generation context written by Business Intelligence page
    console.log("AUTOMATION_TRACE: No PendingIntent found | checking GenerationContext fallback")
    const ctx = loadGenerationContext()
    console.log("AUTOMATION_TRACE: GenerationContext loaded:", ctx ? "found (BI fallback)" : "not found — evaluating context before clearing")
    if (!ctx) {
      const isContinuation = _mountCtx?.continuityMode === "continuation" && !!_mountCtx?.projectId
      const ctxReason = !_mountCtx?.projectId
        ? "missing_project"
        : _mountCtx.continuityMode === "continuation"
          ? "continuation_context"
          : _mountCtx.continuityMode === "standalone"
            ? "standalone_context"
            : "stale_context"
      console.log(`CONTEXT_DECISION | preserve=${isContinuation} | reason=${ctxReason} | projectId=${_mountCtx?.projectId ?? "(none)"}`)
      if (!isContinuation) {
        console.log("AUTOMATION_TRACE: standalone mount — clearing stale project context")
        clearProjectContext()
      } else {
        console.log("AUTOMATION_TRACE: continuation context preserved — will reuse existing project")
      }
      return
    }
    clearGenerationContext()
    const desc = buildAutomationDesc(ctx)
    const wt = deriveWorkflowType(ctx.automations)
    console.log("AUTOMATION_TRACE: Textarea populated (BI fallback) | desc length:", desc.length, "| workflowType:", wt)
    setBusinessDesc(desc)
    setWorkflowType(wt)
    setContextBanner(true)
    autoGenPending.current = { wt, cplx: "Intermediate" }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2 — Start generation after state propagation is confirmed by businessDesc change
  useEffect(() => {
    if (!autoGenPending.current || !businessDesc.trim() || autoGenFired.current) {
      console.log("AUTOMATION_TRACE: Phase 2 | skipped |",
        "autoGenPending:", !!autoGenPending.current,
        "| businessDesc non-empty:", businessDesc.trim().length > 0,
        "| autoGenFired:", autoGenFired.current)
      return
    }
    console.log("AUTOMATION_TRACE: Generation started | businessDesc (first 120):", JSON.stringify(businessDesc.slice(0, 120)), "| workflowType:", autoGenPending.current.wt, "| complexity:", autoGenPending.current.cplx)
    autoGenFired.current = true
    const { wt, cplx } = autoGenPending.current
    autoGenPending.current = null
    generateWith(businessDesc, wt, cplx)
  }, [businessDesc]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Already-mounted: react to generate_automation fired after page open ──────
  // markPendingIntentAutoGenerate dispatches this event + writes a fresh PendingIntent
  // (with the recovered idea). Consume it and trigger generation directly.
  //
  // Phase 5 fix: stable listener with [] deps — avoids the race where the event
  // fires during a gap between old listener being removed and new one being added.
  // businessDescRef / workflowTypeRef / complexityRef give access to current values
  // without re-creating the listener on every state change.
  useEffect(() => {
    const handler = (e: Event) => {
      const { type } = (e as CustomEvent<{ type: string }>).detail
      console.log("AUTOMATION_TRACE: stageone:autoGenerate event received | type:", type)
      if (type !== "automation") {
        console.log("AUTOMATION_TRACE: stageone:autoGenerate event ignored | type is not 'automation'")
        return
      }
      const intent = consumePendingIntent("automation")
      console.log("AUTOMATION_TRACE: Intent consumed (post-mount event) | result:", JSON.stringify(intent))
      if (!intent) return
      const desc = intent.idea || businessDescRef.current
      console.log("AUTOMATION_TRACE: Textarea populated (post-mount event) | desc (first 120):", JSON.stringify(desc.slice(0, 120)))
      if (!desc.trim()) return
      if (!businessDescRef.current.trim()) {
        setBusinessDesc(desc)
        setContextBanner(true)
      }
      console.log("AUTOMATION_TRACE: Generation started (post-mount event) | workflowType:", workflowTypeRef.current, "| complexity:", complexityRef.current)
      setTimeout(() => generateWith(desc, workflowTypeRef.current, complexityRef.current), 100)
    }
    window.addEventListener("stageone:autoGenerate", handler)
    return () => window.removeEventListener("stageone:autoGenerate", handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Post-mount intent sync — handles the case where automation_idea fires while this page
  // is already mounted. The copilot now uses emitWorkspaceSignal (live delivery) instead of
  // the old stageone:intentUpdated CustomEvent + 300ms timeout hack.
  useEffect(() => {
    return subscribeWorkspaceSignal((signal) => {
      if (signal.target !== "automation") return
      if (signal.type === "populate" && signal.payload?.trim()) {
        console.log("AUTOMATION_TRACE: Live workspace signal received | type: populate | idea:", JSON.stringify(signal.payload.slice(0, 60)))
        cacheConsumedIdea("automation", signal.payload)
        setBusinessDesc(signal.payload)
        setContextBanner(true)
      }
    }, "automation")
  }, [subscribeWorkspaceSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 5 — Register bridge + controller on mount, unregister on unmount.
  // The bridge exposes this page's live handlers so automationController can delegate
  // without duplicating any generation logic.
  useEffect(() => {
    registerBridge({
      navigate: () => setLocation("/automation"),
      populate: (idea, onComplete) => {
        if (!idea) { onComplete(); return }
        populateIdeaRef.current = idea
        populateCompleteCallbackRef.current = onComplete
        setPopulateTick(t => t + 1)
      },
      triggerGenerate: (idea) => new Promise<void>((resolve) => {
        generateCompleteCallbackRef.current = resolve
        generateWith(idea, workflowTypeRef.current, complexityRef.current)
      }),
      save: async () => {
        if (latestDataRef.current) {
          await saveToProject(latestDataRef.current)
        }
      },
      getCurrentIdea: () => businessDescRef.current,
    })
    registerController('automation', automationController)
    return () => {
      unregisterBridge()
      unregisterController('automation')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const generateWith = async (desc: string, wt: string, cplx: string) => {
    if (!desc.trim()) return
    console.log("[CONFIRM_FLOW:4] generateWith called — about to fetch /api/generate/automation | desc length:", desc.length, "| workflowType:", wt, "| complexity:", cplx, "| timestamp:", Date.now())
    setGenError(""); setStep("generating"); setStreamText(""); setData(null); setSelectedNode(null)
    abortRef.current = new AbortController()
    let buffer = ""
    try {
      const res = await fetch("/api/generate/automation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ businessDescription: desc.trim(), workflowType: wt, complexity: cplx, language: lang }),
        signal: abortRef.current.signal,
      })
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}))
        if (errData.error === "UPGRADE_REQUIRED") {
          openUpgradeModal({ feature: errData.feature, featureLabel: errData.featureLabel, requiredPlan: errData.requiredPlan })
          setStep("idle")
          return
        }
      }
      if (!res.ok || !res.body) throw new Error("Request failed")
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
            if (msg.error) { setGenError(msg.error); setStep("idle"); return }
            if (msg.content) { buffer += msg.content; setStreamText(buffer) }
            if (msg.done && msg.data) {
              setData(msg.data)
              setStep("done")
              console.log("GENERATOR_AUDIT: generator=automation | generation completed")
              const saved = await saveToProject(msg.data as AutomationData)
              console.log("[CONFIRM_FLOW:5] generateWith complete — emitting automation.generated | saved:", saved, "| timestamp:", Date.now())
              emit({ type: "automation.generated", data: { saved } })
              // Phase 5: resolve the bridge's triggerGenerate Promise only after
              // SSE streaming, saveToProject, and UI update are fully done.
              const completeCb = generateCompleteCallbackRef.current
              generateCompleteCallbackRef.current = null
              completeCb?.()
            }
          } catch { /* fragment */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setGenError("Generation failed — please try again")
        setStep("idle")
      }
      // Phase 5: ensure bridge Promise resolves even on error so the controller
      // doesn't hang waiting for a completion that will never arrive.
      const completeCb = generateCompleteCallbackRef.current
      generateCompleteCallbackRef.current = null
      completeCb?.()
    }
  }

  // Single generation entry point for manual button clicks.
  // Delegates to generateWith so all paths (manual, Copilot, bridge) share
  // one implementation — matching the pattern used by Chatbot Generator.
  const generate = () => {
    generateWith(businessDescRef.current, workflowTypeRef.current, complexityRef.current)
  }

  const selectedNodeData = data?.nodes.find(n => n.id === selectedNode) ?? null

  const copyText = useCallback((key: string, text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(""), 2000) })
  }, [])

  const impactColor = (impact: string) =>
    impact === "high" ? "text-emerald-400" : impact === "medium" ? "text-amber-400" : "text-blue-400"

  const tierColor = (tier: string) =>
    tier === "required" ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : tier === "recommended" ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : "bg-white/5 text-muted-foreground border-white/10"

  return (
    <div className="flex h-screen bg-[#050505] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      {/* Locked overlay for free users */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ left: collapsed ? 64 : 220 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-primary/25 bg-[#0c0c0c] p-8 shadow-2xl mx-4"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                <Workflow className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">Automation Builder</h3>
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                    <Lock className="h-2.5 w-2.5" /> Pro
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to unlock this system</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Generate end-to-end automation workflows with a node-based canvas, AI agent configs, integration maps, and execution logic — auto-populated from your business intelligence.
            </p>
            <div className="rounded-xl border border-white/5 bg-white/2 p-4 mb-6 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3">Included with Pro</p>
              {["Auto-filled from business intelligence", "Node-based workflow canvas", "AI agent configuration", "Integration mapping (CRM, Email, Webhooks)", "Trigger & action logic builder", "Exportable automation spec"].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => openUpgradeModal()} className="flex w-full h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow">
              <Crown className="h-3.5 w-3.5" />
              Upgrade to Pro
            </button>
          </motion.div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        <div className="w-72 shrink-0 border-r border-white/5 bg-[#070707] flex flex-col overflow-y-auto">
          {/* Header */}
          <div className="p-5 border-b border-white/5">
            <div className="flex items-center gap-3 mb-1">
              <img src={stageoneIcon} alt="STAGEONE" className="h-7 w-7 object-contain" />
              <div>
                <h1 className="text-sm font-black text-foreground tracking-tight">Automation Builder</h1>
                <p className="text-[9px] text-muted-foreground tracking-widest uppercase">AI Workflow Engine</p>
              </div>
            </div>
            {contextBanner && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                <p className="text-[11px] text-primary/80 font-medium">Auto-filled from your business intelligence</p>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 space-y-5">
            {/* Business Description */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Business Description</label>
              <textarea
                value={businessDesc}
                onChange={e => setBusinessDesc(e.target.value)}
                placeholder="Describe your business model, industry, and processes..."
                rows={4}
                className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>

            {/* Workflow Type */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Workflow Type</label>
              <div className="grid grid-cols-1 gap-1.5">
                {WORKFLOW_TYPES.map(t => (
                  <button key={t} onClick={() => setWorkflowType(t)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-left transition-all border ${
                      workflowType === t
                        ? "bg-primary/12 border-primary/30 text-primary shadow-[inset_0_0_10px_rgba(212,175,55,0.05)]"
                        : "border-white/5 text-muted-foreground hover:text-foreground hover:border-white/10 hover:bg-white/3"
                    }`}>
                    <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${workflowType === t ? "rotate-90 text-primary" : ""}`} />
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Complexity */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Complexity</label>
              <div className="flex gap-2">
                {COMPLEXITIES.map(c => (
                  <button key={c} onClick={() => setComplexity(c)}
                    className={`flex-1 rounded-lg py-2 text-[10px] font-bold uppercase tracking-wider transition-all border ${
                      complexity === c
                        ? "bg-primary/12 border-primary/40 text-primary"
                        : "border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15"
                    }`}>
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {genError && (
              <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/8 p-3">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                <p className="text-xs text-rose-300">{genError}</p>
              </div>
            )}

            <button
              onClick={generate}
              disabled={!businessDesc.trim() || step === "generating"}
              className="w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-black uppercase tracking-wider hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] hover:shadow-[0_0_28px_rgba(212,175,55,0.4)] flex items-center justify-center gap-2"
            >
              {step === "generating" ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Generating...</>
              ) : (
                <><Zap className="h-4 w-4" />Generate Workflow</>
              )}
            </button>

            {/* Quick stats when done */}
            {data && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-2">
                <div className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-2">Workflow Stats</div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Nodes</span>
                  <span className="text-xs font-bold text-primary">{data.nodes.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Integrations</span>
                  <span className="text-xs font-bold text-primary">{data.integrations.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Complexity</span>
                  <span className="text-xs font-bold text-primary">{data.overview.complexityScore}/10</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">Est. Runtime</span>
                  <span className="text-xs font-bold text-foreground/70">{data.overview.executionEstimate}</span>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="flex items-center gap-4 border-b border-white/5 px-5 h-14 shrink-0">
            {data ? (
              <>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse" />
                  <span className="text-xs font-semibold text-foreground">{workflowType}</span>
                  <span className="text-[9px] text-muted-foreground">· {complexity}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="text-[10px] font-semibold text-primary">Score {data.overview.complexityScore}/10</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-full border border-white/8 px-3 py-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{data.overview.executionEstimate}</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Workflow className="h-4 w-4" />
                <span className="text-xs">Configure and generate your automation workflow</span>
              </div>
            )}

            {/* Tabs */}
            {data && (
              <div className="ml-auto flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
                {(["workflow", "integrations", "agents", "logic"] as const).map(tab => (
                  <button key={tab} onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                      activeTab === tab
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : "text-muted-foreground hover:text-foreground"
                    }`}>
                    {tab === "agents" ? "AI Agents" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden flex">
            {/* Main area */}
            <div className="flex-1 overflow-auto">
              {step === "idle" && !data && (
                <div className="flex items-center justify-center h-full">
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4 max-w-sm px-6">
                    <div className="mx-auto w-16 h-16 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center shadow-[0_0_30px_rgba(212,175,55,0.15)]">
                      <img src={stageoneIcon} alt="" className="h-9 w-9 object-contain" />
                    </div>
                    <div>
                      <h2 className="text-base font-black text-foreground mb-2">Build Intelligent Automation</h2>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Describe your business, choose a workflow type, and STAGEONE will design a complete AI-powered automation system with visual node diagrams, trigger logic, and integration recommendations.
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      {[
                        { icon: Zap, label: "Smart Triggers" },
                        { icon: Brain, label: "AI Agents" },
                        { icon: GitBranch, label: "Logic Flows" },
                      ].map(({ icon: Icon, label }) => (
                        <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-3 text-center">
                          <Icon className="h-4 w-4 text-primary mx-auto mb-1.5" />
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}

              {step === "generating" && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center space-y-5 max-w-xs px-6">
                    <div className="relative mx-auto w-16 h-16">
                      <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
                      <div className="absolute inset-1 rounded-full border border-primary/30 animate-spin" style={{ animationDuration: "2s" }} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Workflow className="h-6 w-6 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Designing Workflow...</p>
                      <p className="text-xs text-muted-foreground mt-1">{workflowType} · {complexity}</p>
                    </div>
                    {streamText && (
                      <div className="rounded-xl border border-white/8 bg-white/2 p-3 text-left max-h-32 overflow-hidden">
                        <p className="text-[10px] font-mono text-muted-foreground/60 line-clamp-5">{streamText.slice(-300)}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {step === "done" && data && (
                <AnimatePresence mode="wait">
                  {activeTab === "workflow" && (
                    <motion.div key="workflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                      {/* Overview */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { icon: Target, label: "Purpose", value: data.overview.purpose },
                          { icon: BarChart3, label: "Objective", value: data.overview.objective },
                          { icon: TrendingUp, label: "Expected Outcome", value: data.overview.expectedOutcome },
                        ].map(({ icon: Icon, label, value }) => (
                          <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-3">
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Icon className="h-3 w-3 text-primary" />
                              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{label}</span>
                            </div>
                            <p className="text-xs text-foreground/80 leading-relaxed">{value}</p>
                          </div>
                        ))}
                      </div>

                      {/* Node Canvas */}
                      <div className="rounded-2xl border border-white/8 bg-[#060606] overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/5 px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-xs font-semibold text-foreground">Visual Workflow</span>
                            <span className="text-[9px] text-muted-foreground">· {data.nodes.length} nodes · {data.edges.length} connections</span>
                          </div>
                          <div className="flex items-center gap-2">
                            {(["trigger", "action", "ai_agent", "crm"] as NodeType[]).map(t => (
                              <div key={t} className="flex items-center gap-1">
                                <div className={`h-1.5 w-1.5 rounded-full ${NODE_STYLES[t].badge}`} />
                                <span className="text-[8px] text-muted-foreground capitalize">{t.replace("_", " ")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="p-4 overflow-auto">
                          <WorkflowCanvas
                            nodes={data.nodes}
                            edges={data.edges}
                            selectedNode={selectedNode}
                            onSelectNode={id => setSelectedNode(id === selectedNode ? null : id)}
                          />
                        </div>
                        <div className="border-t border-white/5 px-4 py-2 text-[9px] text-muted-foreground/50">
                          Click any node to inspect · Animated dots show data flow direction
                        </div>
                      </div>

                      {/* Triggers */}
                      <div className="space-y-2">
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Trigger Events</div>
                        <div className="grid grid-cols-2 gap-2">
                          {data.triggers.map(t => (
                            <div key={t.id} className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                              <div className="flex items-center gap-2 mb-1">
                                <Zap className="h-3 w-3 text-amber-400" />
                                <span className="text-xs font-bold text-amber-300">{t.label}</span>
                              </div>
                              <div className="text-[9px] font-mono text-amber-500/60 mb-1">{t.event}</div>
                              <p className="text-[10px] text-muted-foreground">{t.description}</p>
                              {t.tool && <div className="mt-1.5 text-[9px] text-muted-foreground/50">via {t.tool}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "integrations" && (
                    <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        {data.integrations.map((intg, i) => {
                          const ToolIcon = TOOL_ICONS[intg.name] ?? TOOL_ICONS.default
                          return (
                            <motion.div key={intg.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                              className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div className="p-1.5 rounded-lg bg-white/5">
                                    <ToolIcon className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                  <span className="text-sm font-bold text-foreground">{intg.name}</span>
                                </div>
                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierColor(intg.tier)}`}>
                                  {intg.tier}
                                </span>
                              </div>
                              <div className="text-[9px] font-semibold text-muted-foreground/50 uppercase tracking-widest">{intg.category}</div>
                              <p className="text-xs text-muted-foreground leading-relaxed">{intg.role}</p>
                            </motion.div>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "agents" && (
                    <motion.div key="agents" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                      {/* Agent Config */}
                      <div className="rounded-2xl border border-violet-500/25 bg-violet-500/5 p-5 space-y-4"
                        style={{ boxShadow: "0 0 30px rgba(139,92,246,0.1)" }}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-violet-500/20">
                            <Brain className="h-5 w-5 text-violet-400" />
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-foreground">AI Agent Configuration</h3>
                            <p className="text-[10px] text-muted-foreground">Model: {data.agentConfig.modelRecommendation}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Objectives</div>
                            <ul className="space-y-1.5">
                              {data.agentConfig.objectives.map((o, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                                  <div className="h-1 w-1 rounded-full bg-violet-400 mt-1.5 shrink-0" />{o}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Behaviors</div>
                            <ul className="space-y-1.5">
                              {data.agentConfig.behaviors.map((b, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                                  <div className="h-1 w-1 rounded-full bg-violet-400 mt-1.5 shrink-0" />{b}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 border-t border-violet-500/15 pt-4">
                          <div>
                            <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Input Sources</div>
                            {data.agentConfig.inputSources.map((s, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] text-foreground/70 mb-1">
                                <ArrowRight className="h-2.5 w-2.5 text-violet-400" />{s}
                              </div>
                            ))}
                          </div>
                          <div>
                            <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Output Actions</div>
                            {data.agentConfig.outputActions.map((a, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-[10px] text-foreground/70 mb-1">
                                <ChevronRight className="h-2.5 w-2.5 text-violet-400" />{a}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* AI Opportunities */}
                      <div>
                        <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">AI Enhancement Opportunities</div>
                        <div className="space-y-2">
                          {data.aiOpportunities.map((opp, i) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                              className="flex items-start gap-3 rounded-xl border border-white/8 bg-white/2 p-3">
                              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className="text-xs font-bold text-foreground">{opp.type}</span>
                                  <span className={`text-[8px] font-black uppercase ${impactColor(opp.impact)}`}>{opp.impact} impact</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">{opp.description}</p>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === "logic" && (
                    <motion.div key="logic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-3">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Step-by-Step Automation Logic</div>
                      <div className="relative pl-4">
                        <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
                        {data.workflowLogic.map((step, i) => {
                          const nodeData = data.nodes.find(n => n.id === step.nodeId)
                          const nStyle = nodeData ? NODE_STYLES[nodeData.type] : NODE_STYLES.action
                          return (
                            <motion.div key={step.step} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.07 }}
                              className="relative mb-4">
                              <div className={`absolute -left-6 top-3 h-3 w-3 rounded-full border-2 ${nStyle.border} bg-[#070707]`}
                                style={{ boxShadow: `0 0 8px ${nStyle.glow}` }} />
                              <div className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-black text-primary/60">STEP {step.step}</span>
                                  {nodeData && <span className="text-[9px] text-muted-foreground/50">· {nodeData.label}</span>}
                                </div>
                                <p className="text-xs font-medium text-foreground/90">{step.action}</p>
                                {step.condition && (
                                  <div className="flex items-start gap-1.5 text-[10px] text-amber-400/80 bg-amber-500/5 rounded-lg px-2 py-1">
                                    <GitBranch className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span>If: {step.condition}</span>
                                  </div>
                                )}
                                {step.fallback && (
                                  <div className="flex items-start gap-1.5 text-[10px] text-rose-400/70 bg-rose-500/5 rounded-lg px-2 py-1">
                                    <Shield className="h-3 w-3 shrink-0 mt-0.5" />
                                    <span>Fallback: {step.fallback}</span>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )
                        })}
                      </div>

                      {/* Copy logic button */}
                      <button
                        onClick={() => copyText("logic", JSON.stringify(data.workflowLogic, null, 2))}
                        className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copied === "logic" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                        Copy Logic JSON
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>

            {/* Node detail side panel */}
            <AnimatePresence>
              {selectedNode && selectedNodeData && step === "done" && data && (
                <motion.div
                  key="node-panel"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 280, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  className="shrink-0 border-l border-white/5 bg-[#070707] overflow-hidden"
                >
                  <div className="w-[280px] h-full overflow-y-auto">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Node Inspector</span>
                      <button onClick={() => setSelectedNode(null)}
                        className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
                    </div>
                    <NodeDetailPanel node={selectedNodeData} logic={data.workflowLogic} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
