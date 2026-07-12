import { RuntimeQueue } from "./RuntimeQueue"
import { RuntimeMachine } from "../state/RuntimeMachine"
import { RuntimeState } from "../state/RuntimeTypes"

export class RuntimeController {
  private readonly queue = new RuntimeQueue()
  private readonly machine = new RuntimeMachine()

  get state() {
    return this.machine.getState()
  }

  is(state: RuntimeState) {
    return this.machine.is(state)
  }

  setState(state: RuntimeState) {
    this.machine.setState(state)
  }

  async execute(task: () => Promise<void>) {
    await this.queue.add(task)
  }

  reset() {
    this.queue.clear()
    this.machine.reset()
  }

  getQueueSize() {
    return this.queue.size()
  }

  isBusy() {
    return this.queue.isRunning()
  }
}