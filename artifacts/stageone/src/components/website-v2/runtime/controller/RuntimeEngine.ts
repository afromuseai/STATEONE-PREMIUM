import { BootService } from "../services/BootService"
import { MountService } from "../services/MountService"
import { InstallService } from "../services/InstallService"
import { DevServerService } from "../services/DevServerService"
import { RuntimeController } from "./RuntimeController"
import { RuntimeEventsEmitter } from "./RuntimeEventsEmitter"
import { RuntimeEvent } from "./RuntimeEvents"
import { RuntimeState } from "../state/RuntimeTypes"

export class RuntimeEngine {
  private controller = new RuntimeController()
  private events = new RuntimeEventsEmitter()

  private bootService = new BootService()
  private mountService = new MountService()
  private installService = new InstallService()
  private devService = new DevServerService()

  getRuntime() {
    return this.controller
  }

  subscribe(listener: any) {
    return this.events.subscribe(listener)
  }

  async start(files: any, projectId?: string) {
    await this.controller.execute(async () => {
      try {
        // ── Boot (no-op) ────────────────────────────────────────────────────
        this.controller.setState(RuntimeState.BOOTING)
        this.events.emit(RuntimeEvent.BOOT_STARTED)
        await this.bootService.execute()
        this.events.emit(RuntimeEvent.BOOT_COMPLETED)

        // ── Mount (no-op) ───────────────────────────────────────────────────
        this.controller.setState(RuntimeState.MOUNTING)
        this.events.emit(RuntimeEvent.MOUNT_STARTED)
        await this.mountService.execute()
        this.events.emit(RuntimeEvent.MOUNT_COMPLETED)

        // ── Install (no-op) ─────────────────────────────────────────────────
        this.controller.setState(RuntimeState.INSTALLING)
        this.events.emit(RuntimeEvent.INSTALL_STARTED)
        await this.installService.execute()
        this.events.emit(RuntimeEvent.INSTALL_COMPLETED)

        // ── Start preview generation via api-server ─────────────────────────
        this.controller.setState(RuntimeState.STARTING)

        if (projectId) {
          await this.devService.execute(projectId)
        }

        const url = await this.devService.waitForReady()

        this.controller.setState(RuntimeState.READY)
        this.events.emit(RuntimeEvent.SERVER_READY, url)

      } catch (error) {
        this.controller.setState(RuntimeState.ERROR)
        this.events.emit(RuntimeEvent.ERROR, error)
        throw error
      }
    })
  }
}