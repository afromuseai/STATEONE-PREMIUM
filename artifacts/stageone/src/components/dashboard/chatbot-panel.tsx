import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Bot, Copy, Download, Check, MessageCircle, Zap, RefreshCw,
  ChevronDown, X, Monitor, Smartphone, Send, User, Settings2,
  GitBranch, Plug, FileJson,
} from "lucide-react"
import { useLocation } from "wouter"
import { useLang } from "@/lib/i18n"
import { Markdown } from "@/lib/markdown-renderer"

// ─── Types ────────────────────────────────────────────────────────────────────

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

const RIGHT_TABS: { key: RightTab; label: string; icon: React.ReactNode }[] = [
  { key: "preview",      label: "Preview",      icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: "flows",        label: "Flows",        icon: <GitBranch className="h-3.5 w-3.5" /> },
  { key: "prompt",       label: "Prompt",       icon: <Settings2 className="h-3.5 w-3.5" /> },
  { key: "integrations", label: "Integrations", icon: <Plug className="h-3.5 w-3.5" /> },
  { key: "export",       label: "Export",       icon: <FileJson className="h-3.5 w-3.5" /> },
]

const PRIORITY_COLOR: Record<string, string> = {
  high:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  low:    "text-muted-foreground bg-white/5 border-white/10",
}

let msgId = 0

// ─── Sub-components ───────────────────────────────────────────────────────────

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
      className="flex flex-col h-[520px] rounded-2xl overflow-hidden border shadow-2xl"
      style={{ borderColor: "rgba(255,255,255,0.08)", background: bg, boxShadow: `0 0 60px rgba(0,0,0,0.6), 0 0 40px ${accentColor}12` }}
    >
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ background: isWA ? "#202c33" : "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${accentColor}25`, border: `1px solid ${accentColor}40` }}>
          <Bot className="h-4 w-4" style={{ color: accentColor }} />
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
                  <Markdown text={m.text} />
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

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface ChatbotPanelProps {
  chatbotOutput: Record<string, unknown>
  onRegenerate?: () => void
}

