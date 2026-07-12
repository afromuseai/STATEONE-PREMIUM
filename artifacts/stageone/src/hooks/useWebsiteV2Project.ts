import { useState, useEffect, useCallback } from "react"
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

  const fetch_ = useCallback(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    api.websiteV2
      .getProject(id)
      .then((data) => {
        setProject(data as V2Project)
        setLoading(false)
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        // 429 / rate-limit is transient — keep loading so the UI shows a
        // spinner instead of a false "not found" screen. The polling interval
        // will naturally retry.
        if (/429|rate.li/i.test(msg)) {
          console.warn("[useWebsiteV2Project] Rate limited, will retry")
          return // keep loading=true so the spinner stays visible
        }
        setError(msg)
        setLoading(false)
      })
  }, [id])

  useEffect(() => { fetch_() }, [fetch_])

  // ── Polling ──────────────────────────────────────────────────────────────────
  // When a project is in a non-terminal state (planning/architecting/building),
  // poll every 5s so the UI eventually reflects saved files even when there's
  // no active SSE connection (e.g. page reload mid-generation, or direct URL
  // navigation to an in-progress project).
  // A small random jitter (±1s) avoids thundering-herd on the API.
  const isPollable = project && ["planning", "architecting", "building"].includes(project.status)
  useEffect(() => {
    if (!isPollable) return
    const jitter = Math.round((Math.random() - 0.5) * 2_000) // ±1s
    const interval = setInterval(fetch_, 5_000 + jitter)
    return () => clearInterval(interval)
  }, [isPollable, fetch_])

  return { project, loading, error, refresh: fetch_ }
}
