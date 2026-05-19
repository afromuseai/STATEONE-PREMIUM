import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import {
  Bot, Search, Star, Download, Zap, X, Settings2, ChevronRight,
  CheckCircle2, Activity, Package, Filter, ShieldCheck, BarChart3,
  Users, Globe, Cpu, Brain, Megaphone, FlaskConical, Cog, Lock
} from "lucide-react"

interface CatalogAgent {
  id: string
  name: string
  category: string
  description: string
  capabilities: string[]
  integrations: string[]
  rating: number
  installCount: number
  icon: string
  tier: "free" | "pro" | "enterprise"
}

interface InstalledAgent {
  id: string
  agentId: string
  name: string
  category: string
  status: string
  tasksCompleted: number
  isActive: boolean
  config: Record<string, unknown>
  behaviorRules: string[]
  integrations: string[]
  installedAt: string
}

const CATEGORIES = [
  { label: "All", value: "all", icon: Package },
  { label: "Sales", value: "Sales", icon: BarChart3 },
  { label: "Support", value: "Support", icon: Users },
  { label: "Marketing", value: "Marketing", icon: Megaphone },
  { label: "Research", value: "Research", icon: FlaskConical },
  { label: "Operations", value: "Operations", icon: Cog },
  { label: "Analytics", value: "Analytics", icon: Activity },
  { label: "Cybersecurity", value: "Cybersecurity", icon: ShieldCheck },
]

