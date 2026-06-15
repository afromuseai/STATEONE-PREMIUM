import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, AlertTriangle, UserX, Activity, RefreshCw,
  Ban, CheckCircle2, X, ChevronDown, ChevronUp, Search,
  Clock, Globe, Zap, Eye, UserCheck,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityOverview {
  failedLogins24h: number
  suspendedUsers: number
  openAbuseAlerts: number
  rateLimitViolations24h: number
}

interface TopViolator { ip: string; violations: number }
interface ViolationByEndpoint { endpoint: string; count: number }

interface AbuseAlert {
  id: string
  userId: string | null
  ip: string | null
  alertType: string
  severity: string
  title: string
  description: string
  status: string
  reviewedAt: string | null
  createdAt: string
}

interface SuspendedUser {
  id: string
  email: string
  name: string
  suspendedReason: string | null
  suspendedAt: string | null
}

interface AdminAction {
  id: string
  adminId: string
  action: string
  targetType: string
  targetId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

interface SecurityData {
  overview: SecurityOverview
  topViolators: TopViolator[]
  recentAlerts: AbuseAlert[]
  recentSuspensions: SuspendedUser[]
  recentAdminActions: AdminAction[]
  violationsByEndpoint: ViolationByEndpoint[]
}

interface RateLimitViolation {
  id: string
  userId: string | null
  ip: string
  endpoint: string
  tier: string
  limitType: string
  requestCount: number
  limit: number
  blocked: boolean
  userAgent: string | null
  createdAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const SEVERITY_COLOR: Record<string, string> = {
  info: "#6366F1", warning: "#F59E0B", critical: "#EF4444",
}

const ALERT_TYPE_LABEL: Record<string, string> = {
  excessive_generation: "Excessive Gen",
  spam: "Spam",
  suspicious_automation: "Automation",
  rapid_signup: "Rapid Signup",
  excessive_logins: "Login Abuse",
  content_abuse: "Content Abuse",
}

function SeverityPill({ severity }: { severity: string }) {
  const c = SEVERITY_COLOR[severity] ?? "#6B7280"
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ background: `${c}18`, color: c, border: `1px solid ${c}30` }}>
      {severity}
    </span>
  )
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number | string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/2 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
          <Icon className="h-4 w-4" style={{ color }} />
        </div>
      </div>
      <p className="text-2xl font-black text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/50 mt-0.5">{sub}</p>}
    </motion.div>
  )
}

// ─── Sub-section: Abuse Alerts ────────────────────────────────────────────────

