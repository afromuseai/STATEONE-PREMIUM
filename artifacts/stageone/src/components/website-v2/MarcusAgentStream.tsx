// ─── MarcusAgentStream ────────────────────────────────────────────────────────
//
// Replaces the static 4-step progress checklist with a live agent conversation
// stream. Each agent in the Marcus pipeline gets its own card that appears,
// animates, and completes as the SSE pipeline advances.
//
// Driven by:
//   v2GenPhase  — current SSE phase string from generateV2Core
//   blueprintComponents — component names extracted from the "blueprint" event
//
// Phase → active agent mapping:
//   start / idle        → marcus
//   thinking / architect / blueprint / blueprint-summary → architect
//   building            → developer
//   project-saved       → runtime
//   done                → qa

import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Check, Loader2, Cpu, Code2, Layout, Zap, ShieldCheck, X } from "lucide-react"

// ─── Agent pipeline order ─────────────────────────────────────────────────────

type AgentId = "marcus" | "architect" | "developer" | "runtime" | "qa"

const PIPELINE: AgentId[] = ["marcus", "architect", "developer", "runtime", "qa"]

function phaseToActive(phase: string): AgentId {
  switch (phase) {
    // Pre-generation / pipeline open
    case "idle":
    case "start":
    case "project-created":   // DB record created — pipeline hasn't moved yet
      return "marcus"
    // Phase 1: architect LLM
    case "thinking":
    case "architect":
    case "blueprint":
    case "blueprint-summary":
      return "architect"
    // Phase 2: code generation LLM
    case "building":
      return "developer"
    // Persistence confirmed
    case "project-saved":
      return "runtime"
    // Pipeline finished
    case "done":
      return "qa"
    // Error or unknown — stay on marcus (least surprising non-terminal default)
    case "error":
    default:
      return "marcus"
  }
}

type BlockStatus = "pending" | "active" | "done"

function blockStatus(id: AgentId, active: AgentId): BlockStatus {
  const ai = PIPELINE.indexOf(id)
  const li = PIPELINE.indexOf(active)
  if (ai < li)  return "done"
  if (ai === li) return "active"
  return "pending"
}

// ─── Agent config ─────────────────────────────────────────────────────────────

const AGENT: Record<AgentId, {
  label:    string
  icon:     React.ElementType
  color:    string
  bg:       string
  border:   string
  headline: (idea?: string) => string
}> = {
  marcus: {
    label:    "Marcus",
    icon:     Cpu,
    color:    "#d4af37",
    bg:       "#d4af3712",
    border:   "#d4af3730",
    headline: (idea = "") =>
      idea.trim()
        ? `I understand your goal. Building "${idea.trim().slice(0, 55)}${idea.trim().length > 55 ? "…" : ""}" now.`
        : "I understand your goal. Starting the build pipeline.",
  },
  architect: {
    label:    "Architect Agent",
    icon:     Layout,
    color:    "#8b5cf6",
    bg:       "#8b5cf612",
    border:   "#8b5cf630",
    headline: () => "Analyzing business positioning",
  },
  developer: {
    label:    "Developer Agent",
    icon:     Code2,
    color:    "#3b82f6",
    bg:       "#3b82f612",
    border:   "#3b82f630",
    headline: () => "Building application",
  },
  runtime: {
    label:    "Runtime Agent",
    icon:     Zap,
    color:    "#10b981",
    bg:       "#10b98112",
    border:   "#10b98130",
    headline: () => "Launching preview",
  },
  qa: {
    label:    "QA Agent",
    icon:     ShieldCheck,
    color:    "#f59e0b",
    bg:       "#f59e0b12",
    border:   "#f59e0b30",
    headline: () => "Testing application",
  },
}

// ─── Static item lists ────────────────────────────────────────────────────────

const MARCUS_PLAN = [
  "Define conversion strategy",
  "Design landing page architecture",
  "Generate application code",
  "Validate output",
]

const ARCHITECT_ITEMS = [
  "Identified target audience",
  "Defined conversion strategy",
  "Blueprint validated",
]

const RUNTIME_ITEMS = [
  "Dependencies installed",
  "Preview generated",
  "Project ready",
]

const QA_ITEMS = [
  "Imports validated",
  "Components loaded",
  "No errors found",
]

const FALLBACK_DEV_ITEMS = [
  "Navigation bar",
  "Hero section",
  "Feature system",
  "Call to action",
  "Footer",
]

