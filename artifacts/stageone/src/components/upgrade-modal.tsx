import { useState, useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Check, Zap, Crown, Rocket, Building2 } from "lucide-react"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import { useAuth } from "@/lib/auth-context"

const PLANS = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    yearlyPrice: 0,
    tagline: "Start building your first business system",
    icon: Zap,
    color: "#10B981",
    highlight: false,
    cta: "Current Plan",
    ctaDisabled: true,
    features: [
      "5 AI generations / month",
      "Business idea analysis",
      "Market metrics & insights",
      "Growth plan overview",
      "Project saving",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: 29,
    yearlyPrice: 26,
    tagline: "For founders building real products",
    icon: Crown,
    color: "#D4AF37",
    highlight: true,
    badge: "Most Popular",
    cta: "Upgrade to Pro",
    ctaDisabled: false,
    features: [
      "100 AI generations / month",
      "Deep business intelligence",
      "AI Website Builder",
      "AI Chatbot Generator",
      "Automation Builder",
      "AI memory & cross-context",
      "Project history + CRUD",
    ],
  },
  {
    id: "startup",
    name: "Startup",
    monthlyPrice: 99,
    yearlyPrice: 89,
    tagline: "For serious founders scaling businesses",
    icon: Rocket,
    color: "#8B5CF6",
    highlight: false,
    cta: "Start Building",
    ctaDisabled: false,
    features: [
      "500 AI generations / month",
      "Everything in Pro",
      "Extended AI reasoning depth",
      "Proactive intelligence insights",
      "Growth strategy engine",
      "Priority processing",
      "Advanced execution planning",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    monthlyPrice: null,
    yearlyPrice: null,
    tagline: "For teams and organizations at scale",
    icon: Building2,
    color: "#64748B",
    highlight: false,
    cta: "Contact Sales",
    ctaDisabled: false,
    features: [
      "Unlimited AI generations",
      "Team collaboration",
      "API access",
      "Custom integrations",
      "SSO & enterprise auth",
      "Dedicated support",
    ],
  },
]

export function UpgradeModal() {
  const { open, closeUpgradeModal } = useUpgradeModal()
  const { user } = useAuth()
  const [yearly, setYearly] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") closeUpgradeModal() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, closeUpgradeModal])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => { if (e.target === overlayRef.current) closeUpgradeModal() }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/30 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-5xl rounded-2xl border border-white/10 bg-[#111115] shadow-[0_24px_80px_rgba(0,0,0,0.6)] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 pt-6 pb-5 border-b border-white/6">
              <div>
                <h2 className="text-lg font-bold text-foreground tracking-tight">Choose Your Plan</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Unlock the full AI Operating System — no redirects, no context lost.
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Billing toggle */}
                <div className="flex items-center gap-2 rounded-full border border-white/8 bg-white/3 p-1">
                  <button
                    onClick={() => setYearly(false)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      !yearly
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground/70"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setYearly(true)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all ${
                      yearly
                        ? "bg-white/10 text-foreground"
                        : "text-muted-foreground hover:text-foreground/70"
                    }`}
                  >
                    Yearly
                    <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[9px] font-bold leading-none">
                      -10%
                    </span>
                  </button>
                </div>
                <button
                  onClick={closeUpgradeModal}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/6 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Plan cards */}
            <div className="grid grid-cols-4 gap-0 divide-x divide-white/6 p-0">
              {PLANS.map((plan) => {
                const Icon = plan.icon
                const price = yearly ? plan.yearlyPrice : plan.monthlyPrice
                const isCurrent = plan.id === "free"

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col p-5 ${
                      plan.highlight ? "bg-primary/4" : ""
                    }`}
                  >
                    {/* Popular badge */}
                    {plan.badge && (
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <span className="rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-2.5 py-0.5 tracking-wide uppercase">
                          {plan.badge}
                        </span>
                      </div>
                    )}

                    {/* Plan identity */}
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: `${plan.color}18`, border: `1px solid ${plan.color}30` }}
                      >
                        <Icon className="h-3.5 w-3.5" style={{ color: plan.color }} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-foreground">{plan.name}</span>
                        {isCurrent && (
                          <span className="rounded-full bg-white/8 border border-white/10 text-[9px] font-semibold text-muted-foreground px-2 py-0.5">
                            Current
                          </span>
                        )}
                        {plan.highlight && (
                          <span className="rounded-full text-[9px] font-bold px-1.5 py-0.5 uppercase tracking-wide"
                            style={{ background: `${plan.color}20`, color: plan.color }}
                          >
                            Pro
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mb-2">
                      {price === null ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-foreground">Custom</span>
                        </div>
                      ) : price === 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-foreground">Free</span>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1">
                          <span className="text-[11px] text-muted-foreground mt-0.5">$</span>
                          <span className="text-2xl font-bold text-foreground">{price}</span>
                          <span className="text-[11px] text-muted-foreground">/mo</span>
                        </div>
                      )}
                      {yearly && price !== null && price > 0 && (
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          Billed annually
                        </p>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed mb-4">
                      {plan.tagline}
                    </p>

                    {/* Features */}
                    <ul className="space-y-2 mb-5 flex-1">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2">
                          <Check
                            className="h-3 w-3 shrink-0 mt-0.5"
                            style={{ color: plan.highlight ? plan.color : "#10B981" }}
                          />
                          <span className="text-[11px] text-muted-foreground leading-tight">{f}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      disabled={plan.ctaDisabled}
                      onClick={() => {
                        if (!plan.ctaDisabled) {
                          window.location.href = plan.id === "enterprise"
                            ? "mailto:hello@stageone.ai"
                            : "/signup"
                        }
                      }}
                      className={`w-full h-9 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                        plan.ctaDisabled
                          ? "border border-white/8 text-muted-foreground/40 cursor-default bg-white/2"
                          : plan.highlight
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 gold-glow"
                          : "border border-white/10 bg-white/5 text-foreground hover:bg-white/10"
                      }`}
                    >
                      {!plan.ctaDisabled && plan.highlight && <Crown className="h-3 w-3" />}
                      {plan.cta}
                    </button>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-7 py-3.5 border-t border-white/6 flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground/50">
                Prices are in USD. Upgrades take effect immediately.
              </p>
              <button
                onClick={closeUpgradeModal}
                className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                Maybe later
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
