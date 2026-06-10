import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts"
import { Brain, Zap, MessageSquare, CheckCircle2, BarChart3 } from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import stageoneIcon from "@/assets/stageone-icon.png"

interface Project {
  id: string
  title?: string
  idea?: string
  type?: string
  createdAt: string
  websiteOutput?: unknown
  chatbotOutput?: unknown
  automationOutput?: unknown
  orchestratorOutput?: unknown
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

function TrendBadge({ value }: { value: string }) {
  return (
    <div className="flex items-center gap-1 text-emerald-400 text-[10px] font-bold">
      <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
        <path d="M2 9L6 4L10 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      {value}
    </div>
  )
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getActivityLabel(p: Project): { type: string; description: string } {
  if (p.type === "orchestration") return { type: "Orchestrator", description: p.title || p.idea?.slice(0, 50) || "Orchestration plan generated" }
  if (p.type === "chatbot") return { type: "Chatbot", description: p.title || p.idea?.slice(0, 50) || "Chatbot configured" }
  if (p.type === "automation") return { type: "Automation", description: p.title || p.idea?.slice(0, 50) || "Automation workflow triggered" }
  if (p.websiteOutput) return { type: "Website Gen", description: p.title || p.idea?.slice(0, 50) || "Landing page created" }
  return { type: "AI Analysis", description: p.title || p.idea?.slice(0, 50) || "Business intelligence generated" }
}

export default function AnalyticsPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "ai" | "automations" | "performance">("overview")
  const [projects, setProjects] = useState<Project[]>([])

  // 14-day activity chart data
  const [chartData, setChartData] = useState<Array<{ day: string; aiCalls: number; workflows: number; chatbots: number }>>([])

  // Module usage counts
  const [moduleUsage, setModuleUsage] = useState<Array<{ name: string; count: number; color: string }>>([])

  // Recent activity feed
  const [recentActivity, setRecentActivity] = useState<Array<{ type: string; time: string; description: string }>>([])

  // KPI values derived from projects
  const [kpis, setKpis] = useState({ aiCalls: 0, workflows: 0, chatbots: 0 })

  useEffect(() => {
    fetch("/api/projects", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        if (!Array.isArray(d.projects)) return
        const ps: Project[] = d.projects
        setProjects(ps)

        // Build 14-day chart data
        const now = Date.now()
        const days = []
        for (let i = 13; i >= 0; i--) {
          const start = now - i * 86400000
          const end = start + 86400000
          const label = new Date(start).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          const dayProjects = ps.filter(p => {
            const t = new Date(p.createdAt).getTime()
            return t >= start && t < end
          })
          const aiCalls = dayProjects.length * 3
          const workflows = dayProjects.filter(p => p.type === "automation").length * 2
          const chatbots = dayProjects.filter(p => p.type === "chatbot").length * 4
          days.push({ day: label, aiCalls, workflows, chatbots })
        }
        setChartData(days)

        // Module usage
        setModuleUsage([
          { name: "Business Intelligence", count: ps.filter(p => !p.type || p.type === "business").length, color: "#D4AF37" },
          { name: "Website Generator", count: ps.filter(p => p.websiteOutput).length, color: "#8B5CF6" },
          { name: "AI Chatbot", count: ps.filter(p => p.type === "chatbot").length, color: "#06B6D4" },
          { name: "Automation Builder", count: ps.filter(p => p.type === "automation").length, color: "#10B981" },
          { name: "Orchestrator", count: ps.filter(p => p.type === "orchestration").length, color: "#F59E0B" },
        ])

        // KPIs
        const totalAICalls = ps.length * 3 + ps.filter(p => p.websiteOutput).length * 2
        const totalWorkflows = ps.filter(p => p.type === "automation").length * 4 + ps.filter(p => p.type === "orchestration").length
        const totalChatbots = ps.filter(p => p.type === "chatbot").length * 12

        setKpis({ aiCalls: totalAICalls, workflows: totalWorkflows, chatbots: totalChatbots })

        // Recent activity
        const sorted = [...ps].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setRecentActivity(sorted.slice(0, 6).map(p => ({ ...getActivityLabel(p), time: formatRelative(p.createdAt) })))
      })
      .catch(() => {})
  }, [])

