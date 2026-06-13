import { useState, useEffect, useCallback, useRef } from "react"
import { useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, Users, BarChart3, Crown, Zap, Building2,
  Trash2, ChevronDown, RefreshCw, Search, UserCheck,
  TrendingUp, Globe, Bot, X, Check, AlertTriangle,
  Radio, Activity, Megaphone, MapPin, Funnel,
  Send, Clock, ArrowDown, ArrowUp, Mail, Eye, FolderOpen,
} from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import stageoneIcon from "@/assets/stageone-icon.png"

type Plan = "free" | "pro" | "startup" | "enterprise"
type AdminTab = "users" | "stats" | "events" | "analytics" | "broadcasts" | "intelligence" | "messages"

interface AdminUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
  country?: string | null
  city?: string | null
  lastSeenAt?: string | null
  createdAt: string
  subscription: {
    plan: Plan
    status: string
    aiGenerationsUsed: number
    aiGenerationsLimit: number
    deploymentsUsed: number
    deploymentsLimit: number
    currentPeriodEnd: string
  } | null
}

interface Stats {
  totalUsers: number
  admins: number
  planCounts: Record<string, number>
  totalGenerations: number
}

interface AdminEvent {
  id: string
  type: string
  userId: string | null
  projectId: string | null
  country: string | null
  city: string | null
  ip: string | null
  createdAt: string
  userEmail: string | null
  userName: string | null
}

interface Analytics {
  overview: {
    totalUsers: number
    activeUsers24h: number
    activeUsers7d: number
    activeUsers30d: number
    totalEvents: number
    totalProjects: number
    totalGenerations: number
    totalMarcusMessages: number
  }
  funnel: Array<{ stage: string; count: number; pct: number }>
  geo: Array<{ country: string | null; users: number }>
  topCities: Array<{ city: string | null; users: number }>
  eventTypes: Array<{ type: string; total: number }>
  recentEvents: AdminEvent[]
  dailySignups: Array<{ date: string; signups: number }>
  topUsers: Array<{ userId: string | null; email: string | null; name: string | null; total: number }>
}

interface IntelligenceUser {
  id: string
  email: string
  name: string
  country?: string | null
  city?: string | null
  lastSeenAt?: string | null
  createdAt: string
  plan: string
  projectCount: number
  biGenerations: number
  websiteGenerations: number
  chatbotGenerations: number
  automationGenerations: number
  orchestratorGenerations: number
  marcusMessages: number
  activityScore: number
}

interface Broadcast {
  id: string
  title: string
  message: string
  type: string
  target: string
  createdAt: string
  expiresAt: string | null
  deliveredCount?: number
  emailDelivered?: boolean
}

interface SegmentCounts {
  all: number
  free: number
  pro: number
  startup: number
  enterprise: number
  emailEnabled: boolean
}

const PLAN_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  free:       { icon: Zap,       color: "#10B981", label: "Free" },
  pro:        { icon: Crown,     color: "#D4AF37", label: "Pro" },
  startup:    { icon: TrendingUp, color: "#F97316", label: "Startup" },
  enterprise: { icon: Building2, color: "#8B5CF6", label: "Enterprise" },
}

const EVENT_TYPE_META: Record<string, { color: string; label: string }> = {
  user_login:            { color: "#6366F1", label: "Login" },
  user_signup:           { color: "#10B981", label: "Signup" },
  user_logout:           { color: "#6B7280", label: "Logout" },
  project_created:       { color: "#D4AF37", label: "Project" },
  project_opened:        { color: "#FBBF24", label: "Opened" },
  bi_generated:          { color: "#F59E0B", label: "BI Gen" },
  website_generated:     { color: "#8B5CF6", label: "Website" },
  chatbot_generated:     { color: "#EC4899", label: "Chatbot" },
  automation_created:    { color: "#F97316", label: "Automation" },
  orchestrator_generated:{ color: "#7C3AED", label: "Orchestrator" },
  marcus_message:        { color: "#06B6D4", label: "Marcus" },
  marcus_task_created:   { color: "#0EA5E9", label: "Task" },
}

const BROADCAST_TYPE_META: Record<string, { color: string; label: string }> = {
  info:    { color: "#6366F1", label: "Info" },
  warning: { color: "#F59E0B", label: "Warning" },
  update:  { color: "#10B981", label: "Update" },
  feature: { color: "#D4AF37", label: "Feature" },
}

