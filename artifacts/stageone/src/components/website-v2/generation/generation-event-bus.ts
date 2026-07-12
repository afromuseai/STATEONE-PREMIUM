/**
 * Website Studio — Generation Event Bus.
 *
 * A minimal, dependency-free pub/sub bus for `GenerationEvent`s. This is
 * plain in-memory event fan-out — no Marcus, no network, no backend calls.
 *
 * Usage:
 *
 *   generationBus.emit({
 *     type: "CODE_GENERATION_STARTED",
 *     message: "Writing React components",
 *     timestamp: Date.now(),
 *   })
 *
 *   const unsubscribe = generationBus.subscribe((event) => { ... })
 *   unsubscribe() // or generationBus.unsubscribe(listener)
 */

import type { GenerationEvent } from "./generation-events"

export type GenerationEventListener = (event: GenerationEvent) => void

class GenerationEventBus {
  private listeners: Set<GenerationEventListener> = new Set()

  /** Emit an event to every currently-subscribed listener. */
  emit(event: GenerationEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  /**
   * Subscribe to all future events. Returns an `unsubscribe` function for
   * convenience (e.g. directly as a `useEffect` cleanup), in addition to
   * the explicit `unsubscribe(listener)` method below.
   */
  subscribe(listener: GenerationEventListener): () => void {
    this.listeners.add(listener)
    return () => this.unsubscribe(listener)
  }

  /** Remove a previously subscribed listener. */
  unsubscribe(listener: GenerationEventListener): void {
    this.listeners.delete(listener)
  }

  /** Number of currently active listeners. Useful for debugging/tests. */
  get listenerCount(): number {
    return this.listeners.size
  }
}

/** Singleton bus shared across the app. */
export const generationBus = new GenerationEventBus()
