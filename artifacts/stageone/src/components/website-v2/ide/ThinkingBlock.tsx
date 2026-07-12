// ─── ThinkingBlock — Collapsible "🤔 Thinking..." display ──────────────────────
// Shows the model's internal reasoning with streaming-aware animations.

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, ChevronDown, ChevronUp } from "lucide-react"

interface ThinkingBlockProps {
  text: string
  isStreaming?: boolean
}

function AnimatedDots() {
  return (
    <span className="flex items-center gap-[3px]">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-amber-400/80"
          animate={{
            y: [0, -3, 0],
            opacity: [0.4, 1, 0.4],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: "easeInOut",
          }}
        />
      ))}
    </span>
  )
}

export function ThinkingBlock({ text, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(true)

  if (!text.trim()) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{
        opacity: 1,
        height: "auto",
        borderColor: isStreaming
          ? ["rgba(251, 191, 36, 0.15)", "rgba(251, 191, 36, 0.35)", "rgba(251, 191, 36, 0.15)"]
          : "rgba(251, 191, 36, 0.2)",
      }}
      transition={isStreaming ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : { duration: 0.3 }}
      className="relative rounded-lg border bg-amber-400/5 p-3"
      style={{ borderColor: "rgba(251, 191, 36, 0.2)" }}
    >
      {/* Shimmer overlay while streaming */}
      {isStreaming && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-lg"
          animate={{
            background: [
              "linear-gradient(90deg, transparent 0%, rgba(251, 191, 36, 0.03) 50%, transparent 100%)",
              "linear-gradient(90deg, transparent 100%, rgba(251, 191, 36, 0.03) 150%, transparent 200%)",
            ],
            x: ["-100%", "100%"],
          }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Header */}
      <div className="relative z-[1] flex items-center gap-2 mb-2">
        <motion.div
          className="flex h-5 w-5 items-center justify-center rounded"
          style={{ background: "#f59e0b1a" }}
          animate={isStreaming ? { scale: [1, 1.08, 1] } : {}}
          transition={isStreaming ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
        >
          <Brain className="h-2.5 w-2.5 text-amber-400/80" />
        </motion.div>
        <span className="text-[11px] font-medium text-amber-400/80">
          {isStreaming ? "Thinking" : "Thought"}
        </span>
        {isStreaming && (
          <span className="ml-auto text-[10px] text-amber-400/60">
            <AnimatedDots />
          </span>
        )}
        <button
          onClick={() => setExpanded(!expanded)}
          className="ml-auto rounded p-0.5 text-white/20 hover:text-white/40 transition-colors"
          aria-label={expanded ? "Collapse thinking" : "Expand thinking"}
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="relative z-[1] rounded bg-black/30 p-2 text-[11px] text-white/50 overflow-x-auto max-h-64"
          >
            <pre className="font-mono whitespace-pre-wrap">{text}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}