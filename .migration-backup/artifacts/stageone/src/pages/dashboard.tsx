import { useState, useEffect, useCallback, useRef } from "react"
import { DashboardHeader } from "@/components/dashboard/header"
import { InputPanel } from "@/components/dashboard/input-panel"
import { OutputPanel, type BusinessIntelligence } from "@/components/dashboard/output-panel"
import { Sidebar, type Project } from "@/components/dashboard/sidebar"

interface SavedProject extends Project {
  cachedResult?: BusinessIntelligence
}

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<BusinessIntelligence | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<SavedProject[]>([])
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [streamingText, setStreamingText] = useState("")
  const projectsRef = useRef<SavedProject[]>([])

  useEffect(() => {
    const savedProjects = localStorage.getItem("stageone-projects")
    if (savedProjects) {
      try {
        const parsed = JSON.parse(savedProjects)
        setProjects(parsed)
        projectsRef.current = parsed
      } catch {
        localStorage.removeItem("stageone-projects")
      }
    }
  }, [])

  const persistProjects = useCallback((newProjects: SavedProject[]) => {
    projectsRef.current = newProjects
    setProjects(newProjects)
    localStorage.setItem("stageone-projects", JSON.stringify(newProjects))
  }, [])

  const handleGenerate = useCallback(async (idea: string, projectId?: string) => {
    setIsLoading(true)
    setResults(null)
    setError(null)
    setStreamingText("")

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Request failed" }))
        throw new Error(errorData.error || `Server error: ${response.status}`)
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No response stream available")

      const decoder = new TextDecoder()
      let lineCarryover = ""
      let finalData: BusinessIntelligence | null = null
      let streamError: string | null = null

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
              if (parsed.done && parsed.data) {
                finalData = parsed.data as BusinessIntelligence
              } else if (typeof parsed.content === "string") {
                setStreamingText(prev => prev + parsed.content)
              }
            } catch { /* incomplete JSON fragment */ }
          }

          if (streamError) break
        }
      } finally {
        reader.releaseLock()
      }

      if (streamError) throw new Error(streamError)

      if (finalData) {
        setResults(finalData)

        if (projectId) {
          // Update cached result on existing project
          const updated = projectsRef.current.map(p =>
            p.id === projectId ? { ...p, cachedResult: finalData! } : p
          )
          persistProjects(updated)
        } else {
          // Create new project entry with cached result
          const newProject: SavedProject = {
            id: crypto.randomUUID(),
            title: idea.length > 50 ? idea.slice(0, 50) + "..." : idea,
            businessIdea: idea,
            createdAt: new Date().toISOString(),
            cachedResult: finalData,
            metrics: {
              businessType: finalData.industry,
              scalabilityScore: finalData.metrics.revenueScalability,
            },
          }
          const updated = [newProject, ...projectsRef.current].slice(0, 20)
          persistProjects(updated)
          setActiveProjectId(newProject.id)
        }
      } else {
        throw new Error("No analysis data received — please try again")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred")
    } finally {
      setIsLoading(false)
      setStreamingText("")
    }
  }, [persistProjects])

  const handleSelectProject = useCallback((project: SavedProject) => {
    setActiveProjectId(project.id)
    setError(null)
    // Restore cached result if available — no re-generation needed
    if (project.cachedResult) {
      setResults(project.cachedResult)
    } else {
      handleGenerate(project.businessIdea, project.id)
    }
  }, [handleGenerate])

  const handleNewProject = useCallback(() => {
    setActiveProjectId(null)
    setResults(null)
    setError(null)
    setStreamingText("")
  }, [])

  const handleDeleteProject = useCallback((id: string) => {
    const updated = projectsRef.current.filter(p => p.id !== id)
    persistProjects(updated)
    if (activeProjectId === id) handleNewProject()
  }, [activeProjectId, handleNewProject, persistProjects])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={handleSelectProject}
        onNewProject={handleNewProject}
        onDeleteProject={handleDeleteProject}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
      />

      <div className="flex flex-1 flex-col min-h-screen">
        <DashboardHeader />

        <main className="flex flex-1 flex-col lg:flex-row">
          <aside className="w-full border-b border-border/50 bg-secondary/20 p-6 lg:w-[400px] lg:border-b-0 lg:border-r xl:w-[450px]">
            <InputPanel onGenerate={handleGenerate} isLoading={isLoading} />
            {error && (
              <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
          </aside>

          <section className="flex-1 p-6">
            <OutputPanel
              data={results}
              isLoading={isLoading}
              streamingText={streamingText}
            />
          </section>
        </main>
      </div>
    </div>
  )
}
