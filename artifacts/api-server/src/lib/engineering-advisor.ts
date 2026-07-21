// ─── Engineering Advisor — Autonomous Engineering Recommendation Engine ──────
// Phase 16.2
//
// Continuously analyzes the current website project and proactively recommends
// the highest-value engineering improvements. Never edits code — only observes,
// analyzes, prioritizes, and recommends.
//
// Pipeline position:
//   Workspace → Engineering Audit → Product Intelligence → Engineering Advisor → Engineering Decision
//
// The advisor consumes all available intelligence modules and produces a
// prioritized list of EngineeringRecommendation objects sorted by descending
// priorityScore.

import { logger } from "./logger";
import type { BusinessContext } from "./website-v2-types";
import type { WebsiteBlueprint } from "./website-v2-types";
import type { WorkspaceContext } from "./workspace-context";
import type { EngineeringAudit } from "./continuous-engineering-engine";
import type { ProductAssessment } from "./product-intelligence-engine";
import type { EngineeringDecision } from "./engineering-decision-engine";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecommendationCategory =
  | "architecture"
  | "performance"
  | "design"
  | "components"
  | "routing"
  | "seo"
  | "accessibility"
  | "technical-debt"
  | "developer-experience"
  | "business";

export type RecommendationPriority = "critical" | "high" | "medium" | "low";

export interface EngineeringRecommendation {
  /** Unique identifier for this recommendation. */
  id: string;
  /** Short human-readable title. */
  title: string;
  /** Detailed description of the improvement. */
  description: string;
  /** Category of the recommendation. */
  category: RecommendationCategory;
  /** Priority level based on score thresholds. */
  priority: RecommendationPriority;
  /** Estimated business/quality benefit (0–100). */
  impact: number;
  /** Estimated implementation effort (0–100, higher = harder). */
  effort: number;
  /** Confidence in this recommendation (0–100). */
  confidence: number;
  /** Urgency — how quickly this should be addressed (0–100). */
  urgency: number;
  /** Composite score = (impact × confidence × urgency) / effort. */
  score: number;
  /** Files that would be affected by this recommendation. */
  affectedFiles: string[];
  /** Detailed reasoning behind this recommendation. */
  reasoning: string[];
  /** Concrete, actionable next steps. */
  suggestedActions: string[];
}

export interface EngineeringAdvisorResult {
  /** Overall project health score (0–100). */
  overallHealth: number;
  /** Prioritized list of recommendations. */
  recommendations: EngineeringRecommendation[];
  /** Key strengths of the current project. */
  strengths: string[];
  /** Risks and concerns. */
  risks: string[];
  /** Detected trends (e.g., "improving confidence", "growing duplication"). */
  trends: string[];
  /** Single highest-value improvement to tackle next. */
  nextBestAction: string;
}

// ─── Advisor Inputs ───────────────────────────────────────────────────────────

export interface AdvisorInputs {
  workspaceContext: WorkspaceContext | null | undefined;
  engineeringAudit: EngineeringAudit | null | undefined;
  productAssessment: ProductAssessment | null | undefined;
  engineeringDecision: EngineeringDecision | null | undefined;
  confidenceScore?: number;
  visualScore?: number;
  previewHealth?: number;
  validationSuccess?: boolean;
  repairAttempts?: number;
  recoveryCount?: number;
  rollbackCount?: number;
  learningImprovementScore?: number;
  learningIterations?: number;
  projectId?: string;
  businessContext?: BusinessContext;
  blueprint?: WebsiteBlueprint | null;
  instruction?: string;
  files?: string[];
}

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface AdvisorTelemetry {
  advisorHealth: number;
  recommendationCount: number;
  criticalRecommendations: number;
  highRecommendations: number;
  technicalDebtScore: number;
  architectureScore: number;
  trendCount: number;
  nextBestAction: string;
}

let telemetry: AdvisorTelemetry = {
  advisorHealth: 100,
  recommendationCount: 0,
  criticalRecommendations: 0,
  highRecommendations: 0,
  technicalDebtScore: 100,
  architectureScore: 100,
  trendCount: 0,
  nextBestAction: "",
};

export function getAdvisorTelemetry(): AdvisorTelemetry {
  return { ...telemetry };
}

export function resetAdvisorTelemetry(): void {
  telemetry = {
    advisorHealth: 100,
    recommendationCount: 0,
    criticalRecommendations: 0,
    highRecommendations: 0,
    technicalDebtScore: 100,
    architectureScore: 100,
    trendCount: 0,
    nextBestAction: "",
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _recIdCounter = 0;
function nextRecId(): string {
  _recIdCounter++;
  return `adv-rec-${Date.now()}-${_recIdCounter}`;
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value));
}

