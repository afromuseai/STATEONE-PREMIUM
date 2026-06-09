import { useState, useRef, useEffect, useCallback } from "react";
import { useCopilot } from "@/lib/copilot-context";
import { useLang } from "@/lib/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  X,
  Send,
  Sparkles,
  RotateCcw,
  Minimize2,
  Globe,
  Workflow,
  Brain,
  Rocket,
  BarChart3,
  TrendingUp,
  Zap,
  Target,
  ChevronRight,
  MessageSquare,
  Activity,
  CheckCircle2,
  Clock,
  Layers,
  FolderOpen,
  MapPin,
  ChevronDown,
  ArrowRight,
  XCircle,
  Loader2,
} from "lucide-react";
import { useBusinessContext } from "@/lib/business-context";
import { useAuth } from "@/lib/auth-context";
import { api, type Project } from "@/lib/api";
import {
  setCopilotAutorun,
  setMarcusWorkspaceSignal,
  setPendingIntent,
  markPendingIntentAutoGenerate,
  saveProjectContext,
} from "@/lib/generation-context";
import { useWorkspaceController } from "@/lib/workspace-controller-context";
import { ListChecks, Trash2 } from "lucide-react";
import { Orbit } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  hidden?: boolean;
}

interface DetectedAction {
  id: string;
  label: string;
  detail: string;
}

const ACTION_TAG_RE = /\{\{ACTION:([^|]+)\|([^|]+)\|([^}]+)\}\}/;
const NAVIGATE_TAG_RE = /\{\{NAVIGATE:([^|}]+)(?:\|[^}]*)?\}\}/;
const EXECUTE_TAG_RE = /\{\{EXECUTE:([^|]+)\|([^|]+)(?:\|([^}]*))?\}\}/;
const WORKSPACE_TAG_RE = /\{\{WORKSPACE:([^|]+)\|(\[[\s\S]*?\])\}\}/;
// Matches {{WORKSPACE|command}} or {{WORKSPACE|command|text payload}} (Marcus execution commands — pipe variant)
const WORKSPACE_CMD_RE = /\{\{WORKSPACE\|([^|}\n]+?)(?:\|([^}]*))?\}\}/;
// Matches {{WORKSPACE:command}} or {{WORKSPACE:command|text payload}} where payload is NOT a JSON array
// Handles model hallucination: model sometimes emits colon-variant instead of pipe-variant for execution commands
const WORKSPACE_CMD_COLON_RE =
  /\{\{WORKSPACE:([^|}\n]+?)(?:\|(?!\[)([^}]*))?\}\}/;
// Matches any complete event tag in the stream
const ANY_TAG_RE = () =>
  /\{\{(?:ACTION:[^|]+\|[^|]+\|[^}]+|NAVIGATE:[^|}]+(?:\|[^}]*)?|EXECUTE:[^|]+\|[^|]+(?:\|[^}]*)?|WORKSPACE:[^|]+\|\[[\s\S]*?\]|WORKSPACE:[^|}\n]+?(?:\|(?!\[)[^}]*)?|WORKSPACE\|[^|}\n]+?(?:\|[^}]*)?)\}\}/g;

const ACTION_ROUTES: Record<string, string> = {
  generate_website: "/website-generator",
  generate_intelligence: "/dashboard",
  open_agents: "/agents",
  open_automation: "/automation-builder",
  open_chatbot: "/chatbot-generator",
  open_deployments: "/deployments",
  open_orchestrator: "/orchestrator",
  create_project: "/dashboard",
  open_memory: "/memory",
  open_templates: "/templates",
};

interface WorkspaceContext {
  activePage: string;
  activePagePath: string;
  currentProject: {
    id: string;
    title: string;
    businessIdea: string;
    hasBi: boolean;
    hasWebsite: boolean;
  } | null;
  modules: {
    businessIntelligence: boolean;
    website: boolean;
    chatbot: boolean;
    automation: boolean;
  };
  projectCount: number;
  activeAgents: number;
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
};

function getPageName(path: string): string {
  const clean = path.split("?")[0];
  if (PAGE_NAMES[clean]) return PAGE_NAMES[clean];
  if (clean.startsWith("/projects/")) return "Project";
  return "Workspace";
}

const QUICK_COMMANDS = [
  {
    icon: TrendingUp,
    label: "Improve scalability",
    prompt:
      "How can I improve the scalability score and reach exponential growth in my business?",
  },
  {
    icon: Workflow,
    label: "Onboarding workflow",
    prompt:
      "Generate a detailed onboarding automation workflow for new customers with specific tools and triggers.",
  },
  {
    icon: Target,
    label: "Monetization strategy",
    prompt:
      "What are the most effective monetization strategies for my business type? Give me specific pricing models and revenue levers.",
  },
  {
    icon: Brain,
    label: "Explain my metrics",
    prompt:
      "Can you explain what each business intelligence metric means and how I can improve the ones that are low?",
  },
  {
    icon: Zap,
    label: "Growth tactics",
    prompt:
      "Give me 5 specific, tactical growth strategies I can execute in the next 30 days with measurable outcomes.",
  },
  {
    icon: Globe,
    label: "Website strategy",
    prompt:
      "What pages and conversion elements should my website have to maximize lead generation and sales?",
  },
  {
    icon: Rocket,
    label: "Deploy a project",
    prompt:
      "How do I deploy my generated website or application to production using STAGEONE?",
  },
  {
    icon: BarChart3,
    label: "New analysis",
    prompt:
      "Help me craft a detailed business idea for analysis. Ask me questions about my target market and goals.",
  },
];

const MODULE_LABELS = [
  {
    key: "businessIntelligence",
    label: "Business Intelligence",
    icon: BarChart3,
  },
  { key: "website", label: "Website", icon: Globe },
  { key: "chatbot", label: "Chatbot", icon: MessageSquare },
  { key: "automation", label: "Automation", icon: Workflow },
] as const;

