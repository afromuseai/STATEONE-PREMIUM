// ─── ThinkingBlock — Collapsible "💭 Thinking..." display ──────────────────────

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Brain, ChevronDown, ChevronUp } from "lucide-react"

interface ThinkingBlockProps {
  text: string
  isStreaming?: boolean
}

export function ThinkingBlock({ text, isStreaming = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(true)

  if (!text.trim()) return null

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="relative rounded-lg border border-amber-400/20 bg-amber-400/5 p-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <div className="flex h-5 w-5 items-center justify-center rounded" style={{ background: "#f59e0b1a" }}>
          <Brain className="h-2.5 w-2.5 text-amber-400/80" />
        </div>
        <span className="text-[11px] font-medium text-amber-400/80">Thinking</span>
        {isStreaming && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-400/60">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: "100ms" }} />
            <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" style={{ animationDelay: "200ms" }} />
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
            className="rounded bg-black/30 p-2 text-[11px] text-white/50 overflow-x-auto max-h-64"
          >
            <pre className="font-mono whitespace-pre-wrap">{text}</pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}