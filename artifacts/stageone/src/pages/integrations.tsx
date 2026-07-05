import { useState, useMemo, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Check, Plus, X, ExternalLink, Shield, Zap, Star, Info } from "lucide-react"
import { api } from "@/lib/api"
import stageoneIcon from "@/assets/stageone-icon.png"

interface Integration {
  id: string
  name: string
  description: string
  category: string
  tier: "free" | "pro"
  featured?: boolean
  color: string
  icon: string
}

const CATEGORIES = ["All", "CRM", "Payments", "Communication", "Analytics", "AI Services", "Automation", "Databases", "E-commerce"]

const INTEGRATIONS: Integration[] = [
  { id: "hubspot", name: "HubSpot", description: "CRM, marketing automation, and sales pipeline management", category: "CRM", tier: "free", featured: true, color: "#FF7A59", icon: "H" },
  { id: "salesforce", name: "Salesforce", description: "Enterprise CRM for sales, service, and marketing teams", category: "CRM", tier: "pro", featured: true, color: "#00A1E0", icon: "SF" },
  { id: "pipedrive", name: "Pipedrive", description: "Sales-focused CRM built for deal management", category: "CRM", tier: "free", color: "#007AFF", icon: "P" },
  { id: "stripe", name: "Stripe", description: "Accept payments, manage subscriptions, and handle billing", category: "Payments", tier: "free", featured: true, color: "#635BFF", icon: "S" },
  { id: "paypal", name: "PayPal", description: "Global payment processing and checkout experience", category: "Payments", tier: "free", color: "#003087", icon: "PP" },
  { id: "chargebee", name: "Chargebee", description: "Subscription billing and revenue management platform", category: "Payments", tier: "pro", color: "#007AFF", icon: "CB" },
  { id: "slack", name: "Slack", description: "Team messaging, channel alerts, and workflow notifications", category: "Communication", tier: "free", featured: true, color: "#4A154B", icon: "SL" },
  { id: "discord", name: "Discord", description: "Community platform with bot triggers and webhooks", category: "Communication", tier: "free", color: "#5865F2", icon: "D" },
  { id: "twilio", name: "Twilio", description: "SMS, voice, and WhatsApp messaging APIs", category: "Communication", tier: "pro", color: "#F22F46", icon: "T" },
  { id: "gmail", name: "Gmail", description: "Email automation, outreach, and transactional messages", category: "Communication", tier: "free", color: "#EA4335", icon: "G" },
  { id: "mixpanel", name: "Mixpanel", description: "Product analytics, user funnels, and event tracking", category: "Analytics", tier: "pro", color: "#7856FF", icon: "MX" },
  { id: "amplitude", name: "Amplitude", description: "Behavioral analytics and product intelligence platform", category: "Analytics", tier: "pro", color: "#1DA1F2", icon: "A" },
  { id: "segment", name: "Segment", description: "Customer data platform — collect, unify, and route data", category: "Analytics", tier: "pro", color: "#52BD95", icon: "SG" },
  { id: "openai", name: "OpenAI", description: "GPT models for generation, embeddings, and fine-tuning", category: "AI Services", tier: "pro", featured: true, color: "#10A37F", icon: "AI" },
  { id: "anthropic", name: "Anthropic Claude", description: "Claude models for reasoning, writing, and analysis", category: "AI Services", tier: "pro", color: "#CC785C", icon: "CL" },
  { id: "pinecone", name: "Pinecone", description: "Vector database for AI-powered search and retrieval", category: "AI Services", tier: "pro", color: "#1B4FFF", icon: "PC" },
  { id: "zapier", name: "Zapier", description: "Connect 5,000+ apps with no-code automation workflows", category: "Automation", tier: "free", featured: true, color: "#FF4A00", icon: "Z" },
  { id: "make", name: "Make", description: "Visual automation builder with advanced logic and routing", category: "Automation", tier: "free", color: "#6D00CC", icon: "M" },
  { id: "n8n", name: "n8n", description: "Self-hostable workflow automation with code flexibility", category: "Automation", tier: "free", color: "#EA4B71", icon: "N" },
  { id: "notion", name: "Notion", description: "Docs, wikis, databases, and project management", category: "Databases", tier: "free", featured: true, color: "#000000", icon: "NO" },
  { id: "airtable", name: "Airtable", description: "Flexible spreadsheet-database for structured business data", category: "Databases", tier: "free", color: "#FCB400", icon: "AT" },
  { id: "supabase", name: "Supabase", description: "PostgreSQL database with real-time subscriptions and auth", category: "Databases", tier: "free", color: "#3ECF8E", icon: "SB" },
  { id: "shopify", name: "Shopify", description: "E-commerce platform for product, order, and customer data", category: "E-commerce", tier: "pro", featured: true, color: "#96BF48", icon: "SH" },
  { id: "woocommerce", name: "WooCommerce", description: "WordPress-based e-commerce order and product sync", category: "E-commerce", tier: "free", color: "#7F54B3", icon: "WC" },
]

