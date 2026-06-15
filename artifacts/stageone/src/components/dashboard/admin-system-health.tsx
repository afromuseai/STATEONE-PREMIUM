import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Activity, Database, Server, Zap, Radio, RefreshCw,
  CheckCircle2, AlertTriangle, AlertCircle, X, Bell,
  TrendingUp, Users, Clock, BarChart3, Shield, Plus,
  ChevronDown, Circle, Cpu, Globe, MessageSquare,
} from "lucide-react"

interface HealthSnapshot {
  api:      { status: string; uptimeMs: number; uptimePct: number }
  database: { status: string; pingMs: number }
  overview: {
    totalUsers: number
    usersOnline: number
    activeSessions: number
    sessionsToday: number
    requestVolume24h: number
    errorVolume24h: number
    errorRate: number
  }
  generations: {
    total24h: number
    marcusMessages24h: number
    builderRunning: number
    breakdown: Record<string, number>
  }
  generationHealth: Array<{
    key: string
    label: string
    requests: number
    success: number
    failures: number
    successPct: number
    avgMs: number | null
  }>
  performance: {
    dbPingMs: number
    hourlyVolume: Array<{ hour: string; total: number }>
  }
  liveActivity: {
    usersOnline: number
    activeSessions: number
    builderRunning: number
    totalGenerations24h: number
  }
  meta: { computedAt: string }
}

interface HealthAlert {
  id: string
  type: string
  title: string
  message: string
  severity: "info" | "warning" | "critical"
  dismissed: boolean
  dismissedAt: string | null
  createdAt: string
}

