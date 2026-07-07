// ─── WebContainer Feasibility Test ────────────────────────────────────────────
// Standalone test page — completely isolated from Website Studio and V2 pipeline.
// Goal: determine whether WebContainer is a viable real-execution runtime for
// STAGEONE before committing to a full integration.
//
// Tests:
//  1. COOP/COEP header detection (SharedArrayBuffer availability)
//  2. WebContainer boot time
//  3. Minimal Next.js 14 project mount + npm install
//  4. next dev startup + server-ready capture
//  5. iframe render of running app
//  6. HMR verification (file write → live update)
//  7. Issue documentation

import { useState, useRef, useCallback, useEffect } from "react"
import type { WebContainer as WCType } from "@webcontainer/api"

// ─── Minimal Next.js project to mount ─────────────────────────────────────────
// Pages Router (simpler than App Router for boot testing).
// All inline to avoid any filesystem dependency.
const TEST_FILES = {
  "package.json": {
    file: {
      contents: JSON.stringify(
        {
          name: "wc-nextjs-test",
          version: "0.0.1",
          private: true,
          scripts: { dev: "next dev -p 3000" },
          dependencies: {
            next: "14.2.5",
            react: "18.3.1",
            "react-dom": "18.3.1",
          },
        },
        null,
        2
      ),
    },
  },
  "next.config.js": {
    file: {
      contents: `/** @type {import('next').NextConfig} */
const nextConfig = { reactStrictMode: true }
module.exports = nextConfig`,
    },
  },
  pages: { directory: {} },
  "pages/index.jsx": {
    file: {
      contents: `import { useState } from 'react'

export default function Home() {
  const [count, setCount] = useState(0)
  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🚀</div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        WebContainer + Next.js 14
      </h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>
        Running real Node.js inside the browser
      </p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 600,
          background: '#6366f1',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
      >
        Clicked {count} time{count !== 1 ? 's' : ''}
      </button>
      <p style={{ color: '#475569', fontSize: '0.75rem' }}>
        v1 — original file
      </p>
    </div>
  )
}`,
    },
  },
  "pages/_app.jsx": {
    file: {
      contents: `export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
}`,
    },
  },
}

const HMR_PAGE_CONTENT = `import { useState } from 'react'

export default function Home() {
  const [count, setCount] = useState(0)
  return (
    <div style={{
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '2rem',
      textAlign: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #064e3b 100%)',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>✅</div>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
        HMR Verified!
      </h1>
      <p style={{ color: '#6ee7b7', marginBottom: '1.5rem' }}>
        File was updated — HMR detected the change
      </p>
      <button
        onClick={() => setCount(c => c + 1)}
        style={{
          padding: '0.75rem 1.5rem',
          fontSize: '1rem',
          fontWeight: 600,
          background: '#10b981',
          color: 'white',
          border: 'none',
          borderRadius: '0.5rem',
          cursor: 'pointer',
          marginBottom: '1rem',
        }}
      >
        Still reactive: {count}
      </button>
      <p style={{ color: '#475569', fontSize: '0.75rem' }}>
        v2 — HMR-updated file
      </p>
    </div>
  )
}`

// ─── Types ─────────────────────────────────────────────────────────────────────
interface LogEntry {
  ms: number
  type: "info" | "success" | "error" | "warn" | "terminal"
  text: string
}

interface Diagnostics {
  sharedArrayBuffer:    boolean | null
  crossOriginIsolated:  boolean | null
  serviceWorkerScope:   string | null
  coopHeader:          string | null
  coepHeader:          string | null
  userAgent:           string
  webContainerVersion: string
}

type Phase =
  | "idle"
  | "booting"
  | "mounting"
  | "installing"
  | "starting"
  | "ready"
  | "error"
  | "hmr-testing"
  | "hmr-done"

