import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Eye, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw,
  Zap, Play, Brain, Target, TrendingUp, Shield, Clock,
  XCircle, ArrowRight,
} from "lucide-react"
import {
  runAutonomousScan, getAutonomousSignals, resolveAutonomousSignal,
  type AutonomousSignal, type AutonomousScanResult,
} from "@/lib/intelligence-state"
import { useLocation } from "wouter"
import { toast } from "sonner"

const PRIORITY_CONFIG: Record<number, { label: string; color: string; dotColor: string; icon: React.ElementType }> = {
  1: { label: "CRITICAL", color: "text-red-400 border-red-500/30 bg-red-500/10", dotColor: "bg-red-400", icon: AlertTriangle },
  2: { label: "HIGH", color: "text-orange-400 border-orange-500/30 bg-orange-500/10", dotColor: "bg-orange-400", icon: TrendingUp },
  3: { label: "MEDIUM", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", dotColor: "bg-primary", icon: Target },
  4: { label: "LOW", color: "text-blue-400 border-blue-500/30 bg-blue-500/10", dotColor: "bg-blue-400", icon: Clock },
}

const DECISION_CONFIG: Record<string, { label: string; color: string; description: string }> = {
  EXECUTE: { label: "EXECUTE", color: "text-red-400 border-red-500/25 bg-red-500/8", description: "Act immediately" },
  SUGGEST: { label: "SUGGEST", color: "text-primary border-primary/25 bg-primary/8", description: "Review & action" },
  QUEUE: { label: "QUEUE", color: "text-blue-400 border-blue-500/25 bg-blue-500/8", description: "Scheduled" },
  IGNORE: { label: "IGNORE", color: "text-muted-foreground/50 border-border/20 bg-secondary/10", description: "Low priority" },
}

const REVENUE_IMPACT_COLORS: Record<string, string> = {
  high: "text-green-400",
  medium: "text-primary",
  low: "text-muted-foreground/50",
}

function SignalCard({ signal, onResolve }: { signal: AutonomousSignal; onResolve: (id: string, acted: boolean) => void }) {
  const [, navigate] = useLocation()
  const priority = PRIORITY_CONFIG[signal.priority] ?? PRIORITY_CONFIG[4]
  const decision = DECISION_CONFIG[signal.decisionType] ?? DECISION_CONFIG.QUEUE
  const PriorityIcon = priority.icon

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: signal.isResolved ? 0.4 : 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-xl border p-4 transition-all ${
        signal.isResolved
          ? "border-border/15 bg-secondary/5"
          : signal.priority === 1
          ? "border-red-500/20 bg-red-500/5 hover:border-red-500/30"
          : "border-border/20 bg-secondary/10 hover:border-border/35"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border shrink-0 ${priority.color}`}>
          <PriorityIcon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className={`text-xs font-bold ${signal.isResolved ? "text-muted-foreground/50 line-through" : "text-foreground"}`}>
              {signal.title}
            </p>
            {signal.isResolved ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400 shrink-0 mt-0.5" />
            ) : (
              <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${priority.color}`}>
                {priority.label}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground/60 leading-relaxed mb-3">{signal.description}</p>

          <div className="flex items-center gap-2 flex-wrap mb-3">
            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${decision.color}`}>
              {decision.label}
            </span>
            <span className={`text-[9px] font-semibold ${REVENUE_IMPACT_COLORS[signal.revenueImpact]}`}>
              {signal.revenueImpact} revenue impact
            </span>
            <span className="text-[9px] text-muted-foreground/30">
              {signal.detectedIn.replace("system:", "").replace("project:", "Project ")}
            </span>
          </div>

          {!signal.isResolved && (
            <div className="flex items-center gap-2">
              {signal.actionPath && (
                <button
                  onClick={() => { onResolve(signal.id, true); navigate(signal.actionPath!) }}
                  className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[10px] font-bold text-primary hover:bg-primary/20 transition-colors"
                >
                  <ArrowRight className="h-2.5 w-2.5" />
                  Take Action
                </button>
              )}
              <button
                onClick={() => onResolve(signal.id, false)}
                className="flex items-center gap-1.5 rounded-lg border border-border/20 bg-secondary/10 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground/50 hover:text-foreground hover:border-border/40 transition-colors"
              >
                <XCircle className="h-2.5 w-2.5" />
                Dismiss
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export function AutonomousLoopPanel() {
  const [signals, setSignals] = useState<AutonomousSignal[]>([])
  const [summary, setSummary] = useState<AutonomousScanResult["summary"] | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "unresolved">("unresolved")

  async function loadSignals() {
    setIsLoading(true)
    try {
      const data = await getAutonomousSignals()
      setSignals(data.signals)
    } catch { }
    setIsLoading(false)
  }

  async function handleScan() {
    setIsScanning(true)
    try {
      const result = await runAutonomousScan()
      setSignals(result.signals)
      setSummary(result.summary)
      setLastScanned(result.scannedAt)
      toast.success(`Scan complete — ${result.issuesFound} issue${result.issuesFound !== 1 ? "s" : ""} detected`)
    } catch {
      toast.error("Scan failed — please try again")
    }
    setIsScanning(false)
  }

  async function handleResolve(id: string, wasActedOn: boolean) {
    try {
      const updated = await resolveAutonomousSignal(id, wasActedOn)
      setSignals(prev => prev.map(s => s.id === id ? { ...s, isResolved: true, wasActedOn } : s))
      if (wasActedOn) toast.success("Signal resolved — learning applied")
    } catch {
      toast.error("Failed to resolve signal")
    }
  }

  useEffect(() => { loadSignals() }, [])

  const filtered = filter === "unresolved" ? signals.filter(s => !s.isResolved) : signals
  const unresolved = signals.filter(s => !s.isResolved)
  const criticalCount = unresolved.filter(s => s.priority === 1).length
  const executeCount = unresolved.filter(s => s.decisionType === "EXECUTE").length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40">Autonomous Operating Loop</p>
          <p className="text-[10px] text-muted-foreground/50 mt-0.5">OBSERVE → DETECT → PRIORITIZE → DECIDE → EXECUTE → LEARN</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadSignals}
            className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handleScan}
            disabled={isScanning}
            className="flex items-center gap-1.5 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
          >
            {isScanning ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                  <Eye className="h-3 w-3" />
                </motion.div>
                Scanning...
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                Run Scan
              </>
            )}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {(summary || unresolved.length > 0) && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Unresolved", value: unresolved.length, color: "text-foreground" },
            { label: "Critical", value: criticalCount, color: criticalCount > 0 ? "text-red-400" : "text-muted-foreground/40" },
            { label: "Execute Now", value: executeCount, color: executeCount > 0 ? "text-orange-400" : "text-muted-foreground/40" },
            { label: "Total Found", value: signals.length, color: "text-primary" },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-lg border border-border/15 bg-secondary/10 p-2.5 text-center">
              <p className={`text-lg font-black ${color}`}>{value}</p>
              <p className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Decision type legend */}
      <div className="rounded-xl border border-border/15 bg-secondary/5 p-3">
        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/30 mb-2">Decision Engine Key</p>
        <div className="flex items-center gap-3 flex-wrap">
          {Object.entries(DECISION_CONFIG).map(([type, { label, color, description }]) => (
            <div key={type} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 ${color}`}>
              <span className="text-[8px] font-black uppercase tracking-wider">{label}</span>
              <span className="text-[8px] text-muted-foreground/50">— {description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg border border-border/20 bg-secondary/10 p-1">
        {(["unresolved", "all"] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 rounded-md py-1.5 text-[9px] font-bold uppercase tracking-wider transition-colors ${
              filter === f
                ? "bg-primary/15 text-primary border border-primary/25"
                : "text-muted-foreground/40 hover:text-foreground"
            }`}
          >
            {f === "unresolved" ? `Active (${unresolved.length})` : `All (${signals.length})`}
          </button>
        ))}
      </div>

      {/* Signal list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}>
            <Brain className="h-5 w-5 text-primary/50" />
          </motion.div>
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center py-12 gap-4 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-green-500/20 bg-green-500/5">
            <CheckCircle2 className="h-6 w-6 text-green-400/60" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">
              {filter === "unresolved" ? "All clear — no active issues" : "No signals detected yet"}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1 max-w-[220px]">
              {filter === "unresolved"
                ? "Run a scan to let the autonomous loop detect new opportunities"
                : "Run your first scan to activate the autonomous intelligence loop"}
            </p>
          </div>
          {lastScanned && (
            <p className="text-[9px] text-muted-foreground/30">
              Last scanned: {new Date(lastScanned).toLocaleTimeString()}
            </p>
          )}
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((signal, i) => (
              <motion.div key={signal.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.04 }}>
                <SignalCard signal={signal} onResolve={handleResolve} />
              </motion.div>
            ))}
          </AnimatePresence>
          {lastScanned && (
            <p className="text-center text-[9px] text-muted-foreground/30 pt-2">
              Scanned at {new Date(lastScanned).toLocaleTimeString()}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
