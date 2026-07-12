// ─── Builder Conversation — derivation from the generation event bus ──────────
// Pure fold: `GenerationEvent[]` in, `BuilderConversationMessage[]` out. No
// subscriptions, no side effects, no bus writes — this only *reads* the same
// event log `GenerationActivity` already renders from (via the existing,
// unmodified `useGenerationEvents` hook upstream). Safe to recompute on every
// render; callers should wrap it in `useMemo`.
//
// Each phase gets its own senior-engineer-style copy, written to explain the
// *reasoning* behind a step rather than restate its status — status/progress
// stays GenerationActivity's job. One message per event type per run: like
// `generation-adapter`'s own `emitOnce`, a phase that repeats (e.g. a snapshot
// re-render) does not produce duplicate narration.

import type { GenerationEvent, GenerationEventType } from "../generation-events"
import type { BuilderConversationMessage } from "./types"

type PhaseCopy =
  | { kind: "explanation"; render: (event: GenerationEvent) => string }
  | { kind: "decision"; render: (event: GenerationEvent) => { decision: string; reason?: string } }

// Copy prefers `event.details.decision` / `event.details.reason` when a
// future backend populates them, and otherwise falls back to a generic but
// substantive explanation of that phase — never a fabricated specific
// (page counts, industry claims, etc.) we don't actually have data for.
const PHASE_COPY: Partial<Record<GenerationEventType, PhaseCopy>> = {
  GENERATION_STARTED: {
    kind: "explanation",
    render: () =>
      "I'm reading through your brief to figure out the structure this business actually needs, rather than dropping in a generic template.",
  },
  PLANNING_STARTED: {
    kind: "decision",
    render: (event) => ({
      decision:
        event.details?.decision ??
        "I'm laying out the sitemap around a small set of focused pages with clear navigation.",
      reason:
        event.details?.reason ??
        "Visitors convert better when they can find what they need in a click or two, so I'm keeping the structure simple.",
    }),
  },
  DESIGN_STARTED: {
    kind: "explanation",
    render: () =>
      "I'm settling on a color palette and typography system now — every page will inherit it, so getting it right first keeps the whole site visually consistent.",
  },
  ASSET_GENERATION_STARTED: {
    kind: "explanation",
    render: () =>
      "I'm preparing the images and visual assets the design calls for before wiring them into the pages.",
  },
  CODE_GENERATION_STARTED: {
    kind: "decision",
    render: (event) => ({
      decision: event.details?.decision ?? "I'm building the homepage first.",
      reason:
        event.details?.reason ??
        "It establishes the visual language the rest of the site will reuse, so every other page follows its lead.",
    }),
  },
  REVIEW_STARTED: {
    kind: "explanation",
    render: () =>
      "I'm checking responsiveness and validating the generated files before calling this done.",
  },
}

export function deriveBuilderConversation(events: GenerationEvent[]): BuilderConversationMessage[] {
  const messages: BuilderConversationMessage[] = []
  const emittedThisRun = new Set<GenerationEventType>()
  let runIndex = 0

  events.forEach((event, i) => {
    // A run that already ended (completed or errored) and starts again gets
    // its own dedupe scope, so a second build doesn't get silently swallowed.
    if (event.type === "GENERATION_STARTED" && (emittedThisRun.has("GENERATION_COMPLETED") || emittedThisRun.has("GENERATION_ERROR"))) {
      emittedThisRun.clear()
      runIndex += 1
    }

    if (event.type === "GENERATION_ERROR") {
      if (emittedThisRun.has(event.type)) return
      emittedThisRun.add(event.type)
      messages.push({
        kind: "warning",
        id: `builder-warning-${runIndex}-${i}`,
        timestamp: event.timestamp,
        text: event.message
          ? `Hit a problem while building: ${event.message}`
          : "Hit a problem during this build — taking another pass to fix it before continuing.",
      })
      return
    }

    if (event.type === "GENERATION_COMPLETED") {
      if (emittedThisRun.has(event.type)) return
      emittedThisRun.add(event.type)
      messages.push({
        kind: "summary",
        id: `builder-summary-${runIndex}-${i}`,
        timestamp: event.timestamp,
        text: "Site's built and validated, with a consistent design language carried across every page — it's ready to preview.",
      })
      return
    }

    const copy = PHASE_COPY[event.type]
    if (!copy || emittedThisRun.has(event.type)) return
    emittedThisRun.add(event.type)

    if (copy.kind === "decision") {
      const { decision, reason } = copy.render(event)
      messages.push({
        kind: "decision",
        id: `builder-decision-${runIndex}-${i}`,
        timestamp: event.timestamp,
        decision,
        reason,
      })
    } else {
      messages.push({
        kind: "explanation",
        id: `builder-explanation-${runIndex}-${i}`,
        timestamp: event.timestamp,
        text: copy.render(event),
      })
    }
  })

  return messages
}
