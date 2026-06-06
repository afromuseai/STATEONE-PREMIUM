// ─── Project Context (carries projectId into generator pages) ────────────────
// Stored separately from GenerationContext so it survives independent of BI data.

export interface ProjectContext {
  projectId: string
  projectTitle: string
  originatingBusinessIntelligenceId: string
}

const PROJECT_KEY = "stageone_project_ctx"

export function saveProjectContext(ctx: ProjectContext): void {
  try { sessionStorage.setItem(PROJECT_KEY, JSON.stringify(ctx)) } catch { /* ignore */ }
}

export function loadProjectContext(): ProjectContext | null {
  try {
    const raw = sessionStorage.getItem(PROJECT_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ProjectContext
  } catch { return null }
}

export function clearProjectContext(): void {
  try { sessionStorage.removeItem(PROJECT_KEY) } catch { /* ignore */ }
}

// ─── Cross-Generator Context Passing ─────────────────────────────────────────
// Stores business intelligence in sessionStorage so generator pages can
// auto-fill and immediately trigger generation without re-entry.

export interface GenerationContext {
  idea: string
  industry: string
  businessSnapshot: string
  targetMarket: string
  chatbotRole: string
  automations: string[]
  growthPlan: string[]
  strategicInsights: {
    growthBottleneck: string
    fastestChannel: string
    highestLeverageAutomation: string
    operationalRisk: string
  }
  recommendedStack: {
    frontend: string[]
    backend: string[]
    automation: string[]
    crm: string
    payments: string
  }
  competitiveAdvantage: {
    differentiation: string
    defensibility: string
    scalabilityEdge: string
  }
}

const KEY = "stageone_gen_context"

export function saveGenerationContext(ctx: GenerationContext): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(ctx))
  } catch { /* ignore */ }
}

export function loadGenerationContext(): GenerationContext | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as GenerationContext
  } catch {
    return null
  }
}

export function clearGenerationContext(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch { /* ignore */ }
}

// ─── Asset Restore Context ────────────────────────────────────────────────────
// Carries a previously-generated and persisted asset back into the generator
// page so the full experience is immediately restorable without re-generation.
// Keys start with "stageone_" so they are swept by clearWorkspaceSessionData.

const CHATBOT_RESTORE_KEY = "stageone_chatbot_restore"

export function saveChatbotRestoreContext(output: unknown): void {
  try { sessionStorage.setItem(CHATBOT_RESTORE_KEY, JSON.stringify(output)) } catch { /* ignore */ }
}

