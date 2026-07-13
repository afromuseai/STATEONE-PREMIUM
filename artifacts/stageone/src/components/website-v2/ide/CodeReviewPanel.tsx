// ─── Phase P4 — AI Code Review Panel ─────────────────────────────────────────
// Marcus runs Security, Performance, Accessibility, and SEO checks.
// Triggered from command palette or TopCommandBar.

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Shield, Zap, Eye, Search, AlertTriangle, Info,
  CheckCircle, Loader2, RefreshCw,
} from "lucide-react"
import type { V2Project } from "@/hooks/useWebsiteV2Project"

// ─── Types ────────────────────────────────────────────────────────────────────
interface ReviewIssue {
  severity: "warning" | "info" | "error"
  category: "security" | "performance" | "accessibility" | "seo"
  message:  string
}

interface ReviewResult {
  performance:   number
  security:      number
  accessibility: number
  seo:           number
  issues:        ReviewIssue[]
  summary:       string
}

// ─── Score circle ──────────────────────────────────────────────────────────────
function ScoreCircle({ score, label, color, icon: Icon }: {
  score: number; label: string; color: string; icon: React.ElementType
}) {
  const r = 26
  const circumference = 2 * Math.PI * r
  const strokeDash = (score / 100) * circumference
  const letterGrade = score >= 95 ? "A+" : score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F"
  const textColor = score >= 80 ? color : score >= 60 ? "#f59e0b" : "#f87171"

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 64 64">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#ffffff08" strokeWidth="4" />
          <motion.circle
            cx="32" cy="32" r={r} fill="none"
            stroke={textColor} strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference - strokeDash }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
          />
        </svg>
        <div className="flex flex-col items-center">
          <Icon className="h-3 w-3 mb-0.5" style={{ color: textColor }} />
          <span className="font-bold text-[13px]" style={{ color: textColor }}>{letterGrade}</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-[11px] font-semibold text-[#ECECEC]/60">{label}</span>
        <span className="font-mono text-[10px] text-[#ECECEC]/25">{score}/100</span>
      </div>
    </div>
  )
}

