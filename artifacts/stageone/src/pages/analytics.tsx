import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts"
import {
  Brain, Zap, Activity, Clock, Globe, BarChart3, TrendingUp, Rocket,
} from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import stageoneIcon from "@/assets/stageone-icon.png"

interface Subscription {
  plan: string
  aiGenerationsUsed: number
  aiGenerationsLimit: number
  deploymentsUsed: number
  deploymentsLimit: number
  workspacesUsed: number
  workspacesLimit: number
}

interface Project {
  id: string
  createdAt: string
  websiteOutput?: unknown
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-white/10 bg-[#0a0a0a] p-3 shadow-xl text-xs">
      <p className="text-muted-foreground mb-2 font-semibold">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <div className="h-1.5 w-1.5 rounded-full" style={{ background: p.color }} />
          <span className="text-foreground/70">{p.name}:</span>
          <span className="font-bold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  )
}

function UsageBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0
  const isWarning = pct >= 80
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{used} / {limit === -1 ? "∞" : limit} used</span>
        <span className="text-[10px] font-bold" style={{ color: isWarning ? "#F87171" : color }}>{pct === 0 ? "0%" : `${Math.round(pct)}%`}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full"
          style={{ background: isWarning ? "#F87171" : color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>
    </div>
  )
}

function EmptyChartState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[200px] text-center">
      <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-3" />
      <p className="text-xs text-muted-foreground/50">{label}</p>
    </div>
  )
}

