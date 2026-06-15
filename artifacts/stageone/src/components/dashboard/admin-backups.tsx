import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Database, FileArchive, Settings, CheckCircle2, AlertTriangle,
  Clock, RefreshCw, Plus, X, Trash2, HardDrive, Shield,
  TrendingUp, AlertCircle,
} from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface Backup {
  id: string
  backupType: string
  label: string
  status: string
  sizeBytes: number | null
  metadata: Record<string, unknown> | null
  errorMessage: string | null
  createdBy: string | null
  createdAt: string
  completedAt: string | null
}

interface ReadinessInfo {
  score: number
  latestDatabase:       { id: string; createdAt: string; sizeBytes: number | null } | null
  latestProjectExport:  { id: string; createdAt: string; sizeBytes: number | null } | null
  latestConfigSnapshot: { id: string; createdAt: string; sizeBytes: number | null } | null
  databaseBackupAgeHours: number | null
}

interface Stats30d { total: number; success: number; failed: number }

interface BackupData {
  backups: Backup[]
  readiness: ReadinessInfo
  stats30d: Stats30d
  meta: { computedAt: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  database:       { label: "Database",        icon: Database,    color: "#6366F1" },
  project_export: { label: "Project Export",  icon: FileArchive, color: "#F59E0B" },
  config_snapshot:{ label: "Config Snapshot", icon: Settings,    color: "#10B981" },
}

const STATUS_META: Record<string, { color: string; label: string }> = {
  pending: { color: "#6B7280", label: "Pending" },
  running: { color: "#6366F1", label: "Running" },
  success: { color: "#10B981", label: "Success" },
  failed:  { color: "#EF4444", label: "Failed"  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return "just now"
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1073741824) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${(bytes / 1073741824).toFixed(2)} GB`
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

// ─── Readiness Score Gauge ────────────────────────────────────────────────────

function ReadinessGauge({ score }: { score: number }) {
  const color = score >= 80 ? "#10B981" : score >= 50 ? "#F59E0B" : "#EF4444"
  const label = score >= 80 ? "Excellent" : score >= 50 ? "Moderate" : "Critical"
  const circumference = 2 * Math.PI * 36
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" stroke="#ffffff08" strokeWidth="6" fill="none" />
          <motion.circle cx="40" cy="40" r="36" stroke={color} strokeWidth="6" fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut" }} />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black" style={{ color }}>{score}</span>
          <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">/ 100</span>
        </div>
      </div>
      <span className="text-xs font-black" style={{ color }}>{label}</span>
    </div>
  )
}

// ─── Create Backup Form ───────────────────────────────────────────────────────

function CreateBackupForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [backupType, setBackupType] = useState<"database" | "project_export" | "config_snapshot">("database")
  const [label, setLabel] = useState("")
  const [status, setStatus] = useState<"pending" | "running" | "success" | "failed">("success")
  const [sizeKb, setSizeKb] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setError(null)
    if (!label.trim()) { setError("Label is required"); return }
    setLoading(true)
    try {
      const body: Record<string, unknown> = { backupType, label, status }
      if (sizeKb) body.sizeBytes = Math.round(parseFloat(sizeKb) * 1024)
      const res = await fetch("/api/admin/backups", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
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
        className="w-full max-w-md rounded-t-3xl border border-white/10 bg-[#0a0a0a] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10"><HardDrive className="h-4 w-4 text-indigo-400" /></div>
            <p className="text-sm font-black text-foreground">Record Backup</p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Backup Type</p>
            <div className="flex gap-1.5 flex-wrap">
              {(["database", "project_export", "config_snapshot"] as const).map(t => {
                const meta = TYPE_META[t]
                const Icon = meta.icon
                return (
                  <button key={t} onClick={() => setBackupType(t)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all ${backupType === t ? "text-foreground" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}
                    style={backupType === t ? { background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}30` } : {}}>
                    <Icon className="h-3 w-3" />
                    {meta.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Label</p>
            <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Manual backup — pre-migration"
              className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-foreground focus:outline-none focus:border-white/20" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Status</p>
              <div className="flex gap-1 flex-wrap">
                {(["pending", "success", "failed"] as const).map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black border transition-all capitalize ${status === s ? "text-foreground" : "border-white/8 bg-white/3 text-muted-foreground"}`}
                    style={status === s ? { background: `${STATUS_META[s].color}18`, color: STATUS_META[s].color, borderColor: `${STATUS_META[s].color}30` } : {}}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Size (KB)</p>
              <input value={sizeKb} onChange={e => setSizeKb(e.target.value)} placeholder="Optional, e.g. 2048"
                type="number" min="0"
                className="w-full px-3 py-2 rounded-xl bg-white/4 border border-white/8 text-xs text-foreground focus:outline-none focus:border-white/20" />
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

        <button onClick={handleSubmit} disabled={loading}
          className="w-full py-2.5 rounded-xl bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-xs font-black hover:bg-indigo-500/20 transition-all disabled:opacity-50">
          {loading ? "Recording…" : "Record Backup"}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdminBackups() {
  const [data, setData] = useState<BackupData | null>(null)
  const [loading, setLoading] = useState(false)
  const [typeFilter, setTypeFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [showForm, setShowForm] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetch("/api/admin/backups", { credentials: "include" }).then(r => r.json())
      setData(d)
    } catch (_) {}
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: string) => {
    setDeleting(id)
    try {
      await fetch(`/api/admin/backups/${id}`, { method: "DELETE", credentials: "include" })
      await load()
    } catch (_) {}
    setDeleting(null)
  }

  const backups = (data?.backups ?? []).filter(b =>
    (typeFilter === "all" || b.backupType === typeFilter) &&
    (statusFilter === "all" || b.status === statusFilter)
  )

  const readiness = data?.readiness
  const stats30d = data?.stats30d

  const COVERAGE_ITEMS = [
    { key: "latestDatabase",       label: "Database",        icon: Database,    color: "#6366F1", val: readiness?.latestDatabase },
    { key: "latestProjectExport",  label: "Project Export",  icon: FileArchive, color: "#F59E0B", val: readiness?.latestProjectExport },
    { key: "latestConfigSnapshot", label: "Config Snapshot", icon: Settings,    color: "#10B981", val: readiness?.latestConfigSnapshot },
  ]

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
          <button onClick={() => setTypeFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === "all" ? "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25" : "text-muted-foreground hover:text-foreground"}`}>
            All
          </button>
          {Object.entries(TYPE_META).map(([key, meta]) => (
            <button key={key} onClick={() => setTypeFilter(key)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${typeFilter === key ? "border" : "text-muted-foreground hover:text-foreground"}`}
              style={typeFilter === key ? { background: `${meta.color}18`, color: meta.color, borderColor: `${meta.color}30` } : {}}>
              <meta.icon className="h-2.5 w-2.5" />
              {meta.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
            {["all", "success", "failed", "pending"].map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${statusFilter === s ? "bg-white/8 text-foreground border border-white/15" : "text-muted-foreground hover:text-foreground"}`}
                style={statusFilter === s && s !== "all" ? { background: `${STATUS_META[s]?.color}18`, color: STATUS_META[s]?.color, borderColor: `${STATUS_META[s]?.color}30` } : {}}>
                {s}
              </button>
            ))}
          </div>
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/15 transition-all">
            <Plus className="h-3 w-3" />
            Record Backup
          </button>
          <button onClick={load} disabled={loading}
            className="p-2 rounded-lg border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Readiness + coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Readiness gauge */}
        <div className="rounded-2xl border border-white/8 bg-white/2 p-5 flex flex-col items-center justify-center gap-3">
          <p className="text-xs font-black text-foreground">Restore Readiness</p>
          <ReadinessGauge score={readiness?.score ?? 0} />
          {readiness?.databaseBackupAgeHours !== null && readiness?.databaseBackupAgeHours !== undefined && (
            <p className="text-[10px] text-muted-foreground">DB backup {readiness.databaseBackupAgeHours}h ago</p>
          )}
        </div>

        {/* Coverage cards */}
        {COVERAGE_ITEMS.map(({ label, icon: Icon, color, val }) => (
          <div key={label} className="rounded-2xl border border-white/8 bg-white/2 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg" style={{ background: `${color}15` }}>
                <Icon className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <p className="text-xs font-black text-foreground">{label}</p>
            </div>
            {val ? (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                  <span className="text-xs font-bold text-green-400">Backed up</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{timeAgo(val.createdAt)}</p>
                {val.sizeBytes && <p className="text-[10px] text-muted-foreground">{formatBytes(val.sizeBytes)}</p>}
              </div>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 text-red-400" />
                  <span className="text-xs font-bold text-red-400">Not backed up</span>
                </div>
                <p className="text-[10px] text-muted-foreground">Record a backup to improve readiness</p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 30d stats */}
      {stats30d && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Total (30d)",    value: stats30d.total,   icon: HardDrive,     color: "#6366F1" },
            { label: "Successful",     value: stats30d.success, icon: CheckCircle2,  color: "#10B981" },
            { label: "Failed",         value: stats30d.failed,  icon: AlertTriangle, color: "#EF4444" },
          ].map(({ label, value, icon: Icon, color }) => (
            <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/8 bg-white/2 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-xl" style={{ background: `${color}15` }}>
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
              </div>
              <p className="text-xl font-black text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Backup history */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-black text-muted-foreground uppercase tracking-widest">Backup History</p>
          <span className="text-[10px] text-muted-foreground">{backups.length} records</span>
        </div>

        {backups.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-white/2 py-14 text-center">
            <HardDrive className="h-7 w-7 mx-auto mb-2 text-muted-foreground opacity-30" />
            <p className="text-sm font-bold text-foreground mb-1">No backup records</p>
            <p className="text-xs text-muted-foreground">Record your first backup to start tracking restore readiness</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
            <div className="grid grid-cols-5 gap-2 px-4 py-2.5 border-b border-white/5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">
              <span className="col-span-2">Label / Type</span>
              <span>Status</span>
              <span>Size</span>
              <span>Created</span>
            </div>
            {backups.map((b, i) => {
              const meta = TYPE_META[b.backupType]
              const Icon = meta?.icon ?? Database
              return (
                <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(i * 0.02, 0.5) }}
                  className="grid grid-cols-5 gap-2 items-center px-4 py-3 border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors group">
                  <div className="col-span-2 flex items-center gap-2.5 min-w-0">
                    <div className="flex-shrink-0 p-1.5 rounded-lg" style={{ background: `${meta?.color ?? "#6B7280"}15` }}>
                      <Icon className="h-3 w-3" style={{ color: meta?.color ?? "#6B7280" }} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{b.label}</p>
                      <p className="text-[10px] text-muted-foreground">{meta?.label ?? b.backupType}</p>
                    </div>
                  </div>
                  <StatusBadge status={b.status} />
                  <span className="text-xs text-muted-foreground">{formatBytes(b.sizeBytes)}</span>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground">{timeAgo(b.createdAt)}</span>
                    <button onClick={() => handleDelete(b.id)} disabled={deleting === b.id}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg bg-red-500/8 text-red-400/60 hover:text-red-400 border border-red-500/10 transition-all disabled:opacity-30">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {/* System recovery readiness detail */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-indigo-400" />
          <p className="text-sm font-black text-foreground">Recovery Readiness Breakdown</p>
        </div>
        <div className="space-y-3">
          {[
            { label: "Database backup present",       met: !!readiness?.latestDatabase,       detail: readiness?.latestDatabase ? `Last: ${timeAgo(readiness.latestDatabase.createdAt)}` : "No database backup recorded",                       weight: 40 },
            { label: "Project exports present",       met: !!readiness?.latestProjectExport,  detail: readiness?.latestProjectExport ? `Last: ${timeAgo(readiness.latestProjectExport.createdAt)}` : "No project exports recorded",              weight: 30 },
            { label: "Config snapshot present",       met: !!readiness?.latestConfigSnapshot, detail: readiness?.latestConfigSnapshot ? `Last: ${timeAgo(readiness.latestConfigSnapshot.createdAt)}` : "No config snapshots recorded",          weight: 20 },
            { label: "3+ successful backups (7d)",    met: (stats30d?.success ?? 0) >= 3,     detail: `${stats30d?.success ?? 0} successful backup${(stats30d?.success ?? 0) !== 1 ? "s" : ""} in the last 30 days`,                           weight: 10 },
          ].map(({ label, met, detail, weight }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center ${met ? "bg-green-500/15 border border-green-500/30" : "bg-red-500/10 border border-red-500/20"}`}>
                {met ? <CheckCircle2 className="h-3 w-3 text-green-400" /> : <AlertCircle className="h-3 w-3 text-red-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${met ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                <p className="text-[10px] text-muted-foreground/60">{detail}</p>
              </div>
              <span className={`text-[10px] font-black flex-shrink-0 ${met ? "text-green-400" : "text-muted-foreground/40"}`}>+{weight}pts</span>
            </div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {showForm && <CreateBackupForm onClose={() => setShowForm(false)} onDone={load} />}
      </AnimatePresence>
    </div>
  )
}
