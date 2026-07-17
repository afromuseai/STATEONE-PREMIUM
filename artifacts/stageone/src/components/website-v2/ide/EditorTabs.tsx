import { X, Eye } from "lucide-react"
import { motion } from "framer-motion"
import type { OpenTab, WorkspaceMode } from "./StudioShell"

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

/** Return the icon element for special (non-file) tabs. */
function SpecialTabIcon({ tabId }: { tabId: string }) {
  if (tabId === "preview") return <Eye className="h-3 w-3 flex-shrink-0 text-[#ECECEC]/30" />
  return null
}

interface EditorTabsProps {
  tabs:          OpenTab[]
  activeTabId:   string
  workspaceMode: WorkspaceMode
  onTabClick:    (id: string) => void
  onTabClose:    (id: string) => void
}

export function EditorTabs({
  tabs, activeTabId, onTabClick, onTabClose,
}: EditorTabsProps) {
  // The Terminal already has its own dedicated card/mode above (top command
  // bar) — it should never grow a duplicate tab here, even defensively.
  const visibleTabs = tabs.filter((t) => t.id !== "terminal")

  return (
    <div
      role="tablist"
      aria-label="Editor tabs"
      className="flex h-9 flex-shrink-0 items-end gap-1 overflow-x-auto border-b border-[rgba(255,255,255,0.08)] bg-[#151515] px-2 pt-1.5"
      style={{ scrollbarWidth: "none" }}
    >
      {visibleTabs.map((tab) => {
        const active      = tab.id === activeTabId
        const isSpecial   = tab.id === "preview"
        const badge       = isSpecial ? null : fileBadge(tab.label)
        const canClose    = !tab.pinned

        return (
          // Outer div so the close <button> inside is never nested inside a <button>
          <motion.div
            key={tab.id}
            layout
            role="tab"
            tabIndex={active ? 0 : -1}
            aria-selected={active}
            aria-controls={`editor-panel-${tab.id}`}
            onClick={() => onTabClick(tab.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onTabClick(tab.id)
              }
            }}
            className={`group relative flex h-full flex-shrink-0 cursor-pointer items-center gap-1.5 select-none
              rounded-t-lg px-3 text-[11.5px] transition-all duration-100
              ${active
                ? "bg-[#1A1A1A] text-[#ECECEC] shadow-[0_-1px_0_rgba(255,255,255,0.08)]"
                : "text-[#ECECEC]/28 hover:bg-[#232323] hover:text-[#ECECEC]/55"
              }`}
          >
            {/* Active indicator — active top border, shared layout-id so it slides */}
            {active && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-x-1 top-0 h-[1.5px] rounded-full bg-[#ECECEC]"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}

            {/* Icon */}
            {isSpecial ? (
              <SpecialTabIcon tabId={tab.id} />
            ) : badge ? (
              <span
                className="flex-shrink-0 rounded-sm px-[3px] text-[9px] font-bold"
                style={{ color: badge.color, background: `${badge.color}1a` }}
              >
                {badge.badge}
              </span>
            ) : null}

            <span className="max-w-[120px] truncate font-medium">{tab.label}</span>

            {/* Close button — only for non-pinned tabs */}
            {canClose && (
              <button
                type="button"
                tabIndex={0}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                aria-label={`Close ${tab.label}`}
                className={`ml-0.5 flex h-[14px] w-[14px] flex-shrink-0 items-center justify-center
                  rounded transition-all focus-visible:outline focus-visible:outline-white/60
                  ${active
                    ? "text-[#ECECEC]/30 hover:bg-[#252525] hover:text-[#ECECEC]"
                    : "text-transparent group-hover:text-[#ECECEC]/25 group-hover:hover:text-[#ECECEC]/60"
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
