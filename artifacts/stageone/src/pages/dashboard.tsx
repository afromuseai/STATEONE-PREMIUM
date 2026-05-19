import { useState, useCallback, useRef, useEffect } from "react"
import { useLocation, useSearch } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { InputPanel } from "@/components/dashboard/input-panel"
import { OutputPanel, type BusinessIntelligence } from "@/components/dashboard/output-panel"
import { WebsitePanel } from "@/components/dashboard/website-panel"
import { CommandCenterOverview } from "@/components/dashboard/command-center-overview"
import { useAuth } from "@/lib/auth-context"
import { useBusinessContext } from "@/lib/business-context"
import { api, type Project } from "@/lib/api"
import { recordRevenueSignal } from "@/lib/intelligence-state"
import { saveGenerationContext } from "@/lib/generation-context"
import { useLang } from "@/lib/i18n"
import {
  FolderOpen,
  Plus,
  Clock,
  Sparkles,
  Trash2,
  BarChart3,
  Globe,
  ChevronRight,
  Search,
  AlertTriangle,
  Crown,
  X,
  Bot,
  Workflow,
  Lock,
} from "lucide-react"

type Tab = "overview" | "new" | "projects"


function getTab(search: string): Tab {
  const p = new URLSearchParams(search.replace("?", ""))
  const t = p.get("tab")
  if (t === "new" || t === "projects") return t
  return "overview"
}

