// ─── Marcus Prompt Controller ─────────────────────────────────────────────────
//
// Phase 1 — Architectural Security Refactor
//
// This controller owns ALL implementation-layer logic that was previously
// embedded in the Marcus system prompt. It separates conversational knowledge
// (what Marcus needs to talk to the user) from implementation knowledge (how
// the system works internally).
//
// The controller:
//   1. Classifies intent (EXECUTION vs STRATEGIC)
//   2. Detects confirmation responses
//   3. Determines workspace engine selection
//   4. Computes execution lock state
//   5. Manages memory retrieval gate logic
//   6. Handles permission validation
//   7. Routes to the correct execution engine
//   8. Prepares command emission
//   9. Injects ONLY final results into the prompt — never implementation details
//
// Marcus receives:
//   - conversationMode
//   - availableModules
//   - workspaceContext
//   - userMemory
//   - businessContext
//   - allowedCapabilities
//
// Marcus does NOT receive:
//   - Intent Router logic
//   - Decision Engine internals
//   - Execution Lock mechanics
//   - Pressure Engine rules
//   - Reality Gate logic
//   - Memory Retrieval Gate implementation
//   - Tool Mapping
//   - Internal Commands
//   - Bridge Logic
//   - Prompt Architecture
//   - Developer instructions

import type { Request } from "express";
import type { BusinessContextResult } from "./business-graph";

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ModuleName = "chatbot" | "automation" | "website" | "bi" | "orchestrator";

export type IntentType = "EXECUTION" | "STRATEGIC";
export type GateMode = "GENERATIVE" | "STRATEGIC";
export type MemoryConfidence = "LOW" | "PARTIAL" | "HIGH";
export type ExecutionReadiness = "NOT_READY" | "READY" | "EXECUTING";

export interface ConfirmationResult {
  intent: "CONFIRM" | "REJECT" | "UNCLEAR";
  confidence: number;
  matchedSignals: string[];
}

export interface ModuleConfidence {
  module: ModuleName;
  score: number;
  matchedWorkspaceSignals: string[];
  matchedContextSignals: string[];
}

export interface MarcusControllerInput {
  userId: string;
  isAdmin: boolean;
  latestUserMessage: string;
  messages: Array<{ role: string; content: string }>;
  workspaceContext?: {
    activePage?: string;
    activePagePath?: string;
    currentProject?: {
      id: string;
      title: string;
      businessIdea: string;
      hasBi: boolean;
      hasWebsite: boolean;
    } | null;
    modules?: {
      businessIntelligence: boolean;
      website: boolean;
      chatbot: boolean;
      automation: boolean;
    };
    projectCount?: number;
    activeAgents?: number;
    pendingIntent?: { type: ModuleName; idea?: string } | null;
  } | null;
  businessContext?: Record<string, unknown> | null;
  projects: Array<Record<string, unknown>>;
  memories: Array<Record<string, unknown>>;
  agents: Array<Record<string, unknown>>;
  projectTasksRaw: Array<Record<string, unknown>>;
  activeProjectRaw: Array<Record<string, unknown>>;
  graphContext: BusinessContextResult;
  language?: string;
}

