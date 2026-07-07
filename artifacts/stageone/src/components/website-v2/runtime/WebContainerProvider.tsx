import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { FileSystemTree, WebContainer as WCType } from "@webcontainer/api"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import type {
  RuntimeStatus,
  TerminalLine,
  TerminalLineType,
  WCContextValue,
} from "./runtime-types"
import { WCReactContext } from "./WCContext"

// ─── Module-level singleton state ─────────────────────────────────────────────
// All of this lives outside React so it survives remounts, HMR, and StrictMode
// double-invoke without racing.

/** The booted WC instance — set once, never replaced. */
let wcSingleton: WCType | null = null

/**
 * In-flight boot promise. Any concurrent boot attempt awaits this instead of
 * calling WebContainer.boot() a second time. Set to null only if boot fails.
 */
let bootPromise: Promise<WCType> | null = null

/**
 * True once mount → install → dev have all completed successfully.
 * Prevents re-running the heavy startup pipeline on provider remount.
 */
let pipelineComplete = false

/**
 * Last captured server-ready URL. Restored immediately on remount so the
 * preview iframe doesn't go blank while the provider reinitialises.
 */
let cachedWcUrl: string | null = null

// ─── File-tree builder ────────────────────────────────────────────────────────
function buildFileTree(files: V2ProjectFile[]): FileSystemTree {
  const tree: FileSystemTree = {}
  for (const file of files) {
    const parts = file.path.split("/")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let node: any = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i]
      if (!node[seg]) node[seg] = { directory: {} }
      node = node[seg].directory
    }
    node[parts[parts.length - 1]] = { file: { contents: file.content } }
  }
  return tree
}

// ─── Line classifier ──────────────────────────────────────────────────────────
function classifyLine(text: string): TerminalLineType {
  const t = text.trim()
  if (t.startsWith("$") || t.startsWith(">") || t.startsWith("npm ")) return "cmd"
  if (/error|Error|ENOENT|EACCES|cannot find|Cannot find/i.test(t)) return "error"
  if (/warn|WARN|deprecated/i.test(t)) return "warn"
  if (/✓|✔|ready|Ready|compiled|success|done|added \d+/i.test(t)) return "success"
  return "info"
}

function nowHMS() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map((n) => String(n).padStart(2, "0"))
    .join(":")
}

let lineCounter = 0

// ─── Provider ─────────────────────────────────────────────────────────────────
interface Props {
  project:  V2Project
  children: React.ReactNode
}

