import { useState, useMemo, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Workflow, Zap, Brain, Bell, Database, Globe, Webhook,
  Mail, MessageSquare, CreditCard, Ticket, Play, RefreshCw,
  Copy, Check, Layers, GitBranch, Cpu,
  BarChart3, Shield, ArrowRight, Sparkles, Settings2,
  Activity, Target, Clock, TrendingUp, ChevronRight, AlertCircle,
} from "lucide-react"
import { useLocation } from "wouter"

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_STYLES: Record<NodeType, { bg: string; border: string; icon: React.ElementType; glow: string; badge: string }> = {
  trigger:      { bg: "bg-amber-500/10",   border: "border-amber-500/40",   icon: Zap,      glow: "rgba(245,158,11,0.3)",  badge: "bg-amber-500" },
  action:       { bg: "bg-blue-500/10",    border: "border-blue-500/40",    icon: Play,     glow: "rgba(59,130,246,0.3)",  badge: "bg-blue-500" },
  ai_agent:     { bg: "bg-violet-500/10",  border: "border-violet-500/40",  icon: Brain,    glow: "rgba(139,92,246,0.35)", badge: "bg-violet-500" },
  notification: { bg: "bg-orange-500/10",  border: "border-orange-500/40",  icon: Bell,     glow: "rgba(249,115,22,0.3)",  badge: "bg-orange-500" },
  crm:          { bg: "bg-emerald-500/10", border: "border-emerald-500/40", icon: Database, glow: "rgba(16,185,129,0.3)",  badge: "bg-emerald-500" },
  database:     { bg: "bg-cyan-500/10",    border: "border-cyan-500/40",    icon: Database, glow: "rgba(6,182,212,0.3)",   badge: "bg-cyan-500" },
  webhook:      { bg: "bg-rose-500/10",    border: "border-rose-500/40",    icon: Webhook,  glow: "rgba(244,63,94,0.3)",   badge: "bg-rose-500" },
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

const NODE_W = 200
const NODE_H = 92
const COL_GAP = 80
const ROW_GAP = 20

// ─── Layout engine ────────────────────────────────────────────────────────────

function layoutNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]) {
  if (!nodes.length) return {}
  const inDegree: Record<string, number> = {}
  const outMap: Record<string, string[]> = {}
  nodes.forEach(n => { inDegree[n.id] = 0; outMap[n.id] = [] })
  edges.forEach(e => {
    inDegree[e.to] = (inDegree[e.to] || 0) + 1
    outMap[e.from] = [...(outMap[e.from] || []), e.to]
  })
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

// ─── Animated dot ─────────────────────────────────────────────────────────────

function FlowDot({ d, delay }: { d: string; delay: number }) {
  return (
    <circle r={3} fill="#D4AF37" opacity={0.85}>
      <animateMotion path={d} dur="1.8s" repeatCount="indefinite" begin={`${delay}s`} />
    </circle>
  )
}

// ─── WorkflowCanvas ───────────────────────────────────────────────────────────

function WorkflowCanvas({ nodes, edges, selectedNode, onSelectNode }: {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  selectedNode: string | null
  onSelectNode: (id: string) => void
}) {
  const pos = useMemo(() => layoutNodes(nodes, edges), [nodes, edges])

  if (!nodes.length) return (
    <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">No nodes to display</div>
  )

  const minX = Math.min(...Object.values(pos).map(p => p.x))
  const maxX = Math.max(...Object.values(pos).map(p => p.x)) + NODE_W
  const minY = Math.min(...Object.values(pos).map(p => p.y))
  const maxY = Math.max(...Object.values(pos).map(p => p.y)) + NODE_H
  const padX = 40; const padY = 60
  const canvasW = maxX - minX + padX * 2
  const canvasH = Math.max(maxY - minY + padY * 2, 320)
  const ox = padX - minX
  const oy = padY - minY + (canvasH - (maxY - minY + padY * 2)) / 2

  const edgePaths = edges.map((e, i) => {
    const from = pos[e.from]; const to = pos[e.to]
    if (!from || !to) return null
    const x1 = from.x + ox + NODE_W; const y1 = from.y + oy + NODE_H / 2
    const x2 = to.x + ox;           const y2 = to.y + oy + NODE_H / 2
    const cx = (x1 + x2) / 2
    const d = `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
    return { d, key: `${e.from}-${e.to}-${i}`, label: e.label, midX: cx, midY: (y1 + y2) / 2 }
  }).filter(Boolean)

  return (
    <div className="relative overflow-auto" style={{ minHeight: 320 }}>
      <svg width={canvasW} height={canvasH} className="absolute inset-0 pointer-events-none" style={{ minWidth: canvasW, minHeight: canvasH }}>
        <defs>
          <marker id="arrow-panel" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#D4AF37" opacity={0.6} />
          </marker>
        </defs>
        {edgePaths.map(ep => ep && (
          <g key={ep.key}>
            <path d={ep.d} fill="none" stroke="#D4AF37" strokeWidth={1.5} strokeOpacity={0.25} markerEnd="url(#arrow-panel)" />
            <path d={ep.d} fill="none" stroke="#D4AF37" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="4 6">
              <animate attributeName="stroke-dashoffset" from="0" to="-20" dur="1.2s" repeatCount="indefinite" />
            </path>
            <FlowDot d={ep.d} delay={Math.random() * 1.5} />
            {ep.label && (
              <text x={ep.midX} y={ep.midY - 6} textAnchor="middle" fill="#D4AF37" fontSize={9} opacity={0.7} fontFamily="monospace">{ep.label}</text>
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
            <motion.div key={node.id}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: "easeOut" }}
              onClick={() => onSelectNode(node.id)}
              className={`absolute cursor-pointer rounded-xl border ${style.bg} ${style.border} p-3 transition-all duration-200 hover:scale-105 select-none ${isSelected ? "ring-2 ring-[#D4AF37] ring-offset-1 ring-offset-transparent" : ""}`}
              style={{ left: p.x + ox, top: p.y + oy, width: NODE_W, height: NODE_H, boxShadow: isSelected ? `0 0 20px ${style.glow}` : `0 0 8px ${style.glow}50` }}>
              <div className="flex items-start gap-2 h-full">
                <div className={`p-1.5 rounded-lg ${style.badge}/20 shrink-0 mt-0.5`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[8px] font-black tracking-widest uppercase mb-0.5 opacity-60">{NODE_TYPE_LABELS[node.type]}</div>
                  <div className="text-xs font-bold text-foreground leading-tight truncate">{node.label}</div>
                  {node.tool && <div className="text-[9px] text-muted-foreground mt-0.5 truncate">{node.tool}</div>}
                  {node.description && <div className="text-[9px] text-muted-foreground/70 mt-1 line-clamp-2 leading-tight">{node.description}</div>}
                </div>
              </div>
              {isSelected && <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.8)] animate-pulse" />}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}

// ─── NodeDetailPanel ──────────────────────────────────────────────────────────

function NodeDetailPanel({ node, logic }: { node: WorkflowNode; logic: LogicStep[] }) {
  const style = NODE_STYLES[node.type] || NODE_STYLES.action
  const Icon = style.icon
  const steps = logic.filter(s => s.nodeId === node.id)
  return (
    <div className="p-4 space-y-3">
      <div className={`flex items-center gap-2.5 rounded-xl border ${style.border} ${style.bg} p-3`} style={{ boxShadow: `0 0 12px ${style.glow}40` }}>
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

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface AutomationPanelProps {
  automationOutput: Record<string, unknown>
  onRegenerate?: () => void
}

export function AutomationPanel({ automationOutput, onRegenerate }: AutomationPanelProps) {
  const [, setLocation] = useLocation()
  const data = automationOutput as unknown as AutomationData

  const [activeTab, setActiveTab] = useState<"workflow" | "integrations" | "agents" | "logic">("workflow")
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [copied, setCopied] = useState("")

  const selectedNodeData = data.nodes?.find(n => n.id === selectedNode) ?? null

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
    <div className="flex flex-col h-full bg-[#050505] text-foreground overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-4 border-b border-white/5 px-5 h-14 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] animate-pulse" />
          <span className="text-xs font-semibold text-foreground">{data.overview?.purpose?.slice(0, 60) ?? "Automation Workflow"}</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1">
          <Activity className="h-3 w-3 text-primary" />
          <span className="text-[10px] font-semibold text-primary">Score {data.overview?.complexityScore ?? "–"}/10</span>
        </div>
        <div className="flex items-center gap-1.5 rounded-full border border-white/8 px-3 py-1">
          <Clock className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">{data.overview?.executionEstimate ?? "–"}</span>
        </div>

        {/* Tabs */}
        <div className="ml-auto flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
          {(["workflow", "integrations", "agents", "logic"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${activeTab === tab ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"}`}>
              {tab === "agents" ? "AI Agents" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {onRegenerate && (
          <button onClick={onRegenerate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all">
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        )}
        <button onClick={() => setLocation("/automation-builder")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all">
          Open Builder
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        <div className="flex-1 overflow-auto">
          <AnimatePresence mode="wait">

            {activeTab === "workflow" && (
              <motion.div key="workflow" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                {/* Overview */}
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Target,      label: "Purpose",          value: data.overview?.purpose },
                    { icon: BarChart3,   label: "Objective",        value: data.overview?.objective },
                    { icon: TrendingUp,  label: "Expected Outcome", value: data.overview?.expectedOutcome },
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
                      <span className="text-[9px] text-muted-foreground">· {data.nodes?.length ?? 0} nodes · {data.edges?.length ?? 0} connections</span>
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
                      nodes={data.nodes ?? []}
                      edges={data.edges ?? []}
                      selectedNode={selectedNode}
                      onSelectNode={id => setSelectedNode(id === selectedNode ? null : id)}
                    />
                  </div>
                  <div className="border-t border-white/5 px-4 py-2 text-[9px] text-muted-foreground/50">
                    Click any node to inspect · Animated dots show data flow direction
                  </div>
                </div>

                {/* Triggers */}
                {(data.triggers ?? []).length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Trigger Events</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(data.triggers ?? []).map(t => (
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
                )}
              </motion.div>
            )}

            {activeTab === "integrations" && (
              <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(data.integrations ?? []).map((intg, i) => {
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
                          <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${tierColor(intg.tier)}`}>{intg.tier}</span>
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
                {data.agentConfig && (
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
                          {(data.agentConfig.objectives ?? []).map((o, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-foreground/80">
                              <div className="h-1 w-1 rounded-full bg-violet-400 mt-1.5 shrink-0" />{o}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Behaviors</div>
                        <ul className="space-y-1.5">
                          {(data.agentConfig.behaviors ?? []).map((b, i) => (
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
                        {(data.agentConfig.inputSources ?? []).map((s, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-foreground/70 mb-1">
                            <ArrowRight className="h-2.5 w-2.5 text-violet-400" />{s}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Output Actions</div>
                        {(data.agentConfig.outputActions ?? []).map((a, i) => (
                          <div key={i} className="flex items-center gap-1.5 text-[10px] text-foreground/70 mb-1">
                            <ChevronRight className="h-2.5 w-2.5 text-violet-400" />{a}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {(data.aiOpportunities ?? []).length > 0 && (
                  <div>
                    <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">AI Enhancement Opportunities</div>
                    <div className="space-y-2">
                      {(data.aiOpportunities ?? []).map((opp, i) => (
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
                )}
              </motion.div>
            )}

            {activeTab === "logic" && (
              <motion.div key="logic" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-3">
                <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1">Step-by-Step Automation Logic</div>
                <div className="relative pl-4">
                  <div className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-primary/40 via-primary/20 to-transparent" />
                  {(data.workflowLogic ?? []).map((step, i) => {
                    const nodeData = data.nodes?.find(n => n.id === step.nodeId)
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
        </div>

        {/* Node detail side panel */}
        <AnimatePresence>
          {selectedNode && selectedNodeData && (
            <motion.div key="node-panel"
              initial={{ width: 0, opacity: 0 }} animate={{ width: 280, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="shrink-0 border-l border-white/5 bg-[#070707] overflow-hidden">
              <div className="w-[280px] h-full overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Node Inspector</span>
                  <button onClick={() => setSelectedNode(null)} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">×</button>
                </div>
                <NodeDetailPanel node={selectedNodeData} logic={data.workflowLogic ?? []} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Empty state (no automation yet) ─────────────────────────────────────────

export function AutomationEmptyPanel({ biData, onNavigate }: {
  biData: { automations?: string[] } | null
  onNavigate: () => void
}) {
  return (
    <div className="p-6 space-y-5">
      {biData?.automations?.length ? (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Workflow className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-foreground">Recommended Automations (from Analysis)</h3>
          </div>
          <div className="space-y-2">
            {biData.automations.map((auto, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 rounded-lg bg-secondary/20 px-4 py-3">
                <Zap className="h-3.5 w-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{auto}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Open the Automation Builder to generate a full workflow and save it to this project.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No automation yet.</p>
          <p className="text-xs text-muted-foreground">Generate a business analysis first to see recommended automations.</p>
        </div>
      )}
      <button
        onClick={onNavigate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <Workflow className="h-4 w-4 text-orange-400" />
        Open Automation Builder
      </button>
    </div>
  )
}
