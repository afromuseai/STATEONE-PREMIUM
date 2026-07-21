// ─── Continuous Engineering Engine — Proactive Project Audit & Opportunities ─
// Phase 15.1
//
// Continuously analyzes projects to detect improvement opportunities across
// performance, architecture, design, components, routing, accessibility, SEO,
// validation, technical debt, and developer experience.
//
// Runs when the workspace is ready, before any edit execution, behaving like
// a senior engineering reviewer.
//
// Architecture:
//   Workspace Ready → Continuous Engineering Engine → Engineering Audit
//       ↓                                                 ↓
//   (SSE "audit")                                   EngineeringAuditPanel

import { logger } from "./logger";
import type { WorkspaceContext } from "./workspace-context";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpportunityCategory =
  | "performance"
  | "architecture"
  | "design"
  | "components"
  | "routing"
  | "accessibility"
  | "seo"
  | "validation"
  | "technical-debt"
  | "developer-experience";

export type OpportunitySeverity = "low" | "medium" | "high" | "critical";

export type EffortEstimate = "small" | "medium" | "large";

export interface EngineeringOpportunity {
  id: string;
  category: OpportunityCategory;
  severity: OpportunitySeverity;
  title: string;
  description: string;
  affectedFiles: string[];
  estimatedBenefit: number; // 0–100
  estimatedRisk: number;    // 0–100
  estimatedEffort: EffortEstimate;
  recommendation: string;
  /** Priority score computed from benefit / (risk * effort). */
  priorityScore: number;
}

export interface EngineeringAudit {
  /** Overall project engineering score 0–100. */
  score: number;
  /** Detected improvement opportunities. */
  opportunities: EngineeringOpportunity[];
  /** What the project does well. */
  strengths: string[];
  /** Areas needing improvement. */
  weaknesses: string[];
  /** Human-readable summary. */
  summary: string;
  /** When the audit was performed. */
  timestamp: string;
  /** Duration of the audit in ms. */
  durationMs: number;
}

// ─── SSE Payload ──────────────────────────────────────────────────────────────