function priorityFromScore(score: number): RecommendationPriority {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 40) return "medium";
  return "low";
}

// ─── Recommendation Generators ────────────────────────────────────────────────

/**
 * Analyze architecture concerns from the engineering audit and workspace context.
 */
function generateArchitectureRecs(
  audit: EngineeringAudit | null | undefined,
  wsCtx: WorkspaceContext | null | undefined,
  files: string[] | undefined,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  // Check for large components flagged by audit
  if (audit) {
    const largeComponents = audit.opportunities.filter((o) => o.category === "components");
    if (largeComponents.length > 0) {
      const count = largeComponents.length;
      recs.push({
        id: nextRecId(),
        title: `Refactor ${count} oversized component(s)`,
        description: `Engineering audit identified ${count} component(s) that may be too large or duplicated. Refactoring them would improve maintainability and reduce cognitive load.`,
        category: "architecture",
        priority: count > 3 ? "high" : "medium",
        impact: 65,
        effort: 40,
        confidence: 80,
        urgency: count > 3 ? 70 : 40,
        score: 0, // computed below
        affectedFiles: largeComponents.flatMap((o) => o.affectedFiles ?? []),
        reasoning: [
          `Audit flagged ${count} component(s) with duplication or size concerns.`,
          ...largeComponents.slice(0, 3).map((o) => `  - ${o.title} (${o.affectedFiles?.length ?? 0} file(s))`),
        ],
        suggestedActions: [
          "Extract shared logic into custom hooks or utility functions.",
          "Break monolithic components into smaller, single-responsibility pieces.",
          "Consider using composition patterns instead of large conditional renders.",
        ],
      });
    }

    // Deep nesting
    const deepNestingCount = audit.opportunities.filter((o) => o.category === "routing").length;
    if (deepNestingCount > 2) {
      recs.push({
        id: nextRecId(),
        title: "Reduce component nesting depth",
        description: "Deeply nested components hurt performance and readability. Flatten the component tree where possible.",
        category: "architecture",
        priority: "medium",
        impact: 50,
        effort: 30,
        confidence: 70,
        urgency: 30,
        score: 0,
        affectedFiles: [],
        reasoning: ["Audit detected routing concerns that may indicate deep nesting."],
        suggestedActions: [
          "Use React Fragments (<>…</>) instead of unnecessary wrapper divs.",
          "Extract deeply nested conditional logic into separate components.",
          "Consider using layout components to flatten the render tree.",
        ],
      });
    }
  }

  // Circular imports from related files
  if (wsCtx?.relatedFiles && wsCtx.relatedFiles.length > 30) {
    recs.push({
      id: nextRecId(),
      title: "Audit for circular import chains",
      description: "With many related files, circular imports can silently degrade build performance and cause runtime errors.",
      category: "architecture",
      priority: "medium",
      impact: 45,
      effort: 25,
      confidence: 60,
      urgency: 35,
      score: 0,
      affectedFiles: wsCtx.relatedFiles.slice(0, 5),
      reasoning: [`Project has ${wsCtx.relatedFiles.length} related files — risk of circular dependencies increases with project size.`],
      suggestedActions: [
        "Run `npx madge --circular src/` to detect circular imports.",
        "Refactor shared types into a common module.",
        "Use barrel files (index.ts) with caution — they can mask circular imports.",
      ],
    });
  }

  // Compute scores
  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze performance concerns.
 */
function generatePerformanceRecs(
  audit: EngineeringAudit | null | undefined,
  visualScore?: number,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (audit) {
    const perfOpps = audit.opportunities.filter((o) => o.category === "performance");
    if (perfOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: `Address ${perfOpps.length} performance issue(s)`,
        description: `Engineering audit detected ${perfOpps.length} performance concern(s) that may affect load times and user experience.`,
        category: "performance",
        priority: perfOpps.length > 3 ? "high" : "medium",
        impact: 70,
        effort: 35,
        confidence: 75,
        urgency: perfOpps.length > 3 ? 65 : 40,
        score: 0,
        affectedFiles: perfOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: perfOpps.slice(0, 3).map((o) => `  - ${o.title}`),
        suggestedActions: [
          "Lazy-load below-the-fold components and routes.",
          "Optimize images with next-gen formats (WebP, AVIF) and responsive srcsets.",
          "Remove unused JavaScript and CSS with tree-shaking.",
        ],
      });
    }
  }

  if (visualScore !== undefined && visualScore < 70) {
    recs.push({
      id: nextRecId(),
      title: "Investigate visual regression impact on perceived performance",
      description: `Visual verification score is ${visualScore}/100 — layout instability can make the app feel slow even if the code is fast.`,
      category: "performance",
      priority: "medium",
      impact: 55,
      effort: 30,
      confidence: 70,
      urgency: 45,
      score: 0,
      affectedFiles: [],
      reasoning: [`Visual score of ${visualScore} indicates possible layout shifts or rendering bottlenecks.`],
      suggestedActions: [
        "Profile component render times with React DevTools.",
        "Ensure stable layout with explicit dimensions on media elements.",
        "Use CSS contain property to isolate heavy sections.",
      ],
    });
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze design/UI concerns.
 */
function generateDesignRecs(
  audit: EngineeringAudit | null | undefined,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];
  // Design recommendations come from audit strengths/weaknesses
  if (audit) {
    if (audit.weaknesses.length > 2) {
      recs.push({
        id: nextRecId(),
        title: "Address design system inconsistencies",
        description: "Engineering audit identified several weaknesses. Some may relate to UI consistency, spacing, or visual design patterns.",
        category: "design",
        priority: "medium",
        impact: 60,
        effort: 40,
        confidence: 65,
        urgency: 35,
        score: 0,
        affectedFiles: [],
        reasoning: audit.weaknesses.slice(0, 3).map((w) => `  - ${w}`),
        suggestedActions: [
          "Create or enforce a design token system for colors, spacing, and typography.",
          "Audit all pages for visual consistency against the design spec.",
          "Standardize on a single component library or design framework.",
        ],
      });
    }
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze component-level concerns.
 */
function generateComponentRecs(
  audit: EngineeringAudit | null | undefined,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (audit) {
    const duplicateOpps = audit.opportunities.filter((o) => o.category === "components");
    if (duplicateOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: `Consolidate ${duplicateOpps.length} duplicated component pattern(s)`,
        description: "Duplicate components increase maintenance burden and lead to inconsistent UI. Extract shared patterns into reusable components.",
        category: "components",
        priority: duplicateOpps.length > 2 ? "high" : "medium",
        impact: 75,
        effort: 30,
        confidence: 85,
        urgency: duplicateOpps.length > 2 ? 60 : 35,
        score: 0,
        affectedFiles: duplicateOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: duplicateOpps.slice(0, 3).map((o) => `  - ${o.title}`),
        suggestedActions: [
          "Create a shared components directory for reusable UI pieces.",
          "Use component composition instead of copy-pasting markup.",
          "Add Storybook or similar tool to catalog and document shared components.",
        ],
      });
    }

    // Naming inconsistencies heuristic
    if (duplicateOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: "Standardize component naming conventions",
        description: "Inconsistent naming makes it harder to find and reuse components. Establish and enforce a naming convention.",
        category: "components",
        priority: "low",
        impact: 35,
        effort: 15,
        confidence: 70,
        urgency: 20,
        score: 0,
        affectedFiles: [],
        reasoning: ["Duplicate component patterns suggest naming may be inconsistent across the project."],
        suggestedActions: [
          "Adopt a consistent naming pattern (e.g., PascalCase for components, camelCase for utilities).",
          "Use directory-by-feature structure instead of directory-by-type.",
          "Add ESLint rules for naming conventions.",
        ],
      });
    }
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze routing concerns from audit.
 */
