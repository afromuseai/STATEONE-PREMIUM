import { Link } from "wouter"
import { motion, useMotionValue, useTransform, animate, useScroll, useSpring } from "framer-motion"
import {
  ArrowRight, Sparkles, Globe, Bot, Cpu,
  Brain, Zap, CheckCircle2, BarChart3, Activity, Play,
} from "lucide-react"
import { useEffect, useState, useRef, useCallback } from "react"
import { useAuth } from "@/lib/auth-context"
import { useLang } from "@/lib/i18n"
import { useTheme } from "@/lib/theme-context"
import heroVisual from "@assets/ChatGPT_Image_May_19,_2026,_05_20_34_AM_1779168162338.png"

/* ─── Typing headline ─────────────────────────────────────────────── */
function TypingText({ businessTypes }: { businessTypes: readonly string[] }) {
  const [index, setIndex] = useState(0)
  const [displayed, setDisplayed] = useState("")
  const [phase, setPhase] = useState<"typing" | "pause" | "erasing">("typing")

  useEffect(() => {
    if (!businessTypes?.length) return
    const safeIndex = index % businessTypes.length
    const target = businessTypes[safeIndex]
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
        setIndex((i) => (i + 1) % businessTypes.length)
        setPhase("typing")
      }
    }
    return () => clearTimeout(timeout)
  }, [displayed, phase, index, businessTypes])

  return (
    <span style={{ whiteSpace: "nowrap", display: "inline-flex", alignItems: "baseline" }}>
      <span style={{
        background: "linear-gradient(135deg, oklch(0.92 0.16 85) 0%, oklch(0.80 0.14 85) 40%, oklch(0.65 0.10 85) 100%)",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        backgroundClip: "text",
        filter: "drop-shadow(0 0 40px oklch(0.75 0.12 85 / 0.25))",
      }}>
        {displayed}
      </span>
      <motion.span
        animate={{ opacity: [1, 1, 0, 0] }}
        transition={{ duration: 1, repeat: Infinity, repeatType: "loop", times: [0, 0.45, 0.55, 1] }}
        style={{
          display: "inline-block",
          width: "3px",
          marginLeft: "4px",
          borderRadius: "2px",
          alignSelf: "stretch",
          background: "oklch(0.82 0.14 85)",
          boxShadow: "0 0 12px oklch(0.75 0.12 85 / 0.6)",
          verticalAlign: "middle",
        }}
      />
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
  const items = [...TICKS, ...TICKS, ...TICKS]
  return (
    <div className="relative w-full overflow-hidden border-y border-[oklch(0.75_0.12_85/0.12)] bg-[oklch(0.75_0.12_85/0.025)] py-3">
      <div className="pointer-events-none absolute left-0 inset-y-0 w-32 bg-gradient-to-r from-[oklch(0.08_0_0)] to-transparent z-10" />
      <div className="pointer-events-none absolute right-0 inset-y-0 w-32 bg-gradient-to-l from-[oklch(0.08_0_0)] to-transparent z-10" />
      <div className="flex overflow-hidden">
        <div className="ticker-track">
          {items.map((item, i) => (
            <div key={i} className="ticker-item">
              <span className="ticker-dot" />
              <span className="ticker-label">{item}</span>
            </div>
          ))}
        </div>
      </div>
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
  const { t } = useLang()
  const metrics = [
    { label: t.hero.metrics.businessesBuilt, value: 2400, suffix: "+", icon: "◈" },
    { label: t.hero.metrics.aiModels, value: 13, suffix: "", icon: "⬡" },
    { label: t.hero.metrics.avgLaunch, value: 47, suffix: "s", icon: "◎" },
    { label: t.hero.metrics.uptime, value: 99, suffix: ".9%", icon: "◇" },
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

/* ─── Particle animation overlay ───────────────────────────────────── */
function HeroParticles() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouseRef = useRef({ x: -9999, y: -9999, active: false })

  const init = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animId: number
    let w = canvas.offsetWidth
    let h = canvas.offsetHeight
    canvas.width = w
    canvas.height = h
    let t = 0

    const REPEL_RADIUS = 130
    const REPEL_STRENGTH = 2.8
    const ATTRACT_RADIUS = 260
    const ATTRACT_STRENGTH = 0.18

    /* ── Floating nodes ─────────────────────────────────────── */
    type Node = {
      x: number; y: number; vx: number; vy: number
      baseVx: number; baseVy: number
      r: number; baseAlpha: number; gold: boolean; phase: number
    }
    const nodes: Node[] = Array.from({ length: 70 }, () => {
      const bvx = (Math.random() - 0.5) * 0.4
      const bvy = (Math.random() - 0.5) * 0.4
      return {
        x: Math.random() * w, y: Math.random() * h,
        vx: bvx, vy: bvy, baseVx: bvx, baseVy: bvy,
        r: Math.random() * 2 + 0.5,
        baseAlpha: Math.random() * 0.55 + 0.2,
        gold: Math.random() > 0.45,
        phase: Math.random() * Math.PI * 2,
      }
    })

    /* ── Horizontal data streams ────────────────────────────── */
    type Stream = {
      y: number; x: number; speed: number
      len: number; alpha: number; gold: boolean; phase: number
    }
    const streams: Stream[] = Array.from({ length: 14 }, (_, i) => ({
      y: (h / 14) * i + Math.random() * (h / 14),
      x: Math.random() * w,
      speed: 0.8 + Math.random() * 1.6,
      len: 60 + Math.random() * 140,
      alpha: 0.15 + Math.random() * 0.35,
      gold: Math.random() > 0.4,
      phase: Math.random() * Math.PI * 2,
    }))

    /* ── Pulsing orbs ───────────────────────────────────────── */
    type Orb = { x: number; y: number; r: number; phase: number; gold: boolean }
    const orbs: Orb[] = Array.from({ length: 5 }, () => ({
      x: w * 0.45 + Math.random() * w * 0.55,
      y: Math.random() * h,
      r: 30 + Math.random() * 60,
      phase: Math.random() * Math.PI * 2,
      gold: Math.random() > 0.4,
    }))

    function draw() {
      ctx!.clearRect(0, 0, w, h)
      t += 0.012
      const mx = mouseRef.current.x
      const my = mouseRef.current.y
      const mouseActive = mouseRef.current.active

      /* — pulsing orbs — */
      for (const o of orbs) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 0.8 + o.phase)
        const grd = ctx!.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.r * (1 + pulse * 0.4))
        const col = o.gold ? "184,145,68" : "160,190,255"
        grd.addColorStop(0, `rgba(${col},${0.09 * pulse})`)
        grd.addColorStop(1, `rgba(${col},0)`)
        ctx!.fillStyle = grd
        ctx!.beginPath()
        ctx!.arc(o.x, o.y, o.r * (1 + pulse * 0.4), 0, Math.PI * 2)
        ctx!.fill()
      }

      /* — cursor ripple glow — */
      if (mouseActive) {
        const ripple = 0.5 + 0.5 * Math.sin(t * 3)
        const gr = ctx!.createRadialGradient(mx, my, 0, mx, my, REPEL_RADIUS * (0.8 + ripple * 0.2))
        gr.addColorStop(0, `rgba(184,145,68,${0.12 * ripple})`)
        gr.addColorStop(0.5, `rgba(184,145,68,${0.04 * ripple})`)
        gr.addColorStop(1, `rgba(184,145,68,0)`)
        ctx!.fillStyle = gr
        ctx!.beginPath()
        ctx!.arc(mx, my, REPEL_RADIUS * (0.8 + ripple * 0.2), 0, Math.PI * 2)
        ctx!.fill()
      }

      /* — horizontal data streams — */
      for (const s of streams) {
        s.x += s.speed
        if (s.x - s.len > w) s.x = -s.len
        const pulse = 0.6 + 0.4 * Math.sin(t * 1.4 + s.phase)
        const col = s.gold ? "184,145,68" : "200,220,255"
        const grd = ctx!.createLinearGradient(s.x - s.len, 0, s.x, 0)
        grd.addColorStop(0, `rgba(${col},0)`)
        grd.addColorStop(0.6, `rgba(${col},${s.alpha * pulse})`)
        grd.addColorStop(1, `rgba(${col},${s.alpha * pulse * 1.4})`)
        ctx!.beginPath()
        ctx!.moveTo(s.x - s.len, s.y)
        ctx!.lineTo(s.x, s.y)
        ctx!.strokeStyle = grd
        ctx!.lineWidth = s.gold ? 1.2 : 0.8
        ctx!.stroke()
        ctx!.beginPath()
        ctx!.arc(s.x, s.y, s.gold ? 1.8 : 1.2, 0, Math.PI * 2)
        ctx!.fillStyle = `rgba(${col},${Math.min(1, s.alpha * pulse * 2.2)})`
        ctx!.fill()
      }

      /* — floating nodes with cursor interaction — */
      for (const n of nodes) {
        if (mouseActive) {
          const dx = n.x - mx
          const dy = n.y - my
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < REPEL_RADIUS && dist > 0) {
            /* repel: push away from cursor */
            const force = (1 - dist / REPEL_RADIUS) * REPEL_STRENGTH
            n.vx += (dx / dist) * force * 0.06
            n.vy += (dy / dist) * force * 0.06
          } else if (dist < ATTRACT_RADIUS && dist > REPEL_RADIUS) {
            /* attract: gently pull toward cursor in outer ring */
            const force = (1 - dist / ATTRACT_RADIUS) * ATTRACT_STRENGTH
            n.vx -= (dx / dist) * force * 0.04
            n.vy -= (dy / dist) * force * 0.04
          }
        }
        /* drift back toward base velocity */
        n.vx += (n.baseVx - n.vx) * 0.03
        n.vy += (n.baseVy - n.vy) * 0.03
        /* clamp speed */
        const spd = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
        if (spd > 3.5) { n.vx = (n.vx / spd) * 3.5; n.vy = (n.vy / spd) * 3.5 }

        n.x += n.vx; n.y += n.vy
        if (n.x < 0) n.x = w; if (n.x > w) n.x = 0
        if (n.y < 0) n.y = h; if (n.y > h) n.y = 0

        const pulse = 0.5 + 0.5 * Math.sin(t * 1.2 + n.phase)
        /* boost glow if near cursor */
        let glowBoost = 1
        if (mouseActive) {
          const cdx = n.x - mx; const cdy = n.y - my
          const cd = Math.sqrt(cdx * cdx + cdy * cdy)
          if (cd < ATTRACT_RADIUS) glowBoost = 1 + (1 - cd / ATTRACT_RADIUS) * 1.4
        }
        const a = n.baseAlpha * pulse * Math.min(glowBoost, 2)
        ctx!.beginPath()
        ctx!.arc(n.x, n.y, n.r * (mouseActive ? Math.min(glowBoost * 0.8, 1.5) : 1), 0, Math.PI * 2)
        ctx!.fillStyle = n.gold
          ? `rgba(184,145,68,${Math.min(a, 0.95)})`
          : `rgba(200,220,255,${Math.min(a * 0.7, 0.8)})`
        ctx!.fill()
      }

      /* — connections between close nodes — */
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 120) {
            const a = (1 - dist / 120) * 0.18
            ctx!.beginPath()
            ctx!.moveTo(nodes[i].x, nodes[i].y)
            ctx!.lineTo(nodes[j].x, nodes[j].y)
            ctx!.strokeStyle = nodes[i].gold || nodes[j].gold
              ? `rgba(184,145,68,${a})`
              : `rgba(160,190,255,${a * 0.6})`
            ctx!.lineWidth = 0.6
            ctx!.stroke()
          }
        }
      }

      /* — lines from cursor to nearest nodes — */
      if (mouseActive) {
        const near = nodes
          .map(n => ({ n, d: Math.sqrt((n.x - mx) ** 2 + (n.y - my) ** 2) }))
          .filter(e => e.d < ATTRACT_RADIUS)
          .sort((a, b) => a.d - b.d)
          .slice(0, 6)
        for (const { n, d } of near) {
          const a = (1 - d / ATTRACT_RADIUS) * 0.35
          ctx!.beginPath()
          ctx!.moveTo(mx, my)
          ctx!.lineTo(n.x, n.y)
          ctx!.strokeStyle = `rgba(184,145,68,${a})`
          ctx!.lineWidth = 0.7
          ctx!.stroke()
        }
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height
      mouseRef.current = { x, y, active: inside }
    }
    const onMouseLeave = () => { mouseRef.current = { x: -9999, y: -9999, active: false } }

    const onResize = () => {
      w = canvas.offsetWidth; h = canvas.offsetHeight
      canvas.width = w; canvas.height = h
      orbs.forEach(o => { o.x = w * 0.45 + Math.random() * w * 0.55; o.y = Math.random() * h })
      streams.forEach((s, i) => { s.y = (h / 14) * i + Math.random() * (h / 14) })
    }

    // Listen on window so events are captured even when the canvas is behind other elements
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseleave", onMouseLeave)
    window.addEventListener("resize", onResize)
    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseleave", onMouseLeave)
      window.removeEventListener("resize", onResize)
    }
  }, [])

  useEffect(() => {
    const cleanup = init()
    return cleanup
  }, [init])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
      style={{ mixBlendMode: "screen", opacity: 0.9, pointerEvents: "auto" }}
    />
  )
}

