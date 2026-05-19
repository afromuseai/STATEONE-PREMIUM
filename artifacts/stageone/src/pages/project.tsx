import { useState, useEffect, useCallback } from "react"
import { useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { OutputPanel, type BusinessIntelligence } from "@/components/dashboard/output-panel"
import { WebsitePanel } from "@/components/dashboard/website-panel"
import { api, type Project } from "@/lib/api"
import { ArrowLeft, RefreshCw, Globe, BarChart3, Loader2, Pencil, Check, X } from "lucide-react"

interface ProjectPageProps {
  id: string
}

export default function ProjectPage({ id }: ProjectPageProps) {
  const [, setLocation] = useLocation()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<"analysis" | "website">("analysis")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleInput, setTitleInput] = useState("")
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")

  useEffect(() => {
    api.projects.get(id)
      .then(({ project }) => {
        setProject(project)
        setTitleInput(project.title)
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  const handleRegenerate = useCallback(async () => {
    if (!project) return
    setRegenerating(true)
    setStreamingText("")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ idea: project.businessIdea }),
      })

      if (!response.ok) throw new Error("Generation failed")

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let lineCarryover = ""
      let finalData: BusinessIntelligence | null = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = lineCarryover + decoder.decode(value, { stream: true })
        const lines = chunk.split("\n")
        lineCarryover = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const data = line.slice(6).trim()
          try {
            const parsed = JSON.parse(data)
            if (parsed.done && parsed.data) finalData = parsed.data
            else if (typeof parsed.content === "string") setStreamingText(prev => prev + parsed.content)
          } catch { /* ignore */ }
        }
      }
      reader.releaseLock()

      if (finalData) {
        const updated = await api.projects.update(id, { output: finalData as unknown as Record<string, unknown> })
        setProject(updated.project)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Regeneration failed")
    } finally {
      setRegenerating(false)
      setStreamingText("")
    }
  }, [project, id])

  const handleSaveTitle = useCallback(async () => {
    if (!titleInput.trim() || !project) return
    setSaveStatus("saving")
    try {
      const updated = await api.projects.update(id, { title: titleInput.trim() })
      setProject(updated.project)
      setEditingTitle(false)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    } catch { setSaveStatus("idle") }
  }, [id, titleInput, project])

  const handleWebsiteSaved = useCallback((websiteData: Record<string, unknown>) => {
    setProject(prev => prev ? { ...prev, websiteOutput: websiteData } : prev)
    setTab("website")
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-red-400">{error ?? "Project not found"}</p>
          <button onClick={() => setLocation("/dashboard?tab=projects")} className="mt-4 text-sm text-primary hover:underline">
            Back to projects
          </button>
        </div>
      </div>
    )
  }

  const biData = project.output as BusinessIntelligence | null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(p => !p)} />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 backdrop-blur-xl px-6 shrink-0">
          <button
            onClick={() => setLocation("/dashboard?tab=projects")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {editingTitle ? (
              <div className="flex items-center gap-2">
                <input
                  value={titleInput}
                  onChange={e => setTitleInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleSaveTitle(); if (e.key === "Escape") setEditingTitle(false) }}
                  autoFocus
                  className="bg-secondary/30 border border-border rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:border-primary"
                />
                <button onClick={handleSaveTitle} disabled={saveStatus === "saving"} className="p-1 rounded text-green-400 hover:bg-green-400/10 transition-colors">
                  {saveStatus === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => { setEditingTitle(false); setTitleInput(project.title) }} className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setEditingTitle(true)} className="flex items-center gap-2 group min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{project.title}</span>
                <Pencil className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </button>
            )}
          </div>
          <button
            onClick={handleRegenerate}
            disabled={regenerating}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all shrink-0"
          >
            {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Regenerate
          </button>
        </header>

        {/* Tabs */}
        <div className="flex items-center gap-1 border-b border-border/50 px-6 shrink-0">
          <button
            onClick={() => setTab("analysis")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "analysis" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5" />
            Business Analysis
          </button>
          <button
            onClick={() => setTab("website")}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "website" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            Website{project.websiteOutput ? " ✓" : ""}
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 min-h-0 ${tab === "website" ? "overflow-hidden flex flex-col" : "overflow-y-auto p-6"}`}>
          <AnimatePresence mode="wait">
            {tab === "analysis" ? (
              <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <OutputPanel
                  data={biData}
                  partialData={{}}
                  isLoading={regenerating}
                  streamingText={streamingText}
                  generationStage={0}
                  onGenerateWebsite={biData ? () => setTab("website") : undefined}
                  onGenerateChatbot={biData ? () => setLocation("/chatbot-generator") : undefined}
                  onBuildAutomation={biData ? () => setLocation("/automation-builder") : undefined}
                />
              </motion.div>
            ) : (
              <motion.div key="website" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0">
                <WebsitePanel
                  businessIdea={project.businessIdea}
                  businessIntelligence={biData}
                  projectId={id}
                  existingOutput={project.websiteOutput as Record<string, unknown> | null}
                  onSaved={handleWebsiteSaved}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
