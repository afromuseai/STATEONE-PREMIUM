import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import {
  Bot, X, Send, Sparkles, RotateCcw, Minimize2,
  Globe, Workflow, Brain, Rocket, BarChart3, TrendingUp,
  Zap, Target, ChevronRight, MessageSquare, Activity,
} from "lucide-react"
import { useBusinessContext } from "@/lib/business-context"
import { useAuth } from "@/lib/auth-context"

interface Message {
  role: "user" | "assistant"
  content: string
}

const QUICK_COMMANDS = [
  { icon: TrendingUp, label: "Improve scalability", prompt: "How can I improve the scalability score and reach exponential growth in my business?" },
  { icon: Workflow, label: "Onboarding workflow", prompt: "Generate a detailed onboarding automation workflow for new customers with specific tools and triggers." },
  { icon: Target, label: "Monetization strategy", prompt: "What are the most effective monetization strategies for my business type? Give me specific pricing models and revenue levers." },
  { icon: Brain, label: "Explain my metrics", prompt: "Can you explain what each business intelligence metric means and how I can improve the ones that are low?" },
  { icon: Zap, label: "Growth tactics", prompt: "Give me 5 specific, tactical growth strategies I can execute in the next 30 days with measurable outcomes." },
  { icon: Globe, label: "Website strategy", prompt: "What pages and conversion elements should my website have to maximize lead generation and sales?" },
  { icon: Rocket, label: "Deploy a project", prompt: "How do I deploy my generated website or application to production using STAGEONE?" },
  { icon: BarChart3, label: "New analysis", prompt: "Help me craft a detailed business idea for analysis. Ask me questions about my target market and goals." },
]

function renderMessage(content: string) {
  if (!content) return null
  const lines = content.split("\n")
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { elements.push(<div key={i} className="h-1" />); i++; continue }

    if (line.startsWith("### ")) {
      elements.push(<p key={i} className="text-[10px] font-black uppercase tracking-widest text-primary/80 mt-2 mb-0.5">{line.slice(4)}</p>)
    } else if (line.startsWith("## ")) {
      elements.push(<p key={i} className="text-xs font-bold text-foreground mt-2 mb-0.5">{line.slice(3)}</p>)
    } else if (line.startsWith("**") && line.endsWith("**") && line.length > 4) {
      elements.push(<p key={i} className="text-[11px] font-bold text-foreground">{line.slice(2, -2)}</p>)
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} className="flex items-start gap-1.5 my-0.5">
          <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/60 shrink-0" />
          <span className="text-[11px] leading-relaxed text-muted-foreground">{line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}</span>
        </div>
      )
    } else if (/^\d+\./.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1]
      const text = line.replace(/^\d+\.\s*/, "").replace(/\*\*(.*?)\*\*/g, "$1")
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary mt-0.5">{num}</span>
          <span className="text-[11px] leading-relaxed text-muted-foreground">{text}</span>
        </div>
      )
    } else {
      const formatted = line.replace(/\*\*(.*?)\*\*/g, (_, m) => `<strong>${m}</strong>`)
      elements.push(<p key={i} className="text-[11px] leading-relaxed text-muted-foreground" dangerouslySetInnerHTML={{ __html: formatted }} />)
    }
    i++
  }
  return <div className="space-y-0.5">{elements}</div>
}

