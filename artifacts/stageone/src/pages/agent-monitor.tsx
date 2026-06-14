import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth-context"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import {
  Bot, Activity, CheckCircle2, Clock, XCircle, Zap, Play,
  RefreshCw, Plus, Target, Brain, BarChart3, Trash2, ChevronRight,
  AlertTriangle, Settings2, Cpu, TrendingUp, ListTodo, MemoryStick
} from "lucide-react"

interface AgentTask {
  id: string
  agentKey: string
  title: string
  description?: string
  status: string
  priority: number
  confidence: number
  category: string
  outcome: Record<string, unknown> | null
  errorMessage?: string
  startedAt?: string
  completedAt?: string
  createdAt: string
}

interface AgentObjective {
  id: string
  agentKey: string
  title: string
  description?: string
  goals: { text: string; weight?: number }[]
  constraints: string[]
  executionRules: string[]
  escalationThreshold: number
  progress: number
  isActive: boolean
  createdAt: string
}

interface AgentMemory {
  id: string
  agentKey: string
  memoryType: string
  key: string
  value: string
  importance: number
  isShared: boolean
  createdAt: string
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  pending: { label: "Pending", color: "text-yellow-400", bg: "bg-yellow-500/15 border-yellow-500/25", icon: Clock },
  running: { label: "Running", color: "text-blue-400", bg: "bg-blue-500/15 border-blue-500/25", icon: Cpu },
  completed: { label: "Completed", color: "text-emerald-400", bg: "bg-emerald-500/15 border-emerald-500/25", icon: CheckCircle2 },
  failed: { label: "Failed", color: "text-red-400", bg: "bg-red-500/15 border-red-500/25", icon: XCircle },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-white/5 border-white/10", icon: XCircle },
}

const PRIORITY_COLORS = ["", "text-red-400", "text-orange-400", "text-yellow-400", "text-blue-400", "text-emerald-400"]

