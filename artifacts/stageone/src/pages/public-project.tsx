import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Link } from "wouter"
import {
  Globe, Sparkles, ArrowLeft, ArrowRight, Star, ExternalLink,
  BarChart3, TrendingUp, Users, DollarSign, Copy, Check, Share2
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"

interface PublicProjectData {
  id: string
  title: string
  businessIdea: string
  output: Record<string, unknown> | null
  websiteOutput: Record<string, unknown> | null
  isFeatured: boolean
  createdAt: string
}

interface Props { token: string }

export default function PublicProjectPage({ token }: Props) {
  const [project, setProject] = useState<PublicProjectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "website">("overview")

  useEffect(() => {
    fetch(`/api/share/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setProject(d.project))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [token])

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const output = project?.output as Record<string, unknown> | null

  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative mx-auto w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-ping" />
          <div className="absolute inset-0 flex items-center justify-center">
            <img src={stageoneIcon} alt="" className="h-8 w-8 object-contain" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Loading business blueprint...</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-center px-6">
      <Globe className="h-12 w-12 text-muted-foreground/20 mb-4" />
      <h1 className="text-xl font-black text-foreground mb-2">Project Not Found</h1>
      <p className="text-sm text-muted-foreground mb-6">This project may have been made private or the link has expired.</p>
      <Link href="/showcase" className="text-xs text-primary hover:underline">Browse public projects →</Link>
    </div>
  )

  if (!project) return null

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="border-b border-white/5 px-6 h-14 flex items-center justify-between sticky top-0 bg-[#050505]/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-4">
          <Link href="/showcase" className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-xs">
            <ArrowLeft className="h-3.5 w-3.5" />Showcase
          </Link>
          <div className="h-4 w-px bg-white/10" />
          <Link href="/" className="flex items-center gap-2">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <span className="text-sm font-black tracking-tight text-foreground">STAGEONE</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={copyLink}
            className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/2 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-all">
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? "Copied!" : "Share"}
          </button>
          <Link href="/signup"
            className="rounded-xl bg-primary text-black text-xs font-black px-4 py-2 hover:bg-primary/90 transition-all">
            Build Your Own
          </Link>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* Title */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-4">
            {project.isFeatured && (
              <div className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1">
                <Star className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-black text-primary">FEATURED</span>
              </div>
            )}
            <span className="text-[9px] text-muted-foreground/40">
              {new Date(project.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          </div>
          <h1 className="text-3xl font-black text-foreground mb-3">{project.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{project.businessIdea}</p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1 mb-6 w-fit">
          <button onClick={() => setActiveTab("overview")}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === "overview" ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
            }`}>Business Analysis</button>
          {project.websiteOutput && (
            <button onClick={() => setActiveTab("website")}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === "website" ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Globe className="h-3 w-3" />Website Preview
            </button>
          )}
        </div>

        {activeTab === "overview" && output && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* Key metrics */}
            {(output.metrics as Record<string, string> | undefined) && (
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(output.metrics as Record<string, string>).slice(0, 4).map(([key, value]) => (
                  <div key={key} className="rounded-2xl border border-white/8 bg-white/2 p-4">
                    <p className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">{key}</p>
                    <p className="text-sm font-black text-primary">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Sections */}
            {[
              { key: "executiveSummary", icon: Sparkles, label: "Executive Summary", color: "text-primary" },
              { key: "marketOpportunity", icon: TrendingUp, label: "Market Opportunity", color: "text-emerald-400" },
              { key: "competitiveAdvantage", icon: BarChart3, label: "Competitive Advantage", color: "text-blue-400" },
              { key: "growthStrategy", icon: ArrowRight, label: "Growth Strategy", color: "text-violet-400" },
              { key: "revenueModel", icon: DollarSign, label: "Revenue Model", color: "text-amber-400" },
              { key: "targetAudience", icon: Users, label: "Target Audience", color: "text-rose-400" },
            ].filter(s => output[s.key]).map(({ key, icon: Icon, label, color }, i) => (
              <motion.div key={key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`h-4 w-4 ${color}`} />
                  <h3 className="text-xs font-black text-foreground uppercase tracking-wider">{label}</h3>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {output[key] as string}
                </p>
              </motion.div>
            ))}
          </motion.div>
        )}

        {activeTab === "website" && project.websiteOutput && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="rounded-2xl border border-white/8 overflow-hidden" style={{ height: "70vh" }}>
            <div className="flex items-center gap-2 border-b border-white/5 bg-white/2 px-4 py-2">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-rose-400/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
              </div>
              <div className="flex-1 text-center">
                <span className="text-[10px] text-muted-foreground/40">{project.title} — Live Preview</span>
              </div>
            </div>
            <iframe
              srcDoc={generatePreviewHtml(project.websiteOutput as Record<string, unknown>)}
              className="w-full h-full border-0"
              title="Website Preview"
            />
          </motion.div>
        )}

        {/* CTA */}
        <div className="mt-12 rounded-2xl border border-primary/20 bg-primary/5 p-8 text-center">
          <h2 className="text-xl font-black text-foreground mb-2">Build your own AI business blueprint</h2>
          <p className="text-xs text-muted-foreground mb-5">Generate strategy, website, agents, and automation — all in minutes</p>
          <Link href="/signup"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-black text-sm font-black px-6 py-3 hover:bg-primary/90 transition-all">
            <Sparkles className="h-4 w-4" />Start for Free
          </Link>
        </div>
      </div>
    </div>
  )
}

function generatePreviewHtml(websiteOutput: Record<string, unknown>): string {
  const brand = (websiteOutput.brandVoice as string) ?? ""
  const colors = (websiteOutput.colorPalette as Record<string, string>) ?? {}
  const sections = (websiteOutput.sections as Record<string, unknown>[]) ?? []
  const primary = colors.primary ?? "#D4AF37"
  const bg = colors.background ?? "#050505"
  const text = colors.text ?? "#ffffff"

  const heroSection = sections.find((s: Record<string, unknown>) => s.type === "hero") as Record<string, unknown> | undefined
  const headline = (heroSection?.headline as string) ?? websiteOutput.businessName as string ?? "Business"
  const subtitle = (heroSection?.subheadline as string) ?? brand ?? ""

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${bg};color:${text};font-family:system-ui,sans-serif;overflow-x:hidden}
.hero{min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px 24px;background:radial-gradient(ellipse at center,${primary}15 0%,transparent 70%)}
h1{font-size:clamp(2rem,5vw,4rem);font-weight:900;margin-bottom:16px;line-height:1.1}
p{font-size:1.1rem;opacity:.7;max-width:500px;margin:0 auto 32px;line-height:1.6}
.btn{display:inline-block;background:${primary};color:#000;font-weight:900;padding:14px 32px;border-radius:12px;font-size:.875rem;text-decoration:none}
.accent{color:${primary}}
</style>
</head>
<body>
<div class="hero">
<div>
<div style="font-size:.75rem;font-weight:700;letter-spacing:.15em;opacity:.4;margin-bottom:12px;text-transform:uppercase">AI-Generated Website</div>
<h1>${headline}</h1>
<p>${subtitle}</p>
<a class="btn" href="#">Get Started</a>
</div>
</div>
</body>
</html>`
}
