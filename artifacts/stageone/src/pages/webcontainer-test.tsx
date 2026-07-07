// ─── WebContainer Runtime Diagnostics Console ─────────────────────────────────
// Comprehensive 10-stage feasibility validator.
// Two scenarios: Minimal hardcoded Next.js project + actual V2 project from DB.
// Completely isolated — does not touch Website Studio or any V2 pipeline code.
//
// Stages (in order):
//   1. Environment       — crossOriginIsolated, SharedArrayBuffer
//   2. WebContainer.boot — WASM kernel init, timing
//   3. Service Worker    — registration after boot
//   4. Virtual FS mount  — file tree written to WASM fs
//   5. npm install       — dependency resolution + download
//   6. next dev spawn    — process start
//   7. server-ready      — URL captured from event
//   8. iframe render     — first document load in preview
//   9. fs.writeFile()    — write to live WASM filesystem
//  10. HMR propagation   — visual update in iframe (manual confirm)

import { useState, useEffect, useRef, useCallback } from "react"
import type { FileSystemTree, WebContainer as WCType } from "@webcontainer/api"

// ─── Stage definitions ────────────────────────────────────────────────────────
const STAGE_DEFS = [
  { id: "env",     label: "Environment check",  detail: "crossOriginIsolated · SharedArrayBuffer" },
  { id: "boot",    label: "WebContainer.boot()", detail: "WASM kernel initialisation" },
  { id: "sw",      label: "Service Worker",      detail: "Registration after boot" },
  { id: "mount",   label: "Virtual FS mount",    detail: "File tree → WASM filesystem" },
  { id: "install", label: "npm install",         detail: "Dependency download · resolution" },
  { id: "dev",     label: "next dev spawn",      detail: "Child process start" },
  { id: "ready",   label: "server-ready event",  detail: "Port bound · URL captured" },
  { id: "iframe",  label: "iframe render",        detail: "First document load in preview" },
  { id: "write",   label: "fs.writeFile()",       detail: "Write to live WASM filesystem" },
  { id: "hmr",     label: "HMR propagation",     detail: "File change → live update in iframe" },
] as const

type StageId = typeof STAGE_DEFS[number]["id"]

interface StageResult {
  status:     "pending" | "running" | "pass" | "fail" | "warn" | "skipped"
  durationMs?: number
  note?:       string
}

type Measurements = Record<StageId, StageResult>

const INIT_STAGES: Measurements = Object.fromEntries(
  STAGE_DEFS.map((s) => [s.id, { status: "pending" }])
) as Measurements

// ─── V2 API types ─────────────────────────────────────────────────────────────
interface V2Summary { id: string; projectName: string; status: string }
interface V2File    { path: string; content: string; language?: string }

// ─── Minimal Next.js project (Pages Router — faster than App Router) ──────────
const MINIMAL_FILES: FileSystemTree = {
  "package.json": {
    file: {
      contents: JSON.stringify({
        name: "wc-minimal-test",
        version: "0.0.1",
        private: true,
        scripts: { dev: "next dev -p 3000" },
        dependencies: { next: "14.2.5", react: "18.3.1", "react-dom": "18.3.1" },
      }, null, 2),
    },
  },
  "next.config.js": {
    file: { contents: `/** @type {import('next').NextConfig} */\nmodule.exports = { reactStrictMode: false }` },
  },
  pages: {
    directory: {
      "_app.jsx": {
        file: { contents: `export default function App({ Component, pageProps }) { return <Component {...pageProps} /> }` },
      },
      "index.jsx": {
        file: {
          contents: `import { useState } from 'react'
export default function Home() {
  const [n, setN] = useState(0)
  return (
    <div id="wc-root" style={{
      fontFamily:'system-ui',padding:'3rem',textAlign:'center',
      background:'linear-gradient(135deg,#0f172a,#1e1b4b)',
      minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'white'
    }}>
      <div style={{fontSize:'3rem',marginBottom:'1rem'}}>🚀</div>
      <h1 style={{fontSize:'2rem',fontWeight:700,marginBottom:'0.5rem'}}>WebContainer + Next.js 14</h1>
      <p style={{color:'#94a3b8',marginBottom:'2rem'}}>Real Node.js · real React · no build step</p>
      <button onClick={()=>setN(n+1)} style={{
        padding:'0.75rem 2rem',fontSize:'1rem',fontWeight:600,
        background:'#6366f1',color:'white',border:'none',
        borderRadius:'0.5rem',cursor:'pointer'
      }}>Clicked {n}×</button>
      <p style={{marginTop:'1rem',color:'#475569',fontSize:'0.7rem'}}>v1 — original • HMR test will change this to green</p>
    </div>
  )
}`,
        },
      },
    },
  },
}

