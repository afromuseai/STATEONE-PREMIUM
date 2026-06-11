import { useState, useEffect } from "react"
import { Link, useLocation } from "wouter"
import { motion } from "framer-motion"
import { ThemeWrapper } from "@/lib/theme-context"
import { Lock, ArrowRight, Eye, EyeOff, CheckCircle, AlertCircle } from "lucide-react"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [, setLocation] = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setToken(params.get("token"))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (password !== confirm) {
      setError("Passwords do not match")
      return
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      return
    }
    if (!token) {
      setError("Invalid or missing reset token")
      return
    }
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Something went wrong")
      } else {
        setSuccess(true)
        setTimeout(() => setLocation("/login"), 3000)
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token) {
    return (
      <ThemeWrapper>
        <div className="flex items-center justify-center" style={{ minHeight: "100vh", background: "var(--background)" }}>
          <div className="text-center max-w-sm px-6">
            <div className="flex justify-center mb-4">
              <AlertCircle className="w-10 h-10 text-red-400" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Invalid reset link</h1>
            <p className="text-sm text-muted-foreground mb-6">This password reset link is missing a token. Please request a new one.</p>
            <Link href="/forgot-password">
              <button className="text-sm text-primary hover:underline">Request a new link</button>
            </Link>
          </div>
        </div>
      </ThemeWrapper>
    )
  }

  return (
    <ThemeWrapper>
      <div className="flex" style={{ minHeight: "100vh", background: "var(--background)" }}>
        <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
          <Link href="/" className="absolute top-6 left-8 z-20 flex items-center gap-2">
            <img src={logoImg} alt="STAGEONE" className="h-7 w-auto object-contain" />
            <span className="text-sm font-bold tracking-[0.25em] uppercase text-foreground">STAGEONE</span>
          </Link>

          <div className="pointer-events-none absolute inset-0">
            <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
              <defs>
                <pattern id="rprg" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0L0 0 0 40" fill="none" stroke="oklch(0.75 0.12 85)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#rprg)"/>
            </svg>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-sm relative"
          >
            {success ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="text-center"
              >
                <div className="flex justify-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-primary" />
                  </div>
                </div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Password updated</h1>
                <p className="text-sm text-muted-foreground">
                  Your password has been reset. Redirecting you to sign in…
                </p>
              </motion.div>
            ) : (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-foreground mb-1.5">Set a new password</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your new password below. It must be at least 6 characters.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-lg border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-400"
                    >
                      {error}
                    </motion.div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">New password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        required
                        className="w-full rounded-xl pl-10 pr-11 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                        style={{ border: "1px solid var(--border)", background: "var(--input)" }}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Confirm new password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Repeat your password"
                        required
                        className="w-full rounded-xl pl-10 pr-11 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                        style={{ border: "1px solid var(--border)", background: "var(--input)" }}
                      />
                      <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors">
                        {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <motion.button
                    type="submit"
                    disabled={isLoading}
                    whileHover={!isLoading ? { scale: 1.015, boxShadow: "0 0 32px oklch(0.75 0.12 85 / 0.5), 0 8px 24px rgba(0,0,0,0.4)" } : {}}
                    whileTap={!isLoading ? { scale: 0.985 } : {}}
                    className="relative w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground flex items-center justify-center gap-2 transition-all duration-200 gold-glow disabled:opacity-50 disabled:cursor-not-allowed mt-2 overflow-hidden"
                  >
                    {!isLoading && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                        initial={{ x: "-100%" }}
                        whileHover={{ x: "200%" }}
                        transition={{ duration: 0.55, ease: "easeInOut" }}
                      />
                    )}
                    <span className="relative">{isLoading ? "Updating…" : "Update password"}</span>
                    {!isLoading && <ArrowRight className="relative w-4 h-4" />}
                  </motion.button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login">
                    <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Back to sign in
                    </button>
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        </div>
      </div>
    </ThemeWrapper>
  )
}
