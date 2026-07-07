import { X, Eye } from "lucide-react"
import { motion } from "framer-motion"
import type { OpenTab } from "./StudioShell"

// ─── File type badge ───────────────────────────────────────────────────────────
const EXT_MAP: Record<string, { badge: string; color: string }> = {
  tsx:  { badge: "TSX",  color: "#60a5fa" },
  ts:   { badge: "TS",   color: "#60a5fa" },
  jsx:  { badge: "JSX",  color: "#86efac" },
  js:   { badge: "JS",   color: "#fbbf24" },
  css:  { badge: "CSS",  color: "#f472b6" },
  scss: { badge: "SCSS", color: "#f472b6" },
  json: { badge: "JSON", color: "#fbbf24" },
  md:   { badge: "MD",   color: "#a3e635" },
  html: { badge: "HTML", color: "#fb923c" },
}

function fileBadge(label: string) {
  const ext = label.split(".").pop()?.toLowerCase() ?? ""
  return EXT_MAP[ext] ?? { badge: "TXT", color: "#9ca3af" }
}

interface EditorTabsProps {
  tabs:        OpenTab[]
  activeTabId: string
  onTabClick:  (id: string) => void
  onTabClose:  (id: string) => void
}

export function EditorTabs({ tabs, activeTabId, onTabClick, onTabClose }: EditorTabsProps) {
  return (
    <div
      className="flex h-8 flex-shrink-0 items-stretch overflow-x-auto border-b border-white/[0.06] bg-[#0d0d0d]"
      style={{ scrollbarWidth: "none" }}
    >
      {tabs.map((tab) => {
        const active    = tab.id === activeTabId
        const isPreview = tab.id === "preview"
        const badge     = isPreview ? null : fileBadge(tab.label)

        return (
          // Outer is a div so the close <button> inside is not nested inside a <button>
          <motion.div
            key={tab.id}
            layout
            role="button"
            tabIndex={0}
            onClick={() => onTabClick(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onTabClick(tab.id)
              }
            }}
            className={`group relative flex h-full flex-shrink-0 cursor-pointer items-center gap-1.5 select-none border-r border-white/[0.05] px-3 text-[11.5px] transition-colors duration-75
              ${active
                ? "bg-[#0e0e0e] text-white/80"
                : "text-white/30 hover:bg-white/[0.025] hover:text-white/60"
              }`}
          >
            {/* Active indicator — amber top border */}
            {active && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-x-0 top-0 h-[1.5px] bg-amber-400/80"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}

            {/* Icon */}
            {isPreview ? (
              <Eye className="h-3 w-3 flex-shrink-0 text-white/30" />
            ) : badge ? (
              <span
                className="flex-shrink-0 rounded-sm px-[3px] text-[9px] font-bold"
                style={{ color: badge.color, background: `${badge.color}1a` }}
              >
                {badge.badge}
              </span>
            ) : null}

            <span className="max-w-[120px] truncate font-medium">{tab.label}</span>

            {/* Close button — proper <button> (parent is a div, no nesting violation) */}
            {!isPreview && (
              <button
                type="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                aria-label={`Close ${tab.label}`}
                className={`ml-0.5 flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center rounded transition-all focus-visible:outline focus-visible:outline-amber-400/60
                  ${active
                    ? "text-white/30 hover:bg-white/[0.08] hover:text-white/70"
                    : "text-transparent group-hover:text-white/25 group-hover:hover:text-white/60"
                  }`}
              >
                <X className="h-[9px] w-[9px]" />
              </button>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