export function CopilotPanel() {
  const { user, isLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const [, navigate] = useLocation()
  const { businessData } = useBusinessContext()
  const hasBusinessContext = !!businessData?.industry

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, minimized])

  const sendMessage = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || streaming) return

    setInput("")
    setShowCommands(false)
    const userMsg: Message = { role: "user", content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setStreaming(true)

    const assistantMsg: Message = { role: "assistant", content: "" }
    setMessages(prev => [...prev, assistantMsg])

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: newMessages, businessContext: businessData }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error("Request failed")

      const reader = res.body.getReader()
      const dec = new TextDecoder()
      let carry = ""
      let buffer = ""

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
              buffer += msg.content
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: buffer }
                return updated
              })
            }
          } catch { /* fragment */ }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: "assistant", content: "Sorry, I ran into an error. Please try again." }
          return updated
        })
      }
    } finally {
      setStreaming(false)
    }
  }, [input, messages, streaming])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const clearChat = () => {
    if (streaming) abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
    setShowCommands(false)
  }

  if (isLoading || !user) return null

  return (
    <>
      {/* Floating Trigger */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-2xl border border-primary/30 bg-[#0c0c0c] px-4 py-3 shadow-[0_0_28px_rgba(212,175,55,0.2)] hover:shadow-[0_0_40px_rgba(212,175,55,0.35)] transition-all group"
          >
            <div className="relative">
              <div className="p-1 rounded-lg bg-primary/15">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <motion.div
                className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-[#0c0c0c]"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <div className="text-left">
              <p className="text-[11px] font-black text-foreground leading-none">AI Copilot</p>
              <p className="text-[8px] text-muted-foreground/60 mt-0.5">AI-powered assistant</p>
            </div>
            <Sparkles className="h-3 w-3 text-primary/50 group-hover:text-primary/80 transition-colors" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-white/8 bg-[#090909] shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden"
            style={{ width: 390, maxHeight: minimized ? 52 : 620, transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0d0d0d] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="p-1.5 rounded-xl bg-primary/10 border border-primary/20">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <motion.div
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-[#0d0d0d]"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <p className="text-xs font-black text-foreground">STAGEONE Copilot</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[9px] text-emerald-400/80">Online · AI Assistant</p>
                    {hasBusinessContext && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-0.5 rounded-full bg-primary/15 border border-primary/25 px-1.5 py-0.5"
                      >
                        <Activity className="h-2 w-2 text-primary" />
                        <span className="text-[8px] font-semibold text-primary">
                          {(businessData as Record<string, unknown>).industry as string}
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={clearChat} title="Clear" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button onClick={() => setMinimized(m => !m)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
                  {messages.length === 0 ? (
                    <div className="space-y-4">
                      {/* Welcome */}
                      <div className="text-center pt-2">
                        <motion.div
                          className="mx-auto w-14 h-14 rounded-2xl border border-primary/20 bg-primary/5 flex items-center justify-center mb-3"
                          animate={{ boxShadow: ["0 0 0px rgba(212,175,55,0)", "0 0 20px rgba(212,175,55,0.2)", "0 0 0px rgba(212,175,55,0)"] }}
                          transition={{ duration: 3, repeat: Infinity }}
                        >
                          <Sparkles className="h-7 w-7 text-primary" />
                        </motion.div>
                        <p className="text-sm font-black text-foreground mb-1">Your AI Business Copilot</p>
                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed max-w-[260px] mx-auto">
                          I can help you build strategy, generate workflows, explain metrics, and optimize your STAGEONE workspace.
                        </p>
                      </div>

                      {/* Quick commands */}
                      <div>
                        <p className="text-[8px] font-black text-muted-foreground/35 uppercase tracking-[0.18em] mb-2">Quick Commands</p>
                        <div className="space-y-1">
                          {QUICK_COMMANDS.slice(0, 5).map(({ icon: Icon, label, prompt }) => (
                            <motion.button
                              key={label}
                              whileHover={{ x: 2 }}
                              onClick={() => sendMessage(prompt)}
                              className="w-full flex items-center gap-2.5 rounded-xl border border-white/4 bg-white/2 p-2.5 text-left hover:border-primary/20 hover:bg-primary/5 transition-all group"
                            >
                              <Icon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/70 transition-colors shrink-0" />
                              <span className="flex-1 text-[10px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">{label}</span>
                              <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                            </motion.button>
                          ))}
                        </div>
                        <button
                          onClick={() => setShowCommands(v => !v)}
                          className="mt-1.5 w-full text-center text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
                        >
                          {showCommands ? "Show less" : `+${QUICK_COMMANDS.length - 5} more commands`}
                        </button>
                        <AnimatePresence>
                          {showCommands && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden space-y-1 mt-1">
                              {QUICK_COMMANDS.slice(5).map(({ icon: Icon, label, prompt }) => (
                                <motion.button key={label} whileHover={{ x: 2 }} onClick={() => sendMessage(prompt)} className="w-full flex items-center gap-2.5 rounded-xl border border-white/4 bg-white/2 p-2.5 text-left hover:border-primary/20 hover:bg-primary/5 transition-all group">
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/70 transition-colors shrink-0" />
                                  <span className="flex-1 text-[10px] font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">{label}</span>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                                </motion.button>
                              ))}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {msg.role === "assistant" && (
                          <div className="p-1.5 rounded-xl bg-primary/10 border border-primary/15 h-6 w-6 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                            <Bot className="h-3 w-3 text-primary" />
                          </div>
                        )}
                        <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                          msg.role === "user"
                            ? "bg-primary/15 border border-primary/20 text-foreground text-[11px] leading-relaxed"
                            : "bg-white/3 border border-white/6"
                        }`}>
                          {msg.role === "user" ? (
                            msg.content
                          ) : msg.content ? (
                            renderMessage(msg.content)
                          ) : (
                            <div className="flex items-center gap-1 py-0.5">
                              {[0, 1, 2].map((j) => (
                                <motion.span
                                  key={j}
                                  className="h-1.5 w-1.5 rounded-full bg-primary/50"
                                  animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                                  transition={{ duration: 0.9, repeat: Infinity, delay: j * 0.2 }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-white/5 p-3 shrink-0 bg-[#0a0a0a]">
                  {/* Suggestion chips when typing */}
                  <AnimatePresence>
                    {messages.length > 0 && !streaming && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-2 flex flex-wrap gap-1 overflow-hidden"
                      >
                        {QUICK_COMMANDS.slice(0, 3).map(({ label, prompt }) => (
                          <button
                            key={label}
                            onClick={() => sendMessage(prompt)}
                            className="flex items-center gap-1 rounded-full border border-white/6 bg-white/3 px-2.5 py-1 text-[9px] font-medium text-muted-foreground/50 hover:border-primary/20 hover:text-primary/70 transition-all"
                          >
                            <MessageSquare className="h-2.5 w-2.5" />
                            {label}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex items-end gap-2 rounded-xl border border-white/8 bg-white/2 px-3 py-2 focus-within:border-primary/25 transition-colors">
                    <textarea
                      ref={inputRef}
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Ask anything about your business..."
                      rows={1}
                      disabled={streaming}
                      className="flex-1 resize-none bg-transparent text-[11px] text-foreground placeholder:text-muted-foreground/25 focus:outline-none"
                      style={{ maxHeight: "80px" }}
                    />
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => sendMessage()}
                      disabled={!input.trim() || streaming}
                      className="p-1.5 rounded-lg bg-primary text-black disabled:opacity-30 hover:bg-primary/90 transition-all shrink-0"
                    >
                      <Send className="h-3 w-3" />
                    </motion.button>
                  </div>
                  <p className="text-[8px] text-muted-foreground/20 text-center mt-1.5">
                    Enter to send · Shift+Enter for new line
                  </p>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
