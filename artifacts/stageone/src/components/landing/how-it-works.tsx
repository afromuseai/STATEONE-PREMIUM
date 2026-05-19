import { motion } from "framer-motion"
import { MessageSquare, BarChart3, Globe, Cpu, Rocket, Brain } from "lucide-react"
import { useLang } from "@/lib/i18n"

const ICONS = [MessageSquare, BarChart3, Globe, Cpu, Rocket, Brain]
const COLORS = [
  "oklch(0.75 0.12 85)",
  "oklch(0.72 0.16 150)",
  "oklch(0.70 0.15 220)",
  "oklch(0.68 0.18 290)",
  "oklch(0.70 0.17 30)",
  "oklch(0.70 0.18 350)",
]
const NUMBERS = ["01", "02", "03", "04", "05", "06"]

export function HowItWorks() {
  const { t } = useLang()

  return (
    <section id="how-it-works" className="relative py-32 overflow-hidden transition-colors duration-300" style={{ background: "var(--lp-section-bg)" }}>
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
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] mb-4 px-4 py-1.5 rounded-full border"
            style={{ color: "oklch(0.75 0.12 85 / 0.8)", borderColor: "oklch(0.75 0.12 85 / 0.2)", background: "oklch(0.75 0.12 85 / 0.06)" }}>
            {t.howItWorks.badge}
          </span>
          <h2 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl" style={{ color: "var(--lp-text)" }}>
            {t.howItWorks.title}
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-base" style={{ color: "var(--lp-muted)" }}>
            {t.howItWorks.subtitle}
          </p>
        </motion.div>

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
            <motion.div
              className="absolute top-0 h-full w-16 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.8), transparent)" }}
              animate={{ left: ["-10%", "110%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            />
          </div>

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

          {t.howItWorks.steps.map((step, index) => {
            const Icon = ICONS[index]
            const color = COLORS[index]
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className="relative group"
              >
                <div className="flex flex-col items-center text-center mb-5" style={{ zIndex: 2, position: "relative" }}>
                  <div className="relative mb-4">
                    <motion.div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                      style={{
                        background: `color-mix(in oklch, ${color} 10%, transparent)`,
                        border: `1px solid color-mix(in oklch, ${color} 25%, transparent)`,
                        boxShadow: `0 0 30px color-mix(in oklch, ${color} 10%, transparent)`,
                      }}
                      whileHover={{ boxShadow: `0 0 40px color-mix(in oklch, ${color} 20%, transparent)` }}
                    >
                      <Icon className="w-6 h-6" style={{ color }} />
                    </motion.div>
                    <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ background: color, boxShadow: `0 0 12px color-mix(in oklch, ${color} 50%, transparent)` }}>
                      <span className="text-[8px] font-black text-black">{NUMBERS[index]}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border p-6 text-center transition-all duration-300 group-hover:border-white/10"
                  style={{
                    background: "var(--lp-card-bg)",
                    border: "1px solid var(--lp-border-sub)",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.15)",
                  }}>
                  <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                    style={{ background: `linear-gradient(90deg, transparent, ${color} / 0.5, transparent)` }} />

                  <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--lp-text)" }}>{step.title}</h3>
                  <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--lp-muted)" }}>{step.description}</p>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border"
                    style={{ borderColor: "var(--lp-border-sub)", background: "var(--lp-overlay)" }}>
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: color }}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, delay: index * 0.3, repeat: Infinity }}
                    />
                    <span className="text-[10px] font-medium" style={{ color: "var(--lp-dim)" }}>{step.detail}</span>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 flex items-center justify-center flex-wrap gap-2"
        >
          {t.howItWorks.stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                style={{ color: "var(--lp-muted)", background: "var(--lp-overlay)", border: "1px solid var(--lp-border-sub)" }}>
                {stage}
              </span>
              {i < t.howItWorks.stages.length - 1 && (
                <motion.span
                  className="text-xs"
                  style={{ color: "oklch(0.75 0.12 85 / 0.5)" }}
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
