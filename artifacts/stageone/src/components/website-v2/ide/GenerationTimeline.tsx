// ─── Website Studio · Generation Timeline ─────────────────────────────────────
// A standalone, event-driven "AI engineer working" timeline for the Website
// Studio generation pipeline. This is intentionally decoupled from Marcus:
// it owns no session/context and never imports anything from
// "@/lib/marcus-session". Consumers feed it events (see `GenerationEvent`)
// and it renders a calm, collaborative build log — not a wall of console
// output.

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Brain, Ruler, Palette, Image as ImageIcon, Atom, ShieldCheck,
  Check, AlertCircle, ChevronDown, FileCode,
} from "lucide-react"

// Website Studio's own generation event bus — independent of Marcus. Aliased
// to avoid colliding with this file's pre-existing `GenerationEvent` /
// `GenerationEventType` (the internal step-reducer contract below).
import { useGenerationEvents } from "../generation/use-generation-events"
import { generationBus } from "../generation/generation-event-bus"
import type {
  GenerationEvent as BusGenerationEvent,
  GenerationEventType as BusGenerationEventType,
} from "../generation/generation-events"

// ─── Event-driven interface ────────────────────────────────────────────────────
// The generation pipeline (Website Studio only — not Marcus) can dispatch
// these events to drive the timeline. `applyGenerationEvent` below is a pure
// reducer so wiring a real SSE/stream source in later is a one-line fold.

export type TimelineStepId =
  | "understanding"
  | "planning"
  | "design"
  | "assets"
  | "development"
  | "quality"

export type StepStatus = "pending" | "active" | "completed" | "error"

export interface TimelineStepDetail {
  decision?:     string
  reason?:       string
  filesCreated?: string[]
}

export interface TimelineStep {
  id:          TimelineStepId
  icon:        React.ElementType
  title:       string
  description: string
  status:      StepStatus
  detail?:     TimelineStepDetail
  /** 0–100, only meaningful while `status === "active"`. */
  progress?:   number
}

export interface BuildSummary {
  projectName: string
  progress:    number   // 0–100
  currentTask: string
}

export type GenerationEventType =
  | "GENERATION_STARTED"
  | "PLANNING_STARTED"
  | "DESIGN_STARTED"
  | "ASSET_GENERATION_STARTED"
  | "CODE_GENERATION_STARTED"
  | "REVIEW_STARTED"
  | "GENERATION_COMPLETED"
  | "GENERATION_ERROR"
  | "STEP_DETAIL"
  | "BUILD_SUMMARY"

export interface GenerationEvent {
  type:         GenerationEventType
  timestamp?:   number
  /** STEP_DETAIL only — which step the detail belongs to. */
  stepId?:      TimelineStepId
  /** STEP_DETAIL only — decision/reason/files for the expandable card. */
  detail?:      TimelineStepDetail
  /** GENERATION_ERROR only — human-readable failure reason. */
  message?:     string
  /** BUILD_SUMMARY only — partial patch applied over the current summary. */
  buildSummary?: Partial<BuildSummary>
}

// ─── Default step definitions ──────────────────────────────────────────────────

export const DEFAULT_TIMELINE_STEPS: TimelineStep[] = [
  { id: "understanding", icon: Brain,      title: "Understanding",  description: "Analyzing the company requirements...",     status: "pending" },
  { id: "planning",      icon: Ruler,      title: "Planning",       description: "Creating website architecture...",          status: "pending" },
  { id: "design",        icon: Palette,    title: "Design System",  description: "Choosing colors, typography, layout...",    status: "pending" },
  { id: "assets",        icon: ImageIcon,  title: "Assets",         description: "Preparing images and visual elements...",   status: "pending" },
  { id: "development",   icon: Atom,       title: "Development",    description: "Writing components...",                    status: "pending" },
  { id: "quality",       icon: ShieldCheck,title: "Quality Check",  description: "Testing responsiveness...",                 status: "pending" },
]

const STEP_ORDER: TimelineStepId[] = DEFAULT_TIMELINE_STEPS.map(s => s.id)

const EVENT_TO_STEP: Partial<Record<GenerationEventType, TimelineStepId>> = {
  GENERATION_STARTED:        "understanding",
  PLANNING_STARTED:          "planning",
  DESIGN_STARTED:            "design",
  ASSET_GENERATION_STARTED:  "assets",
  CODE_GENERATION_STARTED:   "development",
  REVIEW_STARTED:            "quality",
}

