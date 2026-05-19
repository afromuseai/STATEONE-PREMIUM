import { useEffect } from "react"
import { Link, useLocation, useSearch } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import stageoneIcon from "@/assets/stageone-icon.png"
import {
  FolderOpen,
  Sparkles,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  BarChart3,
  Bot,
  Workflow,
  Brain,
  X,
  LayoutDashboard,
  Shield,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"

interface AppSidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const NAV_SECTIONS = [
  {
    label: "Generate",
    items: [
      { href: "/dashboard?tab=new", icon: BarChart3, label: "Business Intelligence" },
      { href: "/website-generator", icon: Globe, label: "Website Generator" },
      { href: "/chatbot-generator", icon: Bot, label: "AI Chatbot Generator" },
      { href: "/automation-builder", icon: Workflow, label: "Automation Builder" },
    ],
  },
  {
    label: "Orchestrate",
    items: [
      { href: "/orchestrator", icon: Brain, label: "AI Orchestrator" },
    ],
  },
  {
    label: "Manage",
    items: [
      { href: "/dashboard?tab=projects", icon: FolderOpen, label: "Projects" },
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
]

function SidebarContent({
  collapsed,
  onToggle,
  isMobile = false,
  onMobileClose,
}: {
  collapsed: boolean
  onToggle: () => void
  isMobile?: boolean
  onMobileClose?: () => void
}) {
  const { user, logout } = useAuth()
  const isAdmin = user?.isAdmin ?? false
  const [location] = useLocation()
  const search = useSearch()

  const isActive = (href: string) => {
    const base = href.split("?")[0]
    const tab = new URLSearchParams(href.split("?")[1] ?? "").get("tab")
    if (base === "/dashboard" && tab) {
      const currentTab = new URLSearchParams(search).get("tab")
      return location === "/dashboard" && currentTab === tab
    }
    return location === base || (base !== "/dashboard" && location.startsWith(base))
  }

  const effectiveCollapsed = collapsed && !isMobile

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-white/5 px-4 shrink-0">
        <AnimatePresence mode="wait">
          {!effectiveCollapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Link href="/" className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black shadow-[0_0_12px_rgba(212,175,55,0.4)]">
                  <img src={stageoneIcon} alt="STAGEONE" className="h-6 w-6 object-contain" />
                </div>
                <div>
                  <span className="text-sm font-black text-foreground tracking-tight">STAGEONE</span>
                  <div className="text-[9px] text-muted-foreground/50 tracking-wider uppercase">AI Operating System</div>
                </div>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
        {effectiveCollapsed && (
          <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-lg bg-black mx-auto shadow-[0_0_12px_rgba(212,175,55,0.3)]">
            <img src={stageoneIcon} alt="STAGEONE" className="h-6 w-6 object-contain" />
          </Link>
        )}
        {isMobile ? (
          <button
            onClick={onMobileClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        ) : !effectiveCollapsed ? (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {/* Dashboard top-level link */}
        {(() => {
          const dashActive = location === "/dashboard" && !new URLSearchParams(search).get("tab")
          return (
            <Link href="/dashboard">
              <div
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer group relative mb-1 ${
                  dashActive
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_12px_rgba(212,175,55,0.05)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"
                } ${effectiveCollapsed ? "justify-center" : ""}`}
              >
                <LayoutDashboard
                  className={`h-4 w-4 shrink-0 transition-colors ${dashActive ? "text-primary" : "group-hover:text-foreground"}`}
                />
                <AnimatePresence mode="wait">
                  {!effectiveCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -6 }}
                      transition={{ duration: 0.12 }}
                      className="truncate flex-1 text-xs"
                    >
                      Dashboard
                    </motion.span>
                  )}
                </AnimatePresence>
                {dashActive && !effectiveCollapsed && (
                  <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(212,175,55,0.6)] shrink-0" />
                )}
                {effectiveCollapsed && (
                  <div className="pointer-events-none absolute left-full ml-3 hidden group-hover:flex items-center z-50">
                    <div className="rounded-lg border border-white/10 bg-[#0e0e0e]/95 backdrop-blur px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-xl">
                      Dashboard
                    </div>
                  </div>
                )}
              </div>
            </Link>
          )
        })()}

        {NAV_SECTIONS.map((section) => (
          <div key={section.label}>
            {!effectiveCollapsed && (
              <div className="px-2 pt-3 pb-1">
                <p className="text-[8px] font-black text-muted-foreground/35 uppercase tracking-[0.15em]">
                  {section.label}
                </p>
              </div>
            )}
            {effectiveCollapsed && <div className="my-1 mx-2 h-px bg-white/5" />}

            <div className="space-y-0.5">
              {section.items.map(({ href, icon: Icon, label }) => {
                const active = isActive(href)
                return (
                  <Link key={href + label} href={href}>
                    <div
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer group relative ${
                        active
                          ? "bg-primary/10 text-primary border border-primary/20 shadow-[inset_0_0_12px_rgba(212,175,55,0.05)]"
                          : "text-muted-foreground hover:text-foreground hover:bg-white/4 border border-transparent"
                      } ${effectiveCollapsed ? "justify-center" : ""}`}
                    >
                      <Icon
                        className={`h-4 w-4 shrink-0 transition-colors ${
                          active ? "text-primary" : "group-hover:text-foreground"
                        }`}
                      />
                      <AnimatePresence mode="wait">
                        {!effectiveCollapsed && (
                          <motion.span
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            transition={{ duration: 0.12 }}
                            className="truncate flex-1 text-xs"
                          >
                            {label}
                          </motion.span>
                        )}
                      </AnimatePresence>
                      {active && !effectiveCollapsed && (
                        <div className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_6px_rgba(212,175,55,0.6)] shrink-0" />
                      )}
                      {/* Tooltip for collapsed state */}
                      {effectiveCollapsed && (
                        <div className="pointer-events-none absolute left-full ml-3 hidden group-hover:flex items-center z-50">
                          <div className="rounded-lg border border-white/10 bg-[#0e0e0e]/95 backdrop-blur px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-xl">
                            {label}
                          </div>
                        </div>
                      )}
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Admin link — only visible to admin users */}
      {isAdmin && (
        <div className="px-2 pb-1">
          <Link href="/admin">
            <div className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all cursor-pointer group relative border ${
              location === "/admin"
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "text-muted-foreground hover:text-red-400 hover:bg-red-500/5 border-transparent"
            } ${effectiveCollapsed ? "justify-center" : ""}`}>
              <Shield className={`h-4 w-4 shrink-0 ${location === "/admin" ? "text-red-400" : "group-hover:text-red-400"}`} />
              <AnimatePresence mode="wait">
                {!effectiveCollapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -6 }}
                    transition={{ duration: 0.12 }}
                    className="truncate flex-1 text-xs"
                  >
                    Admin Panel
                  </motion.span>
                )}
              </AnimatePresence>
              {effectiveCollapsed && (
                <div className="pointer-events-none absolute left-full ml-3 hidden group-hover:flex items-center z-50">
                  <div className="rounded-lg border border-white/10 bg-[#0e0e0e]/95 backdrop-blur px-2.5 py-1.5 text-xs text-foreground whitespace-nowrap shadow-xl">
                    Admin Panel
                  </div>
                </div>
              )}
            </div>
          </Link>
        </div>
      )}

      {/* Quick action CTA */}
      {!effectiveCollapsed && (
        <div className="px-3 pb-2">
          <Link href="/dashboard?tab=new">
            <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/8 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/15 transition-all cursor-pointer">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              <span>New Analysis</span>
            </div>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="border-t border-white/5 p-3 shrink-0">
        <div className={`flex items-center gap-3 ${effectiveCollapsed ? "justify-center" : ""}`}>
          {user && !effectiveCollapsed && (
            <>
              <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-bold text-primary">
                  {(user.name ?? user.email)[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground/60 truncate">{user.email}</p>
              </div>
            </>
          )}
          <button
            onClick={() => logout()}
            className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppSidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const [location] = useLocation()

  // Auto-close mobile drawer on navigation
  useEffect(() => {
    onMobileClose?.()
  }, [location])

  return (
    <>
      {/* Desktop sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: collapsed ? 64 : 248 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden lg:flex h-full flex-col border-r border-white/5 bg-[#080808] relative shrink-0 overflow-hidden"
      >
        {collapsed && (
          <button
            onClick={onToggle}
            className="absolute -right-3 top-[60px] z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground transition-colors shadow-sm"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
        <SidebarContent
          collapsed={collapsed}
          onToggle={onToggle}
          isMobile={false}
        />
      </motion.aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              onClick={onMobileClose}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              className="lg:hidden fixed left-0 top-0 z-50 h-full w-64 border-r border-white/8 bg-[#080808] flex flex-col shadow-2xl"
            >
              <SidebarContent
                collapsed={false}
                onToggle={onToggle}
                isMobile={true}
                onMobileClose={onMobileClose}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
