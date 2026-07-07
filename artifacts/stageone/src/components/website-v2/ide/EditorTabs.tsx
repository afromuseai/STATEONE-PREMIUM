import { X, Eye } from "lucide-react"
import { motion } from "framer-motion"
import type { OpenTab } from "./StudioShell"

function fileIcon(label: string): string {
  if (label.endsWith(".tsx") || label.endsWith(".ts")) return "TS"
  if (label.endsWith(".css")) return "CSS"
  if (label.endsWith(".json")) return "JSON"
  if (label.endsWith(".md")) return "MD"
  return "TXT"
}

function fileIconColor(label: string): string {
  if (label.endsWith(".tsx") || label.endsWith(".ts")) return "#60a5fa"
  if (label.endsWith(".css")) return "#f472b6"
  if (label.endsWith(".json")) return "#fbbf24"
  return "#9ca3af"
}

interface EditorTabsProps {
  tabs: OpenTab[]
  activeTabId: string
  onTabClick: (id: string) => void
  onTabClose: (id: string) => void
}

export function EditorTabs({ tabs, activeTabId, onTabClick, onTabClose }: EditorTabsProps) {
  return (
    <div className="flex h-9 flex-shrink-0 items-stretch overflow-x-auto border-b border-white/[0.07] bg-[#0d0d0d]"
      style={{ scrollbarWidth: "none" }}>
      {tabs.map((tab) => {
        const active = tab.id === activeTabId
        const isPreview = tab.id === "preview"

        return (
          <motion.button
            key={tab.id}
            layout
            onClick={() => onTabClick(tab.id)}
            className={`group relative flex h-full flex-shrink-0 items-center gap-1.5 border-r border-white/[0.06] px-3 text-[12px] transition-colors duration-100
              ${active
                ? "bg-[#141414] text-white/90"
                : "text-white/40 hover:bg-white/[0.03] hover:text-white/70"
              }`}
          >
            {/* Active indicator */}
            {active && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute inset-x-0 top-0 h-[2px] bg-amber-400"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}

            {/* Icon */}
            {isPreview ? (
              <Eye className="h-3 w-3 flex-shrink-0 text-amber-400/70" />
            ) : (
              <span
                className="flex-shrink-0 rounded text-[9px] font-bold px-0.5"
                style={{ color: fileIconColor(tab.label), background: `${fileIconColor(tab.label)}18` }}
              >
                {fileIcon(tab.label)}
              </span>
            )}

            <span className="max-w-[120px] truncate font-medium">{tab.label}</span>

            {/* Close button — must be a div, not a button (tab itself is already a button) */}
            {!isPreview && (
              <div
                role="button"
                tabIndex={-1}
                onClick={(e) => { e.stopPropagation(); onTabClose(tab.id) }}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); onTabClose(tab.id) } }}
                className={`ml-0.5 flex h-4 w-4 flex-shrink-0 cursor-pointer items-center justify-center rounded transition-all
                  ${active
                    ? "text-white/40 hover:bg-white/10 hover:text-white/80"
                    : "text-transparent group-hover:text-white/30 group-hover:hover:text-white/70"
                  }`}
              >
                <X className="h-2.5 w-2.5" />
              </div>
            )}
          </motion.button>
        )
      })}
    </div>
  )
}