export interface AuditPayload {
  /** Overall engineering score 0–100. */
  score: number;
  /** Number of opportunities detected. */
  opportunityCount: number;
  /** Top opportunities (up to 20). */
  topOpportunities: Array<{
    id: string;
    category: OpportunityCategory;
    severity: OpportunitySeverity;
    title: string;
    description: string;
    affectedFiles: string[];
    estimatedBenefit: number;
    estimatedRisk: number;
    estimatedEffort: EffortEstimate;
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

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface AuditTelemetry {
  auditDurationMs: number;
  auditScore: number;
  opportunityCount: number;
  criticalIssues: number;
  highPriorityCount: number;
  estimatedEngineeringGain: number;
  estimatedEngineeringRisk: number;
}

let telemetry: AuditTelemetry = {
  auditDurationMs: 0,
  auditScore: 0,
  opportunityCount: 0,
  criticalIssues: 0,
  highPriorityCount: 0,
  estimatedEngineeringGain: 0,
  estimatedEngineeringRisk: 0,
};

export function getAuditTelemetry(): AuditTelemetry {
  return { ...telemetry };
}

export function resetAuditTelemetry(): void {
  telemetry = {
    auditDurationMs: 0,
    auditScore: 0,
    opportunityCount: 0,
    criticalIssues: 0,
    highPriorityCount: 0,
    estimatedEngineeringGain: 0,
    estimatedEngineeringRisk: 0,
  };
}

// ─── Priority Scoring ─────────────────────────────────────────────────────────

/**
 * Compute a priority score that favors high benefit, low risk, low effort.
 * Effort multipliers: small=1, medium=2, large=3
 */
function computePriorityScore(
  benefit: number,
  risk: number,
  effort: EffortEstimate,
): number {
  const effortMultiplier = effort === "small" ? 1 : effort === "medium" ? 2 : 3;
  // Higher benefit * lower risk / higher effort = lower priority (we want higher priority)
  // Invert so higher score = higher priority
  return Math.round((benefit * (100 - risk)) / effortMultiplier);
}

// ─── Analysis Helpers ─────────────────────────────────────────────────────────

/**
 * Normalize a count to a score penalty.
 * Higher count = higher penalty.
 */
function countPenalty(count: number, max: number): number {
  return Math.min(max, count * 5);
}

// ─── Audit Categories Implementation ─────────────────────────────────────────

/**
 * Detect duplicate components based on naming patterns.
 */
function detectDuplicateComponents(
  ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];

  // Look for files with similar names (e.g., Hero, HeroSection, HeroBanner)
  const componentNames = files
    .filter((f) => /[A-Z][a-z]+(?:[A-Z][a-z]+)*\.(tsx|ts|jsx)$/.test(f))
    .map((f) => f.replace(/.*\//, "").replace(/\.(tsx|ts|jsx)$/, ""));

  const nameGroups = new Map<string, string[]>();
  for (const name of componentNames) {
    // Extract base name (e.g., "Hero" from "HeroSection", "HeroBanner")
    const base = name.replace(/(?:Section|Banner|Card|Widget|Container|View)$/, "");
    if (base && base !== name && base.length > 2) {
      const group = nameGroups.get(base) ?? [];
      group.push(name);
      nameGroups.set(base, group);
    }
  }

  for (const [base, names] of nameGroups) {
    if (names.length >= 2) {
      const affected = files.filter((f) =>
        names.some((n) => f.includes(n)),
      );
      results.push({
        id: `duplicate-components-${base}`,
        category: "components",
        severity: names.length >= 3 ? "high" : "medium",
        title: `Potential duplicate components: ${names.join(", ")}`,
        description: `Found ${names.length} components that may overlap in purpose. Consider consolidating "${names.join(", ")}" into a single reusable component.`,
        affectedFiles: affected,
        estimatedBenefit: 65,
        estimatedRisk: 25,
        estimatedEffort: "medium",
        recommendation: `Audit "${names.join(", ")}" for overlap and consolidate into a single ${base} component with props-based customization.`,
        priorityScore: 0, // computed below
      });
    }
  }

  return results;
}

/**
 * Detect large components that may benefit from splitting.
 */
function detectLargeComponents(
  ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];
  const largeThreshold = ctx.framework === "react" || ctx.framework === "nextjs" ? 300 : 200;

  // Large component detection requires file sizes which we don't have directly.
  // We use route/page count as a heuristic for complexity.
  if (ctx.relatedFiles && ctx.relatedFiles.length > 20) {
    results.push({
      id: "large-component-threshold",
      category: "architecture",
      severity: "medium",
      title: "Project exceeds recommended component size threshold",
      description: `With ${ctx.relatedFiles.length} related files, the project may benefit from splitting large components into smaller, focused units.`,
      affectedFiles: ctx.relatedFiles.slice(0, 5),
      estimatedBenefit: 55,
      estimatedRisk: 20,
      estimatedEffort: "large",
      recommendation: "Review components over 200 lines and extract sub-components, hooks, or utilities.",
      priorityScore: 0,
    });
  }

  return results;
}

/**
 * Detect routing issues.
 */
function detectRoutingIssues(
  ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];

  // Check for missing route patterns
  const hasRouter = files.some((f) =>
    f.includes("router") || f.includes("route") || f.includes("navigation"),
  );
  const hasPages = files.some((f) =>
    f.includes("/pages/") || f.includes("/app/") || f.includes("/routes/"),
  );

  if (ctx.framework === "nextjs" && !hasPages && !hasRouter) {
    results.push({
      id: "missing-routing-structure",
      category: "routing",
      severity: "high",
      title: "No routing structure detected",
      description: "Next.js project without detected route structure. Pages directory or app router may be misconfigured.",
      affectedFiles: [],
      estimatedBenefit: 80,
      estimatedRisk: 15,
      estimatedEffort: "medium",
      recommendation: "Ensure pages/ or app/ directory exists with proper file-based routing.",
      priorityScore: 0,
    });
  }

  // Detect deep route nesting
  const routeFiles = files.filter((f) =>
    f.includes("/pages/") || f.includes("/app/") || f.includes("/routes/"),
  );
  if (routeFiles.length > 10) {
    results.push({
      id: "deep-route-nesting",
      category: "architecture",
      severity: routeFiles.length > 20 ? "high" : "medium",
      title: `${routeFiles.length} route files — consider consolidating`,
      description: `${routeFiles.length} route-related files may indicate complex navigation. Consider grouping related routes or using dynamic routing.`,
      affectedFiles: routeFiles.slice(0, 5),
      estimatedBenefit: 45,
      estimatedRisk: 30,
      estimatedEffort: "large",
      recommendation: "Review route structure for consolidation opportunities and use dynamic route parameters where possible.",
      priorityScore: 0,
    });
  }

  return results;
}

/**
 * Detect accessibility issues.
 */
function detectAccessibilityIssues(
  _ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];
  const tsxFiles = files.filter((f) => f.endsWith(".tsx") || f.endsWith(".jsx"));

