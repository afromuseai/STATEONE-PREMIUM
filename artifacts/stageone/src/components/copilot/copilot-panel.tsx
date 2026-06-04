import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useLocation } from "wouter"
import { useQuery } from "@tanstack/react-query"
import {
  Bot, X, Send, Sparkles, RotateCcw, Minimize2,
  Globe, Workflow, Brain, Rocket, BarChart3, TrendingUp,
  Zap, Target, ChevronRight, MessageSquare, Activity,
  CheckCircle2, Clock, Layers, FolderOpen, MapPin, ChevronDown,
} from "lucide-react"
import { useBusinessContext } from "@/lib/business-context"
import { useAuth } from "@/lib/auth-context"
import { api, type Project } from "@/lib/api"

interface Message {
  role: "user" | "assistant"
  content: string
  hidden?: boolean
}

interface WorkspaceContext {
  activePage: string
  activePagePath: string
  currentProject: {
    id: string
    title: string
    businessIdea: string
    hasBi: boolean
    hasWebsite: boolean
  } | null
  modules: {
    businessIntelligence: boolean
    website: boolean
    chatbot: boolean
    automation: boolean
  }
  projectCount: number
  activeAgents: number
}

const PAGE_NAMES: Record<string, string> = {
  "/": "Landing",
  "/dashboard": "Dashboard",
  "/agents": "Agent Store",
  "/webhooks": "Webhooks",
  "/automation-builder": "Automation Builder",
  "/chatbot-generator": "Chatbot Generator",
  "/website-generator": "Website Generator",
  "/deployments": "Deployments",
  "/memory": "AI Memory",
  "/settings": "Settings",
  "/templates": "Templates",
  "/analytics": "Analytics",
  "/developer": "Developer API",
  "/integrations": "Integrations",
  "/intelligence": "Intelligence",
  "/os": "OS Hub",
  "/orchestrator": "Orchestrator",
  "/agent-monitor": "Agent Monitor",
  "/execution-engine": "Execution Engine",
}