const HMR_CONTENT = `import { useState } from 'react'
export default function Home() {
  const [n, setN] = useState(0)
  return (
    <div id="wc-root" style={{
      fontFamily:'system-ui',padding:'3rem',textAlign:'center',
      background:'linear-gradient(135deg,#0f172a,#064e3b)',
      minHeight:'100vh',display:'flex',flexDirection:'column',
      alignItems:'center',justifyContent:'center',color:'white'
    }}>
      <div style={{fontSize:'3rem',marginBottom:'1rem'}}>✅</div>
      <h1 style={{fontSize:'2rem',fontWeight:700,marginBottom:'0.5rem',color:'#6ee7b7'}}>HMR Working!</h1>
      <p style={{color:'#6ee7b7',marginBottom:'2rem'}}>fs.writeFile() triggered live update</p>
      <button onClick={()=>setN(n+1)} style={{
        padding:'0.75rem 2rem',fontSize:'1rem',fontWeight:600,
        background:'#10b981',color:'white',border:'none',
        borderRadius:'0.5rem',cursor:'pointer'
      }}>Still reactive: {n}</button>
      <p style={{marginTop:'1rem',color:'#475569',fontSize:'0.7rem'}}>v2 — HMR-updated by fs.writeFile()</p>
    </div>
  )
}`

// ─── File tree builder for V2 projects ───────────────────────────────────────
function buildFileTree(files: V2File[]): FileSystemTree {
  const tree: Record<string, unknown> = {}

  for (const f of files) {
    if (!f.content || !f.path) continue
    const parts = f.path.replace(/^\//, "").split("/")
    let node: Record<string, unknown> = tree

    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts[i]
      if (!(dir in node)) node[dir] = { directory: {} }
      node = (node[dir] as { directory: Record<string, unknown> }).directory
    }

    const filename = parts[parts.length - 1]
    node[filename] = { file: { contents: f.content } }
  }

  return tree as FileSystemTree
}

function ensureV2Defaults(tree: FileSystemTree, files: V2File[]): FileSystemTree {
  const paths = new Set(files.map((f) => f.path))
  const t = tree as Record<string, unknown>

  if (!paths.has("package.json")) {
    t["package.json"] = {
      file: {
        contents: JSON.stringify({
          name: "v2-project",
          version: "0.0.1",
          private: true,
          scripts: { dev: "next dev -p 3000" },
          dependencies: {
            next: "14.2.5",
            react: "18.3.1",
            "react-dom": "18.3.1",
            "framer-motion": "^11.0.0",
            "lucide-react": "^0.400.0",
            tailwindcss: "^3.4.0",
            autoprefixer: "^10.0.0",
            postcss: "^8.0.0",
          },
        }, null, 2),
      },
    }
  } else {
    // Ensure the dev script uses port 3000
    try {
      const pkgNode = t["package.json"] as { file: { contents: string } }
      const pkg = JSON.parse(pkgNode.file.contents)
      if (!pkg.scripts) pkg.scripts = {}
      if (!pkg.scripts.dev) pkg.scripts.dev = "next dev -p 3000"
      else if (!pkg.scripts.dev.includes("-p")) pkg.scripts.dev += " -p 3000"
      pkgNode.file.contents = JSON.stringify(pkg, null, 2)
    } catch { /* leave as-is */ }
  }

  if (!paths.has("next.config.js") && !paths.has("next.config.mjs") && !paths.has("next.config.ts")) {
    t["next.config.js"] = {
      file: { contents: `/** @type {import('next').NextConfig} */\nmodule.exports = { reactStrictMode: false }` },
    }
  }

  return t as FileSystemTree
}

