// ─── Website Architect V2 — Shared Types ─────────────────────────────────────
import type { ConversationEvent } from "./agents/marcus-conversation";
// These types define the V2 pipeline data contracts.
// V1 types (WebsiteOutput, etc.) in website-html-generator.ts are untouched.
//
// Pipeline:
//   BusinessContext → [Architect Agent] → WebsiteBlueprint
//   WebsiteBlueprint + BusinessContext → [Code Agent] → GeneratedProject

// ─── BusinessContext ──────────────────────────────────────────────────────────
// Extracted from the user's idea and any existing Business Intelligence output.
// Passed as input to both the Architect Agent and the Code Generation Agent.
export interface BusinessContext {
  idea:             string;
  companyName:      string;
  industry:         string;
  targetAudience:   string;
  businessGoal:     string;
  brandPositioning: string;
  conversionGoal:   string;
  existingBI?:      Record<string, unknown>;  // raw BI output from /api/generate
  biIntelligenceContext?: {
    businessSnapshot: string;
    targetMarket: string;
    evidence: {
      facts: string[];
      inferences: string[];
      hypotheses: string[];
      unknowns: string[];
    };
    confidence: {
      overall: "HIGH" | "MEDIUM" | "LOW";
      reason: string;
    };
    decisionPriorities: string[];
    moduleContext?: {
      website: {
        positioning: string;
        conversionGoal: string;
        recommendedPages: string[];
        primaryCTA: string;
      };
      chatbot: {
        primaryRole: string;
        requiredCapabilities: string;
        qualificationQuestions: string[];
        escalationRules: string;
      };
      automation: {
        highestValueWorkflow: string;
        recommendedIntegrations: string[];
        businessProcess: string;
      };
      execution: {
        recommendedAgents: string[];
        prioritySequence: string[];
      };
    };
  };
}

// ─── WebsiteBlueprint ─────────────────────────────────────────────────────────
// The Architect Agent's output — an engineering architecture document.
// NOT HTML. NOT a template schema. NOT marketing copy.
// Describes what to build and why; the Code Agent decides how.

// ─── BlueprintComponent ───────────────────────────────────────────────────────
// Rich per-component specification that removes ambiguity for the Code Agent.
// Every field is architectural intent, never implementation (no code/CSS/copy).
export interface BlueprintComponent {
  name:            string;    // PascalCase component name, e.g. "HeroSection"
  purpose:         string;    // One sentence: what this component achieves for the user
  layout:          string;    // Visual/structural description, e.g. "split hero, text left, visual right"
  contentElements: string[];  // Content slots inside this component (no copy, just slot names)
                              // e.g. ["headline", "supporting paragraph", "primary CTA", "trust badge"]
  behavior:        string[];  // Interaction/animation/responsive rules
                              // e.g. ["fade in on load", "responsive stacking on mobile"]
}

export interface BlueprintPage {
  route:       string;
  purpose:     string;
  components:  BlueprintComponent[];   // Rich component specs, not just names
  priority:    "primary" | "secondary";
}

export interface BlueprintDesignSystem {
  style:        string;   // e.g. "enterprise futuristic", "clean minimal"
  colorPrimary: string;   // descriptive, not hex — e.g. "deep navy"
  colorAccent:  string;   // e.g. "electric blue"
  typography:   string;   // e.g. "modern geometric sans"
  motion:       "none" | "subtle" | "expressive";
  borderRadius: "sharp" | "sm" | "md" | "lg" | "full";
}

export interface WebsiteBlueprint {
  projectType:    "marketing" | "saas" | "portfolio" | "ecommerce" | "blog" | "agency";
  pages:          BlueprintPage[];
  designSystem:   BlueprintDesignSystem;
  // Map of component name → its own sub-components / children
  componentHierarchy:    Record<string, string[]>;
  responsiveStrategy:    string;   // How the layout adapts across breakpoints
  interactionPlan:       string[]; // Key user interactions / animation moments
  contentStrategy:       string;   // Hierarchy of information and persuasion flow
  technicalRequirements: string[]; // Next.js features, libraries, accessibility needs
  architectRationale:    string;   // Why this structure fits the business
}

// ─── GenerationPlan ───────────────────────────────────────────────────────────
// Intermediate planning artifact — the Architect Agent's reasoning trace.
// Stored for observability; not sent to the Code Agent.
export interface GenerationPlan {
  businessSummary:    string;
  keyProblems:        string[];
  strategicDecisions: string[];
  riskFlags:          string[];
}

// ─── ProjectFile ──────────────────────────────────────────────────────────────
// Operation-based file representation for the generated project.
// Enables future agents to update individual files without regenerating the
// entire project. "language" is inferred from the file extension if omitted.
export interface ProjectFile {
  path:       string;                           // e.g. "app/page.tsx"
  operation:  "create" | "update" | "delete";  // always "create" on first generation
  content:    string;                           // full file content
  language?:  string;                           // e.g. "typescript", "css", "json"
}

