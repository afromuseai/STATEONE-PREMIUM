import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { useAuth } from "@/lib/auth-context"
import {
  Webhook, Plus, X, Trash2, Play, CheckCircle2, XCircle, Clock,
  Copy, Eye, EyeOff, Settings2, ChevronDown, ChevronRight, Zap
} from "lucide-react"

interface WebhookType {
  id: string
  name: string
  url: string
  secret: string | null
  events: string[]
  isActive: boolean
  lastTriggeredAt: string | null
  successCount: number
  failureCount: number
  deliveryLogs: Array<{
    timestamp: string
    event: string
    success: boolean
    statusCode: number
    error: string | null
  }>
  createdAt: string
}

const ALL_EVENTS = [
  "deployment.created", "deployment.active", "deployment.failed",
  "deployment.stopped", "deployment.rollback", "generation.completed",
  "generation.failed", "template.published", "agent.installed", "agent.error",
]

const EVENT_COLORS: Record<string, string> = {
  "deployment.created": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "deployment.active": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "deployment.failed": "text-red-400 bg-red-500/10 border-red-500/20",
  "deployment.stopped": "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "deployment.rollback": "text-violet-400 bg-violet-500/10 border-violet-500/20",
  "generation.completed": "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  "generation.failed": "text-red-400 bg-red-500/10 border-red-500/20",
  "template.published": "text-primary bg-primary/10 border-primary/20",
  "agent.installed": "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "agent.error": "text-red-400 bg-red-500/10 border-red-500/20",
}