// ─── Component ─────────────────────────────────────────────────────────────────
export default function WebContainerDiagnostics() {
  const [scenario,           setScenario]          = useState<"minimal" | "v2">("minimal")
  const [stages,             setStages]             = useState<Measurements>(INIT_STAGES)
  const [terminal,           setTerminal]           = useState("")
  const [iframeUrl,          setIframeUrl]          = useState<string | null>(null)
  const [isRunning,          setIsRunning]          = useState(false)
  const [issues,             setIssues]             = useState<string[]>([])
  const [v2Projects,         setV2Projects]         = useState<V2Summary[]>([])
  const [selectedProject,    setSelectedProject]    = useState<string>("")
  const [v2Loading,          setV2Loading]          = useState(false)
  const [iframeLoaded,       setIframeLoaded]       = useState(false)
  const [hmrWaiting,         setHmrWaiting]         = useState(false)
  const [hmrCountdown,       setHmrCountdown]       = useState(0)
  const [diagnostics,        setDiagnostics]        = useState<Record<string, unknown>>({})

  const wcRef         = useRef<WCType | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const devProcRef    = useRef<any>(null)
  const startRef      = useRef(0)
  const stageStartRef = useRef<Record<string, number>>({})
  const termRef       = useRef<HTMLDivElement>(null)
  const iframeRef     = useRef<HTMLIFrameElement>(null)
  const abortRef      = useRef(false)
  const countdownRef  = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Environment diagnostics ──────────────────────────────────────────────────
  useEffect(() => {
    const sab = (() => { try { return typeof SharedArrayBuffer !== "undefined" } catch { return false } })()
    setDiagnostics({
      crossOriginIsolated: typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : "unavailable",
      sharedArrayBuffer:   sab,
      serviceWorker:       "navigator" in globalThis ? "supported" : "unsupported",
      userAgent:           navigator.userAgent.slice(0, 60),
    })
  }, [])

  // ── Fetch V2 project list ────────────────────────────────────────────────────
  useEffect(() => {
    if (scenario !== "v2") return
    setV2Loading(true)
    fetch("/api/website-v2/projects", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { projects?: V2Summary[] }) => {
        const projects = (d.projects ?? []).filter((p) => p.status === "ready")
        setV2Projects(projects)
        if (projects.length > 0 && !selectedProject) setSelectedProject(projects[0].id)
      })
      .catch(() => {})
      .finally(() => setV2Loading(false))
  }, [scenario, selectedProject])

  // ── Stage helpers ─────────────────────────────────────────────────────────────
  const elapsed = () => Date.now() - startRef.current

  const markRunning = useCallback((id: StageId) => {
    stageStartRef.current[id] = Date.now()
    setStages((s) => ({ ...s, [id]: { status: "running" } }))
  }, [])

  const markPass = useCallback((id: StageId, note?: string) => {
    const dur = stageStartRef.current[id] ? Date.now() - stageStartRef.current[id] : 0
    setStages((s) => ({ ...s, [id]: { status: "pass", durationMs: dur, note } }))
  }, [])

  const markFail = useCallback((id: StageId, note: string) => {
    const dur = stageStartRef.current[id] ? Date.now() - stageStartRef.current[id] : 0
    setStages((s) => ({ ...s, [id]: { status: "fail", durationMs: dur, note } }))
    setIssues((prev) => [...prev, `[${id}] ${note}`])
  }, [])

  const markWarn = useCallback((id: StageId, note: string) => {
    const dur = stageStartRef.current[id] ? Date.now() - stageStartRef.current[id] : 0
    setStages((s) => ({ ...s, [id]: { status: "warn", durationMs: dur, note } }))
  }, [])

  const appendTerm = useCallback((text: string) => {
    setTerminal((p) => p + text)
    requestAnimationFrame(() => {
      if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight
    })
  }, [])

  // ── Main test runner ─────────────────────────────────────────────────────────
  const runTest = useCallback(async (fileTree: FileSystemTree) => {
    abortRef.current = false
    setIsRunning(true)
    setStages(INIT_STAGES)
    setTerminal("")
    setIframeUrl(null)
    setIssues([])
    setIframeLoaded(false)
    setHmrWaiting(false)
    startRef.current = Date.now()

    const { WebContainer } = await import("@webcontainer/api")

    try {
      // ── Stage 1: Environment ────────────────────────────────────────────────
      markRunning("env")
      const isolated = typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : false
      const hasSab   = (() => { try { return typeof SharedArrayBuffer !== "undefined" } catch { return false } })()

      if (!isolated || !hasSab) {
        markFail("env", `crossOriginIsolated=${isolated} SharedArrayBuffer=${hasSab} — headers may be missing`)
        // Don't abort — attempt boot anyway to capture the exact failure
        markWarn("env", `crossOriginIsolated=${isolated} SharedArrayBuffer=${hasSab}`)
      } else {
        markPass("env", `crossOriginIsolated=true SharedArrayBuffer=true`)
      }
      if (abortRef.current) return

      // ── Stage 2: WebContainer.boot() ────────────────────────────────────────
      markRunning("boot")
      let wc: WCType
      try {
        if (wcRef.current) {
          wc = wcRef.current
          markPass("boot", "Reusing existing instance (page not refreshed)")
        } else {
          wc = await WebContainer.boot()
          wcRef.current = wc
          markPass("boot", `Boot OK in ${elapsed()}ms from test start`)
        }
      } catch (err: unknown) {
        markFail("boot", err instanceof Error ? err.message : String(err))
        return
      }
      if (abortRef.current) return

      // ── Stage 3: Service Worker ─────────────────────────────────────────────
      markRunning("sw")
      await new Promise((r) => setTimeout(r, 300)) // SW registers async post-boot
      try {
        const regs = await navigator.serviceWorker?.getRegistrations() ?? []
        if (regs.length > 0) {
          markPass("sw", `Scope: ${regs[0]?.scope ?? "unknown"}`)
        } else {
          markFail("sw", "No Service Worker registered — WebContainer URL proxy may not work")
        }
      } catch (err: unknown) {
        markFail("sw", err instanceof Error ? err.message : "SW check failed")
      }
      if (abortRef.current) return

      // ── Stage 4: Virtual FS mount ────────────────────────────────────────────
      markRunning("mount")
      try {
        await wc.mount(fileTree)
        const fileCount = countFiles(fileTree)
        markPass("mount", `${fileCount} files mounted`)
        appendTerm(`Mounted ${fileCount} files to virtual filesystem\n`)
      } catch (err: unknown) {
        markFail("mount", err instanceof Error ? err.message : "Mount failed")
        return
      }
      if (abortRef.current) return

      // ── Stage 5: npm install ─────────────────────────────────────────────────
      markRunning("install")
      appendTerm("\n$ npm install\n")
      try {
        const proc = await wc.spawn("npm", ["install"])
        proc.output.pipeTo(new WritableStream({ write: appendTerm }))
        const code = await proc.exit
        if (code !== 0) {
          markFail("install", `Exit code ${code}`)
          return
        }
        markPass("install")
      } catch (err: unknown) {
        markFail("install", err instanceof Error ? err.message : "install failed")
        return
      }
      if (abortRef.current) return

      // ── Stage 6: next dev spawn ──────────────────────────────────────────────
      markRunning("dev")
      appendTerm("\n$ npm run dev\n")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let devProc: any
      try {
        devProc = await wc.spawn("npm", ["run", "dev"])
        devProcRef.current = devProc
        devProc.output.pipeTo(new WritableStream({ write: appendTerm }))
        markPass("dev", "Process spawned")
      } catch (err: unknown) {
        markFail("dev", err instanceof Error ? err.message : "spawn failed")
        return
      }
      if (abortRef.current) return

      // ── Stage 7: server-ready ────────────────────────────────────────────────
      markRunning("ready")
      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(
            () => reject(new Error("server-ready timeout after 3 minutes")),
            180_000
          )
          wc.on("server-ready", (port, url) => {
            clearTimeout(timeout)
            setIframeUrl(url)
            markPass("ready", `Port ${port} → ${url}`)
            resolve()
          })
          wc.on("error", ({ message }) => {
            clearTimeout(timeout)
            reject(new Error(message))
          })
        })
      } catch (err: unknown) {
        markFail("ready", err instanceof Error ? err.message : "server-ready failed")
        return
      }
      if (abortRef.current) return

      // ── Stage 8: iframe render ───────────────────────────────────────────────
      markRunning("iframe")
      // iframeRef.current onLoad sets iframeLoaded; we wait up to 15s
      await new Promise<void>((resolve) => {
        const deadline = setTimeout(() => {
          markWarn("iframe", "onLoad timeout — iframe may still render asynchronously")
          resolve()
        }, 15_000)
        const interval = setInterval(() => {
          if (iframeRef.current?.contentDocument?.readyState === "complete" ||
              iframeRef.current?.contentDocument?.body?.innerHTML) {
            clearTimeout(deadline)
            clearInterval(interval)
            markPass("iframe", "Document loaded in preview iframe")
            resolve()
          }
        }, 500)
      })
      if (abortRef.current) return

      // ── Stage 9: fs.writeFile() ──────────────────────────────────────────────
      markRunning("write")
      try {
        const writePath = (scenario === "minimal") ? "pages/index.jsx" : "pages/index.jsx"
        await wc.fs.writeFile(writePath, HMR_CONTENT)
        markPass("write", `Written ${HMR_CONTENT.length} bytes to ${writePath}`)
        appendTerm(`\n[test] fs.writeFile("${writePath}") — ${HMR_CONTENT.length} bytes\n`)
      } catch (err: unknown) {
        // V2 projects use app/ router — try app/page.tsx
        try {
          await wc.fs.writeFile("app/page.tsx", HMR_CONTENT)
          markPass("write", `Written to app/page.tsx (App Router)`)
        } catch (err2: unknown) {
          markFail("write", err instanceof Error ? err.message : "writeFile failed")
        }
      }
      if (abortRef.current) return

      // ── Stage 10: HMR propagation ────────────────────────────────────────────
      markRunning("hmr")
      setHmrWaiting(true)
      let countdown = 15
      setHmrCountdown(countdown)
      await new Promise<void>((resolve) => {
        countdownRef.current = setInterval(() => {
          countdown--
          setHmrCountdown(countdown)
          if (countdown <= 0) {
            clearInterval(countdownRef.current!)
            resolve()
          }
        }, 1000)
      })
      setHmrWaiting(false)
      markWarn(
        "hmr",
        "15s elapsed — verify iframe shows green background. Click Confirm if HMR worked."
      )

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setIssues((p) => [...p, `Fatal: ${msg}`])
    } finally {
      setIsRunning(false)
    }
  }, [markRunning, markPass, markFail, markWarn, appendTerm, scenario])

  // ── Scenario launchers ────────────────────────────────────────────────────────
  const runMinimal = useCallback(async () => {
    await runTest(MINIMAL_FILES)
  }, [runTest])

  const runV2 = useCallback(async () => {
    if (!selectedProject) return
    setV2Loading(true)
    try {
      const r = await fetch(`/api/website-v2/projects/${selectedProject}`, { credentials: "include" })
      const data = await r.json() as { files?: V2File[] }
      const files = data.files ?? []
      if (files.length === 0) {
        setIssues(["V2 project has no files — generate a project first"])
        return
      }
      let tree = buildFileTree(files)
      tree = ensureV2Defaults(tree, files)
      await runTest(tree)
    } catch (err: unknown) {
      setIssues([`Failed to load V2 project: ${err instanceof Error ? err.message : String(err)}`])
    } finally {
      setV2Loading(false)
    }
  }, [selectedProject, runTest])

  const confirmHmr = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setHmrWaiting(false)
    setHmrCountdown(0)
    markPass("hmr", "Manually confirmed — iframe shows updated content")
    setIsRunning(false)
  }, [markPass])

  const denyHmr = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    setHmrWaiting(false)
    setHmrCountdown(0)
    markFail("hmr", "Manually confirmed — iframe did NOT update (HMR not working)")
    setIsRunning(false)
  }, [markFail])

  const reset = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current)
    abortRef.current = true
    devProcRef.current?.kill()
    devProcRef.current = null
    setStages(INIT_STAGES)
    setTerminal("")
    setIframeUrl(null)
    setIssues([])
    setIsRunning(false)
    setIframeLoaded(false)
    setHmrWaiting(false)
  }, [])

  // ── Derived metrics ───────────────────────────────────────────────────────────
  const totalMs = stages.ready.status === "pass" ? (stages.ready.durationMs ?? null) : null
  const passCount   = STAGE_DEFS.filter((s) => stages[s.id].status === "pass").length
  const failCount   = STAGE_DEFS.filter((s) => stages[s.id].status === "fail").length
  const warnCount   = STAGE_DEFS.filter((s) => stages[s.id].status === "warn").length
  const anyFailed   = failCount > 0
  const allComplete = STAGE_DEFS.every((s) =>
    ["pass","fail","warn","skipped"].includes(stages[s.id].status)
  )

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen flex-col bg-[#07070f] text-white overflow-hidden">
      {/* ─── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-white/8 bg-black/50 px-5 py-3">
        <div>
          <h1 className="text-sm font-bold tracking-tight">
            WebContainer Runtime Diagnostics
          </h1>
          <p className="text-[10px] text-white/30 mt-0.5">
            Feasibility validator · isolated from Website Studio · 10-stage suite
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Score */}
          {(passCount + failCount + warnCount) > 0 && (
            <div className="flex items-center gap-1.5 font-mono text-xs">
              <span className="text-emerald-400">{passCount}✓</span>
              {warnCount > 0 && <span className="text-amber-400">{warnCount}△</span>}
              {failCount > 0 && <span className="text-red-400">{failCount}✗</span>}
            </div>
          )}

          {/* Environment quick-check */}
          <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-1.5">
            <DiagPill label="COI" ok={diagnostics.crossOriginIsolated === true} />
            <DiagPill label="SAB" ok={diagnostics.sharedArrayBuffer === true} />
          </div>

          {totalMs !== null && (
            <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-mono text-emerald-400">
              Server ready: {(totalMs / 1000).toFixed(1)}s
            </span>
          )}

          {hmrWaiting && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-400">HMR: check iframe… {hmrCountdown}s</span>
              <button onClick={confirmHmr} className="rounded bg-emerald-400/20 px-2 py-0.5 text-xs text-emerald-400 hover:bg-emerald-400/30">
                ✓ HMR worked
              </button>
              <button onClick={denyHmr} className="rounded bg-red-400/20 px-2 py-0.5 text-xs text-red-400 hover:bg-red-400/30">
                ✗ No update
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ─── Main grid ───────────────────────────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[268px_1fr_1fr] overflow-hidden">

        {/* ── Left: stages + controls ──────────────────────────────────────── */}
        <div className="flex flex-col border-r border-white/8 overflow-hidden">

          {/* Scenario selector + controls */}
          <div className="border-b border-white/8 p-4 space-y-3 flex-shrink-0">
            <div className="flex rounded-lg border border-white/8 overflow-hidden">
              {(["minimal","v2"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setScenario(s)}
                  className={`flex-1 py-1.5 text-xs font-semibold transition-colors ${
                    scenario === s
                      ? "bg-amber-400/20 text-amber-400"
                      : "text-white/30 hover:text-white/60"
                  }`}
                >
                  {s === "minimal" ? "Minimal Next.js" : "V2 from DB"}
                </button>
              ))}
            </div>

            {scenario === "v2" && (
              <div>
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  disabled={v2Loading || isRunning}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1.5 text-xs text-white/70 outline-none disabled:opacity-40"
                >
                  {v2Loading && <option>Loading projects…</option>}
                  {!v2Loading && v2Projects.length === 0 && <option>No ready projects</option>}
                  {v2Projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.projectName}</option>
                  ))}
                </select>
                {v2Projects.length === 0 && !v2Loading && (
                  <p className="mt-1 text-[10px] text-amber-400/70">
                    Generate a V2 project first via Website Studio
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <button
                onClick={scenario === "minimal" ? runMinimal : runV2}
                disabled={isRunning || (scenario === "v2" && !selectedProject)}
                className="w-full rounded-lg bg-amber-400/15 py-2 text-sm font-bold text-amber-400 transition-all hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isRunning ? "Running…" : `▶ Run ${scenario === "minimal" ? "Minimal" : "V2 Project"} Test`}
              </button>
              <button
                onClick={reset}
                disabled={!allComplete && !anyFailed && !isRunning}
                className="w-full rounded-lg bg-white/5 py-1.5 text-xs text-white/35 transition-all hover:bg-white/10 disabled:opacity-20"
              >
                ↺ Reset
              </button>
            </div>

            <div className="text-[10px] text-white/20 space-y-0.5">
              <p>⚠ npm install may take 1–5 min</p>
              <p>⚠ Refresh page between full test runs</p>
            </div>
          </div>

          {/* Stage list */}
          <div className="flex-1 overflow-y-auto py-2">
            {STAGE_DEFS.map((def, i) => (
              <StageRow key={def.id} n={i + 1} def={def} result={stages[def.id]} />
            ))}
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div className="border-t border-red-400/20 bg-red-950/20 flex-shrink-0 p-3 max-h-36 overflow-y-auto">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-widest text-red-400/50">
                Issues ({issues.length})
              </p>
              {issues.map((iss, i) => (
                <p key={i} className="text-[10px] text-red-300/70 leading-snug mb-1">{i+1}. {iss}</p>
              ))}
            </div>
          )}
        </div>

        {/* ── Center: terminal + metrics ─────────────────────────────────────── */}
        <div className="flex flex-col border-r border-white/8 overflow-hidden">

          {/* Terminal */}
          <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-white/5 bg-black/40 px-4 py-2 flex-shrink-0">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <span className="ml-1 text-[10px] text-white/25">
                Terminal output — npm install + next dev
              </span>
            </div>
            <div
              ref={termRef}
              className="flex-1 overflow-y-auto p-3 font-mono text-[10px] text-green-300/80 whitespace-pre-wrap leading-relaxed bg-black/60"
            >
              {terminal || <span className="text-white/15">No output yet — start a test to see live stream</span>}
            </div>
          </div>

          {/* Metrics table */}
          <div className="border-t border-white/8 bg-black/30 flex-shrink-0">
            <p className="px-4 pt-3 pb-1 text-[9px] font-bold uppercase tracking-widest text-white/20">
              Performance Metrics
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="px-4 py-1.5 text-left font-normal text-white/25">Stage</th>
                    <th className="px-3 py-1.5 text-right font-normal text-white/25">Duration</th>
                    <th className="px-4 py-1.5 text-right font-normal text-white/25">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {STAGE_DEFS.map((def) => {
                    const r = stages[def.id]
                    return (
                      <tr key={def.id} className="border-b border-white/[0.03]">
                        <td className="px-4 py-1 text-white/50">{def.label}</td>
                        <td className="px-3 py-1 text-right font-mono text-white/40">
                          {r.durationMs !== undefined ? fmtMs(r.durationMs) : "—"}
                        </td>
                        <td className="px-4 py-1 text-right">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Environment quick diagnostics */}
            <div className="flex gap-4 flex-wrap px-4 py-3 border-t border-white/5">
              {Object.entries(diagnostics).map(([k, v]) => (
                <span key={k} className="text-[9px]">
                  <span className="text-white/25">{k}: </span>
                  <span className={
                    v === true ? "text-emerald-400" :
                    v === false ? "text-red-400" :
                    "text-white/50"
                  }>
                    {String(v).slice(0, 30)}
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: preview iframe ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-black/50">
          {!iframeUrl && (
            <div className="absolute inset-0 flex items-center justify-center">
              {!isRunning && (
                <p className="text-sm text-white/15">
                  Preview appears here after server-ready
                </p>
              )}
              {isRunning && stages.install.status === "running" && (
                <Spinner label="npm install running…" sub="1–5 min for Next.js dependencies" amber />
              )}
              {isRunning && (stages.dev.status === "running" || stages.ready.status === "running") && (
                <Spinner label="next dev starting…" sub="Waiting for server-ready event" amber />
              )}
              {isRunning && (stages.boot.status === "running" || stages.sw.status === "running" || stages.mount.status === "running") && (
                <Spinner label="Booting WebContainer…" />
              )}
            </div>
          )}

          {iframeUrl && (
            <>
              <iframe
                ref={iframeRef}
                src={iframeUrl}
                onLoad={() => setIframeLoaded(true)}
                className="absolute inset-0 h-full w-full border-0"
                title="WebContainer Preview"
                allow="cross-origin-isolated"
              />
              <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between border-t border-white/10 bg-black/80 px-3 py-1.5 backdrop-blur-sm">
                <span className="font-mono text-[10px] text-white/30 truncate">{iframeUrl}</span>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  {iframeLoaded && <span className="text-[10px] text-emerald-400">Loaded</span>}
                  {stages.hmr.status === "pass" && <span className="text-[10px] text-emerald-400">HMR ✓</span>}
                  {hmrWaiting && <span className="text-[10px] text-amber-400 animate-pulse">HMR test…</span>}
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function StageRow({ n, def, result }: {
  n: number
  def: typeof STAGE_DEFS[number]
  result: StageResult
}) {
  const { status, durationMs, note } = result

  const icon =
    status === "pass"    ? "✓" :
    status === "fail"    ? "✗" :
    status === "warn"    ? "△" :
    status === "running" ? "⟳" :
    status === "skipped" ? "–" :
    "○"

  const iconColor =
    status === "pass"    ? "text-emerald-400" :
    status === "fail"    ? "text-red-400"     :
    status === "warn"    ? "text-amber-400"   :
    status === "running" ? "text-blue-400"    :
    "text-white/20"

  const textColor =
    status === "running" ? "text-white/80" :
    status === "pass"    ? "text-white/60" :
    status === "fail"    ? "text-red-300/80" :
    "text-white/30"

  return (
    <div className={`flex items-start gap-2.5 px-4 py-1.5 transition-colors ${
      status === "running" ? "bg-blue-400/5" :
      status === "fail"    ? "bg-red-400/5"  : ""
    }`}>
      <span className={`flex-shrink-0 w-3.5 text-center text-xs font-mono mt-0.5 ${iconColor} ${
        status === "running" ? "animate-spin" : ""
      }`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[11px] font-medium truncate ${textColor}`}>
            <span className="text-white/20 mr-1">{n}.</span>{def.label}
          </span>
          {durationMs !== undefined && (
            <span className="flex-shrink-0 font-mono text-[9px] text-white/25">
              {fmtMs(durationMs)}
            </span>
          )}
        </div>
        {status === "pending" && (
          <p className="text-[9px] text-white/15 leading-tight truncate">{def.detail}</p>
        )}
        {note && (
          <p className={`text-[9px] leading-tight break-words ${
            status === "fail" ? "text-red-400/70" :
            status === "warn" ? "text-amber-400/70" :
            "text-white/30"
          }`}>{note}</p>
        )}
      </div>
    </div>
  )
}

function DiagPill({ label, ok }: { label: string; ok: boolean | null }) {
  return (
    <div className={`flex items-center gap-1 text-[9px] font-mono ${ok ? "text-emerald-400" : "text-red-400"}`}>
      <span>{ok ? "✓" : "✗"}</span>
      <span>{label}</span>
    </div>
  )
}

function StatusBadge({ status }: { status: StageResult["status"] }) {
  const cls =
    status === "pass"    ? "text-emerald-400" :
    status === "fail"    ? "text-red-400"     :
    status === "warn"    ? "text-amber-400"   :
    status === "running" ? "text-blue-400"    :
    "text-white/20"
  const label =
    status === "pass" ? "pass" : status === "fail" ? "fail" :
    status === "warn" ? "warn" : status === "running" ? "running" :
    status === "skipped" ? "skip" : "—"
  return <span className={`font-mono ${cls}`}>{label}</span>
}

function Spinner({ label, sub, amber }: { label: string; sub?: string; amber?: boolean }) {
  return (
    <div className="text-center">
      <div className={`mx-auto mb-3 h-7 w-7 animate-spin rounded-full border-2 border-transparent ${
        amber ? "border-t-amber-400" : "border-t-blue-400"
      }`} />
      <p className={`text-sm font-medium ${amber ? "text-amber-400" : "text-blue-400"}`}>{label}</p>
      {sub && <p className="mt-1 text-xs text-white/25">{sub}</p>}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60_000).toFixed(1)}m`
}

function countFiles(tree: FileSystemTree, depth = 0): number {
  if (depth > 10) return 0
  let count = 0
  for (const [, node] of Object.entries(tree)) {
    if ("file" in node) count++
    else if ("directory" in node) count += countFiles(node.directory as FileSystemTree, depth + 1)
  }
  return count
}
