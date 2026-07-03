import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot, Sparkles, Copy, Download, Check, Loader2, ArrowLeft,
  MessageCircle, Zap, RefreshCw, ChevronDown, X, Monitor,
  Smartphone, Send, User, Settings2, GitBranch, Plug, FileJson,
  Lock, Crown,
} from "lucide-react"
import { useLocation } from "wouter"
import { AppSidebar } from "@/components/dashboard/app-sidebar"
import { useUpgradeModal } from "@/lib/upgrade-modal-context"
import {
  loadGenerationContext, clearGenerationContext,
  loadChatbotRestoreContext, clearChatbotRestoreContext,
  deriveChatbotType, deriveChatbotIndustry, deriveChatbotTone, buildChatbotDesc,
} from "@/lib/generation-context"
import { useLang } from "@/lib/i18n"
import { ensureProject } from "@/lib/ensure-project"
import { registerBridge, unregisterBridge } from "@/lib/module-architecture/chatbot-bridge"
import { chatbotController } from "@/lib/module-architecture/controllers/chatbot-controller"
import { useGeneratorOrchestration } from "@/lib/hooks/use-generator-orchestration"


// ─── Types ───────────────────────────────────────────────────────────────────
type Step = "input" | "generating" | "done"
type ChatbotType = "Customer Support" | "Sales Assistant" | "Onboarding Assistant" | "Booking Assistant" | "FAQ Assistant" | "Internal Team Assistant"
type Industry = "SaaS" | "Healthcare" | "Fitness" | "Finance" | "Cybersecurity" | "eCommerce" | "Education"
type Tone = "Professional" | "Friendly" | "Luxury" | "Technical" | "Corporate" | "Conversational"
type PreviewMode = "widget" | "mobile" | "whatsapp"
type RightTab = "preview" | "flows" | "prompt" | "integrations" | "export"
type MessageRole = "bot" | "user"

interface ChatMessage { role: MessageRole; text: string; id: number }

interface ChatbotOutput {
  identity: { name: string; role: string; objective: string; personality: string; greeting: string }
  systemPrompt: { main: string; behavior: string; responseStyle: string; constraints: string[]; fallbacks: string[] }
  conversationFlows: {
    welcome: { trigger: string; botMessage: string; quickReplies: string[] }
    leadCapture: { trigger: string; steps: Array<{ bot: string; type: string; inputLabel?: string; field?: string }> }
    support: { trigger: string; responses: Record<string, string> }
    escalation: { trigger: string; botMessage: string; humanHandoff: string }
    closing: { trigger: string; botMessage: string; followUp: string }
  }
  suggestedPrompts: string[]
  integrations: {
    crm?: Array<{ name: string; purpose: string; priority: string }>
    email?: Array<{ name: string; purpose: string; priority: string }>
    support?: Array<{ name: string; purpose: string; priority: string }>
    automation?: Array<{ name: string; purpose: string; priority: string }>
    calendar?: Array<{ name: string; purpose: string; priority: string }>
    payment?: Array<{ name: string; purpose: string; priority: string }>
  }
  automation: {
    triggers: Array<{ event: string; condition: string; action: string }>
    workflows: Array<{ name: string; steps: string[] }>
    notifications: Array<{ event: string; recipient: string; channel: string }>
  }
  deployment: { recommended: string[]; widgetSnippet: string; whatsappSetup: string; slackSetup: string }
  kpis: { deflectionRate: string; responseTime: string; satisfactionScore: string; leadConversion: string }
}

// ─── Constants ────────────────────────────────────────────────────────────────
const CHATBOT_TYPES: { key: ChatbotType; icon: string; desc: string }[] = [
  { key: "Customer Support", icon: "🛟", desc: "Deflect & resolve" },
  { key: "Sales Assistant", icon: "💼", desc: "Qualify & convert" },
  { key: "Onboarding Assistant", icon: "🚀", desc: "Guide & activate" },
  { key: "Booking Assistant", icon: "📅", desc: "Schedule & confirm" },
  { key: "FAQ Assistant", icon: "💡", desc: "Answer & educate" },
  { key: "Internal Team Assistant", icon: "🏢", desc: "Support & automate" },
]

const INDUSTRIES: Industry[] = ["SaaS", "Healthcare", "Fitness", "Finance", "Cybersecurity", "eCommerce", "Education"]
const TONES: Tone[] = ["Professional", "Friendly", "Luxury", "Technical", "Corporate", "Conversational"]

const GEN_STEPS = [
  "Analyzing business context",
  "Designing chatbot personality",
  "Building conversation flows",
  "Generating system prompt",
  "Creating suggested prompts",
  "Mapping integration stack",
  "Designing automation logic",
  "Finalizing deployment plan",
]

const RIGHT_TABS: { key: RightTab; label: string; icon: React.ReactNode }[] = [
  { key: "preview", label: "Preview", icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: "flows", label: "Flows", icon: <GitBranch className="h-3.5 w-3.5" /> },
  { key: "prompt", label: "Prompt", icon: <Settings2 className="h-3.5 w-3.5" /> },
  { key: "integrations", label: "Integrations", icon: <Plug className="h-3.5 w-3.5" /> },
  { key: "export", label: "Export", icon: <FileJson className="h-3.5 w-3.5" /> },
]

const PRIORITY_COLOR: Record<string, string> = {
  high: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low: "text-muted-foreground bg-white/5 border-white/10",
}

