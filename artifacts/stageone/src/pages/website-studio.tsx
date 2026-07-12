import { useState, useEffect, useMemo, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Globe, Plus, RefreshCw, AlertCircle, Loader, ArrowLeft, ChevronRight, FileCode, Terminal, GitBranch, Sparkles, Building2, Tag, Users, Target, ArrowRight } from "lucide-react"
import { consumePendingIntent, dequeueWorkspaceSignals } from "@/lib/generation-context"
import { useLocation, useParams } from "wouter"
import { ProjectCard } from "@/components/website-v2/ProjectCard"
import { useWebsiteV2Projects } from "@/hooks/useWebsiteV2Projects"
import { StudioShell } from "@/components/website-v2/ide/StudioShell"
import { WebContainerProviderNew } from "@/components/website-v2/runtime/WebContainerProviderNew";
import { useWebsiteV2Project } from "@/hooks/useWebsiteV2Project"
import { useMarcusSessionContext, useMarcusSessionStream } from "@/lib/marcus-session/context"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { api } from "@/lib/api"

type Step = "form" | "workspace"

const INDUSTRY_OPTIONS = [
  "SaaS", "Fintech", "Healthcare", "E-commerce", "Agency",
  "Marketplace", "Education", "Crypto / Web3", "AI / ML", "Other",
]
const AUDIENCE_OPTIONS = [
  "B2B enterprises", "Small businesses", "Developers", "Consumers",
  "Creators", "Investors", "Healthcare professionals", "Other",
]

interface FormState {
  idea: string
  companyName: string
  industry: string
  targetAudience: string
  businessGoal: string
  brandPositioning: string
  conversionGoal: string
}
const EMPTY_FORM: FormState = {
  idea: "", companyName: "", industry: "", targetAudience: "",
  businessGoal: "", brandPositioning: "", conversionGoal: "",
}

