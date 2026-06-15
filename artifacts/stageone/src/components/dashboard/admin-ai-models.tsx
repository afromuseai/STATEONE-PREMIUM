import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Cpu, RefreshCw, CheckCircle2, X, AlertTriangle, AlertCircle,
  TrendingUp, Zap, DollarSign, BarChart3, Activity, Shield,
  ArrowRight, Clock, Users, FolderOpen, Bot, Layers,
  ChevronDown, Circle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────
interface ModelPerf {
  model: string; provider: string; requests: number; success: number; failures: number
  successPct: number; avgLatencyMs: number; p95LatencyMs: number; p99LatencyMs: number
  totalTokens: number; estimatedCost: number
}
interface DailyToken { day: string; totalTokens: number; totalCost: number; requests: number }
interface ByFeature  { feature: string; totalTokens: number; requests: number; totalCost: number }
interface ByModel    { model: string;   totalTokens: number; requests: number; totalCost: number }
interface RouteEntry { feature: string; model: string; key: string; requests: number; failures: number; avgLatency: number }
interface AutoAlert  { type: string; severity: string; title: string; message: string }

interface AiModelsData {
  overview: {
    totalRequests24h: number; totalTokensToday: number; estimatedCostToday: number
    activeModels24h: number;  successRate24h: number
    totalRequests30d: number; totalTokens30d: number; estimatedCost30d: number
  }
  modelPerformance: ModelPerf[]
  dailyTokens:      DailyToken[]
  tokensByFeature:  ByFeature[]
  tokensByModel:    ByModel[]
  costIntelligence: {
    estimatedMonthlySpend: number; estimatedAnnualSpend: number
    mostExpensiveUsers:    Array<{ userId: string; totalCost: number; requests: number; tokens: number }>
    mostExpensiveProjects: Array<{ projectId: string; totalCost: number; requests: number; tokens: number }>
  }
  routingMap:  RouteEntry[]
  alerts:      AutoAlert[]
  meta:        { computedAt: string }
}

type Section = "overview" | "performance" | "tokens" | "cost" | "routing" | "alerts"

const SECTION_TABS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",     label: "Overview",       icon: BarChart3 },
  { id: "performance",  label: "Performance",    icon: Activity },
  { id: "tokens",       label: "Token Analytics", icon: Zap },
  { id: "cost",         label: "Cost Intel",     icon: DollarSign },
  { id: "routing",      label: "Routing Map",    icon: Layers },
  { id: "alerts",       label: "AI Alerts",      icon: AlertTriangle },
]

// ─── Short model name ─────────────────────────────────────────────────────────
function shortModel(model: string) {
  const parts = model.split("/")
  return parts[parts.length - 1] ?? model
}