export function ChatbotPanel({ chatbotOutput, onRegenerate }: ChatbotPanelProps) {
  const { lang } = useLang()
  const [, setLocation] = useLocation()
  const data = chatbotOutput as unknown as ChatbotOutput

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [chatInput, setChatInput] = useState("")
  const [rightTab, setRightTab] = useState<RightTab>("preview")
  const [previewMode, setPreviewMode] = useState<PreviewMode>("widget")
  const [editedPrompt, setEditedPrompt] = useState(data.systemPrompt?.main ?? "")
  const [copiedKey, setCopiedKey] = useState("")

  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const chatHistoryRef = useRef<ChatMessage[]>([])

  const initChat = useCallback((d: ChatbotOutput) => {
    const greetText =
      d.conversationFlows?.welcome?.botMessage ||
      d.identity?.greeting ||
      "Hello! How can I help you today?"
    const greet: ChatMessage = { role: "bot", text: greetText, id: ++msgId }
    setMessages([greet])
    chatHistoryRef.current = [greet]
    setQuickReplies(
      d.conversationFlows?.welcome?.quickReplies?.slice(0, 4) ??
      d.suggestedPrompts?.slice(0, 4) ??
      []
    )
  }, [])

  useEffect(() => {
    if (data) {
      initChat(data)
      setEditedPrompt(data.systemPrompt?.main ?? "")
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

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
      setIsTyping(false)
      const fallback = data.systemPrompt.fallbacks?.[0] ?? "I'm here to help! Could you clarify what you need?"
      setMessages(m => [...m, { role: "bot", text: fallback, id: botId }])
    }

    const fresh = (data.suggestedPrompts ?? []).filter(p => p !== text).slice(0, 3)
    setQuickReplies(fresh)
  }, [data, isTyping, lang, chatHistoryRef])

  const handleSendInput = () => {
    if (chatInput.trim()) { sendMessage(chatInput.trim()); setChatInput("") }
  }

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedKey(key); setTimeout(() => setCopiedKey(""), 2000)
  }

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url
    a.download = `${data.identity.name.toLowerCase().replace(/\s+/g, "-")}-config.json`
    a.click(); URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-[#080808] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center gap-3 border-b border-white/5 px-5 h-12 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.7)] animate-pulse" />
          <span className="text-xs font-semibold text-foreground">{data.identity.name}</span>
          <span className="text-[10px] text-muted-foreground">· {data.identity.role}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </button>
          )}
          <button
            onClick={() => setLocation("/chatbot-generator")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all"
          >
            Open Builder
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="h-11 shrink-0 border-b border-white/5 flex items-center px-4 gap-1">
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

          {/* PREVIEW TAB */}
          {rightTab === "preview" && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full flex flex-col">
              <div className="px-4 py-2.5 border-b border-white/5 flex items-center gap-2 shrink-0">
                {(["widget", "mobile", "whatsapp"] as PreviewMode[]).map(m => (
                  <button key={m} onClick={() => setPreviewMode(m)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${previewMode === m ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-white/8 hover:text-foreground"}`}>
                    {m === "mobile" ? <Smartphone className="h-3.5 w-3.5" /> : m === "whatsapp" ? <span className="text-[14px]">💬</span> : <Monitor className="h-3.5 w-3.5" />}
                    {m === "whatsapp" ? "WhatsApp" : m.charAt(0).toUpperCase() + m.slice(1)}
                  </button>
                ))}
                <button onClick={() => initChat(data)} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-white/8 hover:border-white/15 transition-all">
                  <RefreshCw className="h-3 w-3" /> Reset
                </button>
              </div>
              <div className="flex-1 min-h-0 flex items-center justify-center p-6 overflow-auto"
                style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.04), transparent)" }}>
                <div className="w-full h-full flex items-end justify-center">
                  <ChatWidget
                    data={data}
                    mode={previewMode}
                    messages={messages}
                    isTyping={isTyping}
                    quickReplies={quickReplies}
                    chatInput={chatInput}
                    onChatInput={setChatInput}
                    onSend={handleSendInput}
                    onQuickReply={sendMessage}
                    messagesEndRef={messagesEndRef}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* FLOWS TAB */}
          {rightTab === "flows" && (
            <motion.div key="flows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg font-bold text-foreground mb-1">Conversation Flows</h2>
                <p className="text-sm text-muted-foreground mb-6">5 adaptive flows triggered by user intent.</p>
                <div className="space-y-4">
                  {[
                    { key: "welcome",    label: "Welcome Flow",    color: "from-primary/20",      icon: "👋", data: data.conversationFlows?.welcome,    summary: data.conversationFlows?.welcome?.botMessage ?? "" },
                    { key: "lead",       label: "Lead Capture Flow",color: "from-blue-500/20",    icon: "🎯", data: data.conversationFlows?.leadCapture, summary: `${data.conversationFlows?.leadCapture?.steps?.length ?? 0} steps — ${data.conversationFlows?.leadCapture?.trigger ?? ""}` },
                    { key: "support",    label: "Support Flow",     color: "from-violet-500/20",  icon: "🛟", data: data.conversationFlows?.support,     summary: `Handles: ${Object.keys(data.conversationFlows?.support?.responses ?? {}).join(", ")}` },
                    { key: "escalation", label: "Escalation Flow",  color: "from-orange-500/20",  icon: "⚡", data: data.conversationFlows?.escalation,  summary: data.conversationFlows?.escalation?.botMessage ?? "" },
                    { key: "closing",    label: "Closing Flow",     color: "from-emerald-500/20", icon: "✅", data: data.conversationFlows?.closing,     summary: data.conversationFlows?.closing?.botMessage ?? "" },
                  ].map((flow, idx) => (
                    <FlowCard key={flow.key} index={idx + 1} label={flow.label} icon={flow.icon} colorClass={flow.color} summary={flow.summary} flowData={flow.data} />
                  ))}
                </div>

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
            </motion.div>
          )}

          {/* PROMPT TAB */}
          {rightTab === "prompt" && (
            <motion.div key="prompt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
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
                  <InfoCard title="Behavior Guidelines" content={data.systemPrompt?.behavior ?? ""} onCopy={() => copyToClipboard(data.systemPrompt?.behavior ?? "", "behavior")} copied={copiedKey === "behavior"} />
                  <InfoCard title="Response Style" content={data.systemPrompt?.responseStyle ?? ""} onCopy={() => copyToClipboard(data.systemPrompt?.responseStyle ?? "", "style")} copied={copiedKey === "style"} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-3">Constraints</h3>
                  <div className="space-y-2">
                    {(data.systemPrompt?.constraints ?? []).map((c, i) => (
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
                    {(data.systemPrompt?.fallbacks ?? []).map((f, i) => (
                      <div key={i} className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-white/8 bg-white/2">
                        <Bot className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <span className="text-xs text-foreground/80 italic">"{f}"</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* INTEGRATIONS TAB */}
          {rightTab === "integrations" && (
            <motion.div key="integrations" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-lg font-bold text-foreground mb-1">Integration Stack</h2>
                <p className="text-sm text-muted-foreground mb-6">Recommended integration setup.</p>
                <div className="space-y-6">
                  {Object.entries(data.integrations ?? {}).map(([category, items]) => (
                    items && (items as unknown[]).length > 0 && (
                      <div key={category}>
                        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{category}</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {(items as Array<{ name: string; purpose: string; priority: string }>).map(item => (
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
            </motion.div>
          )}

          {/* EXPORT TAB */}
          {rightTab === "export" && (
            <motion.div key="export" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full overflow-y-auto p-6">
              <div className="max-w-2xl mx-auto">
                <h2 className="text-lg font-bold text-foreground mb-1">Export Chatbot</h2>
                <p className="text-sm text-muted-foreground mb-6">Everything you need to deploy {data.identity?.name}.</p>
                <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: "Download Full Config (JSON)", desc: "Complete chatbot configuration — flows, prompts, integrations, automation", icon: <Download className="h-5 w-5 text-primary" />, action: downloadJson, actionLabel: "Download JSON" },
                    { label: "Copy System Prompt", desc: "Ready to paste into OpenAI, Claude, or any LLM playground", icon: <Copy className="h-5 w-5 text-primary" />, action: () => copyToClipboard(editedPrompt || data.systemPrompt?.main, "export-prompt"), actionLabel: copiedKey === "export-prompt" ? "Copied!" : "Copy Prompt" },
                    { label: "Copy Widget Embed Code", desc: "Paste into your website <head> to add the chat widget", icon: <Copy className="h-5 w-5 text-primary" />, action: () => copyToClipboard(data.deployment?.widgetSnippet ?? "", "widget"), actionLabel: copiedKey === "widget" ? "Copied!" : "Copy Code" },
                    { label: "Copy All Suggested Prompts", desc: "Use these to train or seed your chatbot's knowledge", icon: <Copy className="h-5 w-5 text-primary" />, action: () => copyToClipboard((data.suggestedPrompts ?? []).join("\n"), "prompts"), actionLabel: copiedKey === "prompts" ? "Copied!" : "Copy Prompts" },
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

                {data.deployment?.widgetSnippet && (
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
                )}

                {data.deployment?.whatsappSetup && (
                  <div className="mt-4">
                    <h3 className="text-sm font-bold text-foreground mb-2">WhatsApp Setup</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed p-4 rounded-xl bg-white/2 border border-white/8">{data.deployment.whatsappSetup}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Empty state (no chatbot yet) ────────────────────────────────────────────

export function ChatbotEmptyPanel({ biData, onNavigate }: {
  biData: { chatbotRole?: string } | null
  onNavigate: () => void
}) {
  return (
    <div className="p-6 space-y-5">
      {biData?.chatbotRole ? (
        <div className="glass-card rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bot className="h-4 w-4 text-purple-400" />
            <h3 className="text-sm font-semibold text-foreground">AI Chatbot Role (from Analysis)</h3>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{biData.chatbotRole}</p>
          <p className="text-xs text-muted-foreground mt-3">Generate a chatbot to see the full interactive tester here.</p>
        </div>
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <Bot className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-1">No chatbot yet.</p>
          <p className="text-xs text-muted-foreground">Generate a business analysis first, then build a chatbot from it.</p>
        </div>
      )}
      <button
        onClick={onNavigate}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-border/50 bg-secondary/20 text-sm text-foreground hover:border-primary/50 hover:bg-primary/5 transition-all"
      >
        <Bot className="h-4 w-4 text-purple-400" />
        Open Chatbot Generator
      </button>
    </div>
  )
}
