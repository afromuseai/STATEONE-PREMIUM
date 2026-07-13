// ─── Website Generation Adapter ─────────────────────────────────────────────────
// Bridges the EXISTING Website Studio generation stream (Marcus, via
// MarcusSessionState) onto the NEW, independent `generationBus` that
// `GenerationActivity` renders from.
//
// This file intentionally has ZERO Marcus imports. It knows nothing about
// `marcus-session` types, SSE parsing, or backend phase names — it only
// accepts a small, plain snapshot shape (`WebsiteGenerationSnapshot`) and
// turns *changes* to that snapshot into `GenerationEvent`s on the bus.
//
// The caller (a component that already has legitimate access to Marcus
// session state — e.g. `StudioShell`, which already receives `session` as a
// prop) is responsible for extracting the snapshot from `MarcusSessionState`
// and calling `useWebsiteGenerationAdapter(snapshot)` every render. That
// keeps this adapter reusable and decoupled: it could just as easily be fed
// by a different generation backend in the future.
//
// Nothing here modifies Marcus, AgentConversation, the generation event
// bus/types, or GenerationActivity — it only calls `generationBus.emit(...)`.

import { useEffect, useRef } from "react"

import { generationBus } from "@/components/website-v2/generation/generation-event-bus"
import type { GenerationEventDetails, GenerationEventType } from "@/components/website-v2/generation/generation-events"

// ─── Snapshot shape — deliberately generic, not Marcus-typed ──────────────────
// Only the fields the mapping below actually needs. Optional fields default
// to "nothing happened yet" so a partial/idle snapshot is always safe to pass.

export interface WebsiteGenerationSnapshot {
  /** Coarse session status. Only "generating" starts a run; anything else
   *  that follows a "generating" run ends it (success unless `error` is set). */
  status: string | null | undefined
  /** Current loop phase name, if the backend reports one (e.g. "PLAN",
   *  "EXECUTE", "OBSERVE", "FIX", "VALIDATE", "REPORT", "UNDERSTAND"). */
  phase: string | null | undefined
  /** Human-readable message for the current phase, used as the event's
   *  `message` when available. */
  phaseMessage?: string | null
  /** Error message, if the run failed. */
  error?: string | null
  /** File paths written so far — used only to build the completion summary
   *  (`GenerationActivity` categorizes these into pages/components/assets). */
  files?: string[]
  /** A concrete design/architecture decision extracted from the model's own
   *  planning text, if the model stated one — real backend data only,
   *  never fabricated here. Persists once captured. */
  decision?: string | null
  /** The reason accompanying `decision`, if the model gave one. */
  reason?: string | null
  /** Narrative wrap-up from the backend's completion report. */
  summary?: string | null
  /** Backend-derived confidence in the completion report, forwarded as-is. */
  confidence?: string | null
}

// ─── Phase → event mapping ──────────────────────────────────────────────────
// Loop phase names reported by the current backend that count as "planning"
// or "review" work. Kept as simple string sets so new phase names degrade
// gracefully (unmapped phases are just ignored, not an error).
const PLANNING_PHASES = new Set(["PLAN"])
const CODE_PHASES     = new Set(["EXECUTE"])
const REVIEW_PHASES   = new Set(["OBSERVE", "FIX", "VALIDATE"])

/** Statuses that mean "the run is over" once we've already seen it start. */
const TERMINAL_STATUSES = new Set(["completed", "editing", "idle"])

interface RunTracker {
  /** Which event types we've already emitted for the *current* run — each
   *  one only ever fires once per run, so re-renders and repeated phase
   *  messages don't spam duplicate "step complete" entries in the UI. */
  emitted: Set<GenerationEventType>
  /** Whether a run is currently considered "in flight" (started, not yet
   *  completed/errored). Used to ignore snapshots before the first run and
   *  after a run has already been closed out. */
  active: boolean
}

function freshTracker(): RunTracker {
  return { emitted: new Set(), active: false }
}

function emitOnce(
  tracker: RunTracker,
  type: GenerationEventType,
  message?: string,
  details?: GenerationEventDetails,
) {
  if (tracker.emitted.has(type)) return
  tracker.emitted.add(type)
  const hasDetails = details && Object.values(details).some(v => v !== undefined && v !== null)
  generationBus.emit({
    type,
    message,
    details: hasDetails ? details : undefined,
    timestamp: Date.now(),
  })
}

