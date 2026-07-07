// ─── WebContainer Runtime Types ───────────────────────────────────────────────

/**
 * Lifecycle states of the WebContainer runtime layer.
 * Progresses linearly: idle → booting → mounting → installing → starting → ready
 * Any stage can transition to "error".
 */
export type RuntimeStatus =
  | "idle"        // not yet started
  | "booting"     // WebContainer.boot() in progress
  | "mounting"    // copying project files into WC filesystem
  | "installing"  // npm install running
  | "starting"    // next dev spawned, waiting for server-ready
  | "ready"       // dev server is live, wcUrl is valid
  | "error"       // unrecoverable failure

export type TerminalLineType = "info" | "success" | "error" | "warn" | "cmd"

export interface TerminalLine {
  id:   number
  type: TerminalLineType
  text: string
  time: string  // "HH:MM:SS"
}

export interface RunResult {
  output:   string
  exitCode: number
}

export interface WCContextValue {
  /** Current lifecycle stage */
  status:       RuntimeStatus
  /** Live dev-server URL (e.g. "http://localhost:3000" inside WC network) */
  wcUrl:        string | null
  /** Streamed terminal output */
  terminalLines: TerminalLine[]
  /** Node.js version string detected after install, e.g. "v20.11.0" */
  nodeVersion:  string | null
  /** Number of top-level dependencies installed */
  depCount:     number
  /**
   * Write a file directly into the running WebContainer filesystem.
   * Triggers Next.js HMR automatically — no rebuild needed.
   */
  writeFile:    (path: string, content: string) => Promise<void>
  /**
   * Read a file from the WebContainer filesystem. (Phase O — O2)
   */
  readFile:     (path: string) => Promise<string>
  /**
   * List entries in a directory. (Phase O — O2)
   */
  listDir:      (path: string) => Promise<string[]>
  /**
   * Spawn a command in the WebContainer terminal and collect output. (Phase O — O2/O5)
   */
  runCommand:   (cmd: string, args: string[]) => Promise<RunResult>
  /** Clear the terminal log */
  clearTerminal: () => void
}
