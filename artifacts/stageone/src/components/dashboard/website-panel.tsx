import { useState, useCallback, useEffect, useRef, useMemo } from "react"
import { useWorkspaceController } from "@/lib/workspace-controller-context"
import { useLang } from "@/lib/i18n"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe, Palette, Sparkles, Loader2, Monitor, Smartphone,
  RefreshCw, Download, Copy, Check, Code2, Layout,
  ChevronDown, ChevronUp, Pencil, X, RotateCcw, Type,
  Layers, FileCode, Zap, Star, DollarSign, HelpCircle,
  MessageSquare, ArrowRight, Package, ExternalLink,
  Brain, Target, Users, TrendingUp, Shield, Lightbulb,
  Gauge, AlertTriangle, AlertCircle, CheckCircle2, Wand2,
  ChevronRight, Tablet, History, Clock, RotateCw,
} from "lucide-react"
import { type BusinessIntelligence } from "./output-panel"
import { api } from "@/lib/api"
import { buildPreviewHtml, buildNextjsProject, type WebsiteOutput } from "@/lib/website-html-generator"
import { WebsiteIntelligence } from "./website-intelligence"
import JSZip from "jszip"

interface WebsitePanelProps {
  businessIdea: string
  businessIntelligence: BusinessIntelligence | null
  projectId: string | null
  existingOutput?: Record<string, unknown> | null
  onSaved?: (data: Record<string, unknown>) => void
  autoGenerate?: boolean
}

type PanelTab = "design" | "sections" | "code" | "export" | "strategy" | "intelligence" | "history"

interface WebsiteVersion {
  id: string
  savedAt: string
  label: string
}
type Viewport = "desktop" | "tablet" | "mobile"
type StrategyMode = "plg" | "enterprise" | "high-touch" | "community"

interface OptimizationIssue {
  category: string
  severity: "critical" | "high" | "medium"
  section: string
  issue: string
  why: string
  fix: string
  impact: string
}

