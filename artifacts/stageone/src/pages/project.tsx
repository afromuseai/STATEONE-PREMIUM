import { useState, useEffect, useCallback, useRef } from "react"
import { useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { OutputPanel, type BusinessIntelligence } from "@/components/dashboard/output-panel"
import { WebsitePanel } from "@/components/dashboard/website-panel"
import { api, type Project, type ProjectEvent } from "@/lib/api"
import { saveProjectContext, saveGenerationContext } from "@/lib/generation-context"
import {
  ArrowLeft, RefreshCw, Globe, BarChart3, Loader2, Pencil, Check, X,
  Bot, Zap, CheckSquare, Clock, Plus, Trash2, CheckCircle2, Circle,
  History, ExternalLink, Lightbulb, Workflow, ChevronRight, CheckCheck,
} from "lucide-react"
import { useLang } from "@/lib/i18n"

interface ProjectPageProps {
  id: string
}

type Tab = "analysis" | "website" | "chatbot" | "automation" | "tasks" | "history"

interface ProjectTask {
  id: string
  title: string
  status: "pending" | "done"
  category: string
  createdAt: string
  completedAt: string | null
  projectId: string | null
}

// ─── History event icon/colour mapping ───────────────────────────────────────

const EVENT_META: Record<string, { icon: React.ElementType; colour: string; label: string }> = {
  "intelligence.generated": { icon: BarChart3,  colour: "text-blue-400",   label: "Business Intelligence Generated" },
  "website.generated":      { icon: Globe,       colour: "text-green-400",  label: "Website Generated" },
  "chatbot.generated":      { icon: Bot,         colour: "text-purple-400", label: "Chatbot Generated" },
  "automation.generated":   { icon: Workflow,    colour: "text-orange-400", label: "Automation Generated" },
  "task.completed":         { icon: CheckCircle2,colour: "text-primary",    label: "Task Completed" },
}

function eventMeta(type: string) {
  return EVENT_META[type] ?? { icon: Clock, colour: "text-muted-foreground", label: type }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60_000)
  const hr   = Math.floor(diff / 3_600_000)
  const day  = Math.floor(diff / 86_400_000)
  if (min < 2)  return "just now"
  if (min < 60) return `${min}m ago`
  if (hr  < 24) return `${hr}h ago`
  return `${day}d ago`
}

// ─── Tasks tab ────────────────────────────────────────────────────────────────

