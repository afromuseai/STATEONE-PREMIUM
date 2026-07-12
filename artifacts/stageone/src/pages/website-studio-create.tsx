// ─── Website Studio Create — Replit-style live workspace ─────────────────────
// Flow:
//   1. Input screen — clean chat-style prompt
//   2. Workspace — opens immediately on submit; Marcus streams live into the
//      AgentConversation side panel while files populate the editor in real time.
//   There is no separate "generating" screen. The workspace IS the generation UI.

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Globe, Sparkles, ArrowLeft, ChevronRight,
  ArrowUp, Plus, Building2, Users, Tag, Wand2,
} from "lucide-react"
import { WebContainerProviderNew } from "@/components/website-v2/runtime/WebContainerProviderNew"
import { StudioShell }            from "@/components/website-v2/ide/StudioShell"
import {
  MarcusSessionProvider,
  useMarcusSessionContext,
  useMarcusSessionStream,
} from "@/lib/marcus-session/context"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"

// ─── Orbit animation (same token as EditorChatPanel) ─────────────────────────
const ORBIT_STYLE = `
@keyframes ws-orbit-spin {
  to { transform: rotate(360deg); }
}
.ws-orbit-wrapper {
  position: relative;
  border-radius: 13.5px;
  overflow: hidden;
}
.ws-orbit-wrapper::before {
  content: '';
  position: absolute;
  inset: -150%;
  background: conic-gradient(
    from 0deg,
    transparent 0%,
    transparent 30%,
    #D4A72C 50%,
    #ffffff 65%,
    transparent 80%,
    transparent 100%
  );
  animation: ws-orbit-spin 2.4s linear infinite;
  z-index: 0;
}
.ws-orbit-wrapper::after {
  content: '';
  position: absolute;
  inset: 1px;
  border-radius: 12px;
  background: #202020;
  z-index: 1;
}
.ws-orbit-inner {
  position: relative;
  z-index: 2;
}
`

// ─── Quick-select options ──────────────────────────────────────────────────────
const INDUSTRY_OPTIONS = [
  "SaaS", "Fintech", "Healthcare", "E-commerce", "Agency",
  "Marketplace", "Education", "Crypto / Web3", "AI / ML", "Other",
]
const AUDIENCE_OPTIONS = [
  "B2B enterprises", "Small businesses", "Developers", "Consumers",
  "Creators", "Investors", "Healthcare professionals", "Other",
]

interface FormState {
  idea:           string
  companyName:    string
  industry:       string
  targetAudience: string
}
const EMPTY_FORM: FormState = { idea: "", companyName: "", industry: "", targetAudience: "" }

// ─── Build a V2Project from in-memory session files ───────────────────────────
function sessionToProject(
  projectId: string,
  projectName: string,
  files: Record<string, { language: string; content: string; complete: boolean }>,
): V2Project {
  const projectFiles: V2ProjectFile[] = Object.entries(files)
    .filter(([, f]) => f.complete)
    .map(([path, f]) => ({ path, content: f.content, language: f.language, operation: "create" }))

  return {
    id:              projectId,
    projectName:     projectName || "My Website",
    status:          "active",
    businessContext: {},
    blueprint:       null,
    files:           projectFiles,
    dependencies:    [],
    preview:         null,
    createdAt:       new Date().toISOString(),
    updatedAt:       new Date().toISOString(),
  }
}