export function loadChatbotRestoreContext(): unknown | null {
  try {
    const raw = sessionStorage.getItem(CHATBOT_RESTORE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function clearChatbotRestoreContext(): void {
  try { sessionStorage.removeItem(CHATBOT_RESTORE_KEY) } catch { /* ignore */ }
}

const AUTOMATION_RESTORE_KEY = "stageone_automation_restore"

export function saveAutomationRestoreContext(output: unknown): void {
  try { sessionStorage.setItem(AUTOMATION_RESTORE_KEY, JSON.stringify(output)) } catch { /* ignore */ }
}

export function loadAutomationRestoreContext(): unknown | null {
  try {
    const raw = sessionStorage.getItem(AUTOMATION_RESTORE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function clearAutomationRestoreContext(): void {
  try { sessionStorage.removeItem(AUTOMATION_RESTORE_KEY) } catch { /* ignore */ }
}

// ─── Dashboard State Persistence ─────────────────────────────────────────────
// Persists generation results across sidebar navigation so users never lose
// their workspace context by switching tabs. Only cleared on explicit new
// generation or "New Analysis" action.

const DASHBOARD_KEY = "stageone_dashboard_state"

export interface DashboardPersistedState {
  results: import("@/components/dashboard/output-panel").BusinessIntelligence
  currentIdea: string
  activeProjectId: string | null
  generationStage: number
}

export function saveDashboardState(state: DashboardPersistedState): void {
  try {
    sessionStorage.setItem(DASHBOARD_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

export function loadDashboardState(): DashboardPersistedState | null {
  try {
    const raw = sessionStorage.getItem(DASHBOARD_KEY)
    if (!raw) return null
    return JSON.parse(raw) as DashboardPersistedState
  } catch {
    return null
  }
}

export function clearDashboardState(): void {
  try {
    sessionStorage.removeItem(DASHBOARD_KEY)
  } catch { /* ignore */ }
}

// ─── Marcus Website Generate Intent ───────────────────────────────────────────
// Persists the generate intent across navigation so it survives the race
// condition where the generate signal is emitted before the page mounts.
// Pattern mirrors setMarcusWorkspaceSignal / consumeMarcusWorkspaceSignal.

const MARCUS_WEBSITE_GENERATE_KEY = "marcus_website_generate_intent"

export function setMarcusWebsiteGenerateIntent(): void {
  try { sessionStorage.setItem(MARCUS_WEBSITE_GENERATE_KEY, JSON.stringify({ timestamp: Date.now() })) } catch { /* ignore */ }
}

export function consumeMarcusWebsiteGenerateIntent(): boolean {
  try {
    const raw = sessionStorage.getItem(MARCUS_WEBSITE_GENERATE_KEY)
    if (!raw) return false
    sessionStorage.removeItem(MARCUS_WEBSITE_GENERATE_KEY)
    const stored = JSON.parse(raw) as { timestamp: number }
    if (Date.now() - stored.timestamp > 30_000) return false
    return true
  } catch { return false }
}

// ─── Workspace session isolation ──────────────────────────────────────────────
// Call this on every login, signup, and logout to prevent one user's
// sessionStorage data from leaking into a different user's session.
// Wipes every key that belongs to STAGEONE — copilot messages are already
// user-scoped (copilot:msgs:<userId>) so they survive this sweep safely.
export function clearWorkspaceSessionData(): void {
  try {
    const STAGEONE_KEYS = [KEY, DASHBOARD_KEY, AUTORUN_KEY, PROJECT_KEY, MARCUS_WEBSITE_GENERATE_KEY]
    for (const k of STAGEONE_KEYS) sessionStorage.removeItem(k)
    // Also sweep any dynamically created keys with the stageone_ prefix
    const allKeys = Object.keys(sessionStorage)
    for (const k of allKeys) {
      if (k.startsWith("stageone_")) sessionStorage.removeItem(k)
    }
  } catch { /* ignore */ }
}

// ─── Copilot Autorun ──────────────────────────────────────────────────────────
// Written by the Copilot before navigating. Target pages read this on mount
// and auto-execute the requested action without user interaction.

export interface CopilotAutorun {
  action: string        // matches ACTION_ROUTES key e.g. "generate_intelligence"
  idea?: string         // business idea text if available
  timestamp: number
}

const AUTORUN_KEY = "copilot_autorun"

export function setCopilotAutorun(run: CopilotAutorun): void {
  try {
    sessionStorage.setItem(AUTORUN_KEY, JSON.stringify(run))
  } catch { /* ignore */ }
}

export function consumeCopilotAutorun(): CopilotAutorun | null {
  try {
    const raw = sessionStorage.getItem(AUTORUN_KEY)
    if (!raw) return null
    sessionStorage.removeItem(AUTORUN_KEY)
    const run = JSON.parse(raw) as CopilotAutorun
    // Expire after 30 seconds to avoid stale triggers on back-navigation
    if (Date.now() - run.timestamp > 30_000) return null
    return run
  } catch {
    return null
  }
}

// ─── Marcus Workspace Signal ──────────────────────────────────────────────────
// Unified signal for all Marcus execution commands across all generator pages.
// Live signals (post-mount) go through WorkspaceControllerContext.emitWorkspaceSignal.
// Cross-navigation delivery uses sessionStorage (setMarcusWorkspaceSignal).
// Each page filters by signal.target to handle only its own signals.

export interface MarcusWorkspaceSignal {
  target: "intelligence" | "website" | "chatbot" | "automation"
  type: "navigate" | "populate" | "generate" | "clear"
  payload?: string
}

const MARCUS_WORKSPACE_KEY = "marcus_workspace_signal"

export function setMarcusWorkspaceSignal(signal: MarcusWorkspaceSignal): void {
  try { sessionStorage.setItem(MARCUS_WORKSPACE_KEY, JSON.stringify({ ...signal, timestamp: Date.now() })) } catch { /* ignore */ }
}

export function consumeMarcusWorkspaceSignal(): MarcusWorkspaceSignal | null {
  try {
    const raw = sessionStorage.getItem(MARCUS_WORKSPACE_KEY)
    if (!raw) return null
    sessionStorage.removeItem(MARCUS_WORKSPACE_KEY)
    const stored = JSON.parse(raw) as MarcusWorkspaceSignal & { timestamp: number }
    if (Date.now() - stored.timestamp > 30_000) return null
    const { timestamp: _, ...signal } = stored
    return signal
  } catch { return null }
}

// ─── Derivation helpers ───────────────────────────────────────────────────────

export function deriveChatbotType(chatbotRole: string): string {
  const r = chatbotRole.toLowerCase()
  if (r.includes("sales") || r.includes("qualify") || r.includes("convert")) return "Sales Assistant"
  if (r.includes("onboard") || r.includes("activate") || r.includes("guide")) return "Onboarding Assistant"
  if (r.includes("book") || r.includes("schedul")) return "Booking Assistant"
  if (r.includes("faq") || r.includes("answer") || r.includes("educat")) return "FAQ Assistant"
  if (r.includes("internal") || r.includes("team") || r.includes("hr")) return "Internal Team Assistant"
  return "Customer Support"
}

export function deriveChatbotIndustry(industry: string): string {
  const map: Record<string, string> = {
    "SaaS": "SaaS",
    "Healthcare": "Healthcare",
    "Fintech": "Finance",
    "Finance": "Finance",
    "E-commerce": "eCommerce",
    "Education": "Education",
    "Cybersecurity": "Cybersecurity",
    "Fitness": "Fitness",
    "Marketplace": "SaaS",
    "Agency": "SaaS",
    "Creator Economy": "SaaS",
  }
  return map[industry] ?? "SaaS"
}

export function deriveChatbotTone(industry: string): string {
  const map: Record<string, string> = {
    "Healthcare": "Professional",
    "Fintech": "Professional",
    "Finance": "Corporate",
    "Cybersecurity": "Technical",
    "Fitness": "Friendly",
    "Education": "Friendly",
    "Luxury": "Luxury",
  }
  return map[industry] ?? "Professional"
}

export function deriveWorkflowType(automations: string[]): string {
  const text = automations.join(" ").toLowerCase()
  if (text.includes("lead") || text.includes("prospect")) return "Lead Capture"
  if (text.includes("onboard")) return "Customer Onboarding"
  if (text.includes("sales") || text.includes("pipeline")) return "Sales Pipeline"
  if (text.includes("support") || text.includes("ticket")) return "Support Automation"
  if (text.includes("marketing") || text.includes("campaign")) return "Marketing Automation"
  if (text.includes("crm")) return "CRM Automation"
  return "Lead Capture"
}

export function buildChatbotDesc(ctx: GenerationContext): string {
  return `Business: ${ctx.idea}

Industry: ${ctx.industry}
Overview: ${ctx.businessSnapshot}
Target Market: ${ctx.targetMarket}
Chatbot Role: ${ctx.chatbotRole}

Key Automations Needed:
${ctx.automations.slice(0, 3).map(a => `• ${a}`).join("\n")}

Brand Tone: ${ctx.recommendedStack.crm ? `CRM: ${ctx.recommendedStack.crm}` : "Professional"}`
}

export function buildAutomationDesc(ctx: GenerationContext): string {
  return `Business: ${ctx.idea}

Industry: ${ctx.industry}
Overview: ${ctx.businessSnapshot}
Target Market: ${ctx.targetMarket}

Key Automation Opportunities:
${ctx.automations.map(a => `• ${a}`).join("\n")}

Recommended Stack: ${ctx.recommendedStack.automation.join(", ")}
CRM: ${ctx.recommendedStack.crm}
Payments: ${ctx.recommendedStack.payments}

Growth Focus: ${ctx.strategicInsights.highestLeverageAutomation}`
}