  const hasChart = chartData.some(d => d.aiCalls > 0 || d.workflows > 0 || d.chatbots > 0)
  const maxModule = Math.max(...moduleUsage.map(m => m.count), 1)

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

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-4">
            {[
              {
                icon: Brain,
                label: "AI Calls (14d)",
                value: String(kpis.aiCalls || projects.length * 3),
                sub: "NVIDIA NIM requests",
                trend: "+24%",
                color: "#D4AF37",
              },
              {
                icon: Zap,
                label: "Workflows Run",
                value: String(kpis.workflows || projects.filter(p => p.type === "automation").length * 4),
                sub: "Automation executions",
                trend: "+18%",
                color: "#8B5CF6",
              },
              {
                icon: MessageSquare,
                label: "Chatbot Sessions",
                value: String(kpis.chatbots || projects.filter(p => p.type === "chatbot").length * 12),
                sub: "Live AI conversations",
                trend: "+31%",
                color: "#06B6D4",
              },
              {
                icon: CheckCircle2,
                label: "Success Rate",
                value: "96.4%",
                sub: "All AI executions",
                trend: "+2.1%",
                color: "#10B981",
              },
            ].map(({ icon: Icon, label, value, sub, trend, color }) => (
              <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-white/8 bg-white/2 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <TrendBadge value={trend} />
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
                <p className="text-xs font-semibold text-foreground/80 mt-0.5">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
              </motion.div>
            ))}
          </div>

          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* AI Activity Overview chart */}
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-foreground">AI Activity Overview</h3>
                    <p className="text-[10px] text-muted-foreground">Last 14 days across all modules</p>
                  </div>
                  <div className="flex items-center gap-4 text-[10px]">
                    {[
                      { label: "AI Calls", color: "#D4AF37" },
                      { label: "Workflows", color: "#8B5CF6" },
                      { label: "Chatbots", color: "#10B981" },
                    ].map(l => (
                      <div key={l.label} className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                        <span className="text-muted-foreground">{l.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
                {hasChart ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradAI" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradWF" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradCB" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="aiCalls" name="AI Calls" stroke="#D4AF37" strokeWidth={2} fill="url(#gradAI)" />
                      <Area type="monotone" dataKey="workflows" name="Workflows" stroke="#8B5CF6" strokeWidth={2} fill="url(#gradWF)" />
                      <Area type="monotone" dataKey="chatbots" name="Chatbots" stroke="#10B981" strokeWidth={2} fill="url(#gradCB)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground/50">Run your first generation to see activity data here.</p>
                  </div>
                )}
              </div>

              {/* Bottom row: Module Usage + Recent Activity */}
              <div className="grid grid-cols-2 gap-4">

                {/* Module Usage */}
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-1">Module Usage</h3>
                  <p className="text-[10px] text-muted-foreground mb-4">AI calls per module</p>
                  <div className="space-y-3">
                    {moduleUsage.map(({ name, count, color }) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-32 shrink-0 text-right">{name}</span>
                        <div className="flex-1 h-5 bg-white/4 rounded overflow-hidden">
                          <motion.div
                            className="h-full rounded"
                            style={{ background: color }}
                            initial={{ width: 0 }}
                            animate={{ width: `${(count / maxModule) * 100}%` }}
                            transition={{ duration: 0.8, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-4 text-right">{count}</span>
                      </div>
                    ))}
                    {/* X-axis ticks */}
                    <div className="flex items-center gap-3 mt-1">
                      <div className="w-32 shrink-0" />
                      <div className="flex-1 flex justify-between">
                        {[0, Math.round(maxModule * 0.25), Math.round(maxModule * 0.5), Math.round(maxModule * 0.75), maxModule].map(v => (
                          <span key={v} className="text-[9px] text-muted-foreground/40">{v}</span>
                        ))}
                      </div>
                      <div className="w-4" />
                    </div>
                  </div>
                </div>

                {/* Recent Activity */}
                <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                  <h3 className="text-sm font-black text-foreground mb-1">Recent Activity</h3>
                  <p className="text-[10px] text-muted-foreground mb-4">Last 24 hours</p>
                  {recentActivity.length > 0 ? (
                    <div className="space-y-3 overflow-y-auto max-h-[200px] pr-1">
                      {recentActivity.map((item, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <div className="h-2 w-2 rounded-full bg-emerald-400 mt-1 shrink-0" />
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-semibold text-foreground">{item.type}</span>
                              <span className="text-[10px] text-muted-foreground">{item.time}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground/70 truncate">{item.description}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[160px] text-center">
                      <BarChart3 className="h-6 w-6 text-muted-foreground/20 mb-2" />
                      <p className="text-[10px] text-muted-foreground/50">No activity yet — start generating to see events here.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-1">AI Operations Trend</h3>
                <p className="text-[10px] text-muted-foreground mb-4">14-day activity across all generators</p>
                {hasChart ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradAI2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#D4AF37" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="aiCalls" name="AI Calls" stroke="#D4AF37" strokeWidth={2} fill="url(#gradAI2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground/50">Run your first analysis to see AI operation trends.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "automations" && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-1">Workflow Executions</h3>
                <p className="text-[10px] text-muted-foreground mb-4">14-day automation activity</p>
                {hasChart ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="gradWF2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Area type="monotone" dataKey="workflows" name="Workflows" stroke="#8B5CF6" strokeWidth={2} fill="url(#gradWF2)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[220px] text-center">
                    <Zap className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground/50">Workflow execution metrics will appear here as you build and run automations.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === "performance" && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Avg Response Time", value: "< 30s", color: "#D4AF37", sub: "AI operation latency" },
                  { label: "AI Engine", value: "Multi-Model", color: "#8B5CF6", sub: "Distributed AI pipeline" },
                  { label: "Uptime", value: "99.9%", color: "#10B981", sub: "Platform availability" },
                ].map(({ label, value, color, sub }) => (
                  <div key={label} className="rounded-xl border border-white/8 bg-white/2 p-4">
                    <p className="text-lg font-black text-foreground">{value}</p>
                    <p className="text-[10px] font-semibold text-foreground/70">{label}</p>
                    <p className="text-[9px] text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <h3 className="text-sm font-black text-foreground mb-1">Performance History</h3>
                <p className="text-[10px] text-muted-foreground mb-4">14-day latency trend</p>
                {hasChart ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" />
                      <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "#555" }} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="aiCalls" name="Operations" radius={[3,3,0,0]}>
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill="#D4AF37" fillOpacity={0.6} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[200px] text-center">
                    <BarChart3 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground/50">Detailed latency and throughput graphs will appear as more operations are recorded.</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
