import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useWorkspaceController } from "@/lib/workspace-controller-context"
import { useLang } from "@/lib/i18n"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe, Palette, Sparkles, Loader2, Monitor, Smartphone,
  RefreshCw, Download, Copy, Check, Code2, Pencil, X,
  Layers, Zap, DollarSign, HelpCircle, MessageSquare, ArrowRight,
  Brain, Target, Users, TrendingUp, Shield, Wand2, ChevronRight,
  Tablet, PanelLeft, ExternalLink, RotateCcw, FileCode, CheckCircle2,
  Lightbulb, Settings2, Layout,
} from "lucide-react"
import { type BusinessIntelligence } from "./output-panel"
import { api } from "@/lib/api"
import { buildPreviewHtml, buildNextjsProject, type WebsiteOutput } from "@/lib/website-html-generator"
import { WebsiteIntelligence } from "./website-intelligence"
import JSZip from "jszip"

// ─── Types ─────────────────────────────────────────────────────────────────────

interface WebsitePanelProps {
  businessIdea: string
  businessIntelligence: BusinessIntelligence | null
  projectId: string | null
  existingOutput?: Record<string, unknown> | null
  onSaved?: (data: Record<string, unknown>) => void
  autoGenerate?: boolean
}

type SidebarTab = "design" | "edit" | "export" | "strategy" | "intelligence"
type Viewport = "desktop" | "tablet" | "mobile"
type StrategyMode = "plg" | "enterprise" | "high-touch" | "community"

interface OptimizationIssue {
  category: string; severity: "critical" | "high" | "medium"
  section: string; issue: string; why: string; fix: string; impact: string
}
interface OptimizationResult {
  score: number; grade: string; summary: string; strengths: string[]; issues: OptimizationIssue[]
}

const STRATEGIES = [
  { id: "plg" as StrategyMode, label: "Product-Led Growth", desc: "Free trial, self-serve, low friction" },
  { id: "enterprise" as StrategyMode, label: "Enterprise", desc: "Demo-led, ROI-focused, high-touch" },
  { id: "high-touch" as StrategyMode, label: "High Touch", desc: "Consultative, premium, relationship-led" },
  { id: "community" as StrategyMode, label: "Community-Led", desc: "Network effects, social proof, FOMO" },
]

// ─── Global variant seed ────────────────────────────────────────────────────────
let _globalVariantSeed = 0

// ─── Small helpers ─────────────────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/50 hover:border-primary/40 bg-secondary/20"
    >
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  )
}

function ColorSwatch({ color, label }: { color: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => { await navigator.clipboard.writeText(color); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex flex-col items-center gap-1.5 group" title={`Copy ${color}`}
    >
      <div className="h-9 w-9 rounded-lg border border-border/60 shadow-sm transition-all group-hover:scale-110 group-hover:shadow-md" style={{ background: color }} />
      <span className="text-[9px] font-mono text-muted-foreground group-hover:text-foreground transition-colors">{copied ? "✓" : color.slice(0, 7)}</span>
      <span className="text-[9px] text-muted-foreground capitalize leading-none">{label}</span>
    </button>
  )
}

function EditableField({ value, onChange, multiline = false }: {
  value: string; onChange: (v: string) => void; multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)
  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])
  const commit = () => { onChange(draft); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  if (editing) return (
    <div>
      {multiline
        ? <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => e.key === "Escape" && cancel()} rows={3}
            className="w-full bg-secondary/40 border border-primary/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none resize-none" />
        : <input ref={ref as React.RefObject<HTMLInputElement>} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === "Escape") cancel(); if (e.key === "Enter") commit() }}
            className="w-full bg-secondary/40 border border-primary/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none" />
      }
      <div className="flex gap-1.5 mt-1.5">
        <button onClick={commit} className="text-xs px-2.5 py-1 rounded-md bg-primary text-primary-foreground font-semibold">Save</button>
        <button onClick={cancel} className="text-xs px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground">Cancel</button>
      </div>
    </div>
  )

  return (
    <div onClick={() => setEditing(true)} className="group relative cursor-text rounded-lg border border-transparent hover:border-primary/25 hover:bg-primary/5 px-3 py-2 transition-all min-h-[36px]">
      <span className="text-sm text-foreground leading-relaxed">{value || <span className="text-muted-foreground italic text-xs">Empty — click to edit</span>}</span>
      <Pencil className="absolute top-2 right-2 h-3 w-3 text-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mt-2 mb-0.5 px-1">{children}</p>
}

function InspectorSection({ title, children, defaultOpen = true, action }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border/30">
      <button onClick={() => setOpen(p => !p)} className="flex w-full items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors text-left">
        <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        <div className="flex items-center gap-1.5">
          {action}
          <ChevronRight className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
      </button>
      {open && <div className="px-4 pb-4 space-y-1">{children}</div>}
    </div>
  )
}

function SectionRegenBtn({ sectionName, regenSection, regenningSection }: {
  sectionName: string; regenSection: (n: string) => void; regenningSection: string | null
}) {
  const busy = regenningSection === sectionName
  return (
    <button onClick={e => { e.stopPropagation(); regenSection(sectionName) }} disabled={!!regenningSection}
      className="flex items-center gap-1 text-[10px] text-primary border border-primary/20 hover:border-primary/40 rounded px-1.5 py-0.5 bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-40">
      {busy ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}AI
    </button>
  )
}

