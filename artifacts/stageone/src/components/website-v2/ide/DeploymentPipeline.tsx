// ─── Phase P5 — Deployment Pipeline ────────────────────────────────────────────
// Visual deployment pipeline: Code → Build → Test → Deploy → Live URL
// Provider selection: Vercel, Cloudflare, STAGEONE hosting

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  X, Upload, CheckCircle, Loader2, AlertCircle, ExternalLink,
  Code2, Hammer, FlaskConical, Rocket, Globe, ChevronRight,
  Zap, Cloud, Server,
} from "lucide-react"
import type { V2Project } from "@/hooks/useWebsiteV2Project"

// ─── Types ────────────────────────────────────────────────────────────────────
type StepStatus = "pending" | "running" | "done" | "error"
type Provider = "vercel" | "cloudflare" | "stageone"

interface PipelineStep {
  id:    string
  label: string
  icon:  React.ElementType
  ms:    number   // simulated duration
}

const STEPS: PipelineStep[] = [
  { id: "code",   label: "Preparing code",    icon: Code2,        ms: 1200 },
  { id: "build",  label: "Building project",  icon: Hammer,       ms: 3800 },
  { id: "test",   label: "Running checks",    icon: FlaskConical, ms: 2100 },
  { id: "deploy", label: "Deploying",         icon: Rocket,       ms: 2600 },
  { id: "live",   label: "Going live",        icon: Globe,        ms: 900  },
]

const PROVIDERS: { id: Provider; label: string; icon: React.ElementType; color: string; description: string }[] = [
  {
    id: "vercel", label: "Vercel", icon: Zap, color: "#ffffff",
    description: "Edge network, automatic HTTPS, instant rollbacks",
  },
  {
    id: "cloudflare", label: "Cloudflare Pages", icon: Cloud, color: "#f6821f",
    description: "Global CDN, 0ms cold starts, free bandwidth",
  },
  {
    id: "stageone", label: "STAGEONE Hosting", icon: Server, color: "#f59e0b",
    description: "Managed hosting, AI monitoring, auto-scaling",
  },
]

// ─── Component ────────────────────────────────────────────────────────────────
interface DeploymentPipelineProps {
  project: V2Project
  open:    boolean
  onClose: () => void
}