function sessionToProject(
  projectId: string,
  projectName: string,
  files: Record<string, { language: string; content: string; complete: boolean }>,
  preview: string | null = null,
): V2Project {
  const projectFiles: V2ProjectFile[] = Object.entries(files)
    .filter(([, f]) => f.complete)
    .map(([path, f]) => ({ path, content: f.content, language: f.language, operation: "create" }))

  return {
    id: projectId,
    projectName: projectName || "My Website",
    status: "active",
    businessContext: {},
    blueprint: null,
    files: projectFiles,
    dependencies: [],
    preview,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

function WebsiteStudioInner() {
  const [, navigate] = useLocation()
  const params = useParams()
  const projectId = params.id && params.id !== "new" ? params.id : null

  const { projects, loading: projectsLoading, error: projectsError, refresh: refreshProjects } = useWebsiteV2Projects()
  const { project, loading: projectLoading, error: projectError, refresh: refreshProject } = useWebsiteV2Project(projectId || "")
  const { start, cancel } = useMarcusSessionStream()
  const { state: session, dispatch } = useMarcusSessionContext()

  // Discard a stale session left over from a different project the moment we
  // land on a URL it doesn't belong to, so it can't resurface again later.
  useEffect(() => {
    if (params.id && session.projectId && params.id !== session.projectId && session.status !== "generating") {
      dispatch({ type: "session.reset" })
    }
  }, [params.id, session.projectId, session.status, dispatch])

  const [livePreview, setLivePreview] = useState<string | null>(null)
  const [previewGenerating, setPreviewGenerating] = useState(false)
  const previewRequestedFor = useRef<string | null>(null)
  // Drop any stale preview the moment the session no longer points at the
  // project it belongs to (reset / switched projects), so a leftover preview
  // from a previous project can't flash before the real one loads.
  useEffect(() => {
    if (previewRequestedFor.current && previewRequestedFor.current !== session.projectId) {
      previewRequestedFor.current = null
      setLivePreview(null)
      setPreviewGenerating(false)
    }
  }, [session.projectId])

  const [step, setStep] = useState<Step>("form")
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const ideaRef = useRef<HTMLTextAreaElement>(null)
  const formIdeaRef = useRef<string>("")
  useEffect(() => { formIdeaRef.current = form.idea }, [form.idea])

  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { ideaRef.current?.focus() }, [step])
  useEffect(() => { formIdeaRef.current = form.idea }, [form.idea])

  // ── Consume pending intent from Copilot navigation ────────────────────────
  // When Marcus navigates here with a website idea, consume the pending intent
  // and populate the form with a typewriter animation. This is the ONLY copilot
  // coupling — navigation + populate. Generation is always via standalone button.
  useEffect(() => {
    const intent = consumePendingIntent("website")
    const queued = dequeueWorkspaceSignals("website")
    const populateSignal = queued.find(s => s.type === "populate" && s.payload)
    const idea = intent?.idea || populateSignal?.payload || ""

    if (idea) {
      typewriterPopulate(idea)
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Typewriter populate
  const typewriterPopulate = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current)
    setForm(prev => ({ ...prev, idea: "" }))
    setFormError(null)
    let i = 0
    typewriterRef.current = setInterval(() => {
      i++
      setForm(prev => ({ ...prev, idea: text.slice(0, i) }))
      if (i >= text.length) {
        clearInterval(typewriterRef.current!)
        typewriterRef.current = null
      }
    }, 20)
  }, [])

  // ── Generate: land directly in the workspace (Replit-style) ───────────────────
  // We don't show a separate "generating" screen. Instead we switch straight to
  // the workspace view and start the session in the background. The workspace
  // renders Marcus's live work (streaming files + agent conversation) until the
  // WebContainer is ready to boot with the finished project.
  const handleGenerate = useCallback(async (ideaOverride?: string) => {
    const idea = (ideaOverride ?? form.idea).trim()
    if (!idea) {
      setFormError("Please describe your business idea.")
      ideaRef.current?.focus()
      return
    }
    setFormError(null)
    setStep("workspace")

    const bi: Record<string, unknown> = {}
    if (form.companyName) bi.companyName = form.companyName
    if (form.industry) bi.industry = form.industry
    if (form.targetAudience) bi.targetAudience = form.targetAudience
    if (form.businessGoal) bi.businessGoal = form.businessGoal
    if (form.brandPositioning) bi.brandPositioning = form.brandPositioning
    if (form.conversionGoal) bi.conversionGoal = form.conversionGoal

    // Fire and forget — the workspace renders the live session as it streams.
    void start(idea, Object.keys(bi).length > 0 ? bi : undefined)
  }, [form, start])

  // Once the backend creates the project, sync the address bar to
  // /website-studio/:id (so refresh/share/Back land on the right project).
  //
  // This must NOT go through wouter's navigate(): AnimatedRoutes keys its
  // AnimatePresence transition on the full location string, so any router
  // navigation — even a "replace" — unmounts and remounts this entire page
  // (and the MarcusSessionProvider with it), killing the live SSE stream
  // mid-generation. A raw History API call updates the visible URL without
  // notifying the router, so no remount happens while Marcus is still working.
  useEffect(() => {
    if (step !== "workspace" || !session.projectId) return
    const segs = window.location.pathname.split("/")
    const currentId = segs[segs.length - 1]
    if (currentId !== session.projectId) {
      window.history.replaceState(null, "", `/website-studio/${session.projectId}`)
    }
  }, [session.projectId, step])

  // Refresh the project list once a generation finishes.
  useEffect(() => {
    if (session.status === "editing" && session.projectId) {
      refreshProjects()
    }
  }, [session.status, session.projectId, refreshProjects])

  // ── Preview generation ──────────────────────────────────────────────────────
  // The streaming generation flow (useMarcusStreamGeneration → /api/generate/
  // website-v2/stream) only saves files — it never renders/persists preview
  // HTML. Once the session finishes ("editing"), explicitly regenerate the
  // preview from the saved files so the workspace doesn't show "No preview
  // available" forever. Runs once per completed project id.
  //
  // This call takes ~30-60s (it's its own LLM render pass on the backend), so
  // `previewGenerating` is surfaced to PreviewWorkspace — without it, the
  // panel silently shows "No preview yet" for a full minute, which reads as
  // broken even though the regeneration is working correctly in the background.
  useEffect(() => {
    if (session.status !== "editing" || !session.projectId) return
    if (previewRequestedFor.current === session.projectId) return
    previewRequestedFor.current = session.projectId
    setLivePreview(null)
    setPreviewGenerating(true)
    api.websiteV2
      .regeneratePreview(session.projectId)
      .then((preview) => setLivePreview(preview))
      .catch((e: unknown) => {
        console.error("[website-studio] Preview generation failed", e)
      })
      .finally(() => setPreviewGenerating(false))
  }, [session.status, session.projectId])

  const handleCancel = useCallback(() => {
    cancel()
    setStep("form")
    navigate("/website-studio")
  }, [cancel, navigate])

  const set = (key: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [key]: e.target.value }))

  // ── Render ─────────────────────────────────────────────────────────────────────
  //
  //  Route / step        →  view
  //  ──────────────────────────────────
  //  /website-studio      →  form (detailed form, Replit-style embedded)
  //  /website-studio/:id  →  workspace (live Marcus session)
  //
  const view = step === "workspace" || params.id
    ? "workspace"
    : "form"

  // ── Workspace state (computed unconditionally to keep hooks in order) ─────
  const sessionMatchesRoute = !params.id || params.id === session.projectId
  const liveId = sessionMatchesRoute
    ? session.projectId ?? (session.status === "generating" ? session.sessionId : null)
    : null
  const liveProject = useMemo(() => {
    if (!liveId) return null as unknown as V2Project
    return sessionToProject(
      liveId,
      form.idea.trim().slice(0, 60) || "Your Website",
      session.files,
      livePreview,
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveId, session.files, form.idea, livePreview])

  // ── Homepage: detailed form (Replit-style embedded) ────────────────────────
  if (view === "form") {
    return (
      <div className="flex h-full flex-col overflow-y-auto">
        {/* Hero */}
        <div className="flex shrink-0 items-center gap-3 border-b border-white/[0.06] px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.08]">
            <Globe className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white/90">Website Studio</h1>
            <p className="text-xs text-white/30">Build full Next.js websites with Marcus</p>
          </div>
        </div>

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
                <Sparkles className="h-3 w-3" />
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
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void handleGenerate() }}
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

            {/* Industry */}
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

            {/* Target audience */}
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

            {/* Advanced toggle */}
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
                    { key: "brandPositioning" as const, label: "Brand Positioning", icon: <Sparkles className="h-3 w-3" />, placeholder: "e.g. the affordable Salesforce alternative…" },
                    { key: "conversionGoal" as const, label: "Conversion Goal", icon: <ArrowRight className="h-3 w-3" />, placeholder: "e.g. sign up for free trial, book a demo…" },
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
            {formError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-red-400/80">
                {formError}
              </motion.p>
            )}

            {/* Generate */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => void handleGenerate()}
                disabled={!form.idea.trim()}
                className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-2.5 text-sm font-bold text-black transition-all hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Sparkles className="h-4 w-4" />
                Generate Website
              </button>
              <span className="text-xs text-white/20">Marcus will write the full Next.js codebase</span>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs leading-relaxed text-white/30">
                <span className="font-semibold text-white/50">How it works:</span>{" "}
                Marcus reads your brief, thinks through the design, then streams each file into the
                code editor token by token. When done, your workspace opens instantly — no redirect,
                same Marcus, same session.
              </p>
            </div>

            {/* Existing projects */}
            <div className="mt-10">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-white/30 mb-3">
                {projectsLoading ? "Loading projects…" : projectsError ? "Error loading projects" : projects.length === 0 ? "" : "Recent projects"}
              </h2>
              {projectsLoading ? (
                <div className="flex items-center gap-2 text-sm text-white/30">
                  <Loader className="h-3.5 w-3.5 animate-spin" />
                  Loading...
                </div>
              ) : projectsError ? (
                <div className="flex items-center gap-2 text-sm text-red-400/70">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {projectsError}
                </div>
              ) : projects.length === 0 ? null : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {projects.map((p, i) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      index={i}
                      onClick={() => navigate(`/website-studio/${p.id}`)}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Workspace (live Marcus session) ──────────────────────────────────────────
    // ── Live generation (new project) ───────────────────────────────────────
    // The session is active (sessionId/projectId set) before files finish
    // streaming, so we render the full IDE shell immediately — no "generating"
    // screen. The WebContainer boot is deferred (enabled=false) while Marcus is
    // still writing files; it fires the moment generation completes.
    //
    // Session state is persisted across page mounts (see marcus-session/context)
    // so a chat/timeline survives navigation — but that means a *stale* session
    // from a previous, unrelated project can still be sitting around when the
    // user opens a different project by URL. Only trust the session as "live"
    // when there's no specific project in the URL (a fresh generation redirect)
    // or when the URL's project id matches the session's own project id.
    if (liveId && liveProject) {
      // Generation failed — show the error and a way back.
      if (session.status === "failed") {
        return (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-red-500/20 bg-red-500/[0.08]">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <h2 className="text-base font-semibold text-white/90">Generation failed</h2>
              <p className="mt-2 text-sm text-white/40">
                {session.error ?? "Marcus ran into an unexpected error while building your website."}
              </p>
              <button
                onClick={() => navigate("/website-studio")}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:bg-white/15"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Website Studio
              </button>
            </div>
          </div>
        )
      }

      const shell = <StudioShell project={liveProject} onRefresh={() => {}} session={session} previewGenerating={previewGenerating} />

      return (
        <div className="flex flex-1 min-w-0 h-full overflow-hidden">
          {/* Boot immediately (Replit/v0 style) so dev server is ready when Marcus finishes */}
          <WebContainerProviderNew project={liveProject} enabled={true}>
            {shell}
          </WebContainerProviderNew>
        </div>
      )
    }

    // ── Existing / fetched project ──────────────────────────────────────────
    if (project) {
      return (
        <div className="flex flex-1 min-w-0 h-full overflow-hidden">
          <WebContainerProviderNew project={project} enabled={true}>
            <StudioShell project={project} onRefresh={refreshProject} session={null} />
          </WebContainerProviderNew>
        </div>
      )
    }

    // Loading project data
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 rounded-lg border border-white/10 bg-white/[0.03] flex items-center justify-center mx-auto mb-3">
            <Loader className="h-4 w-4 text-white/30 animate-spin" />
          </div>
          <p className="text-sm text-white/50">Loading project...</p>
        </div>
      </div>
    )
  }

export default function WebsiteStudioPage() {
  return <WebsiteStudioInner />
}