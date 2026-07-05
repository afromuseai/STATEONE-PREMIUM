import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import {
  Crown, Zap, Building2, Check, TrendingUp, CreditCard,
  BarChart3, Bot, Globe, Workflow, ChevronRight, AlertCircle,
} from "lucide-react"
import stageoneIcon from "@/assets/stageone-icon.png"

type Plan = "free" | "pro" | "enterprise"

interface Subscription {
  plan: Plan
  status: string
  aiGenerationsUsed: number
  aiGenerationsLimit: number
  deploymentsUsed: number
  deploymentsLimit: number
  workspacesUsed: number
  workspacesLimit: number
  currentPeriodEnd: string
}

const PLANS = [
  {
    id: "free" as Plan,
    name: "Free",
    price: "$0",
    period: "/month",
    icon: Zap,
    color: "#10B981",
    description: "Get started with AI business intelligence",
    cta: "Start Free",
    features: [
      "10 AI generations/month",
      "2 deployments",
      "1 workspace",
      "Business intelligence",
      "Website generator",
      "Community support",
    ],
    limits: { ai: 10, deploys: 2, workspaces: 1 },
  },
  {
    id: "pro" as Plan,
    name: "Pro",
    price: "$49",
    period: "/month",
    icon: Crown,
    color: "#D4AF37",
    description: "Scale your AI business operations",
    popular: true,
    cta: "Go Pro",
    features: [
      "200 AI generations/month",
      "20 deployments",
      "5 workspaces",
      "All generators + orchestrator",
      "AI memory & context",
      "Template marketplace",
      "Priority support",
      "Deployment dashboard",
    ],
    limits: { ai: 200, deploys: 20, workspaces: 5 },
  },
  {
    id: "enterprise" as Plan,
    name: "Enterprise",
    price: "$299",
    period: "/month",
    icon: Building2,
    color: "#8B5CF6",
    description: "Full AI infrastructure for teams",
    cta: "Go Enterprise",
    features: [
      "Unlimited AI generations",
      "Unlimited deployments",
      "Unlimited workspaces",
      "Custom AI model fine-tuning",
      "SSO & advanced auth",
      "SLA & dedicated support",
      "Custom integrations",
      "White-label options",
    ],
    limits: { ai: 9999, deploys: 9999, workspaces: 9999 },
  },
]

const INVOICES = [
  { id: "INV-001", date: "May 1, 2026", amount: "$49.00", status: "paid", plan: "Pro" },
  { id: "INV-002", date: "Apr 1, 2026", amount: "$49.00", status: "paid", plan: "Pro" },
  { id: "INV-003", date: "Mar 1, 2026", amount: "$0.00", status: "paid", plan: "Free" },
]

function UsageBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = limit >= 9999 ? 5 : Math.min(100, (used / limit) * 100)
  return (
    <div className="w-full h-1.5 rounded-full bg-white/8 overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="h-full rounded-full"
        style={{ background: color }}
      />
    </div>
  )
}

