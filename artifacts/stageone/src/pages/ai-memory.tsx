import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain, Plus, X, Search, Trash2, Edit3, Star, Clock,
  Cpu, FolderOpen, Workflow, Lightbulb, Check, Sparkles,
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"

interface Memory {
  id: string
  key: string
  value: string
  context?: Record<string, unknown>
  importance: number
  source: string
  createdAt: string
  updatedAt: string
}

const SOURCE_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  manual:   { label: "Manual",   icon: Edit3,    color: "#D4AF37" },
  ai:       { label: "AI",       icon: Sparkles, color: "#8B5CF6" },
  project:  { label: "Project",  icon: FolderOpen, color: "#6366F1" },
  workflow: { label: "Workflow", icon: Workflow, color: "#10B981" },
}

function ImportanceDots({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <button key={i} onClick={() => onChange?.(i)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star className={`h-3 w-3 transition-colors ${i <= value ? "fill-primary text-primary" : "text-muted-foreground/30"}`} />
        </button>
      ))}
    </div>
  )
}

export default function AiMemoryPage() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [search, setSearch] = useState("")
  const [activeSource, setActiveSource] = useState<string>("all")
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState("")
  const [newValue, setNewValue] = useState("")
  const [newImportance, setNewImportance] = useState(3)
  const [newSource, setNewSource] = useState<"manual" | "ai" | "project" | "workflow">("manual")
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [deleted, setDeleted] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch("/api/memory", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.memories)) setMemories(d.memories) })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let list = memories.filter(m => !deleted.has(m.id))
    if (search) list = list.filter(m => m.key.toLowerCase().includes(search.toLowerCase()) || m.value.toLowerCase().includes(search.toLowerCase()))
    if (activeSource !== "all") list = list.filter(m => m.source === activeSource)
    return list.sort((a, b) => b.importance - a.importance)
  }, [memories, search, activeSource, deleted])

  const handleCreate = async () => {
    if (!newKey || !newValue) return
    setSaving(true)
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ key: newKey, value: newValue, importance: newImportance, source: newSource }),
      })
      const data = await res.json()
      if (data.memory) setMemories(prev => [data.memory, ...prev])
    } catch (_) {
      const mock: Memory = { id: Date.now().toString(), key: newKey, value: newValue, importance: newImportance, source: newSource, context: {}, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
      setMemories(prev => [mock, ...prev])
    }
    setSaving(false)
    setShowCreate(false)
    setNewKey("")
    setNewValue("")
    setNewImportance(3)
  }

  const handleDelete = async (id: string) => {
    setDeleted(prev => new Set([...prev, id]))
    try {
      await fetch(`/api/memory/${id}`, { method: "DELETE", credentials: "include" })
    } catch (_) {}
  }

  const handleClearAll = async () => {
    if (!window.confirm("Clear all memory entries? This cannot be undone.")) return
    setClearing(true)
    try {
      await fetch("/api/memory", { method: "DELETE", credentials: "include" })
      setMemories([])
      setDeleted(new Set())
    } catch (_) {}
    setClearing(false)
  }

  const bySource = Object.keys(SOURCE_CONFIG).reduce((acc, src) => {
    acc[src] = memories.filter(m => m.source === src && !deleted.has(m.id)).length
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">AI Memory</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">{filtered.length} Active Memory Nodes</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/8 px-3 py-1">
              <Brain className="h-3 w-3 text-purple-400" />
              <span className="text-[10px] font-semibold text-purple-400">Context Active</span>
            </div>
            {memories.filter(m => !deleted.has(m.id)).length > 0 && (
              <button onClick={handleClearAll} disabled={clearing}
                className="flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/8 text-red-400 hover:bg-red-500/15 hover:border-red-500/40 text-xs font-semibold px-3 py-2 transition-all disabled:opacity-50">
                <Trash2 className="h-3.5 w-3.5" />
                {clearing ? "Clearing…" : "Clear All"}
              </button>
            )}
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-black text-xs font-black px-3 py-2 hover:bg-primary/90 transition-all">
              <Plus className="h-3.5 w-3.5" />Add Memory
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search memory..."
                  className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors" />
              </div>
              <div className="flex gap-1.5">
                <button onClick={() => setActiveSource("all")}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${activeSource === "all" ? "bg-primary/12 border-primary/30 text-primary" : "border-white/8 text-muted-foreground hover:text-foreground"}`}>
                  All ({memories.filter(m => !deleted.has(m.id)).length})
                </button>
                {Object.entries(SOURCE_CONFIG).map(([src, { label, color }]) => (
                  <button key={src} onClick={() => setActiveSource(src)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-all ${activeSource === src ? "border-primary/30 text-primary bg-primary/12" : "border-white/8 text-muted-foreground hover:text-foreground"}`}>
                    {label} ({bySource[src] ?? 0})
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="text-center py-20">
                <Brain className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" />
                <p className="text-sm font-bold text-foreground/60">No memories yet</p>
                <p className="text-xs text-muted-foreground mt-1">AI memory stores context about your business, goals, and preferences to improve future recommendations</p>
                <button onClick={() => setShowCreate(true)}
                  className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-primary text-black text-xs font-black px-4 py-2">
                  <Plus className="h-3.5 w-3.5" />Add First Memory
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {filtered.map((mem, i) => {
                  const srcConf = SOURCE_CONFIG[mem.source] ?? SOURCE_CONFIG.manual
                  const SrcIcon = srcConf.icon
                  return (
                    <motion.div key={mem.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className={`rounded-xl border bg-white/2 p-4 space-y-3 hover:border-white/15 transition-all group ${
                        editId === mem.id ? "border-primary/30" : "border-white/8"
                      }`}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg" style={{ background: `${srcConf.color}15` }}>
                            <SrcIcon className="h-3.5 w-3.5" style={{ color: srcConf.color }} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground">{mem.key}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[8px] font-bold uppercase tracking-widest" style={{ color: srcConf.color }}>{srcConf.label}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditId(editId === mem.id ? null : mem.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/8 transition-all">
                            <Edit3 className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleDelete(mem.id)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 transition-all">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-foreground/80 leading-relaxed">{mem.value}</p>
                      <div className="flex items-center justify-between">
                        <ImportanceDots value={mem.importance} />
                        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(mem.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="w-64 shrink-0 border-l border-white/5 bg-[#070707] overflow-y-auto p-4 space-y-4">
            <div>
              <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">Memory Overview</h3>
              <div className="space-y-2">
                {[
                  { label: "Total Memories", value: memories.filter(m => !deleted.has(m.id)).length.toString(), icon: Brain, color: "#8B5CF6" },
                  { label: "High Priority", value: memories.filter(m => m.importance >= 4 && !deleted.has(m.id)).length.toString(), icon: Star, color: "#D4AF37" },
                  { label: "AI Generated", value: bySource.ai?.toString() ?? "0", icon: Cpu, color: "#6366F1" },
                  { label: "From Projects", value: bySource.project?.toString() ?? "0", icon: FolderOpen, color: "#10B981" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/2 p-3">
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5" style={{ color }} />
                      <span className="text-[10px] text-muted-foreground">{label}</span>
                    </div>
                    <span className="text-xs font-black text-foreground">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-white/5 pt-4">
              <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">How AI Memory Works</h3>
              <div className="space-y-3">
                {[
                  { icon: Brain, text: "Stores business context across all sessions", color: "#8B5CF6" },
                  { icon: Lightbulb, text: "References past projects for better recommendations", color: "#D4AF37" },
                  { icon: Sparkles, text: "Adapts AI outputs based on your preferences", color: "#6366F1" },
                  { icon: Cpu, text: "Detects patterns to improve strategic continuity", color: "#10B981" },
                ].map(({ icon: Icon, text, color }, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg shrink-0 mt-0.5" style={{ background: `${color}15` }}>
                      <Icon className="h-3 w-3" style={{ color }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 z-50 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-foreground">Add Memory Node</h3>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Memory Key</label>
                  <input value={newKey} onChange={e => setNewKey(e.target.value)} placeholder="e.g. Business Focus, Target Market..."
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Memory Value</label>
                  <textarea value={newValue} onChange={e => setNewValue(e.target.value)} placeholder="What should AI remember about this?"
                    rows={3}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Importance</label>
                    <ImportanceDots value={newImportance} onChange={setNewImportance} />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Source</label>
                    <select value={newSource} onChange={e => setNewSource(e.target.value as typeof newSource)}
                      className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary/40 transition-colors">
                      {Object.entries(SOURCE_CONFIG).map(([key, { label }]) => (
                        <option key={key} value={key}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <button onClick={handleCreate} disabled={!newKey || !newValue || saving}
                className="w-full rounded-xl bg-primary text-black py-2.5 text-sm font-black uppercase tracking-wider hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <><Sparkles className="h-4 w-4 animate-spin" />Saving...</> : <><Check className="h-4 w-4" />Save to Memory</>}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