interface OptimizationResult {
  score: number
  grade: string
  summary: string
  strengths: string[]
  issues: OptimizationIssue[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CopyBtn({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded border border-border/50 hover:border-primary/50">
      {copied ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      {label && <span>{copied ? "Copied!" : label}</span>}
    </button>
  )
}

function EditableField({ value, onChange, multiline = false, className = "" }: {
  value: string; onChange: (v: string) => void; multiline?: boolean; className?: string
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null)

  useEffect(() => { setDraft(value) }, [value])
  useEffect(() => { if (editing) ref.current?.focus() }, [editing])

  const commit = () => { onChange(draft); setEditing(false) }
  const cancel = () => { setDraft(value); setEditing(false) }

  if (editing) {
    return (
      <div className="relative">
        {multiline ? (
          <textarea ref={ref as React.RefObject<HTMLTextAreaElement>} value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") cancel() }}
            rows={3}
            className={`w-full bg-secondary/30 border border-primary/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none resize-none ${className}`}
          />
        ) : (
          <input ref={ref as React.RefObject<HTMLInputElement>} type="text" value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") cancel(); if (e.key === "Enter") commit() }}
            className={`w-full bg-secondary/30 border border-primary/40 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none ${className}`}
          />
        )}
        <div className="flex items-center gap-1.5 mt-1.5">
          <button onClick={commit} className="text-xs px-2 py-1 rounded bg-primary text-primary-foreground font-medium">Save</button>
          <button onClick={cancel} className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div onClick={() => setEditing(true)}
      className={`group relative cursor-pointer rounded-lg border border-transparent hover:border-primary/30 hover:bg-primary/5 px-3 py-2 transition-all ${className}`}
    >
      <span className="text-sm text-foreground leading-relaxed">{value || <span className="text-muted-foreground italic">Empty</span>}</span>
      <Pencil className="absolute top-2 right-2 h-3 w-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  )
}

function SectionBlock({ title, icon: Icon, children, defaultOpen = true, action }: {
  title: string; icon: typeof Globe; children: React.ReactNode; defaultOpen?: boolean; action?: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-border/40 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(p => !p)} className="flex w-full items-center justify-between p-3 bg-secondary/10 hover:bg-secondary/20 transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {action}
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="p-3 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{children}</p>
}

function ColorDot({ color, label }: { color: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={async () => { await navigator.clipboard.writeText(color); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="flex flex-col items-center gap-1 group" title={color}
    >
      <div className="h-8 w-8 rounded-lg border border-border/50 shadow-sm transition-transform group-hover:scale-110" style={{ backgroundColor: color }} />
      <span className="text-[9px] text-muted-foreground font-mono group-hover:text-foreground transition-colors">{copied ? "✓" : color.slice(0, 7)}</span>
      <span className="text-[9px] text-muted-foreground capitalize">{label}</span>
    </button>
  )
}

// ─── Section Regen Button ──────────────────────────────────────────────────────

function SectionRegenBtn({ sectionName, regenSection, regenningSection }: {
  sectionName: string
  regenSection: (name: string) => void
  regenningSection: string | null
}) {
  const isLoading = regenningSection === sectionName
  return (
    <button
      onClick={e => { e.stopPropagation(); regenSection(sectionName) }}
      disabled={!!regenningSection}
      title={`AI regenerate ${sectionName}`}
      className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded px-1.5 py-0.5 bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-40"
    >
      {isLoading ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : <Wand2 className="h-2.5 w-2.5" />}
      AI
    </button>
  )
}

// ─── Generating State ──────────────────────────────────────────────────────────

const FALLBACK_STEPS = [
  { label: "Analyzing business model & ICP psychology" },
  { label: "Engineering conversion funnel architecture" },
  { label: "Mapping trust signal hierarchy" },
  { label: "Designing section ordering strategy" },
  { label: "Generating brand identity & design system" },
  { label: "Writing industry-specific copy" },
  { label: "Building React components" },
  { label: "Finalizing website package" },
]

function GeneratingState({ streamingText, architectStages, currentStageIdx, phase }: {
  streamingText: string
  architectStages: string[]
  currentStageIdx: number
  phase: "architect" | "generating" | "streaming"
}) {
  const stages = architectStages.length > 0 ? architectStages : FALLBACK_STEPS.map(s => s.label)

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center h-full min-h-96 gap-8 p-8">
      {/* Orbital icon */}
      <div className="relative">
        <motion.div
          className="flex h-20 w-20 items-center justify-center rounded-full border border-primary/30 bg-primary/5"
          animate={{ boxShadow: ["0 0 30px rgba(212,175,55,0.1)", "0 0 60px rgba(212,175,55,0.35)", "0 0 30px rgba(212,175,55,0.1)"] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >
          <Brain className="h-9 w-9 text-primary" />
        </motion.div>
        <motion.div className="absolute inset-0 rounded-full border border-primary/20"
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
        <motion.div className="absolute inset-0 rounded-full border border-primary/10"
          animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 0.4 }}
        />
      </div>

      {/* Phase label */}
      <div className="text-center">
        <motion.p key={phase} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          className="text-xs font-semibold text-primary uppercase tracking-widest mb-1"
        >
          {phase === "architect" ? "Website Architect" : phase === "generating" ? "Generating" : "Streaming"}
        </motion.p>
        <p className="text-[10px] text-muted-foreground">AI strategist at work</p>
      </div>

      {/* Stages list */}
      <div className="w-full max-w-sm space-y-1.5">
        {stages.map((s, i) => {
          const done = i < currentStageIdx
          const active = i === currentStageIdx
          return (
            <motion.div key={i}
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: i <= currentStageIdx ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${active ? "bg-primary/10 border border-primary/20" : done ? "bg-secondary/10" : ""}`}
            >
              <div className={`flex h-5 w-5 items-center justify-center rounded-full shrink-0 ${done ? "bg-green-500/20" : active ? "bg-primary/20" : "bg-secondary/20"}`}>
                {done ? <Check className="h-2.5 w-2.5 text-green-400" /> : active ? <Loader2 className="h-2.5 w-2.5 text-primary animate-spin" /> : <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
              </div>
              <span className={`text-xs ${active ? "text-foreground font-medium" : done ? "text-muted-foreground" : "text-muted-foreground/40"}`}>{s}</span>
            </motion.div>
          )
        })}
      </div>

      {streamingText && (
        <div className="w-full max-w-sm rounded-lg border border-border/50 bg-secondary/10 p-3">
          <p className="font-mono text-[10px] text-green-400/70 max-h-16 overflow-hidden leading-relaxed">
            {streamingText.slice(-160)}
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  const FEATURES = [
    { icon: Brain, label: "Business-aware architecture", desc: "Section order engineered from your ICP psychology" },
    { icon: Target, label: "Conversion optimization", desc: "CTA placement, trust signals, and funnel structure" },
    { icon: Shield, label: "Industry-specific design", desc: "Radically different layouts per vertical" },
    { icon: Gauge, label: "Live optimization analysis", desc: "AI detects conversion gaps after generation" },
    { icon: Wand2, label: "Per-section AI regeneration", desc: "Regenerate any section independently" },
    { icon: TrendingUp, label: "Strategy switching", desc: "Flip between PLG, Enterprise, High-touch, Community" },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex h-full items-center justify-center p-8">
      <div className="text-center max-w-lg w-full">
        <motion.div
          className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-2xl border border-primary/20 bg-primary/5"
          animate={{ boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 50px rgba(212,175,55,0.25)", "0 0 0px rgba(212,175,55,0)"] }}
          transition={{ duration: 3.5, repeat: Infinity }}
        >
          <Brain className="h-12 w-12 text-primary" />
        </motion.div>

        <div className="mb-1">
          <span className="text-[10px] font-semibold text-primary uppercase tracking-widest">AI Website Architect</span>
        </div>
        <h3 className="text-2xl font-bold text-foreground mb-2">Your AI Creative Director</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-sm mx-auto">
          Not a template generator — an intelligent business website strategist that architects your site from your ICP, conversion psychology, and industry-specific trust signals.
        </p>

        <div className="grid grid-cols-2 gap-2 text-left mb-6">
          {FEATURES.map(({ icon: Icon, label, desc }, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
              className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-secondary/20 border border-border/30"
            >
              <Icon className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        <button onClick={onGenerate}
          className="flex items-center gap-2 mx-auto px-8 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-[0_0_40px_rgba(212,175,55,0.3)] hover:shadow-[0_0_60px_rgba(212,175,55,0.45)]"
        >
          <Sparkles className="h-4 w-4" />
          Architect My Website
        </button>
        <p className="text-[10px] text-muted-foreground mt-3">Industry-specific · Conversion-optimized · Live editable</p>
      </div>
    </motion.div>
  )
}

// ─── Severity Badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const colors: Record<string, string> = {
    critical: "bg-red-500/15 text-red-400 border-red-500/20",
    high: "bg-orange-500/15 text-orange-400 border-orange-500/20",
    medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20",
  }
  return (
    <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${colors[severity] ?? colors.medium}`}>
      {severity}
    </span>
  )
}

function CategoryIcon({ category }: { category: string }) {
  const map: Record<string, typeof AlertTriangle> = {
    trust_gap: Shield, cta_weakness: Target, conversion_friction: Zap,
    social_proof_gap: Users, copy_mismatch: MessageSquare, section_ordering: Layers, ux_friction: AlertTriangle,
  }
  const Icon = map[category] ?? AlertCircle
  return <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
}

// ─── Score Ring ────────────────────────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const color = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444"
  const circumference = 2 * Math.PI * 28
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
        <motion.circle cx="36" cy="36" r="28" fill="none" stroke={color} strokeWidth="5"
          strokeLinecap="round" strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-foreground">{grade}</span>
        <span className="text-[9px] text-muted-foreground font-mono">{score}</span>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function WebsitePanel({ businessIdea, businessIntelligence, projectId, existingOutput, onSaved, autoGenerate }: WebsitePanelProps) {
  const { lang } = useLang()
  const { emit } = useWorkspaceController()
  const [data, setData] = useState<WebsiteOutput | null>(existingOutput as unknown as WebsiteOutput | null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [savedStatus, setSavedStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [tab, setTab] = useState<PanelTab>("design")
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [exportStatus, setExportStatus] = useState<"idle" | "downloading">("idle")

  // Architect state
  const [architectStages, setArchitectStages] = useState<string[]>([])
  const [currentStageIdx, setCurrentStageIdx] = useState(0)
  const [phase, setPhase] = useState<"architect" | "generating" | "streaming">("architect")
  const [detectedIndustry, setDetectedIndustry] = useState<string>("")

  // Variant seed: increments on each full regeneration to force a different hero type
  const variantSeedRef = useRef(0)

  // Section regen
  const [regenningSection, setRegenningSection] = useState<string | null>(null)

  // Optimization
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null)
  const [isOptimizing, setIsOptimizing] = useState(false)
  const [optStreamText, setOptStreamText] = useState("")

  // Strategy switcher
  const [activeStrategy, setActiveStrategy] = useState<StrategyMode | null>(null)
  const [isSwitchingStrategy, setIsSwitchingStrategy] = useState(false)
  const [switchingStrategySection, setSwitchingStrategySection] = useState<string | null>(null)

  // Version history
  const [versions, setVersions] = useState<WebsiteVersion[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => { if (existingOutput) setData(existingOutput as unknown as WebsiteOutput) }, [existingOutput])

  // Auto-start generation when opened from Business Intelligence panel
  const autoGenerateRef = useRef(false)
  useEffect(() => {
    if (autoGenerate && !existingOutput && !autoGenerateRef.current) {
      autoGenerateRef.current = true
      // Small delay to let the panel animate in before starting
      const timer = setTimeout(() => { generate() }, 400)
      return () => clearTimeout(timer)
    }
    return undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  const previewHtml = useMemo(() => data ? buildPreviewHtml(data) : "", [data])

  // ─── Main generation ────────────────────────────────────────────────────────
  const generate = useCallback(async () => {
    setIsGenerating(true)
    setError(null)
    setStreamingText("")
    setArchitectStages([])
    setCurrentStageIdx(0)
    setPhase("architect")
    setOptimization(null)

    const ideaToUse = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"

    try {
      const currentVariantSeed = variantSeedRef.current++
      const response = await fetch("/api/generate/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: ideaToUse, businessIntelligence, variantSeed: currentVariantSeed, language: lang }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Failed" }))
        throw new Error(err.error ?? "Generation failed")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let lineCarryover = ""
      let finalData: WebsiteOutput | null = null
      let stageIdx = 0

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = lineCarryover + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        lineCarryover = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          try {
            const parsed = JSON.parse(raw)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.phase === "architect") {
              setArchitectStages(parsed.stages ?? [])
              setDetectedIndustry(parsed.industry ?? "")
              setPhase("architect")
            } else if (parsed.phase === "reasoning") {
              stageIdx = (parsed.stage ?? 0) + 1
              setCurrentStageIdx(stageIdx)
            } else if (parsed.phase === "generating") {
              setPhase("generating")
            } else if (parsed.done && parsed.data) {
              finalData = parsed.data as WebsiteOutput
            } else if (typeof parsed.content === "string") {
              setPhase("streaming")
              setStreamingText(prev => (prev + parsed.content).slice(-500))
            }
          } catch (e) {
            if (e instanceof SyntaxError) continue
            throw e
          }
        }
      }
      reader.releaseLock()

      if (finalData) {
        setData(finalData)
        setTab("design")
        if (projectId) {
          setSavedStatus("saving")
          try {
            await api.projects.update(projectId, { websiteOutput: finalData as unknown as Record<string, unknown> })
            setSavedStatus("saved")
            setTimeout(() => setSavedStatus("idle"), 3000)
            onSaved?.(finalData as unknown as Record<string, unknown>)
            emit({ type: "website.generated" })
          } catch { setSavedStatus("idle") }
        }
      } else {
        throw new Error("No data received — please try again")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed")
    } finally {
      setIsGenerating(false)
      setStreamingText("")
    }
  }, [businessIdea, businessIntelligence, projectId, onSaved])

  // ─── Section regen ──────────────────────────────────────────────────────────
  const regenSection = useCallback(async (sectionName: string) => {
    if (!data || regenningSection) return
    setRegenningSection(sectionName)

    const ideaToUse = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"

    try {
      const response = await fetch("/api/generate/website/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: ideaToUse, businessIntelligence, sectionName, language: lang }),
      })

      const reader = response.body?.getReader()
      if (!reader) return
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
            const parsed = JSON.parse(line.slice(6).trim())
            if (parsed.done && parsed.data) {
              setData(prev => prev ? {
                ...prev,
                sections: { ...prev.sections, [sectionName]: parsed.data }
              } : prev)
            }
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silently fail */ }
    finally {
      setRegenningSection(null)
    }
  }, [data, regenningSection, businessIdea, businessIntelligence])

  // ─── Optimization analysis ──────────────────────────────────────────────────
  const runOptimize = useCallback(async () => {
    if (!data || isOptimizing) return
    setIsOptimizing(true)
    setOptStreamText("")
    setTab("intelligence")

    try {
      const response = await fetch("/api/generate/website/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ websiteData: data, businessIntelligence, language: lang }),
      })

      const reader = response.body?.getReader()
      if (!reader) return
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
            const parsed = JSON.parse(line.slice(6).trim())
            if (parsed.done && parsed.optimization) {
              setOptimization(parsed.optimization as OptimizationResult)
            } else if (typeof parsed.content === "string") {
              setOptStreamText(prev => (prev + parsed.content).slice(-300))
            }
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silently fail */ }
    finally {
      setIsOptimizing(false)
      setOptStreamText("")
    }
  }, [data, isOptimizing, businessIntelligence])

  // ─── Strategy switch ────────────────────────────────────────────────────────
  const switchStrategy = useCallback(async (mode: StrategyMode) => {
    if (!data || isSwitchingStrategy) return
    setIsSwitchingStrategy(true)
    setActiveStrategy(mode)

    const ideaToUse = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"

    try {
      const response = await fetch("/api/generate/website/strategy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: ideaToUse, businessIntelligence, strategyMode: mode, sections: data.sections, language: lang }),
      })

      const reader = response.body?.getReader()
      if (!reader) return
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
            const parsed = JSON.parse(line.slice(6).trim())
            if (parsed.phase === "section") {
              setSwitchingStrategySection(parsed.section)
            } else if (parsed.done && parsed.sections) {
              const secs = parsed.sections as Record<string, unknown>
              setData(prev => {
                if (!prev) return prev
                const updated = { ...prev, sections: { ...prev.sections } }
                if (secs.hero) updated.sections = { ...updated.sections, hero: { ...updated.sections.hero, ...(secs.hero as object) } }
                if (secs.pricing) updated.sections = { ...updated.sections, pricing: { ...updated.sections.pricing, ...(secs.pricing as object) } }
                if (secs.cta) updated.sections = { ...updated.sections, cta: { ...updated.sections.cta, ...(secs.cta as object) } }
                return updated
              })
            }
          } catch { /* fragment */ }
        }
      }
      reader.releaseLock()
    } catch { /* silently fail */ }
    finally {
      setIsSwitchingStrategy(false)
      setSwitchingStrategySection(null)
    }
  }, [data, isSwitchingStrategy, businessIdea, businessIntelligence])

  // ─── Update helpers ─────────────────────────────────────────────────────────
  const updateSection = useCallback(<K extends keyof WebsiteOutput["sections"]>(
    section: K, updates: Partial<WebsiteOutput["sections"][K]>
  ) => {
    setData(prev => prev ? { ...prev, sections: { ...prev.sections, [section]: { ...prev.sections[section], ...updates } } } : prev)
  }, [])

  const updateHeroField = useCallback((field: string, value: string) => {
    setData(prev => prev ? { ...prev, sections: { ...prev.sections, hero: { ...prev.sections.hero, [field]: value } } } : prev)
  }, [])

  const updateFeatureItem = useCallback((i: number, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev
      const items = [...prev.sections.features.items]
      items[i] = { ...items[i], [field]: value }
      return { ...prev, sections: { ...prev.sections, features: { ...prev.sections.features, items } } }
    })
  }, [])

