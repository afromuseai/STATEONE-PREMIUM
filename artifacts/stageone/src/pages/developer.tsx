import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { Link } from "wouter"
import {
  Key, Plus, Trash2, Copy, Check, Eye, EyeOff, Code2, Zap, Globe, Bot, Workflow,
  Rocket, ChevronRight, Terminal, BookOpen, Activity, Shield, AlertCircle,
  BarChart3, Clock, ArrowLeft, ExternalLink, ChevronDown,
} from "lucide-react"
import { useAuth } from "@/lib/auth-context"

const BASE_URL = "/api"

type Plan = "free" | "pro" | "enterprise"

interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  plan: Plan
  requestsPerMonth: number
  requestsUsed: number
  requestsPerMinute: number
  isActive: boolean
  lastUsedAt: string | null
  createdAt: string
}

interface UsageLog {
  id: string
  endpoint: string
  method: string
  statusCode: number
  responseTimeMs: number | null
  createdAt: string
}

const PLAN_LIMITS: Record<Plan, { monthly: number; perMin: number; color: string }> = {
  free:       { monthly: 100,   perMin: 10,  color: "text-muted-foreground" },
  pro:        { monthly: 2000,  perMin: 60,  color: "text-blue-400" },
  enterprise: { monthly: 50000, perMin: 200, color: "text-primary" },
}

const ENDPOINTS = [
  {
    method: "POST",
    path: "/api/v1/analyze-business",
    name: "Business Intelligence",
    icon: BarChart3,
    description: "Returns structured business analysis, growth strategy, and market positioning.",
    body: { businessIdea: "A B2B SaaS platform for construction project management", industry: "SaaS" },
    response: {
      success: true,
      data: {
        industry: "SaaS",
        metrics: { marketDifficulty: 7, automationPotential: 85, revenueScalability: 9 },
        businessSnapshot: "Project management SaaS for construction firms, monetized via seat-based subscriptions.",
        growthPlan: ["Phase 1: Target GCs via LinkedIn outbound → 50 paid seats", "Phase 2: ..."],
      },
      responseTimeMs: 2840,
    },
  },
  {
    method: "POST",
    path: "/api/v1/generate-website",
    name: "Website Generation",
    icon: Globe,
    description: "Returns website structure, UI sections, color palette, typography, and SEO metadata.",
    body: { businessIdea: "AI-powered resume builder for tech professionals", style: "SaaS", tone: "Professional" },
    response: {
      success: true,
      data: {
        brand: { name: "ResumeAI", tagline: "Land your dream job faster" },
        colorPalette: { primary: "#6366f1", background: "#0a0a0a" },
        sections: { hero: { headline: "Build Resumes That Get Interviews", ctaPrimary: "Start Free" } },
        seoMeta: { title: "ResumeAI — AI Resume Builder for Tech Professionals" },
      },
      responseTimeMs: 4120,
    },
  },
  {
    method: "POST",
    path: "/api/v1/generate-chatbot",
    name: "Chatbot Generation",
    icon: Bot,
    description: "Returns chatbot identity, system prompt, conversation flows, and integration config.",
    body: { businessDescription: "SaaS helpdesk software for SMBs", chatbotType: "Customer Support", tone: "Friendly", industry: "SaaS" },
    response: {
      success: true,
      data: {
        identity: { name: "HelpBot", role: "Customer support specialist", greeting: "Hi! I'm HelpBot, here to help." },
        systemPrompt: { main: "You are HelpBot, a friendly support agent for..." },
        kpis: { deflectionRate: "65-75%", satisfactionScore: "CSAT > 4.2/5" },
      },
      responseTimeMs: 5300,
    },
  },
  {
    method: "POST",
    path: "/api/v1/generate-workflow",
    name: "Automation Workflow",
    icon: Workflow,
    description: "Returns workflow nodes, triggers, edges, integrations, and AI agent configuration.",
    body: { businessDescription: "E-commerce fashion brand", workflowType: "Lead Capture", complexity: "Intermediate" },
    response: {
      success: true,
      data: {
        overview: { purpose: "Capture leads and enroll in nurture sequence", complexityScore: 6 },
        nodes: [{ id: "n1", type: "trigger", label: "Form Submitted", tool: "Typeform" }],
        integrations: [{ name: "HubSpot", category: "CRM", tier: "required" }],
      },
      responseTimeMs: 3750,
    },
  },
  {
    method: "POST",
    path: "/api/v1/deploy",
    name: "Deployment",
    icon: Rocket,
    description: "Triggers deployment of a website, chatbot, or workflow to the STAGEONE infrastructure.",
    body: { name: "My SaaS Website", type: "website", environment: "production" },
    response: {
      success: true,
      deployment: {
        id: "dep_abc123",
        name: "My SaaS Website",
        type: "website",
        status: "deploying",
        url: "https://my-saas-website.stageone.app",
        estimatedReadyIn: "30-60 seconds",
      },
      responseTimeMs: 42,
    },
  },
]