// ─── Inner component — consumes the MarcusSessionContext ─────────────────────
function WebsiteStudioCreateInner() {
  const { state: session } = useMarcusSessionContext()
  const { start, cancel }  = useMarcusSessionStream()

  // Only two steps: input → workspace (no separate "generating" screen)
  const [inWorkspace, setInWorkspace] = useState(false)
  const [form, setForm]               = useState<FormState>(EMPTY_FORM)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [formError, setFormError]     = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const ideaRef = useRef<HTMLTextAreaElement>(null)

  // Keep a stable mirror of form.idea for closures that must not capture stale state
  const formIdeaRef = useRef<string>("")
  useEffect(() => { formIdeaRef.current = form.idea }, [form.idea])

  useEffect(() => { ideaRef.current?.focus() }, [])

  // Auto-resize textarea
  useEffect(() => {
    const el = ideaRef.current
    if (!el) return
    el.style.height = "auto"
    const next = Math.min(el.scrollHeight, 240)
    el.style.height = `${Math.max(next, 56)}px`
  }, [form.idea])

  // Update URL once the project is persisted server-side
  useEffect(() => {
    if (session.projectId && inWorkspace) {
      window.history.replaceState(null, "", `/website-studio/${session.projectId}`)
    }
  }, [session.projectId, inWorkspace])

  // If generation fails, return to input
  useEffect(() => {
    if (session.status === "failed" && session.error && inWorkspace && !session.projectId) {
      setFormError(session.error)
      setInWorkspace(false)
      setIsSubmitting(false)
    }
  }, [session.status, session.error, inWorkspace, session.projectId])

  // ─── Submit ──────────────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (ideaOverride?: string) => {
    const idea = (ideaOverride ?? form.idea).trim()
    if (!idea) {
      setFormError("Please describe what you want to build.")
      ideaRef.current?.focus()
      return
    }
    setFormError(null)
    setIsSubmitting(true)

    // Open workspace immediately — streaming will appear in the side panel
    setInWorkspace(true)

    const bi: Record<string, unknown> = {}
    if (form.companyName)    bi.companyName    = form.companyName
    if (form.industry)       bi.industry       = form.industry
    if (form.targetAudience) bi.targetAudience = form.targetAudience

    await start(idea, Object.keys(bi).length > 0 ? bi : undefined)
    setIsSubmitting(false)
  }, [form, start])

  const handleCancel = useCallback(() => {
    cancel()
    setInWorkspace(false)
    setIsSubmitting(false)
  }, [cancel])

  const set = (key: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [key]: e.target.value }))

  // ─── Workspace — opens instantly, Marcus streams into AgentConversation ───
  if (inWorkspace) {
    // Brief moment before the server assigns a projectId
    if (!session.projectId) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[#0e0e0e]">
          <div className="flex flex-col items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.08]">
              <Globe className="h-5 w-5 text-amber-400" />
              <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-50" />
                <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-amber-400" />
              </span>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-white/70">Starting workspace…</p>
              <p className="mt-1 text-xs text-white/30">Marcus is spinning up your project</p>
            </div>
            <button
              onClick={handleCancel}
              className="text-xs text-white/25 underline underline-offset-2 hover:text-white/50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )
    }

    // Workspace is live — pass the session so AgentConversation shows streaming
    const project = sessionToProject(
      session.projectId,
      form.idea.slice(0, 60),
      session.files,
    )

    return (
      <div className="flex flex-1 min-w-0 h-full overflow-hidden">
        <WebContainerProviderNew>
          <StudioShell
            project={project}
            onRefresh={() => {}}
            session={session.status === "generating" ? session : null}
          />
        </WebContainerProviderNew>
      </div>
    )
  }

  // ─── Input screen — Replit-style single prompt ────────────────────────────
  const isWorking = isSubmitting || session.status === "generating"

  return (
    <>
      <style>{ORBIT_STYLE}</style>
      <div className="flex h-full flex-col overflow-y-auto bg-[#0e0e0e]">

        {/* Top nav */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex shrink-0 items-center gap-3 border-b border-white/[0.05] px-6 py-4"
        >
          <button
            onClick={() => window.history.back()}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.08] text-white/25 transition-colors hover:border-white/[0.15] hover:text-white/55"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/[0.08]">
            <Globe className="h-4 w-4 text-amber-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white/85">Website Studio</h1>
            <p className="text-[11px] text-white/30">Describe your idea — Marcus builds it live</p>
          </div>
        </motion.div>

        {/* Hero prompt area */}
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.05 }}
            className="w-full max-w-2xl space-y-6"
          >
            {/* Branding mark */}
            <div className="flex flex-col items-center gap-3 pb-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-400/15 bg-amber-400/[0.06]">
                <Sparkles className="h-6 w-6 text-amber-400/80" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold text-white/90">What do you want to build?</h2>
                <p className="mt-1.5 text-sm text-white/35">
                  Describe your idea and Marcus will write the entire codebase — live, in your workspace.
                </p>
              </div>
            </div>

            {/* Main input with orbit when submitting */}
            <div className={isWorking ? "ws-orbit-wrapper" : ""}>
              <div className={`${isWorking ? "ws-orbit-inner" : ""} rounded-[13px] border border-white/[0.08] bg-[#202020] px-4 py-3.5`}>
                <textarea
                  ref={ideaRef}
                  value={form.idea}
                  onChange={set("idea")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      void handleGenerate()
                    }
                  }}
                  placeholder={isWorking ? "Marcus is building your website…" : "Describe what you want to build…"}
                  disabled={isWorking}
                  rows={1}
                  style={{ minHeight: "56px", maxHeight: "240px" }}
                  className="w-full resize-none bg-transparent text-[14px] leading-relaxed text-white/85 placeholder-white/20 outline-none disabled:cursor-not-allowed overflow-y-auto"
                />

                {/* Bottom row inside box */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[11px] text-white/20">Shift + Enter for new line</span>

                  <button
                    onClick={() => void handleGenerate()}
                    disabled={!form.idea.trim() || isWorking}
                    className="flex h-8 w-8 items-center justify-center rounded-lg transition-all disabled:cursor-not-allowed disabled:opacity-25"
                    style={form.idea.trim() && !isWorking
                      ? { backgroundColor: "#D4A72C" }
                      : { backgroundColor: "rgba(255,255,255,0.06)" }}
                    title="Build website (Enter)"
                  >
                    <ArrowUp
                      className="h-4 w-4"
                      style={{ color: form.idea.trim() && !isWorking ? "#000" : "rgba(255,255,255,0.4)" }}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {formError && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-sm text-red-400/80"
                >
                  {formError}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Optional context */}
            <div className="space-y-4">
              <button
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1.5 text-[11px] text-white/22 transition-colors hover:text-white/45"
              >
                <Plus className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-45" : ""}`} />
                Add context (company, industry, audience)
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden space-y-5"
                  >
                    {/* Company name */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        <Building2 className="h-2.5 w-2.5" />
                        Company Name
                      </label>
                      <input
                        type="text"
                        value={form.companyName}
                        onChange={set("companyName")}
                        placeholder="e.g. Acme Corp, FlowAI…"
                        className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-sm text-white/80 placeholder-white/20 outline-none transition-colors focus:border-amber-400/25 focus:bg-white/[0.05]"
                      />
                    </div>

                    {/* Industry */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        <Tag className="h-2.5 w-2.5" />
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
                                : "border-white/[0.08] bg-white/[0.02] text-white/35 hover:border-white/[0.14] hover:text-white/55"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Target audience */}
                    <div className="space-y-2">
                      <label className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/30">
                        <Users className="h-2.5 w-2.5" />
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
                                : "border-white/[0.08] bg-white/[0.02] text-white/35 hover:border-white/[0.14] hover:text-white/55"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <ChevronRight className="h-0 w-0 opacity-0" />{/* keep import alive */}
                    <Wand2 className="h-0 w-0 opacity-0" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* How it works footnote */}
            <p className="text-center text-[11px] leading-relaxed text-white/18">
              The workspace opens the moment you submit. Marcus plans, thinks, and writes every file
              live — you watch it happen in real time.
            </p>
          </motion.div>
        </div>
      </div>
    </>
  )
}

// ─── Outer export ─────────────────────────────────────────────────────────────
export default function WebsiteStudioCreatePage() {
  return (
    <MarcusSessionProvider>
      <WebsiteStudioCreateInner />
    </MarcusSessionProvider>
  )
}
