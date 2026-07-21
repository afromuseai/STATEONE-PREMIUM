// ─── Product Intelligence Engine — Business & Product Impact Assessment ──────
// Phase 16.1
//
// Evaluates every engineering decision against business goals, user experience,
// branding, accessibility, SEO, and conversion.
//
// The engineering pipeline answers "Can this be built?"
// Product Intelligence answers "Should this change be made?"
//
// Pipeline position:
//   Workspace → Engineering Audit → Product Intelligence → Engineering Decision

import { logger } from "./logger";
import type { BusinessContext } from "./website-v2-types";
import type { WebsiteBlueprint } from "./website-v2-types";
import type { WorkspaceContext } from "./workspace-context";
import type { EngineeringAudit } from "./continuous-engineering-engine";
import type { EngineeringDecision } from "./engineering-decision-engine";

// ─── Product Assessment ───────────────────────────────────────────────────────

export interface ProductAssessment {
  /** Overall product intelligence score 0–100. */
  overallScore: number;
  /** Final recommendation. */
  recommendation: "approve" | "approve-with-warning" | "revise" | "reject";
  /** How well the change aligns with business goals (0–100). */
  businessAlignment: number;
  /** Impact on user experience (0–100, higher = better). */
  uxImpact: number;
  /** Impact on conversion (0–100, higher = better). */
  conversionImpact: number;
  /** Branding consistency score (0–100). */
  brandingConsistency: number;
  /** Accessibility impact score (0–100, higher = more accessible). */
  accessibilityImpact: number;
  /** SEO impact score (0–100). */
  seoImpact: number;
  /** Maintainability impact (0–100, higher = more maintainable). */
  maintainabilityImpact: number;
  /** Risk to user experience if the change is applied (0–100). */
  userRisk: number;
  /** Detailed reasoning behind the assessment. */
  reasoning: string[];
  /** Actionable improvement recommendations. */
  recommendations: string[];
  /** Warnings about potential regressions. */
  warnings: string[];
  /** How long the assessment took (ms). */
  assessmentTimeMs: number;
  /** ISO timestamp. */
  timestamp: string;
}

// ─── SSE Payload ──────────────────────────────────────────────────────────────

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

// ─── Telemetry ────────────────────────────────────────────────────────────────

export interface ProductTelemetry {
  productScore: number;
  businessAlignment: number;
  uxImpact: number;
  conversionImpact: number;
  brandingScore: number;
  seoScore: number;
  accessibilityScore: number;
  recommendation: string;
  warningCount: number;
  recommendationCount: number;
}

let telemetry: ProductTelemetry = {
  productScore: 0,
  businessAlignment: 0,
  uxImpact: 0,
  conversionImpact: 0,
  brandingScore: 0,
  seoScore: 0,
  accessibilityScore: 0,
  recommendation: "approve",
  warningCount: 0,
  recommendationCount: 0,
};

export function getProductTelemetry(): ProductTelemetry {
  return { ...telemetry };
}

export function resetProductTelemetry(): void {
  telemetry = {
    productScore: 0,
    businessAlignment: 0,
    uxImpact: 0,
    conversionImpact: 0,
    brandingScore: 0,
    seoScore: 0,
    accessibilityScore: 0,
    recommendation: "approve",
    warningCount: 0,
    recommendationCount: 0,
  };
}

// ─── Inputs ───────────────────────────────────────────────────────────────────

export interface ProductIntelligenceInputs {
  businessContext: BusinessContext;
  blueprint: WebsiteBlueprint | null;
  wsCtx: WorkspaceContext | null | undefined;
  executionPlan?: {
    strategy?: string;
    complexity?: string;
    description?: string;
    filesToModify?: Array<{ path: string }>;
  };
  engineeringDecision?: EngineeringDecision | null;
  engineeringAudit?: EngineeringAudit | null;
  validationPassed?: boolean;
  visualScore?: number;
  visualNeedsRepair?: boolean;
  confidenceScore?: number;
  userInstruction?: string;
  projectId?: string;
  /** The business idea / user request */
  instruction?: string;
}

// ─── Evaluation Helpers ───────────────────────────────────────────────────────

/** Score a value between 0 and 100 based on how close it is to a target. */
function scoreProximity(value: number, target: number): number {
  const diff = Math.abs(value - target);
  return Math.max(0, Math.min(100, 100 - diff));
}

