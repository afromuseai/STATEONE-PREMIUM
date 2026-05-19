import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUp } from "lucide-react"

export function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="back-to-top"
          initial={{ opacity: 0, scale: 0.8, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 12 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-8 right-8 z-50 w-11 h-11 rounded-full flex items-center justify-center cursor-pointer border border-white/10 backdrop-blur-md shadow-lg"
          style={{
            background: "oklch(0.08 0 0 / 0.85)",
          }}
          whileHover={{
            scale: 1.1,
            boxShadow: "0 0 20px oklch(0.75 0.12 85 / 0.35)",
            borderColor: "oklch(0.75 0.12 85 / 0.4)",
          }}
          whileTap={{ scale: 0.93 }}
          aria-label="Back to top"
        >
          <ArrowUp className="w-4 h-4 text-primary" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
