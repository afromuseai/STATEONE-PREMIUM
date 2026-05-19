import { motion } from "framer-motion"
import { Shield, Zap, Lock, Server } from "lucide-react"

const trustPoints = [
  {
    icon: Zap,
    title: "Multi-Model AI Pipeline",
    description: "13 specialized AI models working in parallel — each optimized for its role in your business stack.",
    stat: "13",
    statLabel: "AI Models",
    color: "oklch(0.75 0.12 85)",
  },
  {
    icon: Server,
    title: "Enterprise Infrastructure",
    description: "Production-grade architecture with real-time streaming, persistent memory, and 99.9% uptime SLA.",
    stat: "99.9%",
    statLabel: "Uptime SLA",
    color: "oklch(0.72 0.16 150)",
  },
  {
    icon: Shield,
    title: "Secure by Design",
    description: "JWT authentication, bcrypt encryption, HMAC-signed webhooks, and isolated execution environments.",
    stat: "256-bit",
    statLabel: "Encryption",
    color: "oklch(0.70 0.15 220)",
  },
  {
    icon: Lock,
    title: "Your Data, Your Control",
    description: "All business intelligence and generated assets are stored privately in your account — always exportable.",
    stat: "100%",
    statLabel: "Data Ownership",
    color: "oklch(0.68 0.18 290)",
  },
]

export function Trust() {
  return (
    <section className="relative py-28">
      {/* Section dividers with glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.15), transparent)" }} />
        <div className="absolute inset-x-0 bottom-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.15), transparent)" }} />
        <div className="absolute left-1/2 -translate-x-1/2 top-0 h-32 w-64"
          style={{ background: "radial-gradient(ellipse, oklch(0.75 0.12 85 / 0.06), transparent 70%)" }} />
      </div>

      <div className="relative mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-[oklch(0.75_0.12_85/0.8)] mb-4 px-4 py-1.5 rounded-full border border-[oklch(0.75_0.12_85/0.2)] bg-[oklch(0.75_0.12_85/0.06)]">
            Enterprise Grade
          </span>
          <h2 className="mt-4 text-3xl font-bold text-white md:text-4xl">
            Built for the Next Generation of Business Operators
          </h2>
          <p className="mt-4 text-sm text-white/40 max-w-lg mx-auto leading-relaxed">
            Enterprise-grade infrastructure. AI-native architecture. Production-ready from day one.
          </p>
        </motion.div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {trustPoints.map((point, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.55, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4, transition: { duration: 0.25 } }}
              className="group relative rounded-2xl border border-white/6 p-6 transition-all duration-300 hover:border-white/10"
              style={{
                background: "linear-gradient(145deg, oklch(0.12 0.005 60 / 0.8), oklch(0.09 0.002 60 / 0.8))",
                boxShadow: "0 4px 24px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
            >
              {/* Hover glow */}
              <div className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle at 40% 0%, ${point.color} / 0.06, transparent 70%)` }} />

              {/* Top accent */}
              <div className="absolute inset-x-0 top-0 h-px rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `linear-gradient(90deg, transparent, ${point.color} / 0.4, transparent)` }} />

              <div className="relative">
                {/* Stat highlight */}
                <div className="mb-4 flex items-end gap-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] group-hover:bg-white/[0.06] transition-all duration-300">
                    <point.icon className="h-4.5 w-4.5" style={{ color: point.color }} />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-lg font-black leading-tight" style={{ color: point.color }}>
                      {point.stat}
                    </span>
                    <span className="text-[9px] uppercase tracking-widest text-white/30 leading-tight">{point.statLabel}</span>
                  </div>
                </div>

                <h3 className="text-sm font-semibold text-white mb-2">{point.title}</h3>
                <p className="text-xs leading-relaxed text-white/40">{point.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Infrastructure badges row */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          {[
            "SOC 2 Ready",
            "GDPR Compliant",
            "99.9% SLA",
            "HMAC Signed",
            "JWT Auth",
            "Isolated Execution",
            "Audit Logs",
          ].map((badge, i) => (
            <span key={i} className="text-[10px] font-medium text-white/30 px-3 py-1.5 rounded-lg bg-white/[0.025] border border-white/5">
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