export function DeploymentPipeline({ project, open, onClose }: DeploymentPipelineProps) {
  const [phase,        setPhase]        = useState<"select" | "running" | "done" | "error">("select")
  const [provider,     setProvider]     = useState<Provider>("stageone")
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({})
  const [currentStep,  setCurrentStep]  = useState<string | null>(null)
  const [liveUrl,      setLiveUrl]      = useState<string | null>(null)

  const reset = () => {
    setPhase("select")
    setStepStatuses({})
    setCurrentStep(null)
    setLiveUrl(null)
  }

  useEffect(() => {
    if (!open) reset()
  }, [open])

  const runPipeline = async () => {
    setPhase("running")

    for (const step of STEPS) {
      setCurrentStep(step.id)
      setStepStatuses(prev => ({ ...prev, [step.id]: "running" }))
      await sleep(step.ms)

      // Simulate a 5% build failure chance
      if (step.id === "build" && Math.random() < 0.05) {
        setStepStatuses(prev => ({ ...prev, [step.id]: "error" }))
        setPhase("error")
        return
      }

      setStepStatuses(prev => ({ ...prev, [step.id]: "done" }))
    }

    setCurrentStep(null)
    const subdomain = project.projectName.toLowerCase().replace(/[^a-z0-9]/g, "-")
    setLiveUrl(`https://${subdomain}.stageone.app`)
    setPhase("done")
  }

  const statusOf = (stepId: string): StepStatus => stepStatuses[stepId] ?? "pending"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] bg-[#202020] backdrop-blur-sm"
            onClick={phase === "select" ? onClose : undefined}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 z-[151] w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2"
          >
            <div className="overflow-hidden rounded-lg border border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] shadow-md shadow-black/80">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-[rgba(255,255,255,0.08)] px-5 py-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#252525]">
                  <Upload className="h-4 w-4 text-[#ECECEC]" />
                </div>
                <div className="flex-1">
                  <h2 className="text-[14px] font-semibold text-[#ECECEC]">Deploy Project</h2>
                  <p className="text-[11px] text-[#ECECEC]/30">{project.projectName}</p>
                </div>
                {(phase === "select" || phase === "done" || phase === "error") && (
                  <button onClick={onClose} className="text-[#ECECEC]/20 hover:text-[#ECECEC]/50 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="p-5">
                {/* ── Provider selection ──────────────────────────────────── */}
                {phase === "select" && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <p className="mb-3 text-[12px] text-[#ECECEC]/35">Choose a deployment provider</p>
                    <div className="space-y-2">
                      {PROVIDERS.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setProvider(p.id)}
                          className={`flex w-full items-center gap-3 rounded-lg border px-3 py-3 text-left transition-all ${
                            provider === p.id
                              ? "border-[rgba(255,255,255,0.08)] bg-[#252525]"
                              : "border-[rgba(255,255,255,0.08)] bg-[#252525] hover:border-[rgba(255,255,255,0.08)] hover:bg-[#252525]"
                          }`}
                        >
                          <div
                            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
                            style={{ background: `${p.color}15` }}
                          >
                            <p.icon className="h-4 w-4" style={{ color: p.color }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-[13px] font-medium text-[#ECECEC]">{p.label}</span>
                            <p className="text-[11px] text-[#ECECEC]/28">{p.description}</p>
                          </div>
                          {provider === p.id && (
                            <CheckCircle className="h-4 w-4 flex-shrink-0 text-[#ECECEC]" />
                          )}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => void runPipeline()}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[#ECECEC] text-[#1A1A1A] py-3 text-[13px] font-semibold text-black transition-all hover:bg-[#ECECEC] text-[#1A1A1A] active:scale-[0.98]"
                    >
                      <Rocket className="h-4 w-4" />
                      Deploy to {PROVIDERS.find(p => p.id === provider)?.label}
                    </button>
                  </motion.div>
                )}

                {/* ── Pipeline running ────────────────────────────────────── */}
                {(phase === "running" || phase === "done" || phase === "error") && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="space-y-1 py-2">
                      {STEPS.map((step, i) => {
                        const status = statusOf(step.id)
                        const Icon = step.icon
                        return (
                          <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.06 }}
                            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                              status === "running" ? "bg-[#252525]" :
                              status === "done"    ? "bg-emerald-500/5" :
                              status === "error"   ? "bg-red-500/8"     : ""
                            }`}
                          >
                            <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md ${
                              status === "running" ? "bg-[#252525]" :
                              status === "done"    ? "bg-emerald-500/12" :
                              status === "error"   ? "bg-red-500/12"     :
                              "bg-[#252525]"
                            }`}>
                              {status === "done"  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> :
                               status === "error" ? <AlertCircle className="h-3.5 w-3.5 text-red-400" /> :
                               status === "running" ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#ECECEC]" /> :
                               <Icon className="h-3.5 w-3.5 text-[#ECECEC]/22" />}
                            </div>
                            <span className={`flex-1 text-[12px] ${
                              status === "running" ? "text-[#ECECEC]" :
                              status === "done"    ? "text-[#ECECEC]/55" :
                              status === "error"   ? "text-red-400/80":
                              "text-[#ECECEC]/25"
                            }`}>
                              {step.label}
                            </span>
                            {status === "running" && (
                              <motion.div className="flex gap-[3px]">
                                {[0,1,2].map(d => (
                                  <motion.div key={d}
                                    className="h-1 w-1 rounded-full bg-[#252525]"
                                    animate={{ opacity: [0.2,1,0.2] }}
                                    transition={{ duration: 1, repeat: Infinity, delay: d * 0.15 }}
                                  />
                                ))}
                              </motion.div>
                            )}
                            {status === "done" && i < STEPS.length - 1 && (
                              <ChevronRight className="h-3 w-3 text-emerald-400/40" />
                            )}
                          </motion.div>
                        )
                      })}
                    </div>

                    {/* Done: live URL */}
                    {phase === "done" && liveUrl && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-4 overflow-hidden rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-none" />
                          <span className="text-[11px] font-semibold text-emerald-400">Live</span>
                        </div>
                        <a
                          href={liveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-[13px] text-emerald-300/80 hover:text-emerald-200 transition-colors"
                        >
                          <span className="font-mono">{liveUrl}</span>
                          <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                        </a>
                        <button
                          onClick={() => { reset(); onClose() }}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500/12 py-2 text-[12px] font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        >
                          Done
                        </button>
                      </motion.div>
                    )}

                    {/* Error */}
                    {phase === "error" && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="mt-4 rounded-lg border border-red-500/20 bg-red-500/8 px-4 py-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <AlertCircle className="h-4 w-4 text-red-400" />
                          <span className="text-[13px] text-red-400">Build failed</span>
                        </div>
                        <p className="text-[11px] text-red-300/50">Check the terminal for error details, then retry.</p>
                        <button
                          onClick={reset}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#252525] py-2 text-[12px] text-[#ECECEC]/45 hover:bg-[#252525] transition-colors"
                        >
                          Try again
                        </button>
                      </motion.div>
                    )}
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

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