/**
 * Pure-ish translator: given the previous and next snapshot plus the mutable
 * run tracker, emits whatever bus events that transition implies. Exported
 * separately from the hook so it can be unit tested without React.
 */
export function translateSnapshot(tracker: RunTracker, snapshot: WebsiteGenerationSnapshot): void {
  const status = snapshot.status ?? "idle"
  const phase  = snapshot.phase ?? null

  // ── A new run starts whenever status becomes "generating" and we weren't
  // already tracking one. Reset per-run dedupe state first. ──────────────────
  if (status === "generating" && !tracker.active) {
    tracker.emitted = new Set()
    tracker.active = true
    emitOnce(tracker, "GENERATION_STARTED", snapshot.phaseMessage || "Analyzing your requirements…")
  }

  // Ignore phase/error signals entirely until a run has actually started —
  // avoids reacting to stale snapshots from a previous, already-closed run.
  if (!tracker.active) return

  if (phase && PLANNING_PHASES.has(phase)) {
    // Forward the design decision/reason if the backend has already
    // captured one by the time PLANNING_STARTED fires. Real data only —
    // if the model hadn't stated a decision yet, these stay undefined.
    emitOnce(tracker, "PLANNING_STARTED", snapshot.phaseMessage || "Planning architecture and design…", {
      decision: snapshot.decision ?? undefined,
      reason:   snapshot.reason ?? undefined,
    })
  }

  if (phase && CODE_PHASES.has(phase)) {
    emitOnce(tracker, "CODE_GENERATION_STARTED", snapshot.phaseMessage || "Writing components…")
  }

  if (phase && REVIEW_PHASES.has(phase)) {
    // Forward confidence if the backend has already derived one by this
    // point (e.g. a prior VALIDATE pass in the FIX loop).
    emitOnce(tracker, "REVIEW_STARTED", snapshot.phaseMessage || "Validating the build…", {
      confidence: snapshot.confidence ?? undefined,
    })
  }

  // ── Run ends: either an explicit error, or a terminal status. ──────────────
  if (snapshot.error) {
    emitOnce(tracker, "GENERATION_ERROR", snapshot.error)
    tracker.active = false
    return
  }

  if (TERMINAL_STATUSES.has(status) && status !== "idle") {
    // The completion event is the authoritative, final narration carrier —
    // by this point the backend's `done` event has already delivered
    // summary/decision/filesCreated/confidence into session state (and
    // `reason`, if ever captured during PLAN, persists in state until
    // session reset), so this is guaranteed to have the real, final values
    // even if the earlier PLANNING_STARTED/REVIEW_STARTED events fired
    // before those fields were available.
    emitOnce(tracker, "GENERATION_COMPLETED", "Website generation complete", {
      files:      snapshot.files,
      summary:    snapshot.summary ?? undefined,
      decision:   snapshot.decision ?? undefined,
      reason:     snapshot.reason ?? undefined,
      confidence: snapshot.confidence ?? undefined,
    })
    tracker.active = false
  }
}

// ─── React hook — call this every render from a component that has Marcus
// session state, passing the extracted snapshot. Safe to call with the same
// (or idle) snapshot repeatedly; only transitions cause bus emissions. ────────
export function useWebsiteGenerationAdapter(snapshot: WebsiteGenerationSnapshot): void {
  const trackerRef = useRef<RunTracker>(freshTracker())

  useEffect(() => {
    translateSnapshot(trackerRef.current, snapshot)
    // Re-run whenever any part of the snapshot that can drive a transition
    // changes. `files` is intentionally read by reference length only, since
    // the array is rebuilt each render — comparing its length is enough to
    // pick up the final file list by the time completion fires. Narration
    // fields are included so a decision/summary/confidence that arrives on a
    // later render (even without a phase/status change) still gets a chance
    // to reach `translateSnapshot` before the run's dedup gate closes it out.
  }, [
    snapshot.status, snapshot.phase, snapshot.phaseMessage, snapshot.error, snapshot.files?.length,
    snapshot.decision, snapshot.reason, snapshot.summary, snapshot.confidence,
  ])
}
