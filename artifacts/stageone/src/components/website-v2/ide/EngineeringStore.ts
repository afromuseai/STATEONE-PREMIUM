// ─── EngineeringStore — Shared State for Engineering Command Center ──────────
// Phase 15.2
//
// Single source of truth for all engineering panels.
// Subscribes to wsRuntimeEmitter ONCE and distributes memoized state slices.
// No duplicate SSE listeners across widgets.

import { useEffect, useReducer, useMemo, useCallback, useRef } from "react";
import { wsRuntimeEmitter } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEmitter";
import type { WSRuntimeEvent } from "@/components/website-v2/runtime/WebsiteStudioRuntimeEvents";

// ─── Subsystem types (re-exported for convenience) ────────────────────────────

export type { TimelineState, TimelineStepData } from "./EngineeringTimeline";
export type { ConfidencePanelState } from "./EngineeringConfidencePanel";
export type { VisualPanelState } from "./EngineeringVisualPanel";
export type { RecoveryPanelState } from "./EngineeringRecoveryPanel";
export type { DecisionPanelState } from "./EngineeringDecisionPanel";
export type { AuditPanelState } from "./EngineeringAuditPanel";
export type { ProductPanelState } from "./EngineeringProductPanel";
export type { AdvisorPanelState } from "./EngineeringAdvisorPanel";
export type { RoadmapPanelState } from "./EngineeringRoadmapPanel";

// ─── Command Center State ─────────────────────────────────────────────────────

export interface EngineeringStoreState {
  /** Current engineering phase. */
  phase: string | null;
  /** Whether an edit is actively running. */
  isRunning: boolean;

  // Subsystem states (populated from events).
  timeline: import("./EngineeringTimeline").TimelineState | null;
  confidence: import("./EngineeringConfidencePanel").ConfidencePanelState | null;
  visual: import("./EngineeringVisualPanel").VisualPanelState | null;
  recovery: import("./EngineeringRecoveryPanel").RecoveryPanelState | null;
  decision: import("./EngineeringDecisionPanel").DecisionPanelState | null;
  audit: import("./EngineeringAuditPanel").AuditPanelState | null;
  product: import("./EngineeringProductPanel").ProductPanelState | null;
  advisor: import("./EngineeringAdvisorPanel").AdvisorPanelState | null;
  roadmap: import("./EngineeringRoadmapPanel").RoadmapPanelState | null;

  /** Last N activity entries for the activity feed. */
  activityFeed: Array<{ kind: string; title: string; status: string; timestamp: number }>;

  /** Learning telemetry from last completed execution. */
  learning: {
    improvementScore: number;
    policyRevisions: number;
    lastExecutionId: string | null;
  };

  /** Recommendations merged from audit, decision, and confidence subsystems. */
  recommendations: Array<{
    id: string;
    source: "audit" | "decision" | "confidence" | "recovery" | "learning";
    title: string;
    severity: "info" | "warning" | "critical";
    priority: number;
    timestamp: number;
  }>;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

type StoreAction =
  | { type: "SET_PHASE"; phase: string }
  | { type: "SET_RUNNING"; isRunning: boolean }
  | { type: "UPDATE_TIMELINE"; state: import("./EngineeringTimeline").TimelineState }
  | { type: "UPDATE_CONFIDENCE"; state: import("./EngineeringConfidencePanel").ConfidencePanelState }
  | { type: "UPDATE_VISUAL"; state: import("./EngineeringVisualPanel").VisualPanelState }
  | { type: "UPDATE_RECOVERY"; state: import("./EngineeringRecoveryPanel").RecoveryPanelState }
  | { type: "UPDATE_DECISION"; state: import("./EngineeringDecisionPanel").DecisionPanelState }
  | { type: "UPDATE_AUDIT"; state: import("./EngineeringAuditPanel").AuditPanelState }
  | { type: "UPDATE_PRODUCT"; state: import("./EngineeringProductPanel").ProductPanelState }
  | { type: "UPDATE_ADVISOR"; state: import("./EngineeringAdvisorPanel").AdvisorPanelState }
  | { type: "UPDATE_ROADMAP"; state: import("./EngineeringRoadmapPanel").RoadmapPanelState }
  | { type: "ADD_ACTIVITY"; kind: string; title: string; status: string }
  | { type: "UPDATE_LEARNING"; payload: Partial<EngineeringStoreState["learning"]> }
  | { type: "ADD_RECOMMENDATION"; recommendation: EngineeringStoreState["recommendations"][0] }
  | { type: "CLEAR_RECOMMENDATIONS" };

// ─── Initial state ────────────────────────────────────────────────────────────

const initialLearning = { improvementScore: 0, policyRevisions: 0, lastExecutionId: null };

export const initialEngineeringState: EngineeringStoreState = {
  phase: null,
  isRunning: false,
  timeline: null,
  confidence: null,
  visual: null,
  recovery: null,
  decision: null,
  audit: null,
  product: null,
  advisor: null,
  roadmap: null,
  activityFeed: [],
  learning: initialLearning,
  recommendations: [],
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function engineeringReducer(state: EngineeringStoreState, action: StoreAction): EngineeringStoreState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };

