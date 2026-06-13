import { useState, useEffect } from "react"
import { Link, useLocation } from "wouter"
import { motion, AnimatePresence } from "framer-motion"
import { Check, ArrowRight, ChevronDown, Zap, Crown, Rocket, Building2, Loader2, AlertTriangle, Lock, X } from "lucide-react"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { useAuth } from "@/lib/auth-context"
import { ThemeWrapper } from "@/lib/theme-context"

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: 0,
    tagline: "Start building your first business system",
    highlight: false,
    comingSoon: false,
    icon: Zap,
    color: "#10B981",
    features: [
      "5 AI generations / month",
      "Business idea analysis",
      "Market metrics & insights",
      "Growth plan overview",
      "Project saving",
    ],
    cta: "Get Started Free",
    ctaHref: "/signup",
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: 29,
    tagline: "For founders building real products",
    highlight: true,
    badge: "Most Popular",
    comingSoon: false,
    icon: Crown,
    color: "#D4AF37",
    features: [
      "100 AI generations / month",
      "Deep business intelligence",
      "AI Website Builder",
      "AI Chatbot Generator",
      "Automation Builder",
      "Agent Marcus (AI Copilot)",
      "AI memory & cross-context",
      "Project history + CRUD",
    ],
    cta: "Go Pro",
    ctaHref: "/signup",
  },
  {
    id: "startup" as const,
    name: "Startup",
    price: 99,
    tagline: "For serious founders scaling businesses",
    highlight: false,
    comingSoon: false,
    icon: Rocket,
    color: "#8B5CF6",
    features: [
      "500 AI generations / month",
      "Everything in Pro",
      "Agent Marcus (AI Copilot)",
      "Extended AI reasoning depth",
      "Proactive intelligence insights",
      "Growth strategy engine",
      "Priority processing (5000 tokens)",
      "Advanced execution planning",
    ],
    cta: "Start Building",
    ctaHref: "/signup",
  },
  {
    id: "enterprise" as const,
    name: "Enterprise",
    price: null,
    tagline: "For teams and organizations at scale",
    highlight: false,
    comingSoon: false,
    icon: Building2,
    color: "#64748B",
    features: [
      "Unlimited AI generations",
      "Agent Marcus (AI Copilot)",
      "Team collaboration",
      "API access",
      "Custom integrations",
      "SSO & enterprise auth",
      "Dedicated support",
    ],
    cta: "Join Waitlist",
    ctaHref: "/signup",
  },
]

const COMPARISON_ROWS: { label: string; free: boolean | string; pro: boolean | string; startup: boolean | string }[] = [
  { label: "Business idea analysis",        free: true,           pro: true,              startup: true },
  { label: "AI generations / month",        free: "5",            pro: "100",             startup: "500" },
  { label: "AI depth",                      free: "Basic",        pro: "Full",            startup: "Extended" },
  { label: "AI Website Builder",            free: false,          pro: true,              startup: true },
  { label: "AI Chatbot Generator",          free: false,          pro: true,              startup: true },
  { label: "Automation Builder",            free: false,          pro: true,              startup: true },
  { label: "Agent Marcus (AI Copilot)",     free: false,          pro: true,              startup: true },
  { label: "AI Memory & cross-context",     free: false,          pro: true,              startup: true },
  { label: "Project history & CRUD",        free: "Limited",      pro: true,              startup: true },
  { label: "Token depth per generation",    free: "1,800",        pro: "3,500",           startup: "5,000" },
  { label: "Proactive intelligence",        free: false,          pro: false,             startup: true },
  { label: "Priority processing",           free: false,          pro: false,             startup: true },
  { label: "Advanced execution planning",   free: false,          pro: false,             startup: true },
]

const faqs = [
  {
    q: "What counts as an AI generation?",
    a: "Each time you submit a business idea and receive a full AI analysis — including market sizing, competitive analysis, growth strategy, and tech stack recommendations — that counts as one generation. Website generation also counts.",
  },
  {
    q: "Can I upgrade or downgrade anytime?",
    a: "Yes. Upgrades take effect immediately and your new limits are applied right away. No cancellation fees or lock-in periods.",
  },
  {
    q: "What's the difference between Pro and Startup?",
    a: "Startup unlocks proactive intelligence, advanced diagnostics, premium reasoning pipelines, and scalability analysis. Pro gives you the core generation suite. Startup is for founders who want the deepest insights.",
  },
  {
    q: "Is there a free trial for Pro or Startup?",
    a: "Start on the Free plan with no credit card required. When you're ready to scale, upgrade at any time from your account settings.",
  },
]