// ─── Issue row ─────────────────────────────────────────────────────────────────
function IssueRow({ issue }: { issue: ReviewIssue }) {
  const severityConfig = {
    error:   { icon: AlertTriangle, color: "#f87171", bg: "#f8717110" },
    warning: { icon: AlertTriangle, color: "#fbbf24", bg: "#fbbf2410" },
    info:    { icon: Info,          color: "#60a5fa", bg: "#60a5fa10" },
  }
  const { icon: SevIcon, color, bg } = severityConfig[issue.severity]

  const categoryConfig = {
    security:      { icon: Shield,  label: "Security"      },
    performance:   { icon: Zap,     label: "Performance"   },
    accessibility: { icon: Eye,     label: "Accessibility" },
    seo:           { icon: Search,  label: "SEO"           },
  }
  const catMeta = categoryConfig[issue.category]
  const CatIcon = catMeta.icon

  return (
    <div className="flex items-start gap-3 rounded-lg px-3 py-2.5" style={{ background: bg }}>
      <SevIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color }} />
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-[#ECECEC]/65">{issue.message}</p>
        <div className="mt-1 flex items-center gap-1">
          <CatIcon className="h-3 w-3 text-[#ECECEC]/22" />
          <span className="text-[10px] text-[#ECECEC]/28">{catMeta.label}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────
interface CodeReviewPanelProps {
  project:  V2Project
  open:     boolean
  onClose:  () => void
}

export function CodeReviewPanel({ project, open, onClose }: CodeReviewPanelProps) {
  const [state,  setState]  = useState<"idle" | "loading" | "done" | "error">("idle")
  const [result, setResult] = useState<ReviewResult | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  useEffect(() => {
    if (open && state === "idle") void runReview()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const runReview = async () => {
    setState("loading")
    setError(null)

    try {
      // Sample a few key files for review (avoid sending entire project)
      const keyFiles = project.files
        .filter(f => /\.(tsx?|jsx?|css|html)$/.test(f.path))
        .slice(0, 8)
        .map(f => `/* ${f.path} */\n${f.content.slice(0, 600)}`)
        .join("\n\n---\n\n")

      const res = await fetch("/api/copilot/code-review", {
        method:      "POST",
        credentials: "include",
        headers:     { "Content-Type": "application/json" },
        body:        JSON.stringify({
          projectName: project.projectName,
          files: keyFiles,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as ReviewResult
      setResult(data)
      setState("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Review failed")
      setState("error")
    }
  }

  const retry = () => {
    setState("idle")
    setResult(null)
    setTimeout(() => void runReview(), 100)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-[#202020] backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-[151] w-full max-w-[500px] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] shadow-md shadow-black/80">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/12">
                  <Shield className="h-4 w-4 text-pink-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[14px] font-semibold text-[#ECECEC]">STAGEONE Review</h2>
                  <p className="text-[11px] text-[#ECECEC]/30">{project.projectName}</p>
                </div>
                <button onClick={onClose} className="text-[#ECECEC]/20 hover:text-[#ECECEC]/50 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-5">
                {state === "loading" && (
                  <div className="flex flex-col items-center gap-4 py-10">
                    <div className="relative">
                      <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
                      <div className="absolute inset-0 rounded-full bg-pink-400/8 animate-ping" />
                    </div>
                    <div className="text-center">
                      <p className="text-[13px] text-[#ECECEC]/60">Marcus is reviewing your project…</p>
                      <p className="mt-1 text-[11px] text-[#ECECEC]/25">Checking security, performance, accessibility, and SEO</p>
                    </div>
                  </div>
                )}

                {state === "error" && (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                    <div className="text-center">
                      <p className="text-[13px] text-[#ECECEC]/60">Review failed</p>
                      <p className="mt-1 text-[11px] text-[#ECECEC]/25">{error}</p>
                    </div>
                    <button
                      onClick={retry}
                      className="flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] px-4 py-2 text-[12px] text-[#ECECEC]/50 hover:border-[rgba(255,255,255,0.08)] hover:text-[#ECECEC] transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </button>
                  </div>
                )}

                {state === "done" && result && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                    {/* Scores */}
                    <div className="flex items-start justify-around pb-5">
                      <ScoreCircle score={result.performance}   label="Performance"   color="#34d399" icon={Zap}    />
                      <ScoreCircle score={result.security}      label="Security"      color="#60a5fa" icon={Shield} />
                      <ScoreCircle score={result.accessibility} label="Accessibility" color="#a78bfa" icon={Eye}    />
                      <ScoreCircle score={result.seo}           label="SEO"           color="#fbbf24" icon={Search} />
                    </div>

                    {/* Summary */}
                    {result.summary && (
                      <div className="mb-4 rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#252525] px-3 py-2.5">
                        <p className="text-[12px] leading-relaxed text-[#ECECEC]/45">{result.summary}</p>
                      </div>
                    )}

                    {/* Issues */}
                    {result.issues.length > 0 ? (
                      <div>
                        <div className="mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="h-3 w-3 text-[#ECECEC]/25" />
                          <span className="text-[11px] font-semibold text-[#ECECEC]/40">
                            {result.issues.length} issue{result.issues.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {result.issues.map((issue, i) => (
                            <IssueRow key={i} issue={issue} />
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-3 py-2.5">
                        <CheckCircle className="h-4 w-4 text-emerald-400" />
                        <span className="text-[12px] text-emerald-300/70">No issues detected</span>
                      </div>
                    )}

                    {/* Re-run */}
                    <button
                      onClick={retry}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-[rgba(255,255,255,0.08)] py-2.5 text-[12px] text-[#ECECEC]/35 hover:border-[rgba(255,255,255,0.08)] hover:text-[#ECECEC]/55 transition-colors"
                    >
                      <RefreshCw className="h-3.5 w-3.5" /> Re-run review
                    </button>
                  </motion.div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
