// ─── Website Studio · Generation Activity (inline chat block) ─────────────────
// Renders Website Studio's own generation progress *inside* the AI chat
// conversation, as one message block — not a permanent side panel. Reads
// from the generation event bus only; no Marcus / marcus-session import,
// no backend calls. Nothing emits real events onto the bus yet.
//
// Progressive by design: it never shows all six pipeline steps up front.
// It shows the steps that have already completed (as short "done" lines)
// plus the single step that's currently active — exactly the shape of a
// standup update, not a checklist.

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain, Ruler, Palette, Image as ImageIcon, Atom, ShieldCheck,
  Check, AlertCircle, ChevronDown, FileCode,
} from "lucide-react"

import { useGenerationEvents } from "./use-generation-events"
import type { GenerationEvent, GenerationEventType, GenerationEventDetails } from "./generation-events"

// ─── Step metadata — order matters, it defines completion order ───────────────

interface StepMeta {
  title:              string
  icon:               React.ElementType
  defaultDescription: string
}

const STEP_META: Partial<Record<GenerationEventType, StepMeta>> = {
  GENERATION_STARTED:       { title: "Understanding",  icon: Brain,     defaultDescription: "Analyzing your requirements…" },
  PLANNING_STARTED:         { title: "Planning",       icon: Ruler,     defaultDescription: "Creating website architecture…" },
  DESIGN_STARTED:           { title: "Design System",  icon: Palette,   defaultDescription: "Choosing colors, typography, layout…" },
  ASSET_GENERATION_STARTED: { title: "Assets",         icon: ImageIcon, defaultDescription: "Preparing images and visual elements…" },
  CODE_GENERATION_STARTED:  { title: "Development",    icon: Atom,      defaultDescription: "Writing components…" },
  REVIEW_STARTED:           { title: "Quality Check",  icon: ShieldCheck, defaultDescription: "Testing responsiveness…" },
}

interface CompletedStep {
  key:     string
  title:   string
  summary: string
}

interface ActiveStep {
  type:        GenerationEventType
  title:       string
  icon:        React.ElementType
  description: string
  progress?:   number
  details?:    GenerationEventDetails
  errored:     boolean
}

interface ActivityState {
  completed: CompletedStep[]
  active:    ActiveStep | null
  error:     string | null
  done:      boolean
}

const EMPTY_STATE: ActivityState = { completed: [], active: null, error: null, done: false }

/** Pure fold — derives the progressive activity view from the full event log. */
function computeActivityState(events: GenerationEvent[]): ActivityState {
  let completed: CompletedStep[] = []
  let active: ActiveStep | null = null
  let error: string | null = null
  let done = false

  events.forEach((event, i) => {
    if (event.type === "GENERATION_ERROR") {
      error = event.message ?? "Generation failed"
      if (active) active = { ...active, errored: true }
      return
    }

    if (event.type === "GENERATION_COMPLETED") {
      if (active) {
        completed = [...completed, { key: `${active.type}-${i}`, title: active.title, summary: active.description }]
      }
      active = null
      error = null
      done = true
      return
    }

    const meta = STEP_META[event.type]
    if (!meta) return

    // The previously active step is implicitly finished once a new one starts.
    if (active) {
      completed = [...completed, { key: `${active.type}-${i}`, title: active.title, summary: active.description }]
    }

    error = null
    done = false
    active = {
      type:        event.type,
      title:       meta.title,
      icon:        meta.icon,
      description: event.message ?? meta.defaultDescription,
      progress:    event.progress,
      details:     event.details,
      errored:     false,
    }
  })

  return { completed, active, error, done }
}

// ─── Expandable details (decision / reason / files) ────────────────────────────

function ActiveStepDetails({ details }: { details: GenerationEventDetails }) {
  const [expanded, setExpanded] = useState(false)
  const hasContent = !!(details.decision || details.reason || (details.files?.length ?? 0) > 0)
  if (!hasContent) return null

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="flex items-center gap-1 text-[10px] font-medium text-[#A0A0A0]/70 hover:text-[#ECECEC]/80"
      >
        Details
        <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 space-y-1.5 rounded-md border border-[#A0A0A0]/10 bg-[#1A1A1A] px-2.5 py-2">
              {details.decision && (
                <p className="text-[11px] text-[#ECECEC]/85"><span className="text-[#A0A0A0]">Decision: </span>{details.decision}</p>
              )}
              {details.reason && (
                <p className="text-[11px] text-[#A0A0A0]"><span className="text-[#A0A0A0]/70">Reason: </span>{details.reason}</p>
              )}
              {details.files && details.files.length > 0 && (
                <div className="pt-0.5">
                  <p className="text-[10px] uppercase tracking-wide text-[#A0A0A0]/60">Files created</p>
                  <div className="mt-1 space-y-0.5">
                    {details.files.map(path => (
                      <div key={path} className="flex items-center gap-1.5 text-[11px] text-[#ECECEC]/70">
                        <FileCode className="h-3 w-3 text-[#A0A0A0]/60" />
                        <span className="truncate font-mono">{path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export function GenerationActivity({ className }: { className?: string }) {
  const { events } = useGenerationEvents()
  const state = useMemo(() => computeActivityState(events), [events])

  // Hidden: no generation running and no events at all.
  if (events.length === 0) return null

  const { completed, active, error, done } = state
  const Icon = active?.icon

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#202020] px-3.5 py-3 ${className ?? ""}`}
    >
      {/* Completed steps — compact, no expansion, just a running log */}
      {completed.length > 0 && (
        <div className="mb-2 space-y-1">
          {completed.map(step => (
            <div key={step.key} className="flex items-start gap-1.5">
              <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/80" />
              <p className="text-[11px] leading-snug text-[#A0A0A0]">
                <span className="text-emerald-300/80">{step.title} complete</span>
                {step.summary && <span className="block text-[#A0A0A0]/70">{step.summary}</span>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Current active step — the only step shown "in progress" at a time */}
      {active && Icon && (
        <div className="flex gap-2.5">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border ${
              active.errored
                ? "border-red-400/25 bg-red-400/10 text-red-400/80"
                : "border-[#ECECEC]/25 bg-[#ECECEC]/[0.08] text-[#ECECEC]"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-[12.5px] font-medium text-[#ECECEC]">{active.title}</p>
              {active.errored ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400/80">
                  <AlertCircle className="h-3 w-3" /> Error
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#ECECEC]/60">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ECECEC]/40" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#ECECEC]/80" />
                  </span>
                  Working
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-[#A0A0A0]">{active.description}</p>

            {typeof active.progress === "number" && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#A0A0A0]/15">
                  <motion.div
                    className="h-full rounded-full bg-[#ECECEC]/70"
                    initial={false}
                    animate={{ width: `${Math.max(0, Math.min(100, Math.round(active.progress)))}%` }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-[#A0A0A0]">
                  {Math.max(0, Math.min(100, Math.round(active.progress)))}%
                </span>
              </div>
            )}

            {active.details && <ActiveStepDetails details={active.details} />}
          </div>
        </div>
      )}

      {/* Generic failure banner — shown when there's no longer an active step to attach it to */}
      {error && !active && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400/80">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {/* Completion banner */}
      {done && !active && !error && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
          <Check className="h-3.5 w-3.5" /> Website generation complete
        </div>
      )}
    </motion.div>
  )
}