function ConfirmDialog({
  plan,
  currentPlan,
  onConfirm,
  onCancel,
  loading,
}: {
  plan: typeof PLANS[number]
  currentPlan: string | null
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  const isDowngrade = (currentPlan === "startup" || currentPlan === "pro") && plan.id === "free"
    || currentPlan === "startup" && plan.id === "pro"
  const PlanIcon = plan.icon
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c0c] p-7 shadow-2xl"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="p-2 rounded-xl shrink-0" style={{ background: `${plan.color}15` }}>
            <PlanIcon className="h-5 w-5" style={{ color: plan.color }} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">
              {isDowngrade ? "Downgrade to" : "Switch to"} {plan.name}?
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">{plan.tagline}</p>
          </div>
        </div>

        {isDowngrade && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3 mb-5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300 leading-relaxed">
              Downgrading will reduce your generation limits immediately.
            </p>
          </div>
        )}

        <div className="rounded-xl border border-white/6 bg-white/[0.02] p-4 mb-6">
          <div className="flex items-baseline gap-1 mb-1">
            {plan.price === 0 ? (
              <span className="text-2xl font-bold text-foreground">Free</span>
            ) : plan.price === null ? (
              <span className="text-2xl font-bold text-foreground">Custom</span>
            ) : (
              <>
                <span className="text-2xl font-bold text-foreground">${plan.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Takes effect immediately upon confirmation.</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-foreground hover:bg-white/8 transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing...</>
            ) : (
              <>Confirm {isDowngrade ? "Downgrade" : "Upgrade"}</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

function WaitlistModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), plan: "enterprise" }),
      })
      if (!res.ok) throw new Error("Failed to join waitlist")
      setDone(true)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0c0c0c] p-7 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-500/15">
              <Building2 className="h-5 w-5 text-slate-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Enterprise Waitlist</h3>
              <p className="text-xs text-muted-foreground mt-0.5">We'll reach out when Enterprise is ready</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
            <X className="h-4 w-4" />
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 mx-auto mb-3">
              <Check className="h-5 w-5 text-emerald-400" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">You're on the list!</p>
            <p className="text-xs text-muted-foreground">We'll email you when Enterprise launches.</p>
            <button onClick={onClose} className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-primary px-5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all">
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Your name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Work email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@company.com"
                required
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 transition-all"
              />
            </div>
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 text-sm font-medium text-foreground hover:bg-white/8 transition-all">
                Cancel
              </button>
              <button type="submit" disabled={submitting || !name.trim() || !email.trim()}
                className="flex-1 h-10 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Joining...</> : "Join Waitlist"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [pendingPlan, setPendingPlan] = useState<typeof PLANS[number] | null>(null)
  const [showWaitlist, setShowWaitlist] = useState(false)
  const { user } = useAuth()
  const [, setLocation] = useLocation()

  useEffect(() => {
    if (!user) return
    setSubLoading(true)
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setCurrentPlan(d.subscription?.plan ?? "free"))
      .catch(() => setCurrentPlan("free"))
      .finally(() => setSubLoading(false))
  }, [user])

  const handleSelectPlan = (plan: typeof PLANS[number]) => {
    if (plan.id === "enterprise") {
      setShowWaitlist(true)
      return
    }
    if (!user) {
      setLocation(plan.ctaHref)
      return
    }
    if (plan.id === currentPlan || upgrading) return
    setPendingPlan(plan)
  }

  const handleConfirmPlan = async () => {
    if (!pendingPlan || pendingPlan.comingSoon) return
    setUpgrading(pendingPlan.id)
    try {
      const res = await fetch("/api/subscriptions/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan: pendingPlan.id }),
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentPlan(data.subscription?.plan ?? pendingPlan.id)
      }
    } catch (_) {}
    setUpgrading(null)
    setPendingPlan(null)
  }

  return (
    <ThemeWrapper>
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <Navbar />

      <AnimatePresence>
        {pendingPlan && (
          <ConfirmDialog
            plan={pendingPlan}
            currentPlan={currentPlan}
            onConfirm={handleConfirmPlan}
            onCancel={() => setPendingPlan(null)}
            loading={!!upgrading}
          />
        )}
        {showWaitlist && (
          <WaitlistModal onClose={() => setShowWaitlist(false)} />
        )}
      </AnimatePresence>

      <main className="pt-24">
        {/* Header */}
        <section className="relative py-20 text-center">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute left-1/2 top-0 -translate-x-1/2 h-[400px] w-[600px] rounded-full bg-primary/5 blur-[120px]" />
          </div>
          <div className="relative mx-auto max-w-3xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-primary mb-4 px-3 py-1 rounded-full border border-primary/20 bg-primary/5">
                Pricing
              </span>
              <h1 className="mt-4 text-4xl font-bold tracking-tight text-foreground md:text-5xl mb-4">
                Simple pricing for building<br />AI-powered business systems
              </h1>
              <p className="text-base text-muted-foreground mb-4">
                Start free. Build your first system. Scale when ready.
              </p>
              {user && currentPlan && !subLoading && (
                <p className="text-sm text-primary/80 font-medium">
                  You're on the <span className="capitalize font-bold">{currentPlan}</span> plan
                </p>
              )}
            </motion.div>
          </div>
        </section>

        {/* Plans */}
        <section className="relative pb-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan, i) => {
                const isCurrent = user && currentPlan === plan.id
                const isUpgrading = upgrading === plan.id
                const PlanIcon = plan.icon
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                    className={`relative rounded-2xl border p-7 flex flex-col ${
                      plan.comingSoon
                        ? "opacity-70"
                        : plan.highlight
                        ? "border-primary/40 bg-primary/[0.04]"
                        : ""
                    }`}
                    style={plan.comingSoon
                      ? { borderColor: "var(--border)", background: "var(--card)" }
                      : plan.highlight
                      ? { boxShadow: "0 0 60px oklch(0.75 0.12 85 / 0.10), 0 0 0 1px oklch(0.75 0.12 85 / 0.15)" }
                      : { borderColor: "var(--border)", background: "var(--card)" }
                    }
                  >
                    {plan.badge && !plan.comingSoon && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-[10px] font-semibold text-primary-foreground whitespace-nowrap">
                        {plan.badge}
                      </div>
                    )}
                    {plan.comingSoon && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full border border-white/15 bg-[#0e0e0e] text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                        Coming Soon
                      </div>
                    )}
                    {isCurrent && (
                      <div className="absolute -top-3 right-4 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
                        style={{ color: plan.color, borderColor: `${plan.color}40`, background: `${plan.color}10` }}>
                        Current Plan
                      </div>
                    )}

                    <div className="mb-6">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="p-1.5 rounded-lg" style={{ background: `${plan.color}15` }}>
                          <PlanIcon className="h-4 w-4" style={{ color: plan.color }} />
                        </div>
                        <h3 className="text-base font-semibold text-foreground">{plan.name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4">{plan.tagline}</p>
                      <div className="flex items-baseline gap-1">
                        {plan.price === 0 ? (
                          <span className="text-3xl font-bold text-foreground">$0</span>
                        ) : plan.price === null ? (
                          <span className="text-3xl font-bold text-muted-foreground">Custom</span>
                        ) : (
                          <>
                            <span className="text-3xl font-bold text-foreground">${plan.price}</span>
                            <span className="text-sm text-muted-foreground">/mo</span>
                          </>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2.5 flex-1 mb-7">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <Check className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: plan.comingSoon ? "#64748B" : plan.color }} />
                          <span className={`text-xs ${plan.comingSoon ? "text-muted-foreground/50" : "text-muted-foreground"}`}>{f}</span>
                        </li>
                      ))}
                    </ul>

                    {plan.comingSoon ? (
                      <button
                        disabled
                        className="w-full inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold gap-2 text-muted-foreground/50 cursor-not-allowed"
                        style={{ border: "1px solid var(--border)", background: "var(--muted)" }}
                      >
                        <Lock className="w-3.5 h-3.5" />
                        Join Waitlist
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSelectPlan(plan)}
                        disabled={!!isCurrent || !!isUpgrading || subLoading}
                        className={`w-full inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold gap-2 transition-all disabled:opacity-60 disabled:cursor-not-allowed ${
                          plan.highlight
                            ? "bg-primary text-primary-foreground hover:bg-primary/90 gold-glow"
                            : "text-foreground hover:opacity-80"
                        }`}
                        style={!plan.highlight ? { border: "1px solid var(--border)", background: "var(--muted)" } : undefined}
                      >
                        {isUpgrading ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing...</>
                        ) : isCurrent ? (
                          "Current Plan"
                        ) : (
                          <>{user ? plan.cta : plan.cta}<ArrowRight className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    )}
                  </motion.div>
                )
              })}
            </div>

            {/* Pro conversion note */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-center text-xs text-muted-foreground/50 mt-6"
            >
              No credit card required to start. Upgrade anytime.
            </motion.p>
          </div>
        </section>

        {/* Feature comparison table */}
        <section className="pb-20">
          <div className="mx-auto max-w-4xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-xl font-bold text-foreground text-center mb-8">Full feature comparison</h2>
              <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                {/* Table header */}
                <div className="grid grid-cols-4 border-b" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
                  <div className="px-5 py-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Feature</div>
                  {[
                    { name: "Free", color: "#10B981" },
                    { name: "Pro", color: "#D4AF37" },
                    { name: "Startup", color: "#8B5CF6" },
                  ].map(p => (
                    <div key={p.name} className="px-5 py-4 text-center">
                      <span className="text-xs font-bold" style={{ color: p.color }}>{p.name}</span>
                    </div>
                  ))}
                </div>
                {/* Rows */}
                {COMPARISON_ROWS.map((row, i) => (
                  <div
                    key={row.label}
                    className={`grid grid-cols-4 last:border-0`}
                    style={{ borderBottom: "1px solid var(--border)", background: i % 2 === 0 ? "var(--muted)" : "var(--background)" }}
                  >
                    <div className="px-5 py-3.5 text-xs text-muted-foreground font-medium">{row.label}</div>
                    {([row.free, row.pro, row.startup] as (boolean | string)[]).map((val, j) => (
                      <div key={j} className="px-5 py-3.5 flex items-center justify-center">
                        {val === true ? (
                          <Check className="h-3.5 w-3.5 text-emerald-400" />
                        ) : val === false ? (
                          <span className="h-[2px] w-4 rounded block" style={{ background: "var(--border)" }} />
                        ) : (
                          <span className="text-[11px] font-semibold text-foreground/80">{val}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* Bottom value prop */}
        <section className="pb-20">
          <div className="mx-auto max-w-3xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl p-10 text-center"
              style={{ border: "1px solid var(--border)", background: "var(--card)" }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Not another SaaS tool. A business operating system.
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xl mx-auto">
                STAGEONE turns ideas into structured business systems using AI — helping founders move from concept to execution faster and more intelligently.
              </p>
            </motion.div>
          </div>
        </section>

        {/* FAQ */}
        <section className="pb-24">
          <div className="mx-auto max-w-2xl px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              <h2 className="text-2xl font-bold text-foreground mb-2">Frequently Asked Questions</h2>
            </motion.div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="rounded-xl overflow-hidden"
                  style={{ border: "1px solid var(--border)", background: "var(--card)" }}
                >
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left"
                  >
                    <span className="text-sm font-medium text-foreground">{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-muted-foreground flex-shrink-0 ml-3 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4">
                      <p className="text-xs text-muted-foreground leading-relaxed">{faq.a}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="pb-24">
          <div className="mx-auto max-w-xl px-6 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <h2 className="text-2xl font-bold text-foreground mb-3">
                Ready to build your first business system?
              </h2>
              <p className="text-sm text-muted-foreground mb-7">Start free. No credit card required.</p>
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow"
              >
                {user ? "Go to Dashboard" : "Get Started Free"}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
    </ThemeWrapper>
  )
}