const SDK_EXAMPLE = `import { StageoneClient } from "@stageone/sdk";

const client = new StageoneClient({
  apiKey: "sk-stg-your-api-key-here",
});

// Analyze a business
const analysis = await client.analyzeBusiness({
  businessIdea: "A SaaS platform for construction management",
});

// Generate a website
const website = await client.generateWebsite({
  businessIdea: "AI-powered resume builder",
  style: "SaaS",
  tone: "Professional",
});

// Generate a chatbot
const chatbot = await client.generateChatbot({
  businessDescription: "SaaS helpdesk for SMBs",
  chatbotType: "Customer Support",
});

// Build an automation workflow
const workflow = await client.generateWorkflow({
  businessDescription: "E-commerce fashion brand",
  workflowType: "Lead Capture",
});

// Deploy
const deployment = await client.deploy({
  name: "My Website",
  type: "website",
});
`

const CURL_EXAMPLE = (apiKey: string, endpoint: typeof ENDPOINTS[0]) => `curl -X POST https://stageone.app${endpoint.path} \\
  -H "Authorization: Bearer ${apiKey}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(endpoint.body, null, 2)}'`

type Tab = "docs" | "keys" | "tester" | "sdk"

export default function DeveloperPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>("docs")
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [logs, setLogs] = useState<UsageLog[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyPlan, setNewKeyPlan] = useState<Plan>("free")
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedEndpoint, setSelectedEndpoint] = useState(0)
  const [testerBody, setTesterBody] = useState(JSON.stringify(ENDPOINTS[0].body, null, 2))
  const [testerApiKey, setTesterApiKey] = useState("")
  const [testerResult, setTesterResult] = useState<unknown>(null)
  const [testerLoading, setTesterLoading] = useState(false)
  const [expandedEndpoint, setExpandedEndpoint] = useState<number | null>(null)

  useEffect(() => {
    if (tab === "keys" && user) fetchKeys()
    if (tab === "keys" && user) fetchLogs()
  }, [tab, user])

  useEffect(() => {
    setTesterBody(JSON.stringify(ENDPOINTS[selectedEndpoint].body, null, 2))
    setTesterResult(null)
  }, [selectedEndpoint])

  async function fetchKeys() {
    setLoading(true)
    try {
      const r = await fetch(`${BASE_URL}/developer/keys`, { credentials: "include" })
      const data = await r.json()
      setKeys(data.keys ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function fetchLogs() {
    try {
      const r = await fetch(`${BASE_URL}/developer/usage`, { credentials: "include" })
      const data = await r.json()
      setLogs(data.logs ?? [])
    } catch { /* non-fatal */ }
  }

  async function createKey() {
    if (!newKeyName.trim()) return
    setCreating(true)
    try {
      const r = await fetch(`${BASE_URL}/developer/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newKeyName, plan: newKeyPlan }),
      })
      const data = await r.json()
      if (data.rawKey) {
        setRevealedKey(data.rawKey)
        setKeys(prev => [data.key, ...prev])
        setNewKeyName("")
        setShowCreateForm(false)
      }
    } finally {
      setCreating(false)
    }
  }

  async function revokeKey(id: string) {
    await fetch(`${BASE_URL}/developer/keys/${id}`, { method: "DELETE", credentials: "include" })
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  async function runTesterRequest() {
    const endpoint = ENDPOINTS[selectedEndpoint]
    if (!testerApiKey.trim()) return
    setTesterLoading(true)
    setTesterResult(null)
    try {
      let body: unknown
      try { body = JSON.parse(testerBody) } catch { body = {} }
      const r = await fetch(endpoint.path, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${testerApiKey}` },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      setTesterResult({ status: r.status, data })
    } catch (err) {
      setTesterResult({ error: String(err) })
    } finally {
      setTesterLoading(false)
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: "docs", label: "Documentation", icon: BookOpen },
    { id: "keys", label: "API Keys", icon: Key },
    { id: "tester", label: "API Tester", icon: Terminal },
    { id: "sdk", label: "SDK & Examples", icon: Code2 },
  ]

  return (
    <div className="min-h-screen bg-[#050505] text-foreground">
      {/* Header */}
      <div className="border-b border-white/5 bg-[#080808]">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-primary" />
                <h1 className="text-lg font-black tracking-tight">Developer API</h1>
                <span className="text-[10px] font-bold uppercase tracking-widest bg-primary/20 text-primary border border-primary/25 px-2 py-0.5 rounded-full">BETA</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Build on STAGEONE's AI infrastructure</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-lg px-3 py-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              API Online
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                  tab === id
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* DOCS TAB */}
        {tab === "docs" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar nav */}
            <div className="lg:col-span-1">
              <div className="sticky top-6 space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-2 mb-3">API Reference</p>
                {ENDPOINTS.map((ep, i) => (
                  <button
                    key={i}
                    onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
                    className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      expandedEndpoint === i ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-white/4"
                    }`}
                  >
                    <ep.icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{ep.name}</span>
                    <ChevronRight className={`h-3 w-3 ml-auto shrink-0 transition-transform ${expandedEndpoint === i ? "rotate-90" : ""}`} />
                  </button>
                ))}
                <div className="border-t border-white/5 pt-3 mt-3">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-2 mb-2">Reference</p>
                  {["Authentication", "Rate Limiting", "Error Codes"].map(label => (
                    <button key={label} className="w-full text-left px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-white/4 transition-colors">
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Main docs */}
            <div className="lg:col-span-3 space-y-8">
              {/* Overview */}
              <div>
                <h2 className="text-2xl font-black tracking-tight mb-2">STAGEONE API Platform</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Build on STAGEONE's AI infrastructure to generate business intelligence, websites, chatbots, and automation workflows programmatically.
                  All endpoints return structured JSON and are secured with API key authentication.
                </p>
                <div className="mt-4 bg-[#0d0d0d] border border-white/8 rounded-xl p-4">
                  <p className="text-xs font-mono text-muted-foreground">Base URL</p>
                  <p className="text-sm font-mono text-foreground mt-1">https://stageone.app/api/v1</p>
                </div>
              </div>

              {/* Auth */}
              <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-primary" />
                  <h3 className="font-bold text-sm">Authentication</h3>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  All API requests require an API key passed as a Bearer token in the Authorization header.
                </p>
                <div className="bg-black/50 rounded-lg p-3 font-mono text-xs text-emerald-400">
                  Authorization: Bearer sk-stg-your-api-key
                </div>
              </div>

              {/* Rate Limits */}
              <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-bold text-sm">Rate Limits & Plans</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/8">
                        <th className="text-left py-2 text-muted-foreground font-medium">Plan</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Requests/Month</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Rate Limit</th>
                        <th className="text-left py-2 text-muted-foreground font-medium">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/4">
                      {[
                        { plan: "Free", monthly: "100", rate: "10 req/min", price: "$0/mo" },
                        { plan: "Pro", monthly: "2,000", rate: "60 req/min", price: "$49/mo" },
                        { plan: "Enterprise", monthly: "50,000", rate: "200 req/min", price: "Custom" },
                      ].map(row => (
                        <tr key={row.plan}>
                          <td className="py-2.5 font-medium">{row.plan}</td>
                          <td className="py-2.5 text-muted-foreground">{row.monthly}</td>
                          <td className="py-2.5 text-muted-foreground">{row.rate}</td>
                          <td className="py-2.5 text-muted-foreground">{row.price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Endpoints */}
              <div className="space-y-4">
                <h3 className="font-black text-lg tracking-tight">Endpoints</h3>
                {ENDPOINTS.map((ep, i) => (
                  <motion.div
                    key={i}
                    className="bg-[#0d0d0d] border border-white/8 rounded-xl overflow-hidden"
                    initial={false}
                  >
                    <button
                      onClick={() => setExpandedEndpoint(expandedEndpoint === i ? null : i)}
                      className="w-full flex items-center gap-3 p-5 text-left hover:bg-white/2 transition-colors"
                    >
                      <span className="text-[10px] font-black bg-primary/20 text-primary border border-primary/25 px-2 py-1 rounded font-mono">{ep.method}</span>
                      <span className="font-mono text-sm text-foreground">{ep.path}</span>
                      <span className="ml-auto text-xs text-muted-foreground flex items-center gap-1">
                        {ep.name}
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expandedEndpoint === i ? "rotate-180" : ""}`} />
                      </span>
                    </button>

                    {expandedEndpoint === i && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="border-t border-white/8 p-5 space-y-4"
                      >
                        <p className="text-sm text-muted-foreground">{ep.description}</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-muted-foreground">Request Body</p>
                              <button
                                onClick={() => copyText(JSON.stringify(ep.body, null, 2), `req-${i}`)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                {copiedId === `req-${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                Copy
                              </button>
                            </div>
                            <pre className="bg-black/50 rounded-lg p-3 text-xs font-mono text-emerald-400 overflow-x-auto">
                              {JSON.stringify(ep.body, null, 2)}
                            </pre>
                          </div>
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-semibold text-muted-foreground">Example Response</p>
                              <button
                                onClick={() => copyText(JSON.stringify(ep.response, null, 2), `res-${i}`)}
                                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                {copiedId === `res-${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                                Copy
                              </button>
                            </div>
                            <pre className="bg-black/50 rounded-lg p-3 text-xs font-mono text-blue-400 overflow-x-auto">
                              {JSON.stringify(ep.response, null, 2)}
                            </pre>
                          </div>
                        </div>

                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-2">cURL Example</p>
                          <div className="relative bg-black/50 rounded-lg p-3">
                            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                              {CURL_EXAMPLE("sk-stg-your-key", ep)}
                            </pre>
                            <button
                              onClick={() => copyText(CURL_EXAMPLE("sk-stg-your-key", ep), `curl-${i}`)}
                              className="absolute top-2 right-2 p-1.5 rounded text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
                            >
                              {copiedId === `curl-${i}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => { setSelectedEndpoint(i); setTab("tester") }}
                          className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 font-semibold transition-colors"
                        >
                          <Terminal className="h-3.5 w-3.5" />
                          Try this endpoint in the API Tester
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>

              {/* Error codes */}
              <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  <h3 className="font-bold text-sm">Error Codes</h3>
                </div>
                <div className="space-y-2 text-xs">
                  {[
                    { code: "401", msg: "Unauthorized", desc: "Missing or invalid API key" },
                    { code: "400", msg: "Bad Request", desc: "Missing required fields in the request body" },
                    { code: "429", msg: "Too Many Requests", desc: "Rate limit or monthly quota exceeded" },
                    { code: "500", msg: "Internal Server Error", desc: "AI generation failed — retry with backoff" },
                  ].map(({ code, msg, desc }) => (
                    <div key={code} className="flex items-start gap-3 py-2 border-b border-white/4 last:border-0">
                      <span className="font-mono text-red-400 w-8 shrink-0">{code}</span>
                      <span className="font-medium w-28 shrink-0">{msg}</span>
                      <span className="text-muted-foreground">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API KEYS TAB */}
        {tab === "keys" && (
          <div className="space-y-6 max-w-3xl">
            {/* Revealed key banner */}
            {revealedKey && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-500/10 border border-emerald-500/25 rounded-xl p-5"
              >
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-emerald-400">API Key Created — Save it now!</p>
                    <p className="text-xs text-muted-foreground mt-1 mb-3">This is the only time you'll see the full key. Copy and store it securely.</p>
                    <div className="flex items-center gap-2 bg-black/50 rounded-lg px-3 py-2">
                      <code className="text-xs font-mono text-emerald-400 flex-1 truncate">{revealedKey}</code>
                      <button onClick={() => copyText(revealedKey, "revealed")}>
                        {copiedId === "revealed" ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
                      </button>
                    </div>
                  </div>
                  <button onClick={() => setRevealedKey(null)} className="text-muted-foreground hover:text-foreground text-xs">Dismiss</button>
                </div>
              </motion.div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight">API Keys</h2>
                <p className="text-xs text-muted-foreground mt-1">Manage your developer API keys. Keep them secret.</p>
              </div>
              {!showCreateForm && (
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center gap-2 bg-primary text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create Key
                </button>
              )}
            </div>

            {/* Create form */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#0d0d0d] border border-white/8 rounded-xl p-5 space-y-4"
              >
                <h3 className="text-sm font-bold">New API Key</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Key Name</label>
                    <input
                      value={newKeyName}
                      onChange={e => setNewKeyName(e.target.value)}
                      placeholder="e.g. Production App"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Plan</label>
                    <select
                      value={newKeyPlan}
                      onChange={e => setNewKeyPlan(e.target.value as Plan)}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                    >
                      <option value="free">Free — 100 req/mo</option>
                      <option value="pro">Pro — 2,000 req/mo</option>
                      <option value="enterprise">Enterprise — 50,000 req/mo</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={createKey}
                    disabled={creating || !newKeyName.trim()}
                    className="flex-1 bg-primary text-black text-xs font-bold py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {creating ? "Creating..." : "Create API Key"}
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 text-xs text-muted-foreground hover:text-foreground border border-white/10 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            )}

            {/* Keys list */}
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-24 bg-[#0d0d0d] border border-white/8 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-16 bg-[#0d0d0d] border border-white/8 rounded-xl">
                <Key className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No API keys yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Create your first key to start building</p>
                <button
                  onClick={() => setShowCreateForm(true)}
                  className="mt-4 flex items-center gap-2 mx-auto bg-primary text-black text-xs font-bold px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create API Key
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {keys.map(key => {
                  const pct = Math.min((key.requestsUsed / key.requestsPerMonth) * 100, 100)
                  const limits = PLAN_LIMITS[key.plan as Plan] ?? PLAN_LIMITS.free
                  return (
                    <div key={key.id} className="bg-[#0d0d0d] border border-white/8 rounded-xl p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold">{key.name}</h4>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                              key.plan === "enterprise" ? "bg-primary/20 text-primary border-primary/25" :
                              key.plan === "pro" ? "bg-blue-500/20 text-blue-400 border-blue-500/25" :
                              "bg-white/5 text-muted-foreground border-white/10"
                            }`}>{key.plan}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <code className="text-xs font-mono text-muted-foreground">{key.keyPrefix}••••••••••••••••••••</code>
                            <button
                              onClick={() => copyText(key.keyPrefix, `prefix-${key.id}`)}
                              className="text-muted-foreground hover:text-foreground transition-colors"
                            >
                              {copiedId === `prefix-${key.id}` ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                            </button>
                          </div>
                        </div>
                        <button
                          onClick={() => revokeKey(key.id)}
                          className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Revoke key"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{key.requestsUsed.toLocaleString()} / {key.requestsPerMonth.toLocaleString()} requests used</span>
                          <span>{Math.round(pct)}%</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${pct > 90 ? "bg-red-500" : pct > 70 ? "bg-yellow-500" : "bg-primary"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{limits.perMin} req/min</span>
                        {key.lastUsedAt && (
                          <span>Last used: {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                        )}
                        <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Usage logs */}
            {logs.length > 0 && (
              <div className="mt-8">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Recent API Activity
                </h3>
                <div className="bg-[#0d0d0d] border border-white/8 rounded-xl overflow-hidden">
                  <div className="divide-y divide-white/4">
                    {logs.slice(0, 10).map(log => (
                      <div key={log.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                        <span className={`w-10 shrink-0 font-mono font-bold ${log.statusCode < 300 ? "text-emerald-400" : "text-red-400"}`}>
                          {log.statusCode}
                        </span>
                        <span className="font-mono text-muted-foreground flex-1 truncate">{log.endpoint}</span>
                        {log.responseTimeMs && (
                          <span className="text-muted-foreground shrink-0">{log.responseTimeMs}ms</span>
                        )}
                        <span className="text-muted-foreground/50 shrink-0">{new Date(log.createdAt).toLocaleTimeString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* API TESTER TAB */}
        {tab === "tester" && (
          <div className="max-w-5xl space-y-6">
            <div>
              <h2 className="text-xl font-black tracking-tight mb-1">Interactive API Tester</h2>
              <p className="text-xs text-muted-foreground">Test all endpoints directly from the browser using your API key.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
              {/* Endpoint selector */}
              <div className="lg:col-span-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Select Endpoint</p>
                {ENDPOINTS.map((ep, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedEndpoint(i)}
                    className={`w-full text-left flex items-center gap-2.5 px-3 py-3 rounded-xl border text-xs font-medium transition-all ${
                      selectedEndpoint === i
                        ? "bg-primary/10 border-primary/25 text-primary"
                        : "bg-[#0d0d0d] border-white/8 text-muted-foreground hover:text-foreground hover:border-white/15"
                    }`}
                  >
                    <ep.icon className="h-4 w-4 shrink-0" />
                    <div>
                      <div className="font-semibold">{ep.name}</div>
                      <div className="text-[10px] font-mono opacity-60 mt-0.5">{ep.path}</div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Request builder */}
              <div className="lg:col-span-3 space-y-4">
                <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-5 space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-primary/20 text-primary border border-primary/25 px-2 py-1 rounded font-mono">POST</span>
                    <span className="font-mono text-sm text-foreground truncate">{ENDPOINTS[selectedEndpoint].path}</span>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">API Key</label>
                    <input
                      type="password"
                      value={testerApiKey}
                      onChange={e => setTesterApiKey(e.target.value)}
                      placeholder="sk-stg-your-api-key"
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary/50 placeholder:text-muted-foreground/30"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1.5">Request Body (JSON)</label>
                    <textarea
                      value={testerBody}
                      onChange={e => setTesterBody(e.target.value)}
                      rows={8}
                      className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/50 resize-none"
                    />
                  </div>

                  <button
                    onClick={runTesterRequest}
                    disabled={testerLoading || !testerApiKey.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-black text-sm font-bold py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {testerLoading ? (
                      <>
                        <div className="h-4 w-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        Send Request
                      </>
                    )}
                  </button>
                </div>

                {!!testerResult && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0d0d0d] border border-white/8 rounded-xl p-5"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-semibold">Response</p>
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${
                          (testerResult as { status?: number }).status && (testerResult as { status: number }).status < 300
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {(testerResult as { status?: number }).status ?? "Error"}
                        </span>
                      </div>
                      <button
                        onClick={() => copyText(JSON.stringify(testerResult, null, 2), "tester-result")}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                      >
                        {copiedId === "tester-result" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                        Copy
                      </button>
                    </div>
                    <pre className="text-xs font-mono text-blue-400 overflow-x-auto max-h-96 overflow-y-auto">
                      {JSON.stringify((testerResult as { data?: unknown }).data ?? testerResult, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* SDK TAB */}
        {tab === "sdk" && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-xl font-black tracking-tight mb-1">SDK & Examples</h2>
              <p className="text-xs text-muted-foreground">Quick-start examples in JavaScript/TypeScript.</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/25 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground">
                The official <code className="text-amber-400 font-mono">@stageone/sdk</code> npm package is coming soon.
                In the meantime, use the REST API directly with the examples below.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-[#0d0d0d] border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4 text-primary" />
                    <span className="text-sm font-bold">TypeScript SDK Preview</span>
                  </div>
                  <button
                    onClick={() => copyText(SDK_EXAMPLE, "sdk")}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedId === "sdk" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <pre className="p-5 text-xs font-mono text-emerald-400 overflow-x-auto">
                  {SDK_EXAMPLE}
                </pre>
              </div>

              <div className="bg-[#0d0d0d] border border-white/8 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/8">
                  <span className="text-sm font-bold">Vanilla Fetch Example</span>
                  <button
                    onClick={() => copyText(CURL_EXAMPLE("sk-stg-your-key", ENDPOINTS[0]), "fetch-example")}
                    className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copiedId === "fetch-example" ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                    Copy
                  </button>
                </div>
                <pre className="p-5 text-xs font-mono text-blue-400 overflow-x-auto">{`const response = await fetch("https://stageone.app/api/v1/analyze-business", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk-stg-your-api-key",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    businessIdea: "A SaaS platform for construction project management",
  }),
});

const { data } = await response.json();
console.log(data.industry);       // "SaaS"
console.log(data.growthPlan);     // [...phases]
console.log(data.recommendedStack);`}
                </pre>
              </div>

              {/* Quick start steps */}
              <div className="bg-[#0d0d0d] border border-white/8 rounded-xl p-6">
                <h3 className="font-bold text-sm mb-4">Quick Start</h3>
                <div className="space-y-4">
                  {[
                    { n: "1", title: "Create an API Key", desc: "Go to the API Keys tab and create your first key.", action: () => setTab("keys") },
                    { n: "2", title: "Make your first request", desc: "Use the API Tester or copy a cURL example to test an endpoint.", action: () => setTab("tester") },
                    { n: "3", title: "Track your usage", desc: "Monitor requests, view logs, and upgrade your plan as needed.", action: () => setTab("keys") },
                  ].map(({ n, title, desc, action }) => (
                    <button key={n} onClick={action} className="w-full text-left flex items-start gap-4 p-4 rounded-xl border border-white/8 hover:border-primary/25 hover:bg-primary/5 transition-all group">
                      <div className="h-7 w-7 rounded-full bg-primary/20 border border-primary/25 flex items-center justify-center shrink-0 text-xs font-black text-primary">{n}</div>
                      <div>
                        <p className="text-sm font-semibold group-hover:text-primary transition-colors">{title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary ml-auto shrink-0 mt-0.5 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
