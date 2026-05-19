import { Link } from "wouter"
import { motion, useMotionValue, useTransform, animate, useScroll, useSpring } from "framer-motion"
import {
  ArrowRight, Sparkles, Globe, Bot, Cpu,
  Brain, Zap, CheckCircle2, BarChart3, Activity, Play,
} from "lucide-react"
import { useEffect, useState, useRef } from "react"
import { useAuth } from "@/lib/auth-context"

/* ─── Typing headline ─────────────────────────────────────────────── */
const BUSINESS_TYPES = [
  "Modern Businesses.",
  "SaaS Startups.",
  "E-commerce Brands.",
  "Creative Agencies.",
  "Tech Founders.",
  "Service Companies.",
]

function TypingText() {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [phase, setPhase] = useState<"typing" | "pause" | "erasing">("typing")

  useEffect(() => {
    const target = BUSINESS_TYPES[index]
    let timeout: ReturnType<typeof setTimeout>

    if (phase === "typing") {
      if (displayed.length < target.length) {
        timeout = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 55)
      } else {
        timeout = setTimeout(() => setPhase("pause"), 1800)
      }
    } else if (phase === "pause") {
      timeout = setTimeout(() => setPhase("erasing"), 200)
    } else {
      if (displayed.length > 0) {
        timeout = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30)
      } else {
        setIndex((i) => (i + 1) % BUSINESS_TYPES.length)
        setPhase("typing")
      }
    }
    return () => clearTimeout(timeout)
  }, [displayed, phase, index])

  return (
    <span style={{
      background: "linear-gradient(135deg, oklch(0.92 0.16 85) 0%, oklch(0.80 0.14 85) 40%, oklch(0.65 0.10 85) 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      filter: "drop-shadow(0 0 40px oklch(0.75 0.12 85 / 0.25))",
    }}>
      {displayed}
      <motion.span
        animate={{ opacity: [1, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatType: "reverse" }}
        style={{ WebkitTextFillColor: "oklch(0.75 0.12 85 / 0.8)" }}
      >|</motion.span>
    </span>
  )
}

/* ─── Counter ─────────────────────────────────────────────────────── */
function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const count = useMotionValue(0)
  const rounded = useTransform(count, (v) => Math.round(v))
  const [display, setDisplay] = useState("0")
  useEffect(() => {
    const c = animate(count, to, { duration: 2, ease: "easeOut" })
    const u = rounded.on("change", (v) => setDisplay(String(v)))
    return () => { c.stop(); u() }
  }, [to])
  return <span>{display}{suffix}</span>
}

