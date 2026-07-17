/**
 * Website Studio — `useGenerationEvents` hook.
 *
 * Subscribes to the `generationBus` for the lifetime of the component and
 * exposes the accumulated event history plus the most recent event.
 *
 * No backend session dependency. Nothing is wired to this yet — it is
 * infrastructure only.
 */

import { useEffect, useState, useCallback } from "react"

import { generationBus } from "./generation-event-bus"
import type { GenerationEvent } from "./generation-events"

export interface UseGenerationEventsResult {
  events: GenerationEvent[]
  latestEvent: GenerationEvent | null
}

export function useGenerationEvents(): UseGenerationEventsResult {
  const [events, setEvents] = useState<GenerationEvent[]>([])

  const handleEvent = useCallback((event: GenerationEvent) => {
    setEvents((prev) => [...prev, event])
  }, [])

  useEffect(() => {
    const unsubscribe = generationBus.subscribe(handleEvent)
    return () => {
      unsubscribe()
    }
  }, [handleEvent])

  return {
    events,
    latestEvent: events.length > 0 ? events[events.length - 1] : null,
  }
}
