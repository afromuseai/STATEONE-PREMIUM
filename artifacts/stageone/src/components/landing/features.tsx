import { motion } from "framer-motion"
import {
  BarChart3,
  Bot,
  Globe,
  Cpu,
  Workflow,
  Brain,
  Rocket,
  Shield,
} from "lucide-react"

const features = [
  {
    icon: BarChart3,
    title: "Business Intelligence",
    description: "Deep AI analysis of market positioning, competitive landscape, revenue potential, and growth vectors — delivered in seconds.",
    gradient: "from-amber-500/8 to-orange-500/4",
    accent: "oklch(0.75 0.12 85)",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[["Market Size", 84], ["Competition", 67], ["Growth", 92]].map(([l, v]) => (
          <div key={l as string} className="flex items-center gap-2">
            <span className="text-[9px] text-white/30 w-16 shrink-0">{l}</span>
            <div className="flex-1 h-1 rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, oklch(0.75 0.12 85 / 0.5), oklch(0.75 0.12 85))" }}
                initial={{ width: 0 }}
                whileInView={{ width: `${v}%` }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
              />
            </div>
            <span className="text-[9px] font-bold text-[oklch(0.75_0.12_85/0.8)]">{v}%</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Globe,
    title: "Website Architect",
    description: "Generate complete, production-ready websites with custom design, copywriting, and React component code. Export and deploy instantly.",
    gradient: "from-blue-500/6 to-cyan-500/3",
    accent: "oklch(0.70 0.15 220)",
    mockup: (
      <div className="mt-4 rounded-lg border border-white/6 bg-black/30 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-1.5 bg-white/[0.02] border-b border-white/5">
          {["bg-red-500/50", "bg-yellow-500/50", "bg-green-500/50"].map((c, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${c}`} />
          ))}
        </div>
        <div className="p-2 space-y-1.5">
          <motion.div className="h-2.5 w-2/3 rounded" style={{ background: "oklch(0.75 0.12 85 / 0.25)" }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
          <div className="flex gap-1">
            {[1, 2, 3].map(i => <div key={i} className="flex-1 h-5 rounded bg-white/4 border border-white/4" />)}
          </div>
          <div className="h-1.5 w-full rounded bg-white/4" />
          <div className="h-1.5 w-4/5 rounded bg-white/4" />
        </div>
      </div>
    ),
  },
  {
    icon: Cpu,
    title: "AI Execution Engine",
    description: "A persistent orchestration layer that plans, executes, and monitors complex business tasks across your entire operation.",
    gradient: "from-violet-500/6 to-purple-500/3",
    accent: "oklch(0.68 0.18 290)",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          { t: "Market analysis", done: true },
          { t: "Website generated", done: true },
          { t: "Agents deploying", done: false },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full border flex-shrink-0 flex items-center justify-center ${item.done ? "border-[oklch(0.75_0.12_85/0.5)] bg-[oklch(0.75_0.12_85/0.1)]" : "border-white/15"}`}>
              {item.done
                ? <div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_85)]" />
                : <motion.div className="w-1.5 h-1.5 rounded-full bg-white/20"
                    animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} />
              }
            </div>
            <span className={`text-[9px] ${item.done ? "text-white/30 line-through" : "text-white/70"}`}>{item.t}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Bot,
    title: "Agent Systems",
    description: "12 pre-built autonomous agents across Sales, Support, Marketing, Research, and Operations — install and configure in one click.",
    gradient: "from-green-500/6 to-emerald-500/3",
    accent: "oklch(0.72 0.16 150)",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          { name: "Sales Agent", active: true },
          { name: "Support Bot", active: true },
          { name: "Analytics", active: false },
        ].map((a, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
            <span className="text-[9px] text-white/60">{a.name}</span>
            <div className="flex items-center gap-1">
              <motion.div
                className={`w-1.5 h-1.5 rounded-full ${a.active ? "bg-green-400" : "bg-white/20"}`}
                animate={a.active ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className={`text-[8px] ${a.active ? "text-green-400" : "text-white/30"}`}>{a.active ? "active" : "idle"}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Brain,
    title: "AI Memory",
    description: "Persistent cross-session intelligence. STAGEONE learns your business context and injects it into every future AI interaction.",
    gradient: "from-pink-500/6 to-rose-500/3",
    accent: "oklch(0.70 0.18 350)",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          "Target: B2B SaaS founders",
          "Model: usage-based revenue",
          "Stage: pre-launch MVP",
        ].map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_85)] mt-0.5 flex-shrink-0"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, delay: i * 0.6, repeat: Infinity }}
            />
            <span className="text-[9px] text-white/40 leading-relaxed">{m}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Workflow,
    title: "Automation Builder",
    description: "Identify and implement automation opportunities across your operations with detailed workflow blueprints and execution plans.",
    gradient: "from-yellow-500/6 to-amber-500/3",
    accent: "oklch(0.78 0.14 75)",
    mockup: (
      <div className="mt-4 flex items-center gap-1.5">
        {["Trigger", "Process", "Action", "Log"].map((node, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="px-2 py-1 rounded-md bg-white/[0.04] border border-white/8">
              <span className="text-[8px] text-white/50">{node}</span>
            </div>
            {i < 3 && (
              <motion.div className="w-3 h-px bg-[oklch(0.75_0.12_85/0.4)]"
                animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }} />
            )}
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Rocket,
    title: "Deployments",
    description: "One-click deployment infrastructure with rollback support, status webhooks, and real-time monitoring dashboards.",
    gradient: "from-orange-500/6 to-red-500/3",
    accent: "oklch(0.70 0.17 30)",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          { env: "Production", status: "Active", color: "text-green-400", dot: "bg-green-400" },
          { env: "Staging", status: "Active", color: "text-green-400", dot: "bg-green-400" },
          { env: "Preview", status: "Building", color: "text-yellow-400", dot: "bg-yellow-400" },
        ].map((d, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white/[0.02] border border-white/5">
            <span className="text-[9px] text-white/50">{d.env}</span>
            <div className="flex items-center gap-1">
              <motion.div className={`w-1.5 h-1.5 rounded-full ${d.dot}`}
                animate={d.status === "Active" ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
              />
              <span className={`text-[8px] font-medium ${d.color}`}>{d.status}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Shield,
    title: "Enterprise Control",
    description: "Webhook integrations, API access, audit logs, developer platform, and role-based controls built for serious operators.",
    gradient: "from-slate-500/6 to-zinc-500/3",
    accent: "oklch(0.65 0.05 240)",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          { label: "API Keys", val: "3 active" },
          { label: "Webhooks", val: "12 events" },
          { label: "Audit Log", val: "Active" },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
            <span className="text-[9px] text-white/40">{item.label}</span>
            <span className="text-[9px] font-medium text-white/60">{item.val}</span>
          </div>
        ))}
      </div>
    ),
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.16, 1, 0.3, 1] },
  },
}

