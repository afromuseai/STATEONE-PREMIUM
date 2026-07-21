// ─── Website Studio Runtime Events ────────────────────────────────────────────
// Single event pipeline for WebsiteStudioRuntime.
// The runtime emits facts; the UI decides how to render them.

export type WSRuntimeEventType =
  // Project analysis
  | "ProjectScanStarted"
  | "ProjectScanCompleted"
  | "ProjectAnalysisReady"
  | "ProjectMemoryUpdated"
  // Tool execution
  | "ToolStarted"
  | "ToolCompleted"
  | "ToolFailed"
  | "FileWritten"
  | "FileRead"
  | "DirectoryListed"
  | "CodeSearched"
  | "CommandExecuted"
  // Streaming
  | "ThinkingDelta"
  | "ThinkingEnd"
  | "TextDelta"
  | "ToolCallDelta"
  | "ToolResultDelta"
  | "DiffDelta"
  | "StreamDone"
  | "StreamError"
  // Agent loop
  | "PhaseChanged"
  | "PlanCreated"
  | "ValidationResult"
  | "AssistantMessage"
  // Session
  | "SessionStarted"
  | "SessionCompleted"
  | "SessionFailed"
  | "SessionReset"
  // Activity Stream (Layer 2 — Live System Activity)
  | "ActivityStarted"
  | "ActivityUpdated"
  | "ActivityCompleted"
  | "ActivityFailed"
  // Phase 14.1A: Engineering Timeline
  | "TimelineUpdate"
  // Phase 14.2: Confidence & Risk Intelligence
  | "ConfidenceUpdate"
  // Phase 14.3: Preview Intelligence
  | "PreviewUpdate"
  // Phase 14.4: Visual Verification
  | "VisualUpdate"
  | "RecoveryUpdate"
  | "DecisionUpdate"
  // Phase 15.1: Engineering Audit
  | "AuditUpdate"
  // Phase 16.1: Product Intelligence
  | "ProductUpdate"
  // Phase 16.2: Engineering Advisor
  | "AdvisorUpdate"
  // Phase 16.3: Engineering Roadmap
  | "RoadmapUpdate"

export interface WSRuntimeEvent {
  type: WSRuntimeEventType
  timestamp: number
  payload: Record<string, unknown>
}

export type WSRuntimeEventListener = (event: WSRuntimeEvent) => void

export class WSRuntimeEventBus {
  private listeners: Set<WSRuntimeEventListener> = new Set()

  emit(event: WSRuntimeEvent): void {
    for (const listener of this.listeners) {
      listener(event)
    }
  }