export interface GenerationTimelineState {
  steps:        TimelineStep[]
  buildSummary: BuildSummary | null
  error:        string | null
}

export const INITIAL_TIMELINE_STATE: GenerationTimelineState = {
  steps:        DEFAULT_TIMELINE_STEPS,
  buildSummary: null,
  error:        null,
}

/** Pure reducer — advances the timeline in response to a single pipeline event. */
export function applyGenerationEvent(
  state: GenerationTimelineState,
  event: GenerationEvent,
): GenerationTimelineState {
  // ── Step-detail attachment (does not move the active pointer) ──────────────
  if (event.type === "STEP_DETAIL" && event.stepId) {
    return {
      ...state,
      steps: state.steps.map(step =>
        step.id === event.stepId ? { ...step, detail: event.detail } : step
      ),
    }
  }

  // ── Build summary patch ─────────────────────────────────────────────────────
  if (event.type === "BUILD_SUMMARY") {
    return {
      ...state,
      buildSummary: {
        projectName: event.buildSummary?.projectName ?? state.buildSummary?.projectName ?? "",
        progress:    event.buildSummary?.progress    ?? state.buildSummary?.progress    ?? 0,
        currentTask: event.buildSummary?.currentTask ?? state.buildSummary?.currentTask ?? "",
      },
    }
  }

  // ── Terminal failure — freeze the in-flight step as errored ────────────────
  if (event.type === "GENERATION_ERROR") {
    const activeId = state.steps.find(s => s.status === "active")?.id
    return {
      ...state,
      error: event.message ?? "Generation failed",
      steps: state.steps.map(step =>
        step.id === activeId ? { ...step, status: "error" } : step
      ),
    }
  }

  // ── Completion — mark every step done ───────────────────────────────────────
  if (event.type === "GENERATION_COMPLETED") {
    return {
      ...state,
      error: null,
      steps: state.steps.map(step => ({ ...step, status: "completed" as StepStatus })),
    }
  }

  // ── Phase-advance events ────────────────────────────────────────────────────
  const targetId = EVENT_TO_STEP[event.type]
  if (!targetId) return state

  const targetIdx = STEP_ORDER.indexOf(targetId)
  return {
    ...state,
    error: null,
    steps: state.steps.map((step, idx) => {
      const stepIdx = STEP_ORDER.indexOf(step.id)
      if (stepIdx < targetIdx)  return step.status === "error" ? step : { ...step, status: "completed" }
      if (stepIdx === targetIdx) return { ...step, status: "active" }
      return step.status === "pending" ? step : { ...step, status: "pending" }
    }),
  }
}

/**
 * Adapter — maps a bus `GenerationEvent` (see `../generation/generation-events`)
 * onto the internal `GenerationTimelineState`. This is the frontend-event
 * counterpart to `applyGenerationEvent` above; kept separate because the two
 * event shapes differ (flat `message`/`details`/`progress` vs. the
 * STEP_DETAIL/BUILD_SUMMARY internal contract).
 */
export function applyBusGenerationEvent(
  state: GenerationTimelineState,
  event: BusGenerationEvent,
): GenerationTimelineState {
  // ── Terminal failure — freeze the in-flight step as errored ────────────────
  if (event.type === "GENERATION_ERROR") {
    const activeId = state.steps.find(s => s.status === "active")?.id
    return {
      ...state,
      error: event.message ?? "Generation failed",
      steps: state.steps.map(step =>
        step.id === activeId
          ? { ...step, status: "error" as StepStatus, description: event.message ?? step.description }
          : step
      ),
      buildSummary: state.buildSummary && {
        ...state.buildSummary,
        currentTask: event.message ?? state.buildSummary.currentTask,
      },
    }
  }

  // ── Completion — mark every step done ───────────────────────────────────────
  if (event.type === "GENERATION_COMPLETED") {
    return {
      ...state,
      error: null,
      steps: state.steps.map(step => ({ ...step, status: "completed" as StepStatus, progress: undefined })),
      buildSummary: state.buildSummary && {
        ...state.buildSummary,
        progress: 100,
        currentTask: event.message ?? "Completed",
      },
    }
  }

  // ── Phase-advance events ────────────────────────────────────────────────────
  const targetId = EVENT_TO_STEP[event.type]
  if (!targetId) return state

  const targetIdx = STEP_ORDER.indexOf(targetId)

  const nextSteps = state.steps.map(step => {
    const stepIdx = STEP_ORDER.indexOf(step.id)

    if (stepIdx < targetIdx) {
      return step.status === "error" ? step : { ...step, status: "completed" as StepStatus }
    }

    if (stepIdx === targetIdx) {
      return {
        ...step,
        status:      "active" as StepStatus,
        description: event.message ?? step.description,
        progress:    event.progress,
        detail: event.details
          ? {
              decision:     event.details.decision,
              reason:       event.details.reason,
              filesCreated: event.details.files,
            }
          : step.detail,
      }
    }

    return step.status === "pending" ? step : { ...step, status: "pending" as StepStatus, progress: undefined }
  })

  return {
    ...state,
    error: null,
    steps: nextSteps,
    buildSummary: {
      projectName: state.buildSummary?.projectName ?? "",
      progress:    event.progress ?? state.buildSummary?.progress ?? 0,
      currentTask: event.message  ?? state.buildSummary?.currentTask ?? "",
    },
  }
}

