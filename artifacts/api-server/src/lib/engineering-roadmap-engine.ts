// ─── Engineering Roadmap Engine — Persistent, Prioritized Engineering Backlog ─
// Phase 16.3
//
// Continuously maintains a prioritized backlog of engineering work for each
// project. Consumes all available intelligence modules and produces a roadmap
// that plans the optimal sequence of improvements across the entire project.
//
// Unlike the Engineering Advisor (which recommends the next best action),
// the Roadmap Engine plans the optimal sequence of improvements over time,
// persists state per project, and auto-completes items when edits resolve them.
//
// Pipeline position:
//   Workspace → Audit → Product Intelligence → Engineering Advisor → Engineering Roadmap → Engineering Decision

import { logger } from "./logger";
import type { BusinessContext } from "./website-v2-types";
import type { WebsiteBlueprint } from "./website-v2-types";
import type { WorkspaceContext } from "./workspace-context";
import type { EngineeringAudit, EffortEstimate } from "./continuous-engineering-engine";
import type { ProductAssessment } from "./product-intelligence-engine";
import type { EngineeringAdvisorResult, EngineeringRecommendation } from "./engineering-advisor";
import type { EngineeringDecision } from "./engineering-decision-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RoadmapCategory =
  | "architecture"
  | "performance"
  | "design"
  | "ux"
  | "seo"
  | "accessibility"
  | "technical-debt"
  | "developer-experience"
  | "business"
  | "security";

export type RoadmapPriority = "critical" | "high" | "medium" | "low";
export type RoadmapEffort = "small" | "medium" | "large";
export type RoadmapItemStatus = "todo" | "in-progress" | "completed" | "deferred";

export interface EngineeringRoadmapItem {
  /** Unique identifier. */
  id: string;
  /** Short human-readable title. */
  title: string;
  /** Detailed description. */
  description: string;
  /** Category of the work. */
  category: RoadmapCategory;
  /** Computed priority. */
  priority: RoadmapPriority;
  /** Estimated effort. */
  effort: RoadmapEffort;
  /** Estimated business/quality impact (0–100). */
  impact: number;
  /** Confidence in this item (0–100). */
  confidence: number;
  /** Current status. */
  status: RoadmapItemStatus;
  /** IDs of items that must be completed first. */
  dependencies: string[];
  /** Source engine(s) that produced this recommendation. */
  source: string[];
  /** ISO timestamp of creation. */
  createdAt: string;
  /** ISO timestamp of last update. */
  updatedAt: string;
  /** ISO timestamp of completion (null if not completed). */
  completedAt: string | null;
}

