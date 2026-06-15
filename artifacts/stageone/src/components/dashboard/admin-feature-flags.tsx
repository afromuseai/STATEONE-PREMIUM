import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Flag, Plus, Trash2, RefreshCw, Search, X, ChevronDown,
  ToggleLeft, ToggleRight, Percent, Tag, Users, Layers, Zap,
  Edit, Check, AlertCircle, Shield
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

function RuleTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    plan: "bg-violet-500/15 text-violet-400 border-violet-500/25",
    user: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    segment: "bg-amber-500/15 text-amber-400 border-amber-500/25",
  }
  const icons: Record<string, React.ElementType> = {
    plan: Layers,
    user: Users,
    segment: Tag,
  }
  const Icon = icons[type] ?? Tag
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${styles[type] ?? "bg-white/5 text-muted-foreground border-white/10"}`}>
      <Icon className="h-2.5 w-2.5" />
      {type}
    </span>
  )
}

export function AdminFeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<"all" | "enabled" | "disabled">("all")
  const [drawerFlag, setDrawerFlag] = useState<FeatureFlag | null>(null)
  const [editFlag, setEditFlag] = useState<FeatureFlag | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [newKey, setNewKey] = useState("")
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newEnabled, setNewEnabled] = useState(false)
  const [newRollout, setNewRollout] = useState(100)

  const [ruleType, setRuleType] = useState<"plan" | "user" | "segment">("plan")
  const [ruleValue, setRuleValue] = useState("")
  const [addingRule, setAddingRule] = useState(false)

  const [editRollout, setEditRollout] = useState(100)
  const [rolloutSaving, setRolloutSaving] = useState<string | null>(null)

  const toast = (msg: string) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/feature-flags", { credentials: "include" })
      const data = await res.json() as { flags: FeatureFlag[] }
      setFlags(data.flags ?? [])
    } catch { /* silent */ }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const handleSeed = async () => {
    setSeeding(true)
    try {
      const res = await fetch("/api/admin/feature-flags/seed", { method: "POST", credentials: "include" })
      const data = await res.json() as { seeded: number }
      toast(`Seeded ${data.seeded} initial flags`)
      await load()
    } catch { toast("Failed to seed flags") }
    setSeeding(false)
  }

  const handleToggle = async (flag: FeatureFlag) => {
    try {
      const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !flag.enabled }),
      })
      if (!res.ok) throw new Error()
      toast(`${flag.name} ${!flag.enabled ? "enabled" : "disabled"}`)
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
      if (drawerFlag?.id === flag.id) setDrawerFlag(prev => prev ? { ...prev, enabled: !prev.enabled } : null)
    } catch { toast("Failed to update flag") }
  }

  const handleDelete = async (flag: FeatureFlag) => {
    if (!confirm(`Delete flag "${flag.name}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/admin/feature-flags/${flag.id}`, { method: "DELETE", credentials: "include" })
      if (!res.ok) throw new Error()
      toast(`Deleted "${flag.name}"`)
      setFlags(prev => prev.filter(f => f.id !== flag.id))
      if (drawerFlag?.id === flag.id) setDrawerFlag(null)
    } catch { toast("Failed to delete flag") }
  }

  const handleCreate = async () => {
    if (!newKey.trim() || !newName.trim()) { toast("Key and name are required"); return }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: newKey.trim().toLowerCase().replace(/\s+/g, "_"), name: newName.trim(), description: newDesc.trim() || undefined, enabled: newEnabled, rolloutPercentage: newRollout }),
      })
      if (!res.ok) { const d = await res.json() as { error: string }; toast(d.error); setSaving(false); return }
      toast(`Created "${newName}"`)
      setShowCreate(false)
      setNewKey(""); setNewName(""); setNewDesc(""); setNewEnabled(false); setNewRollout(100)
      await load()
    } catch { toast("Failed to create flag") }
    setSaving(false)
  }

  const handleSaveEdit = async () => {
    if (!editFlag) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/feature-flags/${editFlag.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editFlag.name, description: editFlag.description }),
      })
      if (!res.ok) throw new Error()
      toast("Saved changes")
      setEditFlag(null)
      await load()
    } catch { toast("Failed to save") }
    setSaving(false)
  }

  const handleAddRule = async () => {
    if (!drawerFlag || !ruleValue.trim()) { toast("Rule value is required"); return }
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
      await load()
      const updated = await fetch("/api/admin/feature-flags", { credentials: "include" })
        .then(r => r.json() as Promise<{ flags: FeatureFlag[] }>)
        .then(d => d.flags.find(f => f.id === drawerFlag.id) ?? null)
      setDrawerFlag(updated)
    } catch { toast("Failed to add rule") }
    setAddingRule(false)
  }

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await fetch(`/api/admin/feature-flags/rules/${ruleId}`, { method: "DELETE", credentials: "include" })
      toast("Rule removed")
      await load()
      const updated = await fetch("/api/admin/feature-flags", { credentials: "include" })
        .then(r => r.json() as Promise<{ flags: FeatureFlag[] }>)
        .then(d => d.flags.find(f => f.id === drawerFlag?.id) ?? null)
      setDrawerFlag(updated)
    } catch { toast("Failed to remove rule") }
  }

  const handleRolloutSave = async (flag: FeatureFlag, pct: number) => {
    setRolloutSaving(flag.id)
    try {
      const res = await fetch(`/api/admin/feature-flags/${flag.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rolloutPercentage: pct }),
      })
      if (!res.ok) throw new Error()
      toast(`Rollout set to ${pct}%`)
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, rolloutPercentage: pct } : f))
      if (drawerFlag?.id === flag.id) setDrawerFlag(prev => prev ? { ...prev, rolloutPercentage: pct } : null)
    } catch { toast("Failed to update rollout") }
    setRolloutSaving(null)
  }

  const filtered = flags.filter(f => {
    const matchSearch = search === "" || f.name.toLowerCase().includes(search.toLowerCase()) || f.key.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === "all" || (filterStatus === "enabled" && f.enabled) || (filterStatus === "disabled" && !f.enabled)
    return matchSearch && matchStatus
  })

  const totalEnabled = flags.filter(f => f.enabled).length
  const totalDisabled = flags.filter(f => !f.enabled).length
  const betaFlags = flags.filter(f => f.rolloutPercentage < 100 && f.enabled).length

  return (
    <div className="space-y-4 relative">
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="fixed top-4 right-4 z-[100] flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/10 bg-[#0a0a0a] text-xs font-bold text-foreground shadow-2xl">
            <Check className="h-3.5 w-3.5 text-emerald-400" />{toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1">
          <Flag className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-black text-foreground">Feature Flags</h2>
          <span className="text-[10px] text-muted-foreground">({flags.length} total)</span>
        </div>
        <div className="flex items-center gap-2">
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

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: "Total Flags",    value: flags.length,   color: "text-foreground",    bg: "bg-white/3",           border: "border-white/8" },
          { label: "Enabled",        value: totalEnabled,   color: "text-emerald-400",   bg: "bg-emerald-500/5",     border: "border-emerald-500/15" },
          { label: "Disabled",       value: totalDisabled,  color: "text-red-400",       bg: "bg-red-500/5",         border: "border-red-500/15" },
          { label: "Beta Programs",  value: betaFlags,      color: "text-amber-400",     bg: "bg-amber-500/5",       border: "border-amber-500/15" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} p-3 space-y-0.5`}>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search flags…"
            className="w-full pl-7 pr-3 py-1.5 rounded-lg bg-white/4 border border-white/8 text-xs text-foreground focus:outline-none focus:border-white/20 placeholder:text-muted-foreground" />
        </div>
        <div className="flex gap-1">
          {(["all", "enabled", "disabled"] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all capitalize ${filterStatus === s ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Flags Table */}
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
              <tr className="border-b border-white/6">
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest">Name / Key</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden sm:table-cell">Status</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden md:table-cell">Rollout</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest hidden lg:table-cell">Rules</th>
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
                        <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${flag.rolloutPercentage}%` }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">{flag.rolloutPercentage}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-[10px] text-muted-foreground">{flag.rules.length} rule{flag.rules.length !== 1 ? "s" : ""}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => { setDrawerFlag(flag); setEditRollout(flag.rolloutPercentage) }}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all" title="Manage rules & rollout">
                        <Edit className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => handleToggle(flag)}
                        className={`p-1.5 rounded-lg transition-all ${flag.enabled ? "text-emerald-400 hover:bg-emerald-500/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                        title={flag.enabled ? "Disable" : "Enable"}>
                        {flag.enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                      </button>
                      <button onClick={() => handleDelete(flag)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all" title="Delete">
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

      {/* Rules / Edit Drawer */}
      <AnimatePresence>
        {drawerFlag && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) setDrawerFlag(null) }}>
            <motion.div initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              className="w-full max-w-lg rounded-t-3xl border border-white/10 bg-[#090909] p-5 space-y-5 max-h-[80vh] overflow-y-auto">

              {/* Drawer Header */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-black text-foreground">{drawerFlag.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{drawerFlag.key}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggle(drawerFlag)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${drawerFlag.enabled ? "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/15" : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"}`}>
                    {drawerFlag.enabled ? <ToggleRight className="h-3.5 w-3.5" /> : <ToggleLeft className="h-3.5 w-3.5" />}
                    {drawerFlag.enabled ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => setDrawerFlag(null)} className="p-1.5 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Rollout Slider */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black text-foreground flex items-center gap-1.5"><Percent className="h-3.5 w-3.5 text-primary" />Rollout Percentage</p>
                  <span className="text-sm font-black text-primary font-mono">{editRollout}%</span>
                </div>
                <input type="range" min={0} max={100} step={5} value={editRollout}
                  onChange={e => setEditRollout(Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>0% — Off</span><span>50% — Half</span><span>100% — All</span>
                </div>
                {editRollout !== drawerFlag.rolloutPercentage && (
                  <button onClick={() => handleRolloutSave(drawerFlag, editRollout)} disabled={rolloutSaving === drawerFlag.id}
                    className="w-full py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                    {rolloutSaving === drawerFlag.id ? "Saving…" : `Save Rollout (${editRollout}%)`}
                  </button>
                )}
                {drawerFlag.rolloutPercentage < 100 && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />Only {drawerFlag.rolloutPercentage}% of users without explicit rules will see this feature.
                  </p>
                )}
              </div>

              {/* Existing Rules */}
              <div className="space-y-2">
                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Targeting Rules ({drawerFlag.rules.length})</p>
                {drawerFlag.rules.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground py-2">No targeting rules. Feature applies globally based on rollout %.</p>
                ) : (
                  <div className="space-y-1.5">
                    {drawerFlag.rules.map(rule => (
                      <div key={rule.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/8 bg-white/3">
                        <RuleTypeBadge type={rule.ruleType} />
                        <span className="text-xs text-foreground font-mono flex-1">{rule.ruleValue}</span>
                        <button onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 text-muted-foreground hover:text-red-400 transition-colors">
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
                <div className="flex gap-2">
                  {(["plan", "user", "segment"] as const).map(t => (
                    <button key={t} onClick={() => { setRuleType(t); setRuleValue("") }}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border capitalize transition-all ${ruleType === t ? "bg-primary/15 border-primary/30 text-primary" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                      {t}
                    </button>
                  ))}
                </div>
                {ruleType === "plan" ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {PLAN_OPTIONS.map(p => (
                      <button key={p} onClick={() => setRuleValue(p)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border capitalize transition-all ${ruleValue === p ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                        {p}
                      </button>
                    ))}
                  </div>
                ) : ruleType === "segment" ? (
                  <div className="flex gap-1.5 flex-wrap">
                    {SEGMENT_OPTIONS.map(s => (
                      <button key={s} onClick={() => setRuleValue(s)}
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${ruleValue === s ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "border-white/8 bg-white/3 text-muted-foreground hover:text-foreground"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input value={ruleValue} onChange={e => setRuleValue(e.target.value)}
                    placeholder="User UUID…"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground font-mono focus:outline-none focus:border-white/20" />
                )}
                <button onClick={handleAddRule} disabled={addingRule || !ruleValue.trim()}
                  className="w-full py-2 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                  {addingRule ? "Adding…" : "Add Rule"}
                </button>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Shield className="h-3 w-3" />Rules are checked before rollout %. Explicit user rules take highest priority.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Create Flag Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
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
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. AI Builder v2"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Key * <span className="normal-case font-normal">(auto-slugified)</span></p>
                  <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="e.g. ai_builder_v2"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground font-mono focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Description</p>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="What does this flag control?"
                    className="w-full px-3 py-2 rounded-lg text-xs bg-white/4 border border-white/8 text-foreground resize-none focus:outline-none focus:border-white/20" />
                </div>
                <div>
                  <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Initial Rollout: <span className="text-primary font-mono">{newRollout}%</span></p>
                  <input type="range" min={0} max={100} step={5} value={newRollout} onChange={e => setNewRollout(Number(e.target.value))}
                    className="w-full accent-primary" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-white/8 bg-white/3">
                  <p className="text-xs font-bold text-foreground">Start enabled</p>
                  <button onClick={() => setNewEnabled(!newEnabled)}
                    className={`transition-colors ${newEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
                    {newEnabled ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <button onClick={handleCreate} disabled={saving || !newKey.trim() || !newName.trim()}
                className="w-full py-2.5 rounded-xl bg-primary/15 border border-primary/25 text-primary text-xs font-black hover:bg-primary/20 transition-all disabled:opacity-50">
                {saving ? "Creating…" : "Create Flag"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