// ─── GeneratedProject ─────────────────────────────────────────────────────────
// The Code Generation Agent's output (Phase 2).
// files: operation-based list of real Next.js project files.
// preview: standalone HTML for the iframe (no build step required).
// dependencies: npm packages the project needs beyond Next.js defaults.
// runInstructions: how to start the project locally after download.
export interface GeneratedProject {
  projectId?:       string;                    // set after DB persistence
  files:            ProjectFile[];             // operation-based file list
  dependencies:     string[];                  // e.g. ["framer-motion", "lucide-react"]
  runInstructions?: { command: string };        // e.g. { command: "npm run dev" }
  preview:          string;                    // self-contained HTML for <iframe srcDoc>
  blueprint:        WebsiteBlueprint;
  context:          BusinessContext;
}

// ─── API response shapes (consumed by Website Studio UI) ─────────────────────

// Lightweight summary returned by GET /api/website-v2/projects (list)
// Heavy fields (files, blueprint, preview) are omitted here.
export interface WebsiteProjectSummary {
  id:          string;
  projectName: string;
  status:      string;
  createdAt:   string;
  updatedAt:   string;
}

// Full project returned by GET /api/website-v2/projects/:id
// Every field needed to power the Website Studio workspace.
export interface WebsiteProjectResponse {
  id:              string;
  projectName:     string;
  status:          string;
  businessContext: BusinessContext;
  blueprint:       WebsiteBlueprint | null;
  files:           ProjectFile[];
  dependencies:    string[];
  preview:         string | null;
  createdAt:       string;
  updatedAt:       string;
}

// ─── AI Editing Agent types ───────────────────────────────────────────────────

// Input: what the user wants to change and which files to focus on.
export interface EditRequest {
  projectId:      string;
  instruction:    string;
  selectedFiles?: string[];   // file paths the user has selected; if empty, agent decides
}

// A single file modification produced by the editing agent.
export interface FileModification {
  path:      string;
  operation: "update" | "create" | "delete";
  content:   string;
  reason:    string;   // one-sentence explanation of what changed and why
}

// The editing agent's full response.
export interface EditResult {
  changes: FileModification[];
  summary: string;   // human-readable description of all changes made
}

// ─── SSE event shapes ─────────────────────────────────────────────────────────
// Typed payloads the V2 route writes to the SSE stream.
export type V2SseEvent =
  | { phase: "start";             model: string; industry: string }
  | { phase: "thinking";          active: boolean }
  | { phase: "architect";         content: string }
  | { phase: "project-created";   projectId: string }
  | { phase: "blueprint";         data: WebsiteBlueprint }
  /**
   * Emitted after blueprint validation and scope enforcement, before code generation begins.
   * Summarises the blueprint's complexity and signals whether it was trimmed.
   */
  | { phase: "blueprint-summary"; components: number; files: number; estimatedTokens: number; simplified: boolean }
  /**
   * Design Review Agent (Step 5): reviews the blueprint against 4 quality gates
   * before the code generation phase begins. content chunks stream the agent's
   * reasoning; blueprint-updated carries the improved blueprint when it changes.
   */
  | { phase: "design-review";     content?: string }
  | { phase: "blueprint-updated"; data: WebsiteBlueprint }
  | { phase: "building";          content?: string }
  | { phase: "project-saved";     projectId: string }
  | { phase: "done";              projectId: string; data: GeneratedProject }
  | { phase: "error";             message: string; code?: string }
  /** Marcus Conversation Engine events — narrate real agent work alongside generation. */
  | { phase: "agent";             event: ConversationEvent };

// SSE events from the editing route.
export type V2EditSseEvent =
  | { phase: "analyzing" }
  | { phase: "editing" }
  | { phase: "changes";       data: EditResult }
  | { phase: "saved";         fileCount: number }
  | { phase: "regenerating" }
  | { phase: "preview-ready" }
  | { phase: "error";         message: string }
  /** Marcus Conversation Engine events — real narration of the edit run (Commit 4). */
  | { phase: "agent";         event: ConversationEvent }
  /** Phase 14.1: Timeline update — live step-by-step engineering progress. */
  | { phase: "timeline";     data: import("./timeline-engine").TimelineUpdate }
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

/**
 * Carries the engineering advisory result — overall health, prioritized
 * recommendations, strengths, risks, trends, and next best action — from the
 * engineering advisor engine to the frontend EngineeringAdvisorPanel.
 */
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

/**
 * Carries the product intelligence assessment — overall score, business alignment,
 * UX impact, conversion impact, branding consistency, accessibility, SEO, and
 * recommendations — from the product intelligence engine to the frontend
 * EngineeringProductPanel.
 */
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