function getPageName(path: string): string {
  const clean = path.split("?")[0]
  if (PAGE_NAMES[clean]) return PAGE_NAMES[clean]
  if (clean.startsWith("/projects/")) return "Project"
  return "Workspace"
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

const MODULE_LABELS = [
  { key: "businessIntelligence", label: "Business Intelligence", icon: BarChart3 },
  { key: "website", label: "Website", icon: Globe },
  { key: "chatbot", label: "Chatbot", icon: MessageSquare },
  { key: "automation", label: "Automation", icon: Workflow },
] as const

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

function ThinkingIndicator() {
  const PHRASES = ["thinking", "on it", "hold on", "one sec", "let me think"]
  const [phrase] = useState(() => PHRASES[Math.floor(Math.random() * PHRASES.length)])
  return (
    <div className="flex items-center gap-1.5 py-0.5">
      <motion.span
        className="text-[11px] text-muted-foreground/50 italic"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      >
        {phrase}
      </motion.span>
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map((j) => (
          <motion.span
            key={j}
            className="h-1 w-1 rounded-full bg-primary/40"
            animate={{ opacity: [0.2, 0.9, 0.2], y: [0, -2, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: j * 0.18, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  )
}

async function streamCopilot(
  payload: { messages: Message[]; businessContext: unknown; workspaceContext: WorkspaceContext },
  signal: AbortSignal,
  onChunk: (buffer: string) => void
) {
  const res = await fetch("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
    signal,
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
          onChunk(buffer)
        }
      } catch { /* fragment */ }
    }
  }
}

interface InsightBubble {
  text: string
  id: number
}

export function CopilotPanel() {
  const { user, isLoading } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [showCommands, setShowCommands] = useState(false)
  const [showMemory, setShowMemory] = useState(false)
  const [bubble, setBubble] = useState<InsightBubble | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const greeted = useRef(false)
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevCrossSystemRef = useRef<typeof crossSystem | null>(null)
  const prevProjectCountRef = useRef<number | null>(null)
  const [location] = useLocation()
  const { businessData, crossSystem } = useBusinessContext()
  const hasBusinessContext = !!businessData?.industry

  const { data: projectsData } = useQuery({
    queryKey: ["copilot-projects"],
    queryFn: () => api.projects.list(),
    enabled: !!user && open,
    staleTime: 30_000,
  })

  const projects = projectsData?.projects ?? []
  const currentProject: Project | null = projects[0] ?? null

  const modules = {
    businessIntelligence: !!(currentProject?.output) || !!businessData?.industry,
    website: !!(currentProject?.websiteOutput) || crossSystem.websiteGenerated,
    chatbot: false,
    automation: crossSystem.automationsConfigured > 0,
  }

  const activePage = getPageName(location)

  const workspaceContext: WorkspaceContext = {
    activePage,
    activePagePath: location,
    currentProject: currentProject ? {
      id: currentProject.id,
      title: currentProject.title,
      businessIdea: currentProject.businessIdea.slice(0, 300),
      hasBi: !!currentProject.output,
      hasWebsite: !!currentProject.websiteOutput,
    } : null,
    modules,
    projectCount: projects.length,
    activeAgents: crossSystem.agentsInstalled,
  }

  const completedCount = Object.values(modules).filter(Boolean).length

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open, minimized])

  // ─── Greeting trigger ────────────────────────────────────────────────────────
  const workspaceContextRef = useRef(workspaceContext)
  workspaceContextRef.current = workspaceContext
  const businessDataRef = useRef(businessData)
  businessDataRef.current = businessData

  const triggerGreeting = useCallback(async () => {
    if (greeted.current) return
    greeted.current = true
    setStreaming(true)

    const greetingTrigger: Message = {
      role: "user",
      content: "Open the conversation. You already know this project. Reference what they're building and where things stand right now — be specific, be direct. Don't introduce yourself, don't say hello, don't use the platform name. Two sentences max, then ask one direct question.",
      hidden: true,
    }
    const assistantMsg: Message = { role: "assistant", content: "" }
    setMessages([greetingTrigger, assistantMsg])

    abortRef.current = new AbortController()

    try {
      await streamCopilot(
        {
          messages: [greetingTrigger],
          businessContext: businessDataRef.current,
          workspaceContext: workspaceContextRef.current,
        },
        abortRef.current.signal,
        (buffer) => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: buffer }
            return updated
          })
        }
      )
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages([{ role: "assistant", content: "What are you working on today?" }])
      } else if (!(e instanceof Error)) {
        setMessages([{ role: "assistant", content: "What are you working on today?" }])
      }
    } finally {
      setStreaming(false)
    }
  }, [])

  // Fire greeting when panel opens — wait for project data or fall back after 900ms
  useEffect(() => {
    if (!open || greeted.current) return

    if (projectsData !== undefined || businessData) {
      triggerGreeting()
      return
    }

    const timer = setTimeout(() => {
      if (!greeted.current) triggerGreeting()
    }, 900)

    return () => clearTimeout(timer)
  }, [open, projectsData, businessData, triggerGreeting])

  // ─── Send message ─────────────────────────────────────────────────────────────
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
      await streamCopilot(
        {
          messages: newMessages.filter(m => !m.hidden),
          businessContext: businessData,
          workspaceContext,
        },
        abortRef.current.signal,
        (buffer) => {
          setMessages(prev => {
            const updated = [...prev]
            updated[updated.length - 1] = { role: "assistant", content: buffer }
            return updated
          })
        }
      )
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
  }, [input, messages, streaming, businessData, workspaceContext])

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const clearChat = () => {
    if (streaming) abortRef.current?.abort()
    setMessages([])
    setStreaming(false)
    setShowCommands(false)
    greeted.current = false
  }

  // ─── Insight bubble ───────────────────────────────────────────────────────────
  const showBubble = (text: string) => {
    if (open) return
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current)
    setBubble({ text, id: Date.now() })
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 9000)
  }

  useEffect(() => {
    const prev = prevCrossSystemRef.current
    if (prev === null) {
      prevCrossSystemRef.current = crossSystem
      return
    }

    if (!prev.websiteGenerated && crossSystem.websiteGenerated) {
      showBubble("Website's ready. Worth reviewing the copy before you go live.")
    } else if (crossSystem.agentsInstalled > prev.agentsInstalled) {
      showBubble("New agent installed. Want to wire it into your workflow?")
    } else if (crossSystem.automationsConfigured > 0 && prev.automationsConfigured === 0) {
      showBubble("Automation's set up. Let's make sure the triggers are right.")
    }

    prevCrossSystemRef.current = crossSystem
  }, [crossSystem]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevProjectCountRef.current === null) {
      prevProjectCountRef.current = projects.length
      return
    }
    if (projects.length > prevProjectCountRef.current) {
      showBubble("New project created. I'll get up to speed.")
    }
    prevProjectCountRef.current = projects.length
  }, [projects.length]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && bubble) setBubble(null)
  }, [open, bubble])

  const visibleMessages = messages.filter(m => !m.hidden)

  if (isLoading || !user) return null

  return (
    <>
      {/* Insight bubble */}
      <AnimatePresence>
        {!open && bubble && (
          <motion.button
            key={bubble.id}
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ type: "spring", damping: 22, stiffness: 340 }}
            onClick={() => { setBubble(null); setOpen(true) }}
            className="fixed bottom-24 right-6 z-50 max-w-[220px] rounded-2xl border border-primary/25 bg-[#0e0d0b] px-3.5 py-2.5 text-left shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:border-primary/45 transition-all"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 p-1 rounded-lg bg-primary/15 shrink-0">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
              </div>
              <p className="text-[11px] leading-relaxed text-foreground/85">{bubble.text}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setBubble(null) }}
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="h-2.5 w-2.5 text-muted-foreground/60" />
            </button>
            {/* tail */}
            <div className="absolute -bottom-1.5 right-8 h-3 w-3 rotate-45 rounded-sm border-r border-b border-primary/25 bg-[#0e0d0b]" />
          </motion.button>
        )}
      </AnimatePresence>

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
            style={{ width: 300, maxHeight: minimized ? 52 : 480, transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)" }}
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
                    <p className="text-[9px] text-emerald-400/80">Online</p>
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
                <button
                  onClick={() => setShowMemory(m => !m)}
                  title="Workspace Memory"
                  className={`p-1.5 rounded-lg transition-all ${showMemory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
                {visibleMessages.length > 0 && (
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
                {/* Workspace Memory Panel */}
                <AnimatePresence>
                  {showMemory && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.22 }}
                      className="overflow-hidden shrink-0"
                    >
                      <div className="px-4 py-3 border-b border-white/5 bg-[#0b0b0b] space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-[8px] font-black text-muted-foreground/35 uppercase tracking-[0.18em]">Workspace Memory</p>
                          <span className="text-[8px] text-muted-foreground/30">{completedCount}/4 modules</span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded-xl border border-white/4 bg-white/2 p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="h-2.5 w-2.5 text-muted-foreground/40" />
                              <span className="text-[8px] text-muted-foreground/35 uppercase tracking-wider">Active Page</span>
                            </div>
                            <p className="text-[10px] font-semibold text-foreground truncate">{activePage}</p>
                          </div>
                          <div className="rounded-xl border border-white/4 bg-white/2 p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <FolderOpen className="h-2.5 w-2.5 text-muted-foreground/40" />
                              <span className="text-[8px] text-muted-foreground/35 uppercase tracking-wider">Project</span>
                            </div>
                            <p className="text-[10px] font-semibold text-foreground truncate">
                              {currentProject?.title ?? "None"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {MODULE_LABELS.map(({ key, label, icon: Icon }) => {
                            const done = modules[key]
                            return (
                              <div key={key} className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                  <Icon className="h-2.5 w-2.5 text-muted-foreground/30" />
                                  <span className="text-[10px] text-muted-foreground/60">{label}</span>
                                </div>
                                {done ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                    <span className="text-[9px] text-emerald-400/80 font-medium">Complete</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground/30" />
                                    <span className="text-[9px] text-muted-foreground/40">Pending</span>
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ minHeight: 0 }}>
                  {visibleMessages.length === 0 ? (
                    /* Loading state while greeting streams in */
                    streaming ? (
                      <div className="flex justify-start pt-2">
                        <div className="p-1.5 rounded-xl bg-primary/10 border border-primary/15 h-6 w-6 flex items-center justify-center shrink-0 mt-0.5 mr-2">
                          <Bot className="h-3 w-3 text-primary" />
                        </div>
                        <div className="max-w-[88%] rounded-2xl px-3.5 py-2.5 bg-white/3 border border-white/6">
                          <ThinkingIndicator />
                        </div>
                      </div>
                    ) : (
                      /* Fallback empty state — only shown if greeting fails entirely */
                      <div className="space-y-4">
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
                            Ask me anything about your business.
                          </p>
                        </div>

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
                            className="mt-1.5 w-full text-center text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex items-center justify-center gap-1"
                          >
                            <ChevronDown className={`h-3 w-3 transition-transform ${showCommands ? "rotate-180" : ""}`} />
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
                    )
                  ) : (
                    visibleMessages.map((msg, i) => (
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
                            <ThinkingIndicator />
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className="border-t border-white/5 p-3 shrink-0 bg-[#0a0a0a]">
                  <AnimatePresence>
                    {visibleMessages.length > 0 && !streaming && (
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
