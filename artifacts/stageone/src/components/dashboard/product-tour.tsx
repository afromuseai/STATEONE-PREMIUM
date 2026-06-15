import { useState, useEffect, useCallback, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, ChevronRight, ChevronLeft } from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const DISMISS_KEY = (uid: string) => `tour:dismissed:v2:${uid}`

interface TourStep {
  target: string
  title: string
  description: string
  placement?: "right" | "left" | "bottom" | "top" | "auto"
}

const STEPS: TourStep[] = [
  {
    target: "[data-tour='nav-dashboard']",
    title: "Dashboard",
    description: "Your command center. See an overview of your AI OS, recent projects, and quick-launch tools.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-business-intelligence']",
    title: "Business Intelligence",
    description: "Describe any business idea and get a complete strategic blueprint — market analysis, competitive insights, revenue projections, and a full growth roadmap.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-website-generator']",
    title: "Website Generator",
    description: "Turn your business blueprint into a launch-ready website. STAGEONE builds it for you with React code, brand colors, and real content you can edit and export.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-chatbot-generator']",
    title: "AI Chatbot Generator",
    description: "Build a custom AI chatbot for your product — trained on your business context, with a configurable persona and embeddable anywhere.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-automation-builder']",
    title: "Automation Builder",
    description: "Design and deploy intelligent workflows that automate repetitive tasks across your business — no code required.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-orchestrator']",
    title: "AI Orchestrator",
    description: "Coordinate multiple AI agents working together in parallel. The Orchestrator breaks down complex goals and delegates to specialized agents automatically.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-analytics']",
    title: "Analytics",
    description: "Track the health and performance of your AI OS — generation usage, agent activity, revenue signals, and growth metrics, all in one view.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-projects']",
    title: "Projects",
    description: "All your saved business analyses and generated websites live here. Revisit, edit, and continue building from where you left off.",
    placement: "right",
  },
  {
    target: "[data-tour='nav-settings']",
    title: "Settings",
    description: "Manage your account, notifications, API keys, integrations, and billing preferences.",
    placement: "right",
  },
  {
    target: "[data-tour='copilot']",
    title: "AI Copilot — Marcus",
    description: "Your always-on AI business partner. Ask anything — market questions, strategy advice, feature ideas — and Marcus responds with full context of your business.",
    placement: "right",
  },
  {
    target: "[data-tour='search']",
    title: "Quick Search",
    description: "Jump to any page instantly. Press ⌘K to open it from anywhere in the app.",
    placement: "bottom",
  },
  {
    target: "[data-tour='new-analysis']",
    title: "New Analysis",
    description: "Start a fresh AI business analysis any time with one click. Describe your idea and let STAGEONE do the heavy lifting.",
    placement: "bottom",
  },
  {
    target: "[data-tour='lang-menu']",
    title: "Language",
    description: "Switch the interface to any supported language — STAGEONE adapts the entire UI for your preference.",
    placement: "bottom",
  },
  {
    target: "[data-tour='notifications']",
    title: "Notifications",
    description: "Stay updated on agent activity, deployment status, and important events from your AI OS.",
    placement: "bottom",
  },
  {
    target: "[data-tour='user-menu']",
    title: "Your Profile",
    description: "Access your account settings, sign out, or switch workspaces from here.",
    placement: "bottom",
  },
]

interface Rect { top: number; left: number; width: number; height: number }
interface BubblePos { x: number; y: number; arrowSide: "left" | "right" | "top" | "bottom" }

const PADDING = 4
const BUBBLE_W = 300
const BUBBLE_H = 170

function computeBubblePos(rect: Rect, placement: TourStep["placement"]): BubblePos {
  const vw = window.innerWidth
  const vh = window.innerHeight

  const cx = rect.left + rect.width / 2
  const cy = rect.top + rect.height / 2

  const spaceRight = vw - (rect.left + rect.width)
  const spaceLeft = rect.left
  const spaceBottom = vh - (rect.top + rect.height)
  const spaceTop = rect.top

  let side = placement === "auto" ? "right" : placement ?? "auto"

  if (side === "auto") {
    if (spaceRight >= BUBBLE_W + PADDING * 2) side = "right"
    else if (spaceLeft >= BUBBLE_W + PADDING * 2) side = "left"
    else if (spaceBottom >= BUBBLE_H + PADDING * 2) side = "bottom"
    else side = "top"
  }

  if (side === "right" && spaceRight < BUBBLE_W + PADDING) side = spaceLeft > spaceRight ? "left" : "bottom"
  if (side === "left" && spaceLeft < BUBBLE_W + PADDING) side = "bottom"

  let x = 0, y = 0, arrowSide: BubblePos["arrowSide"] = "left"

  if (side === "right") {
    x = rect.left + rect.width + PADDING + 8
    y = cy - BUBBLE_H / 2
    arrowSide = "left"
  } else if (side === "left") {
    x = rect.left - BUBBLE_W - PADDING - 8
    y = cy - BUBBLE_H / 2
    arrowSide = "right"
  } else if (side === "bottom") {
    x = cx - BUBBLE_W / 2
    y = rect.top + rect.height + PADDING + 8
    arrowSide = "top"
  } else {
    x = cx - BUBBLE_W / 2
    y = rect.top - BUBBLE_H - PADDING - 8
    arrowSide = "bottom"
  }

  x = Math.max(PADDING, Math.min(vw - BUBBLE_W - PADDING, x))
  y = Math.max(PADDING, Math.min(vh - BUBBLE_H - PADDING, y))

  return { x, y, arrowSide }
}

