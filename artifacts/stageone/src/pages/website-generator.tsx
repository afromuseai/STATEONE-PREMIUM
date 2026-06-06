import { useState, useRef, useCallback, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe, Sparkles, RotateCcw, Download, Monitor, Tablet, Smartphone,
  ChevronDown, Check, Pencil, RefreshCw, Copy, FileCode, ArrowLeft,
  Layers, Loader2, X, ChevronRight, Zap, Lock, Crown,
} from "lucide-react"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import { buildPreviewHtml, buildNextjsProject, type WebsiteOutput } from "@/lib/website-html-generator"
import { loadGenerationContext, clearGenerationContext, consumeCopilotAutorun, consumeMarcusWorkspaceSignal, setMarcusWorkspaceSignal, consumeMarcusWebsiteGenerateIntent } from "@/lib/generation-context"
import { useWorkspaceController } from "@/lib/workspace-controller-context"
import JSZip from "jszip"

// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "input" | "generating" | "done"
type StyleOption = "SaaS" | "Corporate" | "Startup" | "Luxury" | "Cyberpunk" | "Minimal"
type ToneOption = "Professional" | "Futuristic" | "Corporate" | "Friendly" | "Premium"
type Device = "desktop" | "tablet" | "mobile"
type SectionKey = "hero" | "features" | "testimonials" | "pricing" | "cta" | "faq" | "footer"

const STYLES: { key: StyleOption; desc: string; color: string; bg: string }[] = [
  { key: "SaaS", desc: "Linear / Vercel", color: "#8b5cf6", bg: "#8b5cf615" },
  { key: "Corporate", desc: "Enterprise grade", color: "#3b82f6", bg: "#3b82f615" },
  { key: "Startup", desc: "Bold & energetic", color: "#f97316", bg: "#f9731615" },
  { key: "Luxury", desc: "Ultra-premium", color: "#d4af37", bg: "#d4af3715" },
  { key: "Cyberpunk", desc: "Neon futuristic", color: "#00f5ff", bg: "#00f5ff15" },
  { key: "Minimal", desc: "Clean whitespace", color: "#e5e5e5", bg: "#e5e5e510" },
]

const TONES: ToneOption[] = ["Professional", "Futuristic", "Corporate", "Friendly", "Premium"]

const SECTIONS: { key: SectionKey; label: string; icon: React.ReactNode }[] = [
  { key: "hero", label: "Hero", icon: <Zap className="h-3.5 w-3.5" /> },
  { key: "features", label: "Features", icon: <Layers className="h-3.5 w-3.5" /> },
  { key: "testimonials", label: "Testimonials", icon: <Sparkles className="h-3.5 w-3.5" /> },
  { key: "pricing", label: "Pricing", icon: <Globe className="h-3.5 w-3.5" /> },
  { key: "cta", label: "Call to Action", icon: <Zap className="h-3.5 w-3.5" /> },
  { key: "faq", label: "FAQ", icon: <ChevronDown className="h-3.5 w-3.5" /> },
  { key: "footer", label: "Footer", icon: <Layers className="h-3.5 w-3.5" /> },
]

const GEN_STEPS = [
  "Analyzing your business concept",
  "Designing color palette & typography",
  "Crafting hero section copy",
  "Building features & value props",
  "Writing testimonials & social proof",
  "Structuring pricing strategy",
  "Generating CTA & FAQ content",
  "Finalizing footer & SEO metadata",
]

const DEVICE_WIDTHS: Record<Device, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "390px",
}