function renderMessage(content: string) {
  if (!content) return null;
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      elements.push(<div key={i} className="h-1" />);
      i++;
      continue;
    }

    if (line.startsWith("### ")) {
      elements.push(
        <p
          key={i}
          className="text-xs font-black uppercase tracking-widest text-primary/80 mt-2 mb-0.5"
        >
          {line.slice(4)}
        </p>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <p key={i} className="text-xs font-bold text-foreground mt-2 mb-0.5">
          {line.slice(3)}
        </p>,
      );
    } else if (
      line.startsWith("**") &&
      line.endsWith("**") &&
      line.length > 4
    ) {
      elements.push(
        <p key={i} className="text-sm font-bold text-foreground">
          {line.slice(2, -2)}
        </p>,
      );
    } else if (line.startsWith("- ") || line.startsWith("• ")) {
      elements.push(
        <div key={i} className="flex items-start gap-1.5 my-0.5">
          <span className="mt-1.5 h-1 w-1 rounded-full bg-primary/60 shrink-0" />
          <span className="text-sm leading-relaxed text-muted-foreground">
            {line.slice(2).replace(/\*\*(.*?)\*\*/g, "$1")}
          </span>
        </div>,
      );
    } else if (/^\d+\./.test(line)) {
      const num = line.match(/^(\d+)\./)?.[1];
      const text = line
        .replace(/^\d+\.\s*/, "")
        .replace(/\*\*(.*?)\*\*/g, "$1");
      elements.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary/10 text-[9px] font-bold text-primary mt-0.5">
            {num}
          </span>
          <span className="text-sm leading-relaxed text-muted-foreground">
            {text}
          </span>
        </div>,
      );
    } else {
      const formatted = line.replace(
        /\*\*(.*?)\*\*/g,
        (_, m) => `<strong>${m}</strong>`,
      );
      elements.push(
        <p
          key={i}
          className="text-sm leading-relaxed text-muted-foreground"
          dangerouslySetInnerHTML={{ __html: formatted }}
        />,
      );
    }
    i++;
  }
  return <div className="space-y-0.5">{elements}</div>;
}

const THINKING_PHRASES = [
  "thinking",
  "on it",
  "hold on",
  "let me think",
  "give me a sec",
  "hmm",
  "right",
];
let thinkingIndex = 0;