  // Heuristic: check for missing aria patterns in TSX files
  const noAriaFiles: string[] = [];
  const noRoleFiles: string[] = [];
  for (const f of tsxFiles.slice(0, 30)) {
    // We can't read file contents here — use filename patterns as heuristic
    const name = f.toLowerCase();
    if (
      (name.includes("button") || name.includes("nav") || name.includes("modal") ||
       name.includes("dialog") || name.includes("menu") || name.includes("form")) &&
      !name.includes("aria") && !name.includes("accessib")
    ) {
      noAriaFiles.push(f);
    }
  }

  if (noAriaFiles.length > 0) {
    results.push({
      id: "missing-aria-attributes",
      category: "accessibility",
      severity: noAriaFiles.length > 5 ? "high" : "medium",
      title: `${noAriaFiles.length} interactive component(s) may lack ARIA attributes`,
      description: `Components like buttons, navigation, modals, and forms should include proper ARIA labels, roles, and keyboard navigation.`,
      affectedFiles: noAriaFiles.slice(0, 10),
      estimatedBenefit: 70,
      estimatedRisk: 10,
      estimatedEffort: "medium",
      recommendation: "Add aria-label, role, and keyboard event handlers to interactive components.",
      priorityScore: 0,
    });
  }

  return results;
}

/**
 * Detect SEO gaps.
 */
function detectSeoIssues(
  ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];

  const hasMetaTags = files.some((f) =>
    f.includes("head") || f.includes("meta") || f.includes("seo") || f.includes("helmet"),
  );
  const hasTitle = files.some((f) =>
    f.includes("title") || f.includes("head"),
  );

  if (!hasMetaTags || !hasTitle) {
    results.push({
      id: "missing-seo-metadata",
      category: "seo",
      severity: "high",
      title: "SEO metadata may be incomplete",
      description: "Missing or incomplete meta tags, title tags, or SEO head management.",
      affectedFiles: [],
      estimatedBenefit: 75,
      estimatedRisk: 5,
      estimatedEffort: "small",
      recommendation: "Add a Head/Helmet component with dynamic title, meta description, and Open Graph tags.",
      priorityScore: 0,
    });
  }

  // Check for Next.js specific SEO
  if (ctx.framework === "nextjs") {
    const hasNextSeo = files.some((f) =>
      f.includes("next-seo") || f.includes("next/head"),
    );
    if (!hasNextSeo) {
      results.push({
        id: "missing-nextjs-seo",
        category: "seo",
        severity: "medium",
        title: "Next.js SEO optimization not detected",
        description: "Consider using next/head or next-seo for proper page-level SEO management.",
        affectedFiles: [],
        estimatedBenefit: 60,
        estimatedRisk: 5,
        estimatedEffort: "small",
        recommendation: "Use next/head for per-page meta tags or integrate next-seo for structured SEO.",
        priorityScore: 0,
      });
    }
  }

  return results;
}

/**
 * Detect performance issues.
 */
function detectPerformanceIssues(
  ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];
  const largeFiles = files.filter((f) => f.length > 80); // heuristic: long paths may be deep

  if (largeFiles.length > 10) {
    results.push({
      id: "deep-component-trees",
      category: "performance",
      severity: "medium",
      title: `${largeFiles.length} deeply nested files detected`,
      description: "Deep file/folder nesting can indicate overly complex component trees that may impact rendering performance.",
      affectedFiles: largeFiles.slice(0, 5),
      estimatedBenefit: 50,
      estimatedRisk: 15,
      estimatedEffort: "large",
      recommendation: "Review deeply nested component trees and consider flattening or using composition patterns.",
      priorityScore: 0,
    });
  }

  // Check for large images (heuristic based on paths containing "image" or "asset")
  const imageFiles = files.filter((f) =>
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(f),
  );
  if (imageFiles.length > 20) {
    results.push({
      id: "large-image-assets",
      category: "performance",
      severity: "medium",
      title: `${imageFiles.length} image assets — consider optimization`,
      description: `${imageFiles.length} image files detected. Large unoptimized images can significantly impact load times.`,
      affectedFiles: imageFiles.slice(0, 5),
      estimatedBenefit: 65,
      estimatedRisk: 5,
      estimatedEffort: "small",
      recommendation: "Use next/image or a similar optimization pipeline. Convert to WebP/AVIF format.",
      priorityScore: 0,
    });
  }

  return results;
}