export default function WebhooksPage() {
  const [showCreate, setShowCreate] = useState(false)
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({})
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null)
  const [pingStatus, setPingStatus] = useState<Record<string, "idle" | "pending" | "ok" | "fail">>({})

  const [form, setForm] = useState({
    name: "",
    url: "",
    secret: "",
    events: [] as string[],
  })

  const { user } = useAuth()
  const qc = useQueryClient()

  const { data } = useQuery<{ webhooks: WebhookType[] }>({
    queryKey: ["webhooks", user?.id],
    queryFn: () => fetch("/api/webhooks", { credentials: "include" }).then(r => r.json()),
  })

  const createMutation = useMutation({
    mutationFn: (body: typeof form) =>
      fetch("/api/webhooks", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, secret: body.secret || undefined }),
      }).then(r => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["webhooks", user?.id] })
      setShowCreate(false)
      setForm({ name: "", url: "", secret: "", events: [] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/webhooks/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      fetch(`/api/webhooks/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["webhooks"] }),
  })

  const pingMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/webhooks/${id}/ping`, { method: "POST", credentials: "include" }).then(r => r.json()),
    onSuccess: (result, id) => {
      setPingStatus(s => ({ ...s, [id]: result.success ? "ok" : "fail" }))
      qc.invalidateQueries({ queryKey: ["webhooks", user?.id] })
      setTimeout(() => setPingStatus(s => ({ ...s, [id]: "idle" })), 3000)
    },
  })

  const webhooks = data?.webhooks ?? []

  const toggleEvent = (ev: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }))
  }

  return (

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-white/5 bg-[#0a0a0a] px-8 py-5 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15 border border-primary/25">
                  <Zap className="h-4 w-4 text-primary" />
                </div>
                <h1 className="text-lg font-bold text-foreground">Webhooks</h1>
              </div>
              <p className="text-xs text-muted-foreground">Real-time event notifications sent to your endpoints when things happen in STAGEONE</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-primary/15 border border-primary/30 text-primary rounded-xl px-4 py-2 text-sm font-semibold hover:bg-primary/25 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Webhook
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Stats */}
          {webhooks.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: "Total Webhooks", value: webhooks.length, icon: Webhook },
                { label: "Successful Deliveries", value: webhooks.reduce((s, w) => s + w.successCount, 0), icon: CheckCircle2 },
                { label: "Failed Deliveries", value: webhooks.reduce((s, w) => s + w.failureCount, 0), icon: XCircle },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/2 border border-white/6 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>
          )}

          {webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-semibold text-muted-foreground mb-1">No webhooks configured</p>
              <p className="text-xs text-muted-foreground/60 mb-4">Create a webhook to receive real-time events from STAGEONE</p>
              <button
                onClick={() => setShowCreate(true)}
                className="text-xs font-semibold text-primary border border-primary/30 bg-primary/10 rounded-xl px-4 py-2 hover:bg-primary/20 transition-colors"
              >
                Create Your First Webhook
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {webhooks.map((wh, i) => (
                <motion.div
                  key={wh.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-white/2 border border-white/6 rounded-2xl overflow-hidden"
                >
                  <div className="flex items-center gap-4 px-5 py-4">
                    <div className={`h-2 w-2 rounded-full shrink-0 ${wh.isActive ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" : "bg-white/20"}`} />

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{wh.name}</p>
                        {!wh.isActive && (
                          <span className="text-[9px] font-black uppercase tracking-wider bg-white/5 border border-white/10 text-muted-foreground rounded-full px-1.5 py-0.5">Paused</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-xs">{wh.url}</p>
                        <button
                          onClick={() => navigator.clipboard.writeText(wh.url)}
                          className="text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                      <div className="flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{wh.successCount}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <XCircle className="h-3.5 w-3.5 text-red-400" />
                        <span>{wh.failureCount}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {/* Ping button */}
                      <button
                        disabled={pingMutation.isPending}
                        onClick={() => {
                          setPingStatus(s => ({ ...s, [wh.id]: "pending" }))
                          pingMutation.mutate(wh.id)
                        }}
                        className={`flex items-center gap-1.5 text-xs font-semibold rounded-lg px-3 py-1.5 border transition-all ${
                          pingStatus[wh.id] === "ok"
                            ? "bg-emerald-500/12 border-emerald-500/25 text-emerald-400"
                            : pingStatus[wh.id] === "fail"
                            ? "bg-red-500/12 border-red-500/25 text-red-400"
                            : "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {pingStatus[wh.id] === "pending" ? (
                          <Clock className="h-3.5 w-3.5 animate-spin" />
                        ) : pingStatus[wh.id] === "ok" ? (
                          <><CheckCircle2 className="h-3.5 w-3.5" /> OK</>
                        ) : pingStatus[wh.id] === "fail" ? (
                          <><XCircle className="h-3.5 w-3.5" /> Failed</>
                        ) : (
                          <><Play className="h-3.5 w-3.5" /> Ping</>
                        )}
                      </button>

                      <button
                        onClick={() => toggleMutation.mutate({ id: wh.id, isActive: !wh.isActive })}
                        className={`text-xs font-semibold rounded-lg px-3 py-1.5 border transition-colors ${
                          wh.isActive
                            ? "bg-white/4 border-white/8 text-muted-foreground hover:text-foreground"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        {wh.isActive ? "Pause" : "Enable"}
                      </button>

                      <button
                        onClick={() => setExpandedLogs(expandedLogs === wh.id ? null : wh.id)}
                        className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
                      >
                        {expandedLogs === wh.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>

                      <button
                        onClick={() => { if (confirm("Delete this webhook?")) deleteMutation.mutate(wh.id) }}
                        className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Events */}
                  <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                    {wh.events.map(ev => (
                      <span key={ev} className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ${EVENT_COLORS[ev] ?? "bg-white/5 border-white/10 text-muted-foreground"}`}>
                        {ev}
                      </span>
                    ))}
                  </div>

                  {/* Delivery logs */}
                  <AnimatePresence>
                    {expandedLogs === wh.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-white/6 overflow-hidden"
                      >
                        <div className="p-4">
                          <p className="text-xs font-bold text-foreground mb-3">Recent Deliveries</p>
                          {wh.deliveryLogs.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No deliveries yet. Use Ping to test.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {[...(wh.deliveryLogs as WebhookType["deliveryLogs"])].reverse().slice(0, 10).map((log, li) => (
                                <div key={li} className="flex items-center gap-3 text-xs">
                                  {log.success ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
                                  )}
                                  <span className={`border rounded-full px-1.5 py-0.5 text-[10px] font-medium ${EVENT_COLORS[log.event] ?? "bg-white/5 border-white/10 text-muted-foreground"}`}>
                                    {log.event}
                                  </span>
                                  <span className={`font-mono ${log.success ? "text-emerald-400" : "text-red-400"}`}>{log.statusCode || "—"}</span>
                                  <span className="text-muted-foreground/60">{new Date(log.timestamp).toLocaleString()}</span>
                                  {log.error && <span className="text-red-400/70 truncate">{log.error}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-6"
            >
              <div className="w-full max-w-md bg-[#0d0d0d] border border-white/8 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-bold text-foreground">New Webhook</h2>
                  <button onClick={() => setShowCreate(false)} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Name</label>
                    <input
                      value={form.name}
                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="My Webhook"
                      className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Endpoint URL</label>
                    <input
                      value={form.url}
                      onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                      placeholder="https://your-server.com/webhook"
                      className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Secret (optional — used for HMAC signatures)</label>
                    <div className="relative">
                      <input
                        type={showSecret["new"] ? "text" : "password"}
                        value={form.secret}
                        onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                        placeholder="whsec_…"
                        className="w-full bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/40 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSecret(s => ({ ...s, new: !s["new"] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showSecret["new"] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-2 block">Events to subscribe</label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                      {ALL_EVENTS.map(ev => (
                        <button
                          key={ev}
                          type="button"
                          onClick={() => toggleEvent(ev)}
                          className={`flex items-center gap-1.5 text-left text-[10px] font-medium border rounded-lg px-2.5 py-1.5 transition-all ${
                            form.events.includes(ev)
                              ? `${EVENT_COLORS[ev] ?? "bg-primary/10 border-primary/20 text-primary"}`
                              : "bg-white/3 border-white/8 text-muted-foreground hover:border-white/15"
                          }`}
                        >
                          {form.events.includes(ev) && <CheckCircle2 className="h-3 w-3 shrink-0" />}
                          {ev}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-muted-foreground border border-white/8 bg-white/3 hover:bg-white/6 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={!form.name || !form.url || form.events.length === 0 || createMutation.isPending}
                    onClick={() => createMutation.mutate(form)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-primary/15 border border-primary/30 text-primary hover:bg-primary/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? "Creating…" : "Create Webhook"}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  )
}
