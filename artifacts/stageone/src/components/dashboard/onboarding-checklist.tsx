import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Link } from "wouter"
import { CheckCircle2, Circle, ChevronUp, ChevronDown, X, Sparkles, ArrowRight } from "lucide-react"
import type { Project } from "@/lib/api"

interface Step {
  id: string
  label: string
  description: string
  href?: string
  done: boolean
}

interface Props {
  userId: string
  projects: Project[]
}

const DISMISS_KEY = (uid: string) => `onboarding:dismissed:${uid}`
const VISITED_KEY = (uid: string, page: string) => `onboarding:visited:${uid}:${page}`

export function OnboardingChecklist({ userId, projects }: Props) {
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(false)
  const [visitedAgent, setVisitedAgent] = useState(false)
  const [visitedDev, setVisitedDev] = useState(false)

  // Load persisted state
  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY(userId)) === "1")
    setVisitedAgent(localStorage.getItem(VISITED_KEY(userId, "agents")) === "1")
    setVisitedDev(localStorage.getItem(VISITED_KEY(userId, "developer")) === "1")
  }, [userId])

  const steps = useMemo<Step[]>(() => {
    const hasProject = projects.length > 0
    const hasWebsite = projects.some(p => p.websiteOutput && Object.keys(p.websiteOutput).length > 0)
    return [
      {
        id: "account",
        label: "Create your account",
        description: "You're in. Your AI Operating System is live.",
        done: true,
      },
      {
        id: "project",
        label: "Describe your first business idea",
        description: "Run the AI analysis to get your full business blueprint.",
        href: "/dashboard?tab=new",
        done: hasProject,
      },
      {
        id: "website",
        label: "Generate a website",
        description: "Turn your business idea into a live, editable website.",
        href: hasProject ? "/dashboard?tab=projects" : "/dashboard?tab=new",
        done: hasWebsite,
      },
      {
        id: "agents",
        label: "Visit the Agent Store",
        description: "Browse and install AI agents for sales, support, and more.",
        href: "/agents",
        done: visitedAgent,
      },
      {
        id: "developer",
        label: "Get your API key",
        description: "Access the developer platform and connect external tools.",
        href: "/developer",
        done: visitedDev,
      },
    ]
  }, [projects, visitedAgent, visitedDev])

  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY(userId), "1")
    setDismissed(true)
  }

  const handleStepClick = (stepId: string) => {
    if (stepId === "agents") {
      localStorage.setItem(VISITED_KEY(userId, "agents"), "1")
      setVisitedAgent(true)
    }
    if (stepId === "developer") {
      localStorage.setItem(VISITED_KEY(userId, "developer"), "1")
      setVisitedDev(true)
    }
  }

  if (dismissed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.97 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 right-6 z-40 w-80"
      style={{ filter: "drop-shadow(0 8px 32px rgba(0,0,0,0.5))" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-t-2xl cursor-pointer select-none"
        style={{ background: "var(--card)", borderBottom: "1px solid var(--border)" }}
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground leading-none">Getting started</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {allDone ? "All done — you're a pro!" : `${doneCount} of ${steps.length} complete`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Progress ring */}
          <div className="relative w-8 h-8 shrink-0">
            <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2.5"
                className="text-border" />
              <circle cx="16" cy="16" r="12" fill="none" stroke="currentColor" strokeWidth="2.5"
                strokeDasharray={`${2 * Math.PI * 12}`}
                strokeDashoffset={`${2 * Math.PI * 12 * (1 - doneCount / steps.length)}`}
                strokeLinecap="round"
                className="text-primary transition-all duration-700" />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">
              {doneCount}/{steps.length}
            </span>
          </div>

          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            : <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
          }
          <button
            onClick={e => { e.stopPropagation(); handleDismiss() }}
            className="ml-1 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors"
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
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden rounded-b-2xl"
            style={{ background: "var(--card)" }}
          >
            <div className="px-3 pb-3 pt-1 space-y-0.5">
              {steps.map((step, i) => {
                const content = (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.2 }}
                    className={`group flex items-start gap-3 px-2 py-2.5 rounded-xl transition-colors ${
                      !step.done && step.href
                        ? "cursor-pointer hover:bg-white/5"
                        : step.done
                        ? "opacity-60"
                        : "opacity-90"
                    }`}
                    onClick={() => !step.done && handleStepClick(step.id)}
                  >
                    <div className="mt-0.5 shrink-0">
                      {step.done ? (
                        <CheckCircle2 className="w-4 h-4 text-primary" />
                      ) : (
                        <Circle className="w-4 h-4 text-border group-hover:text-muted-foreground transition-colors" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium leading-none mb-0.5 ${step.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {step.label}
                      </p>
                      {!step.done && (
                        <p className="text-[10px] text-muted-foreground leading-snug">{step.description}</p>
                      )}
                    </div>
                    {!step.done && step.href && (
                      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                    )}
                  </motion.div>
                )

                return !step.done && step.href ? (
                  <Link key={step.id} href={step.href} onClick={() => handleStepClick(step.id)}>
                    {content}
                  </Link>
                ) : (
                  <div key={step.id}>{content}</div>
                )
              })}

              {allDone && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-2 px-2 py-2 rounded-xl bg-primary/8 border border-primary/20 text-center"
                >
                  <p className="text-[11px] font-semibold text-primary">You've completed onboarding!</p>
                  <button
                    onClick={handleDismiss}
                    className="text-[10px] text-muted-foreground hover:text-foreground mt-1 transition-colors"
                  >
                    Dismiss this widget
                  </button>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
