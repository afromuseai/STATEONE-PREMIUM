import { motion } from "framer-motion"
import { MessageSquare, BarChart3, Globe, Cpu, Rocket, Brain } from "lucide-react"

const steps = [
  {
    number: "01",
    icon: MessageSquare,
    title: "Describe Your Vision",
    description: "Enter your business concept in natural language. Target market, goals, challenges — no forms or templates.",
    detail: "AI Memory injects your past context automatically.",
    color: "oklch(0.75 0.12 85)",
  },
  {
    number: "02",
    icon: BarChart3,
    title: "Intelligence Engine",
    description: "Deep market analysis, competitive positioning, revenue modeling, and strategic growth vectors — generated in real time.",
    detail: "Market data + AI reasoning = actionable intelligence.",
    color: "oklch(0.72 0.16 150)",
  },
  {
    number: "03",
    icon: Globe,
    title: "Website Generation",
    description: "Full production website with React components, custom design system, copywriting, and exportable code.",
    detail: "8 sections, complete design, ready to deploy.",
    color: "oklch(0.70 0.15 220)",
  },
  {
    number: "04",
    icon: Cpu,
    title: "AI Orchestration",
    description: "Multi-agent pipeline executes complex business tasks in parallel — agents, automations, and workflows activate.",
    detail: "12 AI systems working in parallel — under 60 seconds.",
    color: "oklch(0.68 0.18 290)",
  },
  {
    number: "05",
    icon: Rocket,
    title: "Deploy & Launch",
    description: "One-click deployment with staging environments, rollback support, and real-time uptime monitoring.",
    detail: "From idea to live product in one session.",
    color: "oklch(0.70 0.17 30)",
  },
  {
    number: "06",
    icon: Brain,
    title: "Memory & Scale",
    description: "STAGEONE learns your business context across sessions, continuously improving every AI interaction.",
    detail: "Persistent AI memory — smarter with every session.",
    color: "oklch(0.70 0.18 350)",
  },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[600px] w-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.04), transparent 70%)", filter: "blur(80px)" }} />
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[500px] w-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.03), transparent 70%)", filter: "blur(80px)" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[oklch(0.75_0.12_85/0.8)] mb-4 px-4 py-1.5 rounded-full border border-[oklch(0.75_0.12_85/0.2)] bg-[oklch(0.75_0.12_85/0.06)]">
            How It Works
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight text-white md:text-5xl">
            From Idea to Operating Business
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-white/40 text-base">
            Six stages. One session. A complete AI-powered business.
          </p>
        </motion.div>

        {/* Flow grid */}
        <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Animated connecting flow lines — top row */}
          <div className="absolute top-[3.5rem] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] hidden lg:block h-px pointer-events-none" style={{ zIndex: 1 }}>
            <motion.div
              className="w-full h-full"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.4), oklch(0.75 0.12 85 / 0.4), transparent)" }}
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
            />
            {/* Moving pulse */}
            <motion.div
              className="absolute top-0 h-full w-16 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.8), transparent)" }}
              animate={{ left: ["-10%", "110%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            />
          </div>

          {/* Bottom row connector */}
          <div className="absolute top-[calc(50%+3.5rem)] left-[calc(16.67%+1.5rem)] right-[calc(16.67%+1.5rem)] hidden lg:block h-px pointer-events-none" style={{ zIndex: 1 }}>
            <motion.div
              className="w-full h-full"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.4), oklch(0.75 0.12 85 / 0.4), transparent)" }}
              initial={{ scaleX: 0, opacity: 0 }}
              whileInView={{ scaleX: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.8, ease: "easeOut" }}
            />
            <motion.div
              className="absolute top-0 h-full w-16 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.8), transparent)" }}
              animate={{ left: ["-10%", "110%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 3 }}
            />
          </div>

          {steps.map((step, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="relative group"
            >
              {/* Step number + icon */}
              <div className="flex flex-col items-center text-center mb-5" style={{ zIndex: 2, position: "relative" }}>
                <div className="relative mb-4">
                  <motion.div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                    style={{
                      background: `linear-gradient(135deg, ${step.color} / 0.12, ${step.color} / 0.04)`,
                      border: `1px solid ${step.color} / 0.25`,
                      boxShadow: `0 0 30px ${step.color} / 0.1`,
                    }}
                    whileHover={{ boxShadow: `0 0 40px ${step.color} / 0.2` }}
                  >
                    <step.icon className="w-6 h-6" style={{ color: step.color }} />
                  </motion.div>
                  <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{ background: step.color, boxShadow: `0 0 12px ${step.color} / 0.5` }}>
                    <span className="text-[8px] font-black text-black">{step.number}</span>
                  </div>
                </div>
              </div>

              {/* Card */}
              <div className="rounded-2xl border border-white/6 p-6 text-center transition-all duration-300 group-hover:border-white/10"
                style={{
                  background: "linear-gradient(145deg, oklch(0.12 0.005 60 / 0.8), oklch(0.09 0.002 60 / 0.8))",
                  boxShadow: "0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)",
                }}>
                {/* Top accent line on hover */}
                <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{ background: `linear-gradient(90deg, transparent, ${step.color} / 0.5, transparent)` }} />

                <h3 className="text-sm font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-xs leading-relaxed text-white/40 mb-4">{step.description}</p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/6 bg-white/[0.02]">
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: step.color }}
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2, delay: index * 0.3, repeat: Infinity }}
                  />
                  <span className="text-[10px] text-white/40 font-medium">{step.detail}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom flow summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 flex items-center justify-center flex-wrap gap-2"
        >
          {["Idea", "Intelligence", "Website", "Execution", "Deployment", "Memory"].map((stage, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-white/50 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/6">
                {stage}
              </span>
              {i < 5 && (
                <motion.span
                  className="text-[oklch(0.75_0.12_85/0.5)] text-xs"
                  animate={{ opacity: [0.3, 0.8, 0.3] }}
                  transition={{ duration: 1.5, delay: i * 0.2, repeat: Infinity }}
                >→</motion.span>
              )}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
