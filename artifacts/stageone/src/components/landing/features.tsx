import { motion } from "framer-motion"
import { BarChart3, Bot, Globe, Cpu, Workflow, Brain, Rocket, Shield } from "lucide-react"

const FEATURES = [
  {
    icon: BarChart3,
    title: "Business Intelligence",
    description: "Deep AI analysis of market positioning, competitive landscape, revenue potential, and growth vectors — delivered in seconds.",
    stat: "84%", statLabel: "accuracy rate",
  },
  {
    icon: Globe,
    title: "Website Architect",
    description: "Generate complete, production-ready websites with custom design, copywriting, and React component code. Export and deploy instantly.",
    stat: "8s", statLabel: "generation time",
  },
  {
    icon: Cpu,
    title: "AI Execution Engine",
    description: "A persistent orchestration layer that plans, executes, and monitors complex business tasks across your entire operation.",
    stat: "∞", statLabel: "parallel tasks",
  },
  {
    icon: Bot,
    title: "Agent Systems",
    description: "12 pre-built autonomous agents across Sales, Support, Marketing, Research, and Operations — install and configure in one click.",
    stat: "12", statLabel: "ready agents",
  },
  {
    icon: Brain,
    title: "AI Memory",
    description: "Persistent cross-session intelligence. STAGEONE learns your business context and injects it into every future AI interaction.",
    stat: "100%", statLabel: "context retained",
  },
  {
    icon: Workflow,
    title: "Automation Builder",
    description: "Identify and implement automation opportunities across your operations with detailed workflow blueprints and execution plans.",
    stat: "60%", statLabel: "time saved",
  },
]

export function Features() {
  return (
    <section id="features" className="relative py-32" style={{ background: "#050505" }}>
      {/* Very faint gold grid — consistent with hero */}
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: "linear-gradient(to right, rgba(184,145,68,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(184,145,68,0.03) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      <div className="relative mx-auto max-w-[1320px] px-8 lg:px-12">

        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-6"
            style={{ background: "rgba(184,145,68,0.08)", border: "1px solid rgba(184,145,68,0.25)" }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "rgba(184,145,68,0.9)" }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "rgba(184,145,68,0.9)" }}>
              Platform Capabilities
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] text-white leading-[1.05]">
            The Complete AI Business OS
          </h2>
          <div className="mt-5 h-px w-24" style={{ background: "linear-gradient(90deg, rgba(184,145,68,0.8), transparent)" }} />
          <p className="mt-5 max-w-xl text-[15px] leading-[1.75]" style={{ color: "rgba(255,255,255,0.38)" }}>
            Every system you need to build, operate, and scale a modern business — orchestrated by AI, executed in real time.
          </p>
        </motion.div>

        {/* Feature grid — 3 columns */}
        <div className="grid gap-px md:grid-cols-2 lg:grid-cols-3"
          style={{ background: "rgba(184,145,68,0.08)", borderRadius: "20px", overflow: "hidden", border: "1px solid rgba(184,145,68,0.10)" }}>
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.07 }}
              className="group relative p-8 flex flex-col gap-5 transition-colors duration-300"
              style={{ background: "#050505" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(184,145,68,0.04)")}
              onMouseLeave={e => (e.currentTarget.style.background = "#050505")}
            >
              {/* Icon */}
              <div className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: "rgba(184,145,68,0.07)", border: "1px solid rgba(184,145,68,0.18)" }}>
                <f.icon className="h-5 w-5" style={{ color: "rgba(184,145,68,0.85)" }} />
              </div>

              {/* Text */}
              <div>
                <h3 className="text-[15px] font-semibold text-white mb-2 tracking-[-0.01em]">{f.title}</h3>
                <p className="text-[13px] leading-[1.7]" style={{ color: "rgba(255,255,255,0.36)" }}>{f.description}</p>
              </div>

              {/* Stat */}
              <div className="mt-auto pt-4 flex items-end gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="text-2xl font-black tracking-tight" style={{ color: "rgba(184,145,68,0.9)" }}>{f.stat}</span>
                <span className="text-[11px] mb-0.5" style={{ color: "rgba(255,255,255,0.25)" }}>{f.statLabel}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