function TasksTab({ projectId }: { projectId: string }) {
  const [tasks, setTasks]       = useState<ProjectTask[]>([])
  const [loading, setLoading]   = useState(true)
  const [newTitle, setNewTitle] = useState("")
  const [adding, setAdding]     = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch(`/api/workspace/tasks?projectId=${projectId}`, { credentials: "include" })
      if (!res.ok) return
      const data = await res.json() as { tasks: ProjectTask[] }
      setTasks(data.tasks)
    } catch { /* non-fatal */ } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { fetchTasks() }, [fetchTasks])

  const handleToggle = useCallback(async (task: ProjectTask) => {
    const next = task.status === "pending" ? "done" : "pending"
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next, completedAt: next === "done" ? new Date().toISOString() : null } : t))
    await fetch(`/api/workspace/tasks/${task.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    }).catch(() => fetchTasks())
  }, [fetchTasks])

  const handleDelete = useCallback(async (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await fetch(`/api/workspace/tasks/${id}`, { method: "DELETE", credentials: "include" }).catch(() => fetchTasks())
  }, [fetchTasks])

  const handleAdd = useCallback(async () => {
    const title = newTitle.trim()
    if (!title) return
    setAdding(true)
    try {
      const res = await fetch("/api/workspace/tasks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks: [{ title }], projectId }),
      })
      if (res.ok) {
        const data = await res.json() as { tasks: ProjectTask[] }
        setTasks(prev => [...prev, ...data.tasks])
        setNewTitle("")
      }
    } catch { /* non-fatal */ } finally {
      setAdding(false)
    }
  }, [newTitle, projectId])

  const pending   = tasks.filter(t => t.status === "pending")
  const completed = tasks.filter(t => t.status === "done")

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Add task */}
      <div className="glass-card rounded-xl p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Plus className="h-4 w-4 text-primary" />
          Add Task
        </h3>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleAdd() }}
            placeholder="Task title…"
            className="flex-1 rounded-lg border border-border/50 bg-secondary/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newTitle.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Add
          </button>
        </div>
      </div>

      {/* Progress */}
      {tasks.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-xs text-muted-foreground">{completed.length} / {tasks.length} complete</span>
          </div>
          <div className="h-2 rounded-full bg-secondary/40 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${tasks.length ? (completed.length / tasks.length) * 100 : 0}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Pending tasks */}
      {pending.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Circle className="h-4 w-4 text-yellow-400" />
            Active ({pending.length})
          </h3>
          <div className="space-y-2">
            {pending.map(task => (
              <motion.div key={task.id} layout className="flex items-center gap-3 group">
                <button onClick={() => handleToggle(task)} className="flex-shrink-0 text-muted-foreground hover:text-primary transition-colors">
                  <Circle className="h-4 w-4" />
                </button>
                <span className="flex-1 text-sm text-foreground">{task.title}</span>
                {task.category !== "general" && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/40 text-muted-foreground">{task.category}</span>
                )}
                <button onClick={() => handleDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Completed tasks */}
      {completed.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            Completed ({completed.length})
          </h3>
          <div className="space-y-2">
            {completed.map(task => (
              <motion.div key={task.id} layout className="flex items-center gap-3 group opacity-60">
                <button onClick={() => handleToggle(task)} className="flex-shrink-0 text-primary hover:text-muted-foreground transition-colors">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <span className="flex-1 text-sm text-muted-foreground line-through">{task.title}</span>
                <button onClick={() => handleDelete(task.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 transition-all">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {tasks.length === 0 && (
        <div className="glass-card rounded-xl p-8 text-center">
          <CheckSquare className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No tasks yet. Add your first task above.</p>
        </div>
      )}
    </div>
  )
}

// ─── History tab ──────────────────────────────────────────────────────────────

function HistoryTab({ events, createdAt }: { events: ProjectEvent[]; createdAt: string }) {
  const allEvents: (ProjectEvent & { isOrigin?: boolean })[] = [
    ...events,
    { type: "project.created", label: "Project Created", timestamp: createdAt, isOrigin: true },
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="p-6 space-y-4">
      {allEvents.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center">
          <History className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No history yet.</p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-0">
          {/* Vertical line */}
          <div className="absolute left-2.5 top-3 bottom-3 w-px bg-border/40" />

          {allEvents.map((evt, i) => {
            const meta = evt.isOrigin
              ? { icon: Plus, colour: "text-primary", label: "Project Created" }
              : eventMeta(evt.type)
            const Icon = meta.icon

            return (
              <motion.div
                key={`${evt.type}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="relative flex items-start gap-4 pb-6"
              >
                {/* Dot */}
                <div className={`absolute -left-[3px] flex h-5 w-5 items-center justify-center rounded-full bg-background border border-border/60 ${meta.colour}`}>
                  <Icon className="h-3 w-3" />
                </div>

                <div className="glass-card rounded-xl p-4 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${meta.colour}`}>{meta.label}</p>
                      {evt.label && evt.label !== meta.label && (
                        <p className="text-xs text-muted-foreground mt-0.5">{evt.label}</p>
                      )}
                    </div>
                    <time className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      {timeAgo(evt.timestamp)}
                    </time>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Chatbot tab ──────────────────────────────────────────────────────────────

function ChatbotTab({ biData, chatbotOutput, onNavigate }: {
  biData: BusinessIntelligence | null
  chatbotOutput: Record<string, unknown> | null
  onNavigate: () => void
}) {
  const identity = chatbotOutput?.identity as { name?: string; role?: string; objective?: string; personality?: string; greeting?: string } | undefined
  const kpis = chatbotOutput?.kpis as { deflectionRate?: string; responseTime?: string; satisfactionScore?: string; leadConversion?: string } | undefined
  const suggestedPrompts = chatbotOutput?.suggestedPrompts as string[] | undefined

  return (
    <div className="p-6 space-y-5">
      {chatbotOutput ? (
        <>
          {/* Generated chatbot summary */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCheck className="h-4 w-4 text-green-400" />
              <h3 className="text-sm font-semibold text-foreground">Chatbot Generated</h3>
              <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">Saved</span>
            </div>
            {identity && (
              <div className="space-y-2">
                {identity.name && <p className="text-sm font-medium text-foreground">{identity.name}</p>}
                {identity.role && <p className="text-xs text-muted-foreground">{identity.role}</p>}
                {identity.greeting && (
                  <div className="mt-3 rounded-lg bg-secondary/30 px-4 py-3 text-sm text-muted-foreground italic border border-border/30">
                    "{identity.greeting}"
                  </div>
                )}
              </div>
            )}
          </div>

          {kpis && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="h-4 w-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-foreground">Performance Targets</h3>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  { label: "Deflection Rate", value: kpis.deflectionRate },
                  { label: "Response Time", value: kpis.responseTime },
                  { label: "Satisfaction", value: kpis.satisfactionScore },
                  { label: "Lead Conversion", value: kpis.leadConversion },
                ].filter(x => x.value).map(x => (
                  <div key={x.label} className="rounded-lg bg-secondary/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">{x.label}</p>
                    <p className="text-sm font-medium text-foreground">{x.value}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {suggestedPrompts && suggestedPrompts.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="h-4 w-4 text-purple-400" />
                <h3 className="text-sm font-semibold text-foreground">Suggested Prompts</h3>
              </div>
              <div className="space-y-2">
                {suggestedPrompts.slice(0, 4).map((p, i) => (
                  <div key={i} className="flex items-start gap-2 rounded-lg bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
                    <span className="text-purple-400 mt-0.5">→</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : biData?.chatbotRole ? (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground">AI Chatbot Role (from Analysis)</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{biData.chatbotRole}</p>
          <p className="text-xs text-muted-foreground mt-3">Open the Chatbot Generator to build and save a full chatbot for this project.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No chatbot yet.</p>
          <p className="text-xs text-muted-foreground">Generate a business analysis first, then build a chatbot from it.</p>
        </div>
      )}

      <button
        onClick={onNavigate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <Bot className="h-4 w-4 text-purple-400" />
        {chatbotOutput ? "Regenerate Chatbot" : "Open Chatbot Generator"}
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}

// ─── Automation tab ───────────────────────────────────────────────────────────

function AutomationTab({ biData, automationOutput, onNavigate }: {
  biData: BusinessIntelligence | null
  automationOutput: Record<string, unknown> | null
  onNavigate: () => void
}) {
  const overview = automationOutput?.overview as { purpose?: string; objective?: string; expectedOutcome?: string; complexityScore?: number; executionEstimate?: string } | undefined
  const aiOpportunities = automationOutput?.aiOpportunities as Array<{ type: string; description: string; impact: string }> | undefined
  const integrations = automationOutput?.integrations as Array<{ name: string; category: string; role: string; tier: string }> | undefined

  return (
    <div className="p-6 space-y-5">
      {automationOutput ? (
        <>
          {/* Generated automation summary */}
          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <CheckCheck className="h-4 w-4 text-green-400" />
              <h3 className="text-sm font-semibold text-foreground">Automation Workflow Generated</h3>
              <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">Saved</span>
            </div>
            {overview && (
              <div className="space-y-3">
                {overview.purpose && <p className="text-sm text-muted-foreground leading-relaxed">{overview.purpose}</p>}
                <div className="grid gap-2 sm:grid-cols-2">
                  {overview.expectedOutcome && (
                    <div className="rounded-lg bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Expected Outcome</p>
                      <p className="text-sm text-foreground">{overview.expectedOutcome}</p>
                    </div>
                  )}
                  {overview.executionEstimate && (
                    <div className="rounded-lg bg-secondary/20 p-3">
                      <p className="text-xs text-muted-foreground mb-1">Execution Estimate</p>
                      <p className="text-sm text-foreground">{overview.executionEstimate}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {aiOpportunities && aiOpportunities.length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="h-4 w-4 text-yellow-400" />
                <h3 className="text-sm font-semibold text-foreground">AI Opportunities</h3>
              </div>
              <div className="space-y-2">
                {aiOpportunities.slice(0, 4).map((opp, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-secondary/20 px-4 py-3">
                    <span className={`text-xs font-medium mt-0.5 ${opp.impact === "high" ? "text-green-400" : opp.impact === "medium" ? "text-yellow-400" : "text-blue-400"}`}>
                      {opp.impact?.toUpperCase()}
                    </span>
                    <div>
                      <p className="text-xs text-foreground font-medium">{opp.type}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{opp.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {integrations && integrations.filter(i => i.tier === "required").length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <ChevronRight className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Required Integrations</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {integrations.filter(i => i.tier === "required").map((intg, i) => (
                  <span key={i} className="rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 px-3 py-1 text-xs">
                    {intg.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      ) : biData?.automations?.length ? (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Workflow className="h-4 w-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-foreground">Recommended Automations (from Analysis)</h3>
          </div>
          <div className="space-y-2">
            {biData.automations.map((auto, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-start gap-3 rounded-lg bg-secondary/20 px-4 py-3"
              >
                <Zap className="h-3.5 w-3.5 text-orange-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground">{auto}</span>
              </motion.div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Open the Automation Builder to generate a full workflow and save it to this project.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <Workflow className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No automation yet.</p>
          <p className="text-xs text-muted-foreground">Generate a business analysis first to see recommended automations.</p>
        </div>
      )}

      <button
        onClick={onNavigate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <Workflow className="h-4 w-4 text-orange-400" />
        {automationOutput ? "Regenerate Automation" : "Open Automation Builder"}
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  )
}

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ElementType; indicator?: (p: Project) => boolean }[] = [
  { id: "analysis",   label: "Business Intelligence", icon: BarChart3                                   },
  { id: "website",    label: "Website",               icon: Globe,    indicator: p => !!p.websiteOutput  },
  { id: "chatbot",    label: "Chatbot",               icon: Bot,      indicator: p => !!p.chatbotOutput  },
  { id: "automation", label: "Automation",            icon: Workflow, indicator: p => !!p.automationOutput },
  { id: "tasks",      label: "Tasks",                 icon: CheckSquare                                 },
  { id: "history",    label: "History",               icon: History                                     },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectPage({ id }: ProjectPageProps) {
  const { lang } = useLang()
  const [, setLocation] = useLocation()
  const [project, setProject]       = useState<Project | null>(null)
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [tab, setTab]               = useState<Tab>("analysis")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [editingTitle, setEditingTitle]   = useState(false)
  const [titleInput, setTitleInput]       = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  useEffect(() => {
    api.projects.get(id)
      .then(({ project }) => {
        setProject(project)
        setTitleInput(project.title)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleRegenerate = useCallback(async () => {
    if (!project) return
    setRegenerating(true)
    setStreamingText("")
    setTab("analysis")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: project.businessIdea, language: lang }),
      })
      if (!response.ok) throw new Error("Generation failed")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let lineCarryover = ""
      let finalData: BusinessIntelligence | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = lineCarryover + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        lineCarryover = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          try {
            const parsed = JSON.parse(data)
            if (parsed.done && parsed.data) finalData = parsed.data
            else if (typeof parsed.content === "string") setStreamingText(prev => prev + parsed.content)
          } catch { /* ignore */ }
        }
      }
      reader.releaseLock()

      if (finalData) {
        const updated = await api.projects.update(id, { output: finalData as unknown as Record<string, unknown> })
        setProject(updated.project)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed")
    } finally {
      setRegenerating(false)
      setStreamingText("")
    }
  }, [project, id, lang])

  const handleSaveTitle = useCallback(async () => {
    if (!titleInput.trim() || !project) return
    setSaveStatus("saving")
    try {
      const updated = await api.projects.update(id, { title: titleInput.trim() })
      setProject(updated.project)
      setEditingTitle(false)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch { setSaveStatus("idle") }
  }, [id, titleInput, project])

  const handleWebsiteSaved = useCallback((websiteData: Record<string, unknown>) => {
    setProject(prev => prev ? { ...prev, websiteOutput: websiteData } : prev)
    setTab("website")
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-400">{error ?? "Project not found"}</p>
          <button onClick={() => setLocation("/dashboard?tab=projects")} className="mt-4 text-sm text-primary hover:underline">
            Back to projects
          </button>
        </div>
      </div>
    )
  }

  const biData = project.output as BusinessIntelligence | null
  const events = project.projectEvents ?? []
  const isWebsiteTab = tab === "website"

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* ── Header ── */}
        <header className="flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 shrink-0">
          <button
            onClick={() => setLocation("/dashboard?tab=projects")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </button>
          <div className="h-4 w-px bg-border" />

          {/* Editable title */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false) }}
                  autoFocus
                  className="bg-secondary/30 border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button onClick={handleSaveTitle} disabled={saveStatus === "saving"} className="p-1 rounded text-green-400 hover:bg-green-400/10 transition-colors">
                  {saveStatus === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => { setEditingTitle(false); setTitleInput(project.title) }} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingTitle(true)} className="flex items-center gap-2 group min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{project.title}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
          </div>

          {/* Status badge */}
          <span className={`hidden sm:flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${
            project.status === "active"    ? "border-green-500/30 bg-green-500/10 text-green-400" :
            project.status === "draft"     ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" :
            project.status === "completed" ? "border-blue-500/30 bg-blue-500/10 text-blue-400" :
            "border-border/50 bg-secondary/20 text-muted-foreground"
          }`}>
            {project.status}
          </span>

          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all shrink-0"
          >
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </header>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-0.5 border-b border-border/50 px-4 shrink-0 overflow-x-auto scrollbar-none">
          {TABS.map(({ id: tid, label, icon: Icon, indicator }) => {
            const active = tab === tid
            const hasData = indicator?.(project)
            return (
              <button
                key={tid}
                onClick={() => setTab(tid)}
                className={`relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
                {hasData && !active && (
                  <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-green-400" />
                )}
              </button>
            )
          })}
        </div>

        {/* ── Content ── */}
        <div className={`flex-1 min-h-0 ${isWebsiteTab ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
          <AnimatePresence mode="wait">
            {tab === "analysis" && (
              <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <OutputPanel
                  data={biData}
                  partialData={{}}
                  isLoading={regenerating}
                  streamingText={streamingText}
                  generationStage={0}
                  onGenerateWebsite={biData ? () => setTab("website") : undefined}
                  onGenerateChatbot={biData ? () => {
                    saveProjectContext({ projectId: id, projectTitle: project.title, originatingBusinessIntelligenceId: id })
                    saveGenerationContext({ idea: project.businessIdea, industry: biData.industry, businessSnapshot: biData.businessSnapshot, targetMarket: biData.targetMarket, chatbotRole: biData.chatbotRole, automations: biData.automations ?? [], growthPlan: biData.growthPlan ?? [], strategicInsights: biData.strategicInsights, recommendedStack: biData.recommendedStack, competitiveAdvantage: biData.competitiveAdvantage })
                    setLocation("/chatbot-generator")
                  } : undefined}
                  onBuildAutomation={biData ? () => {
                    saveProjectContext({ projectId: id, projectTitle: project.title, originatingBusinessIntelligenceId: id })
                    saveGenerationContext({ idea: project.businessIdea, industry: biData.industry, businessSnapshot: biData.businessSnapshot, targetMarket: biData.targetMarket, chatbotRole: biData.chatbotRole, automations: biData.automations ?? [], growthPlan: biData.growthPlan ?? [], strategicInsights: biData.strategicInsights, recommendedStack: biData.recommendedStack, competitiveAdvantage: biData.competitiveAdvantage })
                    setLocation("/automation-builder")
                  } : undefined}
                />
              </motion.div>
            )}

            {tab === "website" && (
              <motion.div key="website" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0">
                <WebsitePanel
                  businessIdea={project.businessIdea}
                  businessIntelligence={biData}
                  projectId={id}
                  existingOutput={project.websiteOutput as Record<string, unknown> | null}
                  onSaved={handleWebsiteSaved}
                />
              </motion.div>
            )}

            {tab === "chatbot" && (
              <motion.div key="chatbot" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ChatbotTab
                  biData={biData}
                  chatbotOutput={project.chatbotOutput ?? null}
                  onNavigate={() => {
                    saveProjectContext({ projectId: id, projectTitle: project.title, originatingBusinessIntelligenceId: id })
                    if (biData) saveGenerationContext({ idea: project.businessIdea, industry: biData.industry, businessSnapshot: biData.businessSnapshot, targetMarket: biData.targetMarket, chatbotRole: biData.chatbotRole, automations: biData.automations ?? [], growthPlan: biData.growthPlan ?? [], strategicInsights: biData.strategicInsights, recommendedStack: biData.recommendedStack, competitiveAdvantage: biData.competitiveAdvantage })
                    setLocation("/chatbot-generator")
                  }}
                />
              </motion.div>
            )}

            {tab === "automation" && (
              <motion.div key="automation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AutomationTab
                  biData={biData}
                  automationOutput={project.automationOutput ?? null}
                  onNavigate={() => {
                    saveProjectContext({ projectId: id, projectTitle: project.title, originatingBusinessIntelligenceId: id })
                    if (biData) saveGenerationContext({ idea: project.businessIdea, industry: biData.industry, businessSnapshot: biData.businessSnapshot, targetMarket: biData.targetMarket, chatbotRole: biData.chatbotRole, automations: biData.automations ?? [], growthPlan: biData.growthPlan ?? [], strategicInsights: biData.strategicInsights, recommendedStack: biData.recommendedStack, competitiveAdvantage: biData.competitiveAdvantage })
                    setLocation("/automation-builder")
                  }}
                />
              </motion.div>
            )}

            {tab === "tasks" && (
              <motion.div key="tasks" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TasksTab projectId={id} />
              </motion.div>
            )}

            {tab === "history" && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <HistoryTab events={events} createdAt={project.createdAt} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
