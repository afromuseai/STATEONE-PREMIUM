"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle, XCircle, AlertCircle, Loader, ExternalLink } from "lucide-react"
import type { RuntimeStatus, TerminalLine } from "@/components/website-v2/runtime/runtime-types"

// ─── Types ────────────────────────────────────────────────────────────────────
interface Check {
  label:  string
  status: "pass" | "fail" | "warn" | "pending"
}

interface RuntimeAgentObserverProps {
  status:          RuntimeStatus
  terminalLines:   TerminalLine[]
  wcUrl:           string | null
  /** Ref passed from TerminalPanel — scrolled into view when the card appears */
  scrollIntoView?: React.RefObject<HTMLDivElement | null>
}

// ─── Derive check results from terminal output ────────────────────────────────
function deriveChecks(lines: TerminalLine[], wcUrl: string | null): Check[] {
  const errorLines  = lines.filter((l) => l.type === "error")
  const successLines = lines.filter((l) => l.type === "success")

  // Build: failed if any error contains build/compile keywords, or if no
  // success line with "compiled" or "ready" was ever emitted
  const buildErrorLines = errorLines.filter((l) =>
    /build|compil|SyntaxError|Module not found|Cannot find module|Failed to compile/i.test(l.text),
  )
  const buildSuccessLines = successLines.filter((l) =>
    /compil|ready|✓|built/i.test(l.text),
  )
  const buildStatus: Check["status"] =
    buildErrorLines.length > 0 ? "fail" :
    buildSuccessLines.length > 0 || wcUrl ? "pass" : "warn"

  // Runtime: pass only if the dev server URL is live
  const runtimeStatus: Check["status"] = wcUrl ? "pass" : "fail"

  // Console errors: any error lines not directly attributable to build steps
  const consoleErrorLines = errorLines.filter(
    (l) => !/npm install|WARN|deprecated/i.test(l.text),
  )
  const consoleStatus: Check["status"] =
    consoleErrorLines.length > 0 ? "warn" : "pass"

  // Visual output: confirmed once wcUrl is set (the iframe can render)
  const visualStatus: Check["status"] = wcUrl ? "pass" : "pending"

  return [
    { label: "Build",          status: buildStatus   },
    { label: "Runtime",        status: runtimeStatus },
    { label: "Console errors", status: consoleStatus },
    { label: "Visual output",  status: visualStatus  },
  ]
}

// ─── Check icon ───────────────────────────────────────────────────────────────
function CheckIcon({ status }: { status: Check["status"] }): React.ReactElement {
  switch (status) {
    case "pass":    return <CheckCircle  className="h-3.5 w-3.5 flex-shrink-0 text-emerald-400" />
    case "fail":    return <XCircle      className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
    case "warn":    return <AlertCircle  className="h-3.5 w-3.5 flex-shrink-0 text-[#ECECEC]" />
    default:        return <Loader       className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-[#ECECEC]/30" />
  }
}

// ─── Check label color ────────────────────────────────────────────────────────
function checkColor(status: Check["status"]): string {
  switch (status) {
    case "pass":    return "text-emerald-400/80"
    case "fail":    return "text-red-400/80"
    case "warn":    return "text-[#ECECEC]"
    default:        return "text-[#ECECEC]/35"
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function RuntimeAgentObserver({
  status,
  terminalLines,
  wcUrl,
  scrollIntoView,
}: RuntimeAgentObserverProps) {
  const [visible, setVisible] = useState(false)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (status === "ready") {
      const t = setTimeout(() => {
        setVisible(true)
        // After the card animates in, scroll the anchor (and card) into view
        setTimeout(() => {
          scrollIntoView?.current?.scrollIntoView({ behavior: "smooth" })
        }, 350)
      }, 700)
      return () => clearTimeout(t)
    }
    setVisible(false)
    return undefined
  }, [status, scrollIntoView])

  const checks  = deriveChecks(terminalLines, wcUrl)
  const allPass = checks.every((c) => c.status === "pass")
  const hasFail = checks.some((c) => c.status === "fail")

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.28, ease: "easeOut" }}
          className="mx-3 mb-3 overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]"
        >
          {/* Header row */}
          <div className="flex items-center gap-2 border-b border-[rgba(255,255,255,0.08)] px-3 py-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#252525]">
              <span className="text-[9px] font-bold text-[#ECECEC]">M</span>
            </div>
            <span className="text-[11px] font-semibold text-[#ECECEC]/60">Marcus</span>
            <span className="ml-auto font-mono text-[10px] text-[#ECECEC]/20">Runtime Agent</span>
          </div>

          {/* Body */}
          <div className="px-3 py-2.5">
            {/* Summary line */}
            <p className="mb-3 text-[11px] leading-[1.55] text-[#ECECEC]/50">
              I launched the application.{" "}
              {hasFail
                ? "Some checks failed — review the terminal for details."
                : allPass
                  ? "Everything looks good."
                  : "A few warnings to review."}
            </p>

            {/* Checklist label */}
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-[#ECECEC]/20">
              Checking
            </p>

            {/* Checks */}
            <div className="space-y-1.5">
              {checks.map((check) => (
                <div key={check.label} className="flex items-center gap-2">
                  <CheckIcon status={check.status} />
                  <span className={`text-[11px] ${checkColor(check.status)}`}>
                    {check.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Live URL chip */}
            {wcUrl && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-emerald-400/[0.05] px-2.5 py-1.5">
                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400 shadow-none" />
                <span className="flex-1 truncate font-mono text-[10px] text-emerald-400/65">
                  {wcUrl}
                </span>
                <ExternalLink className="h-2.5 w-2.5 flex-shrink-0 text-[#ECECEC]/20" />
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
