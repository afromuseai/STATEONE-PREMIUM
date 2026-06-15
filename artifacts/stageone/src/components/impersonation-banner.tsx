import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { AlertTriangle, LogOut, User, Clock } from "lucide-react"
import { useImpersonation } from "@/lib/impersonation-context"
import { useState, useEffect } from "react"

function formatTimeLeft(expiresAt: number): string {
  const ms = expiresAt - Date.now()
  if (ms <= 0) return "expired"
  const min = Math.floor(ms / 60000)
  const sec = Math.floor((ms % 60000) / 1000)
  return min > 0 ? `${min}m ${sec}s` : `${sec}s`
}

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation } = useImpersonation()
  const [, setLocation] = useLocation()
  const [timeLeft, setTimeLeft] = useState("")
  const [stopping, setStopping] = useState(false)

  useEffect(() => {
    if (!impersonation.active || !impersonation.expiresAt) return
    setTimeLeft(formatTimeLeft(impersonation.expiresAt))
    const id = setInterval(() => {
      if (!impersonation.expiresAt) return
      const remaining = impersonation.expiresAt - Date.now()
      if (remaining <= 0) {
        setTimeLeft("expired")
        clearInterval(id)
      } else {
        setTimeLeft(formatTimeLeft(impersonation.expiresAt))
      }
    }, 1000)
    return () => clearInterval(id)
  }, [impersonation.active, impersonation.expiresAt])

  const handleStop = async () => {
    setStopping(true)
    await stopImpersonation()
    setStopping(false)
    setLocation("/admin")
  }

  return (
    <AnimatePresence>
      {impersonation.active && impersonation.targetUser && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="relative z-[9999] overflow-hidden"
          style={{ boxShadow: "0 0 0 2px rgba(239,68,68,0.5)" }}
        >
          <div className="bg-red-500/95 backdrop-blur-sm px-4 py-2.5 flex items-center justify-between gap-4">
            {/* Left: info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex items-center gap-1.5 bg-red-600/60 border border-red-400/40 rounded-full px-2.5 py-1 shrink-0">
                <AlertTriangle className="h-3 w-3 text-white" />
                <span className="text-[10px] font-black text-white uppercase tracking-widest">Impersonating</span>
              </div>
              <div className="flex items-center gap-2 min-w-0">
                <User className="h-3.5 w-3.5 text-white/80 shrink-0" />
                <span className="text-sm font-bold text-white truncate">
                  {impersonation.targetUser.name}
                </span>
                <span className="text-xs text-red-100/80 truncate hidden sm:block">
                  {impersonation.targetUser.email}
                </span>
              </div>
              {impersonation.reason && (
                <span className="text-xs text-red-100/70 truncate hidden md:block">
                  · {impersonation.reason}
                </span>
              )}
            </div>

            {/* Right: timer + exit */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-red-100/80">
                <Clock className="h-3 w-3" />
                <span className="font-mono">{timeLeft}</span>
              </div>
              <button
                onClick={handleStop}
                disabled={stopping}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-red-600 text-xs font-black hover:bg-red-50 transition-colors disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" />
                {stopping ? "Exiting…" : "Exit Impersonation"}
              </button>
            </div>
          </div>

          {/* Red border indicator on entire viewport */}
          <div
            className="pointer-events-none fixed inset-0 z-[9998]"
            style={{ boxShadow: "inset 0 0 0 3px rgba(239,68,68,0.35)" }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