export default function BillingPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [upgrading, setUpgrading] = useState<Plan | null>(null)
  const [activeTab, setActiveTab] = useState<"plans" | "usage" | "invoices">("plans")

  useEffect(() => {
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSubscription(d.subscription))
      .catch(() => {
        setSubscription({
          plan: "free", status: "active",
          aiGenerationsUsed: 3, aiGenerationsLimit: 10,
          deploymentsUsed: 0, deploymentsLimit: 2,
          workspacesUsed: 1, workspacesLimit: 1,
          currentPeriodEnd: new Date(Date.now() + 20 * 86400000).toISOString(),
        })
      })
  }, [])

  const handleUpgrade = async (plan: Plan) => {
    if (plan === subscription?.plan) return
    setUpgrading(plan)
    try {
      const res = await fetch("/api/subscriptions/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ plan }),
      })
      const data = await res.json()
      setSubscription(data.subscription)
    } catch (_) {}
    setTimeout(() => setUpgrading(null), 1000)
  }

  const currentPlan = PLANS.find(p => p.id === subscription?.plan) ?? PLANS[0]

  return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/5 px-6 h-14 shrink-0">
          <div className="flex items-center gap-3">
            <img src={stageoneIcon} alt="" className="h-6 w-6 object-contain" />
            <div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Billing & Plans</h1>
              <p className="text-[9px] text-muted-foreground tracking-widest uppercase">Subscription Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full border px-3 py-1"
              style={{ borderColor: `${currentPlan.color}30`, background: `${currentPlan.color}10` }}>
              <currentPlan.icon className="h-3 w-3" style={{ color: currentPlan.color }} />
              <span className="text-[10px] font-bold" style={{ color: currentPlan.color }}>{currentPlan.name} Plan</span>
            </div>
            <div className="flex gap-1 bg-white/3 border border-white/8 rounded-xl p-1">
              {(["plans", "usage", "invoices"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                    activeTab === tab ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground"
                  }`}>{tab}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === "plans" && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-4">
                {PLANS.map((plan, i) => {
                  const isCurrent = subscription?.plan === plan.id
                  const isUpgrading = upgrading === plan.id
                  return (
                    <motion.div key={plan.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                      className={`relative rounded-2xl border p-5 space-y-4 transition-all ${
                        plan.popular ? "border-primary/40 bg-primary/4 shadow-[0_0_30px_rgba(212,175,55,0.08)]" : "border-white/8 bg-white/2"
                      } ${isCurrent ? "ring-1 ring-offset-1 ring-offset-[#050505]" : ""}`}
                      style={{}}>

                      {plan.popular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                          Most Popular
                        </div>
                      )}
                      {isCurrent && (
                        <div className="absolute -top-3 right-4 text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full border"
                          style={{ color: plan.color, borderColor: `${plan.color}40`, background: `${plan.color}10` }}>
                          Current
                        </div>
                      )}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <div className="p-1.5 rounded-lg" style={{ background: `${plan.color}15` }}>
                              <plan.icon className="h-4 w-4" style={{ color: plan.color }} />
                            </div>
                            <span className="text-base font-black text-foreground">{plan.name}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground">{plan.description}</p>
                        </div>
                      </div>
                      <div className="flex items-end gap-1">
                        <span className="text-3xl font-black text-foreground">{plan.price}</span>
                        <span className="text-sm text-muted-foreground pb-1">{plan.period}</span>
                      </div>
                      <div className="space-y-2">
                        {plan.features.map(f => (
                          <div key={f} className="flex items-center gap-2">
                            <Check className="h-3 w-3 shrink-0" style={{ color: plan.color }} />
                            <span className="text-[11px] text-foreground/70">{f}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={isCurrent || isUpgrading}
                        className={`w-full rounded-xl py-2.5 text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                          isCurrent
                            ? "bg-white/5 text-muted-foreground cursor-default"
                            : "text-sm font-black hover:opacity-90"
                        }`}
                        style={!isCurrent ? { background: plan.color, color: "#000" } : {}}>
                        {isUpgrading ? (
                          <><Zap className="h-3.5 w-3.5 animate-spin" />Processing...</>
                        ) : isCurrent ? (
                          "Active Plan"
                        ) : subscription && PLANS.findIndex(p => p.id === plan.id) < PLANS.findIndex(p => p.id === subscription.plan) ? (
                          "Downgrade"
                        ) : (
                          <><ChevronRight className="h-3.5 w-3.5" />{plan.cta}</>
                        )}
                      </button>
                    </motion.div>
                  )
                })}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold text-foreground">Payment & Billing Note</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Live payment processing will be enabled when you connect a Stripe account. Plan upgrades demonstrated above are simulated — contact us to enable production billing for your account.
                </p>
              </div>
            </div>
          )}

          {activeTab === "usage" && subscription && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "AI Generations", used: subscription.aiGenerationsUsed, limit: subscription.aiGenerationsLimit, icon: BarChart3, color: "#D4AF37" },
                  { label: "Deployments", used: subscription.deploymentsUsed, limit: subscription.deploymentsLimit, icon: Globe, color: "#6366F1" },
                  { label: "Workspaces", used: subscription.workspacesUsed, limit: subscription.workspacesLimit, icon: Bot, color: "#10B981" },
                ].map(({ label, used, limit, icon: Icon, color }) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl border border-white/8 bg-white/2 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-xl" style={{ background: `${color}15` }}>
                        <Icon className="h-4 w-4" style={{ color }} />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {used} / {limit >= 9999 ? "∞" : limit}
                      </span>
                    </div>
                    <div>
                      <p className="text-xl font-black text-foreground">{used}</p>
                      <p className="text-xs text-muted-foreground">{label} used</p>
                    </div>
                    <UsageBar used={used} limit={limit} color={color} />
                    <p className="text-[9px] text-muted-foreground">
                      {limit >= 9999 ? "Unlimited" : `${limit - used} remaining this period`}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-black text-foreground">Billing Period</h3>
                    <p className="text-[10px] text-muted-foreground">Current subscription cycle</p>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/8 px-3 py-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-semibold text-emerald-400">Active</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-xl border border-white/8 bg-white/2 p-4">
                    <p className="text-[10px] text-muted-foreground mb-1">Plan</p>
                    <p className="text-sm font-black text-foreground capitalize">{subscription.plan}</p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/2 p-4">
                    <p className="text-[10px] text-muted-foreground mb-1">Period Ends</p>
                    <p className="text-sm font-black text-foreground">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-primary/20 bg-primary/4 p-5">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/15">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-black text-foreground">Upgrade for more capacity</p>
                    <p className="text-[10px] text-muted-foreground">Pro plan gives you 20× more AI generations and 10× more deployments</p>
                  </div>
                  <button onClick={() => { setActiveTab("plans") }}
                    className="rounded-xl bg-primary text-black text-xs font-black px-4 py-2 hover:bg-primary/90 transition-all">
                    View Plans
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "invoices" && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
                  <div className="grid grid-cols-5 gap-4 flex-1 text-[9px] font-black text-muted-foreground uppercase tracking-widest">
                    <span>Invoice</span>
                    <span>Date</span>
                    <span>Plan</span>
                    <span>Amount</span>
                    <span>Status</span>
                  </div>
                </div>
                {INVOICES.map((inv, i) => (
                  <motion.div key={inv.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between px-5 py-4 border-b border-white/4 hover:bg-white/2 transition-colors">
                    <div className="grid grid-cols-5 gap-4 flex-1 items-center">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-bold text-foreground">{inv.id}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">{inv.date}</span>
                      <span className="text-[11px] text-foreground">{inv.plan}</span>
                      <span className="text-[11px] font-bold text-foreground">{inv.amount}</span>
                      <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">{inv.status}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">Invoice downloads available with live billing integration</p>
            </div>
          )}
        </div>
      </div>
  )
}
