import { motion } from "framer-motion"
import { ArrowLeft, AlertCircle, Loader } from "lucide-react"
import { useLocation } from "wouter"
import { StudioShell }           from "@/components/website-v2/ide/StudioShell"
import { WebContainerProviderNew }  from "@/components/website-v2/runtime/WebContainerProviderNew"
import { useWebsiteV2Project }   from "@/hooks/useWebsiteV2Project"
// Session provider is at App level — no local wrapper needed.

interface WebsiteStudioWorkspacePageProps {
  id: string
}

export default function WebsiteStudioWorkspacePage({ id }: WebsiteStudioWorkspacePageProps) {
  const [, navigate] = useLocation()
  const { project, loading, error, refresh } = useWebsiteV2Project(id)

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader className="h-7 w-7 animate-spin text-amber-400/60" />
          <p className="text-sm text-white/30">Loading workspace…</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <AlertCircle className="h-10 w-10 text-red-400/50" />
          <div>
            <p className="font-semibold text-white/60">Project not found</p>
            <p className="mt-1 text-sm text-white/30">{error ?? "This project may have been deleted."}</p>
          </div>
          <button
            onClick={() => navigate("/website-studio")}
            className="flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-sm text-white/50 transition-colors hover:border-white/20 hover:text-white/80"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 min-w-0 h-full overflow-hidden">
      <WebContainerProviderNew project={project}>
        <StudioShell project={project} onRefresh={refresh} />
      </WebContainerProviderNew>
    </div>
  )
}