// ─── Partial JSON field extractor ────────────────────────────────────────────
function extractValue(text: string, startIdx: number): { value: unknown; end: number } | null {
  const remaining = text.slice(startIdx)
  const c = remaining[0]

  if (c === '"') {
    // String
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

  // Number / bool / null
  const m = /^(-?\d+\.?\d*(?:[eE][+-]?\d+)?|true|false|null)/.exec(remaining)
  if (m) {
    try {
      return { value: JSON.parse(m[1]), end: startIdx + m[1].length }
    } catch { return null }
  }

  return null
}

function extractPartialFields(text: string): Partial<BusinessIntelligence> {
  const result: Partial<BusinessIntelligence> = {}
  const fields: Array<keyof BusinessIntelligence> = [
    "industry", "metrics", "businessSnapshot", "targetMarket",
    "strategicInsights", "competitiveAdvantage", "growthPlan",
    "websitePages", "chatbotRole", "automations", "recommendedStack",
  ]

  for (const field of fields) {
    const pattern = new RegExp(`"${field}"\\s*:\\s*`)
    const m = pattern.exec(text)
    if (!m) continue
    const valueStart = m.index + m[0].length
    if (valueStart >= text.length) continue
    const extracted = extractValue(text, valueStart)
    if (extracted !== null) {
      ;(result as Record<string, unknown>)[field] = extracted.value
    }
  }

  return result
}

function computeStage(partial: Partial<BusinessIntelligence>, text: string): number {
  if (!text) return 0
  if (partial.recommendedStack) return 6
  if (partial.growthPlan && (partial.growthPlan as string[]).length > 0) return 5
  if (partial.competitiveAdvantage) return 4
  if (partial.strategicInsights) return 3
  if (partial.businessSnapshot) return 2
  if (partial.metrics) return 1
  // Detect from raw text when field key first appears
  if (/"recommendedStack"/.test(text)) return 6
  if (/"growthPlan"/.test(text)) return 5
  if (/"competitiveAdvantage"/.test(text)) return 4
  if (/"strategicInsights"/.test(text)) return 3
  if (/"businessSnapshot"/.test(text)) return 2
  if (/"metrics"/.test(text)) return 1
  return 1
}
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { t } = useLang()
  const wp = t.workspace.projects
  const wm = t.workspace.modals
  const { user } = useAuth()
  const { setBusinessData } = useBusinessContext()
  const [location] = useLocation()
  const search = useSearch()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const activeTab = getTab(search)

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

  // Projects state
  const [projects, setProjects] = useState<Project[]>([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const projectsRef = useRef<Project[]>([])
  const [memoryCount, setMemoryCount] = useState(0)
  const [agentCount, setAgentCount] = useState(0)
  const [websiteGenerated, setWebsiteGenerated] = useState(false)

  const [, setLocation] = useLocation()
  const [projectSearch, setProjectSearch] = useState("")
  const [projectStatusFilter, setProjectStatusFilter] = useState<"all" | "active" | "draft" | "completed" | "archived">("all")

  // Subscription state for usage warning + quota enforcement
  const [subscription, setSubscription] = useState<{ aiGenerationsUsed: number; aiGenerationsLimit: number; plan: string } | null>(null)
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)
  const [lockedFeature, setLockedFeature] = useState<{ name: string; icon: React.ReactNode; description: string } | null>(null)

  useEffect(() => {
    api.projects.list().then(({ projects }) => {
      setProjects(projects)
      projectsRef.current = projects
      const hasWebsite = projects.some(p => p.websiteOutput)
      if (hasWebsite) setWebsiteGenerated(true)
    }).catch(() => {}).finally(() => setProjectsLoading(false))

    // Fetch memory count for cross-system context
    fetch("/api/memory", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.memories)) setMemoryCount(d.memories.length) })
      .catch(() => {})

    // Fetch agent count
    fetch("/api/agents?installed=true", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d.agents)) setAgentCount(d.agents.filter((a: {isActive: boolean}) => a.isActive).length) })
      .catch(() => {})

    // Fetch subscription for usage warning
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription) setSubscription(d.subscription) })
      .catch(() => {})
  }, [])

  const handleGenerate = useCallback(async (idea: string) => {
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

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea }),
      })

      if (!response.ok) {
        if (response.status === 429) {
          setShowUpgradeModal(true)
          setIsLoading(false)
          setGenerationStage(0)
          return
        }
        const errorData = await response.json().catch(() => ({ error: "Request failed" }))
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
              // Handle reasoning/phase events from the intelligence engine
              if (parsed.reasoning && !parsed.content) {
                // Pre-flight reasoning events — no UI update needed, backend handles these
              } else if (parsed.reasoningStages && Array.isArray(parsed.reasoningStages)) {
                setReasoningStages(parsed.reasoningStages)
                if (parsed.industry) setDetectedIndustry(parsed.industry)
              } else if (parsed.done && parsed.data) {
                finalData = parsed.data as BusinessIntelligence
              } else if (typeof parsed.content === "string") {
                accumulated += parsed.content
                setStreamingText(accumulated)
                // Progressive parse — update partial data & stage
                const partial = extractPartialFields(accumulated)
                const stage = computeStage(partial, accumulated)
                setPartialData(partial)
                setGenerationStage(stage)
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
      // Update memory count after auto-save (memories are saved async server-side)
      setTimeout(() => {
        fetch("/api/memory", { credentials: "include" })
          .then(r => r.json())
          .then(d => { if (Array.isArray(d.memories)) setMemoryCount(d.memories.length) })
          .catch(() => {})
      }, 2000)

      // Auto-record revenue intelligence signal (fire-and-forget)
      recordRevenueSignal({
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

      // Auto-save to DB
      setSaveStatus("saving")
      const title = idea.length > 60 ? idea.slice(0, 60) + "…" : idea
      try {
        const { project } = await api.projects.create({
          title,
          businessIdea: idea,
          output: finalData as unknown as Record<string, unknown>,
        })
        setActiveProjectId(project.id)
        // Link revenue signal to project (best-effort)
        recordRevenueSignal({
          projectId: project.id,
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
        const updated = [project, ...projectsRef.current].slice(0, 50)
        projectsRef.current = updated
        setProjects(updated)
        setSaveStatus("saved")
        setTimeout(() => setSaveStatus("idle"), 3000)
      } catch { setSaveStatus("idle") }

    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setStreamingText("")
      setPartialData({})
    }
  }, [])

  const handleDeleteProject = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await api.projects.delete(id)
    const updated = projectsRef.current.filter(p => p.id !== id)
    projectsRef.current = updated
    setProjects(updated)
    if (activeProjectId === id) {
      setActiveProjectId(null)
      setResults(null)
    }
  }, [activeProjectId])

  const handleOpenProject = useCallback((project: Project) => {
    setLocation(`/projects/${project.id}`)
  }, [setLocation])

  const formatDate = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    const hrs = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    if (mins < 1) return "Just now"
    if (mins < 60) return `${mins}m ago`
    if (hrs < 24) return `${hrs}h ago`
    if (days < 7) return `${days}d ago`
    return new Date(d).toLocaleDateString()
  }

  const renderOverview = () => (
    <CommandCenterOverview
      user={user}
      projects={projects}
      projectsLoading={projectsLoading}
      agentCount={agentCount}
      memoryCount={memoryCount}
      websiteGenerated={websiteGenerated || showWebsite}
      results={results}
      plan={subscription?.plan ?? "free"}
      onNavigate={setLocation}
      onOpenProject={handleOpenProject}
      onDeleteProject={handleDeleteProject}
      formatDate={formatDate}
    />
  )

  const filteredProjects = projects.filter(p => {
    const matchSearch = !projectSearch ||
      p.title.toLowerCase().includes(projectSearch.toLowerCase()) ||
      p.businessIdea.toLowerCase().includes(projectSearch.toLowerCase())
    const matchStatus = projectStatusFilter === "all" || (p.status ?? "active") === projectStatusFilter
    return matchSearch && matchStatus
  })

  const STATUS_LABELS: Record<string, string> = {
    all: wp.statusAll,
    active: wp.statusActive,
    draft: wp.statusDraft,
    completed: wp.statusCompleted,
    archived: wp.statusArchived,
  }

  const STATUS_COLORS_I18N: Record<string, { label: string; color: string; bg: string; border: string }> = {
    active:    { label: wp.statusActive,    color: "text-emerald-400",      bg: "bg-emerald-500/10", border: "border-emerald-500/25" },
    draft:     { label: wp.statusDraft,     color: "text-muted-foreground", bg: "bg-white/5",        border: "border-white/10" },
    completed: { label: wp.statusCompleted, color: "text-blue-400",         bg: "bg-blue-500/10",    border: "border-blue-500/25" },
    archived:  { label: wp.statusArchived,  color: "text-amber-400",        bg: "bg-amber-500/10",   border: "border-amber-500/25" },
  }

  const renderProjects = () => (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">{wp.allProjects}</h2>
        <button
          onClick={() => setLocation("/dashboard?tab=new")}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />{wp.new}
        </button>
      </div>

      {/* Search + status filter */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            value={projectSearch}
            onChange={e => setProjectSearch(e.target.value)}
            placeholder={wp.searchProjects}
            className="w-full rounded-lg border border-white/8 bg-white/3 pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 transition-colors"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "active", "draft", "completed", "archived"] as const).map(s => (
            <button key={s} onClick={() => setProjectStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold capitalize transition-all border ${
                projectStatusFilter === s
                  ? "bg-primary/12 border-primary/30 text-primary"
                  : "border-white/8 text-muted-foreground hover:text-foreground"
              }`}>
              {s === "all" ? `${STATUS_LABELS.all} (${projects.length})` : `${STATUS_LABELS[s]} (${projects.filter(p => (p.status ?? "active") === s).length})`}
            </button>
          ))}
        </div>
      </div>

      {projectsLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!projectsLoading && projects.length === 0 && (
        <div className="text-center py-16 glass-card rounded-xl">
          <FolderOpen className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-foreground font-medium">{wp.noProjectsYet}</p>
          <p className="text-sm text-muted-foreground mt-1">{wp.noProjectsDesc}</p>
        </div>
      )}

      {!projectsLoading && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="text-center py-10 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{wp.noMatchFilter}</p>
        </div>
      )}

      <div className="grid gap-3">
        {filteredProjects.map((project, i) => {
          const statusConf = STATUS_COLORS_I18N[project.status ?? "active"] ?? STATUS_COLORS_I18N.active
          return (
            <motion.div
              key={project.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => handleOpenProject(project)}
              className="glass-card rounded-xl p-4 hover:border-primary/30 cursor-pointer transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 border border-primary/20 shrink-0">
                  <BarChart3 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{project.title}</p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${statusConf.color} ${statusConf.bg} ${statusConf.border}`}>
                      {statusConf.label}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{project.businessIdea}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {project.websiteOutput && (
                      <span className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded px-1.5 py-0.5">
                        <Globe className="h-2.5 w-2.5" /> {wp.website}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5" /> {formatDate(project.updatedAt)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => handleDeleteProject(project.id, e)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )

  const renderNew = () => (
    <div className="flex flex-1 flex-col lg:flex-row min-h-0">
      <aside className="w-full border-b border-border/50 bg-secondary/20 p-6 lg:w-[400px] lg:border-b-0 lg:border-r xl:w-[450px] shrink-0">
        <InputPanel onGenerate={handleGenerate} isLoading={isLoading} />
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
                  if (subscription?.plan === "free" || !subscription) {
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
                  if (subscription?.plan === "free" || !subscription) {
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
                  setLocation("/chatbot-generator")
                } : undefined}
                onBuildAutomation={results ? () => {
                  if (subscription?.plan === "free" || !subscription) {
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
  )

  const tabFromSearch = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("tab") : null

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
                  onClick={() => { setLockedFeature(null); setLocation("/pricing") }}
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
                  onClick={() => { setShowUpgradeModal(false); setLocation("/pricing") }}
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
                  onClick={() => setLocation("/pricing")}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition-colors border border-amber-500/30 rounded-full px-3 py-1 bg-amber-500/6 hover:bg-amber-500/12 shrink-0"
                >
                  <Crown className="h-2.5 w-2.5" />
                  {t.workspace.overview.upgrade}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className={`flex-1 min-h-0 ${tabFromSearch === "new" ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
          <AnimatePresence mode="wait">
            {tabFromSearch === "new" ? (
              <motion.div key="new" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0">
                {renderNew()}
              </motion.div>
            ) : tabFromSearch === "projects" ? (
              <motion.div key="projects" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {renderProjects()}
              </motion.div>
            ) : (
              <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {renderOverview()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
