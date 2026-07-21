// ─── AgentConversation — Streaming conversation UI (replaces AgentPanel) ───────

import { useState, useRef, useEffect, useCallback, useMemo, useReducer } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Loader2, CheckCircle, AlertCircle, RefreshCw,
  FileCode, FileEdit, Cpu, Search, Terminal,
  FolderOpen, Brain, Zap, ChevronRight, Check, Copy, ChevronUp, ChevronDown,
  ShieldCheck, Layers,
} from "lucide-react"
import type { V2Project, V2ProjectFile } from "@/hooks/useWebsiteV2Project"
import { useWebContainer } from "@/components/website-v2/runtime/useWebContainer"
import { WebsiteStudioRuntime, type WSProjectMemory, type WSAgentMessage } from "@/components/website-v2/runtime/WebsiteStudioRuntime"
import { ToolCallCard } from "./ToolCallCard"
import { ThinkingBlock } from "./ThinkingBlock"
// Website Studio's own generation activity — independent event bus, not Marcus.
// Self-hides when there's nothing on the bus; safe to render unconditionally.
import { GenerationActivity } from "../generation/GenerationActivity"
import { useGenerationEvents } from "../generation/use-generation-events"
import type { GenerationEventType } from "../generation/generation-events"
// Website Studio's own composer — textarea, attachments, drag-and-drop, orbit.
// Fully self-contained: owns its own attach/drag state, holds no reference to
// the legacy AgentRuntime, and renders no timeline/action-card UI.
import { WebsiteStudioComposer } from "./WebsiteStudioComposer"
// Phase 14.1A: Engineering Timeline — unified execution progress UI
import { EngineeringTimeline } from "./EngineeringTimeline"
// Phase 14.2: Engineering Confidence Panel — live confidence & risk intelligence
import { EngineeringConfidencePanel } from "./EngineeringConfidencePanel"
// Phase 14.4: Engineering Visual Panel — visual QA & layout verification
import { EngineeringVisualPanel } from "./EngineeringVisualPanel"
// Phase 14.5: Engineering Recovery Panel — snapshot management & rollback
import { EngineeringRecoveryPanel } from "./EngineeringRecoveryPanel"
// Phase 14.6: Engineering Decision Panel — strategy, risk & recommendation
import { EngineeringDecisionPanel } from "./EngineeringDecisionPanel"
// Phase 15.1: Engineering Audit Panel — proactive project audit & opportunities
import { EngineeringAuditPanel } from "./EngineeringAuditPanel"
// Phase 15.2: Engineering Command Center — unified engineering dashboard
import { EngineeringCommandCenter } from "@/components/website-studio/EngineeringCommandCenter"
import { useWSSessionContext, useWSSessionStream } from "@/lib/website-studio-session/context"
import type { WSSessionState, WSConversationEntry, TimelineEntry } from "@/lib/website-studio-session/types"
import { activityEngine } from "@/components/website-v2/runtime/ActivityEngine"
import type { Activity, ActivityKind } from "@/components/website-v2/runtime/ActivityEngine"
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter"
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents"
import { Markdown } from "@/lib/markdown-renderer"

const ACTIVITY_ICONS: Record<ActivityKind, React.ElementType> = {
  thinking: Brain,
  reasoning: Cpu,
  reading: FileCode,
  searching: Search,
  planning: FileEdit,
  working: Zap,
  writing: FileCode,
  "running-command": Terminal,
  testing: ShieldCheck,
  preview: Layers,
  complete: CheckCircle,
}

const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  thinking: "Thinking…",
  reasoning: "Reasoning…",
  reading: "Reading files…",
  searching: "Searching project…",
  planning: "Planning changes…",
  working: "Working…",
  writing: "Writing files…",
  "running-command": "Running command…",
  testing: "Testing…",
  preview: "Refreshing preview…",
  complete: "Complete",
}