export default function AgentMonitorPage() {
  const [collapsed, setCollapsed] = useState(false)
  const [tab, setTab] = useState<"tasks" | "objectives" | "memory">("tasks")
  const [showNewObjective, setShowNewObjective] = useState(false)
  const [showNewMemory, setShowNewMemory] = useState(false)
  const [newObj, setNewObj] = useState({ agentKey: "sales-prospector", title: "", description: "", escalationThreshold: 80 })
  const [newMem, setNewMem] = useState({ agentKey: "sales-prospector", key: "", value: "", memoryType: "context", importance: 5 })
  const { user } = useAuth()
  const qc = useQueryClient()

  const { data: tasksData, isLoading: tasksLoading } = useQuery<{ tasks: AgentTask[]; stats: Record<string, number> }>({
    queryKey: ["agent-tasks", user?.id],
    queryFn: () => fetch("/api/agents/tasks", { credentials: "include" }).then(r => r.json()),
    refetchInterval: 5000,
  })

  const { data: objectivesData } = useQuery<{ objectives: AgentObjective[] }>({
    queryKey: ["agent-objectives", user?.id],
    queryFn: () => fetch("/api/agents/objectives", { credentials: "include" }).then(r => r.json()),
  })

  const { data: memoryData } = useQuery<{ memories: AgentMemory[] }>({
    queryKey: ["agent-memory", user?.id],
    queryFn: () => fetch("/api/agents/memory", { credentials: "include" }).then(r => r.json()),
  })

  const simulateMutation = useMutation({
    mutationFn: () => fetch("/api/agents/tasks/simulate", { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-tasks", user?.id] }),
  })

  const deleteTaskMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/agents/tasks/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-tasks", user?.id] }),
  })

  const createObjectiveMutation = useMutation({
    mutationFn: (data: typeof newObj) => fetch("/api/agents/objectives", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-objectives", user?.id] }); setShowNewObjective(false); setNewObj({ agentKey: "sales-prospector", title: "", description: "", escalationThreshold: 80 }) },
  })

  const deleteObjectiveMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/agents/objectives/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-objectives", user?.id] }),
  })

  const createMemoryMutation = useMutation({
    mutationFn: (data: typeof newMem) => fetch("/api/agents/memory", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(r => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["agent-memory", user?.id] }); setShowNewMemory(false); setNewMem({ agentKey: "sales-prospector", key: "", value: "", memoryType: "context", importance: 5 }) },
  })

  const deleteMemoryMutation = useMutation({
    mutationFn: (id: string) => fetch(`/api/agents/memory/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agent-memory", user?.id] }),
  })

  const tasks = tasksData?.tasks ?? []
  const stats = tasksData?.stats ?? {}
  const objectives = objectivesData?.objectives ?? []
  const memories = memoryData?.memories ?? []

  const AGENT_KEYS = ["sales-prospector", "support-resolver", "content-generator", "market-researcher", "ops-automator", "revenue-analyst", "security-watcher", "email-outreach"]
  const MEM_TYPES = ["context", "long-term", "shared"]

  return (
    <div className="flex h-screen bg-[#080808] text-foreground overflow-hidden">
      <AppSidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-white/5 bg-[#0a0a0a] px-8 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/15 border border-blue-500/25">
                  <Activity className="h-4 w-4 text-blue-400" />
                </div>
                <h1 className="text-lg font-bold text-foreground">Agent Monitor</h1>
                <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/20 text-blue-400 border border-blue-500/25 px-1.5 py-0.5 rounded-full">LIVE</span>
              </div>
              <p className="text-xs text-muted-foreground">Real-time monitoring of autonomous agent tasks, objectives, and memory</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => simulateMutation.mutate()}
                disabled={simulateMutation.isPending}
                className="flex items-center gap-2 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl px-3 py-1.5 hover:bg-blue-500/20 transition-colors"
              >
                <Zap className="h-3.5 w-3.5" />
                {simulateMutation.isPending ? "Simulating…" : "Simulate Task"}
              </button>
              <div className="flex rounded-xl border border-white/8 overflow-hidden">
                {(["tasks", "objectives", "memory"] as const).map(t => (
                  <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-semibold capitalize transition-colors ${tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground bg-transparent hover:bg-white/4"}`}>
                    {t === "tasks" ? `Tasks (${tasks.length})` : t === "objectives" ? `Objectives (${objectives.length})` : `Memory (${memories.length})`}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "tasks" && (
            <div className="space-y-4">
              <div className="grid grid-cols-5 gap-3">
                {[
                  { label: "Total", value: tasks.length, color: "text-foreground" },
                  { label: "Pending", value: stats.pending ?? 0, color: "text-yellow-400" },
                  { label: "Running", value: stats.running ?? 0, color: "text-blue-400" },
                  { label: "Completed", value: stats.completed ?? 0, color: "text-emerald-400" },
                  { label: "Failed", value: stats.failed ?? 0, color: "text-red-400" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-white/2 border border-white/6 rounded-2xl p-4">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                ))}
              </div>

              {tasksLoading ? (
                <div className="flex items-center justify-center h-40">
                  <RefreshCw className="h-5 w-5 text-muted-foreground animate-spin" />
                </div>
              ) : tasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                  <ListTodo className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No tasks yet</p>
                  <p className="text-xs text-muted-foreground/60 mb-4">Click "Simulate Task" to generate agent activity</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {tasks.map((task, i) => {
                    const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.pending!
                    const StatusIcon = cfg.icon
                    return (
                      <motion.div key={task.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-4 bg-white/2 border border-white/6 rounded-xl px-4 py-3 hover:border-white/10 transition-all">
                        <div className={`flex items-center gap-1.5 shrink-0 text-[10px] font-black uppercase tracking-wider border rounded-full px-2 py-0.5 ${cfg.bg} ${cfg.color}`}>
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground">{task.agentKey} · {task.category}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {task.confidence > 0 && (
                            <div className="text-center">
                              <p className={`text-sm font-bold ${task.confidence >= 85 ? "text-emerald-400" : task.confidence >= 70 ? "text-yellow-400" : "text-red-400"}`}>{task.confidence}%</p>
                              <p className="text-[9px] text-muted-foreground/60">confidence</p>
                            </div>
                          )}
                          <div className={`text-xs font-semibold ${PRIORITY_COLORS[task.priority]}`}>P{task.priority}</div>
                          <button onClick={() => deleteTaskMutation.mutate(task.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "objectives" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{objectives.length} objective{objectives.length !== 1 ? "s" : ""} configured</p>
                <button onClick={() => setShowNewObjective(true)} className="flex items-center gap-2 text-xs font-semibold bg-primary/10 border border-primary/25 text-primary rounded-xl px-3 py-1.5 hover:bg-primary/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> New Objective
                </button>
              </div>

              <AnimatePresence>
                {showNewObjective && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-4">
                    <p className="text-sm font-bold text-foreground">New Agent Objective</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Agent</label>
                        <select value={newObj.agentKey} onChange={e => setNewObj(o => ({ ...o, agentKey: e.target.value }))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40">
                          {AGENT_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Escalation Threshold (%)</label>
                        <input type="number" min={0} max={100} value={newObj.escalationThreshold}
                          onChange={e => setNewObj(o => ({ ...o, escalationThreshold: Number(e.target.value) }))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Objective Title</label>
                      <input value={newObj.title} onChange={e => setNewObj(o => ({ ...o, title: e.target.value }))}
                        placeholder="e.g. Maximize Q3 lead conversion"
                        className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Description</label>
                      <textarea value={newObj.description} onChange={e => setNewObj(o => ({ ...o, description: e.target.value }))}
                        placeholder="Describe what this agent should achieve…"
                        rows={2}
                        className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 resize-none" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => createObjectiveMutation.mutate(newObj)} disabled={!newObj.title || createObjectiveMutation.isPending}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50">
                        {createObjectiveMutation.isPending ? "Creating…" : "Create Objective"}
                      </button>
                      <button onClick={() => setShowNewObjective(false)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {objectives.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                  <Target className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No objectives defined</p>
                  <p className="text-xs text-muted-foreground/60">Define goals and constraints for each agent</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {objectives.map((obj, i) => (
                    <motion.div key={obj.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                      className="bg-white/2 border border-white/6 rounded-2xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-4 w-4 text-primary shrink-0" />
                            <p className="text-sm font-bold text-foreground">{obj.title}</p>
                            <span className={`text-[9px] font-black uppercase tracking-wider border rounded-full px-1.5 py-0.5 ${obj.isActive ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-white/5 text-muted-foreground border-white/10"}`}>
                              {obj.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">{obj.agentKey}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-center">
                            <p className="text-sm font-bold text-primary">{obj.progress}%</p>
                            <p className="text-[9px] text-muted-foreground/60">progress</p>
                          </div>
                          <button onClick={() => deleteObjectiveMutation.mutate(obj.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      {obj.description && <p className="text-xs text-muted-foreground mb-3">{obj.description}</p>}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Goals: <span className="text-foreground font-semibold">{(obj.goals as { text: string }[]).length}</span></span>
                        <span>Constraints: <span className="text-foreground font-semibold">{obj.constraints.length}</span></span>
                        <span>Rules: <span className="text-foreground font-semibold">{obj.executionRules.length}</span></span>
                        <span>Escalation: <span className="text-yellow-400 font-semibold">{obj.escalationThreshold}%</span></span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "memory" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{memories.length} memory entr{memories.length !== 1 ? "ies" : "y"}</p>
                <button onClick={() => setShowNewMemory(true)} className="flex items-center gap-2 text-xs font-semibold bg-primary/10 border border-primary/25 text-primary rounded-xl px-3 py-1.5 hover:bg-primary/20 transition-colors">
                  <Plus className="h-3.5 w-3.5" /> Add Memory
                </button>
              </div>

              <AnimatePresence>
                {showNewMemory && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                    className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-4">
                    <p className="text-sm font-bold text-foreground">Add Agent Memory</p>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Agent</label>
                        <select value={newMem.agentKey} onChange={e => setNewMem(m => ({ ...m, agentKey: e.target.value }))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40">
                          {AGENT_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Type</label>
                        <select value={newMem.memoryType} onChange={e => setNewMem(m => ({ ...m, memoryType: e.target.value }))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40">
                          {MEM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Importance (1-10)</label>
                        <input type="number" min={1} max={10} value={newMem.importance}
                          onChange={e => setNewMem(m => ({ ...m, importance: Number(e.target.value) }))}
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Key</label>
                        <input value={newMem.key} onChange={e => setNewMem(m => ({ ...m, key: e.target.value }))}
                          placeholder="e.g. preferred_tone"
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Value</label>
                        <input value={newMem.value} onChange={e => setNewMem(m => ({ ...m, value: e.target.value }))}
                          placeholder="e.g. professional and concise"
                          className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => createMemoryMutation.mutate(newMem)} disabled={!newMem.key || !newMem.value || createMemoryMutation.isPending}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50">
                        {createMemoryMutation.isPending ? "Saving…" : "Save Memory"}
                      </button>
                      <button onClick={() => setShowNewMemory(false)} className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground transition-colors">
                        Cancel
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {memories.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center bg-white/2 border border-white/6 rounded-2xl">
                  <MemoryStick className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-semibold text-muted-foreground mb-1">No agent memories</p>
                  <p className="text-xs text-muted-foreground/60">Agent memory helps agents learn and adapt over time</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {memories.map((mem, i) => {
                    const typeColors: Record<string, string> = { "context": "text-blue-400 bg-blue-500/15 border-blue-500/25", "long-term": "text-violet-400 bg-violet-500/15 border-violet-500/25", "shared": "text-emerald-400 bg-emerald-500/15 border-emerald-500/25" }
                    return (
                      <motion.div key={mem.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}
                        className="flex items-center gap-4 bg-white/2 border border-white/6 rounded-xl px-4 py-3">
                        <span className={`text-[10px] font-black uppercase tracking-wider border rounded-full px-2 py-0.5 shrink-0 ${typeColors[mem.memoryType] ?? "text-muted-foreground bg-white/5 border-white/10"}`}>
                          {mem.memoryType}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground">{mem.key}</p>
                          <p className="text-xs text-muted-foreground truncate">{mem.value}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
                          <span>{mem.agentKey}</span>
                          <span className="text-primary font-semibold">{mem.importance}/10</span>
                          {mem.isShared && <span className="text-emerald-400 text-[10px] font-black">SHARED</span>}
                          <button onClick={() => deleteMemoryMutation.mutate(mem.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
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
    </div>
  )
}