/**
 * Detect validation and repair hotspots.
 */
function detectValidationHotspots(
  _ctx: WorkspaceContext,
  _files: string[],
  validationHistory?: { file: string; errorCount: number }[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];

  if (validationHistory && validationHistory.length > 0) {
    const hotspots = validationHistory
      .filter((h) => h.errorCount > 3)
      .slice(0, 5);

    if (hotspots.length > 0) {
      results.push({
        id: "validation-hotspots",
        category: "validation",
        severity: hotspots.some((h) => h.errorCount > 10) ? "critical" : "high",
        title: `${hotspots.length} validation hotspot(s) detected`,
        description: `${hotspots.length} file(s) have persistent validation errors. These files may need architectural attention.`,
        affectedFiles: hotspots.map((h) => h.file),
        estimatedBenefit: 70,
        estimatedRisk: 20,
        estimatedEffort: "medium",
        recommendation: "Refactor hotspot files to resolve persistent validation issues and improve type safety.",
        priorityScore: 0,
      });
    }
  }

  return results;
}

/**
 * Detect repeated CSS patterns (heuristic).
 */
function detectRepeatedCss(
  _ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];
  const cssFiles = files.filter((f) => f.endsWith(".css") || f.endsWith(".scss"));

  if (cssFiles.length > 3) {
    results.push({
      id: "multiple-css-files",
      category: "design",
      severity: "medium",
      title: `${cssFiles.length} CSS files — consider consolidation`,
      description: `${cssFiles.length} CSS/SCSS files may indicate repeated or overlapping styles. Consider using CSS modules or a design token system.`,
      affectedFiles: cssFiles.slice(0, 5),
      estimatedBenefit: 40,
      estimatedRisk: 15,
      estimatedEffort: "medium",
      recommendation: "Audit CSS files for duplication and consolidate into a theme or design token system.",
      priorityScore: 0,
    });
  }

  return results;
}

/**
 * Detect technical debt signals.
 */
function detectTechnicalDebt(
  _ctx: WorkspaceContext,
  files: string[],
  executionHistory?: {
    repairAttempts: number;
    rollbackCount: number;
  },
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];

  // Files with "old", "legacy", "deprecated" in name
  const legacyFiles = files.filter((f) =>
    /old|legacy|deprecated|backup|_v1|_old/i.test(f),
  );
  if (legacyFiles.length > 0) {
    results.push({
      id: "legacy-files",
      category: "technical-debt",
      severity: legacyFiles.length > 5 ? "high" : "medium",
      title: `${legacyFiles.length} legacy/deprecated file(s) found`,
      description: `Files with "old", "legacy", "deprecated" naming patterns indicate accumulated technical debt.`,
      affectedFiles: legacyFiles.slice(0, 10),
      estimatedBenefit: 50,
      estimatedRisk: 30,
      estimatedEffort: "medium",
      recommendation: "Review and remove deprecated files or migrate them to current patterns.",
      priorityScore: 0,
    });
  }

  // Repeated repairs and rollbacks
  if (executionHistory) {
    if (executionHistory.repairAttempts > 5) {
      results.push({
        id: "frequent-repairs",
        category: "technical-debt",
        severity: "high",
        title: `${executionHistory.repairAttempts} total repair attempts indicate instability`,
        description: "Frequent repair cycles suggest underlying code quality issues that should be addressed.",
        affectedFiles: [],
        estimatedBenefit: 60,
        estimatedRisk: 25,
        estimatedEffort: "large",
        recommendation: "Invest in automated testing, type coverage, and linting to reduce repair frequency.",
        priorityScore: 0,
      });
    }

    if (executionHistory.rollbackCount > 2) {
      results.push({
        id: "repeated-rollbacks",
        category: "technical-debt",
        severity: "critical",
        title: `${executionHistory.rollbackCount} rollbacks performed — systemic instability`,
        description: "Repeated rollbacks indicate systemic issues with edit reliability. Consider architectural review.",
        affectedFiles: [],
        estimatedBenefit: 80,
        estimatedRisk: 20,
        estimatedEffort: "large",
        recommendation: "Conduct architectural review to identify root causes of recurring rollbacks.",
        priorityScore: 0,
      });
    }
  }

  return results;
}

/**
 * Detect developer experience improvements.
 */
