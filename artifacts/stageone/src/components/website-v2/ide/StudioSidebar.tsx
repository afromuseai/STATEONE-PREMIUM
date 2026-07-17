import type { ReactNode } from "react"

export function StudioSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex h-full flex-shrink-0 bg-[#202020] border-r border-[rgba(255,255,255,0.08)] overflow-hidden">
      {children}
    </aside>
  )
}
