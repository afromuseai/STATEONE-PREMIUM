import { useState, useCallback, useRef, useEffect } from "react"
import { useLocation, useSearch } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { InputPanel } from "@/components/dashboard/input-panel"
import { OutputPanel, type BusinessIntelligence } from "@/components/dashboard/output-panel"
import { WebsitePanel } from "@/components/dashboard/website-panel"
import { useAuth } from "@/lib/auth-context"
import { useBusinessContext } from "@/lib/business-context"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import { api } from "@/lib/api"
import { recordRevenueSignal } from "@/lib/intelligence-state"
import {
  saveGenerationContext,
  saveProjectContext,
  saveDashboardState,
  loadDashboardState,
  clearDashboardState,
  consumeCopilotAutorun,
  consumeMarcusWorkspaceSignal,
  consumePendingIntent,
  dequeueWorkspaceSignals,
} from "@/lib/generation-context"
import { useWorkspaceController } from "@/lib/workspace-controller-context"
import { tracer } from "@/lib/execution-tracer"
import { ensureProject } from "@/lib/ensure-project"
import { registerBridge, unregisterBridge } from "@/lib/module-architecture/intelligence-bridge"
import { intelligenceController } from "@/lib/module-architecture/controllers/intelligence-controller"
import { registerController, unregisterController } from "@/lib/module-architecture/registry"
import { useLang } from "@/lib/i18n"
import {
  Globe,
  Bot,
  Workflow,
  Crown,
  X,
  AlertTriangle,
  Lock,
} from "lucide-react"

// ─── Partial JSON field extractor ────────────────────────────────────────────
function extractValue(text: string, startIdx: number): { value: unknown; end: number } | null {
  const remaining = text.slice(startIdx)
  const c = remaining[0]

  if (c === '"') {
    let i = 1, escaped = false
    while (i < remaining.length) {
      if (escaped) { escaped = false; i++; continue }
      if (remaining[i] === "\\") { escaped = true; i++; continue }
      if (remaining[i] === '"') {
        try {
          return { value: JSON.parse(remaining.slice(0, i + 1)), end: startIdx + i + 1 }
        } catch { return null }
      }
      i++
    }
    return null
  }

  if (c === "{" || c === "[") {
    const close = c === "{" ? "}" : "]"
    let depth = 0, i = 0, inStr = false, escaped = false
    while (i < remaining.length) {
      const ch = remaining[i]
      if (escaped) { escaped = false; i++; continue }
      if (inStr && ch === "\\") { escaped = true; i++; continue }
      if (ch === '"') { inStr = !inStr; i++; continue }
      if (!inStr) {
        if (ch === c || ch === (c === "{" ? "[" : "{")) depth++
        else if (ch === close || ch === (c === "{" ? "]" : "}")) {
          depth--
          if (depth === 0) {
            try {
              return { value: JSON.parse(remaining.slice(0, i + 1)), end: startIdx + i + 1 }
            } catch { return null }
          }
        }
      }
      i++
    }
    return null
  }

  const m = /^(-?\d+\.?\d*(?:[eE][+-]?\d+)?|true|false|null)/.exec(remaining)
  if (m) {
    try {
      return { value: JSON.parse(m[1]), end: startIdx + m[1].length }
    } catch { return null }
  }

  return null
}

function extractPartialFields(text: string): Partial<BusinessIntelligence> {
  const result: Record<string, unknown> = {}
  const fieldRe = /"(\w+)"\s*:\s*/g
  let match: RegExpExecArray | null
  while ((match = fieldRe.exec(text)) !== null) {
    const key = match[1]
    const valStart = match.index + match[0].length
    const extracted = extractValue(text, valStart)
    if (extracted) result[key] = extracted.value
  }
  return result as Partial<BusinessIntelligence>
}

function computeStage(partial: Partial<BusinessIntelligence>, accumulated: string): number {
  if (!accumulated) return 0
  if (accumulated.length < 50) return 1
  if (partial.industry) return 2
  if (partial.metrics) return 3
  if (partial.businessSnapshot) return 4
  if (partial.growthPlan || partial.competitiveAdvantage) return 5
  return 1
}
// ─────────────────────────────────────────────────────────────────────────────