// ─── Activity Stream UI Component ─────────────────────────────────────────────
// Renders the activity queue from the ActivityEngine. Pure presentation —
// never mutates activity state, never emits events.
function ActivityStream({ queue = [] }: { queue?: Activity[] }) {
  if (queue.length === 0) return null

  const animationVariants = {
    entering: { opacity: 0, height: 0, y: -8 },
    idle: { opacity: 1, height: "auto", y: 0 },
    exiting: { opacity: 0, height: 0, y: -8 },
  }

  return (
    <div className="px-4">
      {queue.map((activity) => {
        const Icon = ACTIVITY_ICONS[activity.type]
        const label = ACTIVITY_LABELS[activity.type]
        const isActive = activity.status === "running"
        const isComplete = activity.status === "completed"
        const isFailed = activity.status === "failed"
        const displayFile = activity.affectedFiles.length > 0 ? activity.affectedFiles[0] : undefined
        const showProgress = typeof activity.progress === "number"

        return (
          <motion.div
            key={activity.id}
            initial="entering"
            animate={activity.animationState}
            exit="exiting"
            variants={animationVariants}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="px-4 py-2"
          >
            <div className="flex items-center gap-2">
              <div className={`flex h-6 w-6 items-center justify-center rounded-full bg-[#232323] ring-1 ring-[#303030] ${isActive ? "animate-pulse" : ""}`}>
                <Icon className={`h-3 w-3 ${isFailed ? "text-red-400" : isComplete ? "text-emerald-400" : "text-[#ECECEC]"}`} />
              </div>
              <span className="text-[11px] font-medium text-[#ECECEC]">{label}</span>
              {displayFile && (
                <span className="flex-1 truncate text-[10px] font-mono text-[#A0A0A0]/70">{displayFile}</span>
              )}
              {activity.description && activity.description !== label && (
                <span className="text-[10px] text-[#A0A0A0]/50">{activity.description}</span>
              )}
              {showProgress && (
                <div className="flex items-center gap-2 ml-auto">
                  <div className="h-1 w-32 overflow-hidden rounded-full bg-[#A0A0A0]/15">
                    <motion.div
                      className="h-full rounded-full bg-[#ECECEC]/70"
                      initial={false}
                      animate={{ width: `${Math.max(0, Math.min(100, Math.round(activity.progress!)))}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-[10px] tabular-nums text-[#A0A0A0]">
                    {Math.max(0, Math.min(100, Math.round(activity.progress!)))}%
                  </span>
                  {activity.progressDetail && (
                    <span className="text-[10px] text-[#A0A0A0]/60">{activity.progressDetail}</span>
                  )}
                </div>
              )}
              {isActive && !showProgress && (
                <motion.span
                  className="text-[10px] font-mono text-[#A0A0A0]/40"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  ●
                </motion.span>
              )}
              {isComplete && (
                <CheckCircle className="h-3 w-3 text-emerald-400" />
              )}
              {isFailed && (
                <AlertCircle className="h-3 w-3 text-red-400" />
              )}
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Unified Timeline Event System ────────────────────────────────────────────
// Single source of truth for all chat events. Every event enters here.
// Render order = array order. Never replace the array — only append/update.

export type TimelineEventType =
  | "user"           // User message (always right-aligned)
  | "assistant"      // AI natural response (left-aligned)
  | "activity"       // Activity engine event (left-aligned, transient)
  | "execution"      // File operations, tool results (left-aligned)
  | "error"          // Error messages (left-aligned)
  | "thinking"       // AI thinking block (left-aligned, transient)

export interface TimelineEvent {
  id: string
  timestamp: number
  type: TimelineEventType
  payload: unknown
}

// Payload types for each event type
export interface UserPayload {
  text: string
}

export interface AssistantPayload {
  text: string
  phase?: string
}

export interface ActivityPayload {
  activity: Activity
}

export interface ExecutionPayload {
  kind: "file-write" | "file-read" | "tool-call" | "diff" | "summary"
  path?: string
  operation?: "create" | "update" | "delete"
  content?: string
  toolName?: string
  params?: Record<string, unknown>
  result?: string
  status?: "running" | "done" | "error"
}

export interface ErrorPayload {
  message: string
}

export interface ThinkingPayload {
  text: string
  isStreaming: boolean
}

// ─── Timeline Reducer ────────────────────────────────────────────────────────
// Pure reducer — never replaces the full array, only appends/updates by id.

type TimelineAction =
  | { type: "ADD_EVENT"; event: TimelineEvent }
  | { type: "UPDATE_EVENT"; id: string; payload: Partial<TimelineEvent["payload"]> }
  | { type: "REMOVE_EVENT"; id: string }
  | { type: "CLEAR" }

function timelineReducer(state: TimelineEvent[], action: TimelineAction): TimelineEvent[] {
  switch (action.type) {
    case "ADD_EVENT":
      return [...state, action.event]
    case "UPDATE_EVENT":
      return state.map((e) =>
        e.id === action.id ? { ...e, payload: { ...e.payload, ...action.payload } } : e
      )
    case "REMOVE_EVENT":
      return state.filter((e) => e.id !== action.id)
    case "CLEAR":
      return []
    default:
      return state
  }
}

// ─── Intent Classification (Layer 1 — Natural Conversation) ───────────────────
// ─── Phase S1.1 — Deterministic Intent Router ────────────────────────────────
// Routes every user message into exactly one of three mutually-exclusive
// execution modes. Never guesses — emits a clarification request when
// confidence is below threshold instead of silently mis-routing.
//
// CONVERSATION     → POST /api/copilot/agent
// WEBSITE_GENERATION → POST /api/generate/website-v2   (empty project only)
// WEBSITE_ENGINEERING → POST /api/website-v2/projects/:id/edit

export type RoutingMode = "CONVERSATION" | "WEBSITE_GENERATION" | "WEBSITE_ENGINEERING"

export interface RoutingDecision {
  mode:       RoutingMode
  confidence: number    // 0–1
  reason:     string    // signal summary for telemetry
  endpoint:   string    // target API endpoint string
}

/** Minimum confidence required to route without asking for clarification. */
const ROUTING_CONFIDENCE_THRESHOLD = 0.55

function routeIntent(text: string, hasProject: boolean): RoutingDecision {
  const lower = text.toLowerCase().trim()

  // ── Signal detection ────────────────────────────────────────────────────────
  const sig = {
    // CONVERSATION
    greeting:     /^(hi|hello|hey|thanks|thank you|ok|okay|cool|great|awesome|nice|yep|nope|yes|no|sure|perfect|sounds good|got it|makes sense)\b/.test(lower),
    question:     /^(what|why|how|where|when|which|who|can you|could you|would you|is there|are there|do you|does|is it|will it|should i|explain|describe|tell me|show me|help me understand|walk me through|what if|what about)\b/.test(lower),
    codeQuestion: /\b(this|that|the|my|our)\s+(file|component|function|code|page|route|hook|style|class|module)\b/.test(lower),
    brainstorm:   /\b(brainstorm|ideas?|suggest|recommend|thoughts? on|options? for|alternatives?|pros and cons|compare|what would|how would|best way|should i use)\b/.test(lower),
    discussion:   /\b(discuss|talk about|understand|learn|clarify|difference between|when to use|why use|purpose of|overview of|what is)\b/.test(lower),

    // WEBSITE_GENERATION
    creationVerb:   /^(build|create|generate|make|scaffold|spin up|launch|start|design|produce)\b/.test(lower),
    creationTarget: /\b(landing page|homepage|portfolio|agency site|business website|company site|website|web app|saas app|ecommerce|blog|startup site|restaurant site)\b/.test(lower),
    fromScratch:    /\b(from scratch|new website|new site|brand new|fresh project|starting fresh)\b/.test(lower),

    // WEBSITE_ENGINEERING
    modVerb:    /^(add|change|update|modify|fix|improve|remove|delete|replace|refactor|style|edit|rename|move|reorder|resize|rewrite|restructure|adjust|tweak|convert|enable|disable|toggle|implement|integrate|connect|wire|set|put|make)\b/.test(lower),
    modContext: /\b(make it|make the|turn it|switch to|set the|apply a|drop the|strip the|clean up|simplify|use a|put a|move the)\b/.test(lower),
    uiToggle:   /\b(dark mode|light mode|responsive|mobile|tablet|desktop|accessibility|a11y|seo|performance|animation|transition|hover|focus|loading state|error state|empty state)\b/.test(lower),
    uiElement:  /\b(?:the\s+)?(header|footer|navbar|nav bar|hero|sidebar|button|form|card|modal|dialog|banner|section|layout|page|component|colors?|font|spacing|padding|margin|border|shadow|icon|image|logo)\b/.test(lower),
    codeAction: /\b(import|export|type|interface|hook|api call|fetch|mutation|query|props|state|context|ref|effect|callback)\b/.test(lower),
  }

  // ── Score each mode ─────────────────────────────────────────────────────────
  let convScore = 0
  if (sig.greeting)     convScore += 0.90
  if (sig.question)     convScore += 0.75
  if (sig.codeQuestion) convScore += 0.55
  if (sig.brainstorm)   convScore += 0.65
  if (sig.discussion)   convScore += 0.65
  convScore = Math.min(convScore, 1.0)

  let genScore = 0
  if (sig.creationVerb && sig.creationTarget) genScore += 0.85
  else if (sig.creationVerb)                  genScore += 0.45
  if (sig.fromScratch)                        genScore += 0.70
  if (sig.creationTarget && !sig.modVerb)     genScore += 0.30
  genScore = Math.min(genScore, 1.0)

  let engScore = 0
  if (sig.modVerb)                                    engScore += 0.80
  if (sig.modContext)                                  engScore += 0.55
  if (sig.uiToggle)                                    engScore += 0.65
  if (sig.uiElement && (sig.modVerb || sig.modContext)) engScore += 0.45
  if (sig.codeAction)                                  engScore += 0.45
  engScore = Math.min(engScore, 1.0)

  // ── Context adjustments ─────────────────────────────────────────────────────
  if (!hasProject) {
    // No project files — engineering is not applicable
    engScore = 0
    genScore = Math.min(genScore * 1.3, 1.0)
  } else {
    // Project exists — generation from the studio is very unlikely
    genScore *= 0.25
    engScore = Math.min(engScore * 1.1, 1.0)
  }

  // ── Pick winner ─────────────────────────────────────────────────────────────
  const candidates: [RoutingMode, number][] = [
    ["CONVERSATION",        convScore],
    ["WEBSITE_GENERATION",  genScore],
    ["WEBSITE_ENGINEERING", engScore],
  ]
  const [mode, confidence] = candidates.reduce((a, b) => b[1] > a[1] ? b : a)

  // ── Build reason string for telemetry ───────────────────────────────────────
  const activeSignals = (Object.entries(sig) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k)
  const reason = [
    ...activeSignals,
    hasProject ? "project:exists" : "project:empty",
  ].join(", ") || "no-signal"

  const ENDPOINTS: Record<RoutingMode, string> = {
    CONVERSATION:        "POST /api/copilot/agent",
    WEBSITE_GENERATION:  "POST /api/generate/website-v2",
    WEBSITE_ENGINEERING: "POST /api/website-v2/projects/:id/edit",
  }

  return { mode, confidence, reason, endpoint: ENDPOINTS[mode] }
}

// ─── Convert a live-generation ConversationEntry into the shared TimelineEntry
// shape so the initial build streams through the exact same markdown,
// grouping, and card components as the post-generation editing chat — one
// visual surface for Website Studio everywhere, never two.
function toTimelineEntry(entry: WSConversationEntry): TimelineEntry {
  const time = new Date(entry.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  switch (entry.kind) {
    case "thinking":
      return { kind: "thinking", text: entry.text, id: entry.id, time }
    case "user":
      return { kind: "user-msg", text: entry.text, id: entry.id, time }
    case "agent":
      return { kind: "agent-msg", text: entry.text, id: entry.id, time }
    case "tool":
      return {
        kind: "tool-call", name: entry.tool, params: entry.path ? { path: entry.path } : {},
        status: entry.status === "failed" ? "error" : entry.status,
        result: entry.detail, id: entry.id, time,
      }
    case "plan":
      return { kind: "plan", text: entry.text, id: entry.id, time }
    case "scan":
      return {
        kind: "scan", status: entry.status === "failed" ? "error" : entry.status,
        summary: entry.summary, id: entry.id, time,
      }
    case "validation":
      return { kind: "validation", success: entry.success, errors: entry.errors, fixed: entry.fixed, id: entry.id, time }
    case "file-change":
      return {
        kind: "file-change",
        change: { path: entry.path, operation: entry.operation },
        id: entry.id, time,
      }
  }
}

// ─── Component ────────────────────────────────────────────────────────────────
interface AgentConversationProps {
  project: V2Project
  onEditComplete: () => void
  onFileOpen: (file: V2ProjectFile) => void
  /** Persists a single file's content immediately — no separate confirmation
   *  step. Marcus applies every change as it happens, the same way Replit's
   *  own agent does. */
  persistFile: (path: string, content: string) => Promise<void>
  externalInput?: string | null
  onExternalInputConsumed?: () => void
  editorContext?: {
    activeFilePath: string | null
    activeFileContent: string | null
    selection: string | null
    terminalOutput: string
    fileTree: string
  }
  /** Optional live generation session. While its status is "generating", this
   *  component renders the streaming build activity (no input box — it's a
   *  fire-and-forget run) instead of the interactive editing chat. Once the
   *  session moves past "generating" (or is absent), the normal chat takes
   *  over automatically. There is only ever one panel, never two. */
  generationSession?: WSSessionState | null
}

export function AgentConversation({
  project,
  onEditComplete,
  onFileOpen,
  persistFile,
  externalInput,
  onExternalInputConsumed,
  editorContext,
  generationSession,
}: AgentConversationProps) {
  const isGenerating = generationSession?.status === "generating"
  const generationTimeline = useMemo(
    () => (generationSession?.conversation ?? []).map(toTimelineEntry),
    [generationSession?.conversation],
  )
  const { status: wcStatus, readFile, listDir, runCommand } = useWebContainer()

  // ── State ──────────────────────────────────────────────────────────────────
  const [input, setInput] = useState("")

  // ── Unified Timeline State (Layer 1 + 2 + 3) ───────────────────────────────
  // Single source of truth. All events: user, assistant, activity, execution, error, thinking.
  // Render order = array order. Never replace — only append/update via reducer.
  const [timeline, dispatchTimeline] = useReducer(timelineReducer, [] as TimelineEvent[])

  // Legacy state for compatibility during transition
  const [phase, setPhase] = useState<string | null>(null)
  const [projectMemory, setProjectMemory] = useState<WSProjectMemory | null>(null)
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done" | "error">("idle")
  const [conversation, setConversation] = useState<WSAgentMessage[]>([])
  const [isRunning, setIsRunning] = useState(false)

  // Activity Stream state (Layer 2 — Live System Activity)
  // Reads from the ActivityEngine — the single source of truth for AI execution state.
  const [activityQueue, setActivityQueue] = useState<Activity[]>(() => activityEngine.getQueue())

  // Streaming state - use a single message being built
  const [streamingMessage, setStreamingMessage] = useState<{
    text: string
    thinking: string
    toolCalls: Array<{ id: string; name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string }>
    diffs: Array<{ id: string; path: string; oldContent: string; newContent: string }>
  } | null>(null)
  
  // Track if streaming is done (for cursor cleanup)
  const isStreamingRef = useRef(false)

  const abortRef      = useRef<AbortController | null>(null)
  const bottomRef     = useRef<HTMLDivElement | null>(null)
  const runtimeRef    = useRef<WebsiteStudioRuntime | null>(null)

  // Website Studio session context
  const { state: wsSession, dispatch: wsDispatch } = useWSSessionContext()
  const { start: startGeneration, cancel: cancelGeneration } = useWSSessionStream()

  // Website Studio's own generation activity bus — independent of Marcus.
  // Used only to decide whether to render the inline activity block at all;
  // GenerationActivity itself renders nothing when there are no events.
  const { events: generationBusEvents } = useGenerationEvents()
  const hasGenerationActivity = generationBusEvents.length > 0

  // ── Generation events → ActivityEngine ────────────────────────────────────
  // Phase 12.5.2: Generation progress maps to the ActivityEngine so it appears
  // in the activity strip alongside edit pipeline activities.
  // No frontend-generated AI dialogue — the activity layer reports state only.
  const prevGenEventRef = useRef<GenerationEventType | null>(null)
  useEffect(() => {
    if (generationBusEvents.length === 0) {
      prevGenEventRef.current = null
      return
    }
    const lastEvent = generationBusEvents[generationBusEvents.length - 1]

    // Complete any running activities from the previous phase
    const completeRunning = () => {
      const running = activityEngine.getRunning()
      for (const a of running) activityEngine.complete(a.id)
    }

    switch (lastEvent.type) {
      case "GENERATION_STARTED":
        prevGenEventRef.current = "GENERATION_STARTED"
        activityEngine.start("thinking", "Thinking…", "Analyzing your request…")
        break
      case "PLANNING_STARTED":
        completeRunning()
        activityEngine.start("planning", "Planning…", "Planning the website structure…")
        break
      case "DESIGN_STARTED":
        completeRunning()
        activityEngine.start("working", "Designing…", "Creating the design system…")
        break
      case "ASSET_GENERATION_STARTED":
        completeRunning()
        activityEngine.start("working", "Creating assets…", "Preparing images and assets…")
        break
      case "CODE_GENERATION_STARTED":
        completeRunning()
        activityEngine.start("writing", "Writing…", "Generating components and pages…")
        break
      case "REVIEW_STARTED":
        completeRunning()
        activityEngine.start("testing", "Testing…", "Validating the generated project…")
        break
      case "GENERATION_COMPLETED":
        completeRunning()
        activityEngine.start("preview", "Complete", "Your website is ready to preview.")
        setTimeout(() => {
          const running = activityEngine.getRunning()
          for (const a of running) activityEngine.complete(a.id)
        }, 500)
        break
      case "GENERATION_ERROR":
        completeRunning()
        activityEngine.start("error", "Error", lastEvent.message ?? "Generation failed")
        const errRunning = activityEngine.getRunning()
        for (const a of errRunning) activityEngine.fail(a.id, lastEvent.message ?? "Generation failed")
        break
    }
  }, [generationBusEvents])

  // ── Initialize WebsiteStudioRuntime ────────────────────────────────────────
  useEffect(() => {
    runtimeRef.current = new WebsiteStudioRuntime({
      project,
      onEditComplete,
      onFileOpen,
      externalInput,
      onExternalInputConsumed,
      readFile,
      writeFile: persistFile,
      listDir,
      runCommand,
      wcStatus,
    })

    // Subscribe to ActivityEngine for live activity stream
    // Activities only appear in the ActivityStream at the top, not in the timeline.
    const unsubscribeActivity = activityEngine.subscribe((event) => {
      switch (event.type) {
        case "activity.started":
        case "activity.updated":
        case "activity.completed":
        case "activity.failed":
        case "activity.removed": {
          setActivityQueue(activityEngine.getQueue())
          break
        }
      }
    })

    // Subscribe to wsRuntimeEmitter for assistant messages, stream state, phase changes
    const unsubscribeRuntime = wsRuntimeEmitter.subscribe((event: WSRuntimeEvent) => {
      switch (event.type) {
        case "AssistantMessage": {
          const { content, role } = event.payload as { content: string; role: string }
          if (role === "assistant") {
            dispatchTimeline({
              type: "ADD_EVENT",
              event: {
                id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                timestamp: Date.now(),
                type: "assistant",
                payload: { text: content },
              },
            })
            // Also add to conversation state for runtime context
            setConversation(prev => [...prev, { role: "assistant", content }])
          }
          // Clear streaming message since we now have the final response in timeline
          setStreamingMessage(null)
          break
        }
        case "StreamDone": {
          setIsRunning(false)
          setStreamingMessage(null)
          break
        }
        case "StreamError": {
          const { error } = event.payload as { error: string }
          dispatchTimeline({
            type: "ADD_EVENT",
            event: {
              id: `error-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              timestamp: Date.now(),
              type: "error",
              payload: { message: error },
            },
          })
          setIsRunning(false)
          break
        }
        case "PhaseChanged": {
          const { phase } = event.payload as { phase: string }
          setPhase(phase || null)
          break
        }
        case "FileWritten": {
          // File writes are transient — they don't need a permanent chat message.
          // The ActivityStream at the top already shows live file operations.
          break
        }
        case "TextDelta": {
          // Text streaming during conversation — update streaming message
          const { content } = event.payload as { content: string }
          setStreamingMessage(prev => {
            if (!prev) return null
            return { ...prev, text: (prev.text || '') + content }
          })
          break
        }
        case "ThinkingDelta": {
          // Thinking content during conversation
          const { content } = event.payload as { content: string }
          setStreamingMessage(prev => {
            if (!prev) return null
            return { ...prev, thinking: (prev.thinking || '') + content }
          })
          break
        }
      }
    })

    return () => {
      unsubscribeActivity()
      unsubscribeRuntime()
    }
  }, [project, onEditComplete, onFileOpen, persistFile, externalInput, onExternalInputConsumed, readFile, listDir, runCommand, wcStatus])

  // P2 — accept external prompt from inline AI commands
  useEffect(() => {
    if (externalInput) {
      setInput(externalInput)
      onExternalInputConsumed?.()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalInput])

  // ── Auto-scan project when WC becomes ready ────────────────────────────────
  useEffect(() => {
    if (wcStatus !== "ready" || scanStatus !== "idle") return
    runtimeRef.current?.scanProject()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wcStatus])

  // ── Scroll to bottom ───────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [timeline, streamingMessage])

// ─── Handlers ───────────────────────────────────────────────────────────────
const submit = useCallback(async () => {
  const text = input.trim()
  if (!text || isRunning) return
  setInput("")

  // Add user message to timeline IMMEDIATELY — user message always appears first
  const userEvent: TimelineEvent = {
    id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: Date.now(),
    type: "user",
    payload: { text },
  }
  dispatchTimeline({ type: "ADD_EVENT", event: userEvent })

  // Add user message to conversation state for runtime context
  const updatedConv = [...conversation, { role: "user" as const, content: text }]
  setConversation(updatedConv)
  setIsRunning(true)

  // ── Phase S1.1: Deterministic routing ──────────────────────────────────────
  const hasProject = project.files.length > 0
  const routing = routeIntent(text, hasProject)

  // Routing telemetry — visible in DevTools console
  console.log("[Routing]", {
    mode:       routing.mode,
    confidence: routing.confidence.toFixed(2),
    reason:     routing.reason,
    endpoint:   routing.endpoint,
    input:      text.slice(0, 80),
  })

  // Low confidence — ask for clarification instead of guessing
  if (routing.confidence < ROUTING_CONFIDENCE_THRESHOLD) {
    const clarifyEvent: TimelineEvent = {
      id: `agent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      type: "agent",
      payload: {
        text: "Could you clarify — would you like me to edit your website, or are you asking a question about the project?",
      },
    }
    dispatchTimeline({ type: "ADD_EVENT", event: clarifyEvent })
    setIsRunning(false)
    return
  }

  // Initialize streaming state for conversation responses
  if (routing.mode === "CONVERSATION") {
    setStreamingMessage({ text: "", thinking: "", toolCalls: [], diffs: [] })
  }

  // Forward mode to the runtime for pipeline routing
  if (runtimeRef.current) {
    await runtimeRef.current.submit(text, conversation, routing.mode)
  }
}, [input, isRunning, conversation, editorContext])

  const cancel = useCallback(() => {
    if (runtimeRef.current) {
      runtimeRef.current.cancel()
    }
  }, [])

  // ── Status label ────────────────────────────────────────────────────────────
  // Canned, professional narration only — never `generationSession.phaseMessage`
  // or the raw `currentPhase` key. Both are forwarded straight from Marcus's
  // internal loop-phase reporting and can contain raw execution text (e.g.
  // internal step labels, tool-call syntax) that must never reach the AI
  // Engineer header. See Phase 10.4.4.
  const GENERATION_PHASE_LABELS: Record<string, string> = {
    UNDERSTAND: "Understanding the request…",
    PLAN:       "Planning the update…",
    EXECUTE:    "Updating components…",
    OBSERVE:    "Validating the result…",
    VALIDATE:   "Validating the result…",
    FIX:        "Refining the build…",
    REPORT:     "Wrapping up…",
  }
  const statusLabel = (() => {
    if (isGenerating) {
      const phase = generationSession?.currentPhase
      return (phase && GENERATION_PHASE_LABELS[phase]) || "Building your website…"
    }
    if (wcStatus !== "ready") return `WC ${wcStatus}…`
    if (scanStatus === "scanning") return "Scanning project…"
    if (phase?.startsWith("executing")) return `Executing (iter ${phase.split("-")[1]})…`
    if (isRunning) return "Working…"
    return "Ready"
  })()

  const statusColor = (() => {
    if (isGenerating) return "text-[#ECECEC]"
    if (wcStatus !== "ready") return "text-[#ECECEC]"
    if (isRunning) return "text-[#ECECEC]"
    return "text-emerald-400/60"
  })()

  const dotColor = (() => {
    if (isGenerating || isRunning || wcStatus !== "ready") return "bg-[#ECECEC]"
    return "bg-emerald-400"
  })()

  // Real cancellation only exists for the interactive editing runtime (isRunning).
  // The initial full-site build (isGenerating) is fire-and-forget with no cancel
  // hook wired — presenting a non-functional "Stop" for it would be dishonest,
  // so it gets an inert "Generating…" state instead.
  const canStop = isRunning && !isGenerating

  // Which timeline/streaming content is on screen right now — the live build
  // stream while generating, otherwise the interactive editing chat.
  const displayTimeline = isGenerating ? generationTimeline : timeline
  const displayStreamingText = isGenerating ? generationSession?.streamingText : undefined
  const showEmptyState = displayTimeline.length === 0 && !isRunning && !streamingMessage && !displayStreamingText

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#202020]">

      {/* Running glow */}
      <AnimatePresence>
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[2px]"
            style={{ background: "linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.1) 30%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 70%, transparent 100%)" }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
              style={{ background: "inherit", filter: "blur(4px)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative flex flex-shrink-0 items-center gap-3 border-b border-[#303030] px-4 py-3">
        <AnimatePresence>
          {isRunning && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, transparent 60%)" }}
            />
          )}
        </AnimatePresence>

        <div className="relative z-[1] flex-shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#232323] ring-1 ring-[#303030]">
            <Cpu className="h-3.5 w-3.5 text-[#ECECEC]" />
          </div>
          <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#202020] transition-colors duration-500 ${dotColor}`}>
            {isRunning && <div className="absolute inset-0 animate-ping rounded-full bg-[#ECECEC] opacity-60" />}
          </div>
        </div>

        <div className="relative z-[1] min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-[#ECECEC]">AI Builder</span>
            <span className={`text-[10px] font-mono ${statusColor}`}>{statusLabel}</span>
          </div>
        </div>
      </div>

      {/* Conversation area — one continuous vertical feed. Each top-level item
          gets a subtle bottom divider instead of its own card, so the chat
          reads as a single stream rather than a stack of boxes. */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
{/* ── Phase 14.1A: Engineering Timeline (during edits) ────────────── */}
      {/* During editing: show the unified Engineering Timeline instead of the
          transient ActivityStream. During generation: keep legacy activity. */}
      <AnimatePresence mode="wait">
        {isRunning ? (
          <motion.div
            key="engineering-panels"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            {/* Phase 15.2: Engineering Command Center — unified engineering dashboard */}
            <EngineeringCommandCenter />
          </motion.div>
        ) : (
          <motion.div key="activity-stream">
            <ActivityStream queue={activityQueue ?? []} />
          </motion.div>
        )}
      </AnimatePresence>

        <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-3 break-words">

          {/* Empty state */}
          {showEmptyState && (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex flex-1 flex-col items-center justify-center text-center"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-[#303030] bg-[#232323]">
                <Zap className="h-7 w-7 text-[#A0A0A0]/50" />
              </div>
              <h2 className="text-base font-semibold text-[#ECECEC]/80">Start a conversation</h2>
              <p className="mt-1.5 max-w-[260px] text-sm text-[#A0A0A0] leading-relaxed">
                Describe what you want to build, edit, or explain anything in your project.
              </p>
            </motion.div>
          )}

          {/* Phase 14.1A: Generation activity hidden during editing — EngineeringTimeline replaces it */}
          {hasGenerationActivity && !isRunning && (
            <FeedItem>
              <GenerationActivity />
            </FeedItem>
          )}

          {/* Unified Timeline — renders all events in order */}
          {!isGenerating && (
            <AnimatePresence initial={false}>
              {timeline.map((event) => (
                <FeedItem key={event.id}>
                  <TimelineEventRenderer event={event} project={project} onFileOpen={onFileOpen} />
                </FeedItem>
              ))}
            </AnimatePresence>
          )}

          {/* Streaming message (assistant response being built) — same
              generation-only suppression as the timeline above. */}
          {!isGenerating && streamingMessage && (
            <FeedItem>
              <StreamingMessage message={streamingMessage} />
            </FeedItem>
          )}

          {/* Bottom anchor for scroll */}
          <div ref={bottomRef} />
        </div>

        {/* Website Studio's own composer — orbit, textarea, attachments. Fully
            decoupled from the AgentRuntime/timeline above: it only receives the
            input text and generating/running flags, never Marcus internals. */}
        <WebsiteStudioComposer
          value={input}
          onChange={setInput}
          onSubmit={() => void submit()}
          onCancel={cancel}
          isGenerating={isGenerating}
          isRunning={isRunning}
          canStop={canStop}
        />
      </div>
    </div>
  )
}

// ─── Streaming message component ───────────────────────────────────────────────
interface StreamingMessage {
  thinking?: string
  text?: string
  toolCalls: Array<{ id: string; name: string; params: Record<string, unknown>; status: "running" | "done" | "error"; result?: string }>
  diffs: Array<{ id: string; path: string; oldContent: string; newContent: string }>
}

// Blinking cursor dot
function TypingCursor() {
  return (
    <motion.span
      className="inline-flex h-[1.1em] w-[2px] translate-y-[1px] rounded-full bg-[#A0A0A0]"
      animate={{ opacity: [1, 0.15, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
    />
  )
}

function StreamingMessage({ message }: { message: StreamingMessage }) {
  const hasRunningTool = message.toolCalls.some(tc => tc.status === "running")
  const hasContent = !!message.text || !!message.thinking || message.toolCalls.length > 0 || message.diffs.length > 0
  const isStreamingText = !!message.text && (hasRunningTool || !!message.thinking)

  // Don't render if there's nothing to show
  if (!hasContent) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="pl-2"
    >
      <div className="flex-1 min-w-0 space-y-3">
        {/* Thinking block */}
        {message.thinking && (
          <ThinkingBlock text={message.thinking} isStreaming={!message.text} />
        )}

        {/* Streaming text with typing cursor */}
        {message.text && (
          <div className="prose prose-invert max-w-none">
            <Markdown text={message.text} />
            {isStreamingText && <TypingCursor />}
          </div>
        )}

        {/* Initial thinking indicator when no text yet but tool calls are running */}
        {!message.text && hasRunningTool && (
          <div className="flex items-center gap-2 text-[12px] text-[#A0A0A0]">
            <span className="flex gap-0.5">
              <motion.span className="h-1.5 w-1.5 rounded-full bg-[#A0A0A0]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0 }} />
              <motion.span className="h-1.5 w-1.5 rounded-full bg-[#A0A0A0]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.15 }} />
              <motion.span className="h-1.5 w-1.5 rounded-full bg-[#A0A0A0]" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: 0.3 }} />
            </span>
            <span>Processing</span>
          </div>
        )}

        {/* Tool calls */}
        {message.toolCalls.map((tc) => (
          <ToolCallCard
            key={tc.id}
            call={{ name: tc.name, params: tc.params }}
            status={tc.status}
            result={tc.result ? { name: tc.name, params: tc.params, result: tc.result, ok: tc.status === "done" } : undefined}
          />
        ))}

        {/* Diff previews */}
        {message.diffs.map((diff) => (
          <motion.div
            key={diff.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-lg border border-[#303030] bg-[#232323] p-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <FileCode className="h-3.5 w-3.5 text-[#A0A0A0]" />
              <span className="truncate font-mono text-[11px] text-[#A0A0A0]">{diff.path}</span>
              <span className="ml-auto rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
                style={{ background: diff.oldContent ? "#60a5fa15" : "#34d39915", color: diff.oldContent ? "#60a5fa" : "#34d399" }}>
                {diff.oldContent ? "update" : "create"}
              </span>
            </div>
            <div className="rounded bg-[#202020] p-2 text-[9px] font-mono overflow-x-auto max-h-48">
              <pre>{diff.oldContent ? generateDiff(diff.oldContent, diff.newContent) : diff.newContent}</pre>
            </div>
          </motion.div>
        ))}

        {/* Continue/Cancel controls during execution */}
        {hasRunningTool && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 pt-2 border-t border-[#303030]"
          >
            <span className="text-[11px] text-[#A0A0A0]">Executing tools…</span>
            <div className="flex-1 h-1 bg-[#303030] rounded overflow-hidden">
              <motion.div
                className="h-full bg-[#ECECEC]"
                animate={{ width: ["0%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

// Simple diff generator
function generateDiff(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split("\n")
  const newLines = newStr.split("\n")
  const maxLines = Math.max(oldLines.length, newLines.length)
  let diff = ""
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i]
    const newLine = newLines[i]
    if (oldLine === newLine) {
      diff += `  ${oldLine ?? ""}\n`
    } else if (oldLine !== undefined && newLine === undefined) {
      diff += `- ${oldLine}\n`
    } else if (oldLine === undefined && newLine !== undefined) {
      diff += `+ ${newLine}\n`
    } else {
      diff += `- ${oldLine}\n+ ${newLine}\n`
    }
  }
  return diff
}

// ─── Feed item — the unit of the continuous vertical feed. Every top-level
// block (a message, a grouped set of actions, the build activity, a streaming
// reply) renders inside one of these, so separation comes from a single
// subtle divider rather than each block carrying its own card chrome. ───────
function FeedItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="py-1.5 first:pt-0">
      {children}
    </div>
  )
}

// ─── Unified Timeline Event Renderer ──────────────────────────────────────────
// Renders events from the new unified timeline system.
// User messages: right-aligned with rounded card corners (no avatar)
// Assistant messages: left-aligned plain text (no card, no avatar)
function TimelineEventRenderer({ event }: { event: TimelineEvent }) {
  const isUser = event.type === "user"

  // User message — right-aligned with rounded card corners
  if (event.type === "user") {
    const payload = event.payload as UserPayload
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end"
      >
        <div className="rounded-xl rounded-br-sm bg-[#2A2A2A] px-3 py-2 text-[#ECECEC] max-w-[85%] break-words">
          <Markdown text={payload.text} />
        </div>
      </motion.div>
    )
  }

  // Assistant natural response — left-aligned, no card, no background
  if (event.type === "assistant") {
    const payload = event.payload as AssistantPayload
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-start"
      >
        <div className="max-w-[90%] text-[#ECECEC] leading-relaxed">
          {payload.phase && (
            <span className="mb-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide"
              style={{
                background: payload.phase === "error" ? "#ef444415" : "#10b98115",
                color: payload.phase === "error" ? "#ef4444" : "#10b981"
              }}
            >
              {payload.phase}
            </span>
          )}
          <Markdown text={payload.text} />
        </div>
      </motion.div>
    )
  }

  // Error event
  if (event.type === "error") {
    const payload = event.payload as ErrorPayload
    return (
      <motion.div
        key={event.id}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.18 }}
        className="flex items-center gap-2.5 py-1"
      >
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full" style={{ background: "#ef444415" }}>
          <AlertCircle className="h-3 w-3 text-red-400" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-[11px] text-red-300/80">{payload.message}</span>
        </div>
      </motion.div>
    )
  }

  // Thinking event
  if (event.type === "thinking") {
    const payload = event.payload as ThinkingPayload
    return (
      <ThinkingBlock key={event.id} text={payload.text} isStreaming={payload.isStreaming} />
    )
  }

  return null
}