function ThinkingIndicator() {
  const [phrase] = useState(() => {
    const p = THINKING_PHRASES[thinkingIndex % THINKING_PHRASES.length];
    thinkingIndex++;
    return p;
  });
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
            transition={{
              duration: 1.1,
              repeat: Infinity,
              delay: j * 0.18,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>
    </div>
  );
}

async function streamCopilot(
  payload: {
    messages: Message[];
    businessContext: unknown;
    workspaceContext: WorkspaceContext;
    language: string;
  },
  signal: AbortSignal,
  onChunk: (buffer: string) => void,
  onAction?: (action: DetectedAction) => void,
  onNavigate?: (path: string) => void,
  onExecute?: (id: string, endpoint: string, params?: string) => void,
  onWorkspace?: (command: string, payload: string) => void,
  onWorkspaceCmd?: (command: string, payload: string) => void,
) {
  const res = await fetch("/api/copilot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok || !res.body) throw new Error("Request failed");

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let carry = "";
  let buffer = "";
  const firedTags = new Set<string>();

  function fireAndStripTags() {
    console.log(
      "[TRACE] INPUT TO fireAndStripTags | buffer length:",
      buffer.length,
      "| content:",
      buffer,
    );
    const re = ANY_TAG_RE();
    let match: RegExpExecArray | null;
    while ((match = re.exec(buffer)) !== null) {
      const tag = match[0];
      console.log(
        "[TRACE] EVERY TAG DETECTED | tag:",
        tag,
        "| already fired:",
        firedTags.has(tag),
      );
      if (firedTags.has(tag)) continue;
      firedTags.add(tag);

      const actionMatch = tag.match(ACTION_TAG_RE);
      const navMatch = tag.match(NAVIGATE_TAG_RE);
      const execMatch = tag.match(EXECUTE_TAG_RE);

      const wsMatch = tag.match(WORKSPACE_TAG_RE);
      if (actionMatch) {
        onAction?.({
          id: actionMatch[1].trim(),
          label: actionMatch[2].trim(),
          detail: actionMatch[3].trim(),
        });
      } else if (navMatch) {
        onNavigate?.(navMatch[1].trim());
      } else if (execMatch) {
        onExecute?.(
          execMatch[1].trim(),
          execMatch[2].trim(),
          execMatch[3]?.trim(),
        );
      } else if (wsMatch) {
        onWorkspace?.(wsMatch[1].trim(), wsMatch[2].trim());
      } else {
        const wsCmdMatch = tag.match(WORKSPACE_CMD_RE);
        if (wsCmdMatch) {
          const cmd = wsCmdMatch[1].trim();
          console.log("[WEBSITE TRACE] parser detected", cmd, "| tag:", tag);
          if (cmd.startsWith("generate_")) {
            console.log(
              "[CONFIRM_FLOW:2] fireAndStripTags detected generation command | command:",
              cmd,
              "| timestamp:",
              Date.now(),
            );
          }
          onWorkspaceCmd?.(cmd, wsCmdMatch[2]?.trim() ?? "");
        } else {
          // Colon-variant execution command: model emitted {{WORKSPACE:command}} instead of {{WORKSPACE|command}}
          const wsCmdColonMatch = tag.match(WORKSPACE_CMD_COLON_RE);
          if (wsCmdColonMatch) {
            const cmd = wsCmdColonMatch[1].trim();
            console.log(
              "[WEBSITE TRACE] parser detected (colon-variant)",
              cmd,
              "| tag:",
              tag,
            );
            if (cmd.startsWith("generate_")) {
              console.log(
                "[CONFIRM_FLOW:2] fireAndStripTags detected generation command (colon-variant) | command:",
                cmd,
                "| timestamp:",
                Date.now(),
              );
            }
            onWorkspaceCmd?.(cmd, wsCmdColonMatch[2]?.trim() ?? "");
          }
        }
      }
    }
  }

  function buildDisplay(): string {
    let display = buffer;
    for (const tag of firedTags) display = display.split(tag).join("");
    // Suppress any partial (incomplete) tag at the tail
    const partial = display.match(/\{\{[^}]*$/);
    if (partial) display = display.slice(0, -partial[0].length);
    return display.trimEnd();
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = carry + dec.decode(value, { stream: true });
    const lines = chunk.split("\n");
    carry = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const msg = JSON.parse(line.slice(6));
        if (msg.content) {
          buffer += msg.content;
          // Fire any newly-complete event tags immediately
          fireAndStripTags();
          // Push clean display tokens live to UI
          onChunk(buildDisplay());
        }
      } catch {
        /* fragment */
      }
    }
  }

  // Final pass — catch any tags that completed at the very last chunk
  console.log(
    "[TRACE] RAW ASSISTANT RESPONSE | length:",
    buffer.length,
    "| content:",
    buffer,
  );
  fireAndStripTags();
  const _finalDisplay = buildDisplay();
  console.log(
    "[TRACE] OUTPUT AFTER fireAndStripTags | display:",
    _finalDisplay,
  );
  onChunk(_finalDisplay);
}

interface InsightBubble {
  text: string;
  id: number;
}

// ─── Session persistence helpers ─────────────────────────────────────────────
function storageKey(userId: string) {
  return `copilot:msgs:${userId}`;
}
function greetedKey(userId: string) {
  return `copilot:greeted:${userId}`;
}

// Strip any raw WORKSPACE tags that survived the parser (e.g. from previous sessions or model hallucination)
function stripRawWorkspaceTags(content: string): string {
  return content
    .replace(/\{\{WORKSPACE[^}]*\}\}/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function loadMessages(userId: string): Message[] {
  try {
    const raw = sessionStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const msgs = JSON.parse(raw) as Message[];
    // Strip any raw workspace tags that were persisted by a previous session
    return msgs.map((m) =>
      m.role === "assistant"
        ? { ...m, content: stripRawWorkspaceTags(m.content) }
        : m,
    );
  } catch {
    return [];
  }
}

function saveMessages(msgs: Message[], userId: string) {
  try {
    // Strip raw workspace tags before persisting to prevent them from surviving across reloads
    const clean = msgs
      .filter((m) => !m.hidden)
      .map((m) =>
        m.role === "assistant"
          ? { ...m, content: stripRawWorkspaceTags(m.content) }
          : m,
      );
    sessionStorage.setItem(storageKey(userId), JSON.stringify(clean));
  } catch {
    /* quota exceeded — ignore */
  }
}

export function CopilotPanel() {
  const { user, isLoading } = useAuth();
  const { open, setOpen } = useCopilot();
  const { lang } = useLang();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [bubble, setBubble] = useState<InsightBubble | null>(null);
  const [pendingAction, setPendingAction] = useState<DetectedAction | null>(
    null,
  );
  const [autorunCountdown, setAutorunCountdown] = useState<number | null>(null);
  const autorunTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autorunIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const greeted = useRef(false);
  const loadedUserRef = useRef<string | null>(null);
  const bubbleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCrossSystemRef = useRef<typeof crossSystem | null>(null);
  const prevProjectCountRef = useRef<number | null>(null);
  const streamingRef = useRef(false);
  // Tracks the last bi_idea payload so generate_intelligence can always carry it forward
  const lastBiIdeaRef = useRef<string>("");
  // Tracks the last automation_idea payload so generate_automation can recover it
  const lastAutomationIdeaRef = useRef<string>("");
  const [location, navigate] = useLocation();
  const { businessData, crossSystem } = useBusinessContext();
  const hasBusinessContext = !!businessData?.industry;
  const {
    tasks,
    createTasks,
    toggleTask,
    deleteTask,
    subscribe,
    emitWorkspaceSignal,
  } = useWorkspaceController();

  const { data: projectsData } = useQuery({
    queryKey: ["copilot-projects"],
    queryFn: () => api.projects.list(),
    enabled: !!user && open,
    staleTime: 30_000,
  });

  const { data: memoryData } = useQuery({
    queryKey: ["copilot-memory-count"],
    queryFn: () =>
      fetch("/api/memory", { credentials: "include" }).then((r) =>
        r.json(),
      ) as Promise<{ memories: unknown[] }>,
    enabled: !!user,
    staleTime: 60_000,
    refetchInterval: 90_000,
  });
  const memoryCount = memoryData?.memories?.length ?? 0;

  const projects = projectsData?.projects ?? [];
  const currentProject: Project | null = projects[0] ?? null;

  const modules = {
    businessIntelligence: !!currentProject?.output || !!businessData?.industry,
    website: !!currentProject?.websiteOutput || crossSystem.websiteGenerated,
    chatbot: false,
    automation: crossSystem.automationsConfigured > 0,
  };

  const activePage = getPageName(location);

  const workspaceContext: WorkspaceContext = {
    activePage,
    activePagePath: location,
    currentProject: currentProject
      ? {
          id: currentProject.id,
          title: currentProject.title,
          businessIdea: currentProject.businessIdea.slice(0, 300),
          hasBi: !!currentProject.output,
          hasWebsite: !!currentProject.websiteOutput,
        }
      : null,
    modules,
    projectCount: projects.length,
    activeAgents: crossSystem.agentsInstalled,
  };

  const completedCount = Object.values(modules).filter(Boolean).length;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load persisted messages on user session — ALWAYS reset state on user change or logout
  // SECURITY: never skip setMessages() — if we do, the prior user's messages stay visible
  useEffect(() => {
    const userId = user?.id ?? null;

    // ── Logout / unauthenticated: wipe everything immediately ──────────────────
    if (!userId) {
      if (loadedUserRef.current !== null) {
        console.log(
          "[Marcus:isolation] logout detected — clearing conversation state | previousUserId:",
          loadedUserRef.current,
        );
        setMessages([]);
        greeted.current = false;
        loadedUserRef.current = null;
      }
      return;
    }

    // ── Already loaded for this exact user ─────────────────────────────────────
    if (loadedUserRef.current === userId) return;

    const prevUserId = loadedUserRef.current;
    loadedUserRef.current = userId;

    const sk = storageKey(userId);
    const stored = loadMessages(userId);
    const conversationId = `${userId}:copilot`;

    console.log("userId", userId);
    console.log("projectId", currentProject?.id ?? null);
    console.log("conversationId", conversationId);
    console.log("storageKey", sk);
    console.log(
      "[Marcus:isolation] user changed | prev:",
      prevUserId,
      "→ next:",
      userId,
      "| storedMessages:",
      stored.length,
    );

    // ALWAYS call setMessages — even with [] — so prior user's messages never
    // bleed into the next user's session (the original bug: if stored was empty,
    // setMessages was never called and old messages stayed visible).
    setMessages(stored);
    greeted.current = stored.length > 0;

    if (
      stored.length === 0 &&
      sessionStorage.getItem(greetedKey(userId)) === "1"
    ) {
      greeted.current = true;
    }
  }, [user?.id, currentProject?.id]);

  // Save messages to sessionStorage on every change
  useEffect(() => {
    if (!user?.id || messages.length === 0) return;
    saveMessages(messages, user.id);
    sessionStorage.setItem(greetedKey(user.id), "1");
  }, [messages, user?.id]);

  useEffect(() => {
    if (open && !minimized) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, minimized]);

  // Auto-grow textarea up to 4 lines, then scroll
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 72) + "px";
  }, [input]);

  // ─── Greeting trigger ────────────────────────────────────────────────────────
  const workspaceContextRef = useRef(workspaceContext);
  workspaceContextRef.current = workspaceContext;
  const businessDataRef = useRef(businessData);
  businessDataRef.current = businessData;
  const langRef = useRef(lang);
  langRef.current = lang;
  streamingRef.current = streaming;
  // Ref so triggerGreeting can read the current user id without adding it as a dep
  const userIdRef = useRef(user?.id ?? null);
  userIdRef.current = user?.id ?? null;

  const triggerGreeting = useCallback(async () => {
    if (greeted.current) return;
    // Remount guard: if sessionStorage shows this user has already seen a greeting,
    // don't wipe the chat — just sync the ref and bail.
    const uid = userIdRef.current;
    if (uid && sessionStorage.getItem(greetedKey(uid)) === "1") {
      greeted.current = true;
      return;
    }
    greeted.current = true;
    setStreaming(true);

    const hasContext = !!(
      workspaceContextRef.current?.currentProject ||
      businessDataRef.current?.industry
    );
    const greetingTrigger: Message = {
      role: "user",
      content: hasContext
        ? "Open the conversation. You already know this project. Reference what they're building and where things stand right now — be specific, be direct. Don't introduce yourself, don't say hello, don't use the platform name. Two sentences max, then ask one direct question."
        : "Start the conversation. You don't know anything about their business yet. Ask one question — the single sharpest question to understand what they're building. Just the question, nothing else.",
      hidden: true,
    };
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages([greetingTrigger, assistantMsg]);

    abortRef.current = new AbortController();

    try {
      await streamCopilot(
        {
          messages: [greetingTrigger],
          businessContext: businessDataRef.current,
          workspaceContext: workspaceContextRef.current,
          language: langRef.current,
        },
        abortRef.current.signal,
        (buffer) => {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: buffer,
            };
            return updated;
          });
        },
      );
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setMessages([
          { role: "assistant", content: "What are you working on today?" },
        ]);
      } else if (!(e instanceof Error)) {
        setMessages([
          { role: "assistant", content: "What are you working on today?" },
        ]);
      }
    } finally {
      setStreaming(false);
    }
  }, []);

  // Fire greeting when panel opens — wait for project data or fall back after 900ms.
  // Requires user?.id to be present so we never fire before the loadedUserRef effect
  // has had a chance to restore persisted messages and set greeted.current = true.
  useEffect(() => {
    if (!open || greeted.current || !user?.id) return;

    if (projectsData !== undefined || businessData) {
      triggerGreeting();
      return;
    }

    const timer = setTimeout(() => {
      if (!greeted.current) triggerGreeting();
    }, 900);

    return () => clearTimeout(timer);
  }, [open, projectsData, businessData, triggerGreeting, user?.id]);

  // WORKSPACE — create tasks from AI recommendations
  const handleWorkspaceAction = useCallback(
    async (command: string, rawPayload: string) => {
      if (command !== "create_tasks") return;
      try {
        const titles = JSON.parse(rawPayload) as unknown;
        if (!Array.isArray(titles) || titles.length === 0) return;
        const validTitles = (titles as unknown[])
          .filter(
            (t): t is string => typeof t === "string" && t.trim().length > 0,
          )
          .slice(0, 10);
        if (validTitles.length === 0) return;
        const projectId = currentProject?.id ?? null;
        await createTasks(validTitles, projectId);
        showBubble(
          `${validTitles.length} task${validTitles.length > 1 ? "s" : ""} added to your workspace.`,
        );
      } catch {
        /* malformed JSON — ignore */
      }
    },
    [createTasks, currentProject?.id],
  ); // eslint-disable-line react-hooks/exhaustive-deps

  // NAVIGATE — fires immediately on tag detection, switches tab without waiting for stream
  const handleNavigate = useCallback(
    (path: string) => {
      navigate(path);
    },
    [navigate],
  );

  // EXECUTE — fires a fire-and-forget backend call on tag detection
  const handleExecute = useCallback(
    (id: string, endpoint: string, params?: string) => {
      const url = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
      let body: Record<string, unknown> = { action: id };
      if (params) {
        try {
          body = { ...body, ...JSON.parse(params) };
        } catch {
          body.params = params;
        }
      }
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      }).catch(() => {
        /* fire-and-forget — failure is non-fatal */
      });
    },
    [],
  );

  // WORKSPACE CMD — Marcus execution commands: open tabs, populate forms, trigger generation
  const handleWorkspaceCmdAction = useCallback(
    (command: string, payload: string) => {
      if (command === "chatbot") {
        console.log(
          "[PIPELINE:3] chatbot command received | payload:",
          JSON.stringify(payload),
        );
        // Intentional no-op: idea always follows and will navigate.
      } else if (command === "idea") {
        console.log(
          "[PIPELINE:4] idea command received | raw payload:",
          JSON.stringify(payload),
        );
        const idea = payload.trim();
        if (!idea) {
          console.log(
            "[PIPELINE:4] idea payload is EMPTY — early return, no setPendingIntent, no navigate",
          );
          return;
        }
        console.log(
          "[PIPELINE:5] calling setPendingIntent | idea:",
          JSON.stringify(idea),
        );
        if (currentProject) {
          saveProjectContext({ projectId: currentProject.id, projectTitle: currentProject.title, originatingBusinessIntelligenceId: currentProject.id });
        }
        setPendingIntent({ type: "chatbot", idea, autoGenerate: false });
        const raw = sessionStorage.getItem("stageone_pending_intent");
        console.log("[PIPELINE:6] sessionStorage after setPendingIntent:", raw);
        navigate("/chatbot-generator");
      } else if (command === "generate_chatbot") {
        markPendingIntentAutoGenerate("chatbot");
        navigate("/chatbot-generator");
      } else if (command === "intelligence") {
        navigate("/dashboard?tab=new");
      } else if (command === "bi_idea") {
        const idea = payload.trim();
        if (!idea) return;
        lastBiIdeaRef.current = idea;
        setMarcusWorkspaceSignal({
          target: "intelligence",
          type: "populate",
          payload: idea,
        });
        if (!location.startsWith("/dashboard")) navigate("/dashboard?tab=new");
        emitWorkspaceSignal({
          target: "intelligence",
          type: "populate",
          payload: idea,
        });
      } else if (command === "generate_intelligence") {
        // Always carry the idea as payload — subscriber must not rely on ref timing
        emitWorkspaceSignal({
          target: "intelligence",
          type: "generate",
          payload: lastBiIdeaRef.current,
        });
      } else if (command === "website") {
        // Navigate only — NEVER overwrite a pending intent here.
        // website_idea (which fires after or instead of this) writes the real idea.
        // Writing an empty intent here caused a race condition where the page mounted
        // with idea="" because website_idea hadn't processed yet.
        console.log("WEBSITE_FLOW:B navigation triggered (website command) | NOT writing pending intent");
        if (location !== "/website-generator") navigate("/website-generator");
      } else if (command === "website_idea") {
        const idea = payload.trim();
        if (!idea) return;
        // WEBSITE_FLOW:A — idea stored BEFORE any navigation
        console.log("WEBSITE_FLOW:A idea stored | length:", idea.length, "| first 80:", idea.slice(0, 80));
        if (currentProject) {
          saveProjectContext({ projectId: currentProject.id, projectTitle: currentProject.title, originatingBusinessIntelligenceId: currentProject.id });
        }
        setPendingIntent({ type: "website", idea, autoGenerate: false });
        // WEBSITE_FLOW:B — navigate only AFTER idea is in sessionStorage
        console.log("WEBSITE_FLOW:B navigation triggered (website_idea command) | pending intent written first");
        if (location !== "/website-generator") navigate("/website-generator");
      } else if (command === "generate_website") {
        console.log("WEBSITE_FLOW:2 generate_website command received | calling markPendingIntentAutoGenerate(website)");
        markPendingIntentAutoGenerate("website");
        console.log("WEBSITE_FLOW:2a markPendingIntentAutoGenerate dispatched | navigating to /website-generator");
        navigate("/website-generator");
      } else if (command === "automation") {
        console.log(
          "AUTOMATION_TRACE: Command received | command: automation | payload:",
          JSON.stringify(payload),
        );
        // Same as chatbot: do NOT write an empty PendingIntent — it gets consumed
        // before automation_idea can write the real one. Just open the tab.
        if (location !== "/automation-builder") {
          console.log(
            "AUTOMATION_TRACE: Navigation fired | to: /automation-builder",
          );
          navigate("/automation-builder");
        } else {
          console.log(
            "AUTOMATION_TRACE: Navigation skipped | already on /automation-builder",
          );
        }
      } else if (command === "automation_idea") {
        console.log(
          "AUTOMATION_TRACE: Command received | command: automation_idea | payload:",
          JSON.stringify(payload),
        );
        const idea = payload.trim();
        if (!idea) {
          console.log(
            "AUTOMATION_TRACE: PendingIntent SKIPPED | idea is empty",
          );
          return;
        }
        lastAutomationIdeaRef.current = idea;
        if (currentProject) {
          saveProjectContext({ projectId: currentProject.id, projectTitle: currentProject.title, originatingBusinessIntelligenceId: currentProject.id });
        }
        // 1. Write sessionStorage (belt-and-suspenders for mount-based Phase 1 path).
        console.log(
          "AUTOMATION_TRACE: PendingIntent written | type: automation | idea:",
          JSON.stringify(idea),
        );
        setPendingIntent({ type: "automation", idea, autoGenerate: false });
        // 2. Emit workspace signal — if page is mounted, delivers live; if not, queues to
        //    sessionStorage so the page drains it on mount. No timing hacks needed.
        console.log(
          "AUTOMATION_TRACE: emitWorkspaceSignal called | target: automation | type: populate",
        );
        emitWorkspaceSignal({
          target: "automation",
          type: "populate",
          payload: idea,
        });
        // 3. Navigate if not already there (mounts the page so it can drain the queue).
        if (location !== "/automation-builder") {
          console.log(
            "AUTOMATION_TRACE: navigate() called | to: /automation-builder",
          );
          navigate("/automation-builder");
        }
      } else if (command === "generate_automation") {
        console.log(
          "[CONFIRM_FLOW:3] handleWorkspaceCmdAction invoked | command: generate_automation | timestamp:",
          Date.now(),
        );
        console.log(
          "AUTOMATION_TRACE: Command received | command: generate_automation | payload:",
          JSON.stringify(payload),
        );
        console.log(
          "AUTOMATION_TRACE: markPendingIntentAutoGenerate called | type: automation",
        );
        markPendingIntentAutoGenerate("automation");
        const rawAfterMark = sessionStorage.getItem("stageone_pending_intent");
        console.log(
          "AUTOMATION_TRACE: SessionStorage value after markPendingIntentAutoGenerate:",
          rawAfterMark,
        );
        console.log(
          "AUTOMATION_TRACE: Navigation fired | to: /automation-builder",
        );
        navigate("/automation-builder");
      }
    },
    [navigate, location, emitWorkspaceSignal, currentProject],
  );

  // ─── Send message ─────────────────────────────────────────────────────────────
  const sendMessage = useCallback(
    async (text?: string) => {
      const content = (text ?? input).trim();
      if (!content || streaming) return;

      // ── Isolation audit log — emitted on every send ────────────────────────────
      const _sendUserId = user?.id ?? null;
      const _sendProjectId = currentProject?.id ?? null;
      const _sendConversationId = _sendUserId ? `${_sendUserId}:copilot` : null;
      const _sendStorageKey = _sendUserId ? storageKey(_sendUserId) : null;
      console.log("userId", _sendUserId);
      console.log("projectId", _sendProjectId);
      console.log("conversationId", _sendConversationId);
      console.log("storageKey", _sendStorageKey);

      setInput("");
      setShowCommands(false);
      setPendingAction(null);
      const userMsg: Message = { role: "user", content };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setStreaming(true);

      const assistantMsg: Message = { role: "assistant", content: "" };
      setMessages((prev) => [...prev, assistantMsg]);

      abortRef.current = new AbortController();

      try {
        await streamCopilot(
          {
            messages: newMessages.filter((m) => !m.hidden),
            businessContext: businessData,
            workspaceContext,
            language: lang,
          },
          abortRef.current.signal,
          (buffer) => {
            console.log(
              "[TRACE] FINAL MESSAGE SENT TO CHAT UI | content:",
              buffer,
            );
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "assistant",
                content: buffer,
              };
              return updated;
            });
          },
          (action) => {
            // ACTION — render card immediately, even while streaming
            setPendingAction(action);
          },
          (path) => {
            // NAVIGATE — switch tab immediately, no waiting
            handleNavigate(path);
          },
          (id, endpoint, params) => {
            // EXECUTE — fire backend call instantly
            handleExecute(id, endpoint, params);
          },
          (command, payload) => {
            // WORKSPACE — create tasks etc.
            handleWorkspaceAction(command, payload);
          },
          (command, payload) => {
            // WORKSPACE CMD — Marcus execution: open tabs, populate forms, trigger generation
            handleWorkspaceCmdAction(command, payload);
          },
        );
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== "AbortError") {
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              role: "assistant",
              content: "Sorry, I ran into an error. Please try again.",
            };
            return updated;
          });
        }
      } finally {
        setStreaming(false);
      }
    },
    [
      input,
      messages,
      streaming,
      businessData,
      workspaceContext,
      handleNavigate,
      handleExecute,
      handleWorkspaceAction,
      handleWorkspaceCmdAction,
    ],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    if (streaming) abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setShowCommands(false);
    setPendingAction(null);
    greeted.current = false;
  };

  const cancelAutorun = useCallback(() => {
    if (autorunTimerRef.current) clearTimeout(autorunTimerRef.current);
    if (autorunIntervalRef.current) clearInterval(autorunIntervalRef.current);
    autorunTimerRef.current = null;
    autorunIntervalRef.current = null;
    setAutorunCountdown(null);
    setPendingAction(null);
  }, []);

  const executeAction = useCallback(
    (action: DetectedAction) => {
      const route = ACTION_ROUTES[action.id];
      if (!route) return;
      setPendingAction(null);
      setAutorunCountdown(null);
      // Write autorun intent so target page picks it up and executes immediately
      const idea = crossSystem.lastBusinessIdea ?? undefined;
      setCopilotAutorun({ action: action.id, idea, timestamp: Date.now() });
      navigate(route);
      setOpen(false);
    },
    [crossSystem.lastBusinessIdea, navigate, setOpen],
  );

  // When an action is detected after streaming, start a 2-second countdown
  // then auto-execute — user can cancel any time during the countdown
  useEffect(() => {
    if (!pendingAction || streaming) return;
    // Clear any existing timers
    if (autorunTimerRef.current) clearTimeout(autorunTimerRef.current);
    if (autorunIntervalRef.current) clearInterval(autorunIntervalRef.current);

    const capturedAction = pendingAction;

    setAutorunCountdown(2);
    autorunIntervalRef.current = setInterval(() => {
      setAutorunCountdown((prev) => {
        if (prev === null || prev <= 1) return null;
        return prev - 1;
      });
    }, 1000);
    autorunTimerRef.current = setTimeout(() => {
      if (autorunIntervalRef.current) clearInterval(autorunIntervalRef.current);
      autorunIntervalRef.current = null;
      setAutorunCountdown(null);
      setPendingAction(null);
      executeAction(capturedAction);
    }, 2000);

    return () => {
      if (autorunTimerRef.current) clearTimeout(autorunTimerRef.current);
      if (autorunIntervalRef.current) clearInterval(autorunIntervalRef.current);
    };
  }, [pendingAction, streaming]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Insight bubble ───────────────────────────────────────────────────────────
  const showBubble = (text: string) => {
    if (open) return;
    if (bubbleTimerRef.current) clearTimeout(bubbleTimerRef.current);
    setBubble({ text, id: Date.now() });
    bubbleTimerRef.current = setTimeout(() => setBubble(null), 9000);
  };

  useEffect(() => {
    const prev = prevCrossSystemRef.current;
    if (prev === null) {
      prevCrossSystemRef.current = crossSystem;
      return;
    }

    if (!prev.websiteGenerated && crossSystem.websiteGenerated) {
      showBubble(
        "Website's ready. Worth reviewing the copy before you go live.",
      );
    } else if (crossSystem.agentsInstalled > prev.agentsInstalled) {
      showBubble("New agent installed. Want to wire it into your workflow?");
    } else if (
      crossSystem.automationsConfigured > 0 &&
      prev.automationsConfigured === 0
    ) {
      showBubble(
        "Automation's set up. Let's make sure the triggers are right.",
      );
    }

    prevCrossSystemRef.current = crossSystem;
  }, [crossSystem]); // eslint-disable-line react-hooks/exhaustive-deps

  // Workspace Controller event subscriptions — proactive follow-ups + completion awareness
  useEffect(() => {
    const COMPLETION_MESSAGES: Partial<
      Record<string, { open: string; bubble: string; openSaveFailed: string; bubbleSaveFailed: string }>
    > = {
      "generation.complete": {
        open: "Business Intelligence generation completed successfully.\n\nI've attached the report to this project and reviewed the analysis.\n\nIf you'd like to discuss assumptions, risks, growth strategy, or any part of the report, I'm here.",
        bubble:
          "Analysis done. The biggest unknown isn't strategy — it's whether customers agree.",
        openSaveFailed: "Business Intelligence generation completed, but saving to the project failed.\n\nThe output is visible here but was not persisted. You may want to re-run the generation from the project page.",
        bubbleSaveFailed: "Analysis done — but it didn't save to the project. Open to sort it out.",
      },
      "website.generated": {
        open: "Website generation completed successfully.\n\nThe draft has been attached to this project.\n\nIf you'd like feedback on positioning, messaging, structure, or conversion flow, we can review it together.",
        bubble:
          "Website ready. Does the copy match what you'd say to a real customer?",
        openSaveFailed: "Website generation completed, but saving to the project failed.\n\nThe output is visible here but was not persisted. You may want to re-run the generation from the project page.",
        bubbleSaveFailed: "Website generated — but it didn't save to the project. Open to sort it out.",
      },
      "automation.generated": {
        open: "Automation workflow generated successfully.\n\nThe workflow is now attached to this project.\n\nIf you'd like to evaluate implementation complexity, efficiency, or operational impact, I can help.",
        bubble:
          "Automation built. Let's verify the triggers match your actual workflow.",
        openSaveFailed: "Automation workflow generated, but saving to the project failed.\n\nThe output is visible here but was not persisted. You may want to re-run the generation from the project page.",
        bubbleSaveFailed: "Automation built — but it didn't save to the project. Open to sort it out.",
      },
      "chatbot.generated": {
        open: "Chatbot generation completed successfully.\n\nThe chatbot has been attached to this project.\n\nIf you'd like to review conversation design, onboarding flow, or support strategy, we can examine it together.",
        bubble:
          "Chatbot ready. What's the first real conversation you want it to handle?",
        openSaveFailed: "Chatbot generation completed, but saving to the project failed.\n\nThe output is visible here but was not persisted. You may want to re-run the generation from the project page.",
        bubbleSaveFailed: "Chatbot generated — but it didn't save to the project. Open to sort it out.",
      },
    };

    const unsub = subscribe((event) => {
      console.log(
        "[CONFIRM_FLOW:6] Copilot subscriber received workspace event | type:",
        event.type,
        "| open:",
        open,
        "| streaming:",
        streamingRef.current,
        "| timestamp:",
        Date.now(),
      );
      const entry = COMPLETION_MESSAGES[event.type];
      if (entry) {
        const saved = event.data?.saved !== false;
        console.log(
          "[CONFIRM_FLOW:6] matched completion entry | saved:", saved,
          "| will post message:", open && !streamingRef.current,
          "| will show bubble:", !open,
        );
        if (open && !streamingRef.current) {
          // Panel is open and idle — post Marcus message directly into the chat
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: saved ? entry.open : entry.openSaveFailed },
          ]);
        } else if (!open) {
          showBubble(saved ? entry.bubble : entry.bubbleSaveFailed);
        } else {
          console.log(
            "[CONFIRM_FLOW:6] WARNING: completion event received but panel is open AND streaming — message dropped | open:",
            open,
            "| streaming:",
            streamingRef.current,
          );
        }
        return;
      }
      // Non-completion events — bubble only when panel is closed
      if (open) return;
      if (event.type === "task.completed") {
        showBubble("Task done. What's the next highest-leverage step?");
      }
    });
    return unsub;
  }, [subscribe, open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (prevProjectCountRef.current === null) {
      prevProjectCountRef.current = projects.length;
      return;
    }
    if (projects.length > prevProjectCountRef.current) {
      showBubble("New project created. I'll get up to speed.");
    }
    prevProjectCountRef.current = projects.length;
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (open && bubble) setBubble(null);
  }, [open, bubble]);

  const visibleMessages = messages.filter((m) => !m.hidden);

  if (isLoading || !user) return null;

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
            onClick={() => {
              setBubble(null);
              setOpen(true);
            }}
            className="fixed z-50 max-w-[220px] rounded-2xl border border-primary/25 bg-[#0e0d0b] px-3.5 py-2.5 text-left shadow-[0_8px_32px_rgba(0,0,0,0.6)] hover:border-primary/45 transition-all"
            style={{
              bottom: "96px",
              left: "calc(var(--sidebar-w, 0px) + 12px)",
            }}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 p-1 rounded-lg bg-primary/15 shrink-0">
                <Sparkles className="h-2.5 w-2.5 text-primary" />
              </div>
              <p className="text-sm leading-relaxed text-foreground/85">
                {bubble.text}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setBubble(null);
              }}
              className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-[#1a1a1a] border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              <X className="h-2.5 w-2.5 text-muted-foreground/60" />
            </button>
            {/* tail */}
            <div className="absolute -bottom-1.5 left-8 h-3 w-3 rotate-45 rounded-sm border-l border-b border-primary/25 bg-[#0e0d0b]" />
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
            className="fixed bottom-6 z-50 flex flex-col rounded-2xl border border-white/8 bg-[#090909] shadow-[0_24px_80px_rgba(0,0,0,0.85)] overflow-hidden"
            style={{
              left: "calc(var(--sidebar-w, 0px) + 12px)",
              width: 380,
              maxHeight: minimized ? 52 : 600,
              transition: "max-height 0.3s cubic-bezier(0.4,0,0.2,1)",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-[#0d0d0d] shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="p-1.5 rounded-xl bg-primary/10 border border-primary/20">
                  
                    <Brain className="h-4 w-4 text-primary" />
                
                  </div>
                  <motion.div
                    className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-400 border border-[#0d0d0d]"
                    animate={{ opacity: [0.7, 1, 0.7] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <p className="text-xs font-black text-foreground">
                    Agent Marcus
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[9px] text-emerald-400/80">
                      AI Business Operator
                    </p>
                    {hasBusinessContext && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-0.5 rounded-full bg-primary/15 border border-primary/25 px-1.5 py-0.5"
                      >
                        <Activity className="h-2 w-2 text-primary" />
                        <span className="text-[8px] font-semibold text-primary">
                          {
                            (businessData as Record<string, unknown>)
                              .industry as string
                          }
                        </span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowMemory((m) => !m)}
                  title="Workspace Memory"
                  className={`p-1.5 rounded-lg transition-all ${showMemory ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-white/5"}`}
                >
                  <Layers className="h-3.5 w-3.5" />
                </button>
                {visibleMessages.length > 0 && (
                  <button
                    onClick={clearChat}
                    title="Clear"
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setMinimized((m) => !m)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                >
                  <Minimize2 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all"
                >
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
                          <p className="text-[8px] font-black text-muted-foreground/35 uppercase tracking-[0.18em]">
                            Workspace Memory
                          </p>
                          <span className="text-[8px] text-muted-foreground/30">
                            {completedCount}/4 modules
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                          <div className="rounded-xl border border-white/4 bg-white/2 p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <MapPin className="h-2.5 w-2.5 text-muted-foreground/40" />
                              <span className="text-[8px] text-muted-foreground/35 uppercase tracking-wider">
                                Active Page
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-foreground truncate">
                              {activePage}
                            </p>
                          </div>
                          <div className="rounded-xl border border-white/4 bg-white/2 p-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <FolderOpen className="h-2.5 w-2.5 text-muted-foreground/40" />
                              <span className="text-[8px] text-muted-foreground/35 uppercase tracking-wider">
                                Project
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-foreground truncate">
                              {currentProject?.title ?? "None"}
                            </p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          {MODULE_LABELS.map(({ key, label, icon: Icon }) => {
                            const done = modules[key];
                            return (
                              <div
                                key={key}
                                className="flex items-center justify-between"
                              >
                                <div className="flex items-center gap-1.5">
                                  <Icon className="h-2.5 w-2.5 text-muted-foreground/30" />
                                  <span className="text-xs text-muted-foreground/60">
                                    {label}
                                  </span>
                                </div>
                                {done ? (
                                  <div className="flex items-center gap-1">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                    <span className="text-[9px] text-emerald-400/80 font-medium">
                                      Complete
                                    </span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3 text-muted-foreground/30" />
                                    <span className="text-[9px] text-muted-foreground/40">
                                      Pending
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                        {/* Workspace Tasks */}
                        {tasks.length > 0 && (
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <ListChecks className="h-2.5 w-2.5 text-muted-foreground/40" />
                                <p className="text-[8px] font-black text-muted-foreground/35 uppercase tracking-[0.18em]">
                                  Tasks
                                </p>
                              </div>
                              <span className="text-[8px] text-muted-foreground/30">
                                {
                                  tasks.filter((t) => t.status === "done")
                                    .length
                                }
                                /{tasks.length}
                              </span>
                            </div>
                            <div className="space-y-1 max-h-[120px] overflow-y-auto">
                              {tasks.slice(0, 8).map((task) => (
                                <div
                                  key={task.id}
                                  className="flex items-start gap-1.5 group"
                                >
                                  <button
                                    onClick={() =>
                                      toggleTask(
                                        task.id,
                                        task.status === "done"
                                          ? "pending"
                                          : "done",
                                      )
                                    }
                                    className="mt-0.5 shrink-0"
                                  >
                                    {task.status === "done" ? (
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <div className="h-3 w-3 rounded-full border border-white/20 hover:border-primary/50 transition-colors" />
                                    )}
                                  </button>
                                  <span
                                    className={`flex-1 text-xs leading-tight ${task.status === "done" ? "line-through text-muted-foreground/30" : "text-muted-foreground/70"}`}
                                  >
                                    {task.title}
                                  </span>
                                  <button
                                    onClick={() => deleteTask(task.id)}
                                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Trash2 className="h-2.5 w-2.5 text-muted-foreground/30 hover:text-red-400 transition-colors" />
                                  </button>
                                </div>
                              ))}
                              {tasks.length > 8 && (
                                <p className="text-[9px] text-muted-foreground/30 pl-4">
                                  +{tasks.length - 8} more tasks
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Messages */}
                <div
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                  style={{ minHeight: 0 }}
                >
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
                            animate={{
                              boxShadow: [
                                "0 0 0px rgba(212,175,55,0)",
                                "0 0 20px rgba(212,175,55,0.2)",
                                "0 0 0px rgba(212,175,55,0)",
                              ],
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                          >
                            <Sparkles className="h-7 w-7 text-primary" />
                          </motion.div>
                          <p className="text-sm font-black text-foreground mb-1">
                            Your AI Business Copilot
                          </p>
                          <p className="text-xs text-muted-foreground/60 leading-relaxed max-w-[260px] mx-auto">
                            Ask me anything about your business.
                          </p>
                        </div>

                        <div>
                          <p className="text-[8px] font-black text-muted-foreground/35 uppercase tracking-[0.18em] mb-2">
                            Quick Commands
                          </p>
                          <div className="space-y-1">
                            {QUICK_COMMANDS.slice(0, 5).map(
                              ({ icon: Icon, label, prompt }) => (
                                <motion.button
                                  key={label}
                                  whileHover={{ x: 2 }}
                                  onClick={() => sendMessage(prompt)}
                                  className="w-full flex items-center gap-2.5 rounded-xl border border-white/4 bg-white/2 p-2.5 text-left hover:border-primary/20 hover:bg-primary/5 transition-all group"
                                >
                                  <Icon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/70 transition-colors shrink-0" />
                                  <span className="flex-1 text-xs font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                                    {label}
                                  </span>
                                  <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                                </motion.button>
                              ),
                            )}
                          </div>
                          <button
                            onClick={() => setShowCommands((v) => !v)}
                            className="mt-1.5 w-full text-center text-[9px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors flex items-center justify-center gap-1"
                          >
                            <ChevronDown
                              className={`h-3 w-3 transition-transform ${showCommands ? "rotate-180" : ""}`}
                            />
                            {showCommands
                              ? "Show less"
                              : `+${QUICK_COMMANDS.length - 5} more commands`}
                          </button>
                          <AnimatePresence>
                            {showCommands && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden space-y-1 mt-1"
                              >
                                {QUICK_COMMANDS.slice(5).map(
                                  ({ icon: Icon, label, prompt }) => (
                                    <motion.button
                                      key={label}
                                      whileHover={{ x: 2 }}
                                      onClick={() => sendMessage(prompt)}
                                      className="w-full flex items-center gap-2.5 rounded-xl border border-white/4 bg-white/2 p-2.5 text-left hover:border-primary/20 hover:bg-primary/5 transition-all group"
                                    >
                                      <Icon className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary/70 transition-colors shrink-0" />
                                      <span className="flex-1 text-xs font-semibold text-muted-foreground/60 group-hover:text-foreground transition-colors">
                                        {label}
                                      </span>
                                      <ChevronRight className="h-3 w-3 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                                    </motion.button>
                                  ),
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </div>
                    )
                  ) : (
                    <>
                      {visibleMessages.map((msg, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25 }}
                          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          
                          <div
                            className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 ${
                              msg.role === "user"
                                ? "bg-primary/15 border border-primary/20 text-foreground text-sm leading-relaxed"
                                : "bg-white/3 border border-white/6"
                            }`}
                          >
                            {msg.role === "user" ? (
                              msg.content
                            ) : msg.content ? (
                              renderMessage(msg.content)
                            ) : (
                              <ThinkingIndicator />
                            )}
                          </div>
                        </motion.div>
                      ))}
                      {/* Pending action card — appears immediately on detection, executes after countdown */}
                      <AnimatePresence>
                        {pendingAction && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 4 }}
                            transition={{ duration: 0.25 }}
                            className="flex justify-start pl-8"
                          >
                            <div className="max-w-[88%] rounded-2xl border border-primary/30 bg-primary/10 px-3.5 py-3 space-y-2">
                              <p className="text-xs font-semibold text-primary/90">
                                {pendingAction.detail}
                              </p>
                              <div className="flex items-center gap-2">
                                {autorunCountdown !== null ? (
                                  <div className="flex items-center gap-1.5 rounded-lg bg-primary/20 border border-primary/30 px-2.5 py-1.5">
                                    <Loader2 className="h-3 w-3 text-primary animate-spin" />
                                    <span className="text-xs font-bold text-primary">
                                      Executing in {autorunCountdown}s…
                                    </span>
                                  </div>
                                ) : (
                                  <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.97 }}
                                    onClick={() => executeAction(pendingAction)}
                                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black hover:bg-primary/90 transition-colors"
                                  >
                                    <ArrowRight className="h-3 w-3" />
                                    {pendingAction.label}
                                  </motion.button>
                                )}
                                <button
                                  onClick={cancelAutorun}
                                  title="Cancel"
                                  className="p-1 rounded-lg text-muted-foreground/40 hover:text-muted-foreground/80 transition-colors"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
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
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={handleKey}
                      placeholder="Ask anything about your business..."
                      rows={1}
                      disabled={streaming}
                      className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground/25 focus:outline-none leading-[18px]"
                      style={{ maxHeight: "72px", overflowY: "auto" }}
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
  );
}