/* ─── Ticker ──────────────────────────────────────────────────────── */
const TICKS = [
  "Business Intelligence", "Website Generation", "Autonomous Agents",
  "AI Memory", "Execution Engine", "Market Analysis",
  "Deployment Infrastructure", "Automation Workflows", "Growth Strategy",
]
function Ticker() {
  const items = [...TICKS, ...TICKS]
  return (
    <div className="relative w-full overflow-hidden border-y border-[oklch(0.75_0.12_85/0.12)] bg-[oklch(0.75_0.12_85/0.025)] py-3">
      <div className="pointer-events-none absolute left-0 inset-y-0 w-32 bg-gradient-to-r from-[oklch(0.08_0_0)] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 inset-y-0 w-32 bg-gradient-to-l from-[oklch(0.08_0_0)] to-transparent z-10" />
      <motion.div
        className="flex gap-10 whitespace-nowrap"
        animate={{ x: [0, "-50%"] }}
        transition={{ duration: 35, repeat: Infinity, ease: "linear" }}
      >
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-3 flex-shrink-0">
            <motion.div
              className="w-1 h-1 rounded-full bg-[oklch(0.75_0.12_85)]"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
            />
            <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-[oklch(0.75_0.12_85/0.6)]">
              {item}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

/* ─── Ambient node grid ───────────────────────────────────────────── */
function NodeGrid() {
  const nodes = Array.from({ length: 12 }, (_, i) => ({
    x: (i % 4) * 25 + 12.5,
    y: Math.floor(i / 4) * 33 + 16,
    delay: i * 0.4,
  }))
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 w-full h-full opacity-[0.12]" xmlns="http://www.w3.org/2000/svg">
        {nodes.map((n, i) =>
          nodes.slice(i + 1).map((m, j) => {
            const dist = Math.hypot(n.x - m.x, n.y - m.y)
            if (dist > 35) return null
            return (
              <motion.line
                key={`${i}-${j}`}
                x1={`${n.x}%`} y1={`${n.y}%`}
                x2={`${m.x}%`} y2={`${m.y}%`}
                stroke="oklch(0.75 0.12 85)"
                strokeWidth="0.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 4, delay: (i + j) * 0.6, repeat: Infinity, ease: "easeInOut" }}
              />
            )
          })
        )}
        {nodes.map((n, i) => (
          <motion.circle
            key={i}
            cx={`${n.x}%`} cy={`${n.y}%`} r="1.5"
            fill="oklch(0.75 0.12 85)"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.2, 0.8, 0.2] }}
            transition={{ duration: 3, delay: n.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </svg>
    </div>
  )
}

/* ─── Product card: Business Intelligence ──────────────────────────── */
function BICard() {
  const metrics = [
    { label: "Market Opportunity", val: "$4.2B", pct: 84 },
    { label: "Competitive Score", val: "9.1/10", pct: 91 },
    { label: "Growth Rate", val: "34% YoY", pct: 68 },
  ]
  const bars = [84, 67, 91, 58, 76, 45, 88, 62]
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[oklch(0.75_0.12_85/0.12)] border border-[oklch(0.75_0.12_85/0.3)] flex items-center justify-center">
            <BarChart3 className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
          </div>
          <span className="text-xs font-semibold text-white">Business Intelligence</span>
        </div>
        <motion.span
          className="text-[9px] font-bold text-[oklch(0.75_0.12_85)] bg-[oklch(0.75_0.12_85/0.1)] border border-[oklch(0.75_0.12_85/0.3)] px-2 py-0.5 rounded-full uppercase tracking-wider"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        >Live</motion.span>
      </div>
      {metrics.map((m, i) => (
        <div key={i} className="mb-3">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] text-white/50">{m.label}</span>
            <span className="text-[10px] font-bold text-[oklch(0.75_0.12_85)]">{m.val}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.05]">
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, oklch(0.65 0.12 85), oklch(0.85 0.14 85))" }}
              initial={{ width: 0 }}
              whileInView={{ width: `${m.pct}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.2 + i * 0.15, ease: "easeOut" }}
            />
          </div>
        </div>
      ))}
      <div className="mt-4 flex items-end gap-1 h-12">
        {bars.map((h, i) => (
          <motion.div key={i}
            className="flex-1 rounded-sm"
            style={{ height: `${h}%`, background: i % 2 === 0 ? "oklch(0.75 0.12 85 / 0.4)" : "oklch(0.75 0.12 85 / 0.2)" }}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.5 + i * 0.06 }}
          />
        ))}
      </div>
    </div>
  )
}

/* ─── Product card: Website Architect ─────────────────────────────── */
function WebsiteCard() {
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[oklch(0.75_0.12_85/0.12)] border border-[oklch(0.75_0.12_85/0.3)] flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
          </div>
          <span className="text-xs font-semibold text-white">Website Architect</span>
        </div>
        <motion.span
          className="text-[9px] font-bold text-green-400 bg-green-400/10 border border-green-400/25 px-2 py-0.5 rounded-full uppercase tracking-wider"
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 1.8, repeat: Infinity }}
        >Generating</motion.span>
      </div>
      <div className="rounded-xl border border-white/8 bg-black/70 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 bg-white/[0.03] border-b border-white/5">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
          <div className="flex-1 mx-3 h-4 rounded-md bg-white/5 flex items-center px-2">
            <span className="text-[8px] text-white/20">stageone.app</span>
          </div>
        </div>
        <div className="p-3 space-y-2">
          <motion.div
            className="h-5 rounded-md w-3/4"
            style={{ background: "linear-gradient(90deg, oklch(0.75 0.12 85 / 0.3), oklch(0.75 0.12 85 / 0.15))" }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 rounded-lg bg-white/4 border border-white/5" />
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="h-1.5 w-full rounded bg-white/5" />
            <div className="h-1.5 w-5/6 rounded bg-white/5" />
            <div className="h-1.5 w-2/3 rounded bg-white/5" />
          </div>
          <div className="flex gap-2 pt-1">
            <div className="h-6 w-16 rounded-lg" style={{ background: "oklch(0.75 0.12 85 / 0.4)" }} />
            <div className="h-6 w-12 rounded-lg bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Product card: Agents ─────────────────────────────────────────── */
function AgentsCard() {
  const agents = [
    { name: "Sales Agent", status: true, tasks: 24 },
    { name: "Support Bot", status: true, tasks: 87 },
    { name: "Market Research", status: false, tasks: 12 },
    { name: "Analytics Agent", status: true, tasks: 41 },
  ]
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[oklch(0.75_0.12_85/0.12)] border border-[oklch(0.75_0.12_85/0.3)] flex items-center justify-center">
            <Bot className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
          </div>
          <span className="text-xs font-semibold text-white">Agent Systems</span>
        </div>
        <span className="text-[9px] text-white/40">12 agents</span>
      </div>
      <div className="space-y-2">
        {agents.map((a, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/6"
          >
            <div className="flex items-center gap-2.5">
              <motion.div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${a.status ? "bg-green-400" : "bg-white/20"}`}
                animate={a.status ? { boxShadow: ["0 0 0px #4ade80", "0 0 8px #4ade80", "0 0 0px #4ade80"] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[10px] font-medium text-white/80">{a.name}</span>
            </div>
            <span className="text-[10px] font-bold text-[oklch(0.75_0.12_85)]">{a.tasks} tasks</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ─── Product card: Execution ─────────────────────────────────────── */
function ExecutionCard() {
  const tasks = [
    { t: "Market analysis complete", done: true },
    { t: "Website sections generated", done: true },
    { t: "Agent deployment scheduled", done: true },
    { t: "Automation workflows building", done: false },
    { t: "Production deploy queued", done: false },
  ]
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[oklch(0.75_0.12_85/0.12)] border border-[oklch(0.75_0.12_85/0.3)] flex items-center justify-center">
            <Cpu className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
          </div>
          <span className="text-xs font-semibold text-white">Execution Engine</span>
        </div>
        <div className="flex items-center gap-1.5">
          <motion.div className="w-2 h-2 rounded-full bg-green-400"
            animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
          <span className="text-[9px] font-semibold text-green-400">Running</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {tasks.map((t, i) => (
          <motion.div key={i}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="flex items-center gap-2.5"
          >
            {t.done
              ? <CheckCircle2 className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)] flex-shrink-0" />
              : (
                <div className="w-3.5 h-3.5 rounded-full border border-white/20 flex-shrink-0 flex items-center justify-center">
                  <motion.div className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_85/0.6)]"
                    animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1, repeat: Infinity }} />
                </div>
              )
            }
            <span className={`text-[10px] leading-relaxed ${t.done ? "text-white/30 line-through" : "text-white/80"}`}>{t.t}</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ─── Product card: Memory ─────────────────────────────────────────── */
function MemoryCard() {
  const memories = [
    { text: "Target: B2B SaaS founders", relevance: 98 },
    { text: "Revenue: usage-based pricing", relevance: 94 },
    { text: "Stage: pre-launch MVP", relevance: 88 },
    { text: "Differentiation: speed & AI depth", relevance: 82 },
  ]
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[oklch(0.75_0.12_85/0.12)] border border-[oklch(0.75_0.12_85/0.3)] flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
          </div>
          <span className="text-xs font-semibold text-white">AI Memory</span>
        </div>
        <span className="text-[9px] font-bold text-[oklch(0.75_0.12_85)]">12 stored</span>
      </div>
      <div className="space-y-2">
        {memories.map((m, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: 8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/6"
          >
            <motion.div
              className="w-1.5 h-1.5 rounded-full bg-[oklch(0.75_0.12_85)] flex-shrink-0"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 2, delay: i * 0.5, repeat: Infinity }}
            />
            <span className="text-[10px] text-white/60 flex-1 leading-relaxed">{m.text}</span>
            <span className="text-[10px] font-bold text-[oklch(0.75_0.12_85)]">{m.relevance}%</span>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/* ─── Product card: Deploy ─────────────────────────────────────────── */
function DeployCard() {
  const envs = [
    { name: "Production", url: "stageone.app", status: "Active", color: "text-green-400", dot: "bg-green-400" },
    { name: "Staging", url: "stg.stageone.app", status: "Active", color: "text-green-400", dot: "bg-green-400" },
    { name: "Preview", url: "prev.stageone.app", status: "Building", color: "text-yellow-400", dot: "bg-yellow-400" },
  ]
  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[oklch(0.75_0.12_85/0.12)] border border-[oklch(0.75_0.12_85/0.3)] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-[oklch(0.75_0.12_85)]" />
          </div>
          <span className="text-xs font-semibold text-white">Deployments</span>
        </div>
      </div>
      <div className="space-y-2 mb-3">
        {envs.map((e, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, y: 4 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="px-3 py-2.5 rounded-xl bg-white/[0.03] border border-white/6"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-white/80">{e.name}</span>
              <div className="flex items-center gap-1.5">
                <motion.div
                  className={`w-1.5 h-1.5 rounded-full ${e.dot}`}
                  animate={e.status === "Active" ? { boxShadow: ["0 0 0px rgba(74,222,128,0)", "0 0 6px rgba(74,222,128,0.6)", "0 0 0px rgba(74,222,128,0)"] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                <span className={`text-[9px] font-semibold ${e.color}`}>{e.status}</span>
              </div>
            </div>
            <span className="text-[9px] text-white/30">{e.url}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[oklch(0.75_0.12_85/0.2)] bg-[oklch(0.75_0.12_85/0.04)]">
        <Activity className="w-3 h-3 text-[oklch(0.75_0.12_85)]" />
        <span className="text-[9px] font-medium text-[oklch(0.75_0.12_85/0.8)]">99.9% uptime · 0 incidents</span>
      </div>
    </div>
  )
}

/* ─── Card wrapper ─────────────────────────────────────────────────── */
function Card({ children, delay = 0, gold = false }: {
  children: React.ReactNode; delay?: number; gold?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -6, transition: { duration: 0.3 } }}
      className="relative rounded-2xl overflow-hidden group"
      style={{
        background: gold
          ? "linear-gradient(145deg, oklch(0.13 0.006 60 / 0.95), oklch(0.10 0.004 60 / 0.95))"
          : "linear-gradient(145deg, oklch(0.12 0.005 60 / 0.92), oklch(0.09 0.003 60 / 0.92))",
        border: gold
          ? "1px solid oklch(0.75 0.12 85 / 0.35)"
          : "1px solid oklch(0.25 0.01 60 / 0.5)",
        boxShadow: gold
          ? "0 0 50px oklch(0.75 0.12 85 / 0.1), 0 24px 48px rgba(0,0,0,0.7), inset 0 1px 0 oklch(0.75 0.12 85 / 0.1)"
          : "0 24px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)",
        backdropFilter: "blur(20px)",
      }}
    >
      {gold && (
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.7), transparent)" }} />
      )}
      {!gold && (
        <div className="absolute inset-x-0 top-0 h-px"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)" }} />
      )}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
        style={{ background: gold
          ? "radial-gradient(circle at 50% 0%, oklch(0.75 0.12 85 / 0.08), transparent 70%)"
          : "radial-gradient(circle at 50% 0%, oklch(0.75 0.12 85 / 0.04), transparent 70%)"
        }} />
      {children}
    </motion.div>
  )
}

/* ─── Metrics strip ────────────────────────────────────────────────── */
function MetricsStrip() {
  const metrics = [
    { label: "Businesses Built", value: 2400, suffix: "+", icon: "◈" },
    { label: "AI Models Active", value: 13, suffix: "", icon: "⬡" },
    { label: "Avg. Time to Launch", value: 47, suffix: "s", icon: "◎" },
    { label: "Uptime SLA", value: 99, suffix: ".9%", icon: "◇" },
  ]

  return (
    <div className="relative border-y border-[oklch(0.75_0.12_85/0.1)] bg-[oklch(0.09_0.003_60)]">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.25), transparent)" }} />
      <div className="absolute inset-x-0 bottom-0 h-px" style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.25), transparent)" }} />
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-[oklch(0.75_0.12_85/0.08)]">
          {metrics.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative flex flex-col items-center justify-center px-8 py-6 group"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: "radial-gradient(ellipse at 50% 100%, oklch(0.75 0.12 85 / 0.04), transparent 70%)" }} />
              <span className="text-[11px] text-[oklch(0.75_0.12_85/0.5)] mb-1 font-mono">{m.icon}</span>
              <div className="text-3xl font-black tracking-tight" style={{
                background: "linear-gradient(135deg, oklch(0.90 0.14 85), oklch(0.72 0.11 85))",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                <Counter to={m.value} suffix={m.suffix} />
              </div>
              <span className="text-[11px] font-medium text-white/35 mt-1.5 uppercase tracking-widest text-center">{m.label}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Brand Showcase Image ─────────────────────────────────────────── */
function OSCommandCenter() {
  return (
    <div className="relative mx-auto max-w-6xl px-6 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        className="relative"
      >
        {/* Outer glow border */}
        <div className="absolute -inset-px rounded-3xl pointer-events-none z-10" style={{
          background: "linear-gradient(135deg, oklch(0.75 0.12 85 / 0.25), transparent 40%, oklch(0.75 0.12 85 / 0.12) 100%)",
        }} />

        {/* Brand image */}
        <div className="relative rounded-3xl overflow-hidden border border-[oklch(0.75_0.12_85/0.22)]" style={{
          boxShadow: "0 0 0 1px oklch(0.75 0.12 85 / 0.06), 0 40px 100px rgba(0,0,0,0.85), 0 0 140px oklch(0.75 0.12 85 / 0.1)",
        }}>
          <img
            src="/hero-dashboard.png"
            alt="STAGEONE OS Command Center"
            className="w-full h-auto block"
            style={{ display: "block" }}
          />
          {/* Subtle top-edge highlight */}
          <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.6), transparent)" }} />
          {/* Live status badge overlay */}
          <div className="absolute bottom-5 left-5 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md"
            style={{ background: "oklch(0.08 0 0 / 0.85)" }}>
            <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
              animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
            <span className="text-[9px] font-semibold text-green-400/90 tracking-wide">All Systems Active</span>
          </div>
        </div>

        {/* Ambient glow underneath */}
        <div className="absolute -inset-20 -z-10 opacity-40"
          style={{
            background: "radial-gradient(ellipse 60% 30% at 50% 100%, oklch(0.75 0.12 85 / 0.22), transparent)",
            filter: "blur(40px)",
          }} />
      </motion.div>
    </div>
  )
}

/* ─── Hero ─────────────────────────────────────────────────────────── */
export function Hero() {
  const { user } = useAuth()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const parallaxY = useSpring(useTransform(scrollYProgress, [0, 1], [0, 80]), { stiffness: 80, damping: 20 })

  return (
    <section ref={ref} className="relative overflow-hidden bg-[oklch(0.08_0_0)] pt-16">

      {/* ── Background ─────────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        {/* Primary gold halo */}
        <motion.div className="absolute inset-x-0 top-0 h-[900px]" style={{ y: parallaxY }}
          animate={{
            background: [
              "radial-gradient(ellipse 90% 70% at 50% -5%, oklch(0.75 0.12 85 / 0.20) 0%, oklch(0.75 0.12 85 / 0.07) 40%, transparent 70%)",
              "radial-gradient(ellipse 95% 72% at 50% -5%, oklch(0.75 0.12 85 / 0.22) 0%, oklch(0.75 0.12 85 / 0.08) 40%, transparent 70%)",
              "radial-gradient(ellipse 90% 70% at 50% -5%, oklch(0.75 0.12 85 / 0.20) 0%, oklch(0.75 0.12 85 / 0.07) 40%, transparent 70%)",
            ]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Side ambient glows */}
        <div className="absolute -left-32 top-1/3 h-[500px] w-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.04), transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute -right-32 top-1/4 h-[400px] w-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.75 0.12 85 / 0.03), transparent 70%)", filter: "blur(40px)" }} />

        {/* Grid — primary structure */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(to right, oklch(0.75 0.12 85 / 0.045) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.75 0.12 85 / 0.045) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
        }} />

        {/* Subtle secondary grid */}
        <div className="absolute inset-0 opacity-40" style={{
          backgroundImage: "linear-gradient(to right, oklch(0.75 0.12 85 / 0.02) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.75 0.12 85 / 0.02) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }} />

        {/* Fade grid at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-96"
          style={{ background: "linear-gradient(to bottom, transparent, oklch(0.08 0 0))" }} />
      </div>

      {/* Ambient node network */}
      <NodeGrid />

      {/* Floating orbs */}
      <motion.div
        className="pointer-events-none absolute left-[8%] top-[22%] h-80 w-80 rounded-full"
        style={{ background: "oklch(0.75 0.12 85 / 0.05)", filter: "blur(90px)" }}
        animate={{ y: [0, -24, 0], scale: [1, 1.1, 1] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute right-[8%] top-[30%] h-56 w-56 rounded-full"
        style={{ background: "oklch(0.75 0.12 85 / 0.04)", filter: "blur(70px)" }}
        animate={{ y: [0, 24, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* ── Split hero: text LEFT, image RIGHT ─────────────────────── */}
      <div className="relative mx-auto max-w-[1400px] px-6 pt-20 pb-0 flex flex-col lg:flex-row items-center gap-12 lg:gap-0 min-h-[calc(100vh-64px)]">

        {/* ── LEFT: text content ──────────────────────────────────── */}
        <div className="relative z-10 flex-1 flex flex-col items-start justify-center py-16 lg:pr-16">

          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mb-8 inline-flex items-center gap-2.5 rounded-full px-5 py-2"
            style={{
              background: "linear-gradient(135deg, oklch(0.75 0.12 85 / 0.12), oklch(0.75 0.12 85 / 0.06))",
              border: "1px solid oklch(0.75 0.12 85 / 0.35)",
              boxShadow: "0 0 20px oklch(0.75 0.12 85 / 0.1), inset 0 1px 0 oklch(0.75 0.12 85 / 0.1)",
              backdropFilter: "blur(12px)",
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            >
              <Sparkles className="h-4 w-4 text-[oklch(0.75_0.12_85)]" />
            </motion.div>
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[oklch(0.75_0.12_85)]">
              AI Business Operating System
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-5xl sm:text-6xl lg:text-[72px] xl:text-[84px] font-black leading-[1.0] tracking-[-0.02em]"
          >
            <span className="block text-white" style={{ textShadow: "0 0 80px oklch(0.75 0.12 85 / 0.15)" }}>
              The AI Operating System
            </span>
            <span className="block mt-2">
              for <TypingText />
            </span>
          </motion.h1>

          {/* Gold separator */}
          <motion.div
            initial={{ scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ duration: 1, delay: 0.45 }}
            className="my-8 h-px w-48 origin-left"
            style={{ background: "linear-gradient(90deg, oklch(0.75 0.12 85 / 0.9), transparent)" }}
          />

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.5 }}
            className="max-w-lg text-base md:text-lg leading-relaxed text-white/50"
          >
            Build, orchestrate, automate, and scale businesses through one unified AI intelligence
            platform — combining strategy, websites, execution, memory, and operational systems
            in one environment.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row items-start gap-4"
          >
            <Link href={user ? "/dashboard" : "/signup"}
              className="group relative inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-10 text-sm font-bold overflow-hidden transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, oklch(0.83 0.15 85), oklch(0.70 0.13 85))",
                color: "oklch(0.06 0 0)",
                boxShadow: "0 0 40px oklch(0.75 0.12 85 / 0.35), 0 10px 30px rgba(0,0,0,0.5), inset 0 1px 0 oklch(0.90 0.16 85 / 0.5)",
              }}
            >
              <motion.div className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, oklch(0.90 0.17 85), oklch(0.78 0.14 85))" }}
                initial={{ opacity: 0 }} whileHover={{ opacity: 1 }} transition={{ duration: 0.2 }}
              />
              <span className="relative">Start Building</span>
              <ArrowRight className="relative h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>

            <a href="/#how-it-works"
              className="group inline-flex h-14 items-center justify-center gap-2.5 rounded-2xl px-10 text-sm font-semibold text-white/70 transition-all duration-300 hover:text-white"
              style={{
                background: "oklch(0.13 0.004 60 / 0.7)",
                border: "1px solid oklch(0.30 0.01 60 / 0.6)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
              }}
            >
              <Play className="h-3.5 w-3.5 opacity-70 group-hover:opacity-100 transition-opacity" />
              See How It Works
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="mt-10 flex items-center gap-5"
          >
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-[oklch(0.75_0.12_85)] text-xs">★</span>
              ))}
            </div>
            <span className="text-[11px] text-white/30">Trusted by 2,400+ business builders</span>
            <div className="h-3 w-px bg-white/10" />
            <span className="text-[11px] text-white/30">No credit card required</span>
          </motion.div>
        </div>

        {/* ── RIGHT: brand image ──────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="relative lg:w-[52%] xl:w-[55%] flex-shrink-0 w-full"
        >
          {/* Glow behind image */}
          <div className="absolute -inset-8 rounded-3xl pointer-events-none"
            style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, oklch(0.75 0.12 85 / 0.12), transparent 70%)", filter: "blur(30px)" }} />

          {/* Image frame */}
          <div className="relative rounded-2xl overflow-hidden border border-[oklch(0.75_0.12_85/0.2)]"
            style={{ boxShadow: "0 0 0 1px oklch(0.75 0.12 85 / 0.05), 0 40px 80px rgba(0,0,0,0.8), 0 0 100px oklch(0.75 0.12 85 / 0.08)" }}>
            <img
              src="/hero-dashboard.png"
              alt="STAGEONE OS Dashboard"
              className="w-full h-auto block"
            />
            {/* Top-edge gold line */}
            <div className="absolute inset-x-0 top-0 h-px pointer-events-none"
              style={{ background: "linear-gradient(90deg, transparent, oklch(0.75 0.12 85 / 0.7), transparent)" }} />
            {/* Live badge */}
            <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-md"
              style={{ background: "oklch(0.06 0 0 / 0.85)" }}>
              <motion.div className="w-1.5 h-1.5 rounded-full bg-green-400"
                animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.8, repeat: Infinity }} />
              <span className="text-[9px] font-semibold text-green-400/90 tracking-wide">All Systems Active</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ── Ticker ─────────────────────────────────────────────────── */}
      <div className="mt-16">
        <Ticker />
      </div>

      {/* ── Metrics ────────────────────────────────────────────────── */}
      <MetricsStrip />
    </section>
  )
}