// ─── Generation Animation ────────────────────────────────────────────────────────

const FALLBACK_STAGES = [
  "Analyzing business model & ICP psychology",
  "Engineering conversion funnel architecture",
  "Mapping trust signal hierarchy",
  "Generating brand identity & design system",
  "Writing industry-specific copy",
  "Building component code",
  "Finalizing website package",
]

function GeneratingOverlay({ streamingText, architectStages, currentStageIdx, phase }: {
  streamingText: string; architectStages: string[]; currentStageIdx: number
  phase: "architect" | "generating" | "streaming"
}) {
  const stages = architectStages.length > 0 ? architectStages : FALLBACK_STAGES
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-8 p-8">
      {/* Pulsing orb */}
      <div className="relative">
        <motion.div className="h-20 w-20 rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center"
          animate={{ boxShadow: ["0 0 28px rgba(212,175,55,.08)", "0 0 64px rgba(212,175,55,.3)", "0 0 28px rgba(212,175,55,.08)"] }}
          transition={{ duration: 2.4, repeat: Infinity }}>
          <Brain className="h-9 w-9 text-primary" />
        </motion.div>
        {[1.4, 1.9].map((s, i) => (
          <motion.div key={i} className="absolute inset-0 rounded-full border border-primary/20"
            animate={{ scale: [1, s, 1], opacity: [.5, 0, .5] }}
            transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4 }} />
        ))}
      </div>

      {/* Phase */}
      <div className="text-center">
        <motion.p key={phase} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">
          {phase === "architect" ? "Architecting" : phase === "generating" ? "Generating" : "Streaming"}
        </motion.p>
        <p className="text-xs text-muted-foreground">AI website builder at work</p>
      </div>

      {/* Stages */}
      <div className="w-full max-w-xs space-y-1.5">
        {stages.map((s, i) => {
          const done = i < currentStageIdx, active = i === currentStageIdx
          return (
            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i <= currentStageIdx ? 1 : .25, x: 0 }}
              transition={{ delay: i * .07 }}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg ${active ? "bg-primary/10 border border-primary/20" : done ? "bg-secondary/10" : ""}`}>
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-green-500/20" : active ? "bg-primary/20" : "bg-secondary/20"}`}>
                {done ? <Check className="h-2.5 w-2.5 text-green-400" /> : active ? <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />}
              </div>
              <span className={`text-xs ${active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/35"}`}>{s}</span>
            </motion.div>
          )
        })}
      </div>

      {streamingText && (
        <div className="w-full max-w-xs rounded-lg border border-border/40 bg-secondary/10 p-3">
          <p className="font-mono text-[9px] text-green-400/60 max-h-14 overflow-hidden leading-relaxed">{streamingText.slice(-180)}</p>
        </div>
      )}
    </div>
  )
}

