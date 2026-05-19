import { useEffect, useRef, useState } from "react"
import { motion, useInView } from "framer-motion"

const STATS = [
  { value: 2400, suffix: "+", label: "Businesses Launched", decimals: 0 },
  { value: 47, suffix: "s", label: "Average Time to First Insight", decimals: 0 },
  { value: 98, suffix: "%", label: "Satisfaction Rate", decimals: 0 },
  { value: 12, suffix: "", label: "AI Agents Ready to Deploy", decimals: 0 },
]

function useCountUp(target: number, decimals: number, active: boolean, duration = 1800) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active) return
    let start: number | null = null
    const step = (timestamp: number) => {
      if (!start) start = timestamp
      const progress = Math.min((timestamp - start) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(parseFloat((eased * target).toFixed(decimals)))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [active, target, decimals, duration])

  return count
}

function StatCard({
  value, suffix, label, decimals, index, active,
}: {
  value: number; suffix: string; label: string; decimals: number; index: number; active: boolean
}) {
  const count = useCountUp(value, decimals, active)

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      animate={active ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, delay: index * 0.12, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center text-center px-8 py-10 group"
    >
      {/* Divider between cards (not after last) */}
      {index < STATS.length - 1 && (
        <div className="absolute right-0 inset-y-8 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden lg:block" />
      )}

      {/* Glow behind number */}
      <div className="absolute inset-0 rounded-2xl bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      <div className="relative mb-2">
        <span className="text-5xl lg:text-6xl font-bold tabular-nums"
          style={{
            background: "linear-gradient(135deg, #e8c96a 0%, #c9a227 50%, #f0d882 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          {decimals > 0 ? count.toFixed(decimals) : Math.floor(count).toLocaleString()}
          {suffix}
        </span>

        {/* Subtle glow under number */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-primary/30 blur-xl rounded-full opacity-60" />
      </div>

      <p className="text-sm text-muted-foreground/80 font-medium mt-3 max-w-[140px] leading-snug">
        {label}
      </p>
    </motion.div>
  )
}

export function StatsCounter() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, margin: "-80px" })

  return (
    <section ref={ref} className="relative py-4 overflow-hidden">
      {/* Top separator line */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />
      {/* Bottom separator line */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent" />

      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-96 h-40 bg-primary/[0.06] blur-[80px] rounded-full" />
        <div className="absolute right-1/4 top-1/2 -translate-y-1/2 w-72 h-32 bg-primary/[0.04] blur-[60px] rounded-full" />
      </div>

      <div className="relative mx-auto max-w-[1320px] px-8 lg:px-12">
        {/* Label above */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="flex justify-center mb-6"
        >
          <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary/50">
            By the numbers
          </span>
        </motion.div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 divide-white/[0.06]">
          {STATS.map((stat, i) => (
            <StatCard key={stat.label} {...stat} index={i} active={isInView} />
          ))}
        </div>
      </div>
    </section>
  )
}