  subscribe(listener: WSRuntimeEventListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  unsubscribe(listener: WSRuntimeEventListener): void {
    this.listeners.delete(listener)
  }

  get listenerCount(): number {
    return this.listeners.size
  }
}

export const wsRuntimeEventBus = new WSRuntimeEventBus()

// ─── Event factory helpers ────────────────────────────────────────────────────

export function createRuntimeEvent<T extends Record<string, unknown>>(
  type: WSRuntimeEventType,
  payload: T
): WSRuntimeEvent {
  return { type, timestamp: Date.now(), payload }
}

// Project analysis events
export const projectScanStarted = () => createRuntimeEvent("ProjectScanStarted", {})
export const projectScanCompleted = (summary: string) => createRuntimeEvent("ProjectScanCompleted", { summary })
export const projectAnalysisReady = (analysis: Record<string, unknown>) => createRuntimeEvent("ProjectAnalysisReady", { analysis })
export const projectMemoryUpdated = (memory: Record<string, unknown>) => createRuntimeEvent("ProjectMemoryUpdated", { memory })

// Tool events
export const toolStarted = (tool: string, path?: string) => createRuntimeEvent("ToolStarted", { tool, path })
export const toolCompleted = (tool: string, path?: string, detail?: string) => createRuntimeEvent("ToolCompleted", { tool, path, detail })
export const toolFailed = (tool: string, error: string) => createRuntimeEvent("ToolFailed", { tool, error })
export const fileWritten = (path: string, operation: "create" | "update" | "delete") => createRuntimeEvent("FileWritten", { path, operation })
export const fileRead = (path: string) => createRuntimeEvent("FileRead", { path })
export const directoryListed = (path: string, entries: string[]) => createRuntimeEvent("DirectoryListed", { path, entries })
export const codeSearched = (query: string, results: string[]) => createRuntimeEvent("CodeSearched", { query, results })
export const commandExecuted = (cmd: string, exitCode: number, output: string) => createRuntimeEvent("CommandExecuted", { cmd, exitCode, output })

// Streaming events
export const thinkingDelta = (content: string) => createRuntimeEvent("ThinkingDelta", { content })
export const thinkingEnd = () => createRuntimeEvent("ThinkingEnd", {})
export const textDelta = (content: string) => createRuntimeEvent("TextDelta", { content })
export const toolCallDelta = (id: string, name: string, params: Record<string, unknown>) => createRuntimeEvent("ToolCallDelta", { id, name, params })
export const toolResultDelta = (id: string, ok: boolean, result?: string) => createRuntimeEvent("ToolResultDelta", { id, ok, result })
export const diffDelta = (id: string, path: string, oldContent: string, newContent: string) => createRuntimeEvent("DiffDelta", { id, path, oldContent, newContent })
export const streamDone = () => createRuntimeEvent("StreamDone", {})
export const streamError = (error: string) => createRuntimeEvent("StreamError", { error })

// Agent loop events
export const phaseChanged = (phase: string): WSRuntimeEvent => createRuntimeEvent("PhaseChanged", { phase } as Record<string, unknown>)
export const planCreated = (text: string) => createRuntimeEvent("PlanCreated", { text })
export const validationResult = (success: boolean, errors: string[], fixed: boolean) => createRuntimeEvent("ValidationResult", { success, errors, fixed })
export const assistantMessage = (content: string, role: "user" | "assistant") => createRuntimeEvent("AssistantMessage", { content, role })

// Session events
export const sessionStarted = (sessionId: string, projectId: string) => createRuntimeEvent("SessionStarted", { sessionId, projectId })
export const sessionCompleted = (projectId: string, fileCount: number) => createRuntimeEvent("SessionCompleted", { projectId, fileCount })
export const sessionFailed = (message: string) => createRuntimeEvent("SessionFailed", { message })
export const sessionReset = () => createRuntimeEvent("SessionReset", {})

// ─── Activity Stream Events (Layer 2 — Live System Activity) ──────────────────
// These are NOT chat messages. They are transient system activity indicators
// that appear in a small animated area above the conversation.
// They never become chat history.

export type ActivityKind =
  | "thinking"
  | "reasoning"
  | "reading"
  | "searching"
  | "planning"
  | "working"
  | "writing"
  | "running-command"
  | "testing"
  | "preview"
  | "complete"
  | "warning"
  | "error"

export interface ActivityPayload {
  kind: ActivityKind
  /** Optional file path for file-specific activities (reading, writing, etc.) */
  file?: string
  /** Optional detail message for context */
  detail?: string
  /** Optional progress 0-100 */
  progress?: number
  /** Optional progress detail (e.g. "3 / 16 files") */
  progressDetail?: string
}

export const activityStarted = (kind: ActivityKind, file?: string, detail?: string) =>
  createRuntimeEvent("ActivityStarted", { kind, file, detail })

export const activityUpdated = (kind: ActivityKind, file?: string, detail?: string) =>
  createRuntimeEvent("ActivityUpdated", { kind, file, detail })

export const activityCompleted = (kind: ActivityKind, file?: string, detail?: string) =>
  createRuntimeEvent("ActivityCompleted", { kind, file, detail })

export const activityFailed = (kind: ActivityKind, error: string) =>
  createRuntimeEvent("ActivityFailed", { kind, error })

// ─── Phase 14.1A: Timeline Update Event ───────────────────────────────────────
export interface WSTimelineUpdate {
  timelineId: string
  stepId: string
  status: string
  duration?: number
  affectedFiles?: string[]
  specialist?: string
  metadata?: Record<string, unknown>
  timelineStatus?: string
  totalDurationMs?: number
}

export const timelineUpdate = (update: WSTimelineUpdate) =>
  createRuntimeEvent("TimelineUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 14.2: Confidence & Risk Intelligence Events ────────────────────────

export type WSConfidenceLevel = "high" | "medium" | "low";

export type WSValidatorStatus = "pending" | "running" | "passed" | "failed";

export interface WSConfidenceUpdate {
  score: number;
  level: WSConfidenceLevel;
  risks: Array<{
    severity: "low" | "medium" | "high" | "critical";
    reason: string;
    affectedScope?: string;
  }>;
  impact: {
    score: number;
    affectedFiles: number;
    affectedComponents: number;
    affectedRoutes: number;
    dependenciesTouched: number;
  };
  validation: {
    typescript: WSValidatorStatus;
    eslint: WSValidatorStatus;
    build: WSValidatorStatus;
    preview?: WSValidatorStatus;
  };
  breakdown: {
    planningQuality: number;
    validationScore: number;
    workspaceConsistency: number;
    historicalSuccess: number;
    specialistConfidence: number;
    repairStability: number;
  };
  repairs: Array<{
    attempt: number;
    validator: string;
    status: "fixed" | "failed";
  }>;
  timestamp: string;
}

export const confidenceUpdate = (update: WSConfidenceUpdate) =>
  createRuntimeEvent("ConfidenceUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 14.3: Preview Intelligence Events ──────────────────────────────────

export interface WSPreviewVisualIssue {
  type: "overflow" | "missing-content" | "spacing" | "alignment" | "responsive" | "asset";
  severity: "low" | "medium" | "high";
  description: string;
  affectedFiles: string[];
}

export type WSPreviewStatus = "healthy" | "warning" | "failed";

export interface WSPreviewUpdate {
  status: WSPreviewStatus;
  healthScore: number;
  runtimeErrors: string[];
  consoleErrors: string[];
  missingAssets: string[];
  brokenRoutes: string[];
  visualIssues: WSPreviewVisualIssue[];
  needsRepair: boolean;
  repairAttempts: number;
  timestamp: string;
}

export const previewUpdate = (update: WSPreviewUpdate) =>
  createRuntimeEvent("PreviewUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 14.4: Visual Verification Events ──────────────────────────────────

export type WSVisualIssueCategory =
  | "layout-break" | "overlap" | "missing-section" | "spacing"
  | "responsive" | "typography" | "design-token" | "before-after-regression";

export type WSVisualIssueSeverity = "low" | "medium" | "high" | "critical";

export type WSVisualStatus = "healthy" | "warning" | "failed" | "critical";

export interface WSVisualIssue {
  category: WSVisualIssueCategory;
  severity: WSVisualIssueSeverity;
  description: string;
  suggestion?: string;
  affectedFiles: string[];
}

export interface WSVisualComparison {
  modifiedVisuals: Array<{ path: string; reason: string }>;
  removedFiles: string[];
  addedFiles: string[];
  sectionDelta: number;
}

export interface WSVisualScoreBreakdown {
  layoutScore: number;
  overlapScore: number;
  spacingScore: number;
  responsiveScore: number;
  typographyScore: number;
  designTokenScore: number;
  regressionScore: number;
}

export interface WSVisualUpdate {
  score: number;
  status: WSVisualStatus;
  issues: WSVisualIssue[];
  comparison: WSVisualComparison;
  breakdown: WSVisualScoreBreakdown;
  needsRepair: boolean;
  repairAttempts: number;
  summary: string;
  timestamp: string;
}

export const visualUpdate = (update: WSVisualUpdate) =>
  createRuntimeEvent("VisualUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 14.5: Recovery Update ────────────────────────────────────────────────

export type WSRecoveryEventType = "snapshot_created" | "rollback_started" | "rollback_completed" | "recovery_success" | "recovery_failed";

export type WSRecoveryTrigger = "validation_failed" | "confidence_below_threshold" | "visual_score_critical" | "runtime_crashes_persist" | "manual";

export interface WSRecoveryUpdate {
  eventType: WSRecoveryEventType;
  snapshotId?: string;
  trigger?: WSRecoveryTrigger;
  description: string;
  rolledBackFiles?: string[];
  snapshotCount?: number;
  currentVersion?: number;
  totalVersions?: number;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export const recoveryUpdate = (update: WSRecoveryUpdate) =>
  createRuntimeEvent("RecoveryUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 14.6: Decision Update ────────────────────────────────────────────────

export type WSDecisionRecommendation = "proceed" | "repair-first" | "ask-user" | "rollback" | "defer";

export type WSExecutionStrategy = "patch" | "refactor" | "replace" | "extend" | "rebuild";

export type WSTradeoffCategory = "performance" | "maintainability" | "complexity" | "risk" | "design" | "developer-experience";

export interface WSDecisionUpdate {
  recommendation: WSDecisionRecommendation;
  confidence: number;
  estimatedRisk: number;
  executionStrategy: WSExecutionStrategy;
  chosenOption: string;
  alternativeOptions: Array<{
    id: string;
    title: string;
    strategy: WSExecutionStrategy;
    confidence: number;
    risk: number;
    estimatedFiles: number;
  }>;
  tradeoffs: Array<{
    category: WSTradeoffCategory;
    benefit: string;
    drawback: string;
  }>;
  rationale: string[];
  decisionTimeMs: number;
  timestamp: string;
}

export const decisionUpdate = (update: WSDecisionUpdate) =>
  createRuntimeEvent("DecisionUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 15.1: Audit Update ────────────────────────────────────────────────────

export type WSAuditCategory = "performance" | "architecture" | "design" | "components" | "routing" | "accessibility" | "seo" | "validation" | "technical-debt" | "developer-experience";

export type WSAuditSeverity = "low" | "medium" | "high" | "critical";

export type WSAuditEffort = "small" | "medium" | "large";

export interface WSAuditUpdate {
  score: number;
  opportunityCount: number;
  topOpportunities: Array<{
    id: string;
    category: WSAuditCategory;
    severity: WSAuditSeverity;
    title: string;
    description: string;
    affectedFiles: string[];
    estimatedBenefit: number;
    estimatedRisk: number;
    estimatedEffort: WSAuditEffort;
    recommendation: string;
    priorityScore: number;
  }>;
  criticalCount: number;
  highPriorityCount: number;
  strengths: string[];
  weaknesses: string[];
  summary: string;
  durationMs: number;
  timestamp: string;
}

export const auditUpdate = (update: WSAuditUpdate) =>
  createRuntimeEvent("AuditUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 16.1: Product Intelligence Update ────────────────────────────────────

export type WSProductRecommendation = "approve" | "approve-with-warning" | "revise" | "reject";

export interface WSProductUpdate {
  overallScore: number;
  recommendation: WSProductRecommendation;
  businessAlignment: number;
  uxImpact: number;
  conversionImpact: number;
  brandingConsistency: number;
  accessibilityImpact: number;
  seoImpact: number;
  maintainabilityImpact: number;
  userRisk: number;
  reasoning: string[];
  recommendations: string[];
  warnings: string[];
  assessmentTimeMs: number;
  timestamp: string;
}

export const productUpdate = (update: WSProductUpdate) =>
  createRuntimeEvent("ProductUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 16.2: Engineering Advisor Update ───────────────────────────────────

export interface WSAdvisorRecommendation {
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
}

export interface WSAdvisorUpdate {
  overallHealth: number;
  recommendations: WSAdvisorRecommendation[];
  strengths: string[];
  risks: string[];
  trends: string[];
  nextBestAction: string;
}

export const advisorUpdate = (update: WSAdvisorUpdate) =>
  createRuntimeEvent("AdvisorUpdate", update as unknown as Record<string, unknown>)

// ─── Phase 16.3: Engineering Roadmap Update ───────────────────────────────────

export interface WSRoadmapItem {
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

export interface WSRoadmapUpdate {
  items: WSRoadmapItem[];
  summary: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
    deferred: number;
  };
  completionPercentage: number;
  currentFocus: WSRoadmapItem[];
  recentlyCompleted: WSRoadmapItem[];
  roadmapHealth: number;
}

export const roadmapUpdate = (update: WSRoadmapUpdate) =>
  createRuntimeEvent("RoadmapUpdate", update as unknown as Record<string, unknown>)