function AbuseAlertsSection() {
  const [alerts, setAlerts] = useState<AbuseAlert[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState("open")
  const [acting, setActing] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [search, setSearch] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch(`/api/admin/security/abuse-alerts?status=${statusFilter}`, { credentials: "include" }).then(r => r.json())
      setAlerts(data.alerts ?? [])
    } catch (_) {}
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleAction = async (id: string, action: "dismiss" | "action") => {
    setActing(id)
    try {
      await fetch(`/api/admin/security/abuse-alerts/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      await load()
    } catch (_) {}
    setActing(null)
  }

  const filtered = alerts.filter(a =>
    !search ||
    a.title.toLowerCase().includes(search.toLowerCase()) ||
    (a.ip ?? "").includes(search) ||
    (a.alertType ?? "").includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
          {["open", "dismissed", "actioned", "all"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-lg text-xs font-bold capitalize transition-all ${statusFilter === s ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts…"
            className="w-full pl-8 pr-3 py-2 rounded-xl bg-white/3 border border-white/8 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-white/20" />
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/2 py-14 text-center">
          <CheckCircle2 className="h-7 w-7 mx-auto mb-2 text-green-400/40" />
          <p className="text-xs text-muted-foreground">No {statusFilter === "all" ? "" : statusFilter} abuse alerts</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
          {filtered.map((alert, i) => (
            <motion.div key={alert.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className="border-b border-white/5 last:border-0">
              <div className="flex items-start gap-3 px-4 py-3 hover:bg-white/2 transition-colors group cursor-pointer"
                onClick={() => setExpanded(expanded === alert.id ? null : alert.id)}>
                <div className="mt-0.5 flex-shrink-0 h-2 w-2 rounded-full mt-1.5" style={{ background: SEVERITY_COLOR[alert.severity] ?? "#6B7280" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-foreground truncate">{alert.title}</span>
                    <SeverityPill severity={alert.severity} />
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black bg-white/5 text-muted-foreground border border-white/8">
                      {ALERT_TYPE_LABEL[alert.alertType] ?? alert.alertType}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {alert.ip && <span className="text-[10px] text-muted-foreground font-mono">{alert.ip}</span>}
                    <span className="text-[10px] text-muted-foreground">{timeAgo(alert.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {alert.status === "open" && (
                    <>
                      <button onClick={e => { e.stopPropagation(); handleAction(alert.id, "dismiss") }}
                        disabled={acting === alert.id}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white/5 text-muted-foreground hover:text-foreground border border-white/8 transition-all disabled:opacity-40">
                        Dismiss
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleAction(alert.id, "action") }}
                        disabled={acting === alert.id}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-all disabled:opacity-40">
                        Action
                      </button>
                    </>
                  )}
                  {alert.status !== "open" && (
                    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black bg-green-500/10 text-green-400 border border-green-500/20 capitalize">
                      {alert.status}
                    </span>
                  )}
                  {expanded === alert.id ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
                </div>
              </div>
              <AnimatePresence>
                {expanded === alert.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-white/5">
                    <div className="px-4 py-3 bg-white/1 space-y-1">
                      <p className="text-xs text-muted-foreground">{alert.description}</p>
                      {alert.userId && <p className="text-[10px] text-muted-foreground/60 font-mono">User: {alert.userId}</p>}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-section: Suspended Users ─────────────────────────────────────────────

function SuspendedUsersSection() {
  const [users, setUsers] = useState<SuspendedUser[]>([])
  const [loading, setLoading] = useState(false)
  const [reactivating, setReactivating] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch("/api/admin/security/suspended", { credentials: "include" }).then(r => r.json())
      setUsers(data.users ?? [])
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleReactivate = async (id: string) => {
    setReactivating(id)
    try {
      await fetch(`/api/admin/security/reactivate/${id}`, { method: "POST", credentials: "include" })
      await load()
    } catch (_) {}
    setReactivating(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{users.length} suspended account{users.length !== 1 ? "s" : ""}</p>
        <button onClick={load} disabled={loading} className="p-1.5 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {users.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/2 py-12 text-center">
          <UserCheck className="h-6 w-6 mx-auto mb-2 text-green-400/40" />
          <p className="text-xs text-muted-foreground">No suspended accounts</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
          {users.map((u, i) => (
            <motion.div key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/5 last:border-0 group hover:bg-white/2 transition-colors">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <UserX className="h-3.5 w-3.5 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground truncate">{u.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                {u.suspendedReason && (
                  <p className="text-[10px] text-red-400/60 truncate mt-0.5">"{u.suspendedReason}"</p>
                )}
              </div>
              <div className="text-right flex-shrink-0">
                {u.suspendedAt && <p className="text-[10px] text-muted-foreground">{timeAgo(u.suspendedAt)}</p>}
                <button onClick={() => handleReactivate(u.id)} disabled={reactivating === u.id}
                  className="mt-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all disabled:opacity-40">
                  {reactivating === u.id ? "…" : "Reactivate"}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sub-section: Rate Violations ─────────────────────────────────────────────

function RateViolationsSection() {
  const [violations, setViolations] = useState<RateLimitViolation[]>([])
  const [loading, setLoading] = useState(false)
  const [hours, setHours] = useState("24")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch(`/api/admin/security/rate-violations?hours=${hours}`, { credentials: "include" }).then(r => r.json())
      setViolations(data.violations ?? [])
    } catch (_) {}
    setLoading(false)
  }, [hours])

  useEffect(() => { load() }, [load])

  const TIER_COLOR: Record<string, string> = {
    free: "#10B981", pro: "#D4AF37", startup: "#F97316", enterprise: "#8B5CF6", admin: "#EF4444",
  }
  const LIMIT_TYPE_COLOR: Record<string, string> = {
    minute: "#EF4444", hour: "#F59E0B", day: "#6366F1",
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
          {["1", "6", "24", "72"].map(h => (
            <button key={h} onClick={() => setHours(h)}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${hours === h ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-muted-foreground hover:text-foreground"}`}>
              {h}h
            </button>
          ))}
        </div>
        <button onClick={load} disabled={loading} className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <span className="text-xs text-muted-foreground">{violations.length} violations</span>
      </div>

      {violations.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/2 py-12 text-center">
          <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-green-400/40" />
          <p className="text-xs text-muted-foreground">No violations in this period</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
          <div className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
            <span className="col-span-2">IP / Endpoint</span>
            <span>Tier</span>
            <span>Limit</span>
            <span>Time</span>
          </div>
          {violations.slice(0, 100).map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.01, 0.3) }}
              className="grid grid-cols-5 gap-2 items-center px-4 py-2.5 border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
              <div className="col-span-2 min-w-0">
                <p className="text-[10px] font-mono text-foreground truncate">{v.ip}</p>
                <p className="text-[10px] text-muted-foreground truncate">{v.endpoint}</p>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-black capitalize"
                  style={{ background: `${TIER_COLOR[v.tier] ?? "#6B7280"}18`, color: TIER_COLOR[v.tier] ?? "#6B7280", border: `1px solid ${TIER_COLOR[v.tier] ?? "#6B7280"}30` }}>
                  {v.tier}
                </span>
              </div>
              <div>
                <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-black"
                  style={{ background: `${LIMIT_TYPE_COLOR[v.limitType] ?? "#6B7280"}18`, color: LIMIT_TYPE_COLOR[v.limitType] ?? "#6B7280", border: `1px solid ${LIMIT_TYPE_COLOR[v.limitType] ?? "#6B7280"}30` }}>
                  {v.requestCount}/{v.limit} per {v.limitType}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">{timeAgo(v.createdAt)}</p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Suspend User Modal ───────────────────────────────────────────────────────

function SuspendUserModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [userId, setUserId] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!userId.trim()) { setError("User ID is required"); return }
    if (reason.trim().length < 3) { setError("Reason must be at least 3 characters"); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/security/suspend/${userId.trim()}`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to suspend user"); setLoading(false); return }
      onDone()
      onClose()
    } catch (_) { setError("Network error") }
    setLoading(false)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-red-500/10"><Ban className="h-4 w-4 text-red-400" /></div>
            <p className="text-sm font-black text-foreground">Suspend User</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">User ID</p>
            <input value={userId} onChange={e => setUserId(e.target.value)} placeholder="uuid…"
              className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs font-mono text-foreground focus:outline-none focus:border-white/20" />
          </div>
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Reason</p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} placeholder="Reason for suspension…"
              className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-foreground resize-none focus:outline-none focus:border-white/20" />
          </div>
        </div>
        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}
        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-2.5 rounded-xl bg-red-500/15 border border-red-500/25 text-red-400 text-xs font-black hover:bg-red-500/20 transition-all disabled:opacity-50">
          {loading ? "Suspending…" : "Suspend Account"}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

type SecuritySection = "overview" | "alerts" | "suspensions" | "violations"

export function AdminSecurity() {
  const [data, setData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(false)
  const [section, setSection] = useState<SecuritySection>("overview")
  const [showSuspendModal, setShowSuspendModal] = useState(false)

  const loadOverview = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch("/api/admin/security", { credentials: "include" }).then(r => r.json())
      setData(d)
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { loadOverview() }, [loadOverview])

  const SECTIONS: { id: SecuritySection; label: string; icon: React.ElementType }[] = [
    { id: "overview",    label: "Overview",    icon: Shield },
    { id: "alerts",      label: "Abuse Alerts", icon: AlertTriangle },
    { id: "suspensions", label: "Suspensions",  icon: Ban },
    { id: "violations",  label: "Rate Limits",  icon: Zap },
  ]

  return (
    <div className="space-y-5">
      {/* Section nav */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setSection(id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${section === id ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSuspendModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold hover:bg-red-500/15 transition-all">
            <Ban className="h-3 w-3" />
            Suspend User
          </button>
          <button onClick={loadOverview} disabled={loading}
            className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Overview section */}
      {section === "overview" && (
        <div className="space-y-5">
          {/* Stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Failed Logins (24h)"       value={data?.overview?.failedLogins24h        ?? "—"} icon={Eye}           color="#EF4444" />
            <StatCard label="Suspended Accounts"        value={data?.overview?.suspendedUsers         ?? "—"} icon={UserX}         color="#F97316" />
            <StatCard label="Open Abuse Alerts"         value={data?.overview?.openAbuseAlerts        ?? "—"} icon={AlertTriangle} color="#F59E0B" />
            <StatCard label="Rate Violations (24h)"     value={data?.overview?.rateLimitViolations24h ?? "—"} icon={Zap}           color="#6366F1" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top violators */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Globe className="h-3.5 w-3.5 text-red-400" />
                <p className="text-xs font-black text-foreground">Top Violators (24h)</p>
              </div>
              {!data?.topViolators?.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No violations today</p>
              ) : (
                <div className="space-y-2">
                  {data.topViolators.map((v, i) => (
                    <div key={v.ip} className="flex items-center gap-2">
                      <span className="text-[9px] font-black text-muted-foreground w-4">{i + 1}</span>
                      <span className="text-xs font-mono text-foreground flex-1 truncate">{v.ip}</span>
                      <span className="text-xs font-black text-red-400">{v.violations}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Violations by endpoint */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5 text-amber-400" />
                <p className="text-xs font-black text-foreground">Hot Endpoints (24h)</p>
              </div>
              {!data?.violationsByEndpoint?.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No endpoint violations</p>
              ) : (
                <div className="space-y-2">
                  {data.violationsByEndpoint.slice(0, 6).map(v => {
                    const max = data.violationsByEndpoint[0]?.count ?? 1
                    const pct = Math.round((v.count / max) * 100)
                    return (
                      <div key={v.endpoint} className="space-y-0.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-muted-foreground truncate flex-1 mr-2">{v.endpoint}</span>
                          <span className="text-[10px] font-black text-amber-400 flex-shrink-0">{v.count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }} className="h-full rounded-full bg-amber-500/60" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent admin actions */}
            <div className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-indigo-400" />
                <p className="text-xs font-black text-foreground">Recent Security Actions</p>
              </div>
              {!data?.recentAdminActions?.length ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No recent actions</p>
              ) : (
                <div className="space-y-2">
                  {data.recentAdminActions.slice(0, 6).map(a => {
                    const ACTION_COLOR: Record<string, string> = {
                      suspend_user: "#EF4444", reactivate_user: "#10B981",
                      dismiss_abuse: "#6B7280", action_abuse: "#F59E0B",
                    }
                    const c = ACTION_COLOR[a.action] ?? "#6366F1"
                    return (
                      <div key={a.id} className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full flex-shrink-0" style={{ background: c }} />
                        <span className="text-[10px] text-muted-foreground capitalize flex-1 truncate"
                          style={{ color: c }}>{a.action.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(a.createdAt)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Recent alerts preview */}
          {data?.recentAlerts && data.recentAlerts.length > 0 && (
            <div className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-xs font-black text-foreground">Open Abuse Alerts</p>
                </div>
                <button onClick={() => setSection("alerts")} className="text-[10px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                  View all →
                </button>
              </div>
              <div className="space-y-2">
                {data.recentAlerts.slice(0, 3).map(a => (
                  <div key={a.id} className="flex items-center gap-2 py-1">
                    <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: SEVERITY_COLOR[a.severity] ?? "#6B7280" }} />
                    <span className="text-xs text-foreground flex-1 truncate">{a.title}</span>
                    <SeverityPill severity={a.severity} />
                    <span className="text-[10px] text-muted-foreground">{timeAgo(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {section === "alerts"      && <AbuseAlertsSection />}
      {section === "suspensions" && <SuspendedUsersSection />}
      {section === "violations"  && <RateViolationsSection />}

      <AnimatePresence>
        {showSuspendModal && <SuspendUserModal onClose={() => setShowSuspendModal(false)} onDone={loadOverview} />}
      </AnimatePresence>
    </div>
  )
}