export function Features() {
  return (
    <section id="features" className="relative py-32">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[700px] w-[700px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.04), transparent 70%)", filter: "blur(60px)" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[oklch(0.75_0.12_85/0.8)] mb-4 px-4 py-1.5 rounded-full border border-[oklch(0.75_0.12_85/0.2)] bg-[oklch(0.75_0.12_85/0.06)]">
            Platform Capabilities
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
            The Complete AI Business OS
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-white/40 text-base leading-relaxed">
            Every system you need to build, operate, and scale a modern business —
            orchestrated by AI, executed in real time.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ y: -5, transition: { duration: 0.25 } }}
              className={`group relative rounded-2xl border border-white/6 bg-gradient-to-b ${feature.gradient} p-6 transition-all duration-300 hover:border-white/12`}
              style={{
                background: `linear-gradient(145deg, oklch(0.12 0.005 60 / 0.8), oklch(0.09 0.002 60 / 0.8))`,
                boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Top gradient accent */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${feature.accent} / 0.4, transparent)` }} />

              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle at 40% 0%, ${feature.accent} / 0.06, transparent 65%)` }} />

              <div className="relative">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] group-hover:border-white/12 group-hover:bg-white/[0.07] transition-all duration-300">
                  <feature.icon className="h-5 w-5 text-[oklch(0.75_0.12_85)]" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-xs leading-relaxed text-white/40">{feature.description}</p>
                {feature.mockup}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
