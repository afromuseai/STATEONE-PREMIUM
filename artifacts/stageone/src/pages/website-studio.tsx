import { motion } from "framer-motion"
import { Globe, Plus, RefreshCw, AlertCircle, Loader } from "lucide-react"
import { useLocation } from "wouter"
import { ProjectCard } from "@/components/website-v2/ProjectCard"
import { useWebsiteV2Projects } from "@/hooks/useWebsiteV2Projects"

export default function WebsiteStudioPage() {
  const [, navigate] = useLocation()
  const { projects, loading, error, refresh } = useWebsiteV2Projects()

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="flex flex-shrink-0 items-center justify-between border-b border-white/8 px-6 py-4"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/8">
            <Globe className="h-4.5 w-4.5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white/90">Website Studio</h1>
            <p className="text-xs text-white/35">V2 generated projects</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refresh}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-colors hover:border-white/20 hover:text-white/70"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => navigate("/website-generator")}
            className="flex items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-1.5 text-sm font-semibold text-amber-400 transition-all hover:bg-amber-400/15"
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>
        </div>
      </motion.div>

      {/* Body */}
      <div className="flex-1 px-6 py-6">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <Loader className="h-6 w-6 animate-spin text-amber-400/60" />
              <p className="text-sm text-white/30">Loading projects…</p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <AlertCircle className="h-8 w-8 text-red-400/60" />
              <p className="text-sm text-white/50">{error}</p>
              <button
                onClick={refresh}
                className="text-xs text-amber-400/70 underline underline-offset-2 hover:text-amber-400"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/8 bg-white/[0.03]">
              <Globe className="h-8 w-8 text-white/20" />
            </div>
            <h2 className="text-base font-semibold text-white/50">No projects yet</h2>
            <p className="mt-1 max-w-xs text-sm text-white/25">
              Use the Website Generator to create your first V2 project. It will appear here once generated.
            </p>
            <button
              onClick={() => navigate("/website-generator")}
              className="mt-5 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-5 py-2 text-sm font-semibold text-amber-400 transition-all hover:bg-amber-400/15"
            >
              <Plus className="h-4 w-4" />
              Create first project
            </button>
          </motion.div>
        )}

        {!loading && !error && projects.length > 0 && (
          <div>
            <p className="mb-4 text-xs text-white/25">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((p, i) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  index={i}
                  onClick={() => navigate(`/website-studio/${p.id}`)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
