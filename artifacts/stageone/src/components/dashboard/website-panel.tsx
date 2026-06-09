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
  Lightbulb, Settings2, Layout, Star, AlertCircle, ThumbsUp, ThumbsDown, ListChecks,
  Trophy, Medal, BarChart3, Crown,
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

type SidebarTab = "design" | "edit" | "export" | "strategy" | "intelligence" | "evaluation" | "candidates"
type Viewport = "desktop" | "tablet" | "mobile"
type StrategyMode = "plg" | "enterprise" | "high-touch" | "community"
type GenerationMode = "standard" | "explore" | "premium"

interface GenerationCandidate {
  id: string
  candidateNumber: number
  label: string
  websiteData: WebsiteOutput
  previewHtml: string
  evaluationReport: EvaluationReport | null
  overallScore: number
  designVariant: string
  designSpace: string
  status: "generating" | "evaluating" | "ready" | "error"
}

interface ComparisonReport {
  winner: string
  strongest_candidate: string
  reasoning: string
  ranking: string[]
  strengths_by_candidate: Record<string, string[]>
  weaknesses_by_candidate: Record<string, string[]>
}

interface DiversityInfo {
  score: number
  flags: Array<{ labels: [string, string]; dimensions: string[] }>
}

interface CandidateProgress {
  current: number
  total: number
  phase: "generating" | "evaluating" | "comparing"
}

interface EvaluationReport {
  overall_score: number
  design_score: number
  conversion_score: number
  ux_score: number
  content_score: number
  responsiveness_score: number
  strengths: string[]
  weaknesses: string[]
  improvement_recommendations: string[]
}

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

// ─── V4.5 Design Space System ─────────────────────────────────────────────────
const ALL_DESIGN_SPACES = [
  "Premium SaaS",
  "Enterprise Minimal",
  "Futuristic AI",
  "Luxury Editorial",
  "Startup Modern",
  "Glassmorphism",
  "Cinematic Dark",
  "Bold Brutalist",
] as const
type DesignSpaceName = typeof ALL_DESIGN_SPACES[number]

const DESIGN_SPACE_TO_VARIANT: Record<DesignSpaceName, string> = {
  "Premium SaaS":       "Premium SaaS",
  "Enterprise Minimal": "Enterprise Minimal",
  "Futuristic AI":      "Futuristic",
  "Luxury Editorial":   "Luxury Editorial",
  "Startup Modern":     "Startup Modern",
  "Glassmorphism":      "Glassmorphism",
  "Cinematic Dark":     "Cinematic Dark",
  "Bold Brutalist":     "Bold Brutalist",
}

const DESIGN_SPACE_ICONS: Record<DesignSpaceName, string> = {
  "Premium SaaS":       "⚡",
  "Enterprise Minimal": "🏢",
  "Futuristic AI":      "🤖",
  "Luxury Editorial":   "✦",
  "Startup Modern":     "🚀",
  "Glassmorphism":      "🔮",
  "Cinematic Dark":     "🎬",
  "Bold Brutalist":     "⬛",
}

// Design DNA fingerprints (client-side mirrors of backend logic)
function _dsTypographyDNA(ds: string): string {
  if (ds === "Luxury Editorial" || ds === "Cinematic Dark") return "serif"
  if (ds === "Bold Brutalist") return "condensed"
  return "sans"
}
function _dsLayoutDNA(ds: string): string {
  const m: Record<string, string> = {
    "Futuristic AI":      "fullscreen-centered",
    "Premium SaaS":       "split-product",
    "Luxury Editorial":   "centered-editorial",
    "Enterprise Minimal": "split-product",
    "Startup Modern":     "centered-metrics",
    "Bold Brutalist":     "fullscreen-text",
    "Glassmorphism":      "split-glass",
    "Cinematic Dark":     "fullscreen-cinematic",
  }
  return m[ds] ?? "centered"
}
function _dsSpacingDNA(ds: string): string {
  if (ds === "Bold Brutalist") return "brutalist"
  if (ds === "Glassmorphism") return "glass"
  if (ds === "Luxury Editorial") return "editorial"
  return "modern"
}
function _dsVisualDNA(ds: string): string {
  if (ds === "Luxury Editorial") return "pure-black"
  if (ds === "Enterprise Minimal") return "white"
  if (ds === "Glassmorphism") return "gradient"
  if (ds === "Cinematic Dark") return "cinematic-dark"
  if (ds === "Futuristic AI") return "neon-dark"
  return "dark"
}

