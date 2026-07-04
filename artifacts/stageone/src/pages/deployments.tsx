import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe, Bot, Workflow, MessageSquare, Hash, Phone,
  Plus, X, CheckCircle, AlertCircle, Clock, RotateCcw,
  ExternalLink, Trash2, Activity, Server, Loader,
  Shield, Terminal, Key,
  TrendingUp, Zap, BarChart3, Copy, Check,
  Cloud, Lock, Rocket,
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"

type DeployType = "website" | "chatbot" | "workflow" | "slack" | "discord" | "whatsapp"
type DeployStatus = "active" | "pending" | "failed" | "stopped" | "deploying"

interface EnvVar { key: string; value: string; secret: boolean }

interface Deployment {
  id: string
  name: string
  type: DeployType
  provider: string
  status: DeployStatus
  url?: string
  domain?: string
  environment: string
  logs?: Array<{ timestamp: string; level: string; message: string }>
  history?: Array<{ timestamp: string; action: string; status: string }>
  envVars?: EnvVar[]
  createdAt: string
  updatedAt: string
  uptime?: number
  requests?: number
  responseTime?: number
  region?: string
}

const TYPE_CONFIG: Record<DeployType, { label: string; icon: React.ElementType; color: string }> = {
  website:   { label: "Website",   icon: Globe,         color: "#6366F1" },
  chatbot:   { label: "Chatbot",   icon: Bot,           color: "#8B5CF6" },
  workflow:  { label: "Workflow",  icon: Workflow,      color: "#10B981" },
  slack:     { label: "Slack",     icon: Hash,          color: "#4A154B" },
  discord:   { label: "Discord",   icon: MessageSquare, color: "#5865F2" },
  whatsapp:  { label: "WhatsApp",  icon: Phone,         color: "#25D366" },
}

const STATUS_CONFIG: Record<DeployStatus, { label: string; color: string; icon: React.ElementType }> = {
  active:    { label: "Active",    color: "#10B981", icon: CheckCircle },
  pending:   { label: "Pending",   color: "#F59E0B", icon: Clock },
  failed:    { label: "Failed",    color: "#EF4444", icon: AlertCircle },
  stopped:   { label: "Stopped",   color: "#6B7280", icon: Activity },
  deploying: { label: "Deploying", color: "#6366F1", icon: Loader },
}

function MetricBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = Math.min((value / max) * 100, 100)
  return (
    <div className="h-1 rounded-full bg-white/8 overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-full rounded-full" style={{ background: color }} />
    </div>
  )
}

function UptimeBadge({ value }: { value: number }) {
  const color = value >= 99.9 ? "#10B981" : value >= 99 ? "#F59E0B" : "#EF4444"
  return (
    <div className="flex items-center gap-1" style={{ color }}>
      <div className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: color }} />
      <span className="text-[10px] font-black">{value.toFixed(2)}%</span>
    </div>
  )
}

