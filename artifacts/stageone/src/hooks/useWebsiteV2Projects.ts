import { useCallback, useEffect, useState } from "react"
import { api } from "@/lib/api"

export function useWebsiteV2Projects() {
  const [projects, setProjects] = useState<V2ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(() => {
    setLoading(true)
    setError(null)

    api.websiteV2
      .listProjects()
      .then(({ projects }) => {
        setProjects(projects)
      })
      .catch((e: unknown) => {
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load projects"
        )
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    projects,
    loading,
    error,
    refresh,
  }
}