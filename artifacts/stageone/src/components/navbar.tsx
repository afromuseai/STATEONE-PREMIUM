import { Link } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { LayoutDashboard, Sun, Moon, Globe, Check, ChevronDown } from "lucide-react"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"
import { useAuth } from "@/lib/auth-context"
import { useTheme } from "@/lib/theme-context"
import { useLang, LANGUAGES, type Lang } from "@/lib/i18n"
import { useState, useRef, useEffect } from "react"

export function Navbar() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { lang, setLang, t } = useLang()
  const [langOpen, setLangOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setLangOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const currentLang = LANGUAGES.find((l) => l.code === lang)!

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 border-b backdrop-blur-xl transition-colors duration-300"
      style={{
        borderColor: "var(--lp-border-sub)",
        background: "var(--lp-nav-bg)",
      }}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <img src={logoImg} alt="STAGEONE" className="h-9 w-auto object-contain" />
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-foreground hidden sm:block">
            STAGEONE
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <a href="/#features" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.features}
          </a>
          <a href="/#how-it-works" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.howItWorks}
          </a>
          <Link href="/pricing" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            {t.nav.pricing}
          </Link>
        </div>

        {/* Agent Marcus badge — centred in the gap between nav links and controls */}
        <img
          src="/agent-marcus-badge.png"
          alt="Agent Marcus"
          className="hidden md:block w-48 h-auto object-contain opacity-90 hover:opacity-100 transition-opacity"
        />

        <div className="flex items-center gap-2">
          {/* Theme toggle */}
          <motion.button
            onClick={toggleTheme}
            whileTap={{ scale: 0.92 }}
            className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-muted"
            aria-label="Toggle theme"
          >
            <AnimatePresence mode="wait" initial={false}>
              {theme === "dark" ? (
                <motion.span
                  key="sun"
                  initial={{ opacity: 0, rotate: -30, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 30, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Sun className="h-4 w-4 text-muted-foreground" />
                </motion.span>
              ) : (
                <motion.span
                  key="moon"
                  initial={{ opacity: 0, rotate: 30, scale: 0.8 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: -30, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <Moon className="h-4 w-4 text-muted-foreground" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>

          {/* Language picker */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setLangOpen((o) => !o)}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Globe className="h-3.5 w-3.5" />
              <span className="hidden sm:block font-medium">{currentLang.flag} {currentLang.code.toUpperCase()}</span>
              <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${langOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {langOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-44 rounded-xl border shadow-xl overflow-hidden z-50"
                  style={{
                    background: "var(--popover)",
                    borderColor: "var(--border)",
                    boxShadow: "0 16px 40px rgba(0,0,0,0.2)",
                  }}
                >
                  {LANGUAGES.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { setLang(l.code as Lang); setLangOpen(false) }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-sm transition-colors hover:bg-muted"
                      style={{ color: lang === l.code ? "var(--primary)" : "var(--foreground)" }}
                    >
                      <span className="flex items-center gap-2.5">
                        <span>{l.flag}</span>
                        <span className="font-medium">{l.label}</span>
                      </span>
                      {lang === l.code && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Auth buttons */}
          {user ? (
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 gold-glow"
            >
              <LayoutDashboard className="h-4 w-4" />
              {t.nav.dashboard}
            </Link>
          ) : (
            <>
              <Link href="/login" className="hidden sm:inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                {t.nav.signIn}
              </Link>
              <Link
                href="/signup"
                className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 gold-glow"
              >
                {t.nav.startBuilding}
              </Link>
            </>
          )}
        </div>
      </nav>
    </motion.header>
  )
}