  const updateTestimonialItem = useCallback((i: number, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev
      const items = [...prev.sections.testimonials.items]
      items[i] = { ...items[i], [field]: value }
      return { ...prev, sections: { ...prev.sections, testimonials: { ...prev.sections.testimonials, items } } }
    })
  }, [])

  const updatePricingField = useCallback((tierIdx: number, field: string, value: string | boolean) => {
    setData(prev => {
      if (!prev) return prev
      const tiers = [...prev.sections.pricing.tiers]
      tiers[tierIdx] = { ...tiers[tierIdx], [field]: value }
      return { ...prev, sections: { ...prev.sections, pricing: { ...prev.sections.pricing, tiers } } }
    })
  }, [])

  const updateFaqItem = useCallback((i: number, field: string, value: string) => {
    setData(prev => {
      if (!prev) return prev
      const items = [...prev.sections.faq.items]
      items[i] = { ...items[i], [field]: value }
      return { ...prev, sections: { ...prev.sections, faq: { ...prev.sections.faq, items } } }
    })
  }, [])

  const handleDownloadZip = useCallback(async () => {
    if (!data) return
    setExportStatus("downloading")
    try {
      const files = buildNextjsProject(data)
      const zip = new JSZip()
      const folder = zip.folder(data.brand?.name?.toLowerCase().replace(/\s+/g, "-") ?? "my-website")!
      for (const [path, content] of Object.entries(files)) {
        const parts = path.split("/")
        if (parts.length > 1) {
          folder.folder(parts.slice(0, -1).join("/"))!.file(parts[parts.length - 1], content)
        } else {
          folder.file(path, content)
        }
      }
      const blob = await zip.generateAsync({ type: "blob" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${data.brand?.name?.toLowerCase().replace(/\s+/g, "-") ?? "my-website"}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) { console.error("ZIP export failed:", err) }
    finally { setExportStatus("idle") }
  }, [data])

  const allCode = useMemo(() => {
    if (!data?.componentCode) return ""
    return Object.entries(data.componentCode).map(([name, code]) => `// === ${name.toUpperCase()} ===\n${code}`).join("\n\n")
  }, [data])

  // ─── Version history ────────────────────────────────────────────────────────
  const fetchVersions = useCallback(async () => {
    if (!projectId) return
    setVersionsLoading(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/website-versions`, { credentials: "include" })
      if (res.ok) {
        const { versions: v } = await res.json()
        setVersions(v ?? [])
      }
    } catch { /* silently fail */ }
    finally { setVersionsLoading(false) }
  }, [projectId])

  const restoreVersion = useCallback(async (versionId: string) => {
    if (!projectId || restoringId) return
    setRestoringId(versionId)
    try {
      const res = await fetch(`/api/projects/${projectId}/website-versions/${versionId}/restore`, {
        method: "POST",
        credentials: "include",
      })
      if (res.ok) {
        const { restoredOutput } = await res.json()
        setData(restoredOutput as WebsiteOutput)
        setTab("design")
        onSaved?.(restoredOutput as Record<string, unknown>)
        // Refresh the version list
        await fetchVersions()
      }
    } catch { /* silently fail */ }
    finally { setRestoringId(null) }
  }, [projectId, restoringId, fetchVersions, onSaved])

  useEffect(() => {
    if (tab === "history") fetchVersions()
  }, [tab, fetchVersions])

  // ─── Early returns ──────────────────────────────────────────────────────────
  if (!data && !isGenerating) return <EmptyState onGenerate={generate} />
  if (isGenerating) {
    return <GeneratingState
      streamingText={streamingText}
      architectStages={architectStages}
      currentStageIdx={currentStageIdx}
      phase={phase}
    />
  }
  if (!data) return null

  const TABS: Array<{ id: PanelTab; label: string; icon: typeof Globe }> = [
    { id: "design", label: "Design", icon: Palette },
    { id: "sections", label: "Sections", icon: Layout },
    { id: "strategy", label: "Strategy", icon: Brain },
    { id: "intelligence", label: "Analyze", icon: Gauge },
    { id: "code", label: "Code", icon: Code2 },
    { id: "export", label: "Export", icon: Package },
    { id: "history", label: "History", icon: History },
  ]

  const STRATEGIES: Array<{ id: StrategyMode; label: string; desc: string }> = [
    { id: "plg", label: "PLG", desc: "Product-led growth, free tier, self-serve" },
    { id: "enterprise", label: "Enterprise", desc: "Demo-first, compliance, procurement-safe" },
    { id: "high-touch", label: "High-touch", desc: "Consultative, strategy call, ROI-led" },
    { id: "community", label: "Community", desc: "Community-led, network effects, UGC" },
  ]

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full min-h-0">
      {/* Top toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-background/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-green-400 shadow-[0_0_6px_rgba(74,222,128,0.6)]" />
          <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Website Ready</span>
          {detectedIndustry && (
            <span className="text-[10px] border border-primary/20 bg-primary/10 text-primary rounded px-2 py-0.5 font-medium">{detectedIndustry}</span>
          )}
          {savedStatus !== "idle" && (
            <span className={`text-xs ${savedStatus === "saved" ? "text-muted-foreground" : "text-primary"}`}>
              · {savedStatus === "saving" ? "Saving…" : "Saved"}
            </span>
          )}
          {error && <span className="text-xs text-red-400">· {error}</span>}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <button onClick={runOptimize} disabled={isOptimizing}
              className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded-lg px-2.5 py-1.5 bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-50"
            >
              {isOptimizing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Gauge className="h-3 w-3" />}
              Analyze
            </button>
          )}
          <button onClick={generate}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors border border-border/50 rounded-lg px-2.5 py-1.5 hover:border-primary/50"
          >
            <RefreshCw className="h-3 w-3" />Regenerate
          </button>
        </div>
      </div>

      {/* Split body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* LEFT: Controls */}
        <div className="w-72 shrink-0 border-r border-border/40 flex flex-col min-h-0 bg-background">
          {/* Tabs */}
          <div className="flex border-b border-border/40 shrink-0 overflow-x-auto">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex-shrink-0 flex flex-col items-center gap-1 py-2 px-2 text-[9px] font-semibold uppercase tracking-wider transition-colors relative ${
                  tab === t.id ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {t.id === "intelligence" && optimization && (
                  <span className={`absolute top-1 right-1 h-1.5 w-1.5 rounded-full ${optimization.score >= 80 ? "bg-green-400" : optimization.score >= 60 ? "bg-yellow-400" : "bg-red-400"}`} />
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">

            {/* DESIGN TAB */}
            {tab === "design" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <SectionBlock title="Brand" icon={Star}>
                  <Label>Name</Label>
                  <EditableField value={data.brand?.name ?? ""} onChange={v => setData(p => p ? { ...p, brand: { ...p.brand, name: v } } : p)} />
                  <Label>Tagline</Label>
                  <EditableField value={data.brand?.tagline ?? ""} onChange={v => setData(p => p ? { ...p, brand: { ...p.brand, tagline: v } } : p)} />
                  <Label>Voice</Label>
                  <div className="px-3 py-1.5 rounded-lg bg-secondary/20 text-xs text-muted-foreground capitalize">{data.brand?.voice ?? "professional"}</div>
                </SectionBlock>

                <SectionBlock title="Color Palette" icon={Palette}>
                  <div className="flex flex-wrap gap-3 pt-1">
                    {Object.entries(data.colorPalette ?? {}).map(([key, val]) => (
                      <ColorDot key={key} color={val as string} label={key.replace(/([A-Z])/g, " $1").toLowerCase()} />
                    ))}
                  </div>
                </SectionBlock>

                <SectionBlock title="Typography" icon={Type}>
                  {[{ label: "Heading Font", value: data.typography?.headingFont }, { label: "Body Font", value: data.typography?.bodyFont }].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
                      <span className="text-xs font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </SectionBlock>

                <SectionBlock title="Design System" icon={Layers}>
                  <div className="px-3 py-2 rounded-lg bg-secondary/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Style</p>
                    <p className="text-xs text-primary font-semibold capitalize">{data.design?.style ?? "glassmorphism"}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-secondary/20">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">UI Direction</p>
                    <p className="text-xs text-foreground leading-relaxed">{data.design?.uiDirection ?? ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(data.design?.animations ?? []).map((a, i) => (
                      <span key={i} className="text-[10px] border border-primary/20 bg-primary/10 text-primary rounded px-2 py-0.5">{a}</span>
                    ))}
                  </div>
                </SectionBlock>

                <SectionBlock title="SEO Meta" icon={Globe} defaultOpen={false}>
                  <Label>Page Title</Label>
                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/20 gap-2">
                    <span className="text-xs text-foreground flex-1 min-w-0 truncate">{data.seoMeta?.title}</span>
                    <CopyBtn text={data.seoMeta?.title ?? ""} />
                  </div>
                  <Label>Description</Label>
                  <div className="px-3 py-2 rounded-lg bg-secondary/20">
                    <p className="text-xs text-foreground leading-relaxed">{data.seoMeta?.description}</p>
                  </div>
                  <Label>Keywords</Label>
                  <div className="flex flex-wrap gap-1">
                    {(data.seoMeta?.keywords ?? []).map((k, i) => (
                      <span key={i} className="text-[10px] border border-border/50 rounded px-2 py-0.5 text-muted-foreground">{k}</span>
                    ))}
                  </div>
                </SectionBlock>
              </motion.div>
            )}

            {/* SECTIONS TAB */}
            {tab === "sections" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <SectionBlock title="Hero" icon={Layout}
                  action={<SectionRegenBtn sectionName="hero" regenSection={regenSection} regenningSection={regenningSection} />}
                >
                  {[{ key: "badge", label: "Badge" }, { key: "headline", label: "Headline" }, { key: "ctaPrimary", label: "Primary CTA" }, { key: "ctaSecondary", label: "Secondary CTA" }, { key: "socialProof", label: "Social Proof" }].map(({ key, label }) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <EditableField value={String((data.sections?.hero as Record<string, unknown>)?.[key] ?? "")} onChange={v => updateHeroField(key, v)} />
                    </div>
                  ))}
                  <Label>Subheadline</Label>
                  <EditableField value={data.sections?.hero?.subheadline ?? ""} onChange={v => updateHeroField("subheadline", v)} multiline />
                </SectionBlock>

                <SectionBlock title="Features" icon={Zap} defaultOpen={false}
                  action={<SectionRegenBtn sectionName="features" regenSection={regenSection} regenningSection={regenningSection} />}
                >
                  <Label>Section Title</Label>
                  <EditableField value={data.sections?.features?.title ?? ""} onChange={v => updateSection("features", { ...data.sections.features, title: v })} />
                  {(data.sections?.features?.items ?? []).map((f, i) => (
                    <div key={i} className="border border-border/30 rounded-lg p-2 space-y-1">
                      <div className="text-[10px] text-primary font-semibold uppercase">Feature {i + 1}</div>
                      <EditableField value={f.title} onChange={v => updateFeatureItem(i, "title", v)} />
                      <EditableField value={f.description} onChange={v => updateFeatureItem(i, "description", v)} multiline />
                    </div>
                  ))}
                </SectionBlock>

                <SectionBlock title="Testimonials" icon={MessageSquare} defaultOpen={false}
                  action={<SectionRegenBtn sectionName="testimonials" regenSection={regenSection} regenningSection={regenningSection} />}
                >
                  <Label>Section Title</Label>
                  <EditableField value={data.sections?.testimonials?.title ?? ""} onChange={v => updateSection("testimonials", { ...data.sections.testimonials, title: v })} />
                  {(data.sections?.testimonials?.items ?? []).map((t, i) => (
                    <div key={i} className="border border-border/30 rounded-lg p-2 space-y-1">
                      <div className="text-[10px] text-primary font-semibold uppercase">T{i + 1}</div>
                      <Label>Quote</Label>
                      <EditableField value={t.quote} onChange={v => updateTestimonialItem(i, "quote", v)} multiline />
                      <Label>Author · Role · Company</Label>
                      <EditableField value={`${t.author} · ${t.role} · ${t.company}`} onChange={v => {
                        const [author, role, company] = v.split("·").map(s => s.trim())
                        updateTestimonialItem(i, "author", author ?? "")
                        updateTestimonialItem(i, "role", role ?? "")
                        updateTestimonialItem(i, "company", company ?? "")
                      }} />
                    </div>
                  ))}
                </SectionBlock>

                <SectionBlock title="Pricing" icon={DollarSign} defaultOpen={false}
                  action={<SectionRegenBtn sectionName="pricing" regenSection={regenSection} regenningSection={regenningSection} />}
                >
                  <Label>Section Title</Label>
                  <EditableField value={data.sections?.pricing?.title ?? ""} onChange={v => updateSection("pricing", { ...data.sections.pricing, title: v })} />
                  {(data.sections?.pricing?.tiers ?? []).map((tier, i) => (
                    <div key={i} className={`border rounded-lg p-2 space-y-1 ${tier.highlighted ? "border-primary/30" : "border-border/30"}`}>
                      <div className={`text-[10px] font-semibold uppercase ${tier.highlighted ? "text-primary" : "text-muted-foreground"}`}>{tier.name}</div>
                      <Label>Price</Label>
                      <EditableField value={`${tier.price}${tier.period}`} onChange={v => {
                        const match = v.match(/^([^/]+)(\/\w+)?$/)
                        updatePricingField(i, "price", match?.[1] ?? v)
                        updatePricingField(i, "period", match?.[2] ?? "")
                      }} />
                      <Label>CTA</Label>
                      <EditableField value={tier.cta} onChange={v => updatePricingField(i, "cta", v)} />
                    </div>
                  ))}
                </SectionBlock>

                <SectionBlock title="Call to Action" icon={ArrowRight} defaultOpen={false}
                  action={<SectionRegenBtn sectionName="cta" regenSection={regenSection} regenningSection={regenningSection} />}
                >
                  <Label>Headline</Label>
                  <EditableField value={data.sections?.cta?.headline ?? ""} onChange={v => updateSection("cta", { ...data.sections.cta, headline: v })} />
                  <Label>Subheadline</Label>
                  <EditableField value={data.sections?.cta?.subheadline ?? ""} onChange={v => updateSection("cta", { ...data.sections.cta, subheadline: v })} multiline />
                  <Label>Button</Label>
                  <EditableField value={data.sections?.cta?.buttonText ?? ""} onChange={v => updateSection("cta", { ...data.sections.cta, buttonText: v })} />
                </SectionBlock>

                <SectionBlock title="FAQ" icon={HelpCircle} defaultOpen={false}
                  action={<SectionRegenBtn sectionName="faq" regenSection={regenSection} regenningSection={regenningSection} />}
                >
                  <Label>Section Title</Label>
                  <EditableField value={data.sections?.faq?.title ?? ""} onChange={v => updateSection("faq", { ...data.sections.faq, title: v })} />
                  {(data.sections?.faq?.items ?? []).map((item, i) => (
                    <div key={i} className="border border-border/30 rounded-lg p-2 space-y-1">
                      <div className="text-[10px] text-muted-foreground font-semibold uppercase">Q{i + 1}</div>
                      <EditableField value={item.question} onChange={v => updateFaqItem(i, "question", v)} />
                      <EditableField value={item.answer} onChange={v => updateFaqItem(i, "answer", v)} multiline />
                    </div>
                  ))}
                </SectionBlock>
              </motion.div>
            )}

            {/* STRATEGY TAB */}
            {tab === "strategy" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {/* Strategy Switcher */}
                <div className="border border-border/40 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5"><Wand2 className="h-3 w-3 text-primary" />Switch Conversion Strategy</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">AI rewrites hero, pricing & CTA with a new strategy</p>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {STRATEGIES.map(s => (
                      <button key={s.id} onClick={() => switchStrategy(s.id)} disabled={isSwitchingStrategy}
                        className={`w-full text-left px-3 py-2.5 rounded-lg border transition-all flex items-center justify-between ${
                          activeStrategy === s.id
                            ? "border-primary/40 bg-primary/10 text-foreground"
                            : "border-border/30 hover:border-primary/30 hover:bg-primary/5 text-foreground"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-semibold">{s.label}</p>
                          <p className="text-[10px] text-muted-foreground">{s.desc}</p>
                        </div>
                        {isSwitchingStrategy && activeStrategy === s.id ? (
                          <div className="flex items-center gap-1.5 text-[10px] text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            {switchingStrategySection ? `${switchingStrategySection}…` : "…"}
                          </div>
                        ) : activeStrategy === s.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {data.websiteStrategy ? (
                  <>
                    <SectionBlock title="Conversion Approach" icon={Target}>
                      <p className="text-xs text-muted-foreground leading-relaxed">{data.websiteStrategy.conversionApproach}</p>
                    </SectionBlock>
                    <SectionBlock title="Section Order Rationale" icon={Layers}>
                      <p className="text-xs text-muted-foreground leading-relaxed">{data.websiteStrategy.sectionOrderRationale}</p>
                    </SectionBlock>
                    <SectionBlock title="Audience Psychology" icon={Users}>
                      <p className="text-xs text-muted-foreground leading-relaxed">{data.websiteStrategy.audiencePsychology}</p>
                    </SectionBlock>
                    <SectionBlock title="CTA Strategy" icon={TrendingUp}>
                      <p className="text-xs text-muted-foreground leading-relaxed">{data.websiteStrategy.ctaStrategy}</p>
                    </SectionBlock>
                    <SectionBlock title="Trust Signals" icon={Shield}>
                      <div className="space-y-1.5">
                        {(data.websiteStrategy.trustSignals ?? []).map((signal, i) => (
                          <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-secondary/20">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">{signal}</p>
                          </div>
                        ))}
                      </div>
                    </SectionBlock>
                    <SectionBlock title="Industry Optimizations" icon={Lightbulb}>
                      <div className="space-y-1.5">
                        {(data.websiteStrategy.industryOptimizations ?? []).map((opt, i) => (
                          <div key={i} className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                            <p className="text-xs text-muted-foreground leading-relaxed">{opt}</p>
                          </div>
                        ))}
                      </div>
                    </SectionBlock>
                    <SectionBlock title="Conversion Funnel" icon={Brain}>
                      <p className="text-xs text-muted-foreground leading-relaxed">{data.websiteStrategy.conversionFunnel}</p>
                    </SectionBlock>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
                    <Brain className="h-7 w-7 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">Strategy data will appear after generating your website.</p>
                  </div>
                )}
              </motion.div>
            )}

            {/* INTELLIGENCE TAB */}
            {tab === "intelligence" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <WebsiteIntelligence
                  data={data}
                  businessIdea={businessIdea || businessIntelligence?.businessSnapshot || ""}
                  businessIntelligence={businessIntelligence}
                />
              </motion.div>
            )}

            {/* CODE TAB */}
            {tab === "code" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">React + Tailwind components</p>
                  <CopyBtn text={allCode} label="Copy All" />
                </div>
                {Object.entries(data.componentCode ?? {}).map(([name, code]) => (
                  <div key={name} className="border border-border/40 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2 bg-secondary/20">
                      <div className="flex items-center gap-2">
                        <FileCode className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-semibold capitalize text-foreground">{name}.tsx</span>
                      </div>
                      <CopyBtn text={code} />
                    </div>
                    <pre className="p-3 text-[10px] font-mono text-green-300/80 bg-black/60 overflow-x-auto max-h-48 overflow-y-auto leading-relaxed whitespace-pre-wrap break-all">
                      {code}
                    </pre>
                  </div>
                ))}
              </motion.div>
            )}

            {/* EXPORT TAB */}
            {tab === "export" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <p className="text-xs text-muted-foreground leading-relaxed">Export your website as a complete, ready-to-deploy project.</p>

                <div className="border border-border/40 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                    <p className="text-xs font-semibold text-foreground">Copy Code</p>
                  </div>
                  <div className="p-3 space-y-2">
                    {[
                      { label: "All Components", text: allCode },
                      { label: "HTML Preview", text: previewHtml },
                      { label: "Color Palette", text: JSON.stringify(data.colorPalette, null, 2) },
                      { label: "SEO Metadata", text: JSON.stringify(data.seoMeta, null, 2) },
                    ].map(({ label, text }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{label}</span>
                        <CopyBtn text={text} label="Copy" />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border border-border/40 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                    <p className="text-xs font-semibold text-foreground">Download ZIP</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Full Next.js 14 project structure</p>
                  </div>
                  <div className="p-3 space-y-1.5">
                    {["package.json", "tailwind.config.ts", "app/layout.tsx", "app/page.tsx", "components/Hero.tsx", "components/Features.tsx", "components/Pricing.tsx", "components/Testimonials.tsx", "components/CTA.tsx", "components/FAQ.tsx", "components/Footer.tsx"].map(f => (
                      <div key={f} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <FileCode className="h-2.5 w-2.5 text-primary/60 shrink-0" />{f}
                      </div>
                    ))}
                  </div>
                  <div className="px-3 pb-3">
                    <button onClick={handleDownloadZip} disabled={exportStatus === "downloading"}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {exportStatus === "downloading" ? <><Loader2 className="h-4 w-4 animate-spin" />Creating ZIP…</> : <><Download className="h-4 w-4" />Download Next.js Project</>}
                    </button>
                  </div>
                </div>

                <div className="border border-border/40 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/10 border-b border-border/40">
                    <p className="text-xs font-semibold text-foreground">Standalone HTML</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Self-contained, single-file preview</p>
                  </div>
                  <div className="p-3">
                    <button onClick={() => {
                      const blob = new Blob([previewHtml], { type: "text/html" })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement("a")
                      a.href = url
                      a.download = `${data.brand?.name?.toLowerCase().replace(/\s+/g, "-") ?? "website"}.html`
                      a.click()
                      URL.revokeObjectURL(url)
                    }} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-border hover:border-primary/50 text-foreground font-medium text-sm hover:bg-primary/5 transition-all">
                      <Download className="h-4 w-4" />Download HTML File
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Sections", value: "8" },
                    { label: "Components", value: Object.keys(data.componentCode ?? {}).length.toString() },
                    { label: "Features", value: (data.sections?.features?.items?.length ?? 0).toString() },
                    { label: "FAQ Items", value: (data.sections?.faq?.items?.length ?? 0).toString() },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-lg bg-secondary/20 border border-border/30 p-2 text-center">
                      <p className="text-lg font-bold text-primary">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* HISTORY TAB */}
            {tab === "history" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Version History</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Saved automatically each time you regenerate</p>
                  </div>
                  <button onClick={fetchVersions} disabled={versionsLoading}
                    className="text-[10px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCw className={`h-3 w-3 ${versionsLoading ? "animate-spin" : ""}`} />
                    Refresh
                  </button>
                </div>

                {!projectId && (
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 text-center">
                    <History className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">Save this project to track version history</p>
                  </div>
                )}

                {projectId && versionsLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
                  </div>
                )}

                {projectId && !versionsLoading && versions.length === 0 && (
                  <div className="rounded-xl border border-white/8 bg-white/[0.02] p-6 text-center">
                    <Clock className="h-7 w-7 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-xs font-medium text-foreground mb-1">No previous versions yet</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Each time you regenerate, your current website is saved here so you can browse and restore it.
                    </p>
                  </div>
                )}

                {projectId && !versionsLoading && versions.length > 0 && (
                  <div className="space-y-2">
                    {versions.map((v, i) => {
                      const date = new Date(v.savedAt)
                      const isRestoring = restoringId === v.id
                      return (
                        <motion.div
                          key={v.id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-3 py-3 hover:border-primary/20 hover:bg-primary/[0.02] transition-all group"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                              <History className="h-3.5 w-3.5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{v.label}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                {" · "}
                                {date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => restoreVersion(v.id)}
                            disabled={!!restoringId}
                            className="flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded-lg px-2.5 py-1.5 bg-primary/5 hover:bg-primary/10 transition-all disabled:opacity-40 shrink-0 opacity-0 group-hover:opacity-100"
                          >
                            {isRestoring ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <RotateCcw className="h-3 w-3" />
                            )}
                            {isRestoring ? "Restoring…" : "Restore"}
                          </button>
                        </motion.div>
                      )
                    })}
                    <p className="text-[9px] text-muted-foreground/60 text-center pt-1">
                      Up to 10 versions are kept · Oldest are removed automatically
                    </p>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>

        {/* RIGHT: Live Preview */}
        <div className="flex-1 flex flex-col min-w-0 bg-[#0c0c0c]">
          {/* Preview toolbar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-background/30 backdrop-blur-xl shrink-0">
            <span className="text-xs text-muted-foreground font-medium">Live Preview</span>
            <div className="flex items-center gap-1 bg-secondary/30 rounded-lg p-1">
              {([
                { id: "desktop" as const, icon: Monitor, label: "Desktop" },
                { id: "tablet" as const, icon: Tablet, label: "Tablet" },
                { id: "mobile" as const, icon: Smartphone, label: "Mobile" },
              ]).map(({ id, icon: Icon, label }) => (
                <button key={id} onClick={() => setViewport(id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                    viewport === id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={label}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => {
                const blob = new Blob([previewHtml], { type: "text/html" })
                const url = URL.createObjectURL(blob)
                window.open(url, "_blank")
              }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" />Open full
            </button>
          </div>

          {/* Preview frame */}
          <div className="flex-1 overflow-auto flex items-start justify-center p-6 min-h-0">
            <motion.div
              animate={{
                width: viewport === "mobile" ? 390 : viewport === "tablet" ? 768 : "100%",
                maxWidth: viewport === "mobile" ? 390 : viewport === "tablet" ? 768 : 1280,
              }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="relative rounded-xl overflow-hidden border border-border/40 shadow-2xl"
              style={{ minHeight: 600 }}
            >
              {/* Browser chrome */}
              <div className="flex items-center gap-2 px-4 py-2.5 bg-[#1a1a1a] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="h-3 w-3 rounded-full bg-red-500/70" />
                  <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                  <div className="h-3 w-3 rounded-full bg-green-500/70" />
                </div>
                <div className="flex-1 bg-[#111] rounded-md px-3 py-1 text-[11px] text-muted-foreground font-mono">
                  {data.seoMeta?.title ? `${data.brand?.name?.toLowerCase().replace(/\s+/g, "-")}.com` : "preview.local"}
                </div>
                {viewport !== "desktop" && (
                  <span className="text-[10px] text-muted-foreground">
                    {viewport === "tablet" ? "768px" : "390px"}
                  </span>
                )}
              </div>
              <motion.div
                key={`${viewport}-${JSON.stringify(data.sections?.hero?.headline)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25 }}
              >
                <iframe
                  srcDoc={previewHtml}
                  title="Website Preview"
                  className="w-full border-0 bg-white"
                  style={{ height: viewport === "mobile" ? 844 : viewport === "tablet" ? 1024 : 900 }}
                  sandbox="allow-scripts allow-same-origin"
                />
              </motion.div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
