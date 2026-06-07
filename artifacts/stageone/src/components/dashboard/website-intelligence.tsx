import { useState, useMemo, useCallback, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Target, TrendingUp, Layers, Star, Smartphone, Zap, MessageSquare,
  Brain, ChevronDown, Loader2, RefreshCw, ArrowRight,
  AlertCircle, Activity, Sparkles, CheckCircle2,
} from "lucide-react"
import { type WebsiteOutput } from "@/lib/website-html-generator"
import { type BusinessIntelligence } from "./output-panel"

// ─── Types ─────────────────────────────────────────────────────────────────────

type CategoryId = "conversion" | "seo" | "ux" | "brand" | "mobile" | "performance" | "content"

interface Rec {
  priority: "critical" | "high" | "medium" | "low"
  title: string
  description: string
  action: string
}

interface CategoryData {
  score: number
  grade: string
  summary: string
  recommendations: Rec[]
}

interface Report {
  overallScore: number
  overallGrade: string
  overallSummary: string
  topPriorities: string[]
  categories: Record<CategoryId, CategoryData>
}

interface Props {
  data: WebsiteOutput
  businessIdea: string
  businessIntelligence: BusinessIntelligence | null
  autoRunSignal?: number
}

// ─── Category metadata ─────────────────────────────────────────────────────────

const CATS: Array<{ id: CategoryId; label: string; Icon: React.FC<{ className?: string }> }> = [
  { id: "conversion", label: "Conversion", Icon: Target },
  { id: "seo", label: "SEO Health", Icon: TrendingUp },
  { id: "ux", label: "UX Quality", Icon: Layers },
  { id: "brand", label: "Brand", Icon: Star },
  { id: "mobile", label: "Mobile", Icon: Smartphone },
  { id: "performance", label: "Performance", Icon: Zap },
  { id: "content", label: "Content", Icon: MessageSquare },
]

// ─── Helpers ───────────────────────────────────────────────────────────────────

function toGrade(s: number): string {
  if (s >= 95) return "A+"
  if (s >= 90) return "A"
  if (s >= 87) return "A-"
  if (s >= 83) return "B+"
  if (s >= 80) return "B"
  if (s >= 77) return "B-"
  if (s >= 73) return "C+"
  if (s >= 70) return "C"
  if (s >= 65) return "C-"
  return "D"
}

function scoreColor(s: number): string {
  if (s >= 80) return "#4ade80"
  if (s >= 65) return "#facc15"
  return "#f87171"
}

function PriorityBadge({ priority }: { priority: string }) {
  const cls = {
    critical: "text-red-400 border-red-500/25 bg-red-500/10",
    high: "text-orange-400 border-orange-500/25 bg-orange-500/10",
    medium: "text-yellow-400 border-yellow-500/25 bg-yellow-500/10",
    low: "text-blue-400 border-blue-500/25 bg-blue-500/10",
  }[priority] ?? "text-muted-foreground border-border/40 bg-secondary/20"
  return (
    <span className={`text-[8px] font-bold uppercase tracking-wide border rounded px-1 py-0.5 ${cls}`}>
      {priority}
    </span>
  )
}

// ─── Algorithmic baseline scoring ──────────────────────────────────────────────

