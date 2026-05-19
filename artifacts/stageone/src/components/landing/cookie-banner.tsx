import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import { Link } from "wouter"

const STORAGE_KEY = "stageone_cookie_consent"

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, "accepted")
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, "declined")
    setVisible(false)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="cookie-banner"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl"
        >
          <div
            className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-2xl border border-white/10 px-5 py-4 shadow-2xl backdrop-blur-xl"
            style={{ background: "oklch(0.08 0 0 / 0.92)" }}
          >
            {/* Close */}
            <button
              onClick={decline}
              className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            {/* Cookie icon */}
            <div className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: "oklch(0.75 0.12 85 / 0.12)" }}>
              🍪
            </div>

            {/* Text */}
            <p className="text-xs text-muted-foreground leading-relaxed flex-1 pr-4">
              We use cookies to enhance your experience, analyse traffic, and personalise content.{" "}
              <Link href="/privacy" className="text-primary/80 hover:text-primary underline underline-offset-2 transition-colors">
                Privacy Policy
              </Link>
            </p>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={decline}
                className="text-xs px-3.5 py-1.5 rounded-lg border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-all duration-200"
              >
                Decline
              </button>
              <motion.button
                onClick={accept}
                whileHover={{ boxShadow: "0 0 18px oklch(0.75 0.12 85 / 0.4)" }}
                whileTap={{ scale: 0.96 }}
                className="text-xs px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-semibold transition-all duration-200"
              >
                Accept all
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
