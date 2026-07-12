import { RuntimeState } from "./RuntimeTypes"

export class RuntimeMachine {
  private state: RuntimeState = RuntimeState.IDLE

  getState(): RuntimeState {
    return this.state
  }

  setState(next: RuntimeState) {
    this.state = next
  }

  is(state: RuntimeState): boolean {
    return this.state === state
  }

  reset() {
    this.state = RuntimeState.IDLE
  }
}