function generateRoutingRecs(
  audit: EngineeringAudit | null | undefined,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (audit) {
    const routingOpps = audit.opportunities.filter((o) => o.category === "routing");
    if (routingOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: `Resolve ${routingOpps.length} routing concern(s)`,
        description: "Routing issues can lead to broken navigation, poor SEO, and user confusion.",
        category: "routing",
        priority: routingOpps.length > 2 ? "high" : "medium",
        impact: 65,
        effort: 25,
        confidence: 75,
        urgency: routingOpps.length > 2 ? 65 : 40,
        score: 0,
        affectedFiles: routingOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: routingOpps.slice(0, 3).map((o) => `  - ${o.title}`),
        suggestedActions: [
          "Define a flat route hierarchy where possible — avoid deeply nested routes.",
          "Ensure all routes have proper title and metadata for SEO.",
          "Add route-level code splitting for better performance.",
        ],
      });
    }
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze SEO concerns from audit.
 */
function generateSeoRecs(
  audit: EngineeringAudit | null | undefined,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (audit) {
    const seoOpps = audit.opportunities.filter((o) => o.category === "seo");
    if (seoOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: `Fix ${seoOpps.length} SEO issue(s)`,
        description: "SEO issues reduce organic visibility and can significantly impact traffic and conversions.",
        category: "seo",
        priority: seoOpps.length > 2 ? "high" : "medium",
        impact: 80,
        effort: 20,
        confidence: 85,
        urgency: seoOpps.length > 2 ? 75 : 50,
        score: 0,
        affectedFiles: seoOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: seoOpps.slice(0, 3).map((o) => `  - ${o.title}`),
        suggestedActions: [
          "Ensure every page has a unique, descriptive title tag and meta description.",
          "Use semantic HTML (h1–h6 hierarchy, article, section, nav).",
          "Add structured data (JSON-LD) for rich search results.",
        ],
      });
    }

    // Heading structure
    const headingOpps = audit.opportunities.filter(
      (o) => o.title?.toLowerCase().includes("heading") || o.title?.toLowerCase().includes("h1"),
    );
    if (headingOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: "Fix heading structure for SEO and accessibility",
        description: "Improper heading hierarchy hurts both SEO and accessibility. Ensure a logical h1→h2→h3 structure.",
        category: "seo",
        priority: "medium",
        impact: 55,
        effort: 15,
        confidence: 80,
        urgency: 40,
        score: 0,
        affectedFiles: headingOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: ["Heading structure issues detected in audit."],
        suggestedActions: [
          "Ensure exactly one h1 per page that describes the page content.",
          "Nest headings sequentially (h1 > h2 > h3) without skipping levels.",
          "Use headings for structure, not for visual styling.",
        ],
      });
    }
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze accessibility concerns from audit.
 */