const CORNER = 8

function SpotlightOverlay({ rect }: { rect: Rect }) {
  const x = rect.left - PADDING
  const y = rect.top - PADDING
  const w = rect.width + PADDING * 2
  const h = rect.height + PADDING * 2

  return (
    <svg
      className="fixed inset-0 pointer-events-none"
      style={{ width: "100vw", height: "100vh", zIndex: 9998 }}
    >
      <defs>
        <mask id="tour-mask">
          <rect width="100%" height="100%" fill="white" />
          <rect x={x} y={y} width={w} height={h} rx={CORNER} ry={CORNER} fill="black" />
        </mask>
      </defs>
      <rect
        width="100%"
        height="100%"
        fill="rgba(0,0,0,0.75)"
        mask="url(#tour-mask)"
      />
    </svg>
  )
}

function GlowRing({ rect }: { rect: Rect }) {
  const x = rect.left - PADDING
  const y = rect.top - PADDING
  const w = rect.width + PADDING * 2
  const h = rect.height + PADDING * 2

  return (
    <motion.div
      className="fixed pointer-events-none"
      style={{
        left: x - 3,
        top: y - 3,
        width: w + 6,
        height: h + 6,
        zIndex: 9999,
        borderRadius: CORNER + 3,
        border: "1.5px solid rgba(212,175,55,0.85)",
        boxShadow:
          "0 0 0 3px rgba(212,175,55,0.12), 0 0 18px 6px rgba(212,175,55,0.22), inset 0 0 12px rgba(212,175,55,0.05)",
      }}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
    >
      <motion.div
        className="absolute inset-0"
        style={{
          borderRadius: CORNER + 3,
          border: "1px solid rgba(212,175,55,0.25)",
        }}
        animate={{ scale: [1, 1.04, 1], opacity: [0.6, 0.2, 0.6] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.div>
  )
}

function Arrow({ side }: { side: BubblePos["arrowSide"] }) {
  const base = "absolute w-0 h-0"
  const styles: Record<BubblePos["arrowSide"], React.CSSProperties> = {
    left: {
      left: -8,
      top: "50%",
      transform: "translateY(-50%)",
      borderTop: "8px solid transparent",
      borderBottom: "8px solid transparent",
      borderRight: "8px solid rgba(212,175,55,0.18)",
    },
    right: {
      right: -8,
      top: "50%",
      transform: "translateY(-50%)",
      borderTop: "8px solid transparent",
      borderBottom: "8px solid transparent",
      borderLeft: "8px solid rgba(212,175,55,0.18)",
    },
    top: {
      top: -8,
      left: "50%",
      transform: "translateX(-50%)",
      borderLeft: "8px solid transparent",
      borderRight: "8px solid transparent",
      borderBottom: "8px solid rgba(212,175,55,0.18)",
    },
    bottom: {
      bottom: -8,
      left: "50%",
      transform: "translateX(-50%)",
      borderLeft: "8px solid transparent",
      borderRight: "8px solid transparent",
      borderTop: "8px solid rgba(212,175,55,0.18)",
    },
  }
  return <div className={base} style={styles[side]} />
}

export function ProductTour() {
  const { user } = useAuth()
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [bubblePos, setBubblePos] = useState<BubblePos | null>(null)
  const rafRef = useRef<number>(0)

  const currentStep = STEPS[stepIdx]

  const dismiss = useCallback(() => {
    if (user) localStorage.setItem(DISMISS_KEY(user.id), "1")
    setActive(false)
  }, [user?.id])

  const measureTarget = useCallback(() => {
    if (!currentStep) return
    const el = document.querySelector(currentStep.target)
    if (!el) return
    const r = el.getBoundingClientRect()
    const newRect: Rect = { top: r.top, left: r.left, width: r.width, height: r.height }
    setRect(newRect)
    setBubblePos(computeBubblePos(newRect, currentStep.placement))
  }, [currentStep])

  useEffect(() => {
    if (!user) return undefined
    const daysSinceSignup = (Date.now() - new Date(user.createdAt).getTime()) / 86400000
    if (daysSinceSignup > 30) return undefined
    const dismissed = localStorage.getItem(DISMISS_KEY(user.id)) === "1"
    if (dismissed) return undefined
    const t = setTimeout(() => setActive(true), 800)
    return () => clearTimeout(t)
  }, [user?.id])

  useEffect(() => {
    if (!active) return
    measureTarget()
    const loop = () => { measureTarget(); rafRef.current = requestAnimationFrame(loop) }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [active, measureTarget])

  useEffect(() => {
    if (!active) return
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss()
      if (e.key === "ArrowRight" || e.key === "ArrowDown") setStepIdx(i => Math.min(i + 1, STEPS.length - 1))
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") setStepIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [active, dismiss])

  if (!active || !rect || !bubblePos || !currentStep) return null

  const isLast = stepIdx === STEPS.length - 1

  return (
    <>
      <SpotlightOverlay rect={rect} />

      <AnimatePresence mode="wait">
        <GlowRing key={`ring-${stepIdx}`} rect={rect} />
      </AnimatePresence>

      <motion.div
        key={`bubble-${stepIdx}`}
        className="fixed pointer-events-none"
        style={{ left: bubblePos.x, top: bubblePos.y, width: BUBBLE_W, zIndex: 10000 }}
        initial={{ opacity: 0, scale: 0.94, y: bubblePos.arrowSide === "top" ? -8 : bubblePos.arrowSide === "bottom" ? 8 : 0, x: bubblePos.arrowSide === "left" ? -8 : bubblePos.arrowSide === "right" ? 8 : 0 }}
        animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
        exit={{ opacity: 0, scale: 0.94 }}
        transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
      >
        <div
          className="pointer-events-auto relative rounded-2xl overflow-hidden"
          style={{
            background: "linear-gradient(145deg, #161616 0%, #0f0f0f 100%)",
            border: "1px solid rgba(212,175,55,0.18)",
            boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 0 1px rgba(212,175,55,0.06)",
          }}
        >
          <Arrow side={bubblePos.arrowSide} />

          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, rgba(212,175,55,0.3), transparent)" }}
          />

          <div className="px-4 pt-4 pb-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-sm font-bold leading-snug" style={{ color: "#f0f0f0" }}>
                {currentStep.title}
              </h3>
              <button
                onClick={dismiss}
                className="shrink-0 p-0.5 rounded-md transition-colors mt-0.5"
                style={{ color: "#444" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#888")}
                onMouseLeave={e => (e.currentTarget.style.color = "#444")}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-xs leading-relaxed" style={{ color: "#777" }}>
              {currentStep.description}
            </p>
          </div>

          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
          >
            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStepIdx(i)}
                  className="rounded-full transition-all"
                  style={{
                    width: i === stepIdx ? 16 : 5,
                    height: 5,
                    background: i === stepIdx
                      ? "linear-gradient(90deg, #c9a227, #e8c547)"
                      : i < stepIdx
                      ? "rgba(212,175,55,0.35)"
                      : "rgba(255,255,255,0.1)",
                  }}
                />
              ))}
            </div>

            <div className="flex items-center gap-1.5">
              {stepIdx > 0 && (
                <button
                  onClick={() => setStepIdx(i => i - 1)}
                  className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all"
                  style={{ color: "#666", border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.03)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#aaa" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#666" }}
                >
                  <ChevronLeft className="w-3 h-3" />
                  Back
                </button>
              )}
              <button
                onClick={() => isLast ? dismiss() : setStepIdx(i => i + 1)}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08))",
                  border: "1px solid rgba(212,175,55,0.25)",
                  color: "#c9a227",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, rgba(212,175,55,0.25), rgba(212,175,55,0.15))" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "linear-gradient(135deg, rgba(212,175,55,0.15), rgba(212,175,55,0.08))" }}
              >
                {isLast ? "Done" : "Next"}
                {!isLast && <ChevronRight className="w-3 h-3" />}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <div
        className="fixed inset-0 pointer-events-auto"
        style={{ zIndex: 9997 }}
        onClick={dismiss}
      />
    </>
  )
}
