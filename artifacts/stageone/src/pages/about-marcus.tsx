import { motion } from "framer-motion"
import { Link } from "wouter"
import { ArrowRight, Brain, Shield, Zap, Target, BarChart3, Globe, Layers, Eye, MessageSquare, TrendingUp, Lock, CheckCircle2 } from "lucide-react"
import logoImg from "@assets/ChatGPT_Image_May_9__2026__02_48_29_AM-removebg-preview_1778518770581.png"
const badgeImg = "/agent-marcus-badge.png"

const GOLD = "#d4af37"
const BG = "#3c3c3c"
const BG_DARK = "#2e2e2e"
const BG_CARD = "#444444"

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.55 },
}

const stagger = {
  initial: {},
  whileInView: {},
  viewport: { once: true },
}

const capabilities = [
  {
    icon: BarChart3,
    title: "Business Intelligence",
    description:
      "Marcus synthesises market context, competitive dynamics, revenue models, and operational risks into a structured intelligence report — in seconds. Every metric is framed with explicit confidence classification so you always know what's proven versus assumed.",
  },
  {
    icon: Globe,
    title: "AI Website Architect",
    description:
      "From brand voice to conversion strategy, Marcus designs complete website structures with section-by-section copy, layout logic, design systems, and deployable React components — built around your specific market position, not a generic template.",
  },
  {
    icon: MessageSquare,
    title: "Chatbot Engineering",
    description:
      "Marcus designs AI-powered customer-facing assistants trained on your product, pricing, and support scenarios. He defines conversation flows, fallback handling, escalation paths, and tone alignment so your chatbot actually converts.",
  },
  {
    icon: Zap,
    title: "Automation Architecture",
    description:
      "Onboarding sequences, lead capture pipelines, CRM triggers, notification systems — Marcus maps automation workflows end-to-end with explicit tool recommendations, trigger conditions, and failure handling at every node.",
  },
  {
    icon: Layers,
    title: "Orchestration Engine",
    description:
      "Marcus coordinates multi-agent execution pipelines across your workspace. He decomposes complex objectives into assignable tasks, sequences dependencies, and monitors progress against defined success criteria.",
  },
  {
    icon: TrendingUp,
    title: "Growth Strategy",
    description:
      "Marcus identifies the highest-leverage growth levers specific to your business model, stage, and market. He distinguishes validated tactics from hypotheses and routes advice through the appropriate confidence tier — never fabricating traction that doesn't exist.",
  },
  {
    icon: Target,
    title: "Execution Planning",
    description:
      "Beyond strategy, Marcus breaks down goals into sequenced, concrete actions with timelines, resource requirements, and clear success indicators. He operates as an accountable partner, not a suggestion engine.",
  },
  {
    icon: Shield,
    title: "Risk Modelling",
    description:
      "Marcus applies a structured risk framework that separates confirmed threats from inferred risks and unvalidated hypotheses. You never receive a risk assessment without knowing exactly how much of it is grounded in evidence versus assumption.",
  },
]

const domains = [
  "Go-to-market strategy",
  "SaaS business models",
  "E-commerce operations",
  "Healthcare & compliance",
  "FinTech & regulation",
  "B2B sales cycles",
  "Product-led growth",
  "Marketplace dynamics",
  "Creator & media economies",
  "Subscription revenue",
  "API & developer platforms",
  "Enterprise sales",
  "D2C brand building",
  "EdTech & content",
  "PropTech & real estate",
  "Professional services",
  "Logistics & supply chain",
  "Cybersecurity posture",
]

const principles = [
  {
    icon: Eye,
    title: "Evidence-First Reasoning",
    description:
      "Every claim Marcus makes is internally classified before it reaches you. Facts are stated confidently. Inferences are flagged as such. Hypotheses are never presented as findings. The epistemic tier travels with the output — always.",
  },
  {
    icon: Lock,
    title: "No Manufactured Confidence",
    description:
      "Marcus will never say 'the market opportunity is $4.2B' based on an AI projection alone. He will say 'the analysis suggests a large addressable market, but this is unvalidated.' A cofounder who says 'I don't know' is more valuable than one who invents certainty.",
  },
  {
    icon: Brain,
    title: "Context Compression",
    description:
      "Marcus retains a continuously updated memory of your workspace — your decisions, your pivots, your priorities, your past analyses. He doesn't start from zero. He meets you where you are, every session.",
  },
  {
    icon: CheckCircle2,
    title: "Execution, Not Just Advice",
    description:
      "Marcus doesn't stop at recommendations. He initiates website generation, spawns automation workflows, coordinates agents, and opens the right modules inside STAGEONE — all from a single conversational interface.",
  },
]