export default function IntegrationsPage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("All")
  const [connected, setConnected] = useState<Set<string>>(new Set())
  const [connecting, setConnecting] = useState<string | null>(null)
  const [detail, setDetail] = useState<Integration | null>(null)
  const [loadingIntegrations, setLoadingIntegrations] = useState(true)

  useEffect(() => {
    api.integrations.list()
      .then(d => {
        if (Array.isArray(d.integrations)) {
          setConnected(new Set(d.integrations.map(i => i.provider)))
        }
      })
      .catch(() => {})
      .finally(() => setLoadingIntegrations(false))
  }, [])

  const filtered = useMemo(() => INTEGRATIONS.filter(i => {
    const matchSearch = !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.description.toLowerCase().includes(search.toLowerCase())
    const matchCat = activeCategory === "All" || i.category === activeCategory
    return matchSearch && matchCat
  }), [search, activeCategory])

  const featured = useMemo(() => INTEGRATIONS.filter(i => i.featured), [])
  const connectedList = useMemo(() => INTEGRATIONS.filter(i => connected.has(i.id)), [connected])

  const toggleConnect = async (id: string) => {
    const intg = INTEGRATIONS.find(i => i.id === id)
    if (!intg) return

    if (connected.has(id)) {
      setConnected(prev => { const n = new Set(prev); n.delete(id); return n })
      api.integrations.disconnect(id).catch(() => {
        setConnected(prev => new Set([...prev, id]))
      })
      return
    }

    setConnecting(id)
    try {
      await api.integrations.connect(id, intg.name)
      setConnected(prev => new Set([...prev, id]))
    } catch {
      // silent fail — connection state stays unconnected
    } finally {
      setConnecting(null)
    }
  }

  return (
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Integrations</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">
                {loadingIntegrations ? "Loading..." : `${INTEGRATIONS.length} Available · ${connectedList.length} Connected`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[9px] font-black uppercase tracking-widest bg-amber-500/15 text-amber-400 border border-amber-500/25 px-2.5 py-1 rounded-full">Beta</span>
            {!loadingIntegrations && connectedList.length > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/8 px-3 py-1">
                <Check className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold text-primary">{connectedList.length} Active</span>
              </div>
            )}
          </div>
        </div>

        {/* Beta notice */}
        <div className="flex items-start gap-2.5 border-b border-white/5 bg-amber-500/4 px-6 py-2.5 shrink-0">
          <Info className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
          <p className="text-[10px] text-amber-400/80 leading-relaxed">
            Integration connections are saved to your account. Full OAuth flows and live data sync are on the roadmap — use the <strong>Webhooks</strong> page to receive real-time events from connected services today.
          </p>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Main */}
          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Search + filter */}
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search integrations..."
                  className="w-full rounded-xl border border-white/8 bg-white/3 pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => setActiveCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all border ${
                      activeCategory === cat
                        ? "bg-primary/12 border-primary/30 text-primary"
                        : "border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15"
                    }`}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Featured (only when All + no search) */}
            {activeCategory === "All" && !search && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Star className="h-3.5 w-3.5 text-primary" />
                  <h2 className="text-xs font-black text-foreground uppercase tracking-widest">Featured</h2>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {featured.map((intg, i) => (
                    <IntegrationCard key={intg.id} intg={intg} connected={connected.has(intg.id)}
                      connecting={connecting === intg.id}
                      onConnect={() => toggleConnect(intg.id)}
                      onDetail={() => setDetail(intg)}
                      delay={i * 0.05} />
                  ))}
                </div>
              </div>
            )}

            {/* All / filtered */}
            <div>
              {(activeCategory !== "All" || search) && (
                <div className="text-[10px] text-muted-foreground mb-3">{filtered.length} integration{filtered.length !== 1 ? "s" : ""} found</div>
              )}
              {activeCategory === "All" && !search && (
                <h2 className="text-xs font-black text-foreground uppercase tracking-widest mb-3">All Integrations</h2>
              )}
              <div className="grid grid-cols-3 gap-3">
                {filtered.map((intg, i) => (
                  <IntegrationCard key={intg.id} intg={intg} connected={connected.has(intg.id)}
                    connecting={connecting === intg.id}
                    onConnect={() => toggleConnect(intg.id)}
                    onDetail={() => setDetail(intg)}
                    delay={i * 0.03} />
                ))}
              </div>
              {!filtered.length && (
                <div className="text-center py-16 text-muted-foreground">
                  <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No integrations found for "{search}"</p>
                </div>
              )}
            </div>
          </div>

          {/* Connected sidebar */}
          <div className="w-60 shrink-0 border-l border-white/5 bg-[#070707] overflow-y-auto p-4 space-y-4">
            <div>
              <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">
                {loadingIntegrations ? "Loading..." : `Connected (${connectedList.length})`}
              </h3>
              {loadingIntegrations ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mt-4" />
              ) : connectedList.length === 0 ? (
                <p className="text-[10px] text-muted-foreground/50">No integrations connected yet</p>
              ) : (
                <div className="space-y-2">
                  {connectedList.map(intg => (
                    <div key={intg.id} className="flex items-center gap-2.5 rounded-xl border border-emerald-500/15 bg-emerald-500/5 px-3 py-2">
                      <div className="h-6 w-6 rounded-lg flex items-center justify-center text-[9px] font-black text-white shrink-0"
                        style={{ background: intg.color }}>
                        {intg.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-foreground truncate">{intg.name}</p>
                        <p className="text-[8px] text-emerald-400">Saved</p>
                      </div>
                      <button onClick={() => toggleConnect(intg.id)}
                        className="text-muted-foreground hover:text-rose-400 transition-colors">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-white/5 pt-4">
              <h3 className="text-[9px] font-black text-muted-foreground/50 uppercase tracking-widest mb-3">Summary</h3>
              <div className="space-y-2">
                {[
                  { label: "Connected", value: connectedList.length.toString() },
                  { label: "Available", value: INTEGRATIONS.length.toString() },
                  { label: "Live sync", value: "Via Webhooks" },
                  { label: "OAuth flows", value: "Roadmap" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between">
                    <span className="text-[10px] text-muted-foreground">{s.label}</span>
                    <span className="text-[10px] font-bold text-foreground">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {detail && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDetail(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 z-50 shadow-2xl space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl flex items-center justify-center text-sm font-black text-white"
                    style={{ background: detail.color }}>
                    {detail.icon}
                  </div>
                  <div>
                    <h3 className="text-base font-black text-foreground">{detail.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest">{detail.category}</span>
                      <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        detail.tier === "pro"
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-white/5 text-muted-foreground border-white/10"
                      }`}>{detail.tier}</span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setDetail(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{detail.description}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Auth Method", value: "OAuth 2.0" },
                  { label: "Live Sync", value: "Via Webhooks" },
                  { label: "Status", value: "Beta" },
                  { label: "Tier", value: detail.tier === "pro" ? "Pro" : "Free" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-white/8 bg-white/2 p-3">
                    <p className="text-[9px] text-muted-foreground">{s.label}</p>
                    <p className="text-xs font-bold text-foreground mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-amber-500/15 bg-amber-500/5 p-3">
                <p className="text-[10px] text-amber-400/80">Connecting saves this integration to your account. Full OAuth and live data sync coming in a future update.</p>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { toggleConnect(detail.id); setDetail(null) }}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-black uppercase tracking-wider transition-all ${
                    connected.has(detail.id)
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_rgba(212,175,55,0.2)]"
                  }`}>
                  {connected.has(detail.id) ? "Disconnect" : "Connect Integration"}
                </button>
                <button className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <ExternalLink className="h-3.5 w-3.5" />Docs
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
  )
}

function IntegrationCard({ intg, connected, connecting, onConnect, onDetail, delay }: {
  intg: Integration; connected: boolean; connecting: boolean
  onConnect: () => void; onDetail: () => void; delay: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className={`rounded-xl border bg-white/2 p-4 space-y-3 hover:border-white/15 transition-all cursor-pointer group
        ${connected ? "border-emerald-500/25" : "border-white/8"}`}
      onClick={onDetail}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center text-[10px] font-black text-white shrink-0"
            style={{ background: intg.color }}>
            {intg.icon}
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">{intg.name}</p>
            <p className="text-[9px] text-muted-foreground">{intg.category}</p>
          </div>
        </div>
        {connected && (
          <div className="flex items-center gap-1">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{intg.description}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          {intg.tier === "pro" && (
            <span className="text-[8px] font-black text-primary/70 uppercase tracking-wider border border-primary/20 px-1.5 py-0.5 rounded">PRO</span>
          )}
          {intg.tier === "free" && (
            <span className="text-[8px] font-black text-emerald-400/70 uppercase tracking-wider border border-emerald-500/20 px-1.5 py-0.5 rounded">FREE</span>
          )}
          <Shield className="h-2.5 w-2.5 text-muted-foreground/40" />
        </div>
        <button
          onClick={e => { e.stopPropagation(); onConnect() }}
          disabled={connecting}
          className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition-all ${
            connecting
              ? "bg-primary/10 text-primary/50 cursor-wait"
              : connected
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/20"
              : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
          }`}>
          {connecting ? (
            <Zap className="h-3 w-3 animate-spin" />
          ) : connected ? (
            <><Check className="h-3 w-3" />Connected</>
          ) : (
            <><Plus className="h-3 w-3" />Connect</>
          )}
        </button>
      </div>
    </motion.div>
  )
}