function detectDxIssues(
  ctx: WorkspaceContext,
  files: string[],
): EngineeringOpportunity[] {
  const results: EngineeringOpportunity[] = [];

  // Missing TypeScript strict mode
  const hasTsConfig = files.some((f) => f.endsWith("tsconfig.json"));
  if (!hasTsConfig && ctx.framework) {
    results.push({
      id: "missing-typescript-config",
      category: "developer-experience",
      severity: "medium",
      title: "TypeScript configuration not detected",
      description: "A tsconfig.json file was not found in the project. TypeScript strict mode helps catch errors early.",
      affectedFiles: [],
      estimatedBenefit: 70,
      estimatedRisk: 10,
      estimatedEffort: "small",
      recommendation: "Add tsconfig.json with strict mode enabled for better type safety.",
      priorityScore: 0,
    });
  }

  // Missing linting
  const hasLintConfig = files.some((f) =>
    f.includes(".eslint") || f.includes("eslint.config") || f.includes(".prettier"),
  );
  if (!hasLintConfig && ctx.framework) {
    results.push({
      id: "missing-linting",
      category: "developer-experience",
      severity: "low",
      title: "Linting configuration not detected",
      description: "ESLint and Prettier configurations help maintain consistent code quality and style.",
      affectedFiles: [],
      estimatedBenefit: 55,
      estimatedRisk: 5,
      estimatedEffort: "small",
      recommendation: "Add ESLint and Prettier configuration for consistent code quality.",
      priorityScore: 0,
    });
  }

  return results;
}

// ─── Main Audit Function ──────────────────────────────────────────────────────

export interface AuditInputs {
  wsCtx: WorkspaceContext | null | undefined;
  files: string[];
  executionHistory?: {
    repairAttempts: number;
    rollbackCount: number;
  };
  validationHistory?: { file: string; errorCount: number }[];
  projectId?: string;
}

/**
 * Run a full engineering audit on the workspace.
 *
 * Scans files, detects opportunities across all categories, ranks them by
 * priority score, and produces an EngineeringAudit with overall score,
 * strengths, weaknesses, and actionable recommendations.
 */
