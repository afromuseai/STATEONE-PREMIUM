import { useState, useRef, useEffect } from "react"
import { Link, useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Bell, ChevronDown, LogOut, Settings, Sparkles, X, Menu, Globe, Check } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useLang, LANGUAGES } from "@/lib/i18n"
import { NotificationBell } from "./notification-bell"
import stageoneIcon from "@/assets/stageone-icon.png"

interface DashboardHeaderProps {
  onMenuToggle?: () => void
}

function SearchOverlay({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [, navigate] = useLocation()

  useEffect(() => { inputRef.current?.focus() }, [])

  const { t } = useLang()
  const d = t.dashboard

  const QUICK_LINKS = [
    { label: d.nav.businessIntelligence, href: "/business-intelligence", hint: "Generate AI analysis" },
    { label: d.nav.websiteGenerator, href: "/website-generator", hint: "Build your website" },
    { label: "AI Agent Store", href: "/agents", hint: "Browse 12 agents" },
    { label: d.nav.automationBuilder, href: "/automation-builder", hint: "Create workflows" },
    { label: "OS Command Center", href: "/os", hint: "Full system view" },
    { label: "AI Memory", href: "/memory", hint: "Your intelligence context" },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="rounded-2xl border border-border/30 bg-popover backdrop-blur-2xl shadow-[0_32px_80px_rgba(0,0,0,0.4)] overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/20">
            <Search className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <input
              ref={inputRef}
              placeholder={d.actions.search}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
              onKeyDown={e => { if (e.key === "Escape") onClose() }}
            />
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted/50 text-muted-foreground/40 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="p-2">
            <p className="text-[10px] text-muted-foreground/30 font-semibold uppercase tracking-widest px-2 pt-1.5 pb-1.5">{d.actions.searchShortcut}</p>
            {QUICK_LINKS.map(({ label, href, hint }) => (
              <button
                key={href}
                onClick={() => { navigate(href); onClose() }}
                className="w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/40 transition-colors text-left group"
              >
                <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
                <span className="text-[10px] text-muted-foreground/40">{hint}</span>
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function LangMenu() {
  const { lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  const current = LANGUAGES.find(l => l.code === lang)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-1.5 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 px-2 py-1.5 transition-all"
        title="Change language"
      >
        <Globe className="h-3.5 w-3.5 text-muted-foreground/70" />
        <span className="text-xs font-semibold text-muted-foreground/80 hidden sm:block">{current?.code.toUpperCase()}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-40 rounded-xl border border-white/8 bg-[#0e0e0e]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-50 overflow-hidden p-1"
          >
            {LANGUAGES.map(l => (
              <button
                key={l.code}
                onClick={() => { setLang(l.code); setOpen(false) }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <span className="text-base leading-none">{l.flag}</span>
                  <span className="text-xs text-muted-foreground hover:text-foreground">{l.label}</span>
                </span>
                {lang === l.code && <Check className="h-3 w-3 text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function UserMenu({ user, logout }: { user: { name: string; email: string } | null; logout: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  if (!user) return null
  const initials = (user.name || user.email)[0].toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/4 hover:bg-white/8 px-2.5 py-1.5 transition-all"
      >
        <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-black text-black">{initials}</span>
        </div>
        <span className="text-xs font-medium text-foreground hidden sm:block max-w-[100px] truncate">{user.name || user.email}</span>
        <ChevronDown className={`h-3 w-3 text-muted-foreground/50 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/8 bg-[#0e0e0e]/95 backdrop-blur-2xl shadow-[0_16px_48px_rgba(0,0,0,0.6)] z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-white/5">
              <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[10px] text-muted-foreground/50 truncate mt-0.5">{user.email}</p>
            </div>
            <div className="p-1.5 space-y-0.5">
              <Link href="/settings" onClick={() => setOpen(false)}>
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                  <Settings className="h-3.5 w-3.5" />
                  Settings
                </div>
              </Link>
              <button
                onClick={() => { logout(); setOpen(false) }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-red-500/10 text-sm text-muted-foreground hover:text-red-400 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function DashboardHeader({ onMenuToggle }: DashboardHeaderProps) {
  const { user, logout } = useAuth()
  const [searchOpen, setSearchOpen] = useState(false)
  const [, navigate] = useLocation()

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  return (
    <>
      <AnimatePresence>
        {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
      </AnimatePresence>

      <header className="relative z-30 flex h-14 shrink-0 items-center justify-between border-b border-white/5 bg-[#080808]/90 backdrop-blur-xl px-4 gap-4">
        {/* Left: Mobile menu + Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onMenuToggle}
            className="lg:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
          >
            <Menu className="h-4 w-4" />
          </button>
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-black shadow-[0_0_12px_rgba(212,175,55,0.35)]">
              <img src={stageoneIcon} alt="STAGEONE" className="h-5 w-5 object-contain" />
            </div>
            <span className="hidden sm:block text-sm font-black text-foreground tracking-tight">STAGEONE</span>
          </Link>
        </div>

        {/* Center: Search */}
        <div className="flex-1 max-w-xs">
          <button
            data-tour="search"
            onClick={() => setSearchOpen(true)}
            className="w-full flex items-center gap-2.5 rounded-xl border border-white/6 bg-white/3 hover:bg-white/6 px-3 py-1.5 text-left transition-all"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            <span className="text-xs text-muted-foreground/40 flex-1">Search or jump to...</span>
            <kbd className="hidden sm:flex items-center gap-1 text-[9px] text-muted-foreground/25 border border-white/5 rounded px-1 py-0.5">⌘K</kbd>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            data-tour="new-analysis"
            onClick={() => navigate("/business-intelligence?_r=" + Date.now())}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-primary/25 bg-primary/8 hover:bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary transition-all cursor-pointer"
          >
            <Sparkles className="h-3 w-3" />
            <span>New Analysis</span>
          </button>
          <div data-tour="lang-menu"><LangMenu /></div>
          <div data-tour="notifications"><NotificationBell /></div>
          <div data-tour="user-menu"><UserMenu user={user} logout={logout} /></div>
        </div>
      </header>
    </>
  )
}
