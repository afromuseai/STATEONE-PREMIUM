import { motion } from "framer-motion"
import { useState, useRef, useEffect } from "react"
import { X, ChevronDown, Circle } from "lucide-react"
import type { TerminalLine } from "@/components/website-v2/runtime/runtime-types"

interface TerminalDrawerProps {
  onClose: () => void
  terminalLines: TerminalLine[]
}

const LOG_COLORS: Record<TerminalLine["type"], string> = {
  info:    "text-[#ECECEC]/45",
  success: "text-emerald-400/90",
  error:   "text-red-400",
  warn:    "text-[#ECECEC]",
  cmd:     "text-[#ECECEC] font-semibold",
  dim:     "text-[#ECECEC]/20",
}

export function TerminalDrawer({ onClose, terminalLines }: TerminalDrawerProps) {
  const [input, setInput]         = useState("")
  const [history, setHistory]     = useState<TerminalLine[]>([])
  const [historyIdx, setHistoryIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
    inputRef.current?.focus()
  }, [])

  const allLogs = [...terminalLines, ...history]

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && input.trim()) {
      const cmd = input.trim()
      setHistory((prev) => [
        ...prev,
        { id: Date.now(), type: "cmd", text: `$ ${cmd}`, time: "" },
        { id: Date.now() + 1, type: "info", text: "  (WebContainer not connected yet)", time: "" },
      ])
      setInput("")
      setHistoryIdx(-1)
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50)
    }
    if (e.key === "Escape") {
      setInput("")
    }
  }

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 220, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 40 }}
      className="flex flex-shrink-0 flex-col overflow-hidden border-t border-[rgba(255,255,255,0.08)] bg-[#1A1A1A]"
    >
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-1.5">
        <div className="flex items-center gap-2">
          {/* Shell tabs (visual only) */}
          <div className="flex items-center rounded-md border border-[rgba(255,255,255,0.08)] bg-white/[0.025] px-2.5 py-0.5">
            <span className="text-[11px] font-medium text-[#ECECEC]/50">bash</span>
          </div>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <Circle className="h-1.5 w-1.5 fill-emerald-400/65 text-emerald-400/65" />
          <span className="text-[10px] text-[#ECECEC]/22">WebContainer</span>
        </div>

        <div className="ml-2 h-3.5 w-px bg-[#252525]" />

        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded-md text-[#ECECEC]/18 transition-all hover:bg-[#252525] hover:text-[#ECECEC]/55"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded-md text-[#ECECEC]/18 transition-all hover:bg-[#252525] hover:text-[#ECECEC]/55"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      {/* Output */}
      <div className="flex-1 overflow-y-auto px-4 py-2 font-mono text-[12px] leading-[1.65]" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.06) transparent" }}>
        {allLogs.map((line) => (
          <div key={line.id} className={LOG_COLORS[line.type]}>
            {line.text || "\u00a0"}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-[rgba(255,255,255,0.08)] bg-[#1A1A1A] px-4 py-2">
        <span className="font-mono text-[12px] text-[#ECECEC]">$</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type a command…"
          className="flex-1 bg-transparent font-mono text-[12px] text-[#ECECEC]/65 placeholder-white/18 outline-none"
        />
      </div>
    </motion.div>
  )
}