export default function AnalyticsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "ai" | "automations" | "performance">("overview")
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [subLoading, setSubLoading] = useState(true)
  const [projectsData, setProjectsData] = useState<Array<{ day: string; analyses: number; websites: number }>>([])

  useEffect(() => {
    setSubLoading(true)
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription) setSubscription(d.subscription) })
      .catch(() => {})
      .finally(() => setSubLoading(false))

    fetch("/api/projects", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.projects)) {
          setProjects(d.projects)
          // Build last-7-day activity from real project timestamps
          const now = Date.now()
          const days: Array<{ day: string; analyses: number; websites: number }> = []
          for (let i = 6; i >= 0; i--) {
            const dayStart = now - i * 86400000
            const dayEnd = dayStart + 86400000
            const label = new Date(dayStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })
            const analyses = d.projects.filter((p: Project) => {
              const t = new Date(p.createdAt).getTime()
              return t >= dayStart && t < dayEnd
            }).length
            const websites = d.projects.filter((p: Project) => {
              const t = new Date(p.createdAt).getTime()
              return t >= dayStart && t < dayEnd && p.websiteOutput
            }).length
            days.push({ day: label, analyses, websites })
          }
          setProjectsData(days)
        }
      })
      .catch(() => {})
  }, [])

  const totalWebsites = projects.filter(p => p.websiteOutput).length

  return (
    <div className="flex h-screen bg-[#050505] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Analytics</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">AI Infrastructure Metrics</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-semibold text-emerald-400">All Systems Operational</span>
            </div>
            <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1 ml-3">
              {(["overview", "ai", "automations", "performance"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    activeTab === tab
                      ? "bg-primary/15 text-primary border border-primary/25"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {tab === "ai" ? "AI Usage" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* KPI cards — real data from subscription */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                icon: Brain,
                label: "AI Operations",
                value: subLoading ? "—" : String(subscription?.aiGenerationsUsed ?? 0),
                sub: `of ${subscription?.aiGenerationsLimit === -1 ? "unlimited" : subscription?.aiGenerationsLimit ?? 0} this period`,
                color: "#D4AF37",
              },
              {
                icon: Rocket,
                label: "Deployments",
                value: subLoading ? "—" : String(subscription?.deploymentsUsed ?? 0),
                sub: `of ${subscription?.deploymentsLimit === -1 ? "unlimited" : subscription?.deploymentsLimit ?? 0} total`,
                color: "#8B5CF6",
              },
              {
                icon: Globe,
                label: "Websites Generated",
                value: subLoading ? "—" : String(totalWebsites),
                sub: "From your projects",
                color: "#10B981",
              },
              {
                icon: TrendingUp,
                label: "Total Projects",
                value: subLoading ? "—" : String(projects.length),
                sub: "All-time analyses",
                color: "#3B82F6",
              },
            ].map(({ icon: Icon, label, value, sub, color }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
                  <p className="text-xs font-semibold text-foreground/70 mt-0.5">{label}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Activity chart — real data from projects */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-foreground">AI Activity — Last 7 Days</h3>
                    <p className="text-[10px] text-muted-foreground">Based on your project history</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px]">
                    {[
                      { label: "Analyses", color: "#D4AF37" },
                      { label: "Websites", color: "#10B981" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                        <span className="text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {projectsData.some(d => d.analyses > 0 || d.websites > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={projectsData}>
                      <defs>
                        <linearGradient id="gradAI" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradWeb" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#666" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#666" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="analyses" name="Analyses" stroke="#D4AF37" strokeWidth={2} fill="url(#gradAI)" />
                      <Area type="monotone" dataKey="websites" name="Websites" stroke="#10B981" strokeWidth={2} fill="url(#gradWeb)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState label="Run your first analysis to see activity data here." />
                )}
              </div>

              {/* Subscription usage */}
              {subscription && (
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-1">Subscription Usage</h3>
                  <p className="text-[10px] text-muted-foreground mb-5 capitalize">
                    {subscription.plan} plan — current period
                  </p>
                  <div className="space-y-5">
                    <div>
                      <p className="text-xs font-semibold text-foreground/70 mb-2">AI Operations</p>
                      <UsageBar used={subscription.aiGenerationsUsed} limit={subscription.aiGenerationsLimit} color="#D4AF37" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground/70 mb-2">Execution Deployments</p>
                      <UsageBar used={subscription.deploymentsUsed} limit={subscription.deploymentsLimit} color="#8B5CF6" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-foreground/70 mb-2">Operating Environments</p>
                      <UsageBar used={subscription.workspacesUsed} limit={subscription.workspacesLimit} color="#10B981" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-1">AI Operations Trend</h3>
                <p className="text-[10px] text-muted-foreground mb-4">Based on project activity</p>
                {projectsData.some(d => d.analyses > 0) ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={projectsData}>
                      <defs>
                        <linearGradient id="gradToken" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#666" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#666" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="analyses" name="AI Operations" stroke="#D4AF37" strokeWidth={2} fill="url(#gradToken)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyChartState label="Run your first analysis to see AI operation trends." />
                )}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-1">Usage Summary</h3>
                <p className="text-[10px] text-muted-foreground mb-4">Current billing period</p>
                {subscription ? (
                  <div className="space-y-4">
                    <UsageBar used={subscription.aiGenerationsUsed} limit={subscription.aiGenerationsLimit} color="#D4AF37" />
                  </div>
                ) : (
                  <EmptyChartState label="Loading subscription data…" />
                )}
              </div>
            </div>
          )}

          {activeTab === "automations" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/2 p-8 text-center">
                <Zap className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground/50 mb-1">Automation Analytics</h3>
                <p className="text-xs text-muted-foreground">Workflow execution metrics will appear here as you build and run automations.</p>
              </div>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Avg Response Time", value: "< 30s", icon: Clock, color: "#D4AF37", sub: "AI operation latency" },
                  { label: "AI Engine", value: "Multi-Model", icon: Activity, color: "#8B5CF6", sub: "Distributed AI pipeline" },
                  { label: "Uptime", value: "99.9%", icon: Globe, color: "#10B981", sub: "Platform availability" },
                ].map(({ label, value, icon: Icon, color, sub }) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-4">
                    <Icon className="h-4 w-4 mb-2" style={{ color }} />
                    <p className="text-lg font-black text-foreground">{value}</p>
                    <p className="text-[10px] font-semibold text-foreground/70">{label}</p>
                    <p className="text-[9px] text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/2 p-8 text-center">
                <Activity className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-foreground/50 mb-1">Performance History</h3>
                <p className="text-xs text-muted-foreground">Detailed latency and throughput graphs will appear as more operations are recorded.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
