import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search, Star, Download, Globe, Bot, Workflow, Users, BarChart3,
  Plus, X, Upload, Sparkles, Check, Eye, Copy,
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"

type TemplateType = "startup_website" | "ai_chatbot" | "automation_workflow" | "onboarding_system" | "crm_pipeline"

interface Template {
  id: string
  authorId?: string
  name: string
  description: string
  type: TemplateType
  category: string
  isPublic: boolean
  usageCount: number
  rating: number
  ratingCount: number
  tags?: string[]
  createdAt?: string
}

const MOCK_TEMPLATES: Template[] = [
  { id: "1", name: "SaaS Launch Kit", description: "Complete startup website with pricing, features, and CTA sections", type: "startup_website", category: "SaaS", isPublic: true, usageCount: 847, rating: 4.8, ratingCount: 124, tags: ["saas", "landing", "pricing"] },
  { id: "2", name: "E-commerce Store", description: "Full e-commerce template with product catalog, cart, and checkout flow", type: "startup_website", category: "E-commerce", isPublic: true, usageCount: 612, rating: 4.6, ratingCount: 89, tags: ["shop", "products", "ecom"] },
  { id: "3", name: "Agency Portfolio", description: "Creative agency portfolio with project showcase and contact forms", type: "startup_website", category: "Agency", isPublic: true, usageCount: 431, rating: 4.7, ratingCount: 67, tags: ["portfolio", "agency", "creative"] },
  { id: "4", name: "Customer Support Bot", description: "AI chatbot for handling support tickets and FAQs automatically", type: "ai_chatbot", category: "Support", isPublic: true, usageCount: 1203, rating: 4.9, ratingCount: 201, tags: ["support", "faq", "tickets"] },
  { id: "5", name: "Lead Qualifier", description: "Intelligent chatbot that qualifies leads and books sales calls", type: "ai_chatbot", category: "Sales", isPublic: true, usageCount: 776, rating: 4.5, ratingCount: 112, tags: ["leads", "sales", "booking"] },
  { id: "6", name: "HR Onboarding Flow", description: "Automate new employee onboarding from offer letter to day one", type: "automation_workflow", category: "HR", isPublic: true, usageCount: 389, rating: 4.4, ratingCount: 55, tags: ["hr", "employees", "onboarding"] },
  { id: "7", name: "Lead Nurture Sequence", description: "Multi-step email and follow-up automation for inbound leads", type: "automation_workflow", category: "Marketing", isPublic: true, usageCount: 954, rating: 4.7, ratingCount: 143, tags: ["email", "leads", "nurture"] },
  { id: "8", name: "SaaS Onboarding", description: "User onboarding system with progress tracking and feature tours", type: "onboarding_system", category: "SaaS", isPublic: true, usageCount: 562, rating: 4.6, ratingCount: 78, tags: ["saas", "users", "activation"] },
  { id: "9", name: "B2B Sales CRM", description: "Full CRM pipeline for B2B sales with deal stages and forecasting", type: "crm_pipeline", category: "Sales", isPublic: true, usageCount: 721, rating: 4.8, ratingCount: 97, tags: ["crm", "b2b", "pipeline"] },
  { id: "10", name: "Influencer Outreach", description: "CRM pipeline for managing influencer relationships and campaigns", type: "crm_pipeline", category: "Marketing", isPublic: true, usageCount: 298, rating: 4.3, ratingCount: 41, tags: ["influencer", "marketing", "outreach"] },
]

const TYPE_CONFIG: Record<TemplateType, { label: string; icon: React.ElementType; color: string }> = {
  startup_website: { label: "Startup Website", icon: Globe, color: "#6366F1" },
  ai_chatbot: { label: "AI Chatbot", icon: Bot, color: "#8B5CF6" },
  automation_workflow: { label: "Automation Workflow", icon: Workflow, color: "#10B981" },
  onboarding_system: { label: "Onboarding System", icon: Users, color: "#F59E0B" },
  crm_pipeline: { label: "CRM Pipeline", icon: BarChart3, color: "#3B82F6" },
}

const CATEGORIES = ["All", "Startup Website", "AI Chatbot", "Automation Workflow", "Onboarding System", "CRM Pipeline"]