// ─── Editable field config ────────────────────────────────────────────────────
type FieldSpec = { key: string; label: string; multiline?: boolean }
const SECTION_FIELDS: Record<SectionKey, FieldSpec[]> = {
  hero: [
    { key: "badge", label: "Eyebrow badge" },
    { key: "headline", label: "Main headline", multiline: true },
    { key: "subheadline", label: "Subheadline", multiline: true },
    { key: "ctaPrimary", label: "Primary CTA" },
    { key: "ctaSecondary", label: "Secondary CTA" },
    { key: "socialProof", label: "Social proof" },
  ],
  features: [
    { key: "title", label: "Section title" },
    { key: "subtitle", label: "Subtitle" },
  ],
  testimonials: [{ key: "title", label: "Section title" }],
  pricing: [
    { key: "title", label: "Section title" },
    { key: "subtitle", label: "Subtitle" },
  ],
  cta: [
    { key: "headline", label: "Headline", multiline: true },
    { key: "subheadline", label: "Subheadline", multiline: true },
    { key: "buttonText", label: "Button text" },
    { key: "subtext", label: "Small print" },
  ],
  faq: [{ key: "title", label: "Section title" }],
  footer: [
    { key: "tagline", label: "Brand tagline" },
    { key: "legal", label: "Legal text" },
  ],
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WebsiteGeneratorPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [step, setStep] = useState<Step>("input")
  const [idea, setIdea] = useState("")
  const [style, setStyle] = useState<StyleOption>("SaaS")
  const [tone, setTone] = useState<ToneOption>("Professional")
  const [data, setData] = useState<WebsiteOutput | null>(null)
  const [previewHtml, setPreviewHtml] = useState("")
  const [device, setDevice] = useState<Device>("desktop")
  const [activeSection, setActiveSection] = useState<SectionKey>("hero")
  const [genStep, setGenStep] = useState(0)
  const [genError, setGenError] = useState("")
  const [regenSectionKey, setRegenSectionKey] = useState<SectionKey | null>(null)
  const [showExport, setShowExport] = useState(false)
  const [copied, setCopied] = useState(false)
  const [contextBanner, setContextBanner] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const [autorunIdea, setAutorunIdea] = useState<string | null>(null)
  const [marcusPopulateTick, setMarcusPopulateTick] = useState(0)
  const [marcusTriggerGenerate, setMarcusTriggerGenerate] = useState(false)
  const [isTyping, setIsTyping] = useState(false)
  const { openUpgradeModal } = useUpgradeModal()
  const { subscribeWorkspaceSignal } = useWorkspaceController()
  const exportRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const ideaTextareaRef = useRef<HTMLTextAreaElement>(null)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const marcusWebsiteIdeaRef = useRef<string>("")
  // Holds the text to type — written before incrementing marcusPopulateTick.
  // A ref (not state) so clearing it inside the typewriter effect does NOT
  // cause a re-render → effect cleanup never runs → interval is never killed.
  const marcusPopulateRef = useRef<string>("")
  // Always-current mirror of the textarea `idea` state — safe to read in stale closures
  const ideaRef = useRef<string>("")

  // Check subscription tier
  useEffect(() => {
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription?.plan === "free") setIsLocked(true) })
      .catch(() => {})
  }, [])

  // Auto-fill from business intelligence context or Copilot autorun
  useEffect(() => {
    // Copilot autorun takes priority — it carries the idea directly
    const autorun = consumeCopilotAutorun()
    if (autorun?.action === "generate_website" && autorun.idea) {
      setContextBanner(true)
      // Let the component mount before starting typewriter
      setTimeout(() => setAutorunIdea(autorun.idea!), 150)
      return
    }

    // Fallback: auto-fill from saved business intelligence context
    const ctx = loadGenerationContext()
    if (!ctx) return
    clearGenerationContext()
    const ideaText = ctx.idea || ctx.businessSnapshot || ""
    if (ideaText) {
      setContextBanner(true)
      const industryStyleMap: Record<string, StyleOption> = {
        "SaaS": "SaaS",
        "Cybersecurity": "SaaS",
        "Fintech": "Corporate",
        "Healthcare": "Corporate",
        "E-commerce": "Startup",
        "Marketplace": "Startup",
        "Education": "Startup",
        "Agency": "Minimal",
        "Creator Economy": "Startup",
        "Luxury": "Luxury",
      }
      if (ctx.industry && industryStyleMap[ctx.industry]) {
        setStyle(industryStyleMap[ctx.industry])
      }
      setTimeout(() => setAutorunIdea(ideaText), 150)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Keep ideaRef in sync with textarea state ────────────────────────────────
  // (allows the subscriber closure to read the current textarea value without
  //  stale-closure issues — refs are always current even in old closures)
  useEffect(() => { ideaRef.current = idea }, [idea])

  // ─── Marcus workspace signal (on mount — cross-navigation delivery) ──────────
  useEffect(() => {
    console.log("[POPULATE TRACE 7] mount effect running — calling consumeMarcusWorkspaceSignal")
    console.log("[POPULATE TRACE 6] sessionStorage at mount:", sessionStorage.getItem("marcus_workspace_signal"))
    const signal = consumeMarcusWorkspaceSignal()
    console.log("[POPULATE TRACE 8] consumeMarcusWorkspaceSignal returned:", JSON.stringify(signal))
    if (signal?.target === "website" && signal.type === "populate" && signal.payload) {
      const text = signal.payload
      marcusWebsiteIdeaRef.current = text
      ideaRef.current = text
      setContextBanner(true)
      setTimeout(() => {
        marcusPopulateRef.current = text
        setMarcusPopulateTick(t => t + 1)
      }, 150)
    } else {
      console.log("[POPULATE TRACE 8] signal failed condition check — target:", signal?.target, "| type:", signal?.type, "| payload:", signal?.payload ?? "(none)", "| signal null?", signal === null)
    }
    // Consume persisted generate intent — survives navigation race condition
    // (set by Marcus dispatcher before the page has mounted and subscribed)
    if (consumeMarcusWebsiteGenerateIntent()) {
      setMarcusTriggerGenerate(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Marcus generate trigger (cross-navigation) ───────────────────────────────
  // Fires generation when a persisted generate intent is consumed on mount.
  // Uses a state flag so generateWithIdea captures current style/tone values.
  useEffect(() => {
    if (!marcusTriggerGenerate) return
    setMarcusTriggerGenerate(false)
    const text = marcusWebsiteIdeaRef.current || ideaRef.current
    if (text.trim()) generateWithIdea(text)
  }, [marcusTriggerGenerate]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Marcus workspace signal (live — for when page is already mounted) ────────
  useEffect(() => {
    console.log("[TRACE] WEBSITE subscriber registered")
    const unsub = subscribeWorkspaceSignal((signal) => {
      console.log("[TRACE] WEBSITE receiver got signal | target:", signal.target, "| type:", signal.type, "| payload:", signal.payload ?? "(none)")
      console.log("[WEBSITE TRACE] receiver got signal | target:", signal.target, "| type:", signal.type, "| payload:", signal.payload ?? "(none)")
      if (signal.target !== "website") return
      if (signal.type === "populate" && signal.payload) {
        const text = signal.payload
        marcusWebsiteIdeaRef.current = text
        ideaRef.current = text
        setContextBanner(true)
        marcusPopulateRef.current = text
        setMarcusPopulateTick(t => t + 1)
      } else if (signal.type === "generate") {
        console.log("[TRACE] WEBSITE generate handler entered | marcusRef:", marcusWebsiteIdeaRef.current || "(empty)", "| ideaRef:", ideaRef.current || "(empty)")
        // Use marcusWebsiteIdeaRef first; fall back to ideaRef (always-current textarea value)
        // so generation still works even if the page remounted and cleared marcusWebsiteIdeaRef
        const text = marcusWebsiteIdeaRef.current || ideaRef.current
        console.log("[WEBSITE TRACE] generate signal | marcusRef:", marcusWebsiteIdeaRef.current || "(empty)", "| ideaRef:", ideaRef.current || "(empty)", "| using:", text || "(empty)")
        if (text.trim()) {
          console.log("[TRACE] WEBSITE calling generateWithIdea | text:", text)
          generateWithIdea(text)
        }
      }
    })
    return () => {
      console.log("[TRACE] WEBSITE subscriber removed")
      unsub()
    }
  }, [subscribeWorkspaceSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Marcus populate typewriter: types live but does NOT auto-generate ────────
  // (generation is triggered separately by the explicit "generate" signal)
  // ─── Marcus populate typewriter ───────────────────────────────────────────────
  // Uses a counter (marcusPopulateTick) as the dep, not the text string.
  // The text lives in marcusPopulateRef — clearing a ref does NOT cause a
  // re-render, so the effect's cleanup (clearInterval) never fires prematurely.
  //
  // Previous bug: dep was `marcusPopulate` (string state). Calling
  // `setMarcusPopulate(null)` inside the effect changed the dep, which caused
  // React to run cleanup (clearInterval) ~1–2ms after the interval was created
  // via MessageChannel — long before the first 18ms tick. The typewriter was
  // killed before typing a single character.
  useEffect(() => {
    const text = marcusPopulateRef.current
    if (!text) return
    marcusPopulateRef.current = "" // clear ref — no re-render, no cleanup triggered

    setIdea("")
    setIsTyping(true)
    ideaTextareaRef.current?.focus()

    let i = 0
    if (typewriterRef.current) clearInterval(typewriterRef.current)
    typewriterRef.current = setInterval(() => {
      i++
      setIdea(text.slice(0, i))
      if (ideaTextareaRef.current) {
        ideaTextareaRef.current.scrollTop = ideaTextareaRef.current.scrollHeight
      }
      if (i >= text.length) {
        clearInterval(typewriterRef.current!)
        typewriterRef.current = null
        setIsTyping(false)
      }
    }, 18)

    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current)
    }
  }, [marcusPopulateTick]) // eslint-disable-line react-hooks/exhaustive-deps

  // Typewriter autorun: type the idea live, then auto-submit
  useEffect(() => {
    if (!autorunIdea) return
    setAutorunIdea(null) // consume immediately so it doesn't re-fire

    const text = autorunIdea
    setIdea("")
    setIsTyping(true)
    ideaTextareaRef.current?.focus()

    let i = 0
    if (typewriterRef.current) clearInterval(typewriterRef.current)
    typewriterRef.current = setInterval(() => {
      i++
      setIdea(text.slice(0, i))
      if (ideaTextareaRef.current) {
        ideaTextareaRef.current.scrollTop = ideaTextareaRef.current.scrollHeight
      }
      if (i >= text.length) {
        clearInterval(typewriterRef.current!)
        typewriterRef.current = null
        setIsTyping(false)
        // Brief pause so user sees the completed prompt, then run
        setTimeout(() => generateWithIdea(text), 500)
      }
    }, 18)

    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current)
    }
  }, [autorunIdea]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close export dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (showExport && exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExport(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showExport])

  // Animate gen steps
  useEffect(() => {
    if (step !== "generating") return
    setGenStep(0)
    const interval = setInterval(() => {
      setGenStep(s => (s < GEN_STEPS.length - 1 ? s + 1 : s))
    }, 2200)
    return () => clearInterval(interval)
  }, [step])

  const updatePreview = useCallback((d: WebsiteOutput) => {
    setPreviewHtml(buildPreviewHtml(d))
  }, [])

  const generateWithIdea = async (ideaOverride: string) => {
    console.log("[TRACE] generateWithIdea entered | idea:", ideaOverride || "(empty)")
    console.log("[WEBSITE TRACE] generateWithIdea entered | idea:", ideaOverride || "(empty)")
    if (!ideaOverride.trim()) return
    setGenError("")
    setStep("generating")
    abortRef.current = new AbortController()
    let buffer = ""
    try {
      const res = await fetch("/api/generate/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: ideaOverride.trim(), style, tone }),
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error("Request failed")
      if (!res.body) throw new Error("No response stream")
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.content) buffer += msg.content
            if (msg.error) { setGenError(msg.error); setStep("input"); return }
            if (msg.done && msg.data) {
              const out = msg.data as WebsiteOutput
              setData(out)
              updatePreview(out)
              setStep("done")
              return
            }
          } catch { /* fragment */ }
        }
      }
      setGenError("Generation ended unexpectedly. Try again."); setStep("input")
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") { setStep("input"); return }
      setGenError("Connection error. Check your API key and try again.")
      setStep("input")
    }
  }

  const generate = async () => {
    if (!idea.trim()) return
    setGenError("")
    setStep("generating")
    abortRef.current = new AbortController()
    let buffer = ""

    try {
      const res = await fetch("/api/generate/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: idea.trim(), style, tone }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) throw new Error("Request failed")
      if (!res.body) throw new Error("No response stream")

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.content) buffer += msg.content
            if (msg.error) { setGenError(msg.error); setStep("input"); return }
            if (msg.done && msg.data) {
              const out = msg.data as WebsiteOutput
              setData(out)
              updatePreview(out)
              setStep("done")
              return
            }
          } catch { /* fragment */ }
        }
      }
      setGenError("Generation ended unexpectedly. Try again."); setStep("input")
    } catch (err: unknown) {
      if ((err as Error).name === "AbortError") { setStep("input"); return }
      setGenError("Connection error. Check your API key and try again.")
      setStep("input")
    }
  }

  const regenSection = async (sectionKey: SectionKey) => {
    if (!data || !idea.trim()) return
    setRegenSectionKey(sectionKey)
    let buffer = ""

    try {
      const res = await fetch("/api/generate/website/section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea, style, tone, sectionName: sectionKey, currentData: data }),
      })
      if (!res.ok || !res.body) throw new Error("Request failed")
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.content) buffer += msg.content
            if (msg.done && msg.section && msg.data) {
              const updated = { ...data, sections: { ...data.sections, [msg.section]: msg.data } }
              setData(updated)
              updatePreview(updated)
            }
          } catch { /* fragment */ }
        }
      }
    } catch { /* silent */ }
    setRegenSectionKey(null)
  }

  const patchSection = (sectionKey: SectionKey, fieldKey: string, value: string) => {
    if (!data) return
    const updated = {
      ...data,
      sections: {
        ...data.sections,
        [sectionKey]: { ...(data.sections as Record<string, unknown>)[sectionKey] as object, [fieldKey]: value },
      },
    } as WebsiteOutput
    setData(updated)
    updatePreview(updated)
  }

  const copyHtml = async () => {
    await navigator.clipboard.writeText(previewHtml)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const downloadHtml = () => {
    const blob = new Blob([previewHtml], { type: "text/html" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `${data?.brand?.name?.toLowerCase().replace(/\s+/g, "-") ?? "website"}.html`
    a.click(); URL.revokeObjectURL(url)
  }

  const downloadZip = async () => {
    if (!data) return
    const files = buildNextjsProject(data)
    const zip = new JSZip()
    const root = zip.folder(data.brand?.name?.toLowerCase().replace(/\s+/g, "-") ?? "website")!
    for (const [path, content] of Object.entries(files)) {
      const parts = path.split("/")
      if (parts.length === 1) root.file(path, content)
      else {
        let dir = root
        for (let i = 0; i < parts.length - 1; i++) dir = dir.folder(parts[i])!
        dir.file(parts[parts.length - 1], content)
      }
    }
    const blob = await zip.generateAsync({ type: "blob" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `${data.brand?.name?.toLowerCase().replace(/\s+/g, "-") ?? "website"}-nextjs.zip`
    a.click(); URL.revokeObjectURL(url)
  }

  // ─── Section field value getter ─────────────────────────────────────────
  const getSectionField = (sectionKey: SectionKey, fieldKey: string): string => {
    if (!data) return ""
    const section = (data.sections as Record<string, unknown>)[sectionKey] as Record<string, unknown>
    const val = section?.[fieldKey]
    return typeof val === "string" ? val : ""
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

      {/* Locked overlay for free users */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ left: sidebarCollapsed ? 64 : 220 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-primary/25 bg-[#0c0c0c] p-8 shadow-2xl mx-4"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                <Globe className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">AI Website Builder</h3>
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                    <Lock className="h-2.5 w-2.5" /> Pro
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to unlock this system</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Generate a complete, launch-ready website with AI — including copy, design system, React + Tailwind components, live preview, and one-click Next.js export.
            </p>
            <div className="rounded-xl border border-white/5 bg-white/2 p-4 mb-6 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3">Included with Pro</p>
              {["Auto-filled from business intelligence", "8-section AI website (hero, features, pricing…)", "Live browser preview with mobile toggle", "Editable sections & inline text editing", "React + Tailwind component code", "One-click Next.js 14 ZIP export"].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <button onClick={openUpgradeModal} className="flex w-full h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow">
              <Crown className="h-3.5 w-3.5" />
              Upgrade to Pro
            </button>
          </motion.div>
        </div>
      )}

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* ─── LEFT PANEL ─────────────────────────────────────── */}
        <div className="w-[380px] shrink-0 border-r border-white/5 flex flex-col bg-[#090909] overflow-hidden">
          <AnimatePresence mode="wait">
            {step === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col flex-1 min-h-0 overflow-y-auto"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-xl bg-primary/15 border border-primary/25">
                      <Globe className="h-4 w-4 text-primary" />
                    </div>
                    <h1 className="text-base font-bold text-foreground tracking-tight">Website Generator</h1>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Describe your business and we'll build a premium, launch-ready website.
                  </p>
                  {contextBanner && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-[11px] text-primary/80 font-medium">Auto-filled from your business intelligence</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* Idea textarea */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Business Idea
                    </label>
                    <textarea
                      ref={ideaTextareaRef}
                      value={idea}
                      onChange={e => { if (!isTyping) setIdea(e.target.value) }}
                      readOnly={isTyping}
                      placeholder="e.g. AI-powered project management tool for remote engineering teams..."
                      className="w-full h-28 px-3 py-3 rounded-xl bg-white/3 border border-white/8 text-sm text-foreground placeholder-muted-foreground/50 resize-none outline-none focus:border-primary/40 focus:bg-primary/3 transition-all"
                    />
                  </div>

                  {genError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <X className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>{genError}</span>
                    </div>
                  )}

                  {/* Style selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                      Website Style
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {STYLES.map(s => (
                        <button
                          key={s.key}
                          onClick={() => setStyle(s.key)}
                          className={`relative flex flex-col items-start gap-1 p-3 rounded-xl border text-left transition-all ${
                            style === s.key
                              ? "border-primary/50 bg-primary/8 shadow-[0_0_12px_rgba(212,175,55,0.1)]"
                              : "border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                            {style === s.key && <Check className="h-3 w-3 text-primary" />}
                          </div>
                          <div className="text-xs font-bold text-foreground mt-0.5">{s.key}</div>
                          <div className="text-[10px] text-muted-foreground">{s.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone selector */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">
                      Brand Tone
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map(t => (
                        <button
                          key={t}
                          onClick={() => setTone(t)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            tone === t
                              ? "bg-primary/15 border-primary/40 text-primary"
                              : "bg-white/3 border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <div className="px-5 py-4 border-t border-white/5 shrink-0">
                  <button
                    onClick={generate}
                    disabled={!idea.trim()}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-[0_0_24px_rgba(212,175,55,0.3)] active:scale-[0.98]"
                  >
                    <Sparkles className="h-4 w-4" />
                    Generate Website
                  </button>
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-2">
                    ~30–60 seconds · AI-powered generation
                  </p>
                </div>
              </motion.div>
            )}

            {step === "generating" && (
              <motion.div
                key="generating"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col flex-1 min-h-0 items-center justify-center px-6"
              >
                <div className="w-full max-w-[280px]">
                  {/* Animated logo */}
                  <div className="flex justify-center mb-8">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <Globe className="h-7 w-7 text-primary" />
                      </div>
                      <div className="absolute -inset-1 rounded-[20px] border border-primary/20 animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-center text-base font-bold text-foreground mb-2">Building your website</h2>
                  <p className="text-center text-xs text-muted-foreground mb-8">
                    <span className="text-primary font-semibold">{style}</span> · <span className="text-primary/80">{tone}</span>
                  </p>

                  {/* Steps list */}
                  <div className="space-y-2.5">
                    {GEN_STEPS.map((s, i) => (
                      <motion.div
                        key={s}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: i <= genStep ? 1 : 0.25, x: 0 }}
                        transition={{ duration: 0.3, delay: i * 0.1 }}
                        className="flex items-center gap-3"
                      >
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                          i < genStep ? "bg-primary/20 border-primary/50" : i === genStep ? "border-primary animate-pulse" : "border-white/10"
                        }`}>
                          {i < genStep ? (
                            <Check className="h-3 w-3 text-primary" />
                          ) : i === genStep ? (
                            <Loader2 className="h-3 w-3 text-primary animate-spin" />
                          ) : null}
                        </div>
                        <span className={`text-xs transition-colors ${i <= genStep ? "text-foreground" : "text-muted-foreground/40"}`}>
                          {s}
                        </span>
                      </motion.div>
                    ))}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-8 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      animate={{ width: `${((genStep + 1) / GEN_STEPS.length) * 100}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground mt-3">
                    {Math.round(((genStep + 1) / GEN_STEPS.length) * 100)}% complete
                  </p>

                  <button
                    onClick={() => { abortRef.current?.abort(); setStep("input") }}
                    className="mt-8 w-full text-xs text-muted-foreground hover:text-foreground border border-white/8 py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {step === "done" && data && (
              <motion.div
                key="done"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col flex-1 min-h-0 overflow-hidden"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
                  <button
                    onClick={() => setStep("input")}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> New Website
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25 text-primary font-semibold">{style}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{tone}</span>
                  </div>
                </div>

                {/* Brand info */}
                <div className="px-4 py-3 border-b border-white/5 shrink-0">
                  <div className="text-sm font-bold text-foreground truncate">{data.brand?.name}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{data.brand?.tagline}</div>
                </div>

                {/* Design chips */}
                <div className="px-4 py-2.5 border-b border-white/5 shrink-0 flex items-center gap-2 flex-wrap">
                  {data.colorPalette && (
                    <div className="flex gap-1.5">
                      {[data.colorPalette.primary, data.colorPalette.secondary, data.colorPalette.accent, data.colorPalette.surface, data.colorPalette.background].map((c, i) => (
                        <div key={i} title={c} className="h-4 w-4 rounded-full border border-white/10 cursor-pointer" style={{ background: c }} onClick={() => navigator.clipboard.writeText(c)} />
                      ))}
                    </div>
                  )}
                  <span className="text-[10px] text-muted-foreground">{data.typography?.headingFont}</span>
                </div>

                {/* Section Navigator */}
                <div className="px-3 py-2 border-b border-white/5 shrink-0">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2 px-1">Sections</p>
                  <div className="space-y-0.5">
                    {SECTIONS.map(({ key, label, icon }) => (
                      <div
                        key={key}
                        onClick={() => setActiveSection(key)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer transition-all group ${
                          activeSection === key
                            ? "bg-primary/10 border border-primary/20 text-primary"
                            : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"
                        }`}
                      >
                        <span className="shrink-0">{icon}</span>
                        <span className="text-xs font-medium flex-1 truncate">{label}</span>
                        <button
                          onClick={e => { e.stopPropagation(); regenSection(key) }}
                          className={`opacity-0 group-hover:opacity-100 p-1 rounded-lg transition-all hover:bg-white/10 ${activeSection === key ? "opacity-100" : ""}`}
                          title="Regenerate section"
                        >
                          {regenSectionKey === key ? (
                            <Loader2 className="h-3 w-3 animate-spin text-primary" />
                          ) : (
                            <RefreshCw className="h-3 w-3" />
                          )}
                        </button>
                        {activeSection === key && <ChevronRight className="h-3 w-3 shrink-0" />}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Section Editor */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Pencil className="h-3 w-3 text-primary" />
                    <p className="text-[11px] font-semibold text-muted-foreground/80 uppercase tracking-wider">
                      Edit · {SECTIONS.find(s => s.key === activeSection)?.label}
                    </p>
                  </div>
                  <div className="space-y-3">
                    {(SECTION_FIELDS[activeSection] ?? []).map(({ key: fieldKey, label, multiline }) => (
                      <div key={fieldKey}>
                        <label className="block text-[10px] font-semibold text-muted-foreground mb-1 uppercase tracking-wider">{label}</label>
                        {multiline ? (
                          <textarea
                            className="w-full px-3 py-2 rounded-lg bg-white/3 border border-white/8 text-xs text-foreground resize-none outline-none focus:border-primary/40 transition-all leading-relaxed"
                            rows={3}
                            value={getSectionField(activeSection, fieldKey)}
                            onChange={e => patchSection(activeSection, fieldKey, e.target.value)}
                          />
                        ) : (
                          <input
                            className="w-full px-3 py-2 rounded-lg bg-white/3 border border-white/8 text-xs text-foreground outline-none focus:border-primary/40 transition-all"
                            value={getSectionField(activeSection, fieldKey)}
                            onChange={e => patchSection(activeSection, fieldKey, e.target.value)}
                          />
                        )}
                      </div>
                    ))}
                    {(SECTION_FIELDS[activeSection]?.length ?? 0) === 0 && (
                      <p className="text-xs text-muted-foreground/60">Use the regenerate button to refresh this section's content.</p>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── RIGHT PANEL (PREVIEW) ────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#050505]">
          {/* Toolbar */}
          <div className="h-12 shrink-0 border-b border-white/5 flex items-center justify-between px-4 gap-3">
            {/* Device toggles */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-white/4 border border-white/6">
              {(["desktop", "tablet", "mobile"] as Device[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  title={d.charAt(0).toUpperCase() + d.slice(1)}
                  className={`p-1.5 rounded-lg transition-all ${
                    device === d ? "bg-primary/20 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {d === "desktop" ? <Monitor className="h-3.5 w-3.5" /> : d === "tablet" ? <Tablet className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>

            {/* Center status */}
            {step === "done" && data && (
              <div className="flex-1 flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span className="text-xs text-muted-foreground font-medium">{data.brand?.name}</span>
                  <span className="text-[10px] text-muted-foreground/40">· {DEVICE_WIDTHS[device] === "100%" ? "Desktop" : DEVICE_WIDTHS[device]}</span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-2">
              {step === "done" && (
                <>
                  <button
                    onClick={generate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all"
                  >
                    <RotateCcw className="h-3 w-3" /> Regenerate
                  </button>

                  {/* Export dropdown */}
                  <div className="relative" ref={exportRef}>
                    <button
                      onClick={() => setShowExport(v => !v)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-all"
                    >
                      <Download className="h-3 w-3" /> Export <ChevronDown className="h-3 w-3" />
                    </button>
                    <AnimatePresence>
                      {showExport && (
                        <motion.div
                          initial={{ opacity: 0, y: -4, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: -4, scale: 0.97 }}
                          transition={{ duration: 0.12 }}
                          className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 bg-[#111] shadow-2xl overflow-hidden z-50"
                        >
                          <div className="p-1">
                            <button onClick={copyHtml} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-left">
                              <Copy className="h-4 w-4 text-primary/70" />
                              {copied ? "Copied!" : "Copy HTML"}
                            </button>
                            <button onClick={downloadHtml} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-left">
                              <Download className="h-4 w-4 text-primary/70" />
                              Download HTML
                            </button>
                            <button onClick={downloadZip} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors text-left">
                              <FileCode className="h-4 w-4 text-primary/70" />
                              Next.js ZIP Project
                            </button>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Preview area */}
          <div className="flex-1 min-h-0 overflow-hidden flex items-start justify-center bg-[#030303] relative">
            {step === "input" && (
              <div className="flex flex-col items-center justify-center h-full text-center px-12">
                <div className="p-5 rounded-3xl bg-white/3 border border-white/6 mb-6">
                  <Globe className="h-10 w-10 text-muted-foreground/30" />
                </div>
                <h3 className="text-lg font-bold text-foreground/80 mb-2">Your website preview</h3>
                <p className="text-sm text-muted-foreground/60 max-w-[280px] leading-relaxed">
                  Fill in your business idea and click Generate. Your live website will appear here.
                </p>
                <div className="mt-6 flex gap-3 flex-wrap justify-center">
                  {["Hero", "Features", "Pricing", "FAQ"].map(s => (
                    <div key={s} className="px-3 py-1.5 rounded-full border border-white/8 bg-white/3 text-xs text-muted-foreground/60">{s}</div>
                  ))}
                </div>
              </div>
            )}

            {step === "generating" && (
              <div className="flex flex-col items-center justify-center h-full gap-6 px-12">
                {/* Skeleton preview blocks */}
                <div className="w-full max-w-2xl space-y-4">
                  {[120, 200, 160, 140, 180].map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: [0.05, 0.12, 0.05], y: 0 }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                      className="rounded-2xl bg-white/5 border border-white/4"
                      style={{ height: h }}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === "done" && previewHtml && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4 }}
                className="w-full h-full flex items-start justify-center overflow-auto py-0"
                style={{ background: "repeating-linear-gradient(45deg, transparent, transparent 16px, rgba(255,255,255,.008) 16px, rgba(255,255,255,.008) 17px)" }}
              >
                <motion.div
                  animate={{ width: DEVICE_WIDTHS[device] }}
                  transition={{ duration: 0.35, ease: "easeInOut" }}
                  className="h-full shrink-0 overflow-hidden shadow-2xl"
                  style={{ minHeight: "100%" }}
                >
                  {/* Browser chrome */}
                  <div className="h-9 bg-[#1a1a1a] border-b border-white/10 flex items-center px-3 gap-2 shrink-0">
                    <div className="flex gap-1.5">
                      <div className="h-3 w-3 rounded-full bg-red-500/70" />
                      <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                      <div className="h-3 w-3 rounded-full bg-green-500/70" />
                    </div>
                    <div className="flex-1 mx-3 h-5 bg-white/5 rounded-md flex items-center px-2">
                      <span className="text-[10px] text-muted-foreground/40 truncate">{data?.brand?.name?.toLowerCase().replace(/\s+/g, "-")}.com</span>
                    </div>
                  </div>
                  <iframe
                    srcDoc={previewHtml}
                    className="w-full border-0"
                    style={{ height: "calc(100% - 36px)" }}
                    title="Website Preview"
                    sandbox="allow-same-origin allow-scripts"
                  />
                </motion.div>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
