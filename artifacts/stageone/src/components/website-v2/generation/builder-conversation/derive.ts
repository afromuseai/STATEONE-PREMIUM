// ─── Builder Conversation — derivation from the generation event bus ──────────
// Phase 12.5.2 — Stripped of all hardcoded AI dialogue.
//
// The frontend must never create AI conversation. All visible assistant
// responses must come from LLM generation through the centralized Website
// Studio AI identity.
//
// This module now only surfaces:
//   - warnings (GENERATION_ERROR — user-facing errors, not AI speech)
//   - a minimal completion summary (simple state notification, not AI roleplay)
//
// Generation progress belongs to the ActivityEngine (activity layer) and
// GenerationActivity (UI progress display). See AgentConversation.tsx for
// the ActivityEngine wiring.

import type { GenerationEvent, GenerationEventType } from "../generation-events"
import type { BuilderConversationMessage } from "./types"

export function deriveBuilderConversation(events: GenerationEvent[]): BuilderConversationMessage[] {
  const messages: BuilderConversationMessage[] = []
  const emittedThisRun = new Set<GenerationEventType>()
  let runIndex = 0

  events.forEach((event, i) => {
    // A run that already ended and starts again gets its own dedupe scope
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
      // Completion is purely activity-layer — handled by ActivityEngine.
      // No assistant message needed. The generation progress UI and activity
      // strip show the final state. A future enhancement may add an
      // AI-generated summary via the conversation endpoint.
      return
    }
  })

  return messages
}