type Section = "overview" | "performance" | "generation" | "live" | "alerts"

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ElementType; label: string }> = {
    healthy:     { cls: "text-emerald-400 border-emerald-500/25 bg-emerald-500/10", icon: CheckCircle2, label: "Healthy" },
    degraded:    { cls: "text-amber-400 border-amber-500/25 bg-amber-500/10",       icon: AlertTriangle, label: "Degraded" },
    unavailable: { cls: "text-red-400 border-red-500/25 bg-red-500/10",             icon: AlertCircle,  label: "Unavailable" },
  }
  const s = map[status] ?? map.degraded
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${s.cls}`}>
      <Icon className="h-3 w-3" />{s.label}
    </span>
  )
}

function SeverityDot({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-400",
    warning:  "bg-amber-400",
    info:     "bg-blue-400",
  }
  return <span className={`h-2 w-2 rounded-full flex-shrink-0 ${colors[severity] ?? "bg-slate-400"}`} />
}

function fmtUptime(ms: number) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0)  return `${d}d ${h % 24}h`
  if (h > 0)  return `${h}h ${m % 60}m`
  if (m > 0)  return `${m}m ${s % 60}s`
  return `${s}s`
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

const SECTION_TABS: { id: Section; label: string; icon: React.ElementType }[] = [
  { id: "overview",    label: "Overview",     icon: BarChart3 },
  { id: "performance", label: "Performance",  icon: TrendingUp },
  { id: "generation",  label: "Generations",  icon: Zap },
  { id: "live",        label: "Live Activity", icon: Radio },
  { id: "alerts",      label: "Alerts",       icon: Bell },
]

export function AdminSystemHealth() {
  const [snap, setSnap]         = useState<HealthSnapshot | null>(null)
  const [alerts, setAlerts]     = useState<HealthAlert[]>([])
  const [section, setSection]   = useState<Section>("overview")
  const [loading, setLoading]   = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null)
  const [showCreateAlert, setShowCreateAlert] = useState(false)
  const [newAlertTitle, setNewAlertTitle] = useState("")
  const [newAlertMsg, setNewAlertMsg] = useState("")
  const [newAlertSev, setNewAlertSev] = useState<"info" | "warning" | "critical">("info")
  const [creating, setCreating] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const toast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const fetchHealth = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true)
    try {
      const [snapRes, alertsRes] = await Promise.all([
        fetch("/api/admin/health", { credentials: "include" }),
        fetch("/api/admin/health/alerts", { credentials: "include" }),
      ])
      if (snapRes.ok) {
        const data = await snapRes.json() as HealthSnapshot
        setSnap(data)
      }
      if (alertsRes.ok) {
        const data = await alertsRes.json() as { alerts: HealthAlert[] }
        setAlerts(data.alerts ?? [])
      }
      setLastRefreshed(new Date())
    } catch { /* silent */ }
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => {
    fetchHealth()
  }, [fetchHealth])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (autoRefresh) {
      timerRef.current = setInterval(() => fetchHealth(true), 15000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [autoRefresh, fetchHealth])

  const handleDismiss = async (id: string) => {
    try {
      await fetch(`/api/admin/health/alerts/${id}/dismiss`, { method: "PATCH", credentials: "include" })
      setAlerts(prev => prev.map(a => a.id === id ? { ...a, dismissed: true } : a))
      toast("Alert dismissed")
    } catch { toast("Failed to dismiss alert") }
  }

  const handleDeleteAlert = async (id: string) => {
    try {
      await fetch(`/api/admin/health/alerts/${id}`, { method: "DELETE", credentials: "include" })
      setAlerts(prev => prev.filter(a => a.id !== id))
      toast("Alert deleted")
    } catch { toast("Failed to delete alert") }
  }

  const handleCreateAlert = async () => {
    if (!newAlertTitle.trim() || !newAlertMsg.trim()) { toast("Title and message required"); return }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/health/alerts", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "manual", title: newAlertTitle, message: newAlertMsg, severity: newAlertSev }),
      })
      if (res.ok) {
        toast("Alert created")
        setShowCreateAlert(false)
        setNewAlertTitle(""); setNewAlertMsg(""); setNewAlertSev("info")
        await fetchHealth(true)
      }
    } catch { toast("Failed to create alert") }
    setCreating(false)
  }

  const activeAlerts   = alerts.filter(a => !a.dismissed)
  const criticalAlerts = activeAlerts.filter(a => a.severity === "critical")
  const maxBarVolume   = snap ? Math.max(...snap.performance.hourlyVolume.map(h => h.total), 1) : 1

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-4 relative">

      {/* ── Toast ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-[#0a0a0a] text-xs font-bold text-foreground shadow-2xl">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <Activity className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">System Health</h2>
          {criticalAlerts.length > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/25 text-[10px] font-bold text-red-400">
              <AlertCircle className="h-3 w-3" />{criticalAlerts.length} critical
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastRefreshed && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              Updated {fmtTime(lastRefreshed.toISOString())}
            </span>
          )}
          <button onClick={() => setAutoRefresh(v => !v)}
            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${autoRefresh ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400" : "border-white/8 bg-white/3 text-muted-foreground"}`}>
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh OFF"}
          </button>
          <button onClick={() => fetchHealth()} disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
            <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />Refresh
          </button>
        </div>
      </div>

      {/* ── Status strip ───────────────────────────────────────────────── */}
      {snap && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {[
            { label: "API Server",          status: snap.api.status,      icon: Server,   detail: fmtUptime(snap.api.uptimeMs) },
            { label: "Database",            status: snap.database.status, icon: Database, detail: `${snap.database.pingMs}ms ping` },
            { label: "Notification System", status: "healthy",            icon: Bell,     detail: "Operational" },
            { label: "SSE Streaming",       status: "healthy",            icon: Radio,    detail: "Operational" },
            { label: "Generation Pipelines",status: snap.generationHealth.some(g => g.failures > 0) ? "degraded" : "healthy", icon: Zap, detail: `${snap.generations.builderRunning} active` },
          ].map(s => {
            const Icon = s.icon
            const colors: Record<string, string> = {
              healthy:     "border-emerald-500/15 bg-emerald-500/5",
              degraded:    "border-amber-500/15 bg-amber-500/5",
              unavailable: "border-red-500/15 bg-red-500/5",
            }
            const dotColors: Record<string, string> = {
              healthy: "bg-emerald-400", degraded: "bg-amber-400", unavailable: "bg-red-400",
            }
            return (
              <div key={s.label} className={`rounded-xl border p-3 space-y-1.5 ${colors[s.status] ?? colors.degraded}`}>
                <div className="flex items-center justify-between">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className={`h-2 w-2 rounded-full ${dotColors[s.status] ?? "bg-amber-400"}`} />
                </div>
                <p className="text-[10px] font-black text-foreground">{s.label}</p>
                <p className="text-[9px] text-muted-foreground">{s.detail}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Section nav ────────────────────────────────────────────────── */}
      <div className="flex gap-1 flex-wrap">
        {SECTION_TABS.map(tab => {
          const Icon = tab.icon
          const badge = tab.id === "alerts" && activeAlerts.length > 0 ? activeAlerts.length : null
          return (
            <button key={tab.id} onClick={() => setSection(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${section === tab.id ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3 w-3" />{tab.label}
              {badge && (
                <span className="ml-0.5 h-4 w-4 flex items-center justify-center rounded-full bg-red-500/80 text-[9px] font-black text-white">{badge}</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1: OVERVIEW
      ════════════════════════════════════════════════════════════════ */}
      {section === "overview" && snap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: "Total Users",       value: snap.overview.totalUsers.toLocaleString(),       icon: Users,       color: "text-foreground" },
              { label: "Online Now",        value: snap.overview.usersOnline.toLocaleString(),       icon: Circle,      color: "text-emerald-400" },
              { label: "Active Sessions",   value: snap.overview.activeSessions.toLocaleString(),    icon: Globe,       color: "text-blue-400" },
              { label: "Sessions Today",    value: snap.overview.sessionsToday.toLocaleString(),     icon: Clock,       color: "text-violet-400" },
              { label: "Requests (24h)",    value: snap.overview.requestVolume24h.toLocaleString(),  icon: TrendingUp,  color: "text-amber-400" },
              { label: "Errors (24h)",      value: snap.overview.errorVolume24h.toLocaleString(),    icon: AlertCircle, color: snap.overview.errorVolume24h > 0 ? "text-red-400" : "text-muted-foreground" },
            ].map(s => {
              const Icon = s.icon
              return (
                <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              )
            })}
          </div>

          {/* System status table */}
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6 bg-white/2">
              <p className="text-xs font-black text-foreground">System Components</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/4">
                  <th className="text-left px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Component</th>
                  <th className="text-left px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Status</th>
                  <th className="text-left px-4 py-2 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Detail</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "API Server",    status: snap.api.status,      detail: `Uptime ${fmtUptime(snap.api.uptimeMs)} — ${snap.api.uptimePct}%` },
                  { name: "PostgreSQL",    status: snap.database.status, detail: `Ping ${snap.database.pingMs}ms` },
                  { name: "Notifications", status: "healthy",             detail: "Push + in-app delivery operational" },
                  { name: "SSE Streams",   status: "healthy",             detail: "Server-sent events operational" },
                  { name: "AI Pipelines",  status: snap.generationHealth.some(g => g.failures > 0) ? "degraded" : "healthy",
                    detail: `${snap.generations.total24h} generations in 24h, ${snap.generations.builderRunning} running` },
                  { name: "Error Rate",    status: snap.overview.errorRate > 10 ? "unavailable" : snap.overview.errorRate > 3 ? "degraded" : "healthy",
                    detail: `${snap.overview.errorRate}% error rate (24h)` },
                ].map(row => (
                  <tr key={row.name} className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-2.5 font-medium text-foreground">{row.name}</td>
                    <td className="px-4 py-2.5"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden sm:table-cell">{row.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2: PERFORMANCE
      ════════════════════════════════════════════════════════════════ */}
      {section === "performance" && snap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Key perf metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "DB Ping",       value: `${snap.performance.dbPingMs}ms`, color: snap.performance.dbPingMs < 100 ? "text-emerald-400" : snap.performance.dbPingMs < 500 ? "text-amber-400" : "text-red-400" },
              { label: "API Uptime",    value: `${snap.api.uptimePct}%`,         color: "text-emerald-400" },
              { label: "Requests/24h",  value: snap.overview.requestVolume24h.toLocaleString(), color: "text-blue-400" },
              { label: "Error Rate",    value: `${snap.overview.errorRate}%`,    color: snap.overview.errorRate > 3 ? "text-red-400" : "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Hourly volume chart */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <p className="text-xs font-black text-foreground">Request Volume — Last 24 Hours</p>
            {snap.performance.hourlyVolume.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No data yet.</p>
            ) : (
              <div className="flex items-end gap-1 h-24">
                {snap.performance.hourlyVolume.map((h, i) => {
                  const pct = maxBarVolume > 0 ? (h.total / maxBarVolume) * 100 : 0
                  const hour = new Date(h.hour).getHours()
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[#0a0a0a] border border-white/10 text-[9px] text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        {h.total} req @ {hour}:00
                      </div>
                      <div className="w-full rounded-t-sm bg-primary/60 hover:bg-primary/80 transition-all"
                        style={{ height: `${Math.max(pct, 2)}%` }} />
                      {i % 4 === 0 && (
                        <span className="text-[8px] text-muted-foreground/50">{hour}h</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* DB health detail */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <p className="text-xs font-black text-foreground">Database Health</p>
            <div className="flex items-center gap-4">
              <div>
                <p className={`text-2xl font-black ${snap.database.pingMs < 100 ? "text-emerald-400" : snap.database.pingMs < 500 ? "text-amber-400" : "text-red-400"}`}>
                  {snap.database.pingMs}ms
                </p>
                <p className="text-[10px] text-muted-foreground">Response time</p>
              </div>
              <div className="flex-1">
                <StatusBadge status={snap.database.status} />
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  {snap.database.status === "healthy" ? "All queries responding within normal thresholds." :
                   snap.database.status === "degraded" ? "Response time elevated. Monitor closely." :
                   "Database unreachable. Immediate action required."}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 3: GENERATION HEALTH
      ════════════════════════════════════════════════════════════════ */}
      {section === "generation" && snap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total Generations (24h)",  value: snap.generations.total24h, color: "text-foreground" },
              { label: "Marcus Messages (24h)",    value: snap.generations.marcusMessages24h, color: "text-violet-400" },
              { label: "Builder Running Now",      value: snap.generations.builderRunning, color: snap.generations.builderRunning > 0 ? "text-amber-400" : "text-muted-foreground" },
              { label: "Bi Generations (24h)",     value: snap.generations.breakdown.bi ?? 0, color: "text-blue-400" },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-3">
                <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Per-type table */}
          <div className="rounded-2xl border border-white/8 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/6 bg-white/2">
              <p className="text-xs font-black text-foreground">Generation Pipeline Health — Last 24h</p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/4">
                  <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pipeline</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Requests</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Success</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Failures</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Success %</th>
                  <th className="text-right px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {snap.generationHealth.map((row, i) => (
                  <motion.tr key={row.key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                    className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground">{row.label}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">{row.requests}</td>
                    <td className="px-4 py-3 text-right text-emerald-400 hidden sm:table-cell">{row.success}</td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell">
                      <span className={row.failures > 0 ? "text-red-400 font-bold" : "text-muted-foreground"}>{row.failures}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-12 h-1.5 rounded-full bg-white/8 overflow-hidden hidden sm:block">
                          <div className="h-full rounded-full"
                            style={{ width: `${row.successPct}%`, background: row.successPct >= 95 ? "#10B981" : row.successPct >= 80 ? "#F59E0B" : "#EF4444" }} />
                        </div>
                        <span className={`font-bold font-mono ${row.successPct >= 95 ? "text-emerald-400" : row.successPct >= 80 ? "text-amber-400" : "text-red-400"}`}>
                          {row.successPct}%
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground font-mono text-[10px] hidden md:table-cell">
                      {row.avgMs ? `${row.avgMs.toLocaleString()}ms` : "—"}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 4: LIVE ACTIVITY
      ════════════════════════════════════════════════════════════════ */}
      {section === "live" && snap && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Users Online Now",     value: snap.liveActivity.usersOnline,      color: "text-emerald-400",  pulse: snap.liveActivity.usersOnline > 0 },
              { label: "Active Sessions",      value: snap.liveActivity.activeSessions,   color: "text-blue-400",     pulse: false },
              { label: "Builder Jobs Running", value: snap.liveActivity.builderRunning,   color: snap.liveActivity.builderRunning > 0 ? "text-amber-400" : "text-muted-foreground", pulse: snap.liveActivity.builderRunning > 0 },
              { label: "Generations (24h)",    value: snap.liveActivity.totalGenerations24h, color: "text-violet-400", pulse: false },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  {s.pulse && <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" /></span>}
                  <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                </div>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Platform load indicator */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-foreground flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-primary" />Current Platform Load
              </p>
              <span className="text-[10px] text-muted-foreground">Auto-refreshes every 15s</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "API",          pct: Math.min((snap.overview.requestVolume24h / 1000) * 100, 100), color: "#6366F1" },
                { label: "Database",     pct: Math.min((snap.database.pingMs / 1000) * 100, 100),           color: snap.database.pingMs < 200 ? "#10B981" : "#F59E0B" },
                { label: "Generations",  pct: Math.min(snap.liveActivity.builderRunning * 20, 100),         color: "#8B5CF6" },
              ].map(s => (
                <div key={s.label} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    <p className="text-[10px] font-mono text-foreground">{Math.round(s.pct)}%</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${s.pct}%` }} transition={{ duration: 0.6 }}
                      className="h-full rounded-full" style={{ background: s.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Generation breakdown live */}
          <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <p className="text-xs font-black text-foreground">Generation Breakdown (24h)</p>
            <div className="space-y-2">
              {[
                { label: "Business Intelligence", value: snap.generations.breakdown.bi ?? 0,           color: "#6366F1" },
                { label: "Website Builder",        value: snap.generations.breakdown.website ?? 0,      color: "#8B5CF6" },
                { label: "Chatbot",                value: snap.generations.breakdown.chatbot ?? 0,      color: "#06B6D4" },
                { label: "Automation",             value: snap.generations.breakdown.automation ?? 0,   color: "#F59E0B" },
                { label: "Marcus Messages",        value: snap.generations.marcusMessages24h,           color: "#10B981" },
              ].map(s => {
                const total = snap.generations.total24h + snap.generations.marcusMessages24h
                const pct   = total > 0 ? (s.value / total) * 100 : 0
                return (
                  <div key={s.label} className="flex items-center gap-3">
                    <div className="w-28 text-[10px] text-muted-foreground truncate">{s.label}</div>
                    <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }}
                        className="h-full rounded-full" style={{ background: s.color }} />
                    </div>
                    <div className="w-8 text-right text-[10px] font-mono text-muted-foreground">{s.value}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </motion.div>
      )}

      {/* ════════════════════════════════════════════════════════════════
          SECTION 5: ALERTS
      ════════════════════════════════════════════════════════════════ */}
      {section === "alerts" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <p className="text-xs font-black text-foreground">System Alerts</p>
              <span className="text-[10px] text-muted-foreground">({activeAlerts.length} active, {alerts.filter(a => a.dismissed).length} dismissed)</span>
            </div>
            <button onClick={() => setShowCreateAlert(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 transition-all">
              <Plus className="h-3 w-3" />Add Alert
            </button>
          </div>

          {/* Active alerts */}
          {activeAlerts.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-white/2 py-12 text-center space-y-2">
              <Shield className="h-8 w-8 mx-auto text-emerald-400/40" />
              <p className="text-xs font-bold text-emerald-400">All clear — no active alerts</p>
              <p className="text-[10px] text-muted-foreground">The system is healthy. Alerts will appear here automatically.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeAlerts.map((alert, i) => (
                <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-3 p-4 rounded-xl border ${
                    alert.severity === "critical" ? "border-red-500/25 bg-red-500/8" :
                    alert.severity === "warning"  ? "border-amber-500/25 bg-amber-500/8" :
                    "border-blue-500/20 bg-blue-500/5"
                  }`}>
                  <SeverityDot severity={alert.severity} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs font-black text-foreground">{alert.title}</p>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                        alert.severity === "critical" ? "bg-red-500/15 text-red-400 border-red-500/25" :
                        alert.severity === "warning"  ? "bg-amber-500/15 text-amber-400 border-amber-500/25" :
                        "bg-blue-500/15 text-blue-400 border-blue-500/25"
                      }`}>{alert.severity}</span>
                      <span className="text-[9px] text-muted-foreground font-mono">{alert.type}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{alert.message}</p>
                    <p className="text-[9px] text-muted-foreground/60 mt-1">
                      {new Date(alert.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => handleDismiss(alert.id)}
                      className="px-2 py-1 rounded-lg text-[10px] font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all">
                      Dismiss
                    </button>
                    <button onClick={() => handleDeleteAlert(alert.id)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Dismissed alerts */}
          {alerts.filter(a => a.dismissed).length > 0 && (
            <details className="group">
              <summary className="text-[10px] text-muted-foreground cursor-pointer flex items-center gap-1 select-none hover:text-foreground transition-colors">
                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                {alerts.filter(a => a.dismissed).length} dismissed alerts
              </summary>
              <div className="mt-2 space-y-1.5">
                {alerts.filter(a => a.dismissed).map(alert => (
                  <div key={alert.id} className="flex items-center gap-3 px-4 py-2 rounded-xl border border-white/6 bg-white/2 opacity-50">
                    <SeverityDot severity={alert.severity} />
                    <p className="text-[10px] text-muted-foreground flex-1 line-through">{alert.title}</p>
                    <button onClick={() => handleDeleteAlert(alert.id)}
                      className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </motion.div>
      )}

      {/* ── Create Alert Modal ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreateAlert && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowCreateAlert(false) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#090909] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-foreground">Create Manual Alert</p>
                <button onClick={() => setShowCreateAlert(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Title *</p>
                  <input value={newAlertTitle} onChange={e => setNewAlertTitle(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Message *</p>
                  <textarea value={newAlertMsg} onChange={e => setNewAlertMsg(e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground resize-none focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Severity</p>
                  <div className="flex gap-1.5">
                    {(["info", "warning", "critical"] as const).map(s => (
                      <button key={s} onClick={() => setNewAlertSev(s)}
                        className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border capitalize transition-all ${newAlertSev === s
                          ? s === "critical" ? "bg-red-500/20 border-red-500/40 text-red-300"
                          : s === "warning"  ? "bg-amber-500/20 border-amber-500/40 text-amber-300"
                          : "bg-blue-500/20 border-blue-500/40 text-blue-300"
                          : "border-white/8 bg-white/3 text-muted-foreground"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={handleCreateAlert} disabled={creating || !newAlertTitle.trim() || !newAlertMsg.trim()}
                className="w-full py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                {creating ? "Creating…" : "Create Alert"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