export function WebContainerProvider({ project, children }: Props) {
  // Restore last-known URL immediately so the preview iframe is never blank
  // on a remount (e.g. HMR, StrictMode double-invoke).
  const [status,        setStatus]       = useState<RuntimeStatus>(
    pipelineComplete ? "ready" : "idle",
  )
  const [wcUrl,         setWcUrl]        = useState<string | null>(cachedWcUrl)
  const [terminalLines, setTermLines]    = useState<TerminalLine[]>([])
  const [nodeVersion,   setNodeVersion]  = useState<string | null>(null)
  const [depCount,      setDepCount]     = useState(0)

  // Track synced files for the Marcus-edit diff (N5)
  const syncedFilesRef = useRef<Map<string, string>>(new Map())

  // ── Terminal helpers ────────────────────────────────────────────────────────
  const addLine = useCallback((text: string, typeOverride?: TerminalLineType) => {
    const type = typeOverride ?? classifyLine(text)
    setTermLines((prev) => [
      ...prev,
      { id: ++lineCounter, type, text: text.trim(), time: nowHMS() },
    ])
  }, [])

  const addRaw = useCallback((chunk: string) => {
    for (const line of chunk.split(/\r?\n/)) {
      const t = line.trim()
      if (t) addLine(t)
    }
  }, [addLine])

  const clearTerminal = useCallback(() => setTermLines([]), [])

  // ── writeFile — Monaco onChange writes directly to WC FS (N4) ──────────────
  const writeFile = useCallback(async (path: string, content: string) => {
    const wc = wcSingleton
    if (!wc || status !== "ready") return
    const normalized = path.startsWith("/") ? path : `/${path}`
    try {
      await wc.fs.writeFile(normalized, content)
      syncedFilesRef.current.set(path, content)
    } catch (err) {
      console.error("[WC] writeFile failed:", path, err)
    }
  }, [status])

  // ── Boot effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function run() {
      // ── Fast-path: pipeline already finished (remount / HMR) ──────────────
      if (pipelineComplete && wcSingleton) {
        setStatus("ready")
        setWcUrl(cachedWcUrl)
        addLine("↩ WebContainer already running — reattached", "success")
        // Re-populate syncedFilesRef so Marcus-sync can diff correctly
        for (const f of project.files) syncedFilesRef.current.set(f.path, f.content)
        return
      }

      // ── Environment check ────────────────────────────────────────────────
      const isolated =
        typeof crossOriginIsolated !== "undefined" && crossOriginIsolated
      if (!isolated) {
        addLine("⚠ Cross-origin isolation not detected — WC may not boot", "warn")
        addLine("  (COOP/COEP headers may be stripped by the reverse proxy)", "warn")
      }

      // ── Boot — one promise shared across any concurrent mounts ───────────
      setStatus("booting")
      addLine("$ Booting WebContainer…", "cmd")

      let wc: WCType
      try {
        if (!bootPromise) {
          const { WebContainer } = await import("@webcontainer/api")
          bootPromise = WebContainer.boot()
        }
        wc = await bootPromise
        wcSingleton = wc
      } catch (err) {
        bootPromise = null   // allow retry on next mount
        if (cancelled) return
        setStatus("error")
        addLine(
          `✗ Boot failed: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        )
        return
      }
      if (cancelled) return

      // ── Mount ────────────────────────────────────────────────────────────
      setStatus("mounting")
      addLine(`$ Mounting ${project.files.length} files…`, "cmd")

      try {
        await wc.mount(buildFileTree(project.files))
        for (const f of project.files) syncedFilesRef.current.set(f.path, f.content)
        addLine(`✓ ${project.files.length} files mounted`, "success")
      } catch (err) {
        if (cancelled) return
        setStatus("error")
        addLine(
          `✗ Mount failed: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        )
        return
      }
      if (cancelled) return

      // ── npm install ──────────────────────────────────────────────────────
      setStatus("installing")
      addLine("$ npm install", "cmd")

      try {
        const installProc = await wc.spawn("npm", ["install"])
        installProc.output.pipeTo(new WritableStream({ write: addRaw }))
        const code = await installProc.exit
        if (code !== 0) {
          if (cancelled) return
          setStatus("error")
          addLine(`✗ npm install exited with code ${code}`, "error")
          return
        }
        addLine("✓ Dependencies installed", "success")

        // Node version for status bar (non-critical)
        try {
          const nodeProc = await wc.spawn("node", ["--version"])
          const chunks: string[] = []
          await nodeProc.output.pipeTo(new WritableStream({ write: (c) => void chunks.push(c) }))
          const ver = chunks.join("").trim()
          if (ver && !cancelled) setNodeVersion(ver)
        } catch { /* non-critical */ }

        // Dep count from package.json (non-critical)
        try {
          const pkgRaw = await wc.fs.readFile("/package.json", "utf-8")
          const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> }
          if (!cancelled) setDepCount(Object.keys(pkg.dependencies ?? {}).length)
        } catch { /* non-critical */ }

      } catch (err) {
        if (cancelled) return
        setStatus("error")
        addLine(
          `✗ npm install error: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        )
        return
      }
      if (cancelled) return

      // ── npm run dev ──────────────────────────────────────────────────────
      setStatus("starting")
      addLine("$ npm run dev", "cmd")

      try {
        const devProc = await wc.spawn("npm", ["run", "dev"])
        devProc.output.pipeTo(new WritableStream({ write: addRaw }))
      } catch (err) {
        if (cancelled) return
        setStatus("error")
        addLine(
          `✗ Failed to start dev server: ${err instanceof Error ? err.message : String(err)}`,
          "error",
        )
        return
      }
      if (cancelled) return

      // ── server-ready ─────────────────────────────────────────────────────
      addLine("⧗ Waiting for Next.js server-ready…", "info")

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("server-ready timeout after 3 minutes")),
          180_000,
        )
        let settled = false
        const settle = (fn: () => void) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          fn()
        }
        // wc.on stacks listeners; we use one-shot settle to avoid duplicates
        wc.on("server-ready", (port, url) => {
          settle(() => {
            cachedWcUrl = url          // persist for future remounts
            pipelineComplete = true    // mark pipeline done at module scope
            if (!cancelled) {
              setWcUrl(url)
              setStatus("ready")
              addLine(`✓ Next.js ready → ${url} (port ${port})`, "success")
            }
            resolve()
          })
        })
      }).catch((err) => {
        if (cancelled) return
        setStatus("error")
        addLine(`✗ ${err instanceof Error ? err.message : String(err)}`, "error")
      })
    }

    run()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally stable — only run once per mount, module flags guard reuse

  // ── N5: Sync Marcus edits → WC FS on project.files change ──────────────────
  useEffect(() => {
    const wc = wcSingleton
    if (!wc || status !== "ready") return

    for (const file of project.files) {
      const prev = syncedFilesRef.current.get(file.path)
      if (prev === file.content) continue
      const normalized = file.path.startsWith("/") ? file.path : `/${file.path}`
      wc.fs.writeFile(normalized, file.content).catch((err) => {
        console.error("[WC] Marcus sync writeFile failed:", file.path, err)
      })
      syncedFilesRef.current.set(file.path, file.content)
      addLine(`↺ Synced ${file.path.split("/").pop()}`, "info")
    }
  }, [project.files, status, addLine])

  // ── Context value ───────────────────────────────────────────────────────────
  const value = useMemo<WCContextValue>(
    () => ({ status, wcUrl, terminalLines, nodeVersion, depCount, writeFile, clearTerminal }),
    [status, wcUrl, terminalLines, nodeVersion, depCount, writeFile, clearTerminal],
  )

  return (
    <WCReactContext.Provider value={value}>
      {children}
    </WCReactContext.Provider>
  )
}