// Map blueprint component names to readable labels
function componentLabel(name: string): string {
  const MAP: Record<string, string> = {
    Navbar:       "Navigation bar",
    Nav:          "Navigation bar",
    Hero:         "Hero section",
    Features:     "Feature system",
    Testimonials: "Testimonials",
    HowItWorks:   "How it works",
    SocialProof:  "Social proof",
    Stats:        "Statistics section",
    Pricing:      "Pricing section",
    CTA:          "Call to action",
    Footer:       "Footer",
  }
  return MAP[name] ?? name
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface MarcusAgentStreamProps {
  v2GenPhase:          string
  idea:                string
  blueprintComponents: string[]
  onCancel:            () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MarcusAgentStream({
  v2GenPhase,
  idea,
  blueprintComponents,
  onCancel,
}: MarcusAgentStreamProps) {
  const activeAgent = phaseToActive(v2GenPhase)

  // How many items are revealed for each agent (progressively incremented)
  const [revealed, setRevealed] = useState<Record<AgentId, number>>({
    marcus: 0, architect: 0, developer: 0, runtime: 0, qa: 0,
  })

  const intervals = useRef<Map<AgentId, ReturnType<typeof setInterval>>>(new Map())
  const prevActive = useRef<AgentId>("marcus")
  const bottomRef  = useRef<HTMLDivElement>(null)

  // Item list for each agent
  const items = (id: AgentId): string[] => {
    switch (id) {
      case "marcus":    return MARCUS_PLAN
      case "architect": return ARCHITECT_ITEMS
      case "developer": return blueprintComponents.length > 0
        ? blueprintComponents.map(componentLabel)
        : FALLBACK_DEV_ITEMS
      case "runtime":   return RUNTIME_ITEMS
      case "qa":        return QA_ITEMS
    }
  }

  // Start a timed progressive reveal for an agent.
  // Always starts from 0 — never seeds from closed-over `revealed` state,
  // which may be stale at the time the closure forms.
  const startReveal = (id: AgentId, count: number, ms: number) => {
    const existing = intervals.current.get(id)
    if (existing) clearInterval(existing)

    // n is local and starts at 0 — no stale-closure risk
    let n = 0
    setRevealed(prev => ({ ...prev, [id]: 0 }))
    const tick = setInterval(() => {
      n += 1
      setRevealed(prev => ({ ...prev, [id]: n }))
      if (n >= count) { clearInterval(tick); intervals.current.delete(id) }
    }, ms)
    intervals.current.set(id, tick)
  }

  // Snap an agent's items to fully revealed immediately.
  const snapReveal = (id: AgentId, count: number) => {
    const existing = intervals.current.get(id)
    if (existing) clearInterval(existing)
    intervals.current.delete(id)
    setRevealed(prev => ({ ...prev, [id]: count }))
  }

  // React to phase transitions
  useEffect(() => {
    const prev = prevActive.current
    if (prev === activeAgent) return
    prevActive.current = activeAgent

    const activeIdx  = PIPELINE.indexOf(activeAgent)
    const prevIdx    = PIPELINE.indexOf(prev)

    // Quick-reveal all newly-completed agents (fast stagger, 100ms each)
    PIPELINE.slice(0, activeIdx).forEach(id => {
      const list = items(id)
      if (revealed[id] < list.length) {
        // developer gets a slower stagger when it completes naturally;
        // snap it if we skipped past it (e.g. project-saved fires quickly)
        if (id === "developer") {
          snapReveal("developer", list.length)
        } else {
          startReveal(id, list.length, 100)
        }
      }
    })

    // Start developer slow-reveal when it becomes active
    if (activeAgent === "developer") {
      const devList = items("developer")
      startReveal("developer", devList.length, 7000)
    }

    // QA becomes active: snap runtime + start QA quick reveal
    if (activeAgent === "qa") {
      snapReveal("runtime", items("runtime").length)
      startReveal("qa", items("qa").length, 150)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgent])

  // Re-derive developer items when blueprintComponents arrive mid-build.
  // startReveal already resets the count to 0 before starting the interval,
  // so no explicit setRevealed reset is needed here.
  useEffect(() => {
    if (blueprintComponents.length > 0 && activeAgent === "developer") {
      const devList = blueprintComponents.map(componentLabel)
      startReveal("developer", devList.length, 7000)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blueprintComponents])

  // Auto-scroll to latest content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeAgent, revealed])

  // Cleanup
  useEffect(() => {
    return () => { intervals.current.forEach(id => clearInterval(id)) }
  }, [])

  // Only render agents that are active or done (pending stay hidden)
  const visible = PIPELINE.filter(id => blockStatus(id, activeAgent) !== "pending")

  return (
    <div className="flex flex-col flex-1 min-h-0">

      {/* ── Agent stream ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <AnimatePresence initial={false}>
          {visible.map((id, idx) => {
            const status  = blockStatus(id, activeAgent)
            const cfg     = AGENT[id]
            const Icon    = cfg.icon
            const list    = items(id)
            const count   = revealed[id]
            const isActive = status === "active"
            const isDone   = status === "done"

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="mb-5"
              >
                {/* Divider between blocks */}
                {idx > 0 && (
                  <div
                    className="mb-5 h-px w-full"
                    style={{ background: `linear-gradient(to right, transparent, ${cfg.color}25, transparent)` }}
                  />
                )}

                {/* Agent header row */}
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <Icon className="h-3 w-3" style={{ color: cfg.color }} />
                  </div>

                  <span className="text-[11px] font-bold tracking-wide" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>

                  <div className="ml-auto">
                    {isActive && (
                      <Loader2
                        className="h-3 w-3 animate-spin"
                        style={{ color: cfg.color, opacity: 0.7 }}
                      />
                    )}
                    {isDone && (
                      <Check className="h-3 w-3 text-white/20" />
                    )}
                  </div>
                </div>

                {/* Headline */}
                <p className={`text-[12px] leading-relaxed mb-2.5 transition-colors ${
                  isActive ? "text-white/80" : "text-white/40"
                }`}>
                  {cfg.headline(id === "marcus" ? idea : undefined)}
                </p>

                {/* Revealed items */}
                <AnimatePresence initial={false}>
                  {list.slice(0, count).map((item, i) => (
                    <motion.div
                      key={`${id}-${i}`}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.18 }}
                      className="flex items-center gap-2 mb-1.5"
                    >
                      <Check
                        className="h-3 w-3 shrink-0"
                        style={{ color: cfg.color }}
                      />
                      <span className="text-[11px] text-white/50">{item}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Active pulse indicator */}
                {isActive && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-2 flex items-center gap-1"
                  >
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="inline-block h-1 w-1 rounded-full"
                        style={{ background: cfg.color }}
                        animate={{ opacity: [0.25, 1, 0.25] }}
                        transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22 }}
                      />
                    ))}
                  </motion.div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Cancel ──────────────────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/5 px-5 py-3">
        <button
          onClick={onCancel}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/8 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Cancel
        </button>
      </div>
    </div>
  )
}