    case "SET_RUNNING":
      return { ...state, isRunning: action.isRunning };

    case "UPDATE_TIMELINE":
      return { ...state, timeline: action.state };

    case "UPDATE_CONFIDENCE":
      return { ...state, confidence: action.state };

    case "UPDATE_VISUAL":
      return { ...state, visual: action.state };

    case "UPDATE_RECOVERY":
      return { ...state, recovery: action.state };

    case "UPDATE_DECISION":
      return { ...state, decision: action.state };

    case "UPDATE_AUDIT":
      return { ...state, audit: action.state };

    case "UPDATE_PRODUCT":
      return { ...state, product: action.state };

    case "UPDATE_ADVISOR":
      return { ...state, advisor: action.state };

    case "UPDATE_ROADMAP":
      return { ...state, roadmap: action.state };

    case "ADD_ACTIVITY": {
      const feed = [
        { kind: action.kind, title: action.title, status: action.status, timestamp: Date.now() },
        ...state.activityFeed,
      ].slice(0, 50); // Keep last 50
      return { ...state, activityFeed: feed };
    }

    case "UPDATE_LEARNING":
      return { ...state, learning: { ...state.learning, ...action.payload } };

    case "ADD_RECOMMENDATION": {
      // Deduplicate by id
      if (state.recommendations.some((r) => r.id === action.recommendation.id)) return state;
      const recs = [...state.recommendations, action.recommendation]
        .sort((a, b) => b.priority - a.priority)
        .slice(0, 20);
      return { ...state, recommendations: recs };
    }

    case "CLEAR_RECOMMENDATIONS":
      return { ...state, recommendations: [] };

    default:
      return state;
  }
}

// ─── Store hook ───────────────────────────────────────────────────────────────

let singletonDispatch: ((action: StoreAction) => void) | null = null;
let storeInitialized = false;

/**
 * Hook that returns the shared engineering store state.
 * Subscribes to wsRuntimeEmitter exactly once (module-level).
 * All widgets share the same subscription.
 */