export default function AboutMarcusPage() {
  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", color: "white" }}>

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header
        style={{ borderBottom: `1px solid ${GOLD}22`, background: BG_DARK }}
        className="sticky top-0 z-50 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2">
            <img src={logoImg} alt="STAGEONE" className="h-9 w-auto object-contain" />
            <span className="text-sm font-bold tracking-[0.25em] uppercase" style={{ color: "white" }}>
              STAGEONE
            </span>
          </Link>
          <Link
            href="/signup"
            className="inline-flex h-9 items-center gap-2 rounded-md px-4 text-sm font-semibold transition-all"
            style={{ background: GOLD, color: "#1a1a1a" }}
          >
            Start Building
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden py-24 px-6"
        style={{ background: `linear-gradient(180deg, ${BG_DARK} 0%, ${BG} 100%)` }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 70% 50% at 50% 0%, ${GOLD}18 0%, transparent 70%)`,
          }}
        />
        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div {...fadeUp} transition={{ duration: 0.4 }}>
            <img src={badgeImg} alt="Agent Marcus" className="mx-auto mb-10 h-20 w-auto object-contain" />
          </motion.div>

          <motion.div {...fadeUp} transition={{ duration: 0.5, delay: 0.1 }}>
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold tracking-[0.2em] uppercase mb-6"
              style={{ border: `1px solid ${GOLD}55`, color: GOLD, background: `${GOLD}10` }}
            >
              Resident Intelligence · STAGEONE OS
            </div>
          </motion.div>

          <motion.h1
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.15 }}
            className="text-5xl md:text-7xl font-black tracking-tight leading-[0.95] mb-6"
          >
            Meet{" "}
            <span style={{ color: GOLD }}>Marcus</span>
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="text-xl md:text-2xl text-white/70 leading-relaxed max-w-2xl mx-auto mb-10"
          >
            The AI co-founder built into every STAGEONE workspace. Not an assistant. Not a chatbot.
            A strategic intelligence layer that thinks, plans, and executes alongside you.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55, delay: 0.25 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-bold transition-all hover:scale-[1.02]"
              style={{ background: GOLD, color: "#1a1a1a" }}
            >
              Activate Marcus
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-semibold transition-all"
              style={{ border: `1px solid ${GOLD}44`, color: "white" }}
            >
              View Platform
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── What Marcus Is ──────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div
              className="inline-block text-xs font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              The Intelligence Layer
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
              Not built to impress.<br />
              <span style={{ color: GOLD }}>Built to be right.</span>
            </h2>
            <p className="text-white/65 text-lg max-w-2xl mx-auto leading-relaxed">
              Most AI tools tell you what you want to hear. Marcus tells you what the evidence supports — and draws a hard line between the two.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                label: "Co-founder",
                body: "Marcus operates with co-founder-level context about your business. He knows your stage, your market, your past decisions, and your current priorities. He doesn't re-introduce himself. He picks up exactly where you left off.",
              },
              {
                label: "Strategist",
                body: "Marcus applies structured strategic frameworks to every business problem — market sizing, competitive positioning, pricing architecture, growth sequencing, and risk modelling. Each analysis is tied to your actual context, not a generic playbook.",
              },
              {
                label: "Builder",
                body: "Marcus doesn't stop at recommendations. He initiates generation, opens execution engines, populates forms, and produces deployable outputs. Strategy becomes action inside the same conversation.",
              },
              {
                label: "Truth Enforcer",
                body: "Marcus operates under a four-tier evidence model. Every claim he makes is internally classified as Fact, Memory, Inference, or Hypothesis — and the confidence level travels with the output. He will never elevate an AI-generated assumption into a validated finding.",
              },
            ].map(({ label, body }, i) => (
              <motion.div
                key={label}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl p-7"
                style={{ background: BG_CARD, border: `1px solid ${GOLD}22` }}
              >
                <div
                  className="text-xs font-black tracking-[0.2em] uppercase mb-3"
                  style={{ color: GOLD }}
                >
                  {label}
                </div>
                <p className="text-white/80 leading-relaxed">{body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Capabilities ────────────────────────────────────────────────────── */}
      <section
        className="py-24 px-6"
        style={{ background: BG_DARK }}
      >
        <div className="mx-auto max-w-6xl">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div
              className="inline-block text-xs font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              Capabilities
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight">
              Eight systems.<br />
              <span style={{ color: GOLD }}>One intelligence.</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {capabilities.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.06 }}
                className="rounded-2xl p-6 group hover:scale-[1.02] transition-transform"
                style={{
                  background: BG_CARD,
                  border: `1px solid ${GOLD}18`,
                  boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                }}
              >
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: `${GOLD}15`, border: `1px solid ${GOLD}30` }}
                >
                  <Icon className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <h3 className="font-black text-base text-white mb-2">{title}</h3>
                <p className="text-white/55 text-sm leading-relaxed">{description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Epistemic Principles ────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center mb-16">
            <div
              className="inline-block text-xs font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              Design Principles
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
              How Marcus thinks
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto leading-relaxed">
              Marcus is governed by a set of hard constraints that make his reasoning trustworthy — not just fluent.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            {principles.map(({ icon: Icon, title, description }, i) => (
              <motion.div
                key={title}
                {...fadeUp}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="flex gap-5 rounded-2xl p-7"
                style={{ background: BG_CARD, border: `1px solid ${GOLD}22` }}
              >
                <div
                  className="h-11 w-11 shrink-0 rounded-xl flex items-center justify-center mt-0.5"
                  style={{ background: `${GOLD}12`, border: `1px solid ${GOLD}35` }}
                >
                  <Icon className="h-5 w-5" style={{ color: GOLD }} />
                </div>
                <div>
                  <h3 className="font-black text-white text-base mb-2">{title}</h3>
                  <p className="text-white/60 text-sm leading-relaxed">{description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Evidence Tiers ──────────────────────────────────────────────────── */}
      <section
        className="py-24 px-6"
        style={{ background: `linear-gradient(135deg, ${BG_DARK} 0%, #353535 100%)` }}
      >
        <div className="mx-auto max-w-4xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <div
              className="inline-block text-xs font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              Evidence Model
            </div>
            <h2 className="text-4xl font-black tracking-tight mb-4">
              The Four-Tier <span style={{ color: GOLD }}>Truth System</span>
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Every claim Marcus makes is internally classified before it reaches you. The tier is always visible.
            </p>
          </motion.div>

          <div className="space-y-4">
            {[
              {
                tier: "01",
                label: "FACT",
                colour: "#4ade80",
                description: "Supported by project records, saved outputs, or explicit user statements in the current session. Stated with full confidence — no hedging.",
                example: "Your business intelligence report was generated and saved to the workspace.",
              },
              {
                tier: "02",
                label: "MEMORY",
                colour: GOLD,
                description: "Drawn from workspace memory — previous sessions, recorded priorities, historical decisions. Referenced with confidence, but only if the record actually exists.",
                example: "Last session you identified onboarding friction as a priority concern.",
              },
              {
                tier: "03",
                label: "INFERENCE",
                colour: "#60a5fa",
                description: "Reasonable interpretation derived from facts. Not directly stated, but logically derivable from what is known. Always framed with signal language.",
                example: "I suspect the sales cycle may be longer than planned, given the regulatory environment the analysis describes.",
              },
              {
                tier: "04",
                label: "HYPOTHESIS",
                colour: "#f87171",
                description: "Speculation without supporting evidence. AI-generated assumptions that have not been tested, interviewed, or validated. Never presented as findings.",
                example: "The BI report flags HIPAA compliance as a potential risk — but this remains an unvalidated hypothesis until we have customer evidence.",
              },
            ].map(({ tier, label, colour, description, example }, i) => (
              <motion.div
                key={tier}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.07 }}
                className="rounded-2xl p-6"
                style={{
                  background: BG_CARD,
                  border: `1px solid ${colour}30`,
                  boxShadow: `0 0 0 1px ${colour}12, 0 4px 20px rgba(0,0,0,0.2)`,
                }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="text-xs font-black tabular-nums shrink-0 mt-0.5"
                    style={{ color: colour }}
                  >
                    {tier}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="text-xs font-black tracking-[0.15em] px-2 py-0.5 rounded-md"
                        style={{ background: `${colour}15`, color: colour, border: `1px solid ${colour}30` }}
                      >
                        {label}
                      </span>
                    </div>
                    <p className="text-white/70 text-sm leading-relaxed mb-3">{description}</p>
                    <div
                      className="rounded-lg px-3 py-2 text-xs italic"
                      style={{ background: `${colour}08`, borderLeft: `2px solid ${colour}50`, color: "rgba(255,255,255,0.5)" }}
                    >
                      "{example}"
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Domain Knowledge ────────────────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <div
              className="inline-block text-xs font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              Domain Coverage
            </div>
            <h2 className="text-4xl font-black tracking-tight mb-4">
              Fluent across <span style={{ color: GOLD }}>every industry</span>
            </h2>
            <p className="text-white/60 text-lg max-w-xl mx-auto">
              Marcus applies the right frameworks, terminology, and risk models for your specific market — not a generic industry template.
            </p>
          </motion.div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.55 }}
            className="flex flex-wrap gap-2.5 justify-center"
          >
            {domains.map((d) => (
              <span
                key={d}
                className="rounded-full px-4 py-2 text-sm font-semibold"
                style={{
                  background: BG_CARD,
                  border: `1px solid ${GOLD}30`,
                  color: "white",
                }}
              >
                {d}
              </span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Validation Ladder ───────────────────────────────────────────────── */}
      <section
        className="py-24 px-6"
        style={{ background: BG_DARK }}
      >
        <div className="mx-auto max-w-5xl">
          <motion.div {...fadeUp} className="text-center mb-14">
            <div
              className="inline-block text-xs font-bold tracking-[0.2em] uppercase mb-4 px-3 py-1 rounded-full"
              style={{ color: GOLD, border: `1px solid ${GOLD}44` }}
            >
              Validation Model
            </div>
            <h2 className="text-4xl font-black tracking-tight mb-4">
              Advice calibrated to <span style={{ color: GOLD }}>your real stage</span>
            </h2>
            <p className="text-white/60 text-lg max-w-2xl mx-auto">
              Marcus reads your actual validation level from your workspace — and refuses to give advice that outpaces your evidence.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                level: "Level 0–1",
                title: "Idea & Signal",
                desc: "No customers yet. Marcus helps you explore the hypothesis, identify risks, and define the single sharpest validation experiment — not build infrastructure.",
              },
              {
                level: "Level 2–3",
                title: "Intent & Commitment",
                desc: "Early users showing intent. Marcus shifts to MVP scoping, manual workflow design, and prototype strategy. Still no premature scaling advice.",
              },
              {
                level: "Level 4–5",
                title: "Economic Validation",
                desc: "Real payment or deep commitment. Marcus activates architecture, automation, and growth systems — because the foundation is now earned.",
              },
            ].map(({ level, title, desc }, i) => (
              <motion.div
                key={level}
                {...fadeUp}
                transition={{ duration: 0.45, delay: i * 0.1 }}
                className="rounded-2xl p-6"
                style={{ background: BG_CARD, border: `1px solid ${GOLD}22` }}
              >
                <div className="text-xs font-black tracking-widest mb-1" style={{ color: GOLD }}>
                  {level}
                </div>
                <h3 className="text-lg font-black text-white mb-3">{title}</h3>
                <p className="text-white/60 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section
        className="py-28 px-6 text-center relative overflow-hidden"
        style={{ background: BG }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse 60% 60% at 50% 100%, ${GOLD}12 0%, transparent 70%)`,
          }}
        />
        <div className="relative mx-auto max-w-3xl">
          <motion.div {...fadeUp}>
            <img src={badgeImg} alt="Agent Marcus" className="mx-auto mb-8 h-14 w-auto object-contain opacity-90" />
            <h2 className="text-4xl md:text-5xl font-black tracking-tight mb-5">
              Your business deserves<br />
              <span style={{ color: GOLD }}>a better co-founder</span>
            </h2>
            <p className="text-white/60 text-lg mb-10 max-w-xl mx-auto">
              Marcus is active inside every STAGEONE workspace. Start building — he's already waiting.
            </p>
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2.5 rounded-xl px-8 text-sm font-black transition-all hover:scale-[1.03]"
              style={{ background: GOLD, color: "#1a1a1a" }}
            >
              Activate Your Workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer
        className="py-8 px-6"
        style={{ background: BG_DARK, borderTop: `1px solid ${GOLD}22` }}
      >
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={logoImg} alt="STAGEONE" className="h-7 w-auto object-contain" />
            <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/80">STAGEONE</span>
          </div>
          <p
            className="text-xs font-bold tracking-[0.25em] uppercase"
            style={{ color: GOLD }}
          >
            STAGEONE BY AURELIX SYSTEMS
          </p>
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xs text-white/40 hover:text-white/70 transition-colors">Home</Link>
            <Link href="/pricing" className="text-xs text-white/40 hover:text-white/70 transition-colors">Pricing</Link>
            <Link href="/signup" className="text-xs text-white/40 hover:text-white/70 transition-colors">Sign Up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
