import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "wouter"
import { CheckCircle2, Circle, X, Sparkles, ArrowRight, ChevronDown } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { api, type Project } from "@/lib/api"

interface Step {
  id: string
  label: string
  description: string
  href: string
  done: boolean
}

const DISMISS_KEY = (uid: string) => `onboarding:dismissed:${uid}`
const VISITED_KEY = (uid: string, page: string) => `onboarding:visited:${uid}:${page}`

export function OnboardingChecklist() {
  const { user } = useAuth()
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(true)
  const [visitedAgents, setVisitedAgents] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])

  useEffect(() => {
    if (!user) return

    const daysSinceSignup = (Date.now() - new Date(user.createdAt).getTime()) / 86400000
    if (daysSinceSignup > 30) return

    const isDismissed = localStorage.getItem(DISMISS_KEY(user.id)) === "1"
    setDismissed(isDismissed)
    if (isDismissed) return

    setVisitedAgents(localStorage.getItem(VISITED_KEY(user.id, "agents")) === "1")

    api.projects.list()
      .then(({ projects }) => setProjects(projects))
      .catch(() => {})
  }, [user?.id])

  const steps = useMemo<Step[]>(() => {
    const hasProject = projects.length > 0
    const hasWebsite = projects.some(p => p.websiteOutput && Object.keys(p.websiteOutput).length > 0)
    return [
      {
        id: "project",
        label: "Run your first analysis",
        description: "Describe your idea and get a full AI business blueprint.",
        href: "/business-intelligence",
        done: hasProject,
      },
      {
        id: "website",
        label: "Generate a website",
        description: "Turn your blueprint into a live, editable website.",
        href: "/website-studio/new",
        done: hasWebsite,
      },
      {
        id: "agents",
        label: "Install an AI Agent",
        description: "Browse the Agent Store and install your first agent.",
        href: "/agents",
        done: visitedAgents,
      },
    ]
  }, [projects, visitedAgents])

  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length
  const pct = Math.round((doneCount / steps.length) * 100)

  const handleDismiss = () => {
    if (user) localStorage.setItem(DISMISS_KEY(user.id), "1")
    setDismissed(true)
  }

  const markVisited = (stepId: string) => {
    if (!user) return
    if (stepId === "agents") {
      localStorage.setItem(VISITED_KEY(user.id, "agents"), "1")
      setVisitedAgents(true)
    }
  }

  if (!user || dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 12, scale: 0.96 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-5 right-5 z-40 w-72"
    >
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, #1a1a1a 0%, #111 100%)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,162,39,0.08)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
          style={{ borderBottom: expanded ? "1px solid rgba(255,255,255,0.06)" : "none" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(201,162,39,0.12)", border: "1px solid rgba(201,162,39,0.2)" }}
            >
              <Sparkles className="w-3.5 h-3.5" style={{ color: "#c9a227" }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-none" style={{ color: "#f0f0f0" }}>
                {allDone ? "Setup complete!" : "Getting started"}
              </p>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, #c9a227, #e8c547)" }}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] shrink-0 tabular-nums" style={{ color: "#666" }}>
                  {doneCount}/{steps.length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 ml-2 shrink-0">
            <motion.div animate={{ rotate: expanded ? 0 : -90 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="w-3.5 h-3.5" style={{ color: "#555" }} />
            </motion.div>
            <button
              onClick={e => { e.stopPropagation(); handleDismiss() }}
              className="ml-1 p-1 rounded-md transition-colors"
              style={{ color: "#555" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#999")}
              onMouseLeave={e => (e.currentTarget.style.color = "#555")}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Steps */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              key="steps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="px-3 py-2 space-y-0.5">
                {steps.map((step, i) => (
                  <Link
                    key={step.id}
                    href={step.done ? "#" : step.href}
                    onClick={() => !step.done && markVisited(step.id)}
                  >
                    <motion.div
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.18 }}
                      className="group flex items-center gap-3 px-2.5 py-2.5 rounded-xl transition-all"
                      style={{
                        opacity: step.done ? 0.45 : 1,
                        cursor: step.done ? "default" : "pointer",
                      }}
                      onMouseEnter={e => {
                        if (!step.done) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = "transparent"
                      }}
                    >
                      <div className="shrink-0">
                        {step.done ? (
                          <CheckCircle2 className="w-4 h-4" style={{ color: "#c9a227" }} />
                        ) : (
                          <Circle className="w-4 h-4" style={{ color: "rgba(255,255,255,0.2)" }} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-medium leading-none truncate"
                          style={{
                            color: step.done ? "#555" : "#d0d0d0",
                            textDecoration: step.done ? "line-through" : "none",
                          }}
                        >
                          {step.label}
                        </p>
                        {!step.done && (
                          <p className="text-[10px] mt-0.5 leading-snug truncate" style={{ color: "#555" }}>
                            {step.description}
                          </p>
                        )}
                      </div>
                      {!step.done && (
                        <ArrowRight
                          className="w-3 h-3 shrink-0 transition-transform group-hover:translate-x-0.5"
                          style={{ color: "#444" }}
                        />
                      )}
                    </motion.div>
                  </Link>
                ))}
              </div>

              {allDone && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mx-3 mb-3 px-3 py-2.5 rounded-xl text-center"
                  style={{ background: "rgba(201,162,39,0.07)", border: "1px solid rgba(201,162,39,0.15)" }}
                >
                  <p className="text-[11px] font-semibold" style={{ color: "#c9a227" }}>
                    You're all set — let's build something great.
                  </p>
                  <button
                    onClick={handleDismiss}
                    className="text-[10px] mt-1 transition-colors"
                    style={{ color: "#555" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#888")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#555")}
                  >
                    Dismiss
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
