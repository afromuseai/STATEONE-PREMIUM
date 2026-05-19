import { useState } from "react"
import { useLocation, Link } from "wouter"
import { motion } from "framer-motion"
import { useAuth } from "@/lib/auth-context"
import { Loader2, Mail, Lock, User, ArrowRight, Eye, EyeOff, Zap } from "lucide-react"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"

function OSPanel() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {/* Brand image — show only the right dashboard/city half */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/auth-bg.png')",
          backgroundSize: "200% 100%",
          backgroundPosition: "right center",
          backgroundRepeat: "no-repeat",
        }}
      />
      {/* Hard left mask to fully hide any leftover image form content */}
      <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent pointer-events-none" style={{ width: "35%" }} />
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

export default function SignupPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const { signup } = useAuth()
  const [, setLocation] = useLocation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    const result = await signup(email, password, name)
    if (result.success) {
      setLocation("/dashboard")
    } else {
      setError(result.error || "Sign up failed")
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Logo — absolute top-left corner */}
        <Link href="/" className="absolute top-6 left-8 z-20 flex items-center gap-2">
          <img src={logoImg} alt="STAGEONE" className="h-7 w-auto object-contain" />
          <span className="text-sm font-bold tracking-[0.25em] uppercase text-foreground">STAGEONE</span>
        </Link>

        <div className="pointer-events-none absolute inset-0">
          <svg className="absolute inset-0 w-full h-full opacity-[0.02]">
            <defs>
              <pattern id="srg" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M40 0L0 0 0 40" fill="none" stroke="oklch(0.75 0.12 85)" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#srg)"/>
          </svg>
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[480px] w-[480px] rounded-full bg-primary/[0.04] blur-[120px]" />
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }} className="w-full max-w-sm relative"
        >
          <div className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-primary/60" />
              <span className="text-[10px] text-primary/60 tracking-widest uppercase font-semibold">Environment Initialization</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-1.5">
              Initialize Your AI<br />Operating System
            </h1>
            <p className="text-sm text-muted-foreground">
              Create your STAGEONE environment and begin building through intelligence-driven infrastructure.
            </p>
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
              <label className="text-xs font-medium text-muted-foreground">Full Name</label>
              <div className="relative group">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="John Doe" required
                  className="w-full rounded-xl border border-white/8 bg-white/[0.03] pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 focus:bg-primary/[0.025] transition-all duration-200 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative group">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com" required
                  className="w-full rounded-xl border border-white/8 bg-white/[0.03] pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 focus:bg-primary/[0.025] transition-all duration-200 backdrop-blur-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative group">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 group-focus-within:text-primary/70 transition-colors duration-200" />
                <input type={showPassword ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="Min. 6 characters"
                  required minLength={6}
                  className="w-full rounded-xl border border-white/8 bg-white/[0.03] pl-10 pr-11 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/40 focus:bg-primary/[0.025] transition-all duration-200 backdrop-blur-sm"
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
                  <span>Provisioning environment…</span>
                </>
              ) : (
                <>
                  <span className="relative">Initialize Environment</span>
                  <ArrowRight className="relative w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Already have an environment?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                Authenticate
              </Link>
            </p>
          </div>

          <p className="text-center text-muted-foreground text-[10px] mt-8">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>
        </motion.div>
      </div>

      <div className="hidden lg:block lg:w-[52%] border-l border-white/5 h-screen sticky top-0">
        <OSPanel />
      </div>
    </div>
  )
}
