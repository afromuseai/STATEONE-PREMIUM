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
  RunResult,
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

  // Inject tsconfig.json with @/* path alias if not present
  // The generated Next.js project uses @/components/* imports but doesn't include tsconfig.json
  const hasTsConfig = files.some(f => f.path === "tsconfig.json")
  if (!hasTsConfig) {
    tree["tsconfig.json"] = {
      file: {
        contents: JSON.stringify({
          compilerOptions: {
            target: "ES2017",
            lib: ["dom", "dom.iterable", "esnext"],
            allowJs: true,
            skipLibCheck: true,
            strict: true,
            noEmit: true,
            esModuleInterop: true,
            module: "esnext",
            moduleResolution: "bundler",
            resolveJsonModule: true,
            isolatedModules: true,
            jsx: "preserve",
            incremental: true,
            plugins: [{ name: "next" }],
            paths: {
              "@/*": ["./*"]
            }
          },
          include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
          exclude: ["node_modules"]
        }, null, 2)
      }
    }
  }

  // Inject next-env.d.ts if not present (required for Next.js TypeScript)
  const hasNextEnv = files.some(f => f.path === "next-env.d.ts")
  if (!hasNextEnv) {
    tree["next-env.d.ts"] = {
      file: {
        contents: `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n\n// NOTE: This file should not be edited\n// see https://nextjs.org/docs/basic-features/typescript for more information.\n`
      }
    }
  }

  // Inject package.json if not present (required for Next.js to run)
  const hasPackageJson = files.some(f => f.path === "package.json")
  if (!hasPackageJson) {
    // Extract dependencies from project files
    const deps = new Set<string>()
    for (const file of files) {
      if (file.path.endsWith(".tsx") || file.path.endsWith(".ts")) {
        // Find import statements that look like external packages
        const importMatches = file.content.matchAll(/from\s+['"]([^'"./][^'"]*)['"]/g)
        for (const match of importMatches) {
          const pkg = match[1]
          // Skip relative imports and Next.js built-ins
          if (!pkg.startsWith(".") && !pkg.startsWith("next/") && !pkg.startsWith("react")) {
            deps.add(pkg)
          }
        }
      }
    }
    const depList = Array.from(deps)
    
    tree["package.json"] = {
      file: {
        contents: JSON.stringify({
          name: "website-preview",
          version: "0.1.0",
          private: true,
          scripts: {
            dev: "next dev",
            build: "next build",
            start: "next start",
            lint: "next lint"
          },
          dependencies: {
            next: "14.1.0",
            react: "^18.3.1",
            "react-dom": "^18.3.1",
            ...Object.fromEntries(depList.map(d => [d, "latest"]))
          },
          devDependencies: {
            typescript: "^5",
            "@types/node": "^20",
            "@types/react": "^18",
            "@types/react-dom": "^18",
            tailwindcss: "^3.4.1",
            postcss: "^8",
            autoprefixer: "^10.4.17"
          }
        }, null, 2)
      }
    }
  }

  // Inject tailwind.config.ts if not present
  const hasTailwindConfig = files.some(f => f.path === "tailwind.config.ts" || f.path === "tailwind.config.js")
  if (!hasTailwindConfig) {
    tree["tailwind.config.ts"] = {
      file: {
        contents: `import type { Config } from "tailwindcss"

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config
`
      }
    }
  }

  // Inject postcss.config.js if not present
  const hasPostcssConfig = files.some(f => f.path === "postcss.config.js" || f.path === "postcss.config.ts")
  if (!hasPostcssConfig) {
    tree["postcss.config.js"] = {
      file: {
        contents: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
      }
    }
  }

  return tree
}

// ─── Package manager detection ────────────────────────────────────────────────
function detectPackageManager(files: V2ProjectFile[]): "npm" | "pnpm" {
  // Prefer pnpm if lockfile exists, otherwise check for package-lock.json
  if (files.some(f => f.path === "pnpm-lock.yaml")) return "pnpm"
  if (files.some(f => f.path === "package-lock.json")) return "npm"
  // Default to pnpm (faster, better caching) - will use corepack to enable
  return "pnpm"
}

// ─── Check if pnpm is available in WebContainer ───────────────────────────────
async function checkPnpmAvailable(wc: WCType): Promise<boolean> {
  try {
    const proc = await wc.spawn("pnpm", ["--version"])
    const chunks: string[] = []
    await proc.output.pipeTo(new WritableStream({ write: (c) => void chunks.push(c) }))
    await proc.exit
    return chunks.join("").trim().length > 0
  } catch {
    return false
  }
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
  /**
   * When false, the provider mounts (so the IDE shell can render the live
   * session) but the heavy boot → install → dev pipeline is deferred. This is
   * used while Marcus is still streaming files, so we never boot npm install
   * against a half-written project. Flip to true once generation completes.
   */
  enabled?: boolean
}

