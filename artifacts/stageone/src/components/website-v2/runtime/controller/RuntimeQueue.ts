export class RuntimeQueue {
  private queue: (() => Promise<void>)[] = []
  private running = false

  add(task: () => Promise<void>) {
    return new Promise<void>((resolve, reject) => {
      const wrapped = async () => {
        try {
          await task()
          resolve()
        } catch (e) {
          reject(e)
        }
      }
      this.queue.push(wrapped)
      this.process()
    })
  }

  private async process() {
    if (this.running) return

    this.running = true

    while (this.queue.length > 0) {
      const task = this.queue.shift()

      if (task) {
        await task()
      }
    }

    this.running = false
  }

  clear() {
    this.queue = []
  }
}