export function useEngineeringStore(): EngineeringStoreState {
  const [state, dispatch] = useReducer(engineeringReducer, initialEngineeringState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Register the dispatch function so the singleton subscriber can use it
  useEffect(() => {
    singletonDispatch = dispatch;
    return () => {
      singletonDispatch = null;
    };
  }, [dispatch]);

  // Subscribe to wsRuntimeEmitter once
  useEffect(() => {
    if (storeInitialized) return;
    storeInitialized = true;

    const handler = (event: WSRuntimeEvent) => {
      const d = singletonDispatch;
      if (!d) return;

      switch (event.type) {
        // ── Phase events ────────────────────────────────────────────────
        case "PhaseChanged": {
          d({ type: "SET_PHASE", phase: String(event.payload.phase ?? "") });
          const isRun = String(event.payload.phase ?? "") !== "";
          d({ type: "SET_RUNNING", isRunning: isRun });
          break;
        }

        // ── Activity events ─────────────────────────────────────────────
        case "ActivityStarted":
        case "ActivityUpdated":
        case "ActivityCompleted":
        case "ActivityFailed": {
          d({
            type: "ADD_ACTIVITY",
            kind: String(event.payload.type ?? event.type),
            title: String(event.payload.title ?? event.payload.description ?? ""),
            status: event.type === "ActivityFailed" ? "failed" : event.type === "ActivityCompleted" ? "completed" : "running",
          });
          break;
        }

        // ── Timeline ────────────────────────────────────────────────────
        case "TimelineUpdate": {
          const tlPayload = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_TIMELINE",
            state: {
              timelineId: String(tlPayload.timelineId ?? ""),
              status: (tlPayload.status as "running" | "completed" | "failed") ?? "running",
              steps: Array.isArray(tlPayload.steps) ? tlPayload.steps : [],
              totalDurationMs: typeof tlPayload.totalDurationMs === "number" ? tlPayload.totalDurationMs : undefined,
            } as import("./EngineeringTimeline").TimelineState,
          });
          break;
        }

        // ── Confidence ──────────────────────────────────────────────────
        case "ConfidenceUpdate": {
          const cP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_CONFIDENCE",
            state: {
              score: typeof cP.score === "number" ? cP.score : 0,
              level: (cP.level as "high" | "medium" | "low") ?? "medium",
              risks: Array.isArray(cP.risks) ? cP.risks : [],
              impact: cP.impact ?? { score: 0, affectedFiles: 0, affectedComponents: 0, affectedRoutes: 0, dependenciesTouched: 0 },
              validation: cP.validation ?? { typescript: "pending", eslint: "pending", build: "pending" },
              breakdown: cP.breakdown ?? { planningQuality: 0, validationScore: 0, workspaceConsistency: 0, historicalSuccess: 0, specialistConfidence: 0, repairStability: 0 },
              repairs: Array.isArray(cP.repairs) ? cP.repairs : [],
              preview: {
                status: (cP.preview as Record<string, unknown> | undefined)?.status ?? "healthy",
                healthScore: typeof (cP.preview as Record<string, unknown> | undefined)?.healthScore === "number"
                  ? (cP.preview as Record<string, unknown>).healthScore as number : 100,
                runtimeErrors: Array.isArray((cP.preview as Record<string, unknown> | undefined)?.runtimeErrors)
                  ? (cP.preview as Record<string, unknown>).runtimeErrors as string[] : [],
                visualIssues: Array.isArray((cP.preview as Record<string, unknown> | undefined)?.visualIssues)
                  ? (cP.preview as Record<string, unknown>).visualIssues as [] : [],
                repairAttempts: typeof (cP.preview as Record<string, unknown> | undefined)?.repairAttempts === "number"
                  ? (cP.preview as Record<string, unknown>).repairAttempts as number : 0,
              },
              timestamp: String(cP.timestamp ?? null),
              initialized: true,
            } as import("./EngineeringConfidencePanel").ConfidencePanelState,
          });
          break;
        }

        // ── Preview ─────────────────────────────────────────────────────
        case "PreviewUpdate": {
          // Preview is embedded in confidence state, but also update standalone
          const pP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_CONFIDENCE",
            state: {
              score: typeof pP.healthScore === "number" ? pP.healthScore : 100,
              level: pP.status === "failed" ? "low" : pP.status === "warning" ? "medium" : "high",
              risks: [],
              impact: { score: 0, affectedFiles: 0, affectedComponents: 0, affectedRoutes: 0, dependenciesTouched: 0 },
              validation: { typescript: "pending" as const, eslint: "pending" as const, build: "pending" as const },
              breakdown: { planningQuality: 0, validationScore: 0, workspaceConsistency: 0, historicalSuccess: 0, specialistConfidence: 0, repairStability: 0 },
              repairs: [],
              preview: {
                status: (pP.status as "healthy" | "warning" | "failed") ?? "healthy",
                healthScore: typeof pP.healthScore === "number" ? pP.healthScore : 100,
                runtimeErrors: Array.isArray(pP.runtimeErrors) ? pP.runtimeErrors as string[] : [],
                visualIssues: Array.isArray(pP.visualIssues) ? pP.visualIssues as [] : [],
                repairAttempts: typeof pP.repairAttempts === "number" ? pP.repairAttempts : 0,
              },
              timestamp: String(pP.timestamp ?? null),
              initialized: true,
            } as import("./EngineeringConfidencePanel").ConfidencePanelState,
          });
          break;
        }

        // ── Visual ──────────────────────────────────────────────────────
        case "VisualUpdate": {
          const vP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_VISUAL",
            state: {
              score: typeof vP.score === "number" ? vP.score : 100,
              status: (vP.status as "healthy" | "warning" | "failed" | "critical") ?? "healthy",
              issues: Array.isArray(vP.issues) ? vP.issues : [],
              comparison: vP.comparison ?? { modifiedVisuals: [], removedFiles: [], addedFiles: [], sectionDelta: 0 },
              breakdown: vP.breakdown ?? { layoutScore: 0, overlapScore: 0, spacingScore: 0, responsiveScore: 0, typographyScore: 0, designTokenScore: 0, regressionScore: 0 },
              needsRepair: Boolean(vP.needsRepair),
              repairAttempts: typeof vP.repairAttempts === "number" ? vP.repairAttempts : 0,
              summary: String(vP.summary ?? ""),
              timestamp: String(vP.timestamp ?? null),
              initialized: true,
            } as import("./EngineeringVisualPanel").VisualPanelState,
          });
          break;
        }

        // ── Recovery ────────────────────────────────────────────────────
        case "RecoveryUpdate": {
          const rP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_RECOVERY",
            state: {
              eventType: (rP.eventType as import("./EngineeringRecoveryPanel").RecoveryPanelState["eventType"]) ?? null,
              snapshotId: String(rP.snapshotId ?? null),
              trigger: (rP.trigger as import("./EngineeringRecoveryPanel").RecoveryPanelState["trigger"]) ?? null,
              description: String(rP.description ?? ""),
              rolledBackFiles: Array.isArray(rP.rolledBackFiles) ? rP.rolledBackFiles as string[] : [],
              snapshotCount: typeof rP.snapshotCount === "number" ? rP.snapshotCount : 0,
              currentVersion: typeof rP.currentVersion === "number" ? rP.currentVersion : 0,
              totalVersions: typeof rP.totalVersions === "number" ? rP.totalVersions : 0,
              metadata: (rP.metadata as Record<string, unknown>) ?? null,
              timestamp: String(rP.timestamp ?? null),
              initialized: true,
              history: Array.isArray(rP.history) ? rP.history : [],
              rollbackInProgress: Boolean(rP.rollbackInProgress),
              lastRollbackSuccess: rP.lastRollbackSuccess === null ? null : Boolean(rP.lastRollbackSuccess),
            } as import("./EngineeringRecoveryPanel").RecoveryPanelState,
          });
          break;
        }

        // ── Decision ────────────────────────────────────────────────────
        case "DecisionUpdate": {
          const dP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_DECISION",
            state: {
              recommendation: (dP.recommendation as import("./EngineeringDecisionPanel").DecisionPanelState["recommendation"]) ?? null,
              confidence: typeof dP.confidence === "number" ? dP.confidence : 0,
              estimatedRisk: typeof dP.estimatedRisk === "number" ? dP.estimatedRisk : 0,
              executionStrategy: (dP.executionStrategy as import("./EngineeringDecisionPanel").DecisionPanelState["executionStrategy"]) ?? null,
              chosenOption: String(dP.chosenOption ?? ""),
              alternativeOptions: Array.isArray(dP.alternativeOptions) ? dP.alternativeOptions : [],
              tradeoffs: Array.isArray(dP.tradeoffs) ? dP.tradeoffs : [],
              rationale: Array.isArray(dP.rationale) ? dP.rationale as string[] : [],
              decisionTimeMs: typeof dP.decisionTimeMs === "number" ? dP.decisionTimeMs : 0,
              timestamp: String(dP.timestamp ?? null),
              initialized: true,
            } as import("./EngineeringDecisionPanel").DecisionPanelState,
          });
          break;
        }

        // ── Advisor ─────────────────────────────────────────────────────
        case "AdvisorUpdate": {
          const aP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_ADVISOR",
            state: {
              overallHealth: typeof aP.overallHealth === "number" ? aP.overallHealth : 0,
              recommendations: Array.isArray(aP.recommendations) ? aP.recommendations as import("./EngineeringAdvisorPanel").AdvisorPanelState["recommendations"] : [],
              strengths: Array.isArray(aP.strengths) ? aP.strengths as string[] : [],
              risks: Array.isArray(aP.risks) ? aP.risks as string[] : [],
              trends: Array.isArray(aP.trends) ? aP.trends as string[] : [],
              nextBestAction: String(aP.nextBestAction ?? ""),
              initialized: true,
            } as import("./EngineeringAdvisorPanel").AdvisorPanelState,
          });
          break;
        }

        // ── Roadmap ────────────────────────────────────────────────────
        case "RoadmapUpdate": {
          const rP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_ROADMAP",
            state: {
              items: Array.isArray(rP.items) ? rP.items as import("./EngineeringRoadmapPanel").RoadmapPanelState["items"] : [],
              summary: String(rP.summary ?? ""),
              completionPercentage: typeof rP.completionPercentage === "number" ? rP.completionPercentage : 0,
              currentFocus: Array.isArray(rP.currentFocus) ? rP.currentFocus as import("./EngineeringRoadmapPanel").RoadmapPanelState["currentFocus"] : [],
              recentlyCompleted: Array.isArray(rP.recentlyCompleted) ? rP.recentlyCompleted as import("./EngineeringRoadmapPanel").RoadmapPanelState["recentlyCompleted"] : [],
              roadmapHealth: String(rP.roadmapHealth ?? "healthy"),
              initialized: true,
            } as import("./EngineeringRoadmapPanel").RoadmapPanelState,
          });
          break;
        }

        // ── Product ─────────────────────────────────────────────────────
        case "ProductUpdate": {
          const pP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_PRODUCT",
            state: {
              overallScore: typeof pP.overallScore === "number" ? pP.overallScore : 0,
              recommendation: (pP.recommendation as import("./EngineeringProductPanel").ProductPanelState["recommendation"]) ?? null,
              businessAlignment: typeof pP.businessAlignment === "number" ? pP.businessAlignment : 0,
              uxImpact: typeof pP.uxImpact === "number" ? pP.uxImpact : 0,
              conversionImpact: typeof pP.conversionImpact === "number" ? pP.conversionImpact : 0,
              brandingConsistency: typeof pP.brandingConsistency === "number" ? pP.brandingConsistency : 0,
              accessibilityImpact: typeof pP.accessibilityImpact === "number" ? pP.accessibilityImpact : 0,
              seoImpact: typeof pP.seoImpact === "number" ? pP.seoImpact : 0,
              maintainabilityImpact: typeof pP.maintainabilityImpact === "number" ? pP.maintainabilityImpact : 0,
              userRisk: typeof pP.userRisk === "number" ? pP.userRisk : 0,
              reasoning: Array.isArray(pP.reasoning) ? pP.reasoning as string[] : [],
              recommendations: Array.isArray(pP.recommendations) ? pP.recommendations as string[] : [],
              warnings: Array.isArray(pP.warnings) ? pP.warnings as string[] : [],
              assessmentTimeMs: typeof pP.assessmentTimeMs === "number" ? pP.assessmentTimeMs : 0,
              timestamp: String(pP.timestamp ?? null),
              initialized: true,
            } as import("./EngineeringProductPanel").ProductPanelState,
          });
          break;
        }

        // ── Audit ───────────────────────────────────────────────────────
        case "AuditUpdate": {
          const aP = event.payload as Record<string, unknown>;
          d({
            type: "UPDATE_AUDIT",
            state: {
              score: typeof aP.score === "number" ? aP.score : 100,
              opportunities: Array.isArray(aP.topOpportunities) ? aP.topOpportunities : [],
              criticalCount: typeof aP.criticalCount === "number" ? aP.criticalCount : 0,
              highPriorityCount: typeof aP.highPriorityCount === "number" ? aP.highPriorityCount : 0,
              strengths: Array.isArray(aP.strengths) ? aP.strengths as string[] : [],
              weaknesses: Array.isArray(aP.weaknesses) ? aP.weaknesses as string[] : [],
              summary: String(aP.summary ?? ""),
              durationMs: typeof aP.durationMs === "number" ? aP.durationMs : 0,
              timestamp: String(aP.timestamp ?? null),
              initialized: true,
            } as import("./EngineeringAuditPanel").AuditPanelState,
          });
          break;
        }
      }
    };

    const unsub = wsRuntimeEmitter.subscribe(handler);

    return () => {
      unsub();
      storeInitialized = false;
    };
  }, []);

  return state;
}

