import { useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Cpu, FolderOpen, Users, Settings, ChevronLeft } from "lucide-react"
import type { SideView } from "./StudioShell"

interface ActivityBarProps {
  activeSideView: SideView
  onSetSideView:  (v: SideView) => void
}

interface NavItem {
  id:    SideView
  icon:  React.ElementType
  label: string
}

const TOP_ITEMS: NavItem[] = [
  { id: "marcus",        icon: Cpu,        label: "Marcus AI"     },
  { id: "explorer",      icon: FolderOpen, label: "Explorer"      },
  { id: "collaboration", icon: Users,      label: "Collaboration" },
]

/**
 * A 40px VS Code–style activity bar with roving-tabindex keyboard model.
 *
 * Keyboard contract (WAI-ARIA toolbar pattern):
 *   - Arrow Up / Arrow Down moves focus between items.
 *   - Enter / Space activates the focused item.
 *   - Tab leaves the toolbar entirely.
 */
export function ActivityBar({ activeSideView, onSetSideView }: ActivityBarProps) {
  // Refs to each focusable button so we can shift focus programmatically
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent, idx: number) => {
      const total = TOP_ITEMS.length  // now 3 items
      if (e.key === "ArrowDown" || e.key === "ArrowRight") {
        e.preventDefault()
        itemRefs.current[(idx + 1) % total]?.focus()
      } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
        e.preventDefault()
        itemRefs.current[(idx - 1 + total) % total]?.focus()
      }
    },
    [],
  )

  return (
    <div
      className="relative z-10 flex w-10 flex-shrink-0 flex-col items-center
        border-r border-white/[0.04] bg-[#080808] py-1.5"
    >
      {/* Top nav — roving tabindex toolbar */}
      <div
        role="toolbar"
        aria-label="Activity bar"
        aria-orientation="vertical"
        className="flex flex-col gap-0.5 w-full px-1"
      >
        {TOP_ITEMS.map(({ id, icon: Icon, label }, idx) => {
          const active = activeSideView === id
          const tabIndex = active || (activeSideView === null && idx === 0) ? 0 : -1

          return (
            <button
              key={id}
              ref={(el) => { itemRefs.current[idx] = el }}
              tabIndex={tabIndex}
              title={label}
              aria-label={label}
              aria-pressed={active}
              onClick={() => onSetSideView(active ? null : id)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={`group relative flex h-8 w-8 items-center justify-center rounded-lg
                transition-all duration-150
                ${active
                  ? "bg-amber-400/8 text-amber-400/90"
                  : "text-white/25 hover:bg-white/[0.04] hover:text-white/60"
                }`}
            >
              {/* Active accent — left stripe */}
              {active && (
                <motion.div
                  layoutId="activity-accent"
                  className="pointer-events-none absolute -left-1 inset-y-1.5 w-[2px]
                    rounded-r bg-amber-400"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
              <Icon className="h-[15px] w-[15px]" aria-hidden="true" />
            </button>
          )
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom utilities */}
      <div className="flex flex-col gap-0.5 w-full px-1 pb-1">
        <button
          title="Settings"
          aria-label="Settings"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-white/16
            transition-all hover:bg-white/[0.04] hover:text-white/50"
        >
          <Settings className="h-[15px] w-[15px]" aria-hidden="true" />
        </button>

        {activeSideView && (
          <button
            title="Collapse sidebar (⌘B)"
            aria-label="Collapse sidebar"
            onClick={() => onSetSideView(null)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/12
              transition-all hover:bg-white/[0.04] hover:text-white/42"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