// ─── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  const feats = [
    { icon: Brain, label: "Business-aware architecture", desc: "Section order from ICP psychology" },
    { icon: Target, label: "Conversion optimization", desc: "CTA, trust signals, funnel structure" },
    { icon: Shield, label: "Industry-specific design", desc: "Radically different layouts per vertical" },
    { icon: Wand2, label: "Per-section AI regen", desc: "Regenerate any section independently" },
  ]
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="text-center max-w-md w-full">
        <motion.div className="mx-auto mb-6 h-22 w-22 flex items-center justify-center rounded-2xl border border-primary/20 bg-primary/5"
          style={{ width: 88, height: 88 }}
          animate={{ boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 48px rgba(212,175,55,.22)", "0 0 0px rgba(212,175,55,0)"] }}
          transition={{ duration: 3.5, repeat: Infinity }}>
          <Globe className="h-11 w-11 text-primary" />
        </motion.div>
        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">AI Website Builder</p>
        <h3 className="text-xl font-bold text-foreground mb-2">Generate Your Website</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-7 max-w-sm mx-auto">
          Industry-specific design, conversion-optimized layout, and compelling copy — all generated from your business idea in seconds.
        </p>
        <div className="grid grid-cols-2 gap-2 text-left mb-7">
          {feats.map(({ icon: Icon, label, desc }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * .07 }}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/20 border border-border/30">
              <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <button onClick={onGenerate}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold shadow-[0_0_40px_rgba(212,175,55,.28)] hover:shadow-[0_0_60px_rgba(212,175,55,.42)] hover:bg-primary/90 transition-all">
          <Sparkles className="h-4 w-4" />
          Build My Website
        </button>
        <p className="text-[10px] text-muted-foreground mt-3">Industry-aware · Conversion-optimized · Fully editable</p>
      </div>
    </div>
  )
}

// ─── Browser Chrome ─────────────────────────────────────────────────────────────

function BrowserChrome({ brandName, onOpenTab, previewHtml }: { brandName: string; onOpenTab: () => void; previewHtml: string }) {
  const domain = (brandName || "mysite").toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-[#1c1c1e] border-b border-white/[0.06] shrink-0">
      <div className="flex items-center gap-1.5 shrink-0">
        <div className="h-3 w-3 rounded-full bg-[#ff5f57] hover:bg-[#ff5f57]/80 cursor-pointer transition-colors" />
        <div className="h-3 w-3 rounded-full bg-[#febc2e] hover:bg-[#febc2e]/80 cursor-pointer transition-colors" />
        <div className="h-3 w-3 rounded-full bg-[#28c840] hover:bg-[#28c840]/80 cursor-pointer transition-colors" />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 bg-[#2c2c2e] border border-white/[0.08] rounded-md px-3 py-1 max-w-xs w-full">
          <svg className="h-3 w-3 text-green-400/70 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <span className="text-[11px] text-white/50 font-mono truncate">{domain}</span>
        </div>
      </div>
      <button onClick={onOpenTab} title="Open in new tab"
        className="shrink-0 text-white/30 hover:text-white/70 transition-colors p-1 rounded hover:bg-white/10">
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}

// ─── Main Component ─────────────────────────────────────────────────────────────

export function WebsitePanel({ businessIdea, businessIntelligence, projectId, existingOutput, onSaved, autoGenerate }: WebsitePanelProps) {
  const { lang } = useLang()
  const { emit } = useWorkspaceController()

  // Core state
  const [data, setData] = useState<WebsiteOutput | null>(existingOutput as unknown as WebsiteOutput | null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [savedStatus, setSavedStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [exportStatus, setExportStatus] = useState<"idle" | "downloading">("idle")

  // Generation animation
  const [architectStages, setArchitectStages] = useState<string[]>([])
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [phase, setPhase] = useState<"architect" | "generating" | "streaming">("architect")
  const [showAnalysisBanner, setShowAnalysisBanner] = useState(false)
  const [analysisSignal, setAnalysisSignal] = useState(0)

  // UI
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("design")
  const [viewport, setViewport] = useState<Viewport>("desktop")

  // Section regen
  const [regenningSection, setRegenningSection] = useState<string | null>(null)

  // Optimization
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optStreamText, setOptStreamText] = useState("")

  // Strategy
  const [activeStrategy, setActiveStrategy] = useState<StrategyMode | null>(null)
  const [isSwitchingStrategy, setIsSwitchingStrategy] = useState(false)
  const [switchingStrategySection, setSwitchingStrategySection] = useState<string | null>(null)

  // Variant seed (module-level so it persists)
  const variantSeedRef = useRef(_globalVariantSeed)

  useEffect(() => { if (existingOutput) setData(existingOutput as unknown as WebsiteOutput) }, [existingOutput])

  const previewHtml = useMemo(() => data ? buildPreviewHtml(data) : "", [data])
  const allCode = useMemo(() => Object.values(data?.componentCode ?? {}).join("\n\n"), [data])

  // Auto-generate
  const autoGenerateRef = useRef(false)
  useEffect(() => {
    if (autoGenerate && !existingOutput && !autoGenerateRef.current) {
      autoGenerateRef.current = true
      const t = setTimeout(() => generate(), 400)
      return () => clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  // ─── Main generation ──────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    setIsGenerating(true); setError(null); setStreamingText(""); setArchitectStages([]); setCurrentStageIdx(0); setPhase("architect"); setOptimization(null); setShowAnalysisBanner(false)
    const idea = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"
    try {
      const seed = _globalVariantSeed++
      variantSeedRef.current = seed
      const resp = await fetch("/api/generate/website", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ idea, businessIntelligence, variantSeed: seed, language: lang }),
      })
      if (!resp.ok) { const e = await resp.json().catch(() => ({ error: "Failed" })); throw new Error(e.error ?? "Generation failed") }
      const reader = resp.body?.getReader()
      if (!reader) throw new Error("No stream")
      const dec = new TextDecoder(); let carry = "", finalData: WebsiteOutput | null = null, stageIdx = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n"); carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const p = JSON.parse(line.slice(6).trim())
            if (p.error) throw new Error(p.error)
            if (p.phase === "architect") { setArchitectStages(p.stages ?? []); setPhase("architect") }
            else if (p.phase === "reasoning") { stageIdx = (p.stage ?? 0) + 1; setCurrentStageIdx(stageIdx) }
            else if (p.phase === "generating") setPhase("generating")
            else if (p.done && p.data) finalData = p.data as WebsiteOutput
            else if (typeof p.content === "string") { setPhase("streaming"); setStreamingText(prev => (prev + p.content).slice(-500)) }
          } catch (e) { if (e instanceof SyntaxError) continue; throw e }
        }
      }
      reader.releaseLock()
      if (finalData) {
        setData(finalData); setSidebarTab("design"); setShowAnalysisBanner(true)
        if (projectId) {
          setSavedStatus("saving")
          try {
            await api.projects.update(projectId, { websiteOutput: finalData as unknown as Record<string, unknown> })
            setSavedStatus("saved"); setTimeout(() => setSavedStatus("idle"), 3000)
            onSaved?.(finalData as unknown as Record<string, unknown>)
            emit({ type: "website.generated" })
          } catch { setSavedStatus("idle") }
        }
      } else throw new Error("No data received — please try again")
    } catch (err) { setError(err instanceof Error ? err.message : "Generation failed") }
    finally { setIsGenerating(false); setStreamingText("") }
  }, [businessIdea, businessIntelligence, projectId, onSaved, lang, emit])

  // ─── Section regen ────────────────────────────────────────────────────────────

  const regenSection = useCallback(async (sectionName: string) => {
    if (!data || regenningSection) return
    setRegenningSection(sectionName)
    const idea = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"
    try {
      const resp = await fetch("/api/generate/website/section", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ idea, businessIntelligence, sectionName, language: lang }),
      })
      const reader = resp.body?.getReader(); if (!reader) return
      const dec = new TextDecoder(); let carry = ""
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n"); carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const p = JSON.parse(line.slice(6).trim())
            if (p.done && p.data) setData(prev => prev ? { ...prev, sections: { ...prev.sections, [sectionName]: p.data } } : prev)
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silent */ }
    finally { setRegenningSection(null) }
  }, [data, regenningSection, businessIdea, businessIntelligence, lang])

  // ─── Optimization ─────────────────────────────────────────────────────────────

  const runOptimize = useCallback(async () => {
    if (!data || isOptimizing) return
    setIsOptimizing(true); setOptStreamText(""); setSidebarTab("intelligence")
    try {
      const resp = await fetch("/api/generate/website/optimize", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ websiteData: data, businessIntelligence, language: lang }),
      })
      const reader = resp.body?.getReader(); if (!reader) return
      const dec = new TextDecoder(); let carry = ""
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n"); carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const p = JSON.parse(line.slice(6).trim())
            if (p.done && p.optimization) setOptimization(p.optimization as OptimizationResult)
            else if (typeof p.content === "string") setOptStreamText(prev => (prev + p.content).slice(-300))
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silent */ }
    finally { setIsOptimizing(false); setOptStreamText("") }
  }, [data, isOptimizing, businessIntelligence, lang])

  // ─── Strategy switch ──────────────────────────────────────────────────────────

  const switchStrategy = useCallback(async (mode: StrategyMode) => {
    if (!data || isSwitchingStrategy) return
    setIsSwitchingStrategy(true); setActiveStrategy(mode)
    const idea = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"
    try {
      const resp = await fetch("/api/generate/website/strategy", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ idea, businessIntelligence, strategyMode: mode, sections: data.sections, language: lang }),
      })
      const reader = resp.body?.getReader(); if (!reader) return
      const dec = new TextDecoder(); let carry = ""
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n"); carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const p = JSON.parse(line.slice(6).trim())
            if (p.phase === "section") setSwitchingStrategySection(p.section)
            else if (p.done && p.sections) {
              const secs = p.sections as Record<string, unknown>
              setData(prev => {
                if (!prev) return prev
                const u = { ...prev, sections: { ...prev.sections } }
                if (secs.hero) u.sections = { ...u.sections, hero: { ...u.sections.hero, ...(secs.hero as object) } }
                if (secs.pricing) u.sections = { ...u.sections, pricing: { ...u.sections.pricing, ...(secs.pricing as object) } }
                if (secs.cta) u.sections = { ...u.sections, cta: { ...u.sections.cta, ...(secs.cta as object) } }
                return u
              })
            }
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silent */ }
    finally { setIsSwitchingStrategy(false); setSwitchingStrategySection(null) }
  }, [data, isSwitchingStrategy, businessIdea, businessIntelligence, lang])

  // ─── Update helpers ───────────────────────────────────────────────────────────

  const updateSection = useCallback(<K extends keyof WebsiteOutput["sections"]>(k: K, v: Partial<WebsiteOutput["sections"][K]>) => {
    setData(p => p ? { ...p, sections: { ...p.sections, [k]: { ...p.sections[k], ...v } } } : p)
  }, [])
  const updateHeroField = useCallback((field: string, value: string) => {
    setData(p => p ? { ...p, sections: { ...p.sections, hero: { ...p.sections.hero, [field]: value } } } : p)
  }, [])
  const updateFeatureItem = useCallback((i: number, field: string, value: string) => {
    setData(p => {
      if (!p) return p
      const items = [...p.sections.features.items]
      items[i] = { ...items[i], [field]: value }
      return { ...p, sections: { ...p.sections, features: { ...p.sections.features, items } } }
    })
  }, [])
  const updateTestimonialItem = useCallback((i: number, field: string, value: string) => {
    setData(p => {
      if (!p) return p
      const items = [...p.sections.testimonials.items]
      items[i] = { ...items[i], [field]: value }
      return { ...p, sections: { ...p.sections, testimonials: { ...p.sections.testimonials, items } } }
    })
  }, [])
  const updatePricingField = useCallback((i: number, field: string, value: string) => {
    setData(p => {
      if (!p) return p
      const tiers = [...p.sections.pricing.tiers]
      tiers[i] = { ...tiers[i], [field]: value }
      return { ...p, sections: { ...p.sections, pricing: { ...p.sections.pricing, tiers } } }
    })
  }, [])
  const updateFaqItem = useCallback((i: number, field: string, value: string) => {
    setData(p => {
      if (!p) return p
      const items = [...p.sections.faq.items]
      items[i] = { ...items[i], [field]: value }
      return { ...p, sections: { ...p.sections, faq: { ...p.sections.faq, items } } }
    })
  }, [])

  // ─── Export ───────────────────────────────────────────────────────────────────

  const handleDownloadHtml = useCallback(() => {
    if (!data) return
    const blob = new Blob([previewHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${(data.brand?.name ?? "website").toLowerCase().replace(/\s+/g, "-")}.html`
    a.click(); URL.revokeObjectURL(url)
  }, [data, previewHtml])

  const handleDownloadZip = useCallback(async () => {
    if (!data || exportStatus === "downloading") return
    setExportStatus("downloading")
    try {
      const zip = new JSZip()
      const files = buildNextjsProject(data)
      Object.entries(files).forEach(([path, content]) => zip.file(path, content))
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = `${(data.brand?.name ?? "website").toLowerCase().replace(/\s+/g, "-")}-nextjs.zip`
      a.click(); URL.revokeObjectURL(url)
    } finally { setExportStatus("idle") }
  }, [data, exportStatus])

  const openInTab = useCallback(() => {
    if (!previewHtml) return
    const blob = new Blob([previewHtml], { type: "text/html" })
    window.open(URL.createObjectURL(blob), "_blank")
  }, [previewHtml])

  // ─── Viewport dimensions ──────────────────────────────────────────────────────

  const viewportWidth = viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "390px"

  // ─── Sidebar tab content ──────────────────────────────────────────────────────

  const renderDesignTab = () => {
    if (!data) return null
    const c = data.colorPalette
    const t = data.typography
    return (
      <div className="flex flex-col gap-0">
        <InspectorSection title="Design Variant">
          <div className="mt-1 px-1 py-2 rounded-lg bg-primary/5 border border-primary/15 text-xs text-foreground font-semibold">
            {data.designVariant ?? "—"}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 px-1">{data._industry ?? ""}</div>
        </InspectorSection>

        <InspectorSection title="Color Palette">
          <div className="flex flex-wrap gap-3 pt-1">
            {[
              { color: c.primary, label: "primary" },
              { color: c.secondary, label: "secondary" },
              { color: c.accent, label: "accent" },
              { color: c.background, label: "background" },
              { color: c.surface, label: "surface" },
              { color: c.text, label: "text" },
              { color: c.textMuted, label: "muted" },
            ].map(({ color, label }) => (
              <ColorSwatch key={label} color={color} label={label} />
            ))}
          </div>
        </InspectorSection>

        <InspectorSection title="Typography">
          <div className="space-y-2 pt-1">
            <div className="px-3 py-2.5 rounded-lg border border-border/40 bg-secondary/10">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Heading</div>
              <div className="text-sm font-semibold text-foreground" style={{ fontFamily: `'${t.headingFont}', sans-serif` }}>{t.headingFont}</div>
            </div>
            <div className="px-3 py-2.5 rounded-lg border border-border/40 bg-secondary/10">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Body</div>
              <div className="text-sm text-foreground" style={{ fontFamily: `'${t.bodyFont}', sans-serif` }}>{t.bodyFont}</div>
            </div>
          </div>
        </InspectorSection>

        <InspectorSection title="Brand">
          <FieldLabel>Name</FieldLabel>
          <EditableField value={data.brand?.name ?? ""} onChange={v => setData(p => p ? { ...p, brand: { ...p.brand, name: v } } : p)} />
          <FieldLabel>Tagline</FieldLabel>
          <EditableField value={data.brand?.tagline ?? ""} onChange={v => setData(p => p ? { ...p, brand: { ...p.brand, tagline: v } } : p)} />
        </InspectorSection>

        {data.websiteStrategy && (
          <InspectorSection title="Conversion Strategy" defaultOpen={false}>
            <div className="space-y-3 pt-1">
              <div className="text-xs text-muted-foreground leading-relaxed bg-secondary/15 rounded-lg px-3 py-2.5 border border-border/30">
                <span className="font-semibold text-foreground block mb-1">Approach</span>
                {data.websiteStrategy.conversionApproach}
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed bg-secondary/15 rounded-lg px-3 py-2.5 border border-border/30">
                <span className="font-semibold text-foreground block mb-1">Audience Psychology</span>
                {data.websiteStrategy.audiencePsychology}
              </div>
            </div>
          </InspectorSection>
        )}
      </div>
    )
  }

  const renderEditTab = () => {
    if (!data) return null
    const s = data.sections
    return (
      <div className="flex flex-col gap-0">
        <InspectorSection title="Hero" action={<SectionRegenBtn sectionName="hero" regenSection={regenSection} regenningSection={regenningSection} />}>
          <FieldLabel>Badge</FieldLabel>
          <EditableField value={s.hero?.badge ?? ""} onChange={v => updateHeroField("badge", v)} />
          <FieldLabel>Headline</FieldLabel>
          <EditableField value={s.hero?.headline ?? ""} onChange={v => updateHeroField("headline", v)} multiline />
          <FieldLabel>Subheadline</FieldLabel>
          <EditableField value={s.hero?.subheadline ?? ""} onChange={v => updateHeroField("subheadline", v)} multiline />
          <FieldLabel>Primary CTA</FieldLabel>
          <EditableField value={s.hero?.ctaPrimary ?? ""} onChange={v => updateHeroField("ctaPrimary", v)} />
          <FieldLabel>Secondary CTA</FieldLabel>
          <EditableField value={s.hero?.ctaSecondary ?? ""} onChange={v => updateHeroField("ctaSecondary", v)} />
        </InspectorSection>

        <InspectorSection title="Features" defaultOpen={false} action={<SectionRegenBtn sectionName="features" regenSection={regenSection} regenningSection={regenningSection} />}>
          <FieldLabel>Section Title</FieldLabel>
          <EditableField value={s.features?.title ?? ""} onChange={v => updateSection("features", { title: v })} />
          {(s.features?.items ?? []).map((f, i) => (
            <div key={i} className="mt-2 border border-border/30 rounded-lg p-2 space-y-1">
              <div className="text-[9px] text-primary font-bold uppercase">Feature {i + 1}</div>
              <EditableField value={f.title} onChange={v => updateFeatureItem(i, "title", v)} />
              <EditableField value={f.description} onChange={v => updateFeatureItem(i, "description", v)} multiline />
            </div>
          ))}
        </InspectorSection>

        <InspectorSection title="Testimonials" defaultOpen={false} action={<SectionRegenBtn sectionName="testimonials" regenSection={regenSection} regenningSection={regenningSection} />}>
          <FieldLabel>Section Title</FieldLabel>
          <EditableField value={s.testimonials?.title ?? ""} onChange={v => updateSection("testimonials", { title: v })} />
          {(s.testimonials?.items ?? []).map((t, i) => (
            <div key={i} className="mt-2 border border-border/30 rounded-lg p-2 space-y-1">
              <div className="text-[9px] text-primary font-bold uppercase">Testimonial {i + 1}</div>
              <EditableField value={t.quote} onChange={v => updateTestimonialItem(i, "quote", v)} multiline />
              <EditableField value={`${t.author} · ${t.role}`} onChange={v => {
                const [auth, role] = v.split("·").map(s => s.trim())
                updateTestimonialItem(i, "author", auth ?? ""); updateTestimonialItem(i, "role", role ?? "")
              }} />
            </div>
          ))}
        </InspectorSection>

        <InspectorSection title="Pricing" defaultOpen={false} action={<SectionRegenBtn sectionName="pricing" regenSection={regenSection} regenningSection={regenningSection} />}>
          <FieldLabel>Section Title</FieldLabel>
          <EditableField value={s.pricing?.title ?? ""} onChange={v => updateSection("pricing", { title: v })} />
          {(s.pricing?.tiers ?? []).map((tier, i) => (
            <div key={i} className={`mt-2 border rounded-lg p-2 space-y-1 ${tier.highlighted ? "border-primary/30" : "border-border/30"}`}>
              <div className={`text-[9px] font-bold uppercase ${tier.highlighted ? "text-primary" : "text-muted-foreground"}`}>{tier.name}</div>
              <EditableField value={`${tier.price}${tier.period}`} onChange={v => {
                const m = v.match(/^([^/]+)(\/\w+)?$/); updatePricingField(i, "price", m?.[1] ?? v); updatePricingField(i, "period", m?.[2] ?? "")
              }} />
              <EditableField value={tier.cta} onChange={v => updatePricingField(i, "cta", v)} />
            </div>
          ))}
        </InspectorSection>

        <InspectorSection title="Call to Action" defaultOpen={false} action={<SectionRegenBtn sectionName="cta" regenSection={regenSection} regenningSection={regenningSection} />}>
          <FieldLabel>Headline</FieldLabel>
          <EditableField value={s.cta?.headline ?? ""} onChange={v => updateSection("cta", { headline: v })} />
          <FieldLabel>Subheadline</FieldLabel>
          <EditableField value={s.cta?.subheadline ?? ""} onChange={v => updateSection("cta", { subheadline: v })} multiline />
          <FieldLabel>Button Text</FieldLabel>
          <EditableField value={s.cta?.buttonText ?? ""} onChange={v => updateSection("cta", { buttonText: v })} />
        </InspectorSection>

        <InspectorSection title="FAQ" defaultOpen={false} action={<SectionRegenBtn sectionName="faq" regenSection={regenSection} regenningSection={regenningSection} />}>
          {(s.faq?.items ?? []).map((item, i) => (
            <div key={i} className="mt-2 border border-border/30 rounded-lg p-2 space-y-1">
              <div className="text-[9px] text-muted-foreground font-bold uppercase">Q{i + 1}</div>
              <EditableField value={item.question} onChange={v => updateFaqItem(i, "question", v)} />
              <EditableField value={item.answer} onChange={v => updateFaqItem(i, "answer", v)} multiline />
            </div>
          ))}
        </InspectorSection>
      </div>
    )
  }

  const renderStrategyTab = () => (
    <div className="p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold text-foreground mb-1">Switch Conversion Strategy</p>
        <p className="text-[10px] text-muted-foreground mb-3">AI rewrites hero, pricing & CTA with a new conversion approach</p>
        <div className="space-y-1.5">
          {STRATEGIES.map(s => (
            <button key={s.id} onClick={() => switchStrategy(s.id)} disabled={isSwitchingStrategy}
              className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between ${activeStrategy === s.id ? "border-primary/40 bg-primary/10 text-foreground" : "border-border/30 hover:border-primary/30 hover:bg-primary/5 text-foreground"}`}>
              <div>
                <p className="text-xs font-semibold">{s.label}</p>
                <p className="text-[10px] text-muted-foreground">{s.desc}</p>
              </div>
              {isSwitchingStrategy && activeStrategy === s.id
                ? <div className="flex items-center gap-1 text-[10px] text-primary"><Loader2 className="h-3 w-3 animate-spin" />{switchingStrategySection ?? "…"}</div>
                : activeStrategy === s.id ? <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              }
            </button>
          ))}
        </div>
      </div>
    </div>
  )

  const renderExportTab = () => {
    if (!data) return null
    const nextjsFiles = buildNextjsProject(data)
    return (
      <div className="p-4 space-y-4">
        {/* Quick copy */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Copy</p>
          <div className="space-y-1.5">
            {[
              { label: "Full HTML", text: previewHtml },
              { label: "Color Palette", text: JSON.stringify(data.colorPalette, null, 2) },
              { label: "SEO Meta", text: JSON.stringify(data.seoMeta, null, 2) },
            ].map(({ label, text }) => (
              <div key={label} className="flex items-center justify-between py-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <CopyBtn text={text} label="Copy" />
              </div>
            ))}
          </div>
        </div>

        {/* Downloads */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Download</p>
          <div className="space-y-2">
            <button onClick={handleDownloadHtml}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border/40 hover:border-primary/30 bg-secondary/10 hover:bg-primary/5 text-sm text-foreground transition-all">
              <FileCode className="h-4 w-4 text-yellow-400/70 shrink-0" />
              <div className="text-left"><p className="text-xs font-semibold">Download HTML</p><p className="text-[10px] text-muted-foreground">Self-contained website file</p></div>
            </button>
            <button onClick={handleDownloadZip} disabled={exportStatus === "downloading"}
              className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/15 text-sm text-foreground transition-all disabled:opacity-60">
              {exportStatus === "downloading" ? <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" /> : <Download className="h-4 w-4 text-primary shrink-0" />}
              <div className="text-left"><p className="text-xs font-semibold">{exportStatus === "downloading" ? "Creating ZIP…" : "Download Next.js ZIP"}</p><p className="text-[10px] text-muted-foreground">Full Next.js 14 project</p></div>
            </button>
          </div>
        </div>

        {/* Code preview */}
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Files</p>
          <div className="space-y-1.5">
            {Object.entries(nextjsFiles).map(([path, code]) => (
              <div key={path} className="border border-border/30 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-secondary/20">
                  <span className="text-[10px] font-mono text-muted-foreground truncate">{path}</span>
                  <CopyBtn text={code} />
                </div>
                <pre className="px-2.5 py-2 text-[9px] font-mono text-green-300/60 bg-black/50 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">{code.slice(0, 600)}{code.length > 600 ? "\n…" : ""}</pre>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  const renderIntelligenceTab = () => (
    <div className="p-4">
      {isOptimizing ? (
        <div className="flex flex-col items-center gap-3 py-6">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground">Analyzing your website…</p>
          {optStreamText && <p className="font-mono text-[9px] text-green-400/50 max-w-full overflow-hidden">{optStreamText.slice(-120)}</p>}
        </div>
      ) : optimization ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 border border-border/30">
            <div className="text-center">
              <div className="text-2xl font-black text-foreground">{optimization.grade}</div>
              <div className="text-[9px] text-muted-foreground font-mono">{optimization.score}/100</div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{optimization.summary}</p>
          </div>
          {optimization.issues.slice(0, 5).map((issue, i) => (
            <div key={i} className="border border-border/30 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${issue.severity === "critical" ? "bg-red-500/15 text-red-400" : issue.severity === "high" ? "bg-orange-500/15 text-orange-400" : "bg-yellow-500/15 text-yellow-400"}`}>{issue.severity}</span>
                <span className="text-[10px] text-muted-foreground">{issue.section}</span>
              </div>
              <p className="text-xs font-semibold text-foreground">{issue.issue}</p>
              <p className="text-[10px] text-muted-foreground">{issue.fix}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Lightbulb className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground mb-4">Run an AI analysis to find conversion gaps and improvement opportunities.</p>
          <button onClick={runOptimize} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors">
            <Brain className="h-3.5 w-3.5" />Analyze Website
          </button>
        </div>
      )}
      {data && (
        <div className="mt-4">
          <WebsiteIntelligence data={data} businessIdea={businessIdea || businessIntelligence?.businessSnapshot || ""} businessIntelligence={businessIntelligence} autoRunSignal={analysisSignal} />
        </div>
      )}
    </div>
  )

  // ─── Sidebar tabs config ──────────────────────────────────────────────────────

  const sidebarTabs: { id: SidebarTab; icon: typeof Globe; label: string }[] = [
    { id: "design", icon: Palette, label: "Design" },
    { id: "edit", icon: Pencil, label: "Edit" },
    { id: "strategy", icon: Target, label: "Strategy" },
    { id: "intelligence", icon: Brain, label: "AI Audit" },
    { id: "export", icon: Download, label: "Export" },
  ]

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── Toolbar ─────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 bg-background shrink-0 gap-2">
        {/* Left: sidebar toggle + brand info */}
        <div className="flex items-center gap-2 min-w-0">
          <button onClick={() => setSidebarOpen(p => !p)} title="Toggle inspector"
            className={`p-1.5 rounded-md transition-colors shrink-0 ${sidebarOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40"}`}>
            <PanelLeft className="h-4 w-4" />
          </button>
          {data && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-bold text-foreground truncate">{data.brand?.name ?? "Website"}</span>
              <span className="text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full whitespace-nowrap hidden sm:block">{data.designVariant ?? ""}</span>
            </div>
          )}
        </div>

        {/* Center: viewport toggle */}
        <div className="flex items-center gap-1 bg-secondary/30 border border-border/40 rounded-lg p-0.5 shrink-0">
          {(["desktop", "tablet", "mobile"] as Viewport[]).map(v => {
            const Icon = v === "desktop" ? Monitor : v === "tablet" ? Tablet : Smartphone
            return (
              <button key={v} onClick={() => setViewport(v)} title={v}
                className={`p-1.5 rounded-md transition-all ${viewport === v ? "bg-background border border-border/60 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                <Icon className="h-3.5 w-3.5" />
              </button>
            )
          })}
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {savedStatus !== "idle" && (
            <span className={`text-[10px] font-medium transition-all ${savedStatus === "saved" ? "text-green-400" : "text-muted-foreground"}`}>
              {savedStatus === "saving" ? "Saving…" : "✓ Saved"}
            </span>
          )}
          <button onClick={generate} disabled={isGenerating}
            title="Regenerate website"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-muted-foreground hover:text-foreground border border-border/40 hover:border-border/80 bg-secondary/20 hover:bg-secondary/40 transition-all disabled:opacity-50">
            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {data ? "Regen" : "Generate"}
          </button>
          {data && (
            <button onClick={handleDownloadHtml} title="Download HTML"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all">
              <Download className="h-3.5 w-3.5" />
              Export
            </button>
          )}
        </div>
      </div>

      {/* ── Error banner ────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden border-b border-red-500/20 bg-red-500/8 px-4 py-2.5 flex items-center justify-between gap-3">
            <p className="text-xs text-red-400">{error}</p>
            <button onClick={() => setError(null)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Analysis banner ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAnalysisBanner && data && !optimization && !isOptimizing && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }}
            className="overflow-hidden shrink-0 border-b border-primary/15 bg-primary/5 px-4 py-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
              <p className="text-xs text-foreground">Website generated — run an AI audit to find conversion improvements</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => { runOptimize(); setAnalysisSignal(p => p + 1) }}
                className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors whitespace-nowrap">
                Run Audit
              </button>
              <button onClick={() => setShowAnalysisBanner(false)}><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main area ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden min-h-0">

        {/* Inspector sidebar */}
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ width: 0, opacity: 0 }} animate={{ width: 272, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              className="border-r border-border/40 flex flex-col overflow-hidden shrink-0"
              style={{ width: 272 }}
            >
              {/* Sidebar tab nav */}
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border/30 shrink-0 overflow-x-auto">
                {sidebarTabs.map(({ id, icon: Icon, label }) => (
                  <button key={id} onClick={() => setSidebarTab(id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold whitespace-nowrap transition-all ${sidebarTab === id ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/30"}`}>
                    <Icon className="h-3 w-3 shrink-0" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Sidebar content */}
              <div className="flex-1 overflow-y-auto">
                {!data && sidebarTab !== "intelligence" ? (
                  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                    <Globe className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground">Generate a website to see controls here</p>
                  </div>
                ) : (
                  <>
                    {sidebarTab === "design" && renderDesignTab()}
                    {sidebarTab === "edit" && renderEditTab()}
                    {sidebarTab === "strategy" && renderStrategyTab()}
                    {sidebarTab === "intelligence" && renderIntelligenceTab()}
                    {sidebarTab === "export" && renderExportTab()}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Preview area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#141414]">
          {isGenerating ? (
            <div className="relative flex-1">
              <GeneratingOverlay
                streamingText={streamingText}
                architectStages={architectStages}
                currentStageIdx={currentStageIdx}
                phase={phase}
              />
            </div>
          ) : data ? (
            <>
              {/* Browser chrome */}
              <BrowserChrome brandName={data.brand?.name ?? "Website"} onOpenTab={openInTab} previewHtml={previewHtml} />

              {/* Iframe viewport */}
              <div className={`flex-1 overflow-auto bg-[#1a1a1a] ${viewport !== "desktop" ? "flex items-start justify-center p-4 pt-6" : ""}`}>
                <div style={{
                  width: viewportWidth,
                  minHeight: "100%",
                  position: "relative",
                  borderRadius: viewport !== "desktop" ? "8px" : 0,
                  overflow: "hidden",
                  boxShadow: viewport !== "desktop" ? "0 20px 60px rgba(0,0,0,.5)" : "none",
                }}>
                  <iframe
                    key={previewHtml.length}
                    srcDoc={previewHtml}
                    title="Website Preview"
                    style={{ width: "100%", height: "100%", minHeight: "100vh", border: "none", display: "block" }}
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState onGenerate={generate} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