function fmtMs(ms: number) {
  if (ms === 0) return "—"
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

function fmtTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function fmtCost(n: number) {
  if (n === 0) return "$0.00"
  if (n < 0.01) return `$${n.toFixed(4)}`
  return `$${n.toFixed(2)}`
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

function SeverityBadge({ severity }: { severity: string }) {
  const s: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/25",
    warning:  "bg-amber-500/15 text-amber-400 border-amber-500/25",
    info:     "bg-blue-500/15 text-blue-400 border-blue-500/25",
  }
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${s[severity] ?? s.info}`}>{severity}</span>
}

// ─── Provider color dot ───────────────────────────────────────────────────────
function ProviderDot({ model }: { model: string }) {
  const colors: Record<string, string> = {
    qwen: "bg-violet-400", nvidia: "bg-green-400", meta: "bg-blue-400",
    deepseek: "bg-cyan-400", stepfun: "bg-amber-400",
  }
  const vendor = model.split("/")[0] ?? ""
  return <span className={`h-2 w-2 rounded-full flex-shrink-0 ${colors[vendor] ?? "bg-slate-400"}`} />
}

// ─── Bar spark ───────────────────────────────────────────────────────────────
function Bar({ pct, color = "#6366F1" }: { pct: number; color?: string }) {
  return (
    <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(pct, 100)}%` }}
        transition={{ duration: 0.5 }} className="h-full rounded-full" style={{ background: color }} />
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────
function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="py-16 text-center space-y-3">
      <Icon className="h-8 w-8 mx-auto text-muted-foreground/25" />
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export function AdminAiModels() {
  const [data, setData]           = useState<AiModelsData | null>(null)
  const [section, setSection]     = useState<Section>("overview")
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [toastMsg, setToastMsg]   = useState<string | null>(null)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(null), 3000) }

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const res = await fetch("/api/admin/ai-models", { credentials: "include" })
      if (res.ok) setData(await res.json() as AiModelsData)
    } catch { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { load() }, [load])

  const maxTokenDay   = data ? Math.max(...data.dailyTokens.map(d => d.totalTokens), 1) : 1
  const maxTokenFeat  = data ? Math.max(...data.tokensByFeature.map(f => f.totalTokens), 1) : 1
  const maxTokenModel = data ? Math.max(...data.tokensByModel.map(m => m.totalTokens), 1) : 1
  const activeAlerts  = data?.alerts.filter(a => !dismissed.has(a.type)) ?? []

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-4 relative">

      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-[#0a0a0a] text-xs font-bold text-foreground shadow-2xl">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <Cpu className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">AI Model Monitor</h2>
          {data && <span className="text-[10px] text-muted-foreground">Updated {new Date(data.meta.computedAt).toLocaleTimeString()}</span>}
        </div>
        <button onClick={() => load()} disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
          <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />Refresh
        </button>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 flex-wrap">
        {SECTION_TABS.map(tab => {
          const Icon  = tab.icon
          const badge = tab.id === "alerts" && activeAlerts.length > 0 ? activeAlerts.length : null
          return (
            <button key={tab.id} onClick={() => setSection(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${section === tab.id ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3 w-3" />{tab.label}
              {badge && <span className="h-4 w-4 flex items-center justify-center rounded-full bg-red-500/80 text-[9px] font-black text-white">{badge}</span>}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          1. OVERVIEW
      ═══════════════════════════════════════════════════════════════ */}
      {section === "overview" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* 4 metric cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "AI Requests (24h)",   value: data?.overview.totalRequests24h.toLocaleString() ?? "0", icon: Activity,   color: "text-foreground" },
              { label: "Tokens Today",         value: fmtTokens(data?.overview.totalTokensToday ?? 0),        icon: Zap,         color: "text-violet-400" },
              { label: "Est. Cost Today",      value: fmtCost(data?.overview.estimatedCostToday ?? 0),        icon: DollarSign,  color: "text-amber-400" },
              { label: "Active Models (24h)",  value: String(data?.overview.activeModels24h ?? 0),            icon: Cpu,         color: "text-blue-400" },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* 30-day summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Requests (30d)",      value: data?.overview.totalRequests30d.toLocaleString() ?? "0", color: "text-foreground" },
              { label: "Tokens (30d)",         value: fmtTokens(data?.overview.totalTokens30d ?? 0),          color: "text-violet-400" },
              { label: "Est. Spend (30d)",     value: fmtCost(data?.overview.estimatedCost30d ?? 0),          color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/2 p-3">
                <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Success rate */}
          {data && (
            <div className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-black text-foreground">Overall Success Rate (24h)</p>
                <span className={`text-sm font-black ${data.overview.successRate24h >= 95 ? "text-emerald-400" : data.overview.successRate24h >= 80 ? "text-amber-400" : "text-red-400"}`}>
                  {data.overview.successRate24h}%
                </span>
              </div>
              <Bar pct={data.overview.successRate24h} color={data.overview.successRate24h >= 95 ? "#10B981" : data.overview.successRate24h >= 80 ? "#F59E0B" : "#EF4444"} />
            </div>
          )}

          {/* No data nudge */}
          {data && data.overview.totalRequests24h === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/1 py-8 text-center space-y-2">
              <Bot className="h-8 w-8 mx-auto text-muted-foreground/20" />
              <p className="text-xs font-bold text-muted-foreground">No AI requests tracked yet</p>
              <p className="text-[10px] text-muted-foreground/60">Data will appear here as users trigger AI features.</p>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          2. MODEL PERFORMANCE
      ═══════════════════════════════════════════════════════════════ */}
      {section === "performance" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {!data || data.modelPerformance.length === 0 ? (
            <EmptyState icon={Activity} text="No model performance data yet. Data populates as AI features are used." />
          ) : (
            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 bg-white/2">
                <p className="text-xs font-black text-foreground">Model Performance — Last 30 Days</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/4">
                      {["Model", "Requests", "Success %", "Avg Latency", "P95", "P99", "Tokens", "Est. Cost"].map(h => (
                        <th key={h} className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.modelPerformance.map((row, i) => (
                      <motion.tr key={row.model} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <ProviderDot model={row.model} />
                            <div>
                              <p className="font-bold text-foreground text-[11px]">{shortModel(row.model)}</p>
                              <p className="text-[9px] text-muted-foreground">{row.provider}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground">{row.requests.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={`font-black font-mono text-[11px] ${row.successPct >= 95 ? "text-emerald-400" : row.successPct >= 80 ? "text-amber-400" : "text-red-400"}`}>
                            {row.successPct}%
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-muted-foreground whitespace-nowrap">{fmtMs(row.avgLatencyMs)}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground/70 text-[10px] whitespace-nowrap">{fmtMs(row.p95LatencyMs)}</td>
                        <td className="px-4 py-3 font-mono text-muted-foreground/70 text-[10px] whitespace-nowrap">{fmtMs(row.p99LatencyMs)}</td>
                        <td className="px-4 py-3 font-mono text-violet-400">{fmtTokens(row.totalTokens)}</td>
                        <td className="px-4 py-3 font-mono text-amber-400">{fmtCost(row.estimatedCost)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          3. TOKEN ANALYTICS
      ═══════════════════════════════════════════════════════════════ */}
      {section === "tokens" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

          {/* Daily token chart */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <p className="text-xs font-black text-foreground">Daily Token Volume — Last 30 Days</p>
            {!data || data.dailyTokens.length === 0 ? (
              <EmptyState icon={Zap} text="No token data yet." />
            ) : (
              <div className="flex items-end gap-0.5 h-28">
                {data.dailyTokens.map((d, i) => {
                  const pct = (d.totalTokens / maxTokenDay) * 100
                  return (
                    <div key={i} className="flex-1 group relative flex flex-col items-center">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#0a0a0a] border border-white/10 text-[9px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {fmtTokens(d.totalTokens)} @ {fmtDay(d.day)}
                      </div>
                      <div className="w-full rounded-t-sm bg-violet-500/60 hover:bg-violet-500/80 transition-all"
                        style={{ height: `${Math.max(pct, 2)}%` }} />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* By feature + by model side by side */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Tokens by feature */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
              <p className="text-xs font-black text-foreground">Tokens by Feature</p>
              {!data || data.tokensByFeature.length === 0 ? (
                <EmptyState icon={Zap} text="No data yet." />
              ) : (
                <div className="space-y-2.5">
                  {data.tokensByFeature.map(f => (
                    <div key={f.feature} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] text-muted-foreground truncate max-w-[120px]">{f.feature}</p>
                        <p className="text-[10px] font-mono text-violet-400">{fmtTokens(f.totalTokens)}</p>
                      </div>
                      <Bar pct={(f.totalTokens / maxTokenFeat) * 100} color="#8B5CF6" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Tokens by model */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
              <p className="text-xs font-black text-foreground">Tokens by Model</p>
              {!data || data.tokensByModel.length === 0 ? (
                <EmptyState icon={Cpu} text="No data yet." />
              ) : (
                <div className="space-y-2.5">
                  {data.tokensByModel.map(m => (
                    <div key={m.model} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <ProviderDot model={m.model} />
                          <p className="text-[10px] text-muted-foreground truncate">{shortModel(m.model)}</p>
                        </div>
                        <p className="text-[10px] font-mono text-violet-400 flex-shrink-0">{fmtTokens(m.totalTokens)}</p>
                      </div>
                      <Bar pct={(m.totalTokens / maxTokenModel) * 100} color="#6366F1" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          4. COST INTELLIGENCE
      ═══════════════════════════════════════════════════════════════ */}
      {section === "cost" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Spend projections */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { label: "Est. Monthly Spend",  value: fmtCost(data?.costIntelligence.estimatedMonthlySpend ?? 0), color: "text-amber-400" },
              { label: "Est. Annual Spend",   value: fmtCost(data?.costIntelligence.estimatedAnnualSpend  ?? 0), color: "text-red-400" },
              { label: "Cost Today",          value: fmtCost(data?.overview.estimatedCostToday ?? 0),            color: "text-foreground" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Cost disclaimer */}
          <div className="flex items-start gap-2 px-4 py-3 rounded-xl border border-amber-500/15 bg-amber-500/5 text-[10px] text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <p>Costs are estimated based on configurable per-1K token rates. These are approximations only. No real billing provider is connected.</p>
          </div>

          {/* Cost by model */}
          {data && data.tokensByModel.length > 0 && (
            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 bg-white/2">
                <p className="text-xs font-black text-foreground">Most Expensive Models (30d)</p>
              </div>
              <div className="divide-y divide-white/4">
                {data.tokensByModel.slice(0, 8).map((m, i) => (
                  <div key={m.model} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                    <span className="text-[10px] text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                    <ProviderDot model={m.model} />
                    <p className="flex-1 text-xs font-medium text-foreground truncate">{shortModel(m.model)}</p>
                    <p className="text-xs font-mono text-violet-400">{fmtTokens(m.totalTokens)}</p>
                    <p className="text-xs font-mono font-black text-amber-400 w-20 text-right">{fmtCost(m.totalCost)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most expensive users */}
          {data && data.costIntelligence.mostExpensiveUsers.length > 0 && (
            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 bg-white/2">
                <p className="text-xs font-black text-foreground">Most Expensive Users (30d)</p>
              </div>
              <div className="divide-y divide-white/4">
                {data.costIntelligence.mostExpensiveUsers.map((u, i) => (
                  <div key={u.userId ?? i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[10px] text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <p className="flex-1 text-[10px] font-mono text-muted-foreground truncate">{u.userId ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{u.requests} req</p>
                    <p className="text-xs font-mono font-black text-amber-400 w-20 text-right">{fmtCost(u.totalCost)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Most expensive projects */}
          {data && data.costIntelligence.mostExpensiveProjects.length > 0 && (
            <div className="rounded-2xl border border-white/8 overflow-hidden">
              <div className="px-4 py-3 border-b border-white/6 bg-white/2">
                <p className="text-xs font-black text-foreground">Most Expensive Projects (30d)</p>
              </div>
              <div className="divide-y divide-white/4">
                {data.costIntelligence.mostExpensiveProjects.map((p, i) => (
                  <div key={p.projectId ?? i} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-[10px] text-muted-foreground/50 font-mono w-4">{i + 1}</span>
                    <FolderOpen className="h-3 w-3 text-muted-foreground" />
                    <p className="flex-1 text-[10px] font-mono text-muted-foreground truncate">{p.projectId ?? "—"}</p>
                    <p className="text-[10px] text-muted-foreground">{p.requests} req</p>
                    <p className="text-xs font-mono font-black text-amber-400 w-20 text-right">{fmtCost(p.totalCost)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data && data.costIntelligence.mostExpensiveUsers.length === 0 && (
            <EmptyState icon={DollarSign} text="No cost data yet. Costs accumulate as AI features are used." />
          )}
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          5. ROUTING MAP
      ═══════════════════════════════════════════════════════════════ */}
      {section === "routing" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <p className="text-[10px] text-muted-foreground">Live routing assignments from the centralized model registry. Request counts from last 24h.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data?.routingMap.map((entry, i) => (
              <motion.div key={entry.feature} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-3">
                {/* Feature → Model */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black text-foreground">{entry.feature}</p>
                  </div>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <ProviderDot model={entry.model} />
                    <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[110px]">{shortModel(entry.model)}</p>
                  </div>
                </div>

                {/* Live stats */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5">
                  <div>
                    <p className={`text-sm font-black ${entry.requests > 0 ? "text-foreground" : "text-muted-foreground/40"}`}>
                      {entry.requests.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-muted-foreground">requests</p>
                  </div>
                  <div>
                    <p className={`text-sm font-black ${entry.failures > 0 ? "text-red-400" : "text-muted-foreground/40"}`}>
                      {entry.failures}
                    </p>
                    <p className="text-[9px] text-muted-foreground">failures</p>
                  </div>
                  <div>
                    <p className={`text-sm font-black ${entry.avgLatency > 0 ? "text-amber-400" : "text-muted-foreground/40"}`}>
                      {entry.avgLatency > 0 ? fmtMs(entry.avgLatency) : "—"}
                    </p>
                    <p className="text-[9px] text-muted-foreground">avg latency</p>
                  </div>
                </div>

                {/* Active indicator */}
                {entry.requests > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    <p className="text-[9px] text-emerald-400">Active in last 24h</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Model legend */}
          <div className="rounded-xl border border-white/8 bg-white/2 p-3 space-y-2">
            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Model Legend</p>
            <div className="flex flex-wrap gap-3">
              {[
                { vendor: "qwen",     color: "bg-violet-400", label: "Qwen (NVIDIA NIM)" },
                { vendor: "nvidia",   color: "bg-green-400",  label: "Nemotron (NVIDIA NIM)" },
                { vendor: "meta",     color: "bg-blue-400",   label: "Llama / Meta (NVIDIA NIM)" },
                { vendor: "deepseek", color: "bg-cyan-400",   label: "DeepSeek (NVIDIA NIM)" },
              ].map(m => (
                <div key={m.vendor} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${m.color}`} />
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          6. AI ALERTS
      ═══════════════════════════════════════════════════════════════ */}
      {section === "alerts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <p className="text-[10px] text-muted-foreground">
            Alerts are automatically generated when model failure rates, latency, token usage, or estimated costs exceed thresholds.
          </p>

          {activeAlerts.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/2 py-14 text-center space-y-2">
              <Shield className="h-8 w-8 mx-auto text-emerald-400/40" />
              <p className="text-xs font-bold text-emerald-400">No active AI alerts</p>
              <p className="text-[10px] text-muted-foreground">All models are operating within normal thresholds.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert, i) => (
                <motion.div key={alert.type} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${alert.severity === "critical" ? "border-red-500/25 bg-red-500/8" : "border-amber-500/20 bg-amber-500/6"}`}>
                  {alert.severity === "critical"
                    ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="h-4 w-4 text-amber-400 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-foreground">{alert.title}</p>
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{alert.message}</p>
                  </div>
                  <button onClick={() => setDismissed(prev => new Set([...prev, alert.type]))}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}

          {/* Threshold reference */}
          <details className="group">
            <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1 hover:text-foreground transition-colors select-none">
              <ChevronDown className="h-3 w-3 group-open:rotate-180 transition-transform" />Alert Thresholds
            </summary>
            <div className="mt-2 rounded-xl border border-white/8 bg-white/2 divide-y divide-white/4">
              {[
                { threshold: "Failure rate warning",   value: "≥ 10% per model" },
                { threshold: "Failure rate critical",  value: "≥ 25% per model" },
                { threshold: "Avg latency warning",    value: "≥ 8s per model" },
                { threshold: "Avg latency critical",   value: "≥ 20s per model" },
                { threshold: "Token usage spike",      value: "≥ 500K tokens/day" },
                { threshold: "Daily cost spike",       value: "≥ $5.00/day (est.)" },
              ].map(t => (
                <div key={t.threshold} className="flex items-center justify-between px-3 py-2 text-[10px]">
                  <span className="text-muted-foreground">{t.threshold}</span>
                  <span className="text-foreground font-mono">{t.value}</span>
                </div>
              ))}
            </div>
          </details>
        </motion.div>
      )}

    </div>
  )
}