// ─── Selector hooks (memoized slices) ─────────────────────────────────────────

export function useTimelineState(): import("./EngineeringTimeline").TimelineState | null {
  const state = useEngineeringStore();
  return state.timeline;
}

export function useConfidenceState(): import("./EngineeringConfidencePanel").ConfidencePanelState | null {
  const state = useEngineeringStore();
  return state.confidence;
}

export function useVisualState(): import("./EngineeringVisualPanel").VisualPanelState | null {
  const state = useEngineeringStore();
  return state.visual;
}

export function useRecoveryState(): import("./EngineeringRecoveryPanel").RecoveryPanelState | null {
  const state = useEngineeringStore();
  return state.recovery;
}

export function useDecisionState(): import("./EngineeringDecisionPanel").DecisionPanelState | null {
  const state = useEngineeringStore();
  return state.decision;
}

export function useAuditState(): import("./EngineeringAuditPanel").AuditPanelState | null {
  const state = useEngineeringStore();
  return state.audit;
}

export function useProductState(): import("./EngineeringProductPanel").ProductPanelState | null {
  const state = useEngineeringStore();
  return state.product;
}

export function useAdvisorState(): import("./EngineeringAdvisorPanel").AdvisorPanelState | null {
  const state = useEngineeringStore();
  return state.advisor;
}

export function useRoadmapState(): import("./EngineeringRoadmapPanel").RoadmapPanelState | null {
  const state = useEngineeringStore();
  return state.roadmap;
}
