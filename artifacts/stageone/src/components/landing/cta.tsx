import { Link } from "wouter"
import { motion } from "framer-motion"
import { ArrowRight, Zap } from "lucide-react"
import { useAuth } from "@/lib/auth-context"
import { useLang } from "@/lib/i18n"

export function CTA() {
  const { user } = useAuth()
  const { t } = useLang()

  return (
    <section className="relative py-32 transition-colors duration-300" style={{ background: "var(--lp-section-bg)" }}>
      <div className="mx-auto max-w-7xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl border p-12 text-center md:p-20"
          style={{
            background: "var(--lp-card-bg)",
            border: "1px solid oklch(0.75 0.12 85 / 0.2)",
            boxShadow: "0 0 0 1px oklch(0.75 0.12 85 / 0.05), 0 40px 80px rgba(0,0,0,0.15)",
            backdropFilter: "blur(24px)",
          }}
        >
          <div className="pointer-events-none absolute inset-0">
            <motion.div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full"
              style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.08), transparent 70%)", filter: "blur(60px)" }}
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
            />
            <div className="absolute left-1/4 top-0 h-64 w-64 rounded-full"
              style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.05), transparent 70%)", filter: "blur(40px)" }} />
            <div className="absolute right-1/4 bottom-0 h-64 w-64 rounded-full"
              style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.04), transparent 70%)", filter: "blur(40px)" }} />
            <div className="absolute inset-0 rounded-3xl opacity-30" style={{
              backgroundImage: "linear-gradient(to right, oklch(0.75 0.12 85 / 0.04) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.75 0.12 85 / 0.04) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }} />
            <div className="absolute inset-x-0 top-0 h-px"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.5), transparent)" }} />
          </div>

          <div className="relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <span className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-6 px-4 py-1.5 rounded-full border"
                style={{ color: "oklch(0.75 0.12 85)", borderColor: "oklch(0.75 0.12 85 / 0.3)", background: "oklch(0.75 0.12 85 / 0.08)" }}>
                <Zap className="w-3 h-3" />
                {t.cta.badge}
              </span>
            </motion.div>

            <h2 className="text-4xl font-bold tracking-tight md:text-5xl lg:text-6xl mb-6" style={{ color: "var(--lp-text)", textShadow: "0 0 80px oklch(0.75 0.12 85 / 0.1)" }}>
              {t.cta.title}
              <span className="block mt-2" style={{
                background: "linear-gradient(135deg, oklch(0.92 0.16 85) 0%, oklch(0.78 0.13 85) 50%, oklch(0.65 0.10 85) 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: "drop-shadow(0 0 30px oklch(0.75 0.12 85 / 0.2))",
              }}>
                {t.cta.titleAccent}
              </span>
            </h2>

            <p className="mx-auto max-w-lg text-base mb-10 leading-relaxed" style={{ color: "var(--lp-muted)" }}>
              {t.cta.subtitle}
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href={user ? "/dashboard" : "/signup"}
                className="group relative inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-10 text-base font-bold overflow-hidden transition-all duration-300"
                style={{
                  background: "linear-gradient(135deg, oklch(0.83 0.15 85), oklch(0.70 0.13 85))",
                  color: "oklch(0.06 0 0)",
                  boxShadow: "0 0 40px oklch(0.75 0.12 85 / 0.35), 0 10px 30px rgba(0,0,0,0.3)",
                }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(135deg, oklch(0.90 0.17 85), oklch(0.78 0.14 85))" }}
                  initial={{ opacity: 0 }}
                  whileHover={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                />
                <span className="relative">{t.cta.ctaPrimary}</span>
                <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>

              <Link
                href="/pricing"
                className="inline-flex h-14 items-center justify-center rounded-2xl px-10 text-base font-medium transition-all duration-300 hover:text-foreground"
                style={{
                  color: "var(--lp-muted)",
                  background: "var(--lp-overlay)",
                  border: "1px solid var(--lp-border-md)",
                  backdropFilter: "blur(12px)",
                }}
              >
                {t.cta.ctaSecondary}
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              {t.cta.microcopy.map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full" style={{ background: "oklch(0.75 0.12 85 / 0.5)" }} />
                  <span className="text-[11px]" style={{ color: "var(--lp-dim)" }}>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
