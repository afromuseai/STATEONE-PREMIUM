import { RuntimeEngine } from "./RuntimeEngine"

class RuntimeBridge {
  private engine: RuntimeEngine | null = null

  getEngine() {
    if (!this.engine) {
      this.engine = new RuntimeEngine()
    }

    return this.engine
  }

  async startProject(files: any, projectId?: string) {
    const engine = this.getEngine()

    await engine.start(files, projectId)
  }

  reset() {
    this.engine = null
  }
}

export const runtimeBridge = new RuntimeBridge()