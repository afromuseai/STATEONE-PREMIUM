import { useState, useEffect } from "react"
import { api } from "@/lib/api"

export interface V2ProjectFile {
  path: string
  operation: string
  content: string
  language?: string
}

export interface V2Project {
  id: string
  projectName: string
  status: string
  businessContext: Record<string, unknown>
  blueprint: Record<string, unknown> | null
  files: V2ProjectFile[]
  dependencies: string[]
  preview: string | null
  createdAt: string
  updatedAt: string
}

export function useWebsiteV2Project(id: string | null) {
  const [project, setProject] = useState<V2Project | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.websiteV2
      .getProject(id)
      .then((data) => setProject(data as V2Project))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load project"))
      .finally(() => setLoading(false))
  }, [id])

  return { project, loading, error }
}
