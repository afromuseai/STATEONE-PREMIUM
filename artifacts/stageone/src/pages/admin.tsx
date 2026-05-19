import { useState, useEffect, useCallback } from "react"
import { useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import {
  Shield, Users, BarChart3, Crown, Zap, Building2,
  Trash2, ChevronDown, RefreshCw, Search, UserCheck,
  TrendingUp, Globe, Bot, X, Check, AlertTriangle,
} from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { useAuth } from "@/lib/auth-context"
import { api } from "@/lib/api"
import stageoneIcon from "@/assets/stageone-icon.png"

type Plan = "free" | "pro" | "enterprise"

interface AdminUser {
  id: string
  email: string
  name: string
  isAdmin: boolean
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

const PLAN_META = {
  free:       { icon: Zap,       color: "#10B981", label: "Free" },
  pro:        { icon: Crown,     color: "#D4AF37", label: "Pro" },
  enterprise: { icon: Building2, color: "#8B5CF6", label: "Enterprise" },
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

export default function AdminPage() {
  const { user } = useAuth()
  const [, setLocation] = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeTab, setActiveTab] = useState<"users" | "stats">("users")
  const [changingPlan, setChangingPlan] = useState<string | null>(null)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [deletingUser, setDeletingUser] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

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

  useEffect(() => { loadData() }, [loadData])

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

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.name.toLowerCase().includes(search.toLowerCase())
  )

  if (!user?.isAdmin) return null

  return (
    <div className="flex h-screen bg-[#050505] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
              <Shield className="h-4 w-4 text-red-400" />
            </div>
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Admin Panel</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
              {(["users", "stats"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    activeTab === tab ? "bg-red-500/15 text-red-400 border border-red-500/25" : "text-muted-foreground hover:text-foreground"
                  }`}>{tab === "users" ? "Users" : "Statistics"}</button>
              ))}
            </div>
            <button onClick={loadData} disabled={loading}
              className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "stats" && stats && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total Users", value: stats.totalUsers, icon: Users, color: "#6366F1" },
                  { label: "Admin Users", value: stats.admins, icon: Shield, color: "#EF4444" },
                  { label: "Total Generations", value: stats.totalGenerations, icon: BarChart3, color: "#D4AF37" },
                  { label: "Pro+ Users", value: (stats.planCounts.pro ?? 0) + (stats.planCounts.enterprise ?? 0), icon: Crown, color: "#8B5CF6" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/8 bg-white/2 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                    </div>
                    <p className="text-2xl font-black text-foreground">{value}</p>
                    <p className="text-xs text-muted-foreground mt-1">{label}</p>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-4">Plan Distribution</h3>
                <div className="grid grid-cols-3 gap-4">
                  {(["free", "pro", "enterprise"] as Plan[]).map(plan => {
                    const meta = PLAN_META[plan]
                    const Icon = meta.icon
                    const count = stats.planCounts[plan] ?? 0
                    const pct = stats.totalUsers > 0 ? Math.round((count / stats.totalUsers) * 100) : 0
                    return (
                      <div key={plan} className="rounded-xl border border-white/8 bg-white/2 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}15` }}>
                            <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                          </div>
                          <span className="text-xs font-bold text-foreground">{meta.label}</span>
                        </div>
                        <p className="text-xl font-black text-foreground">{count}</p>
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

          {activeTab === "users" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-white/20 transition-colors"
                />
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-20">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {filtered.map((u, i) => {
                    const plan = (u.subscription?.plan ?? "free") as Plan
                    const meta = PLAN_META[plan]
                    const isExpanded = expandedUser === u.id
                    return (
                      <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">

                        {/* Row */}
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
                              {u.id === user?.id && (
                                <span className="text-[9px] text-muted-foreground/50">(you)</span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground truncate">{u.email}</p>
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

                        {/* Expanded actions */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden border-t border-white/5"
                            >
                              <div className="px-5 py-4 space-y-4">
                                {/* Plan change */}
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
                                            isCurrent
                                              ? "border-white/10 bg-white/5 text-muted-foreground cursor-default"
                                              : "border-white/8 bg-white/3 text-foreground hover:bg-white/8"
                                          }`}>
                                          {changingPlan === u.id ? (
                                            <RefreshCw className="h-3 w-3 animate-spin" />
                                          ) : (
                                            <Icon className="h-3 w-3" style={{ color: m.color }} />
                                          )}
                                          {m.label}
                                          {isCurrent && <Check className="h-3 w-3 text-primary" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>

                                {/* Admin toggle + Delete */}
                                <div className="flex items-center gap-3">
                                  <button
                                    onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                                    disabled={togglingAdmin === u.id || u.id === user?.id}
                                    className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border transition-all ${
                                      u.isAdmin
                                        ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                        : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground hover:bg-white/8"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}>
                                    {togglingAdmin === u.id ? (
                                      <RefreshCw className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <Shield className="h-3 w-3" />
                                    )}
                                    {u.isAdmin ? "Revoke Admin" : "Grant Admin"}
                                  </button>

                                  {u.id !== user?.id && (
                                    <>
                                      {confirmDelete === u.id ? (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-red-400 font-medium flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />Delete {u.name}?
                                          </span>
                                          <button onClick={() => handleDelete(u.id)}
                                            disabled={deletingUser === u.id}
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
                                          <Trash2 className="h-3 w-3" />
                                          Delete User
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Usage mini-stats */}
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
        </div>
      </div>
    </div>
  )
}
