import type { ReactNode } from "react"

export function StudioWorkspace({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-w-0 flex-1 flex-col h-full overflow-hidden bg-[#1A1A1A]">
      {children}
    </main>
  )
}
