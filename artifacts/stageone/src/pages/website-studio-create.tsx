// ─── Website Studio Create — Replit-style streaming generation ────────────────
// New project creation flow:
//   1. Input screen (idea + business context)
//   2. Generation screen (Marcus streams files token-by-token into Monaco)
//   3. Auto-redirect to workspace when done

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe, Sparkles, ArrowLeft, ChevronRight, Loader2,
  ArrowRight, Wand2, Building2, Users, Target, Tag,
} from "lucide-react"
import { useLocation } from "wouter"
import { useMarcusStreamGeneration } from "@/hooks/useMarcusStreamGeneration"
import { StreamGenerationScreen } from "@/components/website-v2/StreamGenerationScreen"
import { consumeCopilotAutorun, consumePendingIntent, dequeueWorkspaceSignals } from "@/lib/generation-context"
import { registerBridge, unregisterBridge } from "@/lib/module-architecture/website-bridge"
import { websiteController } from "@/lib/module-architecture/controllers/website-controller"
import { registerController, unregisterController } from "@/lib/module-architecture/registry"

// Module-level: bridges a same-tick unmount/remount cycle (e.g. React Strict
// Mode's mount→cleanup→mount, or AnimatePresence swapping the page in/out)
// so a pendingIntent consumed by the first mount isn't lost when the second
// mount's effect re-runs. Deliberately short-lived (see MOUNT_CACHE_TTL_MS) —
// it must NOT act as a long-term fallback that could reapply a stale idea to
// an unrelated later visit of this page.
let _websiteMountIntentCache: { idea: string; capturedAt: number } | null = null
const MOUNT_CACHE_TTL_MS = 1500

type Step = "input" | "generating" | "redirecting"

// ─── Quick-select options ──────────────────────────────────────────────────────
const INDUSTRY_OPTIONS = [
  "SaaS", "Fintech", "Healthcare", "E-commerce", "Agency",
  "Marketplace", "Education", "Crypto / Web3", "AI / ML", "Other",
]

const AUDIENCE_OPTIONS = [
  "B2B enterprises", "Small businesses", "Developers", "Consumers",
  "Creators", "Investors", "Healthcare professionals", "Other",
]

// ─── Form state ────────────────────────────────────────────────────────────────
interface FormState {
  idea:            string
  companyName:     string
  industry:        string
  targetAudience:  string
  businessGoal:    string
  brandPositioning: string
  conversionGoal:  string
}

