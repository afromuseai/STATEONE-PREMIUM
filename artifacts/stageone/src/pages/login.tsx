import { useState } from "react"
import { useLocation, Link } from "wouter"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import { ThemeWrapper } from "@/lib/theme-context"
import { Loader2, Mail, Lock, ArrowRight, Eye, EyeOff, Shield } from "lucide-react"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"
import authBg from "@assets/image_1779169751394.png"

function OSPanel() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-[#07090d]">
      {/* Cube grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${authBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Left-edge fade into form panel */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: "linear-gradient(to right, #07090d 0%, rgba(7,9,13,0.55) 30%, transparent 100%)" }} />
      {/* Top fade */}
      <div className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to bottom, #07090d 0%, transparent 100%)" }} />
      {/* Bottom fade */}
      <div className="absolute inset-x-0 bottom-0 h-32 pointer-events-none"
        style={{ background: "linear-gradient(to top, #07090d 0%, transparent 100%)" }} />
      {/* Bottom status badge */}
      <div className="absolute bottom-8 right-8 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/15 backdrop-blur-md"
        style={{ background: "oklch(0.08 0 0 / 0.80)" }}>
        <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
          animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
        <span className="text-[9px] font-semibold text-green-400/90 tracking-wide">All Systems Active</span>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const [, setLocation] = useLocation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const result = await login(email, password)
    if (result.success) {
      setLocation("/dashboard")
    } else {
      setError(result.error || "Login failed")
      setIsLoading(false)
    }
  }

  return (
    <ThemeWrapper>
    <div className="flex" style={{ minHeight: "100vh", background: "var(--background)" }}>
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Logo — absolute top-left corner */}
        <Link href="/" className="absolute top-6 left-8 z-20 flex items-center gap-2">
          <img src={logoImg} alt="STAGEONE" className="h-7 w-auto object-contain" />
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-foreground">STAGEONE</span>
        </Link>

        <div className="pointer-events-none absolute inset-0">
          <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
            <defs>
              <pattern id="rg" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="oklch(0.75 0.12 85)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#rg)"/>
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }} className="w-full max-w-sm relative"
        >
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-[10px] text-primary/60 tracking-widest uppercase font-semibold">Secure Access Protocol</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1.5">
              Secure access to your<br />AI Operating System
            </h1>
            <p className="text-sm text-muted-foreground">Authenticate to resume your intelligence environment</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-lg border border-red-500/20 bg-red-500/8 p-3 text-xs text-red-400"
              >
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  className="w-full rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                  style={{ border: "1px solid var(--border)", background: "var(--input)" }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required
                  className="w-full rounded-xl pl-10 pr-11 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all duration-200"
                  style={{ border: "1px solid var(--border)", background: "var(--input)" }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <motion.button type="submit" disabled={isLoading}
              whileHover={!isLoading ? {
                scale: 1.015,
                boxShadow: "0 0 32px oklch(0.75 0.12 85 / 0.5), 0 8px 24px rgba(0,0,0,0.4)"
              } : {}}
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
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying identity…</span>
                </>
              ) : (
                <>
                  <span className="relative">Authenticate</span>
                  <ArrowRight className="relative w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              No environment yet?{" "}
              <Link href="/signup" className="text-primary hover:underline font-medium">
                Initialize one free
              </Link>
            </p>
          </div>

          <p className="text-center text-muted-foreground text-[10px] mt-8">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>

      <div className="hidden lg:block lg:w-[52%] h-screen sticky top-0" style={{ borderLeft: "1px solid var(--border)" }}>
        <OSPanel />
      </div>
    </div>
    </ThemeWrapper>
  )
}
