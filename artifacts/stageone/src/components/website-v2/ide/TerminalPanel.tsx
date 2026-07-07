import { useState } from "react"
import { Terminal, ChevronRight, Circle } from "lucide-react"

interface LogLine {
  id: number
  type: "info" | "success" | "error" | "warn" | "cmd"
  text: string
  time: string
}

const PLACEHOLDER_LOGS: LogLine[] = [
  { id: 1, type: "info",    text: "WebContainer runtime ready",          time: "00:00" },
  { id: 2, type: "cmd",     text: "$ pnpm install",                      time: "00:01" },
  { id: 3, type: "success", text: "✓ 532 packages installed",            time: "00:04" },
  { id: 4, type: "cmd",     text: "$ pnpm dev",                          time: "00:04" },
  { id: 5, type: "success", text: "▲ Next.js 14.2.3",                    time: "00:05" },
  { id: 6, type: "info",    text: "- Local: http://localhost:3000",       time: "00:05" },
  { id: 7, type: "success", text: "✓ Ready in 842ms",                    time: "00:05" },
]

const LOG_COLORS: Record<LogLine["type"], string> = {
  info:    "text-white/50",
  success: "text-emerald-400",
  error:   "text-red-400",
  warn:    "text-amber-400",
  cmd:     "text-amber-300 font-semibold",
}

export function TerminalPanel() {
  const [input, setInput] = useState("")

  return (
    <div className="flex h-full flex-col bg-[#080808] font-mono">
      {/* Terminal header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#0d0d0d] px-3 py-2">
        <Terminal className="h-3.5 w-3.5 text-white/30" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
          Terminal
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <Circle className="h-2 w-2 fill-emerald-400 text-emerald-400" />
          <span className="text-[10px] text-white/30">WebContainer</span>
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto p-3 text-[12px] leading-6">
        {PLACEHOLDER_LOGS.map((line) => (
          <div key={line.id} className="flex items-start gap-3">
            <span className="flex-shrink-0 text-[10px] text-white/20 pt-0.5">{line.time}</span>
            <span className={LOG_COLORS[line.type]}>{line.text}</span>
          </div>
        ))}
        <div className="mt-2 flex items-center gap-1 text-amber-400/80">
          <ChevronRight className="h-3 w-3" />
          <span className="animate-pulse">_</span>
        </div>
      </div>

      {/* Input */}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-white/[0.07] bg-[#0d0d0d] px-3 py-2">
        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-amber-400/60" />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command…"
          className="flex-1 bg-transparent text-[12px] text-white/70 placeholder-white/20 outline-none"
        />
      </div>
    </div>
  )
}