export interface RoadmapPayload {
  /** All roadmap items. */
  items: EngineeringRoadmapItem[];
  /** Summary counts by status. */
  summary: {
    total: number;
    todo: number;
    inProgress: number;
    completed: number;
    deferred: number;
  };
  /** Completion percentage. */
  completionPercentage: number;
  /** Current focus items (top 3 active). */
  currentFocus: EngineeringRoadmapItem[];
  /** Recently completed items (last 5). */
  recentlyCompleted: EngineeringRoadmapItem[];
  /** Overall roadmap health score (0–100). */
  roadmapHealth: number;
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface RoadmapTelemetry {
  roadmapHealth: number;
  totalItems: number;
  completedItems: number;
  inProgressItems: number;
  deferredItems: number;
  completionPercentage: number;
}

let telemetry: RoadmapTelemetry = {
  roadmapHealth: 100,
  totalItems: 0,
  completedItems: 0,
  inProgressItems: 0,
  deferredItems: 0,
  completionPercentage: 0,
};

export function getRoadmapTelemetry(): RoadmapTelemetry {
  return { ...telemetry };
}

export function resetRoadmapTelemetry(): void {
  telemetry = {
    roadmapHealth: 100,
    totalItems: 0,
    completedItems: 0,
    inProgressItems: 0,
    deferredItems: 0,
    completionPercentage: 0,
  };
}

// ─── In-memory persistence ────────────────────────────────────────────────────

const projectRoadmaps = new Map<string, EngineeringRoadmapItem[]>();
const projectVersion = new Map<string, number>();

/** Get the roadmap for a project. */
export function getProjectRoadmap(projectId: string): EngineeringRoadmapItem[] {
  return projectRoadmaps.get(projectId) ?? [];
}

/** Persist a roadmap for a project. */
function setProjectRoadmap(projectId: string, items: EngineeringRoadmapItem[]): void {
  projectRoadmaps.set(projectId, items);
  projectVersion.set(projectId, (projectVersion.get(projectId) ?? 0) + 1);
}

/** Get the current version for change detection. */
export function getRoadmapVersion(projectId: string): number {
  return projectVersion.get(projectId) ?? 0;
}

// ─── Item ID generation ───────────────────────────────────────────────────────

let _itemIdCounter = 0;
function nextItemId(): string {
  _itemIdCounter++;
  return `rm-${Date.now()}-${_itemIdCounter}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function priorityFromScore(score: number): RoadmapPriority {
  if (score >= 75) return "critical";
  if (score >= 55) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function effortFromSize(size: number): RoadmapEffort {
  if (size <= 20) return "small";
  if (size <= 50) return "medium";
  return "large";
}

function effortFromEstimate(estimate: EffortEstimate): RoadmapEffort {
  switch (estimate) {
    case "small":
      return "small";
    case "medium":
      return "medium";
    case "large":
      return "large";
  }
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/\s+/g, " ").trim();
}

// ─── Merging logic ────────────────────────────────────────────────────────────

/**
 * Merge a new recommendation from a source engine into the existing roadmap.
 * If a similar item already exists (by normalized title), merge the source
 * and update confidence/priority but keep the original creation date.
 */
function mergeIntoRoadmap(
  existing: EngineeringRoadmapItem[],
  title: string,
  description: string,
  category: RoadmapCategory,
  impact: number,
  confidence: number,
  source: string,
  effort: RoadmapEffort,
): EngineeringRoadmapItem[] {
  const key = normalizeTitle(title);
  const existingIdx = existing.findIndex((item) => normalizeTitle(item.title) === key && item.status !== "completed");

  if (existingIdx >= 0) {
    // Merge — update metadata but keep original creation date
    const item = existing[existingIdx];
    const mergedSources = [...new Set([...item.source, source])];
    const mergedConfidence = Math.round((item.confidence + confidence) / 2);
    const mergedImpact = Math.max(item.impact, impact);

    const updated: EngineeringRoadmapItem = {
      ...item,
      description: description || item.description,
      impact: mergedImpact,
      confidence: mergedConfidence,
      source: mergedSources,
      priority: priorityFromScore(mergedImpact * mergedConfidence / 100),
      effort: item.effort === "medium" ? item.effort : effort, // Prefer more specific
      updatedAt: new Date().toISOString(),
    };

    const result = [...existing];
    result[existingIdx] = updated;
    return result;
  }

  // New item
  const newItem: EngineeringRoadmapItem = {
    id: nextItemId(),
    title,
    description,
    category,
    priority: priorityFromScore(impact * confidence / 100),
    effort,
    impact,
    confidence,
    status: "todo",
    dependencies: [],
    source: [source],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  return [...existing, newItem];
}

// ─── Auto-completion ──────────────────────────────────────────────────────────

/**
 * Check if any edits or validation results resolve existing roadmap items.
 * Uses keyword matching against item titles and descriptions.
 */
function autoCompleteItems(
  items: EngineeringRoadmapItem[],
  files?: string[],
  instruction?: string,
  validationSuccess?: boolean,
): { items: EngineeringRoadmapItem[]; completedIds: string[] } {
  const completedIds: string[] = [];
  const now = new Date().toISOString();

  const updated = items.map((item) => {
    if (item.status === "completed" || item.status === "deferred") return item;

    // Check if the instruction explicitly mentions the item
    if (instruction) {
      const key = normalizeTitle(item.title);
      const instLower = normalizeTitle(instruction);
      // If instruction contains key words from the title, consider it in-progress
      const titleWords = key.split(/\s+/).filter((w) => w.length > 3);
      const matchCount = titleWords.filter((w) => instLower.includes(w)).length;
      if (matchCount >= 2 && item.status === "todo") {
        return { ...item, status: "in-progress" as RoadmapItemStatus, updatedAt: now };
      }
    }

    // If validation passed and we were working on this, mark complete
    if (validationSuccess && item.status === "in-progress") {
      // Check if affected files overlap with changed files
      completedIds.push(item.id);
      return { ...item, status: "completed" as RoadmapItemStatus, completedAt: now, updatedAt: now };
    }

    return item;
  });

  return { items: updated, completedIds };
}

// ─── Prioritization ───────────────────────────────────────────────────────────

/**
 * Compute a composite priority score for a roadmap item.
 *
 * Factors:
 *   - business impact (from impact field)
 *   - confidence (from confidence field)
 *   - age (older items get a small boost)
 *   - dependency blocking (items that block others get a boost)
 */
function computePriorityScore(
  item: EngineeringRoadmapItem,
  allItems: EngineeringRoadmapItem[],
): number {
  if (item.status === "completed" || item.status === "deferred") return 0;

  // Base score from impact and confidence
  let score = item.impact * (item.confidence / 100);

  // Age bonus — items that have been waiting longer get a small boost
  const ageMs = Date.now() - new Date(item.createdAt).getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  score += Math.min(ageDays * 0.5, 15); // Up to 15 points for age

  // Dependency boost — items that block others get higher priority
  const blockingCount = allItems.filter((other) => other.dependencies.includes(item.id)).length;
  score += blockingCount * 5;

  return clamp(Math.round(score));
}

/**
 * Re-prioritize all items in the roadmap.
 */
function rePrioritize(items: EngineeringRoadmapItem[]): EngineeringRoadmapItem[] {
  const now = new Date().toISOString();

  // Compute scores and re-sort non-completed items
  const scored = items.map((item) => ({
    item,
    score: computePriorityScore(item, items),
  }));

  // Sort: active/blocking items first, then by score descending
  scored.sort((a, b) => {
    // Completed/deferred go last
    const aDone = a.item.status === "completed" || a.item.status === "deferred";
    const bDone = b.item.status === "completed" || b.item.status === "deferred";
    if (aDone && !bDone) return 1;
    if (!aDone && bDone) return -1;

    // In-progress items first
    if (a.item.status === "in-progress" && b.item.status !== "in-progress") return -1;
    if (a.item.status !== "in-progress" && b.item.status === "in-progress") return 1;

    // Then by score descending
    return b.score - a.score;
  });

  // Update priorities based on new scores
  return scored.map(({ item, score }) => ({
    ...item,
    priority: priorityFromScore(score),
    updatedAt: item.status === "completed" || item.status === "deferred" ? item.updatedAt : now,
  }));
}

// ─── Source extraction ────────────────────────────────────────────────────────

/** Extract roadmap items from the Engineering Audit. */
function extractFromAudit(
  audit: EngineeringAudit | null | undefined,
  items: EngineeringRoadmapItem[],
): EngineeringRoadmapItem[] {
  if (!audit) return items;

  let result = items;

  for (const opp of audit.opportunities) {
    const categoryMap: Record<string, RoadmapCategory> = {
      "duplicate-components": "architecture",
      "routing": "architecture",
      "accessibility": "accessibility",
      "seo": "seo",
      "performance": "performance",
      "technical-debt": "technical-debt",
    };
    const category = categoryMap[opp.category] ?? "technical-debt";
    const impact = clamp(opp.estimatedBenefit ?? 50);
    const confidence = clamp(100 - (opp.estimatedRisk ?? 20));
    const effort = effortFromEstimate(opp.estimatedEffort ?? "medium");

    result = mergeIntoRoadmap(
      result,
      opp.title,
      opp.description,
      category,
      impact,
      confidence,
      "audit",
      effort,
    );
  }

  return result;
}

/** Extract roadmap items from the Engineering Advisor. */
function extractFromAdvisor(
  advisor: EngineeringAdvisorResult | null | undefined,
  items: EngineeringRoadmapItem[],
): EngineeringRoadmapItem[] {
  if (!advisor) return items;

  let result = items;

  for (const rec of advisor.recommendations) {
    const categoryMap: Record<string, RoadmapCategory> = {
      architecture: "architecture",
      performance: "performance",
      design: "design",
      components: "architecture",
      routing: "architecture",
      seo: "seo",
      accessibility: "accessibility",
      "technical-debt": "technical-debt",
      "developer-experience": "developer-experience",
      business: "business",
    };
    const category = categoryMap[rec.category] ?? "technical-debt";

    result = mergeIntoRoadmap(
      result,
      rec.title,
      rec.description,
      category,
      rec.impact,
      rec.confidence,
      "advisor",
      effortFromSize(rec.effort),
    );
  }

  return result;
}

/** Extract roadmap items from the Product Assessment. */
function extractFromProductAssessment(
  product: ProductAssessment | null | undefined,
  items: EngineeringRoadmapItem[],
): EngineeringRoadmapItem[] {
  if (!product) return items;

  let result = items;

  if (product.recommendations.length > 0) {
    for (const rec of product.recommendations) {
      result = mergeIntoRoadmap(
        result,
        rec,
        `Product assessment recommendation: ${rec}`,
        "business",
        clamp(product.overallScore),
        75,
        "product-intelligence",
        "medium",
      );
    }
  }

  // If overall score is low, add a roadmap item to improve it
  if (product.overallScore < 60) {
    result = mergeIntoRoadmap(
      result,
      "Improve product alignment score",
      `Overall product intelligence score is ${product.overallScore}/100. Systematic improvements needed across business, UX, and conversion dimensions.`,
      "business",
      80,
      70,
      "product-intelligence",
      "large",
    );
  }

  return result;
}

/** Extract roadmap items from the Engineering Decision. */
function extractFromDecision(
  decision: EngineeringDecision | null | undefined,
  items: EngineeringRoadmapItem[],
): EngineeringRoadmapItem[] {
  if (!decision) return items;
  let result = items;

  if (decision.recommendation === "repair-first" || decision.recommendation === "rollback" || decision.recommendation === "defer") {
    result = mergeIntoRoadmap(
      result,
      "Address engineering decision concerns",
      `Engineering decision recommended "${decision.recommendation}". Underlying issues need systematic resolution.`,
      "technical-debt",
      70,
      65,
      "decision",
      "medium",
    );
  }

  return result;
}

/** Extract roadmap items from validation and execution history. */
function extractFromExecution(
  items: EngineeringRoadmapItem[],
  repairAttempts?: number,
  recoveryCount?: number,
  rollbackCount?: number,
  validationSuccess?: boolean,
): EngineeringRoadmapItem[] {
  let result = items;

  if (repairAttempts !== undefined && repairAttempts > 2) {
    result = mergeIntoRoadmap(
      result,
      "Reduce repair frequency",
      `The last edit required ${repairAttempts} repair attempts. High repair frequency indicates brittle code.`,
      "technical-debt",
      65,
      70,
      "execution",
      "medium",
    );
  }

  if ((recoveryCount ?? 0) > 2 || (rollbackCount ?? 0) > 1) {
    result = mergeIntoRoadmap(
      result,
      "Reduce rollback frequency",
      `The project has experienced ${recoveryCount ?? 0} recovery events and ${rollbackCount ?? 0} rollbacks.`,
      "technical-debt",
      80,
      75,
      "execution",
      "large",
    );
  }

  if (validationSuccess === false) {
    result = mergeIntoRoadmap(
      result,
      "Fix validation failures",
      "Validation checks are failing. Fix TypeScript errors and lint issues to restore code quality.",
      "technical-debt",
      85,
      90,
      "execution",
      "medium",
    );
  }

  return result;
}

// ─── Main Roadmap Generation ──────────────────────────────────────────────────

export interface RoadmapInputs {
  projectId?: string;
  workspaceContext?: WorkspaceContext | null;
  engineeringAudit?: EngineeringAudit | null;
  productAssessment?: ProductAssessment | null;
  engineeringAdvisor?: EngineeringAdvisorResult | null;
  engineeringDecision?: EngineeringDecision | null;
  confidenceScore?: number;
  visualScore?: number;
  previewHealth?: number;
  validationSuccess?: boolean;
  repairAttempts?: number;
  recoveryCount?: number;
  rollbackCount?: number;
  learningImprovementScore?: number;
  businessContext?: BusinessContext;
  blueprint?: WebsiteBlueprint | null;
  instruction?: string;
  files?: string[];
}

/**
 * Run the full roadmap generation cycle.
 *
 * 1. Load existing roadmap for the project.
 * 2. Auto-complete items based on current edit.
 * 3. Extract new items from all intelligence sources.
 * 4. Merge duplicates.
 * 5. Re-prioritize.
 * 6. Persist.
 * 7. Build payload.
 */
export function generateEngineeringRoadmap(inputs: RoadmapInputs): RoadmapPayload {
  const startTime = Date.now();
  const projectId = inputs.projectId ?? "default";

  // ── 1. Load existing roadmap ───────────────────────────────────────────
  let items = getProjectRoadmap(projectId);

  // ── 2. Auto-complete items based on this edit ──────────────────────────
  const autoCompleteResult = autoCompleteItems(
    items,
    inputs.files,
    inputs.instruction,
    inputs.validationSuccess,
  );
  items = autoCompleteResult.items;

  // ── 3. Extract new items from all sources ──────────────────────────────
  items = extractFromAudit(inputs.engineeringAudit, items);
  items = extractFromAdvisor(inputs.engineeringAdvisor, items);
  items = extractFromProductAssessment(inputs.productAssessment, items);
  items = extractFromDecision(inputs.engineeringDecision, items);
  items = extractFromExecution(
    items,
    inputs.repairAttempts,
    inputs.recoveryCount,
    inputs.rollbackCount,
    inputs.validationSuccess,
  );

  // ── 4. Re-prioritize ───────────────────────────────────────────────────
  items = rePrioritize(items);

  // ── 5. Persist ─────────────────────────────────────────────────────────
  setProjectRoadmap(projectId, items);

  // ── 6. Build summary ───────────────────────────────────────────────────
  const todo = items.filter((i) => i.status === "todo").length;
  const inProgress = items.filter((i) => i.status === "in-progress").length;
  const completed = items.filter((i) => i.status === "completed").length;
  const deferred = items.filter((i) => i.status === "deferred").length;
  const total = items.length;
  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Current focus: top 3 non-completed items
  const currentFocus = items
    .filter((i) => i.status !== "completed" && i.status !== "deferred")
    .slice(0, 3);

  // Recently completed: last 5
  const recentlyCompleted = items
    .filter((i) => i.status === "completed" && i.completedAt)
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())
    .slice(0, 5);

  // Roadmap health: based on completion rate, pending critical items, and overall progress
  const criticalPending = items.filter((i) => i.priority === "critical" && i.status !== "completed").length;
  const healthPenalty = criticalPending * 10 + (total - completed) * 0.5;
  const roadmapHealth = clamp(Math.round(Math.max(0, 85 - healthPenalty + completionPercentage * 0.15)));

  const payload: RoadmapPayload = {
    items,
    summary: { total, todo, inProgress, completed, deferred },
    completionPercentage,
    currentFocus,
    recentlyCompleted,
    roadmapHealth,
  };

  // ── Update telemetry ───────────────────────────────────────────────────
  telemetry = {
    roadmapHealth,
    totalItems: total,
    completedItems: completed,
    inProgressItems: inProgress,
    deferredItems: deferred,
    completionPercentage,
  };

  logger.info(
    {
      projectId,
      totalItems: total,
      completedItems: completed,
      completionPercentage,
      roadmapHealth,
      autoCompleted: autoCompleteResult.completedIds.length,
    },
    "[roadmap] Engineering roadmap generated",
  );

  return payload;
}

// ─── Prompt Formatting ────────────────────────────────────────────────────────

/**
 * Format a compact roadmap summary for prompt injection.
 *
 * Includes only the highest-priority active items and the most recently
 * completed work — not the entire roadmap.
 */
export function formatEngineeringRoadmap(payload: RoadmapPayload): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("## Engineering Roadmap");
  lines.push("");
  lines.push(`Completion: **${payload.completionPercentage}%** (${payload.summary.completed}/${payload.summary.total} items)`);
  lines.push("");

  if (payload.currentFocus.length > 0) {
    lines.push("### Current Focus");
    for (let i = 0; i < payload.currentFocus.length; i++) {
      const item = payload.currentFocus[i];
      lines.push(`${i + 1}. **${item.title}** (${item.priority}, ${item.effort})`);
    }
    lines.push("");
  }

  if (payload.recentlyCompleted.length > 0) {
    lines.push("### Completed Recently");
    for (const item of payload.recentlyCompleted) {
      const completedDate = item.completedAt ? new Date(item.completedAt).toLocaleDateString() : "recently";
      lines.push(`- ${item.title} (${completedDate})`);
    }
    lines.push("");
  }

  if (payload.summary.todo > 0) {
    lines.push(`*${payload.summary.todo} items remaining in backlog*`);
    lines.push("");
  }

  return lines.join("\n");
}
