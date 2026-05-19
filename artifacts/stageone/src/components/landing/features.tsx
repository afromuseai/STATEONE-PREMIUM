import { motion } from "framer-motion"
import { BarChart3, Bot, Globe, Cpu, Workflow, Brain } from "lucide-react"
import { useLang } from "@/lib/i18n"

const ICONS = [BarChart3, Globe, Cpu, Bot, Brain, Workflow]
const STATS = ["84%", "8s", "∞", "12", "100%", "60%"]

export function Features() {
  const { t } = useLang()

  return (
    <section id="features" className="relative py-32 transition-colors duration-300" style={{ background: "var(--lp-section-bg)" }}>
      <div className="pointer-events-none absolute inset-0" style={{
        backgroundImage: "linear-gradient(to right, rgba(184,145,68,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(184,145,68,0.03) 1px, transparent 1px)",
        backgroundSize: "80px 80px",
      }} />

      <div className="relative mx-auto max-w-[1320px] px-8 lg:px-12">
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
              {t.features.badge}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl font-black tracking-[-0.02em] leading-[1.05]" style={{ color: "var(--lp-text)" }}>
            {t.features.title}
          </h2>
          <div className="mt-5 h-px w-24" style={{ background: "linear-gradient(90deg, rgba(184,145,68,0.8), transparent)" }} />
          <p className="mt-5 max-w-xl text-[15px] leading-[1.75]" style={{ color: "var(--lp-muted)" }}>
            {t.features.subtitle}
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((f, i) => {
            const Icon = ICONS[i]
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
                className="group relative p-8 flex flex-col gap-5 rounded-2xl transition-all duration-300"
                style={{
                  background: "var(--lp-card-bg)",
                  border: "1px solid var(--lp-border-md)",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.08)",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(184,145,68,0.25)")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--lp-border-md)")}
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{ background: "rgba(184,145,68,0.07)", border: "1px solid rgba(184,145,68,0.18)" }}>
                  <Icon className="h-5 w-5" style={{ color: "rgba(184,145,68,0.85)" }} />
                </div>

                <div>
                  <h3 className="text-[15px] font-semibold mb-2 tracking-[-0.01em]" style={{ color: "var(--lp-text)" }}>{f.title}</h3>
                  <p className="text-[13px] leading-[1.7]" style={{ color: "var(--lp-muted)" }}>{f.description}</p>
                </div>

                <div className="mt-auto pt-4 flex items-end gap-2" style={{ borderTop: "1px solid var(--lp-border-sub)" }}>
                  <span className="text-2xl font-black tracking-tight" style={{ color: "rgba(184,145,68,0.9)" }}>{STATS[i]}</span>
                  <span className="text-[11px] mb-0.5" style={{ color: "var(--lp-dim)" }}>{f.statLabel}</span>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
