// ─── Website Studio Runtime Event Emitter ─────────────────────────────────────
// Simple event emitter for WebsiteStudioRuntime to emit execution events.
// No React dependency. Pure TypeScript.

import type { WSRuntimeEvent } from "./WebsiteStudioRuntimeEvents"

export type WSRuntimeEventListener = (event: WSRuntimeEvent) => void

export class WSRuntimeEventEmitter {
  private listeners: Set<WSRuntimeEventListener> = new Set()

  /** Emit an event to all listeners */
  emit(event: WSRuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  /** Subscribe to events. Returns unsubscribe function. */
  subscribe(listener: WSRuntimeEventListener): () => void {
    this.listeners.add(listener)
    return () => this.unsubscribe(listener)
  }

  /** Remove a listener */
  unsubscribe(listener: WSRuntimeEventListener): void {
    this.listeners.delete(listener)
  }

  /** Number of active listeners */
  get listenerCount(): number {
    return this.listeners.size
  }
}

/** Singleton emitter for the runtime */
export const wsRuntimeEmitter = new WSRuntimeEventEmitter()