export interface MarcusControllerOutput {
  /** The simplified system prompt (Group A only — conversational layer) */
  systemPrompt: string;
  /** Data blocks for prompt assembly (built by caller, consumed by buildSimplifiedSystemPrompt) */
  workspaceBlock: string;
  historyBlock: string;
  businessGraphBlock: string;
  crossModuleBlock: string;
  businessBlock: string;
  memoryBlock: string;
  /** Server-computed intent type */
  serverIntentType: IntentType;
  /** Server-computed gate mode */
  serverGateMode: GateMode;
  /** The canonical workspace intent */
  workspaceIntent: ModuleName | "none";
  /** How the intent was determined */
  intentSource: "pendingIntent" | "pagePathEngine" | "keyword" | "none";
  /** Whether this is a confirmation response */
  isConfirmationResponse: boolean;
  /** Whether the intent came from confirmation */
  intentIsFromConfirmation: boolean;
  /** Confirmation result details */
  confirmationResult: ConfirmationResult;
  /** Module confidence scores */
  moduleConfidences: ModuleConfidence[];
  /** Detected business context phrases */
  detectedBusinessContext: string[];
  /** Memory confidence level */
  memoryConfidence: MemoryConfidence;
  /** Execution readiness level */
  executionReadiness: ExecutionReadiness;
  /** Whether the user has a project */
  hasProject: boolean;
  /** Whether BI data exists */
  hasBi: boolean;
  /** Whether memories exist */
  hasMemories: boolean;
  /** Request type label */
  requestType: string;
  /** Loaded module names (for logging) */
  loadedModules: string[];
  /** Skipped module names (for logging) */
  skippedModules: string[];
  /** Whether the execution confirmation bypass should fire */
  shouldBypassLLM: boolean;
  /** The generate command to emit on bypass */
  bypassGenerateCmd?: string;
  /** The confirmation text for bypass */
  bypassConfirmText?: string;
  /** The client pending intent (if any) */
  clientPendingIntent?: { type: ModuleName; idea?: string } | null;
  /** The active page path engine */
  pagePathEngine: ModuleName | null;
  /** Whether the classifier detected a generative request */
  isChatbotRequest: boolean;
  isAutomationRequest: boolean;
  isWebsiteRequest: boolean;
  isBiRequest: boolean;
  isOrchestratorRequest: boolean;
  /** Whether a pending intent was superseded */
  pendingIntentSuperseded: boolean;
  /** The classifier's raw intent */
  classifierIntent: ModuleName | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const MODULE_ORDER: ModuleName[] = ["chatbot", "automation", "website", "bi", "orchestrator"];

const MODULE_SIGNALS: Record<ModuleName, { workspace: string[]; context: string[] }> = {
  chatbot: {
    workspace: ["chatbot", "chat bot"],
    context: ["scheduling assistant", "booking assistant", "ai scheduling", "customer support bot"],
  },
  automation: {
    workspace: ["automation", "onboarding automation", "workflow automation", "email sequence", "drip sequence", "lead capture automation"],
    context: [],
  },
  website: {
    workspace: ["website", "landing page", "fintech landing", "saas landing", "homepage"],
    context: [],
  },
  bi: {
    workspace: ["business intelligence", "intelligence report", "run business intelligence", "generate intelligence", "run bi report"],
    context: [],
  },
  orchestrator: {
    workspace: ["orchestrator", "multi-agent", "multi agent", "agent pipeline", "agent network", "coordinate agents", "orchestrate agents", "execution plan", "build a plan", "create a plan", "ai pipeline", "agent system"],
    context: [],
  },
};

const GENERATIVE_SIGNALS = [
  "build", "generate", "create", "make", "set up", "setup", "design", "write",
  "draft", "produce", "configure", "add", "launch", "deploy", "start", "give me",
  "show me", "make me", "i want", "i need", "let's build", "let's create",
];

const GENERATIVE_ARTIFACTS = [
  "chatbot", "chat bot", "website", "automation", "workflow", "landing page",
  "pricing page", "onboarding", "onboarding flow", "support system", "scheduling",
  "scheduler", "email sequence", "integration", "dashboard", "form", "campaign",
  "agent", "bot", "flow", "page", "funnel", "system", "platform", "app",
  "assistant", "tool", "feature", "module",
];

const CONFIRM_SIGNALS: Array<{ phrase: string; weight: number }> = [
  { phrase: "yes",         weight: 1.0 },
  { phrase: "yeah",        weight: 1.0 },
  { phrase: "yep",         weight: 1.0 },
  { phrase: "yup",         weight: 1.0 },
  { phrase: "sure",        weight: 0.9 },
  { phrase: "confirmed",   weight: 1.0 },
  { phrase: "confirm",     weight: 1.0 },
  { phrase: "approved",    weight: 1.0 },
  { phrase: "correct",     weight: 0.8 },
  { phrase: "absolutely",  weight: 1.0 },
  { phrase: "definitely",  weight: 1.0 },
  { phrase: "exactly",     weight: 0.8 },
  { phrase: "ok",          weight: 0.7 },
  { phrase: "okay",        weight: 0.7 },
  { phrase: "go ahead",     weight: 1.0 },
  { phrase: "go for it",    weight: 1.0 },
  { phrase: "do it",        weight: 1.0 },
  { phrase: "build it",     weight: 1.0 },
  { phrase: "generate it",  weight: 1.0 },
  { phrase: "run it",       weight: 1.0 },
  { phrase: "start it",     weight: 1.0 },
  { phrase: "execute",      weight: 1.0 },
  { phrase: "proceed",      weight: 1.0 },
  { phrase: "continue",     weight: 0.9 },
  { phrase: "let's go",     weight: 1.0 },
  { phrase: "lets go",      weight: 1.0 },
  { phrase: "let's do it",  weight: 1.0 },
  { phrase: "lets do it",   weight: 1.0 },
  { phrase: "sounds good",   weight: 1.0 },
  { phrase: "looks good",    weight: 1.0 },
  { phrase: "works for me",  weight: 1.0 },
  { phrase: "that works",    weight: 0.9 },
  { phrase: "that's great",  weight: 0.8 },
  { phrase: "great",         weight: 0.6 },
  { phrase: "perfect",       weight: 0.8 },
  { phrase: "please",        weight: 0.5 },
];

const REJECT_SIGNALS: Array<{ phrase: string; weight: number }> = [
  { phrase: "no",          weight: 1.0 },
  { phrase: "nope",        weight: 1.0 },
  { phrase: "nah",         weight: 1.0 },
  { phrase: "stop",        weight: 1.0 },
  { phrase: "cancel",      weight: 1.0 },
  { phrase: "not yet",     weight: 1.0 },
  { phrase: "wait",        weight: 0.9 },
  { phrase: "hold on",     weight: 0.9 },
  { phrase: "change it",   weight: 1.0 },
  { phrase: "modify it",   weight: 1.0 },
  { phrase: "don't",       weight: 0.9 },
  { phrase: "dont",        weight: 0.9 },
  { phrase: "not now",     weight: 1.0 },
  { phrase: "never mind",  weight: 1.0 },
  { phrase: "nevermind",   weight: 1.0 },
];

const IDENTITY_PATTERNS = [
  /^who are you/, /^what is your name/, /^what's your name/, /^who is marcus/,
  /^what do you do/, /^how can you help/, /^what can you do/, /^what are your capabilities/,
  /^explain yourself/, /^tell me about yourself/, /^introduce yourself/,
  /^what is marcus/, /^who is copilot/, /^what is copilot/,
  /^are you (an? )?(ai|bot|assistant|human)/, /^what (kind of|type of) (ai|assistant|bot)/,
];

// ─── Confirmation Detection ───────────────────────────────────────────────────

export function detectConfirmationIntent(rawMessage: string): ConfirmationResult {
  const normalised = rawMessage
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const matched: Array<{ phrase: string; weight: number; side: "CONFIRM" | "REJECT" }> = [];

  for (const sig of CONFIRM_SIGNALS) {
    const re = new RegExp(`(?:^|\\s)${sig.phrase.replace(/'/g, "'")}(?:\\s|$)`);
    if (re.test(normalised) || normalised === sig.phrase) {
      matched.push({ ...sig, side: "CONFIRM" });
    }
  }
  for (const sig of REJECT_SIGNALS) {
    const re = new RegExp(`(?:^|\\s)${sig.phrase}(?:\\s|$)`);
    if (re.test(normalised) || normalised === sig.phrase) {
      matched.push({ ...sig, side: "REJECT" });
    }
  }

  const confirmScore = matched.filter(m => m.side === "CONFIRM").reduce((s, m) => s + m.weight, 0);
  const rejectScore  = matched.filter(m => m.side === "REJECT").reduce((s, m) => s + m.weight, 0);
  const matchedSignals = matched.map(m => m.phrase);

  if (rejectScore > confirmScore) {
    return { intent: "REJECT", confidence: Math.min(rejectScore, 1), matchedSignals };
  }
  if (confirmScore > 0) {
    return { intent: "CONFIRM", confidence: Math.min(confirmScore, 1), matchedSignals };
  }
  return { intent: "UNCLEAR", confidence: 0, matchedSignals: [] };
}

// ─── Identity Query Detection ─────────────────────────────────────────────────

export function isIdentityQuery(message: string): boolean {
  const trimmed = message.toLowerCase().trim();
  return IDENTITY_PATTERNS.some(p => p.test(trimmed));
}

// ─── Intent Classification ────────────────────────────────────────────────────

export function classifyIntent(
  latestUserMessage: string,
  activePagePath: string,
  clientPendingIntent: { type: ModuleName; idea?: string } | null | undefined,
  isConfirmationResponse: boolean,
): {
  serverIntentType: IntentType;
  serverGateMode: GateMode;
  workspaceIntent: ModuleName | "none";
  intentSource: "pendingIntent" | "pagePathEngine" | "keyword" | "none";
  intentIsFromConfirmation: boolean;
  moduleConfidences: ModuleConfidence[];
  detectedBusinessContext: string[];
  classifierIntent: ModuleName | null;
  pagePathEngine: ModuleName | null;
  pendingIntentSuperseded: boolean;
  isChatbotRequest: boolean;
  isAutomationRequest: boolean;
  isWebsiteRequest: boolean;
  isBiRequest: boolean;
  isOrchestratorRequest: boolean;
} {
  const hasGenerativeSignal = GENERATIVE_SIGNALS.some(s => latestUserMessage.includes(s));
  const hasGenerativeArtifact = GENERATIVE_ARTIFACTS.some(a => latestUserMessage.includes(a));
  const isGenerativeRequest = hasGenerativeSignal || hasGenerativeArtifact;

  let serverIntentType: IntentType = hasGenerativeSignal ? "EXECUTION" : "STRATEGIC";
  let serverGateMode: GateMode = isGenerativeRequest ? "GENERATIVE" : "STRATEGIC";

  // Module confidence scoring
  const moduleConfidences = MODULE_ORDER.map(module => {
    const { workspace, context } = MODULE_SIGNALS[module];
    const matchedWorkspaceSignals = workspace.filter(s => latestUserMessage.includes(s));
    const matchedContextSignals = context.filter(s => latestUserMessage.includes(s));
    return {
      module,
      score: matchedWorkspaceSignals.length,
      matchedWorkspaceSignals,
      matchedContextSignals,
    };
  });

  const detectedBusinessContext: string[] = Array.from(
    new Set(moduleConfidences.flatMap(m => m.matchedContextSignals))
  );

  const topModuleConfidence = moduleConfidences.reduce((best, current) =>
    current.score > best.score ? current : best
  );
  const classifierIntent: ModuleName | null = topModuleConfidence.score > 0 ? topModuleConfidence.module : null;

  // Page path engine
  const pagePathEngine: ModuleName | null =
    activePagePath.includes("/chatbot-generator")  ? "chatbot"
    : activePagePath.includes("/website-generator")  ? "website"
    : activePagePath.includes("/automation-builder") ? "automation"
    : activePagePath.includes("/dashboard")           ? "bi"
    : activePagePath.includes("/orchestrator")        ? "orchestrator"
    : null;

  // Pending intent superseded?
  const explicitModuleFromSignals: ModuleName | null = classifierIntent;
  const pendingIntentSuperseded =
    explicitModuleFromSignals !== null &&
    clientPendingIntent != null &&
    explicitModuleFromSignals !== clientPendingIntent.type;

  // Confirmation engine
  const _confirmationEngine = isConfirmationResponse && !pendingIntentSuperseded
    ? (clientPendingIntent?.type ?? pagePathEngine ?? null)
    : null;

  const intentIsFromConfirmation = _confirmationEngine !== null;

  const workspaceIntent: ModuleName | "none" =
    _confirmationEngine ?? classifierIntent ?? "none";

  const intentSource: "pendingIntent" | "pagePathEngine" | "keyword" | "none" =
    intentIsFromConfirmation
      ? (clientPendingIntent ? "pendingIntent" : "pagePathEngine")
      : workspaceIntent !== "none"
        ? "keyword"
        : "none";

  // Gate mode override for confirmation
  if (isConfirmationResponse && intentIsFromConfirmation) {
    serverGateMode = "GENERATIVE";
    serverIntentType = "EXECUTION";
  } else if (pendingIntentSuperseded) {
    serverGateMode = "GENERATIVE";
    serverIntentType = "EXECUTION";
  }

  const isChatbotRequest      = workspaceIntent === "chatbot";
  const isAutomationRequest   = workspaceIntent === "automation";
  const isWebsiteRequest      = workspaceIntent === "website";
  const isBiRequest           = workspaceIntent === "bi";
  const isOrchestratorRequest = workspaceIntent === "orchestrator";

  return {
    serverIntentType,
    serverGateMode,
    workspaceIntent,
    intentSource,
    intentIsFromConfirmation,
    moduleConfidences,
    detectedBusinessContext,
    classifierIntent,
    pagePathEngine,
    pendingIntentSuperseded,
    isChatbotRequest,
    isAutomationRequest,
    isWebsiteRequest,
    isBiRequest,
    isOrchestratorRequest,
  };
}

// ─── State Computation ────────────────────────────────────────────────────────

export function computeState(
  hasProject: boolean,
  hasBi: boolean,
  memoriesLength: number,
  activeAgentsLength: number,
  wsModules?: { businessIntelligence: boolean; website: boolean; chatbot: boolean; automation: boolean } | null,
): {
  memoryConfidence: MemoryConfidence;
  executionReadiness: ExecutionReadiness;
} {
  const memoryConfidence: MemoryConfidence =
    (hasProject && hasBi && memoriesLength >= 5) ? "HIGH"
    : (hasProject || memoriesLength > 0 || hasBi) ? "PARTIAL"
    : "LOW";

  const executionReadiness: ExecutionReadiness =
    (activeAgentsLength > 0 && memoryConfidence !== "LOW") ? "EXECUTING"
    : (hasProject && (hasBi || wsModules?.businessIntelligence)) ? "READY"
    : "NOT_READY";

  return { memoryConfidence, executionReadiness };
}

// ─── Module Loading ───────────────────────────────────────────────────────────

export function computeModuleLoad(
  hasMemories: boolean,
  hasProject: boolean,
  isChatbotRequest: boolean,
  isAutomationRequest: boolean,
  isWebsiteRequest: boolean,
  isBiRequest: boolean,
): {
  loadedModules: string[];
  skippedModules: string[];
  requestType: string;
} {
  const loadedModules: string[] = ["core"];
  const skippedModules: string[] = [];

  if (hasMemories) {
    loadedModules.push("memory_retrieval_gate", "project_memory_continuity");
  } else {
    skippedModules.push("memory_retrieval_gate", "project_memory_continuity");
  }
  if (hasProject) {
    loadedModules.push("event_awareness", "workspace_controller");
  } else {
    skippedModules.push("event_awareness", "workspace_controller");
  }
  if (isChatbotRequest)         { loadedModules.push("chatbot_execution");    skippedModules.push("automation_execution", "website_execution", "bi_execution"); }
  else if (isAutomationRequest) { loadedModules.push("automation_execution"); skippedModules.push("chatbot_execution",    "website_execution", "bi_execution"); }
  else if (isWebsiteRequest)    { loadedModules.push("website_execution");    skippedModules.push("chatbot_execution",    "automation_execution", "bi_execution"); }
  else if (isBiRequest)         { loadedModules.push("bi_execution");         skippedModules.push("chatbot_execution",    "automation_execution", "website_execution"); }
  else                          { skippedModules.push("chatbot_execution",    "automation_execution", "website_execution", "bi_execution"); }

  const requestType = isChatbotRequest    ? "chatbot_generation"
    : isAutomationRequest ? "automation_generation"
    : isWebsiteRequest    ? "website_generation"
    : isBiRequest         ? "bi_generation"
    : (hasMemories || hasProject) ? "strategic_discussion"
    : "general_conversation";

  return { loadedModules, skippedModules, requestType };
}

// ─── Confirmation Bypass ──────────────────────────────────────────────────────

export function computeConfirmationBypass(
  isConfirmationResponse: boolean,
  intentIsFromConfirmation: boolean,
  workspaceIntent: ModuleName | "none",
  wsProject: { id: string; title: string; businessIdea: string } | null | undefined,
  clientPendingIntent: { type: ModuleName; idea?: string } | null | undefined,
  wsModules?: { businessIntelligence: boolean; website: boolean; chatbot: boolean; automation: boolean } | null,
): {
  shouldBypassLLM: boolean;
  bypassGenerateCmd?: string;
  bypassConfirmText?: string;
} {
  if (!isConfirmationResponse || !intentIsFromConfirmation) {
    return { shouldBypassLLM: false };
  }

  const GENERATE_CMD_MAP: Record<string, string> = {
    chatbot:      "generate_chatbot",
    website:      "generate_website",
    automation:   "generate_automation",
    bi:           "generate_intelligence",
    orchestrator: "generate_orchestrator",
  };
  const generateCmd = `{{WORKSPACE|${GENERATE_CMD_MAP[workspaceIntent] ?? `generate_${workspaceIntent}`}}}`;

  const rawIdea = (wsProject?.businessIdea ?? clientPendingIntent?.idea ?? "").trim();
  const ideaLabel = rawIdea.length === 0
    ? null
    : rawIdea.length <= 80
      ? rawIdea
      : rawIdea.slice(0, 80).replace(/\s\S*$/, "").trimEnd() + "…";

  const hasBi = !!(wsModules?.businessIntelligence);

  const confirmText = (() => {
    switch (workspaceIntent) {
      case "bi":
        return ideaLabel
          ? `Everything is ready.\n\nI'm generating a business intelligence report for ${ideaLabel}.\n\nI'll attach the results to your current workspace once analysis completes.`
          : `Everything is ready.\n\nI'm generating a business intelligence report.\n\nI'll attach the results to your current workspace once analysis completes.`;
      case "website":
        return hasBi
          ? `Everything is ready.\n\nI'm generating your website using the business intelligence we created.\n\nI'll save it into the current project.`
          : ideaLabel
            ? `Everything is ready.\n\nI'm generating your website for ${ideaLabel}.\n\nI'll save it into the current project.`
            : `Everything is ready.\n\nI'm generating your website.\n\nI'll save it into the current project.`;
      case "chatbot":
        return `Everything is ready.\n\nI'm generating your chatbot using the current project context.\n\nI'll attach it to your current project once complete.`;
      case "automation":
        return `Everything is ready.\n\nI'm generating automation workflows based on your business strategy.\n\nI'll save the workflow to your current project.`;
      case "orchestrator":
        return `Everything is ready.\n\nI'm preparing the orchestration plan for this business.\n\nI'll attach it to your current workspace once ready.`;
      default:
        return `Everything is ready.\n\nGenerating now.`;
    }
  })();

  return { shouldBypassLLM: true, bypassGenerateCmd: generateCmd, bypassConfirmText: confirmText };
}

// ─── Simplified System Prompt Builder (Group A only) ──────────────────────────
//
// This builds the Marcus system prompt using ONLY conversational-layer content.
// All implementation logic (intent routing, decision engines, pressure systems,
// memory retrieval gates, execution locks, etc.) has been moved server-side.
//
// Marcus receives:
//   - Who he is (identity)
//   - What STAGEONE is (platform description)
//   - The five module names
//   - Current workspace context (project, modules, tasks)
//   - Business context (BI data, graph memory)
//   - Memory summaries
//   - Allowed capabilities (what he can do)
//   - Conversation history
//
// Marcus does NOT receive:
//   - How routing works
//   - How memory retrieval works
//   - How permissions work
//   - How execution works
//   - How orchestration works
//   - How security policies are enforced
//   - How prompts are structured
//   - Internal command names
//   - Developer instructions

export function buildSimplifiedSystemPrompt(params: {
  serverGateMode: GateMode;
  workspaceIntent: ModuleName | "none";
  isConfirmationResponse: boolean;
  intentIsFromConfirmation: boolean;
  hasHistory: boolean;
  hasProject: boolean;
  hasMemories: boolean;
  hasBi: boolean;
  memoryConfidence: MemoryConfidence;
  executionReadiness: ExecutionReadiness;
  isChatbotRequest: boolean;
  isAutomationRequest: boolean;
  isWebsiteRequest: boolean;
  isBiRequest: boolean;
  isOrchestratorRequest: boolean;
  workspaceBlock: string;
  historyBlock: string;
  businessGraphBlock: string;
  crossModuleBlock: string;
  businessBlock: string;
  memoryBlock: string;
  languageInstruction: string;
}): string {
  const {
    serverGateMode,
    workspaceIntent,
    isConfirmationResponse,
    intentIsFromConfirmation,
    hasHistory,
    hasProject,
    hasMemories,
    hasBi,
    memoryConfidence,
    executionReadiness,
    isChatbotRequest,
    isAutomationRequest,
    isWebsiteRequest,
    isBiRequest,
    isOrchestratorRequest,
    workspaceBlock,
    historyBlock,
    businessGraphBlock,
    crossModuleBlock,
    businessBlock,
    memoryBlock,
    languageInstruction,
  } = params;

  // ─── Identity ────────────────────────────────────────────────────────────────
  const personaIntro = hasHistory
    ? `Your name is Marcus. You are the STAGEONE Copilot — a co-founder, product strategist, and execution assistant operating inside a live workspace. You already know the idea, the stage, what's been built. You react. You don't explain your thinking — you just think.`
    : `Your name is Marcus. You are the STAGEONE Copilot — a co-founder meeting this person for the first time. You know nothing about their business yet. Ask one question — the single sharpest question that would tell you the most about what they're building. No intro, no greeting, no explanation. Just the question.`;

  // ─── Execution Mode Header ───────────────────────────────────────────────────
  const executionHeader = serverGateMode === "GENERATIVE" ? `!!!EXECUTION MODE ACTIVE — READ BEFORE ANYTHING ELSE!!!
gate_mode = GENERATIVE. This is a hard server-computed fact.
You are in EXECUTION mode. The user has requested creation of an artifact.
Proceed directly to: classify intent → open execution engine → populate → confirm.
Do NOT validate. Do NOT redirect. Do NOT coach. Execute.
!!!END EXECUTION MODE HEADER!!!

` : "";

  // ─── Confirmation Override ──────────────────────────────────────────────────
  const confirmationBlock = (isConfirmationResponse && intentIsFromConfirmation && workspaceIntent !== "none")
    ? `[PENDING CONFIRMATION]
The user has given explicit approval to proceed with the pending ${workspaceIntent} generation.

REQUIRED ACTION:
1. Emit the generation command: {{WORKSPACE|generate_${workspaceIntent}}}
2. Follow with one short sentence confirming generation has started.
3. STOP. Nothing else.

Do NOT ask for further confirmation. Do NOT add validation warnings.
`
    : "";

  // ─── Execution Engine Blocks ─────────────────────────────────────────────────
  // These tell Marcus what {{WORKSPACE|...}} commands are available.
  // They describe CAPABILITIES, not implementation.

  const chatbotEngine = isChatbotRequest ? `
[Chatbot Generator — available commands]
You can open the chatbot generator and populate it with a description:
  {{WORKSPACE|chatbot}} — opens the chatbot generator tab
  {{WORKSPACE|idea|<description>}} — fills in the chatbot description
  {{WORKSPACE|generate_chatbot}} — triggers generation (only after user confirms)

Flow: open → populate → confirm → generate on approval.
` : "";

  const automationEngine = isAutomationRequest ? `
[Automation Builder — available commands]
You can open the automation builder and populate it with a description:
  {{WORKSPACE|automation}} — opens the automation builder tab
  {{WORKSPACE|idea|<description>}} — fills in the automation description
  {{WORKSPACE|generate_automation}} — triggers generation (only after user confirms)

Flow: open → populate → confirm → generate on approval.
` : "";

  const websiteEngine = isWebsiteRequest ? `
[Website Generator — available commands]
You can open the website generator and populate it with a description:
  {{WORKSPACE|website}} — opens the website generator tab
  {{WORKSPACE|idea|<description>}} — fills in the website description
  {{WORKSPACE|generate_website}} — triggers generation (only after user confirms)

Flow: open → populate → confirm → generate on approval.
` : "";

  const biEngine = isBiRequest ? `
[Business Intelligence — available commands]
You can open the BI generator and populate it with a description:
  {{WORKSPACE|intelligence}} — opens the BI generator tab
  {{WORKSPACE|bi_idea|<description>}} — fills in the business description
  {{WORKSPACE|generate_intelligence}} — triggers generation (only after user confirms)

Flow: open → populate → confirm → generate on approval.
` : "";

  const orchestratorEngine = isOrchestratorRequest ? `
[Execution Engine — available commands]
You can open the Execution Engine and populate it with a goal:
  {{WORKSPACE|open_orchestrator}} — opens the Execution Engine page
  {{WORKSPACE|idea|<goal description>}} — fills in the execution goal
  {{WORKSPACE|generate_orchestrator}} — triggers generation (only after user confirms)

Flow: open → populate → confirm → generate on approval.
The module name is "Execution Engine" — never call it "Orchestrator".
` : "";

  // ─── Agentic Actions ─────────────────────────────────────────────────────────
  const agenticActions = `
[Workspace Actions]
You can initiate workspace actions when the user expresses clear intent:
  {{ACTION:generate_intelligence|Run Intelligence|Run business intelligence analysis}}
  {{ACTION:open_agents|Open Agent Store|Browse and install agents}}
  {{ACTION:open_deployments|Open Deployments|Review deployments}}
  {{ACTION:open_templates|Open Templates|Browse templates}}
  {{ACTION:open_memory|Open Memory|View workspace memory}}

Flow: recognize intent → confirm in text → emit exactly one ACTION tag at end.
${hasProject ? `
[Workspace Tasks]
You can create real tasks in the user's workspace:
  {{WORKSPACE:create_tasks|["Task 1","Task 2","..."]}}
  Max 7 tasks. Must be specific, actionable verbs. Ordered by priority.
` : ""}`;

  // ─── Conversation Quality Rules ──────────────────────────────────────────────
  const qualityRules = `
[Response Rules]
- NEVER begin a response with "Marcus:" or your name as a prefix label.
- Start responses directly with the content.
- One idea per response. One opinion. Say it and stop.
- 1-3 sentences by default. Expand only when explicitly asked.
- No headers, bullets, labels, or formatting unless the user asks for depth.
- No affirmation openers: "Great question", "Absolutely", "Certainly", etc.
- Never repeat back what the user said.
- "It depends" is not an answer — say what you'd actually do.
- Do NOT end every response with a question. Ask only when it unlocks the next action.
- When uncertain: say so. "I don't know yet." / "We haven't tested that."

[Conversation Mode]
Classify the user's message into one mode:

NEUTRAL — short acknowledgment, closing a thread.
  Reply with 1-5 words. No coaching, no warnings, no follow-ups.

EXPLORATION — asking a question, seeking information.
  Answer directly. Do NOT prescribe actions or add warnings.

STRATEGY — asking for advice, recommendation, or decision.
  Give a judgment call. Reference specific project data. Name the single most important action.

EXECUTION — requesting creation of an artifact.
  Open the relevant module, populate with context, confirm, then generate on approval.

[Confidence & Honesty]
- FACT: exists in workspace records. State confidently.
- INFERENCE: derived from analysis. Signal: "The analysis suggests..."
- HYPOTHESIS: no evidence yet. Signal: "We haven't validated that."
- Never invent customers, interviews, pilots, revenue, or usage data.
- Never present analysis as proven fact.

[STAGEONE Modules]
The platform has five modules:
1. Business Intelligence — market analysis, competitor research, business validation
2. Website Architect — landing page and website generation
3. Chatbot Generator — AI chatbot design and deployment
4. Automation Builder — workflow automation design
5. Execution Engine — multi-agent AI execution plans and pipelines

Use these exact names when referencing modules.
`;

  // ─── Assemble ─────────────────────────────────────────────────────────────────
  return `${executionHeader}${personaIntro}

[IDENTITY]
Your name is Marcus. You are Marcus, the STAGEONE Copilot.
If asked your name, who you are, or your role — always answer: "My name is Marcus." or "I'm Marcus, the STAGEONE Copilot."
Never identify as "Copilot", "Assistant", or "AI" alone.
[end identity]

${qualityRules}
${confirmationBlock}${chatbotEngine}${automationEngine}${websiteEngine}${biEngine}${orchestratorEngine}${agenticActions}${workspaceBlock}${historyBlock}${businessGraphBlock}${crossModuleBlock}${businessBlock}${memoryBlock}
${languageInstruction}`;
}

// ─── Main Controller Entry Point ──────────────────────────────────────────────

export function runMarcusController(input: MarcusControllerInput): MarcusControllerOutput {
  const {
    userId,
    isAdmin,
    latestUserMessage,
    messages,
    workspaceContext,
    businessContext,
    projects,
    memories,
    agents,
    projectTasksRaw,
    activeProjectRaw,
    graphContext,
    language,
  } = input;

  const ws = workspaceContext;
  const wsProject = ws?.currentProject;
  const wsModules = ws?.modules;
  const clientPendingIntent = ws?.pendingIntent;

  // 1. Detect identity query
  const isIdentity = isIdentityQuery(latestUserMessage);

  // 2. Detect confirmation
  const confirmationResult = detectConfirmationIntent(latestUserMessage);
  const isConfirmationResponse = confirmationResult.intent === "CONFIRM";

  // 3. Classify intent
  const activePagePath = ws?.activePagePath ?? "";
  const intentClassification = classifyIntent(
    latestUserMessage,
    activePagePath,
    clientPendingIntent,
    isConfirmationResponse,
  );

  // 4. Compute state
  const hasProject = !!wsProject;
  const hasBi = !!businessContext && Object.keys(businessContext as object).length > 0;
  const hasMemories = memories.length > 0;
  const activeAgents = agents.filter(a => (a as { isActive?: boolean }).isActive);

  const state = computeState(
    hasProject,
    hasBi,
    memories.length,
    activeAgents.length,
    wsModules,
  );

  // 5. Compute module load
  const moduleLoad = computeModuleLoad(
    hasMemories,
    hasProject,
    intentClassification.isChatbotRequest,
    intentClassification.isAutomationRequest,
    intentClassification.isWebsiteRequest,
    intentClassification.isBiRequest,
  );

  // 6. Compute confirmation bypass
  const bypass = computeConfirmationBypass(
    isConfirmationResponse,
    intentClassification.intentIsFromConfirmation,
    intentClassification.workspaceIntent,
    wsProject,
    clientPendingIntent,
    wsModules,
  );

  return {
    // Intent classification results
    serverIntentType: intentClassification.serverIntentType,
    serverGateMode: intentClassification.serverGateMode,
    workspaceIntent: intentClassification.workspaceIntent,
    intentSource: intentClassification.intentSource,
    intentIsFromConfirmation: intentClassification.intentIsFromConfirmation,
    moduleConfidences: intentClassification.moduleConfidences,
    detectedBusinessContext: intentClassification.detectedBusinessContext,
    classifierIntent: intentClassification.classifierIntent,
    pagePathEngine: intentClassification.pagePathEngine,
    pendingIntentSuperseded: intentClassification.pendingIntentSuperseded,

    // Confirmation
    isConfirmationResponse,
    confirmationResult,
    clientPendingIntent,

    // State
    memoryConfidence: state.memoryConfidence,
    executionReadiness: state.executionReadiness,
    hasProject,
    hasBi,
    hasMemories,

    // Module loading
    requestType: moduleLoad.requestType,
    loadedModules: moduleLoad.loadedModules,
    skippedModules: moduleLoad.skippedModules,

    // Bypass
    shouldBypassLLM: bypass.shouldBypassLLM,
    bypassGenerateCmd: bypass.bypassGenerateCmd,
    bypassConfirmText: bypass.bypassConfirmText,

    // Request type booleans
    isChatbotRequest: intentClassification.isChatbotRequest,
    isAutomationRequest: intentClassification.isAutomationRequest,
    isWebsiteRequest: intentClassification.isWebsiteRequest,
    isBiRequest: intentClassification.isBiRequest,
    isOrchestratorRequest: intentClassification.isOrchestratorRequest,

    // Data blocks (filled by caller for prompt assembly)
    workspaceBlock: "",
    historyBlock: "",
    businessGraphBlock: "",
    crossModuleBlock: "",
    businessBlock: "",
    memoryBlock: "",

    // System prompt (simplified — Group A only)
    systemPrompt: "", // Built by buildSimplifiedSystemPrompt — caller must invoke it
  };
}