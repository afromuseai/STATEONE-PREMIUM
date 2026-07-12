export interface TerminalMessage {
  id: number
  type: "info" | "error" | "success" | "warning"
  message: string
  timestamp: Date
}

export class TerminalService {
  private logs: TerminalMessage[] = []
  private counter = 0

  add(
    message: string,
    type: TerminalMessage["type"] = "info"
  ) {
    this.logs.push({
      id: ++this.counter,
      type,
      message,
      timestamp: new Date(),
    })
  }

  getLogs() {
    return this.logs
  }

  clear() {
    this.logs = []
  }
}