export default function DeploymentsPage() {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [detail, setDetail] = useState<Deployment | null>(null)
  const [detailTab, setDetailTab] = useState<"overview" | "logs" | "envvars" | "history">("overview")
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newType, setNewType] = useState<DeployType>("website")
  const [newEnv, setNewEnv] = useState<"production" | "staging" | "preview">("production")
  const [creating, setCreating] = useState(false)
  const [rollingBack, setRollingBack] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<"all" | DeployStatus>("all")
  const [envKeyInput, setEnvKeyInput] = useState("")
  const [envValInput, setEnvValInput] = useState("")
  const [envSecret, setEnvSecret] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [showMetrics, setShowMetrics] = useState(true)
  useEffect(() => {
    fetch("/api/deployments", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.deployments?.length) setDeployments(d.deployments) })
      .catch(() => {})
  }, [])

  const handleCreate = async () => {
    if (!newName) return
    setCreating(true)
    try {
      const res = await fetch("/api/deployments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName, type: newType, environment: newEnv }),
      })
      const data = await res.json()
      if (data.deployment) {
        setDeployments(prev => [{ ...data.deployment, uptime: 100, requests: 0, responseTime: 0, region: "us-east-1", envVars: [] }, ...prev])
        setTimeout(async () => {
          const r = await fetch("/api/deployments", { credentials: "include" })
          const d = await r.json()
          if (d.deployments?.length) setDeployments(d.deployments)
        }, 3500)
      }
    } catch {
      const mock: Deployment = {
        id: Date.now().toString(), name: newName, type: newType, provider: "stageone-cloud",
        status: "pending", environment: newEnv, uptime: 0, requests: 0, responseTime: 0, region: "us-east-1",
        logs: [{ timestamp: "now", level: "info", message: "Deployment record created — export your project and connect a hosting provider to go live." }],
        history: [], envVars: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      }
      setDeployments(prev => [mock, ...prev])
    }
    setCreating(false); setShowCreate(false); setNewName("")
  }

  const handleRollback = async (id: string) => {
    setRollingBack(id)
    try { await fetch(`/api/deployments/${id}/rollback`, { method: "POST", credentials: "include" }) } catch {}
    setTimeout(() => setRollingBack(null), 1500)
  }

  const handleDelete = async (id: string) => {
    try { await fetch(`/api/deployments/${id}`, { method: "DELETE", credentials: "include" }) } catch {}
    setDeployments(prev => prev.filter(d => d.id !== id))
    if (detail?.id === id) setDetail(null)
  }

  const addEnvVar = () => {
    if (!detail || !envKeyInput) return
    const newVar = { key: envKeyInput, value: envValInput, secret: envSecret }
    const updated = { ...detail, envVars: [...(detail.envVars ?? []), newVar] }
    setDetail(updated)
    setDeployments(prev => prev.map(d => d.id === detail.id ? updated : d))
    setEnvKeyInput(""); setEnvValInput(""); setEnvSecret(false)
  }

  const removeEnvVar = (key: string) => {
    if (!detail) return
    const updated = { ...detail, envVars: detail.envVars?.filter(v => v.key !== key) ?? [] }
    setDetail(updated)
    setDeployments(prev => prev.map(d => d.id === detail.id ? updated : d))
  }

  const copyUrl = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopied(id); setTimeout(() => setCopied(null), 2000)
  }

  const filtered = activeFilter === "all" ? deployments : deployments.filter(d => d.status === activeFilter)
  const activeCount = deployments.filter(d => d.status === "active").length
  const totalRequests = deployments.reduce((s, d) => s + (d.requests ?? 0), 0)
  const avgUptime = deployments.filter(d => d.uptime != null).reduce((s, d, _, a) => s + (d.uptime ?? 0) / a.length, 0)

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">STAGEONE Cloud</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">{deployments.length} Deployments Tracked</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowMetrics(m => !m)}
              className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all">
              <BarChart3 className="h-3.5 w-3.5" />{showMetrics ? "Hide" : "Show"} Metrics
            </button>
            <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full">Simulation Mode</span>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-black text-xs font-black px-3 py-2 hover:bg-primary/90 transition-all">
              <Plus className="h-3.5 w-3.5" />New Deployment
            </button>
          </div>
        </div>

        {/* Simulation notice */}
        <div className="flex items-center gap-2.5 border-b border-white/5 bg-amber-500/4 px-6 py-2 shrink-0">
          <Server className="h-3 w-3 text-amber-400 shrink-0" />
          <p className="text-[10px] text-amber-400/80">
            Deployment records are tracked here. To go live, export your generated website or code and deploy via <strong>Vercel</strong>, <strong>Netlify</strong>, or your preferred provider — then update the URL in the deployment record.
          </p>
        </div>

        {/* Infrastructure Metrics Bar */}
        <AnimatePresence>
          {showMetrics && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/5 bg-[#070707] overflow-hidden shrink-0">
              <div className="px-6 py-3 grid grid-cols-4 gap-4">
                {[
                  { icon: CheckCircle, label: "Avg Uptime", value: `${avgUptime.toFixed(2)}%`, sub: "Last 30 days", color: "#10B981" },
                  { icon: Activity, label: "Total Requests", value: totalRequests.toLocaleString(), sub: "Across all deployments", color: "#6366F1" },
                  { icon: Zap, label: "Avg Response", value: `${Math.round(deployments.filter(d => d.responseTime).reduce((s, d, _, a) => s + (d.responseTime ?? 0) / a.length, 0))}ms`, sub: "P50 response time", color: "#F59E0B" },
                  { icon: Cloud, label: "Active Regions", value: [...new Set(deployments.map(d => d.region).filter(Boolean))].length.toString(), sub: "Global distribution", color: "#8B5CF6" },
                ].map(({ icon: Icon, label, value, sub, color }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="p-2 rounded-xl shrink-0" style={{ background: `${color}15` }}>
                      <Icon className="h-4 w-4" style={{ color }} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-foreground">{value}</p>
                      <p className="text-[9px] text-muted-foreground">{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Filter tabs */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "active", "deploying", "pending", "failed", "stopped"] as const).map(f => (
                <button key={f} onClick={() => setActiveFilter(f)}
                  className={`rounded-xl border px-3 py-1.5 text-xs font-bold capitalize transition-all ${
                    activeFilter === f ? "border-primary/30 bg-primary/10 text-primary" : "border-white/8 bg-white/2 text-muted-foreground hover:text-foreground"
                  }`}>
                  {f === "all" ? `All (${deployments.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${deployments.filter(d => d.status === f).length})`}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {filtered.length === 0 ? (
                <div className="text-center py-20">
                  <Cloud className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-foreground/60">No deployments yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Deploy your AI-powered business to STAGEONE Cloud</p>
                  <button onClick={() => setShowCreate(true)}
                    className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-primary text-black text-xs font-black px-4 py-2 hover:bg-primary/90 transition-all">
                    <Plus className="h-3.5 w-3.5" />Deploy Now
                  </button>
                </div>
              ) : filtered.map((dep, i) => {
                const typeConf = TYPE_CONFIG[dep.type]
                const statConf = STATUS_CONFIG[dep.status]
                const TypeIcon = typeConf.icon
                const StatIcon = statConf.icon
                return (
                  <motion.div key={dep.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className={`rounded-xl border bg-white/2 p-4 hover:border-white/15 transition-all cursor-pointer ${
                      detail?.id === dep.id ? "border-primary/30 bg-primary/3" : "border-white/8"
                    }`}
                    onClick={() => { setDetail(dep); setDetailTab("overview") }}>
                    <div className="flex items-center gap-4">
                      <div className="p-2 rounded-xl shrink-0" style={{ background: `${typeConf.color}15` }}>
                        <TypeIcon className="h-4 w-4" style={{ color: typeConf.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-foreground truncate">{dep.name}</p>
                          <span className="text-[8px] font-black uppercase border px-1.5 py-0.5 rounded shrink-0"
                            style={{ color: typeConf.color, borderColor: `${typeConf.color}30`, background: `${typeConf.color}10` }}>
                            {typeConf.label}
                          </span>
                          <span className="text-[8px] font-semibold text-muted-foreground capitalize border border-white/8 px-1.5 py-0.5 rounded shrink-0">
                            {dep.environment}
                          </span>
                          {dep.region && (
                            <span className="text-[8px] font-semibold text-muted-foreground/60 border border-white/5 px-1.5 py-0.5 rounded shrink-0">
                              {dep.region}
                            </span>
                          )}
                        </div>
                        {dep.url && (
                          <div className="flex items-center gap-1 group/url">
                            <a href={dep.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                              className="text-[10px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
                              <ExternalLink className="h-2.5 w-2.5" />{dep.url}
                            </a>
                            <button onClick={e => { e.stopPropagation(); copyUrl(dep.url!, dep.id) }}
                              className="opacity-0 group-hover/url:opacity-100 transition-opacity">
                              {copied === dep.id ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5 text-muted-foreground/40" />}
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-5 shrink-0">
                        {dep.uptime != null && dep.status === "active" && (
                          <div className="text-right">
                            <UptimeBadge value={dep.uptime} />
                            <p className="text-[9px] text-muted-foreground/40">Uptime</p>
                          </div>
                        )}
                        {dep.responseTime != null && dep.status === "active" && (
                          <div className="text-right">
                            <p className="text-[10px] font-black text-foreground">{dep.responseTime}ms</p>
                            <p className="text-[9px] text-muted-foreground/40">Latency</p>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: statConf.color }}>
                          <StatIcon className={`h-3.5 w-3.5 ${dep.status === "deploying" ? "animate-spin" : ""}`} />
                          {statConf.label}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={e => { e.stopPropagation(); handleRollback(dep.id) }}
                            disabled={rollingBack === dep.id || dep.status !== "active"}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all disabled:opacity-30" title="Rollback">
                            <RotateCcw className={`h-3.5 w-3.5 ${rollingBack === dep.id ? "animate-spin" : ""}`} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleDelete(dep.id) }}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                    {dep.status === "active" && dep.uptime != null && (
                      <div className="mt-3 pt-3 border-t border-white/5">
                        <MetricBar value={dep.uptime} color="#10B981" />
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Detail Panel */}
          <AnimatePresence>
            {detail && (
              <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                className="shrink-0 border-l border-white/5 bg-[#070707] overflow-hidden flex flex-col">
                {/* Detail header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
                  {(() => {
                    const tc = TYPE_CONFIG[detail.type]
                    const TIcon = tc.icon
                    return (
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl shrink-0" style={{ background: `${tc.color}15` }}>
                          <TIcon className="h-4 w-4" style={{ color: tc.color }} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-foreground truncate max-w-[180px]">{detail.name}</p>
                          <p className="text-[9px] text-muted-foreground capitalize">{detail.environment} · {detail.region ?? "us-east-1"}</p>
                        </div>
                      </div>
                    )
                  })()}
                  <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Detail tabs */}
                <div className="flex border-b border-white/5 shrink-0">
                  {(["overview", "logs", "envvars", "history"] as const).map(t => (
                    <button key={t} onClick={() => setDetailTab(t)}
                      className={`flex-1 py-2 text-[10px] font-bold capitalize transition-all ${
                        detailTab === t ? "text-primary border-b border-primary" : "text-muted-foreground hover:text-foreground"
                      }`}>
                      {t === "envvars" ? "Env Vars" : t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                  {detailTab === "overview" && (() => {
                    const sc = STATUS_CONFIG[detail.status]
                    const SIcon = sc.icon
                    return (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 p-2.5 rounded-xl" style={{ background: `${sc.color}10`, border: `1px solid ${sc.color}25` }}>
                          <SIcon className={`h-4 w-4 ${detail.status === "deploying" ? "animate-spin" : ""}`} style={{ color: sc.color }} />
                          <span className="text-xs font-bold" style={{ color: sc.color }}>{sc.label}</span>
                        </div>
                        {detail.uptime != null && (
                          <div className="rounded-xl border border-white/8 bg-white/2 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] text-muted-foreground">Uptime (30d)</span>
                              <UptimeBadge value={detail.uptime} />
                            </div>
                            <MetricBar value={detail.uptime} color="#10B981" />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Requests", value: (detail.requests ?? 0).toLocaleString(), icon: TrendingUp, color: "#6366F1" },
                            { label: "Response", value: `${detail.responseTime ?? 0}ms`, icon: Zap, color: "#F59E0B" },
                          ].map(({ label, value, icon: Icon, color }) => (
                            <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-3">
                              <Icon className="h-3.5 w-3.5 mb-1.5" style={{ color }} />
                              <p className="text-sm font-black text-foreground">{value}</p>
                              <p className="text-[9px] text-muted-foreground">{label}</p>
                            </div>
                          ))}
                        </div>
                        {[
                          { label: "Provider", value: "STAGEONE Cloud" },
                          { label: "Region", value: detail.region ?? "us-east-1" },
                          { label: "Domain", value: detail.domain ?? detail.url ?? "—" },
                          { label: "Environment", value: detail.environment },
                          { label: "Deployed", value: new Date(detail.createdAt).toLocaleDateString() },
                        ].map(({ label, value }) => (
                          <div key={label} className="flex justify-between items-center py-2 border-b border-white/4">
                            <span className="text-[10px] text-muted-foreground">{label}</span>
                            <span className="text-[10px] font-bold text-foreground max-w-[170px] truncate text-right">{value}</span>
                          </div>
                        ))}
                        <div className="flex gap-2 pt-2">
                          <button onClick={() => handleRollback(detail.id)}
                            disabled={rollingBack === detail.id || detail.status !== "active"}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-white/10 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all disabled:opacity-30">
                            <RotateCcw className="h-3.5 w-3.5" />Rollback
                          </button>
                          {detail.url && (
                            <a href={detail.url} target="_blank" rel="noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary/10 border border-primary/20 py-2 text-xs font-bold text-primary hover:bg-primary/20 transition-all">
                              <ExternalLink className="h-3.5 w-3.5" />Visit
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  {detailTab === "logs" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Terminal className="h-3.5 w-3.5 text-emerald-400" />
                        <span className="text-xs font-bold text-foreground">Deployment Logs</span>
                      </div>
                      <div className="rounded-xl border border-white/5 bg-black/40 p-3 font-mono space-y-1.5">
                        {(detail.logs ?? []).length === 0 ? (
                          <p className="text-[10px] text-muted-foreground/40">No logs yet</p>
                        ) : (detail.logs ?? []).map((log, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-[9px] text-muted-foreground/30 shrink-0 mt-0.5">{log.timestamp}</span>
                            <div className={`h-1.5 w-1.5 rounded-full mt-1.5 shrink-0 ${log.level === "error" ? "bg-rose-400" : log.level === "warn" ? "bg-amber-400" : "bg-emerald-400"}`} />
                            <p className="text-[10px] text-muted-foreground leading-relaxed">{log.message}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {detailTab === "envvars" && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Key className="h-3.5 w-3.5 text-amber-400" />
                        <span className="text-xs font-bold text-foreground">Environment Variables</span>
                      </div>
                      <div className="space-y-1.5">
                        {(detail.envVars ?? []).map(v => (
                          <div key={v.key} className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/2 px-3 py-2">
                            {v.secret && <Lock className="h-3 w-3 text-amber-400/60 shrink-0" />}
                            <span className="text-[10px] font-bold text-foreground flex-1 truncate">{v.key}</span>
                            <span className="text-[10px] text-muted-foreground/50 font-mono truncate max-w-[80px]">
                              {v.secret ? "••••••••" : v.value}
                            </span>
                            <button onClick={() => removeEnvVar(v.key)} className="text-muted-foreground/30 hover:text-rose-400 transition-colors shrink-0">
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-2">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Add Variable</p>
                        <input value={envKeyInput} onChange={e => setEnvKeyInput(e.target.value)} placeholder="KEY"
                          className="w-full rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 font-mono" />
                        <input value={envValInput} onChange={e => setEnvValInput(e.target.value)} placeholder="value"
                          className="w-full rounded-lg border border-white/8 bg-white/3 px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30" />
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <div onClick={() => setEnvSecret(s => !s)}
                              className={`w-8 h-4 rounded-full transition-colors flex items-center ${envSecret ? "bg-amber-400" : "bg-white/10"}`}>
                              <div className={`h-3 w-3 rounded-full bg-white transition-transform mx-0.5 ${envSecret ? "translate-x-4" : ""}`} />
                            </div>
                            <span className="text-[10px] text-muted-foreground">Secret</span>
                          </label>
                          <button onClick={addEnvVar} disabled={!envKeyInput}
                            className="rounded-lg bg-primary/80 text-black text-[10px] font-black px-3 py-1.5 disabled:opacity-40 hover:bg-primary transition-all">
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {detailTab === "history" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-xs font-bold text-foreground">Deployment History</span>
                      </div>
                      {(detail.history ?? []).length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/40">No history yet</p>
                      ) : (detail.history ?? []).map((h, i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/2 px-3 py-2.5">
                          <div className={`h-2 w-2 rounded-full shrink-0 ${h.status === "active" ? "bg-emerald-400" : "bg-muted-foreground/30"}`} />
                          <span className="text-[10px] font-bold text-foreground capitalize flex-1">{h.action}</span>
                          <span className="text-[9px] text-muted-foreground/40">{new Date(h.timestamp).toLocaleDateString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[460px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 z-50 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-foreground">Deploy to STAGEONE Cloud</h3>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Your infrastructure, fully managed</p>
                </div>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Deployment Name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Business Site"
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Deployment Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {Object.entries(TYPE_CONFIG).map(([key, { label, icon: Icon, color }]) => (
                      <button key={key} onClick={() => setNewType(key as DeployType)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all ${
                          newType === key ? "border-primary/40 bg-primary/8" : "border-white/8 hover:border-white/15"
                        }`}>
                        <Icon className="h-4 w-4" style={{ color: newType === key ? color : "#666" }} />
                        <span className="text-[10px] font-semibold text-muted-foreground">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Environment</label>
                  <div className="flex gap-2">
                    {(["production", "staging", "preview"] as const).map(env => (
                      <button key={env} onClick={() => setNewEnv(env)}
                        className={`flex-1 rounded-xl border py-2 text-xs font-semibold capitalize transition-all ${
                          newEnv === env ? "border-primary/30 bg-primary/10 text-primary" : "border-white/8 text-muted-foreground hover:text-foreground"
                        }`}>{env}</button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-white/5 bg-white/2 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-3.5 w-3.5 text-emerald-400" />
                    <p className="text-[10px] font-bold text-foreground">Included with STAGEONE Cloud</p>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {["Auto-scaling", "DDoS protection", "SSL/TLS", "Global CDN", "99.9% SLA", "24/7 monitoring"].map(f => (
                      <div key={f} className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                        <CheckCircle className="h-2.5 w-2.5 text-emerald-400 shrink-0" />{f}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleCreate} disabled={!newName || creating}
                className="w-full rounded-xl bg-primary text-black py-2.5 text-sm font-black uppercase tracking-wider hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {creating ? <><Loader className="h-4 w-4 animate-spin" />Deploying...</> : <><Rocket className="h-4 w-4" />Deploy to Cloud</>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
