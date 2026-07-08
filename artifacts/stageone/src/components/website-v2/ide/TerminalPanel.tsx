import { useEffect, useRef } from "react"
import { Terminal, ChevronRight, Circle, Loader } from "lucide-react"
import type { TerminalLine, RuntimeStatus } from "@/components/website-v2/runtime/runtime-types"
import { RuntimeAgentObserver } from "./RuntimeAgentObserver"

// ─── Placeholder shown before WC boots ────────────────────────────────────────
const PLACEHOLDER_LINES: TerminalLine[] = [
  { id: -1, type: "info", text: "Waiting for WebContainer to start…", time: "00:00:00" },
]

const LINE_COLORS: Record<TerminalLine["type"], string> = {
  info:    "text-white/45",
  success: "text-emerald-400",
  error:   "text-red-400",
  warn:    "text-amber-400",
  cmd:     "text-amber-300 font-semibold",
}

interface TerminalPanelProps {
  /** Real streamed output from WebContainerProvider. Falls back to placeholder when absent. */
  lines?: TerminalLine[]
  /** Whether the WC boot sequence is actively running */
  isBooting?: boolean
  /** Full WC lifecycle status — drives the Runtime Agent Observer card */
  wcStatus?: RuntimeStatus
  /** Live dev-server URL — shown in the Observer card when ready */
  wcUrl?: string | null
}

export function TerminalPanel({ lines, isBooting, wcStatus, wcUrl }: TerminalPanelProps) {
  const bottomRef   = useRef<HTMLDivElement | null>(null)
  const display     = lines && lines.length > 0 ? lines : PLACEHOLDER_LINES
  const showSpinner = isBooting ?? false

  // Auto-scroll to bottom whenever new lines arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [lines])

  return (
    <div className="flex h-full w-full flex-col bg-[#080808] font-mono">
      {/* Terminal header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-white/[0.07] bg-[#0d0d0d] px-3 py-2">
        <Terminal className="h-3.5 w-3.5 text-white/30" />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-white/30">
          Terminal
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {showSpinner
            ? <Loader className="h-3 w-3 animate-spin text-amber-400/60" />
            : <Circle  className="h-2 w-2 fill-emerald-400 text-emerald-400" />
          }
          <span className="text-[10px] text-white/30">
            {showSpinner ? "Starting…" : "WebContainer"}
          </span>
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto text-[12px] leading-6" style={{ scrollbarWidth: "thin" }}>
        <div className="p-3">
          {display.map((line) => (
            <div key={line.id} className="flex items-start gap-3">
              <span className="flex-shrink-0 pt-0.5 font-mono text-[10px] text-white/20">
                {line.time}
              </span>
              <span className={LINE_COLORS[line.type]}>{line.text}</span>
            </div>
          ))}

          {/* Blinking cursor */}
          <div className="mt-2 flex items-center gap-1 text-amber-400/80">
            <ChevronRight className="h-3 w-3" />
            <span className="animate-pulse">_</span>
          </div>
        </div>

        {/* Runtime Agent Observer — appears after WC becomes ready */}
        <RuntimeAgentObserver
          status={wcStatus ?? "idle"}
          terminalLines={lines ?? []}
          wcUrl={wcUrl ?? null}
          scrollIntoView={bottomRef}
        />

        {/* Scroll anchor — lives after the observer so scroll-to-bottom
            always reveals the checklist card once it appears            */}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