/** Convenience hook for consumers who want local state instead of wiring their own reducer. */
export function useGenerationTimeline() {
  const [state, setState] = useState<GenerationTimelineState>(INITIAL_TIMELINE_STATE)

  const applyEvent = useCallback((event: GenerationEvent) => {
    setState(prev => applyGenerationEvent(prev, event))
  }, [])

  const reset = useCallback(() => setState(INITIAL_TIMELINE_STATE), [])

  return { ...state, applyEvent, reset }
}

// ─── Status glyph (✓ / ● / ○ / ✕) ──────────────────────────────────────────────

function StatusGlyph({ status }: { status: StepStatus }) {
  if (status === "completed") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400/80">
        <Check className="h-3 w-3" /> Completed
      </span>
    )
  }
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#ECECEC]/70">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ECECEC]/40" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ECECEC]/80" />
        </span>
        Working
      </span>
    )
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-400/80">
        <AlertCircle className="h-3 w-3" /> Error
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#A0A0A0]/60">
      <span className="h-2 w-2 rounded-full border border-[#A0A0A0]/40" />
      Waiting
    </span>
  )
}

// ─── Single timeline row ───────────────────────────────────────────────────────

function TimelineRow({
  step,
  isLast,
  expanded,
  onToggle,
}: {
  step:     TimelineStep
  isLast:   boolean
  expanded: boolean
  onToggle: () => void
}) {
  const Icon = step.icon
  const hasDetail = !!step.detail && (
    step.detail.decision || step.detail.reason || (step.detail.filesCreated?.length ?? 0) > 0
  )

  const iconWrapClasses =
    step.status === "completed" ? "bg-emerald-400/10 text-emerald-400/80 border-emerald-400/20" :
    step.status === "active"    ? "bg-[#ECECEC]/[0.08] text-[#ECECEC] border-[#ECECEC]/25" :
    step.status === "error"     ? "bg-red-400/10 text-red-400/80 border-red-400/25" :
                                   "bg-transparent text-[#A0A0A0]/50 border-[#A0A0A0]/15"

  return (
    <div className="relative flex gap-3 pb-5 last:pb-0">
      {/* Connector line */}
      {!isLast && (
        <div
          className="absolute left-[15px] top-8 bottom-0 w-px"
          style={{
            background: step.status === "completed" ? "rgba(52,211,153,0.25)" : "rgba(160,160,160,0.15)",
          }}
        />
      )}

      {/* Icon */}
      <div
        className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${iconWrapClasses}`}
      >
        {step.status === "active" && (
          <motion.span
            className="absolute inset-0 rounded-full border border-[#ECECEC]/30"
            animate={{ opacity: [0.5, 0.1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <Icon className="h-3.5 w-3.5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pt-0.5">
        <button
          type="button"
          onClick={hasDetail ? onToggle : undefined}
          className={`flex w-full items-start justify-between gap-2 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
        >
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-[#ECECEC]">{step.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#A0A0A0]">{step.description}</p>
            {step.status === "active" && typeof step.progress === "number" && (
              <p className="mt-1 text-[10px] font-medium tabular-nums text-[#ECECEC]/60">
                Progress: {Math.max(0, Math.min(100, Math.round(step.progress)))}%
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <StatusGlyph status={step.status} />
            {hasDetail && (
              <ChevronDown
                className={`h-3 w-3 text-[#A0A0A0]/50 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            )}
          </div>
        </button>

        <AnimatePresence initial={false}>
          {expanded && hasDetail && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <div className="mt-2 space-y-1.5 rounded-md border border-[#A0A0A0]/10 bg-[#1A1A1A] px-3 py-2.5">
                {step.detail?.decision && (
                  <p className="text-[11px] text-[#ECECEC]/85">
                    <span className="text-[#A0A0A0]">Decision: </span>{step.detail.decision}
                  </p>
                )}
                {step.detail?.reason && (
                  <p className="text-[11px] text-[#A0A0A0]">
                    <span className="text-[#A0A0A0]/70">Reason: </span>{step.detail.reason}
                  </p>
                )}
                {step.detail?.filesCreated && step.detail.filesCreated.length > 0 && (
                  <div className="pt-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-[#A0A0A0]/60">Files created</p>
                    <div className="mt-1 space-y-0.5">
                      {step.detail.filesCreated.map(path => (
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
    </div>
  )
}

// ─── Build summary footer ──────────────────────────────────────────────────────

function BuildSummaryCard({ summary }: { summary: BuildSummary }) {
  const progress = Math.max(0, Math.min(100, Math.round(summary.progress)))

  return (
    <div className="border-t border-[#A0A0A0]/10 px-4 py-3">
      <p className="text-[10px] uppercase tracking-wide text-[#A0A0A0]/60">Current Build Summary</p>

      <div className="mt-2 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-[#A0A0A0]">Building</span>
          <span className="truncate text-[12px] font-medium text-[#ECECEC]">{summary.projectName || "Untitled"}</span>
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#A0A0A0]/15">
            <motion.div
              className="h-full rounded-full bg-[#ECECEC]/70"
              initial={false}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3, ease: "easeOut" }}
            />
          </div>
          <span className="text-[11px] tabular-nums text-[#A0A0A0]">{progress}%</span>
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-[11px] text-[#A0A0A0]">Current task</span>
          <span className="truncate text-[11px] text-[#ECECEC]/80">{summary.currentTask || "—"}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ─────────────────────────────────────────────────────────────

export interface GenerationTimelineProps {
  steps:         TimelineStep[]
  buildSummary?: BuildSummary | null
  className?:    string
}

export function GenerationTimeline({ steps, buildSummary, className }: GenerationTimelineProps) {
  const [expandedId, setExpandedId] = useState<TimelineStepId | null>(null)

  const toggle = (id: TimelineStepId) => setExpandedId(prev => (prev === id ? null : id))

  // ── Live wiring: combine the steps/summary handed in by the parent (acting
  // as the initial seed — e.g. DEFAULT_TIMELINE_STEPS + a mock summary) with
  // events arriving on Website Studio's generation event bus. Nothing emits
  // onto the bus yet from the real pipeline — this only listens.
  const { latestEvent } = useGenerationEvents()
  const seededRef = useRef(false)

  const [liveState, setLiveState] = useState<GenerationTimelineState>({
    steps:        steps,
    buildSummary: buildSummary ?? null,
    error:        null,
  })

  // Re-seed from props until the first live event arrives (e.g. parent swaps
  // in a different project's initial steps/summary before generation starts).
  useEffect(() => {
    if (seededRef.current) return
    setLiveState({ steps, buildSummary: buildSummary ?? null, error: null })
  }, [steps, buildSummary])

  useEffect(() => {
    if (!latestEvent) return
    seededRef.current = true
    setLiveState(prev => applyBusGenerationEvent(prev, latestEvent))
  }, [latestEvent])

  // ── Temporary dev helper — lets us fire test events from the browser
  // console, e.g. window.__generationTest({ type: "PLANNING_STARTED", ... }).
  // Nothing production-facing depends on this; safe to remove later.
  useEffect(() => {
    if (typeof window === "undefined") return
    (window as any).__generationTest = (
      event: Partial<BusGenerationEvent> & { type: BusGenerationEventType },
    ) => {
      generationBus.emit({ timestamp: Date.now(), ...event })
    }
    return () => {
      delete (window as any).__generationTest
    }
  }, [])

  const orderedSteps = useMemo(() => liveState.steps, [liveState.steps])

  return (
    <div
      className={`flex h-full min-h-0 flex-col overflow-hidden ${className ?? ""}`}
      style={{ background: "#202020", color: "#ECECEC" }}
    >
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {orderedSteps.map((step, i) => (
          <TimelineRow
            key={step.id}
            step={step}
            isLast={i === orderedSteps.length - 1}
            expanded={expandedId === step.id}
            onToggle={() => toggle(step.id)}
          />
        ))}
      </div>

      {liveState.buildSummary && <BuildSummaryCard summary={liveState.buildSummary} />}
    </div>
  )
}
