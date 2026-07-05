/**
 * DashboardShell — persistent sidebar layout for all authenticated routes.
 *
 * Lives outside the AnimatePresence boundary so AppSidebar never unmounts
 * during tab navigation. Sidebar collapsed state is persisted to localStorage
 * so it survives full page reloads too.
 *
 * Pages that need to read `collapsed` (e.g. to offset an absolute overlay)
 * or open the mobile sidebar can import `useDashboardShell`.
 */

import { createContext, useContext, useState } from "react"
import { AppSidebar } from "./app-sidebar"

interface DashboardShellContextValue {
  collapsed: boolean
  mobileOpen: boolean
  setMobileOpen: (open: boolean | ((prev: boolean) => boolean)) => void
}

const DashboardShellContext = createContext<DashboardShellContextValue>({
  collapsed: false,
  mobileOpen: false,
  setMobileOpen: () => {},
})

export function useDashboardShell(): DashboardShellContextValue {
  return useContext(DashboardShellContext)
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true" } catch { return false }
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem("sidebar-collapsed", String(next)) } catch {}
      return next
    })
  }

  return (
    <DashboardShellContext.Provider value={{ collapsed, mobileOpen, setMobileOpen }}>
      <div className="flex h-screen overflow-hidden bg-[#080808] text-foreground">
        <AppSidebar
          collapsed={collapsed}
          onToggle={toggle}
          mobileOpen={mobileOpen}
          onMobileClose={() => setMobileOpen(false)}
        />
        <div className="flex flex-1 min-w-0 overflow-hidden">
          {children}
        </div>
      </div>
    </DashboardShellContext.Provider>
  )
}