function computeDiversityScore(designSpaces: string[]): number {
  if (designSpaces.length < 2) return 100
  let totalPairs = 0, diversePairs = 0
  for (let i = 0; i < designSpaces.length; i++) {
    for (let j = i + 1; j < designSpaces.length; j++) {
      totalPairs++
      const diffs = [
        _dsTypographyDNA(designSpaces[i]) !== _dsTypographyDNA(designSpaces[j]),
        _dsLayoutDNA(designSpaces[i]) !== _dsLayoutDNA(designSpaces[j]),
        _dsSpacingDNA(designSpaces[i]) !== _dsSpacingDNA(designSpaces[j]),
        _dsVisualDNA(designSpaces[i]) !== _dsVisualDNA(designSpaces[j]),
      ].filter(Boolean).length
      if (diffs >= 2) diversePairs++
    }
  }
  return Math.round((diversePairs / totalPairs) * 100)
}

function getDiversityFlags(candidates: Array<{ label: string; designSpace: string }>) {
  const flags: Array<{ labels: [string, string]; dimensions: string[] }> = []
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const a = candidates[i], b = candidates[j]
      const shared: string[] = []
      if (_dsTypographyDNA(a.designSpace) === _dsTypographyDNA(b.designSpace)) shared.push("typography")
      if (_dsLayoutDNA(a.designSpace) === _dsLayoutDNA(b.designSpace)) shared.push("layout")
      if (_dsSpacingDNA(a.designSpace) === _dsSpacingDNA(b.designSpace)) shared.push("spacing")
      if (_dsVisualDNA(a.designSpace) === _dsVisualDNA(b.designSpace)) shared.push("visual")
      if (shared.length >= 3) flags.push({ labels: [a.label, b.label], dimensions: shared })
    }
  }
  return flags
}

