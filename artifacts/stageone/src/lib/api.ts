import { getActiveImpersonationToken } from "./impersonation-context";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const impersonationToken = getActiveImpersonationToken();
  const extraHeaders: Record<string, string> = {};
  if (impersonationToken) {
    extraHeaders["X-Impersonation-Token"] = impersonationToken;
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...extraHeaders, ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface UserInfo {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  createdAt: string;
}

export interface ProjectEvent {
  type: string;
  label: string;
  timestamp: string;
}

export type ProjectType =
  | "business_intelligence"
  | "website"
  | "chatbot"
  | "automation"
  | "orchestration";

export interface Project {
  id: string;
  userId: string;
  title: string;
  businessIdea: string;
  type: ProjectType;
  status: string;
  output: Record<string, unknown> | null;
  websiteOutput: Record<string, unknown> | null;
  chatbotOutput: Record<string, unknown> | null;
  automationOutput: Record<string, unknown> | null;
  orchestratorOutput: Record<string, unknown> | null;
  projectEvents: ProjectEvent[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConnectedIntegration {
  id: string;
  userId: string;
  provider: string;
  displayName: string;
  status: string;
  config: Record<string, unknown>;
  connectedAt: string;
  updatedAt: string;
}

// ─── Edit pipeline SSE events ─────────────────────────────────────────────────
// Mirrors the backend V2EditSseEvent union from website-v2-types.ts.
// Used by websiteV2.editProject() to stream edit pipeline events to the UI.

export interface FileModification {
  path:      string;
  operation: "update" | "create" | "delete";
  content:   string;
  reason:    string;
}

export interface EditResult {
  changes: FileModification[];
  summary: string;
}

export interface ConversationEvent {
  id:        string;
  type:      "message" | "action" | "step" | "file" | "warning" | "error" | "complete" | "progress";
  phase:     string | null;
  timestamp: string;
  message:   string;
  metadata?: Record<string, unknown>;
}

export type V2EditSseEvent =
  | { phase: "analyzing" }
  | { phase: "editing" }
  | { phase: "changes";       data: EditResult }
  | { phase: "saved";         fileCount: number }
  | { phase: "regenerating" }
  | { phase: "preview-ready" }
  | { phase: "error";         message: string }
  | { phase: "agent";         event: ConversationEvent }
  /** Phase 14.1: Timeline update — live step-by-step engineering progress. */
  | { phase: "timeline";     data: { timelineId: string; stepId: string; status: string; duration?: number; affectedFiles?: string[]; specialist?: string; metadata?: Record<string, unknown>; timelineStatus?: string; totalDurationMs?: number } }
  /** Phase 14.2: Confidence & Risk intelligence — live confidence, impact, validation, and repair data. */
  | { phase: "confidence";   data: ConfidencePayload }
  /** Phase 14.3: Preview intelligence — runtime health, visual issues, and auto-repair status. */
  | { phase: "preview";      data: PreviewPayload }
  /** Phase 14.4: Visual verification — layout, responsive, typography, and design token analysis. */
  | { phase: "visual";      data: VisualPayload }
  /** Phase 14.5: Recovery & Rollback — snapshot management, rollback, and recovery actions. */
  | { phase: "recovery";    data: RecoveryPayload }
  /** Phase 14.6: Engineering Decision — execution strategy, risk, and recommendation. */
  | { phase: "decision";    data: DecisionPayload }
  /** Phase 15.1: Engineering Audit — proactive project analysis and improvement opportunities. */
  | { phase: "audit";       data: AuditPayload }
  /** Phase 16.1: Product Intelligence — business, UX, conversion, branding, and accessibility assessment. */
  | { phase: "product";     data: ProductPayload }
  /** Phase 16.2: Engineering Advisor — autonomous recommendations for highest-value improvements. */
  | { phase: "advisor";     data: AdvisorPayload }
  /** Phase 16.3: Engineering Roadmap — persistent prioritized engineering backlog. */
  | { phase: "roadmap";     data: RoadmapPayload };

// ─── Phase 16.3: Engineering Roadmap Payload ───────────────────────────────────

export interface RoadmapItemPayload {
  id: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  effort: string;
  impact: number;
  confidence: number;
  status: string;
  dependencies: string[];
  source: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface RoadmapPayload {
  items: RoadmapItemPayload[];
  summary: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
    deferred: number;
  };
  completionPercentage: number;
  currentFocus: RoadmapItemPayload[];
  recentlyCompleted: RoadmapItemPayload[];
  roadmapHealth: number;
}

// ─── Phase 16.2: Engineering Advisor Payload ───────────────────────────────────

export interface AdvisorPayload {
  /** Overall project health score 0–100. */
  overallHealth: number;
  /** Prioritized recommendations. */
  recommendations: Array<{
    id: string;
    title: string;
    description: string;
    category: string;
    priority: string;
    impact: number;
    effort: number;
    confidence: number;
    urgency: number;
    score: number;
    affectedFiles: string[];
    reasoning: string[];
    suggestedActions: string[];
  }>;
  /** Key strengths. */
  strengths: string[];
  /** Risks and concerns. */
  risks: string[];
  /** Detected trends. */
  trends: string[];
  /** Single highest-value improvement. */
  nextBestAction: string;
}

// ─── Phase 16.1: Product Intelligence Payload ──────────────────────────────────

export interface ProductPayload {
  /** Overall product score 0–100. */
  overallScore: number;
  /** Final recommendation. */
  recommendation: "approve" | "approve-with-warning" | "revise" | "reject";
  /** Business alignment score. */
  businessAlignment: number;
  /** UX impact score. */
  uxImpact: number;
  /** Conversion impact score. */
  conversionImpact: number;
  /** Branding consistency score. */
  brandingConsistency: number;
  /** Accessibility impact score. */
  accessibilityImpact: number;
  /** SEO impact score. */
  seoImpact: number;
  /** Maintainability impact score. */
  maintainabilityImpact: number;
  /** User risk score. */
  userRisk: number;
  /** Reasoning summary. */
  reasoning: string[];
  /** Improvement recommendations. */
  recommendations: string[];
  /** Warnings. */
  warnings: string[];
  /** Assessment duration in ms. */
  assessmentTimeMs: number;
  /** ISO timestamp. */
  timestamp: string;
}

// ─── Phase 15.1: Engineering Audit Payload ─────────────────────────────────────

export interface AuditPayload {
  /** Overall project engineering score 0–100. */
  score: number;
  /** Number of opportunities detected. */
  opportunityCount: number;
  /** Top improvement opportunities (up to 20). */
  topOpportunities: Array<{
    id: string;
    category: "performance" | "architecture" | "design" | "components" | "routing" | "accessibility" | "seo" | "validation" | "technical-debt" | "developer-experience";
    severity: "low" | "medium" | "high" | "critical";
    title: string;
    description: string;
    affectedFiles: string[];
    estimatedBenefit: number;
    estimatedRisk: number;
    estimatedEffort: "small" | "medium" | "large";
    recommendation: string;
    priorityScore: number;
  }>;
  /** Critical issues count. */
  criticalCount: number;
  /** High priority count. */
  highPriorityCount: number;
  /** Project strengths. */
  strengths: string[];
  /** Areas needing improvement. */
  weaknesses: string[];
  /** Summary. */
  summary: string;
  /** Audit duration in ms. */
  durationMs: number;
  /** ISO timestamp. */
  timestamp: string;
}

// ─── Phase 14.2: Confidence & Risk Intelligence Payload ────────────────────────

export interface ConfidenceRisk {
  severity: "low" | "medium" | "high" | "critical";
  reason: string;
  affectedScope?: string;
}

export interface ConfidenceImpact {
  score: number;
  affectedFiles: number;
  affectedComponents: number;
  affectedRoutes: number;
  dependenciesTouched: number;
}

export interface ConfidenceValidation {
  typescript:  "pending" | "running" | "passed" | "failed";
  eslint:      "pending" | "running" | "passed" | "failed";
  build:       "pending" | "running" | "passed" | "failed";
  preview?:    "pending" | "running" | "passed" | "failed";
}

export interface ConfidenceBreakdown {
  planningQuality:       number;
  validationScore:       number;
  workspaceConsistency:  number;
  historicalSuccess:     number;
  specialistConfidence:  number;
  repairStability:       number;
}

export interface ConfidenceRepair {
  attempt:   number;
  validator: string;
  status:    "fixed" | "failed";
}

export interface ConfidencePayload {
  score: number;
  level: "high" | "medium" | "low";
  risks: ConfidenceRisk[];
  impact: ConfidenceImpact;
  validation: ConfidenceValidation;
  breakdown: ConfidenceBreakdown;
  repairs: ConfidenceRepair[];
  timestamp: string;
}

// ─── Phase 14.3: Preview Intelligence Payload ──────────────────────────────────

export interface PreviewVisualIssue {
  type: "overflow" | "missing-content" | "spacing" | "alignment" | "responsive" | "asset";
  severity: "low" | "medium" | "high";
  description: string;
  affectedFiles: string[];
}

export interface PreviewPayload {
  status: "healthy" | "warning" | "failed";
  healthScore: number;
  runtimeErrors: string[];
  consoleErrors: string[];
  missingAssets: string[];
  brokenRoutes: string[];
  visualIssues: PreviewVisualIssue[];
  needsRepair: boolean;
  repairAttempts: number;
  timestamp: string;
}

// ─── Phase 14.4: Visual Verification Payload ──────────────────────────────────

export interface VisualPayload {
  score: number;
  status: "healthy" | "warning" | "failed" | "critical";
  issues: Array<{
    category: "layout-break" | "overlap" | "missing-section" | "spacing" | "responsive" | "typography" | "design-token" | "before-after-regression";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    suggestion?: string;
    affectedFiles: string[];
  }>;
  comparison: {
    modifiedVisuals: Array<{ path: string; reason: string }>;
    removedFiles: string[];
    addedFiles: string[];
    sectionDelta: number;
  };
  breakdown: {
    layoutScore: number;
    overlapScore: number;
    spacingScore: number;
    responsiveScore: number;
    typographyScore: number;
    designTokenScore: number;
    regressionScore: number;
  };
  needsRepair: boolean;
  repairAttempts: number;
  summary: string;
  timestamp: string;
}

// ─── Phase 14.5: Recovery & Rollback Payload ──────────────────────────────────

export interface RecoveryPayload {
  /** Type of recovery event. */
  eventType: "snapshot_created" | "rollback_started" | "rollback_completed" | "recovery_success" | "recovery_failed";
  /** Snapshot ID if applicable. */
  snapshotId?: string;
  /** Why rollback was triggered. */
  trigger?: "validation_failed" | "confidence_below_threshold" | "visual_score_critical" | "runtime_crashes_persist" | "manual";
  /** Human-readable description. */
  description: string;
  /** Files that were rolled back (if applicable). */
  rolledBackFiles?: string[];
  /** Number of snapshots taken during this execution. */
  snapshotCount?: number;
  /** Current version/snapshot index. */
  currentVersion?: number;
  /** Total versions available. */
  totalVersions?: number;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
  /** ISO timestamp. */
  timestamp: string;
}

// ─── Phase 14.6: Engineering Decision Payload ────────────────────────────────

export interface DecisionPayload {
  /** Final recommendation from the decision engine. */
  recommendation: "proceed" | "repair-first" | "ask-user" | "rollback" | "defer";
  /** Confidence in the chosen decision (0–100). */
  confidence: number;
  /** Estimated regression risk (0–100). */
  estimatedRisk: number;
  /** The chosen execution strategy. */
  executionStrategy: "patch" | "refactor" | "replace" | "extend" | "rebuild";
  /** Short description of the chosen option. */
  chosenOption: string;
  /** Alternative options that were considered. */
  alternativeOptions: Array<{
    id: string;
    title: string;
    strategy: "patch" | "refactor" | "replace" | "extend" | "rebuild";
    confidence: number;
    risk: number;
    estimatedFiles: number;
  }>;
  /** Tradeoffs of the chosen strategy. */
  tradeoffs: Array<{
    category: "performance" | "maintainability" | "complexity" | "risk" | "design" | "developer-experience";
    benefit: string;
    drawback: string;
  }>;
  /** Reasoning behind the decision. */
  rationale: string[];
  /** How long the evaluation took (ms). */
  decisionTimeMs: number;
  /** ISO timestamp. */
  timestamp: string;
}

// ─── END: Website Studio types ────────────────────────────────────────────────

export const api = {
  auth: {
    signup: (email: string, password: string, name: string) =>
      request<{ user: UserInfo }>("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, name }),
      }),
    login: (email: string, password: string) =>
      request<{ user: UserInfo }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: () =>
      request<{ ok: boolean }>("/auth/logout", { method: "POST" }),
    me: () => request<{ user: UserInfo }>("/auth/me"),
  },
  projects: {
    list: () => request<{ projects: Project[] }>("/projects"),
    get: (id: string) => request<{ project: Project }>(`/projects/${id}`),
    create: (data: { title: string; businessIdea: string; type?: ProjectType; status?: string; output?: unknown; websiteOutput?: unknown; chatbotOutput?: unknown; automationOutput?: unknown; orchestratorOutput?: unknown }) =>
      request<{ project: Project }>("/projects", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: { title?: string; status?: string; output?: unknown; websiteOutput?: unknown; chatbotOutput?: unknown; automationOutput?: unknown; orchestratorOutput?: unknown }) =>
      request<{ project: Project }>(`/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      fetch(`${BASE}/projects/${id}`, { method: "DELETE", credentials: "include" }),
  },
  integrations: {
    list: () => request<{ integrations: ConnectedIntegration[] }>("/integrations"),
    connect: (provider: string, displayName: string, config?: Record<string, unknown>) =>
      request<{ integration: ConnectedIntegration }>("/integrations", {
        method: "POST",
        body: JSON.stringify({ provider, displayName, config }),
      }),
    disconnect: (provider: string) =>
      fetch(`${BASE}/integrations/${encodeURIComponent(provider)}`, {
        method: "DELETE",
        credentials: "include",
      }),
  },
  support: {
    listTickets: () =>
      request<{ tickets: Array<Record<string, unknown>> }>("/support/tickets"),
    createTicket: (data: { subject: string; category: string; priority: string; message: string }) =>
      request<{ ticket: Record<string, unknown> }>("/support/tickets", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getTicket: (id: string) =>
      request<{ ticket: Record<string, unknown>; messages: Array<Record<string, unknown>>; owner: unknown; assignedAdmin: unknown }>(`/support/tickets/${id}`),
    replyToTicket: (id: string, message: string) =>
      request<{ message: Record<string, unknown> }>(`/support/tickets/${id}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
      }),
  },
  onboarding: {
    getProgress: () =>
      request<{ progress: { id: string; isDismissed: boolean; steps: Array<{ key: string; completed: boolean }> } }>("/onboarding"),
    completeStep: (step: "first_bi_generation" | "first_website" | "install_agent" | "chat_with_marcus" | "first_project_saved") =>
      request<{ progress: unknown }>("/onboarding/step", {
        method: "POST",
        body: JSON.stringify({ step }),
      }),
    dismiss: () =>
      request<{ progress: unknown }>("/onboarding/dismiss", { method: "POST" }),
  },
  referrals: {
    getMyLink: () =>
      request<{ referralCode: string; referralLink: string; referralCount: number; totalBonusGenerations: number }>("/referrals/me"),
  },
  websiteV2: {
    listProjects: () =>
      request<{ projects: Array<{ id: string; projectName: string; status: string; createdAt: string; updatedAt: string }> }>("/website-v2/projects"),
    getProject: (id: string) =>
      request<{
        id: string; projectName: string; status: string;
        businessContext: Record<string, unknown>;
        blueprint: Record<string, unknown> | null;
        files: Array<{ path: string; operation: string; content: string; language?: string }>;
        dependencies: string[];
        preview: string | null;
        createdAt: string; updatedAt: string;
      }>(`/website-v2/projects/${id}`),
    // Persists file changes immediately (no separate confirmation step) —
    // used by the Website Studio editing chat when Marcus applies edits.
    updateFiles: (id: string, modifications: Array<{ path: string; operation: "update" | "create" | "delete"; content: string }>) =>
      request<{ files: Array<{ path: string; operation: string; content: string; language?: string }> }>(`/website-v2/projects/${id}/files`, {
        method: "PATCH",
        body: JSON.stringify({ modifications }),
      }),
    // Regenerates + persists the preview HTML for a project from its current
    // files. The route streams SSE phases (analyzing → rendering → preview →
    // saved); we only care about the final "preview" phase's HTML payload.
    regeneratePreview: async (id: string): Promise<string | null> => {
      const res = await fetch(`${BASE}/website-v2/projects/${id}/preview`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let preview: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as {
            phase: string;
            data?: { preview?: string };
            message?: string;
          };
          if (payload.phase === "preview" && payload.data?.preview) {
            preview = payload.data.preview;
          }
          if (payload.phase === "error") {
            throw new Error(payload.message ?? "Preview generation failed");
          }
        }
      }
      return preview;
    },
    // SSE-streaming edit — connects to POST /api/website-v2/projects/:id/edit
    // Calls onEvent for each parsed SSE frame. Resolves when the stream ends
    // or rejects on error / HTTP failure.
    editProject: async (
      id: string,
      instruction: string,
      selectedFiles: string[] | undefined,
      signal: AbortSignal,
      onEvent: (event: V2EditSseEvent) => void,
      workspaceContext?: Record<string, unknown>,
    ): Promise<void> => {
      console.log("[EDIT API] editProject() called", { id, instruction, selectedFiles, hasContext: !!workspaceContext })
      const impersonationToken = getActiveImpersonationToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (impersonationToken) headers["X-Impersonation-Token"] = impersonationToken;

      const body: Record<string, unknown> = { instruction };
      if (selectedFiles) body.selectedFiles = selectedFiles;
      if (workspaceContext) body.workspaceContext = workspaceContext;

      console.log("[EDIT API] Sending POST request to", `${BASE}/website-v2/projects/${id}/edit`)
      const res = await fetch(`${BASE}/website-v2/projects/${id}/edit`, {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
        signal,
      });

      console.log("[EDIT API] Response received", { status: res.status, ok: res.ok, hasBody: !!res.body })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({ error: "Edit request failed" }));
        console.error("[EDIT API] Request failed", { status: res.status, body })
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          console.log("[EDIT API] SSE stream ended")
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";
        for (const chunk of chunks) {
          const line = chunk.split("\n").find((l) => l.startsWith("data: "));
          if (!line) continue;
          const payload = JSON.parse(line.slice(6)) as V2EditSseEvent;
          console.log("[EDIT API] SSE event received", { phase: payload.phase })
          onEvent(payload);
          if (payload.phase === "error") {
            console.error("[EDIT API] SSE error phase", payload)
            throw new Error(payload.message ?? "Edit failed");
          }
        }
      }
    },
  },
  admin: {
    getUsers: () => request<{ users: Array<UserInfo & { subscription: unknown }>, total: number }>("/admin/users"),
    updateUser: (id: string, data: { isAdmin?: boolean; name?: string }) =>
      request<{ user: UserInfo }>(`/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
    updateSubscription: (userId: string, plan: string) =>
      request<{ subscription: unknown }>(`/admin/users/${userId}/subscription`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      }),
    deleteUser: (id: string) =>
      request<{ ok: boolean }>(`/admin/users/${id}`, { method: "DELETE" }),
    getStats: () =>
      request<{ totalUsers: number; admins: number; planCounts: Record<string, number>; totalGenerations: number }>("/admin/stats"),
  },
};
