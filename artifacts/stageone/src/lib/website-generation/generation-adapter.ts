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
import type { GenerationEventType } from "@/components/website-v2/generation/generation-events"

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

function emitOnce(tracker: RunTracker, type: GenerationEventType, message?: string, files?: string[]) {
  if (tracker.emitted.has(type)) return
  tracker.emitted.add(type)
  generationBus.emit({
    type,
    message,
    details: files && files.length > 0 ? { files } : undefined,
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
    emitOnce(tracker, "PLANNING_STARTED", snapshot.phaseMessage || "Planning architecture and design…")
  }

  if (phase && CODE_PHASES.has(phase)) {
    emitOnce(tracker, "CODE_GENERATION_STARTED", snapshot.phaseMessage || "Writing components…")
  }

  if (phase && REVIEW_PHASES.has(phase)) {
    emitOnce(tracker, "REVIEW_STARTED", snapshot.phaseMessage || "Validating the build…")
  }

  // ── Run ends: either an explicit error, or a terminal status. ──────────────
  if (snapshot.error) {
    emitOnce(tracker, "GENERATION_ERROR", snapshot.error)
    tracker.active = false
    return
  }

  if (TERMINAL_STATUSES.has(status) && status !== "idle") {
    emitOnce(tracker, "GENERATION_COMPLETED", "Website generation complete", snapshot.files)
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
    // pick up the final file list by the time completion fires.
  }, [snapshot.status, snapshot.phase, snapshot.phaseMessage, snapshot.error, snapshot.files?.length])
}
