import type { ReactNode } from "react"

export function StudioHeader({ children }: { children: ReactNode }) {
  return (
    <header className="flex-shrink-0 w-full bg-[#1A1A1A] z-10">
      {children}
    </header>
  )
}