const EMPTY_FORM: FormState = {
  idea:             "",
  companyName:      "",
  industry:         "",
  targetAudience:   "",
  businessGoal:     "",
  brandPositioning: "",
  conversionGoal:   "",
}

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function WebsiteStudioCreatePage() {
  const [, navigate]  = useLocation()
  const [step, setStep] = useState<Step>("input")
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ideaRef = useRef<HTMLTextAreaElement>(null)

  const { state: genState, generate, cancel } = useMarcusStreamGeneration()

  // Always-current mirror of form.idea — safe to read from stable closures
  // (the bridge's getCurrentIdea/triggerGenerate) without stale-state bugs.
  const formIdeaRef = useRef<string>("")
  useEffect(() => { formIdeaRef.current = form.idea }, [form.idea])

  // Settles the bridge's triggerGenerate() promise — set by triggerGenerate(),
  // fired once generation reaches done/error/cancelled OR handleGenerate bails
  // out early (e.g. empty idea). Must always be settled on every exit path or
  // an ExecutionBus caller (e.g. Copilot) awaiting it would hang forever.
  const generateCompleteRef = useRef<((ok: boolean) => void) | null>(null)
  const settleGenerateComplete = useCallback((ok: boolean) => {
    generateCompleteRef.current?.(ok)
    generateCompleteRef.current = null
  }, [])

  // Focus textarea on mount
  useEffect(() => { ideaRef.current?.focus() }, [])

  // ─── Module-architecture bridge: lets Copilot drive this page via the
  // ExecutionBus (bus.execute({ module: "website", action: "generate" })).
  // Mirrors the pattern used by chatbot/automation/intelligence controllers —
  // without this, Copilot-triggered website generation silently no-ops.
  useEffect(() => {
    const bridgeRegId = registerBridge({
      navigate: () => navigate("/website-studio/new"),
      populate: (populateIdea, onComplete) => {
        if (!populateIdea) { onComplete(); return }
        formIdeaRef.current = populateIdea
        setForm(prev => ({ ...prev, idea: populateIdea }))
        onComplete()
      },
      triggerGenerate: (idea) => new Promise<void>((resolve, reject) => {
        generateCompleteRef.current = (ok) => (ok ? resolve() : reject(new Error("Website generation did not complete")))
        void handleGenerateRef.current?.(idea)
      }),
      // Generation is auto-persisted by the stream route (createV2Project +
      // saveGeneratedFiles) — there is no separate "re-save" step needed here.
      save: async () => {},
      getCurrentIdea: () => formIdeaRef.current,
    })
    const controllerRegId = registerController("website", websiteController)
    return () => {
      unregisterBridge(bridgeRegId)
      unregisterController("website", controllerRegId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Consume a durable pending intent written by Copilot before navigating
  // here (setPendingIntent({ type: "website", idea })), plus any queued live
  // workspace signal fired while this page was mid-mount.
  useEffect(() => {
    consumeCopilotAutorun() // clear only — generation is triggered via the bridge above

    let ideaFromIntent: string | null = null
    if (_websiteMountIntentCache && Date.now() - _websiteMountIntentCache.capturedAt < MOUNT_CACHE_TTL_MS) {
      ideaFromIntent = _websiteMountIntentCache.idea
      _websiteMountIntentCache = null
    } else {
      _websiteMountIntentCache = null // drop anything stale before consuming a fresh intent
      const intent = consumePendingIntent("website")
      if (intent?.idea) {
        _websiteMountIntentCache = { idea: intent.idea, capturedAt: Date.now() }
        ideaFromIntent = intent.idea
      }
    }

    const queued = dequeueWorkspaceSignals("website")
    const populateSignal = queued.find(s => s.type === "populate" && s.payload)
    const idea = ideaFromIntent || populateSignal?.payload || null

    if (idea) {
      formIdeaRef.current = idea
      setForm(prev => ({ ...prev, idea }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-navigate to workspace when generation is done
  useEffect(() => {
    if (genState.status === "done" && genState.projectId) {
      setStep("redirecting")
      settleGenerateComplete(true)
      setTimeout(() => {
        navigate(`/website-studio/${genState.projectId}`)
      }, 1200)
    }
    if (genState.status === "error" && genState.error) {
      setError(genState.error)
      setStep("input")
      settleGenerateComplete(false)
    }
  }, [genState.status, genState.projectId, genState.error, navigate, settleGenerateComplete])

  // ideaOverride lets the module-architecture bridge (triggerGenerate) drive
  // generation with an idea supplied by Copilot, independent of form state.
  const handleGenerate = useCallback(async (ideaOverride?: string) => {
    const idea = (ideaOverride ?? form.idea).trim()
    if (!idea) {
      setError("Please describe your business idea.")
      ideaRef.current?.focus()
      // Bail-out path: still settle any pending bridge triggerGenerate() so a
      // Copilot-initiated call never hangs on a missing/blank idea.
      settleGenerateComplete(false)
      return
    }
    setError(null)
    setStep("generating")

    const bi: Record<string, unknown> = {}
    if (form.companyName)      bi.companyName      = form.companyName
    if (form.industry)         bi.industry         = form.industry
    if (form.targetAudience)   bi.targetAudience   = form.targetAudience
    if (form.businessGoal)     bi.businessGoal     = form.businessGoal
    if (form.brandPositioning) bi.brandPositioning = form.brandPositioning
    if (form.conversionGoal)   bi.conversionGoal   = form.conversionGoal

    await generate(idea, Object.keys(bi).length > 0 ? bi : undefined)
  }, [form, generate])

  // Stable ref so the bridge (registered in a mount-only effect) always calls
  // the latest handleGenerate closure without needing to re-register itself.
  const handleGenerateRef = useRef(handleGenerate)
  useEffect(() => { handleGenerateRef.current = handleGenerate }, [handleGenerate])

  const handleCancel = useCallback(() => {
    cancel()
    setStep("input")
    // A pending Copilot-driven triggerGenerate() must not hang forever just
    // because the user cancelled from the UI mid-stream.
    settleGenerateComplete(false)
  }, [cancel, settleGenerateComplete])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  // ─── Generating / Redirecting: show streaming screen ──────────────────────
  if (step === "generating" || step === "redirecting") {
    return (
      <div className="flex h-full flex-col overflow-hidden">
        {/* Header strip */}
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg border border-amber-400/20 bg-amber-400/8">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white/80">Website Studio</h1>
              <p className="text-[10px] text-white/30">Marcus is generating your website…</p>
            </div>
          </div>
          {step === "redirecting" && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/8 px-3 py-1.5">
              <Loader2 className="h-3 w-3 animate-spin text-emerald-400" />
              <span className="text-xs text-emerald-400">Opening workspace…</span>
            </div>
          )}
        </div>

        {/* Stream screen */}
        <div className="min-h-0 flex-1">
          <StreamGenerationScreen state={genState} onCancel={step === "generating" ? handleCancel : undefined} />
        </div>
      </div>
    )
  }

  // ─── Input screen ──────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col overflow-y-auto">

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-6 py-4"
      >
        <button
          onClick={() => navigate("/website-studio")}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/30 transition-colors hover:border-white/20 hover:text-white/60"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/8">
          <Globe className="h-4 w-4 text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-bold text-white/90">New Website</h1>
          <p className="text-xs text-white/30">Describe your business — Marcus will build it</p>
        </div>
      </motion.div>

      {/* Form */}
      <div className="flex flex-1 flex-col items-center py-10 px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28 }}
          className="w-full max-w-2xl space-y-6"
        >

          {/* Main idea */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Wand2 className="h-3 w-3" />
              Business Idea
              <span className="text-amber-400">*</span>
            </label>
            <textarea
              ref={ideaRef}
              value={form.idea}
              onChange={set("idea")}
              placeholder="Describe your business in detail. What does it do? Who is it for? What problem does it solve? The more specific you are, the better Marcus can craft your website…"
              rows={5}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-white/80 placeholder-white/20 outline-none transition-colors focus:border-amber-400/30 focus:bg-white/[0.05]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleGenerate()
              }}
            />
            <p className="text-[10px] text-white/20">Press ⌘↵ to generate</p>
          </div>

          {/* Company name */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Building2 className="h-3 w-3" />
              Company Name
            </label>
            <input
              type="text"
              value={form.companyName}
              onChange={set("companyName")}
              placeholder="e.g. Acme Corp, FlowAI, Stripe…"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition-colors focus:border-amber-400/30 focus:bg-white/[0.05]"
            />
          </div>

          {/* Industry quick-select */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Tag className="h-3 w-3" />
              Industry
            </label>
            <div className="flex flex-wrap gap-2">
              {INDUSTRY_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setForm(prev => ({ ...prev, industry: prev.industry === opt ? "" : opt }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    form.industry === opt
                      ? "border-amber-400/40 bg-amber-400/10 text-amber-400"
                      : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/[0.15] hover:text-white/60"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            {form.industry === "Other" && (
              <input
                type="text"
                placeholder="Describe your industry…"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition-colors focus:border-amber-400/30"
              />
            )}
          </div>

          {/* Target audience quick-select */}
          <div className="space-y-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/40">
              <Users className="h-3 w-3" />
              Target Audience
            </label>
            <div className="flex flex-wrap gap-2">
              {AUDIENCE_OPTIONS.map(opt => (
                <button
                  key={opt}
                  onClick={() => setForm(prev => ({ ...prev, targetAudience: prev.targetAudience === opt ? "" : opt }))}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    form.targetAudience === opt
                      ? "border-purple-400/40 bg-purple-400/10 text-purple-400"
                      : "border-white/[0.08] bg-white/[0.02] text-white/40 hover:border-white/[0.15] hover:text-white/60"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Advanced options toggle */}
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className="flex items-center gap-1.5 text-xs text-white/25 transition-colors hover:text-white/50"
          >
            <ChevronRight className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`} />
            Advanced options (goal, positioning, conversion)
          </button>

          <AnimatePresence>
            {showAdvanced && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden space-y-4"
              >
                {[
                  { key: "businessGoal" as const, label: "Business Goal", icon: <Target className="h-3 w-3" />, placeholder: "e.g. grow ARR to $1M, acquire 10k users…" },
                  { key: "brandPositioning" as const, label: "Brand Positioning", icon: <Sparkles className="h-3 w-3" />, placeholder: "e.g. the affordable Salesforce alternative, enterprise-grade security for startups…" },
                  { key: "conversionGoal" as const, label: "Conversion Goal", icon: <ArrowRight className="h-3 w-3" />, placeholder: "e.g. sign up for free trial, book a demo, buy now…" },
                ].map(({ key, label, icon, placeholder }) => (
                  <div key={key} className="space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/30">
                      {icon}
                      {label}
                    </label>
                    <input
                      type="text"
                      value={form[key]}
                      onChange={set(key)}
                      placeholder={placeholder}
                      className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition-colors focus:border-amber-400/30 focus:bg-white/[0.05]"
                    />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {error && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-sm text-red-400/80"
            >
              {error}
            </motion.p>
          )}

          {/* Generate button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => void handleGenerate()}
              disabled={!form.idea.trim()}
              className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              Generate Website
            </button>
            <span className="text-xs text-white/20">
              Marcus will write the full Next.js codebase
            </span>
          </div>

          {/* Hint */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            <p className="text-xs leading-relaxed text-white/30">
              <span className="font-semibold text-white/50">How it works:</span>{" "}
              Marcus reads your brief, thinks through the design, then streams each file into the code editor
              token by token — just like watching a senior developer write your website in real time.
              When done, the WebContainer boots your Next.js project and you get a live preview instantly.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