/**
 * Carries the engineering audit results — overall score, detected opportunities,
 * strengths, weaknesses, and summary — from the continuous engineering engine
 * to the frontend EngineeringAuditPanel.
 */
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

/**
 * Bundles confidence, risk, impact, validation health, and repair history into
 * a single SSE payload. Computed by the editing agent's post-execution analysis
 * and forwarded live to the EngineeringConfidencePanel.
 */
export interface ConfidencePayload {
  /** Overall confidence score 0–100. */
  score: number;
  /** Human-readable confidence level. */
  level: "high" | "medium" | "low";
  /** Detected execution risks. */
  risks: ConfidenceRisk[];
  /** Impact analysis summary. */
  impact: ConfidenceImpact;
  /** Validation health per validator. */
  validation: ConfidenceValidation;
  /** Confidence signal breakdown (expandable). */
  breakdown: ConfidenceBreakdown;
  /** Repair history if repairs occurred. */
  repairs: ConfidenceRepair[];
  /** When this snapshot was computed (ISO string). */
  timestamp: string;
}

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

// ─── Phase 14.3: Preview Intelligence Payload ──────────────────────────────────

/**
 * Captures preview runtime health, visual issues, and auto-repair status.
 * Computed by PreviewIntelligenceEngine after validation and before confidence
 * analysis. Used by the editing agent to self-correct preview issues.
 */
export interface PreviewPayload {
  /** Overall preview health status. */
  status: "healthy" | "warning" | "failed";
  /** Health score 0–100 derived from issue counts. */
  healthScore: number;
  /** Runtime JavaScript errors detected. */
  runtimeErrors: string[];
  /** Console warnings/errors found in code. */
  consoleErrors: string[];
  /** Missing asset references. */
  missingAssets: string[];
  /** Routes that are broken or missing. */
  brokenRoutes: string[];
  /** Visual/layout issues detected. */
  visualIssues: Array<{
    type: "overflow" | "missing-content" | "spacing" | "alignment" | "responsive" | "asset";
    severity: "low" | "medium" | "high";
    description: string;
    affectedFiles: string[];
  }>;
  /** Whether a repair pass is needed. */
  needsRepair: boolean;
  /** Number of repair attempts made. */
  repairAttempts: number;
  /** When this snapshot was computed (ISO string). */
  timestamp: string;
}

// ─── Phase 14.4: Visual Verification Payload ──────────────────────────────────

/**
 * Bundles visual QA results — layout analysis, responsive checks, design token
 * compliance, and before/after comparison — into a single SSE payload.
 * Computed by the visual-verification-engine after preview intelligence and
 * forwarded live to the EngineeringVisualPanel.
 */
export interface VisualPayload {
  /** Overall visual health score 0–100. */
  score: number;
  /** Human-readable visual status. */
  status: "healthy" | "warning" | "failed" | "critical";
  /** All detected visual issues. */
  issues: Array<{
    category: "layout-break" | "overlap" | "missing-section" | "spacing" | "responsive" | "typography" | "design-token" | "before-after-regression";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    suggestion?: string;
    affectedFiles: string[];
  }>;
  /** Before/after comparison data. */
  comparison: {
    modifiedVisuals: Array<{ path: string; reason: string }>;
    removedFiles: string[];
    addedFiles: string[];
    sectionDelta: number;
  };
  /** Score breakdown by category. */
  breakdown: {
    layoutScore: number;
    overlapScore: number;
    spacingScore: number;
    responsiveScore: number;
    typographyScore: number;
    designTokenScore: number;
    regressionScore: number;
  };
  /** Whether repair is needed. */
  needsRepair: boolean;
  /** Number of auto-repair attempts. */
  repairAttempts: number;
  /** Summary of findings. */
  summary: string;
  /** When this snapshot was computed (ISO string). */
  timestamp: string;
}

// ─── Phase 14.5: Recovery & Rollback Payload ───────────────────────────────────

/**
 * Carries snapshot, rollback, and recovery action data from the recovery engine
 * to the frontend EngineeringRecoveryPanel.
 */
export interface RecoveryPayload {
  /** Type of recovery event. */
  eventType: "snapshot_created" | "rollback_started" | "rollback_completed" | "recovery_success" | "recovery_failed";
  /** Snapshot ID if applicable. */
  snapshotId?: string;
  /** Why rollback was triggered (if applicable). */
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

// ─── Phase 14.6: Engineering Decision Payload ──────────────────────────────────

/**
 * Carries the engineering decision recommendation, risk assessment, strategy
 * selection, and tradeoff analysis from the decision engine to the frontend
 * EngineeringDecisionPanel.
 */
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

// SSE events from the preview regeneration route.
export type V2PreviewSseEvent =
  | { phase: "analyzing" }
  | { phase: "rendering" }
  | { phase: "preview"; data: { preview: string } }
  | { phase: "saved" }
  | { phase: "error"; message: string };