let msgId = 0

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChatbotGeneratorPage() {
  const { lang } = useLang()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [step, setStep] = useState<Step>("input")
  const [businessDesc, setBusinessDesc] = useState("")
  const [chatbotType, setChatbotType] = useState<ChatbotType>("Customer Support")
  const [industry, setIndustry] = useState<Industry>("SaaS")
  const [tone, setTone] = useState<Tone>("Professional")
  const [data, setData] = useState<ChatbotOutput | null>(null)
  const [genStep, setGenStep] = useState(0)
  const [genError, setGenError] = useState("")
  const [rightTab, setRightTab] = useState<RightTab>("preview")
  const [previewMode, setPreviewMode] = useState<PreviewMode>("widget")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [editedPrompt, setEditedPrompt] = useState("")
  const [copiedKey, setCopiedKey] = useState("")
  const [chatInput, setChatInput] = useState("")
  const [contextBanner, setContextBanner] = useState(false)
  const [isLocked, setIsLocked] = useState(false)
  const { openUpgradeModal } = useUpgradeModal()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const chatHistoryRef = useRef<ChatMessage[]>([])
  // Holds the auto-generation payload until businessDesc state has propagated
  const autoGenPending = useRef<{ type: ChatbotType; ind: Industry; tn: Tone } | null>(null)
  const autoGenFired = useRef(false)
  // Marcus execution engine refs
  const descTextareaRef = useRef<HTMLTextAreaElement>(null)
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // Keep current state values accessible inside signal callbacks without re-subscribing
  const businessDescRef = useRef(businessDesc)
  const chatbotTypeRef = useRef(chatbotType)
  const industryRef = useRef(industry)
  const toneRef = useRef(tone)

  const [, setLocation] = useLocation()

  // Phase 4 — Bridge refs: wired into the ChatbotBridge so the controller can
  // delegate through them without duplicating any generation logic.
  // populateCompleteCallbackRef: stored by the bridge's populate(); called by
  //   typewriterPopulate when the animation is fully done and form is ready.
  // generateCompleteCallbackRef: stored by the bridge's triggerGenerate(); called
  //   by generateWith after SSE, save, and UI update are all complete.
  // latestDataRef: always-current mirror of data state for bridge-based save.
  const populateCompleteCallbackRef = useRef<(() => void) | null>(null)
  const generateCompleteCallbackRef = useRef<(() => void) | null>(null)
  const latestDataRef = useRef<ChatbotOutput | null>(null)

  // Keep refs in sync with state so signal callbacks always see current values
  useEffect(() => { businessDescRef.current = businessDesc }, [businessDesc])
  useEffect(() => { chatbotTypeRef.current = chatbotType }, [chatbotType])
  useEffect(() => { industryRef.current = industry }, [industry])
  useEffect(() => { toneRef.current = tone }, [tone])
  // Keep latestDataRef in sync for bridge-based save
  useEffect(() => { latestDataRef.current = data }, [data])

  // ─── Marcus typewriter populate ────────────────────────────────────────────
  const typewriterPopulate = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current)
    console.log("MARCUS_STAGE_6_POPULATE | mode: typewriter | promptLength:", text.length, "| first100:", text.slice(0, 100));
    setContextBanner(true)
    setStep("input")
    setBusinessDesc("")
    setGenError("")
    let i = 0
    typewriterRef.current = setInterval(() => {
      i++
      setBusinessDesc(text.slice(0, i))
      if (i >= text.length) {
        clearInterval(typewriterRef.current!)
        typewriterRef.current = null
        console.log("MARCUS_STAGE_7_CONFIRMATION | typewriter complete | form fully populated | businessDescLength:", text.length);
        setTimeout(() => {
          descTextareaRef.current?.focus()
          // Phase 4: notify bridge that populate is complete — fires only after the
          // entire description has finished typing and the form is ready for review.
          populateCompleteCallbackRef.current?.()
          populateCompleteCallbackRef.current = null
        }, 50)
      }
    }, 20)
  }, [])

  // ─── Shared orchestration lifecycle ─────────────────────────────────────────
  // Handles pendingIntent consumption, autoGenerate, workspace signal subscription,
  // and controller registration — replacing the equivalent inline effects below.
  const { completeGeneration } = useGeneratorOrchestration({
    moduleId: "chatbot",
    signalTarget: "chatbot",
    controller: chatbotController,
    completionEvent: "chatbot.generated",
    projectType: "chatbot",
    outputField: "chatbotOutput",
    getIdea: () => businessDescRef.current,
    onPopulate: (idea, animate) => {
      if (animate) {
        typewriterPopulate(idea)
      } else {
        setBusinessDesc(idea)
        setContextBanner(true)
      }
    },
    onAutoGenerate: (idea) => {
      generateWith(idea, chatbotTypeRef.current, industryRef.current, toneRef.current)
    },
  })

  // ─── Phase 4: Register ChatbotBridge on mount ────────────────────────────────
  // The bridge delegates all operations to this component's existing handlers.
  // No generation logic is duplicated — the bridge is purely a delegation layer.
  // Controller registration is handled by useGeneratorOrchestration above.
  useEffect(() => {
    registerBridge({
      navigate: () => setLocation("/chatbot-generator"),
      populate: (idea, onComplete) => {
        if (!idea) { onComplete(); return }
        populateCompleteCallbackRef.current = onComplete
        typewriterPopulate(idea)
      },
      triggerGenerate: (idea) => new Promise<void>((resolve) => {
        generateCompleteCallbackRef.current = resolve
        generateWith(idea, chatbotTypeRef.current, industryRef.current, toneRef.current)
      }),
      save: async () => {
        if (!latestDataRef.current) return
        await ensureProject({
          type: "chatbot",
          idea: businessDescRef.current || "Chatbot",
          outputField: "chatbotOutput",
          output: latestDataRef.current as unknown as Record<string, unknown>,
        }).catch(() => {})
      },
      getCurrentIdea: () => businessDescRef.current,
    })
    return () => {
      unregisterBridge()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Check subscription tier
  useEffect(() => {
    fetch("/api/subscriptions/me", { credentials: "include" })
      .then(r => r.json())
      .then(d => { if (d.subscription?.plan === "free") setIsLocked(true) })
      .catch(() => {})
  }, [])

  // Phase 1 — Load context and hydrate state fields
  useEffect(() => {
    const ctx = loadGenerationContext()
    if (!ctx) return
    clearGenerationContext()
    const desc = buildChatbotDesc(ctx)
    const type = deriveChatbotType(ctx.chatbotRole) as ChatbotType
    const ind = deriveChatbotIndustry(ctx.industry) as Industry
    const tn = deriveChatbotTone(ctx.industry) as Tone
    // Hydrate all fields into React state
    setBusinessDesc(desc)
    setChatbotType(type)
    setIndustry(ind)
    setTone(tn)
    setContextBanner(true)
    // Store payload — generation fires in Phase 2 once businessDesc state has propagated
    autoGenPending.current = { type, ind, tn }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Phase 2 — Start generation after state propagation is confirmed by businessDesc change
  useEffect(() => {
    if (!autoGenPending.current || !businessDesc.trim() || autoGenFired.current) return
    autoGenFired.current = true
    const { type, ind, tn } = autoGenPending.current
    autoGenPending.current = null
    generateWith(businessDesc, type, ind, tn)
  }, [businessDesc]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Gen steps animation
  useEffect(() => {
    if (step !== "generating") return
    setGenStep(0)
    const t = setInterval(() => setGenStep(s => s < GEN_STEPS.length - 1 ? s + 1 : s), 2000)
    return () => clearInterval(t)
  }, [step])

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key); setTimeout(() => setCopiedKey(""), 2000)
  }

  const initChat = useCallback((d: ChatbotOutput) => {
    const greetText =
      d.conversationFlows?.welcome?.botMessage ||
      d.identity?.greeting ||
      "Hello! How can I help you today?"
    const greet: ChatMessage = { role: "bot", text: greetText, id: ++msgId }
    setMessages([greet])
    setQuickReplies(
      d.conversationFlows?.welcome?.quickReplies?.slice(0, 4) ??
      d.suggestedPrompts?.slice(0, 4) ??
      []
    )
  }, [])

  // Phase 0 — Restore previously-saved chatbot.
  // ONLY sets data/step state — does NOT call initChat directly.
  // The separate "chat init" effect below fires reactively once state commits.
  useEffect(() => {
    const saved = loadChatbotRestoreContext()
    if (!saved) return
    clearChatbotRestoreContext()
    clearGenerationContext()      // prevent Phase 1 from auto-generating
    autoGenFired.current = true  // block Phase 2 even if businessDesc state update fires
    const output = saved as ChatbotOutput
    setData(output)
    setStep("done")
    setEditedPrompt(output.systemPrompt?.main ?? "")
    setContextBanner(false)
    setRightTab("preview")
    // initChat is intentionally NOT called here — it runs in the effect below
    // after React has committed these state updates, preventing any throw from
    // blocking the step/data commit.
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Chat init effect — fires whenever step transitions to "done" with data present
  // and no messages yet (restore path). Generation path already calls initChat
  // directly inside generateWith/generate, so messages.length > 0 by the time
  // this effect runs after a normal generation.
  useEffect(() => {
    if (step !== "done" || !data || messages.length > 0) return
    initChat(data)
  }, [step, data]) // eslint-disable-line react-hooks/exhaustive-deps

  const sendMessage = useCallback(async (text: string) => {
    if (!data || isTyping) return
    const userMsg: ChatMessage = { role: "user", text, id: ++msgId }
    const currentHistory = chatHistoryRef.current.slice(-8)
    setMessages(prev => {
      chatHistoryRef.current = [...prev, userMsg]
      return [...prev, userMsg]
    })
    setQuickReplies([])
    setIsTyping(true)

    const botId = ++msgId
    let streamed = ""

    try {
      const res = await fetch("/api/generate/chatbot/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text,
          systemPrompt: data.systemPrompt.main,
          history: currentHistory.slice(-8),
          language: lang,
        }),
      })

      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}))
        if (errData.error === "UPGRADE_REQUIRED") {
          openUpgradeModal({ feature: errData.feature, featureLabel: errData.featureLabel, requiredPlan: errData.requiredPlan })
          setIsTyping(false)
          return
        }
      }
      if (!res.ok || !res.body) throw new Error("Request failed")

      setIsTyping(false)
      setMessages(m => [...m, { role: "bot", text: "", id: botId }])

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.content) {
              streamed += msg.content
              setMessages(m => m.map(x => x.id === botId ? { ...x, text: streamed } : x))
            }
          } catch { /* fragment */ }
        }
      }
    } catch {
      // Fallback to local response on network error
      setIsTyping(false)
      const fallback = data.systemPrompt.fallbacks?.[0] ?? "I'm here to help! Could you clarify what you need?"
      setMessages(m => [...m, { role: "bot", text: fallback, id: botId }])
    }

    const fresh = (data.suggestedPrompts ?? []).filter(p => p !== text).slice(0, 3)
    setQuickReplies(fresh)
  }, [data, isTyping, chatHistoryRef])

  const handleSendInput = () => {
    if (chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput("") }
  }

  const generateWith = async (desc: string, type: string, ind: string, tn: string) => {
    // ── Stage G ──────────────────────────────────────────────────────────────────
    console.log("GENERATE_CHATBOT_FUNCTION_ENTERED | descLength:", desc.trim().length, "| type:", type, "| ind:", ind, "| tn:", tn);
    if (!desc.trim()) return
    console.log("MARCUS_STAGE_8_CONFIRMED | trigger: auto-generate | descLength:", desc.trim().length, "| chatbotType:", type, "| industry:", ind, "| tone:", tn);
    setGenError(""); setStep("generating")
    abortRef.current = new AbortController()
    console.log("MARCUS_STAGE_9_GENERATION_STARTED | endpoint: /api/generate/chatbot | trigger: auto-generate | chatbotType:", type, "| industry:", ind, "| tone:", tn);
    let buffer = ""
    let _s10 = false
    try {
      // ── Stage H ────────────────────────────────────────────────────────────────
      console.log("GENERATE_CHATBOT_FETCH_START | endpoint: /api/generate/chatbot | descLength:", desc.trim().length, "| type:", type);
      const res = await fetch("/api/generate/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ businessDescription: desc.trim(), chatbotType: type, tone: tn, industry: ind, language: lang }),
        signal: abortRef.current.signal,
      })
      if (res.status === 403) {
        const errData = await res.json().catch(() => ({}))
        if (errData.error === "UPGRADE_REQUIRED") {
          openUpgradeModal({ feature: errData.feature, featureLabel: errData.featureLabel, requiredPlan: errData.requiredPlan })
          setStep("input")
          return
        }
      }
      if (!res.ok || !res.body) throw new Error("Request failed")
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = carry + dec.decode(value, { stream: true })
        const lines = chunk.split("\n")
        carry = lines.pop() ?? ""
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.content) {
              if (!_s10) {
                // ── Stage I ──────────────────────────────────────────────────────
                console.log("GENERATE_CHATBOT_STREAM_STARTED | first chunk received | chunkLength:", msg.content.length);
                console.log("MARCUS_STAGE_10_STREAM_STARTED | first chunk received | chunkLength:", msg.content.length);
                _s10 = true;
              }
              buffer += msg.content
            }
            if (msg.error) { setGenError(msg.error); setStep("input"); return }
            if (msg.done && msg.data) {
              const out = msg.data as ChatbotOutput
              // ── Stage J ────────────────────────────────────────────────────────
              console.log("GENERATE_CHATBOT_STREAM_COMPLETE | identity:", out.identity?.name, "| role:", out.identity?.role);
              console.log("MARCUS_STAGE_11_GENERATION_COMPLETE | identity:", out.identity?.name, "| role:", out.identity?.role);
              setData(out)
              setEditedPrompt(out.systemPrompt.main)
              initChat(out)
              setStep("done")
              setRightTab("preview")
              console.log("GENERATOR_AUDIT: generator=chatbot | generation completed")
              await completeGeneration(out as unknown as Record<string, unknown>, businessDescRef.current || "Chatbot")
              // Phase 4: signal bridge that generation is fully complete —
              // fires only after SSE streaming, project save, and UI update are done.
              generateCompleteCallbackRef.current?.()
              generateCompleteCallbackRef.current = null
              return
            }
          } catch { /* fragment */ }
        }
      }
      setGenError("Generation ended unexpectedly. Please try again.")
      setStep("input")
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setGenError("Generation failed — please try again")
        setStep("input")
      }
    }
  }

  const generate = () => {
    generateWith(businessDesc, chatbotType, industry, tone)
  }

  const downloadJson = () => {
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `${data.identity.name.toLowerCase().replace(/\s+/g, "-")}-config.json`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#080808]">
      <AppSidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(c => !c)} />

      {/* Locked overlay for free users */}
      {isLocked && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md" style={{ left: sidebarCollapsed ? 64 : 220 }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="w-full max-w-md rounded-2xl border border-primary/25 bg-[#0c0c0c] p-8 shadow-2xl mx-4"
          >
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                <Bot className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-foreground">AI Chatbot Generator</h3>
                  <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary">
                    <Lock className="h-2.5 w-2.5" /> Pro
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">Upgrade to unlock this system</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
              Build a fully-configured AI chatbot with conversation flows, system prompts, integrations, and live preview — pre-filled from your business analysis.
            </p>
            <div className="rounded-xl border border-white/5 bg-white/2 p-4 mb-6 space-y-2">
              <p className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-widest mb-3">Included with Pro</p>
              {["Auto-filled from business intelligence", "Custom conversation flows & intents", "Live chat preview", "Embeddable widget code", "API integration config", "System prompt editor"].map(f => (
                <div key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  {f}
                </div>
              ))}
            </div>
            <button onClick={() => openUpgradeModal()} className="flex w-full h-10 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all gold-glow">
              <Crown className="h-3.5 w-3.5" />
              Upgrade to Pro
            </button>
          </motion.div>
        </div>
      )}

      <div className="flex flex-1 min-w-0 overflow-hidden">
        {/* ─── LEFT PANEL ─────────────────────────────────────────── */}
        <div className="w-[380px] shrink-0 border-r border-white/5 flex flex-col bg-[#090909] overflow-hidden">
          <AnimatePresence mode="wait">
            {/* INPUT STATE */}
            {step === "input" && (
              <motion.div key="input" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }} className="flex flex-col flex-1 min-h-0 overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-5 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="p-2 rounded-xl bg-primary/15 border border-primary/25">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <h1 className="text-base font-bold text-foreground tracking-tight">AI Chatbot Generator</h1>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    Describe your business and generate a deployable AI assistant system.
                  </p>
                  {contextBanner && (
                    <div className="mt-3 flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                      <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                      <p className="text-[11px] text-primary/80 font-medium">Auto-filled from your business intelligence</p>
                    </div>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                  {/* Business description */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Business Description</label>
                    <textarea
                      ref={descTextareaRef}
                      value={businessDesc}
                      onChange={e => setBusinessDesc(e.target.value)}
                      placeholder="e.g. B2B SaaS platform for project management — 500+ enterprise customers, 15-person support team, common questions about integrations, billing, and API usage..."
                      className="w-full h-28 px-3 py-3 rounded-xl bg-white/3 border border-white/8 text-sm text-foreground placeholder-muted-foreground/50 resize-none outline-none focus:border-primary/40 focus:bg-primary/3 transition-all"
                    />
                  </div>

                  {genError && (
                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                      <X className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{genError}</span>
                    </div>
                  )}

                  {/* Chatbot type */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Chatbot Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {CHATBOT_TYPES.map(t => (
                        <button key={t.key} onClick={() => setChatbotType(t.key)}
                          className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${chatbotType === t.key ? "border-primary/50 bg-primary/8 shadow-[0_0_12px_rgba(212,175,55,0.08)]" : "border-white/6 bg-white/2 hover:border-white/12"}`}>
                          <span className="text-lg leading-none">{t.icon}</span>
                          <div className="min-w-0">
                            <div className="text-[11px] font-bold text-foreground truncate">{t.key}</div>
                            <div className="text-[10px] text-muted-foreground">{t.desc}</div>
                          </div>
                          {chatbotType === t.key && <Check className="h-3 w-3 text-primary ml-auto shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Industry */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Industry</label>
                    <div className="relative">
                      <select
                        value={industry}
                        onChange={e => setIndustry(e.target.value as Industry)}
                        className="w-full appearance-none px-3 py-2.5 rounded-xl bg-white/3 border border-white/8 text-sm text-foreground outline-none focus:border-primary/40 transition-all pr-8 cursor-pointer"
                      >
                        {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>

                  {/* Tone */}
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5">Tone</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TONES.map(t => (
                        <button key={t} onClick={() => setTone(t)}
                          className={`px-2 py-2 rounded-lg text-[11px] font-medium border transition-all ${tone === t ? "bg-primary/15 border-primary/40 text-primary" : "bg-white/3 border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15"}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Generate button */}
                <div className="px-5 py-4 border-t border-white/5 shrink-0">
                  <button onClick={generate} disabled={!businessDesc.trim()}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 shadow-[0_0_24px_rgba(212,175,55,0.3)] active:scale-[0.98]">
                    <Bot className="h-4 w-4" />
                    Generate AI Chatbot
                  </button>
                  <p className="text-[10px] text-muted-foreground/60 text-center mt-2">~30–60 seconds · AI-powered generation</p>
                </div>
              </motion.div>
            )}

            {/* GENERATING STATE */}
            {step === "generating" && (
              <motion.div key="generating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0 items-center justify-center px-6">
                <div className="w-full max-w-[280px]">
                  <div className="flex justify-center mb-8">
                    <div className="relative">
                      <div className="h-14 w-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
                        <Bot className="h-7 w-7 text-primary" />
                      </div>
                      <div className="absolute -inset-1 rounded-[20px] border border-primary/20 animate-pulse" />
                    </div>
                  </div>
                  <h2 className="text-center text-base font-bold text-foreground mb-1">Building your chatbot</h2>
                  <p className="text-center text-xs text-muted-foreground mb-8">
                    <span className="text-primary font-semibold">{chatbotType}</span> · <span className="text-primary/80">{tone}</span> · {industry}
                  </p>
                  <div className="space-y-2.5">
                    {GEN_STEPS.map((s, i) => (
                      <motion.div key={s} initial={{ opacity: 0, x: -8 }} animate={{ opacity: i <= genStep ? 1 : 0.2, x: 0 }} transition={{ duration: 0.3, delay: i * 0.1 }} className="flex items-center gap-3">
                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-all ${i < genStep ? "bg-primary/20 border-primary/50" : i === genStep ? "border-primary animate-pulse" : "border-white/10"}`}>
                          {i < genStep ? <Check className="h-3 w-3 text-primary" /> : i === genStep ? <Loader2 className="h-3 w-3 text-primary animate-spin" /> : null}
                        </div>
                        <span className={`text-xs transition-colors ${i <= genStep ? "text-foreground" : "text-muted-foreground/40"}`}>{s}</span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-8 h-1 rounded-full bg-white/5 overflow-hidden">
                    <motion.div className="h-full rounded-full bg-primary" animate={{ width: `${((genStep + 1) / GEN_STEPS.length) * 100}%` }} transition={{ duration: 0.4 }} />
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground mt-3">{Math.round(((genStep + 1) / GEN_STEPS.length) * 100)}% complete</p>
                  <button onClick={() => { abortRef.current?.abort(); setStep("input") }} className="mt-8 w-full text-xs text-muted-foreground hover:text-foreground border border-white/8 py-2 rounded-lg transition-colors">Cancel</button>
                </div>
              </motion.div>
            )}

            {/* DONE STATE — left panel summary */}
            {step === "done" && data && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                {/* Header */}
                <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
                  <button onClick={() => setStep("input")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> New Chatbot
                  </button>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25 text-primary font-semibold">{chatbotType.split(" ")[0]}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{tone}</span>
                  </div>
                </div>

                {/* Bot identity */}
                <div className="px-4 py-3 border-b border-white/5 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                      <Bot className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground truncate">{data.identity.name}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{data.identity.role}</div>
                    </div>
                  </div>
                  <p className="mt-2.5 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{data.identity.objective}</p>
                </div>

                {/* KPIs */}
                <div className="px-4 py-3 border-b border-white/5 shrink-0 grid grid-cols-2 gap-2">
                  {Object.entries(data.kpis ?? {}).map(([k, v]) => (
                    <div key={k} className="p-2 rounded-lg bg-white/3 border border-white/6">
                      <div className="text-[9px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-0.5">{k.replace(/([A-Z])/g, " $1").trim()}</div>
                      <div className="text-[10px] text-primary font-semibold leading-tight">{v}</div>
                    </div>
                  ))}
                </div>

                {/* Suggested prompts */}
                <div className="flex-1 overflow-y-auto px-4 py-3">
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2">Suggested Prompts</p>
                  <div className="space-y-1.5">
                    {(data.suggestedPrompts ?? []).map((p, i) => (
                      <button key={i} onClick={() => { setRightTab("preview"); sendMessage(p) }}
                        className="w-full text-left px-3 py-2 rounded-lg border border-white/6 bg-white/2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-white/5 hover:border-primary/20 transition-all line-clamp-2 leading-relaxed">
                        {p}
                      </button>
                    ))}
                  </div>

                  {/* Deployment chips */}
                  <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-4 mb-2">Deploy On</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(data.deployment?.recommended ?? []).map(d => (
                      <span key={d} className="px-2 py-1 rounded-lg border border-white/8 bg-white/3 text-[10px] text-muted-foreground capitalize">{d.replace("_", " ")}</span>
                    ))}
                  </div>
                </div>

                {/* Regen button */}
                <div className="px-4 pb-4 pt-2 shrink-0 border-t border-white/5">
                  <button onClick={generate} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/10 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition-all">
                    <RefreshCw className="h-3.5 w-3.5" /> Regenerate
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ─── RIGHT PANEL ────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#050505]">
          {/* Tab bar */}
          <div className="h-12 shrink-0 border-b border-white/5 flex items-center px-4 gap-1">
            {RIGHT_TABS.map(t => (
              <button key={t.key} onClick={() => setRightTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${rightTab === t.key ? "bg-primary/15 text-primary border border-primary/25" : "text-muted-foreground hover:text-foreground hover:bg-white/5 border border-transparent"}`}>
                {t.icon}{t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <AnimatePresence mode="wait">

              {/* ── PREVIEW TAB ─────────────────────────────────── */}
              {rightTab === "preview" && (
                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
                  {/* Device toggle */}
                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                    {(["widget", "mobile", "whatsapp"] as PreviewMode[]).map(m => (
                      <button key={m} onClick={() => setPreviewMode(m)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${previewMode === m ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-white/8 hover:text-foreground"}`}>
                        {m === "mobile" ? <Smartphone className="h-3.5 w-3.5" /> : m === "whatsapp" ? <span className="text-[14px]">💬</span> : <Monitor className="h-3.5 w-3.5" />}
                        {m === "whatsapp" ? "WhatsApp" : m.charAt(0).toUpperCase() + m.slice(1)}
                      </button>
                    ))}
                    {step === "done" && data && (
                      <button onClick={() => initChat(data)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all">
                        <RefreshCw className="h-3 w-3" /> Reset
                      </button>
                    )}
                  </div>

                  {/* Chat area */}
                  <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto"
                    style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.04), transparent)" }}>
                    {step === "input" && (
                      <div className="text-center">
                        <div className="p-5 rounded-3xl bg-white/3 border border-white/6 mb-4 inline-flex">
                          <Bot className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <h3 className="text-base font-bold text-foreground/70 mb-2">Chatbot preview</h3>
                        <p className="text-sm text-muted-foreground/50 max-w-[260px] leading-relaxed">Fill in your business details and generate. Your live chatbot will appear here.</p>
                      </div>
                    )}

                    {step === "generating" && (
                      <div className="space-y-3 w-full max-w-md">
                        {[60, 120, 80, 100, 60].map((h, i) => (
                          <motion.div key={i} animate={{ opacity: [0.05, 0.12, 0.05] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                            className="rounded-2xl bg-white/5 border border-white/4" style={{ height: h }} />
                        ))}
                      </div>
                    )}

                    {step === "done" && data && (
                      <div className="w-full h-full flex items-end justify-center">
                        <ChatWidget
                          data={data}
                          mode={previewMode}
                          messages={messages}
                          isTyping={isTyping}
                          quickReplies={quickReplies}
                          chatInput={chatInput}
                          onChatInput={setChatInput}
                          onSend={() => handleSendInput()}
                          onQuickReply={sendMessage}
                          messagesEndRef={messagesEndRef}
                        />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ── FLOWS TAB ─────────────────────────────────────── */}
              {rightTab === "flows" && (
                <motion.div key="flows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
                  {!data ? <EmptyState icon={<GitBranch className="h-8 w-8" />} label="Generate a chatbot to see conversation flows" /> : (
                    <div className="max-w-3xl mx-auto">
                      <h2 className="text-lg font-bold text-foreground mb-1">Conversation Flows</h2>
                      <p className="text-sm text-muted-foreground mb-6">5 adaptive flows triggered by user intent.</p>
                      <div className="space-y-4">
                        {[
                          { key: "welcome", label: "Welcome Flow", color: "from-primary/20", icon: "👋", data: data.conversationFlows.welcome, summary: data.conversationFlows.welcome.botMessage },
                          { key: "lead", label: "Lead Capture Flow", color: "from-blue-500/20", icon: "🎯", data: data.conversationFlows.leadCapture, summary: `${data.conversationFlows.leadCapture.steps?.length ?? 0} steps — ${data.conversationFlows.leadCapture.trigger}` },
                          { key: "support", label: "Support Flow", color: "from-violet-500/20", icon: "🛟", data: data.conversationFlows.support, summary: `Handles: ${Object.keys(data.conversationFlows.support?.responses ?? {}).join(", ")}` },
                          { key: "escalation", label: "Escalation Flow", color: "from-orange-500/20", icon: "⚡", data: data.conversationFlows.escalation, summary: data.conversationFlows.escalation.botMessage },
                          { key: "closing", label: "Closing Flow", color: "from-emerald-500/20", icon: "✅", data: data.conversationFlows.closing, summary: data.conversationFlows.closing.botMessage },
                        ].map((flow, idx) => (
                          <FlowCard key={flow.key} index={idx + 1} label={flow.label} icon={flow.icon} colorClass={flow.color} summary={flow.summary} flowData={flow.data} />
                        ))}
                      </div>

                      {/* Automation */}
                      <h3 className="text-base font-bold text-foreground mt-8 mb-4">Automation Triggers</h3>
                      <div className="space-y-3">
                        {(data.automation?.triggers ?? []).map((t, i) => (
                          <div key={i} className="p-4 rounded-xl border border-white/8 bg-white/2">
                            <div className="flex items-start gap-3">
                              <div className="h-6 w-6 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0 mt-0.5">
                                <Zap className="h-3 w-3 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-semibold text-foreground">{t.event}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">When: {t.condition}</div>
                                <div className="text-xs text-primary/80 mt-1">→ {t.action}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── PROMPT TAB ─────────────────────────────────────── */}
              {rightTab === "prompt" && (
                <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
                  {!data ? <EmptyState icon={<Settings2 className="h-8 w-8" />} label="Generate a chatbot to see the system prompt" /> : (
                    <div className="max-w-3xl mx-auto space-y-6">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h2 className="text-lg font-bold text-foreground">System Prompt</h2>
                          <button onClick={() => copyToClipboard(editedPrompt, "main")}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 transition-all">
                            {copiedKey === "main" ? <><Check className="h-3 w-3 text-emerald-400" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
                          </button>
                        </div>
                        <textarea
                          value={editedPrompt}
                          onChange={e => setEditedPrompt(e.target.value)}
                          className="w-full h-64 px-4 py-3 rounded-xl bg-white/3 border border-white/8 text-sm text-foreground font-mono resize-none outline-none focus:border-primary/40 leading-relaxed transition-all"
                        />
                      </div>

                      <div className="grid grid-cols-1 gap-4">
                        <InfoCard title="Behavior Guidelines" content={data.systemPrompt.behavior} onCopy={() => copyToClipboard(data.systemPrompt.behavior, "behavior")} copied={copiedKey === "behavior"} />
                        <InfoCard title="Response Style" content={data.systemPrompt.responseStyle} onCopy={() => copyToClipboard(data.systemPrompt.responseStyle, "style")} copied={copiedKey === "style"} />
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-foreground mb-3">Constraints</h3>
                        <div className="space-y-2">
                          {(data.systemPrompt.constraints ?? []).map((c, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg border border-red-500/15 bg-red-500/5">
                              <X className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                              <span className="text-xs text-muted-foreground">{c}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-foreground mb-3">Fallback Responses</h3>
                        <div className="space-y-2">
                          {(data.systemPrompt.fallbacks ?? []).map((f, i) => (
                            <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-white/8 bg-white/2">
                              <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                              <span className="text-xs text-foreground/80 italic">"{f}"</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── INTEGRATIONS TAB ──────────────────────────────── */}
              {rightTab === "integrations" && (
                <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
                  {!data ? <EmptyState icon={<Plug className="h-8 w-8" />} label="Generate a chatbot to see integration recommendations" /> : (
                    <div className="max-w-3xl mx-auto">
                      <h2 className="text-lg font-bold text-foreground mb-1">Integration Stack</h2>
                      <p className="text-sm text-muted-foreground mb-6">Recommended for your {chatbotType.toLowerCase()} · {industry} setup.</p>
                      <div className="space-y-6">
                        {Object.entries(data.integrations ?? {}).map(([category, items]) => (
                          items && items.length > 0 && (
                            <div key={category}>
                              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{category}</h3>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {items.map((item: { name: string; purpose: string; priority: string }) => (
                                  <div key={item.name} className="flex items-start gap-3 p-4 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-all">
                                    <div className="h-9 w-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                      <span className="text-base font-black text-primary">{item.name[0]}</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-foreground">{item.name}</span>
                                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${PRIORITY_COLOR[item.priority] ?? PRIORITY_COLOR["medium"]}`}>{item.priority}</span>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5">{item.purpose}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        ))}
                      </div>

                      {/* Workflows */}
                      <h3 className="text-base font-bold text-foreground mt-8 mb-4">Automation Workflows</h3>
                      <div className="space-y-3">
                        {(data.automation?.workflows ?? []).map((wf, i) => (
                          <div key={i} className="p-4 rounded-xl border border-white/8 bg-white/2">
                            <div className="text-sm font-semibold text-foreground mb-2">{wf.name}</div>
                            <div className="flex flex-wrap gap-2">
                              {wf.steps?.map((s, j) => (
                                <div key={j} className="flex items-center gap-1">
                                  <span className="text-[10px] px-2 py-1 rounded-lg bg-white/5 border border-white/8 text-muted-foreground">{s}</span>
                                  {j < wf.steps.length - 1 && <span className="text-muted-foreground/40 text-xs">→</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ── EXPORT TAB ────────────────────────────────────── */}
              {rightTab === "export" && (
                <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
                  {!data ? <EmptyState icon={<FileJson className="h-8 w-8" />} label="Generate a chatbot to export your config" /> : (
                    <div className="max-w-2xl mx-auto">
                      <h2 className="text-lg font-bold text-foreground mb-1">Export Chatbot</h2>
                      <p className="text-sm text-muted-foreground mb-6">Everything you need to deploy {data.identity.name}.</p>
                      <div className="grid grid-cols-1 gap-4">
                        {[
                          { label: "Download Full Config (JSON)", desc: "Complete chatbot configuration — flows, prompts, integrations, automation", icon: <Download className="h-5 w-5 text-primary" />, action: downloadJson, actionLabel: "Download JSON" },
                          { label: "Copy System Prompt", desc: "Ready to paste into OpenAI, Claude, or any LLM playground", icon: <Copy className="h-5 w-5 text-primary" />, action: () => copyToClipboard(editedPrompt || data.systemPrompt.main, "export-prompt"), actionLabel: copiedKey === "export-prompt" ? "Copied!" : "Copy Prompt" },
                          { label: "Copy Widget Embed Code", desc: "Paste into your website <head> to add the chat widget", icon: <Copy className="h-5 w-5 text-primary" />, action: () => copyToClipboard(data.deployment.widgetSnippet, "widget"), actionLabel: copiedKey === "widget" ? "Copied!" : "Copy Code" },
                          { label: "Copy All Suggested Prompts", desc: "Use these to train or seed your chatbot's knowledge", icon: <Copy className="h-5 w-5 text-primary" />, action: () => copyToClipboard(data.suggestedPrompts.join("\n"), "prompts"), actionLabel: copiedKey === "prompts" ? "Copied!" : "Copy Prompts" },
                        ].map((item, i) => (
                          <div key={i} className="flex items-center gap-4 p-5 rounded-xl border border-white/8 bg-white/2 hover:border-white/12 transition-all">
                            <div className="h-11 w-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">{item.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-foreground">{item.label}</div>
                              <div className="text-xs text-muted-foreground mt-0.5">{item.desc}</div>
                            </div>
                            <button onClick={item.action} className="shrink-0 px-4 py-2 rounded-xl bg-primary/15 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/25 transition-all whitespace-nowrap">
                              {item.actionLabel}
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Widget code preview */}
                      <div className="mt-6">
                        <h3 className="text-sm font-bold text-foreground mb-3">Widget Embed Code</h3>
                        <div className="relative">
                          <pre className="p-4 rounded-xl bg-black/40 border border-white/8 text-[11px] text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                            {data.deployment.widgetSnippet}
                          </pre>
                          <button onClick={() => copyToClipboard(data.deployment.widgetSnippet, "snippet")}
                            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/8 hover:bg-white/12 transition-colors">
                            {copiedKey === "snippet" ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                          </button>
                        </div>
                      </div>

                      {/* WhatsApp setup */}
                      <div className="mt-4">
                        <h3 className="text-sm font-bold text-foreground mb-2">WhatsApp Setup</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed p-4 rounded-xl bg-white/2 border border-white/8">{data.deployment.whatsappSetup}</p>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8">
      <div className="p-5 rounded-3xl bg-white/3 border border-white/6 mb-4 text-muted-foreground/30">{icon}</div>
      <p className="text-sm text-muted-foreground/60 max-w-[240px] leading-relaxed">{label}</p>
    </div>
  )
}

function InfoCard({ title, content, onCopy, copied }: { title: string; content: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="p-4 rounded-xl border border-white/8 bg-white/2">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <button onClick={onCopy} className="p-1.5 rounded-lg hover:bg-white/8 transition-colors">
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{content}</p>
    </div>
  )
}

function FlowCard({ index, label, icon, colorClass, summary, flowData }: {
  index: number; label: string; icon: string; colorClass: string; summary: string; flowData: unknown
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 p-4 text-left hover:bg-white/2 transition-colors">
        <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${colorClass} to-transparent border border-white/10 flex items-center justify-center shrink-0 text-lg`}>{icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground/50 font-mono">0{index}</span>
            <span className="text-sm font-bold text-foreground">{label}</span>
          </div>
          <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{summary}</p>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden border-t border-white/5">
            <pre className="px-4 py-3 text-[11px] text-muted-foreground font-mono whitespace-pre-wrap overflow-x-auto leading-relaxed">
              {JSON.stringify(flowData, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function ChatWidget({
  data, mode, messages, isTyping, quickReplies, chatInput, onChatInput, onSend, onQuickReply, messagesEndRef
}: {
  data: ChatbotOutput; mode: PreviewMode; messages: ChatMessage[]; isTyping: boolean;
  quickReplies: string[]; chatInput: string; onChatInput: (v: string) => void;
  onSend: () => void; onQuickReply: (t: string) => void; messagesEndRef: React.RefObject<HTMLDivElement | null>
}) {
  const isWA = mode === "whatsapp"
  const bg = isWA ? "#0b141a" : "#0a0a0a"
  const accentColor = isWA ? "#25d366" : "#d4af37"
  const userBubble = isWA ? "#005c4b" : "rgba(212,175,55,0.15)"
  const botBubble = isWA ? "#202c33" : "rgba(255,255,255,0.04)"
  const maxW = mode === "mobile" ? "390px" : mode === "widget" ? "400px" : "380px"

  return (
    <motion.div
      animate={{ maxWidth: maxW, width: "100%" }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="flex flex-col h-[560px] rounded-2xl overflow-hidden border shadow-2xl"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: bg, boxShadow: `0 0 60px rgba(0,0,0,0.6), 0 0 40px ${accentColor}12` }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: isWA ? "#202c33" : "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}25`, border: `1px solid ${accentColor}40` }}>
          <Bot className="h-4.5 w-4.5" style={{ color: accentColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-white truncate">{data.identity.name}</div>
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-[10px] text-white/50">Online · usually replies instantly</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: bg }}>
        <AnimatePresence initial={false}>
          {messages.map(m => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }}
              className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "bot" && (
                <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-1" style={{ background: `${accentColor}20` }}>
                  <Bot className="h-3 w-3" style={{ color: accentColor }} />
                </div>
              )}
              <div className="max-w-[75%]">
                <div className="px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed text-white"
                  style={{ background: m.role === "user" ? userBubble : botBubble, borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px", border: m.role === "bot" && !isWA ? "1px solid rgba(255,255,255,0.06)" : undefined }}>
                  {m.text}
                </div>
                <div className="text-[10px] text-white/25 mt-1 px-1" style={{ textAlign: m.role === "user" ? "right" : "left" }}>now</div>
              </div>
              {m.role === "user" && (
                <div className="h-6 w-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1">
                  <User className="h-3 w-3 text-white/60" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex gap-2 items-end">
              <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0" style={{ background: `${accentColor}20` }}>
                <Bot className="h-3 w-3" style={{ color: accentColor }} />
              </div>
              <div className="px-4 py-3 rounded-2xl flex gap-1 items-center" style={{ background: botBubble, borderRadius: "18px 18px 18px 4px" }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: accentColor }}
                    animate={{ y: [0, -5, 0] }} transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }} />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Quick replies */}
      <AnimatePresence>
        {quickReplies.length > 0 && !isTyping && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="px-3 py-2 flex flex-wrap gap-1.5 shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            {quickReplies.map((r, i) => (
              <button key={i} onClick={() => onQuickReply(r)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all"
                style={{ borderColor: `${accentColor}40`, color: accentColor, background: `${accentColor}10` }}
                onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}20` }}
                onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.background = `${accentColor}10` }}>
                {r.length > 40 ? r.slice(0, 38) + "…" : r}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="px-3 py-3 flex items-center gap-2 shrink-0"
        style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: isWA ? "#202c33" : "rgba(255,255,255,0.02)" }}>
        <input
          value={chatInput}
          onChange={e => onChatInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSend()}
          placeholder="Type a message…"
          className="flex-1 px-3 py-2 rounded-full text-sm text-white placeholder-white/30 outline-none"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <button onClick={onSend}
          className="h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-all active:scale-95"
          style={{ background: accentColor }}>
          <Send className="h-4 w-4 text-black" />
        </button>
      </div>
    </motion.div>
  )
}