const TIER_CONFIG = {
  free: { label: "Free", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" },
  pro: { label: "Pro", className: "bg-primary/15 text-primary border-primary/25" },
  enterprise: { label: "Enterprise", className: "bg-violet-500/15 text-violet-400 border-violet-500/25" },
}

function CategoryIcon({ category }: { category: string }) {
  const icons: Record<string, React.ComponentType<{ className?: string }>> = {
    Sales: BarChart3, Support: Users, Marketing: Megaphone,
    Research: FlaskConical, Operations: Cog, Analytics: Activity,
    Cybersecurity: ShieldCheck,
  }
  const Icon = icons[category] ?? Bot
  return <Icon className="h-4 w-4" />
}

export default function AgentStorePage() {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<"store" | "installed">("store")
  const [category, setCategory] = useState("all")
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<CatalogAgent | null>(null)
  const [configuring, setConfiguring] = useState<InstalledAgent | null>(null)
  const [behaviorInput, setBehaviorInput] = useState("")
  const qc = useQueryClient()

  const { data: catalogData } = useQuery<{ agents: CatalogAgent[] }>({
    queryKey: ["agents-catalog"],
    queryFn: () => fetch("/api/agents/catalog", { credentials: "include" }).then(r => r.json()),
  })

  const { data: installedData } = useQuery<{ agents: InstalledAgent[] }>({
    queryKey: ["agents-installed"],
    queryFn: () => fetch("/api/agents", { credentials: "include" }).then(r => r.json()),
  })

  const installMutation = useMutation({
    mutationFn: (agentId: string) =>
      fetch("/api/agents", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents-installed"] })
      setSelected(null)
    },
  })

  const uninstallMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/agents/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents-installed"] }),
  })

  const updateAgentMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      fetch(`/api/agents/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents-installed"] }),
  })

  const catalog = catalogData?.agents ?? []
  const installed = installedData?.agents ?? []
  const installedIds = new Set(installed.map(a => a.agentId))

  const filtered = catalog.filter(a => {
    const matchCat = category === "all" || a.category === category
    const matchSearch = search === "" ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div className="flex h-screen bg-[#080808] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/5 bg-[#0a0a0a] px-8 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-lg font-bold text-foreground">AI Agent Store</h1>
                <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/25 px-1.5 py-0.5 rounded-full">Beta</span>
              </div>
              <p className="text-xs text-muted-foreground">Install and configure AI agents — autonomous execution is on the roadmap</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/4 border border-white/8 rounded-xl px-3 py-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span>{installed.filter(a => a.isActive).length} active agents</span>
              </div>
              <div className="flex rounded-xl border border-white/8 overflow-hidden">
                {(["store", "installed"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`px-4 py-2 text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-white/4"}`}
                  >
                    {t === "installed" ? `Installed (${installed.length})` : "Store"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "store" && (
            <div className="flex h-full">
              {/* Sidebar filter */}
              <div className="w-52 shrink-0 border-r border-white/5 p-4 space-y-1">
                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 px-2 pb-2">Category</p>
                {CATEGORIES.map(({ label, value, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setCategory(value)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      category === value
                        ? "bg-primary/12 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-6">
                {/* Search */}
                <div className="flex items-center gap-3 mb-6">
                  <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search agents…"
                      className="w-full bg-white/4 border border-white/8 rounded-xl pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Filter className="h-3.5 w-3.5" />
                    <span>{filtered.length} agents</span>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((agent, i) => {
                    const isInstalled = installedIds.has(agent.id)
                    const tier = TIER_CONFIG[agent.tier]
                    return (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => setSelected(agent)}
                        className="group relative bg-white/2 border border-white/6 rounded-2xl p-5 cursor-pointer hover:border-white/12 hover:bg-white/4 transition-all"
                      >
                        {isInstalled && (
                          <div className="absolute top-3 right-3 flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                            <span className="text-[10px] font-semibold text-emerald-400">Installed</span>
                          </div>
                        )}

                        <div className="flex items-start gap-3 mb-3">
                          <div className="text-2xl">{agent.icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm font-bold text-foreground truncate">{agent.name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">{agent.category}</span>
                              <span className={`text-[9px] font-black uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${tier.className}`}>
                                {tier.label}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed mb-4 line-clamp-2">{agent.description}</p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <Star className="h-3 w-3 text-primary fill-primary" />
                            <span className="text-xs font-semibold text-foreground">{agent.rating}</span>
                            <span className="text-[10px] text-muted-foreground">({agent.installCount.toLocaleString()})</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                            <span>View details</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {tab === "installed" && (
            <div className="p-6">
              {installed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Bot className="h-12 w-12 text-muted-foreground/30 mb-4" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No agents installed yet</p>
                  <p className="text-xs text-muted-foreground/60 mb-4">Browse the store to find agents that work for your business</p>
                  <button
                    onClick={() => setTab("store")}
                    className="text-xs font-semibold text-primary border border-primary/30 bg-primary/10 rounded-xl px-4 py-2 hover:bg-primary/20 transition-colors"
                  >
                    Browse Agent Store
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Total Installed", value: installed.length, icon: Package, color: "text-primary" },
                      { label: "Active", value: installed.filter(a => a.isActive).length, icon: CheckCircle2, color: "text-emerald-400" },
                      { label: "Tasks Completed", value: installed.reduce((s, a) => s + a.tasksCompleted, 0).toLocaleString(), icon: Zap, color: "text-blue-400" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className="bg-white/2 border border-white/6 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon className={`h-4 w-4 ${color}`} />
                          <span className="text-xs text-muted-foreground">{label}</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{value}</p>
                      </div>
                    ))}
                  </div>

                  {installed.map((agent, i) => {
                    const catalogEntry = catalog.find(c => c.id === agent.agentId)
                    return (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center gap-4 bg-white/2 border border-white/6 rounded-2xl px-5 py-4 hover:border-white/10 transition-all"
                      >
                        <div className="text-xl">{catalogEntry?.icon ?? "🤖"}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">{agent.name}</p>
                            <span className={`text-[9px] font-black uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${
                              agent.isActive
                                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25"
                                : "bg-white/5 text-muted-foreground border-white/10"
                            }`}>
                              {agent.isActive ? "Active" : "Paused"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{agent.category} · {agent.tasksCompleted} tasks completed</p>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateAgentMutation.mutate({ id: agent.id, data: { isActive: !agent.isActive } })}
                            className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                              agent.isActive
                                ? "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"
                                : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                            }`}
                          >
                            {agent.isActive ? "Pause" : "Resume"}
                          </button>
                          <button
                            onClick={() => setConfiguring(agent)}
                            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => { if (confirm("Uninstall this agent?")) uninstallMutation.mutate(agent.id) }}
                            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agent detail modal */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-[#0d0d0d] border-l border-white/8 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">{selected.icon}</div>
                    <div>
                      <h2 className="text-base font-bold text-foreground">{selected.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">{selected.category}</span>
                        <span className={`text-[9px] font-black uppercase tracking-wider border px-1.5 py-0.5 rounded-full ${TIER_CONFIG[selected.tier].className}`}>
                          {TIER_CONFIG[selected.tier].label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-6">{selected.description}</p>

                <div className="flex items-center gap-4 mb-6 p-4 bg-white/3 border border-white/6 rounded-xl">
                  <div className="text-center">
                    <div className="flex items-center gap-1 justify-center">
                      <Star className="h-4 w-4 text-primary fill-primary" />
                      <span className="text-sm font-bold text-foreground">{selected.rating}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Rating</p>
                  </div>
                  <div className="h-6 w-px bg-white/10" />
                  <div className="text-center">
                    <p className="text-sm font-bold text-foreground">{selected.installCount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Installs</p>
                  </div>
                </div>

                <div className="mb-5">
                  <p className="text-xs font-bold text-foreground mb-3">Capabilities</p>
                  <div className="space-y-2">
                    {selected.capabilities.map(cap => (
                      <div key={cap} className="flex items-center gap-2.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs text-muted-foreground">{cap}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-bold text-foreground mb-3">Integrations</p>
                  <div className="flex flex-wrap gap-2">
                    {selected.integrations.map(integ => (
                      <span key={integ} className="text-[10px] font-medium bg-white/5 border border-white/8 text-muted-foreground rounded-lg px-2.5 py-1">
                        {integ}
                      </span>
                    ))}
                  </div>
                </div>

                {selected.tier === "enterprise" && (
                  <div className="flex items-center gap-2 p-3 bg-violet-500/8 border border-violet-500/20 rounded-xl mb-4 text-xs text-violet-400">
                    <Lock className="h-3.5 w-3.5 shrink-0" />
                    Enterprise plan required to install this agent
                  </div>
                )}

                <button
                  disabled={installedIds.has(selected.id) || installMutation.isPending || selected.tier === "enterprise"}
                  onClick={() => installMutation.mutate(selected.id)}
                  className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
                    installedIds.has(selected.id)
                      ? "bg-emerald-500/12 border border-emerald-500/25 text-emerald-400 cursor-default"
                      : selected.tier === "enterprise"
                      ? "bg-white/4 border border-white/8 text-muted-foreground cursor-not-allowed"
                      : "bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 active:scale-[0.98]"
                  }`}
                >
                  {installedIds.has(selected.id) ? (
                    <><CheckCircle2 className="h-4 w-4" /> Installed</>
                  ) : installMutation.isPending ? (
                    <><Cpu className="h-4 w-4 animate-spin" /> Installing…</>
                  ) : (
                    <><Download className="h-4 w-4" /> Install Agent</>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Configure agent panel */}
      <AnimatePresence>
        {configuring && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfiguring(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              transition={{ type: "spring", damping: 26, stiffness: 300 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-[420px] bg-[#0d0d0d] border-l border-white/8 overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-base font-bold text-foreground">Configure Agent</h2>
                  <button onClick={() => setConfiguring(null)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex items-center gap-3 p-4 bg-white/3 border border-white/6 rounded-xl mb-6">
                  <div className="text-xl">{catalog.find(c => c.id === configuring.agentId)?.icon ?? "🤖"}</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{configuring.name}</p>
                    <p className="text-xs text-muted-foreground">{configuring.category}</p>
                  </div>
                </div>

                <div className="mb-5">
                  <p className="text-xs font-bold text-foreground mb-3">Behavior Rules</p>
                  <p className="text-xs text-muted-foreground mb-3">Define how this agent should behave in your context</p>
                  <div className="space-y-2 mb-3">
                    {(configuring.behaviorRules ?? []).map((rule, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white/3 border border-white/6 rounded-lg px-3 py-2">
                        <span className="flex-1 text-xs text-muted-foreground">{rule}</span>
                        <button
                          onClick={() => {
                            const updated = configuring.behaviorRules.filter((_, ri) => ri !== i)
                            setConfiguring({ ...configuring, behaviorRules: updated })
                          }}
                          className="text-muted-foreground hover:text-red-400 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      value={behaviorInput}
                      onChange={e => setBehaviorInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter" && behaviorInput.trim()) {
                          setConfiguring({ ...configuring, behaviorRules: [...(configuring.behaviorRules ?? []), behaviorInput.trim()] })
                          setBehaviorInput("")
                        }
                      }}
                      placeholder="Add a rule and press Enter…"
                      className="flex-1 bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    updateAgentMutation.mutate({
                      id: configuring.id,
                      data: { behaviorRules: configuring.behaviorRules },
                    })
                    setConfiguring(null)
                  }}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors"
                >
                  Save Configuration
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
