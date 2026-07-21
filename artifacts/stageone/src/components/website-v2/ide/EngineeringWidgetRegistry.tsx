// ─── EngineeringWidgetRegistry — Command Center Widget Definitions ───────────
// Phase 15.2
//
// Each widget declares its id, title, priority, defaultSize, visibility
// condition, and render function. The Command Center reads this registry
// to decide what to show and in what layout.

import React from "react";
import { EngineeringTimeline } from "./EngineeringTimeline";
import { EngineeringConfidencePanel } from "./EngineeringConfidencePanel";
import { EngineeringVisualPanel } from "./EngineeringVisualPanel";
import { EngineeringRecoveryPanel } from "./EngineeringRecoveryPanel";
import { EngineeringDecisionPanel } from "./EngineeringDecisionPanel";
import { EngineeringAuditPanel } from "./EngineeringAuditPanel";
import { EngineeringProductPanel } from "./EngineeringProductPanel";
import { EngineeringAdvisorPanel } from "./EngineeringAdvisorPanel";
import { EngineeringRoadmapPanel } from "./EngineeringRoadmapPanel";
import type { EngineeringStoreState } from "./EngineeringStore";

// ─── Widget type ──────────────────────────────────────────────────────────────

export type WidgetSize = "small" | "medium" | "large" | "full";

export interface WidgetDefinition {
  /** Unique widget identifier. */
  id: string;
  /** Display title. */
  title: string;
  /** Render priority (higher = shown first). */
  priority: number;
  /** Default widget size in grid. */
  defaultSize: WidgetSize;
  /** Whether the widget has data to show. */
  visible: (state: EngineeringStoreState) => boolean;
  /** Whether the widget is actively updating (for focus mode). */
  isActive: (state: EngineeringStoreState) => boolean;
  /** Render the widget content. */
  render: (state: EngineeringStoreState, compact?: boolean) => React.ReactNode;
}

// ─── Registry ─────────────────────────────────────────────────────────────────

export const widgetRegistry: WidgetDefinition[] = [
  // ── 1. Timeline ──────────────────────────────────────────────────────────
  {
    id: "timeline",
    title: "Engineering Timeline",
    priority: 100,
    defaultSize: "full",
    visible: (s) => s.timeline !== null && s.timeline.status === "running",
    isActive: (s) => s.timeline !== null && s.timeline.status === "running",
    render: (s, compact) => (
      <EngineeringTimeline externalState={s.timeline} compact={compact} />
    ),
  },

  // ── 2. Confidence Intelligence ───────────────────────────────────────────
  {
    id: "confidence",
    title: "Confidence & Risk",
    priority: 90,
    defaultSize: "medium",
    visible: (s) => s.confidence !== null && s.confidence.initialized,
    isActive: (s) => s.confidence !== null && s.confidence.score < 80,
    render: (s, compact) => (
      <EngineeringConfidencePanel externalState={s.confidence} compact={compact} />
    ),
  },

  // ── 3. Visual Verification ───────────────────────────────────────────────
  {
    id: "visual",
    title: "Visual Verification",
    priority: 80,
    defaultSize: "medium",
    visible: (s) => s.visual !== null && s.visual.initialized,
    isActive: (s) => s.visual !== null && (s.visual.score < 80 || s.visual.needsRepair),
    render: (s, compact) => (
      <EngineeringVisualPanel externalState={s.visual} compact={compact} />
    ),
  },

  // ── 4. Recovery & Rollback ───────────────────────────────────────────────
  {
    id: "recovery",
    title: "Recovery & Rollback",
    priority: 70,
    defaultSize: "medium",
    visible: (s) => s.recovery !== null && s.recovery.initialized,
    isActive: (s) => s.recovery !== null && (s.recovery.rollbackInProgress || s.recovery.eventType !== null),
    render: (s, compact) => (
      <EngineeringRecoveryPanel externalState={s.recovery} compact={compact} />
    ),
  },

  // ── 5. Engineering Decision ──────────────────────────────────────────────
  {
    id: "decision",
    title: "Engineering Decision",
    priority: 85,
    defaultSize: "medium",
    visible: (s) => s.decision !== null && s.decision.initialized,
    isActive: (s) => s.decision !== null && (s.decision.recommendation === "defer" || s.decision.recommendation === "repair-first" || s.decision.recommendation === "rollback"),
    render: (s, compact) => (
      <EngineeringDecisionPanel externalState={s.decision} compact={compact} />
    ),
  },

  // ── 6. Engineering Audit ─────────────────────────────────────────────────
  {
    id: "audit",
    title: "Engineering Audit",
    priority: 60,
    defaultSize: "medium",
    visible: (s) => s.audit !== null && s.audit.initialized,
    isActive: (s) => s.audit !== null && s.audit.criticalCount > 0,
    render: (s, compact) => (
      <EngineeringAuditPanel externalState={s.audit} compact={compact} />
    ),
  },

  // ── 7. Product Intelligence ──────────────────────────────────────────────
  {
    id: "product",
    title: "Product Intelligence",
    priority: 75,
    defaultSize: "medium",
    visible: (s) => s.product !== null && s.product.initialized,
    isActive: (s) => s.product !== null && (s.product.recommendation === "reject" || s.product.recommendation === "revise"),
    render: (s, compact) => (
      <EngineeringProductPanel externalState={s.product} compact={compact} />
    ),
  },

  // ── 8. Engineering Advisor ──────────────────────────────────────────────
  {
    id: "advisor",
    title: "Engineering Advisor",
    priority: 85,
    defaultSize: "medium",
    visible: (s) => s.advisor !== null && s.advisor.initialized && s.advisor.recommendations.length > 0,
    isActive: (s) => s.advisor !== null && s.advisor.recommendations.some((r) => r.priority === "critical" || r.priority === "high"),
    render: (s, compact) => (
      <EngineeringAdvisorPanel externalState={s.advisor} compact={compact} />
    ),
  },

  // ── 9. Engineering Roadmap ─────────────────────────────────────────────
  {
    id: "roadmap",
    title: "Engineering Roadmap",
    priority: 80,
    defaultSize: "medium",
    visible: (s) => s.roadmap !== null && s.roadmap.initialized && s.roadmap.items.length > 0,
    isActive: (s) => s.roadmap !== null && s.roadmap.items.some((i) => i.priority === "critical" && i.status !== "completed"),
    render: (s, compact) => (
      <EngineeringRoadmapPanel externalState={s.roadmap} compact={compact} />
    ),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Get sorted visible widgets for a given store state. */
export function getVisibleWidgets(
  state: EngineeringStoreState,
  focusedWidgetId?: string | null,
): WidgetDefinition[] {
  const all = [...widgetRegistry].sort((a, b) => b.priority - a.priority);

  if (focusedWidgetId) {
    // In focus mode, show only the focused widget and those that are active
    return all.filter(
      (w) => w.id === focusedWidgetId || w.isActive(state),
    );
  }

  return all.filter((w) => w.visible(state));
}

/** Get the active widget IDs for a given state. */
export function getActiveWidgetIds(state: EngineeringStoreState): string[] {
  return widgetRegistry
    .filter((w) => w.isActive(state))
    .map((w) => w.id);
}

/** Grid column class based on widget size. */
export function getWidgetSizeClass(size: WidgetSize): string {
  switch (size) {
    case "small":  return "col-span-1";
    case "medium": return "col-span-1 md:col-span-1";
    case "large":  return "col-span-2";
    case "full":   return "col-span-full";
  }
}
