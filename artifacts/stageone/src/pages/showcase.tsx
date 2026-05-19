import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Link } from "wouter"
import {
  Globe, Sparkles, Star, ArrowRight, Search,
  TrendingUp, Rocket, ExternalLink, Clock
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"

interface ShowcaseProject {
  id: string
  title: string
  businessIdea: string
  shareToken: string
  isFeatured: boolean
  hasWebsite: boolean
  createdAt: string
}

const CATEGORIES = ["All", "Featured", "With Website", "Recent"]

export default function ShowcasePage() {
  const [projects, setProjects] = useState<ShowcaseProject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("All")

  useEffect(() => {
    fetch("/api/showcase")
      .then(r => r.json())
      .then(d => setProjects(d.projects ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.businessIdea.toLowerCase().includes(search.toLowerCase())
    const matchCat = category === "All" ||
      (category === "Featured" && p.isFeatured) ||
      (category === "With Website" && p.hasWebsite) ||
      (category === "Recent")
    return matchSearch && matchCat
  })

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-6 h-14 flex items-center justify-between sticky top-0 bg-[#050505]/90 backdrop-blur-sm z-10">
        <Link href="/" className="flex items-center gap-2.5">
          <img src={stageoneIcon} alt="" className="h-7 w-7 object-contain" />
          <span className="text-sm font-black tracking-tight text-foreground">STAGEONE</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">Sign in</Link>
          <Link href="/signup"
            className="rounded-xl bg-primary text-black text-xs font-black px-4 py-2 hover:bg-primary/90 transition-all">
            Get Started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="px-6 pt-16 pb-10 text-center max-w-3xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-[10px] font-bold text-primary uppercase tracking-widest mb-6">
            <Sparkles className="h-3 w-3" />Community Showcase
          </div>
          <h1 className="text-4xl font-black text-foreground mb-4 leading-tight">
            AI-Powered Businesses<br />Built with STAGEONE
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Browse real business intelligence reports, websites, and AI strategies created by the STAGEONE community.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="mt-8 relative max-w-md mx-auto">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search businesses, ideas..."
            className="w-full rounded-2xl border border-white/8 bg-white/3 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/30 transition-colors"
          />
        </motion.div>
      </div>

      {/* Stats */}
      <div className="px-6 pb-8 max-w-5xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Rocket, label: "Projects Published", value: projects.length.toString() },
            { icon: TrendingUp, label: "With AI Websites", value: projects.filter(p => p.hasWebsite).length.toString() },
            { icon: Star, label: "Featured Projects", value: projects.filter(p => p.isFeatured).length.toString() },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-2xl border border-white/8 bg-white/2 p-4 text-center">
              <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-black text-foreground">{value}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 pb-6 max-w-5xl mx-auto">
        <div className="flex gap-2">
          {CATEGORIES.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)}
              className={`rounded-xl border px-4 py-1.5 text-xs font-semibold transition-all ${
                category === cat
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-white/8 text-muted-foreground hover:text-foreground"
              }`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 pb-20 max-w-5xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-white/5 bg-white/2 h-48 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground/20" />
            <p className="text-sm font-bold text-foreground/50">No public projects yet</p>
            <p className="text-xs text-muted-foreground mt-1">Be the first to share your business blueprint</p>
            <Link href="/signup"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary text-black text-xs font-black px-5 py-2.5 hover:bg-primary/90 transition-all">
              <Sparkles className="h-3.5 w-3.5" />Start Building
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((project, i) => (
              <motion.div key={project.id}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/p/${project.shareToken}`}
                  className="block rounded-2xl border border-white/8 bg-white/2 p-5 hover:border-primary/25 hover:bg-white/4 transition-all group">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {project.isFeatured && (
                        <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5">
                          <Star className="h-2.5 w-2.5 text-primary" />
                          <span className="text-[8px] font-black text-primary">FEATURED</span>
                        </div>
                      )}
                      {project.hasWebsite && (
                        <div className="flex items-center gap-1 rounded-full border border-blue-400/30 bg-blue-400/10 px-2 py-0.5">
                          <Globe className="h-2.5 w-2.5 text-blue-400" />
                          <span className="text-[8px] font-black text-blue-400">WEBSITE</span>
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary/60 transition-colors" />
                  </div>
                  <h3 className="text-sm font-black text-foreground mb-1.5 line-clamp-2">{project.title}</h3>
                  <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">{project.businessIdea}</p>
                  <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-white/5">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground/40" />
                    <span className="text-[9px] text-muted-foreground/40">
                      {new Date(project.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="border-t border-white/5 px-6 py-16 text-center">
        <h2 className="text-2xl font-black text-foreground mb-3">Ready to build your AI-powered business?</h2>
        <p className="text-sm text-muted-foreground mb-6">Join thousands using STAGEONE to generate strategy, websites, and automation</p>
        <Link href="/signup"
          className="inline-flex items-center gap-2 rounded-2xl bg-primary text-black text-sm font-black px-8 py-3.5 hover:bg-primary/90 transition-all shadow-[0_0_30px_rgba(212,175,55,0.3)]">
          <Sparkles className="h-4 w-4" />Start for Free
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}