export function WebContainerProvider({ project, children, enabled = true }: Props) {
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
    // Propagate errors so callers (including the Phase O agent tool loop) know
    // when a write fails. Previously errors were swallowed silently.
    await wc.fs.writeFile(normalized, content)
    syncedFilesRef.current.set(path, content)
  }, [status])

  // ── writeFileForReview — returns diff for user approval before applying ────
  const writeFileForReview = useCallback(async (path: string, content: string) => {
    const wc = wcSingleton
    if (!wc || status !== "ready") throw new Error("WebContainer not ready")
    const normalized = path.startsWith("/") ? path : `/${path}`
    // Read old content for diff
    let oldContent = ""
    try {
      oldContent = await wc.fs.readFile(normalized, "utf-8")
    } catch {
      oldContent = "" // File doesn't exist yet
    }
    // Return diff without writing — caller decides whether to apply
    return { oldContent, newContent: content, path }
  }, [status])

  // ── readFile — Phase O O2: read a file from WC FS ──────────────────────────
  const readFile = useCallback(async (path: string): Promise<string> => {
    const wc = wcSingleton
    if (!wc || status !== "ready") throw new Error("WebContainer not ready")
    const normalized = path.startsWith("/") ? path : `/${path}`
    try {
      return await wc.fs.readFile(normalized, "utf-8")
    } catch (err) {
      throw new Error(`[WC] readFile failed: ${path} — ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [status])

  // ── listDir — Phase O O2: list directory entries ────────────────────────────
  const listDir = useCallback(async (path: string): Promise<string[]> => {
    const wc = wcSingleton
    if (!wc || status !== "ready") throw new Error("WebContainer not ready")
    const normalized = path.startsWith("/") ? path : `/${path}`
    try {
      const entries = await wc.fs.readdir(normalized, { withFileTypes: true })
      return (entries as Array<{ name: string; isDirectory: () => boolean }>).map(
        e => e.isDirectory() ? `${e.name}/` : e.name
      )
    } catch (err) {
      throw new Error(`[WC] listDir failed: ${path} — ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [status])

  // ── runCommand — Phase O O2/O5: spawn a process, collect output, with timeout
  const runCommand = useCallback(async (cmd: string, args: string[]): Promise<{ output: string; exitCode: number }> => {
    const wc = wcSingleton
    if (!wc || status !== "ready") throw new Error("WebContainer not ready")
    addLine(`$ ${cmd} ${args.join(" ")}`, "cmd")

    // Deny long-lived server commands that would stall the agent loop
    const BLOCKED = ["dev", "start", "serve", "watch"]
    if (cmd === "npm" && args.some(a => BLOCKED.includes(a))) {
      const msg = `Blocked: '${args.join(" ")}' would run a long-lived server. Use 'npm run build' or 'npm run lint' instead.`
      addLine(msg, "warn")
      return { output: msg, exitCode: 1 }
    }

    const TIMEOUT_MS = 60_000 // 1 minute hard limit

    try {
      const proc = await wc.spawn(cmd, args)
      const chunks: string[] = []

      proc.output.pipeTo(new WritableStream({
        write: (chunk) => {
          chunks.push(chunk)
          addRaw(chunk)
        },
      }))

      // Race the process exit against the timeout
      const exitCode = await Promise.race<number>([
        proc.exit,
        new Promise<number>((_, reject) =>
          setTimeout(() => reject(new Error(`Command timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
        ),
      ])

      return { output: chunks.join(""), exitCode }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      addLine(`✗ Command failed: ${msg}`, "error")
      return { output: msg, exitCode: 1 }
    }
  }, [status, addLine, addRaw])

  // ── Boot effect ─────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    // Deferred boot: don't start the heavy pipeline until `enabled` flips true
    // (i.e. the project is fully generated). This keeps the provider mounted so
    // the IDE shell can render Marcus's live work without booting against a
    // partial file tree.
    if (!enabled) return

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
        // If we already have a booted instance, reuse it
        if (wcSingleton) {
          wc = wcSingleton
          addLine("↩ Reusing existing WebContainer instance", "success")
        } else if (bootPromise) {
          // Wait for existing boot promise
          addLine("⏳ Waiting for existing boot to complete…", "info")
          wc = await bootPromise
          wcSingleton = wc
        } else {
          // Fresh boot
          const { WebContainer } = await import("@webcontainer/api")
          bootPromise = WebContainer.boot()
          wc = await bootPromise
          wcSingleton = wc
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // Handle "Only a single WebContainer instance can be booted" - the instance exists but we lost the reference
        if (msg.includes("Only a single WebContainer instance can be booted")) {
          addLine("⚠ WebContainer already booted elsewhere, waiting for reference…", "warn")
          bootPromise = null
          wcSingleton = null
          // Wait and retry - the existing instance should still be running
          await new Promise(r => setTimeout(r, 2000))
          try {
            const { WebContainer } = await import("@webcontainer/api")
            // Try to boot again - if it fails again, the instance is truly gone
            bootPromise = WebContainer.boot()
            wc = await bootPromise
            wcSingleton = wc
            addLine("✓ WebContainer recovered successfully", "success")
          } catch (retryErr) {
            bootPromise = null
            if (cancelled) return
            setStatus("error")
            addLine(
              `✗ Boot failed after recovery: ${retryErr instanceof Error ? retryErr.message : String(retryErr)}`,
              "error",
            )
            return
          }
        } else {
          bootPromise = null   // allow retry on next mount
          if (cancelled) return
          setStatus("error")
          addLine(
            `✗ Boot failed: ${msg}`,
            "error",
          )
          return
        }
      }
      if (cancelled) return

      // ── Fast-path: if we're reusing an existing instance, check if it's already ready
      if (wcSingleton && pipelineComplete && cachedWcUrl) {
        setStatus("ready")
        setWcUrl(cachedWcUrl)
        addLine("↩ WebContainer already running — reattached", "success")
        // Re-populate syncedFilesRef so Marcus-sync can diff correctly
        for (const f of project.files) syncedFilesRef.current.set(f.path, f.content)
        return
      }

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

      // ── Install dependencies ──────────────────────────────────────────────
      let pkgManager = detectPackageManager(project.files)
      setStatus("installing")
      addLine(`$ ${pkgManager} install`, "cmd")

      // Check if pnpm is actually available (corepack may not be present)
      if (pkgManager === "pnpm") {
        const pnpmAvailable = await checkPnpmAvailable(wc)
        if (!pnpmAvailable) {
          addLine("⚠ pnpm not available in WebContainer, falling back to npm", "warn")
          pkgManager = "npm"
          addLine(`$ npm install (fallback)`, "cmd")
        }
      }

      try {
        const installProc = await wc.spawn(pkgManager, ["install"])
        installProc.output.pipeTo(new WritableStream({ write: addRaw }))
        
        // Add timeout for install (10 minutes max) - kill process on timeout
        const INSTALL_TIMEOUT_MS = 10 * 60 * 1000
        let timedOut = false
        const code = await Promise.race<number>([
          installProc.exit,
          new Promise<number>((_, reject) =>
            setTimeout(() => {
              timedOut = true
              installProc.kill()
              reject(new Error(`${pkgManager} install timed out after ${INSTALL_TIMEOUT_MS / 1000}s`))
            }, INSTALL_TIMEOUT_MS)
          ),
        ])
        if (timedOut) {
          if (cancelled) return
          setStatus("error")
          addLine(`✗ ${pkgManager} install timed out and was killed`, "error")
          return
        }
        if (code !== 0) {
          if (cancelled) return
          setStatus("error")
          addLine(`✗ ${pkgManager} install exited with code ${code}`, "error")
          return
        }
        addLine("✓ Dependencies installed", "success")

        // ── npm install with retry ─────────────────────────────────────────────
        const MAX_INSTALL_RETRIES = 3
        for (let attempt = 1; attempt <= MAX_INSTALL_RETRIES; attempt++) {
          try {
            const installProc = await wc.spawn(pkgManager, ["install"])
            installProc.output.pipeTo(new WritableStream({ write: addRaw }))
            
            const INSTALL_TIMEOUT_MS = 10 * 60 * 1000
            let timedOut = false
            const code = await Promise.race<number>([
              installProc.exit,
              new Promise<number>((_, reject) =>
                setTimeout(() => {
                  timedOut = true
                  installProc.kill()
                  reject(new Error(`${pkgManager} install timed out after ${INSTALL_TIMEOUT_MS / 1000}s`))
                }, INSTALL_TIMEOUT_MS)
              ),
            ])
            if (timedOut) throw new Error(`${pkgManager} install timed out`)
            if (code !== 0) throw new Error(`${pkgManager} install exited with code ${code}`)
            addLine("✓ Dependencies installed", "success")
            
            // Node version for status bar (non-critical)
            try {
              const nodeProc = await wc.spawn("node", ["--version"])
              const chunks: string[] = []
              await nodeProc.output.pipeTo(new WritableStream({ write: (c) => void chunks.push(c) }))
              const ver = chunks.join("").trim()
              if (ver && !cancelled) setNodeVersion(ver)
            } catch {}

            // Dep count from package.json (non-critical)
            try {
              const pkgRaw = await wc.fs.readFile("/package.json", "utf-8")
              const pkg = JSON.parse(pkgRaw) as { dependencies?: Record<string, string> }
              if (!cancelled) setDepCount(Object.keys(pkg.dependencies ?? {}).length)
            } catch {}

            break
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            const isNetwork = /network|timeout|fetch|socket|ENOTFOUND|ECONNREFUSED|ERR_SOCKET_TIMEOUT/i.test(msg)
            if (attempt < MAX_INSTALL_RETRIES && isNetwork) {
              const delay = Math.min(5000 * Math.pow(2, attempt - 1), 30000)
              addLine(`⚠ Install failed (${msg}) — retrying in ${delay / 1000}s (${attempt}/${MAX_INSTALL_RETRIES})…`, "warn")
              await new Promise(r => setTimeout(r, delay))
              continue
            } else {
              if (cancelled) return
              setStatus("error")
              addLine(`✗ ${pkgManager} install error: ${msg}`, "error")
              return
            }
          }
        }

        // ── npm run dev ──────────────────────────────────────────────────────
        setStatus("starting")
        addLine(`$ ${pkgManager} run dev`, "cmd")

        try {
          const devProc = await wc.spawn(pkgManager, ["run", "dev"])
          devProc.output.pipeTo(new WritableStream({ write: addRaw }))
          
          // Don't wait for devProc.exit - Next.js dev server runs forever!
          // Instead, wait for server-ready event or polling (below)
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

      // Poll the dev server URL as fallback since server-ready event may not fire
      // Use curl inside WebContainer since browser can't reach container's localhost
      const pollUrl = async (): Promise<string | null> => {
        const ports = [3000, 3001, 3002, 3003, 3004, 3005]
        for (const port of ports) {
          try {
            const proc = await wc.spawn("curl", ["-s", "-o", "/dev/null", "-w", "%{http_code}", `http://localhost:${port}`])
            const chunks: string[] = []
            await proc.output.pipeTo(new WritableStream({ write: (c) => void chunks.push(c) }))
            await proc.exit
            const code = chunks.join("").trim()
            if (code && (code === "200" || code === "404")) {
              return `http://localhost:${port}`
            }
          } catch { /* ignore */ }
        }
        return null
      }

      let url: string | null = null
      const startTime = Date.now()
      const MAX_WAIT = 180_000 // 3 minutes

      // First try the server-ready event
      const eventPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("server-ready event timeout")), 30_000)
        wc.on("server-ready", (port, serverUrl) => {
          clearTimeout(timeout)
          resolve(serverUrl)
        })
      })

      try {
        url = await eventPromise
        addLine(`✓ Next.js ready via event → ${url}`, "success")
      } catch {
        // Fallback: poll the URL using curl inside WebContainer
        addLine("⧗ server-ready event not fired, polling URL via curl…", "warn")
        while (Date.now() - startTime < MAX_WAIT) {
          url = await pollUrl()
          if (url) {
            addLine(`✓ Next.js ready via polling → ${url}`, "success")
            break
          }
          await new Promise(r => setTimeout(r, 2000))
        }
        if (!url) {
          throw new Error("server-ready timeout after 3 minutes (event + polling)")
        }
      }

      cachedWcUrl = url          // persist for future remounts
      pipelineComplete = true    // mark pipeline done at module scope
      if (!cancelled) {
        setWcUrl(url)
        setStatus("ready")
        addLine(`✓ Next.js ready → ${url}`, "success")
      }
    }

    run()

    return () => {
      cancelled = true
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]) // re-run when enabled flips; module flags guard against re-boot

  // ── N5: Sync Marcus edits → WC FS on project.files change ──────────────────
  // Use a content-hash dependency so re-renders with the same file contents do
  // not re-trigger the effect (and avoid redundant writeFile calls).
  const filesKey = useMemo(
    () => project.files.map(f => `${f.path}:${f.content}`).join("||"),
    [project.files],
  )
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filesKey, addLine]) // only re-run when file contents actually change

  // ── Context value ───────────────────────────────────────────────────────────
  const value = useMemo<WCContextValue>(
    () => ({ status, wcUrl, terminalLines, nodeVersion, depCount, writeFile, writeFileForReview, readFile, listDir, runCommand, clearTerminal }),
    [status, wcUrl, terminalLines, nodeVersion, depCount, writeFile, writeFileForReview, readFile, listDir, runCommand, clearTerminal],
  )

  return (
    <WCReactContext.Provider value={value}>
      {children}
    </WCReactContext.Provider>
  )
}
