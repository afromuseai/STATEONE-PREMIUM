import { motion } from "framer-motion"
import { BarChart3, Globe, Cpu, Brain, Bot, Rocket } from "lucide-react"

const systems = [
  {
    icon: BarChart3,
    title: "Business Intelligence",
    tag: "Analysis Engine",
    description: "Market sizing, competitive moats, revenue modeling, and growth strategy — all AI-generated in real time.",
    color: "oklch(0.75 0.12 85)",
    gradient: "from-amber-500/6 via-transparent to-transparent",
    mockup: (
      <div className="space-y-2 mt-4">
        {[
          { label: "Market Opportunity", val: "$4.2B", pct: 84 },
          { label: "Competitive Score", val: "8.7 / 10", pct: 87 },
          { label: "Growth Potential", val: "High", pct: 92 },
        ].map(m => (
          <div key={m.label}>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-white/35">{m.label}</span>
              <span className="text-[9px] font-bold text-[oklch(0.75_0.12_85/0.9)]">{m.val}</span>
            </div>
            <div className="h-1 rounded-full bg-white/5">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, oklch(0.65 0.12 85 / 0.7), oklch(0.85 0.14 85))" }}
                initial={{ width: 0 }}
                whileInView={{ width: `${m.pct}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: 0.3 }}
              />
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Globe,
    title: "Website Architect",
    tag: "Visual Builder",
    description: "Full production websites with React components, custom design, copywriting, and instant export — generated from your idea.",
    color: "oklch(0.70 0.15 220)",
    gradient: "from-blue-500/5 via-transparent to-transparent",
    mockup: (
      <div className="mt-4 rounded-xl border border-white/6 bg-black/40 overflow-hidden">
        <div className="flex items-center gap-1 px-2.5 py-2 bg-white/[0.02] border-b border-white/5">
          {["bg-red-500/50", "bg-yellow-500/50", "bg-green-500/50"].map((c, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full ${c}`} />
          ))}
          <div className="flex-1 mx-2 h-3 rounded bg-white/4 flex items-center px-1.5">
            <span className="text-[7px] text-white/20">stageone.app</span>
          </div>
        </div>
        <div className="p-2.5 space-y-1.5">
          <motion.div className="h-2.5 w-2/3 rounded-md"
            style={{ background: "oklch(0.75 0.12 85 / 0.3)" }}
            animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
          <div className="grid grid-cols-3 gap-1 mb-1.5">
            {[1, 2, 3].map(i => <div key={i} className="h-6 rounded-lg bg-white/4 border border-white/4" />)}
          </div>
          <div className="h-1.5 w-full rounded bg-white/4" />
          <div className="h-1.5 w-4/5 rounded bg-white/4" />
          <div className="h-5 w-14 rounded-lg mt-1" style={{ background: "oklch(0.75 0.12 85 / 0.35)" }} />
        </div>
      </div>
    ),
  },
  {
    icon: Cpu,
    title: "Execution Engine",
    tag: "Orchestration Layer",
    description: "A persistent AI runtime that plans complex multi-step tasks, executes them autonomously, and reports results.",
    color: "oklch(0.68 0.18 290)",
    gradient: "from-violet-500/5 via-transparent to-transparent",
    mockup: (
      <div className="mt-4 space-y-2">
        {[
          { task: "Market research", done: true },
          { task: "Website generation", done: true },
          { task: "Agent deployment", done: false },
        ].map((t, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${t.done ? "border-[oklch(0.75_0.12_85/0.4)] bg-[oklch(0.75_0.12_85/0.08)]" : "border-white/15"}`}>
              {t.done
                ? <div className="w-2 h-2 rounded-full bg-[oklch(0.75_0.12_85)]" />
                : <motion.div className="w-2 h-2 rounded-full bg-white/20"
                    animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} />
              }
            </div>
            <span className={`text-[10px] ${t.done ? "text-white/30 line-through" : "text-white/70"}`}>{t.task}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Bot,
    title: "Agent Systems",
    tag: "12 AI Agents",
    description: "Sales, Support, Marketing, Research, and Operations agents — pre-built, configurable, and ready to activate instantly.",
    color: "oklch(0.72 0.16 150)",
    gradient: "from-green-500/5 via-transparent to-transparent",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          { name: "Sales Agent", status: "active" },
          { name: "Support Bot", status: "active" },
          { name: "Market Research", status: "idle" },
          { name: "Analytics Agent", status: "active" },
        ].map(a => (
          <div key={a.name} className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-white/60">{a.name}</span>
            <div className="flex items-center gap-1.5">
              <motion.div
                className={`w-1.5 h-1.5 rounded-full ${a.status === "active" ? "bg-green-400" : "bg-yellow-500/60"}`}
                animate={a.status === "active" ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <span className={`text-[9px] ${a.status === "active" ? "text-green-400" : "text-yellow-500/60"}`}>{a.status}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Brain,
    title: "AI Memory",
    tag: "Persistent Context",
    description: "STAGEONE remembers everything. Business context, decisions, strategies — injected automatically into every AI interaction.",
    color: "oklch(0.70 0.18 350)",
    gradient: "from-pink-500/5 via-transparent to-transparent",
    mockup: (
      <div className="mt-4 space-y-2">
        {[
          "Target market: SMB SaaS founders",
          "Revenue model: usage-based",
          "Key differentiator: speed to market",
          "Stage: pre-launch MVP",
        ].map((m, i) => (
          <div key={i} className="flex items-start gap-2">
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_85)] mt-0.5 flex-shrink-0"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
            />
            <span className="text-[10px] text-white/40 leading-relaxed">{m}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Rocket,
    title: "Deployments",
    tag: "One-Click Launch",
    description: "Deploy websites and automations with rollback support, webhook events, and real-time status monitoring.",
    color: "oklch(0.70 0.17 30)",
    gradient: "from-orange-500/5 via-transparent to-transparent",
    mockup: (
      <div className="mt-4 space-y-1.5">
        {[
          { env: "Production", status: "Active", color: "text-green-400", dot: "bg-green-400" },
          { env: "Staging", status: "Active", color: "text-green-400", dot: "bg-green-400" },
          { env: "Preview", status: "Building", color: "text-yellow-400", dot: "bg-yellow-400" },
        ].map((d, i) => (
          <div key={d.env} className="flex items-center justify-between px-2.5 py-2 rounded-xl bg-white/[0.03] border border-white/5">
            <span className="text-[10px] text-white/60">{d.env}</span>
            <div className="flex items-center gap-1.5">
              <motion.div
                className={`w-1.5 h-1.5 rounded-full ${d.dot}`}
                animate={d.status === "Active" ? { opacity: [1, 0.4, 1] } : {}}
                transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
              />
              <span className={`text-[9px] font-medium ${d.color}`}>{d.status}</span>
            </div>
          </div>
        ))}
      </div>
    ),
  },
]

export function OSShowcase() {
  return (
    <section className="relative py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-px w-3/4"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.15), transparent)" }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.03), transparent 70%)", filter: "blur(60px)" }} />
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
            One Platform
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
            Every Business System, Unified
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/40 text-base leading-relaxed">
            Six interconnected AI systems that work together to build, operate,
            and scale your business from a single command center.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {systems.map((sys, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.09, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -5, transition: { duration: 0.25 } }}
              className={`group relative rounded-2xl border border-white/6 p-5 transition-all duration-300 hover:border-white/12 bg-gradient-to-b ${sys.gradient}`}
              style={{
                background: "linear-gradient(145deg, oklch(0.12 0.005 60 / 0.85), oklch(0.09 0.002 60 / 0.85))",
                boxShadow: "0 4px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.04)",
                backdropFilter: "blur(16px)",
              }}
            >
              {/* Glow on hover */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle at 40% 0%, ${sys.color} / 0.08, transparent 65%)` }} />

              {/* Top accent line */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${sys.color} / 0.5, transparent)` }} />

              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] group-hover:bg-white/[0.07] group-hover:border-white/12 transition-all duration-300">
                    <sys.icon className="h-4.5 w-4.5" style={{ color: sys.color }} />
                  </div>
                  <span className="text-[9px] font-medium text-white/40 bg-white/[0.04] border border-white/6 px-2.5 py-1 rounded-full group-hover:text-white/60 transition-colors duration-300">
                    {sys.tag}
                  </span>
                </div>
                <h3 className="text-sm font-semibold text-white mb-1.5">{sys.title}</h3>
                <p className="text-xs text-white/40 leading-relaxed">{sys.description}</p>
                {sys.mockup}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