// Select N unique design spaces, shuffled for variety
function selectUniqueDesignSpaces(n: number): DesignSpaceName[] {
  const shuffled = [...ALL_DESIGN_SPACES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

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

function GeneratingOverlay({ streamingText, architectStages, currentStageIdx, phase, candidateProgress }: {
  streamingText: string; architectStages: string[]; currentStageIdx: number
  phase: "architect" | "generating" | "streaming"
  candidateProgress?: CandidateProgress | null
}) {
  const stages = architectStages.length > 0 ? architectStages : FALLBACK_STAGES
  const phaseLabel = candidateProgress?.phase === "comparing" ? "Comparing" : candidateProgress?.phase === "evaluating" ? "Evaluating" : phase === "architect" ? "Architecting" : phase === "generating" ? "Generating" : "Streaming"

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-6 p-8">
      {/* Candidate progress pill */}
      {candidateProgress && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/8">
          <div className="flex items-center gap-1.5">
            {Array.from({ length: candidateProgress.total }, (_, i) => (
              <div key={i} className={`h-2 w-2 rounded-full transition-all ${
                i < candidateProgress.current - 1 ? "bg-green-400" :
                i === candidateProgress.current - 1 ? "bg-primary animate-pulse" : "bg-secondary/40"
              }`} />
            ))}
          </div>
          <span className="text-[11px] font-bold text-primary">
            Candidate {candidateProgress.current} of {candidateProgress.total}
          </span>
        </motion.div>
      )}

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
        <motion.p key={phaseLabel} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
          className="text-[11px] font-bold text-primary uppercase tracking-widest mb-1">
          {phaseLabel}
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

  // Evaluation
  const [evaluationReport, setEvaluationReport] = useState<EvaluationReport | null>(null)
  const [isEvaluating, setIsEvaluating] = useState(false)

  // Multi-candidate (V4)
  const [generationMode, setGenerationMode] = useState<GenerationMode>("standard")
  const [candidates, setCandidates] = useState<GenerationCandidate[]>([])
  const [comparisonReport, setComparisonReport] = useState<ComparisonReport | null>(null)
  const [candidateProgress, setCandidateProgress] = useState<CandidateProgress | null>(null)
  // V4.5: Diversity tracking
  const [diversityInfo, setDiversityInfo] = useState<DiversityInfo | null>(null)

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
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoGenerate])

  // ─── Main generation ──────────────────────────────────────────────────────────

  const generate = useCallback(async () => {
    const candidateCount = generationMode === "explore" ? 3 : generationMode === "premium" ? 5 : 1
    const isMulti = candidateCount > 1
    setIsGenerating(true); setError(null); setStreamingText(""); setArchitectStages([]); setCurrentStageIdx(0); setPhase("architect"); setOptimization(null); setShowAnalysisBanner(false)
    if (isMulti) { setCandidates([]); setComparisonReport(null); setDiversityInfo(null) }
    const idea = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"
    const collectedCandidates: GenerationCandidate[] = []

    // V4.5: Pre-select unique design spaces for diversity enforcement
    // Each candidate in explore/premium mode gets a distinct creative direction
    const candidateDesignSpaces: DesignSpaceName[] = isMulti
      ? selectUniqueDesignSpaces(candidateCount)
      : []

    try {
      for (let ci = 0; ci < candidateCount; ci++) {
        if (isMulti) setCandidateProgress({ current: ci + 1, total: candidateCount, phase: "generating" })
        setStreamingText(""); setArchitectStages([]); setCurrentStageIdx(0); setPhase("architect")
        const seed = _globalVariantSeed++
        variantSeedRef.current = seed
        // V4.5: Force the pre-selected unique design space variant for this candidate
        const forcedVariant = isMulti && candidateDesignSpaces[ci]
          ? DESIGN_SPACE_TO_VARIANT[candidateDesignSpaces[ci]]
          : undefined
        const resp = await fetch("/api/generate/website", {
          method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
          body: JSON.stringify({ idea, businessIntelligence, variantSeed: seed, language: lang, projectId: projectId ?? undefined, ...(forcedVariant ? { forceDesignVariant: forcedVariant } : {}) }),
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
        if (!finalData) throw new Error(`Candidate ${ci + 1} returned no data — please try again`)

        if (!isMulti) {
          // Standard mode: existing single-candidate behavior
          setData(finalData); setSidebarTab("design"); setShowAnalysisBanner(true)
          setIsEvaluating(true); setEvaluationReport(null)
          ;(async () => {
            try {
              const evalResp = await fetch("/api/generate/website/evaluate", {
                method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
                body: JSON.stringify({ websiteData: finalData, businessIdea: idea, businessIntelligence }),
              })
              if (evalResp.ok) {
                const evalJson = await evalResp.json() as { success?: boolean; report?: EvaluationReport }
                if (evalJson.success && evalJson.report) setEvaluationReport(evalJson.report)
              }
            } catch { /* advisory */ }
            finally { setIsEvaluating(false) }
          })()
          console.log("GENERATOR_AUDIT: generator=website | generation completed")
          console.log("PROJECT_SAVE: projectId=" + (projectId ?? "(none)"))
          if (projectId) {
            setSavedStatus("saving")
            const endpoint = `/api/projects/${projectId}`
            console.log("SAVE_ENDPOINT: " + endpoint)
            try {
              await api.projects.update(projectId, { websiteOutput: finalData as unknown as Record<string, unknown> })
              console.log("SAVE_RESPONSE_STATUS: 200")
              console.log("SAVE_RESULT: success")
              setSavedStatus("saved"); setTimeout(() => setSavedStatus("idle"), 3000)
              onSaved?.(finalData as unknown as Record<string, unknown>)
              emit({ type: "website.generated", data: { saved: true } })
            } catch (saveErr) {
              console.error("SAVE_RESULT: failure (exception)", saveErr)
              setSavedStatus("idle")
              emit({ type: "website.generated", data: { saved: false } })
            }
          } else {
            emit({ type: "website.generated", data: { saved: false } })
          }
        } else {
          // Multi-candidate mode: collect candidate + evaluate
          const fd = finalData as unknown as { designVariant?: string; _designSpace?: string }
          const candidate: GenerationCandidate = {
            id: `candidate-${ci + 1}`, candidateNumber: ci + 1, label: String.fromCharCode(65 + ci),
            websiteData: finalData, previewHtml: buildPreviewHtml(finalData),
            evaluationReport: null, overallScore: 0,
            designVariant: fd.designVariant ?? "Unknown",
            designSpace: fd._designSpace ?? candidateDesignSpaces[ci] ?? "Premium SaaS",
            status: "evaluating",
          }
          collectedCandidates.push(candidate)
          setCandidates(prev => [...prev, { ...candidate }])
          // Evaluate this candidate immediately
          setCandidateProgress({ current: ci + 1, total: candidateCount, phase: "evaluating" })
          try {
            const er = await fetch("/api/generate/website/evaluate", {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({ websiteData: finalData, businessIdea: idea, businessIntelligence }),
            })
            if (er.ok) {
              const ej = await er.json() as { success?: boolean; report?: EvaluationReport }
              if (ej.success && ej.report) {
                candidate.evaluationReport = ej.report
                candidate.overallScore = ej.report.overall_score
              }
            }
          } catch { /* advisory */ }
          candidate.status = "ready"
          setCandidates(prev => prev.map(c => c.id === candidate.id ? { ...candidate } : c))
        }
      }
      // Multi-candidate finalize
      if (isMulti && collectedCandidates.length > 0) {
        const sorted = [...collectedCandidates].sort((a, b) => b.overallScore - a.overallScore)
        setData(sorted[0].websiteData)
        setSidebarTab("candidates")
        // V4.5: Compute diversity score across all candidates
        const diversityScore = computeDiversityScore(collectedCandidates.map(c => c.designSpace))
        const flags = getDiversityFlags(collectedCandidates.map(c => ({ label: c.label, designSpace: c.designSpace })))
        setDiversityInfo({ score: diversityScore, flags })
        // Run comparison
        if (collectedCandidates.length >= 2) {
          setCandidateProgress({ current: candidateCount, total: candidateCount, phase: "comparing" })
          try {
            const cr = await fetch("/api/generate/website/compare", {
              method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
              body: JSON.stringify({
                candidates: collectedCandidates.map(c => ({ label: c.label, designVariant: c.designVariant, evaluationReport: c.evaluationReport, websiteData: c.websiteData })),
                businessIdea: idea, businessIntelligence,
              }),
            })
            if (cr.ok) {
              const cj = await cr.json() as { success?: boolean; report?: ComparisonReport }
              if (cj.success && cj.report) setComparisonReport(cj.report)
            }
          } catch { /* advisory */ }
        }
        // Save best candidate
        console.log("GENERATOR_AUDIT: generator=website (multi-candidate) | generation completed")
        console.log("PROJECT_SAVE: projectId=" + (projectId ?? "(none)"))
        if (projectId && sorted[0]) {
          setSavedStatus("saving")
          const endpoint = `/api/projects/${projectId}`
          console.log("SAVE_ENDPOINT: " + endpoint)
          try {
            await api.projects.update(projectId, { websiteOutput: sorted[0].websiteData as unknown as Record<string, unknown> })
            console.log("SAVE_RESPONSE_STATUS: 200")
            console.log("SAVE_RESULT: success")
            setSavedStatus("saved"); setTimeout(() => setSavedStatus("idle"), 3000)
            onSaved?.(sorted[0].websiteData as unknown as Record<string, unknown>)
            emit({ type: "website.generated", data: { saved: true } })
          } catch (saveErr) {
            console.error("SAVE_RESULT: failure (exception)", saveErr)
            setSavedStatus("idle")
            emit({ type: "website.generated", data: { saved: false } })
          }
        } else {
          emit({ type: "website.generated", data: { saved: false } })
        }
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Generation failed") }
    finally { setIsGenerating(false); setStreamingText(""); setCandidateProgress(null) }
  }, [generationMode, businessIdea, businessIntelligence, projectId, onSaved, lang, emit])

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

  // ─── Evaluation ───────────────────────────────────────────────────────────────

  const runEvaluation = useCallback(async () => {
    if (!data || isEvaluating) return
    setIsEvaluating(true); setEvaluationReport(null)
    const idea = businessIdea || businessIntelligence?.businessSnapshot || "innovative tech startup"
    try {
      const resp = await fetch("/api/generate/website/evaluate", {
        method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ websiteData: data, businessIdea: idea, businessIntelligence }),
      })
      if (resp.ok) {
        const json = await resp.json() as { success?: boolean; report?: EvaluationReport }
        if (json.success && json.report) setEvaluationReport(json.report)
      }
    } catch { /* advisory only */ }
    finally { setIsEvaluating(false) }
  }, [data, isEvaluating, businessIdea, businessIntelligence])

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

  // ─── Evaluation tab ───────────────────────────────────────────────────────────

  const renderEvaluationTab = () => {
    if (isEvaluating) return (
      <div className="flex flex-col items-center gap-4 py-10 px-4">
        <div className="relative">
          <motion.div className="h-14 w-14 rounded-full border border-primary/30 bg-primary/5 flex items-center justify-center"
            animate={{ boxShadow: ["0 0 20px rgba(212,175,55,.08)", "0 0 48px rgba(212,175,55,.28)", "0 0 20px rgba(212,175,55,.08)"] }}
            transition={{ duration: 2.2, repeat: Infinity }}>
            <Star className="h-6 w-6 text-primary" />
          </motion.div>
        </div>
        <div className="text-center">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Evaluating</p>
          <p className="text-[11px] text-muted-foreground">AI is reviewing your website quality…</p>
        </div>
      </div>
    )

    if (!evaluationReport) return (
      <div className="p-4 text-center py-10">
        <Star className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-xs font-semibold text-foreground mb-1">AI Quality Evaluation</p>
        <p className="text-[11px] text-muted-foreground mb-5 leading-relaxed">
          The AI reviews your website across design, conversion, UX, content, and mobile readiness.
        </p>
        <button onClick={runEvaluation} disabled={!data}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 transition-colors disabled:opacity-40">
          <Star className="h-3.5 w-3.5" />Evaluate Now
        </button>
        {!data && <p className="text-[10px] text-muted-foreground mt-3">Generate a website first</p>}
      </div>
    )

    const r = evaluationReport
    const dims = [
      { key: "design_score", label: "Design", score: r.design_score, color: "#7c3aed" },
      { key: "conversion_score", label: "Conversion", score: r.conversion_score, color: "#d4af37" },
      { key: "ux_score", label: "UX", score: r.ux_score, color: "#0ea5e9" },
      { key: "content_score", label: "Content", score: r.content_score, color: "#22c55e" },
      { key: "responsiveness_score", label: "Mobile", score: r.responsiveness_score, color: "#f97316" },
    ] as const

    const scoreColor = (s: number) => s >= 80 ? "text-green-400" : s >= 65 ? "text-yellow-400" : "text-red-400"
    const scoreBg = (s: number) => s >= 80 ? "bg-green-500/15 border-green-500/20" : s >= 65 ? "bg-yellow-500/15 border-yellow-500/20" : "bg-red-500/15 border-red-500/20"

    return (
      <div className="flex flex-col gap-0 pb-4">
        {/* Overall score hero */}
        <div className="px-4 py-4 border-b border-border/30">
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${scoreBg(r.overall_score)}`}>
            <div className="text-center shrink-0">
              <div className={`text-3xl font-black ${scoreColor(r.overall_score)}`}>{r.overall_score}</div>
              <div className="text-[9px] text-muted-foreground font-mono mt-0.5">/ 100</div>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Overall Score</p>
              <p className="text-[11px] text-foreground leading-relaxed">
                {r.overall_score >= 80 ? "Strong quality — publication-ready" : r.overall_score >= 65 ? "Good quality — minor improvements available" : "Needs improvement — see recommendations"}
              </p>
            </div>
          </div>
        </div>

        {/* Score breakdown */}
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Score Breakdown</p>
          <div className="space-y-2.5">
            {dims.map(({ label, score, color }) => (
              <div key={label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-foreground">{label}</span>
                  <span className={`text-[11px] font-bold tabular-nums ${scoreColor(score)}`}>{score}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-secondary/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${score}%` }}
                    transition={{ duration: 0.7, ease: "easeOut", delay: 0.1 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths */}
        {r.strengths.length > 0 && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-1.5 mb-2.5">
              <ThumbsUp className="h-3.5 w-3.5 text-green-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Strengths</p>
            </div>
            <div className="space-y-1.5">
              {r.strengths.map((s, i) => (
                <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-green-500/6 border border-green-500/12">
                  <Check className="h-3 w-3 text-green-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-foreground leading-relaxed">{s}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weaknesses */}
        {r.weaknesses.length > 0 && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-1.5 mb-2.5">
              <ThumbsDown className="h-3.5 w-3.5 text-red-400" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Weaknesses</p>
            </div>
            <div className="space-y-1.5">
              {r.weaknesses.map((w, i) => (
                <div key={i} className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-red-500/6 border border-red-500/12">
                  <AlertCircle className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-foreground leading-relaxed">{w}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations */}
        {r.improvement_recommendations.length > 0 && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-1.5 mb-2.5">
              <ListChecks className="h-3.5 w-3.5 text-primary" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Recommendations</p>
            </div>
            <div className="space-y-1.5">
              {r.improvement_recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg bg-primary/5 border border-primary/10">
                  <span className="text-[9px] font-black text-primary bg-primary/15 rounded px-1.5 py-0.5 shrink-0 mt-0.5 tabular-nums">{i + 1}</span>
                  <p className="text-[11px] text-foreground leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Re-evaluate */}
        <div className="px-4 pt-3">
          <button onClick={runEvaluation} disabled={isEvaluating}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-border/40 text-[11px] text-muted-foreground hover:text-foreground hover:border-border/80 hover:bg-secondary/20 transition-all disabled:opacity-40">
            <RefreshCw className="h-3 w-3" />Re-evaluate
          </button>
        </div>
      </div>
    )
  }

  // ─── Candidates tab ───────────────────────────────────────────────────────────

  const renderCandidatesTab = () => {
    if (candidates.length === 0) return (
      <div className="p-4 text-center py-10">
        <Trophy className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
        <p className="text-xs font-semibold text-foreground mb-1">Multi-Candidate Results</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Select Explore or Premium mode and generate to compare multiple website candidates.
        </p>
      </div>
    )

    const scoreColor = (s: number) => s >= 80 ? "text-green-400" : s >= 65 ? "text-yellow-400" : "text-red-400"
    const divColor = (s: number) => s >= 80 ? "text-green-400" : s >= 60 ? "text-yellow-400" : "text-red-400"
    const winner = comparisonReport?.winner ?? candidates.sort((a, b) => b.overallScore - a.overallScore)[0]?.label
    const ranked = comparisonReport?.ranking ?? candidates.slice().sort((a, b) => b.overallScore - a.overallScore).map(c => c.label)

    return (
      <div className="flex flex-col gap-0 pb-4">
        {/* Winner banner */}
        {winner && (
          <div className="px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2.5 p-3 rounded-xl border border-primary/25 bg-primary/6">
              <Crown className="h-5 w-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">AI Recommendation</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-[11px] text-foreground font-semibold">Candidate {winner} wins</p>
                  {(() => { const w = candidates.find(c => c.label === winner); return w ? (
                    <span className="text-[9px] font-semibold text-muted-foreground bg-secondary/40 px-1.5 py-0.5 rounded">
                      {DESIGN_SPACE_ICONS[w.designSpace as DesignSpaceName] ?? "◈"} {w.designSpace}
                    </span>
                  ) : null })()}
                </div>
                {comparisonReport?.reasoning && <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{comparisonReport.reasoning}</p>}
              </div>
            </div>
          </div>
        )}

        {/* V4.5: Diversity score panel */}
        {diversityInfo && (
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Design Diversity</p>
            <div className="flex items-center gap-3 mb-2">
              <div className="flex-1">
                <div className="h-1.5 rounded-full bg-secondary/40 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${diversityInfo.score}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: diversityInfo.score >= 80 ? "#22c55e" : diversityInfo.score >= 60 ? "#eab308" : "#ef4444" }}
                  />
                </div>
              </div>
              <span className={`text-sm font-black tabular-nums ${divColor(diversityInfo.score)}`}>{diversityInfo.score}</span>
              <span className="text-[9px] text-muted-foreground font-mono">/ 100</span>
            </div>
            {/* DNA breakdown */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {candidates.map(cand => (
                <div key={cand.id} className="bg-secondary/10 border border-border/20 rounded-lg p-2">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-[11px] leading-none">{DESIGN_SPACE_ICONS[cand.designSpace as DesignSpaceName] ?? "◈"}</span>
                    <span className="text-[9px] font-bold text-foreground">Candidate {cand.label}</span>
                  </div>
                  <p className="text-[9px] text-primary font-semibold truncate">{cand.designSpace}</p>
                  <div className="mt-1 space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-[8px] text-muted-foreground">Typography</span>
                      <span className="text-[8px] font-mono text-muted-foreground">{_dsTypographyDNA(cand.designSpace)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[8px] text-muted-foreground">Layout</span>
                      <span className="text-[8px] font-mono text-muted-foreground truncate ml-1" style={{ maxWidth: 70 }}>{_dsLayoutDNA(cand.designSpace)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[8px] text-muted-foreground">Spacing</span>
                      <span className="text-[8px] font-mono text-muted-foreground">{_dsSpacingDNA(cand.designSpace)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[8px] text-muted-foreground">Visual</span>
                      <span className="text-[8px] font-mono text-muted-foreground truncate ml-1" style={{ maxWidth: 70 }}>{_dsVisualDNA(cand.designSpace)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {/* Similarity flags */}
            {diversityInfo.flags.length > 0 && (
              <div className="space-y-1">
                {diversityInfo.flags.map((flag, i) => (
                  <div key={i} className="flex items-start gap-1.5 p-1.5 rounded-lg bg-yellow-400/6 border border-yellow-400/20">
                    <AlertCircle className="h-2.5 w-2.5 text-yellow-400 mt-0.5 shrink-0" />
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      Candidates {flag.labels[0]} &amp; {flag.labels[1]} share {flag.dimensions.join(", ")} DNA — consider regenerating
                    </p>
                  </div>
                ))}
              </div>
            )}
            {diversityInfo.flags.length === 0 && (
              <div className="flex items-center gap-1.5">
                <Check className="h-2.5 w-2.5 text-green-400 shrink-0" />
                <p className="text-[9px] text-muted-foreground">All candidates are genuinely distinct creative directions</p>
              </div>
            )}
          </div>
        )}

        {/* Candidate cards */}
        <div className="px-4 py-3 border-b border-border/30">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">
            {comparisonReport ? "Ranking" : "Candidates"}
          </p>
          <div className="space-y-2">
            {(ranked.length > 0 ? ranked : candidates.map(c => c.label)).map((label, rankIdx) => {
              const cand = candidates.find(c => c.label === label)
              if (!cand) return null
              const isActive = data === cand.websiteData || (data && JSON.stringify(data) === JSON.stringify(cand.websiteData))
              const isWinner = label === winner
              const rankBadge = rankIdx === 0 ? "🥇" : rankIdx === 1 ? "🥈" : rankIdx === 2 ? "🥉" : `#${rankIdx + 1}`
              return (
                <div key={cand.id}
                  className={`rounded-xl border p-3 transition-all cursor-pointer ${isActive ? "border-primary/40 bg-primary/8" : "border-border/30 hover:border-border/60 bg-secondary/10 hover:bg-secondary/20"}`}
                  onClick={() => setData(cand.websiteData)}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-base leading-none shrink-0">{rankBadge}</span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-foreground">Candidate {cand.label}</span>
                          {isWinner && <span className="text-[9px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded uppercase tracking-wide">Best</span>}
                          {isActive && <span className="text-[9px] font-bold text-blue-400 bg-blue-400/15 px-1.5 py-0.5 rounded uppercase tracking-wide">Viewing</span>}
                        </div>
                        {/* V4.5: Design space badge */}
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[10px] leading-none">{DESIGN_SPACE_ICONS[cand.designSpace as DesignSpaceName] ?? "◈"}</span>
                          <p className="text-[10px] text-primary font-semibold truncate">{cand.designSpace}</p>
                        </div>
                        <p className="text-[9px] text-muted-foreground/60 truncate">{cand.designVariant}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {cand.status === "evaluating" ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : cand.evaluationReport ? (
                        <div>
                          <span className={`text-lg font-black tabular-nums leading-none ${scoreColor(cand.overallScore)}`}>{cand.overallScore}</span>
                          <div className="text-[9px] text-muted-foreground font-mono">/ 100</div>
                        </div>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>
                  {/* Mini score bars */}
                  {cand.evaluationReport && (
                    <div className="grid grid-cols-5 gap-1 mt-1.5">
                      {[
                        { label: "Design", score: cand.evaluationReport.design_score, color: "#7c3aed" },
                        { label: "Conv", score: cand.evaluationReport.conversion_score, color: "#d4af37" },
                        { label: "UX", score: cand.evaluationReport.ux_score, color: "#0ea5e9" },
                        { label: "Copy", score: cand.evaluationReport.content_score, color: "#22c55e" },
                        { label: "Mobile", score: cand.evaluationReport.responsiveness_score, color: "#f97316" },
                      ].map(dim => (
                        <div key={dim.label} className="text-center">
                          <div className="h-1 rounded-full bg-secondary/40 mb-1 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${dim.score}%` }} transition={{ duration: 0.6, ease: "easeOut" }}
                              className="h-full rounded-full" style={{ backgroundColor: dim.color }} />
                          </div>
                          <span className="text-[8px] text-muted-foreground">{dim.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Use button */}
                  {!isActive && (
                    <button onClick={e => { e.stopPropagation(); setData(cand.websiteData) }}
                      className="mt-2 w-full py-1 rounded-lg text-[10px] font-semibold text-primary border border-primary/20 hover:bg-primary/10 transition-colors">
                      Preview this design
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Strengths/weaknesses by candidate from comparison */}
        {comparisonReport && (
          <div className="px-4 py-3 border-b border-border/30">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Analysis by Candidate</p>
            {candidates.map(cand => (
              <div key={cand.id} className="mb-3 last:mb-0">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[11px] leading-none">{DESIGN_SPACE_ICONS[cand.designSpace as DesignSpaceName] ?? "◈"}</span>
                  <p className="text-[10px] font-bold text-foreground">Candidate {cand.label}</p>
                  <span className="text-[9px] text-primary font-semibold bg-primary/10 px-1.5 py-0.5 rounded">{cand.designSpace}</span>
                </div>
                {(comparisonReport.strengths_by_candidate[cand.label] ?? []).map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <Check className="h-2.5 w-2.5 text-green-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{s}</p>
                  </div>
                ))}
                {(comparisonReport.weaknesses_by_candidate[cand.label] ?? []).map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 mb-1">
                    <AlertCircle className="h-2.5 w-2.5 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">{w}</p>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // ─── Sidebar tabs config ──────────────────────────────────────────────────────

  const sidebarTabs: { id: SidebarTab; icon: typeof Globe; label: string }[] = [
    { id: "design", icon: Palette, label: "Design" },
    { id: "edit", icon: Pencil, label: "Edit" },
    { id: "strategy", icon: Target, label: "Strategy" },
    { id: "intelligence", icon: Brain, label: "AI Audit" },
    { id: "evaluation", icon: Star, label: "Evaluate" },
    ...(candidates.length > 0 ? [{ id: "candidates" as SidebarTab, icon: Trophy, label: `A/B (${candidates.length})` }] : []),
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

        {/* Right: mode selector + actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {savedStatus !== "idle" && (
            <span className={`text-[10px] font-medium transition-all ${savedStatus === "saved" ? "text-green-400" : "text-muted-foreground"}`}>
              {savedStatus === "saving" ? "Saving…" : "✓ Saved"}
            </span>
          )}
          {/* Generation mode selector */}
          <div className="flex items-center rounded-lg border border-border/40 bg-secondary/20 overflow-hidden" title="Generation mode">
            {(["standard", "explore", "premium"] as GenerationMode[]).map(mode => (
              <button key={mode} onClick={() => setGenerationMode(mode)} disabled={isGenerating}
                className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-all ${generationMode === mode ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"} disabled:opacity-40`}
                title={mode === "standard" ? "1 candidate" : mode === "explore" ? "3 candidates" : "5 candidates"}>
                {mode === "standard" ? "1×" : mode === "explore" ? "3×" : "5×"}
              </button>
            ))}
          </div>
          <button onClick={generate} disabled={isGenerating}
            title="Generate website"
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
                {!data && sidebarTab !== "intelligence" && sidebarTab !== "candidates" && sidebarTab !== "evaluation" ? (
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
                    {sidebarTab === "evaluation" && renderEvaluationTab()}
                    {sidebarTab === "candidates" && renderCandidatesTab()}
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
                candidateProgress={candidateProgress}
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