export default function BusinessIntelligencePage() {
  const { t, lang } = useLang()
  const wp = t.workspace.projects
  const wm = t.workspace.modals
  const { user } = useAuth()
  const { setBusinessData } = useBusinessContext()
  const { openUpgradeModal } = useUpgradeModal()
  const { subscribeWorkspaceSignal, emit } = useWorkspaceController()
  const search = useSearch()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  // Generation state
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<BusinessIntelligence | null>(null)
  const [partialData, setPartialData] = useState<Partial<BusinessIntelligence>>({})
  const [generationStage, setGenerationStage] = useState(0)
  const [currentIdea, setCurrentIdea] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [showWebsite, setShowWebsite] = useState(false)
  const [reasoningStages, setReasoningStages] = useState<string[]>([])
  const [detectedIndustry, setDetectedIndustry] = useState<string | undefined>(undefined)

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const projectsRef = useRef<import("@/lib/api").Project[]>([])
  const draftProjectIdRef = useRef<string | null>(null)
  const draftCreatingRef = useRef(false)
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestPartialRef = useRef<Partial<BusinessIntelligence>>({})

  const [subscription, setSubscription] = useState<{ aiGenerationsUsed: number; aiGenerationsLimit: number; plan: string } | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [lockedFeature, setLockedFeature] = useState<{ name: string; icon: React.ReactNode; description: string } | null>(null)
  const [autorunIdea, setAutorunIdea] = useState<string | null>(null)
  const [marcusPopulate, setMarcusPopulate] = useState<string | null>(null)
  const marcusBiIdeaRef = useRef<string>("")
  const [, setLocation] = useLocation()
  // Phase 2 architecture: refs used by the IntelligenceBridge
  const populateCompleteCallbackRef = useRef<(() => void) | null>(null)
  const latestResultsRef = useRef<BusinessIntelligence | null>(null)

  // Reset state when _r param changes (triggered by "New Analysis" button)
  useEffect(() => {
    const params = new URLSearchParams(search.replace("?", ""))
    if (params.get("_r")) {
      setResults(null)
      setPartialData({})
      setGenerationStage(0)
      setCurrentIdea("")
      setError(null)
      setStreamingText("")
      setShowWebsite(false)
      setActiveProjectId(null)
      setBusinessData({})
      clearDashboardState()
      setLocation("/business-intelligence")
    }
  }, [search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restore persisted generation state on mount
  useEffect(() => {
    const saved = loadDashboardState()
    if (saved?.results) {
      const savedUserId = saved.userId ?? null
      const currentUserId = user?.id ?? null
      if (savedUserId !== null && currentUserId !== null && savedUserId !== currentUserId) {
        clearDashboardState()
      } else {
        setResults(saved.results)
        setCurrentIdea(saved.currentIdea)
        setGenerationStage(saved.generationStage)
        setActiveProjectId(saved.activeProjectId)
        setBusinessData(saved.results as unknown as Record<string, unknown>)
      }
    }

    // Generation is triggered exclusively by ExecutionBus → IntelligenceBridge → handleGenerateRef.
    // Legacy consumeCopilotAutorun generation trigger removed.
    consumeCopilotAutorun() // consume to clear sessionStorage; result intentionally ignored

    // Primary path: consume pendingIntent written by copilot-panel (same as website/chatbot/automation)
    const intent = consumePendingIntent("bi")
    if (intent?.idea) {
      marcusBiIdeaRef.current = intent.idea
      setTimeout(() => setMarcusPopulate(intent.idea), 150)
    }

    // Marcus workspace signal: cross-navigation delivery (sessionStorage single-slot, legacy path)
    const signal = consumeMarcusWorkspaceSignal()
    if (signal?.target === "intelligence" && signal.type === "populate" && signal.payload) {
      const idea = signal.payload
      if (!marcusBiIdeaRef.current) marcusBiIdeaRef.current = idea
      if (!intent?.idea) setTimeout(() => setMarcusPopulate(idea), 150)
    }

    // Workspace signal queue: drain ALL queued signals for this target (new reliable path)
    const queued = dequeueWorkspaceSignals("intelligence")
    for (const qs of queued) {
      if (qs.type === "populate" && qs.payload) {
        marcusBiIdeaRef.current = qs.payload
        setTimeout(() => setMarcusPopulate(qs.payload!), 150)
      }
      // "generate" type signals removed — generation is triggered exclusively by ExecutionBus
    }

    // Load subscription for usage enforcement
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription) setSubscription(d.subscription) })
      .catch(() => {})

    // Load existing projects for continuity context
    api.projects.list().then(({ projects }) => {
      projectsRef.current = projects
    }).catch(() => {})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Declared before handleGenerate — holds a ref so the signal subscriber
  // (registered once, stable closure) always calls the latest version.
  const handleGenerateRef = useRef<((idea: string) => Promise<void>) | null>(null)
  // Phase 5: bridge completion callback — matches chatbot reference pattern.
  // Set by triggerGenerate(), fired explicitly at the success path in handleGenerate().
  const generateCompleteCallbackRef = useRef<(() => void) | null>(null)

  // Marcus signal subscription (live — for when page is already mounted)
  useEffect(() => {
    return subscribeWorkspaceSignal((signal) => {
      if (signal.target !== "intelligence") return

      if (signal.type === "populate" && signal.payload) {
        const idea = signal.payload
        marcusBiIdeaRef.current = idea
        setTimeout(() => setMarcusPopulate(idea), 50)
      }
      // "generate" type signals removed — generation is triggered exclusively by ExecutionBus
    }, "intelligence")
  }, [subscribeWorkspaceSignal]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep latestResultsRef in sync for bridge-based save
  useEffect(() => { latestResultsRef.current = results }, [results])

  // Phase 2 architecture: register the IntelligenceBridge and controller on mount
  useEffect(() => {
    registerBridge({
      navigate: () => setLocation("/business-intelligence"),
      populate: (idea, onComplete) => {
        populateCompleteCallbackRef.current = onComplete
        marcusBiIdeaRef.current = idea
        setMarcusPopulate(idea)
      },
      triggerGenerate: (idea) => new Promise<void>((resolve) => {
        generateCompleteCallbackRef.current = resolve
        handleGenerateRef.current?.(idea)
      }),
      save: async () => {
        if (!latestResultsRef.current || !draftProjectIdRef.current) return
        setSaveStatus("saving")
        try {
          await api.projects.update(draftProjectIdRef.current, {
            output: latestResultsRef.current as unknown as Record<string, unknown>,
            status: "active",
          })
          setSaveStatus("saved")
          setTimeout(() => setSaveStatus("idle"), 3000)
        } catch {
          setSaveStatus("idle")
        }
      },
      getCurrentIdea: () => marcusBiIdeaRef.current,
    })
    registerController("intelligence", intelligenceController)
    return () => {
      unregisterBridge()
      unregisterController("intelligence")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist generation results whenever they change
  useEffect(() => {
    if (results) {
      saveDashboardState({ userId: user?.id ?? null, results, currentIdea, activeProjectId, generationStage: 6 })
    }
  }, [results, currentIdea, activeProjectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleGenerate = useCallback(async (idea: string) => {
    // Guard: matches the empty-idea early-return in every other module (chatbot, website,
    // automation, orchestrator). Without this, an empty idea reaches the API and returns 400.
    if (!idea.trim()) {
      setError("No business idea was provided — please describe your business above, or ask Marcus to re-prepare the analysis.")
      generateCompleteCallbackRef.current?.()
      generateCompleteCallbackRef.current = null
      return
    }
    clearDashboardState()
    setIsLoading(true)
    setResults(null)
    setPartialData({})
    setGenerationStage(1)
    setCurrentIdea(idea)
    setError(null)
    setStreamingText("")
    setShowWebsite(false)
    setActiveProjectId(null)
    setReasoningStages([])
    setDetectedIndustry(undefined)
    draftProjectIdRef.current = null
    draftCreatingRef.current = false
    if (draftSaveTimerRef.current) { clearTimeout(draftSaveTimerRef.current); draftSaveTimerRef.current = null }
    latestPartialRef.current = {}

    const traceId = tracer.getActiveExecutionId("intelligence")
    try {
      if (traceId) {
        tracer.logStage(traceId, 9, "HTTP request", {
          functionName: "handleGenerate",
          success: true,
          data: { method: "POST", endpoint: "/api/generate" },
        })
      }
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea, language: lang }),
      })

      if (traceId) {
        tracer.logStage(traceId, 10, "HTTP response", {
          functionName: "handleGenerate",
          success: response.ok,
          reason: response.ok ? undefined : `HTTP ${response.status}`,
          data: { status: response.status, endpoint: "/api/generate" },
        })
      }

      if (!response.ok) {
        if (response.status === 429) {
          setShowUpgradeModal(true)
          setIsLoading(false)
          setGenerationStage(0)
          if (traceId) tracer.endExecution(traceId, false, "rate limited (429)")
          return
        }
        const errorData = await response.json().catch(() => ({ error: "Request failed" }))
        if (response.status === 403 && errorData.error === "UPGRADE_REQUIRED") {
          openUpgradeModal({ feature: errorData.feature, featureLabel: errorData.featureLabel, requiredPlan: errorData.requiredPlan })
          setIsLoading(false)
          setGenerationStage(0)
          if (traceId) tracer.endExecution(traceId, false, "UPGRADE_REQUIRED")
          return
        }
        if (traceId) tracer.endExecution(traceId, false, errorData.error || `Server error: ${response.status}`)
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream available")

      const decoder = new TextDecoder()
      let lineCarryover = ""
      let finalData: BusinessIntelligence | null = null
      let streamError: string | null = null
      let accumulated = ""

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = lineCarryover + decoder.decode(value, { stream: true })
          const lines = chunk.split("\n")
          lineCarryover = lines.pop() ?? ""

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue
            const data = line.slice(6).trim()
            if (!data) continue
            try {
              const parsed = JSON.parse(data)
              if (parsed.error) { streamError = parsed.error; break }
              if (parsed.reasoning && !parsed.content) {
                // Pre-flight reasoning events — no UI update needed
              } else if (parsed.reasoningStages && Array.isArray(parsed.reasoningStages)) {
                setReasoningStages(parsed.reasoningStages)
                if (parsed.industry) setDetectedIndustry(parsed.industry)
              } else if (parsed.done && parsed.data) {
                finalData = parsed.data as BusinessIntelligence
              } else if (typeof parsed.content === "string") {
                accumulated += parsed.content
                setStreamingText(accumulated)
                const partial = extractPartialFields(accumulated)
                const stage = computeStage(partial, accumulated)
                setPartialData(partial)
                setGenerationStage(stage)
                latestPartialRef.current = partial
                // Auto-persist: create draft on first meaningful partial data
                if (stage >= 1 && !draftProjectIdRef.current && !draftCreatingRef.current) {
                  draftCreatingRef.current = true
                  const draftTitle = idea.length > 60 ? idea.slice(0, 60) + "…" : idea
                  api.projects.create({ title: draftTitle, businessIdea: idea, status: "draft", output: partial as unknown as Record<string, unknown> })
                    .then(({ project }) => {
                      draftProjectIdRef.current = project.id
                      draftCreatingRef.current = false
                      setActiveProjectId(project.id)
                      projectsRef.current = [project, ...projectsRef.current].slice(0, 50)
                    }).catch(() => { draftCreatingRef.current = false })
                } else if (draftProjectIdRef.current) {
                  if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
                  draftSaveTimerRef.current = setTimeout(() => {
                    const id = draftProjectIdRef.current
                    if (id) api.projects.update(id, { output: latestPartialRef.current as unknown as Record<string, unknown> }).catch(() => {})
                  }, 5000)
                }
              }
            } catch { /* incomplete chunk */ }
          }
          if (streamError) break
        }
      } finally { reader.releaseLock() }

      if (streamError) throw new Error(streamError)
      if (!finalData) throw new Error("No analysis data received")

      setResults(finalData)
      setGenerationStage(6)
      setBusinessData(finalData as unknown as Record<string, unknown>)

      if (draftSaveTimerRef.current) clearTimeout(draftSaveTimerRef.current)
      console.log("GENERATOR_AUDIT: generator=business-intelligence | generation completed")
      const title = idea.length > 60 ? idea.slice(0, 60) + "…" : idea
      // Standardized persistence: if a draft project was created during streaming,
      // register it as the continuation context so ensureProject() patches it instead
      // of creating a duplicate.
      if (draftProjectIdRef.current) {
        saveProjectContext({
          projectId: draftProjectIdRef.current,
          projectTitle: title,
          continuityMode: "continuation",
          source: "Marcus",
        })
      }
      setSaveStatus("saving")
      const biResult = await ensureProject({
        type: "business_intelligence",
        idea,
        outputField: "output",
        output: finalData as unknown as Record<string, unknown>,
        title,
      }).catch(() => ({ projectId: "", created: false, saved: false }))
      if (traceId) {
        tracer.logStage(traceId, 11, "Persistence", {
          functionName: "handleGenerate",
          success: !!biResult.saved,
          reason: biResult.saved ? undefined : "ensureProject did not report saved=true",
          data: { projectId: biResult.projectId, created: biResult.created },
        })
      }
      if (biResult.projectId) {
        setActiveProjectId(biResult.projectId)
        // Promote draft → active now that generation is complete (ensureProject patches output
        // only; the draft was created with status="draft" during streaming).
        api.projects.update(biResult.projectId, { status: "active" }).catch(() => {})
        // Override with BI-specific context (originatingBusinessIntelligenceId + Marcus source)
        saveProjectContext({
          projectId: biResult.projectId,
          projectTitle: title,
          originatingBusinessIntelligenceId: biResult.projectId,
          continuityMode: "continuation",
          source: "Marcus",
        })
        recordRevenueSignal({
          projectId: biResult.projectId,
          industry: finalData.industry,
          businessSnapshot: finalData.businessSnapshot,
          sourceMetrics: {
            marketDifficulty: finalData.metrics.marketDifficulty,
            automationPotential: finalData.metrics.automationPotential,
            revenueScalability: finalData.metrics.revenueScalability,
            operationalComplexity: finalData.metrics.operationalComplexity,
            aiAdoptionOpportunity: finalData.metrics.aiAdoptionOpportunity,
          },
        }).catch(() => {})
      }
      emit({ type: "bi.generated", data: { saved: biResult.saved } })
      if (traceId) {
        tracer.logStage(traceId, 12, "Completion event", {
          functionName: "handleGenerate",
          success: true,
          data: { event: "bi.generated" },
        })
        tracer.endExecution(traceId, true)
      }
      // Phase 5: signal bridge that generation is fully complete —
      // fires only after SSE streaming, project save, and UI update are done.
      // Matches chatbot reference pattern.
      generateCompleteCallbackRef.current?.()
      generateCompleteCallbackRef.current = null
      setSaveStatus(biResult.saved ? "saved" : "idle")
      if (biResult.saved) setTimeout(() => setSaveStatus("idle"), 3000)

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
      if (traceId) tracer.endExecution(traceId, false, err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setStreamingText("")
      setPartialData({})
      if (draftSaveTimerRef.current) { clearTimeout(draftSaveTimerRef.current); draftSaveTimerRef.current = null }
    }
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // Synchronous render-time assignment — ref is always current before any subscriber fires
  handleGenerateRef.current = handleGenerate

  // Compute usage warning
  const usagePct = subscription && subscription.aiGenerationsLimit > 0
    ? subscription.aiGenerationsUsed / subscription.aiGenerationsLimit
    : 0
  const showUsageWarning = usagePct >= 0.8 && subscription !== null && subscription.aiGenerationsLimit > 0

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Feature locked modal (tier gating) */}
      <AnimatePresence>
        {lockedFeature && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
            onClick={() => setLockedFeature(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-primary/20 bg-[#0c0c0c] p-8 shadow-2xl"
            >
              <button
                onClick={() => setLockedFeature(null)}
                className="absolute top-5 right-5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                  {lockedFeature.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">{lockedFeature.name}</h3>
                    <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                      <Lock className="h-2.5 w-2.5" /> Pro
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{wm.upgradeToUnlock}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {lockedFeature.description}
              </p>
              <div className="rounded-xl border border-white/5 bg-white/2 p-4 mb-6 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3">{wm.proUnlocks}</p>
                {wm.proFeatures.map(f => (
                  <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setLockedFeature(null)}
                  className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-foreground hover:bg-white/8 transition-all"
                >
                  {wm.maybeLater}
                </button>
                <button
                  onClick={() => { setLockedFeature(null); openUpgradeModal() }}
                  className="flex-1 h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow flex items-center justify-center gap-2"
                >
                  <Crown className="h-3.5 w-3.5" />
                  {wm.upgradeToPro}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quota upgrade modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c0c] p-8 shadow-2xl"
            >
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="absolute top-5 right-5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-3 mb-5">
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
                  <AlertTriangle className="h-6 w-6 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">{wm.limitReached}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                    {subscription?.plan ?? "free"} plan · {subscription?.aiGenerationsUsed ?? 0} / {subscription?.aiGenerationsLimit ?? 0} used
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {wm.limitDesc}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpgradeModal(false)}
                  className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-foreground hover:bg-white/8 transition-all"
                >
                  {wm.maybeLater}
                </button>
                <button
                  onClick={() => { setShowUpgradeModal(false); openUpgradeModal() }}
                  className="flex-1 h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow flex items-center justify-center gap-2"
                >
                  <Crown className="h-3.5 w-3.5" />
                  {wm.upgradePlan}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(p => !p)}
        mobileOpen={mobileSidebarOpen}
        onMobileClose={() => setMobileSidebarOpen(false)}
      />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <DashboardHeader onMenuToggle={() => setMobileSidebarOpen(p => !p)} />

        {/* 80% usage warning banner */}
        <AnimatePresence>
          {showUsageWarning && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden shrink-0"
            >
              <div className="flex items-center justify-between gap-3 px-5 py-2.5 bg-amber-500/8 border-b border-amber-500/20">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                  <p className="text-xs text-amber-300">
                    <span className="font-bold">
                      {Math.round(usagePct * 100)}{wm.ofAiOpsUsed}
                    </span>
                    {" "}— {subscription!.aiGenerationsLimit - subscription!.aiGenerationsUsed} {wm.remaining}
                  </p>
                </div>
                <button
                  onClick={() => openUpgradeModal()}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 rounded-full px-3 py-1 bg-amber-500/6 hover:bg-amber-500/12 shrink-0"
                >
                  <Crown className="h-2.5 w-2.5" />
                  {t.workspace.overview.upgrade}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* BI Generator */}
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex flex-1 flex-col lg:flex-row min-h-0">
            <aside className="w-full border-b border-border/50 bg-secondary/20 p-6 lg:w-[400px] lg:border-b-0 lg:border-r xl:w-[450px] shrink-0">
              <InputPanel
                onGenerate={handleGenerate}
                isLoading={isLoading}
                copilotAutorun={autorunIdea}
                onAutorunConsumed={() => setAutorunIdea(null)}
                marcusPopulate={marcusPopulate}
                onMarcusPopulateConsumed={() => {
                  setMarcusPopulate(null)
                  populateCompleteCallbackRef.current?.()
                  populateCompleteCallbackRef.current = null
                }}
              />
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400"
                >
                  {error}
                </motion.div>
              )}
              {saveStatus !== "idle" && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-3 rounded-lg border p-3 text-sm flex items-center gap-2 ${
                    saveStatus === "saved"
                      ? "border-green-500/20 bg-green-500/10 text-green-400"
                      : "border-primary/20 bg-primary/10 text-primary"
                  }`}
                >
                  {saveStatus === "saving" ? (
                    <><div className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" /> {wp.savingProject}</>
                  ) : (
                    <><span className="h-3 w-3 rounded-full bg-green-400 inline-block" /> {wp.projectSaved}</>
                  )}
                </motion.div>
              )}
            </aside>

            <section className={`flex-1 min-h-0 ${showWebsite ? "overflow-hidden flex flex-col" : "overflow-y-auto p-6"}`}>
              <AnimatePresence mode="wait">
                {!showWebsite ? (
                  <motion.div key="output" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
                    <OutputPanel
                      data={results}
                      partialData={partialData}
                      isLoading={isLoading}
                      streamingText={streamingText}
                      generationStage={generationStage}
                      reasoningStages={reasoningStages.length > 0 ? reasoningStages : undefined}
                      detectedIndustry={detectedIndustry}
                      onGenerateWebsite={results ? () => {
                        if (subscription?.plan === "free") {
                          setLockedFeature({ name: "Website Builder", icon: <Globe className="h-5 w-5" />, description: "Generate a complete, launch-ready website with AI — including copy, design system, React components, and live preview." })
                          return
                        }
                        saveGenerationContext({
                          idea: currentIdea,
                          industry: results.industry,
                          businessSnapshot: results.businessSnapshot,
                          targetMarket: results.targetMarket,
                          chatbotRole: results.chatbotRole,
                          automations: results.automations,
                          growthPlan: results.growthPlan,
                          strategicInsights: results.strategicInsights,
                          recommendedStack: results.recommendedStack,
                          competitiveAdvantage: results.competitiveAdvantage,
                        })
                        setShowWebsite(true)
                      } : undefined}
                      onGenerateChatbot={results ? () => {
                        if (subscription?.plan === "free") {
                          setLockedFeature({ name: "AI Chatbot Generator", icon: <Bot className="h-5 w-5" />, description: "Build a fully-configured AI chatbot with conversation flows, system prompts, integrations, and live preview — pre-filled from your business analysis." })
                          return
                        }
                        saveGenerationContext({
                          idea: currentIdea,
                          industry: results.industry,
                          businessSnapshot: results.businessSnapshot,
                          targetMarket: results.targetMarket,
                          chatbotRole: results.chatbotRole,
                          automations: results.automations,
                          growthPlan: results.growthPlan,
                          strategicInsights: results.strategicInsights,
                          recommendedStack: results.recommendedStack,
                          competitiveAdvantage: results.competitiveAdvantage,
                        })
                        if (activeProjectId) {
                          const activeProject = projectsRef.current.find(p => p.id === activeProjectId)
                          saveProjectContext({ projectId: activeProjectId, projectTitle: activeProject?.title ?? currentIdea.slice(0, 60), originatingBusinessIntelligenceId: activeProjectId, continuityMode: "continuation", source: "Existing Project" })
                        }
                        setLocation("/chatbot-generator")
                      } : undefined}
                      onBuildAutomation={results ? () => {
                        if (subscription?.plan === "free") {
                          setLockedFeature({ name: "Automation Builder", icon: <Workflow className="h-5 w-5" />, description: "Generate end-to-end automation workflows with node-based canvas, AI agent configs, integration maps, and execution logic — auto-populated from your business intelligence." })
                          return
                        }
                        saveGenerationContext({
                          idea: currentIdea,
                          industry: results.industry,
                          businessSnapshot: results.businessSnapshot,
                          targetMarket: results.targetMarket,
                          chatbotRole: results.chatbotRole,
                          automations: results.automations,
                          growthPlan: results.growthPlan,
                          strategicInsights: results.strategicInsights,
                          recommendedStack: results.recommendedStack,
                          competitiveAdvantage: results.competitiveAdvantage,
                        })
                        if (activeProjectId) {
                          const activeProject = projectsRef.current.find(p => p.id === activeProjectId)
                          saveProjectContext({ projectId: activeProjectId, projectTitle: activeProject?.title ?? currentIdea.slice(0, 60), originatingBusinessIntelligenceId: activeProjectId, continuityMode: "continuation", source: "Existing Project" })
                        }
                        setLocation("/automation-builder")
                      } : undefined}
                      projectId={activeProjectId ?? undefined}
                      userPlan={subscription?.plan ?? "free"}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="website" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0">
                    <div className="px-4 pt-3 pb-0 shrink-0">
                      <button onClick={() => setShowWebsite(false)} className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
                        {wp.backToAnalysis}
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 overflow-hidden">
                      <WebsitePanel
                        businessIdea={currentIdea}
                        businessIntelligence={results}
                        projectId={activeProjectId}
                        autoGenerate={!!results}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
