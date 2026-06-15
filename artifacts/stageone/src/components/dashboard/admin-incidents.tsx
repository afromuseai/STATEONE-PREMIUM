import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  AlertCircle, CheckCircle2, AlertTriangle, Info,
  RefreshCw, Plus, X, ChevronDown, ChevronUp, Edit, Trash2,
  Clock, Activity,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Incident {
  id: string
  title: string
  description: string
  severity: string
  affectedSystems: string[]
  status: string
  createdBy: string
  resolvedAt: string | null
  createdAt: string
  updatedAt: string
}

interface IncidentData {
  incidents: Incident[]
  meta: { availableSystems: string[] }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_META: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  info:     { color: "#6366F1", label: "Info",     icon: Info },
  warning:  { color: "#F59E0B", label: "Warning",  icon: AlertTriangle },
  critical: { color: "#EF4444", label: "Critical", icon: AlertCircle },
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  investigating: { color: "#F59E0B", label: "Investigating" },
  identified:    { color: "#F97316", label: "Identified" },
  monitoring:    { color: "#6366F1", label: "Monitoring" },
  resolved:      { color: "#10B981", label: "Resolved" },
}

const AVAILABLE_SYSTEMS = [
  "API Server", "Database", "AI Pipeline", "Frontend",
  "Auth", "Webhooks", "Email", "Payments", "Notifications",
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function SeverityBadge({ severity }: { severity: string }) {
  const meta = SEVERITY_META[severity] ?? SEVERITY_META.info
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { color: "#6B7280", label: status }
  return (
    <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider"
      style={{ background: `${meta.color}18`, color: meta.color, border: `1px solid ${meta.color}30` }}>
      {meta.label}
    </span>
  )
}

// ─── Create/Edit Form ─────────────────────────────────────────────────────────

interface IncidentFormProps {
  incident?: Incident
  systems: string[]
  onClose: () => void
  onDone: () => void
}

function IncidentForm({ incident, systems, onClose, onDone }: IncidentFormProps) {
  const isEdit = !!incident
  const [title, setTitle]             = useState(incident?.title ?? "")
  const [description, setDescription] = useState(incident?.description ?? "")
  const [severity, setSeverity]       = useState(incident?.severity ?? "warning")
  const [status, setStatus]           = useState(incident?.status ?? "investigating")
  const [selectedSystems, setSelectedSystems] = useState<string[]>(incident?.affectedSystems ?? [])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const availSystems = systems.length > 0 ? systems : AVAILABLE_SYSTEMS

  const toggleSystem = (s: string) =>
    setSelectedSystems(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])

  const handleSubmit = async () => {
    setError(null)
    if (!title.trim()) { setError("Title is required"); return }
    if (description.trim().length < 10) { setError("Description must be at least 10 characters"); return }
    if (selectedSystems.length === 0) { setError("Select at least one affected system"); return }
    setLoading(true)
    try {
      const body = { title, description, severity, affectedSystems: selectedSystems, status }
      const res = await fetch(
        isEdit ? `/api/admin/incidents/${incident!.id}` : "/api/admin/incidents",
        {
          method: isEdit ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed"); setLoading(false); return }
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
        className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-5 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/10"><AlertCircle className="h-4 w-4 text-amber-400" /></div>
            <p className="text-sm font-black text-foreground">{isEdit ? "Update Incident" : "Create Incident"}</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Title</p>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Brief incident summary…"
              className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-foreground focus:outline-none focus:border-white/20" />
          </div>

          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Description</p>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4}
              placeholder="Detailed description of the incident, impact, and timeline…"
              className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-foreground resize-none focus:outline-none focus:border-white/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Severity</p>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(SEVERITY_META).map(([key, meta]) => (
                  <button key={key} onClick={() => setSeverity(key)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${severity === key ? "text-foreground" : "border-white/8 bg-white/3 text-muted-foreground"}`}
                    style={severity === key ? { background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}30` } : {}}>
                    {meta.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Status</p>
              <div className="flex gap-1 flex-wrap">
                {Object.entries(STATUS_META)
                  .filter(([key]) => isEdit || key !== "resolved")
                  .map(([key, meta]) => (
                    <button key={key} onClick={() => setStatus(key)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all ${status === key ? "text-foreground" : "border-white/8 bg-white/3 text-muted-foreground"}`}
                      style={status === key ? { background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}30` } : {}}>
                      {meta.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Affected Systems</p>
            <div className="flex gap-1.5 flex-wrap">
              {availSystems.map(s => (
                <button key={s} onClick={() => toggleSystem(s)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${selectedSystems.includes(s) ? "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/8 text-muted-foreground text-xs font-bold hover:text-foreground transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 text-xs font-black hover:bg-amber-500/20 transition-all disabled:opacity-50">
            {loading ? "Saving…" : isEdit ? "Update Incident" : "Create Incident"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Incident Card ─────────────────────────────────────────────────────────────

function IncidentCard({ incident, onEdit, onDelete, onResolve }: {
  incident: Incident
  onEdit: () => void
  onDelete: () => void
  onResolve: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isResolved = incident.status === "resolved"

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border bg-white/2 overflow-hidden transition-colors ${isResolved ? "border-white/5" : incident.severity === "critical" ? "border-red-500/20" : incident.severity === "warning" ? "border-amber-500/15" : "border-indigo-500/15"}`}>
      <div className="flex items-start gap-3 p-4">
        <div className="flex-shrink-0 mt-0.5">
          {(() => {
            const meta = SEVERITY_META[incident.severity] ?? SEVERITY_META.info
            const Icon = meta.icon
            return (
              <div className="p-1.5 rounded-lg" style={{ background: `${meta.color}15` }}>
                <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
              </div>
            )
          })()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-bold text-foreground">{incident.title}</p>
            <SeverityBadge severity={incident.severity} />
            <StatusBadge status={incident.status} />
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            {incident.affectedSystems.slice(0, 4).map(s => (
              <span key={s} className="text-[10px] font-bold text-muted-foreground/60 bg-white/4 rounded-md px-1.5 py-0.5 border border-white/5">{s}</span>
            ))}
            {incident.affectedSystems.length > 4 && (
              <span className="text-[10px] text-muted-foreground">+{incident.affectedSystems.length - 4} more</span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" />
              {timeAgo(incident.createdAt)}
            </span>
            {incident.resolvedAt && (
              <span className="text-[10px] text-green-400/60 flex items-center gap-1">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Resolved {timeAgo(incident.resolvedAt)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {!isResolved && (
            <button onClick={onResolve}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-all">
              Resolve
            </button>
          )}
          <button onClick={onEdit} className="p-1.5 rounded-lg bg-white/5 text-muted-foreground hover:text-foreground border border-white/8 transition-all">
            <Edit className="h-3 w-3" />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg bg-red-500/8 text-red-400/60 hover:text-red-400 border border-red-500/10 transition-all">
            <Trash2 className="h-3 w-3" />
          </button>
          <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg bg-white/3 text-muted-foreground hover:text-foreground transition-all">
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/5">
            <div className="px-4 py-3 bg-white/1 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">{incident.description}</p>
              <p className="text-[10px] text-muted-foreground/50 font-mono">ID: {incident.id}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminIncidents() {
  const [data, setData] = useState<IncidentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState("active")
  const [severityFilter, setSeverityFilter] = useState("all")
  const [showForm, setShowForm] = useState(false)
  const [editIncident, setEditIncident] = useState<Incident | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch(`/api/admin/incidents?status=${statusFilter}`, { credentials: "include" }).then(r => r.json())
      setData(d)
    } catch (_) {}
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/admin/incidents/${id}`, { method: "DELETE", credentials: "include" })
      await load()
    } catch (_) {}
    setDeleting(null)
  }

  const handleResolve = async (incident: Incident) => {
    try {
      await fetch(`/api/admin/incidents/${incident.id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "resolved" }),
      })
      await load()
    } catch (_) {}
  }

  const incidents = (data?.incidents ?? []).filter(i =>
    severityFilter === "all" || i.severity === severityFilter
  )

  const stats = {
    total:    data?.incidents.length ?? 0,
    active:   data?.incidents.filter(i => i.status !== "resolved").length ?? 0,
    critical: data?.incidents.filter(i => i.severity === "critical" && i.status !== "resolved").length ?? 0,
    resolved: data?.incidents.filter(i => i.status === "resolved").length ?? 0,
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
          {[
            { id: "active",   label: "Active" },
            { id: "resolved", label: "Resolved" },
            { id: "all",      label: "All" },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => setStatusFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${statusFilter === id ? "bg-amber-500/15 text-amber-400 border border-amber-500/25" : "text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
            {["all", "critical", "warning", "info"].map(s => (
              <button key={s} onClick={() => setSeverityFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${severityFilter === s ? "bg-white/8 text-foreground border border-white/15" : "text-muted-foreground hover:text-foreground"}`}
                style={severityFilter === s && s !== "all" ? { background: `${SEVERITY_META[s]?.color}18`, color: SEVERITY_META[s]?.color, borderColor: `${SEVERITY_META[s]?.color}30` } : {}}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => { setEditIncident(null); setShowForm(true) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold hover:bg-amber-500/15 transition-all">
            <Plus className="h-3 w-3" />
            New Incident
          </button>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Incidents",   value: stats.total,    icon: Activity,      color: "#6366F1" },
          { label: "Active Incidents",  value: stats.active,   icon: AlertTriangle, color: "#F59E0B" },
          { label: "Critical Active",   value: stats.critical, icon: AlertCircle,   color: "#EF4444" },
          { label: "Resolved",          value: stats.resolved, icon: CheckCircle2,  color: "#10B981" },
        ].map(({ label, value, icon: Icon, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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

      {/* Incident list */}
      {incidents.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center">
          <CheckCircle2 className="h-7 w-7 mx-auto mb-2 text-green-400/40" />
          <p className="text-sm font-bold text-foreground mb-1">All clear</p>
          <p className="text-xs text-muted-foreground">No {statusFilter !== "all" ? statusFilter : ""} incidents found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map(incident => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onEdit={() => { setEditIncident(incident); setShowForm(true) }}
              onDelete={() => { if (deleting !== incident.id) handleDelete(incident.id) }}
              onResolve={() => handleResolve(incident)}
            />
          ))}
        </div>
      )}

      <AnimatePresence>
        {showForm && (
          <IncidentForm
            incident={editIncident ?? undefined}
            systems={data?.meta.availableSystems ?? AVAILABLE_SYSTEMS}
            onClose={() => { setShowForm(false); setEditIncident(null) }}
            onDone={load}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
