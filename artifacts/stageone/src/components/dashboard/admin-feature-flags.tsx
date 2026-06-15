import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Flag, Plus, Trash2, RefreshCw, Search, X,
  ToggleLeft, ToggleRight, Percent, Tag, Users, Layers, Zap,
  Edit, Check, AlertCircle, Shield, Calendar, Settings2,
} from "lucide-react"

interface FeatureFlagRule {
  id: string
  ruleType: "plan" | "user" | "segment"
  ruleValue: string
  createdAt: string
}

interface FeatureFlag {
  id: string
  key: string
  name: string
  description: string | null
  enabled: boolean
  rolloutPercentage: number
  createdAt: string
  updatedAt: string
  rules: FeatureFlagRule[]
}

const PLAN_OPTIONS = ["free", "pro", "startup", "enterprise"]
const SEGMENT_OPTIONS = ["power_users", "beta_testers", "early_access"]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

function RuleTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    plan:    "bg-violet-500/15 text-violet-400 border-violet-500/25",
    user:    "bg-blue-500/15 text-blue-400 border-blue-500/25",
    segment: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  }
  const icons: Record<string, React.ElementType> = { plan: Layers, user: Users, segment: Tag }
  const Icon = icons[type] ?? Tag
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${styles[type] ?? "bg-white/5 text-muted-foreground border-white/10"}`}>
      <Icon className="h-2.5 w-2.5" />{type}
    </span>
  )
}

export function AdminFeatureFlags() {
  const [flags, setFlags]               = useState<FeatureFlag[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "enabled" | "disabled">("all")

  // Drawer: rules + rollout
  const [drawerFlag, setDrawerFlag]         = useState<FeatureFlag | null>(null)
  const [editRollout, setEditRollout]       = useState(100)
  const [rolloutSaving, setRolloutSaving]   = useState(false)
  const [ruleType, setRuleType]             = useState<"plan" | "user" | "segment">("plan")
  const [ruleValue, setRuleValue]           = useState("")
  const [addingRule, setAddingRule]         = useState(false)

  // Edit name/description modal
  const [editFlag, setEditFlag]   = useState<FeatureFlag | null>(null)
  const [editName, setEditName]   = useState("")
  const [editDesc, setEditDesc]   = useState("")
  const [editSaving, setEditSaving] = useState(false)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey]         = useState("")
  const [newName, setNewName]       = useState("")
  const [newDesc, setNewDesc]       = useState("")
  const [newEnabled, setNewEnabled] = useState(false)
  const [newRollout, setNewRollout] = useState(100)
  const [creating, setCreating]     = useState(false)

  const [seeding, setSeeding]   = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const toast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch("/api/admin/feature-flags", { credentials: "include" })
      const data = await res.json() as { flags: FeatureFlag[] }
      setFlags(data.flags ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Helper: refresh and sync drawer
  const reloadAndSyncDrawer = async (flagId?: string) => {
    await load()
    if (flagId) {
      const res  = await fetch("/api/admin/feature-flags", { credentials: "include" })
      const data = await res.json() as { flags: FeatureFlag[] }
      const updated = data.flags.find(f => f.id === flagId) ?? null
      setDrawerFlag(updated)
    }
  }

  // ── Seed ────────────────────────────────────────────────────────────────────
  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res  = await fetch("/api/admin/feature-flags/seed", { method: "POST", credentials: "include" })
      const data = await res.json() as { seeded: number }
      toast(`Seeded ${data.seeded} initial flag${data.seeded !== 1 ? "s" : ""}`)
      await load()
    } catch { toast("Failed to seed flags") }
    setSeeding(false)
  }

  // ── Toggle enable / disable ──────────────────────────────────────────────────
  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !flag.enabled }),
      })
      if (!res.ok) throw new Error()
      const next = !flag.enabled
      toast(`"${flag.name}" ${next ? "enabled" : "disabled"}`)
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: next } : f))
      if (drawerFlag?.id === flag.id) setDrawerFlag(prev => prev ? { ...prev, enabled: next } : null)
    } catch { toast("Failed to update flag") }
  }

  // ── Delete flag ──────────────────────────────────────────────────────────────
  const handleDelete = async (flag: FeatureFlag) => {
    if (!confirm(`Delete flag "${flag.name}"? This cannot be undone.`)) return
    try {
      await fetch(`/api/admin/feature-flags/${flag.id}`, { method: "DELETE", credentials: "include" })
      toast(`Deleted "${flag.name}"`)
      setFlags(prev => prev.filter(f => f.id !== flag.id))
      if (drawerFlag?.id === flag.id) setDrawerFlag(null)
    } catch { toast("Failed to delete flag") }
  }

  // ── Create ───────────────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!newKey.trim() || !newName.trim()) { toast("Key and name are required"); return }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: newKey.trim().toLowerCase().replace(/\s+/g, "_"),
          name: newName.trim(),
          description: newDesc.trim() || undefined,
          enabled: newEnabled,
          rolloutPercentage: newRollout,
        }),
      })
      if (!res.ok) { const d = await res.json() as { error: string }; toast(d.error); setCreating(false); return }
      toast(`Created "${newName}"`)
      setShowCreate(false)
      setNewKey(""); setNewName(""); setNewDesc(""); setNewEnabled(false); setNewRollout(100)
      await load()
    } catch { toast("Failed to create flag") }
    setCreating(false)
  }

  // ── Edit name / description ───────────────────────────────────────────────────
  const openEdit = (flag: FeatureFlag) => {
    setEditFlag(flag)
    setEditName(flag.name)
    setEditDesc(flag.description ?? "")
  }

  const handleSaveEdit = async () => {
    if (!editFlag || !editName.trim()) { toast("Name is required"); return }
    setEditSaving(true)
    try {
      const res = await fetch(`/api/admin/feature-flags/${editFlag.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
      })
      if (!res.ok) throw new Error()
      toast("Changes saved")
      setEditFlag(null)
      await load()
    } catch { toast("Failed to save changes") }
    setEditSaving(false)
  }

  // ── Rollout save ─────────────────────────────────────────────────────────────
  const handleRolloutSave = async () => {
    if (!drawerFlag) return
    setRolloutSaving(true)
    try {
      await fetch(`/api/admin/feature-flags/${drawerFlag.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolloutPercentage: editRollout }),
      })
      toast(`Rollout set to ${editRollout}%`)
      setFlags(prev => prev.map(f => f.id === drawerFlag.id ? { ...f, rolloutPercentage: editRollout } : f))
      setDrawerFlag(prev => prev ? { ...prev, rolloutPercentage: editRollout } : null)
    } catch { toast("Failed to update rollout") }
    setRolloutSaving(false)
  }

  // ── Add rule ─────────────────────────────────────────────────────────────────
  const handleAddRule = async () => {
    if (!drawerFlag || !ruleValue.trim()) { toast("Select or enter a rule value"); return }
    setAddingRule(true)
    try {
      const res = await fetch(`/api/admin/feature-flags/${drawerFlag.id}/rules`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleType, ruleValue: ruleValue.trim() }),
      })
      if (!res.ok) { const d = await res.json() as { error: string }; toast(d.error); setAddingRule(false); return }
      toast("Rule added")
      setRuleValue("")
      await reloadAndSyncDrawer(drawerFlag.id)
    } catch { toast("Failed to add rule") }
    setAddingRule(false)
  }

  // ── Delete rule ───────────────────────────────────────────────────────────────
  const handleDeleteRule = async (ruleId: string) => {
    if (!drawerFlag) return
    const flagId = drawerFlag.id
    try {
      await fetch(`/api/admin/feature-flags/rules/${ruleId}`, { method: "DELETE", credentials: "include" })
      toast("Rule removed")
      await reloadAndSyncDrawer(flagId)
    } catch { toast("Failed to remove rule") }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────────
  const filtered = flags.filter(f => {
    const q = search.toLowerCase()
    const matchSearch = q === "" || f.name.toLowerCase().includes(q) || f.key.toLowerCase().includes(q) || (f.description ?? "").toLowerCase().includes(q)
    const matchStatus = filterStatus === "all" || (filterStatus === "enabled" && f.enabled) || (filterStatus === "disabled" && !f.enabled)
    return matchSearch && matchStatus
  })

  const totalEnabled = flags.filter(f => f.enabled).length
  const totalDisabled = flags.filter(f => !f.enabled).length
  const betaFlags     = flags.filter(f => f.enabled && f.rolloutPercentage < 100).length

  return (
    <div className="space-y-4 relative">

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-[#0a0a0a] text-xs font-bold text-foreground shadow-2xl">
            <Check className="h-3.5 w-3.5 text-emerald-400" />{toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <Flag className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">Feature Flags</h2>
          <span className="text-[10px] text-muted-foreground">({flags.length} total)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-white/8 bg-white/3 text-muted-foreground hover:text-foreground transition-all disabled:opacity-40">
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />Refresh
          </button>
          {flags.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 transition-all disabled:opacity-40">
              <Zap className={`h-3 w-3 ${seeding ? "animate-spin" : ""}`} />{seeding ? "Seeding…" : "Seed Initial Flags"}
            </button>
          )}
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 transition-all">
            <Plus className="h-3 w-3" />New Flag
          </button>
        </div>
      </div>

      {/* ── Overview Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total Flags",   value: flags.length,   color: "text-foreground",  bg: "bg-white/3",        border: "border-white/8" },
          { label: "Enabled",       value: totalEnabled,   color: "text-emerald-400", bg: "bg-emerald-500/5",  border: "border-emerald-500/15" },
          { label: "Disabled",      value: totalDisabled,  color: "text-red-400",     bg: "bg-red-500/5",      border: "border-red-500/15" },
          { label: "Beta Programs", value: betaFlags,      color: "text-amber-400",   bg: "bg-amber-500/5",    border: "border-amber-500/15" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 space-y-0.5`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, key, description…"
            className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-white/4 border border-white/8 text-xs text-foreground focus:outline-none focus:border-white/20 placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1">
          {(["all", "enabled", "disabled"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border capitalize transition-all ${filterStatus === s ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* ── Feature Table ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center">
          <RefreshCw className="h-5 w-5 mx-auto mb-2 text-muted-foreground animate-spin" />
          <p className="text-xs text-muted-foreground">Loading feature flags…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/8 bg-white/2 py-16 text-center space-y-3">
          <Flag className="h-8 w-8 mx-auto text-muted-foreground/30" />
          <p className="text-xs text-muted-foreground">
            {flags.length === 0 ? "No flags yet. Seed initial flags or create one." : "No flags match your filter."}
          </p>
          {flags.length === 0 && (
            <button onClick={handleSeed} disabled={seeding}
              className="mx-auto flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold border border-amber-500/25 bg-amber-500/10 text-amber-400 hover:bg-amber-500/15 transition-all disabled:opacity-40">
              <Zap className="h-3 w-3" />{seeding ? "Seeding…" : "Seed 6 Initial Flags"}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/8 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/6 bg-white/2">
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Name / Key</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">Rollout %</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Created</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((flag, i) => (
                <motion.tr key={flag.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">{flag.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{flag.key}</p>
                    {flag.description && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5 max-w-[200px] truncate">{flag.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${flag.enabled ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${flag.enabled ? "bg-emerald-400" : "bg-red-400"}`} />
                      {flag.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${flag.rolloutPercentage}%`, background: flag.rolloutPercentage === 100 ? "#10B981" : flag.rolloutPercentage >= 50 ? "#F59E0B" : "#EF4444" }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{flag.rolloutPercentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />{fmtDate(flag.createdAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(flag)} title="Edit name & description"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => { setDrawerFlag(flag); setEditRollout(flag.rolloutPercentage); setRuleValue("") }} title="Manage rules & rollout"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                        <Settings2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleToggle(flag)} title={flag.enabled ? "Disable" : "Enable"}
                        className={`p-1.5 rounded-lg transition-all ${flag.enabled ? "text-emerald-400 hover:bg-red-500/10 hover:text-red-400" : "text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10"}`}>
                        {flag.enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(flag)} title="Delete flag"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Rules & Rollout Drawer ────────────────────────────────────────── */}
      <AnimatePresence>
        {drawerFlag && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setDrawerFlag(null) }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#090909] p-5 space-y-5 max-h-[85vh] overflow-y-auto">

              {/* Drawer header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-foreground truncate">{drawerFlag.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{drawerFlag.key}</p>
                  {drawerFlag.description && (
                    <p className="text-[10px] text-muted-foreground/70 mt-1">{drawerFlag.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => handleToggle(drawerFlag)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${drawerFlag.enabled
                      ? "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/15"
                      : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"}`}>
                    {drawerFlag.enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                    {drawerFlag.enabled ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => setDrawerFlag(null)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Rollout Controls — D */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-foreground flex items-center gap-1.5">
                    <Percent className="h-3.5 w-3.5 text-primary" />Rollout Percentage
                  </p>
                  <span className={`text-sm font-black font-mono ${editRollout === 100 ? "text-emerald-400" : editRollout >= 50 ? "text-amber-400" : "text-red-400"}`}>
                    {editRollout}%
                  </span>
                </div>
                <input type="range" min={0} max={100} step={5} value={editRollout}
                  onChange={e => setEditRollout(Number(e.target.value))}
                  className="w-full accent-primary cursor-pointer" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0% — Nobody</span><span>50% — Half</span><span>100% — Everyone</span>
                </div>
                {editRollout !== drawerFlag.rolloutPercentage && (
                  <button onClick={handleRolloutSave} disabled={rolloutSaving}
                    className="w-full py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                    {rolloutSaving ? "Saving…" : `Save → ${editRollout}%`}
                  </button>
                )}
                {editRollout < 100 && editRollout > 0 && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Only {editRollout}% of users will see this feature (deterministic by user ID).
                  </p>
                )}
                {editRollout === 0 && (
                  <p className="text-[10px] text-red-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />0% rollout — no users will see this even if the flag is enabled.
                  </p>
                )}
              </div>

              {/* Existing Rules — C */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">
                    Targeting Rules ({drawerFlag.rules.length})
                  </p>
                  <p className="text-[10px] text-muted-foreground">Priority: user → segment → plan → global</p>
                </div>
                {drawerFlag.rules.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground py-2 border border-white/6 rounded-xl bg-white/2 text-center">
                    No rules — feature applies to all users based on rollout %.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {drawerFlag.rules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/3">
                        <RuleTypeBadge type={rule.ruleType} />
                        <span className="text-xs text-foreground font-mono flex-1 truncate">{rule.ruleValue}</span>
                        <span className="text-[10px] text-muted-foreground hidden sm:block">{fmtDate(rule.createdAt)}</span>
                        <button onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Rule */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Add Targeting Rule</p>
                <div className="flex gap-1.5">
                  {(["plan", "user", "segment"] as const).map(t => (
                    <button key={t} onClick={() => { setRuleType(t); setRuleValue("") }}
                      className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold border capitalize transition-all ${ruleType === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>

                {/* Plan selector */}
                {ruleType === "plan" && (
                  <div className="grid grid-cols-4 gap-1.5">
                    {PLAN_OPTIONS.map(p => (
                      <button key={p} onClick={() => setRuleValue(p)}
                        className={`py-2 rounded-lg text-[10px] font-bold border capitalize transition-all ${ruleValue === p ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                )}

                {/* Segment selector */}
                {ruleType === "segment" && (
                  <div className="space-y-1.5">
                    {SEGMENT_OPTIONS.map(s => (
                      <button key={s} onClick={() => setRuleValue(s)}
                        className={`w-full px-3 py-2 rounded-lg text-left text-[10px] font-bold border transition-all ${ruleValue === s ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                        {s}
                      </button>
                    ))}
                    <input value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="Or type a custom segment…"
                      className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none focus:border-white/20 placeholder:text-muted-foreground/50" />
                  </div>
                )}

                {/* User UUID input */}
                {ruleType === "user" && (
                  <input value={ruleValue} onChange={e => setRuleValue(e.target.value)} placeholder="Paste user UUID…"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground font-mono focus:outline-none focus:border-white/20 placeholder:text-muted-foreground/50" />
                )}

                <button onClick={handleAddRule} disabled={addingRule || !ruleValue.trim()}
                  className="w-full py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                  {addingRule ? "Adding…" : "Add Rule"}
                </button>

                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />
                  Rules override global rollout. User rules take highest priority.
                </p>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Edit Name / Description Modal ─────────────────────────────────── */}
      <AnimatePresence>
        {editFlag && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setEditFlag(null) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#090909] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-foreground">Edit Flag</p>
                <button onClick={() => setEditFlag(null)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Key <span className="normal-case font-normal text-muted-foreground/50">(read-only)</span></p>
                  <p className="px-3 py-2 rounded-lg text-xs bg-white/2 border border-white/6 text-muted-foreground font-mono">{editFlag.key}</p>
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Name *</p>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Description</p>
                  <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={3}
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground resize-none focus:outline-none focus:border-white/20" />
                </div>
              </div>
              <button onClick={handleSaveEdit} disabled={editSaving || !editName.trim()}
                className="w-full py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                {editSaving ? "Saving…" : "Save Changes"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Flag Modal ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setShowCreate(false) }}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-[#090909] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-foreground">New Feature Flag</p>
                <button onClick={() => setShowCreate(false)} className="p-1 text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Name *</p>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. AI Builder V2"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Key *</p>
                  <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="e.g. ai_builder_v2"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground font-mono focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Description</p>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2}
                    placeholder="What does this flag control?"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground resize-none focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                    Initial Rollout: <span className="text-primary font-mono">{newRollout}%</span>
                  </p>
                  <input type="range" min={0} max={100} step={5} value={newRollout}
                    onChange={e => setNewRollout(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/3">
                  <div>
                    <p className="text-xs font-bold text-foreground">Start enabled</p>
                    <p className="text-[10px] text-muted-foreground">Toggle on to make active immediately</p>
                  </div>
                  <button onClick={() => setNewEnabled(!newEnabled)}
                    className={`transition-colors ${newEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {newEnabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>
              </div>
              <button onClick={handleCreate} disabled={creating || !newKey.trim() || !newName.trim()}
                className="w-full py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                {creating ? "Creating…" : "Create Flag"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  )
}