// ─── Component ─────────────────────────────────────────────────────────────────
export default function WebContainerTestPage() {
  const [phase, setPhase]         = useState<Phase>("idle")
  const [logs, setLogs]           = useState<LogEntry[]>([])
  const [terminal, setTerminal]   = useState<string>("")
  const [iframeUrl, setIframeUrl] = useState<string | null>(null)
  const [bootMs, setBootMs]       = useState<number | null>(null)
  const [hmrMs, setHmrMs]         = useState<number | null>(null)
  const [issues, setIssues]       = useState<string[]>([])
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null)

  const wcRef       = useRef<WCType | null>(null)
  const bootingRef  = useRef(false)
  const startRef    = useRef<number>(0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const logRef      = useRef<HTMLDivElement>(null)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const log = useCallback((text: string, type: LogEntry["type"] = "info") => {
    setLogs((prev) => [...prev, { ms: Date.now() - startRef.current, type, text }])
  }, [])

  const addIssue = useCallback((issue: string) => {
    setIssues((prev) => [...prev, issue])
    log(`⚠ ISSUE: ${issue}`, "warn")
  }, [log])

  const appendTerminal = useCallback((text: string) => {
    setTerminal((prev) => prev + text)
    // Auto-scroll terminal
    requestAnimationFrame(() => {
      if (terminalRef.current) {
        terminalRef.current.scrollTop = terminalRef.current.scrollHeight
      }
    })
  }, [])

  // ── Run diagnostics on mount ──────────────────────────────────────────────────
  useEffect(() => {
    const sab = (() => {
      try { return typeof SharedArrayBuffer !== "undefined" && new SharedArrayBuffer(1) instanceof SharedArrayBuffer }
      catch { return false }
    })()

    const d: Diagnostics = {
      sharedArrayBuffer:    sab,
      crossOriginIsolated:  typeof crossOriginIsolated !== "undefined" ? crossOriginIsolated : null,
      serviceWorkerScope:   null,
      coopHeader:          null,
      coepHeader:          null,
      userAgent:           navigator.userAgent.slice(0, 80),
      webContainerVersion: "1.6.4",
    }

    // Try to detect SW registration
    navigator.serviceWorker?.getRegistrations?.().then((regs) => {
      if (regs.length > 0) {
        d.serviceWorkerScope = regs.map((r) => r.scope).join(", ")
        setDiagnostics({ ...d })
      }
    }).catch(() => {})

    setDiagnostics(d)
  }, [])

  // ── Auto-scroll logs ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  // ── Main test runner ─────────────────────────────────────────────────────────
  const runTest = useCallback(async () => {
    if (bootingRef.current || wcRef.current) return
    bootingRef.current = true
    startRef.current = Date.now()

    const { WebContainer } = await import("@webcontainer/api")

    setLogs([])
    setTerminal("")
    setIframeUrl(null)
    setBootMs(null)
    setHmrMs(null)
    setIssues([])
    setPhase("booting")

    try {
      // ── Phase 1: Boot ──────────────────────────────────────────────────────
      log("Booting WebContainer…")

      if (!crossOriginIsolated) {
        addIssue(
          "crossOriginIsolated is false — SharedArrayBuffer unavailable. " +
          "WebContainer requires COOP: same-origin + COEP: require-corp headers. " +
          "In Replit, these headers may be suppressed by the mTLS proxy."
        )
      }

      const wc = await WebContainer.boot()
      wcRef.current = wc
      const bootMs_ = Date.now() - startRef.current
      log(`WebContainer booted (${bootMs_}ms)`, "success")

      // Register service worker scope if available
      const swRegs = await navigator.serviceWorker?.getRegistrations?.() ?? []
      if (swRegs.length > 0) {
        log(`Service Worker registered: ${swRegs[0]?.scope}`, "info")
        setDiagnostics((d) => d ? { ...d, serviceWorkerScope: swRegs[0]?.scope ?? null } : d)
      } else {
        addIssue("No Service Worker found after WebContainer.boot() — container may not function correctly")
      }

      // ── Phase 2: Mount files ───────────────────────────────────────────────
      setPhase("mounting")
      log(`Mounting ${Object.keys(TEST_FILES).length} files…`)
      await wc.mount(TEST_FILES as Parameters<typeof wc.mount>[0])
      log("Files mounted", "success")

      // ── Phase 3: npm install ───────────────────────────────────────────────
      setPhase("installing")
      const installStart = Date.now()
      log("Running npm install (Next.js 14 — this takes 1–5 min)…")
      appendTerminal("$ npm install\n")

      const installProc = await wc.spawn("npm", ["install"])

      installProc.output.pipeTo(
        new WritableStream({
          write(chunk) { appendTerminal(chunk) },
        })
      )

      const installCode = await installProc.exit
      const installMs = Date.now() - installStart

      if (installCode !== 0) {
        addIssue(`npm install exited with code ${installCode}`)
        setPhase("error")
        log(`npm install failed (code ${installCode}) after ${installMs}ms`, "error")
        return
      }
      log(`npm install completed in ${(installMs / 1000).toFixed(1)}s`, "success")

      // ── Phase 4: next dev ──────────────────────────────────────────────────
      setPhase("starting")
      const devStart = Date.now()
      log("Starting next dev…")
      appendTerminal("\n$ npm run dev\n")

      const devProc = await wc.spawn("npm", ["run", "dev"])

      devProc.output.pipeTo(
        new WritableStream({
          write(chunk) { appendTerminal(chunk) },
        })
      )

      // ── Phase 5: server-ready event ────────────────────────────────────────
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("server-ready timeout after 3 minutes"))
        }, 180_000)

        wc.on("server-ready", (port, url) => {
          clearTimeout(timeout)
          const totalMs = Date.now() - startRef.current
          setBootMs(totalMs)
          setIframeUrl(url)
          setPhase("ready")
          log(`Server ready on port ${port} → ${url}`, "success")
          log(`Total boot time: ${(totalMs / 1000).toFixed(1)}s`, "success")
          resolve()
        })

        wc.on("error", ({ message }) => {
          clearTimeout(timeout)
          reject(new Error(message))
        })
      })

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`FATAL: ${msg}`, "error")
      addIssue(msg)
      setPhase("error")
    } finally {
      bootingRef.current = false
    }
  }, [log, addIssue, appendTerminal])

  // ── HMR test ─────────────────────────────────────────────────────────────────
  const testHmr = useCallback(async () => {
    if (!wcRef.current || phase !== "ready") return
    setPhase("hmr-testing")
    const hmrStart = Date.now()
    log("HMR test: writing new content to pages/index.jsx…")

    try {
      await wcRef.current.fs.writeFile("pages/index.jsx", HMR_PAGE_CONTENT)
      log("File written — waiting for HMR update in iframe…")

      // We give HMR 10 seconds to propagate. The iframe should visually update.
      await new Promise((r) => setTimeout(r, 10_000))

      const elapsed = Date.now() - hmrStart
      setHmrMs(elapsed)
      setPhase("hmr-done")
      log(`HMR test complete after ${elapsed}ms — check iframe for green background`, "success")
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      addIssue(`HMR write failed: ${msg}`)
      log(`HMR write error: ${msg}`, "error")
      setPhase("ready")
    }
  }, [phase, log, addIssue])

  const reset = useCallback(() => {
    wcRef.current = null
    bootingRef.current = false
    setPhase("idle")
    setLogs([])
    setTerminal("")
    setIframeUrl(null)
    setBootMs(null)
    setHmrMs(null)
    setIssues([])
  }, [])

  // ─── Render ──────────────────────────────────────────────────────────────────
  const phaseColor: Record<Phase, string> = {
    idle:         "text-white/40",
    booting:      "text-blue-400",
    mounting:     "text-blue-400",
    installing:   "text-amber-400",
    starting:     "text-amber-400",
    ready:        "text-emerald-400",
    error:        "text-red-400",
    "hmr-testing":"text-purple-400",
    "hmr-done":   "text-emerald-400",
  }

  const phaseLabel: Record<Phase, string> = {
    idle:         "Not started",
    booting:      "Booting WebContainer…",
    mounting:     "Mounting files…",
    installing:   "npm install running…",
    starting:     "next dev starting…",
    ready:        "Ready",
    error:        "Error",
    "hmr-testing":"HMR test running…",
    "hmr-done":   "HMR verified",
  }

  return (
    <div className="min-h-screen bg-[#080810] text-white">
      {/* Header */}
      <div className="border-b border-white/8 bg-black/40 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">WebContainer Feasibility Test</h1>
            <p className="mt-0.5 text-xs text-white/40">
              Isolated from Website Studio — testing Next.js execution in-browser
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-sm font-mono ${phaseColor[phase]}`}>
              {phaseLabel[phase]}
            </span>
            {bootMs !== null && (
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-xs text-emerald-400">
                Boot: {(bootMs / 1000).toFixed(1)}s
              </span>
            )}
            {hmrMs !== null && (
              <span className="rounded-full bg-purple-400/10 px-2 py-0.5 text-xs text-purple-400">
                HMR: {(hmrMs / 1000).toFixed(1)}s
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid h-[calc(100vh-65px)] grid-cols-[360px_1fr] overflow-hidden">
        {/* Left panel */}
        <div className="flex flex-col gap-0 border-r border-white/8 overflow-hidden">

          {/* Diagnostics */}
          <div className="border-b border-white/8 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Environment Diagnostics
            </p>
            {diagnostics ? (
              <div className="space-y-1.5">
                <DiagRow
                  label="crossOriginIsolated"
                  value={diagnostics.crossOriginIsolated}
                  ok={diagnostics.crossOriginIsolated === true}
                  failNote="COOP/COEP headers missing"
                />
                <DiagRow
                  label="SharedArrayBuffer"
                  value={diagnostics.sharedArrayBuffer}
                  ok={diagnostics.sharedArrayBuffer === true}
                  failNote="Required for WebContainer WASM kernel"
                />
                <DiagRow
                  label="Service Worker"
                  value={diagnostics.serviceWorkerScope ?? (phase === "idle" ? "not checked yet" : "none registered")}
                  ok={diagnostics.serviceWorkerScope !== null}
                  failNote="Required for WebContainer URL proxy"
                />
                <div className="mt-2 rounded-lg bg-white/[0.03] p-2 text-[10px] text-white/30">
                  <span className="text-white/40">UA: </span>
                  {diagnostics.userAgent.slice(0, 60)}…
                </div>
              </div>
            ) : (
              <p className="text-xs text-white/30">Running diagnostics…</p>
            )}
          </div>

          {/* Controls */}
          <div className="border-b border-white/8 p-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Test Controls
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={runTest}
                disabled={phase !== "idle"}
                className="w-full rounded-lg bg-amber-400/15 py-2 text-sm font-semibold text-amber-400 transition-all hover:bg-amber-400/25 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {phase === "idle" ? "▶ Start Test" : "Running…"}
              </button>
              <button
                onClick={testHmr}
                disabled={phase !== "ready"}
                className="w-full rounded-lg bg-purple-400/10 py-2 text-sm font-semibold text-purple-400 transition-all hover:bg-purple-400/20 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Test HMR (modify file)
              </button>
              <button
                onClick={reset}
                disabled={phase === "idle" || phase === "booting" || phase === "installing" || phase === "starting"}
                className="w-full rounded-lg bg-white/5 py-1.5 text-xs text-white/40 transition-all hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-20"
              >
                Reset
              </button>
            </div>
          </div>

          {/* Boot log */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
            <p className="mb-2 flex-shrink-0 text-[10px] font-semibold uppercase tracking-widest text-white/30">
              Boot Log ({logs.length} entries)
            </p>
            <div ref={logRef} className="flex-1 overflow-y-auto space-y-1 font-mono text-[10px]">
              {logs.length === 0 && (
                <p className="text-white/20">Waiting for test to start…</p>
              )}
              {logs.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex-shrink-0 text-white/20">
                    +{(entry.ms / 1000).toFixed(2)}s
                  </span>
                  <span className={
                    entry.type === "success" ? "text-emerald-400" :
                    entry.type === "error"   ? "text-red-400"     :
                    entry.type === "warn"    ? "text-amber-400"   :
                    "text-white/60"
                  }>
                    {entry.text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Issues */}
          {issues.length > 0 && (
            <div className="border-t border-red-400/20 bg-red-950/20 p-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-red-400/60">
                Issues Detected ({issues.length})
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {issues.map((issue, i) => (
                  <p key={i} className="text-[10px] text-red-300/80 leading-relaxed">
                    {i + 1}. {issue}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right panel: terminal + iframe */}
        <div className="flex flex-col overflow-hidden">

          {/* Terminal output */}
          <div className="flex h-48 flex-shrink-0 flex-col border-b border-white/8 bg-black/60">
            <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-[10px] text-white/30">
                Terminal — npm install + next dev output
              </span>
            </div>
            <div
              ref={terminalRef}
              className="flex-1 overflow-y-auto p-3 font-mono text-[10px] text-green-300/80 whitespace-pre-wrap leading-relaxed"
            >
              {terminal || <span className="text-white/20">No output yet…</span>}
            </div>
          </div>

          {/* Preview iframe */}
          <div className="relative flex-1 overflow-hidden bg-black/40">
            <div className="absolute inset-0 flex items-center justify-center">
              {phase === "idle" && (
                <p className="text-sm text-white/20">Preview will appear here after server-ready</p>
              )}
              {(phase === "booting" || phase === "mounting") && (
                <BootSpinner label="Booting WebContainer…" />
              )}
              {phase === "installing" && (
                <BootSpinner label="npm install running… (1–5 min for Next.js)" sub="Check terminal for progress" amber />
              )}
              {phase === "starting" && (
                <BootSpinner label="next dev starting…" sub="Waiting for server-ready event" amber />
              )}
              {phase === "error" && (
                <div className="text-center">
                  <p className="text-red-400 text-sm font-semibold">Test failed</p>
                  <p className="text-white/30 text-xs mt-1">See boot log and issues for details</p>
                </div>
              )}
            </div>

            {iframeUrl && (
              <>
                <iframe
                  src={iframeUrl}
                  className="absolute inset-0 h-full w-full border-0"
                  title="WebContainer Preview"
                  allow="cross-origin-isolated"
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 backdrop-blur-sm">
                  <span className="font-mono text-[10px] text-white/40 truncate">
                    {iframeUrl}
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    {phase === "hmr-done" && (
                      <span className="text-[10px] text-emerald-400">HMR ✓</span>
                    )}
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    <span className="text-[10px] text-emerald-400">Live</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function DiagRow({
  label,
  value,
  ok,
  failNote,
}: {
  label: string
  value: boolean | string | null
  ok: boolean
  failNote?: string
}) {
  const display =
    typeof value === "boolean" ? (value ? "true" : "false") :
    value === null ? "null" :
    value

  return (
    <div className="flex items-start gap-2">
      <span className={`mt-0.5 flex-shrink-0 text-[10px] ${ok ? "text-emerald-400" : "text-red-400"}`}>
        {ok ? "✓" : "✗"}
      </span>
      <div className="min-w-0">
        <span className="text-[10px] text-white/50">{label}: </span>
        <span className={`font-mono text-[10px] ${ok ? "text-emerald-300" : "text-red-300"}`}>
          {display}
        </span>
        {!ok && failNote && (
          <p className="text-[9px] text-red-400/60 leading-snug mt-0.5">{failNote}</p>
        )}
      </div>
    </div>
  )
}

function BootSpinner({ label, sub, amber }: { label: string; sub?: string; amber?: boolean }) {
  return (
    <div className="text-center">
      <div className={`mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-transparent ${
        amber ? "border-t-amber-400" : "border-t-blue-400"
      }`} />
      <p className={`text-sm font-medium ${amber ? "text-amber-400" : "text-blue-400"}`}>{label}</p>
      {sub && <p className="mt-1 text-xs text-white/30">{sub}</p>}
    </div>
  )
}
