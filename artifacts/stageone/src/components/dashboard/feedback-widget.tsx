import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ThumbsUp, ThumbsDown, Star, CheckCircle2, MessageSquare, TrendingUp, Zap, Target } from "lucide-react"
import { trackImpact, submitFeedback } from "@/lib/impact-api"
import { toast } from "sonner"

interface FeedbackWidgetProps {
  outputType: "business_intelligence" | "website" | "automation" | "chatbot" | "orchestration"
  projectId?: string
  expectedImpact?: string
  confidenceScore?: number
  optimizationGoal?: string
  compact?: boolean
}

const OUTPUT_TYPE_LABELS: Record<string, string> = {
  business_intelligence: "Business Intelligence",
  website: "Website Generation",
  automation: "Automation Builder",
  chatbot: "Chatbot Generation",
  orchestration: "Orchestration Plan",
}

const GOAL_OPTIONS = [
  { value: "growth", label: "Growth", icon: TrendingUp },
  { value: "efficiency", label: "Efficiency", icon: Zap },
  { value: "conversion", label: "Conversion", icon: Target },
]

export function FeedbackWidget({
  outputType,
  projectId,
  expectedImpact = "medium",
  confidenceScore = 75,
  optimizationGoal = "growth",
  compact = false,
}: FeedbackWidgetProps) {
  const [phase, setPhase] = useState<"idle" | "rating" | "details" | "done">("idle")
  const [trackingId, setTrackingId] = useState<string | null>(null)
  const [rating, setRating] = useState<number>(0)
  const [usefulness, setUsefulness] = useState<number>(0)
  const [note, setNote] = useState("")
  const [implStatus, setImplStatus] = useState<"pending" | "accepted" | "rejected" | "implemented">("pending")
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function handleStart() {
    try {
      const entry = await trackImpact({
        projectId,
        outputType,
        expectedImpact,
        confidenceScore,
        optimizationGoal,
      })
      setTrackingId(entry.id)
      setPhase("rating")
    } catch {
      setPhase("rating")
    }
  }

  async function handleSubmit() {
    if (!trackingId) {
      setPhase("done")
      return
    }
    setIsSubmitting(true)
    try {
      await submitFeedback({
        impactTrackingId: trackingId,
        feedbackRating: rating,
        usefulnessScore: usefulness,
        feedbackNote: note || undefined,
        implementationStatus: implStatus,
      })
      setPhase("done")
      toast.success("Feedback recorded — STAGEONE is learning from your input")
    } catch {
      setPhase("done")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (compact) {
    return (
      <AnimatePresence mode="wait">
        {phase === "idle" && (
          <motion.button
            key="idle"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            onClick={handleStart}
            className="flex items-center gap-1.5 rounded-lg border border-border/25 bg-secondary/20 px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground/60 hover:border-primary/25 hover:text-primary transition-all"
          >
            <MessageSquare className="h-3 w-3" />
            Rate this output
          </motion.button>
        )}
        {phase === "rating" && (
          <motion.div
            key="rating"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <span className="text-[10px] text-muted-foreground/50">Helpful?</span>
            {[1,2,3,4,5].map(n => (
              <button key={n} onClick={() => { setRating(n); setUsefulness(n * 20); setPhase("done"); handleSubmit() }}
                className={`h-5 w-5 rounded transition-colors ${n <= rating ? "text-primary" : "text-muted-foreground/30 hover:text-primary/60"}`}>
                <Star className="h-full w-full" fill={n <= rating ? "currentColor" : "none"} />
              </button>
            ))}
          </motion.div>
        )}
        {phase === "done" && (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-1.5 text-[10px] text-green-400">
            <CheckCircle2 className="h-3 w-3" />
            Thanks — learning applied
          </motion.div>
        )}
      </AnimatePresence>
    )
  }

  return (
    <AnimatePresence mode="wait">
      {phase === "idle" && (
        <motion.div
          key="idle"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mt-4 rounded-xl border border-border/20 bg-secondary/10 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
                <TrendingUp className="h-3.5 w-3.5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Impact Feedback Loop</p>
                <p className="text-[10px] text-muted-foreground/50">Help STAGEONE learn from this {OUTPUT_TYPE_LABELS[outputType]} output</p>
              </div>
            </div>
            <button
              onClick={handleStart}
              className="rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
            >
              Rate Output
            </button>
          </div>
        </motion.div>
      )}

      {phase === "rating" && (
        <motion.div
          key="rating"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-5"
        >
          <div className="flex items-center gap-2 border-b border-border/20 pb-4">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Star className="h-3.5 w-3.5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Rate this {OUTPUT_TYPE_LABELS[outputType]}</p>
              <p className="text-[10px] text-muted-foreground/50">Your feedback trains the adaptive intelligence engine</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Overall Quality</p>
            <div className="flex items-center gap-2">
              {[1,2,3,4,5].map(n => (
                <button
                  key={n}
                  onClick={() => setRating(n)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
                    n <= rating
                      ? "border-primary/50 bg-primary/20 text-primary"
                      : "border-border/25 bg-secondary/20 text-muted-foreground/30 hover:border-primary/25 hover:text-primary/50"
                  }`}
                >
                  <Star className="h-4 w-4" fill={n <= rating ? "currentColor" : "none"} />
                </button>
              ))}
              {rating > 0 && (
                <motion.span initial={{ opacity: 0, x: 4 }} animate={{ opacity: 1, x: 0 }}
                  className="ml-2 text-xs font-semibold text-primary">
                  {["", "Poor", "Fair", "Good", "Great", "Excellent"][rating]}
                </motion.span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Usefulness (0–100)</p>
            <div className="space-y-2">
              <input
                type="range"
                min={0} max={100} step={5}
                value={usefulness}
                onChange={e => setUsefulness(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <div className="flex justify-between">
                <span className="text-[9px] text-muted-foreground/40">Not useful</span>
                <span className="text-xs font-bold text-primary">{usefulness}</span>
                <span className="text-[9px] text-muted-foreground/40">Extremely useful</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Will you implement this?</p>
            <div className="flex gap-2">
              {[
                { value: "accepted", label: "Yes", icon: ThumbsUp },
                { value: "rejected", label: "No", icon: ThumbsDown },
                { value: "implemented", label: "Already did", icon: CheckCircle2 },
              ].map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setImplStatus(value as typeof implStatus)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                    implStatus === value
                      ? "border-primary/50 bg-primary/15 text-primary"
                      : "border-border/25 bg-secondary/10 text-muted-foreground/50 hover:border-border/50"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">Notes (optional)</p>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="What worked well? What could be better?"
              rows={2}
              className="w-full rounded-lg border border-border/25 bg-secondary/20 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/30 focus:border-primary/40 focus:outline-none resize-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={rating === 0 || isSubmitting}
              className="flex-1 rounded-lg border border-primary/30 bg-primary/15 py-2 text-xs font-bold text-primary hover:bg-primary/25 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Saving..." : "Submit Feedback"}
            </button>
            <button
              onClick={() => setPhase("idle")}
              className="rounded-lg border border-border/25 bg-secondary/10 px-3 py-2 text-xs text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              Skip
            </button>
          </div>
        </motion.div>
      )}

      {phase === "done" && (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border border-green-500/25 bg-green-500/10">
              <CheckCircle2 className="h-4 w-4 text-green-400" />
            </div>
            <div>
              <p className="text-xs font-bold text-green-400">Feedback recorded</p>
              <p className="text-[10px] text-muted-foreground/50">STAGEONE is updating its recommendation weights based on your input</p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