function PlanBadge({ plan }: { plan: Plan }) {
  const meta = PLAN_META[plan] ?? PLAN_META.free
  const Icon = meta.icon
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const meta = EVENT_TYPE_META[type] ?? { color: "#6B7280", label: type }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold font-mono"
      style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  )
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function StatCard({ label, value, icon: Icon, color, sub }: { label: string; value: number | string; icon: React.ElementType; color: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
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

export default function AdminPage() {
  const { user } = useAuth()
  const [, setLocation] = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [analytics, setAnalytics] = useState<Analytics | null>(null)
  const [events, setEvents] = useState<AdminEvent[]>([])
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [segmentCounts, setSegmentCounts] = useState<SegmentCounts | null>(null)
  const [showEmailPreview, setShowEmailPreview] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<AdminTab>("users")
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all")
  const [liveEvents, setLiveEvents] = useState<AdminEvent[]>([])
  const [sseConnected, setSseConnected] = useState(false)
  const sseRef = useRef<EventSource | null>(null)
  const [broadcastForm, setBroadcastForm] = useState({
    title: "", message: "", type: "info", target: "all",
  })
  const [sendingBroadcast, setSendingBroadcast] = useState(false)
  const [broadcastSent, setBroadcastSent] = useState(false)
  const [intelligence, setIntelligence] = useState<IntelligenceUser[] | null>(null)
  const [intelligenceSearch, setIntelligenceSearch] = useState("")
  const [intelligenceSort, setIntelligenceSort] = useState<"activityScore" | "createdAt" | "projectCount" | "biGenerations">("activityScore")
  const [intelligenceFilter, setIntelligenceFilter] = useState<"all" | "active" | "inactive" | "power" | "paid" | "new">("all")
  const [msgForm, setMsgForm] = useState({ target: "all", targetUserId: "", type: "announcement", title: "", body: "" })
  const [sendingMsg, setSendingMsg] = useState(false)
  const [msgSent, setMsgSent] = useState(false)

  useEffect(() => {
    if (!user) { setLocation("/login"); return }
    if (!user.isAdmin) { setLocation("/dashboard"); return }
  }, [user])

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersData, statsData] = await Promise.all([
        api.admin.getUsers(),
        api.admin.getStats(),
      ])
      setUsers(usersData.users as AdminUser[])
      setStats(statsData)
    } catch (_) {}
    setLoading(false)
  }, [])

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/analytics", { credentials: "include" }).then(r => r.json())
      if (data?.overview) setAnalytics(data)
    } catch (_) {}
  }, [])

  const loadEvents = useCallback(async () => {
    try {
      const params = eventTypeFilter !== "all" ? `?type=${eventTypeFilter}` : ""
      const data = await fetch(`/api/admin/events${params}`, { credentials: "include" }).then(r => r.json())
      setEvents(data.events ?? [])
    } catch (_) {}
  }, [eventTypeFilter])

  const loadBroadcasts = useCallback(async () => {
    try {
      const [bData, sData] = await Promise.all([
        fetch("/api/admin/broadcasts", { credentials: "include" }).then(r => r.json()),
        fetch("/api/admin/segment-counts", { credentials: "include" }).then(r => r.json()).catch(() => null),
      ])
      setBroadcasts(bData.broadcasts ?? [])
      if (sData) setSegmentCounts(sData)
    } catch (_) {}
  }, [])

  const loadIntelligence = useCallback(async () => {
    try {
      const data = await fetch("/api/admin/user-intelligence", { credentials: "include" }).then(r => r.json())
      if (data?.users) setIntelligence(data.users)
    } catch (_) {}
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (activeTab === "analytics") loadAnalytics()
    else if (activeTab === "events") loadEvents()
    else if (activeTab === "broadcasts") loadBroadcasts()
    else if (activeTab === "intelligence") loadIntelligence()
  }, [activeTab, loadAnalytics, loadEvents, loadBroadcasts, loadIntelligence])

  useEffect(() => {
    if (activeTab !== "events") return
    const es = new EventSource("/api/admin/events/stream", { withCredentials: true })
    sseRef.current = es
    es.addEventListener("open", () => setSseConnected(true))
    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.event) {
          setLiveEvents(prev => [data.event as AdminEvent, ...prev].slice(0, 50))
        }
      } catch (_) {}
    })
    es.addEventListener("error", () => setSseConnected(false))
    return () => { es.close(); setSseConnected(false) }
  }, [activeTab])

  useEffect(() => { if (activeTab === "events") loadEvents() }, [eventTypeFilter, activeTab])

  const handleChangePlan = async (userId: string, plan: Plan) => {
    setChangingPlan(userId)
    try {
      await api.admin.updateSubscription(userId, plan)
      await loadData()
    } catch (_) {}
    setChangingPlan(null)
  }

  const handleToggleAdmin = async (userId: string, current: boolean) => {
    setTogglingAdmin(userId)
    try {
      await api.admin.updateUser(userId, { isAdmin: !current })
      await loadData()
    } catch (_) {}
    setTogglingAdmin(null)
  }

  const handleDelete = async (userId: string) => {
    setDeletingUser(userId)
    try {
      await api.admin.deleteUser(userId)
      setConfirmDelete(null)
      await loadData()
    } catch (_) {}
    setDeletingUser(null)
  }

  const handleSendBroadcast = async () => {
    if (!broadcastForm.title.trim() || !broadcastForm.message.trim()) return
    setSendingBroadcast(true)
    try {
      await fetch("/api/admin/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...broadcastForm, sendEmail }),
      })
      setBroadcastSent(true)
      setBroadcastForm({ title: "", message: "", type: "info", target: "all" })
      setSendEmail(false)
      setShowEmailPreview(false)
      await loadBroadcasts()
      setTimeout(() => setBroadcastSent(false), 3000)
    } catch (_) {}
    setSendingBroadcast(false)
  }

  const handleDeleteBroadcast = async (id: string) => {
    try {
      await fetch(`/api/admin/broadcasts/${id}`, { method: "DELETE", credentials: "include" })
      setBroadcasts(prev => prev.filter(b => b.id !== id))
    } catch (_) {}
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  const TABS: { id: AdminTab; label: string; icon: React.ElementType }[] = [
    { id: "users",        label: "Users",         icon: Users },
    { id: "stats",        label: "Stats",         icon: BarChart3 },
    { id: "events",       label: "Events",        icon: Radio },
    { id: "analytics",    label: "Analytics",     icon: TrendingUp },
    { id: "intelligence", label: "Intelligence",  icon: Bot },
    { id: "messages",     label: "Messages",      icon: Send },
    { id: "broadcasts",   label: "Broadcast",     icon: Megaphone },
  ]

  if (!user?.isAdmin) return null

  return (
    <div className="flex h-screen bg-[#050505] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0 gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <Shield className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Admin Panel</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1 shrink-0">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button key={id} onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    activeTab === id ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-muted-foreground hover:text-foreground"
                  }`}>
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
            <button onClick={() => {
              loadData()
              if (activeTab === "analytics") loadAnalytics()
              if (activeTab === "events") loadEvents()
              if (activeTab === "broadcasts") loadBroadcasts()
              if (activeTab === "intelligence") loadIntelligence()
            }} disabled={loading}
              className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors shrink-0">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* ── Stats Tab ─────────────────────────────────────────────────── */}
          {activeTab === "stats" && stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers, icon: Users, color: "#6366F1" },
                  { label: "Admin Users", value: stats.admins, icon: Shield, color: "#EF4444" },
                  { label: "Total Generations", value: stats.totalGenerations, icon: BarChart3, color: "#D4AF37" },
                  { label: "Pro+ Users", value: (stats.planCounts.pro ?? 0) + (stats.planCounts.enterprise ?? 0), icon: Crown, color: "#8B5CF6" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <StatCard key={label} label={label} value={value} icon={Icon} color={color} />
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-4">Plan Distribution</h3>
                <div className="grid grid-cols-3 gap-4">
                  {(["free", "pro", "enterprise"] as Plan[]).map(plan => {
                    const meta = PLAN_META[plan]
                    const Icon = meta.icon
                    const cnt = stats.planCounts[plan] ?? 0
                    const pct = stats.totalUsers > 0 ? Math.round((cnt / stats.totalUsers) * 100) : 0
                    return (
                      <div key={plan} className="rounded-xl border border-white/8 bg-white/2 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}15` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                          </div>
                          <span className="text-xs font-bold text-foreground">{meta.label}</span>
                        </div>
                        <p className="text-xl font-black text-foreground">{cnt}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{pct}% of users</p>
                        <div className="mt-2 h-1 rounded-full bg-white/8 overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8 }} className="h-full rounded-full"
                            style={{ background: meta.color }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Users Tab ─────────────────────────────────────────────────── */}
          {activeTab === "users" && (
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input type="text" placeholder="Search users by email or name..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors" />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((u, i) => {
                    const plan = (u.subscription?.plan ?? "free") as Plan
                    const meta = PLAN_META[plan] ?? PLAN_META["free"]
                    const isExpanded = expandedUser === u.id
                    return (
                      <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                        <div className="flex items-center gap-4 px-5 py-4">
                          <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black"
                            style={{ background: `${meta.color}20`, color: meta.color }}>
                            {(u.name ?? u.email)[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground truncate">{u.name}</span>
                              {u.isAdmin && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 text-[9px] font-black text-red-400 uppercase">
                                  <Shield className="h-2 w-2" />Admin
                                </span>
                              )}
                              {u.id === user?.id && <span className="text-[9px] text-muted-foreground/50">(you)</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
                              {u.country && (
                                <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                                  <MapPin className="h-2.5 w-2.5" />{u.city ? `${u.city}, ` : ""}{u.country}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="hidden md:flex items-center gap-3">
                            <PlanBadge plan={plan} />
                            {u.subscription && (
                              <span className="text-[10px] text-muted-foreground">
                                {u.subscription.aiGenerationsUsed}/{u.subscription.aiGenerationsLimit === 9999 ? "∞" : u.subscription.aiGenerationsLimit} gen
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(u.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </span>
                          </div>
                          <button onClick={() => setExpandedUser(isExpanded ? null : u.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                            <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                          </button>
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                              className="overflow-hidden border-t border-white/5">
                              <div className="px-5 py-4 space-y-4">
                                <div>
                                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Change Plan</p>
                                  <div className="flex gap-2">
                                    {(["free", "pro", "enterprise"] as Plan[]).map(p => {
                                      const m = PLAN_META[p]
                                      const Icon = m.icon
                                      const isCurrent = plan === p
                                      return (
                                        <button key={p} onClick={() => handleChangePlan(u.id, p)}
                                          disabled={isCurrent || changingPlan === u.id}
                                          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-all border ${
                                            isCurrent ? "border-white/10 bg-white/5 text-muted-foreground cursor-default"
                                              : "border-white/8 bg-white/3 text-foreground hover:bg-white/8"
                                          }`}>
                                          {changingPlan === u.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Icon className="h-3 w-3" style={{ color: m.color }} />}
                                          {m.label}
                                          {isCurrent && <Check className="h-3 w-3 text-primary" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                                    disabled={togglingAdmin === u.id || u.id === user?.id}
                                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border transition-all ${
                                      u.isAdmin ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                        : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground hover:bg-white/8"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    {togglingAdmin === u.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}
                                    {u.isAdmin ? "Revoke Admin" : "Grant Admin"}
                                  </button>
                                  {u.id !== user?.id && (
                                    confirmDelete === u.id ? (
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                                          <AlertTriangle className="h-3 w-3" />Delete {u.name}?
                                        </span>
                                        <button onClick={() => handleDelete(u.id)} disabled={deletingUser === u.id}
                                          className="rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold px-3 py-1.5 hover:bg-red-500/30 transition-all">
                                          {deletingUser === u.id ? "Deleting..." : "Confirm"}
                                        </button>
                                        <button onClick={() => setConfirmDelete(null)}
                                          className="rounded-lg border border-white/10 bg-white/5 text-muted-foreground text-xs px-3 py-1.5 hover:text-foreground transition-all">
                                          Cancel
                                        </button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setConfirmDelete(u.id)}
                                        className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all">
                                        <Trash2 className="h-3 w-3" />Delete User
                                      </button>
                                    )
                                  )}
                                </div>
                                {u.subscription && (
                                  <div className="grid grid-cols-3 gap-2 pt-1">
                                    {[
                                      { label: "AI Gen", used: u.subscription.aiGenerationsUsed, limit: u.subscription.aiGenerationsLimit, color: "#D4AF37", icon: BarChart3 },
                                      { label: "Deploys", used: u.subscription.deploymentsUsed, limit: u.subscription.deploymentsLimit, color: "#6366F1", icon: Globe },
                                    ].map(({ label, used, limit, color, icon: Icon }) => (
                                      <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-3">
                                        <div className="flex items-center gap-1.5 mb-1.5">
                                          <Icon className="h-3 w-3" style={{ color }} />
                                          <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
                                        </div>
                                        <p className="text-sm font-black text-foreground">
                                          {used} <span className="text-[10px] text-muted-foreground font-normal">/ {limit >= 9999 ? "∞" : limit}</span>
                                        </p>
                                      </div>
                                    ))}
                                    <div className="rounded-xl border border-white/8 bg-white/2 p-3">
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <UserCheck className="h-3 w-3 text-emerald-400" />
                                        <span className="text-[10px] font-bold text-muted-foreground">Status</span>
                                      </div>
                                      <p className="text-sm font-black text-emerald-400 capitalize">{u.subscription.status}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  })}
                  {filtered.length === 0 && (
                    <div className="text-center py-16 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No users found</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Events Tab ────────────────────────────────────────────────── */}
          {activeTab === "events" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {["all", "user_signup", "user_login", "user_logout", "project_created", "project_opened", "bi_generated", "website_generated", "chatbot_generated", "automation_created", "orchestrator_generated", "marcus_message", "marcus_task_created"].map(t => (
                    <button key={t} onClick={() => setEventTypeFilter(t)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                        eventTypeFilter === t ? "bg-red-500/15 border-red-500/25 text-red-400" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"
                      }`}>
                      {t === "all" ? "All" : (EVENT_TYPE_META[t]?.label ?? t)}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-full ${sseConnected ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-white/5 text-muted-foreground border border-white/8"}`}>
                  <motion.div className={`h-1.5 w-1.5 rounded-full ${sseConnected ? "bg-emerald-400" : "bg-muted-foreground"}`}
                    animate={sseConnected ? { opacity: [1, 0.3, 1] } : {}} transition={{ duration: 1, repeat: Infinity }} />
                  {sseConnected ? "Live" : "Offline"}
                </div>
              </div>

              {liveEvents.length > 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <Radio className="h-3 w-3" /> Live Feed ({liveEvents.length} new)
                  </p>
                  <div className="space-y-1.5">
                    {liveEvents.slice(0, 5).map(ev => (
                      <div key={ev.id} className="flex items-center gap-3 text-xs">
                        <EventTypeBadge type={ev.type} />
                        <span className="text-muted-foreground truncate">{ev.userEmail ?? "anonymous"}</span>
                        {ev.country && <span className="text-muted-foreground/50 text-[10px]">{ev.country}</span>}
                        <span className="ml-auto text-muted-foreground/50 shrink-0">{timeAgo(ev.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Type</th>
                        <th className="text-left px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest">User</th>
                        <th className="text-left px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">Location</th>
                        <th className="text-right px-4 py-3 text-[10px] font-black text-muted-foreground uppercase tracking-widest">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((ev, i) => (
                        <motion.tr key={ev.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}
                          className="border-b border-white/3 hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3"><EventTypeBadge type={ev.type} /></td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[160px] truncate">{ev.userEmail ?? "—"}</td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            {ev.country ? (
                              <span className="text-muted-foreground/70 flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" />
                                {ev.city ? `${ev.city}, ` : ""}{ev.country}
                              </span>
                            ) : <span className="text-muted-foreground/30">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground/60 whitespace-nowrap">{timeAgo(ev.createdAt)}</td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                  {events.length === 0 && (
                    <div className="py-16 text-center text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No events recorded yet</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Analytics Tab ─────────────────────────────────────────────── */}
          {activeTab === "analytics" && (
            <div className="space-y-5">
              {!analytics ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Total Users" value={analytics.overview.totalUsers} icon={Users} color="#6366F1" />
                    <StatCard label="Total Projects" value={analytics.overview.totalProjects ?? 0} icon={FolderOpen} color="#F59E0B" />
                    <StatCard label="Total Generations" value={analytics.overview.totalGenerations ?? 0} icon={Zap} color="#D4AF37" />
                    <StatCard label="Marcus Messages" value={analytics.overview.totalMarcusMessages ?? 0} icon={Bot} color="#06B6D4" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatCard label="Active Today" value={analytics.overview.activeUsers24h} icon={Activity} color="#10B981" sub="unique users" />
                    <StatCard label="Active (7d)" value={analytics.overview.activeUsers7d} icon={TrendingUp} color="#8B5CF6" sub="unique users" />
                    <StatCard label="Active (30d)" value={analytics.overview.activeUsers30d ?? 0} icon={Globe} color="#EC4899" sub="unique users" />
                    <StatCard label="Total Events" value={analytics.overview.totalEvents} icon={Radio} color="#6B7280" />
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                        <Funnel className="h-4 w-4 text-primary" /> Conversion Funnel
                      </h3>
                      <div className="space-y-3">
                        {analytics.funnel.map((stage, i) => (
                          <div key={stage.stage}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-xs font-bold text-foreground">{stage.stage}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{stage.count.toLocaleString()}</span>
                                {i > 0 && (
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${stage.pct >= 50 ? "bg-emerald-500/10 text-emerald-400" : stage.pct >= 25 ? "bg-amber-500/10 text-amber-400" : "bg-red-500/10 text-red-400"}`}>
                                    {stage.pct}%
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                              <motion.div initial={{ width: 0 }} animate={{ width: `${stage.pct}%` }}
                                transition={{ duration: 0.8, delay: i * 0.1 }}
                                className="h-full rounded-full"
                                style={{ background: i === 0 ? "#6366F1" : "#D4AF37" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" /> Top Countries
                      </h3>
                      {analytics.geo.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No geo data yet</p>
                      ) : (
                        <div className="space-y-2">
                          {analytics.geo.slice(0, 8).map((g, i) => {
                            const maxUsers = analytics.geo[0]?.users ?? 1
                            const pct = Math.round((g.users / maxUsers) * 100)
                            return (
                              <div key={g.country ?? i}>
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-foreground">{g.country ?? "Unknown"}</span>
                                  <span className="text-[10px] text-muted-foreground">{g.users} users</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.05 }}
                                    className="h-full rounded-full bg-primary/60" />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" /> Top Cities
                      </h3>
                      {!analytics.topCities || analytics.topCities.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No city data yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {analytics.topCities.slice(0, 8).map((c, i) => (
                            <div key={c.city ?? i} className="flex items-center justify-between">
                              <span className="text-xs text-foreground">{c.city ?? "Unknown"}</span>
                              <span className="text-[10px] text-muted-foreground bg-white/5 rounded-full px-2 py-0.5">{c.users}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                      <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" /> Top Users
                      </h3>
                      {!analytics.topUsers || analytics.topUsers.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-8 text-center">No activity yet</p>
                      ) : (
                        <div className="space-y-1.5">
                          {analytics.topUsers.map((u, i) => (
                            <div key={u.userId ?? i} className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-foreground truncate">{u.email ?? "Unknown"}</p>
                              </div>
                              <span className="text-[10px] font-bold text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5 ml-2 shrink-0">{Number(u.total).toLocaleString()} events</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <h3 className="text-sm font-black text-foreground mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" /> Event Breakdown
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {analytics.eventTypes.map(et => (
                        <div key={et.type} className="rounded-xl border border-white/8 bg-white/2 p-3">
                          <EventTypeBadge type={et.type} />
                          <p className="text-lg font-black text-foreground mt-2">{et.total.toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── User Intelligence Tab ─────────────────────────────────────── */}
          {activeTab === "intelligence" && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input type="text" placeholder="Search by email or name..."
                    value={intelligenceSearch} onChange={e => setIntelligenceSearch(e.target.value)}
                    className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors" />
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  {(["all", "active", "inactive", "power", "paid", "new"] as const).map(f => (
                    <button key={f} onClick={() => setIntelligenceFilter(f)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${intelligenceFilter === f ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {f === "all" ? "All Users" : f === "active" ? "Active (7d)" : f === "inactive" ? "Dormant" : f === "power" ? "Power Users" : f === "paid" ? "Paid" : "New (<7d)"}
                    </button>
                  ))}
                </div>
                <select value={intelligenceSort} onChange={e => setIntelligenceSort(e.target.value as typeof intelligenceSort)}
                  className="rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs text-foreground outline-none">
                  <option value="activityScore">Sort: Activity Score</option>
                  <option value="biGenerations">Sort: BI Gens</option>
                  <option value="projectCount">Sort: Projects</option>
                  <option value="createdAt">Sort: Newest</option>
                </select>
              </div>

              {!intelligence ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (() => {
                const now = Date.now()
                const day7 = 7 * 24 * 60 * 60 * 1000
                const filtered = intelligence
                  .filter(u => {
                    const q = intelligenceSearch.toLowerCase()
                    if (q && !u.email.toLowerCase().includes(q) && !u.name.toLowerCase().includes(q)) return false
                    if (intelligenceFilter === "active") return u.lastSeenAt && (now - new Date(u.lastSeenAt).getTime()) < day7
                    if (intelligenceFilter === "inactive") return !u.lastSeenAt || (now - new Date(u.lastSeenAt).getTime()) > day7 * 4
                    if (intelligenceFilter === "power") return u.activityScore >= 20
                    if (intelligenceFilter === "paid") return u.plan !== "free"
                    if (intelligenceFilter === "new") return (now - new Date(u.createdAt).getTime()) < day7
                    return true
                  })
                  .sort((a, b) => {
                    if (intelligenceSort === "activityScore") return b.activityScore - a.activityScore
                    if (intelligenceSort === "biGenerations") return b.biGenerations - a.biGenerations
                    if (intelligenceSort === "projectCount") return b.projectCount - a.projectCount
                    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                  })

                return (
                  <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-white/8 bg-white/3">
                            <th className="text-left px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">User</th>
                            <th className="text-left px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Location</th>
                            <th className="text-left px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Plan</th>
                            <th className="text-left px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Last Active</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Projects</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">BI</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Web</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Chat</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Auto</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Orch</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Marcus</th>
                            <th className="text-right px-4 py-3 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.length === 0 ? (
                            <tr><td colSpan={12} className="text-center py-12 text-muted-foreground">No users match this filter</td></tr>
                          ) : filtered.map(u => (
                            <tr key={u.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                              <td className="px-4 py-3">
                                <p className="font-bold text-foreground truncate max-w-[160px]">{u.email}</p>
                                <p className="text-muted-foreground text-[10px]">{u.name}</p>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {u.country ? `${u.city ? u.city + ", " : ""}${u.country}` : "—"}
                              </td>
                              <td className="px-4 py-3"><PlanBadge plan={u.plan as Plan} /></td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {u.lastSeenAt ? new Date(u.lastSeenAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Never"}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-foreground">{u.projectCount}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{u.biGenerations}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{u.websiteGenerations}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{u.chatbotGenerations}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{u.automationGenerations}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{u.orchestratorGenerations}</td>
                              <td className="px-4 py-3 text-right text-muted-foreground">{u.marcusMessages}</td>
                              <td className="px-4 py-3 text-right">
                                <span className={`font-black text-sm ${u.activityScore >= 50 ? "text-primary" : u.activityScore >= 20 ? "text-amber-400" : "text-muted-foreground"}`}>
                                  {u.activityScore}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="px-4 py-2 border-t border-white/5 text-[10px] text-muted-foreground">
                      {filtered.length} of {intelligence.length} users
                    </div>
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Message Center Tab ────────────────────────────────────────── */}
          {activeTab === "messages" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground flex items-center gap-2 mb-4">
                  <Send className="h-4 w-4 text-primary" /> Send In-App Message
                </h3>
                <div className="space-y-3">
                  <input type="text" placeholder="Message title..."
                    value={msgForm.title} onChange={e => setMsgForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors" />
                  <textarea placeholder="Message body..."
                    value={msgForm.body} onChange={e => setMsgForm(f => ({ ...f, body: e.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors resize-none" />
                  <div className="flex gap-5 flex-wrap">
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["announcement", "feature", "tip", "warning", "maintenance"] as const).map(t => (
                          <button key={t} onClick={() => setMsgForm(f => ({ ...f, type: t }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${msgForm.type === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Target</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["all", "free", "pro", "startup", "enterprise", "individual"] as const).map(t => (
                          <button key={t} onClick={() => setMsgForm(f => ({ ...f, target: t }))}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${msgForm.target === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {msgForm.target === "individual" && (
                    <input type="text" placeholder="User ID (UUID)..."
                      value={msgForm.targetUserId} onChange={e => setMsgForm(f => ({ ...f, targetUserId: e.target.value }))}
                      className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors font-mono text-xs" />
                  )}
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={async () => {
                      if (!msgForm.title.trim() || !msgForm.body.trim()) return
                      setSendingMsg(true)
                      try {
                        await fetch("/api/admin/message-center", {
                          method: "POST", credentials: "include",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ ...msgForm }),
                        })
                        setMsgSent(true)
                        setMsgForm({ target: "all", targetUserId: "", type: "announcement", title: "", body: "" })
                        setTimeout(() => setMsgSent(false), 3000)
                      } catch (_) {}
                      setSendingMsg(false)
                    }} disabled={sendingMsg || !msgForm.title.trim() || !msgForm.body.trim()}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {sendingMsg ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sendingMsg ? "Sending..." : `Send to ${msgForm.target === "individual" ? "user" : msgForm.target} (in-app)`}
                    </button>
                    <AnimatePresence>
                      {msgSent && (
                        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <Check className="h-3.5 w-3.5" /> Message sent!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <p className="text-xs text-muted-foreground">
                  Messages are delivered to users' notification bell in real-time. Target segments use the same plan groupings as broadcasts. Use "individual" + User ID to send a direct in-app message to a specific user.
                </p>
              </div>
            </div>
          )}

          {/* ── Broadcasts Tab ────────────────────────────────────────────── */}
          {activeTab === "broadcasts" && (
            <div className="space-y-5">

              {/* Compose card */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                    <Megaphone className="h-4 w-4 text-primary" /> Compose Broadcast
                  </h3>
                  {segmentCounts?.emailEnabled && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2.5 py-1">
                      <Check className="h-2.5 w-2.5" /> Email delivery enabled
                    </span>
                  )}
                  {segmentCounts && !segmentCounts.emailEnabled && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground/60 bg-white/3 border border-white/8 rounded-full px-2.5 py-1">
                      In-app only · Configure SMTP to enable email
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <input type="text" placeholder="Subject / title..."
                    value={broadcastForm.title} onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors" />
                  <textarea placeholder="Write your message to users..."
                    value={broadcastForm.message} onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))}
                    rows={4}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors resize-none" />

                  <div className="flex gap-5 flex-wrap">
                    {/* Type picker */}
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Type</p>
                      <div className="flex gap-2">
                        {(["info", "update", "feature", "warning"] as const).map(t => {
                          const meta = BROADCAST_TYPE_META[t]
                          return (
                            <button key={t} onClick={() => setBroadcastForm(f => ({ ...f, type: t }))}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${broadcastForm.type === t ? "text-foreground" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}
                              style={broadcastForm.type === t ? { background: `${meta.color}15`, borderColor: `${meta.color}30`, color: meta.color } : {}}>
                              {meta.label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* Target picker with user counts */}
                    <div>
                      <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Segment</p>
                      <div className="flex gap-2 flex-wrap">
                        {(["all", "free", "pro", "startup", "enterprise"] as const).map(t => {
                          const cnt = segmentCounts ? segmentCounts[t] : null
                          return (
                            <button key={t} onClick={() => setBroadcastForm(f => ({ ...f, target: t }))}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all capitalize ${broadcastForm.target === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                              {t}
                              {cnt !== null && (
                                <span className={`text-[9px] font-black rounded-full px-1.5 py-0.5 ${broadcastForm.target === t ? "bg-primary/20 text-primary" : "bg-white/8 text-muted-foreground/60"}`}>
                                  {cnt}
                                </span>
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Email toggle + preview */}
                  {segmentCounts?.emailEnabled && (
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        onClick={() => setSendEmail(v => !v)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${sendEmail ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                        <Mail className="h-3.5 w-3.5" />
                        {sendEmail ? "Email delivery ON" : "Also send via email"}
                      </button>
                      {(broadcastForm.title.trim() || broadcastForm.message.trim()) && (
                        <button
                          onClick={() => setShowEmailPreview(v => !v)}
                          className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors">
                          <Eye className="h-3.5 w-3.5" />
                          {showEmailPreview ? "Hide preview" : "Preview email"}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Email preview iframe */}
                  <AnimatePresence>
                    {showEmailPreview && (broadcastForm.title.trim() || broadcastForm.message.trim()) && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-xl border border-white/8">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 py-2 border-b border-white/5 bg-white/3">
                          Email Preview
                        </p>
                        <iframe
                          key={`${broadcastForm.title}|${broadcastForm.message}|${broadcastForm.type}`}
                          src={`/api/admin/broadcasts/preview-email?title=${encodeURIComponent(broadcastForm.title || "Broadcast Title")}&message=${encodeURIComponent(broadcastForm.message || "Your message here.")}&type=${broadcastForm.type}`}
                          className="w-full border-0"
                          style={{ height: 460, background: "#0a0a0f" }}
                          title="Email preview"
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Send bar */}
                  <div className="flex items-center gap-3 pt-1">
                    <button onClick={handleSendBroadcast}
                      disabled={sendingBroadcast || !broadcastForm.title.trim() || !broadcastForm.message.trim()}
                      className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold bg-primary text-black hover:bg-primary/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                      {sendingBroadcast ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      {sendingBroadcast
                        ? "Sending..."
                        : sendEmail
                          ? `Send to ${segmentCounts?.[broadcastForm.target as keyof SegmentCounts] ?? "?"} users (in-app + email)`
                          : `Send to ${segmentCounts?.[broadcastForm.target as keyof SegmentCounts] ?? "?"} users`}
                    </button>
                    <AnimatePresence>
                      {broadcastSent && (
                        <motion.div initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                          className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
                          <Check className="h-3.5 w-3.5" /> Sent successfully!
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Recent broadcasts */}
              <div className="space-y-2">
                <h3 className="text-xs font-black text-muted-foreground uppercase tracking-widest">Broadcast History</h3>
                {broadcasts.length === 0 ? (
                  <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center text-muted-foreground">
                    <Megaphone className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No broadcasts sent yet</p>
                  </div>
                ) : broadcasts.map(b => {
                  const meta = BROADCAST_TYPE_META[b.type] ?? BROADCAST_TYPE_META.info
                  return (
                    <motion.div key={b.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl border border-white/8 bg-white/2 px-5 py-4">
                      <div className="flex items-start gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold"
                              style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}30` }}>
                              {meta.label}
                            </span>
                            <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold bg-white/5 text-muted-foreground border border-white/8 capitalize">
                              → {b.target}
                            </span>
                            {(b.deliveredCount ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <Users className="h-2.5 w-2.5" /> {b.deliveredCount} delivered
                              </span>
                            )}
                            {b.emailDelivered && (
                              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                                <Mail className="h-2.5 w-2.5" /> emailed
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-bold text-foreground">{b.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{b.message}</p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1.5 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {new Date(b.createdAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        <button onClick={() => handleDeleteBroadcast(b.id)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/5 transition-colors shrink-0">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
