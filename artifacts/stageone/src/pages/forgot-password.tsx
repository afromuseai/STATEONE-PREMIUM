import { useState } from "react"
import { Link } from "wouter"
import { motion } from "framer-motion"
import { ThemeWrapper } from "@/lib/theme-context"
import { Mail, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [sent, setSent] = useState(false)
  const [devLink, setDevLink] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? "Something went wrong")
      } else {
        setSent(true)
        if (data.devLink) setDevLink(data.devLink)
      }
    } catch {
      setError("Network error — please try again")
    } finally {
      setIsLoading(false)
    }
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
                <pattern id="fprg" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M40 0L0 0 0 40" fill="none" stroke="oklch(0.75 0.12 85)" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#fprg)"/>
            </svg>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="w-full max-w-sm relative"
          >
            {sent ? (
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
                <h1 className="text-2xl font-bold text-foreground mb-2">Check your inbox</h1>
                <p className="text-sm text-muted-foreground mb-6">
                  If an account exists for <span className="text-foreground font-medium">{email}</span>, a password reset link has been sent.
                </p>

                {devLink && (
                  <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 text-left">
                    <p className="text-[10px] text-primary/70 uppercase tracking-widest font-semibold mb-2">Dev mode — no SMTP configured</p>
                    <p className="text-xs text-muted-foreground mb-2">Use this link to reset the password:</p>
                    <a
                      href={devLink}
                      className="text-xs text-primary break-all hover:underline"
                    >
                      {devLink}
                    </a>
                  </div>
                )}

                <Link href="/login">
                  <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto">
                    <ArrowLeft className="w-4 h-4" />
                    Back to sign in
                  </button>
                </Link>
              </motion.div>
            ) : (
              <>
                <div className="mb-7">
                  <h1 className="text-2xl font-bold text-foreground mb-1.5">Forgot your password?</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your email and we'll send you a reset link.
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
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <div className="relative group">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        required
                        className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                        style={{ border: "1px solid var(--border)", background: "var(--input)" }}
                      />
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
                    <span className="relative">{isLoading ? "Sending…" : "Send reset link"}</span>
                    {!isLoading && <ArrowRight className="relative w-4 h-4" />}
                  </motion.button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/login">
                    <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mx-auto">
                      <ArrowLeft className="w-4 h-4" />
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