function generateAccessibilityRecs(
  audit: EngineeringAudit | null | undefined,
  productAssessment?: ProductAssessment | null,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (audit) {
    const a11yOpps = audit.opportunities.filter((o) => o.category === "accessibility");
    if (a11yOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: `Fix ${a11yOpps.length} accessibility issue(s)`,
        description: "Accessibility issues exclude users and may violate legal requirements. Fixing them improves UX for everyone.",
        category: "accessibility",
        priority: a11yOpps.length > 3 ? "critical" : "high",
        impact: 85,
        effort: 25,
        confidence: 90,
        urgency: a11yOpps.length > 3 ? 80 : 55,
        score: 0,
        affectedFiles: a11yOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: a11yOpps.slice(0, 4).map((o) => `  - ${o.title}`),
        suggestedActions: [
          "Add ARIA labels to interactive elements that lack visible text.",
          "Ensure color contrast meets WCAG AA standards (4.5:1 for normal text).",
          "Make all interactive elements keyboard-accessible.",
          "Add focus indicators and manage focus order logically.",
        ],
      });
    }
  }

  // If product assessment flagged low accessibility
  if (productAssessment && productAssessment.accessibilityImpact < 50) {
    recs.push({
      id: nextRecId(),
      title: "Improve overall accessibility score",
      description: `Product assessment rated accessibility impact at ${productAssessment.accessibilityImpact}/100. Cross-cutting accessibility improvements will benefit all users.`,
      category: "accessibility",
      priority: "high",
      impact: 75,
      effort: 35,
      confidence: 75,
      urgency: 60,
      score: 0,
      affectedFiles: [],
      reasoning: [
        `Product assessment accessibility score: ${productAssessment.accessibilityImpact}/100.`,
        "Low accessibility creates legal risk and excludes users with disabilities.",
      ],
      suggestedActions: [
        "Run a full accessibility audit with axe DevTools or WAVE.",
        "Create an accessibility checklist for new components.",
        "Test with screen readers (NVDA, VoiceOver) regularly.",
      ],
    });
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze technical debt from execution history.
 */
function generateTechnicalDebtRecs(
  audit: EngineeringAudit | null | undefined,
  repairAttempts?: number,
  recoveryCount?: number,
  rollbackCount?: number,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  // Repeated repairs
  if (repairAttempts !== undefined && repairAttempts > 2) {
    recs.push({
      id: nextRecId(),
      title: "Reduce repeated validation repairs",
      description: `The last edit required ${repairAttempts} repair attempt(s). Frequent repairs indicate brittle code or inadequate testing.`,
      category: "technical-debt",
      priority: "high",
      impact: 70,
      effort: 40,
      confidence: 80,
      urgency: 65,
      score: 0,
      affectedFiles: [],
      reasoning: [`${repairAttempts} repair attempt(s) were needed for the last change — higher than the recommended maximum of 2.`],
      suggestedActions: [
        "Add unit tests for frequently breaking modules.",
        "Improve TypeScript coverage to catch type errors earlier.",
        "Consider using a stricter ESLint configuration.",
      ],
    });
  }

  // Repeated rollbacks
  if ((recoveryCount ?? 0) > 2 || (rollbackCount ?? 0) > 1) {
    recs.push({
      id: nextRecId(),
      title: "Address root cause of frequent rollbacks",
      description: `The project has experienced ${recoveryCount ?? 0} recovery event(s) and ${rollbackCount ?? 0} rollback(s). Rollbacks waste time and erode confidence.`,
      category: "technical-debt",
      priority: "critical",
      impact: 85,
      effort: 50,
      confidence: 85,
      urgency: 80,
      score: 0,
      affectedFiles: [],
      reasoning: [
        `Recovery events: ${recoveryCount ?? 0}`,
        `Rollbacks: ${rollbackCount ?? 0}`,
        "Frequent rollbacks suggest systemic issues with change management or validation.",
      ],
      suggestedActions: [
        "Review the most common causes of rollbacks and address them systematically.",
        "Improve pre-edit validation to catch issues before they reach production.",
        "Consider adding a staging/preview environment for changes.",
      ],
    });
  }

  // Validation failures
  if (audit && audit.score < 60) {
    recs.push({
      id: nextRecId(),
      title: "Improve overall engineering health score",
      description: `Engineering audit score is ${audit.score}/100. Low health scores correlate with increased technical debt and maintenance cost.`,
      category: "technical-debt",
      priority: "high",
      impact: 75,
      effort: 45,
      confidence: 80,
      urgency: 60,
      score: 0,
      affectedFiles: [],
      reasoning: [
        `Audit score: ${audit.score}/100 — below the 70/100 healthy threshold.`,
        ...audit.weaknesses.slice(0, 3).map((w) => `  - Weakness: ${w}`),
      ],
      suggestedActions: [
        "Address the highest-severity audit findings first.",
        "Schedule regular refactoring sprints.",
        "Track engineering health over time to measure improvement.",
      ],
    });
  }

  // Growing complexity from audit
  if (audit) {
    const complexityOpps = audit.opportunities.filter(
      (o) => o.category === "technical-debt" || o.title?.toLowerCase().includes("complexity"),
    );
    if (complexityOpps.length > 0) {
      recs.push({
        id: nextRecId(),
        title: "Reduce growing code complexity",
        description: "Rising complexity makes the codebase harder to understand, test, and modify safely.",
        category: "technical-debt",
        priority: "medium",
        impact: 60,
        effort: 35,
        confidence: 70,
        urgency: 45,
        score: 0,
        affectedFiles: complexityOpps.flatMap((o) => o.affectedFiles ?? []),
        reasoning: complexityOpps.slice(0, 3).map((o) => `  - ${o.title}`),
        suggestedActions: [
          "Enforce cyclomatic complexity limits with ESLint rules.",
          "Break large functions into smaller, testable units.",
          "Use early returns and guard clauses to flatten conditional logic.",
        ],
      });
    }
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze developer experience concerns.
 */
function generateDxRecs(
  wsCtx: WorkspaceContext | null | undefined,
  files: string[] | undefined,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  // Large files
  if (files && files.length > 50) {
    recs.push({
      id: nextRecId(),
      title: "Organize growing project structure",
      description: `The project has ${files.length} files. As the project grows, maintaining a clear structure becomes critical for developer productivity.`,
      category: "developer-experience",
      priority: "medium",
      impact: 50,
      effort: 25,
      confidence: 70,
      urgency: 35,
      score: 0,
      affectedFiles: [],
      reasoning: [`Project contains ${files.length} files — consider organizing by feature domain.`],
      suggestedActions: [
        "Group files by feature/domain rather than by technical role.",
        "Create a clear folder structure convention and document it.",
        "Use barrel exports to simplify imports from each module.",
      ],
    });
  }

  // Missing conventions
  if (!wsCtx?.acceptedPatterns || wsCtx.acceptedPatterns.length === 0) {
    recs.push({
      id: nextRecId(),
      title: "Establish and document coding conventions",
      description: "No accepted patterns are documented. Consistent conventions improve code quality and onboarding speed.",
      category: "developer-experience",
      priority: "medium",
      impact: 55,
      effort: 15,
      confidence: 80,
      urgency: 30,
      score: 0,
      affectedFiles: [],
      reasoning: ["No coding conventions or accepted patterns are documented for this project."],
      suggestedActions: [
        "Create a CONTRIBUTING.md with coding standards.",
        "Add ESLint and Prettier configuration for automated enforcement.",
        "Document component patterns and state management conventions.",
      ],
    });
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

/**
 * Analyze business-level concerns.
 */
function generateBusinessRecs(
  productAssessment: ProductAssessment | null | undefined,
  businessContext?: BusinessContext,
): EngineeringRecommendation[] {
  const recs: EngineeringRecommendation[] = [];

  if (productAssessment) {
    if (productAssessment.conversionImpact < 50) {
      recs.push({
        id: nextRecId(),
        title: "Strengthen conversion path",
        description: `Product assessment scores conversion impact at ${productAssessment.conversionImpact}/100. Weak conversion flow directly affects business outcomes.`,
        category: "business",
        priority: "high",
        impact: 90,
        effort: 30,
        confidence: 80,
        urgency: 70,
        score: 0,
        affectedFiles: [],
        reasoning: [`Conversion impact score: ${productAssessment.conversionImpact}/100.`],
        suggestedActions: [
          "Review and optimize primary CTA placement and design.",
          "Reduce friction in the conversion funnel.",
          "A/B test different conversion approaches.",
        ],
      });
    }

    if (productAssessment.brandingConsistency < 50) {
      recs.push({
        id: nextRecId(),
        title: "Improve brand consistency across pages",
        description: `Brand consistency scores ${productAssessment.brandingConsistency}/100. Inconsistent branding erodes trust and weakens brand recognition.`,
        category: "business",
        priority: "medium",
        impact: 65,
        effort: 25,
        confidence: 75,
        urgency: 45,
        score: 0,
        affectedFiles: [],
        reasoning: [`Branding consistency score: ${productAssessment.brandingConsistency}/100.`],
        suggestedActions: [
          "Create a centralized design token file for brand colors, fonts, and spacing.",
          "Audit all pages for brand compliance.",
          "Use consistent tone and voice in all copy.",
        ],
      });
    }

    if (productAssessment.recommendation === "reject" || productAssessment.recommendation === "revise") {
      recs.push({
        id: nextRecId(),
        title: "Re-align engineering work with business goals",
        description: `Product assessment ${productAssessment.recommendation === "reject" ? "rejected" : "recommends revising"} the current direction. Engineering work should directly support business objectives.`,
        category: "business",
        priority: "critical",
        impact: 95,
        effort: 20,
        confidence: 90,
        urgency: 85,
        score: 0,
        affectedFiles: [],
        reasoning: [
          `Product assessment recommendation: ${productAssessment.recommendation}.`,
          "Misalignment between engineering and business goals wastes resources and hurts outcomes.",
        ],
        suggestedActions: [
          "Review business goals with stakeholders and ensure shared understanding.",
          "Prioritize features that directly impact key business metrics.",
          "Set up regular business-alignment reviews for engineering work.",
        ],
      });
    }
  }

  // Weak CTA from business context
  if (businessContext && !businessContext.conversionGoal && !businessContext.biIntelligenceContext?.moduleContext?.website?.primaryCTA) {
    recs.push({
      id: nextRecId(),
      title: "Define clear conversion goals and primary CTA",
      description: "No conversion goal or primary CTA is documented. Without a clear conversion target, it's impossible to measure business success.",
      category: "business",
      priority: "high",
      impact: 85,
      effort: 10,
      confidence: 90,
      urgency: 65,
      score: 0,
      affectedFiles: [],
      reasoning: [
        "No conversion goal documented in business context.",
        "No primary CTA defined.",
        "Business outcomes cannot be measured without clear conversion targets.",
      ],
      suggestedActions: [
        "Document the primary conversion goal (e.g., sign-ups, purchases, leads).",
        "Design a clear, visible primary CTA aligned with the conversion goal.",
        "Set up analytics to track conversion funnel performance.",
      ],
    });
  }

  for (const rec of recs) {
    rec.score = Math.round((rec.impact * rec.confidence * rec.urgency) / Math.max(1, rec.effort));
  }

  return recs;
}

// ─── Trend Analysis ───────────────────────────────────────────────────────────

function analyzeTrends(inputs: AdvisorInputs): string[] {
  const trends: string[] = [];

  // Confidence trend
  if (inputs.confidenceScore !== undefined) {
    if (inputs.confidenceScore >= 85) {
      trends.push("Improving confidence — changes are consistently validated.");
    } else if (inputs.confidenceScore < 50) {
      trends.push("Declining confidence — validation or quality issues persist.");
    }
  }

  // Repair trend
  if (inputs.repairAttempts !== undefined) {
    if (inputs.repairAttempts > 2) {
      trends.push("Increasing repairs — code quality or test coverage may be slipping.");
    } else if (inputs.repairAttempts === 0) {
      trends.push("Improving validation — changes pass without repairs.");
    }
  }

  // Recovery/Rollback trend
  if ((inputs.recoveryCount ?? 0) > 2) {
    trends.push("Increasing rollbacks — change management process needs review.");
  }

  // Validation trend
  if (inputs.validationSuccess === true) {
    trends.push("Improving validation — TypeScript and lint checks are passing.");
  } else if (inputs.validationSuccess === false) {
    trends.push("Growing validation failures — code quality is declining.");
  }

  // Technical debt from audit
  if (inputs.engineeringAudit) {
    const debtOpps = inputs.engineeringAudit.opportunities.filter(
      (o) => o.category === "technical-debt" || o.category === "components",
    );
    if (debtOpps.length > 3) {
      trends.push("Growing technical debt — duplication and code quality issues are accumulating.");
    }
    if (debtOpps.length > 1) {
      trends.push("Growing duplication — shared patterns are not being extracted into reusable components.");
    }
  }

  // Visual trend
  if (inputs.visualScore !== undefined) {
    if (inputs.visualScore >= 90) {
      trends.push("Improving visual consistency — layout and design tokens are well-maintained.");
    } else if (inputs.visualScore < 60) {
      trends.push("Declining visual quality — layout breaks or design token violations detected.");
    }
  }

  // Learning improvement
  if (inputs.learningImprovementScore !== undefined && inputs.learningImprovementScore > 0) {
    trends.push("Improving execution efficiency — learning loop is optimizing policies.");
  }

  // Health from audit
  if (inputs.engineeringAudit && inputs.engineeringAudit.score < 50) {
    trends.push("Growing architectural debt — core structure may need attention.");
  }

  return trends;
}

// ─── Health Score ─────────────────────────────────────────────────────────────

function computeOverallHealth(inputs: AdvisorInputs): number {
  let health = 85; // Start at a healthy baseline

  // Penalize based on intelligence modules
  if (inputs.engineeringAudit) {
    health = (health + inputs.engineeringAudit.score) / 2;
  }

  if (inputs.confidenceScore !== undefined) {
    health = (health + inputs.confidenceScore) / 2;
  }

  if (inputs.visualScore !== undefined) {
    health = (health + inputs.visualScore) / 2;
  }

  if (inputs.previewHealth !== undefined) {
    health = (health + inputs.previewHealth) / 2;
  }

  if (inputs.productAssessment) {
    health = (health + inputs.productAssessment.overallScore) / 2;
  }

  // Penalize for repairs and rollbacks
  if (inputs.repairAttempts !== undefined && inputs.repairAttempts > 2) {
    health -= inputs.repairAttempts * 5;
  }
  if ((inputs.rollbackCount ?? 0) > 0) {
    health -= (inputs.rollbackCount ?? 0) * 10;
  }

  // Validation failures
  if (inputs.validationSuccess === false) {
    health -= 15;
  }

  return clamp(Math.round(health));
}

// ─── Main Advisor Function ────────────────────────────────────────────────────

/**
 * Run a full engineering advisory analysis.
 *
 * Consumes all available intelligence inputs and produces a prioritized
 * list of engineering recommendations.
 */
export function runEngineeringAdvisor(inputs: AdvisorInputs): EngineeringAdvisorResult {
  const startTime = Date.now();

  const {
    workspaceContext: wsCtx,
    engineeringAudit: audit,
    productAssessment,
    businessContext,
    files,
  } = inputs;

  // ── Generate recommendations from each category ─────────────────────────
  const architectureRecs = generateArchitectureRecs(audit, wsCtx, files);
  const performanceRecs = generatePerformanceRecs(audit, inputs.visualScore);
  const designRecs = generateDesignRecs(audit);
  const componentRecs = generateComponentRecs(audit);
  const routingRecs = generateRoutingRecs(audit);
  const seoRecs = generateSeoRecs(audit);
  const a11yRecs = generateAccessibilityRecs(audit, productAssessment);
  const debtRecs = generateTechnicalDebtRecs(audit, inputs.repairAttempts, inputs.recoveryCount, inputs.rollbackCount);
  const dxRecs = generateDxRecs(wsCtx, files);
  const businessRecs = generateBusinessRecs(productAssessment, businessContext);

  // ── Merge and sort by descending score ──────────────────────────────────
  const allRecs = [
    ...architectureRecs,
    ...performanceRecs,
    ...designRecs,
    ...componentRecs,
    ...routingRecs,
    ...seoRecs,
    ...a11yRecs,
    ...debtRecs,
    ...dxRecs,
    ...businessRecs,
  ].sort((a, b) => b.score - a.score);

  // ── Deduplicate by normalized title ─────────────────────────────────────
  const seen = new Set<string>();
  const uniqueRecs: EngineeringRecommendation[] = [];
  for (const rec of allRecs) {
    const key = rec.title.toLowerCase().replace(/\s+/g, " ").trim();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRecs.push(rec);
    }
  }

  // ── Compute overall health ──────────────────────────────────────────────
  const overallHealth = computeOverallHealth(inputs);

  // ── Trend analysis ──────────────────────────────────────────────────────
  const trends = analyzeTrends(inputs);

  // ── Strengths & Risks ───────────────────────────────────────────────────
  const strengths: string[] = [];
  const risks: string[] = [];

  if (audit) {
    strengths.push(...audit.strengths.slice(0, 5));
    risks.push(...audit.weaknesses.slice(0, 5).map((w) => `Weakness: ${w}`));
  }

  if (inputs.confidenceScore !== undefined && inputs.confidenceScore >= 85) {
    strengths.push("High confidence score — engineering team has strong quality assurance.");
  }
  if (inputs.visualScore !== undefined && inputs.visualScore >= 85) {
    strengths.push("Strong visual verification — UI changes are well-tested.");
  }
  if (inputs.validationSuccess === true) {
    strengths.push("Clean validation — TypeScript and lint checks are passing.");
  }
  if (inputs.previewHealth !== undefined && inputs.previewHealth >= 80) {
    strengths.push("Healthy preview pipeline — runtime integration is reliable.");
  }
  if (productAssessment && productAssessment.overallScore >= 80) {
    strengths.push("Strong product alignment — engineering work supports business goals.");
  }

  if (inputs.repairAttempts !== undefined && inputs.repairAttempts > 2) {
    risks.push("Repeated repair attempts suggest brittle code or inadequate testing.");
  }
  if ((inputs.rollbackCount ?? 0) > 1) {
    risks.push("Frequent rollbacks indicate systemic change management issues.");
  }
  if (inputs.confidenceScore !== undefined && inputs.confidenceScore < 50) {
    risks.push("Critically low confidence — high risk of regressions.");
  }
  if (inputs.validationSuccess === false) {
    risks.push("Validation failures — code quality is not meeting standards.");
  }

  // ── Next best action ────────────────────────────────────────────────────
  const nextBestAction = uniqueRecs.length > 0
    ? uniqueRecs[0].title
    : "No critical improvements identified. Continue monitoring.";

  // ── Build result ────────────────────────────────────────────────────────
  const result: EngineeringAdvisorResult = {
    overallHealth,
    recommendations: uniqueRecs,
    strengths,
    risks,
    trends,
    nextBestAction,
  };

  // ── Update telemetry ────────────────────────────────────────────────────
  const criticalCount = uniqueRecs.filter((r) => r.priority === "critical").length;
  const highCount = uniqueRecs.filter((r) => r.priority === "high").length;
  const archScore = architectureRecs.length > 0
    ? Math.round(architectureRecs.reduce((sum, r) => sum + r.score, 0) / architectureRecs.length)
    : 100;
  const debtScore = debtRecs.length > 0
    ? Math.round(debtRecs.reduce((sum, r) => sum + (100 - r.score), 0) / debtRecs.length)
    : 100;

  telemetry = {
    advisorHealth: overallHealth,
    recommendationCount: uniqueRecs.length,
    criticalRecommendations: criticalCount,
    highRecommendations: highCount,
    technicalDebtScore: debtScore,
    architectureScore: archScore,
    trendCount: trends.length,
    nextBestAction,
  };

  logger.info(
    {
      projectId: inputs.projectId,
      overallHealth,
      recommendationCount: uniqueRecs.length,
      criticalCount,
      highCount,
      nextBestAction,
    },
    "[advisor] Engineering advisory analysis completed",
  );

  return result;
}

// ─── Prompt Formatting ────────────────────────────────────────────────────────

/**
 * Format the advisory result as a prompt injection block.
 */
export function formatEngineeringAdvisor(result: EngineeringAdvisorResult): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("## Engineering Advisor");
  lines.push("");
  lines.push(`Overall Health: **${result.overallHealth}/100**`);
  lines.push("");

  if (result.recommendations.length > 0) {
    lines.push("### Top Recommendations");
    lines.push("");
    for (let i = 0; i < Math.min(result.recommendations.length, 10); i++) {
      const rec = result.recommendations[i];
      lines.push(`${i + 1}. **${rec.title}** (${rec.priority}, score: ${rec.score})`);
      lines.push(`   ${rec.description}`);
      lines.push(`   Impact: ${rec.impact} | Effort: ${rec.effort} | Confidence: ${rec.confidence} | Urgency: ${rec.urgency}`);
      lines.push("");
    }
  }

  if (result.trends.length > 0) {
    lines.push("### Trends");
    for (const t of result.trends) {
      lines.push(`- ${t}`);
    }
    lines.push("");
  }

  if (result.strengths.length > 0) {
    lines.push("### Strengths");
    for (const s of result.strengths) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  if (result.risks.length > 0) {
    lines.push("### Risks");
    for (const r of result.risks) {
      lines.push(`- ⚠ ${r}`);
    }
    lines.push("");
  }

  lines.push(`Next Best Action: **${result.nextBestAction}**`);
  lines.push("");

  return lines.join("\n");
}