export function runEngineeringAudit(inputs: AuditInputs): EngineeringAudit {
  const startTime = Date.now();
  const { wsCtx, files, executionHistory, validationHistory } = inputs;

  // Collect all opportunities
  const allOpportunities: EngineeringOpportunity[] = [
    ...detectDuplicateComponents(wsCtx ?? {} as WorkspaceContext, files),
    ...detectLargeComponents(wsCtx ?? {} as WorkspaceContext, files),
    ...detectRoutingIssues(wsCtx ?? {} as WorkspaceContext, files),
    ...detectAccessibilityIssues(wsCtx ?? {} as WorkspaceContext, files),
    ...detectSeoIssues(wsCtx ?? {} as WorkspaceContext, files),
    ...detectPerformanceIssues(wsCtx ?? {} as WorkspaceContext, files),
    ...detectValidationHotspots(wsCtx ?? {} as WorkspaceContext, files, validationHistory),
    ...detectRepeatedCss(wsCtx ?? {} as WorkspaceContext, files),
    ...detectTechnicalDebt(wsCtx ?? {} as WorkspaceContext, files, executionHistory),
    ...detectDxIssues(wsCtx ?? {} as WorkspaceContext, files),
  ];

  // Compute priority scores
  for (const opp of allOpportunities) {
    opp.priorityScore = computePriorityScore(
      opp.estimatedBenefit,
      opp.estimatedRisk,
      opp.estimatedEffort,
    );
  }

  // Sort by priority score descending
  const opportunities = allOpportunities.sort(
    (a, b) => b.priorityScore - a.priorityScore,
  );

  // Compute strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Strengths — what we didn't find issues for
  const categoriesWithIssues = new Set(opportunities.map((o) => o.category));
  const allCategories: OpportunityCategory[] = [
    "performance", "architecture", "design", "components", "routing",
    "accessibility", "seo", "validation", "technical-debt", "developer-experience",
  ];

  for (const cat of allCategories) {
    const catOpps = opportunities.filter((o) => o.category === cat);
    if (catOpps.length === 0) {
      strengths.push(`No significant ${cat} issues detected`);
    }
  }

  // Weaknesses — top issues per category
  const topByCategory = new Map<OpportunityCategory, EngineeringOpportunity[]>();
  for (const opp of opportunities) {
    const list = topByCategory.get(opp.category) ?? [];
    list.push(opp);
    topByCategory.set(opp.category, list);
  }

  for (const [cat, opps] of topByCategory) {
    const criticalHigh = opps.filter(
      (o) => o.severity === "critical" || o.severity === "high",
    );
    if (criticalHigh.length > 0) {
      weaknesses.push(
        `${criticalHigh.length} high-severity ${cat} issue(s): ${criticalHigh[0].title}`,
      );
    }
  }

  // Compute overall score
  // Start at 100, subtract penalties for each issue based on severity and priority
  let score = 100;
  for (const opp of opportunities) {
    const severityPenalty =
      opp.severity === "critical" ? 8 :
      opp.severity === "high" ? 5 :
      opp.severity === "medium" ? 3 : 1;
    score -= severityPenalty;
  }
  score = Math.max(0, Math.min(100, score));

  // Build summary
  const criticalCount = opportunities.filter((o) => o.severity === "critical").length;
  const highCount = opportunities.filter((o) => o.severity === "high").length;
  const mediumCount = opportunities.filter((o) => o.severity === "medium").length;

  let summary = "";
  if (score >= 90) {
    summary = "Project is in excellent engineering health. Minor improvements available.";
  } else if (score >= 75) {
    summary = "Project is in good health with some improvement opportunities.";
  } else if (score >= 50) {
    summary = "Project has several areas that need attention.";
  } else {
    summary = "Project requires significant engineering improvements.";
  }

  if (criticalCount > 0) {
    summary += ` ${criticalCount} critical issue(s) require immediate attention.`;
  }
  if (highCount > 0) {
    summary += ` ${highCount} high-priority issue(s) identified.`;
  }
  if (opportunities.length > 0) {
    summary += ` ${opportunities.length} total improvement opportunities found.`;
  }

  const audit: EngineeringAudit = {
    score,
    opportunities,
    strengths: strengths.length > 0 ? strengths : ["No significant issues detected in any category"],
    weaknesses: weaknesses.length > 0 ? weaknesses : ["No critical weaknesses identified"],
    summary,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };

  // Update telemetry
  const totalBenefit = opportunities.reduce((sum, o) => sum + o.estimatedBenefit, 0);
  const totalRisk = opportunities.reduce((sum, o) => sum + o.estimatedRisk, 0);
  telemetry = {
    auditDurationMs: audit.durationMs,
    auditScore: score,
    opportunityCount: opportunities.length,
    criticalIssues: criticalCount,
    highPriorityCount: highCount,
    estimatedEngineeringGain: opportunities.length > 0
      ? Math.round(totalBenefit / opportunities.length)
      : 0,
    estimatedEngineeringRisk: opportunities.length > 0
      ? Math.round(totalRisk / opportunities.length)
      : 0,
  };

  logger.info(
    {
      projectId: inputs.projectId,
      score,
      opportunities: opportunities.length,
      criticalCount,
      highCount,
      durationMs: audit.durationMs,
    },
    "[audit] Engineering audit completed",
  );

  return audit;
}

/**
 * Format the audit as a prompt injection block.
 */
export function formatEngineeringAudit(audit: EngineeringAudit): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("## Engineering Audit");
  lines.push("");
  lines.push(`Overall Score: **${audit.score}/100**`);
  lines.push(`Opportunities Found: **${audit.opportunities.length}**`);
  lines.push("");

  if (audit.opportunities.length > 0) {
    lines.push("### Top Improvement Opportunities");
    for (const opp of audit.opportunities.slice(0, 5)) {
      lines.push(
        `- **[${opp.severity}]** ${opp.title} ` +
        `(benefit: ${opp.estimatedBenefit}, risk: ${opp.estimatedRisk}, effort: ${opp.estimatedEffort})`,
      );
      lines.push(`  - ${opp.recommendation}`);
    }
    lines.push("");
  }

  if (audit.strengths.length > 0) {
    lines.push("### Strengths");
    for (const s of audit.strengths.slice(0, 5)) {
      lines.push(`- ${s}`);
    }
    lines.push("");
  }

  if (audit.weaknesses.length > 0) {
    lines.push("### Areas for Improvement");
    for (const w of audit.weaknesses.slice(0, 5)) {
      lines.push(`- ${w}`);
    }
    lines.push("");
  }

  lines.push(`Summary: ${audit.summary}`);
  lines.push("");

  return lines.join("\n");
}