/** Invert a score (e.g., risk → opportunity). */
function invert(score: number): number {
  return 100 - score;
}

// ─── Evaluation Categories ───────────────────────────────────────────────────

/**
 * Evaluate business alignment.
 * Does the edit support the business goal, target audience, and positioning?
 */
function evaluateBusinessAlignment(
  context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  instruction?: string,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 70; // Start at neutral

  // Business goal alignment
  if (context.businessGoal) {
    const goalKeywords = context.businessGoal.toLowerCase().split(/\s+/);
    const instructionLower = (instruction ?? "").toLowerCase();
    const matchCount = goalKeywords.filter((kw) => instructionLower.includes(kw)).length;
    if (matchCount >= 3) {
      score += 15;
      reasoning.push("Instruction aligns strongly with documented business goal.");
    } else if (matchCount >= 1) {
      score += 5;
      reasoning.push("Instruction partially aligns with business goal.");
    } else {
      score -= 10;
      reasoning.push("Instruction may not directly address business goal — verify intent.");
    }
  }

  // Target audience alignment
  if (context.targetAudience) {
    const audienceKeywords = context.targetAudience.toLowerCase().split(/\s+/);
    const instructionLower = (instruction ?? "").toLowerCase();
    const audienceMatch = audienceKeywords.filter((kw) => instructionLower.includes(kw)).length;
    if (audienceMatch > 0) {
      score += 10;
      reasoning.push("Instruction considers target audience.");
    }
  }

  // Brand positioning preservation
  if (context.brandPositioning) {
    reasoning.push("Brand positioning context is available — changes can be evaluated against it.");
    score += 5;
  }

  // Industry relevance
  if (context.industry) {
    reasoning.push(`Industry context (${context.industry}) is factored into assessment.`);
    score += 5;
  }

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate UX impact.
 * Navigation, hierarchy, visual flow, readability, CTA placement.
 */
function evaluateUxImpact(
  _context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  wsCtx?: WorkspaceContext | null,
  _instruction?: string,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 75; // Start at decent

  // Framework awareness
  if (wsCtx?.framework) {
    reasoning.push(`Built on ${wsCtx.framework} — modern UX patterns available.`);
    score += 5;
  }

  // File count as complexity heuristic
  if (wsCtx?.relatedFiles) {
    const fileCount = wsCtx.relatedFiles.length;
    if (fileCount > 50) {
      score -= 10;
      reasoning.push("Large project with many files — UX changes may have broad impact.");
    } else if (fileCount < 10) {
      reasoning.push("Focused project — UX changes can be evaluated holistically.");
      score += 5;
    }
  }

  // Check for responsive concerns
  if (wsCtx?.framework === "react" || wsCtx?.framework === "nextjs") {
    reasoning.push("Component-based architecture supports isolated UX evaluation.");
    score += 5;
  }

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate conversion impact.
 * CTA visibility, trust indicators, pricing flow, lead capture.
 */
function evaluateConversionImpact(
  context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 65;

  // Conversion goal awareness
  if (context.conversionGoal) {
    reasoning.push(`Conversion goal documented: "${context.conversionGoal}".`);
    score += 15;
  }

  // Primary CTA awareness
  if (context.biIntelligenceContext?.moduleContext?.website?.primaryCTA) {
    reasoning.push("Primary CTA is documented — can evaluate CTA-related changes.");
    score += 10;
  }

  // Check for conversion-related context
  if (context.businessGoal?.toLowerCase().includes("conversion") ||
      context.businessGoal?.toLowerCase().includes("sales") ||
      context.businessGoal?.toLowerCase().includes("revenue")) {
    reasoning.push("Business goal is conversion-oriented.");
    score += 10;
  }

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate branding consistency.
 * Colors, typography, spacing, design language.
 */
function evaluateBrandingConsistency(
  _context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  wsCtx?: WorkspaceContext | null,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 80; // Start high — existing projects have design systems

  // Check for design token / style awareness
  if (wsCtx?.designTokens?.style) {
    reasoning.push(`Design style documented (${wsCtx.designTokens.style}) — brand consistency can be verified.`);
    score += 10;
  }

  if (wsCtx?.designTokens?.colors && wsCtx.designTokens.colors.length > 0) {
    reasoning.push(`Color palette defined (${wsCtx.designTokens.colors.length} colors) — brand colors can be validated.`);
    score += 5;
  } else {
    score -= 5;
    reasoning.push("No color palette documented — brand color consistency cannot be verified automatically.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate accessibility impact.
 * Keyboard support, contrast, ARIA, focus order.
 */
function evaluateAccessibilityImpact(
  _context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  engineeringAudit?: EngineeringAudit | null,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 75;

  // Check audit for accessibility issues
  if (engineeringAudit) {
    const a11yOpps = engineeringAudit.opportunities.filter(
      (o) => o.category === "accessibility",
    );
    if (a11yOpps.length > 0) {
      score -= a11yOpps.length * 8;
      reasoning.push(`Engineering audit detected ${a11yOpps.length} accessibility issue(s) that may be affected.`);
      for (const opp of a11yOpps.slice(0, 2)) {
        reasoning.push(`  - ${opp.title}`);
      }
    } else {
      reasoning.push("No accessibility issues flagged by engineering audit.");
      score += 10;
    }
  }

  // Check for framework accessibility support
  reasoning.push("Modern component libraries provide built-in ARIA support — verify custom components.");
  score += 5;

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate SEO impact.
 * Headings, metadata, semantic HTML, links.
 */
function evaluateSeoImpact(
  _context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  engineeringAudit?: EngineeringAudit | null,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 70;

  if (engineeringAudit) {
    const seoOpps = engineeringAudit.opportunities.filter(
      (o) => o.category === "seo",
    );
    if (seoOpps.length > 0) {
      score -= seoOpps.length * 10;
      reasoning.push(`Engineering audit flagged ${seoOpps.length} SEO issue(s).`);
      for (const opp of seoOpps.slice(0, 2)) {
        reasoning.push(`  - ${opp.title}`);
      }
    } else {
      reasoning.push("No SEO issues flagged by engineering audit.");
      score += 10;
    }
  }

  // Framework SEO
  if (_context.biIntelligenceContext?.moduleContext?.website?.recommendedPages) {
    reasoning.push("Recommended pages are documented — SEO structure can be evaluated.");
    score += 10;
  }

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate maintainability impact.
 * Engineering health, code quality, technical debt.
 */
function evaluateMaintainabilityImpact(
  _context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  engineeringAudit?: EngineeringAudit | null,
  engineeringDecision?: EngineeringDecision | null,
  visualNeedsRepair?: boolean,
  confidenceScore?: number,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 75;

  // Check engineering audit health
  if (engineeringAudit) {
    if (engineeringAudit.score < 60) {
      score -= 15;
      reasoning.push("Low engineering audit score — maintenance risk is elevated.");
    } else if (engineeringAudit.score >= 85) {
      score += 10;
      reasoning.push("High engineering audit score — project is well-maintained.");
    }
  }

  // Check decision engine
  if (engineeringDecision) {
    if (engineeringDecision.recommendation === "rollback" || engineeringDecision.recommendation === "defer") {
      score -= 20;
      reasoning.push("Engineering decision recommends against proceeding — high risk.");
    } else if (engineeringDecision.recommendation === "repair-first") {
      score -= 10;
      reasoning.push("Engineering decision recommends repairs before proceeding.");
    }
  }

  // Visual health
  if (visualNeedsRepair) {
    score -= 10;
    reasoning.push("Visual verification flagged issues that need repair.");
  }

  // Confidence
  if (confidenceScore !== undefined && confidenceScore < 60) {
    score -= 10;
    reasoning.push(`Low confidence score (${confidenceScore}) — risk of regressions.`);
  } else if (confidenceScore !== undefined && confidenceScore >= 90) {
    score += 5;
    reasoning.push("High confidence score — changes are likely safe.");
  }

  return { score: Math.max(0, Math.min(100, score)), reasoning };
}

/**
 * Evaluate user risk.
 * How risky is this change for the end user?
 */
function evaluateUserRisk(
  _context: BusinessContext,
  _blueprint: WebsiteBlueprint | null,
  engineeringDecision?: EngineeringDecision | null,
  confidenceScore?: number,
  visualNeedsRepair?: boolean,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let risk = 20; // Start low

  // Decision engine
  if (engineeringDecision) {
    if (engineeringDecision.recommendation === "defer" || engineeringDecision.recommendation === "rollback") {
      risk += 40;
      reasoning.push("Engineering decision recommends significant caution.");
    } else if (engineeringDecision.recommendation === "repair-first") {
      risk += 20;
      reasoning.push("Engineering decision recommends repair-first — user-facing issues possible.");
    }
    if (engineeringDecision.estimatedRisk > 70) {
      risk += 20;
      reasoning.push(`High estimated risk (${engineeringDecision.estimatedRisk}%) from decision engine.`);
    }
  }

  // Low confidence
  if (confidenceScore !== undefined && confidenceScore < 50) {
    risk += 20;
    reasoning.push("Very low confidence — high risk of negative user impact.");
  } else if (confidenceScore !== undefined && confidenceScore < 70) {
    risk += 10;
    reasoning.push("Moderate confidence — some risk of regressions.");
  }

  // Visual issues
  if (visualNeedsRepair) {
    risk += 15;
    reasoning.push("Visual issues detected — user-facing regressions are likely.");
  }

  return { score: Math.max(0, Math.min(100, risk)), reasoning };
}

// ─── Main Assessment Function ─────────────────────────────────────────────────

/**
 * Run a full product intelligence assessment.
 *
 * Evaluates the proposed change across 8 dimensions and produces a
 * recommendation with actionable feedback.
 */
export function evaluateProductIntelligence(
  inputs: ProductIntelligenceInputs,
): ProductAssessment {
  const startTime = Date.now();
  const {
    businessContext,
    blueprint,
    wsCtx,
    engineeringDecision,
    engineeringAudit,
    visualNeedsRepair,
    confidenceScore,
    instruction,
  } = inputs;

  // ── Evaluate each dimension ─────────────────────────────────────────────
  const business = evaluateBusinessAlignment(businessContext, blueprint, instruction);
  const ux = evaluateUxImpact(businessContext, blueprint, wsCtx, instruction);
  const conversion = evaluateConversionImpact(businessContext, blueprint);
  const branding = evaluateBrandingConsistency(businessContext, blueprint, wsCtx);
  const accessibility = evaluateAccessibilityImpact(businessContext, blueprint, engineeringAudit);
  const seo = evaluateSeoImpact(businessContext, blueprint, engineeringAudit);
  const maintainability = evaluateMaintainabilityImpact(
    businessContext, blueprint, engineeringAudit, engineeringDecision, visualNeedsRepair, confidenceScore,
  );
  const userRisk = evaluateUserRisk(businessContext, blueprint, engineeringDecision, confidenceScore, visualNeedsRepair);

  // ── Compute overall score ───────────────────────────────────────────────
  // Weighted: business 25%, ux 20%, conversion 15%, branding 10%,
  // accessibility 10%, seo 5%, maintainability 10%, userRisk 5% (inverted)
  const overallScore = Math.round(
    (business.score * 0.25) +
    (ux.score * 0.20) +
    (conversion.score * 0.15) +
    (branding.score * 0.10) +
    (accessibility.score * 0.10) +
    (seo.score * 0.05) +
    (maintainability.score * 0.10) +
    (invert(userRisk.score) * 0.05)
  );

  // ── Determine recommendation ────────────────────────────────────────────
  let recommendation: ProductAssessment["recommendation"] = "approve";
  const warnings: string[] = [];
  const recommendations: string[] = [];

  if (business.score < 40) {
    recommendation = "reject";
    warnings.push("Business alignment is critically low — this change does not support business goals.");
  } else if (overallScore < 50) {
    recommendation = "reject";
    warnings.push("Overall product score is too low to proceed.");
  } else if (business.score < 60) {
    recommendation = "revise";
    warnings.push("Business alignment is below threshold — revise to better support business goals.");
    recommendations.push("Revisit the instruction to ensure it aligns with the documented business goal.");
  } else if (conversion.score < 50) {
    recommendation = "approve-with-warning";
    warnings.push("Conversion impact is low — the change may not improve business outcomes.");
    recommendations.push("Consider adding CTA or conversion-focused elements.");
  } else if (overallScore < 70) {
    recommendation = "revise";
    warnings.push("Overall product score is moderate — some dimensions need improvement.");
  } else if (userRisk.score > 70) {
    recommendation = "approve-with-warning";
    warnings.push("User risk is elevated — monitor for regressions after deployment.");
    recommendations.push("Run manual QA on affected pages after applying changes.");
  } else if (overallScore >= 85) {
    recommendation = "approve";
    recommendations.push("Change is well-aligned with product goals. Proceed with confidence.");
  }

  // Additional warnings from sub-evaluations
  if (maintainability.score < 50) {
    warnings.push("Maintainability impact is concerning — consider refactoring first.");
  }
  if (accessibility.score < 50) {
    warnings.push("Accessibility score is low — verify ARIA, contrast, and keyboard support.");
    recommendations.push("Run an accessibility audit on changed components.");
  }
  if (seo.score < 50) {
    warnings.push("SEO impact may be negative — verify heading structure and metadata.");
    recommendations.push("Ensure proper heading hierarchy and meta tags are preserved.");
  }

  // ── Collect reasoning ──────────────────────────────────────────────────
  const reasoning = [
    ...business.reasoning.map((r) => `[Business] ${r}`),
    ...ux.reasoning.map((r) => `[UX] ${r}`),
    ...conversion.reasoning.map((r) => `[Conversion] ${r}`),
    ...branding.reasoning.map((r) => `[Brand] ${r}`),
    ...accessibility.reasoning.map((r) => `[Accessibility] ${r}`),
    ...seo.reasoning.map((r) => `[SEO] ${r}`),
    ...maintainability.reasoning.map((r) => `[Maintainability] ${r}`),
    ...userRisk.reasoning.map((r) => `[Risk] ${r}`),
  ];

  // Deduplicate reasoning
  const uniqueReasoning = [...new Set(reasoning)];

  const assessment: ProductAssessment = {
    overallScore,
    recommendation,
    businessAlignment: business.score,
    uxImpact: ux.score,
    conversionImpact: conversion.score,
    brandingConsistency: branding.score,
    accessibilityImpact: accessibility.score,
    seoImpact: seo.score,
    maintainabilityImpact: maintainability.score,
    userRisk: userRisk.score,
    reasoning: uniqueReasoning,
    recommendations,
    warnings,
    assessmentTimeMs: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };

  // ── Update telemetry ────────────────────────────────────────────────────
  telemetry = {
    productScore: overallScore,
    businessAlignment: business.score,
    uxImpact: ux.score,
    conversionImpact: conversion.score,
    brandingScore: branding.score,
    seoScore: seo.score,
    accessibilityScore: accessibility.score,
    recommendation,
    warningCount: warnings.length,
    recommendationCount: recommendations.length,
  };

  logger.info(
    {
      projectId: inputs.projectId,
      overallScore,
      recommendation,
      businessAlignment: business.score,
      uxImpact: ux.score,
      assessmentTimeMs: assessment.assessmentTimeMs,
    },
    "[product] Product intelligence assessment completed",
  );

  return assessment;
}

// ─── Prompt Formatting ────────────────────────────────────────────────────────

/**
 * Format the assessment as a prompt injection block.
 */
export function formatProductAssessment(assessment: ProductAssessment): string {
  const lines: string[] = [];
  lines.push("");
  lines.push("## Product Assessment");
  lines.push("");
  lines.push(`Overall Score: **${assessment.overallScore}/100**`);
  lines.push(`Recommendation: **${assessment.recommendation}**`);
  lines.push("");
  lines.push("### Dimension Scores");
  lines.push(`- Business Alignment: **${assessment.businessAlignment}**`);
  lines.push(`- UX Impact: **${assessment.uxImpact}**`);
  lines.push(`- Conversion Impact: **${assessment.conversionImpact}**`);
  lines.push(`- Branding Consistency: **${assessment.brandingConsistency}**`);
  lines.push(`- Accessibility Impact: **${assessment.accessibilityImpact}**`);
  lines.push(`- SEO Impact: **${assessment.seoImpact}**`);
  lines.push(`- Maintainability Impact: **${assessment.maintainabilityImpact}**`);
  lines.push(`- User Risk: **${assessment.userRisk}**`);
  lines.push("");

  if (assessment.warnings.length > 0) {
    lines.push("### Warnings");
    for (const w of assessment.warnings) {
      lines.push(`- ⚠ ${w}`);
    }
    lines.push("");
  }

  if (assessment.recommendations.length > 0) {
    lines.push("### Recommendations");
    for (const r of assessment.recommendations) {
      lines.push(`- ${r}`);
    }
    lines.push("");
  }

  lines.push(`*Assessment completed in ${assessment.assessmentTimeMs}ms*`);
  lines.push("");

  return lines.join("\n");
}
