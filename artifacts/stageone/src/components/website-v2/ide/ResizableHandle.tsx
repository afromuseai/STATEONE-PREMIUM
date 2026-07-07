import { useRef, useCallback, useEffect } from "react"

interface ResizableHandleProps {
  /** Called continuously with the new left-pane percentage (0–100) */
  onResize: (pct: number) => void
  containerRef: React.RefObject<HTMLDivElement | null>
}

/**
 * A slim drag handle for the split-pane layout.
 *
 * Dragging updates the left pane's percentage width in real time.
 * Global listeners and body-style changes are always cleaned up — even if the
 * component unmounts mid-drag or the window loses focus.
 */
export function ResizableHandle({ onResize, containerRef }: ResizableHandleProps) {
  const dragging = useRef(false)

  // Restore body styles if the component unmounts while a drag is in progress
  useEffect(() => {
    return () => {
      if (dragging.current) {
        document.body.style.cursor     = ""
        document.body.style.userSelect = ""
        dragging.current = false
      }
    }
  }, [])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragging.current = true
      document.body.style.cursor     = "col-resize"
      document.body.style.userSelect = "none"

      // All cleanup is centralised here so every exit path calls the same fn
      function cleanup() {
        dragging.current = false
        document.body.style.cursor     = ""
        document.body.style.userSelect = ""
        window.removeEventListener("mousemove", onMove)
        window.removeEventListener("mouseup",   onUp)
        window.removeEventListener("blur",      onWindowBlur)
      }

      function onMove(ev: MouseEvent) {
        if (!dragging.current || !containerRef.current) return
        const rect    = containerRef.current.getBoundingClientRect()
        const rawPct  = ((ev.clientX - rect.left) / rect.width) * 100
        const clamped = Math.min(Math.max(rawPct, 20), 80)
        onResize(clamped)
      }

      function onUp()          { cleanup() }
      function onWindowBlur()  { cleanup() }   // window blur = user alt-tabbed; treat as mouse-up

      window.addEventListener("mousemove", onMove)
      window.addEventListener("mouseup",   onUp)
      window.addEventListener("blur",      onWindowBlur)
    },
    [onResize, containerRef],
  )

  return (
    <div
      role="separator"
      aria-label="Resize code and preview panes"
      aria-orientation="vertical"
      onMouseDown={onMouseDown}
      className="group relative z-10 flex w-[5px] flex-shrink-0 cursor-col-resize
        items-center justify-center bg-transparent transition-colors hover:bg-white/[0.03]"
    >
      {/* Visible grip line */}
      <div
        className="h-8 w-px rounded-full bg-white/[0.10] transition-all duration-100
          group-hover:h-16 group-hover:w-[2px] group-hover:bg-amber-400/40"
      />
    </div>
  )
}