export default function TemplatesMarketplacePage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [sortBy, setSortBy] = useState<"popular" | "rating" | "newest">("popular")
  const [templates, setTemplates] = useState<Template[]>(MOCK_TEMPLATES)
  const [myTemplates, setMyTemplates] = useState<Template[]>([])
  const [installed, setInstalled] = useState<Set<string>>(new Set())
  const [installing, setInstalling] = useState<string | null>(null)
  const [detail, setDetail] = useState<Template | null>(null)
  const [activeTab, setActiveTab] = useState<"marketplace" | "mine">("marketplace")
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [newType, setNewType] = useState<TemplateType>("startup_website")

  useEffect(() => {
    fetch("/api/templates/marketplace", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.templates?.length) setTemplates(d.templates) })
      .catch(() => {})
    fetch("/api/templates", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.templates) setMyTemplates(d.templates) })
      .catch(() => {})
  }, [])

  const filtered = useMemo(() => {
    let list = templates
    if (search) list = list.filter(t => t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase()))
    const catMap: Record<string, TemplateType> = { "Startup Website": "startup_website", "AI Chatbot": "ai_chatbot", "Automation Workflow": "automation_workflow", "Onboarding System": "onboarding_system", "CRM Pipeline": "crm_pipeline" }
    if (activeCategory !== "All") list = list.filter(t => t.type === catMap[activeCategory])
    if (sortBy === "popular") list = [...list].sort((a, b) => b.usageCount - a.usageCount)
    if (sortBy === "rating") list = [...list].sort((a, b) => b.rating - a.rating)
    return list
  }, [templates, search, activeCategory, sortBy])

  const handleInstall = async (id: string) => {
    setInstalling(id)
    try {
      await fetch(`/api/templates/${id}/install`, { method: "POST", credentials: "include" })
      setInstalled(prev => new Set([...prev, id]))
      setTemplates(prev => prev.map(t => t.id === id ? { ...t, usageCount: t.usageCount + 1 } : t))
    } catch (_) {
      setInstalled(prev => new Set([...prev, id]))
    }
    setTimeout(() => setInstalling(null), 800)
  }

  const handleCreate = async () => {
    if (!newName || !newDesc) return
    try {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName, description: newDesc, type: newType, category: "Custom", content: {}, isPublic: false }),
      })
      const data = await res.json()
      if (data.template) setMyTemplates(prev => [data.template, ...prev])
    } catch (_) {}
    setShowCreate(false)
    setNewName("")
    setNewDesc("")
    setActiveTab("mine")
  }

  return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Template Marketplace</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">{templates.length} Templates Available</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-1.5 rounded-xl bg-primary text-black text-xs font-black px-3 py-2 hover:bg-primary/90 transition-all">
              <Plus className="h-3.5 w-3.5" />New Template
            </button>
            <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
              {(["marketplace", "mine"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    activeTab === tab ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
                  }`}>{tab === "mine" ? "My Templates" : "Marketplace"}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === "marketplace" && (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
                <div className="flex gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setActiveCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                        activeCategory === cat ? "bg-primary/12 border-primary/30 text-primary" : "border-white/8 text-muted-foreground hover:text-foreground"
                      }`}>{cat}</button>
                  ))}
                </div>
                <div className="ml-auto flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
                  {(["popular", "rating", "newest"] as const).map(s => (
                    <button key={s} onClick={() => setSortBy(s)}
                      className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all ${
                        sortBy === s ? "bg-white/8 text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}>{s}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                {filtered.map((t, i) => {
                  const config = TYPE_CONFIG[t.type]
                  const Icon = config.icon
                  const isInstalled = installed.has(t.id)
                  const isInstalling = installing === t.id
                  return (
                    <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-3 hover:border-white/15 transition-all cursor-pointer group"
                      onClick={() => setDetail(t)}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2 rounded-xl" style={{ background: `${config.color}15` }}>
                            <Icon className="h-4 w-4" style={{ color: config.color }} />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{t.name}</p>
                            <p className="text-[9px] text-muted-foreground">{config.label}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-primary font-bold">
                          <Star className="h-3 w-3 fill-primary" />{t.rating.toFixed(1)}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{t.description}</p>
                      {t.tags && t.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {t.tags.slice(0, 3).map(tag => (
                            <span key={tag} className="text-[8px] font-semibold text-muted-foreground border border-white/8 px-1.5 py-0.5 rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <Download className="h-3 w-3" />{t.usageCount.toLocaleString()} installs
                        </div>
                        <button
                          onClick={e => { e.stopPropagation(); handleInstall(t.id) }}
                          disabled={isInstalled || isInstalling}
                          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all ${
                            isInstalled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : isInstalling ? "bg-primary/10 text-primary/50 cursor-wait"
                            : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                          }`}>
                          {isInstalling ? <Sparkles className="h-3 w-3 animate-spin" />
                          : isInstalled ? <><Check className="h-3 w-3" />Installed</>
                          : <><Download className="h-3 w-3" />Install</>}
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </>
          )}

          {activeTab === "mine" && (
            <div className="space-y-3">
              {myTemplates.length === 0 ? (
                <div className="text-center py-20">
                  <Copy className="h-10 w-10 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-sm font-bold text-foreground/60">No templates yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Create your first template to save and reuse AI-generated content</p>
                  <button onClick={() => setShowCreate(true)}
                    className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-primary text-black text-xs font-black px-4 py-2 hover:bg-primary/90 transition-all">
                    <Plus className="h-3.5 w-3.5" />Create Template
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  {myTemplates.map((t, i) => {
                    const config = TYPE_CONFIG[t.type]
                    const Icon = config.icon
                    return (
                      <motion.div key={t.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                        className="rounded-xl border border-white/8 bg-white/2 p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl" style={{ background: `${config.color}15` }}>
                              <Icon className="h-4 w-4" style={{ color: config.color }} />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-foreground">{t.name}</p>
                              <p className="text-[9px] text-muted-foreground">{config.label}</p>
                            </div>
                          </div>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${
                            t.isPublic ? "text-emerald-400 border-emerald-500/20 bg-emerald-500/8" : "text-muted-foreground border-white/10"
                          }`}>{t.isPublic ? "Public" : "Private"}</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground line-clamp-2">{t.description}</p>
                        <div className="flex items-center gap-2">
                          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                            <Eye className="h-3 w-3" />Preview
                          </button>
                          <button className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors ml-auto">
                            <Upload className="h-3 w-3" />Publish
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

      <AnimatePresence>
        {detail && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetail(null)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 z-50 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {(() => { const config = TYPE_CONFIG[detail.type]; const Icon = config.icon; return (
                    <div className="p-3 rounded-xl" style={{ background: `${config.color}15` }}>
                      <Icon className="h-5 w-5" style={{ color: config.color }} />
                    </div>
                  ) })()}
                  <div>
                    <h3 className="text-base font-black text-foreground">{detail.name}</h3>
                    <p className="text-[10px] text-muted-foreground">{TYPE_CONFIG[detail.type].label}</p>
                  </div>
                </div>
                <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{detail.description}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/8 bg-white/2 p-3 text-center">
                  <p className="text-lg font-black text-foreground">{detail.rating.toFixed(1)}</p>
                  <div className="flex items-center justify-center gap-1 mt-0.5">
                    {[1,2,3,4,5].map(s => <Star key={s} className={`h-2.5 w-2.5 ${s <= Math.round(detail.rating) ? "fill-primary text-primary" : "text-muted-foreground"}`} />)}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1">{detail.ratingCount} reviews</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/2 p-3 text-center">
                  <p className="text-lg font-black text-foreground">{detail.usageCount.toLocaleString()}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Total installs</p>
                </div>
                <div className="rounded-xl border border-white/8 bg-white/2 p-3 text-center">
                  <p className="text-lg font-black text-foreground capitalize">{detail.category}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Category</p>
                </div>
              </div>
              {detail.tags && detail.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {detail.tags.map(tag => (
                    <span key={tag} className="text-[10px] font-semibold text-muted-foreground border border-white/8 px-2 py-1 rounded-lg">#{tag}</span>
                  ))}
                </div>
              )}
              <button onClick={() => { handleInstall(detail.id); setDetail(null) }}
                disabled={installed.has(detail.id)}
                className={`w-full rounded-xl py-2.5 text-sm font-black uppercase tracking-wider transition-all ${
                  installed.has(detail.id) ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-primary text-black hover:bg-primary/90"
                }`}>
                {installed.has(detail.id) ? "✓ Installed" : "Install Template"}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreate && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowCreate(false)} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 z-50 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-foreground">Create Template</h3>
                <button onClick={() => setShowCreate(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Template Name</label>
                  <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Awesome Template"
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Description</label>
                  <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What does this template do?"
                    rows={3}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors resize-none" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-1.5">Type</label>
                  <select value={newType} onChange={e => setNewType(e.target.value as TemplateType)}
                    className="w-full rounded-xl border border-white/8 bg-white/3 px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary/40 transition-colors">
                    {Object.entries(TYPE_CONFIG).map(([key, { label }]) => (
                      <option key={key} value={key}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <button onClick={handleCreate}
                className="w-full rounded-xl bg-primary text-black py-2.5 text-sm font-black uppercase tracking-wider hover:bg-primary/90 transition-all">
                Create Template
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  )
}
