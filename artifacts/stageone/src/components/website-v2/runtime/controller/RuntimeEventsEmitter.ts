import { RuntimeEvent } from "./RuntimeEvents"

type Listener = (
  event: RuntimeEvent,
  data?: unknown
) => void

export class RuntimeEventsEmitter {
  private listeners: Listener[] = []

  subscribe(listener: Listener) {
    this.listeners.push(listener)

    return () => {
      this.listeners = this.listeners.filter(
        (item) => item !== listener
      )
    }
  }

  emit(
    event: RuntimeEvent,
    data?: unknown
  ) {
    for (const listener of this.listeners) {
      listener(event, data)
    }
  }

  clear() {
    this.listeners = []
  }
}