function computeBaseline(data: WebsiteOutput): Record<CategoryId, number> {
  const s = data.sections
  const c = data.colorPalette
  const t = data.typography
  const b = data.brand
  const d = data.design
  const m = data.seoMeta as Record<string, unknown> | undefined
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)))
  const animCount = (d?.animations ?? []).length

  // Conversion
  let conv = 28
  if (s.hero?.badge) conv += 8
  if ((s.hero?.stats ?? []).length >= 2) conv += 12
  if ((s.hero?.trustedBy ?? []).length >= 2) conv += 10
  if (s.hero?.ctaPrimary) conv += 7
  if (s.hero?.socialProof) conv += 6
  if ((s.pricing?.tiers ?? []).some((t: any) => t.highlighted)) conv += 10
  if ((s.testimonials?.items ?? []).length >= 3) conv += 11
  if (s.cta?.headline) conv += 7
  if ((s.howItWorks?.steps ?? []).length >= 3) conv += 8
  if ((s.faq?.items ?? []).length >= 3) conv += 3

  // SEO
  let seo = 18
  const title = (m?.title as string) ?? ""
  const desc = (m?.description as string) ?? ""
  if (title.length >= 30 && title.length <= 65) seo += 18; else if (title.length > 0) seo += 6
  if (desc.length >= 100 && desc.length <= 165) seo += 18; else if (desc.length > 0) seo += 6
  if (((m?.keywords as string[]) ?? []).length >= 3) seo += 14
  if ((s.features?.items ?? []).length >= 4) seo += 13
  if ((s.faq?.items ?? []).length >= 4) seo += 12
  if (s.hero?.headline) seo += 4

  // UX
  let ux = 20
  if ((s.howItWorks?.steps ?? []).length >= 3) ux += 22
  if ((s.testimonials?.items ?? []).length >= 3) ux += 15
  if ((s.features?.items ?? []).length >= 5) ux += 13
  if ((s.pricing?.tiers ?? []).length >= 3) ux += 12
  if ((s.faq?.items ?? []).length >= 4) ux += 11
  if ((s.nav?.links ?? []).length >= 4) ux += 7

  // Brand
  let brand = 18
  if (c?.primary) brand += 13
  if (c?.secondary) brand += 10
  if (c?.accent) brand += 8
  if (t?.headingFont) brand += 15
  if (t?.bodyFont) brand += 12
  if (b?.voice) brand += 10
  if (b?.tagline?.length ?? 0 > 5) brand += 10
  if (d?.style) brand += 4

  // Mobile (responsive HTML generator gives high baseline)
  let mobile = 68
  if (animCount > 5) mobile -= 8
  if ((s.features?.items ?? []).length > 8) mobile -= 5
  if (d?.glassmorphism) mobile += 4

  // Performance
  let perf = 78
  if (animCount > 4) perf -= 7
  if ((s.features?.items ?? []).length > 8) perf -= 5
  if (d?.glassmorphism) perf -= 6

  // Content
  let content = 18
  const heroWords = (s.hero?.subheadline ?? "").split(" ").length
  if (heroWords >= 8 && heroWords <= 25) content += 15; else if (heroWords > 0) content += 5
  const feats = (s.features?.items ?? []) as Array<{ description?: string }>
  if (feats.length && feats.every(f => (f.description ?? "").length > 20)) content += 18
  const tmons = (s.testimonials?.items ?? []) as Array<{ metric?: string | null }>
  if (tmons.some(t => t.metric)) content += 18
  if ((s.faq?.items ?? []).length >= 4) content += 14
  if ((s.hero?.socialProof ?? "").length > 10) content += 12
  if ((s.pricing?.tiers ?? []).every((t: any) => (t.description ?? "").length > 10)) content += 5

  return {
    conversion: clamp(conv), seo: clamp(seo), ux: clamp(ux), brand: clamp(brand),
    mobile: clamp(mobile), performance: clamp(perf), content: clamp(content),
  }
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function WebsiteIntelligence({ data, businessIdea, businessIntelligence, autoRunSignal }: Props) {
  const baselineScores = useMemo(() => computeBaseline(data), [data])
  const [report, setReport] = useState<Report | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [streamText, setStreamText] = useState("")
  const [expandedCat, setExpandedCat] = useState<CategoryId | null>(null)
  const [error, setError] = useState<string | null>(null)
  const prevSignalRef = useRef(0)

  const scores: Record<CategoryId, number> = report
    ? Object.fromEntries(CATS.map(c => [c.id, report.categories[c.id]?.score ?? baselineScores[c.id]])) as Record<CategoryId, number>
    : baselineScores

  const overallScore = report?.overallScore
    ?? Math.round(Object.values(baselineScores).reduce((a, b) => a + b, 0) / CATS.length)
  const overallGrade = report?.overallGrade ?? toGrade(overallScore)

  const runAnalysis = useCallback(async () => {
    if (isAnalyzing) return
    setIsAnalyzing(true)
    setError(null)
    setStreamText("")

    try {
      const res = await fetch("/api/generate/website/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ websiteData: data, businessIdea, businessIntelligence }),
      })
      if (!res.ok) throw new Error("Analysis request failed")
      const reader = res.body?.getReader()
      if (!reader) throw new Error("No stream")
      const decoder = new TextDecoder()
      let carry = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const p = JSON.parse(line.slice(6).trim())
            if (p.content) setStreamText(prev => (prev + p.content).slice(-200))
            if (p.done && p.report) {
              setReport(p.report as Report)
              setExpandedCat(null)
            }
            if (p.error) throw new Error(p.error)
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }
      reader.releaseLock()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed")
    } finally {
      setIsAnalyzing(false)
      setStreamText("")
    }
  }, [data, businessIdea, businessIntelligence, isAnalyzing])

  // Auto-run when signal increments (triggered from toolbar or post-generation banner)
  useEffect(() => {
    if (!autoRunSignal || autoRunSignal === prevSignalRef.current) return
    prevSignalRef.current = autoRunSignal
    if (!isAnalyzing) runAnalysis()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRunSignal])

  return (
    <div className="space-y-3">

      {/* ── Overall Health Score ──────────────────────────────── */}
      <div className="rounded-xl border border-border/40 bg-secondary/10 overflow-hidden">
        <div className="px-3 py-2 border-b border-border/40 flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Website Health Score</span>
          {report && (
            <span className="ml-auto text-[9px] border border-green-500/20 bg-green-500/10 text-green-400 rounded px-1.5 py-0.5 font-semibold">
              AI ANALYZED
            </span>
          )}
        </div>
        <div className="p-3 flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <svg width="72" height="72" className="-rotate-90">
              <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
              <motion.circle
                cx="36" cy="36" r="28" fill="none"
                stroke={scoreColor(overallScore)} strokeWidth="5" strokeLinecap="round"
                strokeDasharray={175.9}
                initial={{ strokeDashoffset: 175.9 }}
                animate={{ strokeDashoffset: 175.9 * (1 - overallScore / 100) }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xl font-bold" style={{ color: scoreColor(overallScore) }}>{overallGrade}</span>
              <span className="text-[9px] text-muted-foreground font-mono">{overallScore}/100</span>
            </div>
          </div>
          <div className="flex-1 min-w-0">
            {report ? (
              <>
                <p className="text-xs font-semibold text-foreground mb-1">AI Analysis Complete</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{report.overallSummary}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-semibold text-foreground mb-1">Structural Baseline</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Scores computed from website structure. Run AI Analysis for deep recommendations and specific fixes.
                </p>
              </>
            )}
          </div>
        </div>

        {(report?.topPriorities ?? []).length > 0 && (
          <div className="px-3 pb-3 space-y-1.5 border-t border-border/30 pt-2">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Top Priorities</p>
            {report!.topPriorities.map((p, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-start gap-1.5"
              >
                <ArrowRight className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-foreground leading-relaxed">{p}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* ── Run Analysis CTA ──────────────────────────────────── */}
      {!report && !isAnalyzing && (
        <motion.button
          onClick={runAnalysis}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-xs hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <Brain className="h-3.5 w-3.5" />
          Run AI Intelligence Analysis
          <Sparkles className="h-3 w-3 opacity-70" />
        </motion.button>
      )}

      {isAnalyzing && (
        <div className="flex flex-col items-center gap-2 py-4">
          <motion.div
            className="h-12 w-12 rounded-2xl border border-primary/30 bg-primary/5 flex items-center justify-center"
            animate={{ boxShadow: ["0 0 10px rgba(212,175,55,0.1)", "0 0 35px rgba(212,175,55,0.35)", "0 0 10px rgba(212,175,55,0.1)"] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          >
            <Loader2 className="h-5 w-5 text-primary animate-spin" />
          </motion.div>
          <div className="text-center">
            <p className="text-[10px] font-semibold text-foreground">Analyzing website intelligence…</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">Conversion · SEO · UX · Brand · Mobile · Performance · Content</p>
          </div>
          {streamText && (
            <div className="w-full rounded-lg border border-border/40 bg-black/30 p-2 overflow-hidden">
              <p className="font-mono text-[9px] text-green-400/70 leading-relaxed">{streamText}</p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-500/20 bg-red-500/5">
          <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
          <p className="text-[10px] text-red-400">{error}</p>
        </div>
      )}

      {/* ── Category scores ───────────────────────────────────── */}
      <div className="border border-border/40 rounded-xl overflow-hidden">
        <div className="px-3 py-2 border-b border-border/40 bg-secondary/10 flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">
            {report ? "AI Intelligence Analysis" : "AI UX Predictions"}
          </p>
          <p className="text-[9px] text-muted-foreground italic">
            {report ? "Click category to expand" : "Structural analysis"}
          </p>
        </div>

        <div className="divide-y divide-border/25">
          {CATS.map(({ id, label, Icon }) => {
            const sc = scores[id]
            const cat = report?.categories[id]
            const hasRecs = (cat?.recommendations ?? []).length > 0
            const isOpen = expandedCat === id

            return (
              <div key={id}>
                <button
                  onClick={() => hasRecs ? setExpandedCat(isOpen ? null : id) : undefined}
                  className={`w-full px-3 py-2.5 flex items-center gap-2.5 transition-colors ${hasRecs ? "hover:bg-secondary/20 cursor-pointer" : "cursor-default"}`}
                >
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-semibold text-foreground">{label}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: scoreColor(sc) }}>
                          {sc}
                        </span>
                        {hasRecs && (
                          <ChevronDown className={`h-3 w-3 text-muted-foreground/60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </div>
                    <div className="h-1 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, ${scoreColor(sc)}aa, ${scoreColor(sc)})` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${sc}%` }}
                        transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
                      />
                    </div>
                    {cat?.summary && (
                      <p className="text-[9px] text-muted-foreground mt-1 leading-relaxed">{cat.summary}</p>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isOpen && cat && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="px-3 pb-3 pt-2 space-y-2.5 border-t border-border/30 bg-secondary/5">
                        {cat.recommendations.map((rec, i) => (
                          <motion.div key={i}
                            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className="space-y-1.5"
                          >
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <PriorityBadge priority={rec.priority} />
                              <span className="text-[10px] font-semibold text-foreground leading-snug">{rec.title}</span>
                            </div>
                            <p className="text-[9px] text-muted-foreground leading-relaxed">{rec.description}</p>
                            <div className="flex items-start gap-1.5 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                              <ArrowRight className="h-2.5 w-2.5 text-primary mt-0.5 shrink-0" />
                              <p className="text-[9px] text-primary leading-relaxed">{rec.action}</p>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Category summary grid (after analysis) ───────────── */}
      {report && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-1.5"
        >
          {[
            { label: "Strengths", value: CATS.filter(c => (scores[c.id] ?? 0) >= 80).length.toString(), color: "text-green-400" },
            { label: "Needs Work", value: CATS.filter(c => (scores[c.id] ?? 0) < 65).length.toString(), color: "text-red-400" },
            { label: "Recommendations", value: Object.values(report.categories).reduce((sum, cat) => sum + (cat.recommendations?.length ?? 0), 0).toString(), color: "text-primary" },
            { label: "Analyzed", value: "7 cats", color: "text-muted-foreground" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg bg-secondary/20 border border-border/30 p-2 text-center">
              <p className={`text-base font-bold ${color}`}>{value}</p>
              <p className="text-[9px] text-muted-foreground mt-0.5">{label}</p>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Disclaimer ────────────────────────────────────────── */}
      <div className="flex items-start gap-1.5 px-2.5 py-2 rounded-lg border border-border/30 bg-secondary/5">
        <CheckCircle2 className="h-3 w-3 text-muted-foreground/60 shrink-0 mt-0.5" />
        <p className="text-[9px] text-muted-foreground leading-relaxed">
          Scores are structural predictions based on website content and UX principles, not real analytics. All recommendations are explainable and grounded in conversion best practices.
        </p>
      </div>

      {/* ── Re-analyze ───────────────────────────────────────── */}
      {report && !isAnalyzing && (
        <button onClick={runAnalysis}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
        >
          <RefreshCw className="h-3 w-3" />Re-analyze
        </button>
      )}
    </div>
  )
}
