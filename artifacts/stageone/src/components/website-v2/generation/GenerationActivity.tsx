// ─── Website Studio · Generation Activity (inline chat block) ─────────────────
// Renders generation progress *inside* the AI chat conversation, as one
// message block — not a permanent side panel. Reads from the generation
// event bus only; no backend session system import, no backend calls.
//
// Progressive by design: it never shows all six pipeline steps up front.
// It shows the steps that have already completed (as short "done" lines)
// plus the single step that's currently active — exactly the shape of a
// standup update, not a checklist.

import { useMemo, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain, Ruler, Palette, Image as ImageIcon, Atom, ShieldCheck,
  Check, AlertCircle, ChevronDown, FileCode, Cpu,
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
  key:      string
  title:    string
  summary:  string
  details?: GenerationEventDetails
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
        completed = [...completed, { key: `${active.type}-${i}`, title: active.title, summary: active.description, details: active.details }]
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
      completed = [...completed, { key: `${active.type}-${i}`, title: active.title, summary: active.description, details: active.details }]
    }

    error = null
    done = false
    active = {
      type:        event.type,
      title:       meta.title,
      icon:        meta.icon,
      // Always the canned, professional description — never the raw
      // `event.message` forwarded from the backend's internal phase/tool
      // text (e.g. loop-phase names, tool-call syntax). The AI Engineer
      // narration must never leak raw execution internals. See Phase 10.4.4.
      description: meta.defaultDescription,
      progress:    event.progress,
      details:     event.details,
      errored:     false,
    }
  })

  return { completed, active, error, done }
}

/** Every file path mentioned across the whole run, deduped — used only to build
 *  the human-readable completion summary. Doesn't touch the event shape. */
function collectCompletionSummary(events: GenerationEvent[]): { pages: number; components: number; assets: number } {
  const files = new Set<string>()
  events.forEach(event => event.details?.files?.forEach(f => files.add(f)))

  let pages = 0, components = 0, assets = 0
  files.forEach(path => {
    const lower = path.toLowerCase()
    if (/\.(png|jpe?g|svg|webp|gif|ico)$/.test(lower) || lower.includes("/assets/") || lower.startsWith("assets/")) {
      assets++
    } else if (lower.includes("/pages/") || lower.startsWith("pages/") || /page\.(t|j)sx?$/.test(lower)) {
      pages++
    } else if (lower.includes("/components/") || lower.startsWith("components/")) {
      components++
    }
  })
  return { pages, components, assets }
}

// ─── Expandable details (decision / reason / files) — shared by completed and
// active steps so either can be expanded to see the "why" behind it. ──────────

function StepDetails({ details }: { details: GenerationEventDetails }) {
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
  const summary = useMemo(() => collectCompletionSummary(events), [events])

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
      {/* Header — reads as an engineer's status feed, not a progress bar widget */}
      <div className="mb-2 flex items-center gap-1.5">
        <Cpu className="h-3 w-3 text-[#A0A0A0]/60" />
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#A0A0A0]/60">Build Activity</p>
      </div>

      {/* Completed steps — compact log lines, each independently expandable */}
      <AnimatePresence initial={false}>
        {completed.length > 0 && (
          <div className="mb-2 space-y-1.5">
            {completed.map(step => (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
              >
                <div className="flex items-start gap-1.5">
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400/80" />
                  <p className="text-[11px] leading-snug text-[#A0A0A0]">
                    <span className="text-emerald-300/80">{step.title}</span>
                    {step.summary && <span className="block text-[#A0A0A0]/70">{step.summary}</span>}
                  </p>
                </div>
                {step.details && (
                  <div className="pl-[18px]">
                    <StepDetails details={step.details} />
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Current active step — the focal point; everything else is history */}
      <AnimatePresence mode="wait" initial={false}>
        {active && Icon && (
          <motion.div
            key={active.type}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex gap-2.5"
          >
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

              {active.details && <StepDetails details={active.details} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generic failure banner — shown when there's no longer an active step to attach it to */}
      {error && !active && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-400/80">
          <AlertCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}

      {/* Completion state — final summary line, reads like a build report */}
      {done && !active && !error && (
        <motion.div
          initial={{ opacity: 0, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-300/80">
            <Check className="h-3.5 w-3.5" /> Website completed
          </div>
          {(summary.pages > 0 || summary.components > 0 || summary.assets > 0) && (
            <div className="mt-1 space-y-0.5 pl-5 text-[11px] text-[#A0A0A0]">
              {summary.pages > 0 && <p>{summary.pages} page{summary.pages === 1 ? "" : "s"} created</p>}
              {summary.components > 0 && <p>{summary.components} component{summary.components === 1 ? "" : "s"} created</p>}
              {summary.assets > 0 && <p>{summary.assets} asset{summary.assets === 1 ? "" : "s"} generated</p>}
            </div>
          )}
          <p className="mt-1.5 pl-5 text-[11px] text-[#ECECEC]/70">Preview ready</p>
        </motion.div>
      )}
    </motion.div>
  )
}