/* ─── Hero ─────────────────────────────────────────────────────────── */
export function Hero() {
  const { user } = useAuth()
  const { t } = useLang()
  const { theme } = useTheme()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] })
  const parallaxY = useSpring(useTransform(scrollYProgress, [0, 1], [0, 80]), { stiffness: 80, damping: 20 })

  const bg = theme === "dark" ? "#050505" : "#ffffff"
  const r = theme === "dark" ? "5,5,5" : "255,255,255"

  return (
    <section ref={ref} className="relative overflow-hidden pt-[72px]" style={{ background: bg }}>

      {/* ── Full-bleed background image ──────────────────────────── */}
      <div className="pointer-events-none absolute inset-0">
        <img
          src={heroVisual}
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{
            opacity: 0.88,
            maskImage: "linear-gradient(90deg, transparent 0%, transparent 30%, black 62%)",
            WebkitMaskImage: "linear-gradient(90deg, transparent 0%, transparent 30%, black 62%)",
          }}
        />
        {/* Particle animation overlay */}
        <HeroParticles />
        {/* Left vignette — reinforces the mask fade */}
        <div className="absolute inset-0" style={{
          background: `linear-gradient(90deg, rgba(${r},1) 0%, rgba(${r},1) 25%, rgba(${r},0.85) 45%, rgba(${r},0.40) 60%, rgba(${r},0.05) 75%, rgba(${r},0) 100%)`,
        }} />
        {/* Bottom fade into page */}
        <div className="absolute inset-x-0 bottom-0 h-40" style={{
          background: `linear-gradient(to bottom, transparent, ${bg})`,
        }} />
        {/* Subtle gold grid on top */}
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(to right, rgba(184,145,68,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(184,145,68,0.03) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }} />
        {/* Top fade — dissolve into page background */}
        <div className="absolute inset-x-0 top-0 h-[340px]" style={{
          background: `linear-gradient(to bottom, ${bg} 0%, ${bg} 18%, rgba(${r},0.85) 40%, rgba(${r},0.4) 65%, transparent 100%)`,
        }} />
      </div>

      {/* ── Hero content: text over background ───────────────────── */}
      <div className="relative mx-auto max-w-[1320px] px-8 lg:px-12 flex flex-col items-start justify-center min-h-[calc(100vh-72px)] py-20">
        <div className="w-full max-w-[600px]">

          {/* Badge pill */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5"
            style={{
              background: "rgba(184,145,68,0.10)",
              border: "1px solid rgba(184,145,68,0.30)",
              backdropFilter: "blur(8px)",
            }}
          >
            <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: "oklch(0.75 0.12 85)" }}
              animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "oklch(0.75 0.12 85)" }}>
              {t.hero.badge}
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="font-black tracking-[-0.03em] text-white leading-[1.02]"
            style={{ fontSize: "clamp(2.8rem, 5.5vw, 4.8rem)" }}
          >
            {t.hero.headline1}
            <span className="block mt-1" style={{ height: "1.15em" }}><TypingText businessTypes={t.hero.businessTypes} /></span>
          </motion.h1>

          {/* Thin gold rule */}
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="mt-7 mb-7 h-px w-32 origin-left"
            style={{ background: "linear-gradient(90deg, rgba(184,145,68,0.9), transparent)" }}
          />

          {/* Supporting paragraph */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="text-[15px] leading-[1.75]"
            style={{ color: "rgba(255,255,255,0.50)" }}
          >
            {t.hero.subHeadline}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.58 }}
            className="mt-9 flex items-center gap-3"
          >
            <Link href={user ? "/dashboard" : "/signup"}
              className="group relative inline-flex h-12 items-center gap-2 rounded-xl px-8 text-[13px] font-bold overflow-hidden"
              style={{
                background: "linear-gradient(135deg, oklch(0.82 0.15 85), oklch(0.68 0.12 85))",
                color: "#0a0900",
                boxShadow: "0 0 32px rgba(184,145,68,0.35), 0 8px 24px rgba(0,0,0,0.5)",
              }}
            >
              <motion.div className="absolute inset-0"
                style={{ background: "linear-gradient(135deg, oklch(0.88 0.16 85), oklch(0.76 0.13 85))" }}
                initial={{ opacity: 0 }} whileHover={{ opacity: 1 }} transition={{ duration: 0.15 }}
              />
              <span className="relative">{t.hero.ctaPrimary}</span>
              <ArrowRight className="relative h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>

            <a href="/#how-it-works"
              className="inline-flex h-12 items-center gap-2 rounded-xl px-7 text-[13px] font-medium transition-colors hover:text-white"
              style={{
                color: "rgba(255,255,255,0.55)",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.10)",
                backdropFilter: "blur(8px)",
              }}
            >
              <Play className="h-3 w-3 opacity-60" />
              {t.hero.ctaSecondary}
            </a>
          </motion.div>

          {/* Social proof */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="mt-9 flex items-center gap-4"
          >
            <div className="flex items-center gap-0.5">
              {[...Array(5)].map((_, i) => (
                <span key={i} style={{ color: "oklch(0.75 0.12 85)", fontSize: "11px" }}>★</span>
              ))}
            </div>
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{t.hero.trustedBy}</span>
            <div className="h-3 w-px" style={{ background: "rgba(255,255,255,0.10)" }} />
            <span className="text-[11px]" style={{ color: "rgba(255,255,255,0.28)" }}>{t.hero.noCreditCard}</span>
          </motion.div>
        </div>
      </div>

      {/* ── Ticker ────────────────────────────────────────────────── */}
      <Ticker />

      {/* ── Metrics ───────────────────────────────────────────────── */}
      <MetricsStrip />
    </section>
  )
}
