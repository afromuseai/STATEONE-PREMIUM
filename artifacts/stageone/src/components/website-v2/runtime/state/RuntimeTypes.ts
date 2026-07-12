export enum RuntimeState {
  IDLE = "IDLE",
  BOOTING = "BOOTING",
  BOOTED = "BOOTED",
  MOUNTING = "MOUNTING",
  MOUNTED = "MOUNTED",
  INSTALLING = "INSTALLING",
  INSTALLED = "INSTALLED",
  STARTING = "STARTING",
  READY = "READY",
  STOPPING = "STOPPING",
  STOPPED = "STOPPED",
  ERROR = "ERROR",
}

export interface RuntimeContextState {
  state: RuntimeState
  error?: string | null
}

